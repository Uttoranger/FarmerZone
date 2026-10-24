/**
 * Wache: Keine Action ruft eine Action (Regelvorschlag 154, Nachtlauf 24, Nr. 164, Punkt 7).
 *
 * Eine Action ist ein öffentlicher Endpunkt mit eigener Sitzungs- und
 * Rechteprüfung. Ruft eine Datei unter src/server/actions/ eine zweite
 * Action auf, läuft die Prüfung doppelt oder — schlimmer — gar nicht, weil
 * die innere sich auf die äußere verlässt. Gemeinsame Arbeit gehört in eine
 * Datei unter src/server/ (kein 'use server'), die beide aufrufen.
 *
 * Geprüft am Syntaxbaum von TypeScript: Import, Re-Export und dynamisches
 * import() einer Datei unter @/server/actions/ oder per relativem Pfad.
 * Die Bestandsliste nimmt nur ab: Heute ist sie leer; ein Eintrag, der nicht
 * mehr verstößt, muss gestrichen werden.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const WURZEL = process.cwd()
const ACTIONS = 'src/server/actions'

/** Datei -> Anzahl der Verstöße, die bis zur Behebung geduldet sind. Nur Streichen, nie Ergänzen. */
const BESTAND: Record<string, number> = {}

/** Alle Quellen, aus denen die Datei lädt: Import, Re-Export, import(). */
function ladeAus(quelle: string): string[] {
  const datei = ts.createSourceFile('pruefling.ts', quelle, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const ziele: string[] = []
  const besuche = (k: ts.Node): void => {
    if ((ts.isImportDeclaration(k) || ts.isExportDeclaration(k)) && k.moduleSpecifier && ts.isStringLiteral(k.moduleSpecifier)) {
      ziele.push(k.moduleSpecifier.text)
    }
    if (ts.isCallExpression(k) && k.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = k.arguments[0]
      if (arg && ts.isStringLiteralLike(arg)) ziele.push(arg.text)
    }
    ts.forEachChild(k, besuche)
  }
  besuche(datei)
  return ziele
}

/** Eine Quelle zeigt in den Ordner der Actions: mit dem Alias oder relativ aus der Datei dort. */
function istAction(ziel: string): boolean {
  return ziel === '@/server/actions' || ziel.startsWith('@/server/actions/') || ziel.startsWith('./') || ziel.startsWith('../')
}

function verstoesse(quelle: string): string[] {
  return ladeAus(quelle).filter(istAction)
}

function dateien(): string[] {
  return readdirSync(join(WURZEL, ACTIONS), { recursive: true, encoding: 'utf8' })
    .filter((p) => /\.tsx?$/.test(p))
    .map((p) => `${ACTIONS}/${p}`)
}

describe('Keine Action importiert eine Action', () => {
  it('es gibt Dateien zu prüfen', () => {
    expect(dateien().length).toBeGreaterThan(20)
  })

  it.each(dateien())('%s', (pfad) => {
    const gefunden = verstoesse(readFileSync(join(WURZEL, pfad), 'utf8'))
    expect(gefunden, `Gemeinsames gehört nach src/server/ (ohne 'use server'), nicht in eine Action`).toHaveLength(BESTAND[pfad] ?? 0)
  })

  it('die Bestandsliste schrumpft nur: jeder Eintrag verstößt noch und existiert', () => {
    for (const [pfad, anzahl] of Object.entries(BESTAND)) {
      expect(verstoesse(readFileSync(join(WURZEL, pfad), 'utf8')).length, pfad).toBe(anzahl)
    }
  })
})

describe('Gegenproben — die Suche schlägt an', () => {
  it('Import mit Alias, Re-Export, relativer Import und dynamischer Import', () => {
    expect(verstoesse("import { a } from '@/server/actions/farm'")).toEqual(['@/server/actions/farm'])
    expect(verstoesse("export { a } from '@/server/actions/farm'")).toHaveLength(1)
    expect(verstoesse("import { a } from './farm'")).toHaveLength(1)
    expect(verstoesse("const m = await import('../actions/farm')")).toHaveLength(1)
    expect(verstoesse("import type { T } from '@/server/actions/farm'")).toHaveLength(1)
  })

  it('Gegenprobe: gemeinsamer Code unter src/server/ und Bibliotheken sind erlaubt, ein Kommentar zählt nicht', () => {
    expect(verstoesse("import { a } from '@/server/hofbereich'\nimport { b } from '@/lib/x'\nimport z from 'zod'")).toEqual([])
    expect(verstoesse("// import { a } from '@/server/actions/farm'\nconst x = 1")).toEqual([])
  })
})
