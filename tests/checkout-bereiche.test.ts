/**
 * Tests für den Checkout-Handler in Sprint Bereiche 1 (/api/checkout) — am
 * echten Handler, Prisma/Stripe/Mail gemockt.
 *
 * Beweist:
 *   - Jede Position bekommt ihren MwSt-Satz als Snapshot aus Product.vatRate,
 *     im selben create wie die Bestellung.
 *   - Eine Position mit abgabe = NUR_BETRIEBE verlangt Käuferart BETRIEB und
 *     eine Betriebsnummer — serverseitig geprüft, mit der Abgabe aus der DB.
 *     Ein Verstoß ergibt 400 BETRIEBSNACHWEIS_FEHLT, bucht keinen Bestand und
 *     legt keine Bestellung an.
 *   - Ohne solche Position bleibt alles wie bisher (PRIVAT, keine Nummer).
 *   - Ein Produkt, das nicht zu diesem Hof gehört, geht nicht durch.
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
import { sendOnsiteConfirmation } from '@/lib/email'
import { BETRIEBSNACHWEIS_FEHLER } from '@/lib/betriebsnachweis'

const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const productFindMany = vi.mocked(prisma.product.findMany)
const productUpdateMany = vi.mocked(prisma.product.updateMany)
const reservationFindMany = vi.mocked(prisma.stockReservation.findMany)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const orderFindUnique = vi.mocked(prisma.order.findUnique)
const orderCreate = vi.mocked(prisma.order.create)
const orderUpdate = vi.mocked(prisma.order.update)
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

/** Die Produkte in der „Datenbank" — Abgabe und MwSt stehen HIER, nicht im Request. */
const PRODUKTE: Record<string, { farmId: string; vatRate: string; abgabe: 'ALLE' | 'NUR_BETRIEBE' }> = {
  eier: { farmId: 'farm_1', vatRate: '10.00', abgabe: 'ALLE' },
  holz: { farmId: 'farm_1', vatRate: '13.00', abgabe: 'ALLE' },
  hafer: { farmId: 'farm_1', vatRate: '10.00', abgabe: 'NUR_BETRIEBE' },
  fremd: { farmId: 'farm_2', vatRate: '10.00', abgabe: 'ALLE' },
}

type Where = { id?: { in?: string[] }; productId?: { in?: string[] }; farmId?: string; sessionId?: unknown }

beforeEach(() => {
  vi.clearAllMocks()
  // findMany bedient zwei Aufrufer: die Warenkorbprüfung (Bestand) und den
  // Handler (Abgabe, MwSt, Hof). Der Filter auf farmId wirkt wie in der DB.
  productFindMany.mockImplementation(((a: { where?: Where }) => {
    const w = a?.where ?? {}
    const gesucht = w.id?.in ?? []
    return Promise.resolve(
      gesucht
        .filter((id) => PRODUKTE[id] && (w.farmId === undefined || PRODUKTE[id].farmId === w.farmId))
        // price passt zur Anfrage (unitPrice 5) — sonst greift die Preisprüfung.
        .map((id) => ({ id, stock: 999, isAvailable: true, price: 5, ...PRODUKTE[id] }))
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
  mail.mockResolvedValue(undefined)
})

function anfrage(items: Array<{ productId: string; name: string }>, extra: Record<string, unknown> = {}) {
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
      paymentMethod: 'ONSITE_CASH',
      items: items.map((i) => ({ ...i, quantity: 1, unitPrice: 5 })),
      ...extra,
    }),
  })
}

type OrderData = {
  kaeuferArt: string
  betriebsnummer: string | null
  items: { create: Array<{ productId: string; vatRate: unknown }> }
}
const bestellung = () => orderCreate.mock.calls[0][0].data as unknown as OrderData

describe('MwSt-Snapshot je Position', () => {
  it('schreibt den Satz aus dem Produkt an jede Position, im selben create wie die Bestellung', async () => {
    const res = await POST(anfrage([{ productId: 'eier', name: 'Eier' }, { productId: 'holz', name: 'Holz' }]))

    expect(res.status).toBe(200)
    expect(orderCreate).toHaveBeenCalledTimes(1)
    const saetze = bestellung().items.create.map((p) => [p.productId, String(p.vatRate)])
    expect(saetze).toEqual([
      ['eier', '10.00'],
      ['holz', '13.00'],
    ])
  })
})

describe('ohne NUR_BETRIEBE-Position', () => {
  it('bestellt als PRIVAT ohne Nummer, wie bisher', async () => {
    const res = await POST(anfrage([{ productId: 'eier', name: 'Eier' }]))

    expect(res.status).toBe(200)
    expect(bestellung().kaeuferArt).toBe('PRIVAT')
    expect(bestellung().betriebsnummer).toBeNull()
  })

  it('eine mitgeschickte Nummer bei PRIVAT wird nicht gespeichert', async () => {
    await POST(anfrage([{ productId: 'eier', name: 'Eier' }], { betriebsnummer: 'AT 1234567' }))
    expect(bestellung().betriebsnummer).toBeNull()
  })
})

describe('mit NUR_BETRIEBE-Position', () => {
  it('als PRIVAT: 400 BETRIEBSNACHWEIS_FEHLT, kein Bestand gebucht, keine Bestellung', async () => {
    const res = await POST(anfrage([{ productId: 'eier', name: 'Eier' }, { productId: 'hafer', name: 'Hafer' }]))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('BETRIEBSNACHWEIS_FEHLT')
    expect(body.error).toBe(BETRIEBSNACHWEIS_FEHLER)
    expect(productUpdateMany).not.toHaveBeenCalled()
    expect(orderCreate).not.toHaveBeenCalled()
  })

  it('als BETRIEB mit zu kurzer Nummer: ebenfalls 400', async () => {
    const res = await POST(
      anfrage([{ productId: 'hafer', name: 'Hafer' }], { kaeuferArt: 'BETRIEB', betriebsnummer: '1234' })
    )

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('BETRIEBSNACHWEIS_FEHLT')
    expect(orderCreate).not.toHaveBeenCalled()
  })

  it('als BETRIEB mit Nummer: die Bestellung entsteht mit Käuferart und getrimmter Nummer', async () => {
    const res = await POST(
      anfrage([{ productId: 'hafer', name: 'Hafer' }], { kaeuferArt: 'BETRIEB', betriebsnummer: '  AT 1234567 ' })
    )

    expect(res.status).toBe(200)
    expect(bestellung().kaeuferArt).toBe('BETRIEB')
    expect(bestellung().betriebsnummer).toBe('AT 1234567')
  })
})

describe('Produkte eines anderen Hofs', () => {
  it('gehen nicht durch: 409, keine Bestellung', async () => {
    const res = await POST(anfrage([{ productId: 'fremd', name: 'Fremd' }]))

    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('WARENKORB_GEAENDERT')
    expect(orderCreate).not.toHaveBeenCalled()
  })
})
