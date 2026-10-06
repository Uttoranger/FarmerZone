/**
 * Integrationstest — der Stripe-Webhook gegen die echte Datenbank.
 *
 * Die Aussage: Ein Zahlungsereignis ändert eine Bestellung nur aus dem Zustand
 * heraus, für den es gilt. Bedingter Statuswechsel (`updateMany` mit
 * Statusbedingung) statt Lesen-und-blind-Schreiben.
 *
 * WARUM DIESE FÄLLE: `payment_intent.payment_failed` ist bei Stripe KEIN
 * Endzustand — der PaymentIntent bleibt bezahlbar, die Kundin kann es mit einer
 * anderen Karte noch einmal versuchen. Der Webhook stornierte trotzdem und
 * buchte den Bestand zurück; kam danach `payment_intent.succeeded`, setzte er
 * die stornierte Bestellung blind auf PAID — bezahlt, aber ohne Ware im
 * Bestand. Endgültig ist erst `payment_intent.canceled`.
 *
 * WIE EINE ZAHLUNG „ZU SPÄT" KOMMT: Ein abgebrochener PaymentIntent
 * (`canceled`) kann bei Stripe nicht mehr gelingen. Spät wird eine Zahlung,
 * wenn die Bestellung storniert wurde, während der PaymentIntent noch
 * bezahlbar war — vom Hof über `cancelOrder` (hier echt aufgerufen, mit echter
 * Anmeldung), früher auch vom alten `payment_failed`-Handler.
 *
 * Echt sind Datenbank, Transaktion, Anmeldung des Hofes und die
 * Signaturprüfung von Stripe (das Ereignis wird mit dem Platzhalter-Secret der
 * Integrationsschicht signiert). Gemockt sind Erstattung, Mail, Sentry und der
 * Request-Kontext — kein Netz, kein Geld.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/stripe', async () => {
  // Die echten Webhook-Helfer des SDK — Signatur prüfen und im Test erzeugen —,
  // aber keine echte Erstattung.
  const { default: Stripe } = await import('stripe')
  const echt = new Stripe('sk_test_integration_dummy')
  return { stripe: { webhooks: echt.webhooks, refunds: { create: vi.fn(), list: vi.fn(async () => ({ data: [], has_more: false })) } } }
})
vi.mock('@/lib/email', () => ({
  sendOrderConfirmation: vi.fn(),
  sendOrderPaidToFarmer: vi.fn(),
  sendZahlungZuSpaet: vi.fn(),
  sendOrderCancelled: vi.fn(),
  sendOrderReady: vi.fn(),
  sendOrderNotReady: vi.fn(),
}))

import { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { POST } from '@/app/api/stripe/webhook/route'
import { cancelOrder } from '@/server/actions/orders'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { sendOrderConfirmation, sendOrderPaidToFarmer, sendZahlungZuSpaet } from '@/lib/email'
import { INTEGRATIONS_ENV } from './setup/integrations-umgebung'
import { erstelleHofMitAnmeldung, erstelleProdukt, intKennung, raeumeAuf } from './setup/basis'

const erstatten = vi.mocked(stripe.refunds.create)

beforeEach(() => {
  vi.clearAllMocks()
  erstatten.mockResolvedValue({ id: 're_int_test', amount: 2100 } as never)
})

afterEach(async () => {
  await raeumeAuf()
})

const EINZELPREIS = 10
const MENGE = 2
/** Der Bestand NACH der Buchung im Checkout — er ist schon abgezogen. */
const BESTAND_NACH_CHECKOUT = 5

type Ereignistyp =
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'payment_intent.canceled'

/**
 * Eine Online-Bestellung, wie der Checkout sie hinterlässt: wartet auf die
 * Zahlung, Bestand schon gebucht, PaymentIntent vermerkt. Der Hof ist
 * angemeldet, damit `cancelOrder` echt laufen kann.
 */
async function offeneOnlineBestellung() {
  const { farm, cookie } = await erstelleHofMitAnmeldung({ acceptsOnline: true })
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
  const produkt = await erstelleProdukt(farm.id, { stock: BESTAND_NACH_CHECKOUT })
  const paymentIntentId = intKennung('pi')

  const bestellung = await prisma.order.create({
    data: {
      orderNumber: intKennung('bestellung').toUpperCase(),
      farmId: farm.id,
      customerEmail: `${intKennung('kundin')}@example.com`,
      customerName: 'Erika Mustermann',
      customerPhone: '+43 660 0000000',
      status: 'PENDING_CONFIRMATION',
      totalAmount: EINZELPREIS * MENGE,
      pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: 'ONLINE',
      paymentStatus: 'PENDING',
      stripePaymentIntentId: paymentIntentId,
      platformFeeAmount: 0,
      serviceFeeCents: 100,
      serviceFeePercentApplied: 4.9,
      items: {
        create: [
          {
            productId: produkt.id,
            productName: 'Testprodukt',
            unitPrice: EINZELPREIS,
            quantity: MENGE,
            totalPrice: EINZELPREIS * MENGE,
            vatRate: 10,
          },
        ],
      },
    },
  })

  return { produkt, bestellung, paymentIntentId }
}

/** Ein Ereignis, wie Stripe es schickt — mit eigener oder vorgegebener ID. */
function ereignis(typ: Ereignistyp, paymentIntentId: string, id: string = intKennung('evt')) {
  return {
    id,
    object: 'event',
    type: typ,
    data: {
      object: {
        id: paymentIntentId,
        object: 'payment_intent',
        amount: 2100,
        // Servicegebühr 1,00 € als application_fee — wie im Checkout.
        application_fee_amount: 100,
      },
    },
  }
}

/** Signiert wie Stripe und ruft den Handler direkt — kein HTTP-Server. */
async function zustellen(ev: ReturnType<typeof ereignis>) {
  const koerper = JSON.stringify(ev)
  const signatur = stripe.webhooks.generateTestHeaderString({
    payload: koerper,
    secret: INTEGRATIONS_ENV.STRIPE_WEBHOOK_SECRET,
  })
  return POST(
    new NextRequest('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': signatur, 'content-type': 'application/json' },
      body: koerper,
    })
  )
}

async function bestand(produktId: string) {
  return (await prisma.product.findUniqueOrThrow({ where: { id: produktId } })).stock
}

async function zustand(bestellungId: string) {
  return prisma.order.findUniqueOrThrow({ where: { id: bestellungId } })
}

describe('payment_intent.payment_failed — nur vermerken', () => {
  it('lässt die Bestellung offen und den Bestand gebucht', async () => {
    const { produkt, bestellung, paymentIntentId } = await offeneOnlineBestellung()

    const antwort = await zustellen(ereignis('payment_intent.payment_failed', paymentIntentId))

    expect(antwort.status).toBe(200)
    expect(await zustand(bestellung.id)).toMatchObject({
      status: 'PENDING_CONFIRMATION',
      paymentStatus: 'FAILED',
      cancelledAt: null,
    })
    expect(await bestand(produkt.id)).toBe(BESTAND_NACH_CHECKOUT)
  })

  it('failed → succeeded ergibt PAID, der Bestand bleibt einmal gebucht', async () => {
    const { produkt, bestellung, paymentIntentId } = await offeneOnlineBestellung()

    expect((await zustellen(ereignis('payment_intent.payment_failed', paymentIntentId))).status).toBe(200)
    expect((await zustellen(ereignis('payment_intent.succeeded', paymentIntentId))).status).toBe(200)

    const danach = await zustand(bestellung.id)
    expect(danach).toMatchObject({ status: 'PAID', paymentStatus: 'PAID', cancelledAt: null })
    expect(danach.paidAt).not.toBeNull()
    // 5: im Checkout gebucht, weder zurückgegeben noch ein zweites Mal abgezogen.
    // Der Fehler lieferte 7 — zurückgebucht und trotzdem bezahlt.
    expect(await bestand(produkt.id)).toBe(BESTAND_NACH_CHECKOUT)
    expect(erstatten).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(sendOrderConfirmation).toHaveBeenCalledTimes(1))
    expect(sendOrderPaidToFarmer).toHaveBeenCalledTimes(1)
  })
})

describe('payment_intent.canceled — endgültig', () => {
  it('storniert und bucht den Bestand genau einmal zurück, auch bei doppelter Zustellung', async () => {
    const { produkt, bestellung, paymentIntentId } = await offeneOnlineBestellung()
    const einmal = ereignis('payment_intent.canceled', paymentIntentId)

    // Dasselbe Ereignis zweimal gleichzeitig — beide sehen es in der
    // Idempotenz-Tabelle noch nicht — und danach ein zweites mit neuer ID.
    const [a, b] = await Promise.all([zustellen(einmal), zustellen(einmal)])
    const c = await zustellen(ereignis('payment_intent.canceled', paymentIntentId))

    expect([a.status, b.status, c.status]).toEqual([200, 200, 200])
    const danach = await zustand(bestellung.id)
    expect(danach).toMatchObject({ status: 'CANCELLED', cancelReason: 'Zahlung abgebrochen' })
    expect(danach.cancelledAt).not.toBeNull()
    // Die Servicegebühr entfällt — derselbe Vermerk wie bei cancelOrder.
    expect(danach.serviceFeeRefundedAt).not.toBeNull()
    // 5 + 2: genau einmal zurück. Zweimal wären es 9.
    expect(await bestand(produkt.id)).toBe(BESTAND_NACH_CHECKOUT + MENGE)
  })

  // Wache für die Bedingung: Stripe schickt nach succeeded kein canceled —
  // käme es doch (oder rufe K3 die Funktion zu spät), bleibt die Bestellung bezahlt.
  it('lässt eine bezahlte Bestellung unberührt', async () => {
    const { produkt, bestellung, paymentIntentId } = await offeneOnlineBestellung()
    await zustellen(ereignis('payment_intent.succeeded', paymentIntentId))

    await zustellen(ereignis('payment_intent.canceled', paymentIntentId))

    expect(await zustand(bestellung.id)).toMatchObject({ status: 'PAID', paymentStatus: 'PAID' })
    expect(await bestand(produkt.id)).toBe(BESTAND_NACH_CHECKOUT)
  })
})

describe('payment_intent.succeeded — nur aus „wartet auf Zahlung"', () => {
  it('auf eine vom Hof stornierte, unbezahlte Bestellung: voll erstatten, Alarm, Mail — kein PAID, kein Bestand', async () => {
    const { produkt, bestellung, paymentIntentId } = await offeneOnlineBestellung()
    // Der Hof storniert, während die Kundin noch an der Zahlung sitzt.
    expect((await cancelOrder(bestellung.id, 'Ware ausgegangen')).error).toBeUndefined()
    vi.clearAllMocks()
    erstatten.mockResolvedValue({ id: 're_int_test', amount: 2100 } as never)

    const antwort = await zustellen(ereignis('payment_intent.succeeded', paymentIntentId))

    expect(antwort.status).toBe(200)
    expect(erstatten).toHaveBeenCalledTimes(1)
    expect(erstatten).toHaveBeenCalledWith(
      {
        payment_intent: paymentIntentId,
        reverse_transfer: true,
        refund_application_fee: true,
      },
      { idempotencyKey: `spaet-bezahlt-${bestellung.id}` }
    )
    expect(await zustand(bestellung.id)).toMatchObject({
      status: 'CANCELLED',
      paymentStatus: 'REFUNDED',
      paidAt: null,
    })
    // Der Bestand bleibt, wie der Storno ihn hinterließ.
    expect(await bestand(produkt.id)).toBe(BESTAND_NACH_CHECKOUT + MENGE)
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    // Der Betrag aus der Erstattung, in Cent.
    await vi.waitFor(() => expect(sendZahlungZuSpaet).toHaveBeenCalledWith(expect.anything(), 2100))
    expect(sendZahlungZuSpaet).toHaveBeenCalledTimes(1)
    expect(sendOrderConfirmation).not.toHaveBeenCalled()
    expect(sendOrderPaidToFarmer).not.toHaveBeenCalled()
  })

  it('dieselbe späte Zahlung zweimal gleichzeitig zugestellt: ein Schlüssel, eine Mail', async () => {
    const { bestellung, paymentIntentId } = await offeneOnlineBestellung()
    expect((await cancelOrder(bestellung.id)).error).toBeUndefined()
    const spaet = ereignis('payment_intent.succeeded', paymentIntentId)

    const antworten = await Promise.all([zustellen(spaet), zustellen(spaet)])

    expect(antworten.map((a) => a.status)).toEqual([200, 200])
    // Beide dürfen Stripe erreichen — mit DEMSELBEN Schlüssel, also eine Erstattung.
    for (const aufruf of erstatten.mock.calls) {
      expect(aufruf[1]).toEqual({ idempotencyKey: `spaet-bezahlt-${bestellung.id}` })
    }
    await vi.waitFor(() => expect(sendZahlungZuSpaet).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 50))
    expect(sendZahlungZuSpaet).toHaveBeenCalledTimes(1)
    expect(await zustand(bestellung.id)).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUNDED' })
  })

  it('erstattet auch Altfälle: vom früheren payment_failed storniert', async () => {
    const { bestellung, paymentIntentId } = await offeneOnlineBestellung()
    // So hinterließ der alte Handler eine fehlgeschlagene Zahlung.
    await prisma.order.update({
      where: { id: bestellung.id },
      data: {
        status: 'CANCELLED',
        paymentStatus: 'FAILED',
        cancelledAt: new Date(),
        cancelReason: 'Zahlung fehlgeschlagen',
      },
    })

    await zustellen(ereignis('payment_intent.succeeded', paymentIntentId))

    expect(erstatten).toHaveBeenCalledTimes(1)
    expect(await zustand(bestellung.id)).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUNDED' })
  })

  it('erstattet nicht, wenn der Hof die bezahlte Bestellung storniert hat (der Storno hat schon erstattet)', async () => {
    const { bestellung, paymentIntentId } = await offeneOnlineBestellung()
    await zustellen(ereignis('payment_intent.succeeded', paymentIntentId))
    // cancelOrder hinterlässt: storniert, erstattet.
    await prisma.order.update({
      where: { id: bestellung.id },
      data: { status: 'CANCELLED', paymentStatus: 'REFUNDED', cancelledAt: new Date() },
    })
    vi.clearAllMocks()

    // Eine Wiederholung des succeeded-Ereignisses (neue Zustellung).
    const antwort = await zustellen(ereignis('payment_intent.succeeded', paymentIntentId))

    expect(antwort.status).toBe(200)
    expect(erstatten).not.toHaveBeenCalled()
    expect(sendZahlungZuSpaet).not.toHaveBeenCalled()
    expect(await zustand(bestellung.id)).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUNDED' })
  })

  it('zweimal succeeded: einmal PAID, einmal Mails', async () => {
    const { bestellung, paymentIntentId } = await offeneOnlineBestellung()

    await zustellen(ereignis('payment_intent.succeeded', paymentIntentId))
    await zustellen(ereignis('payment_intent.succeeded', paymentIntentId))

    expect(await zustand(bestellung.id)).toMatchObject({ status: 'PAID' })
    await vi.waitFor(() => expect(sendOrderConfirmation).toHaveBeenCalledTimes(1))
    expect(sendOrderPaidToFarmer).toHaveBeenCalledTimes(1)
    expect(erstatten).not.toHaveBeenCalled()
  })
})

describe('Mailfehler', () => {
  it('antwortet trotzdem 200 und vermerkt das Ereignis — kein Stripe-Retry, keine doppelten Mails', async () => {
    const { bestellung, paymentIntentId } = await offeneOnlineBestellung()
    vi.mocked(sendOrderConfirmation).mockRejectedValue(new Error('Mailversand gescheitert'))
    vi.mocked(sendOrderPaidToFarmer).mockRejectedValue(new Error('Mailversand gescheitert'))
    const ev = ereignis('payment_intent.succeeded', paymentIntentId)

    const antwort = await zustellen(ev)

    expect(antwort.status).toBe(200)
    expect(await zustand(bestellung.id)).toMatchObject({ status: 'PAID', paymentStatus: 'PAID' })
    expect(await prisma.webhookEvent.findUnique({ where: { stripeEventId: ev.id } })).not.toBeNull()
    // Der Hof bekommt seine Mail, auch wenn die der Kundin scheitert.
    await vi.waitFor(() => expect(sendOrderPaidToFarmer).toHaveBeenCalledTimes(1))
  })
})
