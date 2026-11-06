/**
 * Positionszeile (G14, Lauf 32, Nr. 248): EINE Hilfe für „**4** × Heumilch frisch (1 L)“ in Packliste,
 * Abholzettel, Mails und Verkäufen. Nur Anzeige, ohne Betrag. Die Anzahl steht vorn und kommt als eigenes Teil
 * zurück, damit HTML und Mail sie fett setzen können; `text` ist dieselbe Zeile als reiner Text (Klartext-Mail,
 * Screenreader, Tests).
 *
 * Das Gebinde folgt derselben Regel wie `positionMengeVorn` (format.ts, Kaufstrecke): ohne Einheit keins, beim
 * Stück nur, wenn es mehr als eins ist; ohne Gebindegröße zählt eine Einheit. Hier steht es in Klammern statt nach
 * einem Komma — so zeigen es die Boards des Hofbereichs und der Mails (Abnahme Lauf 31, G14).
 */
import { einheitLabel, formatZahl, gebindeGroesse } from '@/lib/format'

export type Positionszeile = {
  /** „4“ — fett vorn. */
  anzahl: string
  name: string
  /** „1 L“, „6 Pakete“ — ohne Klammern; null, wenn das Gebinde nichts Neues sagt. */
  gebinde: string | null
  /** „4 × Heumilch frisch (1 L)“ */
  text: string
}

export function positionszeile(p: {
  name: string
  quantity: number
  unit?: string | null
  unitSize?: number | { toString(): string } | null
}): Positionszeile {
  const anzahl = formatZahl(p.quantity)
  const name = p.name.trim()
  const gebinde = gebindeText(p.unit ?? null, p.unitSize)
  return { anzahl, name, gebinde, text: `${anzahl} × ${name}${gebinde ? ` (${gebinde})` : ''}` }
}

function gebindeText(unit: string | null, unitSize: number | { toString(): string } | null | undefined): string | null {
  if (!unit) return null
  const groesse = gebindeGroesse(unitSize) ?? 1
  // „3 × Bergkäse (1 Stück)“ sagte nichts Neues.
  if (unit === 'STUECK' && groesse === 1) return null
  return `${formatZahl(groesse)} ${einheitLabel(unit, groesse)}`
}
