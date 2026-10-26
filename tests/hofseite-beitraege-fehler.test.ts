/**
 * Scheitert das Laden der Beiträge, sagt `?beitrag=` nicht „nicht mehr aktuell“
 * (Register F8, Nr. 128 „Kann“, umgesetzt mit Nr. 134): Der Beitrag kann aktiv
 * sein, nur das Laden ging schief. page.tsx gibt der Hofseite dafür den Merker
 * `beitraegeFehler` (FarmPageView → HofseiteKunde); die Seite zeigt sich dann wie
 * ohne Beiträge, ohne den Satz. Dass die Seite ohne Satz erscheint, prüft
 * tests/hofseite-kunde-ansicht.test.ts, die reine Regel tests/aktuell-vom-hof-regeln.test.ts.
 *
 * Hier läuft die echte Seite bis zur Client-Komponente (nur Datenbank, Lader und
 * die Beitragsabfragen sind Attrappen); geprüft wird, was FarmPageView bekommt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'

const db = vi.hoisted(() => ({ hof: null as Record<string, unknown> | null }))
// Die schlanke Prüfung der Seite fragt nur den Hof; alles andere liefert nichts.
vi.mock('@/lib/prisma', () => ({
  prisma: new Proxy({}, { get: (_, modell: string) => new Proxy({}, { get: () => async () => (modell === 'farm' ? db.hof : null) }) }),
}))
vi.mock('@/server/hofseite-vorschau', () => ({ ladeHofseiteGeteilt: vi.fn() }))
vi.mock('@/server/queries/teilen-bild', () => ({ teilenVorschauAus: vi.fn(() => null) }))
vi.mock('@/server/queries/status-posts', () => ({ getActiveStatusPosts: vi.fn(), ladeAktivenBeitrag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/server/actions/appearance', () => ({ updateFarmBannerAction: vi.fn() }))
vi.mock('@/server/actions/farm-photos', () => ({ addFarmPhotoAction: vi.fn(), reorderPhotosAction: vi.fn() }))
vi.mock('@/server/actions/products', () => ({ updateProductImageAction: vi.fn(), reorderProductsAction: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
  unstable_rethrow: () => {},
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} }),
  usePathname: () => '/testhof-a',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/image', () => ({ default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }) }))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => createElement('a', { href }, children),
}))

import * as Sentry from '@sentry/nextjs'
import FarmPage from '@/app/(public)/[farmSlug]/page'
import { ladeHofseiteGeteilt } from '@/server/hofseite-vorschau'
import { getActiveStatusPosts, ladeAktivenBeitrag, type ActiveStatusPost } from '@/server/queries/status-posts'
import { FarmPageView } from '@/components/farm/farm-page-view'
import { publicFarm } from './fabrik/public-farm'
import { findeElement, inhaltHinterSuspense } from './element-suche'

const KENNUNG = 'cbeitragaaaa'
const BEITRAG: ActiveStatusPost = {
  id: 'cbeitragbbbb', title: 'Neue Karotten', body: 'Frisch vom Feld.', anlass: 'FRESH_PRODUCT', photoUrl: null, fotoAusschnitt: null,
  linkedProductIds: [], publishedAt: '2026-10-02T06:00:00.000Z',
}

/** Die Props, mit denen die Seite die Hofseite zeichnet. */
async function propsDerHofseite(suche: Record<string, string>): Promise<Record<string, unknown>> {
  const baum = await FarmPage({ params: Promise.resolve({ farmSlug: 'testhof-a' }), searchParams: Promise.resolve(suche) })
  const ansicht = findeElement(await inhaltHinterSuspense(baum), FarmPageView)
  if (!ansicht) throw new Error('FarmPageView nicht gefunden')
  return ansicht.props
}

beforeEach(() => {
  vi.clearAllMocks()
  // Ein öffentlicher Hof mit Produkten im Shop (schlanke Prüfung der Seite).
  db.hof = { istTesthof: false, latitude: null, longitude: null, _count: { products: 4 } }
  vi.mocked(ladeHofseiteGeteilt).mockResolvedValue({
    farm: publicFarm({ name: 'Testhof A' }),
    ansicht: { art: 'kundin', noindex: false, kaufen: true },
  })
})

describe('Hofseite: Merker beitraegeFehler (Register F8, Nr. 134)', () => {
  it('scheitert das Laden der Beiträge: leere Liste, Merker gesetzt, Fehler nach Sentry — die Seite bleibt', async () => {
    vi.mocked(getActiveStatusPosts).mockRejectedValue(new Error('Verbindung weg'))
    const props = await propsDerHofseite({ beitrag: KENNUNG })
    expect(props.beitraege).toEqual([])
    expect(props.beitraegeFehler).toBe(true)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })

  it('scheitert erst das Laden des geteilten Beitrags (die neuesten waren da): ebenso Merker, keine halbe Liste', async () => {
    vi.mocked(getActiveStatusPosts).mockResolvedValue([BEITRAG])
    vi.mocked(ladeAktivenBeitrag).mockRejectedValue(new Error('Verbindung weg'))
    const props = await propsDerHofseite({ beitrag: KENNUNG })
    expect(props.beitraege).toEqual([])
    expect(props.beitraegeFehler).toBe(true)
  })

  it('Gegenprobe: ging das Laden gut, ist der Merker aus — auch wenn der Beitrag nicht (mehr) aktiv ist', async () => {
    vi.mocked(getActiveStatusPosts).mockResolvedValue([BEITRAG])
    vi.mocked(ladeAktivenBeitrag).mockResolvedValue(null)
    const props = await propsDerHofseite({ beitrag: KENNUNG })
    expect(props.beitraege).toEqual([BEITRAG])
    expect(props.beitraegeFehler).toBe(false)
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('Gegenprobe: ohne ?beitrag= und ohne Fehler ist der Merker aus', async () => {
    vi.mocked(getActiveStatusPosts).mockResolvedValue([BEITRAG])
    const props = await propsDerHofseite({})
    expect(props.beitraegeFehler).toBe(false)
  })
})
