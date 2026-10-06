/**
 * Menü der Handy-Leiste (src/lib/kunden-menue.ts): welche Punkte, in welcher
 * Reihenfolge, und welcher die aktuelle Seite markiert.
 */
import { describe, expect, it } from 'vitest'
import { MENUE_PUNKTE, menuePunkte } from '@/lib/kunden-menue'

describe('MENUE_PUNKTE — die Wege des Menüs', () => {
  it('führt Startseite, beide Einkaufswege, die Höfe-Wege und Problem melden in dieser Reihenfolge', () => {
    expect(MENUE_PUNKTE.map((p) => [p.text, p.href])).toEqual([
      ['Startseite', '/'],
      ['Hofladen entdecken', '/hoefe'],
      ['Heu & Futter finden', '/hoefe?bereich=futter'],
      ['Für Höfe', '/#fuer-hoefe'],
      ['Hofbetreiber-Login', '/login'],
      ['Problem melden', '/problem-melden'],
    ])
  })

  it('jeder Punkt ist ein eigener, relativer Pfad', () => {
    for (const punkt of MENUE_PUNKTE) expect(punkt.href, punkt.text).toMatch(/^\/(?!\/)/)
    expect(new Set(MENUE_PUNKTE.map((p) => p.href)).size).toBe(MENUE_PUNKTE.length)
  })

  it('die Gruppen stehen zusammen — der Trennstrich kommt nur bei einem Wechsel', () => {
    const gruppen = MENUE_PUNKTE.map((p) => p.gruppe)
    const wechsel = gruppen.filter((g, i) => i > 0 && g !== gruppen[i - 1])
    expect(wechsel).toEqual(['hoefe', 'hilfe'])
  })
})

describe('menuePunkte — die aktuelle Seite', () => {
  const aktuelle = (pfad: string, suche = '') =>
    menuePunkte(pfad, suche)
      .filter((p) => p.aktuell)
      .map((p) => p.text)

  it('Hofübersicht ohne Bereich: Hofladen entdecken', () => {
    expect(aktuelle('/hoefe')).toEqual(['Hofladen entdecken'])
    expect(aktuelle('/hoefe', '?umkreis=25')).toEqual(['Hofladen entdecken'])
  })

  it('Hofübersicht im Futter-Bereich: Heu & Futter finden', () => {
    expect(aktuelle('/hoefe', '?bereich=futter')).toEqual(['Heu & Futter finden'])
    expect(aktuelle('/hoefe', 'bereich=futter&sort=preis')).toEqual(['Heu & Futter finden'])
  })

  it('Problem melden', () => {
    expect(aktuelle('/problem-melden')).toEqual(['Problem melden'])
  })

  it('Hofseite, Checkout, Rechtsseiten: kein Punkt ist aktuell', () => {
    for (const pfad of ['/testhof', '/testhof/checkout', '/impressum', '/datenschutz']) {
      expect(aktuelle(pfad), pfad).toEqual([])
    }
  })

  it('Für Höfe ist nie aktuell — ein Anker ist keine Seite', () => {
    expect(aktuelle('/', '')).toEqual(['Startseite'])
  })
})
