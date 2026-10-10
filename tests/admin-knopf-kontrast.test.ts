/**
 * Der Knopf „Ablehnen" an einem wartenden Hof erreicht ≥ 4,5:1 in beiden
 * Themes.
 *
 * Verlauf: Nr. 19b hob „Ablehnen & löschen" auf 4,5:1 (rote Schrift lag auf
 * Crème bei 4,27:1 und wanderte auf die Kartenfläche). Seit Nr. 22f steht der
 * Admin in der AdminShell (data-design="neu"): „Ablehnen" ist ein
 * Umriss-Knopf (KNOPF_RAHMEN) mit normaler Textfarbe auf der Karte; die
 * zerstörende Bestätigung („Endgültig löschen") steht erst im Dialog, als
 * Orange-Umriss (DESIGN_SYSTEM „Dialoge und Blätter"). Geprüft wird am
 * Quelltext, welche Klassen der Knopf nimmt (mit Gegenprobe), und an den
 * Tokens in globals.css, dass genau dieses Paar den Kontrast hält.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { kontrast, leseOklch, oklchZuHex } from '@/lib/farbraum'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
const ansicht = readFileSync(join(process.cwd(), 'src/components/admin/hoefe-ansicht.tsx'), 'utf8')

function block(selektor: string): string {
  const start = css.indexOf(`${selektor} {`)
  expect(start, `Block „${selektor}" fehlt`).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('\n}', start))
}

function farbe(selektor: string, variable: string): string {
  const treffer = block(selektor).match(new RegExp(`\\n\\s*--${variable}:\\s*([^;]+);`))
  expect(treffer, `${selektor} --${variable}`).not.toBeNull()
  const oklch = leseOklch(treffer![1].trim())
  expect(oklch, `${selektor} --${variable} ist kein oklch`).not.toBeNull()
  return oklchZuHex(oklch!)
}

/** Die Klassen-Angabe des Knopfs, der genau diesen Text trägt (`className={…}` oder `className="…"`). */
function klassenDesKnopfs(quelle: string, text: string): string {
  const ende = quelle.indexOf(`>\n          ${text}\n`)
  expect(ende, `Knopf „${text}" fehlt`).toBeGreaterThan(-1)
  const anfang = quelle.lastIndexOf('<button', ende)
  const klassen = quelle.slice(anfang, ende).match(/className=\{([^}]+)\}|className="([^"]+)"/)
  expect(klassen, `className am Knopf „${text}"`).not.toBeNull()
  return (klassen![1] ?? klassen![2]).trim()
}

const HELL = ':root'
const DUNKEL = '[data-theme="dark"]'

describe('„Ablehnen" — Kontrast in beiden Themes', () => {
  it('der Knopf ist ein Umriss-Knopf in normaler Textfarbe, ohne eigene Fläche und ohne rote Schrift', () => {
    expect(klassenDesKnopfs(ansicht, 'Ablehnen')).toBe('KNOPF_RAHMEN')
    const klassen = KNOPF_RAHMEN.split(/\s+/)
    expect(klassen).toContain('text-foreground')
    expect(klassen).toContain('border-border')
    expect(klassen.filter((k) => /^bg-/.test(k))).toEqual([])
    expect(klassen.join(' ')).not.toMatch(/destructive|#[0-9a-f]{3,6}/i)
  })

  it('Textfarbe auf der Kartenfläche hält ≥ 4,5:1 in beiden Themes (Tokens des neuen Designs)', () => {
    expect(kontrast(farbe(HELL, 'fz-text'), farbe(HELL, 'fz-surface')), 'hell').toBeGreaterThanOrEqual(4.5)
    expect(kontrast(farbe(DUNKEL, 'fz-text'), farbe(DUNKEL, 'fz-surface')), 'dunkel').toBeGreaterThanOrEqual(4.5)
  })

  it('Gegenprobe: die Messung fängt den alten Zustand (rote Schrift auf Crème) — unter 4,5:1', () => {
    // Der helle Wert von --destructive vor Register O1 (Nr. 28); seitdem hält
    // das Token selbst 4,5:1 auch auf Crème (tests/fehler-farbe-kontrast.test.ts).
    const vorO1 = oklchZuHex({ l: 0.577, c: 0.245, h: 27.325 })
    expect(kontrast(vorO1, farbe(HELL, 'background'))).toBeLessThan(4.5)
  })

  it('Gegenprobe: die Suche findet den Knopf nur mit genau diesem Text', () => {
    expect(() => klassenDesKnopfs(ansicht, 'Ablehnen & löschen')).toThrow()
  })
})
