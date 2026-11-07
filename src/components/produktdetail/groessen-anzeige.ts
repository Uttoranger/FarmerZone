import { formatEuro, formatZahl } from '@/lib/format'

/*
 * Anzeige-Hilfen der Produktseite nach der Abnahme Lauf 32 (Nr. 252, Liste
 * lauf32-board-oder-code.md, Abschnitt produkt). Nur Text und Reihenfolge —
 * gerechnet wird nichts: Preise kommen fertig, Vorrat und Zustand aus
 * kartenZustand (src/lib/bereiche-anzeige.ts).
 */

type GroesseMitMenge = {
  unitSize: number | null
  futter: { nettoMenge: number | { toString(): string } | null } | null
}

/** Die Menge eines Gebindes zum Sortieren: Nettomenge bei Futter, sonst die Gebindegröße; ohne Angabe ans Ende. */
function sortierMenge(p: GroesseMitMenge): number {
  const roh = p.futter?.nettoMenge ?? p.unitSize
  if (roh === null || roh === undefined) return Number.POSITIVE_INFINITY
  const menge = typeof roh === 'number' ? roh : Number.parseFloat(roh.toString())
  return Number.isFinite(menge) ? menge : Number.POSITIVE_INFINITY
}

/**
 * Die Größen von klein nach groß (Board s1-/w1-produkt Bild 1: Sack → Big Bag → Lose).
 * Stabil: Gleich große Größen behalten die Reihenfolge des Hofs. Eine eigene
 * Reihenfolge des Hofs (sortOrder) kennt die öffentliche Abfrage nicht — siehe
 * Bericht Nr. 252.
 */
export function groessenAufsteigend<P extends GroesseMitMenge>(familie: readonly P[]): P[] {
  return familie
    .map((p, i) => ({ p, i, menge: sortierMenge(p) }))
    .sort((a, b) => a.menge - b.menge || a.i - b.i)
    .map((x) => x.p)
}

/**
 * Der Vorrat in der Größenzeile (G5, Board: „€ 0,51 / kg · 14 da“): die Zahl
 * der Gebinde mit „da“, knapp mit „nur noch“. Leer (ausverkauft) sagt die
 * Zeile selbst „gerade nicht da“; ohne Vorrat-Text (Pause) bleibt es leer.
 */
export function groessenVorrat(stock: number, zustand: 'normal' | 'knapp' | 'ausverkauft', mitVorrat: boolean): string | undefined {
  if (!mitVorrat || zustand === 'ausverkauft') return undefined
  const zahl = formatZahl(Math.max(0, stock))
  return zustand === 'knapp' ? `nur noch ${zahl} da` : `${zahl} da`
}

/** Raummaße ausgeschrieben (E11, Wortliste): „je Raummeter“ statt „/ rm“ — Raummeter ist nicht m³. */
const RAUMMASS_JE: Record<string, string> = {
  RAUMMETER: 'je Raummeter',
  SCHUETTRAUMMETER: 'je Schüttraummeter',
}

/**
 * „€ 100,70 je Raummeter“ — nur für ein Raummaß ohne Gebinde; sonst null (dann gilt formatGrundpreis). Der Preis
 * kommt schon als Anzeigepreis (mitEndpreis, N38) von der Produktseite — hier wird nur formatiert.
 */
export function preisJeRaummass(price: number, unit: string, unitSize: number | null): string | null {
  const je = RAUMMASS_JE[unit]
  if (!je || (unitSize !== null && unitSize !== 1)) return null
  return `${formatEuro(price)} ${je}`
}

/** Die Erklärzeile unter dem Preis (Board s1-/w1-produkt Bild 3), eine Quelle je Raummaß. */
export const RAUMMASS_ZEILE: Record<string, string> = {
  RAUMMETER: '1 Raummeter = 1 m × 1 m × 1 m geschlichtetes Holz mit Zwischenräumen.',
  SCHUETTRAUMMETER: '1 Schüttraummeter = 1 m × 1 m × 1 m lose geschüttetes Holz.',
}

/** Der Satz der Karte „Gerade ausverkauft“, wörtlich nach der Liste: „<Hof> hat gerade kein <Produkt>. Schau, was es sonst gibt.“ */
export function ausverkauftSatz(hofName: string, produktName: string): string {
  return `${hofName} hat gerade kein ${produktName}. Schau, was es sonst gibt.`
}
