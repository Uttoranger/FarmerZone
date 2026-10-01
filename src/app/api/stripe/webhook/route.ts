import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { Prisma } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'
import { stripe } from '@/lib/stripe'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { sendOrderConfirmation, sendOrderPaidToFarmer, sendZahlungZuSpaet } from '@/lib/email'
import { storniereUnbezahlteBestellung } from '@/server/unbezahlte-bestellung'

// Next.js App Router does not pre-parse the body — raw text needed for Stripe sig verification
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const webhookSecret = env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[Webhook] STRIPE_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Webhook] Signature verification failed:', msg)
    return NextResponse.json({ error: `Webhook signature invalid: ${msg}` }, { status: 400 })
  }

  // Idempotency: skip already-processed events
  const existing = await prisma.webhookEvent.findUnique({
    where: { stripeEventId: event.id },
  })
  if (existing) {
    return NextResponse.json({ received: true, skipped: true })
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent)
    } else if (event.type === 'payment_intent.payment_failed') {
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent)
    } else if (event.type === 'payment_intent.canceled') {
      await handlePaymentCanceled(event.data.object as Stripe.PaymentIntent)
    }
  } catch (err) {
    // 500 → Stripe retried das Event; es wurde noch nicht persistiert und gilt als unverarbeitet
    console.error(`[Webhook] Error handling ${event.type}:`, err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  // Erst nach erfolgreicher Verarbeitung als erledigt markieren
  try {
    await prisma.webhookEvent.create({
      data: { stripeEventId: event.id, type: event.type },
    })
  } catch (err) {
    // P2002 = paralleler Request hat dasselbe Event bereits persistiert — kein Fehler
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ received: true, skipped: true })
    }
    console.error('[Webhook] Event verarbeitet, aber Persistierung fehlgeschlagen:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

const BESTELLUNG_FUER_MAIL = {
  farm: {
    select: {
      id: true, name: true, slug: true, email: true, ownerName: true,
      address: true, postalCode: true, city: true, phone: true,
    },
  },
  items: {
    select: {
      productName: true, quantity: true, unitPrice: true, totalPrice: true,
      // Einheit nur für die E-Mail-Anzeige gejoint
      product: { select: { unit: true, unitSize: true } },
    },
  },
} satisfies Prisma.OrderInclude

/**
 * Bezahlt wird NUR aus „wartet auf Zahlung" heraus — der bedingte Wechsel ist
 * die Sperre (ARCHITECTURE.md §5). Vorher schrieb der Handler blind PAID und
 * belebte damit eine stornierte Bestellung wieder, deren Ware schon
 * zurückgebucht war.
 */
async function handlePaymentSucceeded(pi: Stripe.PaymentIntent) {
  const { count } = await prisma.order.updateMany({
    where: { stripePaymentIntentId: pi.id, status: 'PENDING_CONFIRMATION' },
    data: { status: 'PAID', paymentStatus: 'PAID', paidAt: new Date() },
  })

  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: pi.id },
    include: BESTELLUNG_FUER_MAIL,
  })

  if (!order) {
    console.error('[Webhook] Order not found for PaymentIntent:', pi.id)
    return
  }

  if (count === 1) {
    verschickeBezahltMails(order)
    return
  }

  // Storniert, OHNE dass je eine Zahlung vermerkt wurde: Das Geld kam zu spät.
  // Hat dagegen der Hof eine bezahlte Bestellung storniert (paymentStatus PAID
  // oder REFUNDED), ist die Erstattung Sache von cancelOrder — dann ist dies
  // nur eine Wiederholung des Ereignisses. (Bekannte Lücke dort: DEVELOPMENT.md,
  // „payment_failed stornierte endgültig", Offen.)
  if (order.status === 'CANCELLED' && (order.paymentStatus === 'PENDING' || order.paymentStatus === 'FAILED')) {
    await erstatteSpaeteZahlung(pi, order)
  }
  // Sonst schon bezahlt (PAID oder weiter im Ablauf): nichts zu tun.
}

/**
 * Nur vermerken. `payment_failed` ist bei Stripe KEIN Endzustand: Der
 * PaymentIntent bleibt bezahlbar, die Kundin kann es mit einer anderen Karte
 * gleich noch einmal versuchen. Bestellung und Bestand bleiben deshalb stehen;
 * endgültig beendet erst `payment_intent.canceled`.
 */
async function handlePaymentFailed(pi: Stripe.PaymentIntent) {
  await prisma.order.updateMany({
    where: { stripePaymentIntentId: pi.id, status: 'PENDING_CONFIRMATION' },
    data: { paymentStatus: 'FAILED' },
  })
}

/** Der PaymentIntent ist endgültig abgebrochen — jetzt erst stornieren und die Ware freigeben. */
async function handlePaymentCanceled(pi: Stripe.PaymentIntent) {
  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: pi.id },
    select: { id: true },
  })
  if (!order) return

  await storniereUnbezahlteBestellung(order.id, 'Zahlung abgebrochen')
}

/**
 * Die Zahlung kam, als die Bestellung schon storniert und ihre Ware
 * freigegeben war: sofort voll erstatten. Wie beim Vollstorno
 * (ARCHITECTURE.md §5) mit reverse_transfer und — sobald die Zahlung eine
 * Gebühr trägt — refund_application_fee, sonst trüge die Plattform den
 * Warenpreis bzw. der Hof die Servicegebühr.
 *
 * Scheitert die Erstattung, wirft sie: 500, das Ereignis bleibt unverarbeitet
 * und Stripe stellt es erneut zu — derselbe Idempotenz-Schlüssel verhindert
 * dabei eine zweite Erstattung.
 *
 * AUSNAHME von „erst bedingt schreiben, dann Stripe" (ARCHITECTURE.md §5): Der
 * Vermerk REFUNDED darf erst stehen, wenn das Geld zurück ist — sonst sperrte
 * er die Wiederholung nach einer gescheiterten Erstattung aus. Vor doppelter
 * Erstattung schützt der Schlüssel, der Vermerk sperrt nur die Mail.
 */
async function erstatteSpaeteZahlung(
  pi: Stripe.PaymentIntent,
  order: Prisma.OrderGetPayload<{ include: typeof BESTELLUNG_FUER_MAIL }>
) {
  // Alarm vor dem Geld: Der Betreiber soll den Fall sehen, auch wenn die
  // Erstattung scheitert. Nur die Bestell-ID, keine Kundendaten.
  Sentry.captureMessage('Zahlung nach dem Storno eingegangen — wird voll erstattet', {
    level: 'error',
    tags: { webhook: 'payment_intent.succeeded', grund: 'spaet_bezahlt' },
    extra: { orderId: order.id },
  })

  let erstattetCents: number
  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: pi.id,
        reverse_transfer: true,
        ...((pi.application_fee_amount ?? 0) > 0 ? { refund_application_fee: true } : {}),
      },
      { idempotencyKey: `spaet-bezahlt-${order.id}` }
    )
    erstattetCents = refund.amount
  } catch (err) {
    // Idempotenz-Konflikt (409): Eine gleichzeitige Zustellung desselben
    // Ereignisses erstattet gerade mit demselben Schlüssel. Das Geld geht also
    // zurück — keine Aufforderung zur Handerstattung, nur die Wiederholung.
    if (!istIdempotenzKonflikt(err)) {
      Sentry.captureException(err, {
        tags: { webhook: 'payment_intent.succeeded', grund: 'erstattung_offen' },
        extra: { orderId: order.id, handerstattung: 'Überweisung zurückbuchen und Plattformgebühr erstatten' },
      })
    }
    throw err
  }

  // Der Vermerk ist die Sperre für die Mail: Zwei gleichzeitige Zustellungen
  // desselben Ereignisses erstatten beide (Stripe liefert über den Schlüssel
  // dieselbe Erstattung), aber nur wer den Vermerk setzt, schreibt der Kundin.
  // Getrennt abgefangen: Scheitert nur er, ist das Geld trotzdem zurück. Ein
  // Wurf hier hieße 500 und eine Wiederholung, die nach Ablauf des
  // Idempotenz-Schlüssels an „schon erstattet" scheiterte.
  let vermerkt = true
  try {
    const { count } = await prisma.order.updateMany({
      where: { id: order.id, status: 'CANCELLED', paymentStatus: { in: ['PENDING', 'FAILED'] } },
      data: { paymentStatus: 'REFUNDED' },
    })
    vermerkt = count === 1
  } catch (err) {
    Sentry.captureException(err, {
      tags: { webhook: 'payment_intent.succeeded', grund: 'vermerk_fehlgeschlagen' },
      extra: { orderId: order.id },
    })
  }
  if (!vermerkt) return

  nachDerAntwort(async () => {
    await mailOhneRisiko('zahlung_zu_spaet', order.id, () => sendZahlungZuSpaet(order, erstattetCents))
  })
}

function verschickeBezahltMails(order: Prisma.OrderGetPayload<{ include: typeof BESTELLUNG_FUER_MAIL }>) {
  const emailOrder = {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    totalAmount: order.totalAmount,
    serviceFeeCents: order.serviceFeeCents,
    pickupDate: order.pickupDate,
    pickupTimeStart: order.pickupTimeStart,
    pickupTimeEnd: order.pickupTimeEnd,
    paymentMethod: order.paymentMethod,
    stripePaymentIntentId: order.stripePaymentIntentId,
    farm: order.farm,
    items: order.items,
  }

  // Nach der Antwort und je Mail einzeln abgesichert: Ein Mailfehler im
  // Antwortpfad hieß 500, Stripe stellte das Ereignis erneut zu — und beide
  // Mails gingen ein zweites Mal raus. Scheitert die Mail an die Kundin,
  // bekommt der Hof seine trotzdem.
  nachDerAntwort(async () => {
    await mailOhneRisiko('bestaetigung_kundin', order.id, () => sendOrderConfirmation(emailOrder))
    await mailOhneRisiko('bestellung_hof', order.id, () => sendOrderPaidToFarmer(emailOrder))
  })
}

/** Stripe-Fehlerklasse über `type`, wie das SDK es empfiehlt — ohne Laufzeit-Import des SDK. */
function istIdempotenzKonflikt(err: unknown): boolean {
  return (err as { type?: unknown } | null)?.type === 'StripeIdempotencyError'
}

/** Ein Mailfehler wird gemeldet, nie weitergeworfen. Nur die Bestell-ID, keine Adresse. */
async function mailOhneRisiko(mail: string, orderId: string, senden: () => Promise<void>) {
  try {
    await senden()
  } catch (err) {
    console.error(`[Webhook] Mail ${mail} fehlgeschlagen für Bestellung ${orderId}`)
    Sentry.captureException(err, { tags: { webhook: 'mail', mail }, extra: { orderId } })
  }
}
