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
import { stripeKontoBereit } from '@/lib/stripe-konto'

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

  // Zwei Endpunkte in Stripe, eine Route: Plattform-Events (Zahlungen) und
  // Connect-Events der verbundenen Höfe (account.updated) kommen mit je
  // eigenem Signatur-Secret. Gültig ist, was gegen eines davon passt.
  const secrets = [webhookSecret, env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(
    (s): s is string => typeof s === 'string' && s.length > 0
  )
  let event: Stripe.Event | null = null
  let letzterFehler = 'Unknown error'
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, secret)
      break
    } catch (err) {
      letzterFehler = err instanceof Error ? err.message : 'Unknown error'
    }
  }
  if (!event) {
    console.error('[Webhook] Signature verification failed:', letzterFehler)
    return NextResponse.json({ error: `Webhook signature invalid: ${letzterFehler}` }, { status: 400 })
  }

  // Idempotency: skip already-processed events
  const existing = await prisma.webhookEvent.findUnique({
    where: { stripeEventId: event.id },
  })
  if (existing) {
    return NextResponse.json({ received: true, skipped: true })
  }

  try {
    // Ereignisse verbundener Hof-Konten (Connect-Endpunkt, `event.account`
    // gesetzt) betreffen nur das Konto selbst — Zahlungen laufen als
    // Destination Charge auf der Plattform und kommen ohne `account`.
    if (event.account) {
      if (event.type === 'account.updated') {
        await handleKontoAktualisiert(event.data.object as Stripe.Account)
      }
    } else if (event.type === 'payment_intent.succeeded') {
      await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent)
    } else if (event.type === 'payment_intent.payment_failed') {
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent)
    } else if (event.type === 'payment_intent.canceled') {
      await handlePaymentCanceled(event.data.object as Stripe.PaymentIntent)
    } else if (event.type === 'account.updated') {
      // Auch über den Plattform-Endpunkt möglich (abonniert); dieselbe Regel.
      await handleKontoAktualisiert(event.data.object as Stripe.Account)
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

/**
 * Stripe hat das Konto eines Hofs geändert — etwa gesperrt, weil Angaben
 * fehlen, oder wieder freigegeben. Vorher setzte nur das Onboarding
 * `stripeAccountReady`; eine spätere Sperre blieb unbemerkt, der Checkout bot
 * Online weiter an, und jede Zahlung scheiterte erst bei Stripe. Kein Hof mit
 * dieser Konto-ID (fremdes Konto, das Plattformkonto selbst): nichts zu tun.
 */
async function handleKontoAktualisiert(konto: Stripe.Account) {
  const hof = await prisma.farm.findFirst({ where: { stripeAccountId: konto.id }, select: { id: true } })
  if (!hof) return
  // Stripe liefert Ereignisse nicht garantiert in der richtigen Reihenfolge.
  // Ein verspätetes, älteres account.updated überschriebe sonst einen
  // neueren Stand — also den aktuellen nachlesen. Scheitert das: 500, Stripe
  // stellt erneut zu.
  // Kurze Leine: Hängt Stripe, bricht die Zustellung sonst ab und kommt erneut.
  const aktuell = await stripe.accounts.retrieve(konto.id, {}, { timeout: 10_000, maxNetworkRetries: 1 })
  await prisma.farm.update({
    where: { id: hof.id },
    data: { stripeAccountReady: stripeKontoBereit(aktuell) },
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
    // Jeder Fehler hier heißt: Das Geld ist (noch) nicht zurück. Einen
    // 409 durch eine gleichzeitige Zustellung mit demselben Schlüssel
    // wiederholt das Stripe-SDK schon selbst; was danach noch übrig ist,
    // soll alarmieren.
    Sentry.captureException(err, {
      tags: { webhook: 'payment_intent.succeeded', grund: 'erstattung_offen' },
      extra: { orderId: order.id, handerstattung: 'Überweisung zurückbuchen und Plattformgebühr erstatten' },
    })
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

/** Ein Mailfehler wird gemeldet, nie weitergeworfen. Nur die Bestell-ID, keine Adresse. */
async function mailOhneRisiko(mail: string, orderId: string, senden: () => Promise<void>) {
  try {
    await senden()
  } catch (err) {
    console.error(`[Webhook] Mail ${mail} fehlgeschlagen für Bestellung ${orderId}`)
    Sentry.captureException(err, { tags: { webhook: 'mail', mail }, extra: { orderId } })
  }
}
