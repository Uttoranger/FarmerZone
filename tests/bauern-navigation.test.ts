/**
 * Tests für die Bauern-Navigation (src/lib/bauern-navigation.ts).
 *
 * Beweist:
 *  - Handy: fünf Plätze in fester Reihenfolge — Heute · Bestellungen · ➕ ·
 *    Mein Hof · Mehr.
 *  - Browser und Handy lesen dieselbe Ordnung: Hauptpunkte, „Neu",
 *    „Verkauf und Kunden", unten der Rest.
 *  - „Mein Hof" ist auf Produkte, Hofseite und Beiträge aktiv; die Reiter
 *    darunter kennen ihre Seite.
 *  - Aktiv ist der längste passende Punkt; „Mehr" für alles, was im Blatt liegt.
 *  - „Admin" nur für den Betreiber.
 *  - Jede Seite unter src/app/(farmer) ist über die Navigation erreichbar.
 *  - Der Kopf von Mein Hof sitzt über genau den drei Seiten, mit ihrem Reiter.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  HANDY_LEISTE,
  HAUPT,
  MEIN_HOF_REITER,
  NEU,
  UNTEN,
  VERKAUF_UND_KUNDEN,
  VERKAUF_UND_KUNDEN_TITEL,
  aktiverPunkt,
  aktiverReiter,
  fuerNutzer,
  mehrAktiv,
} from '@/lib/bauern-navigation'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

describe('Reihenfolge', () => {
  it('Handy: Heute · Bestellungen · Plus · Mein Hof · Mehr', () => {
    expect(HANDY_LEISTE.map((p) => (p.art === 'punkt' ? p.punkt.label : p.art))).toEqual([
      'Heute',
      'Bestellungen',
      'neu',
      'Mein Hof',
      'mehr',
    ])
  })

  it('Hauptpunkte mit ihren Zielen; nur Bestellungen trägt eine Zahl', () => {
    expect(HAUPT.map((p) => [p.label, p.href, p.zahl])).toEqual([
      ['Heute', '/dashboard', undefined],
      ['Bestellungen', '/orders', 'bestellungen'],
      ['Mein Hof', '/products', undefined],
    ])
  })

  it('Neu: Verkauf eintragen, Status posten, Produkt anlegen — jeweils mit einem Satz', () => {
    expect(NEU.map((p) => [p.label, p.href])).toEqual([
      ['Verkauf eintragen', '/sales?neu=1'],
      ['Status posten', '/status/new'],
      ['Produkt anlegen', '/products?neu=1'],
    ])
    for (const p of NEU) expect(p.satz).toMatch(/^\S.*\.$/)
  })

  it('Verkauf und Kunden: Kunden, Verkäufe, Auswertung — ohne Hofseite und Beiträge', () => {
    expect(VERKAUF_UND_KUNDEN_TITEL).toBe('Verkauf und Kunden')
    expect(VERKAUF_UND_KUNDEN.map((p) => [p.label, p.href])).toEqual([
      ['Kunden', '/customers'],
      ['Verkäufe', '/sales'],
      ['Auswertung', '/analytics'],
    ])
  })

  it('Unten: Einstellungen, Fehler melden, Meine Meldungen, Admin', () => {
    expect(UNTEN.map((p) => p.label)).toEqual(['Einstellungen', 'Fehler melden', 'Meine Meldungen', 'Admin'])
  })

  it('das Mehr-Blatt kennt weder Hofseite noch Beiträge', () => {
    const imBlatt = [...VERKAUF_UND_KUNDEN, ...UNTEN].map((p) => p.href)
    expect(imBlatt).not.toContain('/farm-page')
    expect(imBlatt).not.toContain('/status')
    expect(imBlatt).not.toContain('/products')
  })
})

describe('Mein Hof', () => {
  it('Reiter: Produkte (Standard) · Hofseite · Beiträge', () => {
    expect(MEIN_HOF_REITER.map((r) => [r.label, r.href])).toEqual([
      ['Produkte', '/products'],
      ['Hofseite', '/farm-page'],
      ['Beiträge', '/status'],
    ])
    // Der Punkt „Mein Hof" führt zum ersten Reiter.
    expect(HAUPT.find((p) => p.id === 'mein-hof')?.href).toBe(MEIN_HOF_REITER[0].href)
  })

  it.each([
    ['/products', 'produkte'],
    ['/farm-page', 'hofseite'],
    ['/status', 'beitraege'],
    ['/status/new', 'beitraege'],
    ['/dashboard', null],
    ['/productsxyz', null],
  ])('aktiverReiter(%s) → %s', (pfad, id) => {
    expect(aktiverReiter(pfad)).toBe(id)
  })

  it('der Kopf sitzt über den drei Seiten, jeweils mit ihrem Reiter', () => {
    expect(quelle('src/app/(farmer)/products/page.tsx')).toContain('<MeinHofKopf ownerId={session.user.id} aktiv="produkte" />')
    expect(quelle('src/app/(farmer)/farm-page/page.tsx')).toContain('<MeinHofKopf ownerId={session.user.id} aktiv="hofseite" />')
    expect(quelle('src/app/(farmer)/status/page.tsx')).toContain('<MeinHofKopf ownerId={session.user.id} aktiv="beitraege" />')
  })

  it('Unterseiten wie „Neuer Status" bekommen ihn nicht', () => {
    expect(quelle('src/app/(farmer)/status/new/page.tsx')).not.toContain('MeinHofKopf')
  })
})

describe('Admin nur für Admins', () => {
  it('ohne Betreiberrechte fehlt Admin, sonst ist alles gleich', () => {
    const bauer = fuerNutzer({ isAdmin: false })
    const betreiber = fuerNutzer({ isAdmin: true })
    expect(bauer.unten.map((p) => p.id)).toEqual(['einstellungen', 'fehler-melden', 'meldungen'])
    expect(betreiber.unten.map((p) => p.id)).toEqual(['einstellungen', 'fehler-melden', 'meldungen', 'admin'])
    expect(bauer.haupt).toEqual(betreiber.haupt)
    expect(bauer.verkaufUndKunden).toEqual(betreiber.verkaufUndKunden)
    expect(bauer.neu).toEqual(betreiber.neu)
  })

  it('Admin trägt die Zahl der Meldungen', () => {
    expect(UNTEN.find((p) => p.id === 'admin')?.zahl).toBe('admin')
  })
})

describe('aktive Pfade', () => {
  it.each([
    ['/dashboard', 'heute'],
    ['/orders', 'bestellungen'],
    ['/orders/abc123', 'bestellungen'],
    ['/orders/today/print', 'bestellungen'],
    ['/products', 'mein-hof'],
    ['/farm-page', 'mein-hof'],
    ['/status', 'mein-hof'],
    ['/status/new', 'mein-hof'],
    ['/status/xyz/send-whatsapp', 'mein-hof'],
    ['/customers/abc', 'kunden'],
    ['/sales', 'verkaeufe'],
    ['/analytics/umfeld', 'auswertung'],
    ['/settings/pickup-slots', 'einstellungen'],
    ['/fehler-melden', 'fehler-melden'],
    ['/meldungen', 'meldungen'],
    ['/admin/meldungen', 'admin'],
  ])('%s → %s', (pfad, id) => {
    expect(aktiverPunkt(pfad)).toBe(id)
  })

  it('kein Treffer über ein Namenspräfix hinweg', () => {
    expect(aktiverPunkt('/ordersxyz')).toBeNull()
    expect(aktiverPunkt('/statusmeldung')).toBeNull()
    expect(aktiverPunkt('/onboarding')).toBeNull()
    expect(aktiverPunkt('/')).toBeNull()
  })

  it('Mehr ist aktiv für alles, was im Mehr-Blatt liegt — nicht für die Leiste', () => {
    for (const pfad of ['/customers', '/sales', '/analytics/umfeld', '/settings', '/fehler-melden', '/meldungen', '/admin']) {
      expect(mehrAktiv(pfad), pfad).toBe(true)
    }
    for (const pfad of ['/dashboard', '/orders', '/orders/today/print', '/products', '/farm-page', '/status', '/status/new', '/onboarding']) {
      expect(mehrAktiv(pfad), pfad).toBe(false)
    }
  })
})

describe('Vollständigkeit', () => {
  it('jede Seite unter src/app/(farmer) hat ihren Punkt in der Navigation', () => {
    const wurzel = join(process.cwd(), 'src/app/(farmer)')
    const ordner = readdirSync(wurzel).filter((n) => statSync(join(wurzel, n)).isDirectory())
    expect(ordner.length).toBeGreaterThan(5)
    for (const name of ordner) {
      expect(aktiverPunkt(`/${name}`), name).not.toBeNull()
    }
  })
})
