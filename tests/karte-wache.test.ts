/**
 * Die beiden Leaflet-Stellen (Hofübersicht samt Umfeld, Standortkarte im
 * Hof-Profil) nach Nachtlauf Nr. 52 — am Quelltext, mit Gegenprobe:
 *
 *  - EIN gemeinsamer Hook für den Größenwechsel (ResizeObserver →
 *    invalidateSize); Leaflets eigenes Lauschen auf window-resize ist aus,
 *    damit nicht zwei Stellen dieselbe Karte neu messen.
 *  - Attribution ohne Leaflet-Präfix; „© OpenStreetMap-Mitwirkende" mit Link
 *    bleibt (eine Quelle für Kacheln und Attribution).
 *  - Beim Nachladen ein Platzhalter in Kartengröße („Karte lädt …").
 *
 * Verhalten im Browser (Messungen, Pins nach dem Größenwechsel) steht im
 * Bericht 52; hier geht es um das, was sich am Quelltext zeigen lässt.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { KarteLaedt } from '@/components/karte/karte-laedt'
import { KARTE_LAEDT } from '@/lib/hoefe-anzeige'

const WURZEL = process.cwd()
const quelle = (pfad: string) => readFileSync(join(WURZEL, pfad), 'utf8')
/** Ohne Kommentare — die Dateien erklären, was sie NICHT tun. */
const code = (pfad: string) => quelle(pfad).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

function alleDateien(ordner: string): string[] {
  return readdirSync(join(WURZEL, ordner)).flatMap((name) => {
    const pfad = join(ordner, name)
    if (statSync(join(WURZEL, pfad)).isDirectory()) return alleDateien(pfad)
    return /\.tsx?$/.test(name) ? [relative(WURZEL, join(WURZEL, pfad)).split(sep).join('/')] : []
  })
}

const KARTEN = ['src/components/hoefe/hoefe-karte.tsx', 'src/components/settings/standort-karte.tsx']
/** Wo eine Leaflet-Karte entsteht: L.map(…) bzw. new L.Map(…). */
const KARTE_ENTSTEHT = /\bL\.map\(|new\s+L\.Map\(/

describe('genau zwei Leaflet-Karten, beide am gemeinsamen Hook', () => {
  it('nur die beiden bekannten Dateien legen eine Karte an', () => {
    const mitKarte = alleDateien('src').filter((d) => KARTE_ENTSTEHT.test(code(d)))
    expect(mitKarte.sort()).toEqual([...KARTEN].sort())
    // Gegenprobe: das Muster erkennt beide Schreibweisen.
    expect(KARTE_ENTSTEHT.test('const m = L.map(div, {})')).toBe(true)
    expect(KARTE_ENTSTEHT.test('const m = new L.Map(div)')).toBe(true)
  })

  for (const datei of KARTEN) {
    it(`${datei}: Größenwechsel über useKartenGroesse, ohne Leaflets eigenes window-resize`, () => {
      const text = code(datei)
      expect(text).toMatch(/import \{ useKartenGroesse \} from '@\/components\/karte\/use-karten-groesse'/)
      expect(text).toMatch(/\buseKartenGroesse\(/)
      expect(text).toMatch(/trackResize:\s*false/)
      // Kein zweiter Beobachter daneben.
      expect(text).not.toMatch(/new ResizeObserver|invalidateSize\(/)
    })

    it(`${datei}: Attribution ohne Präfix, Kacheln und Attribution aus einer Quelle`, () => {
      const text = code(datei)
      expect(text).toMatch(/\.setPrefix\(false\)/)
      expect(text).toMatch(/L\.tileLayer\(KARTEN_KACHELN\.url, \{\s*maxZoom: KARTEN_KACHELN\.maxZoom,\s*attribution: KARTEN_KACHELN\.attribution,?\s*\}\)/)
      expect(text).not.toContain('tile.openstreetmap.org')
    })
  }

  it('der Hook beobachtet den Kartencontainer und ruft invalidateSize', () => {
    const hook = code('src/components/karte/use-karten-groesse.ts')
    expect(hook).toMatch(/new ResizeObserver\(/)
    expect(hook).toMatch(/\.observe\(/)
    expect(hook).toMatch(/\.invalidateSize\(/)
    expect(hook).toMatch(/\.disconnect\(\)/)
  })

  it('die Hofübersicht passt die Übersicht nur neu ein, solange die Nutzerin nichts bewegt hat', () => {
    const karte = code('src/components/hoefe/hoefe-karte.tsx')
    expect(karte).toMatch(/nutzerinHatBewegt/)
    expect(karte).toMatch(/on\('movestart zoomstart'/)
  })

  it('die Standortkarte hält beim Größenwechsel genau die Mitte von vorher (der feste Pin)', () => {
    const karte = code('src/components/settings/standort-karte.tsx')
    expect(karte).toMatch(/useKartenGroesse\(kartenDiv, karte, merker, \(\{ mitte, zoom \}\) =>/)
    expect(karte).toMatch(/setView\(mitte, zoom, \{ animate: false \}\)/)
    // Eigene Sprünge und der Größenwechsel laufen still: Sie füllen weder das Formular noch die Adresse.
    expect(karte).toMatch(/if \(merker\.istStill\) return/)
  })
})

describe('Platzhalter beim Nachladen', () => {
  it('rendert „Karte lädt …" mit aria-busy, nur Tokens, Puls nur auf der Fläche', () => {
    const html = renderToStaticMarkup(createElement(KarteLaedt))
    expect(html).toContain(KARTE_LAEDT)
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('bg-muted')
    expect(html).toContain('text-muted-foreground')
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgb|hsl|oklch)\(/)
    // Der Text pulsiert nicht mit (sonst fiele sein Kontrast in der Animation ab).
    expect(html).toMatch(/<div aria-hidden="true" class="[^"]*animate-pulse[^"]*"><\/div>/)
  })

  it('übernimmt die Größe der Karte, an deren Stelle er steht', () => {
    const html = renderToStaticMarkup(createElement(KarteLaedt, { className: 'h-[280px] rounded-xl' }))
    expect(html).toContain('h-[280px] rounded-xl')
  })

  it('beide Karten laden mit diesem Platzhalter nach, ohne Server-Rendern', () => {
    const client = code('src/components/hoefe/hoefe-client.tsx')
    expect(client).toMatch(/dynamic\(\(\) => import\('@\/components\/hoefe\/hoefe-karte'\), \{\s*ssr: false,\s*loading: \(\) => <KarteLaedt \/>,?\s*\}\)/)
    const profil = code('src/components/settings/profile-form.tsx')
    expect(profil).toMatch(/dynamic\(\(\) => import\('@\/components\/settings\/standort-karte'\), \{\s*ssr: false,\s*loading: \(\) => <KarteLaedt className=\{STANDORT_KARTE_RAHMEN\} \/>,?\s*\}\)/)
    // Die Karte selbst nimmt dieselbe Größe — eine Quelle.
    expect(code('src/components/settings/standort-karte.tsx')).toContain('STANDORT_KARTE_RAHMEN')
  })

  it('Gegenprobe: ohne loading erkennt die Suche den alten Einbau', () => {
    const alt = "const HoefeKarte = dynamic(() => import('@/components/hoefe/hoefe-karte'), { ssr: false })"
    expect(alt).not.toMatch(/loading: \(\) => <KarteLaedt/)
  })
})
