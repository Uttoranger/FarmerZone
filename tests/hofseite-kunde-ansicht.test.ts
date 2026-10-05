/**
 * Die Hofseite für Kundinnen im neuen Design — gerendert (react-dom/server in
 * Node, TESTING_GUIDELINES §1), so wie die Seite sie zeigt: KundeShell um
 * FarmPageView. Merkmale sind Texte, aria-Beschriftungen, Anker und
 * data-abschnitt — keine Layout-Klassen.
 *
 * Beweist:
 *  - Die Seite steht in der KundeShell (data-design="neu", Kopfzeile, eine
 *    Unterleiste) — für Kundinnen wie in der Vorschau des Hofs.
 *  - E1: Im Reiter Produkte stehen die Kategorie-Abschnitte in der Reihenfolge
 *    aus kategorieAbschnitte, mit Chips als Sprungmarken; kein Umschalter
 *    Hofladen | Futtermittel mehr.
 *  - ?bereich=futter öffnet den Reiter Produkte mit dem Futter-Abschnitt.
 *  - Die rechte Spalte ist EINE Komponente: Nächste Abholung, Abholzeiten,
 *    Zahlung & Kontakt (mit Gebührenhinweis), Anfahrt in einem <aside>, und
 *    nur hofseite-kunde.tsx bindet sie ein.
 *  - Zustände knapp und ausverkauft aus dem Bestand; kein „Merken".
 *  - E5: „Bar bei Abholung", nie „Karte bei Abholung"; E4: der Hinweis nennt
 *    den Satz des Hofs, gebührenfrei steht keiner da.
 *  - Reiter „Beiträge" nur mit Beitrag.
 * Je Aussage eine Gegenprobe, dass die Suche das Merkmal auch findet.
 */
import { describe, it, expect, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const adresse = { suche: '' }
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} }),
  usePathname: () => '/hof-test',
  useSearchParams: () => new URLSearchParams(adresse.suche),
}))
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }),
}))
vi.mock('next/link', () => ({
  // onNavigate und prefetch gehören Nexts Link, nicht dem <a>.
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; onNavigate?: unknown; prefetch?: unknown }) => {
    const attribute: Record<string, unknown> = { ...rest }
    delete attribute.onNavigate
    delete attribute.prefetch
    return createElement('a', { href, ...attribute }, children)
  },
}))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))
vi.mock('@/server/actions/appearance', () => ({ updateFarmBannerAction: vi.fn(), updateBannerFocusAction: vi.fn() }))
vi.mock('@/server/actions/farm-photos', () => ({ addFarmPhotoAction: vi.fn(), reorderPhotosAction: vi.fn() }))
vi.mock('@/server/actions/products', () => ({ updateProductImageAction: vi.fn(), reorderProductsAction: vi.fn() }))

import { FarmPageView } from '@/components/farm/farm-page-view'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import type { PublicFarm, PublicProduct } from '@/server/queries/farm'
import type { ActiveStatusPost } from '@/server/queries/status-posts'
import type { ProductCategoryValue } from '@/lib/taxonomie'

const WURZEL = process.cwd()
const quelle = (pfad: string) => readFileSync(join(WURZEL, pfad), 'utf8')
function dateien(ordner: string): string[] {
  const funde: string[] = []
  for (const name of readdirSync(join(WURZEL, ordner))) {
    const pfad = join(ordner, name)
    if (statSync(join(WURZEL, pfad)).isDirectory()) funde.push(...dateien(pfad))
    else if (/\.tsx?$/.test(name)) funde.push(relative(WURZEL, join(WURZEL, pfad)))
  }
  return funde
}

function produkt(id: string, name: string, category: ProductCategoryValue | null, stock = 20): PublicProduct {
  return {
    id, name, description: null, imageUrl: null, category, categoryImageUrl: null,
    price: 4.5, unit: 'STUECK', unitSize: null, stock, isAvailable: true, allergens: [],
    isOrganic: false, requiresCool: false, requiresFreezer: false, seasonStart: null, seasonEnd: null,
    unavailableReason: null, subcategory: null, labels: [], abgabe: 'ALLE', futter: null,
  }
}

const HOF: PublicFarm = {
  id: 'farm_test', slug: 'hof-test', name: 'Hof Test', ownerName: 'Erika Muster',
  description: 'Gemüse aus Musterdorf', address: 'Musterweg 1', postalCode: '4900', city: 'Musterdorf',
  phone: '+43 660 0000000', email: 'hof@example.com', logoUrl: null, bannerUrl: null,
  tagline: null, foundedYear: null, aboutText: 'Ein kleiner Familienbetrieb.', bannerType: 'GRADIENT', bannerValue: null, bannerFocusY: 50,
  sectionsConfig: [], farmValues: [], farmPhotos: [],
  acceptsOnline: true, acceptsOnsite: true, stripeAccountReady: true, isPaused: false, pauseMessage: null,
  serviceFeePercent: 5, serviceFeeMinCents: 50, serviceFeeActiveFrom: new Date('2026-01-01T00:00:00Z'),
  products: [
    produkt('p_holz', 'Buchenscheite', 'BRENNHOLZ'),
    produkt('p_heu', 'Bergwiesen-Heu', 'HEU_STROH'),
    produkt('p_eier', 'Freilandeier', 'EIER', 3),
    produkt('p_honig', 'Blütenhonig', 'HONIG', 0),
    produkt('p_karotten', 'Karotten', 'GEMUESE'),
  ],
  pickupSlots: [{ dayOfWeek: 3, startTime: '15:00', endTime: '18:00' }],
}

const STATUS: ActiveStatusPost = {
  id: 'status_1', title: 'Neue Ernte', body: 'Frische Karotten ab Freitag.', anlass: 'ANNOUNCEMENT',
  photoUrl: null, linkedProductIds: [], publishedAt: '2026-09-30T08:00:00.000Z',
}

type Ansicht = { art: 'kundin' | 'vorschau'; kaufen: boolean }
const KUNDIN: Ansicht = { art: 'kundin', kaufen: true }

/** Genau wie page.tsx: die KundeShell um FarmPageView. */
function seite({ suche = '', farm = HOF, status = STATUS as ActiveStatusPost | null, ansicht = KUNDIN } = {}): string {
  adresse.suche = suche
  return renderToStaticMarkup(
    createElement(KundeShellMitSitzung, null, createElement(FarmPageView, { farm, activeStatus: status, reorderItems: [], ownerMode: false, ansicht }))
  )
}

/** Die Reihenfolge, in der Texte im HTML stehen. */
function reihenfolge(html: string, texte: string[]): string[] {
  return texte.filter((t) => html.includes(t)).sort((a, b) => html.indexOf(a) - html.indexOf(b))
}

describe('die Hofseite steht in der KundeShell', () => {
  it('neues Design, Kopfzeile und Unterleiste — für Kundinnen und in der Vorschau', () => {
    for (const html of [seite(), seite({ ansicht: { art: 'vorschau', kaufen: false } })]) {
      expect(html).toContain('data-design="neu"')
      expect(html).toMatch(/<header\b/)
      expect(html.match(/<main\b/g)).toHaveLength(1)
      expect(html).toContain('Hof Test')
    }
  })

  it('die Seite legt die Shell herum, über die Hülle mit der Sitzung im Browser', () => {
    const text = quelle('src/app/(public)/[farmSlug]/page.tsx')
    expect(text).toMatch(/<KundeShellMitSitzung>\s*<FarmPageView/)
    expect(text).not.toMatch(/KundenKopf|auth\.api|headers\(\)/)
  })
})

describe('E1 — Kategorie-Abschnitte im Reiter Produkte', () => {
  const html = seite({ suche: 'reiter=produkte' })

  it('Abschnitte in der Reihenfolge des Hofs, Futtermittel und Brennmaterial am Ende', () => {
    const titel = ['id="kategorie-eier-titel"', 'id="kategorie-honig-titel"', 'id="kategorie-gemuese-titel"', 'id="kategorie-futtermittel-titel"', 'id="kategorie-brennmaterial-titel"']
    expect(reihenfolge(html, titel)).toEqual(titel)
  })

  it('Chips springen zu den Abschnitten; kein Umschalter Hofladen | Futtermittel', () => {
    expect(html).toContain('aria-label="Zu einer Kategorie springen"')
    for (const anker of ['#kategorie-eier', '#kategorie-futtermittel', '#kategorie-brennmaterial']) expect(html).toContain(`href="${anker}"`)
    expect(html).not.toContain('Hofladen')
  })

  it('die Übersicht zeigt keine Abschnitte, aber „Alle ansehen" zum Reiter Produkte', () => {
    const uebersicht = seite()
    expect(uebersicht).not.toContain('id="kategorie-futtermittel"')
    expect(uebersicht).toContain('href="/hof-test?reiter=produkte"')
    expect(uebersicht).toContain('Alle ansehen')
  })
})

describe('?bereich=futter springt zum Futter', () => {
  it('öffnet den Reiter Produkte mit dem Futter-Abschnitt', () => {
    const html = seite({ suche: 'bereich=futter' })
    expect(html).toMatch(/aria-current="page"[^>]*>Produkte · 5</)
    expect(html).toContain('id="kategorie-futtermittel"')
  })

  it('Gegenprobe: ohne Parameter ist die Übersicht offen', () => {
    expect(seite()).toMatch(/aria-current="page"[^>]*>Übersicht</)
  })
})

describe('die rechte Spalte ist EINE Komponente', () => {
  const KARTEN = ['Nächste Abholung', 'Abholzeiten', 'Zahlung &amp; Kontakt', 'Anfahrt']

  it('alle vier Karten in einem <aside>', () => {
    const html = seite()
    const aside = html.slice(html.indexOf('<aside'), html.indexOf('</aside>'))
    expect(html.match(/<aside\b/g)).toHaveLength(1)
    for (const titel of KARTEN) expect(aside, titel).toContain(titel)
  })

  it('nur hofseite-kunde.tsx bindet sie ein, und die Karten stehen nirgends sonst', () => {
    const src = dateien('src')
    const einbinder = src.filter((p) => /<HofseiteSeitenspalte\b/.test(quelle(p)))
    expect(einbinder).toEqual(['src/components/hofseite/hofseite-kunde.tsx'])
    const mitKartentitel = dateien('src/components/hofseite').filter((p) => />\s*Abholzeiten\s*</.test(quelle(p)))
    expect(mitKartentitel).toEqual(['src/components/hofseite/hofseite-seitenspalte.tsx'])
  })
})

describe('Zustände der Produktkarten — knapp, ausverkauft, kein „Merken"', () => {
  const html = seite({ suche: 'reiter=produkte' })

  it('knapp nennt den Bestand, ausverkauft steht da, wo sonst der Knopf ist', () => {
    expect(html).toContain('Nur noch 3 Stück')
    expect(html).toContain('Ausverkauft')
    // Gegenprobe: ein Produkt mit genug Bestand hat den Knopf.
    expect(html).toContain('aria-label="Karotten in den Korb legen"')
    expect(html).not.toContain('aria-label="Blütenhonig in den Korb legen"')
  })

  it('kein „Merken" — in keinem Reiter', () => {
    for (const suche of ['', 'reiter=produkte', 'reiter=beitraege']) expect(seite({ suche })).not.toMatch(/Merken/)
  })
})

describe('Zahlung und Gebühr', () => {
  it('E5: online und bar bei Abholung, nie Karte bei Abholung', () => {
    const html = seite()
    expect(html).toContain('Online bezahlen')
    expect(html).toContain('Bar bei Abholung')
    expect(html).not.toMatch(/Karte bei Abholung|Vor Ort \(Bar &amp; Karte\)|Online \(Karte\)/)
  })

  it('E4: der Hinweis nennt den Satz des Hofs — gebührenfrei steht keiner da', () => {
    expect(seite()).toContain('Preise zzgl. 5 % Servicegebühr (mind. € 0,50)')
    expect(seite({ suche: 'reiter=produkte' })).toContain('einmal pro Bestellung')
    expect(seite({ farm: { ...HOF, serviceFeeActiveFrom: null } })).not.toContain('Servicegebühr (mind.')
  })
})

describe('Reiter „Beiträge"', () => {
  it('nur mit Beitrag; dort steht er', () => {
    expect(seite()).toContain('>Beiträge<')
    expect(seite({ suche: 'reiter=beitraege' })).toContain('Neue Ernte')
    expect(seite({ status: null })).not.toContain('>Beiträge<')
  })
})

describe('Leer, pausiert, lange Namen', () => {
  it('ohne Produkte und Abholzeiten: Leerzustand mit Ausweg', () => {
    const html = seite({ farm: { ...HOF, products: [], pickupSlots: [] } })
    expect(html).toContain('Dieser Hof richtet gerade seinen Shop ein')
    expect(html).toContain('href="/hoefe"')
  })

  it('pausiert: Hinweis mit dem Text des Hofs, keine Termine, kein Kaufknopf', () => {
    const html = seite({ farm: { ...HOF, isPaused: true, pauseMessage: 'Wir sind im Urlaub.' }, suche: 'reiter=produkte' })
    expect(html).toContain('Hof Test pausiert gerade.')
    expect(html).toContain('Wir sind im Urlaub.')
    expect(html).not.toContain('Nächste Abholung')
    expect(html).not.toMatch(/in den Korb legen/)
  })

  it('ein Hofname mit 80 Zeichen steht in höchstens zwei Zeilen', () => {
    const lang = 'Biohof '.repeat(12).slice(0, 80)
    const html = seite({ farm: { ...HOF, name: lang } })
    expect(html).toMatch(new RegExp(`<h1[^>]*line-clamp-2[^>]*>${lang}</h1>`))
  })
})

describe('beide Themes: nur Tokens in den Teilen der Hofseite', () => {
  // Wie auf /hoefe (tests/hoefe-seite.test.ts): keine Palettenfarben, kein
  // Schwarz/Weiß (Schleier auf Fotos nehmen die theme-festen Tokens,
  // DESIGN_SYSTEM „Bild-Overlays"), keine Hexwerte, keine Bestandspalette --app-*.
  const PALETTE = /\b(?:text|bg|border|ring|from|to|via)-(?:red|amber|green|emerald|lime|yellow|orange|slate|gray|zinc|neutral|stone|sky|blue|teal)-\d{2,3}\b/
  const SCHWARZ_WEISS = /\b(?:text|bg|border|ring|from|to|via|fill|stroke|outline|shadow|divide|decoration)-(?:black|white)(?![\w-])/
  const HEX = /#[0-9a-fA-F]{3,8}\b/
  const BESTAND = /\b(?:app-(?:page|ink|chip|line-firm|button|bar|trough)|notice)\b|var\(--app-/

  it('erkennt sie (Gegenprobe)', () => {
    expect(SCHWARZ_WEISS.test('from-black/25')).toBe(true)
    expect(PALETTE.test('text-amber-700')).toBe(true)
    expect(HEX.test("'#2D5F3F'")).toBe(true)
    expect(BESTAND.test('bg-app-chip text-app-ink')).toBe(true)
    expect(SCHWARZ_WEISS.test('from-primary-foreground/75 text-accent-foreground whitespace-nowrap')).toBe(false)
  })

  it('keine Datei der Kundenansicht nutzt sie', () => {
    const route = [
      'src/app/(public)/[farmSlug]/page.tsx',
      'src/app/(public)/[farmSlug]/loading.tsx',
      'src/components/farm/cart-sheet.tsx',
      'src/components/farm/produkt-detail.tsx',
      ...dateien('src/components/hofseite'),
    ]
    for (const pfad of route) {
      const text = quelle(pfad)
      expect(PALETTE.test(text), pfad).toBe(false)
      expect(SCHWARZ_WEISS.test(text), pfad).toBe(false)
      expect(HEX.test(text), pfad).toBe(false)
      // Die Ladeansicht staffelt wie die übrigen Skelette über app-trough/app-chip (DESIGN_SYSTEM, Ladeansicht).
      if (!pfad.endsWith('loading.tsx')) expect(BESTAND.test(text), pfad).toBe(false)
    }
  })

  it('die Ladeansicht steht im neuen Design (sie kommt vor der Shell)', () => {
    expect(quelle('src/app/(public)/[farmSlug]/loading.tsx')).toContain('data-design="neu"')
  })
})

describe('Reiter und Chips schreiben die Adresse so, dass Next sie abgleicht', () => {
  it('replaceState mit Zustand null — mit window.history.state gleicht Next useSearchParams nicht ab', () => {
    for (const pfad of ['src/components/hofseite/hofseite-kunde.tsx', 'src/components/hofseite/produkt-abschnitte.tsx']) {
      const text = quelle(pfad)
      expect(text, pfad).toMatch(/history\.replaceState\(null,/)
      expect(text, pfad).not.toMatch(/replaceState\(window\.history\.state/)
    }
  })
})
