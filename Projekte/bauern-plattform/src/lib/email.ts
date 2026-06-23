import 'server-only'
import * as React from 'react'
import { render } from '@react-email/render'
import { Resend } from 'resend'
import { OrderConfirmationEmail } from '@/emails/order-confirmation'
import { OnsiteConfirmationEmail } from '@/emails/onsite-confirmation'
import { NewOrderNotificationEmail } from '@/emails/new-order-notification'
import { OrderConfirmedEmail } from '@/emails/order-confirmed'
import { OrderReadyEmail } from '@/emails/pickup-reminder'
import { OrderCancelledEmail } from '@/emails/order-cancelled'
import { CustomerMagicLinkEmail } from '@/emails/customer-magic-link'

const apiKey = process.env.RESEND_API_KEY
const resend = apiKey ? new Resend(apiKey) : null
const FROM = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// Einmal beim Serverstart loggen damit man im Terminal sieht ob der Key gelesen wurde
console.log(`[E-Mail] Init — RESEND_API_KEY=${apiKey ? `gesetzt (${apiKey.slice(0, 8)}…)` : 'FEHLT → nur Log-Modus'} FROM=${FROM}`)

async function toHtml(element: React.ReactElement): Promise<string> {
  return render(element)
}

export async function sendRaw(to: string, subject: string, html: string): Promise<{ id?: string; error?: string }> {
  if (!resend) {
    console.log(`[E-Mail] KEIN API-KEY — würde senden: "${subject}" → ${to}`)
    return { error: 'RESEND_API_KEY nicht gesetzt' }
  }
  console.log(`[E-Mail] Sende: "${subject}" → ${to} (from: ${FROM})`)
  try {
    const result = await resend.emails.send({ from: FROM, to, subject, html })
    if (result.error) {
      console.error(`[E-Mail] Resend-Fehler: ${JSON.stringify(result.error)}`)
      return { error: JSON.stringify(result.error) }
    }
    console.log(`[E-Mail] ✓ Gesendet, ID: ${result.data?.id}`)
    return { id: result.data?.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[E-Mail] Exception: ${msg}`)
    return { error: msg }
  }
}

async function send(to: string, subject: string, html: string): Promise<void> {
  await sendRaw(to, subject, html)
}

function formatPickupDate(date: Date): string {
  return date.toLocaleDateString('de-AT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ─── Typen ────────────────────────────────────────────────────────────────────

export type OrderForEmail = {
  orderNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  totalAmount: { toString(): string } | number
  pickupDate: Date
  pickupTimeStart: string
  pickupTimeEnd: string
  paymentMethod: string
  stripePaymentIntentId?: string | null
  farm: {
    name: string
    email: string
    ownerName: string
    address: string
    city: string
    postalCode: string
    phone: string
    slug: string
  }
  items: Array<{
    productName: string
    quantity: number
    unitPrice: { toString(): string } | number
    totalPrice?: { toString(): string } | number
  }>
}

function n(v: { toString(): string } | number): number {
  return typeof v === 'number' ? v : Number(v.toString())
}

// ─── Send-Funktionen ──────────────────────────────────────────────────────────

/** Magic-Link → Kunde */
export async function sendMagicLinkEmail(email: string, url: string, firstName?: string): Promise<void> {
  const html = await toHtml(React.createElement(CustomerMagicLinkEmail, { firstName, magicUrl: url }))
  await send(email, 'Dein Login-Link für FarmerZone', html)
}

/** Online-Zahlung bestätigt → Kunde */
export async function sendOrderConfirmation(order: OrderForEmail): Promise<void> {
  const html = await toHtml(React.createElement(OrderConfirmationEmail, {
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    farmName: order.farm.name,
    farmPhone: order.farm.phone,
    farmAddress: order.farm.address,
    farmCity: order.farm.city,
    pickupDate: formatPickupDate(order.pickupDate),
    pickupTime: `${order.pickupTimeStart}–${order.pickupTimeEnd}`,
    items: order.items.map(i => ({
      name: i.productName,
      quantity: i.quantity,
      unitPrice: n(i.unitPrice),
    })),
    total: n(order.totalAmount),
    manageUrl: `${APP_URL}/account/profile`,
  }))

  await send(
    order.customerEmail,
    `Deine Bestellung bei ${order.farm.name} – Abholung ${formatPickupDate(order.pickupDate)}`,
    html
  )
}

/** Vor-Ort-Zahlung: Bestätigungslink → Kunde */
export async function sendOnsiteConfirmation(
  order: OrderForEmail,
  confirmationToken: string
): Promise<void> {
  const confirmationUrl = `${APP_URL}/api/orders/confirm/${confirmationToken}`

  const html = await toHtml(React.createElement(OnsiteConfirmationEmail, {
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    farmName: order.farm.name,
    farmAddress: order.farm.address,
    farmCity: order.farm.city,
    pickupDate: formatPickupDate(order.pickupDate),
    pickupTime: `${order.pickupTimeStart}–${order.pickupTimeEnd}`,
    items: order.items.map(i => ({
      name: i.productName,
      quantity: i.quantity,
      unitPrice: n(i.unitPrice),
    })),
    total: n(order.totalAmount),
    confirmationUrl,
  }))

  await send(
    order.customerEmail,
    `Bitte bestätige deine Bestellung bei ${order.farm.name}`,
    html
  )
}

/** Online-Zahlung → Bauer */
export async function sendOrderPaidToFarmer(order: OrderForEmail): Promise<void> {
  const html = await toHtml(React.createElement(NewOrderNotificationEmail, {
    farmerName: order.farm.ownerName,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    orderNumber: order.orderNumber,
    pickupDate: formatPickupDate(order.pickupDate),
    pickupTime: `${order.pickupTimeStart}–${order.pickupTimeEnd}`,
    items: order.items.map(i => ({ name: i.productName, quantity: i.quantity })),
    total: n(order.totalAmount),
    paymentLabel: 'Online (bereits bezahlt)',
    isOnline: true,
    dashboardUrl: `${APP_URL}/orders`,
  }))

  await send(
    order.farm.email,
    `Neue Bestellung für ${formatPickupDate(order.pickupDate)} – ${order.orderNumber}`,
    html
  )
}

/** Vor-Ort bestätigt → Bauer */
export async function sendOrderConfirmedToFarmer(order: OrderForEmail): Promise<void> {
  const paymentLabel =
    order.paymentMethod === 'ONSITE_CASH' ? 'Bar bei Abholung' : 'Karte bei Abholung'

  const html = await toHtml(React.createElement(OrderConfirmedEmail, {
    farmerName: order.farm.ownerName,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    orderNumber: order.orderNumber,
    pickupDate: formatPickupDate(order.pickupDate),
    pickupTime: `${order.pickupTimeStart}–${order.pickupTimeEnd}`,
    items: order.items.map(i => ({ name: i.productName, quantity: i.quantity })),
    total: n(order.totalAmount),
    dashboardUrl: `${APP_URL}/orders`,
  }))

  await send(
    order.farm.email,
    `Neue Vor-Ort-Bestellung für ${formatPickupDate(order.pickupDate)} – ${order.orderNumber} (${paymentLabel})`,
    html
  )
}

/** Bauer markiert als bereit → Kunde */
export async function sendOrderReady(order: OrderForEmail): Promise<void> {
  const html = await toHtml(React.createElement(OrderReadyEmail, {
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    farmName: order.farm.name,
    farmPhone: order.farm.phone,
    farmAddress: order.farm.address,
    farmCity: order.farm.city,
    pickupDate: formatPickupDate(order.pickupDate),
    pickupTime: `${order.pickupTimeStart}–${order.pickupTimeEnd}`,
  }))

  await send(
    order.customerEmail,
    `${order.farm.name}: Deine Bestellung ist bereit zur Abholung`,
    html
  )
}

/** Storno → Kunde */
export async function sendOrderCancelled(
  order: OrderForEmail,
  refundAmount: number | null
): Promise<void> {
  const html = await toHtml(React.createElement(OrderCancelledEmail, {
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    farmName: order.farm.name,
    total: n(order.totalAmount),
    refundAmount,
  }))

  await send(
    order.customerEmail,
    `Deine Bestellung ${order.orderNumber} wurde storniert`,
    html
  )
}
