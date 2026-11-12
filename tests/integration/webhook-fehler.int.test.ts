/**
 * Integrationstest — Fehler im Webhook erreichen Sentry (Nr. 288), gegen die
 * echte Datenbank.
 *
 * Die Aussagen:
 *  - Wirft die Behandlung eines Ereignisses, antwortet der Webhook 500 (Stripe
 *    stellt erneut zu), meldet genau einmal an Sentry mit Grund und Ereignis
 *    und vermerkt das Ereignis NICHT. Die zweite Zustellung nach behobenem
 *    Fehler wird verarbeitet und vermerkt.
 *  - Scheitert das Vermerken (kein P2002): 500 und eine Meldung; P2002 (ein
 *    paralleler Aufruf hat es schon vermerkt): 200 ohne Meldung.
 *  - Eine erfolgreiche Erstattung (charge.refund.updated), die nach dem
 *    Vermerk entstand, schließt eine offene Gebühr nach „Nicht abgeholt“:
 *    `erstattungOffenSeit` leer, `serviceFeeRefundedAt` gesetzt. Ein offener
 *    Storno bekommt kein `serviceFeeRefundedAt`.
 *
 * Echt sind Datenbank und Signaturprüfung (Platzhalter-Secret der
 * Integrationsschicht). Gestellt sind Sentry, Stripe-Aufrufe und für den
 * ersten Fall die Behandlung von invoice.paid (sie wirft auf Bestellung).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/stripe', async () => {
  const { default: Stripe } = await import('stripe')
  const echt = new Stripe('sk_test_integration_dummy')
  return { stripe: { webhooks: echt.webhooks, refunds: { create: vi.fn(), list: vi.fn(async () => ({ data: [], has_more: false })) } } }
})
vi.mock('@/server/plattformgebuehr-abrechnung', async (original) => ({
  ...(await original<typeof import('@/server/plattformgebuehr-abrechnung')>()),
  behandleRechnungBezahlt: vi.fn(async () => undefined),
}))
const nachlauf = vi.hoisted(() => ({ laufend: [] as Array<Promise<void>> }))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.laufend.push(aufgabe().catch(() => {}))
  },
}))

import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'
import { POST } from '@/app/api/stripe/webhook/route'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { behandleRechnungBezahlt } from '@/server/plattformgebuehr-abrechnung'
import { INTEGRATIONS_ENV } from './setup/integrations-umgebung'
import { erstelleHof, intKennung, raeumeAuf } from './setup/basis'

const melde = vi.mocked(Sentry.captureException)

async function nachlaufFertig(): Promise<void> {
  while (nachlauf.laufend.length > 0) await Promise.all(nachlauf.laufend.splice(0))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(async () => {
  vi.restoreAllMocks()
  await nachlaufFertig()
  await raeumeAuf()
})

/** Signiert wie Stripe und ruft den Handler direkt — kein HTTP-Server. */
async function zustellen(ev: { id: string; type: string; data: { object: Record<string, unknown> } }) {
  const koerper = JSON.stringify({ object: 'event', ...ev })
  const signatur = stripe.webhooks.generateTestHeaderString({ payload: koerper, secret: INTEGRATIONS_ENV.STRIPE_WEBHOOK_SECRET })
  return POST(
    new NextRequest('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': signatur, 'content-type': 'application/json' },
      body: koerper,
    })
  )
}

function rechnungBezahlt(id: string) {
  return { id, type: 'invoice.paid', data: { object: { id: 'in_int_beispiel', object: 'invoice', attempt_count: 1 } } }
}

async function vermerkt(id: string): Promise<boolean> {
  return (await prisma.webhookEvent.findUnique({ where: { stripeEventId: id } })) !== null
}

describe('Behandlung wirft', () => {
  it('500, genau eine Sentry-Meldung mit Grund und Ereignis, kein Vermerk — die zweite Zustellung wird verarbeitet', async () => {
    const id = intKennung('evt')
    vi.mocked(behandleRechnungBezahlt).mockRejectedValueOnce(new Error('Verbindung weg bei kundin@example.com'))

    const erste = await zustellen(rechnungBezahlt(id))

    expect(erste.status).toBe(500)
    expect(melde).toHaveBeenCalledTimes(1)
    expect(melde.mock.calls[0]?.[1]).toEqual({ tags: { webhook: 'invoice.paid', grund: 'verarbeitung_fehlgeschlagen' }, extra: { eventId: id } })
    expect(await vermerkt(id)).toBe(false)
    // Das Log nennt nur die Art, nie die Meldung.
    expect(vi.mocked(console.error).mock.calls.flat().map(String).join(' ')).not.toContain('example.com')

    const zweite = await zustellen(rechnungBezahlt(id))

    expect(zweite.status).toBe(200)
    expect(await vermerkt(id)).toBe(true)
    expect(behandleRechnungBezahlt).toHaveBeenCalledTimes(2)
    expect(melde).toHaveBeenCalledTimes(1)
  })
})

describe('Vermerken scheitert', () => {
  it('kein P2002: 500 und genau eine Meldung mit Grund „vermerk_fehlgeschlagen“', async () => {
    const id = intKennung('evt')
    vi.spyOn(prisma.webhookEvent, 'create').mockRejectedValueOnce(new Error('Verbindung weg'))

    const antwort = await zustellen(rechnungBezahlt(id))

    expect(antwort.status).toBe(500)
    expect(melde).toHaveBeenCalledTimes(1)
    expect(melde.mock.calls[0]?.[1]).toEqual({ tags: { webhook: 'invoice.paid', grund: 'vermerk_fehlgeschlagen' }, extra: { eventId: id } })
  })

  it('P2002: 200 ohne Meldung — ein paralleler Aufruf hat es schon vermerkt', async () => {
    const id = intKennung('evt')
    vi.spyOn(prisma.webhookEvent, 'create').mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' })
    )

    const antwort = await zustellen(rechnungBezahlt(id))

    expect(antwort.status).toBe(200)
    expect(melde).not.toHaveBeenCalled()
  })
})

describe('charge.refund.updated schließt die offene Gebühr nach „Nicht abgeholt“', () => {
  async function bestellung(status: 'NOT_PICKED_UP' | 'CANCELLED') {
    const { farm } = await erstelleHof({ acceptsOnline: true })
    const pi = intKennung('pi')
    const order = await prisma.order.create({
      data: {
        orderNumber: intKennung('bestellung').toUpperCase(),
        farmId: farm.id,
        customerEmail: `${intKennung('kundin')}@example.com`,
        customerName: 'Erika Mustermann',
        customerPhone: '+43 660 0000000',
        status,
        totalAmount: 20,
        pickupDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        pickupTimeStart: '15:00',
        pickupTimeEnd: '18:00',
        paymentMethod: 'ONLINE',
        paymentStatus: 'PAID',
        stripePaymentIntentId: pi,
        platformFeeAmount: 0,
        serviceFeeCents: 120,
        serviceFeePercentApplied: 6,
        // Der Vermerk liegt eine Stunde zurück — die Erstattung unten entsteht danach.
        erstattungOffenSeit: new Date(Date.now() - 60 * 60 * 1000),
      },
    })
    return { order, pi }
  }

  function erstattung(pi: string, betrag: number) {
    return {
      id: intKennung('evt'),
      type: 'charge.refund.updated',
      data: { object: { id: intKennung('re'), object: 'refund', amount: betrag, status: 'succeeded', payment_intent: pi, created: Math.floor(Date.now() / 1000) } },
    }
  }

  it('Gebühr-Fall: erstattungOffenSeit leer, serviceFeeRefundedAt gesetzt', async () => {
    const { order, pi } = await bestellung('NOT_PICKED_UP')

    const antwort = await zustellen(erstattung(pi, 120))

    expect(antwort.status).toBe(200)
    const danach = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(danach.erstattungOffenSeit).toBeNull()
    expect(danach.serviceFeeRefundedAt).toBeInstanceOf(Date)
    expect(danach.status).toBe('NOT_PICKED_UP')
  })

  it('offener Storno: erstattungOffenSeit leer, serviceFeeRefundedAt bleibt, wie es war', async () => {
    const { order, pi } = await bestellung('CANCELLED')

    const antwort = await zustellen(erstattung(pi, 2120))

    expect(antwort.status).toBe(200)
    const danach = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(danach.erstattungOffenSeit).toBeNull()
    expect(danach.serviceFeeRefundedAt).toBeNull()
  })
})
