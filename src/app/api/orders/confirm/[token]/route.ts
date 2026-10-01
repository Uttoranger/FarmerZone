import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendOrderConfirmation, sendOrderConfirmedToFarmer } from '@/lib/email'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'

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
          // Einheit nur für die E-Mail-Anzeige gejoint
          product: { select: { unit: true, unitSize: true } },
        },
      },
    },
  })

  if (!order) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const bestellSeite = new URL(`/${order.farm.slug}/confirm/${order.id}`, request.url)

  // Frist gilt beim Lesen (src/lib/fristen.ts): Ist die Bestätigungsfrist
  // vorbei, verfällt die Bestellung JETZT — auch wenn der tägliche Cron noch
  // nicht lief. Die Bestellseite zeigt danach „verfallen".
  await gibVerwaisteFreiOhneRisiko(order.farm.id)

  // Bedingt bestätigen — der Wechsel ist die Sperre (ARCHITECTURE.md §5).
  // Lesen und blind schreiben hätte eine Bestellung bestätigt, die die
  // Freigabe eben storniert und deren Ware sie zurückgebucht hat. count 0:
  // schon bestätigt (zweiter Klick), verfallen oder storniert.
  const { count } = await prisma.order.updateMany({
    where: { id: order.id, status: 'PENDING_CONFIRMATION' },
    data: { status: 'CONFIRMED', confirmedAt: new Date() },
  })
  if (count === 0) {
    return NextResponse.redirect(bestellSeite)
  }

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

  await sendOrderConfirmation(emailOrder)
  await sendOrderConfirmedToFarmer(emailOrder)

  bestellSeite.searchParams.set('confirmed', 'true')
  return NextResponse.redirect(bestellSeite)
}
