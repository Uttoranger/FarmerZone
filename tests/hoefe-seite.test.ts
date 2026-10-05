/**
 * Entdecken (/hoefe) im neuen Design (Nachtlauf Nr. 09) — die Teile
 * serverseitig gerendert (TESTING_GUIDELINES §1: Merkmale statt Schnappschuss,
 * immer mit Gegenprobe) und die Seite am Quelltext: KundeShell, dynamisch wie
 * vorher, gemeinsamer Hofliste-Cache, Fehler inline, nur Tokens.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} }),
  usePathname: () => '/hoefe',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }),
}))
vi.mock('next/link', () => ({
  // onNavigate und prefetch gehören Next, nicht dem <a> im HTML.
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & Record<string, unknown>) => {
    const attribute = { ...rest }
    delete attribute.onNavigate
    delete attribute.prefetch
    return createElement('a', { href, ...attribute }, children)
  },
}))

import {
  AktiveFilterZeile,
  ChipReihe,
  EntdeckenLeer,
  HoefeFehler,
  HofKarte,
  KeineHoefe,
  ProduktZeile,
  type KartenHof,
  type TrefferHof,
} from '@/components/hoefe/entdecken-teile'
import { kategorieReihe, leerzustand } from '@/lib/hoefe-entdecken'
import type { AngebotsProdukt } from '@/lib/bereiche-anzeige'
import { LEERER_HOEFE_FILTER, type HoefeFilter } from '@/schemas/hoefe-filter'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')
const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el)

const HOF: KartenHof = {
  slug: 'hof-test',
  name: 'Hof Test',
  postalCode: '1010',
  city: 'Wien',
  isPaused: false,
  kategorien: ['EIER', 'BROT'],
  naechsteAbholung: { dayOfWeek: 5, startTime: '15:00', endTime: '18:00', tageVoraus: 0 },
  fotos: [],
  entfernungKm: null,
}

const BROT: AngebotsProdukt = {
  id: 'p1',
  name: 'Bauernbrot',
  category: 'BROT',
  subcategory: null,
  labels: ['BIO'],
  tiere: [],
  grundpreis: null,
  grossgebinde: null,
  price: 5.8,
  unit: 'STUECK',
  unitSize: null,
  imageUrl: null,
}

const TREFFER_HOF: TrefferHof = { ...HOF, entfernungKm: 4.2 }

describe('Hofkarte', () => {
  it('ein pausierter Hof bleibt sichtbar, aber ausgegraut — mit Hinweis statt Abholtermin', () => {
    const pausiert = html(createElement(HofKarte, { hof: { ...HOF, isPaused: true }, bereich: 'LEBENSMITTEL', produktNamen: [], split: false, ausgewaehlt: false }))
    expect(pausiert).toContain('data-pausiert="ja"')
    expect(pausiert).toContain('Macht gerade Pause')
    expect(pausiert).not.toContain('Nächste Abholung')
    expect(pausiert).toContain('href="/hof-test"')
    // Gegenprobe: derselbe Hof ohne Pause.
    const offen = html(createElement(HofKarte, { hof: HOF, bereich: 'LEBENSMITTEL', produktNamen: ['Freilandeier'], split: false, ausgewaehlt: false }))
    expect(offen).not.toContain('data-pausiert')
    expect(offen).toContain('Nächste Abholung')
    expect(offen).toContain('Heute 15:00–18:00')
    expect(offen).toContain('Freilandeier')
  })

  it('im Splitscreen wählt die Fläche, zur Hofseite führt nur „Zum Hof" — im Futter direkt zum Futter', () => {
    const split = html(createElement(HofKarte, { hof: HOF, bereich: 'FUTTERMITTEL', produktNamen: [], split: true, ausgewaehlt: false }))
    expect(split).toContain('aria-label="Hof Test auf der Karte zeigen"')
    expect(split).toContain('href="/hof-test?bereich=futter"')
    expect(split).toContain('Zum Hof')
  })

  it('ein Name mit 80 Zeichen steht ganz im title und wird höchstens zweizeilig gezeigt', () => {
    const lang = 'Hof '.repeat(20).trim()
    const karte = html(createElement(HofKarte, { hof: { ...HOF, name: lang }, bereich: 'LEBENSMITTEL', produktNamen: [], split: false, ausgewaehlt: false }))
    expect(karte).toContain(`title="${lang}"`)
    expect(karte).toContain('line-clamp-2')
  })
})

describe('Produktzeile — die Suche zeigt Produkte statt Höfe', () => {
  it('Produkt, Siegel, Hof mit Entfernung, Abholung und Preis; die Zeile führt zur Hofseite', () => {
    const zeile = html(createElement(ProduktZeile, { treffer: { hof: TREFFER_HOF, produkt: BROT }, bereich: 'LEBENSMITTEL' }))
    expect(zeile).toContain('Bauernbrot')
    expect(zeile).toContain('>Bio<')
    expect(zeile).toContain('Hof Test · 4,2 km')
    expect(zeile).toContain('€ 5,80 / Stück')
    expect(zeile).toContain('href="/hof-test"')
    expect(zeile).toContain('aria-label="Bauernbrot bei Hof Test ansehen"')
  })

  it('ohne Standort steht der Ort statt der Entfernung; Futter zeigt den Kilopreis aus der Kennzeichnung', () => {
    const heu: AngebotsProdukt = { ...BROT, name: 'Heu', category: 'HEU_STROH', labels: [], price: 45, unit: 'BALLEN', grundpreis: { wert: 0.15, einheit: 'KG' } }
    const zeile = html(createElement(ProduktZeile, { treffer: { hof: HOF, produkt: heu }, bereich: 'FUTTERMITTEL' }))
    expect(zeile).toContain('Hof Test · 1010 Wien')
    expect(zeile).toContain('€ 0,15 / kg')
    expect(zeile).toContain('href="/hof-test?bereich=futter"')
  })
})

describe('Chips und aktive Filter sind echte Links', () => {
  const hoefe = [{ angebot: [BROT] }]

  it('die Kategorie-Reihe: „Alle" gewählt, Futtermittel führt nach bereich=futter', () => {
    const reihe = html(createElement(ChipReihe, { beschriftung: 'Kategorie', chips: kategorieReihe(hoefe, LEERER_HOEFE_FILTER) }))
    expect(reihe).toContain('aria-label="Kategorie"')
    expect(reihe).toMatch(/<a href="\/hoefe" [^>]*aria-current="page"[^>]*>Alle<\/a>/)
    expect(reihe).toMatch(/<a href="\/hoefe\?bereich=futter"[^>]*>Futtermittel<\/a>/)
    expect(reihe).toMatch(/<a href="\/hoefe\?kat=BRENNHOLZ"[^>]*>Brennmaterial<\/a>/)
    // Gegenprobe: im Futter trägt der Futtermittel-Chip die Markierung.
    const futter = html(createElement(ChipReihe, { beschriftung: 'Kategorie', chips: kategorieReihe(hoefe, { ...LEERER_HOEFE_FILTER, bereich: 'FUTTERMITTEL' }) }))
    expect(futter).toMatch(/aria-current="page"[^>]*>Futtermittel</)
  })

  it('„Aktive Filter" mit Entfernen-Links und „Alle zurücksetzen"', () => {
    const filter: HoefeFilter = { ...LEERER_HOEFE_FILTER, siegel: ['BIO'], suchtext: 'Eier' }
    const zeile = html(createElement(AktiveFilterZeile, { filter }))
    expect(zeile).toContain('Aktive Filter:')
    expect(zeile).toContain('aria-label="Bio entfernen"')
    expect(zeile).toContain('href="/hoefe?q=Eier"')
    expect(zeile).toMatch(/<a href="\/hoefe"[^>]*>Alle zurücksetzen<\/a>/)
    // Gegenprobe: ohne Filter keine Zeile.
    expect(html(createElement(AktiveFilterZeile, { filter: LEERER_HOEFE_FILTER }))).toBe('')
  })
})

describe('Leerzustand, kein Hof, Fehler', () => {
  it('der Leerzustand hat immer einen Ausweg — Link oder Umkreis-Knopf', () => {
    const filter: HoefeFilter = { ...LEERER_HOEFE_FILTER, kategorien: ['FISCH'] }
    const link = html(createElement(EntdeckenLeer, { leer: leerzustand({ sucheLeertDieListe: false, umkreis: null, filter }) }))
    expect(link).toContain('data-slot="empty-state"')
    expect(link).toMatch(/<a href="\/hoefe"[^>]*>Alle zurücksetzen<\/a>/)
    const knopf = html(createElement(EntdeckenLeer, { leer: leerzustand({ sucheLeertDieListe: false, umkreis: 10, filter }) }))
    expect(knopf).toMatch(/<button type="button"[^>]*>Auf 25 km erweitern<\/button>/)
  })

  it('ohne Höfe: kein Fehler, sondern ein Anfang', () => {
    const leer = html(createElement(KeineHoefe))
    expect(leer).toContain('Die ersten Höfe kommen gerade dazu')
    expect(leer).toContain('href="/register"')
  })

  it('der Fehler steht inline, ohne Technik und ohne roten Text', () => {
    const fehler = html(createElement(HoefeFehler))
    expect(fehler).toContain('data-slot="hinweiskarte"')
    expect(fehler).toContain('Wir konnten die Höfe gerade nicht laden.')
    expect(fehler).toContain('href="/hoefe"')
    expect(fehler).not.toMatch(/destructive|text-red/)
  })
})

describe('die Seite am Quelltext', () => {
  const seite = quelle('src/app/(public)/hoefe/page.tsx')

  it('in der KundeShell, Sitzung im Browser — dynamisch wie vorher, nicht schlechter', () => {
    expect(seite).toMatch(/<KundeShellMitSitzung>/)
    expect(seite).toMatch(/export const dynamic = 'force-dynamic'/)
    expect(seite).not.toMatch(/\bheaders\(\)|\bcookies\(\)|auth\.api/)
    // Gegenprobe: Die Suche findet headers(), wo es steht.
    expect(quelle('src/app/account/profile/page.tsx')).toMatch(/headers\(\)/)
  })

  it('die Höfe kommen aus dem gemeinsamen Cache; ein Ladefehler geht nach Sentry und erscheint inline', () => {
    expect(seite).toMatch(/\bladeOeffentlicheHoefe\(\)/)
    expect(seite).toContain('Sentry.captureException')
    expect(seite).toContain('unstable_rethrow(err)')
    expect(seite).toContain('<HoefeFehler />')
    expect(seite).toContain('<KeineHoefe />')
  })

  it('die Ladeansicht steht im neuen Design (sie kommt vor der Shell)', () => {
    expect(quelle('src/app/(public)/hoefe/loading.tsx')).toContain('data-design="neu"')
  })
})

describe('beide Themes: nur Tokens in den Teilen von Entdecken', () => {
  // Farben der Tailwind-Palette (text-amber-700, dark:text-red-300) folgen
  // keinem Token — im anderen Theme stimmt der Kontrast nicht mehr.
  const PALETTE = /\b(?:text|bg|border|ring|from|to|via)-(?:red|amber|green|emerald|lime|yellow|orange|slate|gray|zinc|neutral|stone|sky|blue|teal)-\d{2,3}\b/
  const HEX = /#[0-9a-fA-F]{3,8}\b/

  it('erkennt Palettenfarben und Hexwerte (Gegenprobe)', () => {
    expect(PALETTE.test('text-amber-700 dark:text-amber-300')).toBe(true)
    expect(HEX.test("'#E8F0E2'")).toBe(true)
    expect(PALETTE.test('text-status-offen bg-accent/12')).toBe(false)
  })

  it('keine Datei der Route nutzt sie', () => {
    const dateien = [
      'src/app/(public)/hoefe/page.tsx',
      'src/app/(public)/hoefe/loading.tsx',
      ...readdirSync(join(process.cwd(), 'src/components/hoefe'))
        .filter((d) => d.endsWith('.tsx') && d !== 'hoefe-karte.tsx')
        .map((d) => `src/components/hoefe/${d}`),
    ]
    for (const datei of dateien) {
      const text = quelle(datei)
      expect(PALETTE.test(text), datei).toBe(false)
      expect(HEX.test(text), datei).toBe(false)
    }
  })
})
