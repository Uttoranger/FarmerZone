/**
 * Menü der Handy-Leiste (src/lib/kunden-menue.ts): welche Punkte, in welcher
 * Reihenfolge, und welcher die aktuelle Seite markiert. Seit Nr. 41 (Register
 * N1) heißt der Weg der Höfe „Anmelden" bzw. mit Hof-Sitzung „Mein Hof" — aus
 * derselben Quelle wie der Knopf der Kopfzeile (kopfKnopf).
 */
import { describe, expect, it } from 'vitest'
import { menueFuer, menuePunkte } from '@/lib/kunden-menue'
import { kopfKnopf, type KundenSitzung } from '@/lib/kunden-navigation'

const ALLE: readonly KundenSitzung[] = ['gast', 'kunde', 'hof']

describe('menueFuer — die Wege des Menüs', () => {
  it('ohne Sitzung: Startseite, beide Einkaufswege, Für Höfe, Anmelden und Problem melden in dieser Reihenfolge', () => {
    expect(menueFuer('gast').map((p) => [p.text, p.href])).toEqual([
      ['Startseite', '/'],
      ['Hofladen entdecken', '/hoefe'],
      ['Heu & Futter finden', '/hoefe?bereich=futter'],
      ['Für Höfe', '/fuer-hoefe'],
      ['Anmelden', '/login'],
      ['Problem melden', '/problem-melden'],
    ])
  })

  it('mit Hof-Sitzung steht „Mein Hof" (→ /dashboard) an derselben Stelle — kein „Anmelden"', () => {
    const texte = menueFuer('hof').map((p) => [p.text, p.href])
    expect(texte[4]).toEqual(['Mein Hof', '/dashboard'])
    expect(texte.map(([text]) => text)).not.toContain('Anmelden')
  })

  it('mit Kundensitzung „Mein Konto" bei den Wegen der Kundinnen — kein „Anmelden"', () => {
    const punkte = menueFuer('kunde').map((p) => [p.text, p.href, p.gruppe])
    expect(punkte[3]).toEqual(['Mein Konto', '/account/profile', 'kunden'])
    expect(punkte.map(([text]) => text)).not.toContain('Anmelden')
    expect(punkte.map(([text]) => text)).toContain('Für Höfe')
  })

  it.each(ALLE)('der Punkt der Sitzung ist derselbe wie der Knopf der Kopfzeile (Sitzung: %s)', (sitzung) => {
    const knopf = kopfKnopf(sitzung)
    const gruppe = sitzung === 'kunde' ? 'kunden' : 'hoefe'
    expect(menueFuer(sitzung).filter((p) => p.href === knopf.href)).toEqual([{ href: knopf.href, text: knopf.label, gruppe }])
  })

  it('niemand heißt mehr „Hofbetreiber-Login"', () => {
    for (const sitzung of ALLE) expect(menueFuer(sitzung).map((p) => p.text)).not.toContain('Hofbetreiber-Login')
  })

  it('jeder Punkt ist ein eigener, relativer Pfad', () => {
    for (const sitzung of ALLE) {
      const punkte = menueFuer(sitzung)
      for (const punkt of punkte) expect(punkt.href, punkt.text).toMatch(/^\/(?!\/)/)
      expect(new Set(punkte.map((p) => p.href)).size).toBe(punkte.length)
    }
  })

  it('die Gruppen stehen zusammen — der Trennstrich kommt nur bei einem Wechsel', () => {
    for (const sitzung of ALLE) {
      const gruppen = menueFuer(sitzung).map((p) => p.gruppe)
      const wechsel = gruppen.filter((g, i) => i > 0 && g !== gruppen[i - 1])
      expect(wechsel).toEqual(['hoefe', 'hilfe'])
    }
  })
})

describe('menuePunkte — die aktuelle Seite', () => {
  const aktuelle = (pfad: string, suche = '', sitzung: KundenSitzung = 'gast') =>
    menuePunkte(pfad, suche, sitzung)
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

  it('Für Höfe ist seit Nr. 15 eine eigene Seite — auf ihr aktuell, auf der Startseite nicht', () => {
    expect(aktuelle('/', '')).toEqual(['Startseite'])
    expect(aktuelle('/fuer-hoefe', '')).toEqual(['Für Höfe'])
  })

  it('auf der Hof-Anmeldung ist „Anmelden" aktuell; die Sitzung bestimmt den Punkt', () => {
    expect(aktuelle('/login')).toEqual(['Anmelden'])
    expect(menuePunkte('/', '', 'hof').map((p) => p.text)).toContain('Mein Hof')
  })
})
