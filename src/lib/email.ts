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
import { OrderNotReadyEmail } from '@/emails/order-not-ready'
import { CustomerMagicLinkEmail } from '@/emails/customer-magic-link'
import { PasswordResetEmail } from '@/emails/password-reset'
import { NewFarmNotificationEmail } from '@/emails/new-farm-notification'
import { FreischaltungEmail } from '@/emails/freischaltung'
import { MeldungNotificationEmail } from '@/emails/meldung-notification'
import { BriefkastenZusammenfassungEmail } from '@/emails/briefkasten-zusammenfassung'
import { SUPPORT_EMAIL } from '@/lib/support'
import { StatusUpdateEmail } from '@/emails/status-update'
import { generateReorderToken } from '@/lib/reorder-token'
import { formatPosition } from '@/lib/format'
import { bestellungPfad } from '@/lib/bestell-link'
import type { OrderLineProduct } from '@/lib/order-line'
import { bestellSummen, centsAlsEuro } from '@/lib/servicegebuehr'

const apiKey = process.env.RESEND_API_KEY
const resend = apiKey ? new Resend(apiKey) : null
const FROM = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// Einmal beim Serverstart loggen damit man im Terminal sieht ob der Key gelesen wurde
console.log(`[E-Mail] Init — RESEND_API_KEY=${apiKey ? 'gesetzt' : 'FEHLT → nur Log-Modus'} FROM=${FROM}`)

// Empfängeradressen sind personenbezogene Daten und haben in den
// Produktions-Logs (Vercel) nichts verloren — lokal bleiben sie sichtbar,
// weil man dort ohne sie nicht debuggen kann.
function logEmpfaenger(to: string): string {
  return process.env.NODE_ENV === 'production' ? '[Empfänger verborgen]' : to
}

async function toHtml(element: React.ReactElement): Promise<string> {
  return render(element)
}

export async function sendRaw(to: string, subject: string, html: string): Promise<{ id?: string; error?: string }> {
  if (!resend) {
    console.log(`[E-Mail] KEIN API-KEY — würde senden: "${subject}" → ${logEmpfaenger(to)}`)
    return { error: 'RESEND_API_KEY nicht gesetzt' }
  }
  console.log(`[E-Mail] Sende: "${subject}" → ${logEmpfaenger(to)} (from: ${FROM})`)
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
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  /** Der WARENPREIS in Euro (Order.totalAmount). */
  totalAmount: { toString(): string } | number
  /** Servicegebühr in Cent aus dem Bestell-Snapshot; fehlt sie, gilt 0. */
  serviceFeeCents?: number
  pickupDate: Date
  pickupTimeStart: string
  pickupTimeEnd: string
  paymentMethod: string
  stripePaymentIntentId?: string | null
  farm: {
    id: string
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
    // Einheit optional zur Anzeige gejoint (formatOrderLine-Schreibweise);
    // fehlt sie, bleibt die Darstellung wie bisher
    product?: OrderLineProduct
  }>
}

/**
 * „Heumilch frisch · 2 × 1 L" — die Positionszeile in DERSELBEN Schreibweise
 * wie Warenkorb, Checkout, Bestätigungsseite und Bauern-Backend
 * (src/lib/format.ts, Bug-Report Befund 13). Vorher stand die Menge in den
 * Vorlagen selbst („2× Name (1 l)"), also in einer fünften Variante.
 * Die Menge steckt jetzt IN der Zeile — die Vorlagen stellen ihr deshalb
 * keine Anzahl mehr voran.
 */
function positionsZeile(i: {
  productName: string
  quantity: number
  product?: OrderLineProduct
}): string {
  return formatPosition({
    name: i.productName,
    quantity: i.quantity,
    unit: i.product?.unit ?? null,
    unitSize: i.product?.unitSize ?? null,
  })
}

function n(v: { toString(): string } | number): number {
  return typeof v === 'number' ? v : Number(v.toString())
}

/**
 * Die drei Beträge einer Bestellung in Euro — aus dem SNAPSHOT der Bestellung
 * (src/lib/servicegebuehr.ts), damit Mail, Bestellseite und Checkout dieselbe
 * Rechnung zeigen: Warenpreis, Servicegebühr, Gesamt (= was die Kundin zahlt).
 */
function betraege(order: OrderForEmail): { warenpreis: number; gebuehr: number; gesamt: number } {
  const s = bestellSummen({ totalAmount: order.totalAmount, serviceFeeCents: order.serviceFeeCents ?? 0 })
  return {
    warenpreis: centsAlsEuro(s.warenpreisCents),
    gebuehr: centsAlsEuro(s.gebuehrCents),
    gesamt: centsAlsEuro(s.gesamtCents),
  }
}

// ─── Send-Funktionen ──────────────────────────────────────────────────────────

/** Magic-Link → Kunde */
export async function sendMagicLinkEmail(email: string, url: string, firstName?: string): Promise<void> {
  const html = await toHtml(React.createElement(CustomerMagicLinkEmail, { firstName, magicUrl: url }))
  await send(email, 'Dein Login-Link für FarmerZone', html)
}

/** Passwort-Reset → Bauer */
export async function sendPasswordResetEmail(email: string, url: string): Promise<void> {
  const html = await toHtml(React.createElement(PasswordResetEmail, { resetUrl: url }))
  await send(email, 'Passwort zurücksetzen · FarmerZone', html)
}

/** Neuer Hof registriert → Betreiber (Freischaltung nötig) */
export async function sendNewFarmNotification(farm: {
  id: string
  name: string
  slug: string
  ownerEmail: string
}): Promise<void> {
  const registeredAt = new Date().toLocaleString('de-AT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const html = await toHtml(
    React.createElement(NewFarmNotificationEmail, {
      farmName: farm.name,
      farmId: farm.id,
      farmSlug: farm.slug,
      ownerEmail: farm.ownerEmail,
      registeredAt,
    })
  )
  await send(SUPPORT_EMAIL, `Neuer Hof wartet auf Freischaltung: ${farm.name}`, html)
}

/**
 * Freischalt-Zusage → Hof-Inhaber.
 *
 * Das Gegenstück zu sendNewFarmNotification: Dort erfährt der Betreiber vom
 * neuen Hof, hier erfährt der Hof von seiner Freischaltung. Alle Wartetexte
 * der App versprechen diese Mail.
 */
export async function sendFreischaltungEmail(farm: {
  name: string
  slug: string
  ownerEmail: string
}): Promise<void> {
  const farmUrl = `${APP_URL}/${farm.slug}`
  const html = await toHtml(React.createElement(FreischaltungEmail, { farmName: farm.name, farmUrl }))
  await send(farm.ownerEmail, 'Dein Hof ist freigeschaltet', html)
}

/**
 * Neue FEHLER-Meldung → Betreiber (Fehlerbriefkasten). NUR bei art FEHLER —
 * Wünsche und Fragen bleiben still (Begründung in actions/meldung.ts).
 */
export async function sendMeldungNotification(m: {
  id: string
  kurznummer: string
  text: string
  seiteUrl: string
  userAgent: string
  viewport: string
  diagKennung: string | null
  farmName: string | null
  screenshotUrl: string | null
  createdAt: Date
}): Promise<void> {
  const html = await toHtml(
    React.createElement(MeldungNotificationEmail, {
      kurznummer: m.kurznummer,
      text: m.text,
      seiteUrl: m.seiteUrl,
      userAgent: m.userAgent,
      viewport: m.viewport,
      diagKennung: m.diagKennung,
      farmName: m.farmName,
      screenshotUrl: m.screenshotUrl,
      createdAt: m.createdAt.toLocaleString('de-AT', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        timeZone: 'Europe/Vienna',
      }),
      adminUrl: `${APP_URL}/admin/meldungen/${m.id}`,
    })
  )
  await send(SUPPORT_EMAIL, `Fehlermeldung ${m.kurznummer}${m.farmName ? ` – ${m.farmName}` : ''}`, html)
}

/** Wochen-Zusammenfassung des Briefkastens → Betreiber (nur bei Bedarf, api/cron/briefkasten). */
export async function sendBriefkastenZusammenfassung(z: {
  neu: number
  liegenGeblieben: number
  offen: number
  neueste: Array<{ kurznummer: string; art: string; ersteZeile: string; hofName: string | null }>
  geloescht: number
}): Promise<void> {
  const html = await toHtml(
    React.createElement(BriefkastenZusammenfassungEmail, { ...z, adminUrl: `${APP_URL}/admin/meldungen` })
  )
  await send(
    SUPPORT_EMAIL,
    `Briefkasten: ${z.neu} neu, ${z.liegenGeblieben} liegen länger als 14 Tage`,
    html
  )
}

/** Online-Zahlung bestätigt → Kunde */
export async function sendOrderConfirmation(order: OrderForEmail): Promise<void> {
  const reorderToken = generateReorderToken(order.id, order.farm.id)
  const reorderUrl = `${APP_URL}/${order.farm.slug}?reorder=${reorderToken}`
  // Der signierte Weg zurück zur Bestellung — der einzige, den die Kundin
  // nach dem Schließen des Tabs noch hat (kein Konto, keine Historie).
  const orderUrl = `${APP_URL}${bestellungPfad(order.farm.slug, order.id)}`

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
      name: positionsZeile(i),
      quantity: i.quantity,
      unitPrice: n(i.unitPrice),
    })),
    subtotal: betraege(order).warenpreis,
    serviceFee: betraege(order).gebuehr,
    total: betraege(order).gesamt,
    manageUrl: `${APP_URL}/account/profile`,
    reorderUrl,
    orderUrl,
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
      name: positionsZeile(i),
      quantity: i.quantity,
      unitPrice: n(i.unitPrice),
    })),
    subtotal: betraege(order).warenpreis,
    serviceFee: betraege(order).gebuehr,
    total: betraege(order).gesamt,
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
    items: order.items.map(i => ({ name: positionsZeile(i), quantity: i.quantity })),
    // Für den Hof zählt der Warenpreis — das ist, was ihm überwiesen wird.
    total: betraege(order).warenpreis,
    serviceFee: betraege(order).gebuehr,
    customerTotal: betraege(order).gesamt,
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
    items: order.items.map(i => ({ name: positionsZeile(i), quantity: i.quantity })),
    // Warenpreis für den Hof; „Bar zu kassieren" ist Warenpreis + Gebühr.
    total: betraege(order).warenpreis,
    serviceFee: betraege(order).gebuehr,
    barZuKassieren: betraege(order).gesamt,
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
  const reorderToken = generateReorderToken(order.id, order.farm.id)
  const reorderUrl = `${APP_URL}/${order.farm.slug}?reorder=${reorderToken}`
  const orderUrl = `${APP_URL}${bestellungPfad(order.farm.slug, order.id)}`

  const html = await toHtml(React.createElement(OrderReadyEmail, {
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    farmName: order.farm.name,
    farmPhone: order.farm.phone,
    farmAddress: order.farm.address,
    farmCity: order.farm.city,
    pickupDate: formatPickupDate(order.pickupDate),
    pickupTime: `${order.pickupTimeStart}–${order.pickupTimeEnd}`,
    reorderUrl,
    orderUrl,
  }))

  await send(
    order.customerEmail,
    `${order.farm.name}: Deine Bestellung ist bereit zur Abholung`,
    html
  )
}

/** Fertig-Rückschritt → Kunde (optional, Haken im Dialog): neutrales Update,
 *  die Abholbereit-Mail war schon draußen und wird hiermit relativiert */
export async function sendOrderNotReady(order: OrderForEmail): Promise<void> {
  const html = await toHtml(React.createElement(OrderNotReadyEmail, {
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
    `Kurzes Update zu deiner Bestellung ${order.orderNumber}`,
    html
  )
}

/** Status-Update → Abonnent */
export async function sendStatusUpdateEmail(opts: {
  to: string
  farmName: string
  farmSlug: string
  title: string
  body: string
  anlass: string
  photoUrl?: string
  unsubscribeUrl: string
}): Promise<void> {
  const html = await toHtml(
    React.createElement(StatusUpdateEmail, {
      farmName: opts.farmName,
      farmSlug: opts.farmSlug,
      title: opts.title,
      body: opts.body,
      anlass: opts.anlass,
      photoUrl: opts.photoUrl,
      unsubscribeUrl: opts.unsubscribeUrl,
      appUrl: APP_URL,
    })
  )
  await send(opts.to, `${opts.farmName}: ${opts.title}`, html)
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
