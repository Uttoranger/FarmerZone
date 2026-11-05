/**
 * Kein „Servicegebühr“ nach dem Stichtag in Produkte und Produkt-Formularen (Nr. 223, Lauf 30;
 * V62, Register N38; Boards s1/w1-produkte, s1/w1-produkt-neu).
 *
 * Ursache: Die Futter-Vorschau sagte immer „Die Servicegebühr zahlt die Kundin zusätzlich. Du
 * bekommst genau deinen Preis.“ (futter-formular.tsx, ohne Bedingung) — auch ab dem Stichtag
 * „Hofpreis-Modell ab“, wo die Kundin den Endpreis inkl. Plattformgebühr sieht.
 *
 * Beweist (gerendert, TESTING_GUIDELINES §2 „Wache über Nutzertext“):
 *  - Futter-Vorschau im Hofpreis-Modell: kein „Servicegebühr“, dafür „Preise inkl. Plattformgebühr
 *    (6 %)“ und die Endpreise der Größen (endpreisEuro — dieselbe Rechnung wie /api/checkout).
 *  - Gegenprobe im Modell „bisher“: der Satz von heute mit „Servicegebühr“, die Preise des Hofs.
 *  - Die Liste /products im Hofpreis-Modell: kein „Servicegebühr“, „Du bekommst … · die Kundin zahlt …“.
 *  - Der Satz für Brennmaterial ist derselbe (vorschauGebuehrSatz).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/products',
}))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => createElement('a', { href }, children),
}))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('@/server/actions/products', () => ({
  setzeVorrat: vi.fn(),
  deleteProduct: vi.fn(),
  setzeKategorie: vi.fn(),
  produktSichtbarkeitSetzen: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  pruefeDualUse: vi.fn(),
}))
vi.mock('@/server/actions/produktfamilie', () => ({ legeFutterFamilieAn: vi.fn(), legeBrennmaterialFamilieAn: vi.fn() }))

import { KaeuferVorschau } from '@/components/produkte/futter-formular'
import { vorschauGebuehrSatz } from '@/lib/produkte-hof'
import type { ProductData } from '@/server/queries/products'

const NACH_STICHTAG = { hundertstel: 600 }
const registrierung = { betriebsnummer: null, betriebsstatus: null }
const zeilen = [
  { schluessel: 'a', unit: 'BALLEN' as const, nettoMenge: 15, price: 2.5 },
  { schluessel: 'b', unit: 'BALLEN' as const, nettoMenge: 250, price: 38 },
]

const vorschau = (preisAnzeige: { hundertstel: number } | null) =>
  renderToStaticMarkup(
    createElement(KaeuferVorschau, {
      name: 'Heu, 1. Schnitt',
      zeilen,
      sperren: [false, false],
      category: 'HEU_STROH',
      registrierung,
      preisAnzeige,
    })
  )

describe('Futter-Vorschau je Stichtag', () => {
  it('nach dem Stichtag: kein „Servicegebühr“, Endpreise und „Preise inkl. Plattformgebühr (6 %)“', () => {
    const html = vorschau(NACH_STICHTAG)
    expect(html).not.toMatch(/Servicegebühr/)
    expect(html).toContain('Preise inkl. Plattformgebühr (6 %)')
    // € 2,50 → € 2,65 und € 38,00 → € 40,28 (je Stück aufgerundet, Board s1-produkt-neu Bild 2).
    expect(html).toContain('€ 2,65')
    expect(html).toContain('€ 40,28')
    expect(html).not.toContain('€ 2,50')
  })

  it('Gegenprobe vor dem Stichtag: der Satz von heute mit „Servicegebühr“ und die Preise des Hofs', () => {
    const html = vorschau(null)
    expect(html).toContain('Die Servicegebühr zahlt die Kundin zusätzlich. Du bekommst genau deinen Preis.')
    expect(html).toContain('€ 2,50')
    expect(html).not.toContain('Plattformgebühr')
  })

  it('Brennmaterial nimmt denselben Satz; der Satz des Hofs steht darin', () => {
    expect(vorschauGebuehrSatz(NACH_STICHTAG)).toBe('Preise inkl. Plattformgebühr (6 %)')
    expect(vorschauGebuehrSatz({ hundertstel: 450 })).toBe('Preise inkl. Plattformgebühr (4,5 %)')
    expect(vorschauGebuehrSatz(null)).toMatch(/Servicegebühr/)
  })
})

describe('Liste /products je Stichtag', () => {
  beforeAll(async () => {
    await import('@/components/produkte/produkte-ansicht')
  }, 30_000)

  const produkt: ProductData = {
    id: 'p1',
    name: 'Freilandeier',
    description: null,
    imageUrl: null,
    bildAusschnitt: null,
    category: 'EIER',
    subcategory: null,
    labels: [],
    futter: null,
    abgabe: 'ALLE',
    categoryImageUrl: null,
    countsTowardLimit: true,
    price: 4.5,
    vatRate: 10,
    unit: 'STUECK',
    unitSize: 10,
    stock: 24,
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
  }

  async function liste(preisAnzeige: { hundertstel: number } | null): Promise<string> {
    const { ProdukteAnsicht } = await import('@/components/produkte/produkte-ansicht')
    return renderToStaticMarkup(
      createElement(ProdukteAnsicht, {
        products: [produkt],
        hofBetriebsnummer: null,
        registrierung,
        hof: { name: 'Hof Test', slug: 'hof-test', sichtbar: true, teilenMomenteAus: false },
        naechstesFenster: null,
        preisAnzeige,
      })
    )
  }

  it('nach dem Stichtag kein „Servicegebühr“, „Du bekommst … · die Kundin zahlt …“ — Gegenprobe davor ohne den Satz', async () => {
    const nach = await liste(NACH_STICHTAG)
    expect(nach).not.toMatch(/Servicegebühr/)
    expect(nach).toContain('Du bekommst € 4,50 · die Kundin zahlt € 4,77')
    const vor = await liste(null)
    expect(vor).not.toContain('Du bekommst')
  })
})
