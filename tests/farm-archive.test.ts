/**
 * Tests für die Hof-Stilllegung (archivedAt).
 *
 * Beweist am echten Route-Handler bzw. an der echten Server-Action:
 *  - /api/checkout und /api/reserve lehnen bei gesetztem archivedAt mit HTTP 409
 *    und eigenem Wortlaut ab — BEVOR Bestellung, Reservierung oder Stripe-Vorgang
 *    entstehen. Bei aktivem Hof läuft beides unverändert durch.
 *  - Die öffentliche Hof-Query filtert stillgelegte Höfe weg (notFound-Pfad).
 *  - Der Guard verhindert die Stilllegung bei offenen Bestellungen und erlaubt
 *    sie, sobald keine mehr offen ist.
 *
 * Prisma/Stripe/E-Mail/Auth sind gemockt — keine DB-, Zahlungs- oder Mailzugriffe.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn(), update: vi.fn() },
    product: { findUnique: vi.fn(), update: vi.fn() },
    stockReservation: { aggregate: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    order: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
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
import { archiveFarm, reactivateFarm } from '@/server/actions/farm-archive'
import { getPublicFarm } from '@/server/queries/farm'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { sendOnsiteConfirmation } from '@/lib/email'
import { FARM_ARCHIVED_MESSAGE, farmArchiveBlockedMessage } from '@/lib/farm-archive'
import { SHOP_PAUSED_MESSAGE } from '@/lib/shop-pause'

const getSession = vi.mocked(auth.api.getSession)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const farmUpdate = vi.mocked(prisma.farm.update)
const productFindUnique = vi.mocked(prisma.product.findUnique)
const productUpdate = vi.mocked(prisma.product.update)
const reservationAggregate = vi.mocked(prisma.stockReservation.aggregate)
const reservationDeleteMany = vi.mocked(prisma.stockReservation.deleteMany)
const reservationUpsert = vi.mocked(prisma.stockReservation.upsert)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const orderFindUnique = vi.mocked(prisma.order.findUnique)
const orderCreate = vi.mocked(prisma.order.create)
const orderUpdate = vi.mocked(prisma.order.update)
const orderCount = vi.mocked(prisma.order.count)
const paymentIntentCreate = vi.mocked(stripe.paymentIntents.create)

// ── Testdaten ───────────────────────────────────────────────────────────────

// Ein aktiver Hof ist seit dem Freischaltungs-Sprint auch freigeschaltet.
const FREIGESCHALTET = new Date('2026-01-01T00:00:00.000Z')

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
  archivedAt: null,
  approvedAt: FREIGESCHALTET,
  acceptsOnline: false,
  acceptsOnsite: true,
  stripeAccountReady: false,
  stripeAccountId: null,
  platformFeePercent: 0,
  owner: { name: 'Franz' },
}

const STILLGELEGT = new Date('2026-07-01T10:00:00.000Z')

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
  // Voller Happy-Path: ein aktiver Hof läuft komplett durch.
  farmFindUnique.mockResolvedValue(ACTIVE_FARM as never)
  productFindUnique.mockResolvedValue({
    id: 'prod_1', stock: 10, isAvailable: true, name: 'Eier',
    unit: 'STUECK', unitSize: null,
    farm: { isPaused: false, archivedAt: null, approvedAt: FREIGESCHALTET },
  } as never)
  productUpdate.mockResolvedValue({} as never)
  reservationAggregate.mockResolvedValue({ _sum: { quantity: null } } as never)
  reservationDeleteMany.mockResolvedValue({ count: 0 } as never)
  reservationUpsert.mockResolvedValue({} as never)
  userFindUnique.mockResolvedValue({ id: 'user_1' } as never)
  orderFindUnique.mockResolvedValue(null)
  orderCreate.mockResolvedValue({ id: 'order_1' } as never)
  orderUpdate.mockResolvedValue({} as never)
  orderCount.mockResolvedValue(0 as never)
  farmUpdate.mockResolvedValue({} as never)
  getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
  vi.mocked(sendOnsiteConfirmation).mockResolvedValue(undefined as never)
})

// ── /api/checkout ───────────────────────────────────────────────────────────

describe('/api/checkout bei stillgelegtem Hof', () => {
  it('lehnt mit 409 und eigenem Wortlaut ab', async () => {
    farmFindUnique.mockResolvedValue({ ...ACTIVE_FARM, archivedAt: STILLGELEGT } as never)

    const res = await checkoutPOST(checkoutRequest())

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(FARM_ARCHIVED_MESSAGE)
    expect(FARM_ARCHIVED_MESSAGE).toBe('Dieser Hof nimmt keine Bestellungen mehr entgegen.')
  })

  it('erzeugt dabei WEDER Bestellung NOCH Zahlungsvorgang (fail-closed vor jeder Mutation)', async () => {
    farmFindUnique.mockResolvedValue({ ...ACTIVE_FARM, archivedAt: STILLGELEGT } as never)

    await checkoutPOST(checkoutRequest())

    expect(orderCreate).not.toHaveBeenCalled()
    expect(paymentIntentCreate).not.toHaveBeenCalled()
    expect(productUpdate).not.toHaveBeenCalled()
    expect(sendOnsiteConfirmation).not.toHaveBeenCalled()
  })

  it('greift auch bei Online-Zahlung, bevor Stripe gefragt wird', async () => {
    farmFindUnique.mockResolvedValue({
      ...ACTIVE_FARM, archivedAt: STILLGELEGT,
      acceptsOnline: true, stripeAccountReady: true, stripeAccountId: 'acct_1',
    } as never)

    const res = await checkoutPOST(checkoutRequest({ ...CHECKOUT_BODY, paymentMethod: 'ONLINE' }))

    expect(res.status).toBe(409)
    expect(paymentIntentCreate).not.toHaveBeenCalled()
    expect(orderCreate).not.toHaveBeenCalled()
  })

  it('nennt die Stilllegung, nicht die Pause, wenn beides gesetzt ist', async () => {
    farmFindUnique.mockResolvedValue({
      ...ACTIVE_FARM, archivedAt: STILLGELEGT, isPaused: true,
    } as never)

    const res = await checkoutPOST(checkoutRequest())

    // Der dauerhafte Zustand sticht den vorübergehenden: „bald wieder da"
    // wäre bei einem stillgelegten Hof eine falsche Zusage.
    expect((await res.json()).error).toBe(FARM_ARCHIVED_MESSAGE)
  })
})

describe('/api/checkout bei aktivem Hof', () => {
  it('bestellt unverändert weiter', async () => {
    const res = await checkoutPOST(checkoutRequest())

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.orderId).toBe('order_1')
    expect(json.requiresConfirmation).toBe(true)
    expect(orderCreate).toHaveBeenCalledTimes(1)
  })

  it('lehnt einen pausierten Hof weiterhin mit der Pausen-Meldung ab', async () => {
    farmFindUnique.mockResolvedValue({ ...ACTIVE_FARM, isPaused: true } as never)

    const res = await checkoutPOST(checkoutRequest())

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(SHOP_PAUSED_MESSAGE)
  })
})

// ── /api/reserve ────────────────────────────────────────────────────────────

describe('/api/reserve bei stillgelegtem Hof', () => {
  it('lehnt mit 409 und eigenem Wortlaut ab, ohne zu reservieren', async () => {
    productFindUnique.mockResolvedValue({
      stock: 10, isAvailable: true, farm: { isPaused: false, archivedAt: STILLGELEGT },
    } as never)

    const res = await reservePOST(reserveRequest())

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(FARM_ARCHIVED_MESSAGE)
    expect(reservationUpsert).not.toHaveBeenCalled()
  })

  it('blockiert auch, wenn genug Bestand da wäre', async () => {
    productFindUnique.mockResolvedValue({
      stock: 999, isAvailable: true, farm: { isPaused: false, archivedAt: STILLGELEGT },
    } as never)

    const res = await reservePOST(
      reserveRequest({ productId: 'prod_1', quantity: 1, sessionId: 'sess_a' })
    )

    expect(res.status).toBe(409)
    expect(reservationUpsert).not.toHaveBeenCalled()
  })
})

describe('/api/reserve bei aktivem Hof', () => {
  it('reserviert unverändert weiter', async () => {
    const res = await reservePOST(reserveRequest())

    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(reservationUpsert).toHaveBeenCalledTimes(1)
  })
})

// ── Öffentliche Hof-Query ───────────────────────────────────────────────────

describe('Öffentliche Hof-Query', () => {
  it('filtert stillgelegte Höfe weg — die Seite läuft damit in notFound', async () => {
    farmFindUnique.mockResolvedValue(null)

    const farm = await getPublicFarm('testhof')

    expect(farm).toBeNull()
    const arg = farmFindUnique.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    expect(arg.where).toMatchObject({ slug: 'testhof', isActive: true, archivedAt: null })
  })
})

// ── Guard: Stilllegen nur ohne offene Bestellungen ──────────────────────────

describe('archiveFarm — Guard gegen offene Bestellungen', () => {
  it('legt nicht still, solange offene Bestellungen existieren, und meldet die Anzahl', async () => {
    farmFindUnique.mockResolvedValue({ id: 'farm_1', slug: 'testhof', archivedAt: null } as never)
    orderCount.mockResolvedValue(3 as never)

    const res = await archiveFarm()

    expect(res.openOrders).toBe(3)
    expect(farmUpdate).not.toHaveBeenCalled()
    expect(farmArchiveBlockedMessage(3)).toContain('3 offene Bestellungen')
  })

  it('zählt als offen genau die Status, die auch das Bestell-Badge zählt', async () => {
    farmFindUnique.mockResolvedValue({ id: 'farm_1', slug: 'testhof', archivedAt: null } as never)
    orderCount.mockResolvedValue(1 as never)

    await archiveFarm()

    expect(orderCount).toHaveBeenCalledWith({
      where: {
        farmId: 'farm_1',
        status: {
          in: ['PENDING_CONFIRMATION', 'PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY'],
        },
      },
    })
  })

  it('legt still, wenn keine Bestellung mehr offen ist', async () => {
    farmFindUnique.mockResolvedValue({ id: 'farm_1', slug: 'testhof', archivedAt: null } as never)
    orderCount.mockResolvedValue(0 as never)

    const res = await archiveFarm()

    expect(res.error).toBeUndefined()
    expect(res.openOrders).toBeUndefined()
    expect(farmUpdate).toHaveBeenCalledWith({
      where: { id: 'farm_1' },
      data: { archivedAt: expect.any(Date) },
    })
  })

  it('löscht dabei nichts — es wird ausschließlich archivedAt gesetzt', async () => {
    farmFindUnique.mockResolvedValue({ id: 'farm_1', slug: 'testhof', archivedAt: null } as never)

    await archiveFarm()

    const arg = farmUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(Object.keys(arg.data)).toEqual(['archivedAt'])
  })

  it('verlangt eine Anmeldung', async () => {
    getSession.mockResolvedValue(null as never)

    const res = await archiveFarm()

    expect(res.error).toBe('Nicht angemeldet')
    expect(farmUpdate).not.toHaveBeenCalled()
  })
})

describe('reactivateFarm', () => {
  it('setzt archivedAt zurück auf null und lässt isPaused unberührt', async () => {
    farmFindUnique.mockResolvedValue({
      id: 'farm_1', slug: 'testhof', archivedAt: STILLGELEGT,
    } as never)

    const res = await reactivateFarm()

    expect(res.error).toBeUndefined()
    expect(farmUpdate).toHaveBeenCalledWith({
      where: { id: 'farm_1' },
      data: { archivedAt: null },
    })
    const arg = farmUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(Object.keys(arg.data)).toEqual(['archivedAt'])
  })

  it('braucht keinen Guard — Reaktivieren ist immer erlaubt', async () => {
    farmFindUnique.mockResolvedValue({
      id: 'farm_1', slug: 'testhof', archivedAt: STILLGELEGT,
    } as never)
    orderCount.mockResolvedValue(5 as never)

    const res = await reactivateFarm()

    expect(res.error).toBeUndefined()
    expect(farmUpdate).toHaveBeenCalledTimes(1)
  })
})
