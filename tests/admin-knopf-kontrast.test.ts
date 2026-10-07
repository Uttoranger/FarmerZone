/**
 * Der Knopf „Ablehnen & löschen" in der Admin-Hofliste erreicht ≥ 4,5:1 in
 * beiden Themes (Nr. 19b, Morgenbericht Lauf 4 §7: vorher 4,27:1).
 *
 * Der Knopf ist ein Umriss-Knopf mit roter Schrift. Seine Fläche war im
 * Hellen `bg-background` (Crème) — darauf erreicht `--destructive` nur
 * 4,27:1. Jetzt liegt die Schrift in beiden Themes und auch beim Darüberfahren
 * auf `bg-card`. Geprüft wird beides am Quelltext: welche Tokens der Knopf
 * nimmt (Architektur-Regel mit Gegenprobe) und dass genau dieses Paar in
 * `globals.css` den Kontrast hält.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { kontrast, leseOklch, oklchZuHex } from '@/lib/farbraum'

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
const liste = readFileSync(join(process.cwd(), 'src/app/admin/admin-farm-list.tsx'), 'utf8')

/** Der CSS-Block zu einem Selektor — bis zur ersten schließenden Klammer am Zeilenanfang. */
function block(selektor: string): string {
  const start = css.indexOf(`${selektor} {`)
  expect(start, `Block „${selektor}" fehlt`).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('\n}', start))
}

/** Der Hexwert einer shadcn-Variable (`--card`, `--destructive` …) in einem Block. */
function farbe(selektor: string, variable: string): string {
  const treffer = block(selektor).match(new RegExp(`\\n\\s*--${variable}:\\s*([^;]+);`))
  expect(treffer, `${selektor} --${variable}`).not.toBeNull()
  const oklch = leseOklch(treffer![1].trim())
  expect(oklch, `${selektor} --${variable} ist kein oklch`).not.toBeNull()
  return oklchZuHex(oklch!)
}

/** Die Klassen des Knopfs, der genau diesen Text trägt. */
function klassenDesKnopfs(text: string): string[] {
  const ende = liste.indexOf(text)
  expect(ende, `Knopf „${text}" fehlt`).toBeGreaterThan(-1)
  const anfang = liste.lastIndexOf('<Button', ende)
  const klassen = liste.slice(anfang, ende).match(/className="([^"]+)"/)
  expect(klassen, `className am Knopf „${text}"`).not.toBeNull()
  return klassen![1].split(/\s+/)
}

const HELL = ':root'
const DUNKEL = '[data-theme="dark"]'

describe('„Ablehnen & löschen" — Kontrast in beiden Themes', () => {
  const klassen = klassenDesKnopfs('Ablehnen &amp; löschen')

  it('rote Schrift auf der Kartenfläche — im Hellen, im Dunkeln und beim Darüberfahren', () => {
    expect(klassen).toContain('text-destructive')
    expect(klassen).toContain('bg-card')
    expect(klassen).toContain('dark:bg-card')
    expect(klassen).toContain('hover:bg-card')
    expect(klassen).toContain('dark:hover:bg-card')
    // Keine andere Fläche, keine Hexfarbe, kein Ad-hoc-Wert.
    expect(klassen.filter((k) => /(^|:)bg-/.test(k) && !k.endsWith('bg-card'))).toEqual([])
    expect(klassen.join(' ')).not.toMatch(/#[0-9a-f]{3,6}|\[/i)
  })

  it('--destructive auf --card hält ≥ 4,5:1 in beiden Themes', () => {
    expect(kontrast(farbe(HELL, 'destructive'), farbe(HELL, 'card')), 'hell').toBeGreaterThanOrEqual(4.5)
    expect(kontrast(farbe(DUNKEL, 'destructive'), farbe(DUNKEL, 'card')), 'dunkel').toBeGreaterThanOrEqual(4.5)
  })

  it('Gegenprobe: die Messung fängt den alten Zustand (rote Schrift auf Crème) — unter 4,5:1', () => {
    // Der helle Wert von --destructive vor Register O1 (Nr. 28); seitdem hält
    // das Token selbst 4,5:1 auch auf Crème (tests/fehler-farbe-kontrast.test.ts).
    const vorO1 = oklchZuHex({ l: 0.577, c: 0.245, h: 27.325 })
    expect(kontrast(vorO1, farbe(HELL, 'background'))).toBeLessThan(4.5)
  })
})
