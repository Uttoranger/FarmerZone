/**
 * Tests für das Produkt-Zod-Schema (Kategorie + Grenzwert-Flag, Sprint 17K).
 *
 * Beweist: Gültige Kategorie-Werte werden akzeptiert, leer/fehlend wird zu
 * null ("Keine Angabe"), ungültige Werte werden verweigert, und
 * countsTowardLimit defaultet auf true.
 */
import { describe, it, expect } from 'vitest'
import { productFormSchema, PRODUCT_CATEGORY_VALUES, CATEGORY_OPTIONS } from '@/schemas/product'

const minimalValid = {
  name: 'Heumilch',
  price: 2.5,
  unit: 'STUECK' as const,
}

describe('category', () => {
  it('akzeptiert jeden gültigen Kategorie-Wert', () => {
    for (const value of PRODUCT_CATEGORY_VALUES) {
      const parsed = productFormSchema.parse({ ...minimalValid, category: value })
      expect(parsed.category).toBe(value)
    }
  })

  it('macht aus leerem String und fehlendem Feld null (Keine Angabe)', () => {
    expect(productFormSchema.parse({ ...minimalValid, category: '' }).category).toBeNull()
    expect(productFormSchema.parse(minimalValid).category).toBeNull()
    expect(productFormSchema.parse({ ...minimalValid, category: null }).category).toBeNull()
  })

  it('verweigert ungültige Kategorie-Werte', () => {
    expect(() => productFormSchema.parse({ ...minimalValid, category: 'PIZZA' })).toThrow()
    expect(() => productFormSchema.parse({ ...minimalValid, category: 'milch' })).toThrow()
  })

  it('jede Kategorie hat ein deutsches Label', () => {
    expect(CATEGORY_OPTIONS.map((o) => o.value).sort()).toEqual(
      [...PRODUCT_CATEGORY_VALUES].sort()
    )
    for (const o of CATEGORY_OPTIONS) expect(o.label.length).toBeGreaterThan(1)
  })
})

describe('countsTowardLimit', () => {
  it('defaultet auf true (zählt zur Grenze)', () => {
    expect(productFormSchema.parse(minimalValid).countsTowardLimit).toBe(true)
  })

  it('lässt sich explizit auf false setzen (Urproduktion)', () => {
    expect(
      productFormSchema.parse({ ...minimalValid, countsTowardLimit: false }).countsTowardLimit
    ).toBe(false)
  })

  it('verweigert Nicht-Boolean-Werte', () => {
    expect(() =>
      productFormSchema.parse({ ...minimalValid, countsTowardLimit: 'ja' })
    ).toThrow()
  })
})
