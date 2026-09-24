/**
 * Tests für die Servicegebühr im Checkout (/api/checkout) — am echten Handler,
 * Prisma/Stripe/Mail gemockt.
 *
 * Beweist (Teil C): totalAmount bleibt der WARENPREIS; die Gebühr landet als
 * Snapshot (serviceFeeCents, serviceFeePercentApplied) in der Bestellung; an
 * Stripe geht amount = Warenpreis + Gebühr mit application_fee_amount = Gebühr
 * (+ Plattformgebühr) und transfer_data.destination = Hofkonto — dem Hof
 * fließt exakt der Warenpreis zu. Bar: derselbe Snapshot, kein Stripe, die
 * Bestätigungs-Mail bekommt die Gebühr. Gebührenfrei: 0 und keine
 * application_fee_amount.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn(() => null) }))
vi.mock('@/lib/stripe', () => ({ stripe: { paymentIntents: { create: vi.fn() } } }))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn() },
    product: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    stockReservation: { aggregate: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    order: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    customerFarmSubscription: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}))

import { POST } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { sendOnsiteConfirmation } from '@/lib/email'

/**
 * Seit dem Checkout-Sprint prüft POST /api/checkout die Reservierungsfrist und
 * bucht den Bestand BEDINGT (src/server/warenkorb.ts). Diese Vorbereitung
 * stellt den Normalfall her: Produkte vorrätig, eigener Halt gültig, Buchung
 * erfolgreich. Generisch über die angefragten IDs, damit sie unabhängig von
 * den Produktnamen der einzelnen Suite funktioniert.
 */
// Der Preis in der „Datenbank" — der Handler rechnet seit dem Preis-Fix mit
// ihm, nicht mit dem Preis aus der Anfrage. Tests mit anderem Preis setzen ihn.
let einzelpreis = 10

function warenkorbBereit() {
  const ids = (a: unknown): string[] => {
    const w = (a as { where?: { id?: { in?: string[] }; productId?: { in?: string[] } } })?.where
    return w?.id?.in ?? w?.productId?.in ?? []
  }
  vi.mocked(prisma.product.findMany).mockImplementation(((a: unknown) =>
    Promise.resolve(ids(a).map((id) => ({ id, stock: 999, isAvailable: true, price: einzelpreis })))) as never)
  vi.mocked(prisma.stockReservation.findMany).mockImplementation(((a: unknown) => {
    const sess = (a as { where?: { sessionId?: unknown } })?.where?.sessionId
    // { not: ... } = fremde Sitzungen; die blockieren hier nichts.
    if (sess && typeof sess === 'object') return Promise.resolve([])
    return Promise.resolve(
      ids(a).map((id) => ({ productId: id, quantity: 999, expiresAt: new Date(Date.now() + 600_000) }))
    )
  }) as never)
  vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 1 } as never)
}


const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const productFindUnique = vi.mocked(prisma.product.findUnique)
const reservationAggregate = vi.mocked(prisma.stockReservation.aggregate)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const orderFindUnique = vi.mocked(prisma.order.findUnique)
const orderCreate = vi.mocked(prisma.order.create)
const orderUpdate = vi.mocked(prisma.order.update)
const productUpdate = vi.mocked(prisma.product.update)
const reservationDeleteMany = vi.mocked(prisma.stockReservation.deleteMany)
const paymentIntentCreate = vi.mocked(stripe.paymentIntents.create)

const HOF = {
  id: 'farm_1',
  name: 'Welszucht Probe',
  slug: 'welszucht-probe',
  email: 'hof@test.local',
  ownerName: 'Franz',
  address: 'Teichweg 1',
  postalCode: '4910',
  city: 'Ried',
  phone: '+43 660 0000000',
  isActive: true,
  archivedAt: null,
  approvedAt: new Date('2026-01-01T00:00:00.000Z'),
  isPaused: false,
  acceptsOnline: true,
  acceptsOnsite: true,
  stripeAccountReady: true,
  stripeAccountId: 'acct_hof',
  platformFeePercent: { toString: () => '0' },
  // Gebühr gilt seit 1. September
  serviceFeePercent: { toString: () => '4.90' },
  serviceFeeMinCents: 50,
  serviceFeeActiveFrom: new Date('2026-09-01T00:00:00.000Z'),
  owner: { name: 'Franz' },
}

function anfrage(overrides: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      farmId: 'farm_1',
      farmSlug: 'welszucht-probe',
      sessionId: 'sid_1',
      customerName: 'Anna Testerin',
      customerEmail: 'anna@test.local',
      customerPhone: '+43 660 1234567',
      customerNote: '',
      pickupDate: '2026-09-25',
      pickupTimeStart: '14:00',
      pickupTimeEnd: '16:00',
      paymentMethod: 'ONLINE',
      items: [{ productId: 'prod_1', name: 'Wels', quantity: 2, unitPrice: 10 }],
      ...overrides,
    }),
  })
}

/** Decimal-Beträge als Zahl — nur für den Vergleich im Test; gerechnet wird im Handler mit Decimal. */
function alsZahl(v: unknown): unknown {
  return v !== null && typeof v === 'object' && 'toFixed' in v ? Number(String(v)) : v
}

function createData(): Record<string, unknown> {
  const data = (orderCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data
  return { ...data, totalAmount: alsZahl(data.totalAmount), platformFeeAmount: alsZahl(data.platformFeeAmount) }
}

function intentParams(): Record<string, unknown> {
  return paymentIntentCreate.mock.calls[0]?.[0] as unknown as Record<string, unknown>
}

beforeEach(() => {
  einzelpreis = 10
  warenkorbBereit()
  vi.clearAllMocks()
  farmFindUnique.mockResolvedValue(HOF as never)
  productFindUnique.mockResolvedValue({
    id: 'prod_1', stock: 10, isAvailable: true, name: 'Wels', unit: 'KG', unitSize: null,
  } as never)
  reservationAggregate.mockResolvedValue({ _sum: { quantity: 0 } } as never)
  userFindUnique.mockResolvedValue({ id: 'cust_1' } as never)
  orderFindUnique.mockResolvedValue(null)
  orderCreate.mockResolvedValue({ id: 'order_1' } as never)
  orderUpdate.mockResolvedValue({} as never)
  productUpdate.mockResolvedValue({} as never)
  reservationDeleteMany.mockResolvedValue({ count: 0 } as never)
  paymentIntentCreate.mockResolvedValue({ id: 'pi_1', client_secret: 'cs_test' } as never)
  vi.mocked(sendOnsiteConfirmation).mockResolvedValue(undefined)
})

describe('Checkout ONLINE mit Servicegebühr', () => {
  it('20 € bei 4,9 %: Warenpreis bleibt totalAmount, 98 Cent im Snapshot, Stripe bekommt 2098 mit application_fee 98', async () => {
    const res = await POST(anfrage())

    expect(res.status).toBe(200)
    expect(createData()).toEqual(
      expect.objectContaining({
        totalAmount: 20,
        serviceFeeCents: 98,
        serviceFeePercentApplied: 4.9,
      })
    )
    expect(intentParams()).toEqual(
      expect.objectContaining({
        amount: 2098,
        application_fee_amount: 98,
        transfer_data: { destination: 'acct_hof' },
      })
    )
    // Kein on_behalf_of: die Zahlung bleibt auf dem Plattformkonto (Ladungstyp
    // destination charge), Stripe-Gebühren trägt die Plattform aus der Gebühr.
    expect(intentParams()).not.toHaveProperty('on_behalf_of')
  })

  it('Plattformgebühr (Pilot 0) und Servicegebühr addieren sich in application_fee_amount', async () => {
    farmFindUnique.mockResolvedValue({ ...HOF, platformFeePercent: { toString: () => '5' } } as never)

    await POST(anfrage())

    // 20 € × 5 % = 100 Cent Plattformgebühr + 98 Cent Servicegebühr
    expect(intentParams()).toEqual(expect.objectContaining({ amount: 2098, application_fee_amount: 198 }))
    expect(createData()).toEqual(expect.objectContaining({ totalAmount: 20, serviceFeeCents: 98 }))
  })

  it('gebührenfreier Hof: 0 Cent, kein Prozentsatz, keine application_fee_amount, Betrag = Warenpreis', async () => {
    farmFindUnique.mockResolvedValue({ ...HOF, serviceFeeActiveFrom: null } as never)

    await POST(anfrage())

    expect(createData()).toEqual(
      expect.objectContaining({ totalAmount: 20, serviceFeeCents: 0, serviceFeePercentApplied: null })
    )
    expect(intentParams()).toEqual(expect.objectContaining({ amount: 2000 }))
    expect(intentParams()).not.toHaveProperty('application_fee_amount')
  })

  it('„gilt ab" in der Zukunft: heute noch gebührenfrei', async () => {
    const inZukunft = new Date(Date.now() + 24 * 60 * 60 * 1000)
    farmFindUnique.mockResolvedValue({ ...HOF, serviceFeeActiveFrom: inZukunft } as never)

    await POST(anfrage())

    expect(createData()).toEqual(expect.objectContaining({ serviceFeeCents: 0 }))
    expect(intentParams()).toEqual(expect.objectContaining({ amount: 2000 }))
  })
})

describe('Checkout BAR mit Servicegebühr', () => {
  it('6 €: Mindestgebühr 50 Cent im Snapshot, kein Stripe, Bestätigungs-Mail kennt die Gebühr', async () => {
    einzelpreis = 6
    const res = await POST(
      anfrage({
        paymentMethod: 'ONSITE_CASH',
        items: [{ productId: 'prod_1', name: 'Wels', quantity: 1, unitPrice: 6 }],
      })
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(expect.objectContaining({ requiresConfirmation: true }))
    expect(createData()).toEqual(
      expect.objectContaining({ totalAmount: 6, serviceFeeCents: 50, serviceFeePercentApplied: 4.9 })
    )
    expect(paymentIntentCreate).not.toHaveBeenCalled()
    expect(sendOnsiteConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ serviceFeeCents: 50 }),
      expect.any(String)
    )
    const mailBestellung = vi.mocked(sendOnsiteConfirmation).mock.calls[0][0] as { totalAmount: unknown }
    expect(alsZahl(mailBestellung.totalAmount)).toBe(6)
  })

  it('Karte beim Hof zählt wie bar: derselbe Snapshot, kein Stripe', async () => {
    await POST(anfrage({ paymentMethod: 'ONSITE_CARD' }))

    expect(createData()).toEqual(expect.objectContaining({ totalAmount: 20, serviceFeeCents: 98 }))
    expect(paymentIntentCreate).not.toHaveBeenCalled()
  })
})
