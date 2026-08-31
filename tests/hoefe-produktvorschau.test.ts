/**
 * Tests für die Produktvorschau der Hofkarten: die reine Auswahl
 * (waehleVorschauProdukte in src/lib/hofuebersicht.ts) und das geteilte
 * Preisformat (src/lib/preis-format.ts), das die Vorschau mit der
 * öffentlichen Hofseite gemeinsam hat.
 */
import { describe, it, expect } from 'vitest'
import {
  produktInitiale,
  waehleVorschauProdukte,
  type VorschauProdukt,
} from '@/lib/hofuebersicht'
import { formatEuro, formatPrice } from '@/lib/preis-format'

function p(teil: Partial<VorschauProdukt> & { id: string }): VorschauProdukt {
  return {
    name: `Produkt ${teil.id}`,
    price: 5,
    unit: 'STUECK',
    unitSize: null,
    imageUrl: null,
    category: null,
    verfuegbar: true,
    ...teil,
  }
}

describe('waehleVorschauProdukte — die Auswahl fürs Schaufenster', () => {
  it('drei verfügbare Produkte: genau diese, in gegebener Reihenfolge', () => {
    const produkte = [p({ id: 'a' }), p({ id: 'b' }), p({ id: 'c' })]
    const vorschau = waehleVorschauProdukte(produkte, [], 3)

    expect(vorschau.produkte.map((x) => x.id)).toEqual(['a', 'b', 'c'])
    expect(vorschau.weitere).toBe(0)
  })

  it('Mischung: verfügbare Produkte stehen vorn', () => {
    const produkte = [
      p({ id: 'aus1', verfuegbar: false }),
      p({ id: 'da1' }),
      p({ id: 'aus2', verfuegbar: false }),
      p({ id: 'da2' }),
    ]
    const vorschau = waehleVorschauProdukte(produkte, [], 4)

    expect(vorschau.produkte.map((x) => x.id)).toEqual(['da1', 'da2', 'aus1'])
    expect(vorschau.weitere).toBe(1)
  })

  it('alles ausverkauft: drei ausverkaufte, gekennzeichnet — kein leeres Schaufenster', () => {
    const produkte = [
      p({ id: 'a', verfuegbar: false }),
      p({ id: 'b', verfuegbar: false }),
      p({ id: 'c', verfuegbar: false }),
      p({ id: 'd', verfuegbar: false }),
    ]
    const vorschau = waehleVorschauProdukte(produkte, [], 4)

    expect(vorschau.produkte).toHaveLength(3)
    expect(vorschau.produkte.every((x) => !x.verfuegbar)).toBe(true)
  })

  it('mehr als drei: die Restzahl stimmt — und zählt ALLE Produkte des Hofes, nicht nur die geladenen', () => {
    // Die Query lädt höchstens acht Zeilen; die Gesamtzahl kommt getrennt.
    const produkte = Array.from({ length: 8 }, (_, i) => p({ id: `p${i}` }))
    const vorschau = waehleVorschauProdukte(produkte, [], 20)

    expect(vorschau.produkte).toHaveLength(3)
    expect(vorschau.weitere).toBe(17)
  })

  it('keine Produkte: leer, und keine „+ n weitere"-Zeile', () => {
    const vorschau = waehleVorschauProdukte([], [], 0)

    expect(vorschau.produkte).toEqual([])
    expect(vorschau.weitere).toBe(0)
  })

  it('nie eine negative Restzahl, auch wenn die Gesamtzahl kleiner ist als die Liste', () => {
    expect(waehleVorschauProdukte([p({ id: 'a' })], [], 0).weitere).toBe(0)
  })
})

describe('waehleVorschauProdukte — der Kategoriefilter zieht Passendes nach vorn', () => {
  const SORTIMENT = [
    p({ id: 'milch1', category: 'MILCH' }),
    p({ id: 'brot1', category: 'BROT' }),
    p({ id: 'honig1', category: 'HONIG' }),
    p({ id: 'brot2', category: 'BROT' }),
  ]

  it('gewählte Kategorie zuerst, fremde füllen die restlichen Plätze', () => {
    const vorschau = waehleVorschauProdukte(SORTIMENT, ['BROT'], 4)

    expect(vorschau.produkte.map((x) => x.id)).toEqual(['brot1', 'brot2', 'milch1'])
  })

  it('Mehrfachauswahl zieht alle passenden nach vorn', () => {
    const vorschau = waehleVorschauProdukte(SORTIMENT, ['HONIG', 'BROT'], 4)

    expect(vorschau.produkte.map((x) => x.id).slice(0, 3)).toEqual(['brot1', 'honig1', 'brot2'])
  })

  it('innerhalb der passenden gilt weiter: verfügbar vor ausverkauft', () => {
    const produkte = [
      p({ id: 'brotAus', category: 'BROT', verfuegbar: false }),
      p({ id: 'brotDa', category: 'BROT' }),
      p({ id: 'milch', category: 'MILCH' }),
    ]
    const vorschau = waehleVorschauProdukte(produkte, ['BROT'], 3)

    expect(vorschau.produkte.map((x) => x.id)).toEqual(['brotDa', 'brotAus', 'milch'])
  })

  it('ohne Filter bleibt die Reihenfolge der Hofseite unangetastet', () => {
    const vorschau = waehleVorschauProdukte(SORTIMENT, [], 4)

    expect(vorschau.produkte.map((x) => x.id)).toEqual(['milch1', 'brot1', 'honig1'])
  })

  it('lässt die Eingabeliste unangetastet', () => {
    const eingabe = [...SORTIMENT]
    waehleVorschauProdukte(eingabe, ['BROT'], 4)

    expect(eingabe.map((x) => x.id)).toEqual(['milch1', 'brot1', 'honig1', 'brot2'])
  })
})

describe('Preisformat — dasselbe wie auf der öffentlichen Hofseite', () => {
  it('Euro-Betrag in österreichischer Schreibweise', () => {
    expect(formatEuro(3.5)).toMatch(/3,50/)
    expect(formatEuro(3.5)).toMatch(/€/)
  })

  it('Preis je Einheit, mit Gebindegröße nur wenn sie nicht eins ist', () => {
    expect(formatPrice(3.5, 'KG', null)).toBe(`${formatEuro(3.5)} / kg`)
    expect(formatPrice(3.5, 'KG', 1)).toBe(`${formatEuro(3.5)} / kg`)
    expect(formatPrice(4.2, 'KG', 0.5)).toBe(`${formatEuro(4.2)} / 0.5 kg`)
  })

  it('unbekannte Einheit erscheint als sie selbst, statt zu verschwinden', () => {
    expect(formatPrice(1, 'BUENDEL', null)).toBe(`${formatEuro(1)} / BUENDEL`)
  })
})

describe('produktInitiale — der Platzhalter für ein fehlendes Produktbild', () => {
  it('nimmt den ersten Buchstaben, groß', () => {
    expect(produktInitiale('Bergkäse')).toBe('B')
    expect(produktInitiale('äpfel')).toBe('Ä')
  })

  it('überspringt führende Zeichen, die keine sind — sonst stünde dort ein Sternchen', () => {
    expect(produktInitiale('  Honig')).toBe('H')
    expect(produktInitiale('*Bio-Ei')).toBe('B')
    expect(produktInitiale('„Sonnenblume"')).toBe('S')
  })

  it('eine Ziffer zählt mit — „1/4 Rind" darf nicht leer ausgehen', () => {
    expect(produktInitiale('1/4 Rind')).toBe('1')
  })

  it('bleibt EIN Zeichen, auch wo Großschreiben zwei macht („ß" → „SS")', () => {
    expect(produktInitiale('ßuppe')).toBe('S')
  })

  it('ohne jedes verwertbare Zeichen ein Mittelpunkt statt einer leeren Fläche', () => {
    expect(produktInitiale('')).toBe('·')
    expect(produktInitiale('— ***')).toBe('·')
  })
})
