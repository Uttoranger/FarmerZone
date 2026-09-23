/**
 * Tests für den MwSt-Vorschlag (src/lib/mwst.ts, Sprint Bereiche 1).
 *
 * Beweist: Der Vorschlag hängt nur am Bereich, ist heute überall 10 % und
 * kennt jede Kategorie — auch die Altlast und „keine Angabe".
 */
import { describe, it, expect } from 'vitest'
import { mwstStandard, MWST_STANDARD_JE_BEREICH } from '@/lib/mwst'
import { PRODUCT_CATEGORY_VALUES } from '@/lib/taxonomie'

describe('mwstStandard', () => {
  it('schlägt heute in jedem Bereich 10 % vor', () => {
    expect(MWST_STANDARD_JE_BEREICH).toEqual({ LEBENSMITTEL: 10, FUTTERMITTEL: 10, SONSTIGES: 10 })
  })

  it('kennt jede Kategorie, auch die Altlast', () => {
    for (const l1 of PRODUCT_CATEGORY_VALUES) expect(mwstStandard(l1)).toBe(10)
  })

  it('ohne Kategorie gilt der Satz für Sonstiges', () => {
    expect(mwstStandard(null)).toBe(MWST_STANDARD_JE_BEREICH.SONSTIGES)
    expect(mwstStandard(undefined)).toBe(MWST_STANDARD_JE_BEREICH.SONSTIGES)
  })

  it('folgt dem Bereich, nicht der einzelnen Kategorie', () => {
    expect(mwstStandard('HEU_STROH')).toBe(MWST_STANDARD_JE_BEREICH.FUTTERMITTEL)
    expect(mwstStandard('EIER')).toBe(MWST_STANDARD_JE_BEREICH.LEBENSMITTEL)
    expect(mwstStandard('BRENNHOLZ')).toBe(MWST_STANDARD_JE_BEREICH.SONSTIGES)
  })
})
