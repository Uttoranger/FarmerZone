/**
 * Die Felder der Abschnitte von Mein Hof — früher „Mein Auftritt"
 * (/settings/appearance, Nr. 32, Morgenbericht Lauf 5 §5), seit Nr. 50 die
 * Bausteine in Mein Hof (bild-bausteine.tsx, abschnitt-formulare.tsx), unter lg
 * im Blatt von unten: Die Eingabefelder (Bildunterschrift, Beschreibung eines
 * Werts, Leitspruch, Name, Adresse, Kontakt) und der Knopf „Logo hochladen"
 * sind Touch-Ziele von mindestens 44 px (DESIGN_SYSTEM). Nur per Klasse
 * gehoben; die Basiskomponente `Input` bleibt unverändert.
 *
 * Quelltext-Prüfung mit Gegenprobe (TESTING_GUIDELINES: Architektur-Regel am
 * Quelltext): Jedes einzeilige Feld trägt eine Höhe von mindestens 44 px.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const BILDER = readFileSync(join(process.cwd(), 'src/components/mein-hof/bild-bausteine.tsx'), 'utf8')
const FORMULARE = readFileSync(join(process.cwd(), 'src/components/mein-hof/abschnitt-formulare.tsx'), 'utf8')
const QUELLE = `${BILDER}\n${FORMULARE}`
const INPUT = readFileSync(join(process.cwd(), 'src/components/ui/input.tsx'), 'utf8')

/** Höhen-Klassen unter 44 px (Tailwind: h-1 … h-10, size-…, min-h-…). */
const ZU_NIEDRIG = /(?:^|\s)(?:min-)?h-(?:[1-9]|10)(?:\.5)?(?=\s|$)/

/**
 * Die className-Werte aller `<input … />` und `<Input … />` (nur
 * Zeichenketten-Literale). Bis `/>`, nicht bis zum ersten `>` — ein
 * `onChange={(e) => …}` steht davor.
 */
function feldKlassen(quelle: string): string[] {
  const bloecke = quelle.match(/<[iI]nput\b[\s\S]*?\/>/g) ?? []
  return bloecke.map((b) => /className="([^"]*)"/.exec(b)?.[1] ?? '')
}

describe('Mein Hof (früher Mein Auftritt) — Felder mindestens 44 px', () => {
  it('jedes Eingabefeld hat eine Höhe von mindestens 44 px', () => {
    const felder = feldKlassen(QUELLE).filter((k) => !k.includes('hidden'))
    // Ein Feld ohne Klasse fiele auf 36 px zurück (Basiskomponente).
    expect(felder).not.toContain('')
    expect(felder.length).toBeGreaterThanOrEqual(9)
    for (const k of felder) {
      expect(k, k).not.toMatch(ZU_NIEDRIG)
      expect(k, k).toMatch(/(?:^|\s)(?:min-)?h-(?:11|12|14)(?=\s|$)/)
    }
  })

  it('„Logo hochladen" und „Fotos hinzufügen" sind mindestens 44 px hoch', () => {
    // Die Knöpfe öffnen die Dateiauswahl (openFilePicker) — ihre Klasse direkt danach.
    const knoepfe = [...BILDER.matchAll(/onClick=\{openFilePicker\}[\s\S]*?className=\{cn\(\s*'([^']*)'/g)].map((m) => m[1])
    expect(knoepfe).toHaveLength(2)
    for (const k of knoepfe) {
      expect(k).not.toMatch(ZU_NIEDRIG)
      expect(k).toMatch(/(?:^|\s)min-h-11(?=\s|$)/)
    }
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
