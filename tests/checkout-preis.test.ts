/**
 * Tests für den Preis im Checkout (/api/checkout) — am echten Handler,
 * Prisma/Stripe/Mail gemockt.
 *
 * Beweist: Der Preis kommt aus der Datenbank, nie aus dem Request. Weicht der
 * Preis, den der Browser schickt, vom Preis in der DB ab — weil der Hof ihn
 * geändert hat oder weil jemand den Request baut —, entsteht KEINE Bestellung
 * und kein Bestand wird gebucht; die Antwort nennt das Produkt und liefert den
 * gültigen Preis mit, damit der Warenkorb ihn übernehmen kann. Stimmt der
 * Preis, rechnen Bestellsumme, Positionen und Stripe-Betrag mit dem DB-Preis.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn(() => null) }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
}))
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
import { preisAbweichungen } from '@/lib/order-totals'

const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const productFindMany = vi.mocked(prisma.product.findMany)
const productUpdateMany = vi.mocked(prisma.product.updateMany)
const reservationFindMany = vi.mocked(prisma.stockReservation.findMany)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const orderFindUnique = vi.mocked(prisma.order.findUnique)
const orderCreate = vi.mocked(prisma.order.create)
const orderUpdate = vi.mocked(prisma.order.update)
const intentCreate = vi.mocked(stripe.paymentIntents.create)
const mail = vi.mocked(sendOnsiteConfirmation)

const HOF = {
  id: 'farm_1',
  name: 'Hof Test',
  slug: 'hof-test',
  email: 'hof@example.com',
  ownerName: 'Max Mustermann',
  address: 'Feldweg 1',
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
  serviceFeePercent: { toString: () => '0' },
  serviceFeeMinCents: 0,
  serviceFeeActiveFrom: null,
  owner: { name: 'Max Mustermann' },
}

/** Die „Datenbank": Preise als Decimal-artige Werte, wie Prisma sie liefert. */
let preise: Record<string, string>

type Where = { id?: { in?: string[] }; productId?: { in?: string[] }; farmId?: string; sessionId?: unknown }

beforeEach(() => {
  vi.clearAllMocks()
  preise = { tomaten: '4.99', eier: '3.60' }
  productFindMany.mockImplementation(((a: { where?: Where }) => {
    const gesucht = a?.where?.id?.in ?? []
    return Promise.resolve(
      gesucht
        .filter((id) => preise[id] !== undefined)
        .map((id) => ({
          id,
          stock: 999,
          isAvailable: true,
          farmId: 'farm_1',
          vatRate: { toString: () => '10.00' },
          abgabe: 'ALLE',
          price: { toString: () => preise[id] },
        }))
    )
  }) as never)
  reservationFindMany.mockImplementation(((a: { where?: Where }) => {
    const w = a?.where ?? {}
    if (w.sessionId && typeof w.sessionId === 'object') return Promise.resolve([])
    const gesucht = w.productId?.in ?? w.id?.in ?? []
    return Promise.resolve(
      gesucht.map((id) => ({ productId: id, quantity: 999, expiresAt: new Date(Date.now() + 600_000) }))
    )
  }) as never)
  productUpdateMany.mockResolvedValue({ count: 1 } as never)
  farmFindUnique.mockResolvedValue(HOF as never)
  userFindUnique.mockResolvedValue({ id: 'user_1' } as never)
  orderFindUnique.mockResolvedValue(null)
  orderCreate.mockResolvedValue({ id: 'order_1', createdAt: new Date() } as never)
  orderUpdate.mockResolvedValue({} as never)
  intentCreate.mockResolvedValue({ id: 'pi_test', client_secret: 'secret_test' } as never)
  mail.mockResolvedValue(undefined)
})

function anfrage(
  items: Array<{ productId: string; name: string; quantity: number; unitPrice: number }>,
  paymentMethod = 'ONSITE_CASH'
) {
  return new NextRequest('http://localhost/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      farmId: 'farm_1',
      farmSlug: 'hof-test',
      sessionId: 'sid_1',
      customerName: 'Max Mustermann',
      customerEmail: 'max@example.com',
      customerPhone: '+43 660 0000000',
      pickupDate: '2026-09-26',
      pickupTimeStart: '09:00',
      pickupTimeEnd: '12:00',
      paymentMethod,
      items,
    }),
  })
}

type OrderData = {
  totalAmount: number
  items: { create: Array<{ productId: string; unitPrice: number; totalPrice: number }> }
}
const bestellung = () => orderCreate.mock.calls[0][0].data as unknown as OrderData

describe('Preis aus dem Request weicht von der DB ab', () => {
  it('ein manipulierter Preis (1 Cent statt € 4,99) erzeugt keine Bestellung und bucht keinen Bestand', async () => {
    const res = await POST(anfrage([{ productId: 'tomaten', name: 'Tomaten', quantity: 2, unitPrice: 0.01 }]))

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('WARENKORB_GEAENDERT')
    expect(orderCreate).not.toHaveBeenCalled()
    expect(productUpdateMany).not.toHaveBeenCalled()
    expect(intentCreate).not.toHaveBeenCalled()
  })

  it('die Antwort nennt das Produkt und liefert den gültigen Preis für den Warenkorb', async () => {
    preise.tomaten = '5.49' // Der Hof hat den Preis erhöht, der Warenkorb kennt noch 4,99.
    const res = await POST(
      anfrage([
        { productId: 'tomaten', name: 'Tomaten', quantity: 1, unitPrice: 4.99 },
        { productId: 'eier', name: 'Eier', quantity: 1, unitPrice: 3.6 },
      ])
    )

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('Tomaten')
    expect(body.preise).toEqual([{ productId: 'tomaten', price: 5.49 }])
  })
})

describe('Preis stimmt', () => {
  it('Positionen und Bestellsumme rechnen mit dem DB-Preis', async () => {
    const res = await POST(
      anfrage([
        { productId: 'tomaten', name: 'Tomaten', quantity: 2, unitPrice: 4.99 },
        { productId: 'eier', name: 'Eier', quantity: 3, unitPrice: 3.6 },
      ])
    )

    expect(res.status).toBe(200)
    expect(bestellung().items.create.map((p) => [p.productId, p.unitPrice, p.totalPrice])).toEqual([
      ['tomaten', 4.99, 9.98],
      ['eier', 3.6, 10.8],
    ])
    expect(bestellung().totalAmount).toBeCloseTo(20.78, 10)
  })

  it('Online: Stripe bekommt den Betrag aus dem DB-Preis', async () => {
    const res = await POST(
      anfrage([{ productId: 'tomaten', name: 'Tomaten', quantity: 2, unitPrice: 4.99 }], 'ONLINE')
    )

    expect(res.status).toBe(200)
    expect(intentCreate.mock.calls[0][0]).toMatchObject({ amount: 998 })
  })
})

describe('preisAbweichungen (rein)', () => {
  const db = new Map([
    ['tomaten', 4.99],
    ['eier', 3.6],
  ])

  it('gleicher Preis: keine Abweichung, auch mit Float-Rest', () => {
    expect(preisAbweichungen([{ productId: 'tomaten', name: 'Tomaten', unitPrice: 4.990000001 }], db)).toEqual([])
  })

  it('ein Cent Unterschied zählt', () => {
    expect(preisAbweichungen([{ productId: 'tomaten', name: 'Tomaten', unitPrice: 4.98 }], db)).toEqual([
      { productId: 'tomaten', name: 'Tomaten', price: 4.99 },
    ])
  })

  it('meldet nur die abweichenden Positionen', () => {
    const ergebnis = preisAbweichungen(
      [
        { productId: 'tomaten', name: 'Tomaten', unitPrice: 4.99 },
        { productId: 'eier', name: 'Eier', unitPrice: 0.01 },
      ],
      db
    )
    expect(ergebnis.map((a) => a.productId)).toEqual(['eier'])
  })

  it('ein unbekanntes Produkt ist hier keine Preisabweichung (das prüft der Handler vorher)', () => {
    expect(preisAbweichungen([{ productId: 'fremd', name: 'Fremd', unitPrice: 1 }], db)).toEqual([])
  })
})
