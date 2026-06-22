'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { revalidatePath } from 'next/cache'
import { sendOrderReady, sendOrderCancelled, type OrderForEmail } from '@/lib/email'

export type ActionResult = { error?: string }

async function getAuthFarm() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  return prisma.farm.findUnique({
    where: { ownerId: session.user.id },
    select: {
      id: true, name: true, slug: true, email: true, ownerName: true,
      address: true, postalCode: true, city: true, phone: true,
    },
  })
}

type DbOrder = {
  orderNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  totalAmount: { toString(): string }
  pickupDate: Date
  pickupTimeStart: string
  pickupTimeEnd: string
  paymentMethod: string
  stripePaymentIntentId?: string | null
  items: Array<{
    productName: string
    quantity: number
    unitPrice: { toString(): string }
    totalPrice: { toString(): string }
  }>
}

type FarmInfo = {
  name: string; slug: string; email: string; ownerName: string
  address: string; postalCode: string; city: string; phone: string
}

function toEmailOrder(order: DbOrder, farm: FarmInfo): OrderForEmail {
  return {
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
    farm,
    items: order.items.map(i => ({
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
    })),
  }
}

const ORDER_EMAIL_SELECT = {
  id: true,
  orderNumber: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  totalAmount: true,
  pickupDate: true,
  pickupTimeStart: true,
  pickupTimeEnd: true,
  paymentMethod: true,
  paymentStatus: true,
  stripePaymentIntentId: true,
  items: {
    select: {
      id: true,
      productId: true,
      productName: true,
      quantity: true,
      unitPrice: true,
      totalPrice: true,
    },
  },
} as const

export async function markAsReady(orderId: string): Promise<ActionResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  const order = await prisma.order.findFirst({
    where: { id: orderId, farmId: farm.id, status: { in: ['PAID', 'CONFIRMED', 'IN_PREPARATION'] } },
    select: ORDER_EMAIL_SELECT,
  })
  if (!order) return { error: 'Bestellung nicht gefunden' }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'READY' },
  })

  await sendOrderReady(toEmailOrder(order, farm))

  revalidatePath('/orders')
  revalidatePath(`/orders/${orderId}`)
  return {}
}

export async function markAsPickedUp(orderId: string): Promise<ActionResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  const exists = await prisma.order.findFirst({
    where: { id: orderId, farmId: farm.id, status: 'READY' },
    select: { id: true },
  })
  if (!exists) return { error: 'Bestellung nicht gefunden' }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'PICKED_UP', pickedUpAt: new Date() },
  })

  revalidatePath('/orders')
  revalidatePath(`/orders/${orderId}`)
  return {}
}

export async function markAsPickedUpAndPaid(orderId: string): Promise<ActionResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  const exists = await prisma.order.findFirst({
    where: {
      id: orderId, farmId: farm.id, status: 'READY',
      paymentMethod: { in: ['ONSITE_CASH', 'ONSITE_CARD'] },
    },
    select: { id: true },
  })
  if (!exists) return { error: 'Bestellung nicht gefunden' }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'PICKED_UP',
      paymentStatus: 'PAID',
      pickedUpAt: new Date(),
      paidAt: new Date(),
    },
  })

  revalidatePath('/orders')
  revalidatePath(`/orders/${orderId}`)
  return {}
}

export async function cancelOrder(orderId: string, reason?: string): Promise<ActionResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  const order = await prisma.order.findFirst({
    where: { id: orderId, farmId: farm.id, status: { notIn: ['CANCELLED', 'PICKED_UP'] } },
    select: ORDER_EMAIL_SELECT,
  })
  if (!order) return { error: 'Bestellung nicht gefunden' }

  let refundAmount: number | null = null

  if (order.stripePaymentIntentId && order.paymentStatus === 'PAID') {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: order.stripePaymentIntentId,
      })
      refundAmount = refund.amount / 100
      await prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'REFUNDED' },
      })
    } catch (err) {
      console.error('[cancelOrder] Stripe refund failed:', err)
      return { error: 'Rückerstattung fehlgeschlagen. Bitte manuell über das Stripe Dashboard erstatten.' }
    }
  }

  for (const item of order.items) {
    await prisma.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    })
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelReason: reason ?? null,
    },
  })

  await sendOrderCancelled(toEmailOrder(order, farm), refundAmount)

  revalidatePath('/orders')
  revalidatePath(`/orders/${orderId}`)
  return {}
}
