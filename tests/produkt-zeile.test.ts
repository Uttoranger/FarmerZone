/**
 * Tests der Produktzeile in Mein Hof (src/lib/produkt-zeile.ts): welche Chips
 * je Zustand, wie die Filter-Chips zählen, und dass der Bestand nie unter 0
 * fällt. Reine Funktionen, keine Mocks.
 */
import { describe, it, expect } from 'vitest'
import {
  PRODUKT_FILTER,
  bestandNach,
  kannVerringern,
  passtZuFilter,
  zaehleFilter,
  zeilenChips,
} from '@/lib/produkt-zeile'
import { LOW_STOCK_THRESHOLD } from '@/lib/dashboard-hints'
import type { ProductCategoryValue } from '@/lib/taxonomie'

const produkt = (
  teil: Partial<{
    isAvailable: boolean
    stock: number
    isOrganic: boolean
    requiresCool: boolean
    requiresFreezer: boolean
    category: ProductCategoryValue | null
  }> = {}
) => ({
  isAvailable: true,
  stock: 40,
  isOrganic: false,
  requiresCool: false,
  requiresFreezer: false,
  category: 'GEMUESE' as ProductCategoryValue | null,
  ...teil,
})

const texte = (p: ReturnType<typeof produkt>) => zeilenChips(p).map((c) => c.text)

describe('zeilenChips', () => {
  it('trägt im Normalfall keinen Chip — „Aktiv" gibt es nicht mehr', () => {
    expect(zeilenChips(produkt())).toEqual([])
  })

  it('„Nicht im Shop" grau, auch ohne Bestand (sticht „Ausverkauft")', () => {
    expect(zeilenChips(produkt({ isAvailable: false }))).toEqual([{ text: 'Nicht im Shop', farbe: 'grau' }])
    expect(texte(produkt({ isAvailable: false, stock: 0 }))).toEqual(['Nicht im Shop'])
  })

  it('„Ausverkauft" rot bei Bestand 0 im Shop', () => {
    expect(zeilenChips(produkt({ stock: 0 }))).toEqual([{ text: 'Ausverkauft', farbe: 'rot' }])
  })

  it('„Wenig Bestand" bernstein bis zur Schwelle, darüber nichts', () => {
    expect(zeilenChips(produkt({ stock: LOW_STOCK_THRESHOLD }))).toEqual([{ text: 'Wenig Bestand', farbe: 'bernstein' }])
    expect(texte(produkt({ stock: 1 }))).toEqual(['Wenig Bestand'])
    expect(texte(produkt({ stock: LOW_STOCK_THRESHOLD + 1 }))).toEqual([])
  })

  it('Bio und Kühlung als Wort, nach dem Zustand', () => {
    expect(texte(produkt({ isOrganic: true }))).toEqual(['Bio'])
    expect(texte(produkt({ stock: 0, isOrganic: true, requiresFreezer: true }))).toEqual([
      'Ausverkauft',
      'Bio',
      'Tiefkühlung',
    ])
    expect(texte(produkt({ requiresCool: true }))).toEqual(['Kühlung'])
  })

  it('Tiefkühlung schließt Kühlung ein — nie beide', () => {
    expect(texte(produkt({ requiresCool: true, requiresFreezer: true }))).toEqual(['Tiefkühlung'])
  })
})

describe('Filter', () => {
  const liste = [
    produkt({ category: 'GEMUESE' }),
    produkt({ category: null }), // ohne Kategorie → Hofladen, wie auf der Hofseite
    produkt({ category: 'HEU_STROH', stock: 0 }), // Futter, ausverkauft
    produkt({ category: 'EIER', isAvailable: false, stock: 0 }), // nicht im Shop, NICHT ausverkauft
    produkt({ category: 'GETREIDE_KOERNER', isAvailable: false }),
  ]

  it('zählt jeden Chip aus der geladenen Liste', () => {
    expect(zaehleFilter(liste)).toEqual({
      alle: 5,
      hofladen: 3,
      futter: 2,
      'nicht-im-shop': 2,
      ausverkauft: 1,
    })
  })

  it('Hofladen und Futter teilen die Liste ohne Rest', () => {
    const z = zaehleFilter(liste)
    expect(z.hofladen + z.futter).toBe(z.alle)
  })

  it('„Ausverkauft" meint dasselbe wie der Chip — ein ausgeblendetes Produkt ohne Bestand nicht', () => {
    expect(passtZuFilter(liste[3], 'ausverkauft')).toBe(false)
    expect(passtZuFilter(liste[3], 'nicht-im-shop')).toBe(true)
  })

  it('leere Liste zählt überall 0', () => {
    expect(Object.values(zaehleFilter([]))).toEqual(PRODUKT_FILTER.map(() => 0))
  })

  it('beschriftet die Chips wie gefordert', () => {
    expect(PRODUKT_FILTER.map((f) => f.label)).toEqual(['Alle', 'Hofladen', 'Futter', 'Nicht im Shop', 'Ausverkauft'])
  })
})

describe('Bestand ±1', () => {
  it('zählt hoch und runter', () => {
    expect(bestandNach(53, 1)).toBe(54)
    expect(bestandNach(53, -1)).toBe(52)
  })

  it('fällt nie unter 0', () => {
    expect(bestandNach(0, -1)).toBe(0)
    expect(bestandNach(1, -1)).toBe(0)
    expect(bestandNach(3, -20)).toBe(0)
  })

  it('sperrt „−" bei 0', () => {
    expect(kannVerringern(0)).toBe(false)
    expect(kannVerringern(1)).toBe(true)
  })
})
