/**
 * Was die Bestätigungsseite (/{hof}/confirm/{id}) über den Stand einer
 * Bestellung sagt — AUSSCHLIESSLICH aus der Datenbank.
 *
 * Vorher steuerten ?confirmed=true und ?redirect_status=succeeded die Anzeige:
 * Wer die Adresse abtippte oder ein Lesezeichen setzte, sah „bestätigt" oder
 * „Zahlung erfolgreich", obwohl nichts bestätigt oder bezahlt war. Stripes
 * redirect_status ist hier nur noch ein Hinweis: „succeeded" heißt „Zahlung
 * wird geprüft", solange der Webhook den Stand noch nicht geschrieben hat;
 * „failed" bietet den neuen Versuch an. Nie macht er eine Bestellung bezahlt.
 *
 * Rein, ohne Datenbank (tests/bestaetigung.test.ts).
 */
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client'
import { GRUND_NICHT_BESTAETIGT, fristVon, tagInWorten, uhrzeitInWien, type FristBestellung } from '@/lib/fristen'
import { kalendertagInWien } from '@/lib/servicegebuehr'
import { tagVersetzt } from '@/lib/kalender'
import { bestellStatusAnzeige } from '@/lib/bestellstatus'

export type BestaetigungsZustand =
  | 'bezahlt'
  | 'zahlung-wird-geprueft'
  | 'zahlung-fehlgeschlagen'
  | 'bestaetigt'
  | 'bestaetigung-offen'
  | 'verfallen'

/** Vor Ort: bestätigt ist alles zwischen Bestätigung und Abholung. */
const VOR_ORT_BESTAETIGT: readonly OrderStatus[] = ['CONFIRMED', 'IN_PREPARATION', 'READY', 'PICKED_UP']

export function bestaetigungsZustand(
  order: { paymentMethod: PaymentMethod; paymentStatus: PaymentStatus; status: OrderStatus; cancelReason: string | null },
  redirectStatus: string | undefined
): BestaetigungsZustand | null {
  if (order.paymentMethod === 'ONLINE') {
    // Storniert (Frist vorbei, Hof) — weder ein Hinweis aus der URL noch ein
    // stehengebliebenes PAID (Erstattung noch nicht durch) macht daraus „bezahlt".
    if (order.status === 'CANCELLED') return null
    if (order.paymentStatus === 'PAID') return 'bezahlt'
    if (order.paymentStatus === 'FAILED' || redirectStatus === 'failed') return 'zahlung-fehlgeschlagen'
    if (redirectStatus === 'succeeded' || redirectStatus === 'processing') return 'zahlung-wird-geprueft'
    return null
  }
  if (order.status === 'CANCELLED') {
    return order.cancelReason === GRUND_NICHT_BESTAETIGT ? 'verfallen' : null
  }
  if (order.status === 'PENDING_CONFIRMATION') return 'bestaetigung-offen'
  return VOR_ORT_BESTAETIGT.includes(order.status) ? 'bestaetigt' : null
}

// ─── Nr. 13: Status-Schritte, Kopf und Blöcke der Bestätigungsseite ─────────
//
// Alles aus dem Datenbankstand, rein und ohne Uhr: `jetzt` kommt als
// Parameter (die Seite bestimmt es einmal). Die Komponenten zeigen nur an.

export type SchrittStand = 'erledigt' | 'naechster' | 'offen'

export type BestellSchritt = {
  id: 'bestellt' | 'bezahlt' | 'bestaetigt' | 'gepackt' | 'abgeholt'
  titel: string
  /** Kurz und eine Zeile: Uhrzeit, Frist oder Abholfenster — leer, wo nichts zu sagen ist. */
  zusatz: string
  stand: SchrittStand
}

export type SchrittBestellung = FristBestellung & {
  paymentStatus: PaymentStatus
  status: OrderStatus
  pickupTimeEnd: string
}

/** Online zählt als bezahlt, sobald der Webhook PAID geschrieben hat oder der Hof schon weiter ist. */
const ONLINE_BEZAHLT: readonly OrderStatus[] = ['PAID', 'IN_PREPARATION', 'READY', 'PICKED_UP']
const GEPACKT: readonly OrderStatus[] = ['READY', 'PICKED_UP']
const WOCHENTAG_KURZ = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'] as const

/**
 * „heute", „morgen" oder „Sa., 10.10." — der Wiener Kalendertag, kurz genug
 * für eine Schrittzeile am Handy (vier Schritte nebeneinander bei 390 px).
 */
function kurzerTag(zeitpunkt: Date, jetzt: Date): string {
  const tag = kalendertagInWien(zeitpunkt)
  const heute = kalendertagInWien(jetzt)
  if (tag === heute) return 'heute'
  if (tag === tagVersetzt(heute, 1)) return 'morgen'
  const [jahr, monat, tagImMonat] = tag.split('-').map(Number)
  // Fester Wortlaut statt Intl „short": je nach ICU-Stand steht dort „Sa" oder „Sa.".
  const wochentag = WOCHENTAG_KURZ[new Date(Date.UTC(jahr, monat - 1, tagImMonat)).getUTCDay()]
  return `${wochentag}, ${tagImMonat}.${monat}.`
}

/** „12:12 Uhr" am selben Tag, sonst „morgen, 00:30 Uhr" — sonst läse sich eine Frist nach Mitternacht wie heute. */
function fristKurz(frist: Date, jetzt: Date): string {
  const tag = kalendertagInWien(frist) === kalendertagInWien(jetzt) ? '' : `${kurzerTag(frist, jetzt)}, `
  return `${tag}${uhrzeitInWien(frist)} Uhr`
}

/**
 * Die Schritte einer Bestellung: Bestellt → Bezahlt (online) bzw. Bestätigt
 * (vor Ort) → Gepackt → Abgeholt. Storniert oder nicht abgeholt gibt es keine
 * Schritte (null): Ein halb gefüllter Fortschritt täuschte vor, es ginge
 * weiter. Der erste offene Schritt ist „naechster" — das ist, worauf die
 * Kundin gerade wartet.
 */
export function bestellSchritte(order: SchrittBestellung, jetzt: Date): BestellSchritt[] | null {
  if (order.status === 'CANCELLED' || order.status === 'NOT_PICKED_UP') return null

  const online = order.paymentMethod === 'ONLINE'
  const zweiterErledigt = online
    ? order.paymentStatus === 'PAID' || ONLINE_BEZAHLT.includes(order.status)
    : VOR_ORT_BESTAETIGT.includes(order.status)
  const gepackt = GEPACKT.includes(order.status)
  const abgeholt = order.status === 'PICKED_UP'
  const abholTag = kurzerTag(order.pickupDate, jetzt)

  const roh: Array<Omit<BestellSchritt, 'stand'> & { erledigt: boolean }> = [
    {
      id: 'bestellt',
      titel: 'Bestellt',
      zusatz: `${kurzerTag(order.createdAt, jetzt)}, ${uhrzeitInWien(order.createdAt)} Uhr`,
      erledigt: true,
    },
    {
      id: online ? 'bezahlt' : 'bestaetigt',
      titel: online ? 'Bezahlt' : 'Bestätigt',
      // Die Frist, bis zu der gezahlt bzw. bestätigt sein muss — dieselbe
      // Rechnung, nach der die Bestellung verfällt (fristen.ts).
      zusatz: zweiterErledigt ? '' : `bis ${fristKurz(fristVon(order), jetzt)}`,
      erledigt: zweiterErledigt,
    },
    {
      id: 'gepackt',
      titel: 'Gepackt',
      zusatz: gepackt ? '' : `bis ${order.pickupTimeStart} Uhr`,
      erledigt: gepackt,
    },
    {
      id: 'abgeholt',
      titel: 'Abgeholt',
      zusatz: abgeholt ? '' : `${abholTag}, ${order.pickupTimeStart}–${order.pickupTimeEnd} Uhr`,
      erledigt: abgeholt,
    },
  ]

  const naechster = roh.findIndex((s) => !s.erledigt)
  return roh.map(({ erledigt, ...schritt }, i) => ({
    ...schritt,
    stand: erledigt ? 'erledigt' : i === naechster ? 'naechster' : 'offen',
  }))
}

export type BestaetigungsKopf = {
  /** Grün = alles läuft, Orange = die Kundin muss etwas tun oder warten, neutral = abgeschlossen. */
  ton: 'gruen' | 'orange' | 'neutral'
  symbol: 'haken' | 'uhr' | 'kreuz' | 'info'
  titel: string
  satz: string
}

export type KopfBestellung = {
  status: OrderStatus
  paymentMethod: PaymentMethod
  customerEmail: string
  hofName: string
}

/** Überschrift für Bestellungen, die stehen — sie folgt dem Status, nicht dem Zeitpunkt des Besuchs. */
function titelLaufend(status: OrderStatus): string {
  if (status === 'READY') return 'Deine Bestellung liegt bereit'
  if (status === 'PICKED_UP') return 'Abgeholt – danke für deinen Einkauf!'
  return 'Danke, deine Bestellung ist da!'
}

/** Wie es weitergeht, wenn die Bestellung steht — ohne Datum (das steht in den Schritten). */
function weiter(order: KopfBestellung): string {
  if (order.status === 'READY') return `Sie liegt bei ${order.hofName} für dich bereit.`
  if (order.status === 'PICKED_UP') return 'Schön, dass du direkt beim Hof eingekauft hast.'
  return `${order.hofName} packt sie für dich.`
}

/**
 * Überschrift und Satz der Seite. „Zahlung erfolgreich" und „Bestellung
 * bestätigt" stehen nur in den Zuständen, die die Datenbank so sagt
 * (bestaetigungsZustand) — nie aus einem URL-Parameter.
 */
export function bestaetigungsKopf(zustand: BestaetigungsZustand | null, order: KopfBestellung): BestaetigungsKopf {
  switch (zustand) {
    case 'bezahlt':
      return {
        ton: 'gruen',
        symbol: 'haken',
        titel: titelLaufend(order.status),
        satz: `Zahlung erfolgreich. ${weiter(order)} Die Bestätigung ist unterwegs an ${order.customerEmail}.`,
      }
    case 'bestaetigt':
      return {
        ton: 'gruen',
        symbol: 'haken',
        titel: titelLaufend(order.status),
        satz: `Bestellung bestätigt. ${weiter(order)} Bezahlt wird ${
          order.paymentMethod === 'ONSITE_CARD' ? 'mit Karte' : 'bar'
        } bei der Abholung.`,
      }
    case 'zahlung-wird-geprueft':
      return {
        ton: 'orange',
        symbol: 'uhr',
        titel: 'Zahlung wird geprüft',
        satz: 'Das dauert meist nur ein paar Sekunden. Lade die Seite gleich neu – sobald die Zahlung bestätigt ist, siehst du es hier und bekommst eine E-Mail.',
      }
    case 'zahlung-fehlgeschlagen':
      return {
        ton: 'orange',
        symbol: 'kreuz',
        titel: 'Zahlung fehlgeschlagen',
        satz: 'Bitte versuche es erneut oder wähle eine andere Zahlungsart.',
      }
    case 'bestaetigung-offen':
      return {
        ton: 'orange',
        symbol: 'uhr',
        titel: 'Fast geschafft – bitte bestätige per E-Mail',
        satz: `Wir haben dir an ${order.customerEmail} einen Link geschickt. Erst mit deiner Bestätigung packt ${order.hofName} deine Bestellung.`,
      }
    case 'verfallen':
      return {
        ton: 'neutral',
        symbol: 'uhr',
        titel: 'Bestellung verfallen',
        satz: 'Die Bestellung wurde nicht rechtzeitig bestätigt. Wir haben die Ware wieder freigegeben – dir entstehen keine Kosten.',
      }
  }
  // Kein Zustand der Bestätigung: der Satz der Bestellseite (bestellstatus.ts),
  // damit beide Seiten dasselbe sagen.
  const anzeige = bestellStatusAnzeige(order.status, '', order.paymentMethod)
  if (order.status === 'CANCELLED') return { ton: 'neutral', symbol: 'kreuz', titel: 'Bestellung storniert', satz: anzeige.satz }
  if (order.status === 'NOT_PICKED_UP') return { ton: 'neutral', symbol: 'info', titel: 'Nicht abgeholt', satz: anzeige.satz }
  if (order.status === 'PENDING_CONFIRMATION') return { ton: 'orange', symbol: 'uhr', titel: anzeige.marke, satz: anzeige.satz }
  return { ton: 'neutral', symbol: 'info', titel: 'Deine Bestellung', satz: anzeige.satz }
}

export type BestaetigungsBloecke = {
  /** Bestellnummer, Abholung, „Route planen". */
  abholkarte: boolean
  /** „In den Kalender" — erst, wenn die Bestellung steht (bezahlt bzw. bar bestätigt). */
  kalender: boolean
  /** Bar offen: bis wann bestätigt sein muss. */
  fristHinweis: boolean
  /** „Erzähl's weiter" — nur, wenn die Bestellung wirklich steht. */
  teilen: boolean
  /** Die eine Hauptaktion (grün); „keine" heißt: die Aktion steckt in der Mail. */
  aktion: 'bestellung' | 'neu-bestellen' | 'erneut-versuchen' | 'keine'
}

/**
 * Gibt es zu diesem Bestellstatus einen Abholtermin für den Kalender? Nur,
 * solange die Bestellung steht und die Abholung noch aussteht (Nr. 19b) —
 * dieselbe Antwort für den Knopf auf der Bestätigungsseite und für die
 * ICS-Route, die ein Link auch ohne Knopf erreicht. Eine offene Bestellung
 * (PENDING_CONFIRMATION) bekommt keinen: Vor ihrer Frist (fristen.ts) ist
 * sie noch nicht bezahlt bzw. bestätigt, danach verfallen — gilt beim Lesen,
 * ohne auf den Cron zu warten. Storniert, abgeholt, nicht abgeholt: kein
 * Termin mehr.
 */
export function kalenderTerminGilt(status: OrderStatus): boolean {
  return status === 'PAID' || status === 'CONFIRMED' || status === 'IN_PREPARATION' || status === 'READY'
}

/** Welche Teile die Seite zeigt — eine Stelle statt Bedingungen im JSX. */
export function bestaetigungsBloecke(zustand: BestaetigungsZustand | null, status: OrderStatus): BestaetigungsBloecke {
  const steht = zustand === 'bezahlt' || zustand === 'bestaetigt'
  const laeuft = steht || zustand === 'zahlung-wird-geprueft'
  return {
    abholkarte: laeuft && status !== 'CANCELLED',
    // Nicht schon bei „Zahlung wird geprüft": Scheitert die Zahlung, stünde ein
    // Termin im Kalender, den es nicht gibt.
    kalender: steht && kalenderTerminGilt(status),
    fristHinweis: zustand === 'bestaetigung-offen',
    teilen: steht && status !== 'CANCELLED' && status !== 'NOT_PICKED_UP',
    aktion:
      zustand === 'verfallen'
        ? 'neu-bestellen'
        : zustand === 'zahlung-fehlgeschlagen'
          ? 'erneut-versuchen'
          : zustand === 'bestaetigung-offen' || zustand === null
            ? 'keine'
            : 'bestellung',
  }
}

/**
 * „Heute, 15:00–18:00 Uhr" bzw. „Samstag, 10. Oktober, 15:00–18:00 Uhr" —
 * der Abholtermin als Zeile, vom Wiener Kalendertag aus (tagInWorten).
 */
export function abholZeitText(
  order: { pickupDate: Date; pickupTimeStart: string; pickupTimeEnd: string },
  jetzt: Date
): string {
  const tag = tagInWorten(order.pickupDate, jetzt).replace(/^am /, '')
  return `${tag.charAt(0).toUpperCase()}${tag.slice(1)}, ${order.pickupTimeStart}–${order.pickupTimeEnd} Uhr`
}
