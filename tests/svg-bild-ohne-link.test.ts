/**
 * Kein Link im Bild-SVG (Axe `nested-interactive`, WCAG 4.1.2).
 *
 * Ursache: `<svg role="img">` macht seinen Inhalt für Screenreader zu einem einzigen Bild — ein
 * `<Link>`, `<a>` oder `<button>` darin ist ein bedienbares Element im Bild, das Hilfstechnik nicht
 * erreicht. Axe meldet es als `nested-interactive`; aufgefallen ist es erst in der Bilderstrecke einer
 * Nacht (Diagramm mit verlinkten Balken), nicht beim Schreiben.
 *
 * Beweist (Quelltext von `src/`, TypeScript-Syntaxbaum, kein Netz): Unter keinem `<svg role="img">`
 * (Zeichenkette oder `{'img'}`) steht ein `<Link>`, `<a>` oder `<button>` — in keiner Tiefe. Der Link
 * gehört um das SVG herum oder daneben, nie hinein. Kommentare zählen nicht.
 *
 * Gegenprobe: Text-Attrappen — jedes der drei Elemente in verschiedener Tiefe schlägt an; ein Link
 * um das SVG, ein SVG ohne `role="img"` (dekorativ mit `aria-hidden`) und ein Link daneben nicht.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()
const BEDIENBAR = new Set(['Link', 'a', 'button'])

function* tsxDateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* tsxDateien(pfad)
    else if (name.endsWith('.tsx')) yield pfad
  }
}

/** Ob die Eigenschaften `role="img"` oder `role={'img'}` tragen. */
function istBildRolle(attribute: ts.JsxAttributes): boolean {
  return attribute.properties.some((a) => {
    if (!ts.isJsxAttribute(a) || a.name.getText() !== 'role' || !a.initializer) return false
    const wert = a.initializer
    if (ts.isStringLiteral(wert)) return wert.text === 'img'
    return ts.isJsxExpression(wert) && !!wert.expression && ts.isStringLiteralLike(wert.expression) && wert.expression.text === 'img'
  })
}

/** Die bedienbaren Elemente unter einem `<svg role="img">`: `Datei:Zeile <Name>`. Leer = in Ordnung. */
function bedienbarImBild(quelltext: string, pfad = 'schnipsel.tsx'): string[] {
  const datei = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const funde: string[] = []

  function suche(knoten: ts.Node, imBild: boolean): void {
    let innen = imBild
    if (ts.isJsxElement(knoten) && knoten.openingElement.tagName.getText() === 'svg' && istBildRolle(knoten.openingElement.attributes)) innen = true
    const kopf = ts.isJsxElement(knoten) ? knoten.openingElement : ts.isJsxSelfClosingElement(knoten) ? knoten : null
    if (kopf && imBild && BEDIENBAR.has(kopf.tagName.getText())) {
      funde.push(`${pfad}:${datei.getLineAndCharacterOfPosition(kopf.getStart()).line + 1} <${kopf.tagName.getText()}>`)
    }
    ts.forEachChild(knoten, (kind) => suche(kind, innen))
  }
  suche(datei, false)
  return funde
}

describe('Bild-SVG ohne Link — kein bedienbares Element unter role="img"', () => {
  it('in keiner Datei unter src/ steht ein Link, ein a oder ein button unter einem svg mit role="img"', () => {
    const dateien = [...tsxDateien(join(WURZEL, 'src'))]
    expect(dateien.length).toBeGreaterThan(100)
    const funde = dateien.flatMap((d) => bedienbarImBild(readFileSync(d, 'utf8'), relative(WURZEL, d).split(sep).join('/')))
    expect(funde, 'Den Link um das SVG legen oder neben es stellen, nie hinein (Axe nested-interactive)').toEqual([])
  }, 30_000)
})

describe('Bild-SVG ohne Link — Gegenprobe: die Suche schlägt an', () => {
  it('findet Link, a und button in jeder Tiefe unter svg role="img"', () => {
    for (const [text, name] of [
      ['<svg role="img" aria-label="x"><Link href="/a"><rect /></Link></svg>', 'Link'],
      ['<svg role="img"><g><a href="/a"><circle /></a></g></svg>', 'a'],
      ['<svg role="img"><g><g><button type="button"><path d="M0 0" /></button></g></g></svg>', 'button'],
      ["<svg role={'img'}><Link href=\"/a\" /></svg>", 'Link'],
      ['<svg viewBox="0 0 1 1" role="img">{items.map((i) => <Link key={i} href={i}><rect /></Link>)}</svg>', 'Link'],
    ] as const) {
      expect(bedienbarImBild(text), text).toEqual([expect.stringContaining(`<${name}>`)])
    }
  })

  it('nennt die Zeile des Fundes', () => {
    const text = 'const a = (\n  <svg role="img">\n    <rect />\n    <Link href="/a" />\n  </svg>\n)'
    expect(bedienbarImBild(text, 'src/x.tsx')).toEqual(['src/x.tsx:4 <Link>'])
  })

  it('lässt den Link um das svg, ein dekoratives svg und einen Link daneben stehen', () => {
    for (const text of [
      '<Link href="/a"><svg role="img" aria-label="x"><rect /></svg></Link>',
      '<a href="/a"><svg role="img"><rect /></svg></a>',
      '<svg aria-hidden="true"><Link href="/a" /></svg>',
      '<div><svg role="img"><rect /></svg><Link href="/a">mehr</Link></div>',
      '<svg role="presentation"><a href="/a" /></svg>',
      '{/* <svg role="img"><Link href="/a" /></svg> */}',
    ]) {
      expect(bedienbarImBild(text), text).toEqual([])
    }
  })
})
