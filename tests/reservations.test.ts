/**
 * Tests für die Reservierungslogik (/api/reserve).
 *
 * Beweist: Nur aktive Reservierungen (expiresAt > now) anderer Sessions
 * blockieren Bestand — abgelaufene werden aufgeräumt und zählen nicht.
 * Reicht der freie Bestand nicht, wird mit 409 abgelehnt.
 * Nr. 145: Ohne buchbaren Abholtermin (kaufSperre, Register N24) reserviert die
 * Route nichts — 409 mit dem Titel aus kaufSperreHinweis, geprüft nach der Pause
 * und vor dem Bestand.
 *
 * Nr. 150 (Register S17 Punkt 1): /api/reserve und /api/warenkorb/pruefen
 * zählen in Produktion über alle Instanzen in DENSELBEN Zähler je IP
 * (`reserveIp`, 20 je Minute). Die 21. Anfrage über beide Wege zusammen
 * bekommt 429 mit Retry-After bis zum Fensterende, und nichts wird gehalten;
 * die Bremse sitzt nach dem Parsen und vor jeder Hof-Prüfung.
 *
 * Nr. 169 (Register N28): DELETE /api/reserve gibt den Halt DIESER Sitzung für
 * DIESES Produkt frei (`loescheHalte`), antwortet immer 200 { ok: true } — ob es
 * einen Halt gab oder nicht —, 400 bei kaputtem Körper, 500 bei Datenbankfehler;
 * es zählt im selben Zähler `reserveIp` wie Reservieren und Prüfen.
 *
 * Prisma ist gemockt — keine DB-Zugriffe. Die Zählung der zweiten Stufe
 * stellt eine Attrappe von `$queryRaw` (ein Zähler je Schlüssel); echt prüft
 * sie tests/integration/bremse-datenbank.int.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    // Keine Notbremse (Nr. 189): die Zeile der Einstellung fehlt.
    plattformEinstellung: { findUnique: vi.fn(async () => null) },
    $queryRaw: vi.fn(),
    stockReservation: { deleteMany: vi.fn(), aggregate: vi.fn(), upsert: vi.fn() },
    product: { findUnique: vi.fn() },
  },
}))

// Die erste Stufe (Speicher je Instanz) lässt hier durch, damit die zweite
// allein entscheidet — ihre eigenen Tests stehen in tests/rate-limit*.test.ts.
vi.mock('@/lib/rate-limit', async (original) => ({
  ...(await original<typeof import('@/lib/rate-limit')>()),
  enforceRateLimit: vi.fn(() => null),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
// Der Abgleich im Warenkorb hat eigene Tests (warenkorb-*.test.ts); hier zählt
// nur, ob /api/warenkorb/pruefen bis zum Erneuern der Halte kommt. Die
// Prüfkette des Hofs (pruefeKaufbarkeitHof, Nr. 165) läuft für /api/reserve
// echt — die Fälle unten prüfen sie über die Route.
vi.mock('@/server/warenkorb', async (original) => ({
  ...(await original<typeof import('@/server/warenkorb')>()),
  hofSperrenFuerProdukte: vi.fn(async () => new Map()),
  pruefeSitzungsWarenkorb: vi.fn(async () => ({
    befund: { positionen: [], etwasAbgelaufen: false, etwasGeaendert: false },
    meldung: null,
    berichtigt: [],
  })),
  erneuereHalte: vi.fn(async () => null),
  loescheHalte: vi.fn(async () => undefined),
}))

// Die Freigabe verwaister Bestellungen hat eigene Tests
// (tests/integration/verwaiste-bestellungen.int.test.ts); hier zählt nur die Reservierung.
vi.mock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteFreiFuerProdukte: vi.fn() }))
// Die Zählung der vollen Tage hat eigene Tests (tests/integration/volle-abholfenster.int.test.ts); hier ist sie gestellt,
// der Rest des Moduls (alsAbholFenster, fensterSchluessel) läuft echt.
vi.mock('@/server/abholfenster', async (original) => ({
  ...(await original<typeof import('@/server/abholfenster')>()),
  ausgebuchteTage: vi.fn(async () => new Map()),
}))

import { DELETE, POST } from '@/app/api/reserve/route'
import { POST as pruefenPOST } from '@/app/api/warenkorb/pruefen/route'
import { prisma } from '@/lib/prisma'
import { erneuereHalte, loescheHalte } from '@/server/warenkorb'
import { gibVerwaisteFreiFuerProdukte } from '@/server/verwaiste-bestellungen'
import { DB_BREMSEN, ZU_VIELE_ANFRAGEN, bremsSchluessel } from '@/lib/bremse-datenbank'
import { ausgebuchteTage, fensterSchluessel } from '@/server/abholfenster'
import { FARM_ARCHIVED_MESSAGE } from '@/lib/farm-archive'
import { SHOP_PAUSED_MESSAGE } from '@/lib/shop-pause'

const deleteMany = vi.mocked(prisma.stockReservation.deleteMany)
const aggregate = vi.mocked(prisma.stockReservation.aggregate)
const upsert = vi.mocked(prisma.stockReservation.upsert)
const productFindUnique = vi.mocked(prisma.product.findUnique)
const volleTage = vi.mocked(ausgebuchteTage)

// Eine aktive Abholzeit ohne Höchstzahl: Ohne volle Tage ist der Hof bestellbar.
const MITTWOCH = { dayOfWeek: 3, startTime: '15:00', endTime: '18:00' }
const HOF = {
  id: 'farm_test',
  name: 'Testhof A',
  isPaused: false,
  archivedAt: null,
  approvedAt: new Date('2026-01-01T00:00:00.000Z'),
  pickupSlots: [MITTWOCH],
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/reserve', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const validBody = { productId: 'prod_1', quantity: 6, sessionId: 'sess_a' }

beforeEach(() => {
  vi.clearAllMocks()
  deleteMany.mockResolvedValue({ count: 0 } as never)
  // farm kommt seit shop-pause über den Join mit — Shop hier aktiv,
  // damit diese Tests weiterhin die reine Bestandslogik prüfen
  productFindUnique.mockResolvedValue({
    stock: 10,
    isAvailable: true,
    farm: HOF,
  } as never)
  aggregate.mockResolvedValue({ _sum: { quantity: null } } as never)
  upsert.mockResolvedValue({} as never)
  // Ohne volle Tage — ein Fall mit vollen stellt sie selbst.
  volleTage.mockResolvedValue(new Map())
})

describe('Verfügbarkeitsberechnung', () => {
  it('reserviert, wenn Bestand minus aktive Fremd-Reservierungen reicht (10 − 4 ≥ 6)', async () => {
    aggregate.mockResolvedValue({ _sum: { quantity: 4 } } as never)

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(typeof json.expiresAt).toBe('string')
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId_sessionId: { productId: 'prod_1', sessionId: 'sess_a' } },
        create: expect.objectContaining({ quantity: 6 }),
        update: expect.objectContaining({ quantity: 6 }),
      })
    )
  })

  it('lehnt ab, wenn aktive Fremd-Reservierungen den Bestand aufbrauchen (10 − 4 < 7)', async () => {
    aggregate.mockResolvedValue({ _sum: { quantity: 4 } } as never)

    const res = await POST(makeRequest({ ...validBody, quantity: 7 }))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('Nur noch 6 verfügbar')
    expect(upsert).not.toHaveBeenCalled()
  })

  it('zählt nur Reservierungen mit expiresAt > now — abgelaufene blockieren nicht', async () => {
    // Keine aktiven Reservierungen (die abgelaufenen wurden gelöscht bzw. herausgefiltert)
    aggregate.mockResolvedValue({ _sum: { quantity: null } } as never)

    const res = await POST(makeRequest({ ...validBody, quantity: 10 }))

    expect(res.status).toBe(200)
    // Abgelaufene werden vorab aufgeräumt (expiresAt < now)…
    expect(deleteMany).toHaveBeenCalledWith({
      where: { productId: 'prod_1', expiresAt: { lt: expect.any(Date) } },
    })
    // …und die Verfügbarkeit zählt ausschließlich aktive Fremd-Reservierungen
    expect(aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessionId: { not: 'sess_a' },
          expiresAt: { gt: expect.any(Date) },
        }),
      })
    )
  })

  it('eigene Session blockiert sich nicht selbst (Upsert statt Addition)', async () => {
    aggregate.mockResolvedValue({ _sum: { quantity: 4 } } as never)

    await POST(makeRequest(validBody))

    // Die Aggregation schließt die eigene Session explizit aus
    expect(aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sessionId: { not: 'sess_a' } }),
      })
    )
  })

  it('negative Verfügbarkeit wird als 0 gemeldet', async () => {
    aggregate.mockResolvedValue({ _sum: { quantity: 15 } } as never)

    const res = await POST(makeRequest({ ...validBody, quantity: 1 }))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('Nur noch 0 verfügbar')
  })
})

describe('Randfälle', () => {
  it('lehnt nicht vorhandene Produkte mit 409 ab', async () => {
    productFindUnique.mockResolvedValue(null)

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(409)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('lehnt deaktivierte Produkte mit 409 ab', async () => {
    productFindUnique.mockResolvedValue({ stock: 10, isAvailable: false } as never)

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(409)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('lehnt ungültige Parameter mit 400 ab (quantity 0)', async () => {
    const res = await POST(makeRequest({ ...validBody, quantity: 0 }))

    expect(res.status).toBe(400)
    expect(productFindUnique).not.toHaveBeenCalled()
  })

  it('lehnt mehr als 10.000 Stück mit 400 und verständlichem Text ab', async () => {
    const res = await POST(makeRequest({ ...validBody, quantity: 10_001 }))

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Bitte eine Menge bis 10.000.' })
    expect(productFindUnique).not.toHaveBeenCalled()
  })

  it('nimmt genau 10.000 Stück noch an', async () => {
    productFindUnique.mockResolvedValue({
      stock: 20_000,
      isAvailable: true,
      farm: HOF,
    } as never)

    const res = await POST(makeRequest({ ...validBody, quantity: 10_000 }))

    expect(res.status).toBe(200)
  })

  it('lehnt ungültiges JSON mit 400 ab', async () => {
    const req = new NextRequest('http://localhost/api/reserve', {
      method: 'POST',
      body: 'kein json',
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
  })
})

describe('Kaufsperre (Nr. 145, Register N24): ohne buchbaren Abholtermin wird nichts reserviert', () => {
  // Montag, 19. Oktober 2026, 10:00 Uhr in Wien. Im Vorlauf liegen die Mittwoche 21. und 28. Oktober.
  const JETZT = new Date('2026-10-19T08:00:00.000Z')

  beforeEach(() => {
    vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function hof(farm: Partial<typeof HOF> & { pickupSlots?: typeof HOF.pickupSlots }) {
    productFindUnique.mockResolvedValue({ stock: 10, isAvailable: true, farm: { ...HOF, ...farm } } as never)
  }

  function alleMittwocheVoll() {
    volleTage.mockResolvedValue(
      new Map([['farm_test', new Map([[fensterSchluessel(MITTWOCH), { ...MITTWOCH, ausgebuchtAm: ['2026-10-21', '2026-10-28'] }]])]])
    )
  }

  it('keine aktive Abholzeit: 409 „Noch nicht bestellbar.“, kein upsert', async () => {
    hof({ pickupSlots: [] })

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('Noch nicht bestellbar.')
    expect(upsert).not.toHaveBeenCalled()
  })

  it('alle Termine im Vorlauf voll: 409 „Gerade ausgebucht.“, kein upsert', async () => {
    alleMittwocheVoll()

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('Gerade ausgebucht.')
    expect(upsert).not.toHaveBeenCalled()
    // Gezählt wird für den Hof des Produkts, mit dem Zeitpunkt der Anfrage — wie die Kasse.
    expect(volleTage).toHaveBeenCalledWith(['farm_test'], JETZT)
  })

  it('Gegenprobe: mit freiem Termin 200 und upsert', async () => {
    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(200)
    expect(upsert).toHaveBeenCalledTimes(1)
  })

  it('Gegenprobe: ein freier Mittwoch genügt — nur der 21. voll, der 28. frei', async () => {
    volleTage.mockResolvedValue(
      new Map([['farm_test', new Map([[fensterSchluessel(MITTWOCH), { ...MITTWOCH, ausgebuchtAm: ['2026-10-21'] }]])]])
    )

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(200)
    expect(upsert).toHaveBeenCalledTimes(1)
  })

  it('die Sperre kommt vor dem Bestand: kein Blick auf fremde Reservierungen', async () => {
    hof({ pickupSlots: [] })

    await POST(makeRequest(validBody))

    expect(aggregate).not.toHaveBeenCalled()
  })

  it('Reihenfolge: stillgelegt und ohne Abholzeit bekommt die Meldung der Stilllegung', async () => {
    hof({ pickupSlots: [], archivedAt: new Date('2026-09-01T00:00:00.000Z') as never })

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(FARM_ARCHIVED_MESSAGE)
  })

  it('Reihenfolge: pausiert und ohne Abholzeit bekommt die Meldung der Pause', async () => {
    hof({ pickupSlots: [], isPaused: true })

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(SHOP_PAUSED_MESSAGE)
    expect(volleTage).not.toHaveBeenCalled()
  })

  it('das Select lädt vom Hof id, name und nur die aktiven Abholzeiten', async () => {
    await POST(makeRequest(validBody))

    const arg = productFindUnique.mock.calls[0][0] as { select: { farm: { select: Record<string, unknown> } } }
    expect(arg.select.farm.select).toMatchObject({
      id: true,
      name: true,
      pickupSlots: { where: { isActive: true }, select: { dayOfWeek: true, startTime: true, endTime: true } },
    })
  })
})

describe('Bremse über alle Instanzen (Nr. 150, Register S17 Punkt 1)', () => {
  // Mitten in einem Minutenfenster: noch 30 Sekunden bis zum Ende.
  const JETZT = new Date('2026-10-19T08:00:30.000Z')
  const IP = '203.0.113.9'
  const queryRaw = vi.mocked(prisma.$queryRaw)
  let staende: Map<string, number>

  /** Die Attrappe zählt je Schlüssel hoch wie das INSERT … ON CONFLICT — ein Speicher für „alle Instanzen". */
  function datenbankZaehlt(vorab = 0) {
    staende = new Map()
    queryRaw.mockImplementation((async (...args: unknown[]) => {
      const werte = (args[1] as { values: unknown[] }).values
      const schluessel = werte.filter((w): w is string => typeof w === 'string')
      return schluessel.map((s) => {
        const stand = (staende.get(s) ?? vorab) + 1
        staende.set(s, stand)
        return { schluessel: s, zaehler: stand }
      })
    }) as never)
  }

  function reservieren(ip = IP) {
    return new NextRequest('http://localhost/api/reserve', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    })
  }

  function pruefen(ip = IP) {
    return new NextRequest('http://localhost/api/warenkorb/pruefen', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess_a', items: [{ productId: 'prod_1', quantity: 2 }] }),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    })
  }

  beforeEach(() => {
    vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
    vi.stubEnv('NODE_ENV', 'production')
    datenbankZaehlt()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('beide Wege zählen zusammen: 20 gehen durch, die 21. bekommt 429 und hält nichts', async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await POST(reservieren())).status).toBe(200)
      expect((await pruefenPOST(pruefen())).status).toBe(200)
    }
    expect(upsert).toHaveBeenCalledTimes(10)
    expect(erneuereHalte).toHaveBeenCalledTimes(10)
    // Ein einziger Schlüssel für beide Routen — Zweck im Klartext, die IP nur als HMAC.
    expect([...staende.keys()]).toHaveLength(1)
    expect([...staende.keys()][0]).toMatch(/^reserve-ip:[0-9a-f]{32}$/)

    const res = await POST(reservieren())
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('30')
    expect(await res.json()).toEqual({ error: ZU_VIELE_ANFRAGEN })
    expect(upsert).toHaveBeenCalledTimes(10)

    const res2 = await pruefenPOST(pruefen())
    expect(res2.status).toBe(429)
    expect(res2.headers.get('Retry-After')).toBe('30')
    expect(erneuereHalte).toHaveBeenCalledTimes(10)
  })

  it('Gegenprobe: eine andere Adresse hat ihren eigenen Zähler', async () => {
    // Die erste Adresse hat ihre 20 im Fenster schon verbraucht.
    staende.set(bremsSchluessel(process.env.BETTER_AUTH_SECRET!, DB_BREMSEN.reserveIp.zweck, IP), 20)
    expect((await POST(reservieren())).status).toBe(429)
    expect((await POST(reservieren('203.0.113.10'))).status).toBe(200)
    expect(upsert).toHaveBeenCalledTimes(1)
  })

  it('Reihenfolge: ein stillgelegter Hof bei voller Bremse bekommt 429 — vor Fristfreigabe und Hof-Lesen', async () => {
    datenbankZaehlt(20)
    productFindUnique.mockResolvedValue({
      stock: 10,
      isAvailable: true,
      farm: { ...HOF, archivedAt: new Date('2026-09-01T00:00:00.000Z') },
    } as never)

    const res = await POST(reservieren())

    expect(res.status).toBe(429)
    expect(gibVerwaisteFreiFuerProdukte).not.toHaveBeenCalled()
    expect(deleteMany).not.toHaveBeenCalled()
    expect(productFindUnique).not.toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
  })

  it('Gegenprobe: derselbe stillgelegte Hof mit freier Bremse bekommt die Meldung der Stilllegung', async () => {
    datenbankZaehlt(19)
    productFindUnique.mockResolvedValue({
      stock: 10,
      isAvailable: true,
      farm: { ...HOF, archivedAt: new Date('2026-09-01T00:00:00.000Z') },
    } as never)

    const res = await POST(reservieren())

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(FARM_ARCHIVED_MESSAGE)
  })

  it('pruefen bei voller Bremse: 429 vor der Fristfreigabe, kein Erneuern der Halte', async () => {
    datenbankZaehlt(20)

    const res = await pruefenPOST(pruefen())

    expect(res.status).toBe(429)
    expect(gibVerwaisteFreiFuerProdukte).not.toHaveBeenCalled()
    expect(erneuereHalte).not.toHaveBeenCalled()
  })

  it('ungültige Anfragen zählen nicht: erst parsen, dann bremsen', async () => {
    const kaputt = new NextRequest('http://localhost/api/reserve', {
      method: 'POST',
      body: JSON.stringify({ ...validBody, quantity: 0 }),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': IP },
    })
    expect((await POST(kaputt)).status).toBe(400)
    expect(queryRaw).not.toHaveBeenCalled()
  })

  it('außerhalb der Produktion keine zweite Stufe — keine Abfrage', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    datenbankZaehlt(20)
    expect((await POST(reservieren())).status).toBe(200)
    expect((await pruefenPOST(pruefen())).status).toBe(200)
    expect(queryRaw).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/reserve — Entfernen gibt den Halt frei (Nr. 169, Register N28)', () => {
  function freigeben(body: unknown, ip = '198.51.100.7') {
    return new NextRequest('http://localhost/api/reserve', {
      method: 'DELETE',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    })
  }

  it('löscht nur den Halt dieser Sitzung für dieses Produkt und antwortet 200 { ok: true }', async () => {
    const res = await DELETE(freigeben({ productId: 'prod_1', sessionId: 'sess_a' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(vi.mocked(loescheHalte)).toHaveBeenCalledWith(['prod_1'], 'sess_a')
    // Kein Aufräumen fremder Halte, keine Fristfreigabe, keine Prüfkette.
    expect(deleteMany).not.toHaveBeenCalled()
    expect(gibVerwaisteFreiFuerProdukte).not.toHaveBeenCalled()
    expect(productFindUnique).not.toHaveBeenCalled()
  })

  it('ohne Halt dieselbe Antwort — sie verrät nicht, ob es einen gab', async () => {
    vi.mocked(loescheHalte).mockResolvedValueOnce(undefined)
    const res = await DELETE(freigeben({ productId: 'prod_ohne_halt', sessionId: 'sess_b' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('kaputter Körper: 400, nichts gelöscht', async () => {
    for (const body of ['{kein json', { productId: 'prod_1' }, { productId: '', sessionId: 'sess_a' }, { sessionId: 'sess_a' }]) {
      expect((await DELETE(freigeben(body))).status).toBe(400)
    }
    expect(vi.mocked(loescheHalte)).not.toHaveBeenCalled()
  })

  it('Datenbankfehler: 500 wie bei POST', async () => {
    vi.mocked(loescheHalte).mockRejectedValueOnce(new Error('DB weg'))
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await DELETE(freigeben({ productId: 'prod_1', sessionId: 'sess_a' }))
    expect(res.status).toBe(500)
    fehler.mockRestore()
  })

  describe('im selben Zähler reserveIp (Register S17 Punkt 1)', () => {
    const queryRaw = vi.mocked(prisma.$queryRaw)
    beforeEach(() => {
      vi.useFakeTimers({ now: new Date('2026-10-14T09:00:30.000Z'), toFake: ['Date'] })
      vi.stubEnv('NODE_ENV', 'production')
    })
    afterEach(() => {
      vi.useRealTimers()
      vi.unstubAllEnvs()
    })

    it('volle Bremse: 429, nichts gelöscht', async () => {
      queryRaw.mockImplementation((async (...args: unknown[]) => {
        const werte = (args[1] as { values: unknown[] }).values
        return werte.filter((w): w is string => typeof w === 'string').map((s) => ({ schluessel: s, zaehler: 21 }))
      }) as never)

      const res = await DELETE(freigeben({ productId: 'prod_1', sessionId: 'sess_a' }))

      expect(res.status).toBe(429)
      expect(await res.json()).toEqual({ error: ZU_VIELE_ANFRAGEN })
      expect(vi.mocked(loescheHalte)).not.toHaveBeenCalled()
      // Derselbe Zweck wie Reservieren und Prüfen.
      const werte = (queryRaw.mock.calls[0][1] as unknown as { values: unknown[] }).values
      expect(werte.some((w) => typeof w === 'string' && w.startsWith(`${DB_BREMSEN.reserveIp.zweck}:`))).toBe(true)
    })

    it('Gegenprobe: freie Bremse — gelöscht', async () => {
      queryRaw.mockImplementation((async (...args: unknown[]) => {
        const werte = (args[1] as { values: unknown[] }).values
        return werte.filter((w): w is string => typeof w === 'string').map((s) => ({ schluessel: s, zaehler: 1 }))
      }) as never)

      expect((await DELETE(freigeben({ productId: 'prod_1', sessionId: 'sess_a' }))).status).toBe(200)
      expect(vi.mocked(loescheHalte)).toHaveBeenCalledTimes(1)
    })

    it('kaputter Körper zählt nicht: erst parsen, dann bremsen', async () => {
      expect((await DELETE(freigeben({ sessionId: 'sess_a' }))).status).toBe(400)
      expect(queryRaw).not.toHaveBeenCalled()
    })
  })
})
