/**
 * Tests für den Stripe-Webhook-Handler (/api/stripe/webhook).
 *
 * Zementiert das Retry-Verhalten aus Härtung 1:
 * Idempotenz-Check → Verarbeitung → Event erst bei ERFOLG persistieren →
 * bei Verarbeitungsfehler 500 (Stripe retried).
 *
 * Und die Zustandsregel: Ein Zahlungsereignis ändert eine Bestellung nur aus
 * dem Zustand heraus, für den es gilt (bedingtes `updateMany`). Dieselben
 * Fälle gegen die echte Datenbank: tests/integration/webhook-zahlung.int.test.ts.
 *
 * Stripe-Signaturprüfung, Prisma, E-Mail und Sentry sind gemockt — kein
 * Netzwerk, keine DB.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: vi.fn() },
    refunds: { create: vi.fn() },
    accounts: { retrieve: vi.fn() },
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    webhookEvent: { findUnique: vi.fn(), create: vi.fn() },
    order: { findUnique: vi.fn(), updateMany: vi.fn() },
    farm: { findFirst: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('@/lib/email', () => ({
  sendOrderConfirmation: vi.fn(),
  sendOrderPaidToFarmer: vi.fn(),
  sendZahlungZuSpaet: vi.fn(),
}))

vi.mock('@/server/unbezahlte-bestellung', () => ({
  storniereUnbezahlteBestellung: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { POST } from '@/app/api/stripe/webhook/route'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { sendOrderConfirmation, sendOrderPaidToFarmer, sendZahlungZuSpaet } from '@/lib/email'
import { storniereUnbezahlteBestellung } from '@/server/unbezahlte-bestellung'

const constructEvent = vi.mocked(stripe.webhooks.constructEvent)
const erstatten = vi.mocked(stripe.refunds.create)
const webhookEventFindUnique = vi.mocked(prisma.webhookEvent.findUnique)
const webhookEventCreate = vi.mocked(prisma.webhookEvent.create)
const orderFindUnique = vi.mocked(prisma.order.findUnique)
const orderUpdateMany = vi.mocked(prisma.order.updateMany)
const stornieren = vi.mocked(storniereUnbezahlteBestellung)

function makeRequest(body = '{}', headers: Record<string, string> = { 'stripe-signature': 'sig_test' }) {
  return new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body,
    headers,
  })
}

function piEvent(
  type: 'payment_intent.succeeded' | 'payment_intent.payment_failed' | 'payment_intent.canceled',
  id = 'evt_1',
  pi: Record<string, unknown> = {}
) {
  return {
    id,
    type,
    data: { object: { id: 'pi_test_1', application_fee_amount: 100, ...pi } },
  } as unknown as ReturnType<typeof constructEvent>
}

const succeededEvent = (id = 'evt_success_1') => piEvent('payment_intent.succeeded', id)

const orderFixture = {
  id: 'order_1',
  orderNumber: 'TST-0101-AAAA',
  status: 'PAID',
  paymentStatus: 'PAID',
  customerName: 'Test Kunde',
  customerEmail: 'kunde@example.com',
  customerPhone: '+43 660 0000000',
  totalAmount: 33,
  serviceFeeCents: 100,
  pickupDate: new Date('2026-07-20T12:00:00Z'),
  pickupTimeStart: '09:00',
  pickupTimeEnd: '12:00',
  paymentMethod: 'ONLINE',
  stripePaymentIntentId: 'pi_test_1',
  farm: {
    id: 'farm_1', name: 'Testhof', slug: 'testhof', email: 'hof@example.com',
    ownerName: 'Bauer Test', address: 'Weg 1', postalCode: '1234', city: 'Ort', phone: '+43',
  },
  items: [{ productName: 'Eier', quantity: 2, unitPrice: 5, totalPrice: 10 }],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test_dummy')
  // Happy-Path-Defaults; einzelne Tests überschreiben gezielt
  webhookEventFindUnique.mockResolvedValue(null)
  webhookEventCreate.mockResolvedValue({} as never)
  orderFindUnique.mockResolvedValue(orderFixture as never)
  orderUpdateMany.mockResolvedValue({ count: 1 })
  stornieren.mockResolvedValue(true)
  erstatten.mockResolvedValue({ id: 're_test_1', amount: 3400 } as never)
  vi.mocked(sendOrderConfirmation).mockResolvedValue(undefined)
  vi.mocked(sendOrderPaidToFarmer).mockResolvedValue(undefined)
  vi.mocked(sendZahlungZuSpaet).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('payment_intent.succeeded', () => {
  it('setzt die Bestellung BEDINGT auf PAID, verschickt beide Mails, persistiert das Event und antwortet 200', async () => {
    constructEvent.mockReturnValue(succeededEvent())

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
    expect(orderUpdateMany).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: 'pi_test_1', status: 'PENDING_CONFIRMATION' },
      data: expect.objectContaining({ status: 'PAID', paymentStatus: 'PAID' }),
    })
    await vi.waitFor(() => expect(sendOrderPaidToFarmer).toHaveBeenCalledTimes(1))
    expect(sendOrderConfirmation).toHaveBeenCalledTimes(1)
    expect(webhookEventCreate).toHaveBeenCalledWith({
      data: { stripeEventId: 'evt_success_1', type: 'payment_intent.succeeded' },
    })
  })

  it('überspringt ein bereits verarbeitetes Event ohne Doppelverarbeitung (Idempotenz)', async () => {
    constructEvent.mockReturnValue(succeededEvent())
    webhookEventFindUnique.mockResolvedValue({ id: 'we_1' } as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, skipped: true })
    expect(orderFindUnique).not.toHaveBeenCalled()
    expect(orderUpdateMany).not.toHaveBeenCalled()
    expect(sendOrderConfirmation).not.toHaveBeenCalled()
    expect(webhookEventCreate).not.toHaveBeenCalled()
  })

  it('antwortet 500 und persistiert das Event NICHT, wenn die Verarbeitung fehlschlägt (Stripe darf retrien)', async () => {
    constructEvent.mockReturnValue(succeededEvent())
    orderUpdateMany.mockRejectedValue(new Error('DB down'))

    const res = await POST(makeRequest())

    expect(res.status).toBe(500)
    expect(webhookEventCreate).not.toHaveBeenCalled()
  })

  it('bleibt erfolgreich (200 + Event persistiert), wenn eine Mail WIRFT — und der Hof bekommt seine trotzdem', async () => {
    constructEvent.mockReturnValue(succeededEvent())
    // Nicht nur Resend-Fehler (die fängt sendRaw), auch ein Wurf beim Rendern
    // oder beim Token darf keine 500 und damit keine Doppel-Mails auslösen.
    vi.mocked(sendOrderConfirmation).mockRejectedValue(new Error('Render kaputt'))

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
    expect(webhookEventCreate).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(sendOrderPaidToFarmer).toHaveBeenCalledTimes(1))
    await vi.waitFor(() =>
      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ extra: { orderId: 'order_1' } })
      )
    )
  })

  it('behandelt parallele Zustellung (Unique-Verletzung beim Persistieren) als skipped, nicht als Fehler', async () => {
    constructEvent.mockReturnValue(succeededEvent())
    webhookEventCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      })
    )

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, skipped: true })
  })

  it('schon bezahlt (Bedingung trifft nichts): keine Mails, keine Erstattung', async () => {
    constructEvent.mockReturnValue(succeededEvent())
    orderUpdateMany.mockResolvedValue({ count: 0 })

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(erstatten).not.toHaveBeenCalled()
    expect(sendOrderConfirmation).not.toHaveBeenCalled()
    expect(webhookEventCreate).toHaveBeenCalledTimes(1)
  })

  describe('auf eine stornierte Bestellung (Zahlung kam zu spät)', () => {
    const stornierteUnbezahlte = { ...orderFixture, status: 'CANCELLED', paymentStatus: 'FAILED' }

    beforeEach(() => {
      orderUpdateMany.mockResolvedValueOnce({ count: 0 })
      orderFindUnique.mockResolvedValue(stornierteUnbezahlte as never)
    })

    it('erstattet voll mit reverse_transfer und refund_application_fee, festem Schlüssel, Alarm und Mail', async () => {
      constructEvent.mockReturnValue(succeededEvent())

      const res = await POST(makeRequest())

      expect(res.status).toBe(200)
      expect(erstatten).toHaveBeenCalledWith(
        { payment_intent: 'pi_test_1', reverse_transfer: true, refund_application_fee: true },
        { idempotencyKey: 'spaet-bezahlt-order_1' }
      )
      expect(orderUpdateMany).toHaveBeenLastCalledWith({
        where: { id: 'order_1', status: 'CANCELLED', paymentStatus: { in: ['PENDING', 'FAILED'] } },
        data: { paymentStatus: 'REFUNDED' },
      })
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ level: 'error', extra: { orderId: 'order_1' } })
      )
      await vi.waitFor(() => expect(sendZahlungZuSpaet).toHaveBeenCalledWith(stornierteUnbezahlte, 3400))
      expect(sendOrderConfirmation).not.toHaveBeenCalled()
      expect(sendOrderPaidToFarmer).not.toHaveBeenCalled()
    })

    it('ohne Gebühr auf der Zahlung kein refund_application_fee', async () => {
      constructEvent.mockReturnValue(
        piEvent('payment_intent.succeeded', 'evt_ohne_gebuehr', { application_fee_amount: null })
      )

      await POST(makeRequest())

      expect(erstatten).toHaveBeenCalledWith(
        { payment_intent: 'pi_test_1', reverse_transfer: true },
        { idempotencyKey: 'spaet-bezahlt-order_1' }
      )
    })

    it('scheitert die Erstattung: 500, Event NICHT persistiert (Stripe stellt erneut zu), Sentry, keine Mail', async () => {
      constructEvent.mockReturnValue(succeededEvent())
      erstatten.mockRejectedValue(new Error('Saldo reicht nicht'))

      const res = await POST(makeRequest())

      expect(res.status).toBe(500)
      expect(webhookEventCreate).not.toHaveBeenCalled()
      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ tags: expect.objectContaining({ grund: 'erstattung_offen' }) })
      )
      expect(sendZahlungZuSpaet).not.toHaveBeenCalled()
    })

    it('hat eine parallele Zustellung den Vermerk schon gesetzt: keine zweite Mail', async () => {
      constructEvent.mockReturnValue(succeededEvent())
      // Erster Aufruf (bedingtes PAID) count 0 aus dem beforeEach, der Vermerk
      // trifft ebenfalls nichts mehr.
      orderUpdateMany.mockResolvedValueOnce({ count: 0 })

      const res = await POST(makeRequest())

      expect(res.status).toBe(200)
      expect(erstatten).toHaveBeenCalledTimes(1)
      await new Promise((r) => setTimeout(r, 0))
      expect(sendZahlungZuSpaet).not.toHaveBeenCalled()
    })

    it('scheitert nur der Vermerk: trotzdem 200 und Mail — das Geld ist zurück', async () => {
      constructEvent.mockReturnValue(succeededEvent())
      // Erster Aufruf (bedingtes PAID) liefert count 0 aus dem beforeEach,
      // der zweite — der Vermerk REFUNDED — scheitert.
      orderUpdateMany.mockRejectedValueOnce(new Error('DB weg'))

      const res = await POST(makeRequest())

      expect(res.status).toBe(200)
      expect(webhookEventCreate).toHaveBeenCalledTimes(1)
      await vi.waitFor(() => expect(sendZahlungZuSpaet).toHaveBeenCalledTimes(1))
    })
  })

  it('storniert vom Hof NACH der Zahlung (REFUNDED): keine zweite Erstattung', async () => {
    constructEvent.mockReturnValue(succeededEvent())
    orderUpdateMany.mockResolvedValue({ count: 0 })
    orderFindUnique.mockResolvedValue({ ...orderFixture, status: 'CANCELLED', paymentStatus: 'REFUNDED' } as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(erstatten).not.toHaveBeenCalled()
    expect(sendZahlungZuSpaet).not.toHaveBeenCalled()
  })
})

describe('payment_intent.payment_failed', () => {
  it('vermerkt nur — bedingt, ohne Storno und ohne Bestand', async () => {
    constructEvent.mockReturnValue(piEvent('payment_intent.payment_failed', 'evt_failed_1'))

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(orderUpdateMany).toHaveBeenCalledTimes(1)
    expect(orderUpdateMany).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: 'pi_test_1', status: 'PENDING_CONFIRMATION' },
      data: { paymentStatus: 'FAILED' },
    })
    expect(stornieren).not.toHaveBeenCalled()
    expect(webhookEventCreate).toHaveBeenCalledWith({
      data: { stripeEventId: 'evt_failed_1', type: 'payment_intent.payment_failed' },
    })
  })
})

describe('payment_intent.canceled', () => {
  it('storniert über storniereUnbezahlteBestellung mit Grund „Zahlung abgebrochen"', async () => {
    constructEvent.mockReturnValue(piEvent('payment_intent.canceled', 'evt_canceled_1'))
    orderFindUnique.mockResolvedValue({ id: 'order_2' } as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(stornieren).toHaveBeenCalledWith('order_2', 'Zahlung abgebrochen')
    expect(webhookEventCreate).toHaveBeenCalledTimes(1)
  })

  it('ignoriert PaymentIntents ohne zugehörige Bestellung, Event gilt als verarbeitet', async () => {
    constructEvent.mockReturnValue(piEvent('payment_intent.canceled', 'evt_canceled_2'))
    orderFindUnique.mockResolvedValue(null)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(stornieren).not.toHaveBeenCalled()
    expect(webhookEventCreate).toHaveBeenCalledTimes(1)
  })

  it('antwortet 500, wenn die Stornierung scheitert (Stripe stellt erneut zu)', async () => {
    constructEvent.mockReturnValue(piEvent('payment_intent.canceled', 'evt_canceled_3'))
    orderFindUnique.mockResolvedValue({ id: 'order_2' } as never)
    stornieren.mockRejectedValue(new Error('DB down'))

    const res = await POST(makeRequest())

    expect(res.status).toBe(500)
    expect(webhookEventCreate).not.toHaveBeenCalled()
  })
})

describe('Connect-Endpunkt: account.updated mit eigenem Secret', () => {
  const kontoEreignis = {
    id: 'evt_konto_1',
    type: 'account.updated',
    account: 'acct_hof_1',
    data: { object: { id: 'acct_hof_1', charges_enabled: false, payouts_enabled: true } },
  } as unknown as ReturnType<typeof constructEvent>

  it('passt das Plattform-Secret nicht, gilt das Connect-Secret — und der Hof wird nicht mehr als bereit geführt', async () => {
    vi.stubEnv('STRIPE_CONNECT_WEBHOOK_SECRET', 'whsec_connect_dummy')
    vi.mocked(prisma.farm.findFirst).mockResolvedValue({ id: 'farm_1' } as never)
    vi.mocked(stripe.accounts.retrieve).mockResolvedValue({
      id: 'acct_hof_1',
      charges_enabled: false,
      payouts_enabled: true,
    } as never)
    constructEvent
      .mockImplementationOnce(() => {
        throw new Error('No signatures found matching the expected signature')
      })
      .mockReturnValueOnce(kontoEreignis)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(constructEvent).toHaveBeenNthCalledWith(1, '{}', 'sig_test', 'whsec_test_dummy')
    expect(constructEvent).toHaveBeenNthCalledWith(2, '{}', 'sig_test', 'whsec_connect_dummy')
    // Der Stand kommt frisch von Stripe, nicht aus dem (womöglich verspäteten) Ereignis.
    expect(stripe.accounts.retrieve).toHaveBeenCalledWith('acct_hof_1', {}, { timeout: 10_000, maxNetworkRetries: 1 })
    expect(vi.mocked(prisma.farm.update)).toHaveBeenCalledWith({
      where: { id: 'farm_1' },
      data: { stripeAccountReady: false },
    })
  })

  it('Ereignisse verbundener Konten laufen nur durch account.updated — nie durch die Zahlungs-Handler', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_fremd_pi',
      type: 'payment_intent.succeeded',
      account: 'acct_hof_1',
      data: { object: { id: 'pi_test_1' } },
    } as unknown as ReturnType<typeof constructEvent>)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(orderUpdateMany).not.toHaveBeenCalled()
    expect(webhookEventCreate).toHaveBeenCalledTimes(1)
  })

  it('ohne Connect-Secret gibt es nur einen Versuch', async () => {
    constructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature')
    })

    const res = await POST(makeRequest())

    expect(res.status).toBe(400)
    expect(constructEvent).toHaveBeenCalledTimes(1)
  })
})

describe('Signatur- und Konfigurationsfehler', () => {
  it('antwortet 400 bei ungültiger Signatur, ohne irgendetwas zu verarbeiten', async () => {
    constructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature')
    })

    const res = await POST(makeRequest())

    expect(res.status).toBe(400)
    expect(webhookEventFindUnique).not.toHaveBeenCalled()
    expect(orderUpdateMany).not.toHaveBeenCalled()
    expect(webhookEventCreate).not.toHaveBeenCalled()
  })

  it('antwortet 400, wenn der stripe-signature-Header fehlt', async () => {
    const res = await POST(makeRequest('{}', {}))

    expect(res.status).toBe(400)
    expect(constructEvent).not.toHaveBeenCalled()
  })

  it('antwortet 500, wenn STRIPE_WEBHOOK_SECRET nicht konfiguriert ist', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')

    const res = await POST(makeRequest())

    expect(res.status).toBe(500)
    expect(constructEvent).not.toHaveBeenCalled()
  })
})
