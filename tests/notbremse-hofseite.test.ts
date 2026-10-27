/**
 * Notbremse auf der Hofseite (Register N34, Nachbau zu Nr. 189 Punkt 2):
 * Während die Notbremse gilt, sagt die Hofzeile nicht „Nimmt Bestellungen an“
 * und der Knopf „Bestellen“ (springt zu den Produkten) fehlt — beide lesen
 * `useBestellstopp` wie die Kaufknöpfe des Produktrasters. Gerendert wird die
 * echte Hofseite (react-dom/server); nur der Stand der Notbremse im Browser
 * kommt aus einer Attrappe, weil der Server-Stand immer „keine“ ist.
 *
 * Beweist (je mit Gegenprobe ohne Notbremse):
 *  - Hofzeile: „Musterdorf · Bestellen geht gerade nicht“ statt „Nimmt Bestellungen an“;
 *  - „Bestellen“/„Jetzt bestellen“ fehlt, „Anfahrt“ bleibt;
 *  - die Produktkarten ruhen („In den Korb“ fehlt), die Produkte bleiben sichtbar;
 *  - eine Sperre des Hofs geht vor („Pausiert“ bleibt „Pausiert“).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Bestellstopp } from '@/lib/notbremse'

const browser = vi.hoisted(() => ({ stopp: null as Bestellstopp | null }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} }),
  usePathname: () => '/hof-test',
  useSearchParams: () => new URLSearchParams(),
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
vi.mock('@/components/notbremse-band', async (original) => ({
  ...(await original<typeof import('@/components/notbremse-band')>()),
  useBestellstopp: () => browser.stopp,
}))

import { FarmPageView } from '@/components/farm/farm-page-view'
import type { KaufSperre } from '@/lib/bereiche-anzeige'
import { hofZeileZustand } from '@/lib/hofseite-orientierung'
import type { PublicFarm } from '@/server/queries/farm'
import { publicFarm } from './fabrik/public-farm'
import { publicProduct } from './fabrik/public-product'

const JETZT = '2026-10-26T08:00:00.000Z'
const STOPP: Bestellstopp = { satz: 'Bestellen geht gleich wieder.', bis: '2026-10-26T10:00:00.000Z' }
const HOF: PublicFarm = publicFarm({
  products: [publicProduct({ id: 'p_milch', name: 'Heumilch', category: 'MILCH', stock: 20 }), publicProduct({ id: 'p_eier', name: 'Freilandeier', category: 'EIER', stock: 20 })],
})

function seite(sperre: KaufSperre = null): string {
  return renderToStaticMarkup(
    createElement(FarmPageView, { farm: HOF, beitraege: [], beitraegeFehler: false, reorderItems: [], ansicht: { art: 'kundin', kaufen: true }, jetzt: JETZT, sperre })
  )
}

/** Die Hofzeile am Handy — vom Merkmal bis zum Teilen-Knopf. */
function hofzeile(html: string): string {
  const start = html.indexOf('data-hofzeile')
  expect(start).toBeGreaterThan(0)
  return html.slice(start, html.indexOf('Hofseite teilen', start))
}

beforeEach(() => {
  browser.stopp = null
})

describe('Hofseite während der Notbremse', () => {
  it('Gegenprobe ohne Notbremse: „Nimmt Bestellungen an“, „Bestellen“ und „In den Korb“ stehen da', () => {
    const html = seite()
    expect(hofzeile(html)).toContain('Musterdorf · Nimmt Bestellungen an')
    expect(html).toContain('>Bestellen</span>')
    expect(html).toContain('>Jetzt bestellen</span>')
    expect(html).toMatch(/aria-label="Heumilch in den Korb"|>In den Korb</)
  })

  it('Hofzeile sagt „Bestellen geht gerade nicht“, „Bestellen“ fehlt, die Karten ruhen — Produkte und Anfahrt bleiben', () => {
    browser.stopp = STOPP
    const html = seite()
    expect(hofzeile(html)).toContain('Musterdorf · Bestellen geht gerade nicht')
    expect(html).not.toContain('Nimmt Bestellungen an')
    expect(html).not.toContain('>Bestellen</span>')
    expect(html).not.toContain('>Jetzt bestellen</span>')
    expect(html).not.toMatch(/aria-label="Heumilch in den Korb"|>In den Korb</)
    expect(html).toContain('Heumilch')
    expect(html).toContain('Anfahrt')
  })

  it('eine Sperre des Hofs geht vor: pausiert bleibt „Pausiert“, auch während der Notbremse', () => {
    browser.stopp = STOPP
    expect(hofzeile(seite('pause'))).toContain('Musterdorf · Pausiert')
    expect(hofZeileZustand(null, true)).toBe('Bestellen geht gerade nicht')
    expect(hofZeileZustand(null, false)).toBe('Nimmt Bestellungen an')
    expect(hofZeileZustand('pause', true)).toBe(hofZeileZustand('pause', false))
  })
})
