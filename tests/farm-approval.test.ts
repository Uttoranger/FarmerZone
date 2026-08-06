/**
 * Tests für die Hof-Freischaltung (approvedAt).
 *
 * Beweist an den echten Route-Handlern, Queries und Server-Actions:
 *  - /api/checkout und /api/reserve lehnen bei approvedAt = null mit HTTP 409
 *    und eigenem Wortlaut ab — BEVOR Bestellung, Reservierung oder Stripe-
 *    Vorgang entstehen. Bei freigeschaltetem Hof läuft beides unverändert.
 *  - Die Prüfreihenfolge stimmt: archiviert sticht nicht-freigeschaltet,
 *    nicht-freigeschaltet sticht pausiert.
 *  - Die öffentliche Hof-Query filtert nicht freigeschaltete Höfe weg.
 *  - Die Freigabe-Actions wirken nur mit isAdmin — eine gültige Session
 *    allein genügt nicht.
 *  - Die Registrierung verlangt keinen Einladungscode mehr, und ein neu
 *    angelegter Hof entsteht ohne approvedAt (= wartet auf Freigabe).
 *
 * Prisma/Stripe/E-Mail/Auth sind gemockt — keine DB-, Zahlungs- oder Mailzugriffe.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn(), signUpEmail: vi.fn() } },
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    product: { findUnique: vi.fn(), update: vi.fn(), createMany: vi.fn() },
    stockReservation: { aggregate: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    order: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    customerFarmSubscription: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}))
vi.mock('@/lib/stripe', () => ({ stripe: { paymentIntents: { create: vi.fn() } } }))
vi.mock('@/lib/email', () => ({
  sendOnsiteConfirmation: vi.fn(),
  sendNewFarmNotification: vi.fn(),
}))

import { POST as checkoutPOST } from '@/app/api/checkout/route'
import { POST as reservePOST } from '@/app/api/reserve/route'
import { getPublicFarm } from '@/server/queries/farm'
import { approveFarmAction, revokeFarmApprovalAction } from '@/server/actions/admin'
import { registerFarmer } from '@/server/actions/register'
import { generateFormToken, MIN_FORM_AGE_MS } from '@/lib/form-token'
import { createFarm } from '@/server/actions/onboarding'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { FARM_NOT_APPROVED_MESSAGE } from '@/lib/farm-approval'
import { FARM_ARCHIVED_MESSAGE } from '@/lib/farm-archive'
import { SHOP_PAUSED_MESSAGE } from '@/lib/shop-pause'

const getSession = vi.mocked(auth.api.getSession)
const signUpEmail = vi.mocked(auth.api.signUpEmail)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const farmCreate = vi.mocked(prisma.farm.create)
const farmUpdate = vi.mocked(prisma.farm.update)
const productFindUnique = vi.mocked(prisma.product.findUnique)
const productUpdate = vi.mocked(prisma.product.update)
const reservationAggregate = vi.mocked(prisma.stockReservation.aggregate)
const reservationDeleteMany = vi.mocked(prisma.stockReservation.deleteMany)
const reservationUpsert = vi.mocked(prisma.stockReservation.upsert)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const userUpdate = vi.mocked(prisma.user.update)
const orderCreate = vi.mocked(prisma.order.create)
const paymentIntentCreate = vi.mocked(stripe.paymentIntents.create)

// ── Testdaten ───────────────────────────────────────────────────────────────

const FREIGESCHALTET = new Date('2026-01-01T00:00:00.000Z')
const STILLGELEGT = new Date('2026-07-01T10:00:00.000Z')

const FREIGEGEBENER_HOF = {
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

/**
 * Ein Formular-Token, das die Zeitschranke passiert: ausgestellt, dann die
 * Uhr um die Mindestdauer vorgestellt. Ohne Zeitreise wäre jedes frisch
 * erzeugte Token „zu schnell" und die Registrierung würde still abgelehnt.
 */
function alterFormToken(): string {
  const jetzt = Date.now()
  vi.useFakeTimers()
  vi.setSystemTime(jetzt)
  const token = generateFormToken()
  vi.setSystemTime(jetzt + MIN_FORM_AGE_MS)
  return token
}

function reserveRequest() {
  return new NextRequest('http://localhost/api/reserve', {
    method: 'POST',
    body: JSON.stringify({ productId: 'prod_1', quantity: 2, sessionId: 'sess_a' }),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  farmFindUnique.mockResolvedValue(FREIGEGEBENER_HOF as never)
  productFindUnique.mockResolvedValue({
    id: 'prod_1', stock: 10, isAvailable: true, name: 'Eier', unit: 'STUECK', unitSize: null,
    farm: { isPaused: false, archivedAt: null, approvedAt: FREIGESCHALTET },
  } as never)
  productUpdate.mockResolvedValue({} as never)
  reservationAggregate.mockResolvedValue({ _sum: { quantity: null } } as never)
  reservationDeleteMany.mockResolvedValue({ count: 0 } as never)
  reservationUpsert.mockResolvedValue({} as never)
  userFindUnique.mockResolvedValue({ id: 'user_1' } as never)
  userUpdate.mockResolvedValue({} as never)
  orderCreate.mockResolvedValue({ id: 'order_1' } as never)
  farmUpdate.mockResolvedValue({} as never)
  farmCreate.mockResolvedValue({ id: 'farm_neu', slug: 'neuer-hof', name: 'Neuer Hof' } as never)
  getSession.mockResolvedValue({ user: { id: 'user_1', email: 'franz@test.local' } } as never)
})

// alterFormToken() stellt die Uhr — sie darf nicht in den nächsten Test lecken.
afterEach(() => {
  vi.useRealTimers()
})

// ── Sperre bei fehlender Freigabe ───────────────────────────────────────────

describe('/api/checkout bei nicht freigeschaltetem Hof', () => {
  it('lehnt mit 409 und eigenem Wortlaut ab', async () => {
    farmFindUnique.mockResolvedValue({ ...FREIGEGEBENER_HOF, approvedAt: null } as never)

    const res = await checkoutPOST(checkoutRequest())

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(FARM_NOT_APPROVED_MESSAGE)
    expect(FARM_NOT_APPROVED_MESSAGE).toBe('Dieser Hof ist noch nicht freigeschaltet.')
  })

  it('erzeugt dabei WEDER Bestellung NOCH Zahlungsvorgang (fail-closed vor jeder Mutation)', async () => {
    farmFindUnique.mockResolvedValue({ ...FREIGEGEBENER_HOF, approvedAt: null } as never)

    await checkoutPOST(checkoutRequest())

    expect(orderCreate).not.toHaveBeenCalled()
    expect(paymentIntentCreate).not.toHaveBeenCalled()
    expect(productUpdate).not.toHaveBeenCalled()
  })

  it('greift auch bei Online-Zahlung, bevor Stripe gefragt wird', async () => {
    farmFindUnique.mockResolvedValue({
      ...FREIGEGEBENER_HOF, approvedAt: null,
      acceptsOnline: true, stripeAccountReady: true, stripeAccountId: 'acct_1',
    } as never)

    const res = await checkoutPOST(checkoutRequest({ ...CHECKOUT_BODY, paymentMethod: 'ONLINE' }))

    expect(res.status).toBe(409)
    expect(paymentIntentCreate).not.toHaveBeenCalled()
  })

  it('lässt einen freigeschalteten Hof unverändert durch', async () => {
    const res = await checkoutPOST(checkoutRequest())

    expect(res.status).toBe(200)
    expect(orderCreate).toHaveBeenCalledTimes(1)
  })
})

describe('/api/reserve bei nicht freigeschaltetem Hof', () => {
  it('lehnt mit 409 ab und legt keine Reservierung an', async () => {
    productFindUnique.mockResolvedValue({
      id: 'prod_1', stock: 10, isAvailable: true, name: 'Eier', unit: 'STUECK', unitSize: null,
      farm: { isPaused: false, archivedAt: null, approvedAt: null },
    } as never)

    const res = await reservePOST(reserveRequest())

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(FARM_NOT_APPROVED_MESSAGE)
    expect(reservationUpsert).not.toHaveBeenCalled()
  })

  it('lässt einen freigeschalteten Hof unverändert durch', async () => {
    const res = await reservePOST(reserveRequest())

    expect(res.status).toBe(200)
    expect(reservationUpsert).toHaveBeenCalledTimes(1)
  })
})

// ── Prüfreihenfolge ─────────────────────────────────────────────────────────

describe('Prüfreihenfolge: archiviert → nicht freigeschaltet → pausiert', () => {
  it('stillgelegt sticht fehlende Freigabe', async () => {
    farmFindUnique.mockResolvedValue({
      ...FREIGEGEBENER_HOF, archivedAt: STILLGELEGT, approvedAt: null,
    } as never)

    const res = await checkoutPOST(checkoutRequest())

    expect((await res.json()).error).toBe(FARM_ARCHIVED_MESSAGE)
  })

  it('fehlende Freigabe sticht die Pause', async () => {
    farmFindUnique.mockResolvedValue({
      ...FREIGEGEBENER_HOF, approvedAt: null, isPaused: true,
    } as never)

    const res = await checkoutPOST(checkoutRequest())

    expect((await res.json()).error).toBe(FARM_NOT_APPROVED_MESSAGE)
  })

  it('bei freigeschaltetem, pausiertem Hof bleibt es bei der Pausen-Meldung', async () => {
    farmFindUnique.mockResolvedValue({ ...FREIGEGEBENER_HOF, isPaused: true } as never)

    const res = await checkoutPOST(checkoutRequest())

    expect((await res.json()).error).toBe(SHOP_PAUSED_MESSAGE)
  })

  it('dieselbe Reihenfolge gilt in /api/reserve', async () => {
    productFindUnique.mockResolvedValue({
      id: 'prod_1', stock: 10, isAvailable: true, name: 'Eier', unit: 'STUECK', unitSize: null,
      farm: { isPaused: true, archivedAt: null, approvedAt: null },
    } as never)

    const res = await reservePOST(reserveRequest())

    expect((await res.json()).error).toBe(FARM_NOT_APPROVED_MESSAGE)
  })
})

// ── Öffentliche Sichtbarkeit ────────────────────────────────────────────────

describe('öffentliche Hof-Query', () => {
  it('filtert nicht freigeschaltete Höfe über die where-Bedingung weg', async () => {
    farmFindUnique.mockResolvedValue(null)

    const farm = await getPublicFarm('testhof')

    expect(farm).toBeNull()
    const arg = farmFindUnique.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(arg.where).toMatchObject({
      slug: 'testhof',
      isActive: true,
      archivedAt: null,
      approvedAt: { not: null },
    })
  })
})

// ── Admin-Actions ───────────────────────────────────────────────────────────

describe('Freigabe-Actions', () => {
  it('schaltet mit isAdmin frei und setzt approvedAt auf einen Zeitstempel', async () => {
    userFindUnique.mockResolvedValue({ isAdmin: true } as never)
    farmFindUnique.mockResolvedValue({ slug: 'testhof' } as never)

    const result = await approveFarmAction('farm_1')

    expect(result.error).toBeUndefined()
    expect(farmUpdate).toHaveBeenCalledTimes(1)
    const arg = farmUpdate.mock.calls[0][0] as { data: { approvedAt: Date } }
    expect(arg.data.approvedAt).toBeInstanceOf(Date)
  })

  it('nimmt mit isAdmin die Freigabe zurück (approvedAt = null)', async () => {
    userFindUnique.mockResolvedValue({ isAdmin: true } as never)
    farmFindUnique.mockResolvedValue({ slug: 'testhof' } as never)

    const result = await revokeFarmApprovalAction('farm_1')

    expect(result.error).toBeUndefined()
    const arg = farmUpdate.mock.calls[0][0] as { data: { approvedAt: null } }
    expect(arg.data.approvedAt).toBeNull()
  })

  it('lehnt ohne isAdmin ab, obwohl eine gültige Session besteht — und ändert nichts', async () => {
    userFindUnique.mockResolvedValue({ isAdmin: false } as never)

    const result = await approveFarmAction('farm_1')

    expect(result.error).toBe('Kein Zugriff.')
    expect(farmUpdate).not.toHaveBeenCalled()
  })

  it('lehnt das Zurücknehmen ohne isAdmin ebenfalls ab', async () => {
    userFindUnique.mockResolvedValue({ isAdmin: false } as never)

    const result = await revokeFarmApprovalAction('farm_1')

    expect(result.error).toBe('Kein Zugriff.')
    expect(farmUpdate).not.toHaveBeenCalled()
  })

  it('lehnt ohne Session ab', async () => {
    getSession.mockResolvedValue(null as never)

    const result = await approveFarmAction('farm_1')

    expect(result.error).toBe('Nicht angemeldet.')
    expect(farmUpdate).not.toHaveBeenCalled()
  })

  it('liest das Admin-Recht aus der Datenbank, nicht aus der Session', async () => {
    // Session behauptet isAdmin — die Datenbank sagt nein. Die DB gewinnt.
    getSession.mockResolvedValue({ user: { id: 'user_1', isAdmin: true } } as never)
    userFindUnique.mockResolvedValue({ isAdmin: false } as never)

    const result = await approveFarmAction('farm_1')

    expect(result.error).toBe('Kein Zugriff.')
    expect(farmUpdate).not.toHaveBeenCalled()
  })
})

// ── Registrierung ───────────────────────────────────────────────────────────

describe('Registrierung ohne Einladungscode', () => {
  it('läuft ohne Code durch, auch wenn FARMER_SIGNUP_CODE gesetzt ist', async () => {
    vi.stubEnv('FARMER_SIGNUP_CODE', 'geheim')
    signUpEmail.mockResolvedValue({ user: { id: 'user_neu' } } as never)

    const result = await registerFarmer({
      firstName: 'Franz',
      lastName: 'Müller',
      email: 'franz@test.local',
      password: 'Hofladen1',
      // Leerer Honigtopf und ein Zeitstempel, der die Drei-Sekunden-Schranke
      // passiert — die Bot-Abwehr steht der echten Anmeldung nicht im Weg.
      // Eigene Suite dafür: tests/register-spam.test.ts
      website: '',
      formToken: alterFormToken(),
    })

    expect(result).toEqual({ ok: true })
    expect(signUpEmail).toHaveBeenCalledTimes(1)
    vi.unstubAllEnvs()
  })

  it('legt einen neuen Hof ohne approvedAt an — er wartet also auf die Freigabe', async () => {
    farmFindUnique.mockResolvedValue(null)

    await createFarm({
      name: 'Neuer Hof',
      ownerName: 'Franz Müller',
      description: 'Beschreibung',
      address: 'Weg 1',
      postalCode: '5270',
      city: 'Mauerkirchen',
      phone: '+43 660 1234567',
      email: 'neuer@test.local',
    })

    expect(farmCreate).toHaveBeenCalledTimes(1)
    const arg = farmCreate.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(arg.data.approvedAt).toBeUndefined()
  })
})
