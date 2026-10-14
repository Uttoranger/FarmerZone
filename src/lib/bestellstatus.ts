// Die Status-Darstellung der Kundinnen-Bestellseite: je Order-Status eine
// Marke (kurzes Wort), ihre Bedeutung und ein erklärender Satz in
// Kundinnen-Sprache.
//
// BEWUSST NEBEN der Hof-Lesart (bestellMarke in src/lib/hof-bestellungen.ts),
// nicht darin: Dieselben Status bedeuten aus beiden Blickwinkeln Verschiedenes.
// Bezahlt heißt für den Hof „Zum Packen" (tun), für die Kundin läuft alles;
// „Wartet auf Kunde" ist für den Hof erledigt, für die Kundin „Bestätigung
// offen" (tun). Auch die Wortwahl trennt sich: „Wartet auf Kunden-Bestätigung"
// ist ein Satz ÜBER die Kundin, „Bitte bestätige…" ist einer AN sie.
//
// Die Bedeutung steht als Art der Marke (Register G5): tun = die Kundin muss
// etwas tun · läuft = alles läuft · erledigt = abgeschlossen (auch „Nicht
// abgeholt", Freigabe Lauf 13) · abgebrochen = storniert. Schrift und Fläche
// dazu sind Tokens in beiden Modi und kommen nur aus dem Baustein Marke — hier
// steht keine Farbe. Bestellseite und „Meine Bestellungen" zeichnen beide aus
// `art` (bestellEintrag in src/lib/bestellungen-finden.ts).
//
// Nur die REAL VORHANDENEN Enum-Werte (prisma OrderStatus, schema.prisma:17)
// — keine erfundenen Zwischenschritte. Zwei davon setzt heute kein Codepfad
// (IN_PREPARATION, NOT_PICKED_UP; siehe order-status.ts), sie können aber
// in Daten stehen und brauchen deshalb trotzdem eine ehrliche Darstellung.

import type { MarkeArt } from '@/lib/marke-art'

export type BestellStatusAnzeige = {
  /** Das kurze Wort auf der Marke, z. B. „Abholbereit". */
  marke: string
  /** Die Bedeutung der Marke (Register G5) — die Farbe zeichnet der Baustein Marke. */
  art: MarkeArt
  /** Ein ganzer Satz an die Kundin — mit dem Abholtermin, wo er hilft. */
  satz: string
}

/**
 * „am Freitag, 4. September zwischen 14:00 und 16:00 Uhr" — der Abholtermin
 * als Satzbaustein. Fest in Wiener Ortszeit aufgelöst, damit der Server
 * (UTC) denselben Wochentag nennt wie der Hof (pickupDate steht auf 12:00,
 * der Kalendertag ist in beiden Zonen derselbe).
 */
export function formatiereAbholtermin(datum: Date, start: string, ende: string): string {
  const tag = datum.toLocaleDateString('de-AT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Vienna',
  })
  return `am ${tag} zwischen ${start} und ${ende} Uhr`
}

/**
 * Marke, Bedeutung und erklärender Satz zu einem Bestellstatus.
 *
 * `abholtermin` ist der fertig formatierte Satzbaustein (formatiereAbholtermin)
 * — die Funktion bleibt damit rein und ohne Datumslogik prüfbar. Ein
 * unbekannter Status (künftiger Enum-Wert) fällt auf eine neutrale,
 * definierte Darstellung zurück statt auf einen Laufzeitfehler.
 *
 * `paymentMethod` entscheidet NUR bei PENDING_CONFIRMATION mit: Auch
 * Online-Bestellungen stehen kurz auf diesem Status (angelegt vor der
 * Zahlung, PAID setzt erst der Stripe-Webhook) — für sie gibt es aber
 * keinen Bestätigungslink, der Satz „bestätige per E-Mail" wäre gelogen.
 */
export function bestellStatusAnzeige(
  status: string,
  abholtermin: string,
  paymentMethod?: string
): BestellStatusAnzeige {
  switch (status) {
    case 'PENDING_CONFIRMATION':
      if (paymentMethod === 'ONLINE') {
        return {
          marke: 'Zahlung offen',
          art: 'tun',
          satz: 'Deine Zahlung ist noch nicht abgeschlossen. Sobald sie bestätigt ist, findest du hier den aktuellen Stand.',
        }
      }
      return {
        marke: 'Bestätigung offen',
        art: 'tun',
        satz: 'Fast geschafft — bitte bestätige deine Bestellung über den Link in deiner E-Mail.',
      }
    case 'PAID':
      return {
        marke: 'Bezahlt',
        art: 'laeuft',
        satz: `Deine Bestellung ist bezahlt und beim Hof eingegangen — abholbar ${abholtermin}.`,
      }
    case 'CONFIRMED':
      return {
        marke: 'Bestätigt',
        art: 'laeuft',
        satz: `Deine Bestellung ist verbindlich bestätigt — abholbar ${abholtermin}, bezahlt wird bei der Abholung.`,
      }
    case 'IN_PREPARATION':
      return {
        marke: 'In Vorbereitung',
        art: 'laeuft',
        satz: `Der Hof stellt deine Bestellung gerade zusammen — abholbar ${abholtermin}.`,
      }
    case 'READY':
      return {
        marke: 'Abholbereit',
        art: 'laeuft',
        satz: `Dein Paket wartet — abholbar ${abholtermin}.`,
      }
    case 'PICKED_UP':
      return {
        marke: 'Abgeholt',
        art: 'erledigt',
        satz: 'Abgeholt — danke für deinen Einkauf!',
      }
    case 'CANCELLED':
      return {
        marke: 'Storniert',
        art: 'abgebrochen',
        satz: 'Diese Bestellung wurde storniert. Bei Fragen hilft dir der Hof direkt weiter.',
      }
    case 'NOT_PICKED_UP':
      return {
        marke: 'Nicht abgeholt',
        art: 'erledigt',
        satz: 'Diese Bestellung wurde nicht abgeholt. Melde dich beim Hof, wenn du dazu Fragen hast.',
      }
    default:
      return {
        marke: 'Bestellung',
        art: 'erledigt',
        satz: 'Den aktuellen Stand deiner Bestellung erfährst du direkt beim Hof.',
      }
  }
}

/**
 * Zahlungsart und -zustand in Kundinnen-Sprache. paymentLabel im
 * Bauern-Bereich (order-status.ts) sagt „Online (Stripe)" — der Kundin ist
 * der Dienstleister egal, deshalb eigene Worte statt Wiederverwendung.
 */
export function zahlungsAnzeige(
  paymentMethod: string,
  paymentStatus: string
): { art: string; zustand: string } {
  const art =
    paymentMethod === 'ONLINE'
      ? 'Online'
      : paymentMethod === 'ONSITE_CASH'
        ? 'Bar bei Abholung'
        : paymentMethod === 'ONSITE_CARD'
          ? 'Karte bei Abholung'
          : paymentMethod
  const zustand =
    paymentStatus === 'PAID'
      ? 'Bezahlt'
      : paymentStatus === 'PENDING'
        ? 'Noch offen'
        : paymentStatus === 'FAILED'
          ? 'Fehlgeschlagen'
          : paymentStatus === 'REFUNDED'
            ? 'Rückerstattet'
            : paymentStatus
  return { art, zustand }
}
