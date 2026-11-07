import { Calendar, Caravan, Tractor, type LucideIcon } from 'lucide-react'
import { OPEN_STATUSES } from '@/lib/bestellstatus-offen'

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

// ─── Abholung nach Absprache (Register N47, Nr. 257) ────────────────────────

/**
 * Die Wörter rund um „Abholung nach Absprache" an allen drei Orten (Kasse,
 * Bestätigungsmail, Hofbereich), wörtlich aus N47. „(freiwillig)" ist Hausstil
 * an jedem freiwilligen Feld und bleibt deshalb am Notizfeld stehen.
 */
export const ABSPRACHE_TEXT = {
  kasseHinweis: 'Der Hof meldet sich bei dir, um die Abholung abzustimmen. Wähl trotzdem einen Wunschtermin.',
  notizMitAbsprache: 'Notiz zur Abholung (freiwillig)',
  notizOhneAbsprache: 'Notiz an den Hof (freiwillig)',
  mailMitAntwort: 'Der Hof stimmt die Abholung mit dir ab. Du kannst einfach auf diese Mail antworten.',
  mailOhneAntwort: 'Der Hof stimmt die Abholung mit dir ab und meldet sich bei dir.',
  marke: 'Abholung absprechen',
  anrufen: 'Anrufen',
  mailSchreiben: 'Mail schreiben',
} as const

/**
 * Die EINE Regel für alle drei Orte: Ein Korb bzw. eine Bestellung braucht
 * eine Absprache, sobald mindestens eine Position den Hinweis „Abholung nach
 * Absprache" trägt. Je Position kommen ihre Abholhinweise (fehlt das Produkt
 * oder die Angabe, zählt die Position nicht).
 */
export function brauchtAbsprache(hinweiseJePosition: readonly (readonly string[] | null | undefined)[]): boolean {
  return hinweiseJePosition.some((hinweise) => hinweise?.includes('NACH_ABSPRACHE') === true)
}

/**
 * Dieselbe Regel für den Korb der Kasse: Der Browser kennt nur die IDs im
 * Korb, die Seite lädt die IDs der Produkte mit Absprache auf dem Server.
 */
export function korbBrauchtAbsprache(korb: readonly { productId: string }[], abspracheIds: readonly string[]): boolean {
  return brauchtAbsprache(korb.map((p) => (abspracheIds.includes(p.productId) ? ['NACH_ABSPRACHE'] : [])))
}

/**
 * Zeigt der Hofbereich Marke und Kontakt? Nur bei offenen Bestellungen mit
 * Absprache — abgeholt, storniert oder nicht abgeholt gibt es nichts mehr
 * abzusprechen. Offen heißt dasselbe wie überall im Hofbereich (OPEN_STATUSES).
 */
export function abspracheOffen(status: string, absprache: boolean): boolean {
  const offen: readonly string[] = OPEN_STATUSES
  return absprache && offen.includes(status)
}

/**
 * Der Satz im Abholblock der Bestätigungsmail: Mit „Antwort an" (Hof-E-Mail
 * im Profil) kann die Kundin einfach antworten, sonst meldet sich der Hof.
 */
export function abspracheMailSatz(mitAntwortAn: boolean): string {
  return mitAntwortAn ? ABSPRACHE_TEXT.mailMitAntwort : ABSPRACHE_TEXT.mailOhneAntwort
}
