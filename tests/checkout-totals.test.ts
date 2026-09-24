/**
 * Tests für die Betragsberechnung des Checkouts (src/lib/order-totals.ts).
 *
 * Beweist: Einzelpreise × Mengen summieren exakt in Decimal — 3 × 1,10 € ist
 * 3,30 €, nicht 3.3000000000000003 —, Stripe bekommt ganze Cent, und die
 * Plattformgebühr rundet kaufmännisch auf ganze Cent. eurosToCents bleibt für
 * die Anzeige im Browser und rundet dort Float-Reste weg.
 */
import { describe, it, expect } from 'vitest'
import { Decimal } from '@prisma/client/runtime/index-browser'
import {
  calcLineTotal,
  calcTotalAmount,
  calcPlatformFeeAmount,
  decimalZuCents,
  eurosToCents,
} from '@/lib/order-totals'

describe('calcTotalAmount', () => {
  it('summiert Einzelpreise × Mengen', () => {
    const items = [
      { unitPrice: 2.5, quantity: 2 },
      { unitPrice: 3.2, quantity: 1 },
    ]
    expect(calcTotalAmount(items).toFixed(2)).toBe('8.20')
  })

  it('leerer Warenkorb ergibt 0', () => {
    expect(calcTotalAmount([]).toNumber()).toBe(0)
  })

  it('Rundungsfall 3 × 1,10 €: exakt 3,30 — kein Float-Artefakt mehr', () => {
    const total = calcTotalAmount([{ unitPrice: 1.1, quantity: 3 }])
    expect(total.toString()).toBe('3.3')
    expect(decimalZuCents(total)).toBe(330)
  })

  it('nimmt Prisma-Decimal-artige Preise an', () => {
    const total = calcTotalAmount([{ unitPrice: { toString: () => '4.99' }, quantity: 2 }])
    expect(total.toFixed(2)).toBe('9.98')
  })
})

describe('calcLineTotal', () => {
  it('Einzelpreis × Menge, exakt', () => {
    expect(calcLineTotal('19.99', 3).toFixed(2)).toBe('59.97')
    expect(calcLineTotal(0.1, 3).toString()).toBe('0.3')
  })
})

describe('decimalZuCents', () => {
  it('wandelt glatte Beträge exakt um', () => {
    expect(decimalZuCents(new Decimal(0))).toBe(0)
    expect(decimalZuCents(new Decimal('19.99'))).toBe(1999)
    expect(decimalZuCents(new Decimal(100))).toBe(10000)
  })

  it('3 × 19,99 € ergibt exakt 5997 Cent', () => {
    expect(decimalZuCents(calcTotalAmount([{ unitPrice: 19.99, quantity: 3 }]))).toBe(5997)
  })
})

describe('eurosToCents (Anzeige im Browser)', () => {
  it('wandelt glatte Beträge exakt um', () => {
    expect(eurosToCents(0)).toBe(0)
    expect(eurosToCents(19.99)).toBe(1999)
    expect(eurosToCents(100)).toBe(10000)
  })

  it('rundet klassische Float-Summen korrekt (0,1 + 0,2)', () => {
    expect(eurosToCents(0.1 + 0.2)).toBe(30)
  })
})

describe('calcPlatformFeeAmount', () => {
  it('berechnet die Gebühr in Euro, kaufmännisch auf ganze Cent gerundet', () => {
    // 3,30 € × 5 % = 0,165 € → 0,17 €
    expect(calcPlatformFeeAmount(new Decimal('3.3'), 5).toFixed(2)).toBe('0.17')
  })

  it('Gebühr 0 % ergibt 0', () => {
    expect(calcPlatformFeeAmount(new Decimal(50), 0).toNumber()).toBe(0)
  })

  it('Gebühren-Cents an Stripe sind ganzzahlig, auch bei krummen Summen', () => {
    const total = calcTotalAmount([{ unitPrice: 1.1, quantity: 3 }])
    const fee = calcPlatformFeeAmount(total, 5)
    expect(decimalZuCents(fee)).toBe(17)
    expect(Number.isInteger(decimalZuCents(fee))).toBe(true)
  })

  it('typischer Fall: 8,20 € × 10 % = 0,82 € = 82 Cent', () => {
    const fee = calcPlatformFeeAmount(new Decimal('8.2'), 10)
    expect(fee.toFixed(2)).toBe('0.82')
    expect(decimalZuCents(fee)).toBe(82)
  })

  it('nimmt den Prozentsatz als Prisma-Decimal an', () => {
    expect(calcPlatformFeeAmount(new Decimal(100), { toString: () => '4.90' }).toFixed(2)).toBe('4.90')
  })
})
