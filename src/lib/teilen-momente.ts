/**
 * Die Teilen-Momente des Hofs und ihr Schalter (Gate 7 Aufgabe 5, Nachtlauf
 * Nr. 30) — rein, ohne Datenbank und ohne Browser-Speicher
 * (tests/teilen-momente.test.ts).
 *
 * Drei Momente fragen den Hof, ob er teilen will: „freigeschaltet" (Heute,
 * src/lib/freischalt-moment.ts), „wieder da" und „gespeichert" (Produkte,
 * src/lib/produkte-hof.ts). Jeder fragt höchstens einmal je Anlass, und der
 * Hof kann alle drei auf einmal abschalten: `Farm.teilenMomenteAus`
 * (/settings/teilen, Action setzeTeilenMomente). Den Schalter liest der
 * Server und gibt ihn mit der Seite mit; jede „…Moeglich"-Regel verlangt ihn
 * als Pflichtfeld, damit kein Moment ihn übergehen kann.
 *
 * Mit dem Teilen-Kanal (T1) hat das nichts zu tun: Hier wird nichts über
 * Kundinnen gezählt oder gespeichert.
 */

export const TEILEN_MOMENTE_PFAD = '/settings/teilen'
export const TEILEN_MOMENTE_TITEL = 'Teilen-Hinweise'
export const TEILEN_MOMENTE_SATZ =
  'Wenn dein Hof online geht, du ein neues Produkt anlegst oder etwas wieder da ist, fragen wir dich einmal, ob du es teilen willst.'
export const TEILEN_MOMENTE_SCHALTER = 'Teilen-Hinweise zeigen'

/** Der Satz unter dem Moment „gespeichert" (Mockup mobil-h2-gespeichert-teilen). */
export const GESPEICHERT_HINWEIS = 'Fragt nur einmal pro Produkt. Abschalten unter Einstellungen.'

/** Dürfen überhaupt Momente kommen? false, sobald der Hof sie abgeschaltet hat. */
export function teilenMomenteAn(hof: { teilenMomenteAus: boolean }): boolean {
  return !hof.teilenMomenteAus
}

/** Die Zeile in der Übersicht der Einstellungen. */
export function teilenMomenteZeile(aus: boolean): string {
  return aus ? 'Aus · wir fragen nicht, ob du teilen willst' : 'An · wir fragen einmal, ob du teilen willst'
}

/** Die Rückmeldung nach dem Umschalten. */
export function teilenMomenteMeldung(an: boolean): string {
  return an ? 'Teilen-Hinweise sind an' : 'Teilen-Hinweise sind aus'
}
