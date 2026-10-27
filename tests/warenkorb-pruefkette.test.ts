/**
 * /api/warenkorb/pruefen prüft die Höfe mit derselben Kette wie /api/reserve
 * (Nr. 165, Register N24 Ergänzung 24.10.2026).
 *
 * Beweist:
 *  - `pruefeKaufbarkeitHof` liefert in der Reihenfolge Stilllegung →
 *    Freischaltung → Sperre des Teams (Nr. 187) → Pause → Kaufsperre den ersten Grund mit dem Text, den
 *    /api/reserve schon heute meldet, sonst null; die vollen Tage zählt sie
 *    nur für einen Hof, der die ersten drei Prüfungen besteht.
 *  - Besteht ein Hof nicht, erneuert der Warenkorb bei ihm keinen Halt, löscht
 *    ALLE Halte der Sitzung bei ihm (auch den eines Produkts, das die Anfrage
 *    nicht mehr mitschickt; Gegenprobe beim bestellbaren Hof) und nennt den Grund in der Meldung; die
 *    Position gilt als nicht möglich. Gegenprobe: ein bestellbarer Hof behält
 *    seinen Halt.
 *  - Gemischter Korb mit zwei Höfen: nur der gesperrte entfällt.
 *  - `quantity` über `MAX_MENGE` → 400, genau `MAX_MENGE` geht noch.
 *
 * Prisma ist gemockt, die Regeln laufen echt; die Zählung der vollen Tage ist
 * gestellt (echt in tests/integration/volle-abholfenster.int.test.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn(() => null) }))
vi.mock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteFreiFuerProdukte: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    // Keine Notbremse (Nr. 189): die Zeile der Einstellung fehlt.
    plattformEinstellung: { findUnique: vi.fn(async () => null) },
    product: { findMany: vi.fn() },
    stockReservation: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
}))
vi.mock('@/server/abholfenster', async (original) => ({
  ...(await original<typeof import('@/server/abholfenster')>()),
  ausgebuchteTage: vi.fn(async () => new Map()),
}))

import { POST } from '@/app/api/warenkorb/pruefen/route'
import { prisma } from '@/lib/prisma'
import { ausgebuchteTage, fensterSchluessel } from '@/server/abholfenster'
import { pruefeKaufbarkeitHof } from '@/server/warenkorb'
import { MAX_MENGE } from '@/lib/reservierung'
import { SHOP_PAUSED_MESSAGE } from '@/lib/shop-pause'
import { FARM_ARCHIVED_MESSAGE } from '@/lib/farm-archive'
import { FARM_NOT_APPROVED_MESSAGE } from '@/lib/farm-approval'
import { HOF_GESPERRT_SATZ, kaufSperreHinweis } from '@/lib/bereiche-anzeige'

// Montag, 19. Oktober 2026, 10:00 Uhr in Wien. Im Vorlauf liegen die Mittwoche 21. und 28. Oktober.
const JETZT = new Date('2026-10-19T08:00:00.000Z')
const MITTWOCH = { dayOfWeek: 3, startTime: '15:00', endTime: '18:00' }
const SITZUNG = 'sitzung-1'

type Hof = {
  id: string
  name: string
  isPaused: boolean
  archivedAt: Date | null
  approvedAt: Date | null
  adminGesperrtAm: Date | null
  pickupSlots: (typeof MITTWOCH)[]
}

type Abweichung = Partial<Omit<Hof, 'pickupSlots'>> & { pickupSlots?: readonly (typeof MITTWOCH)[] }

function hof(id: string, abweichung: Abweichung = {}): Hof {
  return {
    id,
    name: `Testhof ${id}`,
    isPaused: false,
    archivedAt: null,
    approvedAt: new Date('2026-01-01T00:00:00.000Z'),
    adminGesperrtAm: null,
    ...abweichung,
    pickupSlots: [...(abweichung.pickupSlots ?? [MITTWOCH])],
  }
}

const volleTage = vi.mocked(ausgebuchteTage)
const upsert = vi.mocked(prisma.stockReservation.upsert)
const deleteMany = vi.mocked(prisma.stockReservation.deleteMany)

/**
 * Produkte mit Bestand 10, je an ihrem Hof; die Sitzung hält jedes davon noch —
 * auch eines, das die Anfrage nicht mitschickt. Die Abfrage der Produkte
 * achtet auf `id` und `farmId` wie die echte Datenbank.
 */
function stelleEin(produkte: { id: string; farm: Hof }[]) {
  vi.mocked(prisma.product.findMany).mockImplementation(((a: unknown) => {
    const where = (a as { where?: { id?: { in?: string[] }; farmId?: { in?: string[] } } })?.where ?? {}
    return Promise.resolve(
      produkte
        .filter((p) => !where.id?.in || where.id.in.includes(p.id))
        .filter((p) => !where.farmId?.in || where.farmId.in.includes(p.farm.id))
        .map((p) => ({
          id: p.id,
          stock: 10,
          isAvailable: true,
          category: null,
          verpackung: null,
          farm: { ...p.farm, betriebsnummer: null, betriebsstatus: null },
        }))
    )
  }) as never)
  vi.mocked(prisma.stockReservation.findMany).mockImplementation(((a: unknown) => {
    const where = (a as { where?: { sessionId?: unknown; productId?: { in?: string[] } } })?.where ?? {}
    if (where.sessionId && typeof where.sessionId === 'object') return Promise.resolve([])
    return Promise.resolve(
      produkte
        .filter((p) => !where.productId?.in || where.productId.in.includes(p.id))
        .map((p) => ({ productId: p.id, quantity: 2, expiresAt: new Date(JETZT.getTime() + 60_000) }))
    )
  }) as never)
}

function anfrage(items: { productId: string; quantity: number }[]): NextRequest {
  return new NextRequest('http://localhost/api/warenkorb/pruefen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: SITZUNG, items }),
  })
}

function alleMittwocheVoll(farmId: string) {
  volleTage.mockResolvedValue(
    new Map([[farmId, new Map([[fensterSchluessel(MITTWOCH), { ...MITTWOCH, ausgebuchtAm: ['2026-10-21', '2026-10-28'] }]])]])
  )
}

/** Welche Produkte einen erneuerten Halt bekamen. */
function erneuert(): string[] {
  return upsert.mock.calls.map((c) => (c[0] as { create: { productId: string } }).create.productId)
}

/** Welche Halte dieser Sitzung freigegeben wurden (je Produkt einmal, sortiert). */
function geloescht(): string[] {
  const ids = deleteMany.mock.calls.flatMap((c) => {
    const where = (c[0] as { where: { sessionId: string; productId: { in: string[] } } }).where
    expect(where.sessionId).toBe(SITZUNG)
    return where.productId.in
  })
  return [...new Set(ids)].sort()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
  volleTage.mockResolvedValue(new Map())
  upsert.mockResolvedValue({} as never)
  deleteMany.mockResolvedValue({ count: 0 } as never)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('pruefeKaufbarkeitHof — EINE Prüfkette für Reservieren und Warenkorb', () => {
  it('bestellbarer Hof: null', async () => {
    expect(await pruefeKaufbarkeitHof(hof('a'), JETZT)).toBeNull()
  })

  it.each([
    ['stillgelegt', { archivedAt: new Date('2026-09-01T00:00:00.000Z') }, FARM_ARCHIVED_MESSAGE],
    ['nicht-freigeschaltet', { approvedAt: null }, FARM_NOT_APPROVED_MESSAGE],
    ['admin-gesperrt', { adminGesperrtAm: new Date('2026-10-18T00:00:00.000Z') }, HOF_GESPERRT_SATZ],
    ['pause', { isPaused: true }, SHOP_PAUSED_MESSAGE],
    ['keine-abholzeit', { pickupSlots: [] }, 'Noch nicht bestellbar.'],
  ] as const)('%s: Grund und der Text von /api/reserve', async (grund, abweichung, text) => {
    expect(await pruefeKaufbarkeitHof(hof('a', abweichung), JETZT)).toEqual({ grund, text })
  })

  it('ausgebucht: Titel aus kaufSperreHinweis, gezählt mit dem Zeitpunkt der Anfrage', async () => {
    alleMittwocheVoll('a')
    expect(await pruefeKaufbarkeitHof(hof('a'), JETZT)).toEqual({
      grund: 'ausgebucht',
      text: kaufSperreHinweis('ausgebucht', 'Testhof a').titel,
    })
    expect(volleTage).toHaveBeenCalledWith(['a'], JETZT)
  })

  it('Reihenfolge: Stilllegung vor Freischaltung vor Pause vor Kaufsperre', async () => {
    const alles = { archivedAt: new Date('2026-09-01T00:00:00.000Z'), approvedAt: null, isPaused: true, pickupSlots: [] }
    expect((await pruefeKaufbarkeitHof(hof('a', alles), JETZT))?.grund).toBe('stillgelegt')
    expect((await pruefeKaufbarkeitHof(hof('a', { ...alles, archivedAt: null }), JETZT))?.grund).toBe('nicht-freigeschaltet')
    expect(
      (await pruefeKaufbarkeitHof(hof('a', { ...alles, archivedAt: null, approvedAt: new Date() }), JETZT))?.grund
    ).toBe('pause')
  })

  it('Sperre des Teams (N34, Nr. 187): nach der Freischaltung, vor der Pause — und ohne Zählung der vollen Tage', async () => {
    const gesperrt = { adminGesperrtAm: new Date('2026-10-18T00:00:00.000Z'), isPaused: true, pickupSlots: [] }
    expect(await pruefeKaufbarkeitHof(hof('a', gesperrt), JETZT)).toEqual({ grund: 'admin-gesperrt', text: HOF_GESPERRT_SATZ })
    // Freischaltung sticht die Sperre: Ein wartender Hof war nie offen.
    expect((await pruefeKaufbarkeitHof(hof('a', { ...gesperrt, approvedAt: null }), JETZT))?.grund).toBe('nicht-freigeschaltet')
    expect(volleTage).not.toHaveBeenCalled()
    // Gegenprobe: aufgehoben → wieder die Pause bzw. bestellbar.
    expect((await pruefeKaufbarkeitHof(hof('a', { ...gesperrt, adminGesperrtAm: null }), JETZT))?.grund).toBe('pause')
    expect(await pruefeKaufbarkeitHof(hof('a', { adminGesperrtAm: null }), JETZT)).toBeNull()
  })

  it('ein pausierter Hof kostet keine Zählung der vollen Tage', async () => {
    await pruefeKaufbarkeitHof(hof('a', { isPaused: true }), JETZT)
    expect(volleTage).not.toHaveBeenCalled()
  })
})

describe('/api/warenkorb/pruefen — Hof besteht die Prüfkette nicht', () => {
  it.each([
    ['pausiert', { isPaused: true }, SHOP_PAUSED_MESSAGE],
    ['stillgelegt', { archivedAt: new Date('2026-09-01T00:00:00.000Z') }, FARM_ARCHIVED_MESSAGE],
    ['nicht freigeschaltet', { approvedAt: null }, FARM_NOT_APPROVED_MESSAGE],
    ['vom Team gesperrt', { adminGesperrtAm: new Date('2026-10-18T00:00:00.000Z') }, HOF_GESPERRT_SATZ],
    ['ohne Abholzeit', { pickupSlots: [] }, 'Noch nicht bestellbar.'],
  ] as const)('%s: kein Halt erneuert, Halte gelöscht, Grund in der Meldung', async (_name, abweichung, text) => {
    stelleEin([{ id: 'eier', farm: hof('a', abweichung) }])

    const res = await POST(anfrage([{ productId: 'eier', quantity: 2 }]))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(erneuert()).toEqual([])
    expect(geloescht()).toEqual(['eier'])
    expect(body.meldung).toContain(text)
    expect(body.items).toEqual([])
    expect(body.reserviertBis).toBeNull()
    expect(body.positionen).toEqual([expect.objectContaining({ productId: 'eier', moeglich: 0, zustand: 'weg' })])
  })

  it('ausgebucht: kein Halt erneuert, Halte gelöscht, „Gerade ausgebucht.“ in der Meldung', async () => {
    stelleEin([{ id: 'eier', farm: hof('a') }])
    alleMittwocheVoll('a')

    const body = await (await POST(anfrage([{ productId: 'eier', quantity: 2 }]))).json()

    expect(erneuert()).toEqual([])
    expect(geloescht()).toEqual(['eier'])
    expect(body.meldung).toContain('Gerade ausgebucht.')
  })

  it('gesperrter Hof: auch der Halt ohne mitgeschickte Position fällt', async () => {
    // Die Sitzung hält Eier und Käse, der Korb schickt nur noch die Eier mit.
    stelleEin([
      { id: 'eier', farm: hof('a', { isPaused: true }) },
      { id: 'kaese', farm: hof('a', { isPaused: true }) },
    ])

    await POST(anfrage([{ productId: 'eier', quantity: 2 }]))

    expect(erneuert()).toEqual([])
    expect(geloescht()).toEqual(['eier', 'kaese'])
  })

  it('Gegenprobe: bei einem bestellbaren Hof bleibt der Halt ohne mitgeschickte Position', async () => {
    stelleEin([
      { id: 'eier', farm: hof('a') },
      { id: 'kaese', farm: hof('a') },
    ])

    await POST(anfrage([{ productId: 'eier', quantity: 2 }]))

    expect(erneuert()).toEqual(['eier'])
    expect(geloescht()).toEqual([])
  })

  it('gemischter Korb: der Halt ohne mitgeschickte Position fällt nur beim gesperrten Hof', async () => {
    stelleEin([
      { id: 'eier', farm: hof('a', { isPaused: true }) },
      { id: 'kaese', farm: hof('a', { isPaused: true }) },
      { id: 'milch', farm: hof('b') },
      { id: 'butter', farm: hof('b') },
    ])

    await POST(
      anfrage([
        { productId: 'eier', quantity: 2 },
        { productId: 'milch', quantity: 2 },
      ])
    )

    expect(geloescht()).toEqual(['eier', 'kaese'])
  })

  it('Gegenprobe: ein bestellbarer Hof behält seinen Halt, keine Meldung', async () => {
    stelleEin([{ id: 'eier', farm: hof('a') }])

    const body = await (await POST(anfrage([{ productId: 'eier', quantity: 2 }]))).json()

    expect(erneuert()).toEqual(['eier'])
    expect(geloescht()).toEqual([])
    expect(body.meldung).toBeNull()
    expect(body.items).toEqual([{ productId: 'eier', quantity: 2 }])
  })

  it('gemischter Korb mit zwei Höfen: nur der gesperrte entfällt', async () => {
    stelleEin([
      { id: 'eier', farm: hof('a', { isPaused: true }) },
      { id: 'milch', farm: hof('b') },
    ])

    const body = await (
      await POST(
        anfrage([
          { productId: 'eier', quantity: 2 },
          { productId: 'milch', quantity: 2 },
        ])
      )
    ).json()

    expect(erneuert()).toEqual(['milch'])
    expect(geloescht()).toEqual(['eier'])
    expect(body.items).toEqual([{ productId: 'milch', quantity: 2 }])
    expect(body.meldung).toContain(SHOP_PAUSED_MESSAGE)
    // Gezählt wird nur für den Hof, der Stilllegung, Freischaltung und Pause besteht.
    expect(volleTage).toHaveBeenCalledWith(['b'], JETZT)
  })
})

describe('/api/warenkorb/pruefen — Obergrenze je Position', () => {
  it('quantity über MAX_MENGE → 400, nichts gehalten', async () => {
    stelleEin([{ id: 'eier', farm: hof('a') }])

    const res = await POST(anfrage([{ productId: 'eier', quantity: MAX_MENGE + 1 }]))

    expect(res.status).toBe(400)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('Gegenprobe: genau MAX_MENGE geht durch', async () => {
    stelleEin([{ id: 'eier', farm: hof('a') }])

    const res = await POST(anfrage([{ productId: 'eier', quantity: MAX_MENGE }]))

    expect(res.status).toBe(200)
  })
})
