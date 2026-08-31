// Die Status-Darstellung der Kundinnen-Bestellseite: je Order-Status eine
// Marke (kurzes Wort auf farbiger Fläche), die Farbklassen dazu und ein
// erklärender Satz in Kundinnen-Sprache.
//
// BEWUSST NEBEN src/components/orders/order-status.ts (Bauern-Bereich), nicht
// darin: Dieselben Status bedeuten aus beiden Blickwinkeln Verschiedenes.
// Für den Bauern ist READY erledigte Arbeit (dort grau „fertig"), für die
// Kundin ist READY der Höhepunkt — jetzt hinfahren (hier kräftig grün).
// Auch die Wortwahl trennt sich: „Wartet auf Kunden-Bestätigung" ist ein
// Satz ÜBER die Kundin, „Bitte bestätige…" ist einer AN sie.
//
// Farbwelt wie die Referenz-19-Marken des Bauern-Bereichs: Orange auf
// #FBEEE3 = die Kundin muss etwas tun · Grün auf #E8F0E2 = alles läuft ·
// #9AA08F auf #F0EDE5 = abgeschlossen · Rot = storniert/nicht abgeholt.
//
// Nur die REAL VORHANDENEN Enum-Werte (prisma OrderStatus, schema.prisma:17)
// — keine erfundenen Zwischenschritte. Zwei davon setzt heute kein Codepfad
// (IN_PREPARATION, NOT_PICKED_UP; siehe order-status.ts:40), sie können aber
// in Daten stehen und brauchen deshalb trotzdem eine ehrliche Darstellung.

export type BestellStatusAnzeige = {
  /** Das kurze Wort auf der Marke, z. B. „Abholbereit". */
  marke: string
  /** Tailwind-Klassen für die Marken-Fläche (Hintergrund + Text). */
  farbe: string
  /** Ein ganzer Satz an die Kundin — mit dem Abholtermin, wo er hilft. */
  satz: string
}

const ORANGE = 'bg-[#FBEEE3] text-[#E8854A]'
const FERTIG = 'bg-[#F0EDE5] text-[#9AA08F]'
const ROT = 'bg-red-100 text-red-700'

/** Das Grün der laufenden Bestellung — exportiert, weil die Abholtermin-Marke
 *  der Hofübersicht (Teil desselben Gestaltungs-Elements) dieselbe Fläche
 *  trägt und die Farbe nicht zweimal definiert sein soll. */
export const MARKE_GRUEN = 'bg-[#E8F0E2] text-[#2D5F3F]'
const GRUEN = MARKE_GRUEN

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
 * Marke, Farbe und erklärender Satz zu einem Bestellstatus.
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
          farbe: ORANGE,
          satz: 'Deine Zahlung ist noch nicht abgeschlossen. Sobald sie bestätigt ist, findest du hier den aktuellen Stand.',
        }
      }
      return {
        marke: 'Bestätigung offen',
        farbe: ORANGE,
        satz: 'Fast geschafft — bitte bestätige deine Bestellung über den Link in deiner E-Mail.',
      }
    case 'PAID':
      return {
        marke: 'Bezahlt',
        farbe: GRUEN,
        satz: `Deine Bestellung ist bezahlt und beim Hof eingegangen — abholbar ${abholtermin}.`,
      }
    case 'CONFIRMED':
      return {
        marke: 'Bestätigt',
        farbe: GRUEN,
        satz: `Deine Bestellung ist verbindlich bestätigt — abholbar ${abholtermin}, bezahlt wird bei der Abholung.`,
      }
    case 'IN_PREPARATION':
      return {
        marke: 'In Vorbereitung',
        farbe: GRUEN,
        satz: `Der Hof stellt deine Bestellung gerade zusammen — abholbar ${abholtermin}.`,
      }
    case 'READY':
      return {
        marke: 'Abholbereit',
        farbe: GRUEN,
        satz: `Dein Paket wartet — abholbar ${abholtermin}.`,
      }
    case 'PICKED_UP':
      return {
        marke: 'Abgeholt',
        farbe: FERTIG,
        satz: 'Abgeholt — danke für deinen Einkauf!',
      }
    case 'CANCELLED':
      return {
        marke: 'Storniert',
        farbe: ROT,
        satz: 'Diese Bestellung wurde storniert. Bei Fragen hilft dir der Hof direkt weiter.',
      }
    case 'NOT_PICKED_UP':
      return {
        marke: 'Nicht abgeholt',
        farbe: ROT,
        satz: 'Diese Bestellung wurde nicht abgeholt. Melde dich beim Hof, wenn du dazu Fragen hast.',
      }
    default:
      return {
        marke: 'Bestellung',
        farbe: FERTIG,
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
