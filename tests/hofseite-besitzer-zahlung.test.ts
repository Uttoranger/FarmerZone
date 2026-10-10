/**
 * Zahlung in der Besitzer-Ansicht der Hofseite (FarmPageView mit ownerMode,
 * /farm-page am Handy; Nr. 35, Morgenbericht Lauf 6 §6, Register Z1):
 * Online-Zahlung erscheint nur mit fertigem Stripe-Konto UND `acceptsOnline`
 * — über die gemeinsame Regel `zahlungsarten` (src/lib/hofseite-kunde.ts),
 * dieselbe wie Hofseite, Produktseite und Kasse. Vorher reichte
 * `acceptsOnline`, und der Hof sah „Online (Karte)", obwohl Kundinnen online
 * gar nicht zahlen konnten.
 *
 * Gerendert wird echt (react-dom/server), im Bearbeitungsmodus („Zahlung &
 * Kontakt") und in der Vorschau (dazu die Aktionsleiste unter dem Titelbild).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} }),
  usePathname: () => '/farm-page',
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
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))

import { FarmPageView } from '@/components/farm/farm-page-view'
import type { PublicFarm } from '@/server/queries/farm'

const HOF: PublicFarm = {
  id: 'farm_test', slug: 'hof-test', name: 'Hof Test', ownerName: 'Erika Muster',
  description: 'Gemüse aus Musterdorf', address: 'Musterweg 1', postalCode: '4900', city: 'Musterdorf',
  phone: '+43 660 0000000', email: 'hof@example.com', logoUrl: null, bannerUrl: null,
  tagline: null, foundedYear: null, aboutText: null, bannerType: 'GRADIENT', bannerValue: null, bannerFocusY: 50,
  sectionsConfig: [], farmValues: [], farmPhotos: [],
  acceptsOnline: true, acceptsOnsite: true, stripeAccountReady: false, isPaused: false, pauseMessage: null,
  serviceFeePercent: 0, serviceFeeMinCents: 0, serviceFeeActiveFrom: null, betriebsstatus: null,
  products: [],
  pickupSlots: [{ dayOfWeek: 5, startTime: '15:00', endTime: '18:00' }],
}

type Fall = Pick<PublicFarm, 'acceptsOnline' | 'stripeAccountReady' | 'acceptsOnsite'>

function besitzer(fall: Fall, mode: 'edit' | 'preview'): string {
  return renderToStaticMarkup(
    createElement(FarmPageView, { farm: { ...HOF, ...fall }, activeStatus: null, ownerMode: true, mode, pastStatusCount: 0 })
  )
}

/** Der Text der Aktionsleiste („Zahlung <b>…</b>"), nur in der Vorschau. */
function zahlungInDerLeiste(html: string): string | null {
  return /Zahlung <b[^>]*>([^<]*)<\/b>/.exec(html)?.[1] ?? null
}

const ONLINE_MARKE = /Online bezahlen|Online \(Karte\)/

describe('Besitzer-Ansicht: Online-Zahlung nur mit Stripe UND acceptsOnline (Z1)', () => {
  it('acceptsOnline, aber Stripe nicht fertig: keine Online-Marke, Leiste „am Hof"', () => {
    const fall = { acceptsOnline: true, stripeAccountReady: false, acceptsOnsite: true }
    expect(besitzer(fall, 'edit')).not.toMatch(ONLINE_MARKE)
    const vorschau = besitzer(fall, 'preview')
    expect(vorschau).not.toMatch(ONLINE_MARKE)
    expect(zahlungInDerLeiste(vorschau)).toBe('am Hof')
  })

  it('Stripe fertig, aber Online aus: keine Online-Marke', () => {
    const fall = { acceptsOnline: false, stripeAccountReady: true, acceptsOnsite: true }
    expect(besitzer(fall, 'edit')).not.toMatch(ONLINE_MARKE)
    expect(zahlungInDerLeiste(besitzer(fall, 'preview'))).toBe('am Hof')
  })

  it('Stripe fertig und Online an: Online-Marke, Leiste „am Hof oder online"', () => {
    const fall = { acceptsOnline: true, stripeAccountReady: true, acceptsOnsite: true }
    expect(besitzer(fall, 'edit')).toMatch(/Online bezahlen/)
    const vorschau = besitzer(fall, 'preview')
    expect(vorschau).toMatch(/Online bezahlen/)
    expect(zahlungInDerLeiste(vorschau)).toBe('am Hof oder online')
  })

  it('nur online (kein Vor-Ort): Leiste „online", keine Bar-Marke', () => {
    const fall = { acceptsOnline: true, stripeAccountReady: true, acceptsOnsite: false }
    const vorschau = besitzer(fall, 'preview')
    expect(zahlungInDerLeiste(vorschau)).toBe('online')
    expect(vorschau).not.toMatch(/Bar bei Abholung/)
  })

  it('weder online bereit noch vor Ort: keine Zahlungs-Zeile in der Leiste', () => {
    const fall = { acceptsOnline: true, stripeAccountReady: false, acceptsOnsite: false }
    expect(zahlungInDerLeiste(besitzer(fall, 'preview'))).toBeNull()
  })

  it('Vor-Ort heißt wie für Kundinnen „Bar bei Abholung" (E5, keine Karte am Hof)', () => {
    const html = besitzer({ acceptsOnline: false, stripeAccountReady: false, acceptsOnsite: true }, 'edit')
    expect(html).toMatch(/Bar bei Abholung/)
    expect(html).not.toMatch(/Bar &amp; Karte|Bar & Karte/)
  })
})

describe('Quelltext: eine Regel, kein eigenes acceptsOnline', () => {
  const QUELLE = readFileSync(join(process.cwd(), 'src/components/farm/farm-page-view.tsx'), 'utf8')

  it('fragt zahlungsarten und liest acceptsOnline nicht selbst', () => {
    expect(QUELLE).toMatch(/zahlungsarten\(farm\)/)
    expect(QUELLE).not.toMatch(/farm\.acceptsOnline/)
  })

  it('Gegenprobe: die Suche erkennt den alten Weg', () => {
    expect('{farm.acceptsOnline && (').toMatch(/farm\.acceptsOnline/)
  })
})
