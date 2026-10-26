/**
 * Feld-Kontrast-Wache (Nr. 173, WCAG 1.4.3 und 1.4.11).
 *
 * Ursache: Platzhalter standen mit `text-muted-foreground/60` bei 2,45:1 (hell),
 * Feldränder mit `--fz-border` bei 1,29:1, der Schalter aus mit
 * `muted-foreground/30` bei 1,51:1, der Fokus-Halo mit `ring/50` bzw. `/30`
 * bei 2,14:1. Jede Deckkraft hinter einer Textfarbe oder einem Feldrand
 * senkt den gerechneten Kontrast wieder — still, ohne dass ein Test es sieht.
 *
 * Beweist (Quelltext unter src/components/ui, Kommentare zählen nicht):
 *  - Kein `placeholder:`-Text mit Deckkraft (`/60`).
 *  - In den Feld-Bausteinen (Input, Textarea, Select) kein Rand mit Deckkraft
 *    (`border-input/50`, `aria-invalid:border-destructive/50`) und kein
 *    Fokusring mit Deckkraft (`ring-ring/30`).
 *  - Nirgends unter src/components/ui ein `border-input/…`.
 *  - Der Schalter zeichnet den Aus-Zustand in `bg-input` (Feldrand), ohne Deckkraft.
 * Gegenprobe: Text-Attrappen mit den alten Klassen schlagen an.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const UI = join(process.cwd(), 'src/components/ui')
const FELD_BAUSTEINE = ['input.tsx', 'textarea.tsx', 'select.tsx']

const ohneKommentare = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'])\/\/.*$/gm, '$1')

/** Klassen mit Deckkraft, die den Kontrast eines Platzhalters senken. */
function platzhalterMitDeckkraft(text: string): string[] {
  return [...ohneKommentare(text).matchAll(/(?<![\w-])(?:[\w-]+:)*placeholder:text-[\w-]+\/\d+/g)].map((m) => m[0])
}

/** Ränder und Fokusringe mit Deckkraft — in einem Feld-Baustein verboten. */
function feldraenderMitDeckkraft(text: string): string[] {
  return [...ohneKommentare(text).matchAll(/(?<![\w-])(?:[\w-]+:)*(?:border|ring)-(?:input|ring|destructive|border)\/\d+/g)]
    .map((m) => m[0])
    // Der Fehler-Halo ist eine Tönung um den vollen roten Rand, nicht der Rand selbst.
    .filter((k) => !/aria-invalid:ring-destructive\/\d+$/.test(k))
}

const lies = (datei: string): string => readFileSync(join(UI, datei), 'utf8')

describe('Gegenprobe', () => {
  it('die alten Klassen schlagen an', () => {
    expect(platzhalterMitDeckkraft('"h-9 placeholder:text-muted-foreground/60 px-3"')).toEqual(['placeholder:text-muted-foreground/60'])
    expect(feldraenderMitDeckkraft('"focus-visible:ring-ring/30 dark:aria-invalid:border-destructive/50 border-input/40"')).toEqual([
      'focus-visible:ring-ring/30',
      'dark:aria-invalid:border-destructive/50',
      'border-input/40',
    ])
  })

  it('volle Klassen, der Fehler-Halo und Kommentare schlagen nicht an', () => {
    expect(platzhalterMitDeckkraft('"placeholder:text-muted-foreground" /* placeholder:text-x/60 */')).toEqual([])
    expect(feldraenderMitDeckkraft('"border-input focus-visible:ring-ring aria-invalid:ring-destructive/20"')).toEqual([])
  })
})

describe('Platzhalter und Feldränder ohne Transparenz', () => {
  const dateien = readdirSync(UI).filter((d) => d.endsWith('.tsx') || d.endsWith('.ts'))

  it('kein Platzhalter mit Deckkraft unter src/components/ui', () => {
    expect(dateien.flatMap((d) => platzhalterMitDeckkraft(lies(d)).map((k) => `${d}: ${k}`))).toEqual([])
  })

  it.each(FELD_BAUSTEINE)('%s: kein Rand und kein Fokusring mit Deckkraft', (datei) => {
    expect(feldraenderMitDeckkraft(lies(datei))).toEqual([])
  })

  it('nirgends unter src/components/ui ein Feldrand mit Deckkraft', () => {
    expect(dateien.filter((d) => /(?<![\w-])(?:[\w-]+:)*border-input\/\d+/.test(ohneKommentare(lies(d))))).toEqual([])
  })

  it('der Schalter zeichnet aus in bg-input, nicht mehr in muted-foreground/30', () => {
    const schalter = ohneKommentare(lies('switch.tsx'))
    expect(schalter).toMatch(/(?<![\w:-])bg-input(?![\w/-])/)
    expect(schalter).not.toMatch(/bg-muted-foreground\/\d+/)
  })
})
