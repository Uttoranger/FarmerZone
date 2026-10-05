/**
 * Tests für die Navigation der KundeShell (src/lib/kunden-navigation.ts).
 *
 * Beweist:
 *  - Web abgemeldet: Höfe entdecken · So funktioniert's · Für Höfe · Anmelden.
 *  - Web angemeldet: nur, was es heute gibt (E8: kein Kundenkonto, keine
 *    „Meine Höfe", kein „Merken") — Höfe entdecken · Meine Bestellungen ·
 *    Mein Konto; Suche und Warenkorb zeichnet die Shell selbst.
 *  - Handy: Entdecken · Warenkorb · Bestellungen (E8, drei Einträge), in
 *    beiden Zuständen gleich.
 *  - Web und Handy bekommen dieselben Einträge aus derselben Quelle.
 *  - Aktiv ist der längste passende Punkt; ein Anker auf der Startseite nie.
 */
import { describe, it, expect } from 'vitest'
import { kundenAktiverPunkt, kundenAriaAktuell, kundenNavigation } from '@/lib/kunden-navigation'

describe('Web', () => {
  it('abgemeldet: Höfe entdecken · So funktioniert’s · Für Höfe · Anmelden', () => {
    const nav = kundenNavigation({ angemeldet: false })
    expect(nav.web.map((p) => p.label)).toEqual(['Höfe entdecken', 'So funktioniert’s', 'Für Höfe'])
    expect(nav.anmelden).toEqual({ id: 'anmelden', label: 'Anmelden', href: '/account/login' })
    expect(nav.konto).toBeNull()
  })

  it('angemeldet: Höfe entdecken · Meine Bestellungen, rechts Mein Konto — kein Anmelden', () => {
    const nav = kundenNavigation({ angemeldet: true })
    expect(nav.web.map((p) => p.label)).toEqual(['Höfe entdecken', 'Meine Bestellungen'])
    expect(nav.konto).toEqual({ id: 'konto', label: 'Mein Konto', href: '/account/profile' })
    expect(nav.anmelden).toBeNull()
  })

  it('E8: weder „Meine Höfe" noch „Merken" noch „Neuigkeiten" — in keinem Zustand', () => {
    for (const angemeldet of [false, true]) {
      const nav = kundenNavigation({ angemeldet })
      const texte = [...nav.web, ...nav.handy.flatMap((p) => (p.art === 'punkt' ? [p.punkt] : []))].map((p) => p.label)
      for (const verboten of ['Meine Höfe', 'Merken', 'Neuigkeiten']) {
        expect(texte.join(' ')).not.toContain(verboten)
      }
    }
  })

  it('alle Ziele sind Seiten, die es gibt — kein Link ins Leere', () => {
    for (const angemeldet of [false, true]) {
      const nav = kundenNavigation({ angemeldet })
      for (const p of [...nav.web, nav.anmelden, nav.konto]) {
        if (p) expect(p.href, p.label).toMatch(/^\/(hoefe|account\/login|account\/profile|#[a-z-]+)?$/)
      }
    }
  })
})

describe('Handy', () => {
  it('drei Plätze: Entdecken · Warenkorb · Bestellungen — in beiden Zuständen', () => {
    for (const angemeldet of [false, true]) {
      const leiste = kundenNavigation({ angemeldet }).handy
      expect(leiste.map((p) => (p.art === 'punkt' ? p.punkt.kurz : p.art))).toEqual(['Entdecken', 'warenkorb', 'Bestellungen'])
    }
  })

  it('Web und Handy bekommen dieselben Einträge: jeder Punkt der Leiste ist derselbe wie im Web (angemeldet)', () => {
    const nav = kundenNavigation({ angemeldet: true })
    for (const platz of nav.handy) {
      if (platz.art === 'punkt') expect(nav.web).toContainEqual(platz.punkt)
    }
  })

  it('abgemeldet führt „Bestellungen" dorthin, wo im Web „Anmelden" hinführt', () => {
    const nav = kundenNavigation({ angemeldet: false })
    const bestellungen = nav.handy.find((p) => p.art === 'punkt' && p.punkt.id === 'bestellungen')
    expect(bestellungen?.art === 'punkt' && bestellungen.punkt.href).toBe(nav.anmelden?.href)
    expect(nav.web).toContainEqual(nav.handy[0].art === 'punkt' ? nav.handy[0].punkt : null)
  })
})

describe('aktive Punkte', () => {
  it.each([
    ['/hoefe', 'entdecken'],
    ['/account/profile', 'konto'],
    ['/account/login', 'bestellungen'],
  ])('%s → %s', (pfad, id) => {
    expect(kundenAktiverPunkt(pfad)).toBe(id)
  })

  it('Startseite und Hofseite haben keinen aktiven Punkt; ein Anker ist nie aktuell', () => {
    expect(kundenAktiverPunkt('/')).toBeNull()
    expect(kundenAktiverPunkt('/hof-test')).toBeNull()
    const fuerHoefe = kundenNavigation({ angemeldet: false }).web.find((p) => p.id === 'fuer-hoefe')
    expect(fuerHoefe && kundenAriaAktuell('/', fuerHoefe)).toBeUndefined()
  })

  it("aria-current 'page' nur auf genau der Zielseite", () => {
    const entdecken = kundenNavigation({ angemeldet: false }).web[0]
    expect(kundenAriaAktuell('/hoefe', entdecken)).toBe('page')
    expect(kundenAriaAktuell('/account/profile', entdecken)).toBeUndefined()
  })
})
