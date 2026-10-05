/**
 * Tests für die Navigation der KundeShell (src/lib/kunden-navigation.ts).
 *
 * Beweist:
 *  - Web abgemeldet: Höfe entdecken · So funktioniert's · Für Höfe · Meine
 *    Bestellungen · Anmelden.
 *  - Web angemeldet: nur, was es heute gibt (E8: kein Kundenkonto, keine
 *    „Meine Höfe", kein „Merken") — Höfe entdecken · Meine Bestellungen ·
 *    Mein Konto. Suche und Warenkorb zeichnet die Shell selbst.
 *  - Handy: Entdecken · Warenkorb · Bestellungen (E8, drei Einträge), in
 *    beiden Zuständen; „Bestellungen" führt seit Nr. 14 immer auf die Seite
 *    „Bestellungen finden" (/bestellungen) — nicht mehr zur Anmeldung oder
 *    zu „Mein Konto".
 *  - Web und Handy bekommen aus derselben Quelle dieselben Ziele: Jedes Ziel
 *    der Leiste bietet die Kopfzeile derselben Sitzung auch an.
 *  - Aktiv ist der längste passende Punkt; ein Anker auf der Startseite nie.
 *  - Als angemeldet zählt nur die Kunden-Anmeldung, nicht die eines Hofs.
 */
import { describe, it, expect } from 'vitest'
import { istKundensitzung, kundenAktiverPunkt, kundenAriaAktuell, kundenNavigation } from '@/lib/kunden-navigation'
import { BESTELLUNGEN_PFAD } from '@/lib/bestellungen-finden'

describe('Web', () => {
  it('abgemeldet: Höfe entdecken · So funktioniert’s · Für Höfe · Meine Bestellungen · Anmelden', () => {
    const nav = kundenNavigation({ angemeldet: false })
    expect(nav.web.map((p) => p.label)).toEqual(['Höfe entdecken', 'So funktioniert’s', 'Für Höfe', 'Meine Bestellungen'])
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
        if (p) expect(p.href, p.label).toMatch(/^\/(hoefe|bestellungen|account\/login|account\/profile|#[a-z-]+)?$/)
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

  /** Alle Ziele, die die Kopfzeile in diesem Zustand anbietet: Textlinks, Anmelden, Konto. */
  function webZiele(angemeldet: boolean): string[] {
    const nav = kundenNavigation({ angemeldet })
    return [...nav.web, nav.anmelden, nav.konto].flatMap((p) => (p ? [p.href] : []))
  }

  it.each([false, true])('Web und Handy bekommen dieselben Ziele — jedes Ziel der Leiste steht auch im Kopf (angemeldet: %s)', (angemeldet) => {
    const nav = kundenNavigation({ angemeldet })
    for (const platz of nav.handy) {
      if (platz.art === 'punkt') expect(webZiele(angemeldet), platz.punkt.label).toContain(platz.punkt.href)
    }
  })

  it('Gegenprobe: der Zielvergleich schlägt an — die Anmeldung steht nur abgemeldet im Kopf', () => {
    expect(webZiele(true)).not.toContain('/account/login')
    expect(webZiele(false)).toContain('/account/login')
  })

  it.each([false, true])('„Bestellungen" führt auf die Seite „Bestellungen finden" (angemeldet: %s) — nicht zur Anmeldung, nicht zum Konto', (angemeldet) => {
    const nav = kundenNavigation({ angemeldet })
    const bestellungen = nav.handy.find((p) => p.art === 'punkt' && p.punkt.id === 'bestellungen')
    expect(bestellungen?.art === 'punkt' && bestellungen.punkt.href).toBe('/bestellungen')
    expect(nav.web.map((p) => p.href)).toContain('/bestellungen')
  })

  it('der Pfad ist derselbe wie der der Seite und ihres Cookies (BESTELLUNGEN_PFAD)', () => {
    const nav = kundenNavigation({ angemeldet: false })
    expect(nav.web.find((p) => p.id === 'bestellungen')?.href).toBe(BESTELLUNGEN_PFAD)
  })
})

describe('aktive Punkte', () => {
  it.each([
    ['/hoefe', 'entdecken'],
    ['/account/profile', 'konto'],
    ['/account/login', 'anmelden'],
    ['/bestellungen', 'bestellungen'],
  ])('%s → %s', (pfad, id) => {
    expect(kundenAktiverPunkt(pfad)).toBe(id)
  })

  it('Startseite und Hofseite haben keinen aktiven Punkt; ein Anker ist nie aktuell', () => {
    expect(kundenAktiverPunkt('/')).toBeNull()
    expect(kundenAktiverPunkt('/hof-test')).toBeNull()
    const fuerHoefe = kundenNavigation({ angemeldet: false }).web.find((p) => p.id === 'fuer-hoefe')
    expect(fuerHoefe && kundenAriaAktuell('/', fuerHoefe)).toBeUndefined()
  })

  it('angemeldet leuchtet auf /account/profile das Konto, nicht „Bestellungen"', () => {
    const nav = kundenNavigation({ angemeldet: true })
    const bestellungen = nav.handy.flatMap((p) => (p.art === 'punkt' && p.punkt.id === 'bestellungen' ? [p.punkt] : []))[0]
    expect(nav.konto && kundenAriaAktuell('/account/profile', nav.konto)).toBe('page')
    expect(kundenAriaAktuell('/account/profile', bestellungen)).toBeUndefined()
  })

  it('auf /bestellungen leuchtet „Bestellungen" (Leiste und Kopf), auf der Anmeldeseite „Anmelden"', () => {
    for (const angemeldet of [false, true]) {
      const nav = kundenNavigation({ angemeldet })
      const bestellungen = nav.handy.flatMap((p) => (p.art === 'punkt' && p.punkt.id === 'bestellungen' ? [p.punkt] : []))[0]
      expect(kundenAriaAktuell('/bestellungen', bestellungen)).toBe('page')
      expect(kundenAriaAktuell('/account/login', bestellungen)).toBeUndefined()
    }
    const abgemeldet = kundenNavigation({ angemeldet: false })
    expect(abgemeldet.anmelden && kundenAriaAktuell('/account/login', abgemeldet.anmelden)).toBe('page')
  })

  it("aria-current 'page' nur auf genau der Zielseite", () => {
    const entdecken = kundenNavigation({ angemeldet: false }).web[0]
    expect(kundenAriaAktuell('/hoefe', entdecken)).toBe('page')
    expect(kundenAriaAktuell('/account/profile', entdecken)).toBeUndefined()
  })
})

describe('istKundensitzung', () => {
  it('zählt die freiwillige Kunden-Anmeldung als angemeldet', () => {
    expect(istKundensitzung({ role: 'CUSTOMER' })).toBe(true)
  })

  it('ein angemeldeter Hof sieht die Kundenseite abgemeldet — ohne „Mein Konto" der Kunden', () => {
    expect(istKundensitzung({ role: 'FARMER' })).toBe(false)
  })

  it('ohne Sitzung abgemeldet', () => {
    expect(istKundensitzung(null)).toBe(false)
    expect(istKundensitzung(undefined)).toBe(false)
    expect(istKundensitzung({})).toBe(false)
  })
})
