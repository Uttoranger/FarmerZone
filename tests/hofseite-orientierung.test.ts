/**
 * Hofseite und Navigation: immer wissen, wo man ist (Nr. 177, Register N30;
 * Board docs/mockups/system-sterne-hofseite-orientierung.html).
 *
 * Beweist, je mit Gegenprobe:
 *  1. Hof- und Produktseite setzen „Entdecken" aktiv (aria-current="true"),
 *     die Startseite nicht.
 *  2. Am Handy kleben Hofzeile (Zurück, Name, Ort · Zustand, Teilen), Reiter
 *     und Chips als EIN Block unter dem Kopf; ab md bleibt „‹ Alle Höfe".
 *  3. Die Chips kommen am Handy in ihren Platz im Block (Portal).
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
  CHIPS_PX,
  HOFZEILE_PX,
  KLEBE_BLOCK,
  KLEBE_BLOCK_VAR,
  REITER_PX,
  blattBeimErstenMal,
  TITELBILD_ZURUECK,
  hofZeileUnterzeile,
  hofZeileZustand,
  hofzeileSteht,
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

/** Das ganze <div> mit einem Merkmal samt allen verschachtelten <div> — für den klebenden Block. */
function ganzesDiv(html: string, merkmal: string): string {
  const start = html.lastIndexOf('<div', html.indexOf(merkmal))
  expect(start, `${merkmal} fehlt`).toBeGreaterThanOrEqual(0)
  const tags = /<div[\s>]|<\/div>/g
  tags.lastIndex = start
  let tiefe = 0
  for (let t = tags.exec(html); t; t = tags.exec(html)) {
    tiefe += t[0] === '</div>' ? -1 : 1
    if (tiefe === 0) return html.slice(start, t.index + t[0].length)
  }
  throw new Error(`${merkmal}: <div> ohne Ende`)
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

describe('2. Hofzeile, Reiter und Chips: EIN klebender Block unter dem Kopf', () => {
  it('die Hofzeile (48 px, nur unter md): Zurück, Name mit title, Ort · Zustand, Teilen — 44-px-Ziele', () => {
    const zeile = element(seite(), 'data-hofzeile', '</button>')
    expect(zeile).toMatch(/class="flex h-12 [^"]*md:hidden/)
    expect(HOFZEILE_PX).toBe(48)
    expect(zeile).toContain('aria-label="Zurück zu allen Höfen"')
    expect(zeile).toContain('href="/hoefe"')
    expect(zeile).toMatch(/class="truncate [^"]*" title="Hof Test">Hof Test</)
    expect(zeile).toContain('Musterdorf · Nimmt Bestellungen an')
    expect(zeile.match(/size-11/g)).toHaveLength(2)
  })

  it('der Zustand kommt aus der Kaufsperre — pausiert heißt „Pausiert" (Gegenprobe zum offenen Hof)', () => {
    expect(element(seite({ sperre: 'pause' }), 'data-hofzeile', 'Hofseite teilen')).toContain('Musterdorf · Pausiert')
    expect(hofZeileZustand('keine-abholzeit')).toBe('Noch nicht bestellbar')
    expect(hofZeileZustand('ausgebucht')).toBe('Gerade ausgebucht')
    expect(hofZeileUnterzeile('  ', null)).toBe('Nimmt Bestellungen an')
  })

  it('ein einziges `sticky` (am Handy top-14, ab md top-16) — Hofzeile, Reiter und Chip-Platz darin im Fluss', () => {
    expect(KLEBE_BLOCK).toBe('sticky top-14 z-30 bg-background md:top-16')
    const html = seite({ suche: 'reiter=produkte' })
    const block = ganzesDiv(html, 'data-klebe-block')
    expect(block).toContain(KLEBE_BLOCK)
    expect(block).toContain('data-hofzeile')
    expect(block).toContain('aria-label="Bereiche der Hofseite"')
    expect(block).toContain('data-chips-kleben')
    // Genau ein klebendes Element im Block (der Block selbst), und nur ein Block auf der Seite.
    expect(block.match(/sticky/g)).toHaveLength(1)
    expect(html.match(/data-klebe-block/g)).toHaveLength(1)
    // Der Block wächst mit seinem Inhalt: keine feste Höhe, keine gerechneten Abstände.
    expect(element(block, 'data-klebe-block', '>')).not.toMatch(/\bh-\[|top-\[/)
  })

  it('Gegenprobe: außerhalb des Blocks klebt nichts von Hofzeile, Reitern und Chips', () => {
    const html = seite({ suche: 'reiter=produkte' })
    const ohneBlock = html.replace(ganzesDiv(html, 'data-klebe-block'), '')
    expect(ohneBlock).not.toContain('data-hofzeile')
    expect(ohneBlock).not.toContain('aria-label="Bereiche der Hofseite"')
    expect(element(ohneBlock, 'aria-label="Zu einer Kategorie springen"', '>')).not.toContain('sticky')
  })

  it('ab md bleibt „‹ Alle Höfe" oben; „Teilen" steht nur einmal (in der Hofzeile)', () => {
    const html = seite()
    expect(html).toMatch(/class="mx-auto hidden max-w-\[1200px\] px-6 pt-3 md:block"><a[^>]*>‹ Alle Höfe/)
    expect(html.match(/aria-label="Hofseite teilen"/g)).toHaveLength(1)
  })

  it('ohne Produkte und Abholzeiten besteht der Block nur aus der Hofzeile', () => {
    const leer = publicFarm({ products: [], pickupSlots: [] })
    const block = ganzesDiv(seite({ farm: leer }), 'data-klebe-block')
    expect(block).toContain('data-hofzeile')
    expect(block).not.toContain('Bereiche der Hofseite')
  })
})

describe('3. Chips am Handy im Block', () => {
  it('im Reiter Produkte hält der Block den Platz der Chips in voller Höhe frei (CHIPS_PX), nur unter md', () => {
    const platz = element(seite({ suche: 'reiter=produkte' }), 'data-chips-kleben', '>')
    expect(platz).toContain(`min-h-[${CHIPS_PX}px] md:hidden`)
  })

  it('die Reihe im Fluss gilt dann nur ab md; am Handy legt ProduktAbschnitte sie per Portal in den Platz', () => {
    const nav = element(seite({ suche: 'reiter=produkte' }), 'aria-label="Zu einer Kategorie springen"', '>')
    expect(nav).toContain('hidden md:block')
    const abschnitte = quelle('src/components/hofseite/produkt-abschnitte.tsx')
    expect(abschnitte).toMatch(/createPortal\(\s*\/\/[^\n]*\n\s*<nav aria-label="Zu einer Kategorie springen" className="border-b border-border bg-background">/)
    expect(abschnitte).toMatch(/chipPlatz\s*\)\}/)
    expect(quelle('src/components/hofseite/hofseite-kunde.tsx')).toContain('chipBlock={chipsKleben ? { platz: chipPlatz } : undefined}')
  })

  it('Gegenprobe: in der Übersicht gibt es weder Chip-Reihe noch Chip-Platz', () => {
    const html = seite()
    expect(html).not.toContain('Zu einer Kategorie springen')
    expect(html).not.toContain('data-chips-kleben')
  })

  it('Gegenprobe: mit nur einer Kategorie kein Chip-Platz', () => {
    const einer = publicFarm({ products: [produkt('p_milch', 'Heumilch', 'MILCH')] })
    expect(seite({ suche: 'reiter=produkte', farm: einer })).not.toContain('data-chips-kleben')
  })
})

describe('4. Korb: Fehlertexte und das erste Blatt einer Sitzung (Register N29, N30)', () => {
  it('rohe Servertexte werden geglättet — beim Legen und beim Ändern der Menge', () => {
    for (const roh of ['Serverfehler bei der Reservierung', 'Ungültige Parameter', 'Ungültige Anfrage', undefined]) {
      expect(korbFehlerText({ ok: false, error: roh }, 'legen')).toBe('Wir konnten das Produkt nicht in den Warenkorb legen. Versuch es gleich noch einmal.')
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
  expect(treffer, `--${name} fehlt in KUNDE_SHELL_MASSE`).not.toBeNull()
  return treffer?.[1] ?? ''
}

describe('6. scroll-padding: der Fokus rutscht nie unter klebende Köpfe und die Unterleiste (WCAG 2.4.11)', () => {
  const css = quelle('src/app/globals.css')
  const px = (wert: string) => {
    const treffer = /^(\d+)px/.exec(wert)
    expect(treffer, `„${wert}" beginnt nicht mit einer Zahl in px`).not.toBeNull()
    return Number(treffer?.[1])
  }

  it('KundeShell: oben die Kopfzeile (--kunde-kopf), unten Unterleiste plus Mittelknopf', () => {
    expect(regel(css, "html:has([data-scroll-rand^='kunde'])", 'scroll-padding-top')).toBe(masse('kunde-kopf'))
    expect(regel(css, "html:has([data-scroll-rand^='kunde'])", 'scroll-padding-top', '@media (min-width: 768px)')).toBe(masse('kunde-kopf', true))
    const unten = regel(css, "html:has([data-scroll-rand='kunde']),", 'scroll-padding-bottom', '@media (max-width: 767px) {\n    html:has([data-scroll-rand')
    expect(unten).toBe(`calc(${px(masse('kunde-unterleiste').replace('calc(', '')) + px(masse('kunde-ueberstand'))}px + env(safe-area-inset-bottom))`)
  })

  it('Hofseite: oben Kopf + gemessene Höhe des Blocks; bis zur Messung Hofzeile + Reiter (+ Chips), ab md Reiter', () => {
    const handyMedien = '@media (max-width: 767px) {\n    html:has([data-scroll-rand'
    const kopf = px(masse('kunde-kopf'))
    expect(regel(css, "html:has([data-scroll-rand='kunde']):has([data-klebe-block])", 'scroll-padding-top', handyMedien)).toBe(
      `calc(${kopf}px + var(${KLEBE_BLOCK_VAR}, ${HOFZEILE_PX + REITER_PX}px))`
    )
    expect(regel(css, "html:has([data-scroll-rand='kunde']):has([data-chips-kleben])", 'scroll-padding-top', handyMedien)).toBe(
      `calc(${kopf}px + var(${KLEBE_BLOCK_VAR}, ${HOFZEILE_PX + REITER_PX + CHIPS_PX}px))`
    )
    const breit = regel(css, "html:has([data-scroll-rand='kunde']):has([data-klebe-block])", 'scroll-padding-top', '@media (min-width: 768px) {\n    html:has([data-scroll-rand')
    expect(breit).toBe(`calc(${px(masse('kunde-kopf', true))}px + var(${KLEBE_BLOCK_VAR}, ${REITER_PX}px))`)
  })

  it('die Hofseite misst ihren Block und schreibt die Höhe an die Wurzel', () => {
    expect(KLEBE_BLOCK_VAR).toBe('--hof-klebeblock')
    const kunde = quelle('src/components/hofseite/hofseite-kunde.tsx')
    expect(kunde).toContain('new ResizeObserver(() => wurzel.style.setProperty(KLEBE_BLOCK_VAR, `${klebeBlock.offsetHeight}px`))')
    expect(kunde).toContain('wurzel.style.removeProperty(KLEBE_BLOCK_VAR)')
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
    const ohne = css.replace(/html:has\(\[data-scroll-rand='kunde'\]\):has\(\[data-klebe-block\]\) \{[^}]*\}/g, '')
    expect(regel(ohne, "html:has([data-scroll-rand='kunde']):has([data-klebe-block])", 'scroll-padding-top')).toBeNull()
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

describe('Zurück im Titelbild am Handy (Entscheidung 5, Nr. 195)', () => {
  it('oben links im Titelbild, 44 px, nur unter md, mit dem Namen „Zu allen Höfen" für den Screenreader', () => {
    expect(TITELBILD_ZURUECK).toBe('Zu allen Höfen')
    const html = seite()
    const knopf = element(html, 'data-titelbild-zurueck', '</a>')
    expect(knopf).toContain('aria-label="Zu allen Höfen"')
    expect(knopf).toMatch(/href="\/hoefe[^"]*"/)
    expect(knopf).toContain('size-11')
    expect(knopf).toContain('top-2 left-2')
    expect(knopf).toContain('md:hidden')
    // Theme-fest dunkel wie jedes Bild-Overlay, kein Palette-Wert.
    expect(knopf).toContain('bg-primary-foreground/65')
  })

  it('steht vor der klebenden Hofzeile, nicht in ihr — vor dem Kleben (Server und erste Messung) ist er da', () => {
    const html = seite()
    expect(html.indexOf('data-titelbild-zurueck')).toBeGreaterThan(-1)
    expect(html.indexOf('data-titelbild-zurueck')).toBeLessThan(html.indexOf('data-klebe-block'))
    // Gegenprobe: Im klebenden Block bleibt das Zurück der Hofzeile, das mit dem langen Namen.
    const block = ganzesDiv(html, 'data-klebe-block')
    expect(block).not.toContain('data-titelbild-zurueck')
    expect(block).toContain('aria-label="Zurück zu allen Höfen"')
  })

  it('ab md bleibt es bei „‹ Alle Höfe": der Knopf im Titelbild ist dort verborgen, Teilen steht weiter nur einmal', () => {
    const html = seite()
    expect(html.match(/data-titelbild-zurueck/g)).toHaveLength(1)
    expect(html.match(/aria-label="Hofseite teilen"/g)).toHaveLength(1)
  })

  it('hofzeileSteht: klebt, sobald die Oberkante des Blocks unter dem Kopf angekommen ist', () => {
    expect(hofzeileSteht(56, 56)).toBe(true)
    expect(hofzeileSteht(20, 56)).toBe(true)
    // Gegenprobe: noch darunter im Fluss.
    expect(hofzeileSteht(57, 56)).toBe(false)
    expect(hofzeileSteht(420, 56)).toBe(false)
    // Ohne Kopf zählt die Fensterkante.
    expect(hofzeileSteht(0, 0)).toBe(true)
    expect(hofzeileSteht(10, 0)).toBe(false)
  })

  it('der Knopf verschwindet, wenn der Block klebt (Quelltext: nur ohne `klebt` gerendert)', () => {
    const q = quelle('src/components/hofseite/hofseite-kunde.tsx')
    expect(q).toMatch(/\{!klebt && \(\s*<Link[^>]*\s+href=\{zurueck\.href\}[\s\S]*?data-titelbild-zurueck/)
  })
})
