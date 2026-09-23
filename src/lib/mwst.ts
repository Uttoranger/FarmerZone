/**
 * MwSt-Vorschlag für ein Produkt (Sprint Bereiche 1, docs/konzepte/bereiche.md §4).
 *
 * Die endgültige Steuerrechnung braucht drei Eingaben — Bereich des Produkts,
 * Besteuerung des Verkäufers (`Farm.besteuerung`, kommt im Steuer-Sprint) und
 * Käuferart (`Order.kaeuferArt`). Diese Funktion verwendet nur die erste und
 * liefert einen Vorschlag, keine Wahrheit.
 *
 * Wofür sie taugt: die Vorbelegung des MwSt-Felds im Produktformular. Wofür
 * NICHT: Rechnungen, Auswertungen, Steuerbeträge. Was eine Bestellung gekostet
 * hat, steht als Snapshot in `OrderItem.vatRate` — nie hier nachrechnen.
 *
 * Rein und ohne Abhängigkeiten; läuft auch im Browser (Produktformular).
 */
import { bereichVon, type Bereich, type ProductCategoryValue } from '@/lib/taxonomie'

/**
 * Standardsatz in Prozent je Bereich. Initial überall 10 —
 * Sätze nach Rücksprache Steuerberater.
 */
export const MWST_STANDARD_JE_BEREICH: Record<Bereich, number> = {
  LEBENSMITTEL: 10,
  FUTTERMITTEL: 10,
  SONSTIGES: 10,
}

/** Der vorgeschlagene MwSt-Satz für eine Kategorie; ohne Kategorie der Satz für Sonstiges. */
export function mwstStandard(l1: ProductCategoryValue | null | undefined): number {
  return MWST_STANDARD_JE_BEREICH[bereichVon(l1)]
}
