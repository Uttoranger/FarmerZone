/**
 * Umrechnung zwischen Hex (sRGB) und OKLCH — rein, ohne Abhängigkeit.
 *
 * Gebraucht, um die Farbtokens in src/app/globals.css (oklch, CODING_STANDARDS §7)
 * mit der Tabelle in docs/ai/DESIGN_SYSTEM.md (Hex) abzugleichen
 * (tests/design-tokens.test.ts) — und für den Kontrast nach WCAG, den jede
 * Farbwahl in beiden Modi bestehen muss. Formeln und Matrizen der
 * OKLab-Referenz (sRGB, D65).
 */

export type Oklch = { l: number; c: number; h: number }

const HEX = /^#?([0-9a-f]{6})$/i

/** „#abc" oder „abcdef" → „#AABBCC"; null, wenn es kein Hexwert ist. */
export function leseHex(text: string): string | null {
  const kurz = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(text.trim())
  if (kurz) return `#${(kurz[1] + kurz[1] + kurz[2] + kurz[2] + kurz[3] + kurz[3]).toUpperCase()}`
  const lang = HEX.exec(text.trim())
  return lang ? `#${lang[1].toUpperCase()}` : null
}

/** „oklch(0.95 0.01 93)" → { l, c, h }; null, wenn es kein oklch-Ausdruck ist. Prozent und Alpha bleiben außen vor. */
export function leseOklch(text: string): Oklch | null {
  const m = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/i.exec(text.trim())
  if (!m) return null
  return { l: Number(m[1]), c: Number(m[2]), h: Number(m[3]) }
}

function linear(kanal: number): number {
  const c = kanal / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function gamma(linear: number): number {
  const c = Math.min(1, Math.max(0, linear))
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055
  return Math.round(v * 255)
}

export function hexZuOklch(hex: string): Oklch {
  const sauber = leseHex(hex)
  if (!sauber) throw new Error(`Kein Hexwert: ${hex}`)
  const r = linear(parseInt(sauber.slice(1, 3), 16))
  const g = linear(parseInt(sauber.slice(3, 5), 16))
  const b = linear(parseInt(sauber.slice(5, 7), 16))

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s

  const c = Math.hypot(a, bb)
  // Ohne Buntheit ist der Farbwinkel bedeutungslos — 0, damit Grau stabil bleibt.
  const h = c < 1e-4 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360
  return { l: L, c, h }
}

export function oklchZuHex(farbe: Oklch): string {
  const winkel = (farbe.h * Math.PI) / 180
  const a = farbe.c * Math.cos(winkel)
  const bb = farbe.c * Math.sin(winkel)

  const l = (farbe.l + 0.3963377774 * a + 0.2158037573 * bb) ** 3
  const m = (farbe.l - 0.1055613458 * a - 0.0638541728 * bb) ** 3
  const s = (farbe.l - 0.0894841775 * a - 1.291485548 * bb) ** 3

  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s

  const hex = (v: number) => gamma(v).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase()
}

/** Relative Leuchtdichte nach WCAG 2 (0 = Schwarz, 1 = Weiß). */
function leuchtdichte(hex: string): number {
  const sauber = leseHex(hex)
  if (!sauber) throw new Error(`Kein Hexwert: ${hex}`)
  const [r, g, b] = [1, 3, 5].map((i) => linear(parseInt(sauber.slice(i, i + 2), 16)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Kontrastverhältnis nach WCAG 2 (1 bis 21) — Fließtext braucht ≥ 4,5, große Schrift und Symbole ≥ 3. */
export function kontrast(a: string, b: string): number {
  const x = leuchtdichte(a)
  const y = leuchtdichte(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** Größter Abstand je Kanal (0–255) zwischen zwei Hexwerten — für Toleranzen beim Abgleich. */
export function hexAbstand(a: string, b: string): number {
  const x = leseHex(a)
  const y = leseHex(b)
  if (!x || !y) throw new Error(`Kein Hexwert: ${a} / ${b}`)
  let max = 0
  for (const i of [1, 3, 5]) {
    max = Math.max(max, Math.abs(parseInt(x.slice(i, i + 2), 16) - parseInt(y.slice(i, i + 2), 16)))
  }
  return max
}
