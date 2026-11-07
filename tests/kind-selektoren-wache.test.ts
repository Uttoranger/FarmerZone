/**
 * `[&>`-Wache (Nr. 246; Regelvorschlag aus Morgenbericht 31, als entschieden übernommen in freigabe.md §36).
 *
 * Ursache: Seiten bauten ui/-Bausteine per Kind-Selektor von außen um (`[&>span]:size-9`, `[&>p:first-of-type]:…`,
 * etwa den Leerzustand im Korb-Blatt). Ändert der Baustein sein Innenleben — wie EmptyState ohne Symbol in
 * Nr. 246 —, greifen solche Klassen ins Leere oder ins Falsche, und kein Typecheck merkt es. Neuer Code nimmt eine
 * Variante oder ein Prop des Bausteins.
 *
 * Beweist (Quelltext von `src/`, `.ts` und `.tsx`, Kommentare zählen nicht): `[&>` steht nur in Dateien der
 * Bestandsliste (tests/bestandslisten/kind-selektoren.ts) und dort nicht öfter als heute. Eine Datei der Liste
 * ohne Treffer fällt als veraltet auf: Die Liste darf nur schrumpfen.
 *
 * Gegenprobe: Text-Attrappen — jede Schreibweise mit Variante schlägt an, `[&_svg]`, `*:` und Kommentare nicht;
 * und die Suche findet im echten Baum Treffer.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { KIND_SELEKTOR_BESTAND } from './bestandslisten/kind-selektoren'

const WURZEL = process.cwd()
const KIND_SELEKTOR = /\[&>/g

function* dateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* dateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

const ohneKommentare = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/** Wie oft ein Text einen Kind-Selektor `[&>…]` schreibt. */
function zaehleKindSelektoren(text: string): number {
  return [...ohneKommentare(text).matchAll(KIND_SELEKTOR)].length
}

const treffer = new Map<string, number>()
for (const pfad of dateien(join(WURZEL, 'src'))) {
  const anzahl = zaehleKindSelektoren(readFileSync(pfad, 'utf8'))
  if (anzahl > 0) treffer.set(relative(WURZEL, pfad).split(sep).join('/'), anzahl)
}

describe('Kind-Selektoren `[&>` an Bausteinen', () => {
  it('keine neue Datei schreibt `[&>` — neuer Code nimmt eine Variante oder ein Prop des Bausteins', () => {
    const neu = [...treffer.keys()].filter((datei) => !(datei in KIND_SELEKTOR_BESTAND))
    expect(neu, 'Statt `[&>…]` eine Variante oder ein Prop am Baustein (src/components/ui/)').toEqual([])
  })

  it('in Dateien der Bestandsliste wird es nicht mehr', () => {
    const mehr = [...treffer].filter(([datei, anzahl]) => datei in KIND_SELEKTOR_BESTAND && anzahl > KIND_SELEKTOR_BESTAND[datei])
    expect(mehr.map(([datei, anzahl]) => `${datei}: ${anzahl} statt höchstens ${KIND_SELEKTOR_BESTAND[datei]}`)).toEqual([])
  })

  it('die Bestandsliste schrumpft nur — eine Datei ohne Treffer muss heraus', () => {
    const veraltet = Object.keys(KIND_SELEKTOR_BESTAND).filter((datei) => !treffer.has(datei))
    expect(veraltet, 'Diese Dateien aus tests/bestandslisten/kind-selektoren.ts streichen').toEqual([])
  })

  it('Gegenprobe: jede Schreibweise schlägt an, andere Selektoren und Kommentare nicht', () => {
    expect(zaehleKindSelektoren('<EmptyState className="[&>span]:size-9 [&>p:first-of-type]:font-sans" />')).toBe(2)
    expect(zaehleKindSelektoren("cn('md:[&>div]:mt-2', 'hover:[&>svg]:text-foreground')")).toBe(2)
    expect(zaehleKindSelektoren('[&_svg]:size-4 *:w-full [&:has(>a)]:p-0')).toBe(0)
    expect(zaehleKindSelektoren('// [&>span] im Kommentar\n/* [&>div] */')).toBe(0)
    expect(treffer.size).toBeGreaterThan(0)
  })
})
