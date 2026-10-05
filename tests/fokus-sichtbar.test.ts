/**
 * Sichtbarer Fokus in den neuen Bausteinen und Shells.
 *
 * Altbefund aus der Hof-Navigation (farmer-nav.tsx): `outline-none` zusammen
 * mit `focus-visible:outline-2` zeigt in Tailwind 4 KEINEN Rahmen — die
 * Rahmenart bleibt „none". Abhilfe ist `focus-visible:outline-solid`.
 *
 * Beweist:
 *  - Jede Klassenkette in src/components/ui (Gate-2-Bausteine),
 *    src/components/shells und src/app/intern, die einen Fokusrahmen setzt,
 *    setzt auch die Rahmenart.
 *  - Der gemeinsame Fokusrahmen (fokus.ts) trägt sie.
 *  - Gegenprobe: Die Prüfung erkennt die fehlerhafte Kette des Bestands.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'

/** Klassenketten (in '…', "…" oder `…`), die einen Fokusrahmen setzen, aber keine Rahmenart. */
function rahmenOhneArt(text: string): string[] {
  const ketten = text.match(/(['"`])(?:(?!\1)[^\n])*focus-visible:outline-(?:\d|\[)(?:(?!\1)[^\n])*\1/g) ?? []
  return ketten.filter((kette) => !/focus-visible:outline-(solid|dashed|dotted|double)/.test(kette))
}

const NEUE_BAUSTEINE = [
  'chip', 'stepper', 'segment', 'list-row', 'progress-bar', 'empty-state', 'status-badge',
  'groessenkachel', 'hinweiskarte', 'bottom-nav', 'sidebar-gruppe', 'zaehler', 'fokus',
]

function dateienUnter(ordner: string): string[] {
  const wurzel = join(process.cwd(), ordner)
  const liste: string[] = []
  const suche = (o: string) => {
    for (const name of readdirSync(o)) {
      const p = join(o, name)
      if (statSync(p).isDirectory()) suche(p)
      else if (/\.tsx?$/.test(name)) liste.push(p)
    }
  }
  suche(wurzel)
  return liste
}

describe('Fokusrahmen mit Rahmenart', () => {
  it('der gemeinsame Rahmen trägt outline-solid', () => {
    for (const rahmen of [FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN]) {
      expect(rahmen).toContain('focus-visible:outline-solid')
      expect(rahmenOhneArt(`'${rahmen}'`)).toEqual([])
    }
  })

  it('Bausteine, Shells und Vorschau setzen keinen Fokusrahmen ohne Rahmenart', () => {
    const dateien = [
      ...NEUE_BAUSTEINE.map((n) => join(process.cwd(), 'src/components/ui', `${n}.${n === 'fokus' ? 'ts' : 'tsx'}`)),
      ...dateienUnter('src/components/shells'),
      ...dateienUnter('src/app/intern'),
    ]
    expect(dateien.length).toBeGreaterThan(15)
    for (const datei of dateien) expect(rahmenOhneArt(readFileSync(datei, 'utf8')), datei).toEqual([])
  })

  it('Gegenprobe: die Kette des Bestands fällt auf', () => {
    const bestand = readFileSync(join(process.cwd(), 'src/components/farmer/farmer-nav.tsx'), 'utf8')
    expect(rahmenOhneArt(bestand).length).toBeGreaterThan(0)
    expect(rahmenOhneArt("'outline-none focus-visible:outline-2 focus-visible:outline-ring'")).toHaveLength(1)
  })
})
