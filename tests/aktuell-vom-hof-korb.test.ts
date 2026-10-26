/**
 * Das „+“ in „Aktuell vom Hof“ legt über GENAU den Weg der Produktkarten in
 * den Korb (Register F8, Nr. 128; Freigabe: „kein zweiter Warenkorb-Code“).
 *
 * Gerendert wird die echte Hofseite (FarmPageView mit dem echten ProductGrid)
 * wie in page.tsx. Ersetzt sind nur die Grenzen: der Korb (useCart, sein
 * addItem zählt), der Abschnitt und die Produktkarte als Attrappen, die ihre
 * Props festhalten, und `useImperativeHandle` so, dass er schon beim Rendern
 * auf dem Server wirkt (dort laufen Effekte nicht). Dann wird beides getippt:
 * das „+“ des Abschnitts und der Kaufknopf der Produktkarte — der Mock zählt
 * zwei Aufrufe mit denselben Daten.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const fang = vi.hoisted(() => ({
  abschnitt: null as null | Record<string, unknown>,
  karten: [] as Record<string, unknown>[],
  addItem: null as null | ((...args: unknown[]) => Promise<{ ok: boolean }>),
}))

vi.mock('react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react')>()
  return {
    ...echt,
    // Auf dem Server setzt React keine Refs — hier gleich beim Rendern, wie es im Browser danach geschähe.
    useImperativeHandle: (ref: unknown, erzeuge: () => unknown) => {
      if (ref && typeof ref === 'object') (ref as { current: unknown }).current = erzeuge()
    },
  }
})
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} }),
  usePathname: () => '/hof-test',
  useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('next/image', () => ({ default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }) }))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => createElement('a', { href }, children),
}))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }) }))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))
vi.mock('@/server/actions/appearance', () => ({ updateFarmBannerAction: vi.fn() }))
vi.mock('@/server/actions/farm-photos', () => ({ addFarmPhotoAction: vi.fn(), reorderPhotosAction: vi.fn() }))
vi.mock('@/server/actions/products', () => ({ updateProductImageAction: vi.fn(), reorderProductsAction: vi.fn() }))
vi.mock('@/lib/use-cart', () => ({
  useCart: () => ({
    items: [], count: 0, total: 0, isHydrated: true,
    addItem: (...args: unknown[]) => fang.addItem?.(...args) ?? Promise.resolve({ ok: true }),
    updateQuantity: vi.fn(), removeItem: vi.fn(), clearCart: vi.fn(), ersetzeKorb: vi.fn(),
  }),
  // Der Satz des Abgleichs (Nr. 169) — hier keiner.
  useKorbHinweis: () => null,
  // Der leere Korb im Blatt (Nr. 175).
  KORB_LEER: { titel: 'leer', satz: 'leer', zumHof: 'zum Hof' },
  zeigeKorbHinweis: vi.fn(),
}))
vi.mock('@/components/hofseite/aktuell-vom-hof', () => ({
  AktuellVomHof: (props: Record<string, unknown>) => {
    fang.abschnitt = props
    return null
  },
}))
vi.mock('@/components/hofseite/produkt-karte', () => ({
  ProduktKarte: (props: Record<string, unknown>) => {
    fang.karten.push(props)
    return null
  },
}))

import { FarmPageView } from '@/components/farm/farm-page-view'
import type { PublicFarm, PublicProduct } from '@/server/queries/farm'
import { publicFarm } from './fabrik/public-farm'
import { publicProduct } from './fabrik/public-product'
import type { ActiveStatusPost } from '@/server/queries/status-posts'

const KAROTTEN: PublicProduct = publicProduct({ id: 'p_karotten', name: 'Karotten', price: 2.4, unit: 'KG', unitSize: 1, stock: 8 })
const HOF: PublicFarm = publicFarm({ name: 'Testhof A', description: 'Gemüse', products: [KAROTTEN] })
const BEITRAG: ActiveStatusPost = {
  id: 'bneu', title: 'Neue Karotten', body: 'Frisch vom Feld.', anlass: 'FRESH_PRODUCT', photoUrl: null, fotoAusschnitt: null,
  linkedProductIds: ['p_karotten'], publishedAt: '2026-10-02T06:00:00.000Z',
}

beforeEach(() => {
  fang.abschnitt = null
  fang.karten = []
})

function rendere(): void {
  renderToStaticMarkup(
    createElement(FarmPageView, { farm: HOF, beitraege: [BEITRAG], reorderItems: [], ansicht: { art: 'kundin', kaufen: true }, jetzt: '2026-10-02T08:00:00.000Z', sperre: null })
  )
}

describe('„+“ in „Aktuell vom Hof“ = Kaufknopf der Produktkarte', () => {
  it('beide Tipps landen im selben Korb, mit denselben Daten — der Mock zählt zwei', async () => {
    const addItem = vi.fn(async () => ({ ok: true }))
    fang.addItem = addItem
    rendere()

    const plus = fang.abschnitt?.onInDenKorb as (p: PublicProduct) => void
    const karte = fang.karten.find((k) => (k.produkt as PublicProduct).id === 'p_karotten')
    expect(plus).toBeTypeOf('function')
    expect(karte).toBeDefined()

    plus(KAROTTEN)
    await vi.waitFor(() => expect(addItem).toHaveBeenCalledTimes(1))
    ;(karte?.onInDenKorb as (p: PublicProduct) => void)(KAROTTEN)
    await vi.waitFor(() => expect(addItem).toHaveBeenCalledTimes(2))

    expect(addItem.mock.calls[0]).toEqual(addItem.mock.calls[1])
    expect(addItem.mock.calls[0]).toEqual([
      { productId: 'p_karotten', name: 'Karotten', price: 2.4, unit: 'KG', unitSize: 1, imageUrl: null },
      1,
    ])
  })

  it('der Abschnitt bekommt die Produktliste der Hofseite und das „+“ nur, wo Kaufen wirkt', () => {
    rendere()
    expect(fang.abschnitt?.produkte).toEqual([KAROTTEN])
    expect(fang.abschnitt?.mitPlus).toBe(true)
  })
})
