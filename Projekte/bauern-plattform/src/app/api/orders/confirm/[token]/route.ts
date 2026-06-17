import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, orderConfirmationHtml, farmerNotificationHtml } from '@/lib/email'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const order = await prisma.order.findUnique({
    where: { confirmationToken: token },
    include: {
      farm: {
        select: { slug: true, name: true, email: true, ownerName: true },
      },
      items: { select: { productName: true, quantity: true, unitPrice: true, totalPrice: true } },
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

  // Update order to CONFIRMED
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: 'CONFIRMED',
      confirmedAt: new Date(),
    },
  })

  const pickupDate = order.pickupDate.toLocaleDateString('de-AT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const pickupTime = `${order.pickupTimeStart}–${order.pickupTimeEnd}`

  // Send confirmation email to customer
  await sendEmail({
    to: order.customerEmail,
    subject: `Bestellung ${order.orderNumber} bestätigt — ${order.farm.name}`,
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
      isOnline: false,
    }),
  })

  // Notify farmer
  await sendEmail({
    to: order.farm.email,
    subject: `Neue bestätigte Bestellung ${order.orderNumber}`,
    html: farmerNotificationHtml({
      farmerName: order.farm.ownerName,
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      pickupDate,
      pickupTime,
      items: order.items.map((i) => ({ name: i.productName, quantity: i.quantity })),
      total: Number(order.totalAmount),
      paymentLabel:
        order.paymentMethod === 'ONSITE_CASH' ? 'Bar bei Abholung' : 'Karte bei Abholung',
    }),
  })

  return NextResponse.redirect(
    new URL(`/${order.farm.slug}/confirm/${order.id}?confirmed=true`, request.url)
  )
}
