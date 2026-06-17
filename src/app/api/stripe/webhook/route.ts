import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { sendEmail, orderConfirmationHtml, farmerNotificationHtml } from '@/lib/email'

// Next.js App Router does not pre-parse the body — raw text needed for Stripe sig verification
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
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

  // Record before processing so retries don't double-process
  await prisma.webhookEvent.create({
    data: { stripeEventId: event.id, type: event.type },
  })

  try {
    if (event.type === 'payment_intent.succeeded') {
      await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent)
    } else if (event.type === 'payment_intent.payment_failed') {
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent)
    }
  } catch (err) {
    // Return 200 — event is already recorded, Stripe shouldn't retry
    console.error(`[Webhook] Error handling ${event.type}:`, err)
  }

  return NextResponse.json({ received: true })
}

async function handlePaymentSucceeded(pi: Stripe.PaymentIntent) {
  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: pi.id },
    include: {
      farm: { select: { slug: true, name: true, email: true, ownerName: true } },
      items: { select: { productName: true, quantity: true, unitPrice: true } },
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

  const pickupDate = order.pickupDate.toLocaleDateString('de-AT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const pickupTime = `${order.pickupTimeStart}–${order.pickupTimeEnd}`

  await sendEmail({
    to: order.customerEmail,
    subject: `Zahlung erfolgreich — Bestellung ${order.orderNumber}`,
    html: orderConfirmationHtml({
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      farmName: order.farm.name,
      pickupDate,
      pickupTime,
      items: order.items.map((i) => ({
        name: i.productName,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
      })),
      total: Number(order.totalAmount),
      isOnline: true,
    }),
  })

  await sendEmail({
    to: order.farm.email,
    subject: `Bezahlte Bestellung ${order.orderNumber} eingegangen`,
    html: farmerNotificationHtml({
      farmerName: order.farm.ownerName,
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      pickupDate,
      pickupTime,
      items: order.items.map((i) => ({ name: i.productName, quantity: i.quantity })),
      total: Number(order.totalAmount),
      paymentLabel: 'Online (bereits bezahlt)',
    }),
  })
}

async function handlePaymentFailed(pi: Stripe.PaymentIntent) {
  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: pi.id },
    select: { id: true, items: { select: { productId: true, quantity: true } } },
  })

  if (!order) return

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: 'CANCELLED',
      paymentStatus: 'FAILED',
      cancelledAt: new Date(),
      cancelReason: 'Zahlung fehlgeschlagen',
    },
  })

  // Restore stock so others can order
  for (const item of order.items) {
    await prisma.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    })
  }
}
