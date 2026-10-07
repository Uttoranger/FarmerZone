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
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hexZuOklch, kontrast, leseHex, leseOklch, oklchZuHex, type Oklch } from '@/lib/farbraum'

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
const NEU = ':root:is([data-design="neu"], :has([data-design="neu"]))'

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

/** `color-mix(in oklch, a w, b)` — wie der Browser `--muted`/`--secondary` im neuen Design mischt (kürzerer Farbwinkel). */
function mischeOklch(a: Oklch, b: Oklch, anteilA: number): string {
  let dh = b.h - a.h
  if (dh > 180) dh -= 360
  if (dh < -180) dh += 360
  return oklchZuHex({
    l: a.l * anteilA + b.l * (1 - anteilA),
    c: a.c * anteilA + b.c * (1 - anteilA),
    h: (a.h + dh * (1 - anteilA) + 360) % 360,
  })
}

/**
 * Eine halbdurchsichtige Fläche (`bg-destructive/10`) über dem Grund — der
 * Browser legt sie im gamma-kodierten sRGB übereinander, Kanal für Kanal.
 */
function ueberlagere(vorne: string, hinten: string, alpha: number): string {
  const v = leseHex(vorne)
  const h = leseHex(hinten)
  if (!v || !h) throw new Error(`Kein Hexwert: ${vorne} / ${hinten}`)
  const kanal = (x: string, i: number) => parseInt(x.slice(i, i + 2), 16)
  return `#${[1, 3, 5]
    .map((i) => Math.round(kanal(v, i) * alpha + kanal(h, i) * (1 - alpha)).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase()
}

/** Die Gründe je Theme, auf denen Fehlertext steht: Bestand (shadcn-Werte) und neues Design (--fz-Tokens). */
function gruende(selektor: string): [string, string][] {
  const neuMuted = mischeOklch(hexZuOklch(farbe(selektor, 'fz-surface')), hexZuOklch(farbe(selektor, 'fz-border')), 0.6)
  return [
    ['Bestand Grund', farbe(selektor, 'background')],
    ['Bestand Karte', farbe(selektor, 'card')],
    ['Bestand muted', farbe(selektor, 'muted')],
    ['Bestand secondary', farbe(selektor, 'secondary')],
    ['neu Grund', farbe(selektor, 'fz-bg')],
    ['neu Karte', farbe(selektor, 'fz-surface')],
    // Im neuen Design sind muted und secondary dieselbe Mischung (globals.css, Geltungsbereich).
    ['neu muted/secondary', neuMuted],
  ]
}

/** Ohne Tönung, Fläche `/10` (Knopf, Badge, Hinweise) und `/20` (Darüberfahren, Badge im Dunkeln). */
const TOENUNGEN = [0, 0.1, 0.2] as const

describe('O1 — Fehler-Farbe mit mindestens 4,5:1 in beiden Themes', () => {
  for (const [modus, selektor] of [
    ['hell', HELL],
    ['dunkel', DUNKEL],
  ] as const) {
    it(`${modus}: Fehlertext auf jedem Grund, ungetönt und mit roter Tönung /10 und /20`, () => {
      const rot = farbe(selektor, 'destructive')
      for (const [name, grund] of gruende(selektor)) {
        for (const alpha of TOENUNGEN) {
          const flaeche = alpha === 0 ? grund : ueberlagere(rot, grund, alpha)
          const wert = kontrast(rot, flaeche)
          expect(wert, `${modus} ${name} /${alpha * 100}: ${wert.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
        }
      }
    })
  }

  it('die Mischung für muted/secondary im neuen Design ist die, mit der hier gerechnet wird', () => {
    const neu = block(NEU)
    expect(neu).toMatch(/--muted:\s*color-mix\(in oklch, var\(--fz-surface\) 60%, var\(--fz-border\)\);/)
    expect(neu).toMatch(/--secondary:\s*color-mix\(in oklch, var\(--fz-surface\) 60%, var\(--fz-border\)\);/)
  })

  it('keine Stelle tönt stärker als /20 rot — sonst deckt diese Rechnung sie nicht ab', () => {
    const toenungen: string[] = []
    const lies = (ordner: string): void => {
      for (const eintrag of readdirSync(join(process.cwd(), ordner), { withFileTypes: true })) {
        const pfad = `${ordner}/${eintrag.name}`
        if (eintrag.isDirectory()) lies(pfad)
        else if (/\.tsx?$/.test(eintrag.name)) {
          for (const m of readFileSync(join(process.cwd(), pfad), 'utf8').matchAll(/bg-destructive\/(\d+)/g)) {
            if (Number(m[1]) > 20) toenungen.push(`${pfad}: ${m[0]}`)
          }
        }
      }
    }
    lies('src')
    expect(toenungen).toEqual([])
    // Gegenprobe: Die Suche fände den früheren Hover im Dunkeln.
    expect([...'dark:hover:bg-destructive/30'.matchAll(/bg-destructive\/(\d+)/g)].map((m) => Number(m[1]))).toEqual([30])
  })

  it('der neue Geltungsbereich ordnet --destructive nicht um — es gilt der Wert des Themes', () => {
    expect(block(':root:is([data-design="neu"], :has([data-design="neu"]))')).not.toMatch(/--destructive:/)
  })

  it('Tailwind kennt die Farbe nur über das Token (text-destructive)', () => {
    expect(css).toMatch(/--color-destructive:\s*var\(--destructive\);/)
  })

  it('Gegenprobe: die alten Werte fielen durch — ungetönt bzw. auf getöntem Grund', () => {
    const alt = oklchZuHex({ l: 0.577, c: 0.245, h: 27.325 })
    expect(kontrast(alt, farbe(HELL, 'fz-bg'))).toBeLessThan(4.5)
    // Stand nach Runde 0 (#C91018): ungetönt gut, mit Hover /20 auf Crème nur 3,69.
    const runde0 = oklchZuHex({ l: 0.53, c: 0.21, h: 27.325 })
    expect(kontrast(runde0, ueberlagere(runde0, farbe(HELL, 'fz-bg'), 0.2))).toBeLessThan(4.5)
    // Dunkel vorher (#FF6467): auf muted mit /20 nur 4,13.
    const dunkelAlt = oklchZuHex({ l: 0.704, c: 0.191, h: 22.216 })
    expect(kontrast(dunkelAlt, ueberlagere(dunkelAlt, farbe(DUNKEL, 'muted'), 0.2))).toBeLessThan(4.5)
  })
})
