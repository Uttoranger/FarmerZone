/**
 * Bar-Token aus einer Quelle (Nr. 170, Register S17): Kasse, „Erneut senden“
 * und „Nochmal schicken“ im Admin erzeugen den Token des Bestätigungslinks
 * über `neuerBarToken()` (src/lib/bar-bestaetigung.ts).
 *
 * Ursache: Bis Nr. 170 rief die Kasse und `sendeBarLinkErneut` je selbst
 * `nanoid(32)` und hashte danach — eine dritte Stelle mit anderer Länge oder
 * ohne Hash fiele nicht auf.
 *
 * Beweist (Syntaxbaum von `src/`, nur Aufrufe, Kommentare zählen nicht): kein
 * `nanoid(32)` und kein `nanoid(BAR_TOKEN_LAENGE)` außerhalb von
 * src/lib/bar-bestaetigung.ts. `nanoid()` ohne Länge (src/lib/use-cart.ts)
 * bleibt erlaubt, Tests liegen außerhalb von `src/`.
 *
 * Gegenprobe: Text-Attrappen — beide Formen schlagen an, ein Kommentar und
 * `nanoid()` nicht; die eine erlaubte Datei trägt die Erzeugung wirklich.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()
const ERLAUBT = 'src/lib/bar-bestaetigung.ts'

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

/** Alle Aufrufe `nanoid(32)` bzw. `nanoid(BAR_TOKEN_LAENGE)` als `Datei:Zeile`. */
function barTokenAufrufe(quelltext: string, pfad = 'schnipsel.ts'): string[] {
  const datei = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const funde: string[] = []
  const besuche = (knoten: ts.Node): void => {
    if (ts.isCallExpression(knoten) && ts.isIdentifier(knoten.expression) && knoten.expression.text === 'nanoid') {
      const [laenge] = knoten.arguments
      const istBarLaenge = laenge !== undefined && ((ts.isNumericLiteral(laenge) && laenge.text === '32') || (ts.isIdentifier(laenge) && laenge.text === 'BAR_TOKEN_LAENGE'))
      if (istBarLaenge) funde.push(`${pfad}:${datei.getLineAndCharacterOfPosition(knoten.getStart()).line + 1}`)
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return funde
}

describe('Bar-Token aus einer Quelle (Nr. 170)', () => {
  it('kein nanoid(32) bzw. nanoid(BAR_TOKEN_LAENGE) außerhalb von src/lib/bar-bestaetigung.ts', () => {
    const funde: string[] = []
    for (const pfad of quelldateien(join(WURZEL, 'src'))) {
      const rel = relative(WURZEL, pfad).split(sep).join('/')
      if (rel === ERLAUBT) continue
      funde.push(...barTokenAufrufe(readFileSync(pfad, 'utf8'), rel))
    }
    expect(funde).toEqual([])
  }, 30_000)

  it('Gegenprobe: beide Formen schlagen an, ein Kommentar und nanoid() nicht; die erlaubte Datei erzeugt wirklich', () => {
    expect(barTokenAufrufe('const t = nanoid(32)')).toEqual(['schnipsel.ts:1'])
    expect(barTokenAufrufe('const a = 1\nconst t = nanoid(BAR_TOKEN_LAENGE)')).toEqual(['schnipsel.ts:2'])
    expect(barTokenAufrufe('// früher: nanoid(32)\nconst id = nanoid()\nconst k = nanoid(21)')).toEqual([])
    expect(barTokenAufrufe(readFileSync(join(WURZEL, ERLAUBT), 'utf8'))).toHaveLength(1)
  })
})
