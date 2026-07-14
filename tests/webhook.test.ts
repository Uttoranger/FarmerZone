/**
 * Tests für den Stripe-Webhook-Handler (/api/stripe/webhook).
 *
 * Zementiert das Retry-Verhalten aus Härtung 1:
 * Idempotenz-Check → Verarbeitung → Event erst bei ERFOLG persistieren →
 * bei Verarbeitungsfehler 500 (Stripe retried).
 *
 * Stripe-Signaturprüfung, Prisma und E-Mail sind gemockt — kein Netzwerk, keine DB.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

vi.mock('@/lib/stripe', () => ({
  stripe: { webhooks: { constructEvent: vi.fn() } },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    webhookEvent: { findUnique: vi.fn(), create: vi.fn() },
    order: { findUnique: vi.fn(), update: vi.fn() },
    product: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/email', () => ({
  sendOrderConfirmation: vi.fn(),
  sendOrderPaidToFarmer: vi.fn(),
}))

import { POST } from '@/app/api/stripe/webhook/route'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { sendOrderConfirmation, sendOrderPaidToFarmer } from '@/lib/email'

const constructEvent = vi.mocked(stripe.webhooks.constructEvent)
const webhookEventFindUnique = vi.mocked(prisma.webhookEvent.findUnique)
const webhookEventCreate = vi.mocked(prisma.webhookEvent.create)
const orderFindUnique = vi.mocked(prisma.order.findUnique)
const orderUpdate = vi.mocked(prisma.order.update)
const productUpdate = vi.mocked(prisma.product.update)
const transaction = vi.mocked(prisma.$transaction)

function makeRequest(body = '{}', headers: Record<string, string> = { 'stripe-signature': 'sig_test' }) {
  return new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body,
    headers,
  })
}

function succeededEvent(id = 'evt_success_1') {
  return {
    id,
    type: 'payment_intent.succeeded',
    data: { object: { id: 'pi_test_1' } },
  } as ReturnType<typeof constructEvent>
}

function failedEvent(id = 'evt_failed_1') {
  return {
    id,
    type: 'payment_intent.payment_failed',
    data: { object: { id: 'pi_test_1' } },
  } as ReturnType<typeof constructEvent>
}

const paidOrderFixture = {
  id: 'order_1',
  orderNumber: 'TST-0101-AAAA',
  customerName: 'Test Kunde',
  customerEmail: 'kunde@example.com',
  customerPhone: '+43 660 0000000',
  totalAmount: 33,
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
  orderFindUnique.mockResolvedValue(paidOrderFixture as never)
  orderUpdate.mockResolvedValue({} as never)
  productUpdate.mockReturnValue({} as never)
  transaction.mockResolvedValue([] as never)
  vi.mocked(sendOrderConfirmation).mockResolvedValue(undefined)
  vi.mocked(sendOrderPaidToFarmer).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('payment_intent.succeeded', () => {
  it('setzt die Bestellung auf PAID, verschickt beide Mails, persistiert das Event und antwortet 200', async () => {
    constructEvent.mockReturnValue(succeededEvent())

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order_1' },
        data: expect.objectContaining({ status: 'PAID', paymentStatus: 'PAID' }),
      })
    )
    expect(sendOrderConfirmation).toHaveBeenCalledTimes(1)
    expect(sendOrderPaidToFarmer).toHaveBeenCalledTimes(1)
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
    expect(orderUpdate).not.toHaveBeenCalled()
    expect(sendOrderConfirmation).not.toHaveBeenCalled()
    expect(webhookEventCreate).not.toHaveBeenCalled()
  })

  it('antwortet 500 und persistiert das Event NICHT, wenn die Verarbeitung fehlschlägt (Stripe darf retrien)', async () => {
    constructEvent.mockReturnValue(succeededEvent())
    orderUpdate.mockRejectedValue(new Error('DB down'))

    const res = await POST(makeRequest())

    expect(res.status).toBe(500)
    expect(webhookEventCreate).not.toHaveBeenCalled()
  })

  it('bleibt erfolgreich (200 + Event persistiert), wenn der Mail-Versand fehlschlägt — email.ts wirft nie', async () => {
    constructEvent.mockReturnValue(succeededEvent())
    // Kontrakt von lib/email: Fehler werden intern gefangen, die Promise resolved
    // trotzdem (siehe tests/email-sendraw.test.ts, der genau das am echten Modul beweist)
    vi.mocked(sendOrderConfirmation).mockResolvedValue(undefined)
    vi.mocked(sendOrderPaidToFarmer).mockResolvedValue(undefined)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
    expect(webhookEventCreate).toHaveBeenCalledTimes(1)
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
})

describe('payment_intent.payment_failed', () => {
  const failedOrderFixture = {
    id: 'order_2',
    status: 'PENDING_CONFIRMATION',
    items: [
      { productId: 'prod_1', quantity: 2 },
      { productId: 'prod_2', quantity: 1 },
    ],
  }

  it('storniert die Bestellung und bucht den Bestand atomar (Transaktion) zurück', async () => {
    constructEvent.mockReturnValue(failedEvent())
    orderFindUnique.mockResolvedValue(failedOrderFixture as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order_2' },
        data: expect.objectContaining({ status: 'CANCELLED', paymentStatus: 'FAILED' }),
      })
    )
    expect(productUpdate).toHaveBeenCalledTimes(2)
    expect(productUpdate).toHaveBeenCalledWith({
      where: { id: 'prod_1' },
      data: { stock: { increment: 2 } },
    })
    expect(webhookEventCreate).toHaveBeenCalledWith({
      data: { stripeEventId: 'evt_failed_1', type: 'payment_intent.payment_failed' },
    })
  })

  it('bucht bei bereits stornierter Bestellung den Bestand NICHT erneut zurück (Retry-Guard)', async () => {
    constructEvent.mockReturnValue(failedEvent())
    orderFindUnique.mockResolvedValue({ ...failedOrderFixture, status: 'CANCELLED' } as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(transaction).not.toHaveBeenCalled()
    expect(productUpdate).not.toHaveBeenCalled()
    // Event wird trotzdem als erledigt markiert
    expect(webhookEventCreate).toHaveBeenCalledTimes(1)
  })

  it('ignoriert PaymentIntents ohne zugehörige Bestellung, Event gilt als verarbeitet', async () => {
    constructEvent.mockReturnValue(failedEvent())
    orderFindUnique.mockResolvedValue(null)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(transaction).not.toHaveBeenCalled()
    expect(webhookEventCreate).toHaveBeenCalledTimes(1)
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
    expect(orderUpdate).not.toHaveBeenCalled()
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
