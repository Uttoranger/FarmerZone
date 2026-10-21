/**
 * Wache (Nr. 134, Register F8/G4): Die vier Wörter, mit denen ein Beitrag seinen
 * Anlass nennt („Frisches Produkt“, „Neue Saison“, „Aktion“, „Mitteilung“), stehen
 * in `src/` als ganzes Zeichenketten-Literal nur in `src/lib/beitrag-anlass.ts`
 * (BEITRAG_ANLASS). Vorher standen sie viermal daneben — im Assistenten „Neuer
 * Beitrag“, in der Mail an Abonnentinnen, im Teilen-Bild und im Bild der Route
 * `/api/status-image/[id]` — und ein geändertes Wort stimmte dann nur an einer Stelle.
 *
 * Geprüft wird der Syntaxbaum jeder Datei unter `src/`: Zeichenketten, Vorlagen ohne
 * Platzhalter, Attributwerte und reiner JSX-Text. Kommentare und Rechtstexte zählen
 * nicht (ein Satz, der das Wort nur enthält, ist kein ganzes Literal).
 *
 * Gegenprobe: Text-Attrappen mit jeder Schreibweise schlagen an, Kommentar, längerer
 * Satz, Vorlage mit Platzhalter und Bezeichner nicht.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { BEITRAG_ANLASS } from '@/lib/beitrag-anlass'

const WURZEL = process.cwd()
const QUELLE = 'src/lib/beitrag-anlass.ts'
const WOERTER = ['Frisches Produkt', 'Neue Saison', 'Aktion', 'Mitteilung']

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

/** Alle Stellen, an denen eines der Wörter als ganzes Literal steht: `Zeile Wort`. Leer = in Ordnung. */
function findeAnlassWoerter(quelltext: string, woerter: readonly string[]): string[] {
  const datei = ts.createSourceFile('schnipsel.tsx', quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const funde: string[] = []
  function besuche(knoten: ts.Node): void {
    const text =
      ts.isStringLiteral(knoten) || ts.isNoSubstitutionTemplateLiteral(knoten)
        ? knoten.text
        : ts.isJsxText(knoten)
          ? knoten.text.trim()
          : null
    if (text !== null && woerter.includes(text)) {
      funde.push(`${datei.getLineAndCharacterOfPosition(knoten.getStart()).line + 1} ${text}`)
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return funde
}

describe('Anlass-Wörter — eine Quelle (BEITRAG_ANLASS)', () => {
  it('die Quelle nennt genau die vier Wörter, nach denen die Wache sucht', () => {
    expect(Object.values(BEITRAG_ANLASS).map((a) => a.wort).sort()).toEqual([...WOERTER].sort())
  })

  it('stehen in src/ als ganzes Literal nur in src/lib/beitrag-anlass.ts', { timeout: 30_000 }, () => {
    // Liest und parst jede Datei unter src/ (TESTING_GUIDELINES: Zeitgrenze 30_000 an genau diesem it).
    const verstoesse: string[] = []
    for (const pfad of quelldateien(join(WURZEL, 'src'))) {
      const name = relative(WURZEL, pfad).split(sep).join('/')
      if (name === QUELLE) continue
      const text = readFileSync(pfad, 'utf8')
      if (!WOERTER.some((wort) => text.includes(wort))) continue
      for (const fund of findeAnlassWoerter(text, WOERTER)) verstoesse.push(`${name}:${fund}`)
    }
    expect(verstoesse).toEqual([])
  })

  it('Gegenprobe: schlägt an bei Zeichenkette, Vorlage, Attribut und JSX-Text — nicht bei Kommentar, Satz, Platzhalter oder Bezeichner', () => {
    const schnipsel = [
      "const a = 'Frisches Produkt'",
      'const b = "Neue Saison"',
      'const c = `Aktion`',
      'const d = <Feld label="Mitteilung" />',
      'const e = <span>Aktion</span>',
      // Das alles zählt nicht:
      "// 'Aktion' im Kommentar",
      '/** Mitteilung, Aktion */',
      "const f = 'Unterschrift (nur bei Mitteilung auf Papier):'",
      'const g = `${n} Aktion`',
      'const Aktion = 1',
      "const h = 'Aktionen'",
    ].join('\n')
    expect(findeAnlassWoerter(schnipsel, WOERTER)).toEqual([
      '1 Frisches Produkt',
      '2 Neue Saison',
      '3 Aktion',
      '4 Mitteilung',
      '5 Aktion',
    ])
  })
})
