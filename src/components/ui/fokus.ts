/**
 * Der sichtbare Fokus der neuen Bausteine und Shells — ein Rahmen außen in
 * der Ringfarbe (im neuen Design --fz-status-fertig, ≥ 3:1 auf Grund und
 * Fläche in beiden Modi).
 *
 * `focus-visible:outline-solid` ist Pflicht, nicht Zierde: Tailwind 4 setzt
 * mit `outline-none` die Rahmenart auf „none" (über --tw-outline-style), und
 * die Breite im Fokus (outline-2) ändert nur die Breite — der Rahmen bliebe
 * unsichtbar. Genau so war der Fokus in der Hof-Navigation des Bestands
 * verschwunden. tests/fokus-sichtbar.test.ts wacht darüber.
 */
export const FOKUS_RAHMEN =
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring'

/** Dasselbe für Elemente, deren Rahmen innen liegen muss (Zeilen in Listen mit overflow-hidden). */
export const FOKUS_RAHMEN_INNEN =
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring'
