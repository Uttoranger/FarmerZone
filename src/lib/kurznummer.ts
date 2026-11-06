/**
 * Kurznummer einer Meldung (G14, Lauf 32, Nr. 248): kurz, groß geschrieben, aus derselben ID — für die Bestätigung
 * („Deine Kurznummer: …“), Listen, Mails an den Betrieb und das Nachfragen.
 *
 * Warum das ENDE der ID: Eine cuid beginnt mit „c“ und dem Zeitstempel; die ersten Zeichen sind über Monate
 * gleich („cmw4…“) — als kurze Nummer taugen sie nicht. Das Ende ist der Zufallsteil.
 *
 * Warum sechs Zeichen (Board auf diese Länge angleichen): Aus 36 Zeichen ergeben vier nur 1,7 Mio. Nummern —
 * bei 1.000 Meldungen hätten zwei mit etwa 25 % Wahrscheinlichkeit dieselbe. Sechs ergeben 2,2 Mrd.; dann liegt
 * die Wahrscheinlichkeit bei 1.000 Meldungen bei etwa 0,2 ‰, bei 10.000 um 2 %. Gleich werden können sie trotzdem —
 * darum findet `passtZurKurznummer` ALLE Treffer, und wer sucht, zeigt bei mehr als einem die Auswahl.
 *
 * Neben `kurznummer` (meldung.ts, die ersten acht Zeichen; Admin, CLI) — die Seiten-Nummern ziehen um.
 */
export const KURZNUMMER_LAENGE = 6

/** „4F8M2Q“ aus der ID — die letzten sechs Zeichen, groß. Eine kürzere ID bleibt ganz. */
export function kurznummerAus(id: string): string {
  return id.trim().slice(-KURZNUMMER_LAENGE).toUpperCase()
}

/**
 * Passt eine Eingabe zur ID? Die ganze ID oder die Kurznummer, gleich ob groß oder klein, mit Rändern und einem
 * führenden „#“ — nie ein beliebiges Stück der ID (sonst träfe „A“ jede zweite Meldung).
 */
export function passtZurKurznummer(id: string, eingabe: string): boolean {
  const wert = eingabe.trim().replace(/^#/, '').toLowerCase()
  if (wert === '') return false
  const kennung = id.trim().toLowerCase()
  if (wert === kennung) return true
  return wert.length === Math.min(KURZNUMMER_LAENGE, kennung.length) && kennung.endsWith(wert)
}
