/**
 * Tests für die Durchsetzung der Shop-Pause (shop-pause).
 *
 * Beweist am echten Route-Handler: Bei Farm.isPaused = true lehnen
 * /api/checkout und /api/reserve mit HTTP 409 und deutscher Meldung ab —
 * und zwar BEVOR eine Bestellung, eine Reservierung oder ein Stripe-Vorgang
 * entsteht. Bei aktivem Shop läuft beides unverändert durch.
 *
 * Prisma/Stripe/E-Mail sind gemockt — keine DB-, Zahlungs- oder Mailzugriffe.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn() },
    product: { findUnique: vi.fn(), update: vi.fn() },
    stockReservation: { aggregate: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    order: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    customerFarmSubscription: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn() } },
}))
vi.mock('@/lib/email', () => ({
  sendOnsiteConfirmation: vi.fn(),
}))

import { POST as checkoutPOST } from '@/app/api/checkout/route'
import { POST as reservePOST } from '@/app/api/reserve/route'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { sendOnsiteConfirmation } from '@/lib/email'
import { SHOP_PAUSED_MESSAGE } from '@/lib/shop-pause'

const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const productFindUnique = vi.mocked(prisma.product.findUnique)
const reservationAggregate = vi.mocked(prisma.stockReservation.aggregate)
const reservationDeleteMany = vi.mocked(prisma.stockReservation.deleteMany)
const reservationUpsert = vi.mocked(prisma.stockReservation.upsert)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const orderFindUnique = vi.mocked(prisma.order.findUnique)
const orderCreate = vi.mocked(prisma.order.create)
const orderUpdate = vi.mocked(prisma.order.update)
const productUpdate = vi.mocked(prisma.product.update)
const paymentIntentCreate = vi.mocked(stripe.paymentIntents.create)

// ── Testdaten ───────────────────────────────────────────────────────────────

const ACTIVE_FARM = {
  id: 'farm_1',
  slug: 'testhof',
  name: 'Testhof',
  email: 'hof@test.local',
  ownerName: 'Franz',
  address: 'Weg 1',
  postalCode: '5270',
  city: 'Mauerkirchen',
  phone: '',
  isActive: true,
  isPaused: false,
  approvedAt: new Date('2026-01-01T00:00:00.000Z'),
  acceptsOnline: false,
  acceptsOnsite: true,
  stripeAccountReady: false,
  stripeAccountId: null,
  platformFeePercent: 0,
  owner: { name: 'Franz' },
}

const CHECKOUT_BODY = {
  farmId: 'farm_1',
  farmSlug: 'testhof',
  sessionId: 'sess_a',
  customerName: 'Anna Testerin',
  customerEmail: 'kundin@test.local',
  customerPhone: '+43 660 1234567',
  customerNote: '',
  pickupDate: '2026-08-01',
  pickupTimeStart: '09:00',
  pickupTimeEnd: '12:00',
  paymentMethod: 'ONSITE_CASH',
  optInEmail: false,
  optInWhatsApp: false,
  items: [{ productId: 'prod_1', name: 'Eier', quantity: 2, unitPrice: 3.5 }],
}

function checkoutRequest(body: unknown = CHECKOUT_BODY) {
  return new NextRequest('http://localhost/api/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function reserveRequest(body: unknown = { productId: 'prod_1', quantity: 2, sessionId: 'sess_a' }) {
  return new NextRequest('http://localhost/api/reserve', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Voller Happy-Path-Bestand: jeder Aufruf liefert etwas Sinnvolles,
  // damit ein NICHT pausierter Shop komplett durchläuft.
  farmFindUnique.mockResolvedValue(ACTIVE_FARM as never)
  productFindUnique.mockResolvedValue({
    id: 'prod_1', stock: 10, isAvailable: true, name: 'Eier',
    unit: 'STUECK', unitSize: null,
    farm: { isPaused: false, approvedAt: new Date('2026-01-01T00:00:00.000Z') },
  } as never)
  productUpdate.mockResolvedValue({} as never)
  reservationAggregate.mockResolvedValue({ _sum: { quantity: null } } as never)
  reservationDeleteMany.mockResolvedValue({ count: 0 } as never)
  reservationUpsert.mockResolvedValue({} as never)
  userFindUnique.mockResolvedValue({ id: 'user_1' } as never)
  orderFindUnique.mockResolvedValue(null)
  orderCreate.mockResolvedValue({ id: 'order_1' } as never)
  orderUpdate.mockResolvedValue({} as never)
  vi.mocked(sendOnsiteConfirmation).mockResolvedValue(undefined as never)
})

// ── /api/checkout ───────────────────────────────────────────────────────────

describe('/api/checkout bei pausiertem Shop', () => {
  it('lehnt mit 409 und deutscher Meldung ab', async () => {
    farmFindUnique.mockResolvedValue({ ...ACTIVE_FARM, isPaused: true } as never)

    const res = await checkoutPOST(checkoutRequest())

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(SHOP_PAUSED_MESSAGE)
    expect(SHOP_PAUSED_MESSAGE).toBe('Der Hofladen ist derzeit pausiert.')
  })

  it('erzeugt dabei WEDER Bestellung NOCH Zahlungsvorgang (fail-closed vor jeder Mutation)', async () => {
    farmFindUnique.mockResolvedValue({ ...ACTIVE_FARM, isPaused: true } as never)

    await checkoutPOST(checkoutRequest())

    expect(orderCreate).not.toHaveBeenCalled()
    expect(paymentIntentCreate).not.toHaveBeenCalled()
    expect(productUpdate).not.toHaveBeenCalled()
    expect(sendOnsiteConfirmation).not.toHaveBeenCalled()
  })

  it('greift auch bei Online-Zahlung, bevor Stripe gefragt wird', async () => {
    farmFindUnique.mockResolvedValue({
      ...ACTIVE_FARM, isPaused: true,
      acceptsOnline: true, stripeAccountReady: true, stripeAccountId: 'acct_1',
    } as never)

    const res = await checkoutPOST(checkoutRequest({ ...CHECKOUT_BODY, paymentMethod: 'ONLINE' }))

    expect(res.status).toBe(409)
    expect(paymentIntentCreate).not.toHaveBeenCalled()
    expect(orderCreate).not.toHaveBeenCalled()
  })
})

describe('/api/checkout bei aktivem Shop', () => {
  it('bestellt unverändert weiter', async () => {
    const res = await checkoutPOST(checkoutRequest())

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.orderId).toBe('order_1')
    expect(json.requiresConfirmation).toBe(true)
    expect(orderCreate).toHaveBeenCalledTimes(1)
  })

  it('lehnt einen inaktiven Hof weiterhin mit 404 ab (Pause-Guard verdrängt das nicht)', async () => {
    farmFindUnique.mockResolvedValue({ ...ACTIVE_FARM, isActive: false } as never)

    const res = await checkoutPOST(checkoutRequest())

    expect(res.status).toBe(404)
    expect(orderCreate).not.toHaveBeenCalled()
  })
})

// ── /api/reserve ────────────────────────────────────────────────────────────

describe('/api/reserve bei pausiertem Shop', () => {
  it('lehnt mit 409 und deutscher Meldung ab, ohne zu reservieren', async () => {
    productFindUnique.mockResolvedValue({
      stock: 10, isAvailable: true, farm: { isPaused: true, approvedAt: new Date('2026-01-01T00:00:00.000Z') },
    } as never)

    const res = await reservePOST(reserveRequest())

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(SHOP_PAUSED_MESSAGE)
    expect(reservationUpsert).not.toHaveBeenCalled()
  })

  it('blockiert auch, wenn genug Bestand da wäre', async () => {
    productFindUnique.mockResolvedValue({
      stock: 999, isAvailable: true, farm: { isPaused: true, approvedAt: new Date('2026-01-01T00:00:00.000Z') },
    } as never)

    const res = await reservePOST(reserveRequest({ productId: 'prod_1', quantity: 1, sessionId: 'sess_a' }))

    expect(res.status).toBe(409)
    expect(reservationUpsert).not.toHaveBeenCalled()
  })
})

describe('/api/reserve bei aktivem Shop', () => {
  it('reserviert unverändert weiter', async () => {
    const res = await reservePOST(reserveRequest())

    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(reservationUpsert).toHaveBeenCalledTimes(1)
  })
})

// ── Hof-Queries ─────────────────────────────────────────────────────────────

describe('Öffentliche Hof-Query', () => {
  it('liefert isPaused und pauseMessage mit — sonst könnte die Seite die Pause nicht zeigen', async () => {
    const { getPublicFarm } = await import('@/server/queries/farm')
    farmFindUnique.mockResolvedValue(null)

    await getPublicFarm('testhof')

    const arg = farmFindUnique.mock.calls[0]?.[0] as { select: Record<string, unknown> }
    expect(arg.select.isPaused).toBe(true)
    expect(arg.select.pauseMessage).toBe(true)
  })

  it('Owner-Query liefert die Pausen-Felder ebenfalls (Hinweisbalken in Edit und Vorschau)', async () => {
    const { getOwnerFarm } = await import('@/server/queries/farm')
    farmFindUnique.mockResolvedValue(null)

    await getOwnerFarm('user_1')

    const arg = farmFindUnique.mock.calls[0]?.[0] as { select: Record<string, unknown> }
    expect(arg.select.isPaused).toBe(true)
    expect(arg.select.pauseMessage).toBe(true)
  })
})
