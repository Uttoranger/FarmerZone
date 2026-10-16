/**
 * Die Fotos der Hofseite am Handy (Register N5, Änderung Nr. 107; Mockups
 * mobil-k2-hofseite-fotos-mosaik, mobil-k2-hofseite-bildansicht).
 *
 * Beweist:
 *  - Die Form kommt aus EINER Regel: 1 Foto volle Breite, 2 Hälften, ab 3 das
 *    Mosaik; den Deckel „+n" gibt es erst ab 4 (fotoForm).
 *  - Wischen blättert erst ab 40 px waagrecht, senkrecht gewinnt (wischRichtung).
 *  - Das Mosaik scrollt nicht seitlich: keine Klasse mit overflow-x oder snap-x
 *    im Markup; jede Kachel heißt „Foto i von n öffnen", die Liste „Fotos von
 *    <Hof>, n insgesamt", der Deckel „Alle n Fotos ansehen" — und er öffnet bei
 *    Foto 3.
 *  - Die Bildansicht zählt „3 / 8" (aria-live) und hat unten die Leiste mit
 *    allen Fotos, das gewählte markiert.
 *
 * Ohne DOM (TESTING_GUIDELINES §1): reine Funktionen und serverseitig
 * gerendert; Fokus, Wischen im Browser und die Leiste mit Pfeiltasten prüft
 * der Bild-Durchgang (Bericht 107).
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }),
}))

import { HofseiteFotos } from '@/components/hofseite/hofseite-fotos'
import { BildansichtEbene, type Bildansicht } from '@/components/hofseite/bildansicht'
import { WISCH_SCHWELLE_PX, fotoForm, wischRichtung, zaehlerText } from '@/lib/hofseite-fotos'

/** Alle Knöpfe im Baum, den eine Komponente als Funktion zurückgibt — gerendert wird nichts. */
function knoepfe(knoten: unknown): { props: Record<string, unknown> }[] {
  if (knoten == null || typeof knoten !== 'object') return []
  if (Array.isArray(knoten)) return knoten.flatMap(knoepfe)
  const element = knoten as { type?: unknown; props?: Record<string, unknown> }
  if (!element.props) return []
  return [...(element.type === 'button' ? [{ props: element.props }] : []), ...knoepfe(element.props.children)]
}

const fotos = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `foto_${i + 1}`, url: `/landing/row-${i + 1}.jpg`, caption: null, sortOrder: i, ausschnitt: null }))

const uebersicht = (n: number) => renderToStaticMarkup(createElement(HofseiteFotos, { fotos: fotos(n), hofName: 'Hof Test', schaufenster: true }))

/** Nur das Mosaik (unter lg): die erste Liste der Fotos. */
const mosaik = (html: string) => html.slice(html.indexOf('<ul'), html.indexOf('</ul>') + 5)

describe('fotoForm — die Form unter lg aus einer Regel', () => {
  it('0, 1, 2, 3, 4 und 8 Fotos', () => {
    expect(fotoForm(0)).toEqual({ form: 'leer', weitere: 0 })
    expect(fotoForm(1)).toEqual({ form: 'eins', weitere: 0 })
    expect(fotoForm(2)).toEqual({ form: 'zwei', weitere: 0 })
    expect(fotoForm(3)).toEqual({ form: 'mosaik', weitere: 0 })
    expect(fotoForm(4)).toEqual({ form: 'mosaik', weitere: 1 })
    expect(fotoForm(8)).toEqual({ form: 'mosaik', weitere: 5 })
  })
})

describe('wischRichtung — wann ein Wischen blättert', () => {
  it('unter 40 px ist es ein Tipp, ab 40 px blättert es', () => {
    expect(WISCH_SCHWELLE_PX).toBe(40)
    expect(wischRichtung(-39, 0)).toBeNull()
    expect(wischRichtung(39, 0)).toBeNull()
    expect(wischRichtung(-40, 0)).toBe('vor')
    expect(wischRichtung(40, 0)).toBe('zurueck')
  })

  it('nach links gewischt kommt das nächste Foto, nach rechts das vorige', () => {
    expect(wischRichtung(-120, 10)).toBe('vor')
    expect(wischRichtung(120, -10)).toBe('zurueck')
  })

  it('senkrecht gewinnt: wer scrollt, blättert nicht — auch bei gleich viel waagrecht', () => {
    expect(wischRichtung(-60, 60)).toBeNull()
    expect(wischRichtung(60, -80)).toBeNull()
    expect(wischRichtung(-60, 59)).toBe('vor')
  })
})

describe('Mosaik unter lg', () => {
  it('kein seitliches Scrollen: keine Klasse mit overflow-x oder snap-x, bei keiner Zahl', () => {
    for (const n of [1, 2, 3, 8]) {
      const html = uebersicht(n)
      expect(html, String(n)).not.toMatch(/overflow-x-|snap-x/)
    }
    // Gegenprobe: die Suche schlägt am alten Streifen an.
    expect('<ul class="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto">').toMatch(/overflow-x-|snap-x/)
  })

  it('jede Kachel ein Knopf „Foto i von n öffnen"; die Liste trägt Hof und Zahl', () => {
    const html = mosaik(uebersicht(3))
    expect(html).toContain('aria-label="Fotos von Hof Test, 3 insgesamt"')
    expect(html.match(/<button type="button" aria-label="Foto \d von 3 öffnen"/g)).toHaveLength(3)
    expect(html).not.toMatch(/<a\b/)
  })

  it('der Deckel erst ab 4 Fotos — bei 3 ist nichts verborgen', () => {
    for (const n of [1, 2, 3]) {
      const html = mosaik(uebersicht(n))
      expect(html, String(n)).not.toContain('Fotos ansehen')
      expect(html, String(n)).not.toMatch(/>\+\d+</)
    }
    const vier = mosaik(uebersicht(4))
    expect(vier).toContain('>+1<')
    expect(vier).toContain('>alle 4 Fotos<')
  })

  it('bei 8 Fotos: drei Kacheln, auf der dritten „+5 · alle 8 Fotos" als Knopf „Alle 8 Fotos ansehen"', () => {
    const html = mosaik(uebersicht(8))
    const knoepfe = [...html.matchAll(/<button type="button" aria-label="([^"]+)"/g)].map((t) => t[1])
    expect(knoepfe).toEqual(['Foto 1 von 8 öffnen', 'Foto 2 von 8 öffnen', 'Alle 8 Fotos ansehen'])
    expect(html).toContain('>+5<')
    expect(html).toContain('>alle 8 Fotos<')
    // Der Deckel ist Schmuck — der Name steht am Knopf.
    expect(html).toMatch(/<span aria-hidden="true"[^>]*><span[^>]*>\+5<\/span>/)
  })

  it('die leise Zeile darunter erst ab zwei Fotos', () => {
    expect(uebersicht(8)).toContain('Tippen öffnet die Bildansicht – wischen blättert durch alle 8.')
    expect(uebersicht(1)).not.toContain('Tippen öffnet')
  })

  it('ab lg das Raster wie bisher: bis zu sechs Kacheln, auf der sechsten „+N"', () => {
    const html = uebersicht(8)
    const raster = html.slice(html.lastIndexOf('<ul'), html.lastIndexOf('</ul>'))
    const knoepfe = [...raster.matchAll(/<button type="button" aria-label="([^"]+)"/g)].map((t) => t[1])
    expect(knoepfe).toHaveLength(6)
    expect(knoepfe.at(-1)).toBe('Alle 8 Fotos ansehen')
    expect(raster).toContain('>+2<')
  })

  it('ohne Fotos kein Abschnitt', () => {
    expect(uebersicht(0)).toBe('')
  })
})

describe('Bildansicht', () => {
  const bild = (offen: number | null): Bildansicht => ({ offen, oeffne: () => {}, schliesse: () => {}, vor: () => {}, zurueck: () => {}, geheZu: () => {} })
  const ansicht = (offen: number | null, n = 8) =>
    renderToStaticMarkup(createElement(BildansichtEbene, { fotos: fotos(n), bild: bild(offen), titel: 'Fotos vom Hof', hofName: 'Hof Test' }))

  it('der Zähler „3 / 8" wird angesagt', () => {
    expect(zaehlerText(2, 8)).toBe('3 / 8')
    expect(ansicht(2)).toMatch(/aria-live="polite"[^>]*>3 \/ 8</)
  })

  it('oben Schließen, unten die Leiste mit allen Fotos — das gewählte markiert', () => {
    const html = ansicht(2)
    expect(html).toMatch(/role="dialog" aria-modal="true" aria-label="Fotos vom Hof"/)
    expect(html).toContain('aria-label="Schließen"')
    const leiste = html.slice(html.indexOf('aria-label="Alle Fotos"'))
    expect(leiste.match(/aria-label="Foto \d von 8"/g)).toHaveLength(8)
    expect(leiste).toMatch(/aria-label="Foto 3 von 8" aria-current="true"/)
    expect(leiste.match(/aria-current/g)).toHaveLength(1)
  })

  it('mit einem Foto weder Leiste noch Pfeile — es gibt nichts zu blättern', () => {
    const html = ansicht(0, 1)
    expect(html).toContain('1 / 1')
    expect(html).not.toContain('aria-label="Alle Fotos"')
    expect(html).not.toContain('Nächstes Foto')
  })

  it('zu: nichts', () => {
    expect(ansicht(null)).toBe('')
  })
})

describe('der Deckel öffnet bei Foto 3', () => {
  it('der Knopf „Alle 8 Fotos ansehen" ruft oeffne mit dem dritten Foto', async () => {
    vi.resetModules()
    const oeffne = vi.fn()
    vi.doMock('@/components/hofseite/bildansicht', () => ({
      useBildansicht: () => ({ offen: null, oeffne, schliesse: () => {}, vor: () => {}, zurueck: () => {}, geheZu: () => {} }),
      BildansichtEbene: () => null,
    }))
    const { HofseiteFotos: Fotos } = await import('@/components/hofseite/hofseite-fotos')
    const baum = Fotos({ fotos: fotos(8), hofName: 'Hof Test' })
    const alle = knoepfe(baum)
    // Gegenprobe: die Suche findet die Kacheln beider Listen (3 im Mosaik, 6 im Raster).
    expect(alle).toHaveLength(9)
    // Der erste Knopf mit diesem Namen ist der Deckel im Mosaik (der zweite die sechste Kachel ab lg).
    const deckel = alle.find((k) => k.props['aria-label'] === 'Alle 8 Fotos ansehen')
    expect(deckel).toBeDefined()
    const kachel = { tag: 'kachel' }
    ;(deckel?.props.onClick as (e: { currentTarget: unknown }) => void)({ currentTarget: kachel })
    expect(oeffne).toHaveBeenCalledWith(2, kachel)
    vi.doUnmock('@/components/hofseite/bildansicht')
  })
})
