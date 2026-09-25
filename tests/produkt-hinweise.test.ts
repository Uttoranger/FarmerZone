/**
 * Tests für produktHinweise (src/components/products/produkt-hinweise.ts,
 * Sprint Produktformular Nachschliff) — die Chips in der Produktliste.
 */
import { describe, it, expect } from 'vitest'
import { produktHinweise } from '@/components/products/produkt-hinweise'

const produkt = { name: 'Gartenzwerg', category: null, subcategory: null, unitSize: null }

describe('produktHinweise', () => {
  it('ohne Kategorie mit eindeutigem Vorschlag: „… übernehmen"', () => {
    expect(produktHinweise({ ...produkt, name: 'Lammfleisch' })).toEqual([
      { art: 'kategorie-uebernehmen', vorschlag: { category: 'FLEISCH', subcategory: 'LAMM' } },
    ])
  })

  it('ohne Kategorie und ohne Vorschlag: „Kategorie ergänzen"', () => {
    expect(produktHinweise(produkt)).toEqual([{ art: 'kategorie-ergaenzen' }])
    expect(produktHinweise({ ...produkt, name: 'Hafer' })).toEqual([{ art: 'kategorie-ergaenzen' }])
  })

  it('ein Futtermittel-Vorschlag wird nie mit einem Tipp übernommen — die Kennzeichnung fehlt', () => {
    expect(produktHinweise({ ...produkt, name: 'Heuballen' })).toEqual([{ art: 'kategorie-ergaenzen' }])
  })

  it('Futtermittel mit alter Gebindegröße: „Einheit prüfen"', () => {
    const altfall = { name: 'Heu', category: 'HEU_STROH' as const, subcategory: 'WIESENHEU' as const, unitSize: 50 }
    expect(produktHinweise(altfall)).toEqual([{ art: 'einheit-pruefen' }])
    expect(produktHinweise({ ...altfall, unitSize: null })).toEqual([])
  })

  it('Lebensmittel mit Gebinde bekommen keinen Einheit-Hinweis, aber weiter „Unterkategorie ergänzen"', () => {
    expect(produktHinweise({ name: 'Rindfleisch', category: 'FLEISCH', subcategory: null, unitSize: 2 })).toEqual([
      { art: 'unterkategorie-ergaenzen' },
    ])
  })
})
