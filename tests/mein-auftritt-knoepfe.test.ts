/**
 * „Mein Auftritt" (/settings/appearance, Nr. 35, Morgenbericht Lauf 6 §6):
 * Jeder Knopf ist ein Touch-Ziel von mindestens 44 px (DESIGN_SYSTEM). Nr. 32
 * hatte die Felder und „Logo hochladen" gehoben; übrig waren „Logo entfernen"
 * (20 px), „Titelbild entfernen" (28 px), der Griff „Bereich verschieben"
 * (32 px), die Pfeil- und Löschknöpfe bei Fotos, Werten und Bereichen (24 px)
 * und die Wert-Kacheln (40 px). Die sichtbaren Kreise dürfen kleiner bleiben —
 * dann liegt der Kreis als Span im 44-px-Knopf.
 *
 * Dazu: Knöpfe nur mit Symbol tragen ein `aria-label`, und ihre Symbole sind
 * `aria-hidden`.
 *
 * Quelltext-Prüfung über den TypeScript-Parser (TESTING_GUIDELINES:
 * Architektur-Regel am Quelltext), mit Gegenprobe an den alten Formen.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, it, expect } from 'vitest'

const PFAD = 'src/app/(hof)/settings/appearance/appearance-client.tsx'
const QUELLE = readFileSync(join(process.cwd(), PFAD), 'utf8')

/** Größen-Klassen unter 44 px am Knopf selbst (Tailwind: 1 … 10, auch x.5). */
const ZU_KLEIN = /(?:^|\s)(?:size|h|min-h|w|min-w)-(?:[1-9]|10)(?:\.5)?(?=\s|$)/
/** Höhe ≥ 44 px. */
const HOCH_GENUG = /(?:^|\s)(?:size|h|min-h)-(?:11|12|14|16|20|24)(?=\s|$)/
/** Breite ≥ 44 px — für Knöpfe ohne Text, die sonst schmal blieben. */
const BREIT_GENUG = /(?:^|\s)(?:size|w|min-w)-(?:11|12|14|16|20|24|full)(?=\s|$)|(?:^|\s)flex-1(?=\s|$)/

/** Konstanten der Datei mit einer Zeichenkette (`const SYMBOL_KNOPF = '…'`). */
function konstanten(datei: ts.SourceFile): Map<string, string> {
  const werte = new Map<string, string>()
  for (const anweisung of datei.statements) {
    if (!ts.isVariableStatement(anweisung)) continue
    for (const d of anweisung.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.initializer && ts.isStringLiteral(d.initializer)) werte.set(d.name.text, d.initializer.text)
    }
  }
  return werte
}

/**
 * Alle Zeichenketten in einem Ausdruck (className="…" oder cn('…', bedingung
 * ? '…' : '…')), Bezeichner über die Konstanten der Datei aufgelöst.
 */
function texte(knoten: ts.Node, werte: Map<string, string>): string[] {
  const funde: string[] = []
  const besuche = (k: ts.Node): void => {
    if (ts.isStringLiteral(k) || ts.isNoSubstitutionTemplateLiteral(k)) funde.push(k.text)
    else if (ts.isIdentifier(k) && werte.has(k.text)) funde.push(werte.get(k.text) ?? '')
    ts.forEachChild(k, besuche)
  }
  besuche(knoten)
  return funde
}

function attribut(attribute: ts.JsxAttributes, name: string): ts.JsxAttribute | undefined {
  return attribute.properties.find((a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText() === name)
}

/**
 * Trägt der Knopf Text? JsxText oder ein Ausdruck mit Zeichenkette, Eigenschaft
 * (`item.titel`) oder Aufruf (`stufenText(…)`) — Attribute von Kindern zählen
 * nicht (sonst wäre `className="size-4"` eines Symbols „Text").
 */
function hatText(kinder: ts.NodeArray<ts.JsxChild>): boolean {
  let gefunden = false
  const besuche = (k: ts.Node): void => {
    if (gefunden || ts.isJsxAttributes(k)) return
    if (ts.isJsxText(k) && k.text.trim() !== '') gefunden = true
    else if (
      ts.isStringLiteral(k) ||
      ts.isNoSubstitutionTemplateLiteral(k) ||
      ts.isTemplateExpression(k) ||
      ts.isPropertyAccessExpression(k) ||
      ts.isElementAccessExpression(k) ||
      ts.isCallExpression(k)
    )
      gefunden = true
    else ts.forEachChild(k, besuche)
  }
  kinder.forEach(besuche)
  return gefunden
}

/** Symbole im Knopf (lucide: großgeschriebene Elemente ohne Kinder) ohne aria-hidden. */
function symboleOhneAriaHidden(kinder: ts.NodeArray<ts.JsxChild>): string[] {
  const funde: string[] = []
  const besuche = (k: ts.Node): void => {
    if (ts.isJsxSelfClosingElement(k)) {
      const name = k.tagName.getText()
      if (/^[A-Z]/.test(name) && name !== 'Image' && !attribut(k.attributes, 'aria-hidden')) funde.push(name)
    }
    ts.forEachChild(k, besuche)
  }
  kinder.forEach(besuche)
  return funde
}

/** Befunde je Knopf: „Zeile: was fehlt". Leer = alles in Ordnung. */
function pruefeKnoepfe(quelle: string): string[] {
  const datei = ts.createSourceFile('x.tsx', quelle, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const befunde: string[] = []
  const werte = konstanten(datei)
  const besuche = (k: ts.Node): void => {
    if (ts.isJsxElement(k) && k.openingElement.tagName.getText() === 'button') {
      const zeile = datei.getLineAndCharacterOfPosition(k.getStart()).line + 1
      const klassenAttribut = attribut(k.openingElement.attributes, 'className')
      const klassen = klassenAttribut?.initializer ? texte(klassenAttribut.initializer, werte).join(' ') : ''
      const mitText = hatText(k.children)
      if (ZU_KLEIN.test(klassen)) befunde.push(`${zeile}: Größe unter 44 px (${klassen})`)
      if (!HOCH_GENUG.test(klassen)) befunde.push(`${zeile}: keine Höhe ≥ 44 px (${klassen})`)
      if (!mitText && !BREIT_GENUG.test(klassen)) befunde.push(`${zeile}: keine Breite ≥ 44 px (${klassen})`)
      if (!mitText && !attribut(k.openingElement.attributes, 'aria-label')) befunde.push(`${zeile}: Symbol-Knopf ohne aria-label`)
      for (const symbol of symboleOhneAriaHidden(k.children)) befunde.push(`${zeile}: ${symbol} ohne aria-hidden`)
    }
    ts.forEachChild(k, besuche)
  }
  besuche(datei)
  return befunde
}

describe('Mein Auftritt — jeder Knopf ≥ 44 px, Symbol-Knöpfe benannt', () => {
  it('keine Befunde', () => {
    expect(pruefeKnoepfe(QUELLE)).toEqual([])
  })

  it('die Prüfung sieht alle Knöpfe der Seite', () => {
    expect((QUELLE.match(/<button\b/g) ?? []).length).toBeGreaterThanOrEqual(20)
  })

  it('Knöpfe ohne Text nennen, wofür sie sind', () => {
    for (const label of ['Logo entfernen', 'Titelbild entfernen', 'Bereich verschieben']) {
      expect(QUELLE).toContain(`aria-label="${label}"`)
    }
    // Fotos, Werte und Bereiche nennen ihren Eintrag (Vorbild Direktverkauf, DESIGN_SYSTEM).
    expect(QUELLE).toMatch(/aria-label=\{`Foto \$\{index \+ 1\} nach oben`\}/)
    expect(QUELLE).toMatch(/aria-label=\{`\$\{v\.title\} entfernen`\}/)
    expect(QUELLE).toMatch(/aria-label=\{`\$\{bereichName\} nach unten`\}/)
  })
})

describe('Gegenprobe: die Prüfung erkennt die alten Formen', () => {
  const knopf = (inhalt: string) => `const x = <div>${inhalt}</div>`

  it('24-px-Pfeil ohne Namen', () => {
    const befunde = pruefeKnoepfe(knopf('<button onClick={() => f()} className="w-6 h-6 rounded-md"><ChevronUp className="size-3.5" /></button>'))
    expect(befunde.join('\n')).toMatch(/Größe unter 44 px/)
    expect(befunde.join('\n')).toMatch(/ohne aria-label/)
    expect(befunde.join('\n')).toMatch(/ChevronUp ohne aria-hidden/)
  })

  it('32-px-Griff mit Namen', () => {
    const befunde = pruefeKnoepfe(knopf('<button aria-label="Bereich verschieben" className="shrink-0 size-8 rounded-lg"><GripVertical className="size-4" aria-hidden="true" /></button>'))
    expect(befunde).toHaveLength(3)
    expect(befunde.join("\n")).not.toMatch(/aria-label|aria-hidden/)
  })

  it('Wert-Kachel mit Text, aber ohne Höhe (40 px)', () => {
    const befunde = pruefeKnoepfe(knopf("<button className={cn('flex items-center gap-2 p-2.5', a ? 'x' : 'y')}><span>{item.titel}</span></button>"))
    expect(befunde).toEqual([expect.stringMatching(/keine Höhe/)])
  })

  it('Klassen aus einer Konstante der Datei zählen mit', () => {
    const quelle = `const KLEIN = 'w-6 h-6'\nconst x = <div><button aria-label="Hoch" className={cn(KLEIN, 'hover:bg-muted')}><ChevronUp aria-hidden="true" /></button></div>`
    expect(pruefeKnoepfe(quelle).join('\n')).toMatch(/Größe unter 44 px \(w-6 h-6/)
  })

  it('so ist es richtig: 44-px-Knopf mit kleinem sichtbarem Kreis', () => {
    const befunde = pruefeKnoepfe(
      knopf('<button aria-label="Logo entfernen" className="size-11 flex items-center justify-center"><span className="size-5 rounded-full"><X className="size-3" aria-hidden="true" /></span></button>')
    )
    expect(befunde).toEqual([])
  })
})
