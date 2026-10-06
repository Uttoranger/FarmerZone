/**
 * Tests der Sichtbarkeitsregeln des Hofes (src/lib/produkt-sichtbarkeit.ts).
 *
 * Die Aussage: „Nicht im Shop" (der Hof hat es abgeschaltet, die Kundin sieht
 * nichts) und „Ausverkauft" (im Shop, aber Bestand 0 — die Kundin sieht es mit
 * Hinweis) sind zwei verschiedene Dinge, und die Reihenfolge zwischen ihnen ist
 * entschieden. Dazu die Zählung der Kopfzeile.
 *
 * Reine Funktionen, keine Mocks.
 */
import { describe, it, expect } from 'vitest'
import {
  IM_SHOP,
  NICHT_IM_SHOP,
  produktZustand,
  streifenText,
  umschaltMeldung,
} from '@/lib/produkt-sichtbarkeit'

const p = (isAvailable: boolean, stock: number) => ({ isAvailable, stock })

describe('produktZustand', () => {
  it('nennt ein abgeschaltetes Produkt „nicht im Shop", unabhängig vom Bestand', () => {
    expect(produktZustand(p(false, 0))).toEqual({ art: 'nicht-im-shop' })
    expect(produktZustand(p(false, 3))).toEqual({ art: 'nicht-im-shop' })
    expect(produktZustand(p(false, 999))).toEqual({ art: 'nicht-im-shop' })
  })

  it('„nicht im Shop" sticht „ausverkauft" — sonst verspräche es eine Rückkehr', () => {
    // Beides trifft zu: abgeschaltet UND Bestand 0. Die Kundin sieht nichts,
    // also darf der Hof nicht „Ausverkauft" lesen.
    expect(produktZustand(p(false, 0)).art).toBe('nicht-im-shop')
  })

  it('nennt ein sichtbares Produkt ohne Bestand „ausverkauft"', () => {
    expect(produktZustand(p(true, 0))).toEqual({ art: 'ausverkauft' })
  })

  it('behandelt einen negativen Bestand wie null — er darf nie vorkommen, aber nie „knapp" heißen', () => {
    expect(produktZustand(p(true, -1))).toEqual({ art: 'ausverkauft' })
  })

  it('nennt kleinen Bestand „knapp", genau an der Schwelle noch knapp', () => {
    expect(produktZustand(p(true, 1))).toEqual({ art: 'knapp', bestand: 1 })
    expect(produktZustand(p(true, 5))).toEqual({ art: 'knapp', bestand: 5 })
  })

  it('nennt alles über der Schwelle schlicht „im Shop"', () => {
    expect(produktZustand(p(true, 6))).toEqual({ art: 'im-shop', bestand: 6 })
  })

  it('nimmt die Schwelle als Parameter, damit sie nicht im Bauteil festklebt', () => {
    expect(produktZustand(p(true, 6), 10)).toEqual({ art: 'knapp', bestand: 6 })
    expect(produktZustand(p(true, 6), 2)).toEqual({ art: 'im-shop', bestand: 6 })
  })
})

describe('Beschriftungen', () => {
  it('sagt im Aus-Zustand überall genau dasselbe Wort', () => {
    const aus = produktZustand(p(false, 4))
    expect(streifenText(aus)).toBe(NICHT_IM_SHOP)
    expect(umschaltMeldung('Heumilch', false)).toContain('nicht mehr im Shop')
  })

  it('benutzt das Wort „Ausgeblendet" nirgends mehr', () => {
    const alle = [p(false, 0), p(false, 3), p(true, 0), p(true, 2), p(true, 9)]
      .map((x) => produktZustand(x))
      .map((z) => streifenText(z))
    for (const text of alle) {
      expect(text.toLowerCase()).not.toContain('ausgeblendet')
      expect(text.toLowerCase()).not.toContain('pausiert')
    }
  })

  it('beschriftet den Schalter unabhängig vom Zustand immer gleich', () => {
    // Der Zustand steckt in der Schalterstellung, nicht im Text.
    expect(IM_SHOP).toBe('Im Shop')
  })

  it('hält die beiden Wörter als Konstanten, damit der dritte Ort nicht wieder abweicht', () => {
    // Schalter, Produktliste UND das Produktformular (product-dialog.tsx)
    // lesen dieselben beiden Zeichenketten. Vorher stand im Formular
    // „Ausgeblendet im Shop" und im Raster „Ausgeblendet – nur du siehst es".
    expect(NICHT_IM_SHOP).toBe('Nicht im Shop')
    expect(IM_SHOP).not.toBe(NICHT_IM_SHOP)
  })

  it('nennt den Bestand auf dem Streifen', () => {
    expect(streifenText(produktZustand(p(true, 3)))).toBe('Nur noch 3 verfügbar')
    expect(streifenText(produktZustand(p(true, 40)))).toBe('40 verfügbar')
  })

  it('nennt im Toast das Produkt, in beide Richtungen', () => {
    expect(umschaltMeldung('Bio-Eier', false)).toBe('Bio-Eier ist nicht mehr im Shop')
    expect(umschaltMeldung('Bio-Eier', true)).toBe('Bio-Eier ist wieder im Shop')
  })
})
