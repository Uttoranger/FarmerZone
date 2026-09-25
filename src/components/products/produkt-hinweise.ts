/**
 * Welche Hinweis-Chips ein Produkt in der Produktliste trägt (Sprint
 * Produktformular Nachschliff). Rein, ohne React — die Liste zeigt nur an,
 * was hier entschieden wurde. Hinweise sind nie Fehler: Bestandsprodukte
 * bleiben speicherbar und sichtbar.
 */
import {
  hatUnterkategorien,
  istFuttermittel,
  kategorieVorschlag,
  type KategorieVorschlag,
  type ProductCategoryValue,
  type ProductSubcategoryValue,
} from '@/lib/taxonomie'

export type ProduktHinweis =
  /** Eindeutiger Vorschlag aus dem Namen — ein Tipp übernimmt ihn. */
  | { art: 'kategorie-uebernehmen'; vorschlag: KategorieVorschlag }
  /** Keine Kategorie und kein übernehmbarer Vorschlag — ein Tipp öffnet das Produkt. */
  | { art: 'kategorie-ergaenzen' }
  | { art: 'unterkategorie-ergaenzen' }
  /** Futtermittel mit alter Gebindegröße (Rückfrage F1). */
  | { art: 'einheit-pruefen' }

export function produktHinweise(p: {
  name: string
  category: ProductCategoryValue | null
  subcategory: ProductSubcategoryValue | null
  unitSize: number | null
}): ProduktHinweis[] {
  if (p.category === null) {
    const vorschlag = kategorieVorschlag(p.name)
    // Ein Futtermittel braucht eine Kennzeichnung, die nur der Dialog
    // erfasst — dafür gibt es keinen Ein-Tipp-Weg, nur „ergänzen".
    if (vorschlag && !istFuttermittel(vorschlag.category)) {
      return [{ art: 'kategorie-uebernehmen', vorschlag }]
    }
    return [{ art: 'kategorie-ergaenzen' }]
  }
  const hinweise: ProduktHinweis[] = []
  if (hatUnterkategorien(p.category) && p.subcategory === null) hinweise.push({ art: 'unterkategorie-ergaenzen' })
  if (istFuttermittel(p.category) && p.unitSize != null) hinweise.push({ art: 'einheit-pruefen' })
  return hinweise
}
