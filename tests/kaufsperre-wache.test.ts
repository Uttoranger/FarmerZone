/**
 * Wache (Register N24, /fix „Kaufen nur mit Abholtermin“, 21.10.2026): Die Kaufwege der Hof- und Produktseite
 * lesen die Pause nicht mehr selbst, sondern nur die Sperre aus `kaufSperre` (src/lib/bereiche-anzeige.ts).
 * Vorher fragte jede Stelle `isPaused` — und kannte darum weder „keine Abholzeit“ noch „ausgebucht“.
 *
 * Geprüft wird der Syntaxbaum jeder Datei unter `src/components/hofseite`, `src/components/produktdetail` und
 * `src/components/farm`: Kein Bezeichner und keine Zeichenkette `isPaused` — weder `farm.isPaused` noch ein Prop
 * `isPaused={…}` noch `{ isPaused }`. Die Sperre selbst rechnen die Seiten einmal auf dem Server
 * (`kaufSperre(` in page.tsx von Hofseite, Produktseite und Kasse).
 *
 * Gegenprobe: Schnipsel mit `isPaused` am Kaufknopf, als Prop, entpackt und als Zugriff mit Klammern schlagen an;
 * ein Kommentar und ein längerer Name nicht. Der Aufruf `kaufSperre(` wird erkannt, im Kommentar nicht.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()
const ORDNER = ['src/components/hofseite', 'src/components/produktdetail', 'src/components/farm']
const SEITEN = ['src/app/(public)/[farmSlug]/page.tsx', 'src/app/(public)/[farmSlug]/produkt/[id]/page.tsx', 'src/app/(public)/[farmSlug]/checkout/page.tsx']

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

function syntaxbaum(quelltext: string): ts.SourceFile {
  return ts.createSourceFile('schnipsel.tsx', quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

/** Jede Stelle, an der `isPaused` als Bezeichner oder Zeichenkette steht: Zeilennummern. Leer = in Ordnung. */
function findeIsPaused(quelltext: string): number[] {
  const datei = syntaxbaum(quelltext)
  const zeilen: number[] = []
  function besuche(knoten: ts.Node): void {
    const name = ts.isIdentifier(knoten) ? knoten.text : ts.isStringLiteral(knoten) ? knoten.text : null
    if (name === 'isPaused') zeilen.push(datei.getLineAndCharacterOfPosition(knoten.getStart()).line + 1)
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return zeilen
}

/** Ruft der Quelltext `kaufSperre(…)` auf? Ein Kommentar zählt nicht. */
function ruftKaufSperre(quelltext: string): boolean {
  let gefunden = false
  function besuche(knoten: ts.Node): void {
    if (ts.isCallExpression(knoten) && ts.isIdentifier(knoten.expression) && knoten.expression.text === 'kaufSperre') gefunden = true
    ts.forEachChild(knoten, besuche)
  }
  besuche(syntaxbaum(quelltext))
  return gefunden
}

describe('Kaufwege lesen die Sperre, nicht die Pause (Register N24)', () => {
  it('kein `isPaused` in hofseite, produktdetail und farm', { timeout: 30_000 }, () => {
    // Liest und parst drei Ordner rekursiv — die Zeitgrenze nur an diesem it (TESTING_GUIDELINES §4).
    const verstoesse: string[] = []
    let gelesen = 0
    for (const ordner of ORDNER) {
      for (const pfad of quelldateien(join(WURZEL, ordner))) {
        gelesen++
        const name = relative(WURZEL, pfad).split(sep).join('/')
        for (const zeile of findeIsPaused(readFileSync(pfad, 'utf8'))) verstoesse.push(`${name}:${zeile}`)
      }
    }
    // Gegenprobe zum Lesen: Die Ordner gibt es, und in ihnen stehen die Kaufknöpfe.
    expect(gelesen).toBeGreaterThan(5)
    expect(verstoesse).toEqual([])
  })

  it('Hofseite, Produktseite und Kasse rechnen die Sperre auf dem Server mit kaufSperre', () => {
    for (const seite of SEITEN) expect(ruftKaufSperre(readFileSync(join(WURZEL, seite), 'utf8')), seite).toBe(true)
  })

  it('Gegenprobe: `isPaused` am Kaufknopf, als Prop, entpackt und mit Klammern schlägt an — Kommentar und längerer Name nicht', () => {
    const anschlagen = [
      'const canBuy = zeigeKaufknopf(product, farm.isPaused)',
      'const x = <ProductGrid isPaused={farm.isPaused} />',
      'const { isPaused } = farm',
      "const y = farm['isPaused']",
      '{farm.isPaused && <Hinweiskarte titel="Pause" />}',
    ]
    for (const schnipsel of anschlagen) expect(findeIsPaused(schnipsel), schnipsel).not.toEqual([])
    for (const schnipsel of ['// farm.isPaused war früher hier', 'const isPausedAlt = 1', "const z = 'nicht isPaused'"]) {
      expect(findeIsPaused(schnipsel), schnipsel).toEqual([])
    }
  })

  it('Gegenprobe: der Aufruf kaufSperre( wird erkannt, im Kommentar nicht', () => {
    expect(ruftKaufSperre('const sperre = kaufSperre(farm, jetzt)')).toBe(true)
    expect(ruftKaufSperre('// kaufSperre(farm, jetzt)')).toBe(false)
    expect(ruftKaufSperre('const sperre = farm.isPaused')).toBe(false)
  })
})
