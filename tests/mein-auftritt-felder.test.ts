/**
 * „Mein Auftritt" (/settings/appearance, Nr. 32, Morgenbericht Lauf 5 §5):
 * Die Eingabefelder (Bildunterschrift, Beschreibung eines Werts) und der
 * Knopf „Logo hochladen" waren 32 bzw. 36 px hoch — unter dem Touch-Ziel von
 * 44 px (DESIGN_SYSTEM). Wie bei Abholzeiten und Hofprofil (Nr. 22d) nur per
 * Klasse gehoben; die Basiskomponente `Input` bleibt unverändert.
 *
 * Quelltext-Prüfung mit Gegenprobe (TESTING_GUIDELINES: Architektur-Regel am
 * Quelltext): Jedes einzeilige Feld trägt eine Höhe von mindestens 44 px.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const QUELLE = readFileSync(join(process.cwd(), 'src/app/(hof)/settings/appearance/appearance-client.tsx'), 'utf8')
const INPUT = readFileSync(join(process.cwd(), 'src/components/ui/input.tsx'), 'utf8')

/** Höhen-Klassen unter 44 px (Tailwind: h-1 … h-10, size-…, min-h-…). */
const ZU_NIEDRIG = /(?:^|\s)(?:min-)?h-(?:[1-9]|10)(?:\.5)?(?=\s|$)/

/**
 * Die className-Werte aller `<input … />` (nur Zeichenketten-Literale). Bis
 * `/>`, nicht bis zum ersten `>` — ein `onChange={(e) => …}` steht davor.
 */
function feldKlassen(quelle: string): string[] {
  const bloecke = quelle.match(/<input\b[\s\S]*?\/>/g) ?? []
  return bloecke.map((b) => /className="([^"]*)"/.exec(b)?.[1] ?? '')
}

describe('Mein Auftritt — Felder mindestens 44 px', () => {
  it('jedes Eingabefeld hat eine Höhe von mindestens 44 px', () => {
    const felder = feldKlassen(QUELLE).filter((k) => k !== '' && !k.includes('hidden'))
    expect(felder.length).toBeGreaterThanOrEqual(4)
    for (const k of felder) {
      expect(k, k).not.toMatch(ZU_NIEDRIG)
      expect(k, k).toMatch(/(?:^|\s)(?:min-)?h-(?:11|12|14)(?=\s|$)/)
    }
  })

  it('„Logo hochladen" ist mindestens 44 px hoch', () => {
    // Der Knopf öffnet die Dateiauswahl (openFilePicker) — seine Klasse direkt danach.
    const logo = /onClick=\{openFilePicker\}[\s\S]*?className="([^"]*)"/.exec(QUELLE)?.[1]
    expect(logo).toBeDefined()
    expect(logo).not.toMatch(ZU_NIEDRIG)
    expect(logo).toMatch(/(?:^|\s)min-h-11(?=\s|$)/)
  })

  it('Gegenprobe: die Suche erkennt 32- und 36-px-Felder', () => {
    expect('w-full h-8 px-2').toMatch(ZU_NIEDRIG)
    expect('inline-flex h-9 px-4').toMatch(ZU_NIEDRIG)
    expect('w-full h-11 px-3').not.toMatch(ZU_NIEDRIG)
    expect(feldKlassen('<input\n  onChange={(e) => x(e)}\n  className="w-full h-8 px-2"\n/>')).toEqual(['w-full h-8 px-2'])
  })

  it('die Basiskomponente Input bleibt unverändert bei 36 px (nur additiv gehoben)', () => {
    expect(INPUT).toContain('"h-9 w-full min-w-0')
  })
})
