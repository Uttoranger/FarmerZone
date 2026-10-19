/**
 * Keine Emojis als Bedeutungsträger — Symbole kommen aus lucide-react
 * (docs/ai/DESIGN_SYSTEM.md, „Symbole").
 *
 * Ursache des Fehlers: Die Prototypen trugen Emojis als Platzhalter (so stand
 * es in ihrer Übergabe, die seit dem Redesign-Kit gelöscht ist); beim
 * Nachbauen blieben sie in Leerzuständen, Zahlungsarten, der Fehlerseite, den
 * Verkaufswegen, den Mails und der Story-Grafik stehen.
 * Je nach Gerät sehen sie anders aus, Screenreader lesen sie als „Gesicht mit
 * Freudentränen" vor, und das Design-System kennt sie nicht.
 *
 * Beweist:
 *  - In keinem Text, den der Quelltext unter src/ selbst schreibt
 *    (Zeichenketten, Vorlagen, JSX-Text), steht ein Emoji oder ein Haken „✓".
 *    Das gilt auch für E-Mails, die WhatsApp-Nachricht und die Story-Grafik.
 *  - Ausgenommen: ©, ® und ™ (Schriftzeichen, z. B. die Pflichtangabe
 *    „© OpenStreetMap") und Server-Logs (console.*), die niemand in der
 *    Oberfläche liest.
 *
 * Fremdtext — Produktnamen, Beiträge und Werte der Höfe — liegt in der
 * Datenbank, nicht im Quelltext, und bleibt unangetastet.
 *
 * Dazu (Regelvorschlag 103, Lauf 16; Nr. 118): Mitten in einer Datei unter src/ oder tests/ steht kein
 * unsichtbares Zeichen U+FEFF (BOM). Eine als Escape gemeinte Byte-Reihenfolge-Marke kam unsichtbar in
 * Quelltext und Test (Nr. 103, CSV-Ausgabe); wer sie braucht, schreibt `\uFEFF`. Ein BOM ganz am Dateianfang
 * zählt nicht (Editoren setzen es).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'

const WURZEL = process.cwd()

/** Bildzeichen nach Unicode, dazu Haken und Kreuze, die dort nicht mitzählen. */
const BILDZEICHEN = /\p{Extended_Pictographic}|[✓✗]/gu
/** Schriftzeichen, die Unicode ebenfalls als Bildzeichen führt. */
const SCHRIFTZEICHEN = new Set(['©', '®', '™'])

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

/** Steht der Knoten in einem Aufruf von console.* — also in einem Server-Log? */
function imLog(knoten: ts.Node): boolean {
  for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) {
    if (ts.isCallExpression(k) && ts.isPropertyAccessExpression(k.expression)) {
      if (k.expression.expression.getText() === 'console') return true
    }
  }
  return false
}

/** Emojis in Zeichenketten, Vorlagen und JSX-Text — Kommentare und Logs zählen nicht. */
function findeEmojis(quelltext: string, pfad = 'schnipsel.tsx'): string[] {
  const art = pfad.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const datei = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, art)
  const funde: string[] = []
  const besuche = (knoten: ts.Node): void => {
    let text: string | null = null
    if (ts.isStringLiteral(knoten) || ts.isNoSubstitutionTemplateLiteral(knoten)) text = knoten.text
    else if (ts.isTemplateHead(knoten) || ts.isTemplateMiddle(knoten) || ts.isTemplateTail(knoten)) text = knoten.text
    else if (ts.isJsxText(knoten)) text = knoten.text
    if (text !== null && !imLog(knoten)) {
      const zeichen = [...text.matchAll(BILDZEICHEN)].map((m) => m[0]).filter((z) => !SCHRIFTZEICHEN.has(z))
      if (zeichen.length > 0) {
        const zeile = datei.getLineAndCharacterOfPosition(knoten.getStart(datei)).line + 1
        funde.push(`${pfad}:${zeile} ${zeichen.join(' ')}`)
      }
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return funde
}

describe('keine Emojis', () => {
  it('Gegenprobe: findet Emojis in Text, Zeichenkette und Vorlage — nicht in Kommentaren, Logs und ©', () => {
    const schnipsel = [
      '// 🌱 ein Kommentar zählt nicht',
      'const a = <div className="text-5xl">📬</div>',
      "const b = { ONLINE: '💳 Online' }",
      'const c = `Hallo ${name}! 🌿`',
      "const d = aktiv ? '✓ Anderer Weg' : 'Anderer Weg'",
      'console.log(`[E-Mail] ✓ Gesendet`)',
      'const e = <p>© OpenStreetMap</p>',
      "const f = 'Alle →'",
    ].join('\n')
    expect(findeEmojis(schnipsel)).toEqual([
      'schnipsel.tsx:2 📬',
      'schnipsel.tsx:3 💳',
      'schnipsel.tsx:4 🌿',
      'schnipsel.tsx:5 ✓',
    ])
  })

  it('kein Emoji in Oberfläche, Mails, WhatsApp-Nachricht und Story-Grafik', () => {
    const funde = [...quelldateien(join(WURZEL, 'src'))].flatMap((pfad) =>
      findeEmojis(readFileSync(pfad, 'utf8'), relative(WURZEL, pfad))
    )
    expect(funde).toEqual([])
  })
})

/** Das Zeichen, das hier gesucht wird, steht nie als Zeichen im Quelltext dieser Datei — nur als Escape. */
const BOM = '\uFEFF'
const TEXTDATEI = /\.(ts|tsx|mjs|js|css|json|md|sql)$/

function* textdateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* textdateien(pfad)
    else if (TEXTDATEI.test(name)) yield pfad
  }
}

/** Zeilen (1-basiert), in denen mitten im Text ein U+FEFF steht — am Dateianfang nicht. */
function bomMittenImText(text: string): number[] {
  const zeilen: number[] = []
  for (let i = text.indexOf(BOM, 1); i !== -1; i = text.indexOf(BOM, i + 1)) {
    zeilen.push(text.slice(0, i).split('\n').length)
  }
  return zeilen
}

describe('kein unsichtbares BOM mitten in Dateien (Regelvorschlag 103)', () => {
  it('Gegenprobe: findet ein BOM in einer Zeichenkette und in einer Vorlage — nicht am Dateianfang', () => {
    expect(bomMittenImText(`const a = 1\nconst b = \`${BOM}\${x}\`\n`)).toEqual([2])
    expect(bomMittenImText(`x.replace(/^${BOM}/, '')`)).toEqual([1])
    expect(bomMittenImText(`${BOM}const a = 1\n`)).toEqual([])
    // als Escape geschrieben ist es sichtbar und ohne Befund
    expect(bomMittenImText('const b = `\\uFEFF${x}`')).toEqual([])
  })

  it('unter src/ und tests/ steht kein BOM mitten in einer Datei', () => {
    const funde = ['src', 'tests'].flatMap((ordner) =>
      [...textdateien(join(WURZEL, ordner))].flatMap((pfad) =>
        bomMittenImText(readFileSync(pfad, 'utf8')).map((zeile) => `${relative(WURZEL, pfad)}:${zeile}`)
      )
    )
    expect(funde, 'Ein unsichtbares U+FEFF mitten in der Datei — als Escape \\uFEFF schreiben.').toEqual([])
  }, 30_000)
})
