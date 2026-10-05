/**
 * „Bestellungen finden" per E-Mail-Code (Nr. 14, E7/E8) — die Fachregeln,
 * rein und ohne Datenbank prüfbar (tests/bestellungen-finden.test.ts). Läuft
 * auch im Browser (Fehlertexte, Pfad); Geheimnisse und Signaturen stehen in
 * src/lib/bestellungen-zugang.ts.
 *
 * WARUM EIN EIGENER WEG UND NICHT DIE CODE-ANMELDUNG AUS NR. 08: Better Auths
 * `/sign-in/email-otp` legt beim ersten Code ein Kundenkonto an
 * (`disableSignUp: false`, die freiwillige Anmeldung) und erzeugt eine
 * Sitzung. E8 sagt: kein Kundenkonto, „nur für diese Sitzung". Jede
 * Bestellsuche legte sonst still ein Konto an. Die serverseitigen Code-APIs
 * des Plugins passen auch nicht: `checkVerificationOTP` verlangt ein
 * bestehendes Konto (verrät damit, ob es eines gibt), zählt die Versuche ohne
 * Sperre (Lesen, dann blind Schreiben) und verbraucht den Code nicht.
 *
 * Deshalb ein kleiner eigener Mechanismus auf der bestehenden
 * Verification-Tabelle (keine Schema-Änderung): eine Zeile je Adresse mit
 * eigener Kennung, Wert „<hash>:<versuche>" wie beim Plugin, geprüft unter
 * Zeilensperre (src/server/bestellungen-finden.ts). Dieselben Zahlen wie die
 * Anmeldung: 6 Ziffern, 10 Minuten, 5 Versuche (src/lib/anmeldecode.ts).
 * Nach dem richtigen Code bekommt das Gerät einen kurzlebigen, signierten
 * Cookie mit der bewiesenen Adresse — kein Konto, keine Better-Auth-Sitzung.
 */
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client'
import { ANMELDECODE_GUELTIG_SEKUNDEN, ANMELDECODE_MAX_VERSUCHE } from '@/lib/anmeldecode'
import { abholZeitText } from '@/lib/bestaetigung'
import { bestellStatusAnzeige, zahlungsAnzeige } from '@/lib/bestellstatus'
import { formatEuro, mitAnzahl } from '@/lib/format'
import { centsAlsEuro, kalendertagInWien } from '@/lib/servicegebuehr'

/** Die Seite — der Cookie gilt nur für diesen Pfad. */
export const BESTELLUNGEN_PFAD = '/bestellungen'

/** Name des Cookies mit der bewiesenen Adresse (httpOnly, signiert). */
export const BESTELLUNGEN_COOKIE = 'fz-bestellungen'

/** „Nur für diese Sitzung" (E8): so lange bleibt die Liste nach dem Code offen. */
export const BESTELLUNGEN_ANSICHT_SEKUNDEN = 30 * 60

/** Höchstens so viele Bestellungen auf der Seite, neueste zuerst. */
export const BESTELLUNGEN_HOECHSTENS = 100

/** Gültigkeit und Versuche wie bei der Anmeldung — eine Quelle (S4). */
export const BESTELLCODE_GUELTIG_SEKUNDEN = ANMELDECODE_GUELTIG_SEKUNDEN

/**
 * Die Kennung der Code-Zeile in `Verification`. Eigenes Präfix: Das
 * emailOTP-Plugin nimmt `sign-in-otp-…` — ein Code für die Bestellsuche
 * meldet nie an, und ein Anmeldecode zeigt nie Bestellungen.
 */
export function bestellCodeKennung(email: string): string {
  return `bestellungen-finden-otp-${email}`
}

/** Der Wert der Zeile: „<hash>:<versuche>", dieselbe Form wie beim Plugin. */
export function codeWert(hash: string, versuche: number): string {
  return `${hash}:${versuche}`
}

export function leseCodeWert(wert: string): { hash: string; versuche: number } | null {
  const trenner = wert.lastIndexOf(':')
  if (trenner <= 0) return null
  const versuche = wert.slice(trenner + 1)
  if (!/^\d+$/.test(versuche)) return null
  return { hash: wert.slice(0, trenner), versuche: Number(versuche) }
}

export type BestellCodeFehler = 'INVALID_OTP' | 'OTP_EXPIRED' | 'TOO_MANY_ATTEMPTS'

/** Was nach einem Code-Versuch mit der Zeile geschieht. */
export type CodeEntscheidung =
  | { ergebnis: 'ok'; schreiben: 'verbrauchen' }
  | { ergebnis: BestellCodeFehler; schreiben: 'nichts' | 'loeschen' | { versuche: number } }

/**
 * Ein Code-Versuch gegen die gespeicherte Zeile. Die Frist gilt beim Lesen
 * (genau an `expiresAt` abgelaufen), nicht durch einen Aufräumlauf.
 * Gesperrt ist ab 5 gezählten Fehlversuchen — dann nimmt auch der richtige
 * Code nicht mehr an; die Zeile bleibt bis zum Ablauf stehen, ein neuer Code
 * ersetzt sie. Der richtige Code wird verbraucht: Er gilt genau einmal.
 */
export function entscheideCodeVersuch(
  zeile: { wert: string; expiresAt: Date } | null,
  passt: (hash: string) => boolean,
  jetzt: Date
): CodeEntscheidung {
  if (!zeile) return { ergebnis: 'INVALID_OTP', schreiben: 'nichts' }
  const gespeichert = leseCodeWert(zeile.wert)
  if (!gespeichert) return { ergebnis: 'INVALID_OTP', schreiben: 'loeschen' }
  if (zeile.expiresAt.getTime() <= jetzt.getTime()) return { ergebnis: 'OTP_EXPIRED', schreiben: 'loeschen' }
  if (gespeichert.versuche >= ANMELDECODE_MAX_VERSUCHE) return { ergebnis: 'TOO_MANY_ATTEMPTS', schreiben: 'nichts' }
  if (!passt(gespeichert.hash)) return { ergebnis: 'INVALID_OTP', schreiben: { versuche: gespeichert.versuche + 1 } }
  return { ergebnis: 'ok', schreiben: 'verbrauchen' }
}

/**
 * Der Satz für die Kundin — geduzt, ohne Fachwort, mit Ausweg. Wortlaut wie
 * bei der Anmeldung (anmeldeFehlerText), nur ohne „anmelden".
 */
export function bestellCodeFehlerText(fehler: BestellCodeFehler | 'ZU_VIELE' | 'UNBEKANNT'): string {
  switch (fehler) {
    case 'INVALID_OTP':
      return 'Der Code stimmt nicht. Schau noch einmal in die E-Mail oder lass dir einen neuen schicken.'
    case 'OTP_EXPIRED':
      return 'Der Code ist abgelaufen – er gilt 10 Minuten. Lass dir einen neuen schicken.'
    case 'TOO_MANY_ATTEMPTS':
      return 'Du hast den Code zu oft falsch eingegeben. Lass dir einen neuen Code schicken.'
    case 'ZU_VIELE':
      return 'Das waren gerade zu viele Versuche. Warte eine Minute und probier es dann noch einmal.'
    case 'UNBEKANNT':
      return 'Wir konnten deine Bestellungen gerade nicht laden. Probier es gleich noch einmal.'
  }
}

/**
 * Ein ILIKE-Muster, das nur genau diesen Text trifft (ohne Rücksicht auf
 * Groß-/Kleinschreibung). Prisma übersetzt `equals` mit `mode: 'insensitive'`
 * in ein ILIKE OHNE Maskierung — „_" und „%" wären dort Platzhalter. Eine
 * Adresse wie „a_b@example.com" (gültig, „_" ist erlaubt) träfe sonst auch
 * die Bestellungen von „axb@example.com". Gemessen gegen die Test-Datenbank
 * am 05.10.2026 (Bericht Nr. 14).
 */
export function genauesIlikeMuster(text: string): string {
  return text.replace(/[\\%_]/g, (zeichen) => `\\${zeichen}`)
}

// ─── Die Liste ───────────────────────────────────────────────────────────────

/** Eine Bestellung, so weit die Liste sie braucht — Betrag schon in Cent, Link schon signiert. */
export type ListenBestellung = {
  id: string
  /** Signierter Pfad der Bestätigungsseite (bestaetigungsPfad) — nur der Server baut ihn. */
  link: string
  hofName: string
  bestellnummer: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  pickupDate: Date
  pickupTimeStart: string
  pickupTimeEnd: string
  createdAt: Date
  /** Warenpreis + Servicegebühr (Snapshot), in Cent. */
  gesamtCents: number
  artikel: number
}

/** Status, bei denen die Bestellung noch läuft — alles andere ist abgeschlossen. */
export const LAUFENDE_STATUS: readonly OrderStatus[] = ['PENDING_CONFIRMATION', 'PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY']

/**
 * Laufend = aktiver Status UND Abholtag (Wien) heute oder später. Eine
 * Bestellung, deren Abholtag vorbei ist, rutscht nach „Früher", auch wenn der
 * Hof sie nie als abgeholt markiert hat — oben steht, worauf die Kundin
 * gerade wartet.
 */
export function istLaufend(b: Pick<ListenBestellung, 'status' | 'pickupDate'>, jetzt: Date): boolean {
  return LAUFENDE_STATUS.includes(b.status) && kalendertagInWien(b.pickupDate) >= kalendertagInWien(jetzt)
}

/** Laufende oben (nächster Abholtermin zuerst), frühere darunter (neueste Bestellung zuerst). */
export function teileBestellungen<T extends ListenBestellung>(liste: readonly T[], jetzt: Date): { laufend: T[]; frueher: T[] } {
  const laufend = liste
    .filter((b) => istLaufend(b, jetzt))
    .sort(
      (a, b) => a.pickupDate.getTime() - b.pickupDate.getTime() || a.pickupTimeStart.localeCompare(b.pickupTimeStart)
    )
  const frueher = liste.filter((b) => !istLaufend(b, jetzt)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  return { laufend, frueher }
}

export type BestellTon = 'offen' | 'fertig' | 'neutral'

const TON: Record<OrderStatus, BestellTon> = {
  // Die Kundin muss etwas tun (bestätigen bzw. bezahlen): orange.
  PENDING_CONFIRMATION: 'offen',
  PAID: 'fertig',
  CONFIRMED: 'fertig',
  IN_PREPARATION: 'fertig',
  READY: 'fertig',
  // Abgeschlossen — auch storniert: Für „schiefgegangen" gibt es kein Token
  // (DESIGN_SYSTEM, Bericht Nr. 08), die Marke sagt es in Worten.
  PICKED_UP: 'neutral',
  CANCELLED: 'neutral',
  NOT_PICKED_UP: 'neutral',
}

// Fester Wortlaut statt Intl „short": je nach ICU-Stand stünde „Sept." oder „Sep.".
const MONAT_KURZ = ['Jän.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'] as const

/** „26. Sep." im laufenden Jahr, sonst „10. Jän. 2025" — der Wiener Kalendertag. */
function kurzesDatum(zeitpunkt: Date, jetzt: Date): string {
  const [jahr, monat, tag] = kalendertagInWien(zeitpunkt).split('-').map(Number)
  const diesesJahr = Number(kalendertagInWien(jetzt).slice(0, 4))
  return `${tag}. ${MONAT_KURZ[monat - 1]}${jahr === diesesJahr ? '' : ` ${jahr}`}`
}

/** Eine Zeile der Liste, fertig zum Anzeigen. */
export type BestellEintrag = {
  id: string
  link: string
  hofName: string
  bestellnummer: string
  marke: string
  ton: BestellTon
  /** Laufend die Abholzeit („Morgen, 15:00–18:00 Uhr"), früher der Abholtag („26. Sep."). */
  wann: string
  betrag: string
  zahlung: string
  artikel: string
}

/**
 * Was eine Zeile zeigt. Marke aus `bestellStatusAnzeige`, Zahlung aus
 * `zahlungsAnzeige` (dieselben Worte wie auf der Bestellseite), Betrag über
 * `formatEuro` aus ganzen Cent.
 */
export function bestellEintrag(b: ListenBestellung, jetzt: Date, laufend: boolean): BestellEintrag {
  const zahlung = zahlungsAnzeige(b.paymentMethod, b.paymentStatus)
  return {
    id: b.id,
    link: b.link,
    hofName: b.hofName,
    bestellnummer: b.bestellnummer,
    marke: bestellStatusAnzeige(b.status, '', b.paymentMethod).marke,
    ton: TON[b.status] ?? 'neutral',
    wann: laufend ? abholZeitText(b, jetzt) : kurzesDatum(b.pickupDate, jetzt),
    betrag: formatEuro(centsAlsEuro(b.gesamtCents)),
    zahlung: `${zahlung.art} · ${zahlung.zustand}`,
    artikel: mitAnzahl(b.artikel, 'Artikel', 'Artikel'),
  }
}
