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
import { HoefeSuche } from '@/components/hoefe/hoefe-suche'
import { kategorieReihe, leerzustand } from '@/lib/hoefe-entdecken'
import { grundpreisAusKennzeichnung, type AngebotsProdukt } from '@/lib/bereiche-anzeige'
import { LEERER_HOEFE_FILTER, SUCHTEXT_MAX, type HoefeFilter } from '@/schemas/hoefe-filter'

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

  it('„Zum Hof" hat eine Trefferfläche von mindestens 44 px', () => {
    const split = html(createElement(HofKarte, { hof: HOF, bereich: 'LEBENSMITTEL', produktNamen: [], split: true, ausgewaehlt: false }))
    const klassen = split.match(/<a href="\/hof-test" class="([^"]*)"[^>]*>Zum Hof/)?.[1] ?? ''
    // h-9 (36 px) reicht nur mit dem unsichtbaren Rand darüber und darunter (4 + 36 + 4).
    const reicht = (k: string) => /\bh-11\b|\bmin-h-11\b/.test(k) || (/\bh-9\b/.test(k) && k.includes('before:-inset-y-1') && k.includes('before:absolute'))
    expect(klassen).not.toBe('')
    expect(reicht(klassen)).toBe(true)
    // Gegenprobe: der alte Knopf ohne Erweiterung fiele durch.
    expect(reicht('relative inline-flex h-9 items-center')).toBe(false)
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
    const heu: AngebotsProdukt = { ...BROT, name: 'Heu', category: 'HEU_STROH', labels: [], price: 45, unit: 'BALLEN', grundpreis: { wert: 0.15, einheit: 'KG', preis: 45, menge: 300 } }
    const zeile = html(createElement(ProduktZeile, { treffer: { hof: HOF, produkt: heu }, bereich: 'FUTTERMITTEL' }))
    expect(zeile).toContain('Hof Test · 1010 Wien')
    expect(zeile).toContain('€ 0,15 / kg')
    expect(zeile).toContain('href="/hof-test?bereich=futter"')
  })

  it('der Kilopreis rundet wie Hof- und Produktseite: € 2,01 für 2 kg zeigt € 1,01 / kg (Nr. 11, Nachbesserung 1)', () => {
    const sack: AngebotsProdukt = {
      ...BROT, name: 'Hafer im Sack', category: 'GETREIDE_KOERNER', labels: [], price: 2.01, unit: 'STUECK',
      grundpreis: grundpreisAusKennzeichnung(2.01, { nettoMenge: 2, nettoEinheit: 'KG' }),
    }
    const zeile = html(createElement(ProduktZeile, { treffer: { hof: HOF, produkt: sack }, bereich: 'FUTTERMITTEL' }))
    expect(zeile).toContain('€ 1,01 / kg')
    expect(zeile).not.toContain('€ 1,00 / kg')
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

  it('der Umkreis steht als eigener Eintrag in „Aktive Filter" — ein Knopf, kein Link (er lebt nicht in der URL)', () => {
    const zeile = html(createElement(AktiveFilterZeile, { filter: LEERER_HOEFE_FILTER, umkreis: 25 }))
    expect(zeile).toContain('Aktive Filter:')
    expect(zeile).toMatch(/<button type="button"[^>]*aria-label="Umkreis: 25 km entfernen"/)
    expect(zeile).toContain('Alle zurücksetzen')
    // Gegenprobe: „Alle" ist kein Filter.
    expect(html(createElement(AktiveFilterZeile, { filter: LEERER_HOEFE_FILTER, umkreis: null }))).toBe('')
  })

  it('„Alle zurücksetzen" und der Umkreis-Eintrag heben den Umkreis auf', () => {
    // Die Zeile hat keine Hooks — ihr Baum lässt sich direkt durchsuchen.
    type Knoten = { type?: unknown; props?: Record<string, unknown> & { children?: unknown } }
    const finde = (knoten: unknown, passt: (k: Knoten) => boolean): Knoten | null => {
      if (Array.isArray(knoten)) {
        for (const kind of knoten) {
          const treffer = finde(kind, passt)
          if (treffer) return treffer
        }
        return null
      }
      if (!knoten || typeof knoten !== 'object') return null
      const k = knoten as Knoten
      if (passt(k)) return k
      return finde(k.props?.children, passt)
    }
    const text = (k: Knoten) => JSON.stringify(k.props?.children ?? '')
    const gewaehlt: HoefeFilter[] = []
    let aufgehoben = 0
    const baum = AktiveFilterZeile({
      filter: { ...LEERER_HOEFE_FILTER, siegel: ['BIO'] },
      umkreis: 10,
      onWahl: (f) => gewaehlt.push(f),
      onUmkreisAufheben: () => (aufgehoben += 1),
    })
    const ereignis = { preventDefault() {} }
    const alle = finde(baum, (k) => typeof k.props?.onNavigate === 'function' && text(k).includes('Alle zurücksetzen'))
    expect(alle).not.toBeNull()
    ;(alle!.props!.onNavigate as (e: typeof ereignis) => void)(ereignis)
    expect(aufgehoben).toBe(1)
    expect(gewaehlt).toEqual([LEERER_HOEFE_FILTER])
    const umkreis = finde(baum, (k) => k.props?.['aria-label'] === 'Umkreis: 10 km entfernen')
    ;(umkreis!.props!.onClick as () => void)()
    expect(aufgehoben).toBe(2)
    // Gegenprobe: „Bio entfernen" lässt den Umkreis stehen.
    const bio = finde(baum, (k) => k.props?.['aria-label'] === 'Bio entfernen')
    ;(bio!.props!.onNavigate as (e: typeof ereignis) => void)(ereignis)
    expect(aufgehoben).toBe(2)
  })

  it('der Seitenzustand verdrahtet den Umkreis in „Aktive Filter" und in „Zurücksetzen" im Filterblatt', () => {
    const client = quelle('src/components/hoefe/hoefe-client.tsx')
    expect(client).toMatch(/<AktiveFilterZeile[^>]*umkreis=\{aktiverUmkreis\}[^>]*onUmkreisAufheben=/)
    expect(client).toMatch(/beimNavigieren\(zuruecksetzenZiel, schreibeUrl, umkreisAufheben\)/)
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
  // Schwarz und Weiß sind auch keine Tokens (from-black/25, bg-white/50) —
  // Schleier und Punkte auf Fotos nehmen die theme-festen Tokens
  // (DESIGN_SYSTEM.md, „Bild-Overlays"). Eine Ausnahme sieht das Design-System nicht vor.
  const SCHWARZ_WEISS = /\b(?:text|bg|border|ring|from|to|via|fill|stroke|outline|shadow|divide|decoration)-(?:black|white)(?![\w-])/
  const HEX = /#[0-9a-fA-F]{3,8}\b/

  it('erkennt Palettenfarben, Schwarz/Weiß und Hexwerte (Gegenprobe)', () => {
    expect(PALETTE.test('text-amber-700 dark:text-amber-300')).toBe(true)
    expect(HEX.test("'#E8F0E2'")).toBe(true)
    expect(PALETTE.test('text-status-offen bg-accent/12')).toBe(false)
    expect(SCHWARZ_WEISS.test('bg-linear-150 from-black/25 via-transparent')).toBe(true)
    expect(SCHWARZ_WEISS.test("i === aktiv ? 'bg-white' : 'bg-white/50'")).toBe(true)
    expect(SCHWARZ_WEISS.test('dark:text-white')).toBe(true)
    // Gegenprobe: Wörter, die nur so klingen, und die Tokens fallen nicht darunter.
    expect(SCHWARZ_WEISS.test('whitespace-nowrap text-foreground from-primary-foreground/25 bg-accent-foreground/50')).toBe(false)
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
      expect(SCHWARZ_WEISS.test(text), datei).toBe(false)
      expect(HEX.test(text), datei).toBe(false)
    }
  })
})

/** Das eine Suchfeld „Ort oder Produkt" (Nr. 46) ohne Text, ohne Bezugspunkt. */
const SUCHE = {
  suchtext: '',
  vorschlaege: [],
  status: '',
  treffer: 0,
  bezugspunkt: null,
  onSuchtext: () => {},
  onUebernehmen: () => {},
  onBezugspunkt: () => {},
  onAufheben: () => {},
}

describe('gültiges HTML und Grenzen der Felder', () => {
  it('das Suchformular steckt in keinem <span> (ein Formular ist ein Block)', () => {
    const umkreis = html(createElement(HoefeSuche, SUCHE))
    const vorher = umkreis.slice(0, umkreis.indexOf('<form'))
    expect(umkreis).toContain('<form')
    const offeneSpans = (t: string) => (t.match(/<span\b/g) ?? []).length - (t.match(/<\/span>/g) ?? []).length
    expect(offeneSpans(vorher)).toBe(0)
    // Gegenprobe: die Zählung erkennt ein offenes <span> davor.
    expect(offeneSpans('<div><span class="x"><span>a</span>')).toBe(1)
  })

  it('das Suchfeld nimmt höchstens so viele Zeichen an, wie die Adresse trägt', () => {
    const suche = html(createElement(HoefeSuche, SUCHE))
    expect(suche).toContain(`maxLength="${SUCHTEXT_MAX}"`)
    // Gegenprobe: ein längerer Suchtext fiele beim Lesen der Adresse weg.
    expect(SUCHTEXT_MAX).toBe(100)
  })
})

describe('Ein Suchfeld „Ort oder Produkt" plus „Standort nutzen" (Nr. 46)', () => {
  it('ohne Bezugspunkt: genau ein Eingabefeld, der Knopf „Standort nutzen" und „Nichts wird gespeichert."', () => {
    const suche = html(createElement(HoefeSuche, SUCHE))
    expect((suche.match(/<input\b/g) ?? []).length).toBe(1)
    expect(suche).toContain('placeholder="Ort oder Produkt"')
    expect(suche).toContain('role="combobox"')
    expect(suche).toMatch(/<button type="button"[^>]*>.*Standort nutzen<\/button>/)
    expect(suche).toContain('Nichts wird gespeichert.')
    // Das eigene Postleitzahl-Feld und die große grüne Karte sind weg.
    expect(suche).not.toContain('PLZ oder Ort')
    expect(suche).not.toContain('data-slot="hinweiskarte"')
  })

  it('mit Bezugspunkt: „Wir zeigen Höfe rund um …" mit „Ort ändern" statt des Standort-Knopfs', () => {
    const suche = html(createElement(HoefeSuche, { ...SUCHE, bezugspunkt: { lat: 48.2, lon: 13.5, name: '4910 Ried im Innkreis' } }))
    expect(suche).toContain('data-slot="hinweiskarte"')
    expect(suche).toContain('4910 Ried im Innkreis')
    expect(suche).toContain('Ort ändern')
    expect(suche).not.toContain('Standort nutzen')
  })

  it('die Seite verdrahtet das eine Feld mit Trefferzahl und Bezugspunkt — die alte Umkreis-Karte gibt es nicht mehr', () => {
    const client = quelle('src/components/hoefe/hoefe-client.tsx')
    expect(client).toMatch(/<HoefeSuche[\s\S]*?treffer=\{anzahl\}[\s\S]*?bezugspunkt=\{bezugspunkt\}[\s\S]*?\/>/)
    expect(client).not.toMatch(/HoefeUmkreis|hoefe-umkreis/)
    // Gegenprobe: das Muster erkennt den alten Einbau.
    expect('import HoefeUmkreis from \'@/components/hoefe/hoefe-umkreis\'').toMatch(/HoefeUmkreis|hoefe-umkreis/)
  })

  it('Enter löst die Ortssuche nur bei vier Ziffern aus — ohne Treffer markiert es den Eintrag „Höfe rund um …" (Runde 1)', () => {
    const suche = quelle('src/components/hoefe/hoefe-suche.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const absenden = suche.slice(suche.indexOf('function absenden('), suche.indexOf('const knopf'))
    expect(absenden).toContain('enterImSuchfeld(suchtext, treffer)')
    expect(absenden).toMatch(/aktion === 'ort-suchen'\) ort\.ortSuchen\(suchtext\)/)
    expect(absenden).toMatch(/aktion === 'ort-eintrag-zeigen'\) setVorschlagsLage\(\{ offen: true, markiert: ORT_VORSCHLAG \}\)/)
    // Genau ein Weg zur Ortssuche beim Absenden — der für vier Ziffern.
    expect(absenden.match(/ortSuchen\(/g)).toHaveLength(1)
    // Gegenprobe: der alte Weg (Enter ohne Treffer sucht selbst) fiele auf.
    expect('if (enterSuchtOrt(suchtext, treffer)) ort.ortSuchen(suchtext)').not.toContain('enterImSuchfeld(suchtext, treffer)')
  })

  it('der Standort bleibt im Browser: Die Ortssuche schickt nur den getippten Text, der Standort geht in keine Anfrage', () => {
    // Ohne Kommentare: Die Datei erklärt selbst, warum es keinen localStorage gibt.
    const hook = quelle('src/components/hoefe/use-ortssuche.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(hook).toContain('loeseOrtAuf(text)')
    expect(hook).not.toMatch(/loeseOrtAuf\([^)]*coords/)
    expect(hook).not.toMatch(/localStorage|sessionStorage|document\.cookie/)
  })
})
