/**
 * Welche Produkte unter „Braucht dich" stehen (Karten-Zeilen unter 1024 px):
 * `hatHandlung` in der Produkte-Ansicht. Nur „Unterkategorie ergänzen" ist ein
 * leiser Hinweis und lässt ein Produkt unter „Im Shop"; „Einheit prüfen" und
 * „Kategorie ergänzen" stellen es nach oben.
 *
 * Die Gegenprobe sitzt im Quelltext der Ansicht: Ohne die Ausnahme für
 * `unterkategorie-ergaenzen` wäre der erste Fall rot.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/products',
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; [k: string]: unknown }) => {
    const attribute = { ...rest }
    delete attribute.prefetch
    delete attribute.onNavigate
    return createElement('a', { href, ...attribute }, children)
  },
}))
vi.mock('@/server/actions/products', () => ({
  setzeVorrat: vi.fn(),
  deleteProduct: vi.fn(),
  setzeKategorie: vi.fn(),
  produktSichtbarkeitSetzen: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  pruefeDualUse: vi.fn(),
}))
vi.mock('@/server/actions/produktfamilie', () => ({
  legeFutterFamilieAn: vi.fn(),
  legeBrennmaterialFamilieAn: vi.fn(),
}))

import { LOW_STOCK_THRESHOLD } from '@/lib/dashboard-hints'
import type { ProductData } from '@/server/queries/products'

describe('hatHandlung: Abschnitt „Braucht dich" oder „Im Shop"', () => {
  beforeAll(async () => {
    await import('@/components/produkte/produkte-ansicht')
  }, 30_000)

  const vorrat = LOW_STOCK_THRESHOLD + 10

  function produkt(teil: Partial<ProductData>): ProductData {
    return {
      id: 'p1',
      name: 'Testprodukt',
      description: null,
      imageUrl: null,
      bildAusschnitt: null,
      category: 'GEMUESE',
      subcategory: null,
      labels: [],
      futter: null,
      abgabe: 'ALLE',
      categoryImageUrl: null,
      countsTowardLimit: true,
      price: 4.5,
      vatRate: 10,
      unit: 'KG',
      unitSize: null,
      stock: vorrat,
      reservedStock: 0,
      isAvailable: true,
      allergens: [],
      isOrganic: false,
      requiresCool: false,
      requiresFreezer: false,
      seasonStart: null,
      seasonEnd: null,
      unavailableReason: null,
      familieId: null,
      verpackung: null,
      abholhinweise: [],
      keinRuecktritt: false,
      ruecksendekostenCents: null,
      sperre: null,
      ...teil,
    }
  }

  /** Der Teil der Karten-Zeilen (nach der Tabelle), aufgeteilt an den Abschnittsköpfen. */
  async function abschnitte(p: ProductData): Promise<{ braucht: string; imShop: string }> {
    const { ProdukteAnsicht } = await import('@/components/produkte/produkte-ansicht')
    const html = renderToStaticMarkup(
      createElement(ProdukteAnsicht, {
        products: [p],
        hofBetriebsnummer: null,
        registrierung: { betriebsnummer: null, betriebsstatus: null },
        hof: { name: 'Testhof A', slug: 'testhof-a', sichtbar: true, teilenMomenteAus: false },
        naechstesFenster: null,
      })
    )
    const zeilen = html.slice(html.indexOf('</table>'))
    const braucht = zeilen.indexOf('>Braucht dich<')
    const shop = zeilen.indexOf('>Im Shop<')
    if (braucht >= 0) return { braucht: zeilen.slice(braucht, shop > braucht ? shop : undefined), imShop: shop > braucht ? zeilen.slice(shop) : '' }
    return { braucht: '', imShop: shop >= 0 ? zeilen.slice(shop) : '' }
  }

  it('nur „Unterkategorie ergänzen": das Produkt steht unter „Im Shop"', async () => {
    const { braucht, imShop } = await abschnitte(produkt({ name: 'Nur Unterkategorie' }))
    expect(braucht).toBe('')
    expect(imShop).toContain('Nur Unterkategorie')
  })

  it('„Kategorie ergänzen": das Produkt steht unter „Braucht dich"', async () => {
    const { braucht, imShop } = await abschnitte(produkt({ name: 'Zzyzx', category: null }))
    expect(braucht).toContain('Zzyzx')
    expect(imShop).not.toContain('Zzyzx')
  })

  it('„Einheit prüfen" (Futtermittel mit alter Gebindegröße): das Produkt steht unter „Braucht dich"', async () => {
    const { braucht, imShop } = await abschnitte(produkt({ name: 'Altes Heu', category: 'HEU_STROH', subcategory: 'WIESENHEU', unitSize: 20 }))
    expect(braucht).toContain('Altes Heu')
    expect(imShop).not.toContain('Altes Heu')
  })

  it('Gegenprobe: die Ausnahme für „Unterkategorie ergänzen" steht in hatHandlung', () => {
    const quelle = readFileSync(join(process.cwd(), 'src/components/produkte/produkte-ansicht.tsx'), 'utf8')
    expect(quelle).toMatch(/hatHandlung[^\n]*h\.art !== 'unterkategorie-ergaenzen'/)
  })
})
