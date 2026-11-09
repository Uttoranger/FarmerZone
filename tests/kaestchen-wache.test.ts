/**
 * Kästchen-Wache (A-8, Morgenbericht 32 A, freigegeben 7.11.2026; Nr. 269).
 *
 * Ursache: Kästchen standen als natives `<input type="checkbox">` mit `accent-primary` in 20 Dateien, ohne eigenes
 * Token und ohne Baustein — Rand, Fläche und Haken hingen am Browser und an `primary` (im Hofbereich Orange). Seit
 * Nr. 269 gibt es `Kaestchen` (src/components/ui/kaestchen.tsx) mit eigenen Tokens.
 *
 * Beweist (Quelltext von `src/`, Kommentare zählen nicht): `type="checkbox"` steht außer im Baustein selbst nur in
 * Dateien der Bestandsliste (tests/bestandslisten/kaestchen.ts); eine Datei der Liste ohne Treffer fällt als
 * veraltet auf (die Liste schrumpft nur); die Liste ist nie länger als der Startbestand von 20 Dateien.
 *
 * Gegenprobe: Text-Attrappen — das Attribut in JSX und als Objekt-Eigenschaft schlägt an, der Baustein, ein anderer
 * Typ und ein Kommentar nicht; im echten Baum findet die Suche die Liste.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { KAESTCHEN_BESTAND } from './bestandslisten/kaestchen'

const WURZEL = process.cwd()

/** Der Baustein selbst zeichnet das eine native Kästchen. */
const BAUSTEIN = 'src/components/ui/kaestchen.tsx'

/** Startbestand beim Start von Nr. 269 (`git grep -l 'type="checkbox"' src/`, 8.11.2026). */
const STARTBESTAND = 20

function* dateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* dateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

const ohneKommentare = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/** Zeichnet ein Text ein eigenes Kästchen? Als JSX-Attribut oder als Eigenschaft (`type: 'checkbox'`). */
function zeichnetKaestchen(text: string): boolean {
  const code = ohneKommentare(text)
  return /\btype\s*=\s*\{?\s*["'`]checkbox["'`]/.test(code) || /\btype\s*:\s*["'`]checkbox["'`]/.test(code)
}

const funde = new Set<string>()
for (const pfad of dateien(join(WURZEL, 'src'))) {
  const datei = relative(WURZEL, pfad).split(sep).join('/')
  if (datei === BAUSTEIN) continue
  if (zeichnetKaestchen(readFileSync(pfad, 'utf8'))) funde.add(datei)
}

describe('Kästchen nur noch über den Baustein (A-8)', () => {
  it('keine neue Datei zeichnet ein eigenes Kästchen — neue Kästchen nehmen Kaestchen aus ui/kaestchen.tsx', () => {
    const neu = [...funde].filter((datei) => !KAESTCHEN_BESTAND.includes(datei))
    expect(neu, 'Statt <input type="checkbox"> den Baustein Kaestchen aus src/components/ui/kaestchen.tsx nehmen').toEqual([])
  })

  it('die Bestandsliste schrumpft nur — eine umgestellte Datei muss heraus', () => {
    const veraltet = KAESTCHEN_BESTAND.filter((datei) => !funde.has(datei))
    expect(veraltet, 'Diese Dateien aus tests/bestandslisten/kaestchen.ts streichen').toEqual([])
    expect(KAESTCHEN_BESTAND.length).toBeLessThanOrEqual(STARTBESTAND)
    expect(new Set(KAESTCHEN_BESTAND).size).toBe(KAESTCHEN_BESTAND.length)
  })

  it('der Baustein selbst zeichnet das native Kästchen', () => {
    expect(zeichnetKaestchen(readFileSync(join(WURZEL, BAUSTEIN), 'utf8'))).toBe(true)
  })

  it('Gegenprobe: JSX-Attribut und Eigenschaft schlagen an, Baustein, andere Typen und Kommentare nicht', () => {
    expect(zeichnetKaestchen('<input type="checkbox" name="a" />')).toBe(true)
    expect(zeichnetKaestchen("<input type={'checkbox'} />")).toBe(true)
    expect(zeichnetKaestchen("const feld = { type: 'checkbox' }")).toBe(true)
    expect(zeichnetKaestchen('<Kaestchen name="a" />')).toBe(false)
    expect(zeichnetKaestchen('<input type="radio" />')).toBe(false)
    expect(zeichnetKaestchen('// früher <input type="checkbox" /> hier')).toBe(false)
    expect(zeichnetKaestchen('/* <input type="checkbox" /> */')).toBe(false)
    expect(funde.size).toBeGreaterThan(0)
  })
})
