import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendOrderConfirmation, sendOrderConfirmedToFarmer } from '@/lib/email'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const order = await prisma.order.findUnique({
    where: { confirmationToken: token },
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
        },
      },
    },
  })

  if (!order) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Idempotent — clicking twice is fine
  if (order.status !== 'PENDING_CONFIRMATION') {
    return NextResponse.redirect(
      new URL(`/${order.farm.slug}/confirm/${order.id}`, request.url)
    )
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'CONFIRMED', confirmedAt: new Date() },
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
  await sendOrderConfirmedToFarmer(emailOrder)

  return NextResponse.redirect(
    new URL(`/${order.farm.slug}/confirm/${order.id}?confirmed=true`, request.url)
  )
}
