/**
 * Hofseite und Navigation: immer wissen, wo man ist (Nr. 177, Register N30;
 * Board docs/mockups/system-sterne-hofseite-orientierung.html).
 *
 * Beweist, je mit Gegenprobe:
 *  1. Hof- und Produktseite setzen „Entdecken" aktiv (aria-current="true"),
 *     die Startseite nicht.
 *  2. Am Handy klebt die Hofzeile (Zurück, Name, Ort · Zustand, Teilen) unter
 *     dem Kopf, darunter Reiter und Chips; ab md bleibt „‹ Alle Höfe".
 *  3. Die Chips kleben am Handy unter den Reitern.
 *  4. Fehlertexte beim Griff in den Korb sind geglättet; das Korb-Blatt
 *     öffnet nur das erste Mal einer Sitzung (Merker, auch ohne Speicher).
 *  5. Maße: Kopf der Fokus-Shell 56 px, Beschriftung der Unterleiste 12 px.
 *  6. scroll-padding in KundeShell, HofShell und auf der Hofseite aus den
 *     Maßen der Shell und des klebenden Blocks.
 *  7. Der Rückweg im Hofbereich nimmt den Verlauf nach derselben Regel wie die
 *     Kundenseiten.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; onNavigate?: unknown; prefetch?: unknown }) => {
    const attribute: Record<string, unknown> = { ...rest }
    delete attribute.onNavigate
    delete attribute.prefetch
    return createElement('a', { href, ...attribute }, children)
  },
}))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))
vi.mock('@/server/actions/appearance', () => ({ updateFarmBannerAction: vi.fn() }))
vi.mock('@/server/actions/farm-photos', () => ({ addFarmPhotoAction: vi.fn(), reorderPhotosAction: vi.fn() }))
vi.mock('@/server/actions/products', () => ({ updateProductImageAction: vi.fn(), reorderProductsAction: vi.fn() }))

import { FarmPageView } from '@/components/farm/farm-page-view'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { kaufSperre, type KaufSperre } from '@/lib/bereiche-anzeige'
import { KUNDE_SHELL_MASSE } from '@/lib/kunde-shell-masse'
import { kundenAriaAktuell, kundenNavigation, type KundenNavId } from '@/lib/kunden-navigation'
import { nimmtVerlaufZu, tippAufRueckweg, tippAufZiel } from '@/lib/kunden-kopf'
import {
  BLATT_MERKER,
  CHIPS_KLEBEN,
  CHIPS_PX,
  HOFZEILE_PX,
  REITER_KLEBT,
  REITER_PX,
  blattBeimErstenMal,
  hofZeileUnterzeile,
  hofZeileZustand,
  korbFehlerText,
  vergissBlattMerker,
} from '@/lib/hofseite-orientierung'
import { NETZ_SATZ } from '@/lib/netz'
import type { PublicFarm, PublicProduct } from '@/server/queries/farm'
import { publicFarm } from './fabrik/public-farm'
import { publicProduct } from './fabrik/public-product'
import type { ProductCategoryValue } from '@/lib/taxonomie'

const WURZEL = process.cwd()
const quelle = (pfad: string) => readFileSync(join(WURZEL, pfad), 'utf8')

function produkt(id: string, name: string, category: ProductCategoryValue | null): PublicProduct {
  return publicProduct({ id, name, category, stock: 20 })
}

const HOF: PublicFarm = publicFarm({
  products: [produkt('p_milch', 'Heumilch', 'MILCH'), produkt('p_eier', 'Freilandeier', 'EIER'), produkt('p_honig', 'Blütenhonig', 'HONIG')],
})
const JETZT = '2026-10-02T08:00:00.000Z'

function seite({ suche = '', aktiv, farm = HOF, sperre }: { suche?: string; aktiv?: KundenNavId; farm?: PublicFarm; sperre?: KaufSperre } = {}): string {
  adresse.suche = suche
  return renderToStaticMarkup(
    createElement(
      // createElement mit dem Inhalt als weiterem Argument — ohne dass TypeScript `children` in den Props verlangt.
      KundeShellMitSitzung as unknown as (props: { aktiv?: KundenNavId }) => React.JSX.Element,
      { aktiv },
      createElement(FarmPageView, {
        farm,
        beitraege: [],
        beitraegeFehler: false,
        reorderItems: [],
        ansicht: { art: 'kundin', kaufen: true },
        jetzt: JETZT,
        sperre: sperre === undefined ? kaufSperre(farm, new Date(JETZT)) : sperre,
      })
    )
  )
}

/** Das Element mit einem Merkmal — vom öffnenden Tag bis zum Ende seines Inhalts (grob, für flache Teile). */
function element(html: string, merkmal: string, ende = '</div>'): string {
  const start = html.lastIndexOf('<', html.indexOf(merkmal))
  expect(start, `${merkmal} fehlt`).toBeGreaterThanOrEqual(0)
  return html.slice(start, html.indexOf(ende, html.indexOf(merkmal)) + ende.length)
}

/** Der Eintrag der Unterleiste mit diesem Namen (das <a> davor). */
function leistenEintrag(html: string, name: string): string {
  const leiste = html.slice(html.indexOf('data-slot="bottom-nav"'))
  const stelle = leiste.indexOf(`>${name}</span>`)
  return leiste.slice(leiste.lastIndexOf('<a', stelle), stelle)
}

describe('1. Aktiver Eintrag: „Entdecken" auf Hof- und Produktseite', () => {
  const entdecken = kundenNavigation({ sitzung: 'gast' }).web[0]

  it('mit `aktiv` ist genau dieser Punkt aktiv, als „true" — kein anderer', () => {
    expect(entdecken.id).toBe('entdecken')
    expect(kundenAriaAktuell('/hof-test', entdecken, 'entdecken')).toBe('true')
    const bestellungen = kundenNavigation({ sitzung: 'gast' }).web.find((p) => p.id === 'bestellungen')!
    expect(kundenAriaAktuell('/hof-test', bestellungen, 'entdecken')).toBeUndefined()
  })

  it('Gegenprobe: ohne `aktiv` (Startseite, Hofseite bisher) ist auf /hof-test nichts aktiv, auf /hoefe „page"', () => {
    expect(kundenAriaAktuell('/hof-test', entdecken)).toBeUndefined()
    expect(kundenAriaAktuell('/', entdecken)).toBeUndefined()
    expect(kundenAriaAktuell('/hoefe', entdecken)).toBe('page')
  })

  it('die Unterleiste der Hofseite markiert „Entdecken" — ohne Prop (Gegenprobe) nicht', () => {
    expect(leistenEintrag(seite({ aktiv: 'entdecken' }), 'Entdecken')).toContain('aria-current="true"')
    expect(leistenEintrag(seite(), 'Entdecken')).not.toContain('aria-current')
    expect(leistenEintrag(seite({ aktiv: 'entdecken' }), 'Bestellungen')).not.toContain('aria-current')
  })

  it('Hof- und Produktseite reichen `entdecken` an die Shell; die Startseite nicht', () => {
    expect(quelle('src/app/(public)/[farmSlug]/page.tsx')).toMatch(/<KundeShellMitSitzung aktiv="entdecken">/)
    expect(quelle('src/app/(public)/[farmSlug]/produkt/[id]/page.tsx')).toMatch(/<KundeShellMitSitzung unterleiste=\{false\} aktiv="entdecken">/)
    expect(quelle('src/app/page.tsx')).not.toMatch(/aktiv="/)
  })
})

describe('2. Klebende Hofzeile am Handy', () => {
  it('klebt unter dem Kopf (top-14, 48 px), nur unter md: Zurück, Name mit title, Ort · Zustand, Teilen', () => {
    const zeile = element(seite(), 'data-hofzeile', '</button>')
    expect(zeile).toMatch(/class="sticky top-14 z-30 flex h-12 [^"]*md:hidden/)
    expect(HOFZEILE_PX).toBe(48)
    expect(zeile).toContain('aria-label="Zurück zu allen Höfen"')
    expect(zeile).toContain('href="/hoefe"')
    expect(zeile).toMatch(/class="truncate [^"]*" title="Hof Test">Hof Test</)
    expect(zeile).toContain('Musterdorf · Nimmt Bestellungen an')
    // Die Ziele sind 44 px groß.
    expect(zeile.match(/size-11/g)).toHaveLength(2)
  })

  it('der Zustand kommt aus der Kaufsperre — pausiert heißt „Pausiert" (Gegenprobe zum offenen Hof)', () => {
    expect(element(seite({ sperre: 'pause' }), 'data-hofzeile', 'Hofseite teilen')).toContain('Musterdorf · Pausiert')
    expect(hofZeileZustand('keine-abholzeit')).toBe('Noch nicht bestellbar')
    expect(hofZeileZustand('ausgebucht')).toBe('Gerade ausgebucht')
    expect(hofZeileUnterzeile('  ', null)).toBe('Nimmt Bestellungen an')
  })

  it('darunter kleben die Reiter (104 px = Kopf 56 + Hofzeile 48), ab md wie bisher unter dem Kopf', () => {
    expect(REITER_KLEBT).toBe(`sticky top-[${56 + HOFZEILE_PX}px] md:top-16`)
    const html = seite()
    expect(element(html, 'aria-label="Bereiche der Hofseite"', '>')).toContain(REITER_KLEBT)
    // Ab md bleibt „‹ Alle Höfe"; am Handy steht er nicht mehr doppelt.
    expect(element(html, '‹ Alle Höfe', '</div>')).toBeTruthy()
    expect(html).toMatch(/class="mx-auto hidden max-w-\[1200px\] px-6 pt-3 md:block"><a[^>]*>‹ Alle Höfe/)
  })

  it('„Teilen" steht am Handy nur noch in der Hofzeile, nicht doppelt auf dem Titelbild', () => {
    const html = seite()
    expect(html.match(/aria-label="Hofseite teilen"/g)).toHaveLength(1)
  })
})

describe('3. Chips kleben am Handy unter den Reitern', () => {
  it('im Reiter Produkte klebt die Chip-Reihe (153 px = 104 + Reiter 49), ab md im Fluss', () => {
    expect(CHIPS_KLEBEN).toBe(`sticky top-[${56 + HOFZEILE_PX + REITER_PX}px] md:static`)
    const nav = element(seite({ suche: 'reiter=produkte' }), 'aria-label="Zu einer Kategorie springen"', '>')
    expect(nav).toContain(CHIPS_KLEBEN)
    expect(nav).toContain('bg-background')
  })

  it('Gegenprobe: in der Übersicht gibt es keine Chip-Reihe', () => {
    expect(seite()).not.toContain('Zu einer Kategorie springen')
  })
})

describe('4. Korb: Fehlertexte und das erste Blatt einer Sitzung (Register N29, N30)', () => {
  it('rohe Servertexte werden geglättet — beim Legen und beim Ändern der Menge', () => {
    for (const roh of ['Serverfehler bei der Reservierung', 'Ungültige Parameter', 'Ungültige Anfrage', undefined]) {
      expect(korbFehlerText({ ok: false, error: roh }, 'legen')).toBe('Wir konnten das Produkt nicht in den Korb legen. Versuch es gleich noch einmal.')
      expect(korbFehlerText({ ok: false, error: roh }, 'menge')).toBe('Wir konnten die Menge nicht ändern. Versuch es gleich noch einmal.')
    }
  })

  it('verständliche Sätze bleiben (Gegenprobe zur Glättung)', () => {
    expect(korbFehlerText({ ok: false, error: 'Nur noch 2 verfügbar' }, 'legen')).toBe('Nur noch 2 verfügbar – mehr hat der Hof gerade nicht.')
    expect(korbFehlerText({ ok: false, error: 'Produkt nicht verfügbar' }, 'legen')).toBe('Produkt nicht verfügbar.')
    expect(korbFehlerText({ ok: false, error: 'Bitte eine Menge bis 10.000.' }, 'legen')).toBe('Bitte eine Menge bis 10.000.')
    expect(korbFehlerText({ ok: false, error: 'Noch nicht bestellbar.' }, 'legen')).toBe('Noch nicht bestellbar.')
  })

  it('am Netz der Satz aus N29 — auch beim Ändern der Menge (vorher der allgemeine Satz)', () => {
    expect(korbFehlerText({ ok: false, error: NETZ_SATZ, nochmal: true }, 'legen')).toBe(NETZ_SATZ)
    expect(korbFehlerText({ ok: false, error: NETZ_SATZ, nochmal: true }, 'menge')).toBe(NETZ_SATZ)
    // Gegenprobe: ohne `nochmal` ist derselbe Text kein Funkloch, sondern unverständlich.
    expect(korbFehlerText({ ok: false, error: NETZ_SATZ }, 'menge')).not.toBe(NETZ_SATZ)
  })

  beforeEach(() => vergissBlattMerker())

  it('das Blatt öffnet nur beim ersten Mal einer Sitzung — der Merker liegt im sessionStorage', () => {
    const speicher = new Map<string, string>()
    const s = { getItem: (k: string) => speicher.get(k) ?? null, setItem: (k: string, v: string) => void speicher.set(k, v) }
    expect(blattBeimErstenMal(() => s)).toBe(true)
    expect(speicher.get(BLATT_MERKER)).toBe('1')
    expect(blattBeimErstenMal(() => s)).toBe(false)
    expect(blattBeimErstenMal(() => s)).toBe(false)
  })

  it('ohne Speicher (wirft oder fehlt) gilt der Merker im Dokument — nie ein Wurf, nie jedes Mal das Blatt', () => {
    const wirft = () => {
      throw new Error('SecurityError')
    }
    expect(blattBeimErstenMal(wirft)).toBe(true)
    expect(blattBeimErstenMal(wirft)).toBe(false)
    vergissBlattMerker()
    expect(blattBeimErstenMal(() => null)).toBe(true)
    expect(blattBeimErstenMal(() => null)).toBe(false)
  })
})

describe('5. Maße', () => {
  it('der Kopf der KundeFokusShell ist 56 px hoch wie der der KundeShell (vorher 52)', () => {
    const fokus = quelle('src/components/shells/kunde-shell.tsx').split('export function KundeFokusShell(')[1]
    expect(fokus).toMatch(/<div className="mx-auto flex h-14 max-w-\[1200px\][^"]*md:h-16/)
    expect(fokus).not.toContain('h-[52px]')
  })

  it('die Beschriftung der Unterleiste ist 12 px — die Leiste bleibt 68 px hoch', () => {
    const leiste = quelle('src/components/ui/bottom-nav.tsx')
    expect(leiste.match(/text-\[12px\] leading-none/g)).toHaveLength(2)
    expect(leiste).not.toContain('text-[10.5px]')
    expect(leiste).toMatch(/flex h-\[68px\] items-stretch/)
  })
})

/** Der Wert einer CSS-Eigenschaft in der Regel mit genau diesem Selektor (innerhalb der Medienabfrage, falls angegeben). */
function regel(css: string, selektor: string, eigenschaft: string, medien?: string): string | null {
  const bereich = medien ? css.slice(css.indexOf(medien)) : css
  const block = new RegExp(`${selektor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^{]*\\{([^}]*)\\}`).exec(bereich)
  if (!block) return null
  const wert = new RegExp(`${eigenschaft}:\\s*([^;]+);`).exec(block[1])
  return wert ? wert[1].trim() : null
}

/** Ein Wert aus KUNDE_SHELL_MASSE, z. B. `--kunde-kopf` ohne/mit md. */
function masse(name: string, md = false): string {
  const treffer = new RegExp(`${md ? 'md:' : '(?<!md:)'}\\[--${name}:([^\\]]+)\\]`).exec(KUNDE_SHELL_MASSE)
  return treffer![1]
}

describe('6. scroll-padding: der Fokus rutscht nie unter klebende Köpfe und die Unterleiste (WCAG 2.4.11)', () => {
  const css = quelle('src/app/globals.css')
  const px = (wert: string) => Number(/^(\d+)px/.exec(wert)![1])

  it('KundeShell: oben die Kopfzeile (--kunde-kopf), unten Unterleiste plus Mittelknopf', () => {
    expect(regel(css, "html:has([data-scroll-rand^='kunde'])", 'scroll-padding-top')).toBe(masse('kunde-kopf'))
    expect(regel(css, "html:has([data-scroll-rand^='kunde'])", 'scroll-padding-top', '@media (min-width: 768px)')).toBe(masse('kunde-kopf', true))
    const unten = regel(css, "html:has([data-scroll-rand='kunde']),", 'scroll-padding-bottom', '@media (max-width: 767px) {\n    html:has([data-scroll-rand')
    expect(unten).toBe(`calc(${px(masse('kunde-unterleiste').replace('calc(', '')) + px(masse('kunde-ueberstand'))}px + env(safe-area-inset-bottom))`)
  })

  it('Hofseite: oben Kopf + Hofzeile + Reiter + Chips, ab md Kopf + Reiter', () => {
    const handy = regel(css, "html:has([data-scroll-rand='kunde']):has([data-hofzeile])", 'scroll-padding-top', '@media (max-width: 767px) {\n    html:has([data-scroll-rand')
    expect(handy).toBe(`${px(masse('kunde-kopf')) + HOFZEILE_PX + REITER_PX + CHIPS_PX}px`)
    const breit = regel(css, "html:has([data-scroll-rand='kunde']):has([data-hofzeile])", 'scroll-padding-top', '@media (min-width: 768px) {\n    html:has([data-scroll-rand')
    expect(breit).toBe(`${px(masse('kunde-kopf', true)) + REITER_PX}px`)
  })

  it('HofShell: unten die Unterleiste, oben der Unterseiten-Kopf, wo es ihn gibt', () => {
    expect(css).toMatch(/html:has\(\[data-scroll-rand='hof'\]\) \{\s*scroll-padding-bottom: calc\(89px \+ env\(safe-area-inset-bottom\)\);/)
    expect(regel(css, "html:has([data-scroll-rand='hof']):has([data-unterseiten-leiste])", 'scroll-padding-top')).toBe('57px')
  })

  it('die Shells und der Unterseiten-Kopf tragen die Merkmale, auf die die Regeln zielen', () => {
    expect(quelle('src/components/shells/kunde-shell.tsx')).toContain(`data-scroll-rand={unterleiste ? 'kunde' : 'kunde-ohne-leiste'}`)
    expect(quelle('src/components/shells/hof-shell.tsx')).toContain('data-scroll-rand="hof"')
    expect(quelle('src/components/hofbereich/unterseiten-kopf.tsx')).toContain('data-unterseiten-leiste=""')
    expect(seite()).toContain('data-scroll-rand="kunde"')
  })

  it('Gegenprobe: die Suche findet eine fehlende Regel nicht', () => {
    const ohne = css.replace(/html:has\(\[data-scroll-rand='kunde'\]\):has\(\[data-hofzeile\]\) \{[^}]*\}/g, '')
    expect(regel(ohne, "html:has([data-scroll-rand='kunde']):has([data-hofzeile])", 'scroll-padding-top')).toBeNull()
  })
})

describe('7. Rückweg im Hofbereich: dieselbe Regel wie auf den Kundenseiten', () => {
  it('ein Schritt im Verlauf genau dann, wenn die Elternseite direkt davor stand — Filter zählen nicht zum Pfad', () => {
    expect(nimmtVerlaufZu('/customers', '/customers')).toBe(true)
    expect(nimmtVerlaufZu('/orders?filter=heute', '/orders')).toBe(true)
    expect(tippAufZiel('/customers?filter=lange', '/customers')).toEqual({ aktion: 'verlauf' })
  })

  it('Gegenprobe: eine andere Seite davor oder keine — dann der Link, hinauf zum Ziel', () => {
    expect(nimmtVerlaufZu('/customers', '/dashboard')).toBe(false)
    expect(nimmtVerlaufZu('/customers', null)).toBe(false)
    expect(tippAufZiel('/orders?filter=heute', '/dashboard')).toEqual({ aktion: 'hinauf', ziel: '/orders' })
  })

  it('die Browser-Zeile der Kundenseiten nimmt dieselbe Regel (eine Quelle)', () => {
    const hofseite = { art: 'hofseite' as const, hofSlug: 'hof-test', bereich: 'LEBENSMITTEL' as const }
    expect(tippAufRueckweg(hofseite, '/hoefe', 'zeile')).toEqual(tippAufZiel('/hoefe', '/hoefe'))
    expect(tippAufRueckweg(hofseite, '/', 'zeile')).toEqual(tippAufZiel('/hoefe', '/'))
  })

  it('UnterseitenKopf fragt die Regel mit dem Vorgänger aus dem RueckwegMerker — beide Links', () => {
    const kopf = quelle('src/components/hofbereich/unterseiten-kopf.tsx')
    expect(kopf).toContain('tippAufZiel(ziel, eigenerVorgaengerJetzt())')
    expect(kopf).toContain('window.history.back()')
    expect(kopf.match(/onClick=\{beimTipp\(ziel\)\}/g)).toHaveLength(2)
  })
})
