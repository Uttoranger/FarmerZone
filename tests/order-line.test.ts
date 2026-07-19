/**
 * Tests für formatOrderLine/unitSuffix (Nachlese 5 Punkt 6): Einheit wird
 * zur Anzeige vom Produkt gejoint — mit Einheit, ohne Einheit, gelöschtes
 * Produkt (null/undefined) → Darstellung wie bisher, kein Crash.
 */
import { describe, it, expect } from 'vitest'
import { formatOrderLine, unitSuffix } from '@/lib/order-line'

describe('formatOrderLine', () => {
  it('mit Einheit und Gebindegröße: "(1 l)" bzw. "(5 kg)"', () => {
    expect(
      formatOrderLine(
        { quantity: 1, productName: 'Heumilch frisch' },
        { unit: 'LITER', unitSize: 1 }
      )
    ).toBe('1× Heumilch frisch (1 l)')
    expect(
      formatOrderLine({ quantity: 2, productName: 'Kartoffeln' }, { unit: 'KG', unitSize: 5 })
    ).toBe('2× Kartoffeln (5 kg)')
  })

  it('mit Einheit ohne Gebindegröße: "(Stk.)"', () => {
    expect(
      formatOrderLine({ quantity: 3, productName: 'Eier' }, { unit: 'STUECK', unitSize: null })
    ).toBe('3× Eier (Stk.)')
  })

  it('gelöschtes Produkt (null/undefined): Darstellung wie bisher, kein Crash', () => {
    expect(formatOrderLine({ quantity: 1, productName: 'Altes Produkt' }, null)).toBe(
      '1× Altes Produkt'
    )
    expect(formatOrderLine({ quantity: 4, productName: 'Altes Produkt' })).toBe('4× Altes Produkt')
  })

  it('Produkt ohne Einheiten-Feld: Darstellung wie bisher', () => {
    expect(
      formatOrderLine({ quantity: 2, productName: 'Honig' }, { unit: null, unitSize: null })
    ).toBe('2× Honig')
  })

  it('Prisma-Decimal-artige unitSize wird korrekt formatiert', () => {
    const decimalLike = { toString: () => '0.5' }
    expect(
      formatOrderLine({ quantity: 1, productName: 'Bergkäse' }, { unit: 'KG', unitSize: decimalLike })
    ).toBe('1× Bergkäse (0.5 kg)')
  })

  it('unbekannter Einheiten-Code fällt auf den Rohwert zurück', () => {
    expect(
      formatOrderLine({ quantity: 1, productName: 'Neuprodukt' }, { unit: 'BUND', unitSize: null })
    ).toBe('1× Neuprodukt (BUND)')
  })
})

describe('unitSuffix', () => {
  it('liefert null ohne Produkt oder ohne Einheit', () => {
    expect(unitSuffix(null)).toBeNull()
    expect(unitSuffix(undefined)).toBeNull()
    expect(unitSuffix({ unit: null })).toBeNull()
  })

  it('Checkout-Schreibweise der Labels', () => {
    expect(unitSuffix({ unit: 'STUECK' })).toBe('Stk.')
    expect(unitSuffix({ unit: 'LITER', unitSize: 1 })).toBe('1 l')
    expect(unitSuffix({ unit: 'M3', unitSize: 2 })).toBe('2 m³')
    expect(unitSuffix({ unit: 'PAKET' })).toBe('Pak.')
  })
})
