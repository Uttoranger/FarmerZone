/**
 * Rundungen-Wache (Baustein G8, Nr. 245; Liste Lauf 32, Abschnitt 3.2; Regelvorschlag 233/236).
 *
 * Ursache: `rounded-xl`, `rounded-2xl` und `rounded-3xl` rechnen mit `--radius` (globals.css). Im neuen
 * Design ist der 1rem — aus 12/16 px der Boards werden 22/29 px. Neuer Code nimmt die festen Pixel aus
 * `RUNDUNG` (src/components/ui/rundung.ts); die Tokens in globals.css bleiben.
 *
 * Beweist (Quelltext von `src/`, `.ts` und `.tsx`, Kommentare zählen nicht): Diese Klassen — auch mit Seite
 * davor (`rounded-t-2xl`) und Variante (`md:rounded-2xl`) — stehen nur in Dateien der Bestandsliste
 * (tests/bestandslisten/rundungen.ts) und dort nicht öfter als heute. Eine Datei der Liste ohne Treffer
 * fällt als veraltet auf: Die Liste darf nur schrumpfen.
 *
 * Gegenprobe: Text-Attrappen — jede Schreibweise schlägt an, die festen Pixel, `rounded-lg`, `rounded-full`
 * und Wörter, die nur so aussehen (`rounded-xll`), nicht; und die Suche findet im echten Baum Treffer.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RUNDUNGEN_BESTAND } from './bestandslisten/rundungen'
import { RUNDUNG, RUNDUNG_PX } from '@/components/ui/rundung'

const WURZEL = process.cwd()

const RUNDUNG_KLASSE = /(?<![A-Za-z0-9_-])rounded-(?:[trblse]{1,2}-)?(?:xl|2xl|3xl)(?![A-Za-z0-9-])/g

function* dateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* dateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

const ohneKommentare = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/** Wie oft ein Text eine der wachsenden Rundungen schreibt. */
function zaehleRundungen(text: string): number {
  return [...ohneKommentare(text).matchAll(RUNDUNG_KLASSE)].length
}

const treffer = new Map<string, number>()
for (const pfad of dateien(join(WURZEL, 'src'))) {
  const anzahl = zaehleRundungen(readFileSync(pfad, 'utf8'))
  if (anzahl > 0) treffer.set(relative(WURZEL, pfad).split(sep).join('/'), anzahl)
}

describe('Rundungen in Pixeln (G8)', () => {
  it('keine neue Datei schreibt rounded-xl/2xl/3xl — neuer Code nimmt RUNDUNG', () => {
    const neu = [...treffer.keys()].filter((datei) => !(datei in RUNDUNGEN_BESTAND))
    expect(neu, 'Statt rounded-xl/2xl/3xl RUNDUNG aus src/components/ui/rundung.ts nehmen').toEqual([])
  })

  it('in Dateien der Bestandsliste wird es nicht mehr', () => {
    const mehr = [...treffer].filter(([datei, anzahl]) => datei in RUNDUNGEN_BESTAND && anzahl > RUNDUNGEN_BESTAND[datei])
    expect(mehr.map(([datei, anzahl]) => `${datei}: ${anzahl} statt höchstens ${RUNDUNGEN_BESTAND[datei]}`)).toEqual([])
  })

  it('die Bestandsliste schrumpft nur — eine Datei ohne Treffer muss heraus', () => {
    const veraltet = Object.keys(RUNDUNGEN_BESTAND).filter((datei) => !treffer.has(datei))
    expect(veraltet, 'Diese Dateien aus tests/bestandslisten/rundungen.ts streichen').toEqual([])
  })

  it('Gegenprobe: jede Schreibweise schlägt an, feste Pixel und Ähnliches nicht', () => {
    expect(zaehleRundungen('<div className="rounded-xl border" />')).toBe(1)
    expect(zaehleRundungen("cn('md:rounded-2xl', 'rounded-t-3xl', 'rounded-bl-xl')")).toBe(3)
    expect(zaehleRundungen('rounded-[12px] rounded-lg rounded-full rounded-xll rounded-2xl-ish')).toBe(0)
    expect(zaehleRundungen('// rounded-2xl im Kommentar\n/* rounded-xl */')).toBe(0)
    expect(treffer.size).toBeGreaterThan(0)
  })

  it('RUNDUNG trägt die Pixel der Liste: Karte 12, Feld 10, Hinweis 12, Blatt 16', () => {
    expect(RUNDUNG_PX).toEqual({ karte: 12, feld: 10, hinweis: 12, blatt: 16 })
    for (const art of Object.keys(RUNDUNG_PX) as (keyof typeof RUNDUNG_PX)[]) {
      expect(RUNDUNG[art]).toBe(`rounded-[${RUNDUNG_PX[art]}px]`)
    }
  })
})
