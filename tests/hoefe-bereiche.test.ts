/**
 * Tests für die Ausblendung der Futter-Kategorien auf /hoefe bis Sprint
 * Bereiche 2 (Konzept 6.2), src/lib/hofuebersicht.ts.
 *
 * Beweist: Die Chip-Liste enthält keine Kategorie aus dem Bereich
 * Futtermittel, auch nicht die Altlast; Lebensmittel und Sonstiges bleiben
 * in Schema-Reihenfolge. Ein Hof mit Eiern und Heu zeigt nur „Eier".
 */
import { describe, it, expect } from 'vitest'
import { HOEFE_KATEGORIEN, sammleKategorien } from '@/lib/hofuebersicht'
import { BEREICH_KATEGORIEN, istFuttermittel } from '@/lib/taxonomie'

describe('HOEFE_KATEGORIEN', () => {
  it('enthält keine Futter-Kategorie, auch nicht die Altlast', () => {
    expect(HOEFE_KATEGORIEN.some((k) => istFuttermittel(k))).toBe(false)
    expect(HOEFE_KATEGORIEN).not.toContain('FUTTERMITTEL')
  })

  it('enthält alle Lebensmittel und Sonstiges, Brennholz zuletzt vor Sonstiges', () => {
    for (const k of [...BEREICH_KATEGORIEN.LEBENSMITTEL, ...BEREICH_KATEGORIEN.SONSTIGES]) {
      expect(HOEFE_KATEGORIEN).toContain(k)
    }
    expect(HOEFE_KATEGORIEN.slice(-2)).toEqual(['BRENNHOLZ', 'SONSTIGES'])
  })

  it('ein Hof mit Eiern und Heu zeigt nur Eier', () => {
    const kategorien = sammleKategorien(
      [{ category: 'EIER' }, { category: 'HEU_STROH' }, { category: 'GETREIDE_KOERNER' }],
      HOEFE_KATEGORIEN
    )
    expect(kategorien).toEqual(['EIER'])
  })
})
