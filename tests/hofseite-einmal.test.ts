/**
 * Architektur-Tests: Die Hofseite gibt es genau einmal — unter /[farmSlug].
 * Die Vorschau ist dieselbe Route mit ?vorschau=1, nie ein Nachbau
 * (ARCHITECTURE §4).
 *
 * Beweist:
 *  - Der Parameter „vorschau" wird in src/ nur in ansichtsModus() gelesen
 *    (src/lib/ansichts-modus.ts). Gesucht wird nach jeder Leseform — Index,
 *    URLSearchParams, Eigenschaft, Zerlegen, Adresse im Text, Literal —, und die
 *    Konstante VORSCHAU_PARAMETER steht nur in hofseite-vorschau.ts (Adressen
 *    schreiben) und in ansichtsModus. Die einzige Stelle außerhalb von src/
 *    ist die Header-Regel in next.config.ts — sie greift, bevor eine Seite
 *    läuft, und gibt nur das Einbetten frei (tests/sicherheits-header.test.ts).
 *  - ansichtsModus läuft nur auf dem Server: aufgerufen allein im Lader,
 *    eingebunden von keinem Client-Modul.
 *  - FarmPageView binden genau zwei Stellen ein: die Hofseite und
 *    farm-page-client.tsx (Besitzer am Handy). Eine dritte — benannt, als
 *    Namensraum, weitergereicht oder dynamisch — lässt den Test fehlschlagen.
 *    Die Seite für Kundinnen im neuen Design (HofseiteKunde, Nr. 10) bindet
 *    nur FarmPageView ein; die Kundenansicht des Besitzers ist die echte Route
 *    im Rahmen (?vorschau=1 über vorschauLink), kein Nachbau.
 *  - Bearbeitungs-Elemente (Stifte, Werkzeugleiste, Bearbeitungs-Hinweis und
 *    die übrigen Knöpfe des Hofs) erscheinen nur mit ownerMode: Die Seite für
 *    Kundinnen und die Vorschau rendern ohne sie. Gerendert wird echt
 *    (react-dom/server in Node); je Quelle eine Gegenprobe, dass die Suche
 *    jedes Merkmal auch findet — FarmPageView im Bearbeitungsmodus für ihre
 *    Elemente, farm-page-client für die Werkzeugleiste.
 *  - Kaufen wirkt bei Kundinnen und nirgends sonst: Der Korb (CartSheet) hängt
 *    nur in der Seite für Kundinnen — nicht in der Vorschau, nicht im
 *    Bearbeitungsmodus. Ginge `kaufen` auf dem Weg ins Produktraster verloren,
 *    reservierte die Vorschau Bestand.
 */
import { describe, it, expect, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Next und die Server-Aktionen gibt es im Test nicht: Router, Bild und Link
// werden zu schlichten Elementen, die Aktionen zu Attrappen. Der Korb wird zu
// einem Merkmal — sein Blatt rendert geschlossen nichts, und der Knopf dazu
// erscheint erst nach dem Hydrieren. Gerendert wird sonst die echte Komponente.
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
vi.mock('@/components/farm/cart-sheet', () => ({ CartSheet: () => createElement('div', { 'data-merkmal': 'korb' }) }))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))

import { FarmPageView } from '@/components/farm/farm-page-view'
import { FarmPageClient } from '@/components/farmer/farm-page-client'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
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

type Fund = { pfad: string; stelle: number; art: string }

const NAME = String.raw`(?:VORSCHAU_PARAMETER|['"\x60]vorschau['"\x60])`

/**
 * Jede Stelle, an der der Parameter vorkommt, mit ihrer Form. Ob sie erlaubt
 * ist, entscheidet `erlaubt` darunter — gesucht wird hier bewusst weit.
 */
function funde(pfad: string, roh: string): Fund[] {
  const text = ohneKommentare(roh)
  const liste: Fund[] = []
  const suche = (muster: RegExp, art: string, harmlos?: (stelle: number) => boolean) => {
    for (const m of text.matchAll(muster)) {
      const stelle = m.index ?? -1
      if (!harmlos?.(stelle)) liste.push({ pfad, stelle, art })
    }
  }
  suche(new RegExp(String.raw`\[\s*${NAME}\s*\]`, 'g'), 'Index') // suche[VORSCHAU_PARAMETER]
  suche(new RegExp(String.raw`\.(?:get|getAll|has)\(\s*${NAME}`, 'g'), 'URLSearchParams')
  // Jede Eigenschaft .vorschau — bis auf die eine, die nichts mit der Adresse
  // zu tun hat: die Kundenansicht des Besitzers im Pausen-Banner.
  suche(/\.vorschau\b/g, 'Eigenschaft', (stelle) => pfad === 'src/lib/shop-pause.ts' && text.slice(stelle - 7, stelle) === 'eingabe')
  suche(/\{[^{}]*\bvorschau\b[^{}]*\}\s*=(?!=)/g, 'Zerlegen') // const { vorschau } = await searchParams
  suche(/vorschau=/g, 'Adresse im Text') // location.search.includes('vorschau=1'), /[?&]vorschau=1/
  // Das Wort als Text: nur als Wert der Ansicht (art) und in der Definition der Konstante.
  suche(/['"\x60]vorschau['"\x60]/g, 'Literal', (stelle) =>
    /(?:\bart\s*[!=]==?\s*|\bart:\s*|\|\s*|VORSCHAU_PARAMETER\s*=\s*)$/.test(text.slice(Math.max(0, stelle - 40), stelle))
  )
  suche(/\bVORSCHAU_PARAMETER\b/g, 'Konstante')
  return liste
}

/** Ob eine Stelle im Rumpf einer Funktion liegt (bis zur ersten Zeile, die mit `}` beginnt). */
function imRumpf(code: string, kopf: string, stelle: number): boolean {
  const anfang = code.indexOf(kopf)
  const ende = code.indexOf('\n}\n', anfang)
  return anfang > -1 && stelle > anfang && stelle < ende
}

/** Die Zeile, in der eine Stelle steht. */
function zeileVon(code: string, stelle: number): string {
  const ende = code.indexOf('\n', stelle)
  return code.slice(code.lastIndexOf('\n', stelle) + 1, ende === -1 ? undefined : ende)
}

/** Wo ein Fund erlaubt ist: die Adresse schreiben nur in vorschauLink, lesen nur in ansichtsModus. */
function erlaubt(fund: Fund, text: string): boolean {
  const code = ohneKommentare(text)
  if (fund.pfad === 'src/lib/hofseite-vorschau.ts' && fund.art === 'Konstante') {
    if (code.slice(Math.max(0, fund.stelle - 13), fund.stelle) === 'export const ') return true
    return imRumpf(code, 'export function vorschauLink(', fund.stelle)
  }
  if (fund.pfad === 'src/lib/ansichts-modus.ts' && (fund.art === 'Konstante' || fund.art === 'Index')) {
    const imImport = /^import\s*\{[^}]*\}\s*from\s*'@\/lib\/hofseite-vorschau'\s*$/.test(zeileVon(code, fund.stelle))
    return imImport || imRumpf(code, 'export async function ansichtsModus(', fund.stelle)
  }
  return false
}

function verboten(pfad: string, text: string): Fund[] {
  return funde(pfad, text).filter((fund) => !erlaubt(fund, text))
}

describe('der Parameter „vorschau" wird nur in ansichtsModus() gelesen', () => {
  it('die Suche erkennt jede Leseform — und Schreiben, Vergleichen, Kommentieren ist kein Lesen', () => {
    const gelesen = [
      'const w = suche[VORSCHAU_PARAMETER]',
      "const w = (await searchParams)['vorschau']",
      "useSearchParams().get('vorschau')",
      'new URL(href).searchParams.has(VORSCHAU_PARAMETER)',
      'if (searchParams?.vorschau) {}',
      'const w = (await searchParams).vorschau',
      'const w = sp.vorschau',
      'const { vorschau } = use(searchParams)',
      'const { vorschau, reorder } = await searchParams',
      "if (location.search.includes('vorschau=1')) {}",
      'if (/[?&]vorschau=1/.test(location.search)) {}',
      "if (location.search.includes('vorschau')) {}",
      "import { VORSCHAU_PARAMETER as P } from '@/lib/hofseite-vorschau'\nconst w = suche[P]",
    ]
    for (const zeile of gelesen) expect(verboten('src/irgendwo.tsx', zeile), zeile).not.toHaveLength(0)

    const harmlos = [
      "const istVorschau = ansicht.art === 'vorschau'",
      "type Ansicht = { art: 'kundin' | 'vorschau' }",
      "return { art: 'vorschau', kaufen: false }",
      '// früher: suche[VORSCHAU_PARAMETER]',
      'function Raster({ vorschau = false }: Props) {}',
      'const href = vorschauLink(slug)',
    ]
    for (const zeile of harmlos) expect(verboten('src/irgendwo.tsx', zeile), zeile).toEqual([])

    // Auch in den beiden erlaubten Dateien zählt nur der eine Ort: Lesen außerhalb
    // von vorschauLink bzw. ansichtsModus fällt auf, ein Import weiter unten ändert daran nichts.
    const leseInDerAdressdatei = "export function vorschauLink(slug: string): string {\n  return `/${slug}?${VORSCHAU_PARAMETER}=1`\n}\nexport const hier = location.search.includes(`${VORSCHAU_PARAMETER}=1`)\n"
    expect(verboten('src/lib/hofseite-vorschau.ts', leseInDerAdressdatei)).toHaveLength(1)
    const leseVorDemModus = "const w = suche[VORSCHAU_PARAMETER]\nimport { VORSCHAU_PARAMETER } from '@/lib/hofseite-vorschau'\n"
    expect(verboten('src/lib/ansichts-modus.ts', leseVorDemModus).map((f) => f.art)).toEqual(['Index', 'Konstante'])
  })

  it('in src/ liest ihn nur ansichtsModus — keine Seite, kein Lader, keine Komponente', () => {
    const alle = SRC.flatMap((pfad) => verboten(pfad, quelle(pfad)))
    expect(alle.map((f) => `${f.pfad}: ${f.art}`)).toEqual([])
    // Und ansichtsModus liest ihn wirklich — sonst bewiese das Schweigen oben nichts.
    const imModus = funde('src/lib/ansichts-modus.ts', quelle('src/lib/ansichts-modus.ts'))
    expect(imModus.map((f) => f.art)).toContain('Index')
  })

  it('außerhalb von src/ nur die Header-Regel in next.config.ts — sie gibt das Einbetten frei, sonst nichts', () => {
    const konfiguration = ohneKommentare(quelle('next.config.ts'))
    expect([...konfiguration.matchAll(/vorschau/g)]).toHaveLength(1)
    expect(konfiguration).toContain("has: [{ type: 'query', key: 'vorschau', value: '1' }]")
  })

  it('ansichtsModus läuft nur auf dem Server: aufgerufen im Lader, von keinem Client-Modul eingebunden', () => {
    const aufrufer = SRC.filter((pfad) => /(?<!function )\bansichtsModus\(/.test(ohneKommentare(quelle(pfad))))
    expect(aufrufer).toEqual(['src/server/hofseite-vorschau.ts'])
    // Typen dürfen sie kennen (die Ansicht beschreibt ihr Ergebnis), Werte nicht —
    // gleich, ob über '@/lib/…' oder einen relativen Pfad, statisch oder dynamisch.
    // [^'"] hält das Muster in einer Anweisung: Ohne Semikolons liefe es sonst über die Importe davor.
    const wertImport = /import\s+(?!type\b)[^'"]*?from\s+['"][^'"]*ansichts-modus['"]|import\(\s*['"][^'"]*ansichts-modus['"]/
    expect(wertImport.test("import { ansichtsModus } from '../../lib/ansichts-modus'")).toBe(true)
    expect(wertImport.test("import type { SeitenAnsicht } from '@/lib/ansichts-modus'")).toBe(false)
    for (const pfad of SRC) {
      const text = quelle(pfad)
      if (!/^\s*['"]use client['"]/.test(text)) continue
      expect(wertImport.test(text), pfad).toBe(false)
    }
  })
})

// ── Einbindung von FarmPageView ───────────────────────────────────────────

describe('FarmPageView binden genau zwei Stellen ein', () => {
  const EINBINDEN = [
    /import\s*\{[^}]*\bFarmPageView\b[^}]*\}\s*from/, // benannt
    /import\s*\*\s*as\s+\w+\s+from\s+['"][^'"]*farm-page-view['"]/, // Namensraum
    /export\s*\{[^}]*\bFarmPageView\b[^}]*\}\s*from/, // weitergereicht, benannt
    /export\s*\*(?:\s*as\s+\w+)?\s*from\s*['"][^'"]*farm-page-view['"]/, // weitergereicht, alles
    /import\(\s*['"][^'"]*farm-page-view['"]\s*\)/, // dynamisch
    /<(?:\w+\.)?FarmPageView\b/, // im JSX, auch als Hof.FarmPageView
  ]
  const bindetEin = (text: string) => EINBINDEN.some((muster) => muster.test(ohneKommentare(text)))

  it('die Suche erkennt jede Form der Einbindung', () => {
    for (const zeile of [
      "import { FarmPageView } from '@/components/farm/farm-page-view'",
      "import * as Hof from '@/components/farm/farm-page-view'",
      "export { FarmPageView } from './farm-page-view'",
      "export * as Hof from '@/components/farm/farm-page-view'",
      "const Seite = dynamic(() => import('@/components/farm/farm-page-view'))",
      '<Hof.FarmPageView farm={farm} />',
    ]) {
      expect(bindetEin(zeile), zeile).toBe(true)
    }
    expect(bindetEin("import { CoverEditButton } from '@/components/farm/farm-page-view'")).toBe(false)
    expect(bindetEin("export * from './andere-datei'")).toBe(false)
  })

  it('die Hofseite und farm-page-client.tsx — eine dritte Stelle lässt den Test fehlschlagen', () => {
    const stellen = SRC.filter((pfad) => pfad !== 'src/components/farm/farm-page-view.tsx')
      .filter((pfad) => bindetEin(quelle(pfad)))
      .toSorted()
    expect(stellen).toEqual(['src/app/(public)/[farmSlug]/page.tsx', 'src/components/farmer/farm-page-client.tsx'])
  })

  it('die Seite für Kundinnen (HofseiteKunde) bindet nur FarmPageView ein', () => {
    const stellen = SRC.filter((pfad) => pfad !== 'src/components/hofseite/hofseite-kunde.tsx')
      .filter((pfad) => /<HofseiteKunde\b|import\s*\{[^}]*\bHofseiteKunde\b[^}]*\}\s*from/.test(ohneKommentare(quelle(pfad))))
    expect(stellen).toEqual(['src/components/farm/farm-page-view.tsx'])
  })

  it('die Kundenansicht des Besitzers ist die echte Route im Rahmen, kein Nachbau', () => {
    const besitzer = ohneKommentare(quelle('src/components/farmer/farm-page-client.tsx'))
    expect(besitzer).toMatch(/<iframe[\s\S]*?src=\{vorschauLink\(farm\.slug\)\}/)
    // FarmPageView rendert dort nur noch den Bearbeitungsmodus.
    expect(besitzer).toMatch(/mode === 'preview' \? \(\s*\/?\/?[\s\S]*?<iframe/)
  })

  it('die Hofseite rendert sie immer ohne ownerMode; farm-page-client steht nur auf der Besitzer-Route', () => {
    const seite = ohneKommentare(quelle('src/app/(public)/[farmSlug]/page.tsx'))
    expect(seite.match(/ownerMode=\{[^}]*\}/g)).toEqual(['ownerMode={false}'])
    const besitzerSeiten = SRC.filter((pfad) => /<FarmPageClient\b/.test(ohneKommentare(quelle(pfad))))
    expect(besitzerSeiten).toEqual(['src/app/(farmer)/farm-page/page.tsx'])
  })
})

// ── Bearbeitungs-Elemente nur mit ownerMode, Korb nur für Kundinnen ───────

function produkt(id: string, name: string, sichtbar: boolean): PublicProduct {
  return {
    id, name, description: null, imageUrl: null, category: null, categoryImageUrl: null,
    price: 3.5, unit: 'kg', unitSize: 1, stock: 10, isAvailable: sichtbar, allergens: [],
    isOrganic: false, requiresCool: false, requiresFreezer: false, seasonStart: null, seasonEnd: null,
    unavailableReason: null, subcategory: null, labels: [], abgabe: 'ALLE', futter: null,
    familieId: null, brennmaterial: null,
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
  serviceFeePercent: 0, serviceFeeMinCents: 0, serviceFeeActiveFrom: null, betriebsstatus: null,
  products: [produkt('prod_1', 'Kartoffeln', true), produkt('prod_2', 'Zwiebeln', false)],
  pickupSlots: [{ dayOfWeek: 5, startTime: '15:00', endTime: '18:00' }],
}

/** Derselbe Hof, offen — dort zählt, ob Kaufen wirkt. */
const HOF_OFFEN: PublicFarm = { ...HOF, isPaused: false }

const STATUS: ActiveStatusPost = {
  id: 'status_1', title: 'Neue Ernte', body: 'Frische Kartoffeln ab Freitag.', anlass: 'ANNOUNCEMENT',
  photoUrl: null, linkedProductIds: [], publishedAt: '2026-09-30T08:00:00.000Z',
}

type Merkmal = { was: string; muster: RegExp }

/** Woran man die Bearbeitungs-Elemente von FarmPageView im HTML erkennt. */
const IN_DER_ANSICHT: Merkmal[] = [
  { was: 'Stift', muster: /lucide-pencil/ },
  { was: 'Bearbeitungs-Hinweis', muster: /Du bearbeitest deine Hof-Seite|Stift-Symbol/ },
  { was: 'Ziel „… bearbeiten"', muster: /aria-label="[^"]*bearbeiten"/ },
  { was: 'Titelbild-Knopf', muster: /Titelbild ersetzen/ },
  { was: 'Status-Pflege', muster: /Neuer Status|Frühere Status/ },
  { was: 'Pausen-Hinweis für den Hof', muster: /Dein Shop ist pausiert/ },
]
/** Die Werkzeugleiste steht in farm-page-client.tsx selbst. */
const WERKZEUGLEISTE: Merkmal = { was: 'Werkzeugleiste', muster: />Bearbeiten<|>Kundenansicht<|>Kopieren</ }
const KORB = /data-merkmal="korb"/

function gefunden(html: string, merkmale: Merkmal[]): string[] {
  return merkmale.filter(({ muster }) => muster.test(html)).map(({ was }) => was)
}

type Ansicht = { art: 'kundin' | 'vorschau'; kaufen: boolean }
const KUNDIN: Ansicht = { art: 'kundin', kaufen: true }
const VORSCHAU: Ansicht = { art: 'vorschau', kaufen: false }

/** Genau so, wie die Hofseite FarmPageView rendert — in der KundeShell, mit der Ansicht aus ansichtsModus. */
function hofseite(ansicht: Ansicht, farm: PublicFarm = HOF): string {
  return renderToStaticMarkup(
    createElement(KundeShellMitSitzung, null, createElement(FarmPageView, { farm, activeStatus: STATUS, reorderItems: [], ownerMode: false, ansicht }))
  )
}

describe('Bearbeitungs-Elemente erscheinen nur mit ownerMode', () => {
  it('Gegenprobe: FarmPageView im Bearbeitungsmodus hat jedes ihrer Elemente', () => {
    const bearbeiten = renderToStaticMarkup(
      createElement(FarmPageView, { farm: HOF, activeStatus: STATUS, ownerMode: true, mode: 'edit', pastStatusCount: 2 })
    )
    expect(gefunden(bearbeiten, IN_DER_ANSICHT)).toEqual(IN_DER_ANSICHT.map(({ was }) => was))
  })

  it('Gegenprobe: farm-page-client trägt die Werkzeugleiste', () => {
    const besitzer = renderToStaticMarkup(createElement(FarmPageClient, { farm: HOF, activeStatus: STATUS, pastStatusCount: 2 }))
    expect(gefunden(besitzer, [WERKZEUGLEISTE])).toEqual([WERKZEUGLEISTE.was])
  })

  it('die Seite für Kundinnen rendert ohne sie', () => {
    const html = hofseite(KUNDIN)
    expect(html).toContain('Hof Test')
    expect(gefunden(html, [...IN_DER_ANSICHT, WERKZEUGLEISTE])).toEqual([])
  })

  it('die Vorschau rendert ohne sie — mit derselben Kopfzeile wie für Kundinnen, kein Nachbau', () => {
    const html = hofseite(VORSCHAU)
    expect(gefunden(html, [...IN_DER_ANSICHT, WERKZEUGLEISTE])).toEqual([])
    // Die Navigation der Kundenseite (KundeShell) samt Hofname, wie bei Kundinnen.
    for (const seite of [html, hofseite(KUNDIN)]) {
      expect(seite).toMatch(/<header\b/)
      expect(seite).toContain('data-design="neu"')
      expect(seite).toContain('Hof Test')
      expect(seite).toContain('Kartoffeln')
    }
  })
})

describe('Kaufen wirkt bei Kundinnen und nirgends sonst', () => {
  it('Kundin: der Korb hängt in der Seite', () => {
    expect(hofseite(KUNDIN, HOF_OFFEN)).toMatch(KORB)
  })

  it('Vorschau: kein Korb — `kaufen` aus ansichtsModus kommt im Produktraster an', () => {
    expect(hofseite(VORSCHAU, HOF_OFFEN)).not.toMatch(KORB)
  })

  it('Bearbeitungsmodus des Besitzers: kein Korb', () => {
    const bearbeiten = renderToStaticMarkup(
      createElement(FarmPageView, { farm: HOF_OFFEN, activeStatus: STATUS, ownerMode: true, mode: 'edit' })
    )
    expect(bearbeiten).not.toMatch(KORB)
  })
})
