/**
 * Tests für summenJeSatz (src/lib/order-totals.ts, Sprint Bereiche 1).
 *
 * Beweist: Summen je MwSt-Satz entstehen in Decimal ohne Float-Artefakte,
 * 10 und „10.00" sind derselbe Satz, die Ausgabe ist nach Satz sortiert, und
 * eine leere Bestellung ergibt keine Zeile.
 */
import { describe, it, expect } from 'vitest'
import { summenJeSatz } from '@/lib/order-totals'

describe('summenJeSatz', () => {
  it('summiert 0,10 + 0,20 exakt zu 0,30 — ohne Float-Artefakt', () => {
    const [zeile] = summenJeSatz([
      { vatRate: 10, totalPrice: '0.10' },
      { vatRate: 10, totalPrice: '0.20' },
    ])
    expect(zeile.summe.toFixed(2)).toBe('0.30')
    expect(zeile.summe.toString()).toBe('0.3')
  })

  it('fasst 10 und „10.00" als denselben Satz zusammen', () => {
    const ergebnis = summenJeSatz([
      { vatRate: 10, totalPrice: 5 },
      { vatRate: '10.00', totalPrice: '2.50' },
    ])
    expect(ergebnis).toHaveLength(1)
    expect(ergebnis[0].summe.toFixed(2)).toBe('7.50')
  })

  it('trennt verschiedene Sätze und sortiert aufsteigend', () => {
    const ergebnis = summenJeSatz([
      { vatRate: 20, totalPrice: '95.00' },
      { vatRate: 10, totalPrice: '6.50' },
      { vatRate: 13, totalPrice: '12.00' },
      { vatRate: 10, totalPrice: '3.60' },
    ])
    expect(ergebnis.map((z) => z.vatRate.toNumber())).toEqual([10, 13, 20])
    expect(ergebnis.map((z) => z.summe.toFixed(2))).toEqual(['10.10', '12.00', '95.00'])
  })

  it('nimmt Prisma-Decimal-artige Werte an', () => {
    const ergebnis = summenJeSatz([{ vatRate: { toString: () => '10.00' }, totalPrice: { toString: () => '19.99' } }])
    expect(ergebnis[0].summe.toFixed(2)).toBe('19.99')
  })

  it('leere Bestellung: keine Zeile', () => {
    expect(summenJeSatz([])).toEqual([])
  })

  it('Satz 0 ist ein eigener Satz', () => {
    const ergebnis = summenJeSatz([{ vatRate: 0, totalPrice: '4.00' }])
    expect(ergebnis[0].vatRate.toNumber()).toBe(0)
  })
})
