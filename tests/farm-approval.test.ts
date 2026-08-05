/**
 * Tests für die Hof-Freigabe (approvedAt).
 *
 * Beweist am echten Route-Handler bzw. an der echten Server-Action:
 *  - /api/checkout und /api/reserve lehnen einen noch nicht freigeschalteten
 *    Hof mit HTTP 409 ab, BEVOR Bestellung, Reservierung oder Stripe-Vorgang
 *    entstehen; ein freigeschalteter Hof läuft unverändert durch.
 *  - Die Prüfreihenfolge stillgelegt → nicht freigeschaltet → pausiert gilt.
 *  - Die öffentliche Hof-Query filtert wartende Höfe weg (notFound-Pfad).
 *  - Die Freigabe-Action wirkt nur mit isAdmin — auch eine angemeldete
 *    Bäuerin ohne Adminrecht kommt nicht durch.
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
    farm: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    product: { findUnique: vi.fn(), update: vi.fn() },
    stockReservation: { aggregate: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    order: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    customerFarmSubscription: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}))
vi.mock('@/lib/stripe', () => ({ stripe: { paymentIntents: { create: vi.fn() } } }))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))

import { POST as checkoutPOST } from '@/app/api/checkout/route'
import { POST as reservePOST } from '@/app/api/reserve/route'
import { freischaltenAction, freigabeZuruecknehmenAction } from '@/server/actions/admin'
import { getPublicFarm } from '@/server/queries/farm'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { sendOnsiteConfirmation } from '@/lib/email'
import { FARM_NOT_APPROVED_MESSAGE } from '@/lib/farm-approval'
import { FARM_ARCHIVED_MESSAGE } from '@/lib/farm-archive'
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
const paymentIntentCreate = vi.mocked(stripe.paymentIntents.create)

const FREIGESCHALTET = new Date('2026-07-01T10:00:00.000Z')
const STILLGELEGT = new Date('2026-07-20T10:00:00.000Z')

const AKTIVER_HOF = {
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
  farmFindUnique.mockResolvedValue(AKTIVER_HOF as never)
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
  farmUpdate.mockResolvedValue({} as never)
  getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
  vi.mocked(sendOnsiteConfirmation).mockResolvedValue(undefined as never)
})

// ── /api/checkout ───────────────────────────────────────────────────────────

describe('/api/checkout bei noch nicht freigeschaltetem Hof', () => {
  it('lehnt mit 409 und eigenem Wortlaut ab', async () => {
    farmFindUnique.mockResolvedValue({ ...AKTIVER_HOF, approvedAt: null } as never)

    const res = await checkoutPOST(checkoutRequest())

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(FARM_NOT_APPROVED_MESSAGE)
    expect(FARM_NOT_APPROVED_MESSAGE).toBe('Dieser Hof ist noch nicht freigeschaltet.')
  })

  it('erzeugt WEDER Bestellung NOCH Zahlungsvorgang', async () => {
    farmFindUnique.mockResolvedValue({ ...AKTIVER_HOF, approvedAt: null } as never)

    await checkoutPOST(checkoutRequest())

    expect(orderCreate).not.toHaveBeenCalled()
    expect(paymentIntentCreate).not.toHaveBeenCalled()
    expect(productUpdate).not.toHaveBeenCalled()
    expect(sendOnsiteConfirmation).not.toHaveBeenCalled()
  })

  it('greift auch bei Online-Zahlung, bevor Stripe gefragt wird', async () => {
    farmFindUnique.mockResolvedValue({
      ...AKTIVER_HOF, approvedAt: null,
      acceptsOnline: true, stripeAccountReady: true, stripeAccountId: 'acct_1',
    } as never)

    const res = await checkoutPOST(checkoutRequest({ ...CHECKOUT_BODY, paymentMethod: 'ONLINE' }))

    expect(res.status).toBe(409)
    expect(paymentIntentCreate).not.toHaveBeenCalled()
  })
})

describe('Prüfreihenfolge: stillgelegt → nicht freigeschaltet → pausiert', () => {
  it('stillgelegt sticht die fehlende Freigabe', async () => {
    farmFindUnique.mockResolvedValue({
      ...AKTIVER_HOF, archivedAt: STILLGELEGT, approvedAt: null, isPaused: true,
    } as never)

    const res = await checkoutPOST(checkoutRequest())
    expect((await res.json()).error).toBe(FARM_ARCHIVED_MESSAGE)
  })

  it('fehlende Freigabe sticht die Pause', async () => {
    farmFindUnique.mockResolvedValue({
      ...AKTIVER_HOF, approvedAt: null, isPaused: true,
    } as never)

    const res = await checkoutPOST(checkoutRequest())
    expect((await res.json()).error).toBe(FARM_NOT_APPROVED_MESSAGE)
  })

  it('bei freigeschaltetem Hof bleibt die Pausen-Meldung erhalten', async () => {
    farmFindUnique.mockResolvedValue({ ...AKTIVER_HOF, isPaused: true } as never)

    const res = await checkoutPOST(checkoutRequest())
    expect((await res.json()).error).toBe(SHOP_PAUSED_MESSAGE)
  })
})

describe('/api/checkout bei freigeschaltetem Hof', () => {
  it('bestellt unverändert weiter', async () => {
    const res = await checkoutPOST(checkoutRequest())

    expect(res.status).toBe(200)
    expect((await res.json()).orderId).toBe('order_1')
    expect(orderCreate).toHaveBeenCalledTimes(1)
  })
})

// ── /api/reserve ────────────────────────────────────────────────────────────

describe('/api/reserve', () => {
  it('lehnt bei fehlender Freigabe mit 409 ab, ohne zu reservieren', async () => {
    productFindUnique.mockResolvedValue({
      stock: 10, isAvailable: true,
      farm: { isPaused: false, archivedAt: null, approvedAt: null },
    } as never)

    const res = await reservePOST(reserveRequest())

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(FARM_NOT_APPROVED_MESSAGE)
    expect(reservationUpsert).not.toHaveBeenCalled()
  })

  it('hält dieselbe Prüfreihenfolge ein wie der Checkout', async () => {
    productFindUnique.mockResolvedValue({
      stock: 10, isAvailable: true,
      farm: { isPaused: true, archivedAt: STILLGELEGT, approvedAt: null },
    } as never)

    const res = await reservePOST(reserveRequest())
    expect((await res.json()).error).toBe(FARM_ARCHIVED_MESSAGE)
  })

  it('reserviert bei freigeschaltetem Hof unverändert weiter', async () => {
    const res = await reservePOST(reserveRequest())

    expect(res.status).toBe(200)
    expect(reservationUpsert).toHaveBeenCalledTimes(1)
  })
})

// ── Öffentliche Hof-Query ───────────────────────────────────────────────────

describe('Öffentliche Hof-Query', () => {
  it('filtert wartende Höfe weg — die Seite läuft in notFound', async () => {
    farmFindUnique.mockResolvedValue(null)

    const farm = await getPublicFarm('testhof')

    expect(farm).toBeNull()
    const arg = farmFindUnique.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    expect(arg.where).toMatchObject({
      slug: 'testhof',
      isActive: true,
      archivedAt: null,
      approvedAt: { not: null },
    })
  })
})

// ── Freigabe-Action ─────────────────────────────────────────────────────────

describe('freischaltenAction', () => {
  it('schaltet mit Adminrecht frei', async () => {
    userFindUnique.mockResolvedValue({ isAdmin: true } as never)
    farmFindUnique.mockResolvedValue({ slug: 'testhof', approvedAt: null } as never)

    const res = await freischaltenAction('farm_1')

    expect(res.error).toBeUndefined()
    expect(farmUpdate).toHaveBeenCalledWith({
      where: { id: 'farm_1' },
      data: { approvedAt: expect.any(Date) },
    })
  })

  it('lehnt eine angemeldete Nutzerin OHNE Adminrecht ab', async () => {
    userFindUnique.mockResolvedValue({ isAdmin: false } as never)

    const res = await freischaltenAction('farm_1')

    expect(res.error).toBe('Keine Berechtigung')
    expect(farmUpdate).not.toHaveBeenCalled()
  })

  it('lehnt ohne Anmeldung ab', async () => {
    getSession.mockResolvedValue(null as never)

    const res = await freischaltenAction('farm_1')

    expect(res.error).toBe('Nicht angemeldet')
    expect(farmUpdate).not.toHaveBeenCalled()
  })

  it('setzt ausschließlich approvedAt — keine anderen Hofdaten', async () => {
    userFindUnique.mockResolvedValue({ isAdmin: true } as never)
    farmFindUnique.mockResolvedValue({ slug: 'testhof', approvedAt: null } as never)

    await freischaltenAction('farm_1')

    const arg = farmUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(Object.keys(arg.data)).toEqual(['approvedAt'])
  })
})

describe('freigabeZuruecknehmenAction', () => {
  it('setzt approvedAt mit Adminrecht auf null zurück', async () => {
    userFindUnique.mockResolvedValue({ isAdmin: true } as never)
    farmFindUnique.mockResolvedValue({ slug: 'testhof' } as never)

    const res = await freigabeZuruecknehmenAction('farm_1')

    expect(res.error).toBeUndefined()
    expect(farmUpdate).toHaveBeenCalledWith({
      where: { id: 'farm_1' },
      data: { approvedAt: null },
    })
  })

  it('lehnt ohne Adminrecht ab', async () => {
    userFindUnique.mockResolvedValue({ isAdmin: false } as never)

    const res = await freigabeZuruecknehmenAction('farm_1')

    expect(res.error).toBe('Keine Berechtigung')
    expect(farmUpdate).not.toHaveBeenCalled()
  })
})
