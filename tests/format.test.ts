/**
 * Tests für die zentrale Darstellung (src/lib/format.ts, Bug-Report Befund 13
 * und 11). Geprüft wird das, was die Kundin liest: Dezimalkomma, Euro-Zeichen
 * vorn, Plural bei Paketen, offene Rechnung bei Gebindegrößen, eine
 * Schreibweise für die Position.
 */
import { describe, it, expect } from 'vitest'
import {
  formatEuro,
  formatZahl,
  formatMenge,
  formatPosition,
  formatGrundpreis,
  formatGrundpreisZeile,
  grundpreisJeEinheit,
  einheitLabel,
  mitAnzahl,
  plural,
} from '@/lib/format'

/** Intl setzt ein schmales geschütztes Leerzeichen als Tausendertrenner. */
const norm = (s: string) => s.replace(/[  ]/g, ' ')

describe('Geld', () => {
  it('schreibt das Euro-Zeichen vorn, mit Dezimalkomma und zwei Stellen', () => {
    expect(formatEuro(2.9)).toBe('€ 2,90')
    expect(formatEuro(0)).toBe('€ 0,00')
    expect(formatEuro(9.985)).toBe('€ 9,99')
  })

  it('trennt Tausender wie im österreichischen Deutsch — mit Leerzeichen, nicht mit Punkt', () => {
    // de-AT setzt laut Intl ein schmales geschütztes Leerzeichen; de-DE hätte
    // hier den Punkt. Die Plattform ist österreichisch, das bleibt so.
    expect(norm(formatEuro(1234.5))).toBe('€ 1 234,50')
    expect(formatEuro(1234.5)).not.toContain('1.234')
  })

  it('fällt bei unbrauchbaren Zahlen auf null zurück statt „€ NaN" zu zeigen', () => {
    expect(formatEuro(Number.NaN)).toBe('€ 0,00')
    expect(formatEuro(Number.POSITIVE_INFINITY)).toBe('€ 0,00')
  })
})

describe('Mengen', () => {
  it('schreibt Zahlen deutsch, ohne überflüssige Nullen', () => {
    expect(formatZahl(0.5)).toBe('0,5')
    expect(formatZahl(2)).toBe('2')
    expect(formatZahl(1.25)).toBe('1,25')
  })

  it('ohne Gebindegröße: schlichte Menge mit Einheit', () => {
    expect(formatMenge(2, 'KG')).toBe('2 kg')
    expect(formatMenge(0.5, 'KG')).toBe('0,5 kg')
    expect(formatMenge(0.5, 'LITER')).toBe('0,5 L')
    expect(formatMenge(3, 'STUECK')).toBe('3 Stück')
  })

  it('setzt Pakete in den Plural — „6 Paket" war der Befund', () => {
    expect(formatMenge(1, 'PAKET')).toBe('1 Paket')
    expect(formatMenge(6, 'PAKET')).toBe('6 Pakete')
    expect(einheitLabel('PAKET', 6)).toBe('Pakete')
    expect(einheitLabel('PAKET', 1)).toBe('Paket')
  })

  it('lässt Maßeinheiten unverändert — „6 kgs" gibt es nicht', () => {
    expect(formatMenge(6, 'KG')).toBe('6 kg')
    expect(formatMenge(6, 'LITER')).toBe('6 L')
    expect(formatMenge(6, 'STUECK')).toBe('6 Stück')
  })

  it('macht die Rechnung bei Gebindegrößen offen, statt sie zusammenzufassen', () => {
    // Zwei Flaschen zu 0,5 L sind nicht „1 L" — man kauft zwei Flaschen.
    expect(formatMenge(2, 'LITER', 0.5)).toBe('2 × 0,5 L')
    expect(formatMenge(3, 'KG', 5)).toBe('3 × 5 kg')
    // Gebindegröße 1 ist keine Information
    expect(formatMenge(2, 'KG', 1)).toBe('2 kg')
    expect(formatMenge(2, 'KG', null)).toBe('2 kg')
  })

  it('nimmt Prisma-Decimal genauso an wie eine Zahl', () => {
    expect(formatMenge(2, 'LITER', { toString: () => '0.5' })).toBe('2 × 0,5 L')
  })
})

describe('Position', () => {
  it('schreibt überall dasselbe: Name · Menge · Summe', () => {
    expect(
      formatPosition({ name: 'Tomaten', quantity: 2, unit: 'KG', unitSize: 1, totalPrice: 9.98 })
    ).toBe('Tomaten · 2 kg · € 9,98')
  })

  it('lässt die Summe weg, wenn sie woanders steht', () => {
    expect(formatPosition({ name: 'Tomaten', quantity: 2, unit: 'KG' })).toBe('Tomaten · 2 kg')
  })

  it('kommt ohne bekannte Einheit zurecht — gelöschtes Produkt, kein Absturz', () => {
    expect(formatPosition({ name: 'Altes Produkt', quantity: 2, unit: null, totalPrice: 4 })).toBe(
      'Altes Produkt · 2× · € 4,00'
    )
  })

  it('zeigt eine unbekannte Einheit unverändert statt sie zu verschlucken', () => {
    expect(formatPosition({ name: 'X', quantity: 2, unit: 'BUND' })).toBe('X · 2 BUND')
  })
})

describe('Grundpreis', () => {
  it('ohne Gebinde: Preis je Einheit mit Schrägstrich', () => {
    expect(formatGrundpreis(3.5, 'KG')).toBe('€ 3,50 / kg')
    expect(formatGrundpreis(4.2, 'KG', 1)).toBe('€ 4,20 / kg')
    expect(formatGrundpreis(4.2, 'KG', null)).toBe('€ 4,20 / kg')
  })

  it('mit Gebinde: „für", nicht „/" — der Schrägstrich las sich als „pro"', () => {
    expect(formatGrundpreis(50, 'KG', 2)).toBe('€ 50,00 für 2 kg')
    expect(formatGrundpreis(4.2, 'KG', 0.5)).toBe('€ 4,20 für 0,5 kg')
    expect(formatGrundpreis(3.6, 'PAKET', 6)).toBe('€ 3,60 für 6 Pakete')
    expect(formatGrundpreis(2, 'STUECK', 10)).toBe('€ 2,00 für 10 Stück')
  })

  it('unbrauchbare Gebindegrößen zählen als kein Gebinde', () => {
    expect(formatGrundpreis(3.5, 'KG', 0)).toBe('€ 3,50 / kg')
    expect(formatGrundpreis(3.5, 'KG', Number.NaN)).toBe('€ 3,50 / kg')
  })
})

describe('grundpreisJeEinheit — nur zur Anzeige', () => {
  it('ohne Gebinde ist es der Preis selbst', () => {
    expect(grundpreisJeEinheit(3.5)).toBe(3.5)
    expect(grundpreisJeEinheit(3.5, null)).toBe(3.5)
  })

  it('teilt durch die Gebindegröße und rundet auf Cent', () => {
    expect(grundpreisJeEinheit(50, 2)).toBe(25)
    expect(grundpreisJeEinheit(4.2, 0.5)).toBe(8.4)
    expect(grundpreisJeEinheit(10, 3)).toBe(3.33)
  })

  it('null bei Null, negativ, NaN oder unbrauchbarem Preis', () => {
    expect(grundpreisJeEinheit(50, 0)).toBeNull()
    expect(grundpreisJeEinheit(50, -2)).toBeNull()
    expect(grundpreisJeEinheit(50, Number.NaN)).toBeNull()
    expect(grundpreisJeEinheit(Number.NaN, 2)).toBeNull()
  })

  it('nimmt Prisma-Decimal-artige Werte an', () => {
    expect(grundpreisJeEinheit(89, { toString: () => '5.000' })).toBe(17.8)
  })
})

describe('formatGrundpreisZeile — die zweite Zeile unter dem Preis', () => {
  it('bei Maßeinheit mit Gebinde: Preis je Einheit', () => {
    expect(formatGrundpreisZeile(50, 'KG', 2)).toBe('€ 25,00 / kg')
    expect(formatGrundpreisZeile(4.2, 'LITER', 0.5)).toBe('€ 8,40 / L')
    expect(formatGrundpreisZeile(89, 'KG', 5)).toBe('€ 17,80 / kg')
  })

  it('ohne Gebinde oder bei Gebinde 1 nichts — der Preis sagt es schon', () => {
    expect(formatGrundpreisZeile(3.5, 'KG')).toBeNull()
    expect(formatGrundpreisZeile(3.5, 'KG', 1)).toBeNull()
    expect(formatGrundpreisZeile(3.5, 'KG', null)).toBeNull()
  })

  it('bei Stück und Paket nichts, auch mit Gebinde', () => {
    expect(formatGrundpreisZeile(3.6, 'PAKET', 6)).toBeNull()
    expect(formatGrundpreisZeile(2, 'STUECK', 10)).toBeNull()
  })

  it('unbrauchbare Zahlen: nichts statt „€ NaN"', () => {
    expect(formatGrundpreisZeile(Number.NaN, 'KG', 2)).toBeNull()
    expect(formatGrundpreisZeile(50, 'KG', 0)).toBeNull()
  })
})

describe('Singular und Plural', () => {
  it('schreibt „1 Produkt" und „6 Produkte" — „1 Produkte" war der Befund', () => {
    expect(mitAnzahl(1, 'Produkt', 'Produkte')).toBe('1 Produkt')
    expect(mitAnzahl(6, 'Produkt', 'Produkte')).toBe('6 Produkte')
    expect(mitAnzahl(0, 'Produkt', 'Produkte')).toBe('0 Produkte')
  })

  it('liefert auf Wunsch nur das Wort', () => {
    expect(plural(1, 'Hof', 'Höfe')).toBe('Hof')
    expect(plural(3, 'Hof', 'Höfe')).toBe('Höfe')
  })
})
