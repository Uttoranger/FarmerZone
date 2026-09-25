/**
 * Tests für kategorieVorschlag (src/lib/taxonomie.ts, Sprint Produktformular
 * Nachschliff).
 *
 * Beweist: Ein Vorschlag kommt nur bei genau einem eindeutigen Treffer;
 * Unterkategorien gehen vor Kategorien; Synonyme zählen nur als ganzes Wort;
 * allgemeine Unterkategorien (Bio, Freiland) brauchen ihre Kategorie im Namen;
 * Dual-Use-Wörter verhindern jeden Vorschlag.
 */
import { describe, it, expect } from 'vitest'
import { kategorieVorschlag } from '@/lib/taxonomie'

describe('kategorieVorschlag — eindeutige Treffer', () => {
  it('„Lammfleisch" → Fleisch › Lamm (Label am Wortanfang)', () => {
    expect(kategorieVorschlag('Lammfleisch')).toEqual({ category: 'FLEISCH', subcategory: 'LAMM' })
  })

  it('„Wiesenheu 1. Schnitt" → Heu & Stroh › Wiesenheu', () => {
    expect(kategorieVorschlag('Wiesenheu 1. Schnitt')).toEqual({ category: 'HEU_STROH', subcategory: 'WIESENHEU' })
  })

  it('„Bio-Eier" → Eier › Bio', () => {
    expect(kategorieVorschlag('Bio-Eier')).toEqual({ category: 'EIER', subcategory: 'EIER_BIO' })
  })

  it('„Bio-Lammfleisch" → Fleisch › Lamm, nicht Eier › Bio', () => {
    expect(kategorieVorschlag('Bio-Lammfleisch')).toEqual({ category: 'FLEISCH', subcategory: 'LAMM' })
  })

  it('„Heumilch" → Milch › Trinkmilch (Synonym geht vor dem Kategorie-Label „Heu")', () => {
    expect(kategorieVorschlag('Heumilch')).toEqual({ category: 'MILCH', subcategory: 'TRINKMILCH' })
  })

  it('„Heuballen" → Heu & Stroh › Wiesenheu', () => {
    expect(kategorieVorschlag('Heuballen')).toEqual({ category: 'HEU_STROH', subcategory: 'WIESENHEU' })
  })

  it('„Heu" als ganzes Wort → Heu & Stroh › Wiesenheu', () => {
    expect(kategorieVorschlag('Heu vom Hang')).toEqual({ category: 'HEU_STROH', subcategory: 'WIESENHEU' })
  })

  it('Umlaute werden normalisiert: „Kaese" und „Käse" treffen gleich', () => {
    expect(kategorieVorschlag('Bergkäse')).toBeNull()
    expect(kategorieVorschlag('Käse vom Hof')).toEqual({ category: 'MILCH', subcategory: 'KAESE' })
    expect(kategorieVorschlag('Kaese vom Hof')).toEqual({ category: 'MILCH', subcategory: 'KAESE' })
  })

  it('nur ein Kategorie-Treffer → Kategorie ohne Unterkategorie', () => {
    expect(kategorieVorschlag('Freilandeier')).toBeNull()
    expect(kategorieVorschlag('Eier vom Hof')).toEqual({ category: 'EIER', subcategory: null })
  })

  it('zwei Unterkategorien derselben Kategorie → nur die Kategorie', () => {
    expect(kategorieVorschlag('Lamm-Wurst')).toEqual({ category: 'FLEISCH', subcategory: null })
  })
})

describe('kategorieVorschlag — kein Vorschlag', () => {
  it('„Hafer" und „Haferflocken" → nichts (Dual-Use)', () => {
    expect(kategorieVorschlag('Hafer')).toBeNull()
    expect(kategorieVorschlag('Haferflocken')).toBeNull()
  })

  it('Dual-Use gewinnt auch gegen andere Treffer', () => {
    expect(kategorieVorschlag('Erdäpfel')).toBeNull()
    expect(kategorieVorschlag('Kartoffel-Speck')).toBeNull()
    expect(kategorieVorschlag('Maisstroh')).toBeNull()
  })

  it('„Gartenzwerg" → nichts', () => {
    expect(kategorieVorschlag('Gartenzwerg')).toBeNull()
  })

  it('leerer Name → nichts', () => {
    expect(kategorieVorschlag('')).toBeNull()
    expect(kategorieVorschlag('  - ')).toBeNull()
  })

  it('„Bio" allein → nichts: allgemeine Unterkategorien brauchen ihre Kategorie', () => {
    expect(kategorieVorschlag('Bio')).toBeNull()
    expect(kategorieVorschlag('Freiland-Hendl')).toEqual({ category: 'FLEISCH', subcategory: 'HAEHNCHEN' })
  })

  it('kurze Schlüssel nur als ganzes Wort — „Heurigenbrot" ist kein Heu', () => {
    expect(kategorieVorschlag('Heurigenbrot')).toBeNull()
    expect(kategorieVorschlag('Heute frisch')).toBeNull()
    expect(kategorieVorschlag('Heurigen-Brot')).toEqual({ category: 'BROT', subcategory: null })
  })

  it('Treffer in zwei Kategorien → nichts', () => {
    expect(kategorieVorschlag('Lamm mit Käse')).toBeNull()
  })
})
