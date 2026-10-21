/**
 * Wache (Nr. 134, Regelvorschlag 128, Register G4): Ein Aufruf `useCart(` steht in
 * `src/` nur in der Produktliste der Hofseite (`product-grid.tsx`) und auf der
 * Produktseite (`produktdetail-kunde.tsx`). Die Kasse liest den Korb über
 * `leseWarenkorb`, die Kopfzeile über `useWarenkorbKopf` — ein zweiter `useCart`
 * führte still einen zweiten Korb (eigener Zustand, eigene Reservierungen), und
 * die Hofseite zeigte zwei Stände nebeneinander. Die Definition in
 * `src/lib/use-cart.ts` ist kein Aufruf und zählt nicht.
 *
 * Geprüft wird der Syntaxbaum jeder Datei unter `src/`: Aufrufe als `useCart(…)`
 * und als `x.useCart(…)`. Kommentare, Zeichenketten, die Definition und ein
 * Import zählen nicht.
 *
 * Gegenprobe: Text-Attrappen mit einem Aufruf (auch als Eigenschaft) schlagen an,
 * Kommentar, Zeichenkette, Definition, Import und Bezeichner ohne Aufruf nicht.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()
/** Die einzigen Stellen mit einem Aufruf — je genau einer. */
const ERLAUBT = ['src/components/farm/product-grid.tsx', 'src/components/produktdetail/produktdetail-kunde.tsx']

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

/** Die Zeilen, in denen `useCart(` aufgerufen wird — leer = kein Aufruf. */
function findeUseCartAufrufe(quelltext: string): number[] {
  const datei = ts.createSourceFile('schnipsel.tsx', quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const zeilen: number[] = []
  function besuche(knoten: ts.Node): void {
    if (ts.isCallExpression(knoten)) {
      const ziel = knoten.expression
      const name = ts.isIdentifier(ziel) ? ziel.text : ts.isPropertyAccessExpression(ziel) ? ziel.name.text : null
      if (name === 'useCart') zeilen.push(datei.getLineAndCharacterOfPosition(knoten.getStart()).line + 1)
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return zeilen
}

describe('useCart — ein Korb', () => {
  it('der Aufruf steht in src/ nur in der Produktliste der Hofseite und auf der Produktseite', { timeout: 30_000 }, () => {
    // Liest und parst jede Datei unter src/ (TESTING_GUIDELINES: Zeitgrenze 30_000 an genau diesem it).
    const funde: string[] = []
    for (const pfad of quelldateien(join(WURZEL, 'src'))) {
      const text = readFileSync(pfad, 'utf8')
      if (!text.includes('useCart')) continue
      const name = relative(WURZEL, pfad).split(sep).join('/')
      funde.push(...findeUseCartAufrufe(text).map(() => name))
    }
    // Je Stelle genau ein Aufruf; die Gegenprobe darunter zeigt, dass die Suche anschlägt.
    expect(funde.sort()).toEqual([...ERLAUBT].sort())
  })

  it('Gegenprobe: schlägt an bei Aufruf und Aufruf als Eigenschaft — nicht bei Kommentar, Zeichenkette, Definition, Import und Bezeichner', () => {
    const aufrufe = [
      'const korb = useCart(farm.id, farm.slug)',
      'const { items } = useCart(id, slug)',
      'const korb = hooks.useCart(id, slug)',
    ].join('\n')
    expect(findeUseCartAufrufe(aufrufe)).toEqual([1, 2, 3])

    const keine = [
      '// Ein zweiter useCart(farmId, slug) führte einen zweiten Korb',
      '/** useCart(…) bleibt auf Hofseite und Produktseite */',
      "const text = 'useCart(farmId)'",
      "import { useCart } from '@/lib/use-cart'",
      'export function useCart(farmId: string, farmSlug: string): Warenkorb { return leere() }',
      'const verweis = useCart',
    ].join('\n')
    expect(findeUseCartAufrufe(keine)).toEqual([])
  })
})
