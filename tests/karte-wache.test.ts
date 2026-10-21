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
const ohneKommentare = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
const code = (pfad: string) => ohneKommentare(quelle(pfad))

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

  it('die Pins gruppieren für die Zoomstufe der Karte, nie für einen gemerkten Wert (Runde 1)', () => {
    const karte = code('src/components/hoefe/hoefe-karte.tsx')
    // Die Punkte sind die Höfe — mit Namen oder ohne (Register N22), immer für die aktuelle Zoomstufe.
    expect(karte).toMatch(/gruppierePins\(punkte, map\.getZoom\(\)\)/)
    expect(karte).toMatch(/const punkte = mitNamen \? hoefe : hoefe\.map\(/)
    // Jedes zoomend zählt — auch eines, das auf der Ausgangsstufe endet.
    expect(karte).toMatch(/on\('zoomend', \(\) => setZoomEnden\(\(n\) => n \+ 1\)\)/)
    // Gegenprobe: der alte Weg über die gemerkte Stufe fiele auf.
    expect('gruppierePins(punkte, zoomStufe ?? map.getZoom())').not.toMatch(/gruppierePins\(punkte, map\.getZoom\(\)\)/)
  })

  it('die Trefferfläche hat EINE Zahl für Marke und Gruppierung, rund wie das Bild (Runde 1)', () => {
    const karte = code('src/components/hoefe/hoefe-karte.tsx')
    expect(karte).toMatch(/const \{ breite: b, hoehe: h \} = trefferMasse\(breite, hoehe\)/)
    expect(karte).not.toMatch(/\b44\b/)
    // Rund: der Rahmen der Marke (Leaflets Element) und die Fläche darin.
    expect(karte).toMatch(/className: TREFFER_RUNDUNG/)
    expect(karte).toMatch(/const TREFFER_RUNDUNG = 'rounded-full'/)
    expect(karte).toContain('border-radius:9999px;display:flex')
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

// Nr. 120 (Register N22): Pins per Tab, Enter wie Klick, die Vorschau am Computer.
// Ohne DOM lässt sich das Verhalten nicht ausführen — die Wache hält die Verdrahtung fest.
// Die Abgleiche stehen in EINER Funktion, damit die Gegenprobe dieselben Abgleiche
// gegen Abwandlungen des echten Quelltexts laufen lässt, nicht gegen ein Literal (Runde 1).
const KARTE = 'src/components/hoefe/hoefe-karte.tsx'

/** Was an der Tastatur- und Vorschau-Verdrahtung fehlt; leer = alles da. Kommentare zählen nicht. */
function pruefeKarteTastatur(text: string): string[] {
  const karte = ohneKommentare(text)
  const anzahl = (muster: RegExp) => karte.match(muster)?.length ?? 0
  const fehlt: string[] = []
  if (anzahl(/keyboard: true/g) !== 2) fehlt.push('Pin und Gruppen-Pin mit keyboard: true')
  // Nur der eigene Hof der Umfeld-Karte bleibt ohne Tab — er ist nicht antippbar.
  if (anzahl(/keyboard: false/g) !== 1) fehlt.push('genau ein Pin mit keyboard: false')
  if (anzahl(/e\.key !== 'Enter' && e\.key !== ' '/g) !== 2) fehlt.push('Enter und Leertaste an Pin und Gruppen-Pin')
  for (const ereignis of ['mouseenter', 'mouseleave', 'focus', 'blur']) {
    if (!karte.includes(`addEventListener('${ereignis}'`)) fehlt.push(`addEventListener('${ereignis}')`)
  }
  if (!/const VORSCHAU_NACHLAUF_MS = 300\b/.test(karte)) fehlt.push('Nachlauf 300 ms')
  if (!/if \(e\.key === 'Escape'\) vorschauZu\(\)/.test(karte)) fehlt.push('Escape schließt die Vorschau')
  if (!karte.includes("setAttribute('aria-describedby', vorschauId)")) fehlt.push('aria-describedby am Pin')
  if (!/if \(fokusPin === pin\.slug\) element\.focus\(\{ preventScroll: true \}\)/.test(karte)) fehlt.push('Fokus zurück an den Pin')
  return fehlt
}

/** Entfernt genau die eine Zeile, die `teil` enthält — sonst wäre die Abwandlung nicht eindeutig. */
function ohneZeile(text: string, teil: string): string {
  const zeilen = text.split('\n')
  expect(zeilen.filter((z) => z.includes(teil)), teil).toHaveLength(1)
  return zeilen.filter((z) => !z.includes(teil)).join('\n')
}

describe('Pins per Tastatur und die Vorschau am Computer', () => {
  const echt = quelle(KARTE)

  it('Pins per Tab, Enter und Leertaste wie ein Klick, Vorschau bei Zeiger und Fokus, Escape oder 300 ms', () => {
    expect(pruefeKarteTastatur(echt)).toEqual([])
    expect(code('src/components/hoefe/hof-kurzkarte.tsx')).toContain('role="tooltip"')
  })

  // Gegenprobe am echten Quelltext: Jede Abwandlung muss mindestens einen Fehler liefern.
  const abwandlungen: Record<string, (text: string) => string> = {
    'keyboard: true wird keyboard: false': (t) => t.replace('keyboard: true', 'keyboard: false'),
    'Escape-Zweig entfernt': (t) => ohneZeile(t, "if (e.key === 'Escape') vorschauZu()"),
    'Nachlauf 500 statt 300 ms': (t) => t.replace('VORSCHAU_NACHLAUF_MS = 300', 'VORSCHAU_NACHLAUF_MS = 500'),
    "addEventListener('focus' entfernt": (t) => ohneZeile(t, "addEventListener('focus'"),
    'Fokus zurück an den Pin entfernt': (t) => ohneZeile(t, 'element.focus({ preventScroll: true })'),
  }
  for (const [name, abwandeln] of Object.entries(abwandlungen)) {
    it(`Gegenprobe: ${name} fällt auf`, () => {
      const abgewandelt = abwandeln(echt)
      expect(abgewandelt).not.toBe(echt)
      expect(pruefeKarteTastatur(abgewandelt).length).toBeGreaterThan(0)
    })
  }
})

// Nr. 127 (Regelvorschlag 120, freigegeben 20.10.2026): /hoefe ist statisch (5 min Zwischenspeicher, Register N19).
// Eine Zeitangabe aus der Uhr des Servers ist dort bis zum nächsten Rendern falsch — Zeitlogik nur über `useUhr`.
const UHR_DATEI = 'src/components/hoefe/use-uhr.ts'
/** Die Uhr ablesen: `new Date()` ohne Argument und `Date.now()`. `new Date(wert)` wandelt nur um. */
const UHR_ABLESEN = /\bnew\s+Date\(\s*\)|\bDate\.now\s*\(/

/** Dateien unter `src/components/hoefe/`, die die Uhr direkt ablesen (Kommentare zählen nicht). */
function liestUhrDirekt(dateien: Array<{ pfad: string; text: string }>): string[] {
  return dateien.filter((d) => UHR_ABLESEN.test(ohneKommentare(d.text))).map((d) => d.pfad).sort()
}

describe('Zeit in src/components/hoefe nur über useUhr (Nr. 120)', () => {
  it('new Date() und Date.now() stehen dort nur in use-uhr.ts', () => {
    const dateien = alleDateien('src/components/hoefe').map((pfad) => ({ pfad, text: quelle(pfad) }))
    expect(dateien.length).toBeGreaterThan(5)
    expect(liestUhrDirekt(dateien)).toEqual([UHR_DATEI])
  })

  it('Gegenprobe: das Muster findet beide Schreibweisen, auch in einer neuen Datei', () => {
    const neu = (text: string) => liestUhrDirekt([{ pfad: 'src/components/hoefe/neu.tsx', text }, { pfad: UHR_DATEI, text: 'Date.now()' }])
    expect(neu('const jetzt = new Date()')).toEqual(['src/components/hoefe/neu.tsx', UHR_DATEI])
    expect(neu('const t = Date.now()')).toEqual(['src/components/hoefe/neu.tsx', UHR_DATEI])
    expect(neu('const jetzt = new  Date( )')).toContain('src/components/hoefe/neu.tsx')
  })

  it('Gegenprobe: Umwandlung mit Argument und Kommentare schlagen nicht an', () => {
    const neu = (text: string) => liestUhrDirekt([{ pfad: 'src/components/hoefe/neu.tsx', text }])
    expect(neu('const d = new Date(iso)')).toEqual([])
    expect(neu('// nie new Date() beim Rendern\nconst x = 1')).toEqual([])
    expect(neu('/* Date.now() */ const x = 1')).toEqual([])
  })
})
