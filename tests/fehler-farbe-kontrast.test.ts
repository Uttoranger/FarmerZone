/**
 * Register O1 (entschieden 07.10.2026, Nr. 28): Die Fehler-Farbe
 * (`--destructive`, im Code `text-destructive`) erreicht in BEIDEN Themes
 * mindestens 4,5:1 — auf dem Seitengrund und auf Karten, im Bestand und im
 * Geltungsbereich des neuen Designs.
 *
 * Gerechnet wird aus den Token-Werten in `src/app/globals.css`, nicht aus
 * einer abgeschriebenen Tabelle: Wer das Token oder einen Grund ändert, sieht
 * hier sofort, ob der Fehlertext noch lesbar ist. Vorher lag der helle Wert
 * bei 4,22:1 auf dem Grund des neuen Designs (#F4F1E7) — deshalb zeigten
 * neue Seiten Fehler bisher orange (`text-status-offen`).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { kontrast, leseOklch, oklchZuHex } from '@/lib/farbraum'

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

const HELL = ':root'
const DUNKEL = '[data-theme="dark"]'

/** Der CSS-Block zu einem Selektor — bis zur ersten schließenden Klammer am Zeilenanfang. */
function block(selektor: string): string {
  const start = css.indexOf(`${selektor} {`)
  expect(start, `Block „${selektor}" fehlt`).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('\n}', start))
}

/** Der Hexwert einer Variable (`--destructive`, `--fz-bg` …) in einem Block, aus dem oklch-Wert gerechnet. */
function farbe(selektor: string, variable: string): string {
  const treffer = new RegExp(`\\n\\s*--${variable}:\\s*([^;]+);`).exec(block(selektor))
  if (!treffer) throw new Error(`fehlt: ${selektor} --${variable}`)
  const oklch = leseOklch(treffer[1].trim())
  if (!oklch) throw new Error(`${selektor} --${variable} ist kein oklch: ${treffer[1]}`)
  return oklchZuHex(oklch)
}

/** Seitengrund und Kartenfläche je Theme — Bestand (shadcn-Werte) und neues Design (--fz-Tokens). */
const GRUENDE = [
  ['Bestand Grund', 'background'],
  ['Bestand Karte', 'card'],
  ['neu Grund', 'fz-bg'],
  ['neu Karte', 'fz-surface'],
] as const

describe('O1 — Fehler-Farbe mit mindestens 4,5:1 in beiden Themes', () => {
  for (const [modus, selektor] of [
    ['hell', HELL],
    ['dunkel', DUNKEL],
  ] as const) {
    for (const [name, grund] of GRUENDE) {
      it(`${modus}: Fehlertext auf ${name}`, () => {
        const wert = kontrast(farbe(selektor, 'destructive'), farbe(selektor, grund))
        expect(wert, `${modus} ${name}: ${wert.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  it('der neue Geltungsbereich ordnet --destructive nicht um — es gilt der Wert des Themes', () => {
    expect(block(':root:is([data-design="neu"], :has([data-design="neu"]))')).not.toMatch(/--destructive:/)
  })

  it('Tailwind kennt die Farbe nur über das Token (text-destructive)', () => {
    expect(css).toMatch(/--color-destructive:\s*var\(--destructive\);/)
  })

  it('Gegenprobe: der alte helle Wert fiel auf dem Grund des neuen Designs durch', () => {
    const alt = oklchZuHex({ l: 0.577, c: 0.245, h: 27.325 })
    expect(kontrast(alt, farbe(HELL, 'fz-bg'))).toBeLessThan(4.5)
  })
})
