/**
 * Wache: kein `key` an einem iframe, außer in der Liste aus `vorschauRahmen`
 * (Regelvorschlag 106, Lauf 16; freigegeben für Nr. 118, Lauf 17).
 *
 * Ursache: Die Vorschau der Hofseite und der Startseite hing an `key={vorschauAdresse(…)}`. Jede Speicherung
 * brachte eine neue Adresse, React baute den Rahmen neu auf — er stand leer da, lud von oben, und eine
 * Änderung weiter unten passierte außer Sicht (Nr. 106). Seither tauscht die Vorschau erst nach `load`
 * (`vorschauRahmen`, src/lib/startseite-fassung.ts): Der sichtbare Rahmen bleibt stehen, der neue lädt
 * unsichtbar daneben, nie mehr als zwei. Die Hofseite lässt den einen Rahmen stehen und lädt ihn über
 * `location.replace` neu (hofseite-vorschau-rahmen.tsx).
 *
 * Beweist (TypeScript-Syntaxbaum über jede .tsx unter src/):
 *  - Kein `<iframe>` trägt ein `key` — außer er steht in einem `.map(…)` über die Liste `rahmen`, die
 *    `vorschauRahmen(…)` liefert. Dort ist die Adresse der Schlüssel jedes der höchstens zwei Rahmen und
 *    baut keinen davon neu auf.
 *  - Gegenprobe: Der alte Weg (`key` mit der Adresse an EINEM Rahmen), ein `key` in einer Liste aus etwas
 *    anderem und derselbe Aufbau mit `vorschauRahmen` werden unterschieden.
 *  - Die Ausnahme gibt es wirklich: Die Startseiten-Vorschau nutzt die Liste aus `vorschauRahmen`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'

const WURZEL = process.cwd()

function* tsxDateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* tsxDateien(pfad)
    else if (name.endsWith('.tsx')) yield pfad
  }
}

/** Die lokalen Namen, unter denen `rahmen` aus `vorschauRahmen(…)` kommt: `const { rahmen } = vorschauRahmen(…)`. */
function namenAusVorschauRahmen(datei: ts.SourceFile): Set<string> {
  const namen = new Set<string>()
  const besuche = (knoten: ts.Node): void => {
    if (
      ts.isVariableDeclaration(knoten) &&
      knoten.initializer &&
      ts.isCallExpression(knoten.initializer) &&
      ts.isIdentifier(knoten.initializer.expression) &&
      knoten.initializer.expression.text === 'vorschauRahmen' &&
      ts.isObjectBindingPattern(knoten.name)
    ) {
      for (const element of knoten.name.elements) {
        const eigenschaft = element.propertyName ?? element.name
        if (ts.isIdentifier(eigenschaft) && eigenschaft.text === 'rahmen' && ts.isIdentifier(element.name)) namen.add(element.name.text)
      }
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return namen
}

/** Steht der Knoten im Rückruf eines `.map(…)` über eine der genannten Listen? */
function ueberListe(knoten: ts.Node, listen: Set<string>): boolean {
  for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) {
    if (
      ts.isCallExpression(k) &&
      ts.isPropertyAccessExpression(k.expression) &&
      k.expression.name.text === 'map' &&
      ts.isIdentifier(k.expression.expression) &&
      listen.has(k.expression.expression.text)
    ) {
      return true
    }
  }
  return false
}

/** Jeder `<iframe>` mit `key`, der nicht in der Liste aus `vorschauRahmen` steht: „Datei:Zeile“. */
function findeIframeMitKey(quelltext: string, pfad = 'schnipsel.tsx'): string[] {
  const datei = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const erlaubteListen = namenAusVorschauRahmen(datei)
  const funde: string[] = []
  const besuche = (knoten: ts.Node): void => {
    if ((ts.isJsxOpeningElement(knoten) || ts.isJsxSelfClosingElement(knoten)) && knoten.tagName.getText(datei) === 'iframe') {
      const hatKey = knoten.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText(datei) === 'key')
      if (hatKey && !ueberListe(knoten, erlaubteListen)) {
        funde.push(`${pfad}:${datei.getLineAndCharacterOfPosition(knoten.getStart(datei)).line + 1}`)
      }
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return funde
}

describe('kein key an einem iframe (Regelvorschlag 106)', () => {
  it('Gegenprobe: der alte Weg — key mit der Vorschau-Adresse an EINEM Rahmen — schlägt an', () => {
    const alt = [
      'export function Vorschau({ slug, stand }: { slug: string; stand: string }) {',
      '  return <iframe key={vorschauAdresse(slug, stand)} src={vorschauAdresse(slug, stand)} title="Vorschau" />',
      '}',
    ].join('\n')
    expect(findeIframeMitKey(alt)).toEqual(['schnipsel.tsx:2'])
    // auch als Rahmen mit Inhalt und mit einem Schlüssel aus mehreren Teilen
    expect(findeIframeMitKey('const a = <iframe key={`${slug}-${stand}`} src={adresse}></iframe>')).toEqual(['schnipsel.tsx:1'])
  })

  it('Gegenprobe: ein key in einer Liste aus etwas anderem als vorschauRahmen schlägt an', () => {
    const liste = 'const a = adressen.map((p) => <iframe key={p} src={p} />)'
    expect(findeIframeMitKey(liste)).toEqual(['schnipsel.tsx:1'])
    // auch wenn vorschauRahmen in der Datei vorkommt, aber die Liste nicht von dort kommt
    const fremd = ['const { rahmen } = vorschauRahmen(a, b)', 'const x = andere.map((p) => <iframe key={p} src={p} />)'].join('\n')
    expect(findeIframeMitKey(fremd)).toEqual(['schnipsel.tsx:2'])
  })

  it('der Aufbau mit vorschauRahmen und ein Rahmen ohne key sind in Ordnung', () => {
    const neu = [
      'const { rahmen, laedt } = vorschauRahmen(sichtbar, gewuenscht)',
      'const a = rahmen.map((pfad) => <iframe key={pfad} src={pfad} />)',
    ].join('\n')
    expect(findeIframeMitKey(neu)).toEqual([])
    // umbenannt beim Auslesen ändert nichts
    const umbenannt = ['const { rahmen: stehende } = vorschauRahmen(s, g)', 'const a = stehende.map((pfad) => <iframe key={pfad} src={pfad} />)'].join('\n')
    expect(findeIframeMitKey(umbenannt)).toEqual([])
    expect(findeIframeMitKey('const a = <iframe ref={rahmen} src={adresse} title="Vorschau" />')).toEqual([])
  })

  it('kein iframe unter src/ trägt ein key, das einen Rahmen neu aufbaut', () => {
    const funde = [...tsxDateien(join(WURZEL, 'src'))].flatMap((pfad) => findeIframeMitKey(readFileSync(pfad, 'utf8'), relative(WURZEL, pfad)))
    expect(funde, 'Ein key am iframe baut den Rahmen bei jeder neuen Adresse neu auf (leer, wieder oben) — vorschauRahmen oder location.replace nehmen.').toEqual([])
  }, 30_000)

  it('die Ausnahme gibt es wirklich: die Startseiten-Vorschau läuft über die Liste aus vorschauRahmen', () => {
    const pfad = 'src/components/admin/startseite-vorschau.tsx'
    const quelle = readFileSync(join(WURZEL, pfad), 'utf8')
    const datei = ts.createSourceFile(pfad, quelle, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    expect(namenAusVorschauRahmen(datei)).toEqual(new Set(['rahmen']))
    expect(quelle).toMatch(/<iframe\s+key=\{pfad\}/)
    // Ohne die Liste aus vorschauRahmen wäre dieselbe Datei ein Fund.
    expect(findeIframeMitKey(quelle.replace('vorschauRahmen(', 'andereListe('), pfad)).toHaveLength(1)
  })
})
