/**
 * Tests für die Betragsberechnung des Checkouts (src/lib/order-totals.ts).
 *
 * Beweist: Einzelpreise × Mengen summieren korrekt, Float-Artefakte
 * (3 × 1,10 € = 3.3000000000000003) landen als exakte Cent-Beträge bei Stripe,
 * und die Plattformgebühr rundet auf ganze Cents.
 */
import { describe, it, expect } from 'vitest'
import { calcTotalAmount, calcPlatformFeeAmount, eurosToCents } from '@/lib/order-totals'

describe('calcTotalAmount', () => {
  it('summiert Einzelpreise × Mengen', () => {
    const items = [
      { unitPrice: 2.5, quantity: 2 },
      { unitPrice: 3.2, quantity: 1 },
    ]
    expect(calcTotalAmount(items)).toBeCloseTo(8.2, 10)
  })

  it('leerer Warenkorb ergibt 0', () => {
    expect(calcTotalAmount([])).toBe(0)
  })

  it('Rundungsfall 3 × 1,10 €: Float-Artefakt entsteht, Cents stimmen trotzdem exakt', () => {
    const total = calcTotalAmount([{ unitPrice: 1.1, quantity: 3 }])
    // Das rohe Ergebnis ist NICHT exakt 3.3 (IEEE-754)…
    expect(total).not.toBe(3.3)
    expect(total).toBeCloseTo(3.3, 10)
    // …aber der Cent-Betrag an Stripe ist exakt 330
    expect(eurosToCents(total)).toBe(330)
  })
})

describe('eurosToCents', () => {
  it('wandelt glatte Beträge exakt um', () => {
    expect(eurosToCents(0)).toBe(0)
    expect(eurosToCents(19.99)).toBe(1999)
    expect(eurosToCents(100)).toBe(10000)
  })

  it('rundet klassische Float-Summen korrekt (0,1 + 0,2)', () => {
    expect(eurosToCents(0.1 + 0.2)).toBe(30)
  })

  it('3 × 19,99 € ergibt exakt 5997 Cent', () => {
    expect(eurosToCents(calcTotalAmount([{ unitPrice: 19.99, quantity: 3 }]))).toBe(5997)
  })
})

describe('calcPlatformFeeAmount', () => {
  it('berechnet die Gebühr in Euro, auf ganze Cents gerundet', () => {
    // 3,30 € × 5 % = 0,165 € → gerundet 0,17 €
    expect(calcPlatformFeeAmount(3.3, 5)).toBe(0.17)
  })

  it('Gebühr 0 % ergibt 0', () => {
    expect(calcPlatformFeeAmount(50, 0)).toBe(0)
  })

  it('Gebühren-Cents an Stripe sind ganzzahlig, auch bei krummen Summen', () => {
    const total = calcTotalAmount([{ unitPrice: 1.1, quantity: 3 }]) // 3.3000000000000003
    const fee = calcPlatformFeeAmount(total, 5)
    expect(eurosToCents(fee)).toBe(17)
    expect(Number.isInteger(eurosToCents(fee))).toBe(true)
  })

  it('typischer Fall: 8,20 € × 10 % = 0,82 € = 82 Cent', () => {
    const fee = calcPlatformFeeAmount(8.2, 10)
    expect(fee).toBe(0.82)
    expect(eurosToCents(fee)).toBe(82)
  })
})
