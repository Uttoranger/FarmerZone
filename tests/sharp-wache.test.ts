/**
 * Wache: Fremde Bytes erreichen sharp nur über die Prüfung (Sicherheitsupdate 20.10.2026).
 *
 * Regel (ARCHITECTURE §5, Uploads): `/api/upload/verarbeiten` gibt Bytes an
 * sharp nur über `ladeErlaubtesBild`, das vorher `formatFuerSharp` fragt. Die
 * Sperre der fremden Lader (`sperreFremdeLader`) gilt für den ganzen Prozess
 * und steht deshalb nur in dieser Route. Die Verhaltenstests
 * (tests/upload-bildformat.test.ts) prüfen die heutigen Wege; ein dritter
 * `sharp(…)` für einen neuen Zweck bliebe dort grün — hier nicht.
 *
 * Beweist (TypeScript-Syntaxbaum):
 *  - In der Route gibt es genau einen Aufruf des sharp-Imports, und er steht in
 *    `ladeErlaubtesBild`. `sharp.block(…)` und Kommentare zählen nicht.
 *  - `sperreFremdeLader(…)` ruft unter src/ nur diese Route auf.
 *  - sharp importieren unter src/ nur die benannten Dateien, je mit Grund.
 *  - Gegenprobe: Die Suche schlägt an Schnipseln an und übersieht keinen Aufruf.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'

const WURZEL = process.cwd()
const ROUTE = 'src/app/api/upload/verarbeiten/route.ts'

/** Wer sharp lädt, und warum dort nur eigene oder geprüfte Bytes ankommen. */
const SHARP_NUTZER: Record<string, string> = {
  [ROUTE]: 'Hochgeladene Originale — nur über ladeErlaubtesBild (formatFuerSharp), Lader gesperrt.',
  'src/app/(public)/[farmSlug]/opengraph-image/route.tsx': 'Wandelt das PNG von ImageResponse in JPEG — eigene Bytes, keine fremden.',
  'src/lib/teilen-bild-quellen.ts': 'Fotos aus dem eigenen Zielordner (nur die Upload-Route schreibt dorthin, als WebP), vorher bildFormat; Illustrationen aus public/.',
}

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

function syntaxbaum(quelltext: string, pfad: string): ts.SourceFile {
  const art = pfad.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, art)
}

/** Lädt der Quelltext sharp — statisch, dynamisch oder per require? */
function laedtSharp(quelltext: string, pfad = 'schnipsel.ts'): boolean {
  let gefunden = false
  const besuche = (k: ts.Node): void => {
    if (ts.isImportDeclaration(k) && ts.isStringLiteral(k.moduleSpecifier) && k.moduleSpecifier.text === 'sharp' && !k.importClause?.isTypeOnly) gefunden = true
    if (ts.isCallExpression(k) && k.arguments.length === 1 && ts.isStringLiteralLike(k.arguments[0]) && k.arguments[0].text === 'sharp') {
      if (k.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(k.expression) && k.expression.text === 'require')) gefunden = true
    }
    ts.forEachChild(k, besuche)
  }
  besuche(syntaxbaum(quelltext, pfad))
  return gefunden
}

/** Die Aufrufe des sharp-Imports — je mit dem Namen der Funktion, in der sie stehen. */
function sharpAufrufe(quelltext: string, pfad = 'schnipsel.ts'): string[] {
  const datei = syntaxbaum(quelltext, pfad)
  const namen = new Set<string>()
  for (const anweisung of datei.statements) {
    if (ts.isImportDeclaration(anweisung) && ts.isStringLiteral(anweisung.moduleSpecifier) && anweisung.moduleSpecifier.text === 'sharp') {
      if (anweisung.importClause?.name) namen.add(anweisung.importClause.name.text)
    }
  }
  const orte: string[] = []
  const besuche = (k: ts.Node, funktion: string): void => {
    let hier = funktion
    if (ts.isFunctionDeclaration(k) && k.name) hier = k.name.text
    if (ts.isVariableDeclaration(k) && ts.isIdentifier(k.name) && k.initializer && (ts.isArrowFunction(k.initializer) || ts.isFunctionExpression(k.initializer))) hier = k.name.text
    // Auch `new sharp(…)` ruft sharp auf (der Typecheck lehnt es heute ab, die Wache zählt es trotzdem).
    if ((ts.isCallExpression(k) || ts.isNewExpression(k)) && ts.isIdentifier(k.expression) && namen.has(k.expression.text)) orte.push(hier)
    ts.forEachChild(k, (kind) => besuche(kind, hier))
  }
  besuche(datei, '(Modul)')
  return orte
}

/** Wo `sperreFremdeLader(…)` aufgerufen wird (nicht definiert). */
function rufeSperre(quelltext: string, pfad = 'schnipsel.ts'): number {
  let anzahl = 0
  const besuche = (k: ts.Node): void => {
    if (ts.isCallExpression(k) && ts.isIdentifier(k.expression) && k.expression.text === 'sperreFremdeLader') anzahl++
    ts.forEachChild(k, besuche)
  }
  besuche(syntaxbaum(quelltext, pfad))
  return anzahl
}

const QUELLEN = [...quelldateien(join(WURZEL, 'src'))].map((pfad) => ({
  pfad: relative(WURZEL, pfad).split(sep).join('/'),
  text: readFileSync(pfad, 'utf8'),
}))

describe('Wache: sharp sieht nur geprüfte Bytes', () => {
  it('die Verarbeitungs-Route ruft sharp genau einmal, in ladeErlaubtesBild', () => {
    const route = QUELLEN.find((q) => q.pfad === ROUTE)
    expect(route, ROUTE).toBeDefined()
    expect(sharpAufrufe(route!.text, ROUTE)).toEqual(['ladeErlaubtesBild'])
  })

  it('die Lader-Sperre ruft nur die Verarbeitungs-Route auf', () => {
    const treffer = QUELLEN.filter((q) => rufeSperre(q.text, q.pfad) > 0).map((q) => q.pfad)
    expect(treffer).toEqual([ROUTE])
  })

  it('sharp laden nur die benannten Dateien', () => {
    const treffer = QUELLEN.filter((q) => laedtSharp(q.text, q.pfad)).map((q) => q.pfad).sort()
    expect(treffer).toEqual(Object.keys(SHARP_NUTZER).sort())
  })
})

describe('Gegenprobe an Schnipseln', () => {
  it('findet einen zweiten Aufruf außerhalb von ladeErlaubtesBild', () => {
    const schnipsel = `import sharp from 'sharp'
function ladeErlaubtesBild(b: ArrayBuffer) { return sharp(Buffer.from(b)) }
async function neuerZweck(b: ArrayBuffer) { return sharp(Buffer.from(b)).toBuffer() }
const pfeil = (b: Buffer) => sharp(b)
function mitNew(b: Buffer) { return new sharp(b) }`
    expect(sharpAufrufe(schnipsel)).toEqual(['ladeErlaubtesBild', 'neuerZweck', 'pfeil', 'mitNew'])
  })

  it('zählt sharp.block, Kommentare und Text nicht mit', () => {
    const schnipsel = `import sharp from 'sharp'
// vor JEDEM sharp() die Prüfung
sharp.block({ operation: ['VipsForeignLoad'] })
const text = 'sharp(x)'`
    expect(sharpAufrufe(schnipsel)).toEqual([])
  })

  it('findet einen umbenannten Import', () => {
    expect(sharpAufrufe(`import bild from 'sharp'\nbild(Buffer.alloc(1))`)).toEqual(['(Modul)'])
  })

  it('erkennt jedes Laden von sharp, aber keinen reinen Typ-Import', () => {
    expect(laedtSharp(`import sharp from 'sharp'`)).toBe(true)
    expect(laedtSharp(`const { default: sharp } = await import('sharp')`)).toBe(true)
    expect(laedtSharp(`const sharp = require('sharp')`)).toBe(true)
    expect(laedtSharp(`import type { Sharp } from 'sharp'`)).toBe(false)
    expect(laedtSharp(`// import sharp from 'sharp'`)).toBe(false)
  })

  it('zählt Aufrufe der Sperre, nicht ihre Definition', () => {
    expect(rufeSperre(`export function sperreFremdeLader(s: unknown) {}`)).toBe(0)
    expect(rufeSperre(`import sharp from 'sharp'\nsperreFremdeLader(sharp)`)).toBe(1)
  })
})
