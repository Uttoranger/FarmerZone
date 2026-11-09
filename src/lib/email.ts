import 'server-only'
import * as React from 'react'
import * as Sentry from '@sentry/nextjs'
import type { Resend } from 'resend'
import { SUPPORT_EMAIL } from '@/lib/support'
import { formatEuro, formatPosition } from '@/lib/format'
import { barBestaetigungsPfad, bestellungPfad, widerrufPfad } from '@/lib/bestell-link'
import type { OrderLineProduct } from '@/lib/order-line'
import { abspracheMailSatz, brauchtAbsprache } from '@/lib/abholhinweise'
import { SERVICEGEBUEHR_BEZEICHNUNG, anzeigeGesamtCents, barOhneServicegebuehr, barZuKassierenCents, bestellSummen, centsAlsEuro, gebuehrEntfallen, gebuehrEntfallenVermerk } from '@/lib/servicegebuehr'
import { gebuehrHinweisFuer, hofpreisModellAb, istHofpreisBestellung } from '@/lib/plattformgebuehr'
import { hofpreisEinstellungAus } from '@/lib/plattform-einstellung'
import { AGB_BISHER, type AgbKennung } from '@/lib/rechtstexte/agb-fassung'
import { agbFassungMitMeldung } from '@/lib/rechtstexte/agb-fassung-melden'
import { PLATTFORMGEBUEHR_BEZEICHNUNG } from '@/lib/konditionen'
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
import { MARKE } from '@/lib/marke'
import { WUENSCHE_TEXT } from '@/lib/meldung'
import { EINGANG_TEXT, POSTFACH_MAIL_TEXT, eingangAdresse, eingangMeldungAdresse, fadenHref, offenSatz, type EingangZahlen } from '@/lib/postfach'
import { ZUSTELLUNG_MAIL_TEXT, bestaetigenPfad } from '@/lib/zustellung'
import { ADMIN_BETRIEB_HREF, betriebMail, fehlerKlasse, type BetriebMailAnlass } from '@/lib/betrieb'
import { empfaengerFingerabdruck } from '@/lib/mail-empfaenger'
import { hofEmailFehlt, hofKontaktEmail, type HofKontakt } from '@/lib/hof-kontakt'
import { belehrungHof, belehrungMitHof, belehrungMitKostenschaetzung, type Belehrung } from '@/lib/widerruf'
import { ruecksendekostenSchaetzungEuro } from '@/lib/ruecktritt-angaben'
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
 * Betreff und HTML einer Mail, ohne Empfänger — was eine Inhalts-Funktion
 * (`<art>Inhalt`, Nr. 270) liefert. Die `send…`-Funktion ruft sie und dann
 * sendRaw; die Beispiele in Admin › Betrieb › Mails rufen nur sie.
 */
export type MailInhalt = { betreff: string; html: string }

/**
 * Laden oder Rendern der Vorlage ist in einer Inhalts-Funktion gescheitert
 * (Nr. 270) — trägt die Nachricht des ursprünglichen Fehlers. Nur dieser
 * Fehler wird in `inhaltOderFehler` zu `{ error }`; alles davor (etwa das
 * Laden der Texte) wirft wie vor Nr. 270 weiter.
 */
class VorlageFehler extends Error {
  constructor(nachricht: string) {
    super(nachricht)
    this.name = 'VorlageFehler'
  }
}

/** Die Vorlage einer Inhalts-Funktion rendern. Loggt nie — das tut der Versand (`inhaltOderFehler`). */
async function vorlageHtml(baue: () => Promise<React.ReactElement>): Promise<string> {
  try {
    return await toHtml(await baue())
  } catch (err) {
    throw new VorlageFehler(err instanceof Error ? err.message : String(err))
  }
}

/**
 * Für die Versandfunktionen, die ein Ergebnis liefern statt zu werfen
 * (Anmeldecode, Code für „Bestellungen finden", E-Mail bestätigen): Laden und
 * Rendern der Vorlage im selben Fehlerweg wie der Versand — seit die Vorlage
 * dynamisch kommt (Nr. 31), könnte schon das Laden scheitern. Dann
 * `{ error }` wie bei einem Resend-Fehler; auth.ts schreibt den Code lokal ins Log.
 * Seit Nr. 270 um die Inhalts-Funktion gelegt: Nur ein Fehler der Vorlage
 * wird zu `{ error }`, jeder andere wirft wie vorher. Derselbe Satz im Log
 * wie `htmlOderFehler` (der Rücktrittseingang, ohne Inhalts-Funktion davor).
 */
async function inhaltOderFehler(baue: () => Promise<MailInhalt>): Promise<({ ok: true } & MailInhalt) | { ok: false; error: string }> {
  try {
    return { ok: true, ...(await baue()) }
  } catch (err) {
    if (!(err instanceof VorlageFehler)) throw err
    console.error(`[E-Mail] Vorlage nicht erzeugt: ${err.message}`)
    return { ok: false, error: err.message }
  }
}

/** Wie `inhaltOderFehler`, nur um die Vorlage allein — für den Rücktrittseingang (Nr. 200), der seine Inhalts-Funktion schon hat. */
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
export type MailOptionen = {
  art: MailArt
  bestellungId?: string
  farmId?: string
  nochmalVon?: string
  headers?: Record<string, string>
  /** Dateien im Anhang (Nr. 207: die AGB) — nie Text der Kundin. */
  anhaenge?: readonly MailAnhang[]
  /** „Antwort an“ (V86): nur die Hof-E-Mail aus dem Profil, nur bei Bestellmails an die Kundin — siehe `antwortAnHof`. */
  antwortAn?: string
}

/**
 * Eine Datei im Anhang (Nr. 207): Name und Inhalt als Text (UTF-8). Heute nur
 * die AGB aus agb-datei.ts — fester Text, nie Daten der Kundin; in Logs und
 * Sentry steht weder Name noch Inhalt.
 */
export type MailAnhang = { dateiname: string; inhalt: string }

/** Für Resend: der Inhalt als Base64 (die API nimmt Text so entgegen), der Typ aus der Endung. */
function alsResendAnhaenge(anhaenge: readonly MailAnhang[] | undefined): { filename: string; content: string }[] | undefined {
  if (!anhaenge || anhaenge.length === 0) return undefined
  return anhaenge.map((a) => ({ filename: a.dateiname, content: Buffer.from(a.inhalt, 'utf8').toString('base64') }))
}

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
    const attachments = alsResendAnhaenge(optionen.anhaenge)
    const result = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
      ...(optionen.headers ? { headers: optionen.headers } : {}),
      ...(optionen.antwortAn ? { replyTo: optionen.antwortAn } : {}),
      ...(attachments ? { attachments } : {}),
    })
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

/**
 * Eine fertige Mail für den Stapelversand des Workers — die Adresse lebt nur im
 * Speicher, nie in der Tabelle. `antwortAn` (V86) baut der Renderer beim
 * Versand frisch aus dem Hof der Bestellung; auch sie steht nie im Auftrag.
 */
export type StapelMail = { an: string; betreff: string; html: string; headers?: Record<string, string>; anhaenge?: readonly MailAnhang[]; antwortAn?: string }

/** Trägt die Mail einen Anhang? Dann geht sie nie im Stapel (Resend nimmt Anhänge nur einzeln), sondern allein. */
export function hatAnhang(mail: Pick<StapelMail, 'anhaenge'>): boolean {
  return (mail.anhaenge?.length ?? 0) > 0
}

/**
 * Ergebnis eines Stapels: `ok` mit einer Resend-ID je Mail in derselben
 * Reihenfolge, sonst Status und kurzer Code (429/5xx/null = später nochmal).
 */
export type StapelErgebnis = { ok: true; ids: string[] } | { ok: false; statusCode: number | null; code: string }

/**
 * Bis zu 100 Mails in EINER Anfrage an Resend (`batch.send`, Nr. 158) — nur
 * für den Worker der Warteschlange, der vorher die Post-Sperre über
 * `postSperreLaesstDurch` geprüft hat. `batch.send` nimmt je Mail dieselben
 * Felder wie `emails.send` ohne Anhänge und ohne Termin, also auch `headers`
 * und `replyTo`;
 * der Idempotenz-Schlüssel gilt für die ganze Anfrage. Strikte Prüfung (alles
 * oder nichts): So gehört die n-te ID sicher zur n-ten Mail. Gezählt werden
 * die angenommenen Mails in EINEM Schritt. Wirft nie.
 *
 * Mit Anhang (Nr. 207, die AGB in der Bestätigung): genau EINE Mail über
 * `emails.send` mit demselben Idempotenz-Schlüssel — der Worker schickt solche
 * Mails einzeln (`hatAnhang`). Mehrere Mails mit Anhang in einer Anfrage
 * lehnt die Funktion ab, statt den Anhang still wegzulassen.
 */
export async function versendeStapel(mails: readonly StapelMail[], idempotenzSchluessel: string): Promise<StapelErgebnis> {
  if (!apiKey) return { ok: false, statusCode: null, code: 'ohne_schluessel' }
  if (mails.some(hatAnhang)) return versendeMitAnhang(mails, idempotenzSchluessel)
  try {
    const resend = await resendClient(apiKey)
    const result = await resend.batch.send(
      mails.map((m) => ({
        from: FROM,
        to: m.an,
        subject: m.betreff,
        html: m.html,
        ...(m.headers ? { headers: m.headers } : {}),
        ...(m.antwortAn ? { replyTo: m.antwortAn } : {}),
      })),
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

async function versendeMitAnhang(mails: readonly StapelMail[], idempotenzSchluessel: string): Promise<StapelErgebnis> {
  const [m] = mails
  if (!apiKey || !m || mails.length !== 1) return { ok: false, statusCode: null, code: 'anhang_im_stapel' }
  try {
    const resend = await resendClient(apiKey)
    const result = await resend.emails.send(
      {
        from: FROM,
        to: m.an,
        subject: m.betreff,
        html: m.html,
        ...(m.headers ? { headers: m.headers } : {}),
        ...(m.antwortAn ? { replyTo: m.antwortAn } : {}),
        attachments: alsResendAnhaenge(m.anhaenge),
      },
      { idempotencyKey: idempotenzSchluessel }
    )
    if (result.error) {
      const statusCode = 'statusCode' in result.error && typeof result.error.statusCode === 'number' ? result.error.statusCode : null
      console.error(`[E-Mail] Resend-Fehler (Mail mit Anhang): ${resendFehlerCode(result.error)} (${statusCode ?? 'ohne Status'})`)
      return { ok: false, statusCode, code: resendFehlerCode(result.error) }
    }
    console.log('[E-Mail] ✓ Mail mit Anhang gesendet')
    await zaehleVersand(1)
    return { ok: true, ids: [result.data?.id ?? ''] }
  } catch (err) {
    console.error(`[E-Mail] Exception (Mail mit Anhang): ${fehlerKlasse(err)}`)
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
  // Kurzer Wochentag ohne Punkt wie in den Boards („Mi, 3. März 2027“, Lauf 31):
  // Ausgeschrieben bricht „Uhr“ am Handy allein in die nächste Zeile.
  const wochentag = date.toLocaleDateString('de-AT', { weekday: 'short', timeZone: 'Europe/Vienna' }).replace(/\.$/, '')
  const datum = date.toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' })
  return `${wochentag}, ${datum}`
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
  /**
   * Gesetzt, wenn die Gebühr entfallen bzw. erstattet ist (Storno, „nicht abgeholt“, verfallen) — dann zeigt
   * das „Gesamt“ der Kunden-Mails nur den Warenpreis (anzeigeGesamtCents, Nr. 255). Das betrifft fast nur
   * die Admin-Vorschau: Die echten Mails gehen vorher hinaus. Fehlt es, gilt die Gebühr.
   */
  serviceFeeRefundedAt?: Date | string | null
  /** Gebührenmodell aus dem Snapshot (N38): 'hofpreis' oder null/fehlend = bisher. */
  gebuehrModell?: string | null
  /** Einzugsweg aus dem Snapshot (N38): 'erlassen' heißt, die Bargebühr bleibt beim Hof. */
  gebuehrEinzug?: string | null
  /** Bestellzeitpunkt — für die Frist in „Bitte bestätige" (fristVon); fehlt er, bleibt der allgemeine Satz. */
  createdAt?: Date
  pickupDate: Date
  pickupTimeStart: string
  pickupTimeEnd: string
  paymentMethod: string
  stripePaymentIntentId?: string | null
  /** Käuferart (Nr. 200): nur bei PRIVAT steht „Vertrag widerrufen“ in der Mail; fehlt sie, kein Link. */
  kaeuferArt?: string | null
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
    /**
     * Die Anmelde-Adresse der Inhaberin (Nr. 207): Rückfall der Hof-E-Mail in
     * der Belehrung (hofKontaktEmail). Alle Lader liefern sie; fehlt sie (alte
     * Testdaten), bleibt die Zeile ohne E-Mail, wenn das Profil keine hat.
     */
    owner?: { email: string }
  }
  items: Array<{
    productName: string
    quantity: number
    unitPrice: { toString(): string } | number
    totalPrice?: { toString(): string } | number
    /**
     * Gebühr dieser Position in Cent (OrderItem.gebuehrCents, N38) — nur im Hofpreis-Modell über 0.
     * Pflicht, damit der Typecheck jeden Lader meldet, der das Feld vergisst: Sonst zeigt die Mail
     * Zeilen ohne Gebühr, aber ein Gesamt mit Gebühr.
     */
    gebuehrCents: number
    // Einheit optional zur Anzeige gejoint (formatOrderLine-Schreibweise);
    // fehlt sie, bleibt die Darstellung wie bisher. ruecksendekostenCents
    // (Nr. 214): die Schätzung des Hofs für den Satz aus Gestaltungshinweis 5 b
    // in der Belehrung — die Lader der drei Bestätigungsmails lesen sie mit.
    // abholhinweise (N47, Nr. 257): Trägt eine Position „Abholung nach Absprache“, sagt die Bestätigung es im Abholblock.
    product?: (NonNullable<OrderLineProduct> & { ruecksendekostenCents?: number | null; abholhinweise?: readonly string[] }) | null
  }>
}

/**
 * Eine Bestellung für die Mails AN DEN HOF: dazu die Anmelde-Adresse der
 * Inhaberin — ohne Hof-E-Mail geht die Mail dorthin (hofKontaktEmail, Nr. 194).
 */
export type OrderForHofMail = OrderForEmail & { farm: OrderForEmail['farm'] & HofKontakt }

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
function zeilenBetrag(i: OrderForEmail['items'][number], mitGebuehr: boolean): number {
  const cents = i.totalPrice != null ? alsCents(i.totalPrice) : decimalZuCents(calcLineTotal(i.unitPrice, i.quantity))
  // Im Hofpreis-Modell (N38) zeigt die Kundin-Mail den Endpreis der Zeile: Ware + Gebühr der Zeile aus dem Snapshot.
  return centsAlsEuro(mitGebuehr ? cents + i.gebuehrCents : cents)
}

/** Ist die Bestellung im Hofpreis-Modell (N38)? Dann heißt die Gebühr „Plattformgebühr“ und steckt im Preis. */
function imHofpreis(order: OrderForEmail): boolean {
  return istHofpreisBestellung({ gebuehrModell: order.gebuehrModell ?? null })
}

/** Ist die Gebühr dieser Bestellung entfallen bzw. erstattet (gebuehrEntfallen)? Fehlt das Feld, gilt sie. NUR Anzeige. */
function mailGebuehrEntfallen(order: OrderForEmail): boolean {
  return gebuehrEntfallen({ serviceFeeRefundedAt: order.serviceFeeRefundedAt ?? null })
}

/**
 * Positionen für die Mails: Zeile in der gemeinsamen Schreibweise, Betrag
 * fertig gerechnet — im Hofpreis-Modell der Endpreis inkl. Plattformgebühr
 * (N38), sonst der Warenpreis. `mitGebuehr` überschreibt das für die
 * Kunden-Mails (`kundenPositionen`); die Hof-Mails rufen ohne.
 */
function mailPositionen(order: OrderForEmail, mitGebuehr: boolean = imHofpreis(order)): Array<{ name: string; betrag: number }> {
  return order.items.map((i) => ({ name: positionsZeile(i), betrag: zeilenBetrag(i, mitGebuehr) }))
}

/**
 * Positionen der Kunden-Mails mit „Gesamt“ (Bestätigung, „Bitte bestätige“):
 * Endpreise inkl. Gebühr nur, solange die Gebühr gilt. Ist sie entfallen,
 * zeigt „Gesamt“ den Warenpreis (anzeigeGesamtCents) — dann auch die Zeilen,
 * sonst wäre die Zeilensumme größer als „Gesamt“ (Nr. 255 Runde 1, wie die
 * Bestätigungsseite). NUR Anzeige; gespeicherte Beträge bleiben.
 */
function kundenPositionen(order: OrderForEmail): Array<{ name: string; betrag: number }> {
  return mailPositionen(order, imHofpreis(order) && !mailGebuehrEntfallen(order))
}

/**
 * Die Gebühr in den Kunden-Mails: im Modell `bisher` eine eigene Zeile mit dem
 * Wort und dem Erklärsatz der Bestellung (`gebuehrZeile`), im Hofpreis-Modell
 * keine Zeile — sie steckt in den Endpreisen, der Satz darunter nennt sie
 * (`plattformgebuehr`).
 */
function kundenGebuehr(order: OrderForEmail): {
  gebuehrZeile?: { wort: string; betrag: number; hinweis: string; vermerk?: 'erstattet' | 'entfällt' }
  plattformgebuehr: number
} {
  const { gebuehr } = betraege(order)
  // Hofpreis-Modell: bei entfallener Gebühr kein „inkl.“-Satz (freigabe §36 „Seiten“, wie zahlzeile.ts) — 0 heißt „kein Satz“.
  if (imHofpreis(order)) return { plattformgebuehr: mailGebuehrEntfallen(order) ? 0 : gebuehr }
  // Nr. 255: „erstattet“/„entfällt“ wie Bestätigungsseite und Abholzettel (gebuehrEntfallenVermerk) — sonst zählte die Zeile über „Gesamt“ scheinbar mit.
  const vermerk = gebuehrEntfallenVermerk({ serviceFeeRefundedAt: order.serviceFeeRefundedAt ?? null, paymentMethod: order.paymentMethod })
  return {
    gebuehrZeile: { wort: gebuehrWort(order), betrag: gebuehr, hinweis: gebuehrHinweisFuer({ gebuehrModell: order.gebuehrModell ?? null }), ...(vermerk ? { vermerk } : {}) },
    plattformgebuehr: 0,
  }
}

/**
 * „Antwort an“ in den Bestellmails an die Kundin (V86): nur die Hof-E-Mail aus
 * dem Profil, nur wenn sie gesetzt ist — sonst keine, und die Antwort landet
 * wie bisher bei der Absenderadresse. Nie die Anmelde-Adresse und nie
 * hofKontaktEmail: Die fällt auf die Anmelde-Adresse zurück, und die sähe die
 * Kundin sonst beim Antworten (Kopfkommentar von src/lib/hof-kontakt.ts).
 * Nur die Adresse, ohne Namen davor: Der Hofname ist Fremdtext.
 */
function antwortAnHof(farm: { email: string }): string | undefined {
  return hofEmailFehlt(farm) ? undefined : farm.email.trim()
}

/** `antwortAn` für eine Bestellmail an die Kundin — ohne Hof-E-Mail fehlt das Feld ganz. */
function mitAntwortAn(farm: { email: string }): { antwortAn?: string } {
  const adresse = antwortAnHof(farm)
  return adresse ? { antwortAn: adresse } : {}
}

/**
 * Abholung nach Absprache in der Bestätigung (N47, Nr. 257): Bedingung und
 * „Antwort an“ aus EINER Stelle — der Satz verspricht „einfach antworten“ nur,
 * wenn der Kopf der Mail wirklich die Hof-E-Mail als Antwort-Adresse trägt.
 */
function bestaetigungMitAbsprache(order: OrderForEmail): { abspracheSatz?: string; kopf: { antwortAn?: string } } {
  const kopf = mitAntwortAn(order.farm)
  if (!brauchtAbsprache(order.items.map((i) => i.product?.abholhinweise))) return { kopf }
  return { abspracheSatz: abspracheMailSatz(kopf.antwortAn !== undefined), kopf }
}

/** Das Wort für die Gebühr in den Hof-Mails (N8): „Plattformgebühr“ im Hofpreis-Modell, sonst „Servicegebühr“. */
function gebuehrWort(order: OrderForEmail): string {
  return imHofpreis(order) ? PLATTFORMGEBUEHR_BEZEICHNUNG : SERVICEGEBUEHR_BEZEICHNUNG
}

/** Online, bar oder (alte Bestellungen, E5) Karte vor Ort — für Satz und Gesamtzeile der Mail. */
function mailZahlart(paymentMethod: string): MailZahlart {
  if (paymentMethod === 'ONLINE') return 'online'
  return paymentMethod === 'ONSITE_CARD' ? 'karte' : 'bar'
}

/** „Vertrag widerrufen“ (Nr. 200, N39): der signierte Link — nur für Verbraucherinnen. */
function widerrufUrl(order: OrderForEmail): string | undefined {
  return order.kaeuferArt === 'PRIVAT' ? `${APP_URL}${widerrufPfad(order.id)}` : undefined
}

/**
 * Die Belehrung nach Anhang I FAGG für die Bestätigungsmails (Nr. 207): nur
 * bei Verbraucherinnen (PRIVAT, wie der Widerruf-Link — fehlt die Käuferart,
 * keine Belehrung), gefüllt mit Name, Anschrift, Telefon und E-Mail des Hofs
 * DIESER Bestellung. Die E-Mail ist die Adresse, unter der der Hof erreichbar
 * ist (hofKontaktEmail, ohne Hof-E-Mail die Anmelde-Adresse).
 */
function belehrungFuer(order: OrderForEmail): Belehrung | undefined {
  if (order.kaeuferArt !== 'PRIVAT') return undefined
  // Ohne Anmelde-Adresse (nur alte Testdaten) bleibt die Hof-E-Mail des Profils, sonst nichts — nie ein erfundener Wert.
  const { owner, ...farm } = order.farm
  const belehrung = belehrungMitHof(belehrungHof(farm, hofKontaktEmail({ ...farm, owner: owner ?? { email: '' } })))
  // Nr. 214: geschätzte Rücksendekosten sperriger Ware (Gestaltungshinweis 5 b) — ohne Schätzung bleibt der Satz weg.
  const euro = ruecksendekostenSchaetzungEuro(order.items.map((i) => ({ menge: i.quantity, ruecksendekostenCents: i.product?.ruecksendekostenCents ?? null })))
  return belehrungMitKostenschaetzung(belehrung, euro)
}

/**
 * Die AGB als Datei im Anhang (Nr. 207) in der Fassung der Bestellung (N45) —
 * erst beim Bauen geladen, wie die Vorlagen (ARCHITECTURE §4). Für 1.0 braucht
 * der Stand-Vermerk den Stichtag; scheitert das Laden, steht der Ersatzwert
 * („ab dem Stichtag auf <Domain>/konditionen“) da, es geht eine Meldung an
 * Sentry, und es wird nie geworfen: Die Bar-Bestätigungsmail geht „Sofort“ und
 * darf an keinem Nachlauf scheitern (N26).
 */
async function agbAnhang(fassung: AgbKennung): Promise<MailAnhang> {
  const { agbAlsHtml, agbDateiname } = await import('@/lib/rechtstexte/agb-datei')
  let inkrafttreten: Date | null = null
  if (fassung !== AGB_BISHER) {
    try {
      const { ladePlattformEinstellung } = await import('@/server/queries/plattform-einstellung')
      inkrafttreten = hofpreisModellAb(hofpreisEinstellungAus(await ladePlattformEinstellung()))
    } catch (err) {
      Sentry.captureException(err, { tags: { bereich: 'agb-anhang-stichtag' } })
    }
  }
  return { dateiname: agbDateiname(fassung), inhalt: agbAlsHtml(fassung, { inkrafttreten }) }
}

function routeUrl(order: OrderForEmail): string {
  return buildMapsUrl(order.farm.address, order.farm.postalCode, order.farm.city)
}

/**
 * Die Beträge einer Bestellung in Euro — aus dem SNAPSHOT der Bestellung
 * (src/lib/servicegebuehr.ts), damit Mail, Bestellseite und Checkout dieselbe
 * Rechnung zeigen: Warenpreis, Servicegebühr, Gesamt (= was die Kundin zahlt).
 * `anzeigeGesamt` ist das „Gesamt“ der Kunden-Mails (Nr. 255): wie Bestätigung
 * und Bestellseite ohne entfallene Gebühr (anzeigeGesamtCents) — NUR Anzeige;
 * „Bar zu kassieren“ und „Die Kundin hat … bezahlt“ bleiben `gesamt`.
 */
function betraege(order: OrderForEmail): { warenpreis: number; gebuehr: number; gesamt: number; anzeigeGesamt: number } {
  const summen = { totalAmount: order.totalAmount, serviceFeeCents: order.serviceFeeCents ?? 0 }
  const s = bestellSummen(summen)
  return {
    warenpreis: centsAlsEuro(s.warenpreisCents),
    gebuehr: centsAlsEuro(s.gebuehrCents),
    gesamt: centsAlsEuro(s.gesamtCents),
    anzeigeGesamt: centsAlsEuro(anzeigeGesamtCents({ ...summen, serviceFeeRefundedAt: order.serviceFeeRefundedAt ?? null })),
  }
}

/**
 * Der Betrag in „Bring bitte … in bar mit“ / „Bitte zahle … mit Karte“: was der
 * Hof kassiert, aus dem Snapshot (barZuKassierenCents) — dieselbe Zahl wie
 * „Bar zu kassieren“ in der Hof-Mail, nie das Anzeige-Gesamt (Nr. 255 Runde 1).
 * Online gibt es nichts zu kassieren: dann das Gesamt aus dem Snapshot.
 * null = kein Kasten: Ist die Gebühr entfallen (Storno, „nicht abgeholt“,
 * verfallen — nur die Admin-Vorschau), ist bei der Abholung nichts mehr zu
 * zahlen; der Snapshot-Betrag stünde sonst neben „Servicegebühr (entfällt)“.
 */
function vorOrtBetrag(order: OrderForEmail): number | null {
  if (mailGebuehrEntfallen(order)) return null
  const cents = barZuKassierenCents({ totalAmount: order.totalAmount, serviceFeeCents: order.serviceFeeCents ?? 0, paymentMethod: order.paymentMethod })
  return cents === null ? betraege(order).gesamt : centsAlsEuro(cents)
}

// ─── Send-Funktionen ──────────────────────────────────────────────────────────

/*
 * Inhalts-Funktionen (Nr. 270): Je Sofort-Art baut `<art>Inhalt(daten)` nur
 * Betreff und HTML — ohne Empfänger, ohne Log, ohne Versand. Die
 * `send…`-Funktion ruft sie und dann sendRaw; Text und Ablauf sind dieselben
 * wie vorher (Vorher-nachher-Test tests/mail-inhalt-gleich.test.ts). Die
 * Beispiele in Admin › Betrieb › Mails (src/server/mail-arten/beispiele.ts)
 * rufen nur die Inhalts-Funktion, mit festen Platzhaltern.
 */

/** Anmeldecode → Kundin: nur Betreff und HTML (Nr. 270). Der Betreff trägt den Code nicht. */
export async function anmeldecodeInhalt(daten: { code: string }): Promise<MailInhalt> {
  const minuten = ANMELDECODE_GUELTIG_SEKUNDEN / 60
  const html = await vorlageHtml(async () => {
    const { AnmeldecodeEmail } = await import('@/emails/anmeldecode')
    return React.createElement(AnmeldecodeEmail, { code: daten.code, minuten })
  })
  return { betreff: `Dein Anmeldecode für ${MARKE}`, html }
}

/**
 * Anmeldecode → Kundin (E7). Der Betreff trägt den Code NICHT: sendRaw
 * schreibt den Betreff auch in Produktion ins Log, und der Sperrbildschirm
 * zeigt ihn jedem, der danebensteht. Gibt das Versandergebnis zurück — ohne
 * ID (kein Schlüssel, Resend-Fehler) schreibt auth.ts den Code lokal ins Log.
 */
export async function sendAnmeldeCodeEmail(email: string, code: string): Promise<VersandErgebnis> {
  const inhalt = await inhaltOderFehler(() => anmeldecodeInhalt({ code }))
  if (!inhalt.ok) return { error: inhalt.error }
  return sendRaw(email, inhalt.betreff, inhalt.html, { art: 'anmeldecode' })
}

/** Code für „Bestellungen finden": nur Betreff und HTML (Nr. 270). */
export async function bestellcodeInhalt(daten: { code: string }): Promise<MailInhalt> {
  const minuten = ANMELDECODE_GUELTIG_SEKUNDEN / 60
  const html = await vorlageHtml(async () => {
    const { AnmeldecodeEmail } = await import('@/emails/anmeldecode')
    return React.createElement(AnmeldecodeEmail, { code: daten.code, minuten, zweck: 'bestellungen' })
  })
  return { betreff: `Dein Code für deine Bestellungen · ${MARKE}`, html }
}

/**
 * Code für „Bestellungen finden" (Nr. 14) → wer seine Bestellungen sehen will.
 * Dieselbe Vorlage wie der Anmeldecode, eigener Text; Betreff und Vorschau
 * ohne Code (Begründung wie oben). Gibt das Versandergebnis zurück.
 */
export async function sendBestellCodeEmail(email: string, code: string): Promise<VersandErgebnis> {
  const inhalt = await inhaltOderFehler(() => bestellcodeInhalt({ code }))
  if (!inhalt.ok) return { error: inhalt.error }
  return sendRaw(email, inhalt.betreff, inhalt.html, { art: 'bestellcode' })
}

/** „Bestätige deine E-Mail" → neuer Hof: nur Betreff und HTML (Nr. 270). `url` trägt den signierten Token. */
export async function emailBestaetigungInhalt(daten: { url: string }): Promise<MailInhalt> {
  const html = await vorlageHtml(async () => {
    const { EmailBestaetigungEmail } = await import('@/emails/email-bestaetigung')
    return React.createElement(EmailBestaetigungEmail, { url: daten.url, stunden: BESTAETIGUNG_GUELTIG_SEKUNDEN / 3600 })
  })
  return { betreff: `Bestätige deine E-Mail-Adresse · ${MARKE}`, html }
}

/**
 * „Bestätige deine E-Mail" → neuer Hof (S3, Nachtlauf Nr. 17b). `url` ist die
 * volle Adresse von /verify mit dem signierten Token. Der Betreff trägt
 * keinen Link; gibt das Versandergebnis zurück (sendRaw wirft nie).
 */
export async function sendEmailBestaetigung(email: string, url: string): Promise<VersandErgebnis> {
  const inhalt = await inhaltOderFehler(() => emailBestaetigungInhalt({ url }))
  if (!inhalt.ok) return { error: inhalt.error }
  return sendRaw(email, inhalt.betreff, inhalt.html, { art: 'email-bestaetigung' })
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
 * Registrierungs-Hinweis: nur Betreff und HTML (Nr. 270). Wirft wie der
 * Versand bisher, wenn die Vorlage scheitert (kein `{ error }`).
 */
export async function registrierungsHinweisInhalt(ziele: { weg: 'passwort' | 'code'; anmelden: string; passwortZuruecksetzen: string | null }): Promise<MailInhalt> {
  // Vorlage erst beim Bauen laden: Seitenmodule, die email.ts einbinden,
  // sollen sie nicht mitziehen (Nachtlauf Nr. 31, „schwere Module nur bei Bedarf").
  const { RegistrierungHinweisEmail } = await import('@/emails/registrierung-hinweis')
  const html = await toHtml(React.createElement(RegistrierungHinweisEmail, ziele))
  return { betreff: `Jemand wollte sich mit deiner Adresse registrieren · ${MARKE}`, html }
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
  const inhalt = await registrierungsHinweisInhalt(ziele)
  return sendRaw(email, inhalt.betreff, inhalt.html, { art: 'registrierungs-hinweis' })
}

/** Passwort-Reset → Bauer: nur Betreff und HTML (Nr. 270). Wirft wie der Versand, wenn die Vorlage scheitert. */
export async function passwortLinkInhalt(daten: { url: string }): Promise<MailInhalt> {
  const { PasswordResetEmail } = await import('@/emails/password-reset')
  const html = await toHtml(React.createElement(PasswordResetEmail, { resetUrl: daten.url }))
  return { betreff: `Passwort zurücksetzen · ${MARKE}`, html }
}

/** Passwort-Reset → Bauer */
export async function sendPasswordResetEmail(email: string, url: string): Promise<void> {
  const inhalt = await passwortLinkInhalt({ url })
  await send(email, inhalt.betreff, inhalt.html, { art: 'passwort-link' })
}

/** „Zu viele falsche Codes" bzw. „… Passwörter": nur Betreff und HTML (Nr. 270). */
export async function zuVieleVersucheInhalt(daten: { art: import('@/lib/anmeldecode').FehlversuchArt; bis: Date }): Promise<MailInhalt> {
  // Dynamisch statt in der Importzeile oben: email.ts teilen sich mehrere Nummern eines Laufs.
  const { ZU_VIELE_VERSUCHE_MAIL } = await import('@/lib/anmeldecode')
  const html = await vorlageHtml(async () => {
    const { ZuVieleVersucheEmail } = await import('@/emails/zu-viele-versuche')
    return React.createElement(ZuVieleVersucheEmail, { art: daten.art, bis: zeitpunktFuerMail(daten.bis) })
  })
  return { betreff: `${ZU_VIELE_VERSUCHE_MAIL[daten.art].betreff} · ${MARKE}`, html }
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
  const inhalt = await inhaltOderFehler(() => zuVieleVersucheInhalt({ art, bis }))
  if (!inhalt.ok) return { error: inhalt.error }
  return sendRaw(email, inhalt.betreff, inhalt.html, { art: 'zu-viele-versuche' })
}

/** „Neue Anmeldung bei deinem Hof-Konto": nur Betreff und HTML (Nr. 270). `link` trägt einen Einmal-Token. */
export async function neueAnmeldungInhalt(daten: { hof: boolean; name: string | null; geraet: string; zeitpunkt: Date; link: string }): Promise<MailInhalt> {
  // Dynamisch statt in der Importzeile oben: email.ts teilen sich mehrere Nummern eines Laufs.
  const { NEUE_ANMELDUNG_MAIL, anmeldeZeitpunkt } = await import('@/lib/geraete')
  const html = await vorlageHtml(async () => {
    const { NeueAnmeldungEmail } = await import('@/emails/neue-anmeldung')
    const { zeitpunkt, ...rest } = daten
    return React.createElement(NeueAnmeldungEmail, { ...rest, wann: anmeldeZeitpunkt(zeitpunkt) })
  })
  return { betreff: `${NEUE_ANMELDUNG_MAIL.betreff(daten.hof)} · ${MARKE}`, html }
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
  const inhalt = await inhaltOderFehler(() => neueAnmeldungInhalt(daten))
  if (!inhalt.ok) return { error: inhalt.error }
  return sendRaw(email, inhalt.betreff, inhalt.html, { art: 'neue-anmeldung' })
}

/** „Admin-Sicherheit": nur Betreff und HTML (Nr. 270). `code` nur beim Einrichtungscode, nie im Betreff. */
export async function adminSicherheitInhalt(daten: {
  anlass: import('@/lib/admin-anmeldung').AdminSicherheitAnlass
  geraet: string
  zeitpunkt: Date
  code?: string
}): Promise<MailInhalt> {
  // Dynamisch statt in der Importzeile oben: email.ts teilen sich mehrere Nummern eines Laufs.
  const { ADMIN_SICHERHEIT_MAIL } = await import('@/lib/admin-anmeldung')
  const { anmeldeZeitpunkt } = await import('@/lib/geraete')
  const html = await vorlageHtml(async () => {
    const { AdminSicherheitEmail } = await import('@/emails/admin-sicherheit')
    return React.createElement(AdminSicherheitEmail, { anlass: daten.anlass, geraet: daten.geraet, wann: anmeldeZeitpunkt(daten.zeitpunkt), code: daten.code })
  })
  return { betreff: `${ADMIN_SICHERHEIT_MAIL.betreff[daten.anlass]} · ${MARKE}`, html }
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
  const inhalt = await inhaltOderFehler(() => adminSicherheitInhalt({ anlass, geraet: daten.geraet, zeitpunkt: daten.zeitpunkt, code: daten.code }))
  if (!inhalt.ok) return { error: inhalt.error }
  return sendRaw(email, inhalt.betreff, inhalt.html, { art: 'admin-sicherheit' })
}

/** „Bestätige deine neue Anmelde-Adresse": nur Betreff und HTML (Nr. 270). `link` trägt einen Einmal-Token. */
export async function emailAendernLinkInhalt(daten: { hof: string | null; link: string }): Promise<MailInhalt> {
  // Dynamisch statt in der Importzeile oben: email.ts teilen sich mehrere Nummern eines Laufs.
  const { EMAIL_AENDERN_MAIL } = await import('@/lib/konto-anfragen')
  const html = await vorlageHtml(async () => {
    const { EmailAendernEmail } = await import('@/emails/email-aendern')
    return React.createElement(EmailAendernEmail, daten)
  })
  return { betreff: `${EMAIL_AENDERN_MAIL.betreff} · ${MARKE}`, html }
}

/**
 * „Bestätige deine neue Anmelde-Adresse" → die NEUE Adresse (Register N36,
 * Nr. 190). `link` trägt einen Einmal-Token (24 Stunden) — nur in der Mail,
 * nie im Betreff und nie im Log. Gibt das Versandergebnis zurück.
 */
export async function sendEmailAendernLink(email: string, daten: { hof: string | null; link: string }): Promise<VersandErgebnis> {
  const inhalt = await inhaltOderFehler(() => emailAendernLinkInhalt(daten))
  if (!inhalt.ok) return { error: inhalt.error }
  return sendRaw(email, inhalt.betreff, inhalt.html, { art: 'email-aendern-link' })
}

/** „Deine Anmelde-Adresse wurde geändert": nur Betreff und HTML (Nr. 270). */
export async function emailGeaendertHinweisInhalt(daten: { hof: string | null; zeitpunkt: Date; link: string }): Promise<MailInhalt> {
  // Dynamisch statt in der Importzeile oben: email.ts teilen sich mehrere Nummern eines Laufs.
  const { EMAIL_GEAENDERT_MAIL } = await import('@/lib/konto-anfragen')
  const { anmeldeZeitpunkt } = await import('@/lib/geraete')
  const html = await vorlageHtml(async () => {
    const { EmailGeaendertEmail } = await import('@/emails/email-aendern')
    return React.createElement(EmailGeaendertEmail, { hof: daten.hof, wann: anmeldeZeitpunkt(daten.zeitpunkt), link: daten.link })
  })
  return { betreff: `${EMAIL_GEAENDERT_MAIL.betreff} · ${MARKE}`, html }
}

/**
 * „Deine Anmelde-Adresse wurde geändert" → die ALTE Adresse (Register N36,
 * Nr. 190), mit „Das war ich nicht" (Einmal-Link, nur in der Mail).
 */
export async function sendEmailGeaendertHinweis(email: string, daten: { hof: string | null; zeitpunkt: Date; link: string }): Promise<VersandErgebnis> {
  const inhalt = await inhaltOderFehler(() => emailGeaendertHinweisInhalt(daten))
  if (!inhalt.ok) return { error: inhalt.error }
  return sendRaw(email, inhalt.betreff, inhalt.html, { art: 'email-geaendert-hinweis' })
}

/** Sicherheitsmail an eine Person im Admin-Team: nur Betreff und HTML (Nr. 270). */
export async function teamRechtGeaendertInhalt(daten: { anlass: import('@/lib/admin-team').TeamAnlass; name: string | null; rechte: string[] }): Promise<MailInhalt> {
  // Dynamisch statt in der Importzeile oben: email.ts teilen sich mehrere Nummern eines Laufs.
  const { TEAM_MAIL } = await import('@/lib/admin-team')
  const html = await vorlageHtml(async () => {
    const { TeamRechtGeaendertEmail } = await import('@/emails/team-recht-geaendert')
    return React.createElement(TeamRechtGeaendertEmail, daten)
  })
  return { betreff: `${TEAM_MAIL.betreff[daten.anlass]} · ${MARKE}`, html }
}

/**
 * Sicherheitsmail an eine Person im Admin-Team (Register N35, Nr. 190):
 * eingeladen, Rechte, Inhaber, entfernt — mit den Rechten danach als Wörter.
 */
export async function sendTeamRechtGeaendert(
  email: string,
  daten: { anlass: import('@/lib/admin-team').TeamAnlass; name: string | null; rechte: string[] }
): Promise<VersandErgebnis> {
  const inhalt = await inhaltOderFehler(() => teamRechtGeaendertInhalt(daten))
  if (!inhalt.ok) return { error: inhalt.error }
  return sendRaw(email, inhalt.betreff, inhalt.html, { art: 'team-recht-geaendert' })
}

/** Neuer Hof registriert → EINE Betreiber-Adresse (Freischaltung nötig); die Adressen aus empfaengerFuer('hofWartet'), je Adresse ein Auftrag. */
export async function baueNewFarmNotification(
  farm: {
    id: string
    name: string
    slug: string
    ownerEmail: string
    createdAt: Date
    /** PLZ und Ort für die Zeile „Hof“ (Board Bild 1); fehlen sie, steht nur der Name. */
    postalCode?: string
    city?: string
    /** Was zum Verkaufen noch fehlt („Stripe“, „Produkte“, „Abholzeit“); leer oder fehlend = keine Zeile. */
    fehlt?: string[]
  },
  an: string
): Promise<StapelMail> {
  // Kurzer Wochentag, Datum und Uhrzeit wie in den Boards („Do, 15. Oktober 2026, 10:00“, Wiener Zeit).
  const registeredAt = `${formatPickupDate(farm.createdAt)}, ${farm.createdAt.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna' })}`
  const { NewFarmNotificationEmail } = await import('@/emails/new-farm-notification')
  const { ADMIN_HOEFE_HREF } = await import('@/lib/admin-hof-akte')
  const html = await toHtml(
    React.createElement(NewFarmNotificationEmail, {
      pruefenUrl: `${APP_URL}${ADMIN_HOEFE_HREF}`,
      farmName: farm.name,
      farmOrt: [farm.postalCode, farm.city].filter(Boolean).join(' ') || undefined,
      fehlt: farm.fehlt,
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
 * Plattformgebühr: Ankündigung vier Wochen vor dem Einzugsbeginn → Hof
 * (Register N38, Nr. 198). Der Text kommt fertig aus `ankuendigungText` —
 * dieselben Worte wie die Postfach-Nachricht.
 */
export async function bauePlattformgebuehrAnkuendigung(d: { an: string; text: string; datum: string }): Promise<StapelMail> {
  const { LASTSCHRIFT_HREF, LASTSCHRIFT_TEXT } = await import('@/lib/konditionen')
  const { PlattformgebuehrAnkuendigungEmail } = await import('@/emails/plattformgebuehr-ankuendigung')
  const html = await toHtml(
    React.createElement(PlattformgebuehrAnkuendigungEmail, { text: d.text, datum: d.datum, lastschriftUrl: `${APP_URL}${LASTSCHRIFT_HREF}`, knopf: LASTSCHRIFT_TEXT.einrichten })
  )
  return { an: d.an, betreff: `Plattformgebühr ab ${d.datum}`, html }
}

/** Lastschrift der Monatsabrechnung gescheitert → Hof (Register N38, Nr. 198); Text aus `lastschriftGescheitertText`. */
export async function baueLastschriftGescheitert(d: { an: string; text: string; monat: string }): Promise<StapelMail> {
  const { LastschriftGescheitertEmail } = await import('@/emails/lastschrift-gescheitert')
  const html = await toHtml(React.createElement(LastschriftGescheitertEmail, { text: d.text, monat: d.monat, konditionenUrl: `${APP_URL}/settings/konditionen` }))
  return { an: d.an, betreff: `Lastschrift für ${d.monat} hat nicht geklappt`, html }
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
    /** Die Zahlen der Wochenlage (Nr. 192), fertig formuliert; ohne sie bleibt die Mail wie vor Nr. 192. */
    lage?: Array<{ label: string; wert: string }>
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
  const { ADMIN_BESTELLUNGEN_HREF } = await import('@/lib/admin-bestellung')
  const html = await toHtml(
    React.createElement(ErstattungOffenEmail, {
      bestellungenUrl: `${APP_URL}${ADMIN_BESTELLUNGEN_HREF}`,
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
  // N45: die Fassung aus dem Snapshot, nie aus der Uhr; ein unbekannter Wert ergibt 0.9 und eine Meldung.
  const agbFassung = agbFassungMitMeldung(order)
  const { abspracheSatz, kopf } = bestaetigungMitAbsprache(order)

  const { OrderConfirmationEmail } = await import('@/emails/order-confirmation')
  const html = await toHtml(React.createElement(OrderConfirmationEmail, {
    orderNumber: order.orderNumber,
    farmName: order.farm.name,
    farmPhone: order.farm.phone,
    farmAddress: order.farm.address,
    farmCity: order.farm.city,
    farmPostalCode: order.farm.postalCode,
    pickupDate: formatPickupDate(order.pickupDate),
    pickupTime: `${order.pickupTimeStart}–${order.pickupTimeEnd}`,
    abspracheSatz,
    zahlart: mailZahlart(order.paymentMethod),
    items: kundenPositionen(order),
    ...kundenGebuehr(order),
    total: betraege(order).anzeigeGesamt,
    vorOrtBetrag: vorOrtBetrag(order),
    routeUrl: routeUrl(order),
    manageUrl: `${APP_URL}/account/profile`,
    orderUrl,
    widerrufUrl: widerrufUrl(order),
    belehrung: belehrungFuer(order),
    agbFassung,
  }))

  // Nr. 207: die AGB als Datei im Anhang — auch bei „Betrieb“ (nur Belehrung und Formular entfallen); N45: in der Fassung der Bestellung.
  return {
    an: order.customerEmail,
    betreff: `Deine Bestellung bei ${order.farm.name} – Abholung ${formatPickupDate(order.pickupDate)}`,
    html,
    anhaenge: [await agbAnhang(agbFassung)],
    ...kopf,
  }
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
  // N45: die Fassung aus dem Snapshot, nie aus der Uhr; ein unbekannter Wert ergibt 0.9 und eine Meldung.
  const agbFassung = agbFassungMitMeldung(order)

  const { OnsiteConfirmationEmail } = await import('@/emails/onsite-confirmation')
  const html = await toHtml(React.createElement(OnsiteConfirmationEmail, {
    orderNumber: order.orderNumber,
    farmName: order.farm.name,
    farmAddress: order.farm.address,
    farmCity: order.farm.city,
    farmPostalCode: order.farm.postalCode,
    pickupDate: formatPickupDate(order.pickupDate),
    pickupTime: `${order.pickupTimeStart}–${order.pickupTimeEnd}`,
    items: kundenPositionen(order),
    ...kundenGebuehr(order),
    total: betraege(order).anzeigeGesamt,
    confirmationUrl,
    bestaetigenBis: frist ? zeitpunktFuerMail(frist) : undefined,
    belehrung: belehrungFuer(order),
    widerrufUrl: widerrufUrl(order),
    agbFassung,
  }))

  // Nr. 207: die AGB als Datei im Anhang, wie in der Bestätigung (N45: Fassung der Bestellung).
  return {
    an: order.customerEmail,
    betreff: `Bitte bestätige deine Bestellung bei ${order.farm.name}`,
    html,
    anhaenge: [await agbAnhang(agbFassung)],
    ...mitAntwortAn(order.farm),
  }
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
    ...(mail.anhaenge ? { anhaenge: mail.anhaenge } : {}),
    ...(mail.antwortAn ? { antwortAn: mail.antwortAn } : {}),
  })
}

/**
 * Die Abholzeit in den Hof-Mails ohne führende Null der Stunde: „9:00–12:00“ (Board s3/w3-mail-hof-bestellung, V9).
 * Die Kunden-Mails behalten „09:00“ wie die Bestätigungsseite — die Frist „bis …, 09:40 Uhr“ ebenso (C-Zeile mail-kauf).
 */
function hofAbholzeit(order: Pick<OrderForEmail, 'pickupTimeStart' | 'pickupTimeEnd'>): string {
  const ohneNull = (zeit: string) => zeit.replace(/^0(\d:)/, '$1')
  return `${ohneNull(order.pickupTimeStart)}–${ohneNull(order.pickupTimeEnd)}`
}

/** „Bei Heute ansehen →“ in den Hof-Mails: die Startseite des Hofbereichs (Wortliste N42 c), dieselbe Adresse wie in der Navigation. */
async function heuteUrl(): Promise<string> {
  const { hauptPunktHref } = await import('@/lib/bauern-navigation')
  return `${APP_URL}${hauptPunktHref('heute')}`
}

/** Online-Zahlung → Bauer */
export async function baueOrderPaidToFarmer(order: OrderForHofMail): Promise<StapelMail> {
  const { NewOrderNotificationEmail } = await import('@/emails/new-order-notification')
  const html = await toHtml(React.createElement(NewOrderNotificationEmail, {
    farmerName: order.farm.ownerName,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    orderNumber: order.orderNumber,
    pickupDate: formatPickupDate(order.pickupDate),
    pickupTime: hofAbholzeit(order),
    // Zeilenbeträge wie in der Mail an die Kundin (mailPositionen: dieselbe Rechnung über Cent), Board s3/w3-mail-hof-bestellung Bild 1.
    items: mailPositionen(order).map((zeile, i) => ({ ...zeile, quantity: order.items[i]?.quantity ?? 0 })),
    // Für den Hof zählt der Warenpreis — das ist, was ihm überwiesen wird.
    total: betraege(order).warenpreis,
    serviceFee: betraege(order).gebuehr,
    gebuehrWort: gebuehrWort(order),
    customerTotal: betraege(order).gesamt,
    paymentLabel: 'Online (bereits bezahlt)',
    isOnline: true,
    heuteUrl: await heuteUrl(),
  }))

  return { an: hofKontaktEmail(order.farm), betreff: `Neue Bestellung für ${formatPickupDate(order.pickupDate)} – ${order.orderNumber}`, html }
}

/**
 * Neue Barbestellung → Hof (Nr. 256, N46; Board s3/w3-mail-hof-bestellung
 * Bild 2), solange die Kundin noch bestätigen muss. Ob sie noch passt (Status,
 * Frist), entscheidet der Renderer `rendereBestellungBarHof` — hier wird nur
 * gebaut. Ohne Telefonnummer, ohne E-Mail-Adresse und ohne Notiz der Kundin:
 * Vor ihrer Bestätigung braucht der Hof nur, was er packen und kassieren wird.
 * Kein Reply-To: Antworten an die Kundin laufen über die Bestellung.
 */
export async function baueBarBestellungAnHof(order: OrderForHofMail): Promise<StapelMail> {
  // „Bar zu kassieren“ allein aus dem Snapshot (barZuKassierenCents) — nie aus dem Warenpreis als Rückfall.
  const kassierenCents = barZuKassierenCents({ totalAmount: order.totalAmount, serviceFeeCents: order.serviceFeeCents ?? 0, paymentMethod: order.paymentMethod })
  if (kassierenCents === null) throw new Error('Bar-Mail an den Hof für eine Online-Bestellung')
  // Dieselbe Frist wie die Mail „Bitte bestätige“ an die Kundin und das Verfallen (fristen.ts), als fester Tag mit Uhrzeit (C-Zeile mail-kauf).
  const frist = order.createdAt
    ? // Vor Ort, nie online (oben ausgeschlossen): fristVon rechnet bar und Karte vor Ort gleich.
      fristVon({ paymentMethod: 'ONSITE_CASH', createdAt: order.createdAt, pickupDate: order.pickupDate, pickupTimeStart: order.pickupTimeStart })
    : null

  const { NewOrderNotificationEmail } = await import('@/emails/new-order-notification')
  const html = await toHtml(React.createElement(NewOrderNotificationEmail, {
    farmerName: order.farm.ownerName,
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    pickupDate: formatPickupDate(order.pickupDate),
    pickupTime: hofAbholzeit(order),
    items: mailPositionen(order).map((zeile, i) => ({ ...zeile, quantity: order.items[i]?.quantity ?? 0 })),
    paymentLabel: 'Bar bei Abholung',
    isOnline: false,
    barZuKassieren: centsAlsEuro(kassierenCents),
    bestaetigenBis: frist ? zeitpunktFuerMail(frist) : undefined,
    heuteUrl: await heuteUrl(),
  }))

  return {
    an: hofKontaktEmail(order.farm),
    betreff: `Neue Bestellung für ${formatPickupDate(order.pickupDate)} – ${order.orderNumber} (Bar bei Abholung)`,
    html,
  }
}

/** Bar bestätigt → Bauer (alte Bestellungen mit Karte bei Abholung, E5, gehen denselben Weg) */
export async function baueOrderConfirmedToFarmer(order: OrderForHofMail): Promise<StapelMail> {
  const bar = order.paymentMethod === 'ONSITE_CASH'

  const { OrderConfirmedEmail } = await import('@/emails/order-confirmed')
  const html = await toHtml(React.createElement(OrderConfirmedEmail, {
    farmerName: order.farm.ownerName,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    orderNumber: order.orderNumber,
    pickupDate: formatPickupDate(order.pickupDate),
    pickupTime: hofAbholzeit(order),
    items: order.items.map(i => ({ name: positionsZeile(i), quantity: i.quantity })),
    // Warenpreis für den Hof; „Bar zu kassieren" ist Warenpreis + Gebühr.
    total: betraege(order).warenpreis,
    serviceFee: betraege(order).gebuehr,
    gebuehrWort: gebuehrWort(order),
    barZuKassieren: betraege(order).gesamt,
    // B1 nach dem BESTELLzeitpunkt, nicht nach dem Versand. Ohne Zeitpunkt der
    // bisherige Satz — lieber kein Hinweis als ein falscher.
    // Hofpreis-Modell (N38): Erlassen heißt, die Bargebühr bleibt beim Hof — kein Satz zur Monatsabrechnung.
    barOhneGebuehr: imHofpreis(order)
      ? order.gebuehrEinzug === 'erlassen'
      : order.paymentMethod === 'ONSITE_CASH' && order.createdAt
        ? barOhneServicegebuehr('ONSITE_CASH', order.createdAt)
        : false,
    zahlart: bar ? 'bar' : 'karte',
    heuteUrl: await heuteUrl(),
  }))

  // Wortliste (N42 c, V57): „Bar-Bestellung bestätigt“ wie am Bildschirm, nie „Vor-Ort-Bestellung“.
  return {
    an: hofKontaktEmail(order.farm),
    betreff: bar ? `Bar-Bestellung ${order.orderNumber} bestätigt` : `Bestellung ${order.orderNumber} bestätigt (Karte bei Abholung)`,
    html,
  }
}

/** Bauer markiert als bereit → Kunde */
export async function baueOrderReady(order: OrderForEmail): Promise<StapelMail> {
  // Antwort 8 (Lauf 32, Nr. 255): kein „Dieselbe Bestellung nochmal aufgeben“ mehr — Vertragsmail ohne Werbung (S11).
  // Die Route ?reorder= bleibt für Links in alten Mails.
  const orderUrl = `${APP_URL}${bestellungPfad(order.farm.slug, order.id)}`

  const { OrderReadyEmail } = await import('@/emails/pickup-reminder')
  const html = await toHtml(React.createElement(OrderReadyEmail, {
    orderNumber: order.orderNumber,
    farmName: order.farm.name,
    farmPhone: order.farm.phone,
    farmAddress: order.farm.address,
    farmCity: order.farm.city,
    farmPostalCode: order.farm.postalCode,
    pickupDate: formatPickupDate(order.pickupDate),
    pickupTime: `${order.pickupTimeStart}–${order.pickupTimeEnd}`,
    routeUrl: routeUrl(order),
    orderUrl,
    widerrufUrl: widerrufUrl(order),
  }))

  return { an: order.customerEmail, betreff: `${order.farm.name}: Deine Bestellung ist bereit zur Abholung`, html, ...mitAntwortAn(order.farm) }
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
    farmPostalCode: order.farm.postalCode,
    pickupDate: formatPickupDate(order.pickupDate),
    pickupTime: `${order.pickupTimeStart}–${order.pickupTimeEnd}`,
    routeUrl: routeUrl(order),
    widerrufUrl: widerrufUrl(order),
  }))

  return { an: order.customerEmail, betreff: `Kurzes Update zu deiner Bestellung ${order.orderNumber}`, html, ...mitAntwortAn(order.farm) }
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
    farmPhone: order.farm.phone,
    zahlart: mailZahlart(order.paymentMethod),
    total: n(order.totalAmount),
    refundAmount: erstattetCents === null ? null : centsAlsEuro(erstattetCents),
    cancelReason: cancelReason ?? undefined,
  }))

  return { an: order.customerEmail, betreff: `Deine Bestellung ${order.orderNumber} wurde storniert`, html, ...mitAntwortAn(order.farm) }
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
    /** Was in der Bestellung bleibt (Board s3/w3-mail-kauf Bild 6); fehlt es, keine Zeilen. */
    uebrig?: OrderForEmail['items']
  }
): Promise<StapelMail> {
  const { ArtikelFehltEmail } = await import('@/emails/artikel-fehlt')
  const hofpreis = imHofpreis(order)
  const html = await toHtml(React.createElement(ArtikelFehltEmail, {
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    farmName: order.farm.name,
    farmPhone: order.farm.phone,
    artikel: positionsZeile(fehlt.position),
    // Dieselbe Zeilenrechnung wie die Bestätigung (mailPositionen): Decimal/Cent, im Hofpreis-Modell der Endpreis.
    uebrig: (fehlt.uebrig ?? []).map((i) => ({ name: positionsZeile(i), betrag: zeilenBetrag(i, hofpreis) })),
    gebuehrWort: gebuehrWort(order),
    pickupDate: formatPickupDate(order.pickupDate),
    pickupTime: `${order.pickupTimeStart}–${order.pickupTimeEnd}`,
    zahlung: fehlt.zahlung,
    bisher: centsAlsEuro(fehlt.bisherCents),
    neu: centsAlsEuro(fehlt.neuCents),
    erstattet: fehlt.erstattetCents === null ? null : centsAlsEuro(fehlt.erstattetCents),
    orderUrl: `${APP_URL}${bestellungPfad(order.farm.slug, order.id)}`,
    widerrufUrl: widerrufUrl(order),
  }))

  return { an: order.customerEmail, betreff: `Ein Artikel fehlt in deiner Bestellung ${order.orderNumber}`, html, ...mitAntwortAn(order.farm) }
}

/** Zahlung nach dem Storno eingegangen und sofort voll erstattet → Kunde */
export async function baueZahlungZuSpaet(
  order: Pick<OrderForEmail, 'customerName' | 'customerEmail' | 'orderNumber'> & {
    farm: Pick<OrderForEmail['farm'], 'name' | 'email'>
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

  return { an: order.customerEmail, betreff: 'Deine Zahlung kam zu spät – das Geld ist zurück', html, ...mitAntwortAn(order.farm) }
}

/** Barbestellung nicht rechtzeitig bestätigt, Ware freigegeben → Kunde */
export async function baueBestellungVerfallen(
  order: Pick<OrderForEmail, 'customerName' | 'customerEmail' | 'orderNumber'> &
    Partial<Pick<OrderForEmail, 'createdAt' | 'pickupDate' | 'pickupTimeStart'>> & {
      farm: Pick<OrderForEmail['farm'], 'name' | 'email'>
    }
): Promise<StapelMail> {
  // Board s3/w3-mail-storno Bild 3 (V87): die Frist, die verstrichen ist — dieselbe Rechnung wie „Bitte bestätige“
  // (fristVon, nur gelesen), als fester Tag. Fehlt ein Zeitpunkt, bleibt „nicht rechtzeitig“.
  const frist =
    order.createdAt && order.pickupDate && order.pickupTimeStart
      ? fristVon({ paymentMethod: 'ONSITE_CASH', createdAt: order.createdAt, pickupDate: order.pickupDate, pickupTimeStart: order.pickupTimeStart })
      : null
  const { BestellungVerfallenEmail } = await import('@/emails/bestellung-verfallen')
  const html = await toHtml(React.createElement(BestellungVerfallenEmail, {
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    farmName: order.farm.name,
    bestaetigenBis: frist ? zeitpunktFuerMail(frist) : undefined,
  }))

  return { an: order.customerEmail, betreff: 'Deine Bestellung ist verfallen, weil sie nicht bestätigt wurde', html, ...mitAntwortAn(order.farm) }
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
 * Nr. 105) — Kann warten, je Meldung ein Auftrag (Nr. 159). Die Vorlage
 * src/emails/bescheid.tsx; die Antwort lädt der Renderer frisch aus der Meldung.
 */
export async function baueBescheidMail(an: string, antwort: string): Promise<StapelMail> {
  // Seit Nr. 241 in der Karte aller Mails (Board s3/w3-mail-neuigkeiten Bild 4) statt als rohes HTML.
  const { BescheidEmail } = await import('@/emails/bescheid')
  return { an, betreff: WUENSCHE_TEXT.bescheidTitel, html: await toHtml(React.createElement(BescheidEmail, { antwort })) }
}

/**
 * „Bitte bestätige deine Adresse" → eine weitere Adresse der Zustellung
 * (Register N14, Nr. 95; Double-Opt-in nach dem Muster sendAboBestaetigung).
 * Der Link öffnet nur die Seite, bestätigt wird dort per Knopf — Link-Scanner
 * öffnen Links ungefragt. Gibt das Versandergebnis zurück (sendRaw wirft nie).
 */
export async function sendBetreiberBestaetigung(email: string, token: string): Promise<VersandErgebnis> {
  const inhalt = await inhaltOderFehler(() => betreiberBestaetigungInhalt({ token }))
  if (!inhalt.ok) return { error: inhalt.error }
  return sendRaw(email, inhalt.betreff, inhalt.html, { art: 'betreiber-bestaetigung' })
}

/** „Bitte bestätige deine Adresse" (Zustellung): nur Betreff und HTML (Nr. 270). `token` steht nur im Link. */
export async function betreiberBestaetigungInhalt(daten: { token: string }): Promise<MailInhalt> {
  const html = await vorlageHtml(async () => {
    const { BetreiberBestaetigungEmail } = await import('@/emails/betreiber-bestaetigung')
    return React.createElement(BetreiberBestaetigungEmail, { url: `${APP_URL}${bestaetigenPfad(daten.token)}` })
  })
  return { betreff: ZUSTELLUNG_MAIL_TEXT.bestaetigungBetreff, html }
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
  const html = await toHtml(React.createElement(BetreiberTestmailEmail))
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
  const inhalt = await inhaltOderFehler(() => betriebWarnungInhalt(anlass))
  if (!inhalt.ok) return { gesendet: 0, gescheitert: an.length }
  return sendeAnListe(an, inhalt.betreff, inhalt.html, 'betrieb-warnung')
}

/** Warn-Mail des Betriebs: nur Betreff und HTML (Nr. 270), Sätze aus der reinen `betriebMail`. */
export async function betriebWarnungInhalt(anlass: BetriebMailAnlass): Promise<MailInhalt> {
  const mail = betriebMail(anlass)
  const html = await vorlageHtml(async () => {
    const { BetriebWarnungEmail } = await import('@/emails/betrieb-warnung')
    return React.createElement(BetriebWarnungEmail, { mail, url: `${APP_URL}${ADMIN_BETRIEB_HREF}` })
  })
  return { betreff: mail.betreff, html }
}

// ─── Widerruf (Nr. 200, Register N39) ────────────────────────────────────────

export type WiderrufEingangDaten = {
  bestellnummer: string | null
  umfang: string[]
  eingegangenAm: string
  naechsteSchritte: readonly string[]
  hofName: string | null
}

/**
 * Eingangsbestätigung → Kundin (Sofort, Freigabe 200 Punkt 3): direkt über
 * sendRaw, nur Protokoll. Betreff ohne Name und ohne Nummer — sendRaw schreibt
 * ihn ins Log. `protokoll.bestellungId` nur, wenn der Widerruf einer
 * Bestellung zugeordnet ist (dann kann der Support sie nochmal schicken).
 */
export async function sendWiderrufEingang(
  an: string,
  daten: WiderrufEingangDaten,
  protokoll: { bestellungId?: string; farmId?: string; nochmalVon?: string } = {}
): Promise<VersandErgebnis> {
  const vorlage = await htmlOderFehler(async () => {
    const { WiderrufEingangEmail } = await import('@/emails/widerruf')
    return React.createElement(WiderrufEingangEmail, daten)
  })
  if (!vorlage.ok) return { error: vorlage.error }
  return sendRaw(an, WIDERRUF_EINGANG_BETREFF, vorlage.html, { art: 'widerruf-eingang', ...protokoll })
}

const WIDERRUF_EINGANG_BETREFF = `Dein Widerruf ist eingegangen · ${MARKE}`

/** Dieselbe Mail nur gebaut — für die Vorschau in Admin › Betrieb (Nr. 167) und das Bild der Abnahme. */
export async function widerrufEingangInhalt(an: string, daten: WiderrufEingangDaten): Promise<StapelMail> {
  const { WiderrufEingangEmail } = await import('@/emails/widerruf')
  return { an, betreff: WIDERRUF_EINGANG_BETREFF, html: await toHtml(React.createElement(WiderrufEingangEmail, daten)) }
}

/** Rücktritt nach der Abholung → Hof (Wichtig): prüfen, erstatten oder mit Grund ablehnen. Wortlaut „Rücktritt“ (N43). */
export async function baueWiderrufHof(
  an: string,
  daten: { bestellnummer: string; umfang: string[]; eingegangenAm: string; bestellungPfad: string; ausnahmeSatz: string }
): Promise<StapelMail> {
  const { WiderrufHofEmail } = await import('@/emails/widerruf')
  const html = await toHtml(
    React.createElement(WiderrufHofEmail, {
      bestellnummer: daten.bestellnummer,
      umfang: daten.umfang,
      eingegangenAm: daten.eingegangenAm,
      bestellungUrl: `${APP_URL}${daten.bestellungPfad}`,
      ausnahmeSatz: daten.ausnahmeSatz,
    })
  )
  return { an, betreff: `Rücktritt zu Bestellung ${daten.bestellnummer}`, html }
}

/**
 * Ergebnis → Kundin (Wichtig): erstattet (Betrag in Cent, bar null) oder
 * abgelehnt (Grund des Hofs). Eine Bestellmail an die Kundin: „Antwort an“
 * den Hof der Bestellung (V86), über `hof` aus dem Renderer.
 */
export async function baueWiderrufErgebnis(
  an: string,
  daten: {
    bestellnummer: string
    hofName: string
    erstattetCents: number | null
    grund: string | null
    vorAbholung?: boolean
    teilweise?: boolean
    hof: { email: string }
  }
): Promise<StapelMail> {
  const { WiderrufErgebnisEmail, WIDERRUF_ERGEBNIS_TITEL } = await import('@/emails/widerruf')
  const html = await toHtml(
    React.createElement(WiderrufErgebnisEmail, {
      bestellnummer: daten.bestellnummer,
      hofName: daten.hofName,
      erstattet: daten.erstattetCents === null ? null : centsAlsEuro(daten.erstattetCents),
      grund: daten.grund,
      vorAbholung: daten.vorAbholung === true,
      teilweise: daten.teilweise === true,
    })
  )
  const titel =
    daten.grund !== null
      ? WIDERRUF_ERGEBNIS_TITEL.abgelehnt
      : daten.teilweise === true
        ? WIDERRUF_ERGEBNIS_TITEL.teilweise
        : WIDERRUF_ERGEBNIS_TITEL.erledigt
  return { an, betreff: `${titel} · ${daten.bestellnummer}`, html, ...mitAntwortAn(daten.hof) }
}
