import 'server-only'
import * as React from 'react'
import type { Resend } from 'resend'
import { SUPPORT_EMAIL } from '@/lib/support'
import { generateReorderToken } from '@/lib/reorder-token'
import { formatEuro, formatPosition } from '@/lib/format'
import { barBestaetigungsPfad, bestellungPfad } from '@/lib/bestell-link'
import type { OrderLineProduct } from '@/lib/order-line'
import { barOhneServicegebuehr, bestellSummen, centsAlsEuro } from '@/lib/servicegebuehr'
import { alsCents, calcLineTotal, decimalZuCents } from '@/lib/order-totals'
import { fristVon, zeitpunktFuerMail } from '@/lib/fristen'
import { buildMapsUrl } from '@/lib/customer-links'
import type { MailZahlart } from '@/emails/order-confirmation'
import { APP_URL } from '@/lib/umgebung-server'
import { ANMELDECODE_GUELTIG_SEKUNDEN } from '@/lib/anmeldecode'
import { BESTAETIGUNG_GUELTIG_SEKUNDEN } from '@/lib/email-bestaetigung'

const apiKey = process.env.RESEND_API_KEY
const FROM = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'

/*
 * Schwere Module erst beim Versand (Nachtlauf Nr. 31, ARCHITECTURE §4): Das
 * Resend-SDK, @react-email/render und jede Vorlage kommen per `await import()`
 * in der Versandfunktion — so lädt ein Kaltstart, der keine Mail schickt,
 * nichts davon. Vorher stand hier ein Log beim Laden des Moduls, das bei
 * jedem Kaltstart im Hofbereich erschien; ob der Schlüssel fehlt, sagt jetzt
 * sendRaw bei jedem Versand (Log-Modus unten).
 */
let resendInstanz: Resend | null = null

async function resendClient(schluessel: string): Promise<Resend> {
  if (!resendInstanz) {
    const { Resend } = await import('resend')
    resendInstanz = new Resend(schluessel)
  }
  return resendInstanz
}

// Empfängeradressen sind personenbezogene Daten und haben in den
// Produktions-Logs (Vercel) nichts verloren — lokal bleiben sie sichtbar,
// weil man dort ohne sie nicht debuggen kann.
function logEmpfaenger(to: string): string {
  return process.env.NODE_ENV === 'production' ? '[Empfänger verborgen]' : to
}

async function toHtml(element: React.ReactElement): Promise<string> {
  const { render } = await import('@react-email/render')
  return render(element)
}

/**
 * Für die Versandfunktionen, die ein Ergebnis liefern statt zu werfen
 * (Anmeldecode, Code für „Bestellungen finden", E-Mail bestätigen): Laden und
 * Rendern der Vorlage im selben Fehlerweg wie der Versand — seit die Vorlage
 * dynamisch kommt (Nr. 31), könnte schon das Laden scheitern. Dann
 * `{ error }` wie bei einem Resend-Fehler; auth.ts schreibt den Code lokal ins Log.
 */
async function htmlOderFehler(
  baue: () => Promise<React.ReactElement>
): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  try {
    return { ok: true, html: await toHtml(await baue()) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[E-Mail] Vorlage nicht erzeugt: ${msg}`)
    return { ok: false, error: msg }
  }
}

export async function sendRaw(to: string, subject: string, html: string): Promise<{ id?: string; error?: string }> {
  if (!apiKey) {
    console.log(`[E-Mail] KEIN API-KEY — würde senden: "${subject}" → ${logEmpfaenger(to)}`)
    return { error: 'RESEND_API_KEY nicht gesetzt' }
  }
  console.log(`[E-Mail] Sende: "${subject}" → ${logEmpfaenger(to)} (from: ${FROM})`)
  try {
    // Im try: Scheitert schon das Laden des SDK, bleibt es beim { error } — sendRaw wirft nie.
    const resend = await resendClient(apiKey)
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
  // Wiener Kalendertag, nie die Zeitzone des Servers (CODING_STANDARDS §2).
  return date.toLocaleDateString('de-AT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Vienna',
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
  /** Bestellzeitpunkt — für die Frist in „Bitte bestätige" (fristVon); fehlt er, bleibt der allgemeine Satz. */
  createdAt?: Date
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
 * Der Zeilenbetrag einer Position in Euro, NUR zur Anzeige über formatEuro —
 * gerechnet über Decimal und Cent (CODING_STANDARDS §2), nie `Preis × Menge`
 * in Fließkomma: Der Snapshot `totalPrice`, sonst `calcLineTotal`.
 */
function zeilenBetrag(i: OrderForEmail['items'][number]): number {
  const cents = i.totalPrice != null ? alsCents(i.totalPrice) : decimalZuCents(calcLineTotal(i.unitPrice, i.quantity))
  return centsAlsEuro(cents)
}

/** Positionen für die Kunden-Mails: Zeile in der gemeinsamen Schreibweise, Betrag fertig gerechnet. */
function mailPositionen(order: OrderForEmail): Array<{ name: string; betrag: number }> {
  return order.items.map((i) => ({ name: positionsZeile(i), betrag: zeilenBetrag(i) }))
}

/** Online, bar oder (alte Bestellungen, E5) Karte vor Ort — für Satz und Gesamtzeile der Mail. */
function mailZahlart(paymentMethod: string): MailZahlart {
  if (paymentMethod === 'ONLINE') return 'online'
  return paymentMethod === 'ONSITE_CARD' ? 'karte' : 'bar'
}

function routeUrl(order: OrderForEmail): string {
  return buildMapsUrl(order.farm.address, order.farm.postalCode, order.farm.city)
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
  const { CustomerMagicLinkEmail } = await import('@/emails/customer-magic-link')
  const html = await toHtml(React.createElement(CustomerMagicLinkEmail, { firstName, magicUrl: url }))
  await send(email, 'Dein Login-Link für FarmerZone', html)
}

/**
 * Anmeldecode → Kundin (E7). Der Betreff trägt den Code NICHT: sendRaw
 * schreibt den Betreff auch in Produktion ins Log, und der Sperrbildschirm
 * zeigt ihn jedem, der danebensteht. Gibt das Versandergebnis zurück — ohne
 * ID (kein Schlüssel, Resend-Fehler) schreibt auth.ts den Code lokal ins Log.
 */
export async function sendAnmeldeCodeEmail(email: string, code: string): Promise<{ id?: string; error?: string }> {
  const minuten = ANMELDECODE_GUELTIG_SEKUNDEN / 60
  const vorlage = await htmlOderFehler(async () => {
    const { AnmeldecodeEmail } = await import('@/emails/anmeldecode')
    return React.createElement(AnmeldecodeEmail, { code, minuten })
  })
  if (!vorlage.ok) return { error: vorlage.error }
  return sendRaw(email, 'Dein Anmeldecode für FarmerZone', vorlage.html)
}

/**
 * Code für „Bestellungen finden" (Nr. 14) → wer seine Bestellungen sehen will.
 * Dieselbe Vorlage wie der Anmeldecode, eigener Text; Betreff und Vorschau
 * ohne Code (Begründung wie oben). Gibt das Versandergebnis zurück.
 */
export async function sendBestellCodeEmail(email: string, code: string): Promise<{ id?: string; error?: string }> {
  const minuten = ANMELDECODE_GUELTIG_SEKUNDEN / 60
  const vorlage = await htmlOderFehler(async () => {
    const { AnmeldecodeEmail } = await import('@/emails/anmeldecode')
    return React.createElement(AnmeldecodeEmail, { code, minuten, zweck: 'bestellungen' })
  })
  if (!vorlage.ok) return { error: vorlage.error }
  return sendRaw(email, 'Dein Code für deine Bestellungen · FarmerZone', vorlage.html)
}

/**
 * „Bestätige deine E-Mail" → neuer Hof (S3, Nachtlauf Nr. 17b). `url` ist die
 * volle Adresse von /verify mit dem signierten Token. Der Betreff trägt
 * keinen Link; gibt das Versandergebnis zurück (sendRaw wirft nie).
 */
export async function sendEmailBestaetigung(email: string, url: string): Promise<{ id?: string; error?: string }> {
  const vorlage = await htmlOderFehler(async () => {
    const { EmailBestaetigungEmail } = await import('@/emails/email-bestaetigung')
    return React.createElement(EmailBestaetigungEmail, { url, stunden: BESTAETIGUNG_GUELTIG_SEKUNDEN / 3600 })
  })
  if (!vorlage.ok) return { error: vorlage.error }
  return sendRaw(email, 'Bestätige deine E-Mail-Adresse · FarmerZone', vorlage.html)
}

/**
 * Hinweis an ein bestehendes Konto: Jemand wollte sich mit seiner Adresse
 * registrieren (Register F6 „19b", Nachtlauf Nr. 27). Der Betreff nennt die
 * Adresse nicht. Gibt wie sendRaw `{ error }` zurück statt zu werfen — der
 * Aufrufer meldet es ohne Adresse an Sentry.
 */
export async function sendRegistrierungsHinweis(
  email: string,
  ziele: { weg: 'passwort' | 'code'; anmelden: string; passwortZuruecksetzen: string | null }
): Promise<{ id?: string; error?: string }> {
  // Vorlage erst beim Versand laden: Seitenmodule, die email.ts einbinden,
  // sollen sie nicht mitziehen (Nachtlauf Nr. 31, „schwere Module nur bei Bedarf").
  const { RegistrierungHinweisEmail } = await import('@/emails/registrierung-hinweis')
  const html = await toHtml(React.createElement(RegistrierungHinweisEmail, ziele))
  return sendRaw(email, 'Jemand wollte sich mit deiner Adresse registrieren · FarmerZone', html)
}

/** Passwort-Reset → Bauer */
export async function sendPasswordResetEmail(email: string, url: string): Promise<void> {
  const { PasswordResetEmail } = await import('@/emails/password-reset')
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
  const { NewFarmNotificationEmail } = await import('@/emails/new-farm-notification')
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
  const { FreischaltungEmail } = await import('@/emails/freischaltung')
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
  const { MeldungNotificationEmail } = await import('@/emails/meldung-notification')
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
  const { BriefkastenZusammenfassungEmail } = await import('@/emails/briefkasten-zusammenfassung')
  const html = await toHtml(
    React.createElement(BriefkastenZusammenfassungEmail, { ...z, adminUrl: `${APP_URL}/admin/meldungen` })
  )
  await send(
    SUPPORT_EMAIL,
    `Briefkasten: ${z.neu} neu, ${z.liegenGeblieben} liegen länger als 14 Tage`,
    html
  )
}

/** Was der Betreiber über offenes Geld erfährt — ohne Daten der Kundin. */
export type ErstattungOffenMeldung = {
  /** Was passiert ist — ein Satz. */
  was: string
  bestellId: string | null
  bestellnummer: string | null
  hofName: string | null
  betraege: Array<{ label: string; cents: number }>
  /** Was von Hand zu tun ist — dieselbe Anweisung wie an Sentry. */
  handanweisung: string
  /** Kennung der Erstattung bei Stripe (re_…), falls bekannt. */
  stripeKennung: string | null
}

/**
 * Erstattung offen → Betreiber (Nr. 19c): ein Storno, dessen Erstattung
 * scheiterte, oder eine Erstattung, die Stripe später als gescheitert meldet.
 * Erstatten kann nur das Plattformkonto; der Hof bekommt nur „Wir kümmern uns
 * um die Erstattung und melden uns."
 */
export async function sendErstattungOffen(m: ErstattungOffenMeldung): Promise<void> {
  const { ErstattungOffenEmail } = await import('@/emails/erstattung-offen')
  const html = await toHtml(
    React.createElement(ErstattungOffenEmail, {
      was: m.was,
      bestellnummer: m.bestellnummer,
      bestellId: m.bestellId,
      hofName: m.hofName,
      betraege: m.betraege.map((b) => ({ label: b.label, wert: formatEuro(centsAlsEuro(b.cents)) })),
      handanweisung: m.handanweisung,
      stripeKennung: m.stripeKennung,
    })
  )
  await send(SUPPORT_EMAIL, `Erstattung offen – Bestellung ${m.bestellnummer ?? m.stripeKennung ?? 'unbekannt'}`, html)
}

/**
 * Bestellung steht → Kunde: nach der Online-Zahlung (Webhook) und nach der
 * Bar-Bestätigung per Knopf. Satz und Gesamtzeile folgen der Zahlart — eine
 * bar bestätigte Bestellung ist nicht „bezahlt". Ohne „Nochmal bestellen"
 * (Vertragsmail ohne Werbung, S11; Mockup web-k3-e-mails-web-mobil).
 */
export async function sendOrderConfirmation(order: OrderForEmail): Promise<void> {
  // Der signierte Weg zurück zur Bestellung — der einzige, den die Kundin
  // nach dem Schließen des Tabs noch hat (kein Konto, keine Historie).
  const orderUrl = `${APP_URL}${bestellungPfad(order.farm.slug, order.id)}`

  const { OrderConfirmationEmail } = await import('@/emails/order-confirmation')
  const html = await toHtml(React.createElement(OrderConfirmationEmail, {
    orderNumber: order.orderNumber,
    farmName: order.farm.name,
    farmPhone: order.farm.phone,
    farmAddress: order.farm.address,
    farmCity: order.farm.city,
    pickupDate: formatPickupDate(order.pickupDate),
    pickupTime: `${order.pickupTimeStart}–${order.pickupTimeEnd}`,
    zahlart: mailZahlart(order.paymentMethod),
    items: mailPositionen(order),
    serviceFee: betraege(order).gebuehr,
    total: betraege(order).gesamt,
    routeUrl: routeUrl(order),
    manageUrl: `${APP_URL}/account/profile`,
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
  // Zur Seite mit dem Knopf (H3) — der Link selbst bestätigt nichts, damit
  // Link-Scanner der Mailprogramme keine Bestellung auslösen.
  const confirmationUrl = `${APP_URL}${barBestaetigungsPfad(order.farm.slug, confirmationToken)}`
  // Die Frist, nach der die Bestellung verfällt — dieselbe Rechnung wie
  // verwaiste-bestellungen.ts und die Bestätigungsseite (fristen.ts). Als
  // fester Tag, nie „heute"/„morgen": Wer die Mail nach Mitternacht öffnet,
  // läse sonst den falschen Tag.
  const frist = order.createdAt
    ? fristVon({
        // Vor Ort, nie online: Diese Mail gibt es nur für Barbestellungen.
        paymentMethod: 'ONSITE_CASH',
        createdAt: order.createdAt,
        pickupDate: order.pickupDate,
        pickupTimeStart: order.pickupTimeStart,
      })
    : null

  const { OnsiteConfirmationEmail } = await import('@/emails/onsite-confirmation')
  const html = await toHtml(React.createElement(OnsiteConfirmationEmail, {
    orderNumber: order.orderNumber,
    farmName: order.farm.name,
    farmAddress: order.farm.address,
    farmCity: order.farm.city,
    pickupDate: formatPickupDate(order.pickupDate),
    pickupTime: `${order.pickupTimeStart}–${order.pickupTimeEnd}`,
    items: mailPositionen(order),
    serviceFee: betraege(order).gebuehr,
    total: betraege(order).gesamt,
    confirmationUrl,
    bestaetigenBis: frist ? zeitpunktFuerMail(frist) : undefined,
  }))

  await send(
    order.customerEmail,
    `Bitte bestätige deine Bestellung bei ${order.farm.name}`,
    html
  )
}

/** Online-Zahlung → Bauer */
export async function sendOrderPaidToFarmer(order: OrderForEmail): Promise<void> {
  const { NewOrderNotificationEmail } = await import('@/emails/new-order-notification')
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

  const { OrderConfirmedEmail } = await import('@/emails/order-confirmed')
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
    // B1 nach dem BESTELLzeitpunkt, nicht nach dem Versand. Ohne Zeitpunkt der
    // bisherige Satz — lieber kein Hinweis als ein falscher.
    barOhneGebuehr: order.paymentMethod === 'ONSITE_CASH' && order.createdAt ? barOhneServicegebuehr('ONSITE_CASH', order.createdAt) : false,
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

  const { OrderReadyEmail } = await import('@/emails/pickup-reminder')
  const html = await toHtml(React.createElement(OrderReadyEmail, {
    orderNumber: order.orderNumber,
    farmName: order.farm.name,
    farmPhone: order.farm.phone,
    farmAddress: order.farm.address,
    farmCity: order.farm.city,
    pickupDate: formatPickupDate(order.pickupDate),
    pickupTime: `${order.pickupTimeStart}–${order.pickupTimeEnd}`,
    routeUrl: routeUrl(order),
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
  const { OrderNotReadyEmail } = await import('@/emails/order-not-ready')
  const html = await toHtml(React.createElement(OrderNotReadyEmail, {
    orderNumber: order.orderNumber,
    farmName: order.farm.name,
    farmPhone: order.farm.phone,
    farmAddress: order.farm.address,
    farmCity: order.farm.city,
    pickupDate: formatPickupDate(order.pickupDate),
    pickupTime: `${order.pickupTimeStart}–${order.pickupTimeEnd}`,
    routeUrl: routeUrl(order),
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
  const { StatusUpdateEmail } = await import('@/emails/status-update')
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
  refundAmount: number | null,
  /** Der Grund aus dem Storno-Dialog (Nr. 19) — Text des Hofs, React escaped ihn. */
  cancelReason?: string | null
): Promise<void> {
  const { OrderCancelledEmail } = await import('@/emails/order-cancelled')
  const html = await toHtml(React.createElement(OrderCancelledEmail, {
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    farmName: order.farm.name,
    total: n(order.totalAmount),
    refundAmount,
    cancelReason: cancelReason ?? undefined,
  }))

  await send(
    order.customerEmail,
    `Deine Bestellung ${order.orderNumber} wurde storniert`,
    html
  )
}

/**
 * „Artikel fehlt" → Kunde (E14, Nr. 19): sofort nach dem Speichern, damit die
 * Kundin den neuen Betrag kennt, bevor sie losfährt. Beträge kommen fertig
 * gerechnet in Cent (src/lib/artikel-fehlt.ts), die Vorlage formatiert nur.
 */
export async function sendArtikelFehlt(
  order: OrderForEmail,
  fehlt: {
    position: OrderForEmail['items'][number]
    zahlung: 'online' | 'vor_ort'
    bisherCents: number
    neuCents: number
    erstattetCents: number | null
  }
): Promise<void> {
  const { ArtikelFehltEmail } = await import('@/emails/artikel-fehlt')
  const html = await toHtml(React.createElement(ArtikelFehltEmail, {
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    farmName: order.farm.name,
    farmPhone: order.farm.phone,
    artikel: positionsZeile(fehlt.position),
    pickupDate: formatPickupDate(order.pickupDate),
    pickupTime: `${order.pickupTimeStart}–${order.pickupTimeEnd}`,
    zahlung: fehlt.zahlung,
    bisher: centsAlsEuro(fehlt.bisherCents),
    neu: centsAlsEuro(fehlt.neuCents),
    erstattet: fehlt.erstattetCents === null ? null : centsAlsEuro(fehlt.erstattetCents),
    orderUrl: `${APP_URL}${bestellungPfad(order.farm.slug, order.id)}`,
  }))

  await send(order.customerEmail, `Ein Artikel fehlt in deiner Bestellung ${order.orderNumber}`, html)
}

/** Zahlung nach dem Storno eingegangen und sofort voll erstattet → Kunde */
export async function sendZahlungZuSpaet(
  order: Pick<OrderForEmail, 'customerName' | 'customerEmail' | 'orderNumber'> & {
    farm: Pick<OrderForEmail['farm'], 'name'>
  },
  erstattetCents: number
): Promise<void> {
  const { ZahlungZuSpaetEmail } = await import('@/emails/zahlung-zu-spaet')
  const html = await toHtml(React.createElement(ZahlungZuSpaetEmail, {
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    farmName: order.farm.name,
    erstattet: centsAlsEuro(erstattetCents),
    supportEmail: SUPPORT_EMAIL,
  }))

  await send(order.customerEmail, 'Deine Zahlung kam zu spät – das Geld ist zurück', html)
}

/** Vor-Ort-Bestellung nicht rechtzeitig bestätigt, Ware freigegeben → Kunde */
export async function sendBestellungVerfallen(
  order: Pick<OrderForEmail, 'customerName' | 'customerEmail' | 'orderNumber'> & {
    farm: Pick<OrderForEmail['farm'], 'name'>
  }
): Promise<void> {
  const { BestellungVerfallenEmail } = await import('@/emails/bestellung-verfallen')
  const html = await toHtml(React.createElement(BestellungVerfallenEmail, {
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    farmName: order.farm.name,
  }))

  await send(order.customerEmail, 'Deine Bestellung ist verfallen, weil sie nicht bestätigt wurde', html)
}
