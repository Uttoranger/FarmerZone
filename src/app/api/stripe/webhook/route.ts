import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { Prisma } from '@prisma/client'
import { stripe } from '@/lib/stripe'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { sendOrderConfirmation, sendOrderPaidToFarmer } from '@/lib/email'

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

async function handlePaymentSucceeded(pi: Stripe.PaymentIntent) {
  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: pi.id },
    include: {
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
    },
  })

  if (!order) {
    console.error('[Webhook] Order not found for PaymentIntent:', pi.id)
    return
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'PAID', paymentStatus: 'PAID', paidAt: new Date() },
  })

  const emailOrder = {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    totalAmount: order.totalAmount,
    pickupDate: order.pickupDate,
    pickupTimeStart: order.pickupTimeStart,
    pickupTimeEnd: order.pickupTimeEnd,
    paymentMethod: order.paymentMethod,
    stripePaymentIntentId: order.stripePaymentIntentId,
    farm: order.farm,
    items: order.items,
  }

  await sendOrderConfirmation(emailOrder)
  await sendOrderPaidToFarmer(emailOrder)
}

async function handlePaymentFailed(pi: Stripe.PaymentIntent) {
  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: pi.id },
    select: { id: true, status: true, items: { select: { productId: true, quantity: true } } },
  })

  if (!order) return

  // Bereits storniert (z. B. früherer, vollständig gelaufener Versuch dieses Events):
  // Bestand nicht noch einmal zurückbuchen
  if (order.status === 'CANCELLED') return

  // Atomar: Storno + Bestands-Rückbuchung ganz oder gar nicht — sonst würde ein
  // Stripe-Retry nach Teilfehler den Bestand doppelt erhöhen
  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        paymentStatus: 'FAILED',
        cancelledAt: new Date(),
        cancelReason: 'Zahlung fehlgeschlagen',
      },
    }),
    ...order.items.map((item) =>
      prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      })
    ),
  ])
}
