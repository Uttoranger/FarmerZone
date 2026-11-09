/*
 * Die Stile der Liste von Mein Hof › Hofseite — EINE Quelle für die Liste unter
 * lg (abschnitte-liste.tsx) und den Editor ab lg (hofseite-editor.tsx), nach den
 * Boards s1-/w1-mein-hof (Nr. 274): Gruppen-Überschrift 13 px fett in Großbuchstaben,
 * Zeilen 56 px mit Titel 15 px fett und Wert 13 px, ohne Symbol; der
 * Fortschrittsbalken 8 px in der Farbe „läuft“ (im Dunkeln hell, wie im Board).
 */

/** Die Überschrift einer Gruppe („Oben auf der Seite“, „Aktuell vom Hof“). */
export const MEIN_HOF_GRUPPE_TITEL = 'px-1 pt-3.5 pb-2 text-[13px] font-bold tracking-[0.04em] text-muted-foreground uppercase'

/** Der Titel einer Zeile. */
export const MEIN_HOF_ZEILE_TITEL = 'text-[15px] leading-snug font-semibold text-foreground'

/** Der Wert unter dem Titel. */
export const MEIN_HOF_ZEILE_WERT = 'text-[13px] text-muted-foreground'

/** Die Spur des Fortschrittsbalkens. */
export const FORTSCHRITT_SPUR = 'h-2 overflow-hidden rounded-[4px] bg-muted'

/** Der gefüllte Teil: `zustand-laeuft` — am Tag dunkelgrün, im Dunkeln hellgrün (Liste Lauf 32 mein-hof, Abnahme 13). */
export const FORTSCHRITT_FUELLUNG = 'h-full bg-zustand-laeuft'
