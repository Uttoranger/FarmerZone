/**
 * Kurznummer einer Meldung (G14, Lauf 32, Nr. 248; überall gleich seit Nr. 263, Register N48): kurz, groß
 * geschrieben, aus derselben ID — für die Bestätigung („Deine Kurznummer: …“), Meine Meldungen, Admin › Heute,
 * Postfach und Briefkasten-Ansichten, Mails an den Betrieb und das Nachfragen.
 *
 * Warum das ENDE der ID: Eine cuid beginnt mit „c“ und dem Zeitstempel; die ersten Zeichen sind über Monate
 * gleich („cmw4…“) — als kurze Nummer taugen sie nicht. Das Ende ist der Zufallsteil.
 *
 * Warum sechs Zeichen (Board auf diese Länge angleichen): Aus 36 Zeichen ergeben vier nur 1,7 Mio. Nummern —
 * bei 1.000 Meldungen hätten zwei mit etwa 25 % Wahrscheinlichkeit dieselbe. Sechs ergeben 2,2 Mrd.; dann liegt
 * die Wahrscheinlichkeit bei 1.000 Meldungen bei etwa 0,2 ‰, bei 10.000 um 2 %. Gleich werden können sie trotzdem —
 * darum findet `passtZurKurznummer` ALLE Treffer: Eine Liste zeigt die Auswahl, wer EINE Meldung braucht
 * (`waehleZurKurznummer`), nimmt bei mehreren keine beliebige, sondern meldet `KURZNUMMER_MEHRDEUTIG`.
 *
 * Die alte Nummer (`kurznummer` in meldung.ts, die ersten acht Zeichen) nennen nur noch der CLI-Export
 * (briefkasten-export.ts) und /api/triage — beide bleiben bei ihr (Sperrzone /api, Nr. 263). Die Suche nimmt sie
 * weiter an: Wer sie aus einer früheren Mail abschreibt, findet seine Meldung noch.
 */

export const KURZNUMMER_LAENGE = 6

/** Länge der alten Kurznummer (`kurznummer` in meldung.ts: Anfang der ID). Hier abgeschrieben statt importiert,
 *  damit meldung.ts `kurznummerAus` nutzen kann, ohne dass sich beide Module gegenseitig laden. */
const ALTE_LAENGE = 8

/** Der Satz, wenn eine Kurznummer zu mehreren Meldungen passt — nie wird dann eine beliebige genommen. */
export const KURZNUMMER_MEHRDEUTIG = 'Diese Kurznummer passt zu mehreren Meldungen – gib die volle Nummer ein.'

/** Die Zeichen, aus denen das Ende einer cuid besteht — die Form der Scheinnummer der Bot-Bremse. */
export const CUID_ENDE_ZEICHEN = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** „4F8M2Q“ aus der ID — die letzten sechs Zeichen, groß. Eine kürzere ID bleibt ganz. */
export function kurznummerAus(id: string): string {
  return id.trim().slice(-KURZNUMMER_LAENGE).toUpperCase()
}

/** Eine Eingabe, wie die Suche sie vergleicht: ohne Ränder und führendes „#“, klein geschrieben. */
export function kurznummerEingabe(eingabe: string): string {
  return eingabe.trim().replace(/^#/, '').toLowerCase()
}

/**
 * Passt eine Eingabe zur ID? Die ganze ID oder die Kurznummer, gleich ob groß oder klein, mit Rändern und einem
 * führenden „#“ — nie ein beliebiges Stück der ID (sonst träfe „A“ jede zweite Meldung; unter sechs Zeichen passt
 * nur eine ganze, so kurze ID). Als Übergang auch die alte Nummer aus meldung.ts (genau die ersten acht Zeichen).
 */
export function passtZurKurznummer(id: string, eingabe: string): boolean {
  const wert = kurznummerEingabe(eingabe)
  if (wert === '') return false
  const kennung = id.trim().toLowerCase()
  if (wert === kennung) return true
  if (wert.length === ALTE_LAENGE && wert === kennung.slice(0, ALTE_LAENGE)) return true
  return wert.length === Math.min(KURZNUMMER_LAENGE, kennung.length) && kennung.endsWith(wert)
}

export type KurznummerWahl<T> = { art: 'eine'; meldung: T } | { art: 'keine' } | { art: 'mehrdeutig' }

/**
 * DIE eine Meldung zu einer Eingabe (Admin-Suche, Duplikat-Verweis der Triage): Die volle ID gewinnt immer — sie
 * ist der Ausweg aus „mehrdeutig“. Sonst nach `passtZurKurznummer`; passen mehrere, keine beliebige.
 */
export function waehleZurKurznummer<T extends { id: string }>(kandidaten: readonly T[], eingabe: string): KurznummerWahl<T> {
  const wert = kurznummerEingabe(eingabe)
  const voll = kandidaten.find((k) => k.id.trim().toLowerCase() === wert)
  if (wert !== '' && voll) return { art: 'eine', meldung: voll }
  const treffer = kandidaten.filter((k) => passtZurKurznummer(k.id, eingabe))
  if (treffer.length === 0) return { art: 'keine' }
  if (treffer.length > 1) return { art: 'mehrdeutig' }
  return { art: 'eine', meldung: treffer[0] }
}
