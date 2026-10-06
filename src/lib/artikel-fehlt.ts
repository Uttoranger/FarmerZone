/**
 * „Artikel fehlt" (E14, docs/entscheidungen.md; Rechenregeln wörtlich in
 * docs/nachtlauf/freigabe.md 1a) — EINE Rechnung für den Dialog (was der Hof
 * vor dem Speichern sieht) und für die Servergrenze (was danach gebucht und
 * erstattet wird). Rein, in ganzen Cent; Decimal → Cent wandelt die
 * Servergrenze (`alsCents`).
 *
 * Grundsatz: Die Servicegebühr gilt nur für das, was übergeben wird. Sie wird
 * auf den verbleibenden Warenwert mit derselben Regel wie beim Bestellen neu
 * berechnet (berechneServicegebuehr: Satz der Bestellung, aufrunden,
 * Mindestgebühr). Der Hof verliert nie mehr als den Preis des fehlenden
 * Artikels.
 *
 *   bar/vor Ort  neuer Betrag = verbleibender Warenwert + neue Gebühr; keine
 *                Erstattung. Die Monatsabrechnung nimmt die neue Gebühr.
 *   online       Kundin bekommt Artikelpreis + Gebührendifferenz zurück; vom
 *                Hof wird GENAU der Artikelpreis zurückgeholt (Rückbuchung mit
 *                festem Betrag); die Differenz trägt die einbehaltene Gebühr.
 *
 * Jede Rechnung geht vom AKTUELLEN Stand der Bestellung aus (Warenpreis und
 * Gebühr nach früheren fehlenden Artikeln). Weil die Erstattung immer
 * Artikelpreis + (alte − neue Gebühr) ist und die neue Gebühr nie über der
 * alten liegt, ist nach jedem Schritt
 *   bezahlt = aktueller Warenpreis + aktuelle Gebühr + bisher erstattet
 * — die Summe der Erstattungen übersteigt nie den bezahlten Betrag.
 */
import { formatEuro } from '@/lib/format'
import {
  SERVICEGEBUEHR_STANDARD_MIND_CENTS,
  berechneServicegebuehr,
  centsAlsEuro,
  istVorOrtZahlung,
} from '@/lib/servicegebuehr'
import { onlineBezahlt } from '@/lib/storno'

/** Aus diesen Status darf der Hof einen Artikel als fehlend melden — solange nichts übergeben ist. */
export const ARTIKEL_FEHLT_STATUS: readonly string[] = ['PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY']

/** Der Stand einer Bestellung, so weit ihn die Rechnung braucht — alle Beträge in Cent. */
export type ArtikelFehltBestellung = {
  status: string
  paymentMethod: string
  paymentStatus: string
  stripePaymentIntentId: string | null
  /** Order.totalAmount — der AKTUELLE Warenpreis (ohne schon fehlende Artikel). */
  warenpreisCents: number
  /** Order.serviceFeeCents — die AKTUELLE Gebühr. */
  serviceFeeCents: number
  /** Order.serviceFeePercentApplied — Satz der Bestellung; null bei 0 Cent. */
  serviceFeePercentApplied: number | null
  /** Order.serviceFeeMinCentsApplied — Mindestgebühr der Bestellung; null bei Altbestellungen. */
  serviceFeeMinCentsApplied: number | null
  /** Order.erstattetCents — bisher erstattet (nur online). */
  erstattetCents: number
  positionen: ReadonlyArray<{ id: string; betragCents: number; fehlt: boolean }>
}

export type ArtikelFehltAblehnung = 'position_unbekannt' | 'schon_fehlend' | 'status' | 'nicht_bezahlt'

export type ArtikelFehltTeil = {
  art: 'teil'
  zahlung: 'online' | 'vor_ort'
  /** Preis der fehlenden Position (Snapshot `OrderItem.totalPrice`). */
  artikelCents: number
  bisherWarenCents: number
  bisherGebuehrCents: number
  neuWarenCents: number
  neuGebuehrCents: number
  /** Was die Kundin danach insgesamt zahlt — bar: der neue Betrag zum Kassieren. */
  neuGesamtCents: number
  gebuehrDifferenzCents: number
  /** Online: Artikelpreis + Gebührendifferenz; vor Ort 0. */
  erstattungCents: number
  /** Online: genau der Artikelpreis; vor Ort 0. */
  vomHofCents: number
}

export type ArtikelFehltErgebnis =
  | { art: 'abgelehnt'; grund: ArtikelFehltAblehnung }
  /** Fehlt der letzte Artikel, ist es ein normaler Storno (cancelOrder). */
  | { art: 'storno' }
  | ArtikelFehltTeil

/*
 * Für berechneServicegebuehr: Die Regel der Bestellung GALT schon — ob sie
 * gilt, hat der Checkout entschieden (sonst wäre die Gebühr 0 und es bleibt
 * bei 0). Ein fester Zeitpunkt hält die Funktion rein.
 */
const REGEL_GALT = new Date(0)

function gebuehrNachRegel(warenCents: number, prozent: number, mindestCents: number): number {
  return berechneServicegebuehr(
    warenCents,
    { serviceFeePercent: prozent, serviceFeeMinCents: mindestCents, serviceFeeActiveFrom: REGEL_GALT },
    REGEL_GALT
  ).gebuehrCents
}

/**
 * Die Gebühr auf den verbleibenden Warenwert — mit Satz und Mindestgebühr DER
 * BESTELLUNG, nie mit der heutigen Hofeinstellung (E4: gespeicherte Beträge
 * werden nicht neu berechnet; E14 rechnet nur die Bemessungsgrundlage neu).
 *
 * Altbestellungen ohne Snapshot der Mindestgebühr (`serviceFeeMinCentsApplied`
 * null, vor Nr. 19): Lag die gezahlte Gebühr über dem Prozentanteil, WAR sie
 * die Mindestgebühr — dann gilt genau sie. Sonst die Mindestgebühr nach E4
 * (€ 0,50). In jedem Fall nie über der bisherigen Gebühr: Für weniger Ware
 * zahlt niemand mehr Gebühr, und der Hof verliert nie mehr als den Artikel.
 */
export function neueServicegebuehrCents(
  restWarenCents: number,
  b: Pick<ArtikelFehltBestellung, 'warenpreisCents' | 'serviceFeeCents' | 'serviceFeePercentApplied' | 'serviceFeeMinCentsApplied'>
): number {
  if (b.serviceFeeCents <= 0) return 0
  const prozent = b.serviceFeePercentApplied ?? 0
  const mindest =
    b.serviceFeeMinCentsApplied ??
    (b.serviceFeeCents > gebuehrNachRegel(b.warenpreisCents, prozent, 0)
      ? b.serviceFeeCents
      : SERVICEGEBUEHR_STANDARD_MIND_CENTS)
  return Math.min(gebuehrNachRegel(restWarenCents, prozent, mindest), b.serviceFeeCents)
}

/** Was „Artikel fehlt" für diese Position bedeutet — vom aktuellen Stand aus. */
export function artikelFehltRechnung(b: ArtikelFehltBestellung, positionId: string): ArtikelFehltErgebnis {
  if (!ARTIKEL_FEHLT_STATUS.includes(b.status)) return { art: 'abgelehnt', grund: 'status' }
  const position = b.positionen.find((p) => p.id === positionId)
  if (!position) return { art: 'abgelehnt', grund: 'position_unbekannt' }
  if (position.fehlt) return { art: 'abgelehnt', grund: 'schon_fehlend' }

  const online = !istVorOrtZahlung(b.paymentMethod)
  if (online && !onlineBezahlt(b)) return { art: 'abgelehnt', grund: 'nicht_bezahlt' }

  const bleibt = b.positionen.filter((p) => !p.fehlt && p.id !== positionId)
  if (bleibt.length === 0) return { art: 'storno' }

  const artikelCents = position.betragCents
  // Aus dem aktuellen Warenpreis, nicht aus der Summe der übrigen Positionen:
  // Beides ist gleich, solange niemand an den Snapshots dreht — der Warenpreis
  // ist aber der Betrag, den Stripe und die Monatsabrechnung kennen.
  const neuWarenCents = Math.max(0, b.warenpreisCents - artikelCents)
  const neuGebuehrCents = neueServicegebuehrCents(neuWarenCents, b)
  const gebuehrDifferenzCents = b.serviceFeeCents - neuGebuehrCents

  return {
    art: 'teil',
    zahlung: online ? 'online' : 'vor_ort',
    artikelCents,
    bisherWarenCents: b.warenpreisCents,
    bisherGebuehrCents: b.serviceFeeCents,
    neuWarenCents,
    neuGebuehrCents,
    neuGesamtCents: neuWarenCents + neuGebuehrCents,
    gebuehrDifferenzCents,
    erstattungCents: online ? artikelCents + gebuehrDifferenzCents : 0,
    vomHofCents: online ? artikelCents : 0,
  }
}

const euro = (cents: number): string => formatEuro(centsAlsEuro(cents))

export type ArtikelFehltZeilen = {
  bisher: { text: string; betrag: string }
  neu: { text: string; betrag: string }
  saetze: string[]
}

/**
 * Der Betragsblock im Dialog: bar „bisher → neu zu kassieren", online „wer
 * bekommt was zurück und was wird vom Hof abgezogen". Gerechnet hat
 * `artikelFehltRechnung`; hier stehen nur die Worte.
 */
export function artikelFehltZeilen(r: ArtikelFehltErgebnis, kundenVorname: string): ArtikelFehltZeilen | null {
  if (r.art !== 'teil') return null
  if (r.zahlung === 'vor_ort') {
    return {
      bisher: { text: 'Bar zu kassieren bisher', betrag: euro(r.bisherWarenCents + r.bisherGebuehrCents) },
      neu: {
        text: `Neu: Warenpreis ${euro(r.neuWarenCents)} + Servicegebühr ${euro(r.neuGebuehrCents)}`,
        betrag: euro(r.neuGesamtCents),
      },
      saetze: r.neuGebuehrCents > 0 ? ['Die Monatsabrechnung nimmt die neue Servicegebühr.'] : [],
    }
  }
  const zusammensetzung =
    r.gebuehrDifferenzCents > 0
      ? `Artikel ${euro(r.artikelCents)} + Servicegebühr ${euro(r.gebuehrDifferenzCents)} – die Gebühr gilt nur noch für ${euro(r.neuWarenCents)} Ware.`
      : `Genau der Preis des Artikels, ${euro(r.artikelCents)}.`
  return {
    bisher: { text: `${kundenVorname} bekommt zurück`, betrag: euro(r.erstattungCents) },
    neu: { text: 'Von deiner nächsten Auszahlung abgezogen', betrag: euro(r.vomHofCents) },
    saetze: [
      zusammensetzung,
      r.gebuehrDifferenzCents > 0
        ? 'Das ist genau der Preis des fehlenden Artikels. Den Unterschied bei der Servicegebühr erstattet FarmerZone.'
        : 'Das ist genau der Preis des fehlenden Artikels.',
    ],
  }
}
