/**
 * Der Baustein „Aktuell vom Hof“ (Register F8, Nr. 128) — gerendert in Node
 * (TESTING_GUIDELINES §1). Merkmale sind Texte, aria-Attribute und Kennungen.
 *
 * Beweist:
 *  - Die Karte ist kurz: zwei Zeilen Text (nach stripStatusVariables) und
 *    „Weiterlesen“ als Knopf mit aria-expanded und aria-controls auf
 *    Kennungen, die es gibt; aufgeklappt „Weniger anzeigen“ und alle Produkte.
 *  - Ältere Beiträge sind Zeilen mit eigenem Knopf, der an Ort und Stelle
 *    aufklappt; zugeklappt ist ihr Inhalt verborgen.
 *  - Das „+“ ruft `onInDenKorb` mit genau dem Produkt der Produktliste —
 *    einmal je Tipp (Mock zählt). Ohne `mitPlus` gibt es kein „+“.
 *
 * Aufgeklappt wird über einen kleinen Prüfstand: `useState` liefert für den
 * Zustand „offen“ den Wert aus `stand.offen` (React rendert auf dem Server
 * nur den Anfang). Getippt wird, indem der Baum der Komponenten als
 * Funktionen entfaltet und der Knopf-Rückruf aufgerufen wird.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const stand = vi.hoisted(() => ({ offen: false }))
vi.mock('react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react')>()
  return {
    ...echt,
    useState: <T,>(anfang: T | (() => T)): [T, () => void] => {
      const wert = typeof anfang === 'function' ? (anfang as () => T)() : anfang
      // Nur der Zustand „offen“ der Karten ist ein Wahrheitswert.
      return [(typeof wert === 'boolean' ? stand.offen : wert) as T, () => {}]
    },
  }
})
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

import { AktuellVomHof } from '@/components/hofseite/aktuell-vom-hof'
import { ordneBeitraege } from '@/lib/hofseite-kunde'
import type { ActiveStatusPost } from '@/server/queries/status-posts'
import type { PublicProduct } from '@/server/queries/farm'

function produkt(id: string, name: string, stock = 10): PublicProduct {
  return {
    id, name, description: null, imageUrl: null, bildAusschnitt: null, category: 'GEMUESE', categoryImageUrl: null,
    price: 3.2, unit: 'KG', unitSize: 1, stock, isAvailable: true, allergens: [],
    isOrganic: false, requiresCool: false, requiresFreezer: false, seasonStart: null, seasonEnd: null,
    unavailableReason: null, subcategory: null, labels: [], abgabe: 'ALLE', futter: null,
    familieId: null, brennmaterial: null, abholhinweise: [],
  }
}
const PRODUKTE = [produkt('p_kuerbis', 'Hokkaido-Kürbis'), produkt('p_nuss', 'Butternut', 0), produkt('p_apfel', 'Äpfel Topaz'), produkt('p_eier', 'Freilandeier')]

const beitrag = (id: string, title: string, publishedAt: string, mehr: Partial<ActiveStatusPost> = {}): ActiveStatusPost => ({
  id, title, body: 'Hallo {Vorname}, die ersten Kürbisse sind da.\nAb Freitag auch als Suppe.', anlass: 'NEW_SEASON',
  photoUrl: '/landing/row-1.jpg', fotoAusschnitt: null, linkedProductIds: [], publishedAt, ...mehr,
})
const NEU = beitrag('bneu', 'Die ersten Kürbisse sind da', '2026-10-02T06:00:00.000Z', { linkedProductIds: ['p_nuss', 'p_kuerbis', 'p_apfel', 'p_eier'] })
const AELTER = beitrag('balt', 'Heu-Aktion: zehn Ballen zum Preis von neun', '2026-09-29T08:00:00.000Z', {
  anlass: 'PROMOTION', photoUrl: null, linkedProductIds: ['p_eier'],
})
const JETZT = '2026-10-02T08:00:00.000Z'

function props(mehr: { kennung?: string | null; mitPlus?: boolean; onInDenKorb?: (p: PublicProduct) => void } = {}) {
  const { anordnung } = ordneBeitraege([NEU, AELTER], mehr.kennung ?? null)
  if (!anordnung) throw new Error('Ohne Beiträge keine Anordnung')
  return {
    anordnung, jetzt: JETZT, produkte: PRODUKTE, mitPlus: mehr.mitPlus ?? true,
    onInDenKorb: mehr.onInDenKorb ?? (() => {}), produktLink: (id: string) => `/hof-test/produkt/${id}`,
    neuesterHref: '/hof-test', onNeuester: () => {},
  }
}
const html = (p: ReturnType<typeof props>) => renderToStaticMarkup(createElement(AktuellVomHof, p))

/** Der Baum der Komponenten, als Funktionen entfaltet — Kinder bis hinunter zu den HTML-Elementen. */
function entfalte(knoten: unknown): unknown {
  if (Array.isArray(knoten)) return knoten.map(entfalte)
  if (knoten == null || typeof knoten !== 'object') return knoten
  const element = knoten as { type: unknown; props: Record<string, unknown> }
  if (typeof element.type === 'function') return entfalte((element.type as (p: unknown) => unknown)(element.props))
  if (!element.props) return knoten
  return { ...element, props: { ...element.props, children: entfalte(element.props.children) } }
}
function knoepfe(baum: unknown, gefunden: { props: Record<string, unknown> }[] = []): { props: Record<string, unknown> }[] {
  if (Array.isArray(baum)) baum.forEach((kind) => knoepfe(kind, gefunden))
  else if (baum && typeof baum === 'object' && 'props' in baum) {
    const element = baum as { type: unknown; props: Record<string, unknown> }
    if (element.type === 'button') gefunden.push(element)
    knoepfe(element.props.children, gefunden)
  }
  return gefunden
}

beforeEach(() => {
  stand.offen = false
})

describe('Die Karte: kurz, mit „Weiterlesen“', () => {
  it('Anlass, „Aktuell · vor 2 Stunden“, Titel als h3, Text ohne Platzhalter', () => {
    const seite = html(props())
    expect(seite).toContain('Neue Saison')
    expect(seite).toContain('Aktuell · vor 2 Stunden')
    expect(seite).toMatch(/<h3 id="beitrag-titel-bneu"[^>]*>Die ersten Kürbisse sind da<\/h3>/)
    expect(seite).toContain('Hallo, die ersten Kürbisse sind da.')
    expect(seite).not.toContain('{Vorname}')
  })

  it('„Weiterlesen“ ist ein Knopf mit aria-expanded und aria-controls auf Kennungen, die es gibt', () => {
    const seite = html(props())
    const knopf = seite.match(/<button type="button" aria-expanded="false" aria-controls="([^"]+)"[^>]*>Weiterlesen/)
    expect(knopf).not.toBeNull()
    for (const kennung of (knopf?.[1] ?? '').split(' ')) expect(seite).toContain(`id="${kennung}"`)
    expect(seite).not.toContain('Weniger anzeigen')
  })

  it('zugeklappt steht „· n Produkte“ (am Handy nur das erste), aufgeklappt „Weniger anzeigen“ und alle', () => {
    expect(html(props())).toContain(' · 3 Produkte')
    stand.offen = true
    const offen = html(props())
    expect(offen).toMatch(/aria-expanded="true"[^>]*>Weniger anzeigen/)
    expect(offen).not.toContain(' · 3 Produkte')
    for (const name of ['Hokkaido-Kürbis', 'Äpfel Topaz', 'Freilandeier']) expect(offen).toContain(name)
  })

  it('das Foto: zugeklappt klein (am Handy 76 px, ab lg 250 px), aufgeklappt groß — am Handy wie am Computer', () => {
    // Ohne Browser zählt die Klasse: Welches Foto steht unter lg, welches ab lg?
    const fotos = (seite: string, ab: 'handy' | 'lg') => {
      const karte = seite.slice(seite.indexOf('<article aria-labelledby="beitrag-titel-bneu"'), seite.indexOf('</article>'))
      return [...karte.matchAll(/<span class="([^"]*)"><img src="\/landing\/row-1\.jpg"/g)]
        .map((treffer) => treffer[1].split(' '))
        .filter((k) => (ab === 'lg' ? k.includes('lg:block') || (!k.includes('hidden') && !k.includes('lg:hidden')) : !k.includes('hidden')))
        .map((k) => (k.includes('w-[250px]') ? 'klein-250' : k.includes('size-[76px]') ? 'klein-76' : k.includes('aspect-[3/2]') ? 'gross' : 'anders'))
    }
    const zu = html(props())
    expect(fotos(zu, 'handy')).toEqual(['klein-76'])
    expect(fotos(zu, 'lg')).toEqual(['klein-250'])
    stand.offen = true
    const offen = html(props())
    expect(fotos(offen, 'handy')).toEqual(['gross'])
    expect(fotos(offen, 'lg')).toEqual(['gross'])
  })

  it('höchstens drei Produkte, kaufbare zuerst — das ausverkaufte vierte fällt weg', () => {
    const seite = html(props())
    const karte = seite.slice(seite.indexOf('id="beitrag-produkte-bneu"'), seite.indexOf('</article>'))
    expect(karte).not.toContain('Butternut')
    expect(karte.indexOf('Hokkaido-Kürbis')).toBeLessThan(karte.indexOf('Äpfel Topaz'))
  })
})

describe('Ältere Beiträge als Zeilen', () => {
  it('je ein article mit Knopf (aria-expanded) und der Zeile „Anlass · Zeit“; zugeklappt ist der Inhalt verborgen', () => {
    const seite = html(props())
    expect(seite).toMatch(/<article aria-labelledby="beitrag-titel-balt"/)
    expect(seite).toMatch(/<h3><button type="button" aria-expanded="false" aria-controls="beitrag-inhalt-balt"/)
    expect(seite).toContain('Aktion · vor 3 Tagen')
    expect(seite).toMatch(/id="beitrag-inhalt-balt" hidden=""/)
  })

  it('aufgeklappt an Ort und Stelle: Text und Produkte in derselben Zeile', () => {
    stand.offen = true
    const seite = html(props())
    const zeile = seite.slice(seite.indexOf('<article aria-labelledby="beitrag-titel-balt"'))
    expect(zeile).toMatch(/aria-expanded="true" aria-controls="beitrag-inhalt-balt"/)
    expect(zeile).not.toMatch(/id="beitrag-inhalt-balt" hidden/)
    expect(zeile).toContain('Freilandeier')
  })

  it('ein geteilter älterer Beitrag steht oben, darunter „Neuester: …“ mit dem Weg zur Seite ohne ?beitrag=', () => {
    const seite = html(props({ kennung: 'balt' }))
    expect(seite.indexOf('Heu-Aktion')).toBeLessThan(seite.indexOf('Die ersten Kürbisse sind da'))
    expect(seite).toMatch(/<a href="\/hof-test"[^>]*><span[^>]*><span class="font-semibold">Neuester:<\/span> Die ersten Kürbisse sind da/)
    expect(seite).not.toContain('Aktuell ·')
  })
})

describe('Das „+“ — derselbe Weg in den Korb wie die Produktkarte', () => {
  it('ein Tipp ruft onInDenKorb genau einmal, mit dem Produkt der Produktliste', () => {
    const inDenKorb = vi.fn()
    const baum = entfalte(createElement(AktuellVomHof, props({ onInDenKorb: inDenKorb })))
    const plus = knoepfe(baum).find((k) => k.props['aria-label'] === 'Hokkaido-Kürbis in den Korb')
    expect(plus).toBeDefined()
    ;(plus?.props.onClick as () => void)()
    expect(inDenKorb).toHaveBeenCalledTimes(1)
    expect(inDenKorb).toHaveBeenCalledWith(PRODUKTE[0])
  })

  it('ohne mitPlus (Vorschau, Pause) kein „+“ — Gegenprobe: mit mitPlus ist es da', () => {
    expect(html(props({ mitPlus: false }))).not.toMatch(/in den Korb"/)
    expect(html(props({ mitPlus: true }))).toContain('aria-label="Hokkaido-Kürbis in den Korb"')
  })
})
