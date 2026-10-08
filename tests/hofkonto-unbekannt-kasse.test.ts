/**
 * Kasse: Stripe kennt das Konto des Hofs nicht (Register Z2, Nachtlauf Nr. 42)
 * — der echte Handler POST /api/checkout, Prisma und Stripe gemockt.
 *
 * Beweist:
 *  - Neue Online-Bestellung, Stripe meldet das Zielkonto als unbekannt:
 *    Bestellung storniert (die Ware kommt zurück), 503 mit verständlichem
 *    Satz und `onlineAus` — die Kasse bietet danach nur noch bar an. Die Halte
 *    der Sitzung bleiben, damit die Kundin sofort bar bestellen kann.
 *  - Der Hof wird mit Hof-ID und gespeicherter Kennung vermerkt (nicht
 *    bereit, Sentry gedrosselt) — kein ungedrosseltes captureException.
 *  - Dasselbe in der Wiederholung ohne gespeicherten Intent: sofort Storno
 *    statt zwei Minuten „wird gerade angelegt".
 *  - Gegenprobe: Ein gewöhnlicher Stripe-Ausfall bleibt beim bisherigen Weg
 *    (eigener Satz, kein Vermerk, Sentry wie bisher).
 *
 * Den Zustand in der Datenbank danach prüft
 * tests/integration/hofkonto-unbekannt.int.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import Stripe from 'stripe'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn(() => null) }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn(), cancel: vi.fn() } },
}))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
vi.mock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteFreiOhneRisiko: vi.fn() }))
vi.mock('@/server/unbezahlte-bestellung', () => ({ storniereUnbezahlteBestellung: vi.fn(async () => true) }))
vi.mock('@/server/hofkonto-unbekannt', () => ({ vermerkeUnbekanntesHofKonto: vi.fn(async () => undefined) }))
vi.mock('@/server/abholfenster', async (original) => ({
  ...(await original<typeof import('@/server/abholfenster')>()),
  pruefeAbholfenster: vi.fn(async () => ({
    ok: true,
    fenster: { datum: '', start: '', ende: '', slot: { id: 'slot_1', dayOfWeek: 0, startTime: '', endTime: '', maxOrders: null, isActive: true } },
  })),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn() },
    product: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    stockReservation: { aggregate: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    order: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    customerFarmSubscription: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}))

import * as Sentry from '@sentry/nextjs'
import { POST } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { storniereUnbezahlteBestellung } from '@/server/unbezahlte-bestellung'
import { vermerkeUnbekanntesHofKonto } from '@/server/hofkonto-unbekannt'
import { hofKontoUnbekanntText, zahlungNichtMoeglichText } from '@/lib/stripe-konto'
import { Decimal } from '@prisma/client/runtime/index-browser'

const JETZT = new Date('2026-10-08T08:00:00.000Z')
const KONTO = 'acct_erfunden_testmodus'

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
  acceptsOnline: true,
  acceptsOnsite: true,
  stripeAccountReady: true,
  stripeAccountId: KONTO,
  platformFeePercent: { toString: () => '0' },
  serviceFeePercent: { toString: () => '5' },
  serviceFeeMinCents: 50,
  serviceFeeActiveFrom: new Date('2026-01-01T00:00:00.000Z'),
  owner: { name: 'Max Mustermann' },
}

/** So baut das SDK den Fehler aus Stripes Antwort — erfundene Kennung, kein Netz. */
const zielkontoUnbekannt = () =>
  new Stripe.errors.StripeInvalidRequestError({
    type: 'invalid_request_error',
    code: 'resource_missing',
    message: `No such destination: '${KONTO}'`,
    param: 'transfer_data[destination]',
    statusCode: 400,
  })

const ids = (a: unknown): string[] => {
  const w = (a as { where?: { id?: { in?: string[] }; productId?: { in?: string[] } } })?.where
  return w?.id?.in ?? w?.productId?.in ?? []
}

function anfrage(overrides: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      farmId: 'farm_1',
      farmSlug: 'hof-test',
      sessionId: 'sid_1',
      idempotencyKey: 'schluessel-0042',
      customerName: 'Max Mustermann',
      customerEmail: 'max.mustermann@example.org',
      customerPhone: '+43 660 0000000',
      customerNote: '',
      pickupDate: '2026-10-09',
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: 'ONLINE',
      items: [{ productId: 'eier', quantity: 1, unitPrice: 4.5 }],
      ...overrides,
    }),
  })
}

const anlegen = vi.mocked(stripe.paymentIntents.create)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
  vi.mocked(prisma.farm.findUnique).mockResolvedValue(HOF as never)
  vi.mocked(prisma.product.findMany).mockImplementation(((a: unknown) =>
    Promise.resolve(
      ids(a).map((id) => ({ id, name: id, stock: 999, isAvailable: true, price: 4.5, abgabe: 'ALLE', vatRate: 10, unit: 'STUECK', unitSize: null }))
    )) as never)
  vi.mocked(prisma.stockReservation.findMany).mockImplementation(((a: unknown) => {
    const sitzung = (a as { where?: { sessionId?: unknown } })?.where?.sessionId
    if (sitzung && typeof sitzung === 'object') return Promise.resolve([])
    return Promise.resolve(ids(a).map((id) => ({ productId: id, quantity: 999, expiresAt: new Date(JETZT.getTime() + 600_000) })))
  }) as never)
  vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 1 } as never)
  vi.mocked(prisma.order.findUnique).mockResolvedValue(null)
  vi.mocked(prisma.order.create).mockImplementation((({ data }: { data: { totalAmount: unknown; platformFeeAmount: unknown; serviceFeeCents: number } }) =>
    Promise.resolve({
      id: 'order_1',
      createdAt: JETZT,
      orderNumber: 'HT-0810-AAAA',
      farmId: 'farm_1',
      totalAmount: data.totalAmount,
      platformFeeAmount: data.platformFeeAmount,
      serviceFeeCents: data.serviceFeeCents,
    })) as never)
  vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 } as never)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('neue Online-Bestellung, Stripe kennt das Zielkonto nicht', () => {
  it('storniert, antwortet 503 mit Satz und onlineAus — die Kundin zahlt bar', async () => {
    anlegen.mockRejectedValue(zielkontoUnbekannt())

    const res = await POST(anfrage())

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      code: 'ZAHLUNG_NICHT_MOEGLICH',
      error: hofKontoUnbekanntText(true),
      onlineAus: true,
    })
    expect(storniereUnbezahlteBestellung).toHaveBeenCalledWith('order_1', 'Zahlung konnte nicht gestartet werden')
  })

  it('vermerkt den Hof mit Hof-ID und gespeicherter Kennung — ohne ungedrosselten Sentry-Alarm', async () => {
    anlegen.mockRejectedValue(zielkontoUnbekannt())

    await POST(anfrage())

    expect(vermerkeUnbekanntesHofKonto).toHaveBeenCalledTimes(1)
    expect(vi.mocked(vermerkeUnbekanntesHofKonto).mock.calls[0].slice(0, 2)).toEqual(['farm_1', KONTO])
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('lässt die Halte der Sitzung stehen: Barzahlung geht sofort, ohne neu zu reservieren', async () => {
    anlegen.mockRejectedValue(zielkontoUnbekannt())

    await POST(anfrage())

    expect(prisma.stockReservation.deleteMany).not.toHaveBeenCalled()
  })

  it('ohne Barzahlung beim Hof verspricht der Satz sie nicht', async () => {
    vi.mocked(prisma.farm.findUnique).mockResolvedValue({ ...HOF, acceptsOnsite: false } as never)
    anlegen.mockRejectedValue(zielkontoUnbekannt())

    const body = await (await POST(anfrage())).json()

    expect(body.error).toBe(hofKontoUnbekanntText(false))
    expect(body.onlineAus).toBe(true)
  })

  it('Gegenprobe: ein gewöhnlicher Stripe-Ausfall bleibt beim bisherigen Weg', async () => {
    anlegen.mockRejectedValue(new Error('Stripe nicht erreichbar'))

    const res = await POST(anfrage())

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ code: 'ZAHLUNG_NICHT_MOEGLICH', error: zahlungNichtMoeglichText(true) })
    expect(vermerkeUnbekanntesHofKonto).not.toHaveBeenCalled()
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })
})

describe('Wiederholung ohne gespeicherten Intent, Stripe kennt das Zielkonto nicht', () => {
  beforeEach(() => {
    vi.mocked(prisma.order.findUnique).mockImplementation((({ where }: { where: { idempotencyKey?: string } }) =>
      Promise.resolve(
        where.idempotencyKey === 'schluessel-0042'
          ? {
              id: 'order_alt',
              orderNumber: 'HT-0810-BBBB',
              farmId: 'farm_1',
              paymentMethod: 'ONLINE',
              stripePaymentIntentId: null,
              status: 'PENDING_CONFIRMATION',
              createdAt: JETZT,
              pickupDate: JETZT,
              pickupTimeStart: '15:00',
              totalAmount: new Decimal('4.50'),
              platformFeeAmount: new Decimal('0'),
              serviceFeeCents: 50,
              farm: { slug: 'hof-test', stripeAccountId: KONTO, acceptsOnsite: true },
            }
          : null
      )) as never)
  })

  it('storniert sofort und vermerkt den Hof — statt zwei Minuten „wird gerade angelegt"', async () => {
    anlegen.mockRejectedValue(zielkontoUnbekannt())

    const res = await POST(anfrage())

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ code: 'ZAHLUNG_NICHT_MOEGLICH', error: hofKontoUnbekanntText(true), onlineAus: true })
    expect(storniereUnbezahlteBestellung).toHaveBeenCalledWith('order_alt', 'Zahlung konnte nicht gestartet werden')
    expect(vi.mocked(vermerkeUnbekanntesHofKonto).mock.calls[0].slice(0, 2)).toEqual(['farm_1', KONTO])
    expect(prisma.order.create).not.toHaveBeenCalled()
  })

  it('Gegenprobe: ein anderer Fehler bleibt „wird gerade angelegt" (409), ohne Storno und Vermerk', async () => {
    anlegen.mockRejectedValue(new Error('Stripe nicht erreichbar'))

    const res = await POST(anfrage())

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'BESTELLUNG_IN_ARBEIT' })
    expect(storniereUnbezahlteBestellung).not.toHaveBeenCalled()
    expect(vermerkeUnbekanntesHofKonto).not.toHaveBeenCalled()
  })
})
