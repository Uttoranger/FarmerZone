/**
 * Alt-Texte der Hofseite (Nr. 117) — gerendert mit react-dom/server.
 *
 * Beweist: Das Titelbild heißt „Titelbild von {Hof}" (nur die eine Lage, die
 * Screenreader hören; Kopie und ganze Lage bleiben Schmuck), Hoffotos tragen
 * ihre Bildunterschrift oder „Foto von {Hof}", das Produktfoto den
 * Produktnamen; die Kategorie-Illustration bleibt leer. Je Aussage die
 * Gegenprobe, dass die Suche das Bild auch findet.
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string; 'aria-hidden'?: string }) => createElement('img', { src: p.src, alt: p.alt, 'aria-hidden': p['aria-hidden'] }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; onNavigate?: unknown; prefetch?: unknown }) => {
    const attribute: Record<string, unknown> = { ...rest }
    delete attribute.onNavigate
    delete attribute.prefetch
    return createElement('a', { href, ...attribute }, children)
  },
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} }),
  usePathname: () => '/hof-test',
  useSearchParams: () => new URLSearchParams(),
}))

import { Titelbild } from '@/components/hofseite/titelbild'
import { HofseiteFotos } from '@/components/hofseite/hofseite-fotos'
import { fotoAlt } from '@/components/hofseite/bildansicht'
import { ProduktKarte } from '@/components/hofseite/produkt-karte'
import { titelbildAusschnitt } from '@/lib/titelbild'
import type { PublicFarmPhoto, PublicProduct } from '@/server/queries/farm'

const FOTO = 'https://blob.example/titel.jpg'

/** Alle <img> mit ihrem alt und ob sie für Screenreader verborgen sind. */
function bilder(html: string): { src: string; alt: string; versteckt: boolean }[] {
  return [...html.matchAll(/<img([^>]*)>/g)].map(([, attr]) => ({
    src: /src="([^"]*)"/.exec(attr)?.[1] ?? '',
    alt: /alt="([^"]*)"/.exec(attr)?.[1] ?? '',
    versteckt: /aria-hidden="true"/.test(attr),
  }))
}

describe('Titelbild', () => {
  const html = (hofName?: string) =>
    renderToStaticMarkup(createElement(Titelbild, { foto: FOTO, verlauf: 'none', ausschnitt: titelbildAusschnitt(null, 50), hofName }))

  it('„Titelbild von {Hof}" an genau der Lage, die Screenreader hören; die beiden anderen bleiben leer', () => {
    const alle = bilder(html('Hof Test'))
    // Gegenprobe: Die Suche findet alle drei Lagen desselben Fotos.
    expect(alle.map((b) => b.src)).toEqual([FOTO, FOTO, FOTO])
    expect(alle.filter((b) => b.alt !== '')).toEqual([{ src: FOTO, alt: 'Titelbild von Hof Test', versteckt: false }])
  })

  it('ohne Namen bleibt der Alt-Text leer wie bisher', () => {
    expect(bilder(html()).every((b) => b.alt === '')).toBe(true)
  })
})

describe('Hoffotos', () => {
  const foto = (id: string, caption: string | null): PublicFarmPhoto => ({ id, url: `https://blob.example/${id}.jpg`, caption, sortOrder: 0, ausschnitt: null })

  it('Kacheln mit Bildunterschrift tragen sie, ohne „Foto von {Hof}"', () => {
    const html = renderToStaticMarkup(createElement(HofseiteFotos, { fotos: [foto('a', 'Unser Stall im Winter'), foto('b', null)], hofName: 'Hof Test' }))
    const alle = bilder(html)
    expect(alle.length).toBeGreaterThanOrEqual(2)
    expect(alle.filter((b) => b.src.endsWith('/a.jpg')).every((b) => b.alt === 'Unser Stall im Winter')).toBe(true)
    expect(alle.filter((b) => b.src.endsWith('/b.jpg')).every((b) => b.alt === 'Foto von Hof Test')).toBe(true)
  })

  it('die Regel für Bildansicht und Kacheln: Unterschrift, sonst „Foto von {Hof}", ohne Namen leer', () => {
    expect(fotoAlt({ caption: 'Am Feld' }, 'Hof Test')).toBe('Am Feld')
    expect(fotoAlt({ caption: null }, 'Hof Test')).toBe('Foto von Hof Test')
    expect(fotoAlt({ caption: '' }, 'Hof Test')).toBe('Foto von Hof Test')
    expect(fotoAlt({ caption: null }, undefined)).toBe('')
  })
})

describe('Produktkarte', () => {
  const produkt = (teil: Partial<PublicProduct>): PublicProduct => ({
    id: 'p_eier', name: 'Freilandeier', description: null, imageUrl: null, bildAusschnitt: null, category: 'EIER', categoryImageUrl: '/categories/eier.webp',
    price: 4.5, unit: 'STUECK', unitSize: null, stock: 20, isAvailable: true, allergens: [], isOrganic: false, requiresCool: false, requiresFreezer: false,
    seasonStart: null, seasonEnd: null, unavailableReason: null, subcategory: null, labels: [], abgabe: 'ALLE', futter: null, familieId: null, brennmaterial: null,
    ...teil,
  })
  const karte = (p: PublicProduct) =>
    renderToStaticMarkup(
      createElement(ProduktKarte, { produkt: p, zustand: { art: 'kaufbar' }, imKorb: 0, wirdHinzugefuegt: false, href: '/hof-test/produkt/p_eier', onInDenKorb: () => {}, onMenge: () => {} })
    )

  it('das Produktfoto heißt wie das Produkt', () => {
    expect(bilder(karte(produkt({ imageUrl: 'https://blob.example/eier.jpg' })))).toEqual([
      { src: 'https://blob.example/eier.jpg', alt: 'Freilandeier', versteckt: false },
    ])
  })

  it('die Kategorie-Illustration ist Schmuck und bleibt leer — Gegenprobe: das Bild steht da', () => {
    expect(bilder(karte(produkt({})))).toEqual([{ src: '/categories/eier.webp', alt: '', versteckt: false }])
  })
})
