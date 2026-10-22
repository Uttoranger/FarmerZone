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
 * Prisma ist gemockt — keine DB-Zugriffe.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    stockReservation: { deleteMany: vi.fn(), aggregate: vi.fn(), upsert: vi.fn() },
    product: { findUnique: vi.fn() },
  },
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

import { POST } from '@/app/api/reserve/route'
import { prisma } from '@/lib/prisma'
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
