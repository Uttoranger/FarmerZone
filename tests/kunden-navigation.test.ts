/**
 * Tests für die Navigation der KundeShell (src/lib/kunden-navigation.ts).
 *
 * Beweist:
 *  - Web ohne Sitzung: Höfe entdecken · So funktioniert's · Für Höfe · Meine
 *    Bestellungen, rechts „Anmelden" — seit Nr. 41 (Register N1) auf /login,
 *    nicht mehr auf /account/login.
 *  - Web mit Kundensitzung: nur, was es heute gibt (E8: kein Kundenkonto,
 *    keine „Meine Höfe", kein „Merken") — Höfe entdecken · Meine Bestellungen ·
 *    Mein Konto. Suche und Warenkorb zeichnet die Shell selbst.
 *  - Web mit Hof-Sitzung (N1): dieselben Links wie ohne Sitzung, rechts
 *    „Mein Hof" auf /dashboard statt „Anmelden".
 *  - Handy: Entdecken · Warenkorb · Bestellungen (E8, drei Einträge), in
 *    jeder Sitzung; „Bestellungen" führt seit Nr. 14 immer auf die Seite
 *    „Bestellungen finden" (/bestellungen).
 *  - Web und Handy bekommen aus derselben Quelle dieselben Ziele: Jedes Ziel
 *    der Leiste bietet die Kopfzeile derselben Sitzung auch an.
 *  - Aktiv ist der längste passende Punkt; ein Anker auf der Startseite nie.
 *  - Welche Sitzung eine Rolle ergibt (kundenSitzung), welchen Knopf die
 *    Kopfzeile der noch nicht umgezogenen Seiten zeigt (kopfKnopf) und dass
 *    „Schon dabei? Anmelden" dasselbe Ziel hat wie der Knopf (SCHON_DABEI).
 */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  SCHON_DABEI,
  kopfKnopf,
  kundenAktiverPunkt,
  kundenAriaAktuell,
  kundenNavigation,
  kundenSitzung,
  type KundenSitzung,
} from '@/lib/kunden-navigation'
import { BESTELLUNGEN_PFAD } from '@/lib/bestellungen-finden'

const ALLE: readonly KundenSitzung[] = ['gast', 'kunde', 'hof']

describe('Web', () => {
  it('ohne Sitzung: Höfe entdecken · So funktioniert’s · Für Höfe · Meine Bestellungen · Anmelden (→ /login)', () => {
    const nav = kundenNavigation({ sitzung: 'gast' })
    expect(nav.web.map((p) => p.label)).toEqual(['Höfe entdecken', 'So funktioniert’s', 'Für Höfe', 'Meine Bestellungen'])
    expect(nav.knopf).toEqual({ id: 'anmelden', label: 'Anmelden', href: '/login' })
    expect(nav.konto).toBeNull()
  })

  it('Kundensitzung: Höfe entdecken · Meine Bestellungen, rechts Mein Konto — kein Knopf', () => {
    const nav = kundenNavigation({ sitzung: 'kunde' })
    expect(nav.web.map((p) => p.label)).toEqual(['Höfe entdecken', 'Meine Bestellungen'])
    expect(nav.konto).toEqual({ id: 'konto', label: 'Mein Konto', href: '/account/profile' })
    expect(nav.knopf).toBeNull()
  })

  it('Hof-Sitzung (N1): dieselben Links wie ohne Sitzung, rechts „Mein Hof" (→ /dashboard) statt „Anmelden"', () => {
    const hof = kundenNavigation({ sitzung: 'hof' })
    expect(hof.web).toEqual(kundenNavigation({ sitzung: 'gast' }).web)
    expect(hof.knopf).toEqual({ id: 'mein-hof', label: 'Mein Hof', href: '/dashboard' })
    expect(hof.konto).toBeNull()
  })

  it('E8: weder „Meine Höfe" noch „Merken" noch „Neuigkeiten" — in keiner Sitzung', () => {
    for (const sitzung of ALLE) {
      const nav = kundenNavigation({ sitzung })
      const texte = [...nav.web, nav.knopf, nav.konto, ...nav.handy.flatMap((p) => (p.art === 'punkt' ? [p.punkt] : []))]
        .flatMap((p) => (p ? [p.label] : []))
      for (const verboten of ['Meine Höfe', 'Merken', 'Neuigkeiten']) {
        expect(texte.join(' ')).not.toContain(verboten)
      }
    }
  })

  it('alle Ziele sind Seiten, die es gibt — kein Link ins Leere', () => {
    for (const sitzung of ALLE) {
      const nav = kundenNavigation({ sitzung })
      for (const p of [...nav.web, nav.knopf, nav.konto]) {
        if (p) expect(p.href, p.label).toMatch(/^\/(hoefe|bestellungen|fuer-hoefe|login|dashboard|account\/profile|#[a-z-]+)?$/)
      }
    }
    // Die Ziele der Knöpfe liegen als Seiten im Code.
    expect(existsSync(join(process.cwd(), 'src/app/(auth)/login/page.tsx'))).toBe(true)
    expect(existsSync(join(process.cwd(), 'src/app/(hof)/dashboard/page.tsx'))).toBe(true)
  })
})

describe('Handy', () => {
  it('drei Plätze: Entdecken · Warenkorb · Bestellungen — in jeder Sitzung', () => {
    for (const sitzung of ALLE) {
      const leiste = kundenNavigation({ sitzung }).handy
      expect(leiste.map((p) => (p.art === 'punkt' ? p.punkt.kurz : p.art))).toEqual(['Entdecken', 'warenkorb', 'Bestellungen'])
    }
  })

  /** Alle Ziele, die die Kopfzeile in dieser Sitzung anbietet: Textlinks, Knopf, Konto. */
  function webZiele(sitzung: KundenSitzung): string[] {
    const nav = kundenNavigation({ sitzung })
    return [...nav.web, nav.knopf, nav.konto].flatMap((p) => (p ? [p.href] : []))
  }

  it.each(ALLE)('Web und Handy bekommen dieselben Ziele — jedes Ziel der Leiste steht auch im Kopf (Sitzung: %s)', (sitzung) => {
    const nav = kundenNavigation({ sitzung })
    for (const platz of nav.handy) {
      if (platz.art === 'punkt') expect(webZiele(sitzung), platz.punkt.label).toContain(platz.punkt.href)
    }
  })

  it('Gegenprobe: der Zielvergleich schlägt an — die Anmeldung steht nur ohne Sitzung, „Mein Hof" nur mit Hof-Sitzung im Kopf', () => {
    expect(webZiele('gast')).toContain('/login')
    expect(webZiele('kunde')).not.toContain('/login')
    expect(webZiele('hof')).not.toContain('/login')
    expect(webZiele('hof')).toContain('/dashboard')
    expect(webZiele('gast')).not.toContain('/dashboard')
    expect(webZiele('kunde')).not.toContain('/dashboard')
  })

  it.each(ALLE)('„Bestellungen" führt auf die Seite „Bestellungen finden" (Sitzung: %s) — nicht zur Anmeldung, nicht zum Konto', (sitzung) => {
    const nav = kundenNavigation({ sitzung })
    const bestellungen = nav.handy.find((p) => p.art === 'punkt' && p.punkt.id === 'bestellungen')
    expect(bestellungen?.art === 'punkt' && bestellungen.punkt.href).toBe('/bestellungen')
    expect(nav.web.map((p) => p.href)).toContain('/bestellungen')
  })

  it('der Pfad ist derselbe wie der der Seite und ihres Cookies (BESTELLUNGEN_PFAD)', () => {
    const nav = kundenNavigation({ sitzung: 'gast' })
    expect(nav.web.find((p) => p.id === 'bestellungen')?.href).toBe(BESTELLUNGEN_PFAD)
  })
})

describe('aktive Punkte', () => {
  it.each([
    ['/hoefe', 'entdecken'],
    ['/account/profile', 'konto'],
    ['/login', 'anmelden'],
    ['/bestellungen', 'bestellungen'],
    ['/fuer-hoefe', 'fuer-hoefe'],
  ])('%s → %s', (pfad, id) => {
    expect(kundenAktiverPunkt(pfad)).toBe(id)
  })

  it('Startseite und Hofseite haben keinen aktiven Punkt; ein Anker ist nie aktuell', () => {
    expect(kundenAktiverPunkt('/')).toBeNull()
    expect(kundenAktiverPunkt('/hof-test')).toBeNull()
    const fuerHoefe = kundenNavigation({ sitzung: 'gast' }).web.find((p) => p.id === 'fuer-hoefe')
    expect(fuerHoefe && kundenAriaAktuell('/', fuerHoefe)).toBeUndefined()
  })

  it('mit Kundensitzung leuchtet auf /account/profile das Konto, nicht „Bestellungen"', () => {
    const nav = kundenNavigation({ sitzung: 'kunde' })
    const bestellungen = nav.handy.flatMap((p) => (p.art === 'punkt' && p.punkt.id === 'bestellungen' ? [p.punkt] : []))[0]
    expect(nav.konto && kundenAriaAktuell('/account/profile', nav.konto)).toBe('page')
    expect(kundenAriaAktuell('/account/profile', bestellungen)).toBeUndefined()
  })

  it('auf /bestellungen leuchtet „Bestellungen" (Leiste und Kopf), auf der Hof-Anmeldung „Anmelden"', () => {
    for (const sitzung of ALLE) {
      const nav = kundenNavigation({ sitzung })
      const bestellungen = nav.handy.flatMap((p) => (p.art === 'punkt' && p.punkt.id === 'bestellungen' ? [p.punkt] : []))[0]
      expect(kundenAriaAktuell('/bestellungen', bestellungen)).toBe('page')
      expect(kundenAriaAktuell('/login', bestellungen)).toBeUndefined()
    }
    const gast = kundenNavigation({ sitzung: 'gast' })
    expect(gast.knopf && kundenAriaAktuell('/login', gast.knopf)).toBe('page')
    expect(gast.knopf && kundenAriaAktuell('/', gast.knopf)).toBeUndefined()
  })

  it("aria-current 'page' nur auf genau der Zielseite", () => {
    const entdecken = kundenNavigation({ sitzung: 'gast' }).web[0]
    expect(kundenAriaAktuell('/hoefe', entdecken)).toBe('page')
    expect(kundenAriaAktuell('/account/profile', entdecken)).toBeUndefined()
  })
})

describe('kundenSitzung — wie eine öffentliche Seite die Sitzung sieht', () => {
  it('die freiwillige Kunden-Anmeldung (Rolle CUSTOMER) ist eine Kundensitzung — auch ein Betreiber ohne Hof', () => {
    expect(kundenSitzung({ role: 'CUSTOMER' })).toBe('kunde')
  })

  it('ein angemeldeter Hof (Rolle FARMER, auch ein Betreiber mit eigenem Hof) ist eine Hof-Sitzung (N1)', () => {
    expect(kundenSitzung({ role: 'FARMER' })).toBe('hof')
  })

  it('ohne Sitzung oder mit einer anderen Rolle: wie abgemeldet', () => {
    expect(kundenSitzung(null)).toBe('gast')
    expect(kundenSitzung(undefined)).toBe('gast')
    expect(kundenSitzung({})).toBe('gast')
    expect(kundenSitzung({ role: null })).toBe('gast')
    // Die Rolle ADMIN öffnet den Hofbereich nicht (ladeHofbereich verlangt FARMER) — „Mein Hof" führte ins Leere.
    expect(kundenSitzung({ role: 'ADMIN' })).toBe('gast')
  })
})

describe('kopfKnopf — der Knopf der Kopfzeile auf Seiten, die noch KundenKopf tragen', () => {
  it('mit Hof-Sitzung „Mein Hof", sonst „Anmelden" — dieselben Punkte wie in der KundeShell', () => {
    expect(kopfKnopf('hof')).toEqual(kundenNavigation({ sitzung: 'hof' }).knopf)
    expect(kopfKnopf('gast')).toEqual(kundenNavigation({ sitzung: 'gast' }).knopf)
    // Kundensitzung wie bisher: KundenKopf kennt kein „Mein Konto", er zeigt die Anmeldung.
    expect(kopfKnopf('kunde')).toEqual(kundenNavigation({ sitzung: 'gast' }).knopf)
  })
})

describe('SCHON_DABEI — „Schon dabei? Anmelden" (N1)', () => {
  it('Frage und Link, Ziel und Wort aus dem Knopf der Kopfzeile', () => {
    const anmelden = kundenNavigation({ sitzung: 'gast' }).knopf
    expect(SCHON_DABEI).toEqual({ frage: 'Schon dabei?', link: anmelden?.label, href: anmelden?.href })
    expect(SCHON_DABEI.href).toBe('/login')
  })
})
