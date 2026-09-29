/**
 * Was eine Zeile der Produktliste in „Mein Hof" zeigt — Chips, Filter und der
 * Bestandsschritt. Rein und ohne Datenbank prüfbar (tests/produkt-zeile.test.ts);
 * die Liste (components/products/product-list.tsx) zeigt nur an.
 *
 * DER NORMALFALL TRÄGT KEINEN CHIP. Neben dem Schalter steht fest „Im Shop";
 * ein grünes „Aktiv" in jeder Zeile sagte dasselbe noch einmal und ließ die
 * Abweichungen („Ausverkauft", „Wenig Bestand") in der Menge untergehen.
 * Chips gibt es nur, wenn etwas anders ist als üblich — und für die
 * Eigenschaften, die Kundinnen suchen (Bio, Kühlung), mit Wort statt Symbol:
 * Ein Blatt oder eine Schneeflocke allein las am Telefon niemand.
 */
import { produktZustand, NICHT_IM_SHOP } from '@/lib/produkt-sichtbarkeit'
import { anzeigeBereichVon, type ProductCategoryValue } from '@/lib/taxonomie'
import type { SchildFarbe } from '@/lib/mein-hof'

export type ZeilenChip = { text: string; farbe: SchildFarbe }

type ZeilenProdukt = {
  isAvailable: boolean
  stock: number
  isOrganic: boolean
  requiresCool: boolean
  requiresFreezer: boolean
}

/**
 * Die Chips einer Produktzeile, Zustand zuerst, dann die Eigenschaften.
 * Der Zustand kommt aus `produktZustand` — „Nicht im Shop" sticht
 * „Ausverkauft" dort, also hier auch.
 */
export function zeilenChips(p: ZeilenProdukt): ZeilenChip[] {
  const chips: ZeilenChip[] = []
  const zustand = produktZustand(p)
  if (zustand.art === 'nicht-im-shop') chips.push({ text: NICHT_IM_SHOP, farbe: 'grau' })
  if (zustand.art === 'ausverkauft') chips.push({ text: 'Ausverkauft', farbe: 'rot' })
  if (zustand.art === 'knapp') chips.push({ text: 'Wenig Bestand', farbe: 'bernstein' })
  if (p.isOrganic) chips.push({ text: 'Bio', farbe: 'gruen' })
  // Tiefkühlung schließt Kühlung ein — beides nebeneinander wäre doppelt.
  // Grau: Kühlung ist eine Eigenschaft, kein Zustand; ein Blau wäre eine neue
  // Bedeutungsfarbe (CODING_STANDARDS §7, nur nach Rückfrage).
  if (p.requiresFreezer) chips.push({ text: 'Tiefkühlung', farbe: 'grau' })
  else if (p.requiresCool) chips.push({ text: 'Kühlung', farbe: 'grau' })
  return chips
}

export const PRODUKT_FILTER = [
  { id: 'alle', label: 'Alle' },
  { id: 'hofladen', label: 'Hofladen' },
  { id: 'futter', label: 'Futter' },
  { id: 'nicht-im-shop', label: NICHT_IM_SHOP },
  { id: 'ausverkauft', label: 'Ausverkauft' },
] as const

export type ProduktFilter = (typeof PRODUKT_FILTER)[number]['id']

type FilterProdukt = { isAvailable: boolean; stock: number; category: ProductCategoryValue | null }

/**
 * Gehört ein Produkt in den Filter? Der Bereich kommt aus `anzeigeBereichVon`
 * (ein Produkt ohne Kategorie steht damit im Hofladen, wie auf der Hofseite);
 * „Ausverkauft" ist derselbe Zustand wie der Chip — ein ausgeblendetes Produkt
 * ohne Bestand zählt dort nicht, es steht unter „Nicht im Shop".
 */
export function passtZuFilter(p: FilterProdukt, filter: ProduktFilter): boolean {
  switch (filter) {
    case 'alle':
      return true
    case 'hofladen':
      return anzeigeBereichVon(p.category) === 'LEBENSMITTEL'
    case 'futter':
      return anzeigeBereichVon(p.category) === 'FUTTERMITTEL'
    case 'nicht-im-shop':
      return produktZustand(p).art === 'nicht-im-shop'
    case 'ausverkauft':
      return produktZustand(p).art === 'ausverkauft'
  }
}

/** Die Zahl hinter jedem Filter-Chip — aus der geladenen Liste, ohne eigene Abfrage. */
export function zaehleFilter(produkte: readonly FilterProdukt[]): Record<ProduktFilter, number> {
  const zahlen = {} as Record<ProduktFilter, number>
  for (const f of PRODUKT_FILTER) {
    zahlen[f.id] = produkte.filter((p) => passtZuFilter(p, f.id)).length
  }
  return zahlen
}

/**
 * Der Bestand nach einem Tipp auf „−" oder „+". Nie unter 0: Ein negativer
 * Bestand hieße für den Checkout „mehr verkauft als da" (CLAUDE.md, Geld und
 * Bestellungen). Die Aktion klemmt auf dem Server ebenso.
 */
export function bestandNach(aktuell: number, delta: number): number {
  return Math.max(0, aktuell + delta)
}

/** „−" ist bei 0 gesperrt — ein Tipp, der nichts ändert, sähe aus wie ein Fehler. */
export function kannVerringern(aktuell: number): boolean {
  return aktuell > 0
}
