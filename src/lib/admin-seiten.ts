/**
 * Das Muster der Admin-Seiten (Register N15, Nr. 94): Seitenkopf mit Satz ·
 * Kennzahlen · Unterreiter · Inhalt · Regel-Zeile. Hier stehen die Formen, die
 * Fachregeln und Bausteine teilen — die Bausteine selbst liegen in
 * src/components/admin (`Seitenkopf`, `Kennzahlen`, `Unterreiter`).
 *
 * Die Typen liegen in src/lib, weil die Fachregeln einer Seite sie liefern und
 * lib nicht aus components liest (ARCHITECTURE §1). Eine Fachregel sagt nie
 * eine Farbe: Der Ton einer Kachel ist eine Bedeutung aus den Zustandsfarben
 * (Register G5), gezeichnet wird er vom Baustein.
 */
import type { MarkeArt } from '@/lib/marke-art'

/**
 * Der Ton einer Kennzahl: dieselben Bedeutungen wie die Marke (tun — hier
 * wartet etwas auf dich; läuft — es trägt sich), dazu „neutral“ ohne Farbe.
 * Ein Ton steht nur bei Handlungsbedarf; erledigt und abgebrochen sind keine
 * Töne einer Zahl.
 */
export type KennzahlTon = Extract<MarkeArt, 'tun' | 'laeuft'> | 'neutral'

export type KennzahlDaten = {
  id: string
  titel: string
  /** Kürzerer Titel für das Handy, wo drei Kacheln nebeneinander stehen. */
  titelKurz?: string
  /** Die Zahl, fertig geschrieben („2“, „5 frei“, „€ 72,40“). */
  wert: string
  /** Eine leise Zeile darunter. */
  satz?: string
  ton?: KennzahlTon
  /** false = am Handy ausgeblendet (am Handy stehen höchstens drei Kacheln). Standard: sichtbar. */
  amHandy?: boolean
  /** true = der Satz steht auch am Handy; sonst nur ab 768 px. */
  satzAmHandy?: boolean
}

export type UnterreiterDaten = {
  id: string
  label: string
  /** Kurzname für das Handy („Warten“ statt „Warten auf Freischaltung“). */
  labelKurz?: string
  /** Die Adresse mit dem Parameter `reiter`. */
  href: string
  /** Die Zahl in der Pille, fertig geschrieben („2“, „7 / 12“). */
  zahl?: string
}
