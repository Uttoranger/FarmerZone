import 'server-only'
import * as React from 'react'
import * as Sentry from '@sentry/nextjs'
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
import { APP_URL, UMGEBUNG } from '@/lib/umgebung-server'
import { ANMELDECODE_GUELTIG_SEKUNDEN } from '@/lib/anmeldecode'
import { BESTAETIGUNG_GUELTIG_SEKUNDEN } from '@/lib/email-bestaetigung'
import { ABO_BESTAETIGUNG_GUELTIG_TAGE } from '@/lib/abo-bestaetigung'
import { env } from '@/lib/env'
import { darfMailEmpfangen, leseTestEmpfaenger, sperrtTrotzProduktion } from '@/lib/testumgebung'
import { abmeldeSeitenPfad, listUnsubscribeKoepfe } from '@/lib/abmelde-link'
import { MARKE, MARKE_TEAM } from '@/lib/marke'
import { WUENSCHE_TEXT, bescheidMailHtml } from '@/lib/meldung'
import { EINGANG_TEXT, POSTFACH_MAIL_TEXT, eingangAdresse, eingangMeldungAdresse, fadenHref, offenSatz, type EingangZahlen } from '@/lib/postfach'
import { ZUSTELLUNG_MAIL_TEXT, bestaetigenPfad } from '@/lib/zustellung'
import { ADMIN_BETRIEB_HREF, betriebMail, fehlerKlasse, type BetriebMailAnlass } from '@/lib/betrieb'
import { empfaengerFingerabdruck } from '@/lib/mail-empfaenger'
import type { MailArt, MailStatus } from '@/schemas/mail-auftrag'

const apiKey = process.env.RESEND_API_KEY
const FROM = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'

// Post-Sperre (Register Z3, Nr. 43): frei nur im Produktions-Deployment bei
// Vercel. Die Liste einmal je Instanz, der Zähler auch — gezählt wird nur, nie
// eine Adresse notiert.
const TEST_EMPFAENGER = leseTestEmpfaenger(env.TEST_EMPFAENGER)
let nichtVerschickt = 0
let sperreTrotzProduktionGemeldet = false

/**
 * Sicherheitsnetz (Nr. 43, Runde 1): Hält sich die App für die Produktion, fehlt
 * aber VERCEL_ENV=production, sperrt die Post fail-closed. Ist das die echte
 * Produktion (Vercel gibt die Systemvariablen nicht frei), verstummte sie sonst
 * still — deshalb einmal je Instanz nach Sentry, fester Satz, ohne Adresse und
 * ohne Betreff. Lokal, in der CI und in Tests ohne DSN ist der Aufruf ein No-op.
 */
function meldeSperreTrotzProduktion(): void {
  if (sperreTrotzProduktionGemeldet || !sperrtTrotzProduktion(UMGEBUNG)) return
  sperreTrotzProduktionGemeldet = true
  try {
    Sentry.captureMessage(
      'Mail nicht verschickt: Die App läuft als Produktion, aber ohne VERCEL_ENV=production — die Post-Sperre (Register Z3) gilt. Systemvariablen bei Vercel freigeben.',
      { level: 'error', tags: { bereich: 'post-sperre' } }
    )
  } catch {
    // Telemetrie scheitert leise — die Sperre selbst gilt weiter.
  }
}

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

/**
 * Ergebnis eines Versands: `id` = verschickt, `error` = gescheitert,
 * `gesperrt` = außerhalb des Produktions-Deployments bei Vercel bewusst nicht
 * verschickt (Empfänger nicht freigegeben, Register Z3). Gesperrt ist kein
 * Fehler — die Aufrufer melden ihn deshalb nicht an Sentry; nur sendRaw selbst
 * meldet die Sperre trotz Produktion, einmal je Instanz.
 */
export type VersandErgebnis = { id?: string; error?: string; gesperrt?: true }

/**
 * Was jede Mail mitbringt (Register N26, Nr. 158): ihre Art (Pflicht — der Typ
 * erzwingt sie, damit jede Mail im Protokoll steht), die Bestellung, zu der sie
 * gehört, und zusätzliche Kopfzeilen — heute nur die Abmelde-Kopfzeilen
 * werblicher Mails (List-Unsubscribe, RFC 8058, Nr. 47).
 */
/**
 * `farmId` und `nochmalVon` nur für das Protokoll (Nr. 167): der Hof für den
 * Filter in „Alle Mails“, die ursprüngliche Mail beim Nochmal-Schicken durch
 * den Support (dann steht die Zeile als „vom Support“).
 */
export type MailOptionen = { art: MailArt; bestellungId?: string; farmId?: string; nochmalVon?: string; headers?: Record<string, string> }

/**
 * Zählt `menge` verschickte Mails für Admin › Betrieb (Register N18, Nr. 103) —
 * die EINE Ausnahme von „email.ts liest nie Prisma" (ARCHITECTURE §4): Der
 * Zähler kommt per `await import()` erst nach dem Versand, email.ts selbst
 * bindet ihn nicht statisch ein. Fail-open: Ein Fehler beim Zählen stoppt nie
 * eine Mail und wirft nie — nach Sentry geht nur die Fehlerklasse unter einem
 * festen Satz, nie Adresse oder Betreff.
 */
async function zaehleVersand(menge = 1): Promise<void> {
  try {
    const { zaehleMail } = await import('@/server/betrieb-zaehler')
    await zaehleMail(new Date(), menge)
  } catch (err) {
    try {
      const meldung = new Error('Betrieb: Mail nicht gezählt')
      meldung.name = fehlerKlasse(err)
      Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'betrieb', grund: 'mail-zaehler' } })
    } catch {
      // Telemetrie scheitert leise — die Mail ist schon hinaus.
    }
  }
}

/**
 * Die Post-Sperre (Register Z3) — die EINE Stelle, die über den Versand
 * entscheidet: `sendRaw` und der Worker der Warteschlange
 * (src/server/mail-warteschlange.ts) fragen beide hier. false = nicht
 * verschicken; gezählt wird nur, nie eine Adresse notiert.
 */
export function postSperreLaesstDurch(to: string): boolean {
  if (darfMailEmpfangen(to, UMGEBUNG, TEST_EMPFAENGER)) return true
  nichtVerschickt += 1
  // Hier stehen weder Adresse noch Betreff im Log: Beide können eine Person
  // nennen, und die Testumgebung schreibt in die Vercel-Logs.
  console.log(
    `[E-Mail] Nicht verschickt: Empfänger steht nicht in TEST_EMPFAENGER (außerhalb des Produktions-Deployments). Bisher ${nichtVerschickt} in dieser Instanz.`
  )
  meldeSperreTrotzProduktion()
  return false
}

/** Ob ein Schlüssel für Resend da ist — ohne ihn verschickt nichts (Vorschau, lokal). */
export function hatResendSchluessel(): boolean {
  return Boolean(apiKey)
}

/**
 * Der kurze Fehlercode einer Antwort von Resend (`name`, z. B.
 * `rate_limit_exceeded`) — nie deren Nachricht, die eine Adresse tragen kann.
 */
function resendFehlerCode(fehler: { name?: unknown }): string {
  return typeof fehler.name === 'string' && /^[a-z_]{1,60}$/.test(fehler.name) ? fehler.name : 'unbekannt'
}

/**
 * Jede direkte Mail als Zeile im Protokoll (Register N26, Nr. 158; vorrang 0)
 * — per `await import()` wie der Zähler, damit email.ts selbst nie Prisma
 * bindet. Fail-open: Scheitert das Protokoll, ist die Mail trotzdem hinaus
 * (CLAUDE.md §2); nach Sentry geht nur die Fehlerklasse unter festem Satz.
 */
async function protokolliere(
  to: string,
  optionen: MailOptionen,
  ergebnis: { status: Extract<MailStatus, 'gesendet' | 'gescheitert' | 'gesperrt' | 'ohne_schluessel'>; resendId?: string; fehlerCode?: string }
): Promise<void> {
  try {
    const { protokolliereSofortMail } = await import('@/server/mail-warteschlange')
    await protokolliereSofortMail({
      art: optionen.art,
      bestellungId: optionen.bestellungId,
      farmId: optionen.farmId,
      nochmalVon: optionen.nochmalVon,
      empfaengerHash: empfaengerFingerabdruck(to),
      ...ergebnis,
    })
  } catch (err) {
    try {
      const meldung = new Error('Mail-Protokoll: Zeile nicht geschrieben')
      meldung.name = fehlerKlasse(err)
      Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'mail-protokoll', art: optionen.art } })
    } catch {
      // Telemetrie scheitert leise — die Mail ist schon entschieden.
    }
  }
}

export async function sendRaw(to: string, subject: string, html: string, optionen: MailOptionen): Promise<VersandErgebnis> {
  if (!apiKey) {
    console.log(`[E-Mail] KEIN API-KEY — würde senden: "${subject}" → ${logEmpfaenger(to)}`)
    await protokolliere(to, optionen, { status: 'ohne_schluessel' })
    return { error: 'RESEND_API_KEY nicht gesetzt' }
  }
  // Nach dem Log-Modus, damit lokal ohne Schlüssel alles bleibt, wie es war.
  if (!postSperreLaesstDurch(to)) {
    await protokolliere(to, optionen, { status: 'gesperrt' })
    return { gesperrt: true }
  }
  console.log(`[E-Mail] Sende: "${subject}" → ${logEmpfaenger(to)} (from: ${FROM})`)
  let ergebnis: VersandErgebnis
  try {
    // Im try: Scheitert schon das Laden des SDK, bleibt es beim { error } — sendRaw wirft nie.
    const resend = await resendClient(apiKey)
    const result = await resend.emails.send({ from: FROM, to, subject, html, ...(optionen.headers ? { headers: optionen.headers } : {}) })
    if (result.error) {
      console.error(`[E-Mail] Resend-Fehler: ${JSON.stringify(result.error)}`)
      await protokolliere(to, optionen, { status: 'gescheitert', fehlerCode: resendFehlerCode(result.error) })
      return { error: JSON.stringify(result.error) }
    }
    console.log(`[E-Mail] ✓ Gesendet, ID: ${result.data?.id}`)
    await zaehleVersand()
    ergebnis = { id: result.data?.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[E-Mail] Exception: ${msg}`)
    await protokolliere(to, optionen, { status: 'gescheitert', fehlerCode: 'ausnahme' })
    return { error: msg }
  }
  await protokolliere(to, optionen, { status: 'gesendet', resendId: ergebnis.id })
  return ergebnis
}

/** Eine fertige Mail für den Stapelversand des Workers — die Adresse lebt nur im Speicher, nie in der Tabelle. */
export type StapelMail = { an: string; betreff: string; html: string; headers?: Record<string, string> }

/**
 * Ergebnis eines Stapels: `ok` mit einer Resend-ID je Mail in derselben
 * Reihenfolge, sonst Status und kurzer Code (429/5xx/null = später nochmal).
 */
export type StapelErgebnis = { ok: true; ids: string[] } | { ok: false; statusCode: number | null; code: string }

/**
 * Bis zu 100 Mails in EINER Anfrage an Resend (`batch.send`, Nr. 158) — nur
 * für den Worker der Warteschlange, der vorher die Post-Sperre über
 * `postSperreLaesstDurch` geprüft hat. `batch.send` nimmt je Mail dieselben
 * Felder wie `emails.send` ohne Anhänge und ohne Termin, also auch `headers`;
 * der Idempotenz-Schlüssel gilt für die ganze Anfrage. Strikte Prüfung (alles
 * oder nichts): So gehört die n-te ID sicher zur n-ten Mail. Gezählt werden
 * die angenommenen Mails in EINEM Schritt. Wirft nie.
 */
export async function versendeStapel(mails: readonly StapelMail[], idempotenzSchluessel: string): Promise<StapelErgebnis> {
  if (!apiKey) return { ok: false, statusCode: null, code: 'ohne_schluessel' }
  try {
    const resend = await resendClient(apiKey)
    const result = await resend.batch.send(
      mails.map((m) => ({ from: FROM, to: m.an, subject: m.betreff, html: m.html, ...(m.headers ? { headers: m.headers } : {}) })),
      { idempotencyKey: idempotenzSchluessel }
    )
    if (result.error) {
      console.error(`[E-Mail] Resend-Fehler im Stapel: ${resendFehlerCode(result.error)} (${result.error.statusCode ?? 'ohne Status'})`)
      return { ok: false, statusCode: result.error.statusCode, code: resendFehlerCode(result.error) }
    }
    const ids = result.data.data.map((d) => d.id)
    console.log(`[E-Mail] ✓ Stapel gesendet: ${ids.length} Mails`)
    // Ein Schritt für den ganzen Stapel (Nr. 170) statt einer Anweisung je Mail.
    if (ids.length > 0) await zaehleVersand(ids.length)
    return { ok: true, ids }
  } catch (err) {
    console.error(`[E-Mail] Exception im Stapel: ${fehlerKlasse(err)}`)
    return { ok: false, statusCode: null, code: 'ausnahme' }
  }
}

async function send(to: string, subject: string, html: string, optionen: MailOptionen): Promise<void> {
  await sendRaw(to, subject, html, optionen)
}

/** Wie viele Mails einer Liste hinausgingen und wie viele scheiterten (gesperrt zählt nicht als gescheitert, Z3). */
export type ListenErgebnis = { gesendet: number; gescheitert: number }

/**
 * Die Warn-Mail des Betriebs an jede Adresse der Empfängerliste — seit Nr. 159
 * der einzige Aufrufer: Warn-Mails gehen direkt, nicht über die Warteschlange
 * (N18-Ergänzung), damit eine hängende Warteschlange sie nicht mitnimmt. Alle
 * anderen Betreiber-Mails stellt der Aufrufer je Adresse ein
 * (src/server/mail-arten/betreiber.ts). Nacheinander, jede über sendRaw mit der
 * Post-Sperre (Z3); ein Fehler bei einer Adresse hält die übrigen nicht auf.
 * Eine leere Liste heißt: keine Mail.
 */
async function sendeAnListe(an: readonly string[], subject: string, html: string, art: MailArt): Promise<ListenErgebnis> {
  const ergebnis: ListenErgebnis = { gesendet: 0, gescheitert: 0 }
  for (const adresse of an) {
    const versand = await sendRaw(adresse, subject, html, { art })
    if (versand.error) ergebnis.gescheitert += 1
    else if (versand.id) ergebnis.gesendet += 1
  }
  return ergebnis
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
  await send(email, `Dein Login-Link für ${MARKE}`, html, { art: 'login-link' })
}

/**
 * Anmeldecode → Kundin (E7). Der Betreff trägt den Code NICHT: sendRaw
 * schreibt den Betreff auch in Produktion ins Log, und der Sperrbildschirm
 * zeigt ihn jedem, der danebensteht. Gibt das Versandergebnis zurück — ohne
 * ID (kein Schlüssel, Resend-Fehler) schreibt auth.ts den Code lokal ins Log.
 */
export async function sendAnmeldeCodeEmail(email: string, code: string): Promise<VersandErgebnis> {
  const minuten = ANMELDECODE_GUELTIG_SEKUNDEN / 60
  const vorlage = await htmlOderFehler(async () => {
    const { AnmeldecodeEmail } = await import('@/emails/anmeldecode')
    return React.createElement(AnmeldecodeEmail, { code, minuten })
  })
  if (!vorlage.ok) return { error: vorlage.error }
  return sendRaw(email, `Dein Anmeldecode für ${MARKE}`, vorlage.html, { art: 'anmeldecode' })
}

/**
 * Code für „Bestellungen finden" (Nr. 14) → wer seine Bestellungen sehen will.
 * Dieselbe Vorlage wie der Anmeldecode, eigener Text; Betreff und Vorschau
 * ohne Code (Begründung wie oben). Gibt das Versandergebnis zurück.
 */
export async function sendBestellCodeEmail(email: string, code: string): Promise<VersandErgebnis> {
  const minuten = ANMELDECODE_GUELTIG_SEKUNDEN / 60
  const vorlage = await htmlOderFehler(async () => {
    const { AnmeldecodeEmail } = await import('@/emails/anmeldecode')
    return React.createElement(AnmeldecodeEmail, { code, minuten, zweck: 'bestellungen' })
  })
  if (!vorlage.ok) return { error: vorlage.error }
  return sendRaw(email, `Dein Code für deine Bestellungen · ${MARKE}`, vorlage.html, { art: 'bestellcode' })
}

/**
 * „Bestätige deine E-Mail" → neuer Hof (S3, Nachtlauf Nr. 17b). `url` ist die
 * volle Adresse von /verify mit dem signierten Token. Der Betreff trägt
 * keinen Link; gibt das Versandergebnis zurück (sendRaw wirft nie).
 */
export async function sendEmailBestaetigung(email: string, url: string): Promise<VersandErgebnis> {
  const vorlage = await htmlOderFehler(async () => {
    const { EmailBestaetigungEmail } = await import('@/emails/email-bestaetigung')
    return React.createElement(EmailBestaetigungEmail, { url, stunden: BESTAETIGUNG_GUELTIG_SEKUNDEN / 3600 })
  })
  if (!vorlage.ok) return { error: vorlage.error }
  return sendRaw(email, `Bestätige deine E-Mail-Adresse · ${MARKE}`, vorlage.html, { art: 'email-bestaetigung' })
}

/**
 * „Bitte bestätige deine Anmeldung" → wer sich für Neuigkeiten eines Hofes
 * angemeldet hat (Double-Opt-in, S11, Nr. 38). Keine werbliche Mail, deshalb
 * ohne Abmeldelink. Wichtig (Nr. 159): Den Link baut der Renderer beim
 * Versand frisch aus Abo und Anfragezeitpunkt (src/server/mail-arten/abo.ts),
 * in der Warteschlange steht er nie.
 */
export async function baueAboBestaetigung(email: string, daten: { hofName: string; url: string }): Promise<StapelMail> {
  const { AboBestaetigungEmail } = await import('@/emails/abo-bestaetigung')
  const html = await toHtml(React.createElement(AboBestaetigungEmail, { ...daten, tage: ABO_BESTAETIGUNG_GUELTIG_TAGE }))
  return { an: email, betreff: `Bitte bestätige deine Anmeldung · ${MARKE}`, html }
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
): Promise<VersandErgebnis> {
  // Vorlage erst beim Versand laden: Seitenmodule, die email.ts einbinden,
  // sollen sie nicht mitziehen (Nachtlauf Nr. 31, „schwere Module nur bei Bedarf").
  const { RegistrierungHinweisEmail } = await import('@/emails/registrierung-hinweis')
  const html = await toHtml(React.createElement(RegistrierungHinweisEmail, ziele))
  return sendRaw(email, `Jemand wollte sich mit deiner Adresse registrieren · ${MARKE}`, html, { art: 'registrierungs-hinweis' })
}

/** Passwort-Reset → Bauer */
export async function sendPasswordResetEmail(email: string, url: string): Promise<void> {
  const { PasswordResetEmail } = await import('@/emails/password-reset')
  const html = await toHtml(React.createElement(PasswordResetEmail, { resetUrl: url }))
  await send(email, `Passwort zurücksetzen · ${MARKE}`, html, { art: 'passwort-link' })
}

/**
 * „Zu viele falsche Codes" bzw. „… Passwörter" → das Konto hinter der Adresse
 * (Register E7, Ergänzung; Nr. 112). Ohne Code und ohne Link; Betreff und
 * Texte aus src/lib/anmeldecode.ts, die Pause mit Tag und Uhrzeit. Gibt das
 * Versandergebnis zurück (sendRaw wirft nie).
 */
export async function sendZuVieleVersucheEmail(
  email: string,
  art: import('@/lib/anmeldecode').FehlversuchArt,
  bis: Date
): Promise<VersandErgebnis> {
  // Dynamisch statt in der Importzeile oben: email.ts teilen sich mehrere Nummern eines Laufs.
  const { ZU_VIELE_VERSUCHE_MAIL } = await import('@/lib/anmeldecode')
  const vorlage = await htmlOderFehler(async () => {
    const { ZuVieleVersucheEmail } = await import('@/emails/zu-viele-versuche')
    return React.createElement(ZuVieleVersucheEmail, { art, bis: zeitpunktFuerMail(bis) })
  })
  if (!vorlage.ok) return { error: vorlage.error }
  return sendRaw(email, `${ZU_VIELE_VERSUCHE_MAIL[art].betreff} · ${MARKE}`, vorlage.html, { art: 'zu-viele-versuche' })
}

/**
 * „Neue Anmeldung bei deinem Hof-Konto" → Hof- bzw. Admin-Konto, das sich auf
 * einem neuen Gerät angemeldet hat (Register E7, Ergänzung; Nr. 114). `link`
 * trägt einen Einmal-Token — er steht nur in der Mail, nie im Betreff und nie
 * im Log (sendRaw schreibt ohne Schlüssel nur Betreff und Empfänger). Gibt das
 * Versandergebnis zurück (sendRaw wirft nie).
 */
export async function sendNeueAnmeldungEmail(
  email: string,
  daten: { hof: boolean; name: string | null; geraet: string; zeitpunkt: Date; link: string }
): Promise<VersandErgebnis> {
  // Dynamisch statt in der Importzeile oben: email.ts teilen sich mehrere Nummern eines Laufs.
  const { NEUE_ANMELDUNG_MAIL, anmeldeZeitpunkt } = await import('@/lib/geraete')
  const vorlage = await htmlOderFehler(async () => {
    const { NeueAnmeldungEmail } = await import('@/emails/neue-anmeldung')
    const { zeitpunkt, ...rest } = daten
    return React.createElement(NeueAnmeldungEmail, { ...rest, wann: anmeldeZeitpunkt(zeitpunkt) })
  })
  if (!vorlage.ok) return { error: vorlage.error }
  return sendRaw(email, `${NEUE_ANMELDUNG_MAIL.betreff(daten.hof)} · ${MARKE}`, vorlage.html, { art: 'neue-anmeldung' })
}

/**
 * „Admin-Sicherheit" → das eigene Admin-Konto (Register N20; Nr. 115): Passkey
 * hinzugefügt oder entfernt, Ersatzcode benutzt (mit Gerät und Uhrzeit) und
 * der E-Mail-Code der Einrichtung. Ohne Link zum Anmelden; der Code steht nie
 * im Betreff (sendRaw schreibt ohne Schlüssel nur Betreff und Empfänger ins
 * Log). Gibt das Versandergebnis zurück (sendRaw wirft nie).
 */
export async function sendAdminSicherheitEmail(
  email: string,
  anlass: import('@/lib/admin-anmeldung').AdminSicherheitAnlass,
  daten: { geraet: string; zeitpunkt: Date; code?: string }
): Promise<VersandErgebnis> {
  // Dynamisch statt in der Importzeile oben: email.ts teilen sich mehrere Nummern eines Laufs.
  const { ADMIN_SICHERHEIT_MAIL } = await import('@/lib/admin-anmeldung')
  const { anmeldeZeitpunkt } = await import('@/lib/geraete')
  const vorlage = await htmlOderFehler(async () => {
    const { AdminSicherheitEmail } = await import('@/emails/admin-sicherheit')
    return React.createElement(AdminSicherheitEmail, { anlass, geraet: daten.geraet, wann: anmeldeZeitpunkt(daten.zeitpunkt), code: daten.code })
  })
  if (!vorlage.ok) return { error: vorlage.error }
  return sendRaw(email, `${ADMIN_SICHERHEIT_MAIL.betreff[anlass]} · ${MARKE}`, vorlage.html, { art: 'admin-sicherheit' })
}

/** Neuer Hof registriert → EINE Betreiber-Adresse (Freischaltung nötig); die Adressen aus empfaengerFuer('hofWartet'), je Adresse ein Auftrag. */
export async function baueNewFarmNotification(
  farm: {
    id: string
    name: string
    slug: string
    ownerEmail: string
    createdAt: Date
  },
  an: string
): Promise<StapelMail> {
  const registeredAt = farm.createdAt.toLocaleString('de-AT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Vienna',
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
  return { an, betreff: `Neuer Hof wartet auf Freischaltung: ${farm.name}`, html }
}

/**
 * Freischalt-Zusage → Hof-Inhaber.
 *
 * Das Gegenstück zu sendNewFarmNotification: Dort erfährt der Betreiber vom
 * neuen Hof, hier erfährt der Hof von seiner Freischaltung. Alle Wartetexte
 * der App versprechen diese Mail.
 */
export async function baueFreischaltungEmail(farm: {
  name: string
  slug: string
  ownerEmail: string
}): Promise<StapelMail> {
  const farmUrl = `${APP_URL}/${farm.slug}`
  const { FreischaltungEmail } = await import('@/emails/freischaltung')
  const html = await toHtml(React.createElement(FreischaltungEmail, { farmName: farm.name, farmUrl }))
  return { an: farm.ownerEmail, betreff: 'Dein Hof ist freigeschaltet', html }
}

/**
 * Neue FEHLER-Meldung → EINE Betreiber-Adresse (Fehlerbriefkasten). NUR bei
 * art FEHLER — Wünsche und Fragen bleiben im Eingang (Register N14); die
 * Adressen aus empfaengerFuer('fehlermeldung'), je Adresse ein Auftrag.
 */
export async function baueMeldungNotification(
  m: {
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
  },
  an: string
): Promise<StapelMail> {
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
      adminUrl: `${APP_URL}${eingangMeldungAdresse(m.id)}`,
    })
  )
  return { an, betreff: `Fehlermeldung ${m.kurznummer}${m.farmName ? ` – ${m.farmName}` : ''}`, html }
}

/**
 * Wochen-Zusammenfassung → EINE Betreiber-Adresse (nur wenn im Eingang etwas
 * offen ist, api/cron/briefkasten); die Adressen aus
 * empfaengerFuer('wochenbericht'), je Adresse ein Auftrag. Die Zeile
 * „Offen im Eingang" kommt aus derselben Zählung und demselben Satz wie die
 * Kennzahl im Eingang (offenSatz); der Meldungsteil bleibt darunter.
 */
export async function baueBriefkastenZusammenfassung(
  z: {
    neu: number
    liegenGeblieben: number
    offen: number
    neueste: Array<{ kurznummer: string; art: string; ersteZeile: string; hofName: string | null }>
    geloescht: number
    eingang: EingangZahlen
  },
  an: string
): Promise<StapelMail> {
  const { eingang, ...meldungen } = z
  const { BriefkastenZusammenfassungEmail } = await import('@/emails/briefkasten-zusammenfassung')
  const html = await toHtml(
    React.createElement(BriefkastenZusammenfassungEmail, {
      ...meldungen,
      offenZeile: `${EINGANG_TEXT.offenTitel}: ${offenSatz(eingang)}`,
      adminUrl: `${APP_URL}${eingangAdresse('offen')}`,
    })
  )
  return { an, betreff: ZUSTELLUNG_MAIL_TEXT.wochenberichtBetreff(offenSatz(eingang)), html }
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
 * Erstattung offen → EINE Betreiber-Adresse (Nr. 19c): ein Storno, dessen
 * Erstattung scheiterte, oder eine Erstattung, die Stripe später als
 * gescheitert meldet. Erstatten kann nur das Plattformkonto; der Hof bekommt
 * nur „Wir kümmern uns um die Erstattung und melden uns." Die Adressen aus
 * empfaengerFuer('erstattungOffen') — diese Art ignoriert „aus" und hat immer
 * mindestens SUPPORT_EMAIL; je Adresse ein Auftrag.
 */
export async function baueErstattungOffen(m: ErstattungOffenMeldung, an: string): Promise<StapelMail> {
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
  // Derselbe Betreff, auf den die Aufgabe im Eingang verweist (EINGANG_TEXT.erstattungMail).
  return { an, betreff: EINGANG_TEXT.erstattungKopf(m.bestellnummer ?? m.stripeKennung ?? 'unbekannt'), html }
}

/**
 * Bestellung steht → Kunde: nach der Online-Zahlung (Webhook) und nach der
 * Bar-Bestätigung per Knopf. Satz und Gesamtzeile folgen der Zahlart — eine
 * bar bestätigte Bestellung ist nicht „bezahlt". Ohne „Nochmal bestellen"
 * (Vertragsmail ohne Werbung, S11; Mockup web-k3-e-mails-web-mobil).
 */
export async function baueOrderConfirmation(order: OrderForEmail): Promise<StapelMail> {
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

  return { an: order.customerEmail, betreff: `Deine Bestellung bei ${order.farm.name} – Abholung ${formatPickupDate(order.pickupDate)}`, html }
}

/**
 * Die Mail mit dem Bestätigungslink — nur gebaut. `sendOnsiteConfirmation`
 * verschickt sie; die Vorschau in Admin › Betrieb (Nr. 167) baut sie mit
 * einem Platzhalter statt Token und macht den Link unkenntlich.
 */
export async function onsiteConfirmationInhalt(
  order: OrderForEmail,
  confirmationToken: string
): Promise<StapelMail> {
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

  return { an: order.customerEmail, betreff: `Bitte bestätige deine Bestellung bei ${order.farm.name}`, html }
}

/**
 * Vor-Ort-Zahlung: Bestätigungslink → Kunde (Sofort). `protokoll.nochmalVon`
 * nur beim Nochmal-Schicken durch den Support (Nr. 167) — die Zeile steht dann
 * als „vom Support“ mit Verweis auf die ursprüngliche Mail.
 */
export async function sendOnsiteConfirmation(
  order: OrderForEmail,
  confirmationToken: string,
  protokoll: { nochmalVon?: string } = {}
): Promise<void> {
  const mail = await onsiteConfirmationInhalt(order, confirmationToken)
  await send(mail.an, mail.betreff, mail.html, {
    art: 'bar-bestaetigungslink',
    bestellungId: order.id,
    farmId: order.farm.id,
    ...(protokoll.nochmalVon ? { nochmalVon: protokoll.nochmalVon } : {}),
  })
}

/** Online-Zahlung → Bauer */
export async function baueOrderPaidToFarmer(order: OrderForEmail): Promise<StapelMail> {
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

  return { an: order.farm.email, betreff: `Neue Bestellung für ${formatPickupDate(order.pickupDate)} – ${order.orderNumber}`, html }
}

/** Vor-Ort bestätigt → Bauer */
export async function baueOrderConfirmedToFarmer(order: OrderForEmail): Promise<StapelMail> {
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

  return {
    an: order.farm.email,
    betreff: `Neue Vor-Ort-Bestellung für ${formatPickupDate(order.pickupDate)} – ${order.orderNumber} (${paymentLabel})`,
    html,
  }
}

/** Bauer markiert als bereit → Kunde */
export async function baueOrderReady(order: OrderForEmail): Promise<StapelMail> {
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

  return { an: order.customerEmail, betreff: `${order.farm.name}: Deine Bestellung ist bereit zur Abholung`, html }
}

/** Fertig-Rückschritt → Kunde (optional, Haken im Dialog): neutrales Update,
 *  die Abholbereit-Mail war schon draußen und wird hiermit relativiert */
export async function baueOrderNotReady(order: OrderForEmail): Promise<StapelMail> {
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

  return { an: order.customerEmail, betreff: `Kurzes Update zu deiner Bestellung ${order.orderNumber}`, html }
}

/** Was eine Beitragsmail braucht — gemeinsam für den Versand heute und den Renderer der Warteschlange (Nr. 158). */
export type BeitragMailDaten = {
  to: string
  farmName: string
  farmSlug: string
  title: string
  body: string
  anlass: string
  photoUrl?: string
  /** Der Beitrag, auf den der Knopf führt (`?beitrag=<id>`, Register T5) — nur, wenn er auf der Hofseite steht. */
  beitragId?: string
  /** Signierter Abmelde-Token (generateUnsubscribeToken) — ohne Ablauf. */
  abmeldeToken: string
}

/**
 * Status-Update → Abonnent — die werbliche Mail (S11). Aus dem signierten
 * Abmelde-Token entstehen beide Wege hinaus: der Link im Text (Seite mit dem
 * Knopf) und seit Nr. 47 die Kopfzeilen List-Unsubscribe und
 * List-Unsubscribe-Post, mit denen das Mailprogramm selbst „Abmelden"
 * anbietet (Ein-Klick, RFC 8058). Keine Transaktionsmail trägt sie.
 *
 * Seit Nr. 159 nur noch über die Warteschlange (Kann warten): Der Renderer
 * `beitrag` (src/server/mail-arten/beitrag.ts) baut sie je Abo.
 */
export async function baueBeitragMail(opts: BeitragMailDaten): Promise<StapelMail> {
  const { StatusUpdateEmail } = await import('@/emails/status-update')
  const html = await toHtml(
    React.createElement(StatusUpdateEmail, {
      farmName: opts.farmName,
      farmSlug: opts.farmSlug,
      title: opts.title,
      body: opts.body,
      anlass: opts.anlass,
      photoUrl: opts.photoUrl,
      beitragId: opts.beitragId,
      unsubscribeUrl: `${APP_URL}${abmeldeSeitenPfad(opts.abmeldeToken)}`,
      appUrl: APP_URL,
    })
  )
  return { an: opts.to, betreff: `${opts.farmName}: ${opts.title}`, html, headers: listUnsubscribeKoepfe(APP_URL, opts.abmeldeToken) }
}

/** Storno → Kunde; `erstattetCents` nur, wenn online erstattet wurde (sonst null). */
export async function baueOrderCancelled(
  order: OrderForEmail,
  erstattetCents: number | null,
  /** Der Grund aus dem Storno-Dialog (Nr. 19) — Text des Hofs, React escaped ihn. */
  cancelReason?: string | null
): Promise<StapelMail> {
  const { OrderCancelledEmail } = await import('@/emails/order-cancelled')
  const html = await toHtml(React.createElement(OrderCancelledEmail, {
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    farmName: order.farm.name,
    total: n(order.totalAmount),
    refundAmount: erstattetCents === null ? null : centsAlsEuro(erstattetCents),
    cancelReason: cancelReason ?? undefined,
  }))

  return { an: order.customerEmail, betreff: `Deine Bestellung ${order.orderNumber} wurde storniert`, html }
}

/**
 * „Artikel fehlt" → Kunde (E14, Nr. 19): sofort nach dem Speichern, damit die
 * Kundin den neuen Betrag kennt, bevor sie losfährt. Beträge kommen fertig
 * gerechnet in Cent (src/lib/artikel-fehlt.ts), die Vorlage formatiert nur.
 */
export async function baueArtikelFehlt(
  order: OrderForEmail,
  fehlt: {
    position: OrderForEmail['items'][number]
    zahlung: 'online' | 'vor_ort'
    bisherCents: number
    neuCents: number
    erstattetCents: number | null
  }
): Promise<StapelMail> {
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

  return { an: order.customerEmail, betreff: `Ein Artikel fehlt in deiner Bestellung ${order.orderNumber}`, html }
}

/** Zahlung nach dem Storno eingegangen und sofort voll erstattet → Kunde */
export async function baueZahlungZuSpaet(
  order: Pick<OrderForEmail, 'customerName' | 'customerEmail' | 'orderNumber'> & {
    farm: Pick<OrderForEmail['farm'], 'name'>
  },
  erstattetCents: number
): Promise<StapelMail> {
  const { ZahlungZuSpaetEmail } = await import('@/emails/zahlung-zu-spaet')
  const html = await toHtml(React.createElement(ZahlungZuSpaetEmail, {
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    farmName: order.farm.name,
    erstattet: centsAlsEuro(erstattetCents),
    supportEmail: SUPPORT_EMAIL,
  }))

  return { an: order.customerEmail, betreff: 'Deine Zahlung kam zu spät – das Geld ist zurück', html }
}

/** Vor-Ort-Bestellung nicht rechtzeitig bestätigt, Ware freigegeben → Kunde */
export async function baueBestellungVerfallen(
  order: Pick<OrderForEmail, 'customerName' | 'customerEmail' | 'orderNumber'> & {
    farm: Pick<OrderForEmail['farm'], 'name'>
  }
): Promise<StapelMail> {
  const { BestellungVerfallenEmail } = await import('@/emails/bestellung-verfallen')
  const html = await toHtml(React.createElement(BestellungVerfallenEmail, {
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    farmName: order.farm.name,
  }))

  return { an: order.customerEmail, betreff: 'Deine Bestellung ist verfallen, weil sie nicht bestätigt wurde', html }
}

/**
 * Postfach (Register N12, Nr. 87): eine Nachricht vom Team an einen Hof per
 * E-Mail — ein Rundschreiben mit dem Haken „Betriebsmitteilung" (Kann
 * warten) oder eine Antwort des Teams im Faden (Wichtig; höchstens eine je
 * Faden und Stunde, das entscheidet die Action). Nie bei Antworten des Hofs.
 * Links der Nachricht sind Wege in der App (appPfadAusLink) und bekommen hier
 * den eigenen Ursprung. Seit Nr. 159 über die Warteschlange: Text und Link
 * lädt der Renderer frisch aus der Nachricht (src/server/mail-arten/postfach.ts).
 */
export async function bauePostfachMail(m: {
  art: 'rundschreiben' | 'antwort'
  an: string
  titel: string
  text: string
  link: string | null
  unterhaltungId: string
}): Promise<StapelMail> {
  const props = {
    titel: m.titel,
    text: m.text,
    linkUrl: m.link ? `${APP_URL}${m.link}` : null,
    fadenUrl: `${APP_URL}${fadenHref(m.unterhaltungId)}`,
  }
  let element: React.ReactElement
  if (m.art === 'rundschreiben') {
    const { PostfachRundschreibenEmail } = await import('@/emails/postfach-rundschreiben')
    element = React.createElement(PostfachRundschreibenEmail, props)
  } else {
    const { PostfachAntwortEmail } = await import('@/emails/postfach-antwort')
    element = React.createElement(PostfachAntwortEmail, props)
  }
  const betreff = m.art === 'rundschreiben' ? m.titel : POSTFACH_MAIL_TEXT.antwortBetreff(m.titel)
  return { an: m.an, betreff, html: await toHtml(element) }
}

/**
 * Bescheid an eine Kundin, die einen Wunsch gemeldet hat (Register N14,
 * Nr. 105) — Kann warten, je Meldung ein Auftrag (Nr. 159). Text und Team-Name
 * baut `bescheidMailHtml` (src/lib/meldung.ts); die Antwort lädt der Renderer
 * frisch aus der Meldung.
 */
export async function baueBescheidMail(an: string, antwort: string): Promise<StapelMail> {
  return { an, betreff: WUENSCHE_TEXT.bescheidTitel, html: bescheidMailHtml(antwort, MARKE_TEAM) }
}

/**
 * „Bitte bestätige deine Adresse" → eine weitere Adresse der Zustellung
 * (Register N14, Nr. 95; Double-Opt-in nach dem Muster sendAboBestaetigung).
 * Der Link öffnet nur die Seite, bestätigt wird dort per Knopf — Link-Scanner
 * öffnen Links ungefragt. Gibt das Versandergebnis zurück (sendRaw wirft nie).
 */
export async function sendBetreiberBestaetigung(email: string, token: string): Promise<VersandErgebnis> {
  const vorlage = await htmlOderFehler(async () => {
    const { BetreiberBestaetigungEmail } = await import('@/emails/betreiber-bestaetigung')
    return React.createElement(BetreiberBestaetigungEmail, { url: `${APP_URL}${bestaetigenPfad(token)}` })
  })
  if (!vorlage.ok) return { error: vorlage.error }
  return sendRaw(email, ZUSTELLUNG_MAIL_TEXT.bestaetigungBetreff, vorlage.html, { art: 'betreiber-bestaetigung' })
}

/**
 * Ein Hof hat im Faden geantwortet → EINE Adresse der Empfängerliste (Regel
 * „Antwort eines Hofs: sofort", Register N14; je Adresse ein Auftrag, Nr. 159).
 * Hofname und Text sind Fremdtext — React escaped sie; nur an bestätigte
 * Adressen (aus empfaengerFuer).
 */
export async function baueHofAntwortAnTeam(
  an: string,
  m: { hofName: string; titel: string; text: string; unterhaltungId: string }
): Promise<StapelMail> {
  const { BetreiberAntwortEmail } = await import('@/emails/betreiber-antwort')
  const html = await toHtml(
    React.createElement(BetreiberAntwortEmail, {
      hofName: m.hofName,
      titel: m.titel,
      text: m.text,
      url: `${APP_URL}${eingangAdresse('antwort', { art: 'antwort', id: m.unterhaltungId })}`,
    })
  )
  return { an, betreff: ZUSTELLUNG_MAIL_TEXT.antwortBetreff(m.hofName, m.titel), html }
}

/** „Testmail an alle senden" (Postfach › Zustellung) → EINE Adresse der Liste (je Adresse ein Auftrag). */
export async function baueBetreiberTestmail(an: string): Promise<StapelMail> {
  const { BetreiberTestmailEmail } = await import('@/emails/betreiber-testmail')
  const html = await toHtml(React.createElement(BetreiberTestmailEmail, { url: `${APP_URL}${eingangAdresse('offen')}` }))
  return { an, betreff: ZUSTELLUNG_MAIL_TEXT.testBetreff, html }
}

/**
 * Warn-Mail von Admin › Betrieb (Register N18, Nr. 103; Mockup
 * email-betrieb-warnung) an die Empfänger der Art „Betrieb“ — fest an, `an`
 * aus `ladeBetreiberEmpfaenger('betrieb')`. Betreff und Sätze baut die reine
 * `betriebMail`; nur Zahlen und Namen aus festen Listen, keine Personendaten.
 * Sie selbst löst keine Prüfung aus (nur der Zähler in sendRaw zählt sie mit).
 */
export async function sendBetriebWarnung(anlass: BetriebMailAnlass, an: readonly string[]): Promise<ListenErgebnis> {
  if (an.length === 0) return { gesendet: 0, gescheitert: 0 }
  const mail = betriebMail(anlass)
  const vorlage = await htmlOderFehler(async () => {
    const { BetriebWarnungEmail } = await import('@/emails/betrieb-warnung')
    return React.createElement(BetriebWarnungEmail, { mail, url: `${APP_URL}${ADMIN_BETRIEB_HREF}` })
  })
  if (!vorlage.ok) return { gesendet: 0, gescheitert: an.length }
  return sendeAnListe(an, mail.betreff, vorlage.html, 'betrieb-warnung')
}
