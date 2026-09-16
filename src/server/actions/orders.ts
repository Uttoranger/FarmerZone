'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { revalidatePath } from 'next/cache'
import { sendOrderReady, sendOrderCancelled, sendOrderNotReady, type OrderForEmail } from '@/lib/email'
import type { OrderStatus } from '@prisma/client'

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
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  totalAmount: { toString(): string }
  /** Servicegebühr-Snapshot in Cent (Order.serviceFeeCents). */
  serviceFeeCents?: number
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
    product?: { unit: string; unitSize: { toString(): string } | null } | null
  }>
}

type FarmInfo = {
  id: string; name: string; slug: string; email: string; ownerName: string
  address: string; postalCode: string; city: string; phone: string
}

function toEmailOrder(order: DbOrder, farm: FarmInfo): OrderForEmail {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    totalAmount: order.totalAmount,
    serviceFeeCents: order.serviceFeeCents ?? 0,
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
      product: i.product ?? null,
    })),
  }
}

const ORDER_EMAIL_SELECT = {
  id: true,  // order ID (needed for reorder token)
  orderNumber: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  totalAmount: true,
  // Servicegebühr-Snapshot: für die Mails (Gesamtbetrag) und den Storno-Vermerk
  serviceFeeCents: true,
  serviceFeeRefundedAt: true,
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
      // Einheit nur für die E-Mail-Anzeige gejoint
      product: { select: { unit: true, unitSize: true } },
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

// Ein-Schritt-Rückweg (bestellungen-undo): heilt einen Verdrücker bei
// "Fertig melden". Nur aus READY erlaubt. Der Vorzustand wird nicht
// gespeichert — er lässt sich eindeutig herleiten: online bereits bezahlte
// Bestellungen (paymentStatus PAID) standen vor READY auf PAID, alle anderen
// auf CONFIRMED. (IN_PREPARATION geht dabei bewusst auf CONFIRMED zurück —
// ein harmloser Schritt weiter zurück statt einer gespeicherten Historie.)
export async function revertReady(
  orderId: string,
  notifyCustomer: boolean = true
): Promise<ActionResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  const order = await prisma.order.findFirst({
    where: { id: orderId, farmId: farm.id, status: 'READY' },
    select: ORDER_EMAIL_SELECT,
  })
  if (!order) return { error: 'Bestellung nicht gefunden' }

  const previous: OrderStatus = order.paymentStatus === 'PAID' ? 'PAID' : 'CONFIRMED'

  await prisma.order.update({
    where: { id: orderId },
    data: { status: previous },
  })

  // Kunden-Info nur auf Wunsch (Haken im Dialog, Standard AN): neutrales
  // "Kurzes Update" — relativiert die bereits verschickte Abholbereit-Mail
  if (notifyCustomer) {
    await sendOrderNotReady(toEmailOrder(order, farm))
  }

  revalidatePath('/orders')
  revalidatePath(`/orders/${orderId}`)
  return {}
}

// Ein-Schritt-Rückweg: heilt einen Verdrücker bei "Abgeholt". Nur aus
// PICKED_UP erlaubt, zurück auf READY, pickedUpAt wird geleert.
// paymentStatus/paidAt bleiben UNANGETASTET: die Geld-Wahrheit (z. B. bar
// kassiert bei "Abgeholt & bezahlt") wird von einem Undo nie verändert —
// bewusste Grenze dieses Rückwegs.
export async function revertPickedUp(orderId: string): Promise<ActionResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  const exists = await prisma.order.findFirst({
    where: { id: orderId, farmId: farm.id, status: 'PICKED_UP' },
    select: { id: true },
  })
  if (!exists) return { error: 'Bestellung nicht gefunden' }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'READY', pickedUpAt: null },
  })

  // Keine Mail: der Kunde hatte die Abholbereitschafts-Mail bereits

  revalidatePath('/orders')
  revalidatePath(`/orders/${orderId}`)
  return {}
}

export async function revertOrderStatus(orderId: string, previousStatus: string): Promise<ActionResult> {
  const REVERTABLE = ['PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY']
  if (!REVERTABLE.includes(previousStatus)) return { error: 'Status kann nicht zurückgesetzt werden' }

  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  const exists = await prisma.order.findFirst({
    where: { id: orderId, farmId: farm.id },
    select: { id: true },
  })
  if (!exists) return { error: 'Bestellung nicht gefunden' }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: previousStatus as OrderStatus, pickedUpAt: null, paidAt: null },
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
      // Servicegebühr entfällt auch bei Storno: online steckt sie in der vollen
      // Erstattung oben (Stripe erstattet den ganzen Zahlungsbetrag), bar wurde
      // sie nie kassiert. Der Vermerk hält den Snapshot ehrlich — Admin-Spalte
      // „entfallen" heute, Monatsabrechnung (Sprint 3) später.
      ...(order.serviceFeeCents > 0 && !order.serviceFeeRefundedAt
        ? { serviceFeeRefundedAt: new Date() }
        : {}),
    },
  })

  await sendOrderCancelled(toEmailOrder(order, farm), refundAmount)

  revalidatePath('/orders')
  revalidatePath(`/orders/${orderId}`)
  return {}
}

/**
 * „Nicht abgeholt" (Sprint servicegebuehr, Teil D). Der Status NOT_PICKED_UP
 * existiert seit dem ersten Schema (Enum, Beschriftung, Filter), wurde aber von
 * keinem Codepfad gesetzt (bestellstatus.ts:17–19) — dies ist der erste.
 * Erlaubt aus jedem laufenden Status außer der offenen Kunden-Bestätigung:
 * PAID, CONFIRMED, IN_PREPARATION, READY. Kein Rückweg: Eine Erstattung lässt
 * sich nicht zurücknehmen, deshalb fragt die Oberfläche vorher.
 *
 * WARENPREIS: bleibt exakt wie bisher — und bisher gab es bei Nichtabholung
 * keinerlei Geldbewegung: keine Erstattung (online bleibt der Warenpreis beim
 * Hof, paymentStatus bleibt PAID), keine Bestandsrückbuchung, keine Mail.
 * Dieser Sprint ändert NUR die Gebühr.
 *
 * GEBÜHR: Nicht abgeholte Bestellungen kosten keine Gebühr.
 *   bar    → als entfallen vermerkt (serviceFeeRefundedAt), damit die spätere
 *            Monatsabrechnung sie nicht einzieht.
 *   online → Teilerstattung in Höhe der Gebühr über Stripe, danach der Vermerk.
 *            Ein Fehler beim Erstatten blockiert den Statuswechsel NICHT: Der
 *            Status ist dann gesetzt, die Erstattung steht aus — sichtbar im
 *            Bauern-Bereich (gebuehrErstattungOffen) und im Log.
 */
export async function markAsNotPickedUp(
  orderId: string
): Promise<ActionResult & { gebuehrErstattungOffen?: boolean }> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      farmId: farm.id,
      status: { in: ['PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY'] },
    },
    select: {
      id: true,
      paymentMethod: true,
      paymentStatus: true,
      stripePaymentIntentId: true,
      serviceFeeCents: true,
      serviceFeeRefundedAt: true,
    },
  })
  if (!order) return { error: 'Bestellung nicht gefunden' }

  // 1. Der Statuswechsel ZUERST und für sich — er darf an nichts hängen, was
  //    danach kommt (Stripe, Netz).
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'NOT_PICKED_UP' },
  })

  // 2. Die Gebühr entfällt.
  const gebuehr = await lasseServicegebuehrEntfallen(order)

  revalidatePath('/orders')
  revalidatePath(`/orders/${orderId}`)
  return gebuehr.offen ? { gebuehrErstattungOffen: true } : {}
}

async function lasseServicegebuehrEntfallen(order: {
  id: string
  paymentMethod: string
  paymentStatus: string
  stripePaymentIntentId: string | null
  serviceFeeCents: number
  serviceFeeRefundedAt: Date | null
}): Promise<{ offen: boolean }> {
  // Ohne Gebühr oder bereits entfallen: nichts zu tun (auch bei Wiederholung).
  if (order.serviceFeeCents <= 0 || order.serviceFeeRefundedAt) return { offen: false }

  // Online UND bezahlt: Teilerstattung in Höhe der Gebühr.
  if (order.paymentMethod === 'ONLINE' && order.paymentStatus === 'PAID' && order.stripePaymentIntentId) {
    try {
      await stripe.refunds.create(
        {
          payment_intent: order.stripePaymentIntentId,
          amount: order.serviceFeeCents,
          // LADUNGSTYP destination charge (/api/checkout): Die Erstattung wird
          // vom PLATTFORM-Saldo abgebucht — genau dort liegt die einbehaltene
          // Gebühr. Deshalb bewusst OHNE reverse_transfer (würde anteilig vom
          // Hof zurückholen, der behält 100 % Warenpreis) und OHNE
          // refund_application_fee (das gäbe einen Anteil der Application Fee
          // an den HOF zurück, nicht an die Kundin — der Hof bekäme mehr als
          // den Warenpreis). Die Kundin bekommt die Gebühr, sonst bewegt sich
          // nichts.
          metadata: { orderId: order.id, grund: 'servicegebuehr_nicht_abgeholt' },
        },
        // Idempotenz: Gelingt die Erstattung, scheitert aber das Vermerken,
        // liefert ein zweiter Anlauf DIESELBE Erstattung statt einer zweiten.
        { idempotencyKey: `servicegebuehr-nicht-abgeholt-${order.id}` }
      )
    } catch (err) {
      console.error(
        `[markAsNotPickedUp] Servicegebühr-Erstattung fehlgeschlagen (Bestellung ${order.id}):`,
        err instanceof Error ? err.message : err
      )
      return { offen: true }
    }
  }

  // Bar (oder online nie bezahlt): nichts zu erstatten — nur als entfallen vermerken.
  await prisma.order.update({
    where: { id: order.id },
    data: { serviceFeeRefundedAt: new Date() },
  })
  return { offen: false }
}
