/**
 * Entdecken (/hoefe) im neuen Design (Nachtlauf Nr. 09) — die Teile
 * serverseitig gerendert (TESTING_GUIDELINES §1: Merkmale statt Schnappschuss,
 * immer mit Gegenprobe) und die Seite am Quelltext: KundeShell, statisch mit
 * Neubau alle fünf Minuten (Register N19), gemeinsamer Hofliste-Cache, Fehler
 * inline, nur Tokens, Filter-Links mit nofollow.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ComponentProps, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} }),
  usePathname: () => '/hoefe',
  unstable_rethrow: () => {},
}))
// Die Seite wird echt importiert (Metadaten, revalidate); Hofliste und Sitzung sind Attrappen.
vi.mock('@/server/queries/oeffentliche-hoefe', () => ({ ladeOeffentlicheHoefe: async () => [] }))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null, isPending: false }), signOut: () => {} }))
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
// Die Ortssuche (useOrtssuche) läuft echt. Ein Test darf ihr einen festen Stand unterschieben — den Hinweis „Standort nur
// ungefähr" gibt es erst nach der Antwort der Browser-Ortung, und die gibt es ohne DOM nicht. Der echte Hook läuft trotzdem
// immer (gleiche Hook-Reihenfolge); nur sein Ergebnis wird ersetzt, solange `ersatz` gesetzt ist.
const ortssuche = vi.hoisted(() => ({ ersatz: null as (() => unknown) | null }))
vi.mock('@/components/hoefe/use-ortssuche', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@/components/hoefe/use-ortssuche')>()
  return {
    ...echt,
    useOrtssuche(argumente: Parameters<typeof echt.useOrtssuche>[0]) {
      const ergebnis = echt.useOrtssuche(argumente)
      return ortssuche.ersatz ? (ortssuche.ersatz() as typeof ergebnis) : ergebnis
    },
  }
})

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
import { HoefeSuche, StandortUngefaehr } from '@/components/hoefe/hoefe-suche'
import type { Ortssuche } from '@/components/hoefe/use-ortssuche'
import { EntdeckenFilterblatt } from '@/components/hoefe/entdecken-filterblatt'
import { SUCHFELD_TEXT, abholungReihe, kategorieReihe, leerzustand, standortUngefaehrText } from '@/lib/hoefe-entdecken'
import { HofKurzkarte, KurzkartenInhalt } from '@/components/hoefe/hof-kurzkarte'
import type { VorschauProdukt } from '@/lib/hofuebersicht'
import { illustrationPfad } from '@/lib/taxonomie'
import { grundpreisAusKennzeichnung, type AngebotsProdukt } from '@/lib/bereiche-anzeige'
import { LEERER_HOEFE_FILTER, SUCHTEXT_MAX, type HoefeFilter } from '@/schemas/hoefe-filter'
import { HoefeClient } from '@/components/hoefe/hoefe-client'
import { FilterChip } from '@/components/ui/chip'
import type { HofUebersichtEintrag } from '@/server/queries/farm'
import { metadata, revalidate } from '@/app/(public)/hoefe/page'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')
/** Ohne Kommentare — die Dateien erklären selbst, warum es kein useSearchParams gibt. */
const ohneKommentare = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el)

/** Mi, 21. Okt 2026, 10:00 in Wien — der Zeitpunkt der Seite (Register N22: die Abholzeile rechnet damit bis zur Hydration). */
const JETZT = '2026-10-21T08:00:00.000Z'

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
  bildAusschnitt: null,
}

const HOF: KartenHof = {
  slug: 'hof-test',
  name: 'Hof Test',
  postalCode: '1010',
  city: 'Wien',
  isPaused: false,
  kategorien: ['EIER', 'BROT'],
  abholfenster: [{ dayOfWeek: 3, startTime: '15:00', endTime: '18:00' }],
  angebot: [BROT],
  fotos: [],
  gruendungshof: false,
  entfernungKm: null,
  latitude: 48.2,
  longitude: 16.37,
}

const TREFFER_HOF: TrefferHof = { ...HOF, entfernungKm: 4.2 }

const vorschauProdukt = (id: string, name: string, imageUrl: string | null = null, teil: Partial<VorschauProdukt> = {}): VorschauProdukt => ({
  id,
  name,
  price: 4.2,
  unit: 'STUECK',
  unitSize: null,
  imageUrl,
  bildAusschnitt: null,
  category: 'EIER',
  subcategory: null,
  verfuegbar: true,
  ...teil,
})
const DREI = { produkte: [vorschauProdukt('a', 'Freilandeier'), vorschauProdukt('b', 'Bauernbrot'), vorschauProdukt('c', 'Honig')], weitere: 6 }
const KEINE = { produkte: [], weitere: 0 }
const karte = (props: Partial<ComponentProps<typeof HofKarte>> = {}) =>
  html(createElement(HofKarte, { hof: HOF, bereich: 'LEBENSMITTEL', schaufenster: KEINE, split: false, ausgewaehlt: false, jetzt: JETZT, ...props }))

describe('Hofkarte', () => {
  it('ein pausierter Hof bleibt sichtbar, aber ausgegraut — mit Hinweis statt Abholtermin', () => {
    const pausiert = karte({ hof: { ...HOF, isPaused: true } })
    expect(pausiert).toContain('data-pausiert="ja"')
    expect(pausiert).toContain('Macht gerade Pause')
    expect(pausiert).not.toContain('Abholung heute')
    expect(pausiert).toContain('href="/hof-test"')
    // Gegenprobe: derselbe Hof ohne Pause.
    const offen = karte({ schaufenster: DREI })
    expect(offen).not.toContain('data-pausiert')
    expect(offen).toContain('Abholung heute 15:00–18:00')
    expect(offen).toContain('Freilandeier')
  })

  it('im Splitscreen wählt die Fläche, zur Hofseite führt nur „Zum Hof" — im Futter direkt zum Futter', () => {
    const split = karte({ bereich: 'FUTTERMITTEL', split: true })
    expect(split).toContain('aria-label="Hof Test auf der Karte zeigen"')
    expect(split).toContain('href="/hof-test?bereich=futter"')
    expect(split).toContain('Zum Hof')
  })

  it('„Zum Hof" hat eine Trefferfläche von mindestens 44 px', () => {
    const split = karte({ split: true })
    const klassen = split.match(/<a href="\/hof-test" class="([^"]*)"[^>]*>Zum Hof/)?.[1] ?? ''
    // h-9 (36 px, 34 im Rahmen) reicht nur mit dem unsichtbaren Rand darüber und darunter (5 + 34 + 5, wie chip.tsx).
    const reicht = (k: string) => /\bh-11\b|\bmin-h-11\b/.test(k) || (/\bh-9\b/.test(k) && k.includes('before:-inset-y-[5px]') && k.includes('before:absolute'))
    expect(klassen).not.toBe('')
    expect(reicht(klassen)).toBe(true)
    // Gegenprobe: der alte Knopf mit 4 px (42 px, Morgenbericht 17) fiele durch.
    expect(reicht('relative inline-flex h-9 items-center before:absolute before:-inset-y-1')).toBe(false)
  })

  it('ein Name mit 80 Zeichen steht ganz im title und wird höchstens zweizeilig gezeigt', () => {
    const lang = 'Hof '.repeat(20).trim()
    const gross = karte({ hof: { ...HOF, name: lang } })
    expect(gross).toContain(`title="${lang}"`)
    expect(gross).toContain('line-clamp-2')
  })
})

// Register N22 (Nr. 120): Variante A des Boards system-k1-entdecken-v2.
describe('Hofkarte A', () => {
  it('Foto und Bildfläche sind gleich hoch (150 px) — ohne Foto die Illustrationen der Kategorien, alt=""', () => {
    const ohneFoto = karte()
    expect(ohneFoto).toContain('data-slot="hof-bildflaeche"')
    expect(ohneFoto).toMatch(/data-slot="hof-bildflaeche" class="[^"]*\bh-\[150px\]/)
    expect(ohneFoto).toContain('<img src="/categories/eier.webp" alt=""/>')
    expect(ohneFoto).toContain('<img src="/categories/brot.webp" alt=""/>')
    const mitFoto = karte({ hof: { ...HOF, fotos: ['/hof.jpg'] } })
    expect(mitFoto).toMatch(/class="group\/foto relative h-\[150px\]/)
    expect(mitFoto).not.toContain('data-slot="hof-bildflaeche"')
  })

  it('keine Initialen, keine Kategorie-Chips — in beiden Gestalten', () => {
    for (const gestalt of [karte(), karte({ split: true })]) {
      expect(gestalt).not.toContain('>HT<')
      expect(gestalt).not.toContain('data-slot="chip"')
    }
  })

  it('drei Produktzeilen mit Preis und „+ n weitere", die ganze Karte ist EIN Link', () => {
    const voll = karte({ schaufenster: DREI })
    for (const name of ['Freilandeier', 'Bauernbrot', 'Honig']) expect(voll).toContain(name)
    expect(voll).toContain('€ 4,20 / Stück')
    expect(voll).toContain('+ 6 weitere Produkte')
    expect(voll.match(/<a /g)).toHaveLength(1)
    expect(voll).toContain('href="/hof-test"')
  })

  it('fehlt ein Produktfoto, steht die Illustration der Kategorie statt eines Anfangsbuchstabens', () => {
    const voll = karte({ schaufenster: { produkte: [vorschauProdukt('a', 'Freilandeier')], weitere: 0 } })
    const zeilen = voll.slice(voll.indexOf('Freilandeier'))
    expect(zeilen).toContain('<img src="/categories/eier.webp" alt=""/>')
    expect(zeilen).not.toMatch(/>F<\/span>/)
    // Gegenprobe: mit Foto das Foto.
    expect(karte({ schaufenster: { produkte: [vorschauProdukt('a', 'Freilandeier', '/eier.jpg')], weitere: 0 } })).toContain('src="/eier.jpg"')
  })

  // Nr. 127: Dieselbe Quelle wie Produktseite und Teilen-Bild: illustrationPfad(Kategorie, Unterkategorie).
  it('fehlt das Foto, steht die Illustration der UNTERkategorie, wenn es eine gibt — sonst die der Kategorie', () => {
    const mitSorte = vorschauProdukt('k', 'Bergkäse', null, { category: 'MILCH', subcategory: 'KAESE' })
    const ohneSorte = vorschauProdukt('m', 'Milch', null, { category: 'MILCH' })
    expect(illustrationPfad('MILCH', 'KAESE')).not.toBe(illustrationPfad('MILCH'))
    const html1 = karte({ schaufenster: { produkte: [mitSorte], weitere: 0 } })
    expect(html1.slice(html1.indexOf('Bergkäse'))).toContain(`<img src="${illustrationPfad('MILCH', 'KAESE')}" alt=""/>`)
    // Gegenprobe: ohne Sorte die Illustration der Kategorie, nicht die der Sorte.
    const html2 = karte({ schaufenster: { produkte: [ohneSorte], weitere: 0 } })
    expect(html2.slice(html2.indexOf('Milch'))).toContain(`<img src="${illustrationPfad('MILCH')}" alt=""/>`)
    expect(html2).not.toContain(illustrationPfad('MILCH', 'KAESE'))
  })

  it('noch nicht bestellbar (kein kaufbares Produkt oder keine Abholzeit): graue Zeile statt Abholzeile, die Pause geht vor', () => {
    expect(karte({ hof: { ...HOF, angebot: [] } })).toContain('Noch nicht bestellbar')
    expect(karte({ hof: { ...HOF, abholfenster: [] } })).toContain('Noch nicht bestellbar')
    expect(karte({ hof: { ...HOF, angebot: [], isPaused: true } })).not.toContain('Noch nicht bestellbar')
    expect(karte()).not.toContain('Noch nicht bestellbar')
  })

  it('ein Hof ohne Kartenpunkt trägt „Nicht auf der Karte"', () => {
    expect(karte({ hof: { ...HOF, latitude: null } })).toContain('Nicht auf der Karte')
    expect(karte()).not.toContain('Nicht auf der Karte')
  })

  it('im Splitscreen ohne Foto eine Illustration als Vorschaubild', () => {
    const split = karte({ split: true })
    expect(split.match(/<img src="\/categories\/[^"]+" alt=""\/>/g)).toHaveLength(1)
  })
})

/**
 * Das Markup der Pin-Vorschau von /hoefe, wie es VOR dem Umbau des Rahmens war (Stand d9c0c2b, Kurzform mit `schaufenster`
 * und `jetzt` im Rahmen), an denselben Testdaten wie unten. Absichtlich ein Schnappschuss, obwohl TESTING_GUIDELINES §1 sie
 * sonst meidet: Auftrag Nr. 133 Punkt 1 verlangt den Beleg, dass der Umbau /hoefe nicht verändert. Ändert jemand die
 * Vorschau gewollt, ersetzt er diesen Text durch das neue Markup — mit Bild im Bericht.
 */
const KURZFORM_VORHER = [
  '<link rel="preload" as="image" href="/categories/eier.webp"/>',
  '<link rel="preload" as="image" href="/categories/brot.webp"/>',
  '<div id="vorschau-1" role="tooltip" style="width:288px" class="overflow-hidden rounded-2xl border border-border bg-card text-left shadow-lg">',
  '<span data-slot="hof-bildflaeche" class="flex justify-center overflow-hidden bg-muted dark:ring-1 dark:ring-border h-[104px] w-full">',
  '<span class="relative h-full min-w-0 aspect-square shrink">',
  '<img src="/categories/eier.webp" alt=""/>',
  '</span>',
  '<span class="relative h-full min-w-0 aspect-square shrink">',
  '<img src="/categories/brot.webp" alt=""/>',
  '</span>',
  '</span>',
  '<div class="flex flex-col gap-1 p-3.5">',
  '<div class="flex items-start gap-2">',
  '<p class="line-clamp-2 min-w-0 flex-1 font-heading text-[17px] leading-snug font-semibold break-words text-foreground">Hof Test</p>',
  '<span class="shrink-0 pt-0.5 text-[13px] text-muted-foreground">2,1 km</span>',
  '</div>',
  '<p class="truncate text-[13px] text-muted-foreground">1010 Wien</p>',
  '<p data-abholung="heute" class="flex items-center gap-1.5 text-[13px] text-status-fertig font-semibold">',
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock size-3.5 shrink-0" aria-hidden="true">',
  '<circle cx="12" cy="12" r="10">',
  '</circle>',
  '<path d="M12 6v6l4 2">',
  '</path>',
  '</svg>',
  '<span class="min-w-0">Abholung heute 15:00–18:00</span>',
  '</p>',
  '<div class="mt-2 space-y-1.5">',
  '<div class="flex items-center gap-2">',
  '<div class="min-w-0 flex-1">',
  '<div class="flex items-baseline gap-1.5">',
  '<p class="min-w-0 truncate text-sm text-foreground">Freilandeier</p>',
  '</div>',
  '<p class="text-xs text-muted-foreground">€ 4,20 / Stück</p>',
  '</div>',
  '<span data-slot="hof-bildflaeche" class="flex justify-center overflow-hidden bg-muted dark:ring-1 dark:ring-border shrink-0 rounded-lg size-10">',
  '<span class="relative h-full min-w-0 flex-1">',
  '<img src="/categories/eier.webp" alt=""/>',
  '</span>',
  '</span>',
  '</div>',
  '<div class="flex items-center gap-2">',
  '<div class="min-w-0 flex-1">',
  '<div class="flex items-baseline gap-1.5">',
  '<p class="min-w-0 truncate text-sm text-foreground">Bauernbrot</p>',
  '</div>',
  '<p class="text-xs text-muted-foreground">€ 4,20 / Stück</p>',
  '</div>',
  '<span data-slot="hof-bildflaeche" class="flex justify-center overflow-hidden bg-muted dark:ring-1 dark:ring-border shrink-0 rounded-lg size-10">',
  '<span class="relative h-full min-w-0 flex-1">',
  '<img src="/categories/eier.webp" alt=""/>',
  '</span>',
  '</span>',
  '</div>',
  '</div>',
  '<a href="/hof-test" tabindex="-1" class="mt-1 inline-flex min-h-11 items-center gap-0.5 self-start rounded-lg text-[13.5px] font-semibold text-status-fertig hover:underline outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring">Zum Hof<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right size-4" aria-hidden="true">',
  '<path d="m9 18 6-6-6-6">',
  '</path>',
  '</svg>',
  '</a>',
  '</div>',
  '</div>',
].join('')

describe('HofKurzkarte — die Pin-Vorschau am Computer', () => {
  // So baut hoefe-client.tsx die Vorschau: der Rahmen nimmt den Inhalt als `children`. Der Rahmen (art „tooltip") hat keine Hooks,
  // darum als Funktion aufgerufen — `createElement` mit `children` im Props-Objekt verbietet die Lint-Regel, als drittes
  // Argument der Typ. Bekommt der Rahmen einmal einen Hook, wirft dieser Aufruf und der Test wird rot, nicht still falsch.
  const hofMitEntfernung = { ...HOF, entfernungKm: 2.1 }
  const kurz = html(
    HofKurzkarte({
      hof: hofMitEntfernung,
      bereich: 'LEBENSMITTEL',
      id: 'vorschau-1',
      children: createElement(KurzkartenInhalt, { hof: hofMitEntfernung, schaufenster: { produkte: DREI.produkte.slice(0, 2) }, jetzt: JETZT }),
    })
  )

  it('das Markup ist Byte für Byte das von vor dem Umbau des Rahmens (Nr. 133 Punkt 1)', () => {
    expect(kurz).toBe(KURZFORM_VORHER)
  })

  it('ein role="tooltip" mit Name, Entfernung, Ort, Abholzeile und zwei Produktzeilen mit 40er-Bildern', () => {
    expect(kurz).toContain('id="vorschau-1" role="tooltip"')
    for (const teil of ['Hof Test', '2,1 km', '1010 Wien', 'Abholung heute 15:00–18:00', 'Freilandeier', 'Bauernbrot']) expect(kurz, teil).toContain(teil)
    expect(kurz).not.toContain('Honig')
    expect(kurz).toContain('size-10')
  })

  it('„Zum Hof" führt zur Hofseite und liegt nicht im Tab-Weg (Enter am Pin wählt den Hof)', () => {
    expect(kurz).toMatch(/<a href="\/hof-test" tabindex="-1"[^>]*>Zum Hof/)
  })
})

describe('Produktzeile — die Suche zeigt Produkte statt Höfe', () => {
  it('Produkt, Siegel, Hof mit Entfernung, Abholung und Preis; die Zeile führt zur Hofseite', () => {
    const zeile = html(createElement(ProduktZeile, { treffer: { hof: TREFFER_HOF, produkt: BROT }, bereich: 'LEBENSMITTEL', jetzt: JETZT }))
    expect(zeile).toContain('Bauernbrot')
    expect(zeile).toContain('Abholung heute 15:00–18:00')
    // Ohne Produktfoto die Illustration der Kategorie (Register N22).
    expect(zeile).toContain('<img src="/categories/brot.webp" alt=""/>')
    expect(zeile).toContain('>Bio<')
    expect(zeile).toContain('Hof Test · 4,2 km')
    expect(zeile).toContain('€ 5,80 / Stück')
    expect(zeile).toContain('href="/hof-test"')
    expect(zeile).toContain('aria-label="Bauernbrot bei Hof Test ansehen"')
  })

  it('ohne Standort steht der Ort statt der Entfernung; Futter zeigt den Kilopreis aus der Kennzeichnung', () => {
    const heu: AngebotsProdukt = { ...BROT, name: 'Heu', category: 'HEU_STROH', labels: [], price: 45, unit: 'BALLEN', grundpreis: { wert: 0.15, einheit: 'KG', preis: 45, menge: 300 } }
    const zeile = html(createElement(ProduktZeile, { treffer: { hof: HOF, produkt: heu }, bereich: 'FUTTERMITTEL', jetzt: JETZT }))
    expect(zeile).toContain('Hof Test · 1010 Wien')
    expect(zeile).toContain('€ 0,15 / kg')
    expect(zeile).toContain('href="/hof-test?bereich=futter"')
  })

  it('der Kilopreis rundet wie Hof- und Produktseite: € 2,01 für 2 kg zeigt € 1,01 / kg (Nr. 11, Nachbesserung 1)', () => {
    const sack: AngebotsProdukt = {
      ...BROT, name: 'Hafer im Sack', category: 'GETREIDE_KOERNER', labels: [], price: 2.01, unit: 'STUECK',
      grundpreis: grundpreisAusKennzeichnung(2.01, { nettoMenge: 2, nettoEinheit: 'KG' }),
    }
    const zeile = html(createElement(ProduktZeile, { treffer: { hof: HOF, produkt: sack }, bereich: 'FUTTERMITTEL', jetzt: JETZT }))
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
    // Jede Adresse der Seite trägt zum Suchtext die Kennung `t=1`: Der Text ist getippt, nicht abgesendet (abgesendeterSuchtext).
    expect(zeile).toContain('href="/hoefe?q=Eier&amp;t=1"')
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

  it('statisch mit Neubau alle fünf Minuten wie die Startseite — liest weder Parameter noch Anfrage noch Sitzung (Register N19)', () => {
    // Dynamisch kostete jeder Aufruf einen Server-Render — und jede Filterkombination ist ein Aufruf (19.10.: 622.000 an einem Tag).
    expect(seite).toMatch(/<KundeShellMitSitzung>/)
    const code = ohneKommentare(seite)
    expect(code).not.toMatch(/force-dynamic|export const dynamic\b/)
    expect(code).not.toMatch(/\bsearchParams\b|\bheaders\(\)|\bcookies\(\)|auth\.api\b|next\/headers|from '@\/lib\/auth'/)
    expect(revalidate).toBe(300)
    expect(seite).toMatch(/^export const revalidate = 300$/m)
    // Gegenprobe: Dieselbe Suche findet headers() und auth.api auf einer Seite, die die Sitzung auf dem Server liest.
    const dynamisch = ohneKommentare(quelle('src/app/account/profile/page.tsx'))
    expect(dynamisch).toMatch(/\bheaders\(\)/)
    expect(dynamisch).toMatch(/auth\.api\b/)
  })

  it('nennt /hoefe als Canonical — jede Filteradresse verweist auf die eine Seite', () => {
    expect(metadata.alternates?.canonical).toBe('/hoefe')
    // metadataBase macht daraus die volle Adresse — sie steht im Root-Layout.
    expect(quelle('src/app/layout.tsx')).toMatch(/metadataBase:/)
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

  it('Standort nur ungefähr (Zustand 3): der Satz mit der Genauigkeit und zwei Knöpfe, beide 44 px hoch', () => {
    const hinweis = html(
      createElement(StandortUngefaehr, {
        satz: standortUngefaehrText(15_000),
        genauerMisslang: false,
        ortet: false,
        onGenauer: () => {},
        onSoLassen: () => {},
      })
    )
    expect(hinweis).toContain('data-slot="hinweiskarte"')
    expect(hinweis).toContain('Dein Standort ist nur ungefähr bekannt (etwa 15 km).')
    const knoepfe = [...hinweis.matchAll(/<button type="button"([^>]*)>(.*?)<\/button>/g)]
    expect(knoepfe.map((k) => k[2].replace(/<[^>]*>/g, ''))).toEqual(['Genauer bestimmen', 'So lassen'])
    for (const [, attribute] of knoepfe) expect(attribute.match(/class="([^"]*)"/)?.[1]).toMatch(/\bh-11\b/)
    // Der Satz ist die Beschreibung des ersten Knopfs: Wer mit der Tastatur dort landet, hört ihn mit.
    const beschreibung = hinweis.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(beschreibung).toBeTruthy()
    expect(hinweis).toContain(`id="${beschreibung}"`)
    // Gegenprobe: Misslang das genauere Bestimmen, sagt der Hinweis es dazu; läuft es, ist der Knopf beschäftigt.
    expect(hinweis).not.toContain('Genauer ging es nicht.')
    expect(hinweis).not.toContain('aria-busy="true"')
    const misslungen = html(
      createElement(StandortUngefaehr, { satz: 'Satz.', genauerMisslang: true, ortet: false, onGenauer: () => {}, onSoLassen: () => {} })
    )
    expect(misslungen).toContain(SUCHFELD_TEXT.genauerMisslang)
    const laeuft = html(
      createElement(StandortUngefaehr, { satz: 'Satz.', genauerMisslang: false, ortet: true, onGenauer: () => {}, onSoLassen: () => {} })
    )
    expect(laeuft).toContain('aria-busy="true"')
  })

  it('Standort nur ungefähr mit Bezugspunkt (Zustand 3, Mockup): der Knopf „Standort nutzen" bleibt, die grüne Karte mit „Ort ändern" kommt erst, wenn der Hinweis zu ist', () => {
    // Seit dem Abschluss von Nr. 84 gilt der ungefähre Punkt sofort (die Liste zeigt Höfe im Umkreis) — der Bezugspunkt steht
    // also schon, während der Hinweis noch offen ist. Das Mockup (system-k1-ortssuche-zustaende, Zustand 3) zeigt dann Feld,
    // Knopf und den orangen Satz; die grüne Karte „Wir zeigen Höfe rund um …" gehört zum geschlossenen Hinweis.
    const RUHE: Ortssuche = {
      hinweis: null,
      kandidaten: [],
      ungefaehr: null,
      ortet: false,
      laeuft: false,
      standortErfragen() {},
      genauerBestimmen() {},
      soLassen() {},
      ortSuchen() {},
      uebernimm() {},
      keinerDavon() {},
      textGeaendert() {},
      aufheben() {},
    }
    const punkt = { lat: 48.1, lon: 13.15 }
    const karten = (t: string) => (t.match(/data-slot="hinweiskarte"/g) ?? []).length
    try {
      ortssuche.ersatz = () => ({ ...RUHE, ungefaehr: { punkt, satz: standortUngefaehrText(15_000), genauerMisslang: false } })
      const offen = html(createElement(HoefeSuche, { ...SUCHE, bezugspunkt: punkt }))
      expect(offen).toContain('Dein Standort ist nur ungefähr bekannt (etwa 15 km).')
      expect(offen).toMatch(/<button type="button"[^>]*>.*Standort nutzen<\/button>/)
      expect(offen).not.toContain(SUCHFELD_TEXT.ortAendern)
      // Genau eine Hinweiskarte: die orange — nicht dazu die grüne.
      expect(karten(offen)).toBe(1)

      // Gegenprobe: Hinweis zu („So lassen" oder ein genauer Wert) — die grüne Karte mit „Ort ändern" statt des Knopfs.
      ortssuche.ersatz = () => RUHE
      const zu = html(createElement(HoefeSuche, { ...SUCHE, bezugspunkt: punkt }))
      expect(zu).toContain(SUCHFELD_TEXT.ortAendern)
      expect(zu).not.toContain('Standort nutzen')
      expect(zu).not.toContain('nur ungefähr bekannt')
      expect(karten(zu)).toBe(1)
    } finally {
      ortssuche.ersatz = null
    }
  })

  it('der Hinweis hängt am Hook: Er steht, solange ort.ungefaehr gesetzt ist, und seine Knöpfe rufen genauerBestimmen und soLassen', () => {
    const suche = quelle('src/components/hoefe/hoefe-suche.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(suche).toMatch(/ort\.ungefaehr && \(\s*<StandortUngefaehr[\s\S]*?onGenauer=\{ort\.genauerBestimmen\}[\s\S]*?onSoLassen=\{ort\.soLassen\}/)
    // Gegenprobe: ohne Bedingung stünde der Hinweis immer da.
    expect('<StandortUngefaehr onGenauer={ort.genauerBestimmen} onSoLassen={ort.soLassen} />').not.toMatch(/ort\.ungefaehr && \(\s*<StandortUngefaehr/)
  })

  it('die Seite verdrahtet das eine Feld mit Bezugspunkt und Ankunftstext — die alte Umkreis-Karte gibt es nicht mehr', () => {
    const client = quelle('src/components/hoefe/hoefe-client.tsx')
    expect(client).toMatch(/<HoefeSuche[\s\S]*?bezugspunkt=\{bezugspunkt\}[\s\S]*?ankunftsText=\{ankunftsText \?\? ''\}[\s\S]*?\/>/)
    // Der Ankunftstext ist nur der ABGESENDETE Suchtext der Adresse (nicht, was die Seite beim Tippen selbst hineinschrieb) und wird
    // vergessen — ein neu aufgebautes Feld (Karte ↔ Liste) fragt nicht noch einmal. Gelesen erst, wenn die Adresse feststeht
    // (nach der Hydration bzw. nach dem Seitenwechsel), und nur einmal (ankunftAusAdresse, tests/hoefe-adresse.test.ts).
    expect(client).toContain('const [ankunftsText, setAnkunftsText] = useState<string | null>(null)')
    expect(client).toContain('const ankunft = ankunftAusAdresse(ankunftsText, adresse)')
    expect(client).toContain('if (ankunft !== ankunftsText) setAnkunftsText(ankunft)')
    expect(client).toContain("onAnkunftErledigt={() => setAnkunftsText('')}")
    // Nach dem Auflösen schreibt die Seite die Adresse neu (mit der Kennung) — aus der Adresse von jetzt, nicht aus dem Stand beim Ankommen.
    expect(client).toContain('onAnkunftAufgeloest={() => schreibeUrl(leseHoefeFilter(new URLSearchParams(window.location.search)))}')
    // Gegenprobe: der alte Weg (jedes q der Adresse ist ein Ankunftstext) steht nicht mehr da.
    expect(client).not.toContain('useState(filter.suchtext)')
    expect(client).not.toContain('useState(() => abgesendeterSuchtext(suchParameter))')
    expect(client).not.toMatch(/HoefeUmkreis|hoefe-umkreis/)
    // Gegenprobe: das Muster erkennt den alten Einbau.
    expect('import HoefeUmkreis from \'@/components/hoefe/hoefe-umkreis\'').toMatch(/HoefeUmkreis|hoefe-umkreis/)
  })

  it('Enter sucht den Ort, wenn der Text ein Ort sein kann — ein Weg zur Ortssuche beim Absenden, der Rest bleibt die Produktsuche (Nr. 84)', () => {
    const suche = quelle('src/components/hoefe/hoefe-suche.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const anfang = suche.indexOf('function absenden(')
    const absenden = suche.slice(anfang, suche.indexOf('return (', anfang))
    expect(absenden).toContain('enterImSuchfeld(suchtext)')
    expect(absenden).toMatch(/aktion === 'ort-suchen'\) ort\.ortSuchen\(suchtext\)/)
    // Genau ein Weg zur Ortssuche beim Absenden — und der alte Zwischenschritt „Eintrag zeigen" ist weg.
    expect(absenden.match(/ortSuchen\(/g)).toHaveLength(1)
    expect(absenden).not.toContain('ort-eintrag-zeigen')
    // Gegenprobe: Käme ein zweiter Weg dazu (Enter sucht selbst, am Ergebnis der Produktsuche vorbei), zählte die Prüfung oben zwei.
    const mitZweitemWeg = `${absenden}\nif (treffer === 0) ort.ortSuchen(suchtext)`
    expect(mitZweitemWeg.match(/ortSuchen\(/g)).toHaveLength(2)
  })

  it('der Standort bleibt im Browser: Die Ortssuche schickt nur den getippten Text, der Standort geht in keine Anfrage', () => {
    // Ohne Kommentare: Die Datei erklärt selbst, warum es keinen localStorage gibt.
    const hook = quelle('src/components/hoefe/use-ortssuche.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(hook).toContain('loeseOrtAuf(text)')
    expect(hook).not.toMatch(/loeseOrtAuf\([^)]*coords/)
    expect(hook).not.toMatch(/localStorage|sessionStorage|document\.cookie/)
  })
})

describe('Kartenmodus am Handy: Suche · Filter · Liste in einer Zeile (Nr. 52)', () => {
  it('die Suche kompakt: nur das Feld, ohne „Standort nutzen" — die Ansagen bleiben im Baum', () => {
    const suche = html(createElement(HoefeSuche, { ...SUCHE, kompakt: true }))
    expect((suche.match(/<input\b/g) ?? []).length).toBe(1)
    expect(suche).toContain('role="combobox"')
    expect(suche).not.toContain('Standort nutzen')
    expect(suche).not.toContain('Nichts wird gespeichert.')
    // Die Live-Region zum Umkreis steht dauerhaft im Baum, sonst verpasst der Screenreader die erste Änderung.
    // Eine zweite, die die Trefferzahl noch einmal ansagt, gibt es seit Nr. 127 nicht mehr (Zahlzeile, s. u.).
    expect(suche).toMatch(/<p class="sr-only" role="status" id="umkreis-meldung">/)
    expect(suche.match(/role="status"/g)).toHaveLength(1)
    // Gegenprobe: ohne kompakt steht der Knopf da.
    expect(html(createElement(HoefeSuche, SUCHE))).toContain('Standort nutzen')
  })

  it('kompakt mit Bezugspunkt: keine Hinweiskarte, die Ansage „Entfernungen ab …" bleibt', () => {
    const punkt = { lat: 48.2, lon: 13.5, name: '4910 Ried im Innkreis' }
    const suche = html(createElement(HoefeSuche, { ...SUCHE, kompakt: true, bezugspunkt: punkt }))
    expect(suche).not.toContain('data-slot="hinweiskarte"')
    expect(suche).toContain('Entfernungen ab 4910 Ried im Innkreis')
    // Gegenprobe: in der Liste steht die Karte mit „Ort ändern".
    expect(html(createElement(HoefeSuche, { ...SUCHE, bezugspunkt: punkt }))).toContain('data-slot="hinweiskarte"')
  })

  it('der Filter kompakt: ein Knopf mit Namen „Filter" und der Zahl der gesetzten Filter', () => {
    // Die Reihen kommen als Kind herein — hier keine (children: null), es geht um den Knopf.
    const blatt = (anzahlFilter: number) => {
      const eigenschaften: Parameters<typeof EntdeckenFilterblatt>[0] = {
        kompakt: true,
        anzahlFilter,
        anzeigenText: '3 Höfe anzeigen',
        zuruecksetzen: null,
        onOeffnen: () => {},
        onAbbrechen: () => {},
        children: null,
      }
      return html(createElement(EntdeckenFilterblatt, eigenschaften))
    }
    const mitZwei = blatt(2)
    expect(mitZwei).toMatch(/<button[^>]*>[\s\S]*Filter[\s\S]*<\/button>/)
    expect(mitZwei).toContain('2 gesetzt')
    expect(mitZwei).toContain('data-slot="zaehler"')
    // Ohne gesetzten Filter keine Zahl.
    expect(blatt(0)).not.toContain('data-slot="zaehler"')
  })

  it('kompakt legt sich die Vorschlagsliste über die Karte, statt sie beim Tippen zu schrumpfen (Runde 1)', () => {
    const suche = quelle('src/components/hoefe/hoefe-suche.tsx')
    const liste = suche.slice(suche.indexOf('role="listbox"'), suche.indexOf('{vorschlagsNamen.map('))
    // Über der isolate-Ebene der Karte, unten bis über die Unterleiste, der Rest scrollt.
    expect(liste).toMatch(/kompakt\s*\?[\s\S]*?'absolute top-full left-0 z-\[1000\] max-h-\[calc\(100dvh-var\(--kunde-kopf\)-var\(--kunde-unterleiste\)-4rem\)\][^']*overflow-y-auto[^']*'/)
    expect(suche).toMatch(/<form role="search" onSubmit=\{absenden\} className=\{cn\('min-w-0 sm:flex-1', kompakt && 'relative'\)\}>/)
    // Gegenprobe: in der Liste bleibt sie im Fluss.
    expect(liste).toMatch(/: 'overflow-hidden'/)
  })

  it('der Bezugspunkt steht im Kartenmodus als Eintrag „Rund um …" — ein Knopf, wie der Umkreis', () => {
    const ort = { lat: 48.2, lon: 13.5, name: '4910 Ried im Innkreis' }
    const zeile = html(createElement(AktiveFilterZeile, { filter: LEERER_HOEFE_FILTER, ort }))
    expect(zeile).toMatch(/<button type="button"[^>]*aria-label="Rund um 4910 Ried im Innkreis entfernen"/)
    expect(zeile).toContain('Alle zurücksetzen')
    // Gegenprobe: ohne Bezugspunkt keine Zeile.
    expect(html(createElement(AktiveFilterZeile, { filter: LEERER_HOEFE_FILTER, ort: null }))).toBe('')
  })

  it('„Rund um …" und „Alle zurücksetzen" heben den Bezugspunkt auf', () => {
    type Knoten = { props?: Record<string, unknown> & { children?: unknown } }
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
    let ortWeg = 0
    let umkreisWeg = 0
    const baum = AktiveFilterZeile({
      filter: LEERER_HOEFE_FILTER,
      umkreis: 25,
      onWahl: () => {},
      onUmkreisAufheben: () => (umkreisWeg += 1),
      ort: { lat: 48.2, lon: 13.5 },
      onOrtAufheben: () => (ortWeg += 1),
    })
    const eintrag = finde(baum, (k) => k.props?.['aria-label'] === 'Rund um deinen Standort entfernen')
    ;(eintrag!.props!.onClick as () => void)()
    expect([ortWeg, umkreisWeg]).toEqual([1, 0])
    const alle = finde(baum, (k) => typeof k.props?.onNavigate === 'function' && JSON.stringify(k.props?.children ?? '').includes('Alle zurücksetzen'))
    ;(alle!.props!.onNavigate as (e: { preventDefault: () => void }) => void)({ preventDefault() {} })
    expect([ortWeg, umkreisWeg]).toEqual([2, 1])
  })

  it('im Kartenmodus kein Eintrag „Suche: …" für den getippten Text — er steht im Feld, die Karte schrumpft beim Tippen nicht', () => {
    // Nur getippt: keine zweite Zeile.
    expect(html(createElement(AktiveFilterZeile, { filter: { ...LEERER_HOEFE_FILTER, suchtext: 'Eier' }, suchtextImFeld: true }))).toBe('')
    // Mit einem Filter daneben: der Filter ja, der Text nicht — und sein Entfernen behält den Text.
    const zeile = html(createElement(AktiveFilterZeile, { filter: { ...LEERER_HOEFE_FILTER, siegel: ['BIO'], suchtext: 'Eier' }, suchtextImFeld: true }))
    expect(zeile).toContain('aria-label="Bio entfernen"')
    expect(zeile).toContain('href="/hoefe?q=Eier&amp;t=1"')
    expect(zeile).not.toContain('Suche: Eier')
    // Gegenprobe: in der Liste steht der Eintrag.
    expect(html(createElement(AktiveFilterZeile, { filter: { ...LEERER_HOEFE_FILTER, suchtext: 'Eier' } }))).toContain('aria-label="Suche: Eier entfernen"')
    const client = quelle('src/components/hoefe/hoefe-client.tsx')
    const kartenmodus = client.slice(client.indexOf("if (ansicht === 'karte') {"), client.lastIndexOf('return ('))
    expect(kartenmodus).toMatch(/<AktiveFilterZeile[\s\S]*?suchtextImFeld[\s\S]*?\/>/)
    expect(kartenmodus).toContain(".some((f) => f.schluessel !== 'suchtext')")
  })

  it('die Seite gibt den Bezugspunkt nur im Kartenmodus in „Aktive Filter" — die Liste zeigt ihn mit „Ort ändern"', () => {
    const client = quelle('src/components/hoefe/hoefe-client.tsx')
    const kopf = client.slice(client.indexOf('const kopfbereich = ('), client.indexOf('if (istBreit) {'))
    const kartenmodus = client.slice(client.indexOf("if (ansicht === 'karte') {"), client.lastIndexOf('return ('))
    expect(kartenmodus).toMatch(/<AktiveFilterZeile[\s\S]*?ort=\{bezugspunkt\}[\s\S]*?onOrtAufheben=\{ortAufheben\}[\s\S]*?\/>/)
    expect(kartenmodus).toContain('aktiveFilter(filter, aktiverUmkreis, bezugspunkt).some(')
    // Gegenprobe: der Kopf der Liste übergibt ihn nicht.
    expect(kopf).toContain('<AktiveFilterZeile')
    expect(kopf).not.toContain('ort={bezugspunkt}')
  })

  it('die Karte im Splitscreen behält ihren Rahmen; randlos nur im Kartenmodus am Handy (Runde 1)', () => {
    const client = quelle('src/components/hoefe/hoefe-client.tsx')
    const element = (teil: string) => teil.match(/<HoefeKarte[\s\S]*?\/>/)?.[0] ?? ''
    const split = element(client.slice(client.indexOf('if (istBreit) {'), client.indexOf('const karussellHoefe')))
    expect(split).toContain('hoeheKlasse="h-full"')
    expect(split).not.toMatch(/\brandlos\b/)
    // Gegenprobe: im Kartenmodus trägt die Karte die Eigenschaft — die Suche findet sie.
    expect(element(client.slice(client.indexOf("if (ansicht === 'karte') {")))).toMatch(/\brandlos\b/)
  })

  it('der Titel bleibt für Vorleser, die Zeile zeigt Suche, Filter und Liste', () => {
    const client = quelle('src/components/hoefe/hoefe-client.tsx')
    expect(client).toMatch(/<h1 className="sr-only">\{kopf\.titel\}<\/h1>/)
    expect(client).toMatch(/suchfeld\(true\)/)
    expect(client).toMatch(/filterblatt\(true\)/)
    // „Liste zeigen" — unter 640 px nur „Liste" sichtbar, vorgelesen immer ganz.
    expect(client).toMatch(/Liste<span className="max-sm:sr-only"> zeigen<\/span>/)
  })
})

describe('Filter im Browser: kein useSearchParams im Baum von /hoefe (Register N19)', () => {
  /** import … from, export … from und import(…) — ohne `import type`; nur eigene Dateien unter src. */
  const IMPORT = /(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g
  function aufloesen(von: string, ziel: string): string | null {
    const basis = ziel.startsWith('@/') ? join('src', ziel.slice(2)) : ziel.startsWith('.') ? join(von, '..', ziel) : null
    if (!basis) return null
    for (const kandidat of [basis, `${basis}.ts`, `${basis}.tsx`, join(basis, 'index.ts'), join(basis, 'index.tsx')]) {
      try {
        if (statSync(join(process.cwd(), kandidat)).isFile()) return kandidat
      } catch {
        // gibt es nicht — nächster Kandidat
      }
    }
    return null
  }
  function baum(...einstiege: string[]): string[] {
    const gesehen = new Set<string>()
    const offen = [...einstiege]
    for (let datei = offen.pop(); datei !== undefined; datei = offen.pop()) {
      if (gesehen.has(datei)) continue
      gesehen.add(datei)
      for (const treffer of ohneKommentare(quelle(datei)).matchAll(IMPORT)) {
        const ziel = aufloesen(datei, treffer[1] ?? treffer[2])
        if (ziel) offen.push(ziel)
      }
    }
    return [...gesehen]
  }
  // Seite, Ladeansicht und das Root-Layout darüber (die Ladeansicht der Gruppe entfiel mit Nr. 117).
  const hoefe = baum('src/app/(public)/hoefe/page.tsx', 'src/app/(public)/hoefe/loading.tsx', 'src/app/layout.tsx')
  const liest = (datei: string) => /\buseSearchParams\b|\bsearchParams\b/.test(ohneKommentare(quelle(datei)))

  it('der Baum reicht bis in die Teile der Seite — sonst bewiese ein leerer Fund nichts', () => {
    for (const datei of [
      'src/components/hoefe/hoefe-client.tsx',
      'src/components/hoefe/use-hoefe-adresse.ts',
      'src/components/hoefe/entdecken-teile.tsx',
      'src/components/hoefe/use-ortssuche.ts',
      'src/components/hoefe/hoefe-karte.tsx',
      'src/components/shells/kunde-shell.tsx',
    ]) {
      expect(hoefe, datei).toContain(datei)
    }
  })

  it('keine Datei im Baum liest Suchparameter über Next — die Liste stünde sonst nicht im Server-HTML', () => {
    expect(hoefe.filter(liest)).toEqual([])
    // Gegenprobe: Im Baum der Hofseite findet dieselbe Suche ihre Suchparameter.
    expect(baum('src/app/(public)/[farmSlug]/page.tsx').filter(liest).length).toBeGreaterThan(0)
  })

  it('die Seite liest die Adresse über den Speicher und schreibt sie nur über ihn (replaceState, keine Server-Anfrage)', () => {
    const client = ohneKommentare(quelle('src/components/hoefe/hoefe-client.tsx'))
    expect(client).toContain('const adresse = useHoefeAdresse()')
    expect(client).toMatch(/HOEFE_ADRESSE\.ersetze\(schreibeHoefeFilter\(neu\)\)/)
    // Kein zweiter Weg an die Adresse: kein replaceState daneben, kein router.replace/push für Filter.
    expect(client).not.toMatch(/history\.(?:replaceState|pushState)|router\.(?:replace|push)\(hoefeHref/)
    // Gegenprobe: das Muster erkennt den alten Weg.
    expect("window.history.replaceState(null, '', query ? `${pfad}?${query}` : pfad)").toMatch(/history\.(?:replaceState|pushState)/)
  })
})

describe('das Server-HTML: die ganze Hofliste, ungefiltert, mit Links auf die Hofseiten', () => {
  const hof = (slug: string, name: string): HofUebersichtEintrag => ({
    slug,
    name,
    postalCode: '4900',
    city: 'Musterdorf',
    logoUrl: null,
    logoAusschnitt: null,
    latitude: 48.1,
    longitude: 13.1,
    isPaused: false,
    kategorien: ['EIER'],
    angebot: [{ ...BROT, id: `${slug}-brot` }],
    naechsteAbholung: null,
    abholfenster: [],
    produkte: [],
    produkteGesamt: 1,
    produkteJeBereich: { LEBENSMITTEL: 1, FUTTERMITTEL: 0 },
    suchNamen: ['Bauernbrot'],
    fotos: [],
    gruendungshof: false,
    neuerBeitrag: null,
  })

  it('beide Höfe mit Link — auf dem Server gilt der leere Filter (kein window, kein Wurf)', () => {
    const seite = html(createElement(HoefeClient, { hoefe: [hof('hof-a', 'Hof Anfang'), hof('hof-b', 'Hof Berg')], jetzt: JETZT }))
    expect(seite).toContain('aria-label="Höfe"')
    expect(seite).toContain('Hof Anfang')
    expect(seite).toContain('href="/hof-a"')
    expect(seite).toContain('Hof Berg')
    expect(seite).toContain('href="/hof-b"')
    // Gegenprobe: ohne Höfe steht keiner da.
    expect(html(createElement(HoefeClient, { hoefe: [hof('hof-a', 'Hof Anfang')], jetzt: JETZT }))).not.toContain('Hof Berg')
  })

  it('die Zahlzeile ist eine Statusmeldung: „2 Höfe · 1 holt heute ab · nach Freischaltung"', () => {
    const heute = { ...hof('hof-a', 'Hof Anfang'), abholfenster: [{ dayOfWeek: 3, startTime: '15:00', endTime: '18:00' }] }
    const seite = html(createElement(HoefeClient, { hoefe: [heute, hof('hof-b', 'Hof Berg')], jetzt: JETZT }))
    expect(seite).toContain('<p role="status" class="text-[13px] text-muted-foreground">2 Höfe · 1 holt heute ab · nach Freischaltung</p>')
  })

  // Nr. 127 (Nacharbeit 120): Die Trefferzahl sagt EINE Live-Region an, die Zahlzeile. Die zweite unter dem
  // Suchfeld („3 Treffer gefunden.") sagte dasselbe noch einmal — Screenreader lasen jede Änderung doppelt.
  it('die Trefferzahl wird nur einmal angesagt: die Zahlzeile; daneben nur die Meldung zum Umkreis', () => {
    const regionen = (markup: string) => markup.match(/<(?:p|span)\b[^>]*\brole="status"[^>]*>/g) ?? []
    const seite = html(createElement(HoefeClient, { hoefe: [hof('hof-a', 'Hof Anfang'), hof('hof-b', 'Hof Berg')], jetzt: JETZT }))
    expect(regionen(seite)).toHaveLength(2)
    expect(regionen(seite).filter((r) => r.includes('id="umkreis-meldung"'))).toHaveLength(1)
    // Genau eine trägt die Zahl (die Zahlzeile).
    expect(seite).toContain('<p role="status" class="text-[13px] text-muted-foreground">2 Höfe')
    // Gegenprobe: Eine zweite Region wie die alte, ohne Kennung, würde mitgezählt.
    expect(regionen(`${seite}<p role="status" class="sr-only">2 Treffer gefunden.</p>`)).toHaveLength(3)
  })

  it('am Handy die Reihe „Abholung" über der Liste — eine Liste von Links mit aria-current, keine Radiogruppe', () => {
    const seite = html(createElement(HoefeClient, { hoefe: [hof('hof-a', 'Hof Anfang')], jetzt: JETZT }))
    const reihe = seite.slice(seite.indexOf('<ul aria-label="Abholung"'))
    expect(reihe).toMatch(/^<ul aria-label="Abholung"/)
    expect(reihe.slice(0, reihe.indexOf('</ul>'))).toMatch(/<a href="\/hoefe" rel="nofollow" data-slot="filter-chip" aria-current="page"[^>]*>Alle Tage<\/a>/)
    expect(seite.indexOf('<ul aria-label="Abholung"')).toBeLessThan(seite.indexOf('aria-label="Höfe"'))
    expect(seite).not.toContain('radiogroup')
  })
})

describe('Filter „Abholung" (Register N22)', () => {
  it('jeder Chip ein Link mit nofollow und 44 px Trefferfläche; der gewählte trägt aria-current', () => {
    const reihe = html(createElement(ChipReihe, { beschriftung: 'Abholung', chips: abholungReihe({ ...LEERER_HOEFE_FILTER, abholung: 'heute' }) }))
    const links = [...reihe.matchAll(/<a [^>]*>/g)].map((m) => m[0])
    expect(links).toHaveLength(4)
    for (const link of links) {
      expect(link).toContain('rel="nofollow"')
      expect(link).toContain('before:-inset-y-[5px]')
    }
    expect(links.filter((l) => l.includes('aria-current="page"'))).toHaveLength(1)
    expect(reihe).toMatch(/aria-current="page"[^>]*>Heute<\/a>/)
  })

  it('im Filter-Blatt unter „Wann holst du ab?" mit dem Satz des Boards, am Computer in der zweiten Zeile', () => {
    const client = quelle('src/components/hoefe/hoefe-client.tsx')
    expect(client).toMatch(/<BlattGruppe titel=\{ABHOLUNG_TEXT\.frage\}>\s*<p[^>]*>\{ABHOLUNG_TEXT\.erklaerung\}<\/p>/)
    expect(client).toMatch(/<FilterGruppe titel=\{ABHOLUNG_TEXT\.beschriftung\}>/)
  })
})

describe('Filter-Links auf /hoefe tragen rel="nofollow" (Register N19)', () => {
  const hoefe = [{ angebot: [BROT] }]
  /** Jeder Link auf /hoefe — mit oder ohne Parameter — samt seiner Attribute. */
  const hoefeLinks = (text: string) => [...text.matchAll(/<a href="\/hoefe(?:\?[^"]*)?"[^>]*>/g)].map((m) => m[0])

  it('die Chips der Reihen', () => {
    const reihe = html(createElement(ChipReihe, { beschriftung: 'Kategorie', chips: kategorieReihe(hoefe, LEERER_HOEFE_FILTER) }))
    const links = hoefeLinks(reihe)
    expect(links.length).toBeGreaterThan(2)
    for (const link of links) expect(link, link).toContain('rel="nofollow"')
  })

  it('die „ohne"-Einträge und „Alle zurücksetzen" in „Aktive Filter"', () => {
    const zeile = html(createElement(AktiveFilterZeile, { filter: { ...LEERER_HOEFE_FILTER, siegel: ['BIO'], suchtext: 'Eier' } }))
    const links = hoefeLinks(zeile)
    expect(links).toHaveLength(3)
    for (const link of links) expect(link, link).toContain('rel="nofollow"')
  })

  it('der Ausweg im Leerzustand', () => {
    const leer = html(createElement(EntdeckenLeer, { leer: leerzustand({ sucheLeertDieListe: false, umkreis: null, filter: { ...LEERER_HOEFE_FILTER, kategorien: ['FISCH'] } }) }))
    const links = hoefeLinks(leer)
    expect(links).toHaveLength(1)
    expect(links[0]).toContain('rel="nofollow"')
  })

  it('die Seite selbst: „Zurücksetzen", „Liste zeigen" und „Karte öffnen"', () => {
    const client = quelle('src/components/hoefe/hoefe-client.tsx')
    const links = [...client.matchAll(/<Link\s[^>]*?href=\{hoefeHref\([\s\S]*?>/g)].map((m) => m[0])
    expect(links).toHaveLength(3)
    for (const link of links) expect(link, link).toContain('rel="nofollow"')
  })

  it('Gegenprobe: Hofseiten bleiben folgbar, und ein FilterChip ohne nofollow trägt kein rel (Admin bleibt, wie er ist)', () => {
    const split = karte({ split: true })
    expect(split).toContain('href="/hof-test"')
    expect(split).not.toContain('nofollow')
    const zeile = html(createElement(ProduktZeile, { treffer: { hof: TREFFER_HOF, produkt: BROT }, bereich: 'LEBENSMITTEL', jetzt: JETZT }))
    expect(zeile).not.toContain('nofollow')
    const chip = (props: Omit<ComponentProps<typeof FilterChip>, 'children'>, text: string) =>
      html(createElement(FilterChip, props as ComponentProps<typeof FilterChip>, text))
    expect(chip({ href: '/admin?reiter=alle' }, 'Alle')).not.toContain('rel=')
    expect(chip({ href: '/hoefe?kat=EIER', nofollow: true }, 'Eier')).toContain('rel="nofollow"')
  })
})
