import {
  barZuKassierenCents,
  gebuehrEntfallen,
  type BestellungFuerGebuehrStatus,
  type BestellungMitGebuehr,
} from '@/lib/servicegebuehr'
import { gebuehrBezeichnungFuer, istHofpreisBestellung } from '@/lib/plattformgebuehr'

/*
 * Abholzettel (Nr. 249b): Titel des Kastens unter „Gesamt“ und der Satz zur Gebühr.
 * NUR ANZEIGE — der Betrag kommt unverändert aus `barZuKassierenCents` (Snapshot); hier wird nichts
 * gerechnet, nur gewählt, welches Wort darüber steht.
 */

export type DruckKasse = {
  /** „Bar zu kassieren“, „Zu kassieren“ (Karte bei Abholung, Altbestand) oder „Nichts zu kassieren“. */
  titel: 'Bar zu kassieren' | 'Zu kassieren' | 'Nichts zu kassieren'
  /** Der Betrag aus barZuKassierenCents; null bei „Nichts zu kassieren“ — dann steht kein Betrag da. */
  cents: number | null
}

/**
 * Was der Kasten unter „Gesamt“ sagt (Antwort 8 der Projektleitung, 7.11.2026). Online: kein Kasten (null).
 * Nicht abgeholt, storniert oder mit entfallener Gebühr gibt es nichts mehr zu kassieren — der Snapshot-
 * Betrag bliebe dort stehen und läse sich wie eine offene Forderung. Storniert zählt auch ohne
 * Erstattungszeitpunkt (Altbestand ohne Gebühr), weil eine stornierte Bestellung nie kassiert wird.
 */
export function druckKasse(
  bestellung: BestellungMitGebuehr & Pick<BestellungFuerGebuehrStatus, 'status' | 'paymentMethod' | 'serviceFeeRefundedAt'>
): DruckKasse | null {
  const cents = barZuKassierenCents(bestellung)
  if (cents === null) return null
  if (bestellung.status === 'NOT_PICKED_UP' || bestellung.status === 'CANCELLED' || gebuehrEntfallen(bestellung)) {
    return { titel: 'Nichts zu kassieren', cents: null }
  }
  // Mit Karte zahlt niemand bar — „Bar zu kassieren“ wäre bei diesem Altbestand falsch.
  if (bestellung.paymentMethod === 'ONSITE_CARD') return { titel: 'Zu kassieren', cents }
  return { titel: 'Bar zu kassieren', cents }
}

/**
 * Der Satz zur Gebühr unter dem Zettel — nur im Hofpreis-Modell, und nur, wenn das gezeigte „Gesamt“ die
 * Gebühr wirklich enthält (Gebühr > 0, nicht entfallen). Er spricht vom Gesamt, nicht von „Preisen“: Die
 * Positionen stehen mit dem Warenpreis aus dem Snapshot, also OHNE Gebühr (Mangel Zwischen-Durchgang A,
 * druck Bild 1: Positionen € 12,20, Gesamt € 12,95). Positionen inkl. Gebühr umzurechnen wäre eine neue
 * Geldrechnung. Das Wort kommt aus gebuehrBezeichnungFuer, nie fest.
 */
export function druckGesamtHinweis(
  bestellung: { gebuehrModell: string | null } & Pick<BestellungFuerGebuehrStatus, 'serviceFeeCents' | 'serviceFeeRefundedAt'>
): string | null {
  if (!istHofpreisBestellung(bestellung) || bestellung.serviceFeeCents <= 0 || gebuehrEntfallen(bestellung)) return null
  return `Gesamt inkl. ${gebuehrBezeichnungFuer(bestellung)}.`
}
