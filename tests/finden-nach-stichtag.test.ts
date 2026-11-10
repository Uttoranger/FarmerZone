/**
 * Nr. 226 (Lauf 30, „Kundschaft: Finden“): Nach dem Stichtag „Hofpreis-Modell
 * ab“ steht auf Startseite, Hofseite, Produktseite und /fuer-hoefe kein
 * „Servicegebühr“ mehr (V62, N38; Rendertest aus FERTIG, WENN je Nummer).
 *
 * Gerendert wird die echte Komponente bzw. Seite (renderToStaticMarkup), mit
 * Gegenprobe: dieselbe Stelle im Modell „bisher“ nennt das Wort — sonst
 * bewiese ein leerer Fund nichts (TESTING_GUIDELINES §2).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/server/actions/appearance', () => ({ updateFarmBannerAction: vi.fn() }))
vi.mock('@/server/actions/farm-photos', () => ({ addFarmPhotoAction: vi.fn() }))
vi.mock('@/server/actions/products', () => ({ updateProductImageAction: vi.fn(), reorderProductsAction: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} }),
  usePathname: () => '/hof-test',
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error('notFound')
  },
  unstable_rethrow: () => {},
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
// Der Stichtag je Fall; die Zahlen der Gründungshöfe fehlen (dann rendern die Seiten ohne sie).
const stichtag = vi.hoisted(() => ({ ab: null as Date | null }))
vi.mock('@/server/queries/plattform-einstellung', () => ({
  gruendungFuerSeiten: async () => null,
  ladeHofpreisEinstellung: async () => ({ hofpreisModellAb: stichtag.ab }),
}))
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({
  KundeShellMitSitzung: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))

import FuerHoefePage from '@/app/(public)/fuer-hoefe/page'
import { FarmPageView } from '@/components/farm/farm-page-view'
import { ProduktdetailKunde } from '@/components/produktdetail/produktdetail-kunde'
import { Fragen, STARTSEITE_ABSCHNITTE, SoFunktionierts } from '@/components/startseite/startseite-abschnitte'
import { BEISPIEL_WARENPREIS_CENTS, WIE_BEZAHLE_ICH_HOFPREIS, beispielRechnung } from '@/lib/startseite'
import { entferneKontaktdaten } from '@/lib/hofseite-kunde'
import { gebuehrGrundsatz } from '@/lib/konditionen'
import type { PublicFarm } from '@/server/queries/farm'
import { publicFarm } from './fabrik/public-farm'
import { publicProduct } from './fabrik/public-product'

/** Ein Tag im Hofpreis-Modell (Beispielwelt der Boards) und einer davor. */
const NACH = new Date('2027-03-03T09:00:00.000Z')
const VOR = new Date('2026-10-02T08:00:00.000Z')
/** Ab diesem Tag gilt das Hofpreis-Modell in diesen Fällen (Admin-Einstellung). */
const STICHTAG = new Date('2027-02-01T00:00:00.000Z')

const WORT = /Servicegebühr/
const KUNDIN = { art: 'kundin' as const, kaufen: true }

function hof(hofpreis: boolean): PublicFarm {
  return publicFarm({
    preisAnzeige: hofpreis ? { hundertstel: 600 } : null,
    products: [publicProduct({ id: 'p_eier', name: 'Freilandeier', price: 4.5 }), publicProduct({ id: 'p_karotten', name: 'Karotten' })],
  })
}

const hofseite = (hofpreis: boolean, jetzt: Date): string =>
  renderToStaticMarkup(
    createElement(FarmPageView, { farm: hof(hofpreis), beitraege: [], reorderItems: [], ansicht: KUNDIN, jetzt: jetzt.toISOString(), sperre: null })
  )

const produktseite = (hofpreis: boolean, jetzt: Date): string =>
  renderToStaticMarkup(
    createElement(ProduktdetailKunde, {
      farm: entferneKontaktdaten(hof(hofpreis)),
      produktId: 'p_eier',
      gewaehltId: 'p_eier',
      ansicht: KUNDIN,
      jetzt: jetzt.toISOString(),
      sperre: null,
    })
  )

/** Ein async-Abschnitt der Startseite, einmal aufgelöst (Server-Komponente ohne Next). */
async function abschnitt(element: ReactNode): Promise<string> {
  const el = element as ReactElement<Record<string, unknown>>
  const inhalt = await (el.type as (p: Record<string, unknown>) => Promise<ReactElement>)(el.props)
  return renderToStaticMarkup(inhalt)
}

afterEach(() => {
  vi.useRealTimers()
  stichtag.ab = null
})

describe('Hofseite und Produktseite nach dem Stichtag', () => {
  it('die Hofseite nennt die Plattformgebühr, nie die Servicegebühr', () => {
    const html = hofseite(true, NACH)
    expect(html).not.toMatch(WORT)
    expect(html).toContain('Plattformgebühr')
  })

  it('Gegenprobe: im Modell „bisher“ nennt dieselbe Seite die Servicegebühr', () => {
    expect(hofseite(false, VOR)).toMatch(WORT)
  })

  it('die Produktseite nennt die Plattformgebühr, nie die Servicegebühr', () => {
    const html = produktseite(true, NACH)
    expect(html).not.toMatch(WORT)
    expect(html).toContain('Plattformgebühr')
  })

  it('Gegenprobe: im Modell „bisher“ nennt dieselbe Produktseite die Servicegebühr', () => {
    expect(produktseite(false, VOR)).toMatch(WORT)
  })
})

describe('/fuer-hoefe nach dem Stichtag', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NACH, toFake: ['Date'] })
  })

  it('kein „Servicegebühr“ — Preise und Fragen mit dem Grundsatz der Plattformgebühr', async () => {
    stichtag.ab = STICHTAG
    const html = renderToStaticMarkup(await FuerHoefePage())
    expect(html).not.toMatch(WORT)
    expect(html).toContain(gebuehrGrundsatz('hofpreis', NACH))
    expect(html).toContain('Die Plattformgebühr fällt dann weg.')
  })

  it('Gegenprobe: mit dem Stichtag in der Zukunft steht der Grundsatz „bisher“ da', async () => {
    stichtag.ab = new Date('2027-06-01T00:00:00.000Z')
    const html = renderToStaticMarkup(await FuerHoefePage())
    expect(html).toMatch(WORT)
    expect(html).toContain(gebuehrGrundsatz('bisher', NACH))
  })
})

describe('Startseite nach dem Stichtag', () => {
  it('„So funktioniert’s“: das Beispiel als Satz mit der Plattformgebühr (Board w1-startseite), ohne Servicegebühr', async () => {
    stichtag.ab = STICHTAG
    const html = await abschnitt(STARTSEITE_ABSCHNITTE.SO_FUNKTIONIERTS({ jetzt: NACH }))
    expect(html).not.toMatch(WORT)
    expect(html).toContain('data-beispiel="hofpreis"')
    expect(html).toContain('darin stecken 6 % Plattformgebühr')
    expect(html).toContain('Der Hof setzt seinen Preis selbst.')
  })

  it('„Gut zu wissen“: „Wie bezahle ich?“ nennt die Plattformgebühr', async () => {
    stichtag.ab = STICHTAG
    const html = await abschnitt(STARTSEITE_ABSCHNITTE.FRAGEN({ jetzt: NACH }))
    expect(html).not.toMatch(WORT)
    expect(html).toContain(WIE_BEZAHLE_ICH_HOFPREIS.replace(/&/g, '&amp;'))
  })

  it('Gegenprobe: vor dem Stichtag die Rechnung mit der Servicegebühr und die bisherige Antwort', async () => {
    stichtag.ab = STICHTAG
    expect(await abschnitt(STARTSEITE_ABSCHNITTE.SO_FUNKTIONIERTS({ jetzt: VOR }))).toMatch(WORT)
    expect(await abschnitt(STARTSEITE_ABSCHNITTE.FRAGEN({ jetzt: VOR }))).toMatch(WORT)
    // Dieselben Bausteine direkt: Das Modell entscheidet, nicht die Uhr.
    expect(renderToStaticMarkup(createElement(SoFunktionierts, { rechnung: beispielRechnung(NACH, BEISPIEL_WARENPREIS_CENTS, 'bisher') }))).toMatch(WORT)
    expect(renderToStaticMarkup(createElement(Fragen, { jetzt: NACH, modell: 'hofpreis' }))).not.toMatch(WORT)
  })
})
