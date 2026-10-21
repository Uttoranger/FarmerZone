import { Calendar, Caravan, Tractor, type LucideIcon } from 'lucide-react'

/**
 * Abholhinweise eines Futters (Register N23, Nr. 123; Board
 * system-h5-region-eigene-teile §3): eine feste Auswahl statt Freitext im
 * Untertitel — „Anhänger nötig", „Verladen mit Frontlader", „Abholung nach
 * Absprache". EINE Quelle für Wörter und Symbole: Futter-Formular,
 * Produktdialog, Futterkarte in „Futter kaufen" und Produktseite.
 *
 * Rein, ohne Datenbank: Die Werte spiegeln das Prisma-Enum `Abholhinweis` in
 * derselben Reihenfolge (ein Test hält beide deckungsgleich). Diese Datei läuft
 * auch im Browser — deshalb eigene Literale statt Prisma-Typen.
 */
export const ABHOLHINWEIS_VALUES = ['ANHAENGER_NOETIG', 'FRONTLADER', 'NACH_ABSPRACHE'] as const
export type AbholhinweisValue = (typeof ABHOLHINWEIS_VALUES)[number]

/** Höchstens so viele Hinweise je Produkt — jeder Wert einmal. */
export const ABHOLHINWEISE_MAX = ABHOLHINWEIS_VALUES.length

/** Die Wörter (Wortliste: „Abholhinweis"). */
export const ABHOLHINWEIS_TEXT: Record<AbholhinweisValue, string> = {
  ANHAENGER_NOETIG: 'Anhänger nötig',
  FRONTLADER: 'Verladen mit Frontlader',
  NACH_ABSPRACHE: 'Abholung nach Absprache',
}

/** Die Symbole nach dem Board: Anhänger, Traktor mit Frontlader, Kalender. */
export const ABHOLHINWEIS_SYMBOL: Record<AbholhinweisValue, LucideIcon> = {
  ANHAENGER_NOETIG: Caravan,
  FRONTLADER: Tractor,
  NACH_ABSPRACHE: Calendar,
}

/** Der Abschnitt im Futter-Formular und im Produktdialog. */
export const ABHOLUNG_ABSCHNITT = {
  titel: 'Abholung',
  satz: 'Die Abholzeit wählt die Kundschaft wie immer bei der Bestellung.',
} as const

/**
 * Die Hinweise in der festen Reihenfolge der Auswahl, jeder einmal. So
 * speichert der Server sie — Futterkarte und Produktseite zeigen die
 * Kennzeichen dann überall in derselben Folge, egal in welcher getippt wurde.
 */
export function ordneAbholhinweise(hinweise: readonly AbholhinweisValue[]): AbholhinweisValue[] {
  return ABHOLHINWEIS_VALUES.filter((h) => hinweise.includes(h))
}

/** Ein Hinweis an- oder abwählen (Chips im Formular) — die Liste bleibt geordnet. */
export function schalteAbholhinweis(hinweise: readonly AbholhinweisValue[], hinweis: AbholhinweisValue): AbholhinweisValue[] {
  return hinweise.includes(hinweis) ? hinweise.filter((h) => h !== hinweis) : ordneAbholhinweise([...hinweise, hinweis])
}
