/**
 * Die Kasse und der echte Handler POST /api/checkout (Nachtlauf Nr. 12) —
 * Prisma, Stripe und Mail gemockt, Zod, Geldrechnung und Zahlart-Regel echt.
 *
 * Beweist:
 *  - E5: Eine NEUE Bestellung mit „Karte bei Abholung" (ONSITE_CARD) lehnt der
 *    Server ab — deutscher Satz, Code, keine Bestellung, kein Bestand, kein
 *    Stripe, keine Mail. Gegenprobe: bar und online gehen durch.
 *  - E5 Expand/Contract: Eine schon bestehende Bestellung mit ONSITE_CARD
 *    (gleicher Idempotenz-Schlüssel, etwa ein alter Tab) bekommt weiter ihre
 *    Antwort — die Regel gilt nur für neue Bestellungen.
 *  - Die Gebührenzeile der Kasse (kassenBetraege) zeigt genau den Betrag, den
 *    der Server als Snapshot speichert und Stripe berechnet.
 *  - Nachbesserung 1: Jede Antwort mit Client-Secret trägt `amountCents` — genau
 *    den Betrag, den Stripe abbucht — und den Gebühren-Snapshot, auch bei der
 *    Wiederholung zu einer bestehenden Bestellung (mit und ohne gespeicherten Intent).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn(() => null) }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn(), cancel: vi.fn() } },
}))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
// Die Freigabe verwaister Bestellungen hat eigene Tests; hier zählt die Kasse.
vi.mock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteFreiOhneRisiko: vi.fn() }))
// Der Abholtermin hat eigene Tests (tests/checkout-abholfenster.test.ts):
// Hier gilt jedes Fenster als angeboten und unbegrenzt, der Rest des Moduls läuft echt.
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
    user: { findUnique: vi.fn(), create: vi.fn() },
    order: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    customerFarmSubscription: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}))

import { POST } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { sendOnsiteConfirmation } from '@/lib/email'
import { CODE_ZAHLART_NICHT_ANGEBOTEN, ZAHLART_NICHT_ANGEBOTEN, kassenBetraege } from '@/lib/kasse'
import { alsCents } from '@/lib/order-totals'
import { Decimal } from '@prisma/client/runtime/index-browser'

const JETZT = new Date('2026-10-05T08:00:00.000Z')

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
  stripeAccountId: 'acct_test_platzhalter',
  platformFeePercent: { toString: () => '0' },
  serviceFeePercent: { toString: () => '5' },
  serviceFeeMinCents: 50,
  serviceFeeActiveFrom: new Date('2026-01-01T00:00:00.000Z'),
  owner: { name: 'Max Mustermann' },
}

/** Preise in der „Datenbank" je Produkt — der Handler rechnet nur mit ihnen. */
let preise: Record<string, number>

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
      idempotencyKey: 'schluessel-0001',
      customerName: 'Max Mustermann',
      customerEmail: 'max.mustermann@example.org',
      customerPhone: '+43 660 0000000',
      customerNote: '',
      pickupDate: '2026-10-06',
      pickupTimeStart: '14:00',
      pickupTimeEnd: '16:00',
      paymentMethod: 'ONSITE_CASH',
      items: [{ productId: 'eier', quantity: 1, unitPrice: 4.5 }],
      ...overrides,
    }),
  })
}

const orderCreate = vi.mocked(prisma.order.create)
const createData = (n = 0) =>
  (orderCreate.mock.calls[n][0] as { data: { serviceFeeCents: number; totalAmount: unknown; paymentMethod: string } }).data

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
  preise = { eier: 4.5, brot: 5.8 }
  vi.mocked(prisma.farm.findUnique).mockResolvedValue(HOF as never)
  vi.mocked(prisma.product.findMany).mockImplementation(((a: unknown) =>
    Promise.resolve(
      ids(a).map((id) => ({ id, name: id, stock: 999, isAvailable: true, price: preise[id], abgabe: 'ALLE', vatRate: 10, unit: 'STUECK', unitSize: null }))
    )) as never)
  vi.mocked(prisma.stockReservation.findMany).mockImplementation(((a: unknown) => {
    const sitzung = (a as { where?: { sessionId?: unknown } })?.where?.sessionId
    if (sitzung && typeof sitzung === 'object') return Promise.resolve([]) // fremde Sitzungen
    return Promise.resolve(ids(a).map((id) => ({ productId: id, quantity: 999, expiresAt: new Date(JETZT.getTime() + 600_000) })))
  }) as never)
  vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 1 } as never)
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'kunde_1' } as never)
  vi.mocked(prisma.order.findUnique).mockResolvedValue(null)
  // Die Geldwerte kommen zurück, wie der Handler sie geschrieben hat (Decimal) —
  // genau daraus rechnet er den Stripe-Betrag.
  orderCreate.mockImplementation((({ data }: { data: { totalAmount: unknown; platformFeeAmount: unknown; serviceFeeCents: number } }) =>
    Promise.resolve({
      id: 'order_1',
      createdAt: JETZT,
      orderNumber: 'HT-0510-AAAA',
      farmId: 'farm_1',
      totalAmount: data.totalAmount,
      platformFeeAmount: data.platformFeeAmount,
      serviceFeeCents: data.serviceFeeCents,
    })) as never)
  vi.mocked(prisma.order.update).mockResolvedValue({} as never)
  vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 } as never)
  vi.mocked(stripe.paymentIntents.create).mockResolvedValue({ id: 'pi_test', client_secret: 'pi_test_secret' } as never)
  vi.mocked(sendOnsiteConfirmation).mockResolvedValue(undefined as never)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('E5: Karte bei Abholung für neue Bestellungen', () => {
  it('lehnt eine neue ONSITE_CARD-Bestellung ab — nichts gebucht, nichts angelegt, kein Stripe, keine Mail', async () => {
    const res = await POST(anfrage({ paymentMethod: 'ONSITE_CARD' }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: ZAHLART_NICHT_ANGEBOTEN, code: CODE_ZAHLART_NICHT_ANGEBOTEN })
    expect(prisma.product.updateMany).not.toHaveBeenCalled()
    expect(orderCreate).not.toHaveBeenCalled()
    expect(prisma.user.create).not.toHaveBeenCalled()
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled()
    expect(sendOnsiteConfirmation).not.toHaveBeenCalled()
  })

  it('Gegenprobe: bar bei Abholung legt die Bestellung an', async () => {
    const res = await POST(anfrage({ paymentMethod: 'ONSITE_CASH' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(expect.objectContaining({ requiresConfirmation: true }))
    expect(createData().paymentMethod).toBe('ONSITE_CASH')
  })

  it('Gegenprobe: online legt die Bestellung und den Zahlungsvorgang an', async () => {
    const res = await POST(anfrage({ paymentMethod: 'ONLINE' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(expect.objectContaining({ clientSecret: 'pi_test_secret' }))
    expect(createData().paymentMethod).toBe('ONLINE')
  })

  it('eine bestehende ONSITE_CARD-Bestellung (alter Tab, gleicher Schlüssel) bekommt weiter ihre Antwort', async () => {
    vi.mocked(prisma.order.findUnique).mockImplementation((({ where }: { where: { idempotencyKey?: string } }) =>
      Promise.resolve(
        where.idempotencyKey === 'schluessel-0001'
          ? {
              id: 'order_alt',
              orderNumber: 'HT-0110-BBBB',
              farmId: 'farm_1',
              paymentMethod: 'ONSITE_CARD',
              stripePaymentIntentId: null,
              status: 'PENDING_CONFIRMATION',
              createdAt: JETZT,
              pickupDate: JETZT,
              pickupTimeStart: '14:00',
              totalAmount: { toString: () => '4.5' },
              platformFeeAmount: { toString: () => '0' },
              serviceFeeCents: 50,
              farm: { slug: 'hof-test', stripeAccountId: null, acceptsOnsite: true },
            }
          : null
      )) as never)

    const res = await POST(anfrage({ paymentMethod: 'ONSITE_CARD' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(expect.objectContaining({ orderId: 'order_alt', wiederholt: true }))
    expect(orderCreate).not.toHaveBeenCalled()
  })
})

describe('Gebührenzeile der Kasse = Betrag des Servers', () => {
  const koerbe: Array<{ name: string; preise: Record<string, number>; items: Array<{ productId: string; quantity: number }> }> = [
    { name: 'Mockup: Eier und Brot', preise: { eier: 4.5, brot: 5.8 }, items: [{ productId: 'eier', quantity: 1 }, { productId: 'brot', quantity: 1 }] },
    { name: 'Mindestgebühr', preise: { eier: 0.99 }, items: [{ productId: 'eier', quantity: 3 }] },
    { name: 'krumme Beträge', preise: { eier: 19.99, brot: 2.35 }, items: [{ productId: 'eier', quantity: 1 }, { productId: 'brot', quantity: 7 }] },
    { name: 'großer Korb', preise: { eier: 180 }, items: [{ productId: 'eier', quantity: 2 }] },
  ]

  for (const korb of koerbe) {
    it(`${korb.name}: Snapshot, Stripe-Betrag und Anzeige stimmen überein`, async () => {
      preise = korb.preise
      const items = korb.items.map((i) => ({ ...i, unitPrice: korb.preise[i.productId] }))
      const anzeige = kassenBetraege(
        items.map((i) => ({ productId: i.productId, price: i.unitPrice, quantity: i.quantity })),
        { ...HOF, serviceFeePercent: 5 },
        JETZT,
        'ONLINE'
      )

      const res = await POST(anfrage({ paymentMethod: 'ONLINE', items }))

      expect(res.status).toBe(200)
      expect(createData().serviceFeeCents).toBe(anzeige.gebuehrCents)
      expect(alsCents(createData().totalAmount as never)).toBe(anzeige.warenCents)
      const intent = vi.mocked(stripe.paymentIntents.create).mock.calls[0][0] as { amount: number }
      expect(intent.amount).toBe(anzeige.gesamtCents)
    })
  }
})

describe('Nachbesserung 1: die Antwort nennt den Betrag, den Stripe abbucht', () => {
  /** Eine schon angelegte Online-Bestellung zum Schlüssel: Warenpreis € 10,30, Gebühr € 0,52. */
  function bestehendeOnlineBestellung(stripePaymentIntentId: string | null) {
    vi.mocked(prisma.order.findUnique).mockImplementation((({ where }: { where: { idempotencyKey?: string } }) =>
      Promise.resolve(
        where.idempotencyKey === 'schluessel-0001'
          ? {
              id: 'order_alt',
              orderNumber: 'HT-0510-CCCC',
              farmId: 'farm_1',
              paymentMethod: 'ONLINE',
              stripePaymentIntentId,
              status: 'PENDING_CONFIRMATION',
              createdAt: JETZT,
              pickupDate: JETZT,
              pickupTimeStart: '14:00',
              totalAmount: new Decimal('10.30'),
              platformFeeAmount: new Decimal('0'),
              serviceFeeCents: 52,
              farm: { slug: 'hof-test', stripeAccountId: 'acct_test_platzhalter', acceptsOnsite: true },
            }
          : null
      )) as never)
  }

  it('neue Online-Bestellung: amountCents ist der Stripe-Betrag, serviceFeeCents der Snapshot', async () => {
    const items = [{ productId: 'eier', quantity: 1, unitPrice: 4.5 }, { productId: 'brot', quantity: 1, unitPrice: 5.8 }]

    const res = await POST(anfrage({ paymentMethod: 'ONLINE', items }))

    expect(res.status).toBe(200)
    const body = await res.json()
    const intent = vi.mocked(stripe.paymentIntents.create).mock.calls[0][0] as { amount: number }
    expect(body.amountCents).toBe(intent.amount)
    expect(body.amountCents).toBe(1082)
    expect(body.serviceFeeCents).toBe(createData().serviceFeeCents)
  })

  it('Wiederholung mit gespeichertem Intent: amountCents aus dem PaymentIntent, ohne neuen anzulegen', async () => {
    bestehendeOnlineBestellung('pi_alt')
    vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue({ id: 'pi_alt', client_secret: 'pi_alt_secret', amount: 1082 } as never)

    const res = await POST(anfrage({ paymentMethod: 'ONLINE' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(
      expect.objectContaining({ clientSecret: 'pi_alt_secret', amountCents: 1082, serviceFeeCents: 52, wiederholt: true })
    )
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled()
    expect(orderCreate).not.toHaveBeenCalled()
  })

  it('Wiederholung ohne gespeicherten Intent: amountCents ist der Betrag, den der neue Stripe-Aufruf bekommt', async () => {
    bestehendeOnlineBestellung(null)
    vi.mocked(stripe.paymentIntents.create).mockResolvedValue({ id: 'pi_neu', client_secret: 'pi_neu_secret' } as never)

    const res = await POST(anfrage({ paymentMethod: 'ONLINE' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    const intent = vi.mocked(stripe.paymentIntents.create).mock.calls[0][0] as { amount: number }
    expect(body).toEqual(expect.objectContaining({ clientSecret: 'pi_neu_secret', wiederholt: true, serviceFeeCents: 52 }))
    expect(body.amountCents).toBe(intent.amount)
    expect(body.amountCents).toBe(1082)
    expect(orderCreate).not.toHaveBeenCalled()
  })

  it('Gegenprobe: bar gibt keinen Zahlungsbetrag heraus (kein Zahlungsschritt)', async () => {
    const res = await POST(anfrage({ paymentMethod: 'ONSITE_CASH' }))

    const body = await res.json()
    expect(body.requiresConfirmation).toBe(true)
    expect(body).not.toHaveProperty('amountCents')
  })
})

describe('Register N2 (Nr. 46): kein Pflicht-Haken, kein Abo im Checkout', () => {
  const ALTE_FELDER = { onsiteConfirmed: false, optInEmail: true, optInWhatsApp: true }

  it('bar ohne Haken: die Bestellung entsteht — verbindlich ist der Knopf, nicht ein Haken', async () => {
    const res = await POST(anfrage({ paymentMethod: 'ONSITE_CASH' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(expect.objectContaining({ requiresConfirmation: true }))
    expect(createData().paymentMethod).toBe('ONSITE_CASH')
  })

  it('ein alter Tab mit Haken-Feldern bekommt seine Bestellung — und es entsteht kein Abo', async () => {
    const res = await POST(anfrage({ paymentMethod: 'ONSITE_CASH', ...ALTE_FELDER }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(expect.objectContaining({ requiresConfirmation: true }))
    expect(orderCreate).toHaveBeenCalledOnce()
    expect(prisma.customerFarmSubscription.upsert).not.toHaveBeenCalled()
    expect(prisma.customerFarmSubscription.findUnique).not.toHaveBeenCalled()
    // Die Antwort sagt nichts über Neuigkeiten — wie vorher keine Auskunft.
    expect(JSON.stringify(body)).not.toMatch(/optIn|abo|neuigkeit|subscri/i)
  })

  it('online mit Haken-Feldern: Bestellung und Zahlungsvorgang, kein Abo, Betrag unverändert', async () => {
    const res = await POST(anfrage({ paymentMethod: 'ONLINE', ...ALTE_FELDER }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(expect.objectContaining({ clientSecret: 'pi_test_secret', amountCents: 500, serviceFeeCents: 50 }))
    expect(prisma.customerFarmSubscription.upsert).not.toHaveBeenCalled()
  })

  it('am Quelltext: der Checkout fasst keine Abos an und ruft keine Abo-Anmeldung', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const route = readFileSync(join(process.cwd(), 'src/app/api/checkout/route.ts'), 'utf8')
    const code = route.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).not.toMatch(/customerFarmSubscription|meldeEmailAboAn|abo-anmeldung|optIn/)
    // Gegenprobe: das Muster schlägt am alten Stand an.
    expect('if (data.optInEmail) await meldeEmailAboAn(abo, new Date())').toMatch(/customerFarmSubscription|meldeEmailAboAn|abo-anmeldung|optIn/)
  })
})
