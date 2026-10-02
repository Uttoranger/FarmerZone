/**
 * Der Abholtermin im Checkout (/api/checkout) — am echten Handler, Prisma,
 * Stripe und Mail gemockt, die Uhr fest.
 *
 * Beweist: Der Server nimmt nur ein Abholfenster an, das der Hof wirklich
 * anbietet — aktives Fenster mit diesem Wochentag (Wiener Zeit) und genau
 * diesen Zeiten, Bestellschluss (Beginn des Fensters) in der Zukunft, im
 * Zeitraum der nächsten 14 Tage, und mit freiem Platz, wenn das Fenster eine
 * Höchstzahl hat. Sonst 409 — ohne Bestandsbuchung, ohne Bestellung. Ein
 * Datum in falscher Form ist 400 (Schema) statt eines 500 beim Speichern.
 *
 * Gleichzeitige Bestellungen auf den letzten Platz prüft zusätzlich
 * tests/integration/checkout-abholfenster.int.test.ts gegen echtes Postgres.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn(() => null) }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
}))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
vi.mock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteFreiOhneRisiko: vi.fn() }))
vi.mock('@/lib/prisma', () => {
  const prisma = {
    farm: { findUnique: vi.fn() },
    product: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    stockReservation: { aggregate: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    order: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    customerFarmSubscription: { findUnique: vi.fn(), upsert: vi.fn() },
    pickupSlot: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  }
  // Die Transaktion läuft auf denselben Mocks — gezählt und angelegt wird
  // dort genauso, nur unter der Sperre der Zeile des Abholfensters.
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma))
  return { prisma }
})

import { POST } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'

const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const productFindMany = vi.mocked(prisma.product.findMany)
const productUpdate = vi.mocked(prisma.product.update)
const productUpdateMany = vi.mocked(prisma.product.updateMany)
const reservationFindMany = vi.mocked(prisma.stockReservation.findMany)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const orderFindUnique = vi.mocked(prisma.order.findUnique)
const orderCreate = vi.mocked(prisma.order.create)
const orderUpdate = vi.mocked(prisma.order.update)
const orderCount = vi.mocked(prisma.order.count)
const slotFindMany = vi.mocked(prisma.pickupSlot.findMany)

/** Mittwoch, 7. Oktober 2026, 10:00 in Wien (Sommerzeit, UTC+2). */
const JETZT = new Date('2026-10-07T08:00:00.000Z')

const HOF = {
  id: 'farm_1',
  name: 'Hof Test',
  slug: 'hof-test',
  email: 'hof@example.org',
  ownerName: 'Max Mustermann',
  address: 'Feldweg 1',
  postalCode: '4910',
  city: 'Ried',
  phone: '+43 660 0000000',
  isActive: true,
  archivedAt: null,
  approvedAt: new Date('2026-01-01T00:00:00.000Z'),
  isPaused: false,
  acceptsOnline: false,
  acceptsOnsite: true,
  stripeAccountReady: false,
  stripeAccountId: null,
  platformFeePercent: { toString: () => '0' },
  serviceFeePercent: { toString: () => '0' },
  serviceFeeMinCents: 0,
  serviceFeeActiveFrom: null,
  owner: { name: 'Max Mustermann' },
}

/** Mittwoch 15–18 Uhr ohne Grenze, Samstag 9–12 Uhr höchstens zwei Bestellungen. */
const FENSTER = [
  { id: 'slot_mi', dayOfWeek: 3, startTime: '15:00', endTime: '18:00', maxOrders: null, isActive: true },
  { id: 'slot_sa', dayOfWeek: 6, startTime: '09:00', endTime: '12:00', maxOrders: 2, isActive: true },
]

const ids = (a: unknown): string[] => {
  const w = (a as { where?: { id?: { in?: string[] }; productId?: { in?: string[] } } })?.where
  return w?.id?.in ?? w?.productId?.in ?? []
}

function anfrage(termin: { pickupDate: string; pickupTimeStart: string; pickupTimeEnd: string }): NextRequest {
  return new NextRequest('http://localhost/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      farmId: 'farm_1',
      farmSlug: 'hof-test',
      sessionId: 'sid_1',
      customerName: 'Max Mustermann',
      customerEmail: 'max@example.org',
      customerPhone: '+43 660 0000000',
      customerNote: '',
      paymentMethod: 'ONSITE_CASH',
      items: [{ productId: 'prod_1', name: 'Erdäpfel', quantity: 2, unitPrice: 5 }],
      ...termin,
    }),
  })
}

const MITTWOCH = (datum: string) => ({ pickupDate: datum, pickupTimeStart: '15:00', pickupTimeEnd: '18:00' })
const SAMSTAG = (datum: string) => ({ pickupDate: datum, pickupTimeStart: '09:00', pickupTimeEnd: '12:00' })

/** Abgelehnt mit diesem Code — und nichts gebucht, nichts angelegt. */
async function erwarteAbgelehnt(res: Response, code: string): Promise<void> {
  expect(res.status).toBe(409)
  const body = await res.json()
  expect(body.code).toBe(code)
  expect(body.error).toBe('Dieses Zeitfenster ist leider nicht mehr verfügbar – bitte wähle ein anderes.')
  expect(productUpdateMany).not.toHaveBeenCalled()
  expect(orderCreate).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(JETZT)
  vi.mocked(prisma.$transaction).mockImplementation(((fn: (tx: typeof prisma) => unknown) => fn(prisma)) as never)
  farmFindUnique.mockResolvedValue(HOF as never)
  slotFindMany.mockResolvedValue(FENSTER as never)
  orderCount.mockResolvedValue(0)
  productFindMany.mockImplementation(((a: unknown) =>
    Promise.resolve(
      ids(a).map((id) => ({ id, name: 'Erdäpfel', stock: 999, isAvailable: true, price: 5, abgabe: 'ALLE', vatRate: 10 }))
    )) as never)
  reservationFindMany.mockImplementation(((a: unknown) => {
    const sitzung = (a as { where?: { sessionId?: unknown } })?.where?.sessionId
    if (sitzung && typeof sitzung === 'object') return Promise.resolve([])
    return Promise.resolve(ids(a).map((id) => ({ productId: id, quantity: 999, expiresAt: new Date(JETZT.getTime() + 600_000) })))
  }) as never)
  productUpdateMany.mockResolvedValue({ count: 1 } as never)
  productUpdate.mockResolvedValue({} as never)
  userFindUnique.mockResolvedValue({ id: 'kunde_1' } as never)
  orderFindUnique.mockResolvedValue(null)
  orderCreate.mockResolvedValue({ id: 'order_1', createdAt: JETZT } as never)
  orderUpdate.mockResolvedValue({} as never)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Abholtermin — gültig', () => {
  it('nimmt das heutige Fenster an, solange es noch nicht begonnen hat', async () => {
    const res = await POST(anfrage(MITTWOCH('2026-10-07')))

    expect(res.status).toBe(200)
    expect(orderCreate).toHaveBeenCalledTimes(1)
  })

  it('nimmt ein Fenster mit Höchstzahl an, solange ein Platz frei ist', async () => {
    orderCount.mockResolvedValue(1)

    const res = await POST(anfrage(SAMSTAG('2026-10-10')))

    expect(res.status).toBe(200)
    expect(orderCreate).toHaveBeenCalledTimes(1)
  })

  it('nimmt ein Fenster am Ende des Zeitraums an (in 13 Tagen)', async () => {
    const res = await POST(anfrage(SAMSTAG('2026-10-17')))

    expect(res.status).toBe(200)
  })
})

describe('Abholtermin — ungültig: 409 ABHOLFENSTER_UNGUELTIG', () => {
  it('Vergangenheit: das Fenster von letzter Woche', async () => {
    await erwarteAbgelehnt(await POST(anfrage(MITTWOCH('2026-09-30'))), 'ABHOLFENSTER_UNGUELTIG')
  })

  it('heute, aber das Fenster hat schon begonnen (Bestellschluss vorbei)', async () => {
    vi.setSystemTime(new Date('2026-10-07T13:30:00.000Z')) // 15:30 in Wien

    await erwarteAbgelehnt(await POST(anfrage(MITTWOCH('2026-10-07'))), 'ABHOLFENSTER_UNGUELTIG')
  })

  it('falscher Wochentag: Donnerstag hat kein Fenster', async () => {
    await erwarteAbgelehnt(await POST(anfrage(MITTWOCH('2026-10-08'))), 'ABHOLFENSTER_UNGUELTIG')
  })

  it('falsche Uhrzeit: Beginn oder Ende weicht vom Fenster ab', async () => {
    await erwarteAbgelehnt(
      await POST(anfrage({ pickupDate: '2026-10-07', pickupTimeStart: '14:00', pickupTimeEnd: '18:00' })),
      'ABHOLFENSTER_UNGUELTIG'
    )
    await erwarteAbgelehnt(
      await POST(anfrage({ pickupDate: '2026-10-07', pickupTimeStart: '15:00', pickupTimeEnd: '19:00' })),
      'ABHOLFENSTER_UNGUELTIG'
    )
  })

  it('zu weit voraus: in 14 Tagen bietet der Checkout nichts mehr an', async () => {
    await erwarteAbgelehnt(await POST(anfrage(MITTWOCH('2026-10-21'))), 'ABHOLFENSTER_UNGUELTIG')
  })

  it('ein Datum, das es nicht gibt (31. Februar)', async () => {
    await erwarteAbgelehnt(await POST(anfrage(MITTWOCH('2027-02-31'))), 'ABHOLFENSTER_UNGUELTIG')
  })

  it('ein abgeschaltetes Fenster zählt nicht', async () => {
    slotFindMany.mockResolvedValue([{ ...FENSTER[0], isActive: false }] as never)

    await erwarteAbgelehnt(await POST(anfrage(MITTWOCH('2026-10-07'))), 'ABHOLFENSTER_UNGUELTIG')
  })
})

describe('Abholtermin — kaputtes Format: 400 statt 500', () => {
  it.each([
    ['Datum ohne führende Nullen', { pickupDate: '2026-10-7', pickupTimeStart: '15:00', pickupTimeEnd: '18:00' }],
    ['Datum in deutscher Schreibweise', { pickupDate: '07.10.2026', pickupTimeStart: '15:00', pickupTimeEnd: '18:00' }],
    ['Text statt Datum', { pickupDate: 'morgen', pickupTimeStart: '15:00', pickupTimeEnd: '18:00' }],
    ['Uhrzeit ohne Minuten', { pickupDate: '2026-10-07', pickupTimeStart: '15', pickupTimeEnd: '18:00' }],
    ['Uhrzeit als Text', { pickupDate: '2026-10-07', pickupTimeStart: '15:00', pickupTimeEnd: 'abends' }],
  ])('%s', async (_name, termin) => {
    const res = await POST(anfrage(termin))

    expect(res.status).toBe(400)
    expect(productUpdateMany).not.toHaveBeenCalled()
    expect(orderCreate).not.toHaveBeenCalled()
  })
})

describe('Abholtermin — volles Fenster: 409 ABHOLFENSTER_VOLL', () => {
  it('lehnt ab, wenn das Fenster seine Höchstzahl erreicht hat', async () => {
    orderCount.mockResolvedValue(2)

    await erwarteAbgelehnt(await POST(anfrage(SAMSTAG('2026-10-10'))), 'ABHOLFENSTER_VOLL')
  })

  it('zählt nur nicht stornierte Bestellungen dieses Hofs, Tages und Fensters', async () => {
    orderCount.mockResolvedValue(1)

    await POST(anfrage(SAMSTAG('2026-10-10')))

    const wo = (orderCount.mock.calls[0][0] as { where: Record<string, unknown> }).where
    expect(wo).toMatchObject({
      farmId: 'farm_1',
      pickupTimeStart: '09:00',
      pickupTimeEnd: '12:00',
      status: { not: 'CANCELLED' },
    })
  })

  it('der letzte Platz geht beim Anlegen weg: Bestand zurück, 409, keine Bestellung', async () => {
    // Vorprüfung sieht einen freien Platz, in der Transaktion ist er weg —
    // eine gleichzeitige Bestellung war schneller.
    orderCount.mockResolvedValueOnce(1).mockResolvedValueOnce(2)

    const res = await POST(anfrage(SAMSTAG('2026-10-10')))

    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('ABHOLFENSTER_VOLL')
    expect(orderCreate).not.toHaveBeenCalled()
    // Der gebuchte Bestand ist wieder gutgeschrieben.
    expect(productUpdate).toHaveBeenCalledWith({
      where: { id: 'prod_1' },
      data: { stock: { increment: 2 } },
    })
  })
})
