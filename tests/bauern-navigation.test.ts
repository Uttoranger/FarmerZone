/**
 * Tests für die Bauern-Navigation (src/lib/bauern-navigation.ts).
 *
 * Beweist:
 *  - Handy: fünf Plätze in fester Reihenfolge — Heute · Bestellungen · ➕ ·
 *    Produkte · Mehr.
 *  - Browser und Handy lesen dieselbe Ordnung: Hauptpunkte, „Neu", „Dein Hof",
 *    unten der Rest.
 *  - Aktiv ist der längste passende Punkt; „Mehr" für alles, was im Blatt liegt.
 *  - „Admin" nur für den Betreiber.
 *  - Jede Seite unter src/app/(farmer) ist über die Navigation erreichbar.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEIN_HOF,
  HANDY_LEISTE,
  HAUPT,
  NEU,
  UNTEN,
  aktiverPunkt,
  fuerNutzer,
  mehrAktiv,
} from '@/lib/bauern-navigation'

describe('Reihenfolge', () => {
  it('Handy: Heute · Bestellungen · Plus · Produkte · Mehr', () => {
    expect(HANDY_LEISTE.map((p) => (p.art === 'punkt' ? p.punkt.label : p.art))).toEqual([
      'Heute',
      'Bestellungen',
      'neu',
      'Produkte',
      'mehr',
    ])
  })

  it('Hauptpunkte mit ihren Zielen; nur Bestellungen trägt eine Zahl', () => {
    expect(HAUPT.map((p) => [p.label, p.href, p.zahl])).toEqual([
      ['Heute', '/dashboard', undefined],
      ['Bestellungen', '/orders', 'bestellungen'],
      ['Produkte', '/products', undefined],
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

  it('Dein Hof: Hof-Seite, Kunden, Verkäufe, Auswertung, Status-Beiträge', () => {
    expect(DEIN_HOF.map((p) => [p.label, p.href])).toEqual([
      ['Meine Hof-Seite', '/farm-page'],
      ['Kunden', '/customers'],
      ['Verkäufe', '/sales'],
      ['Auswertung', '/analytics'],
      ['Status-Beiträge', '/status'],
    ])
  })

  it('Unten: Einstellungen, Fehler melden, Meine Meldungen, Admin', () => {
    expect(UNTEN.map((p) => p.label)).toEqual(['Einstellungen', 'Fehler melden', 'Meine Meldungen', 'Admin'])
  })
})

describe('Admin nur für Admins', () => {
  it('ohne Betreiberrechte fehlt Admin, sonst ist alles gleich', () => {
    const bauer = fuerNutzer({ isAdmin: false })
    const betreiber = fuerNutzer({ isAdmin: true })
    expect(bauer.unten.map((p) => p.id)).toEqual(['einstellungen', 'fehler-melden', 'meldungen'])
    expect(betreiber.unten.map((p) => p.id)).toEqual(['einstellungen', 'fehler-melden', 'meldungen', 'admin'])
    expect(bauer.haupt).toEqual(betreiber.haupt)
    expect(bauer.deinHof).toEqual(betreiber.deinHof)
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
    ['/products', 'produkte'],
    ['/farm-page', 'hofseite'],
    ['/customers/abc', 'kunden'],
    ['/sales', 'verkaeufe'],
    ['/analytics/umfeld', 'auswertung'],
    ['/status', 'status'],
    ['/status/new', 'status'],
    ['/status/xyz/send-whatsapp', 'status'],
    ['/settings/pickup-slots', 'einstellungen'],
    ['/fehler-melden', 'fehler-melden'],
    ['/meldungen', 'meldungen'],
    ['/admin/meldungen', 'admin'],
  ])('%s → %s', (pfad, id) => {
    expect(aktiverPunkt(pfad)).toBe(id)
  })

  it('kein Treffer über ein Namenspräfix hinweg', () => {
    expect(aktiverPunkt('/ordersxyz')).toBeNull()
    expect(aktiverPunkt('/onboarding')).toBeNull()
    expect(aktiverPunkt('/')).toBeNull()
  })

  it('Mehr ist aktiv für alles, was im Mehr-Blatt liegt — nicht für die Leiste', () => {
    for (const pfad of ['/farm-page', '/customers', '/sales', '/analytics/umfeld', '/status/new', '/settings', '/fehler-melden', '/meldungen', '/admin']) {
      expect(mehrAktiv(pfad), pfad).toBe(true)
    }
    for (const pfad of ['/dashboard', '/orders', '/orders/today/print', '/products', '/onboarding']) {
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
