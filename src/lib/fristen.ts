/**
 * Die Fristen einer offenen Bestellung — EINE Stelle für Werte und Rechnung.
 *
 * Der Checkout bucht den Bestand, BEVOR bezahlt (online) oder bestätigt (bar)
 * wird. Ohne Frist hielte eine Bestellung, die nie bezahlt oder bestätigt
 * wird, ihre Ware für immer. Mit Frist verfällt sie und gibt die Ware frei
 * (src/server/verwaiste-bestellungen.ts).
 *
 * Fachlich festgelegt:
 * - Online: 30 Minuten ab Bestellung bis zur Zahlung.
 * - Bar (und Karte vor Ort): 2 Stunden ab Bestellung bis zur Bestätigung per
 *   E-Mail-Link, spätestens bis zum Bestellschluss des gewählten
 *   Abholfensters — was früher eintritt.
 *
 * BESTELLSCHLUSS: Einen eigenen Bestellschluss kennt die App nicht. Gilt
 * deshalb der Beginn des gewählten Abholfensters — danach ergibt eine
 * unbestätigte Bestellung keinen Sinn mehr.
 *
 * DIE FRIST GILT BEIM LESEN, wie bei Reservierungen (src/lib/reservierung.ts):
 * Wer Bestand liest, gibt vorher frei, was verfallen ist. Der tägliche Cron
 * ist nur das Netz darunter.
 *
 * ZEITZONE: Die Abholfenster sind Wiener Ortszeiten („14:00"), der Server
 * läuft in UTC. Alles hier rechnet mit Zeitpunkten und löst Wien über `Intl`
 * auf — auch an den Tagen der Zeitumstellung.
 *
 * Rein und ohne Datenbank: läuft im Server und im Browser
 * (tests/fristen.test.ts).
 */
import type { PaymentMethod } from '@prisma/client'
import { kalendertagInWien } from '@/lib/servicegebuehr'
import { tagVersetzt } from '@/lib/kalender'

export const ZAHLUNGSFRIST_ONLINE_MINUTEN = 30
export const BESTAETIGUNGSFRIST_BAR_MINUTEN = 2 * 60

/** Storno-Grund einer verfallenen Bestellung (Order.cancelReason) — der Hof liest ihn. */
export const GRUND_ZAHLUNG_VERFALLEN = 'Zahlung nicht rechtzeitig abgeschlossen'
export const GRUND_NICHT_BESTAETIGT = 'Nicht rechtzeitig bestätigt'

const MINUTE_MS = 60 * 1000

export type FristBestellung = {
  paymentMethod: PaymentMethod
  createdAt: Date
  /** Der Abholtag, wie der Checkout ihn speichert (12:00 des Tages). */
  pickupDate: Date
  /** Beginn des Abholfensters, Wiener Ortszeit „HH:MM". */
  pickupTimeStart: string
}

/** Wie viele Minuten Wien dem UTC zu diesem Zeitpunkt voraus ist (60 oder 120). */
function wienVorsprungMinuten(zeitpunkt: Date): number {
  const teile = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Vienna',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(zeitpunkt)
  const wert = (typ: string) => Number(teile.find((t) => t.type === typ)?.value)
  const alsWennUtc = Date.UTC(wert('year'), wert('month') - 1, wert('day'), wert('hour'), wert('minute'))
  const aufMinuteGenau = Math.floor(zeitpunkt.getTime() / MINUTE_MS) * MINUTE_MS
  return (alsWennUtc - aufMinuteGenau) / MINUTE_MS
}

/**
 * Kalendertag (JJJJ-MM-TT) und Uhrzeit (HH:MM) in Wien → Zeitpunkt.
 * Zweimal angenähert, damit auch der Tag der Zeitumstellung stimmt: Der
 * Vorsprung wird am Ergebnis gemessen, nicht an der naiven Annahme.
 */
export function wienerZeitpunkt(kalendertag: string, uhrzeit: string): Date | null {
  const tag = /^(\d{4})-(\d{2})-(\d{2})$/.exec(kalendertag)
  const zeit = /^(\d{2}):(\d{2})$/.exec(uhrzeit)
  if (!tag || !zeit) return null
  const [j, m, t] = [Number(tag[1]), Number(tag[2]), Number(tag[3])]
  const [h, min] = [Number(zeit[1]), Number(zeit[2])]
  if (m < 1 || m > 12 || t < 1 || t > 31 || h > 23 || min > 59) return null

  const naiv = Date.UTC(j, m - 1, t, h, min)
  let ergebnis = naiv - wienVorsprungMinuten(new Date(naiv)) * MINUTE_MS
  ergebnis = naiv - wienVorsprungMinuten(new Date(ergebnis)) * MINUTE_MS
  const zeitpunkt = new Date(ergebnis)
  // Plausibilität: Ein 31. Februar o. Ä. landet auf einem anderen Tag.
  if (kalendertagInWien(zeitpunkt) !== kalendertag) return null
  return zeitpunkt
}

/** Der Bestellschluss eines Abholfensters: sein Beginn (siehe Kopf). */
export function bestellschluss(pickupDate: Date, pickupTimeStart: string): Date | null {
  return wienerZeitpunkt(kalendertagInWien(pickupDate), pickupTimeStart)
}

/** Bis wann eine Bestellung bezahlt (online) oder bestätigt (vor Ort) sein muss. */
export function fristVon(bestellung: FristBestellung): Date {
  const bestelltAm = bestellung.createdAt.getTime()
  if (bestellung.paymentMethod === 'ONLINE') {
    return new Date(bestelltAm + ZAHLUNGSFRIST_ONLINE_MINUTEN * MINUTE_MS)
  }
  const zweiStunden = bestelltAm + BESTAETIGUNGSFRIST_BAR_MINUTEN * MINUTE_MS
  const schluss = bestellschluss(bestellung.pickupDate, bestellung.pickupTimeStart)
  return new Date(schluss ? Math.min(zweiStunden, schluss.getTime()) : zweiStunden)
}

/** Ab der Frist (einschließlich) ist eine offene Bestellung verwaist. */
export function istVerwaist(bestellung: FristBestellung, jetzt: Date): boolean {
  return fristVon(bestellung).getTime() <= jetzt.getTime()
}

/** „14:05" — die Uhrzeit in Wien. */
export function uhrzeitInWien(zeitpunkt: Date): string {
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: 'Europe/Vienna',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(zeitpunkt)
}

/**
 * „heute", „morgen" oder „am Samstag, 3. Oktober" — vom Wiener Kalendertag
 * aus. „Morgen" über `tagVersetzt`, nicht über +24 Stunden: In der Nacht der
 * Zeitumstellung hat ein Tag 23 oder 25 Stunden (CODING_STANDARDS §2).
 */
export function tagInWorten(zeitpunkt: Date, jetzt: Date): string {
  const tag = kalendertagInWien(zeitpunkt)
  const heute = kalendertagInWien(jetzt)
  if (tag === heute) return 'heute'
  if (tag === tagVersetzt(heute, 1)) return 'morgen'
  const datum = new Intl.DateTimeFormat('de-AT', {
    timeZone: 'Europe/Vienna',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(zeitpunkt)
  return `am ${datum}`
}

/**
 * „Montag, 5. Oktober, 12:12 Uhr" — fester Tag mit Wochentag in Wiener Zeit.
 * Für Mails: Sie werden später gelesen als verschickt, „heute"/„morgen"
 * (tagInWorten) stimmte nach Mitternacht nicht mehr. Seiten rechnen beim
 * Lesen und dürfen relativ bleiben.
 */
export function zeitpunktFuerMail(zeitpunkt: Date): string {
  const tag = new Intl.DateTimeFormat('de-AT', {
    timeZone: 'Europe/Vienna',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(zeitpunkt)
  return `${tag}, ${uhrzeitInWien(zeitpunkt)} Uhr`
}
