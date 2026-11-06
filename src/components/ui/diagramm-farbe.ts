/**
 * Diagrammfarbe (G13, Lauf 32, Nr. 248): die Balken der Wochen- und Umsatzdiagramme (Heute, Auswertung) aus EINER
 * Quelle. Am Tag das Grün der Kundenaktion (`accent`), im Dunkeln das helle Mint (`status-fertig` dunkel) — das
 * dunkle Grün stand dort mit zu wenig Kontrast auf der Karte (Abnahme Lauf 31: „Balken im Dunkeln dunkelgrün,
 * Vergleich kaum sichtbar“). Der Vergleichsbalken ist dieselbe Farbe, deutlich leichter, aber sichtbar.
 *
 * Nur für Balken als Kästen mit Token-Klassen (wie heute in heute-teile.tsx und auswertung-teile.tsx); Recharts
 * braucht Farbsätze in JavaScript (CODING_STANDARDS §7, „Diagramme“). Eigene Datei ohne 'use client', damit auch
 * Server-Komponenten die Klassen bekommen. Die Seiten-Nummern (Heute, Auswertung) ziehen ihre Balken hierher um.
 */
export const DIAGRAMM_BALKEN = 'bg-accent dark:bg-status-fertig'
export const DIAGRAMM_VERGLEICH = 'bg-accent/30 dark:bg-status-fertig/40'
/** Ein Tag ohne Umsatz: nur ein Strich in der Linienfarbe. */
export const DIAGRAMM_LEER = 'bg-border'
