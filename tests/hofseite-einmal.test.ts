/**
 * Architektur-Tests: Die Hofseite gibt es genau einmal — unter /[farmSlug].
 * Die Vorschau ist dieselbe Route mit ?vorschau=1, nie ein Nachbau
 * (ARCHITECTURE §4).
 *
 * Beweist:
 *  - Der Parameter „vorschau" wird in src/ nur in ansichtsModus() gelesen
 *    (src/lib/ansichts-modus.ts). Seite, Lader und Ansicht lesen nur das
 *    Ergebnis. Die einzige Stelle außerhalb von src/ ist die Header-Regel in
 *    next.config.ts — sie greift, bevor eine Seite läuft, und gibt nur das
 *    Einbetten frei (tests/sicherheits-header.test.ts).
 *  - ansichtsModus läuft nur auf dem Server: aufgerufen allein im Lader,
 *    eingebunden von keinem Client-Modul.
 *  - FarmPageView binden genau zwei Stellen ein: die Hofseite und
 *    farm-page-client.tsx (Besitzer am Handy). Eine dritte lässt den Test
 *    fehlschlagen.
 *  - Bearbeitungs-Elemente (Stifte, Werkzeugleiste, Bearbeitungs-Hinweis und
 *    die übrigen Knöpfe des Hofs) erscheinen nur mit ownerMode: Die Seite für
 *    Kundinnen und die Vorschau rendern ohne sie. Gerendert wird echt
 *    (react-dom/server in Node); die Besitzer-Ansicht ist die Gegenprobe, dass
 *    die Suche jedes dieser Elemente auch findet.
 */
import { describe, it, expect, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Next und die Server-Aktionen gibt es im Test nicht: Router, Bild und Link
// werden zu schlichten Elementen, die Aktionen zu Attrappen. Gerendert wird
// sonst die echte Komponente.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} }),
  usePathname: () => '/hof-test',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/server/actions/appearance', () => ({ updateFarmBannerAction: vi.fn(), updateBannerFocusAction: vi.fn() }))
vi.mock('@/server/actions/farm-photos', () => ({ addFarmPhotoAction: vi.fn(), reorderPhotosAction: vi.fn() }))
vi.mock('@/server/actions/products', () => ({ updateProductImageAction: vi.fn(), reorderProductsAction: vi.fn() }))

import { FarmPageView } from '@/components/farm/farm-page-view'
import { FarmPageClient } from '@/components/farmer/farm-page-client'
import type { PublicFarm, PublicProduct } from '@/server/queries/farm'
import type { ActiveStatusPost } from '@/server/queries/status-posts'

const WURZEL = process.cwd()
const quelle = (pfad: string) => readFileSync(join(WURZEL, pfad), 'utf8')

/** Alle .ts- und .tsx-Dateien unter einem Ordner, als Pfad ab der Wurzel. */
function dateien(ordner: string): string[] {
  const funde: string[] = []
  for (const name of readdirSync(join(WURZEL, ordner))) {
    const pfad = join(ordner, name)
    if (statSync(join(WURZEL, pfad)).isDirectory()) funde.push(...dateien(pfad))
    else if (/\.tsx?$/.test(name)) funde.push(relative(WURZEL, join(WURZEL, pfad)))
  }
  return funde
}

/** Kommentare raus — eine Erwähnung im Kommentar ist kein Lesen. `//` nur nach Leerraum, sonst träfe es URLs. */
function ohneKommentare(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1')
}

const SRC = dateien('src')

// ── Der Parameter ─────────────────────────────────────────────────────────

const NAME = String.raw`(?:VORSCHAU_PARAMETER|['"\x60]vorschau['"\x60])`
/** Jede Form, den Parameter aus einer Adresse zu lesen. */
const LESEN = [
  new RegExp(String.raw`\[\s*${NAME}\s*\]`, 'g'), // suche[VORSCHAU_PARAMETER], suche['vorschau']
  new RegExp(String.raw`\.(?:get|getAll|has)\(\s*${NAME}`, 'g'), // URLSearchParams
  /\b(?:searchParams|suche|query|parameter|params)\??\.vorschau\b/g, // suche.vorschau
  /\{[^{}]*\bvorschau\b[^{}]*\}\s*=\s*(?:await\s+)?(?:props\.)?(?:searchParams|suche|query|params)\b/g, // { vorschau } = await searchParams
]

/** Wo im Text der Parameter gelesen wird (Positionen im Text ohne Kommentare). */
function lesestellen(text: string): number[] {
  const ohne = ohneKommentare(text)
  return LESEN.flatMap((muster) => [...ohne.matchAll(muster)].map((m) => m.index ?? -1))
}

describe('der Parameter „vorschau" wird nur in ansichtsModus() gelesen', () => {
  it('die Suche erkennt jede Leseform — und Schreiben ist kein Lesen', () => {
    const gelesen = [
      'const w = suche[VORSCHAU_PARAMETER]',
      "const w = (await searchParams)['vorschau']",
      "useSearchParams().get('vorschau')",
      'new URL(href).searchParams.has(VORSCHAU_PARAMETER)',
      'if (searchParams?.vorschau) {}',
      'const { vorschau, reorder } = await searchParams',
    ]
    for (const zeile of gelesen) expect(lesestellen(zeile), zeile).not.toHaveLength(0)
    const geschrieben = [
      'return `/${slug}?${VORSCHAU_PARAMETER}=1&stand=${stand}`',
      "const istVorschau = ansicht.art === 'vorschau'",
      '// früher: suche[VORSCHAU_PARAMETER]',
      'function Raster({ vorschau = false }: Props) {}',
    ]
    for (const zeile of geschrieben) expect(lesestellen(zeile), zeile).toHaveLength(0)
  })

  it('in src/ liest ihn nur ansichtsModus — keine Seite, kein Lader, keine Komponente', () => {
    const fundorte = SRC.filter((pfad) => lesestellen(quelle(pfad)).length > 0)
    expect(fundorte).toEqual(['src/lib/ansichts-modus.ts'])

    const text = ohneKommentare(quelle('src/lib/ansichts-modus.ts'))
    const anfang = text.indexOf('export async function ansichtsModus(')
    const ende = text.indexOf('\n}\n', anfang)
    expect(anfang).toBeGreaterThan(-1)
    for (const stelle of lesestellen(quelle('src/lib/ansichts-modus.ts'))) {
      expect(stelle, 'Lesestelle außerhalb von ansichtsModus').toBeGreaterThan(anfang)
      expect(stelle, 'Lesestelle außerhalb von ansichtsModus').toBeLessThan(ende)
    }
  })

  it('außerhalb von src/ nur die Header-Regel in next.config.ts — sie gibt das Einbetten frei, sonst nichts', () => {
    const konfiguration = ohneKommentare(quelle('next.config.ts'))
    const erwaehnungen = [...konfiguration.matchAll(/['"]vorschau['"]/g)]
    expect(erwaehnungen).toHaveLength(1)
    expect(konfiguration).toContain("has: [{ type: 'query', key: 'vorschau', value: '1' }]")
  })

  it('ansichtsModus läuft nur auf dem Server: aufgerufen im Lader, von keinem Client-Modul eingebunden', () => {
    const aufrufer = SRC.filter((pfad) => /(?<!function )\bansichtsModus\(/.test(ohneKommentare(quelle(pfad))))
    expect(aufrufer).toEqual(['src/server/hofseite-vorschau.ts'])
    for (const pfad of SRC) {
      const text = quelle(pfad)
      if (!/^\s*['"]use client['"]/.test(text)) continue
      // Typen dürfen sie kennen (die Ansicht beschreibt ihr Ergebnis), Werte nicht.
      // [^'"] hält das Muster in einer Anweisung: Ohne Semikolons liefe es sonst über die Importe davor.
      expect(text, pfad).not.toMatch(/import\s+(?!type\b)[^'"]*?from\s+['"]@\/lib\/ansichts-modus['"]/)
    }
  })
})

// ── Einbindung von FarmPageView ───────────────────────────────────────────

describe('FarmPageView binden genau zwei Stellen ein', () => {
  const EINBINDEN = [
    /import\s*\{[^}]*\bFarmPageView\b[^}]*\}\s*from/,
    /<FarmPageView\b/,
    /import\(\s*['"][^'"]*farm-page-view['"]\s*\)/,
  ]

  it('die Hofseite und farm-page-client.tsx — eine dritte Stelle lässt den Test fehlschlagen', () => {
    const stellen = SRC.filter((pfad) => pfad !== 'src/components/farm/farm-page-view.tsx')
      .filter((pfad) => EINBINDEN.some((muster) => muster.test(ohneKommentare(quelle(pfad)))))
      .toSorted()
    expect(stellen).toEqual(['src/app/(public)/[farmSlug]/page.tsx', 'src/components/farmer/farm-page-client.tsx'])
  })

  it('die Hofseite rendert sie immer ohne ownerMode; farm-page-client steht nur auf der Besitzer-Route', () => {
    const seite = ohneKommentare(quelle('src/app/(public)/[farmSlug]/page.tsx'))
    expect(seite.match(/ownerMode=\{[^}]*\}/g)).toEqual(['ownerMode={false}'])
    const besitzerSeiten = SRC.filter((pfad) => /<FarmPageClient\b/.test(ohneKommentare(quelle(pfad))))
    expect(besitzerSeiten).toEqual(['src/app/(farmer)/farm-page/page.tsx'])
  })
})

// ── Bearbeitungs-Elemente nur mit ownerMode ───────────────────────────────

function produkt(id: string, name: string, sichtbar: boolean): PublicProduct {
  return {
    id, name, description: null, imageUrl: null, category: null, categoryImageUrl: null,
    price: 3.5, unit: 'kg', unitSize: 1, stock: 10, isAvailable: sichtbar, allergens: [],
    isOrganic: false, requiresCool: false, requiresFreezer: false, seasonStart: null, seasonEnd: null,
    unavailableReason: null, subcategory: null, labels: [], abgabe: 'ALLE' as PublicProduct['abgabe'], futter: null,
  }
}

/** Ein Hof, an dem jedes Bearbeitungs-Element etwas zu tun hätte: pausiert, mit Status, Fotos und Produkten. */
const HOF: PublicFarm = {
  id: 'farm_test', slug: 'hof-test', name: 'Hof Test', ownerName: 'Erika Muster',
  description: 'Gemüse aus Musterdorf', address: 'Musterweg 1', postalCode: '4900', city: 'Musterdorf',
  phone: '+43 660 0000000', email: 'hof@example.com', logoUrl: null, bannerUrl: null,
  tagline: null, foundedYear: null, aboutText: null, bannerType: 'GRADIENT', bannerValue: null, bannerFocusY: 50,
  sectionsConfig: [], farmValues: [], farmPhotos: [{ id: 'foto_1', url: '/foto.jpg', caption: null, sortOrder: 0 }],
  acceptsOnline: false, acceptsOnsite: true, stripeAccountReady: false, isPaused: true, pauseMessage: null,
  serviceFeePercent: 0, serviceFeeMinCents: 0, serviceFeeActiveFrom: null,
  products: [produkt('prod_1', 'Kartoffeln', true), produkt('prod_2', 'Zwiebeln', false)],
  pickupSlots: [{ dayOfWeek: 5, startTime: '15:00', endTime: '18:00' }],
}

const STATUS: ActiveStatusPost = {
  id: 'status_1', title: 'Neue Ernte', body: 'Frische Kartoffeln ab Freitag.', anlass: 'ANNOUNCEMENT',
  photoUrl: null, linkedProductIds: [], publishedAt: '2026-09-30T08:00:00.000Z',
}

/** Woran man ein Bearbeitungs-Element im gerenderten HTML erkennt. */
const BEARBEITUNG: { was: string; muster: RegExp }[] = [
  { was: 'Stift', muster: /lucide-pencil/ },
  { was: 'Werkzeugleiste', muster: />Bearbeiten<|>Kundenansicht<|>Kopieren</ },
  { was: 'Bearbeitungs-Hinweis', muster: /Du bearbeitest deine Hof-Seite|Stift-Symbol/ },
  { was: 'Ziel „… bearbeiten"', muster: /aria-label="[^"]*bearbeiten"/ },
  { was: 'Titelbild-Knopf', muster: /Titelbild ersetzen/ },
  { was: 'Status-Pflege', muster: /Neuer Status|Frühere Status/ },
  { was: 'Pausen-Hinweis für den Hof', muster: /Dein Shop ist pausiert/ },
]

function spuren(html: string): string[] {
  return BEARBEITUNG.filter(({ muster }) => muster.test(html)).map(({ was }) => was)
}

/** Genau so, wie die Hofseite FarmPageView rendert — nur mit der Ansicht aus ansichtsModus. */
function hofseite(ansicht: { art: 'kundin' | 'vorschau'; kaufen: boolean }): string {
  return renderToStaticMarkup(createElement(FarmPageView, { farm: HOF, activeStatus: STATUS, reorderItems: [], ownerMode: false, ansicht }))
}

describe('Bearbeitungs-Elemente erscheinen nur mit ownerMode', () => {
  it('Gegenprobe: der Besitzer am Handy (farm-page-client) hat jedes von ihnen', () => {
    const besitzer = renderToStaticMarkup(createElement(FarmPageClient, { farm: HOF, activeStatus: STATUS, pastStatusCount: 2 }))
    expect(spuren(besitzer)).toEqual(BEARBEITUNG.map(({ was }) => was))
  })

  it('die Seite für Kundinnen rendert ohne sie', () => {
    const html = hofseite({ art: 'kundin', kaufen: true })
    expect(html).toContain('Hof Test')
    expect(spuren(html)).toEqual([])
  })

  it('die Vorschau rendert ohne sie — und ist die Kundenseite samt Navigation, kein Nachbau', () => {
    const vorschau = hofseite({ art: 'vorschau', kaufen: false })
    const kundin = hofseite({ art: 'kundin', kaufen: true })
    expect(spuren(vorschau)).toEqual([])
    // Dieselbe Kopfzeile wie für Kundinnen (KundenKopf) — und dieselbe Seite:
    // Was nur Kundinnen haben (der Korb), unterscheidet; der Rest ist gleich.
    const kopf = (html: string) => html.slice(0, html.indexOf('Unsere Produkte'))
    expect(kopf(vorschau)).toBe(kopf(kundin))
    expect(vorschau).toMatch(/<header\b/)
  })
})
