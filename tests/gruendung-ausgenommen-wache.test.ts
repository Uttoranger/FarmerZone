/**
 * Wache (Register K2, Nr. 109): Jede Hofliste, die die Platzvergabe füttert,
 * kommt aus HOF_FUER_GRUENDUNG (über ladeHoefeFuerGruendung) oder aus dem
 * Select von getAdminFarms — beide tragen gruendungAusgenommen. Eine dritte
 * Abfrage könnte das Feld selbst füllen (etwa mit `false`) und zählte dann
 * einen ausgenommenen Hof wieder mit.
 *
 * Geprüft am Syntaxbaum von TypeScript: Jede Datei unter src/ außerhalb von
 * src/lib (dort sind die Regeln rein und bekommen die Liste als Parameter), die
 * eine Regel der Platzvergabe einbindet, bindet auch einen der beiden Lader
 * ein; Ausnahmen nur mit Grund. Dazu tragen beide Selects das Feld. Gegenprobe:
 * Eine Datei mit eigener Abfrage schlägt an.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, it, expect } from 'vitest'

const WURZEL = process.cwd()

/** Die Regeln, die eine Hofliste der Platzvergabe brauchen. */
const PLATZ_REGELN: Record<string, readonly string[]> = {
  '@/lib/gruendungshof': [
    'gruendungsplaetze',
    'gruendungsplatzVon',
    'istGruendungshof',
    'vergebeneGruendungsplaetze',
    'bekaemePlatzBeiFreigabe',
    'bestimmeGruendungBis',
    'baueGruendungAnzeige',
    'fuerSeiten',
    'gruendungSeitenDaten',
    'voraussichtlicherPlatz',
    'gruendungsZusageBeiFreigabe',
    'folgenDerAenderung',
    'wiederAufnahmeMoeglich',
    'zaehleAusgenommene',
  ],
  '@/lib/admin-hoefe-seite': ['platzBeiFreischaltung', 'gruendungAenderung'],
}

/** Die beiden erlaubten Quellen der Hofliste. */
const LADER = new Set(['ladeHoefeFuerGruendung', 'getAdminFarms'])

/** Dateien, die eine Regel einbinden, ohne eine Hofliste zu laden — je mit Grund. */
const AUSNAHMEN: Record<string, string> = {
  'src/server/queries/admin.ts': 'definiert beide Lader selbst (HOF_FUER_GRUENDUNG und das Select von getAdminFarms)',
}

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) return dateien(pfad)
    return /\.tsx?$/.test(name) ? [pfad] : []
  })
}

/** Benannte Importe je Modul, aus dem Syntaxbaum. */
function importe(quelltext: string, name = 'datei.ts'): Map<string, string[]> {
  const datei = ts.createSourceFile(name, quelltext, ts.ScriptTarget.Latest, true, name.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const ergebnis = new Map<string, string[]>()
  for (const anweisung of datei.statements) {
    if (!ts.isImportDeclaration(anweisung) || !ts.isStringLiteral(anweisung.moduleSpecifier)) continue
    const gebunden = anweisung.importClause?.namedBindings
    if (!gebunden || !ts.isNamedImports(gebunden)) continue
    const namen = gebunden.elements.filter((e) => !e.isTypeOnly).map((e) => (e.propertyName ?? e.name).text)
    ergebnis.set(anweisung.moduleSpecifier.text, [...(ergebnis.get(anweisung.moduleSpecifier.text) ?? []), ...namen])
  }
  return ergebnis
}

/** Bindet die Datei eine Regel der Platzvergabe ein, aber keinen der beiden Lader? */
function ohneLader(quelltext: string, name?: string): boolean {
  const i = importe(quelltext, name)
  const nutztRegel = Object.entries(PLATZ_REGELN).some(([modul, regeln]) => (i.get(modul) ?? []).some((n) => regeln.includes(n)))
  const nutztLader = [...i.values()].flat().some((n) => LADER.has(n))
  return nutztRegel && !nutztLader
}

describe('Wache: die Platzvergabe bekommt ihre Höfe nur aus den zwei Selects', () => {
  it('jede Datei unter src/ außerhalb von src/lib, die eine Regel einbindet, lädt die Höfe über einen der beiden Lader', () => {
    const verstoesse = dateien(join(WURZEL, 'src'))
      .map((pfad) => relative(WURZEL, pfad).split('\\').join('/'))
      .filter((pfad) => !pfad.startsWith('src/lib/') && !(pfad in AUSNAHMEN))
      .filter((pfad) => ohneLader(readFileSync(join(WURZEL, pfad), 'utf8'), pfad))
    expect(verstoesse).toEqual([])
  }, 30_000) // liest und parst jede Datei unter src/

  it('beide Selects tragen gruendungAusgenommen', () => {
    const quelle = readFileSync(join(WURZEL, 'src/server/queries/admin.ts'), 'utf8')
    const hofFuerGruendung = quelle.slice(quelle.indexOf('const HOF_FUER_GRUENDUNG = {'), quelle.indexOf('} satisfies Prisma.FarmSelect'))
    expect(hofFuerGruendung).toMatch(/^\s*gruendungAusgenommen: true,$/m)
    const start = quelle.indexOf('export async function getAdminFarms(')
    const select = quelle.slice(start, quelle.indexOf("orderBy: { createdAt: 'desc' }", start))
    expect(select).toMatch(/^\s*gruendungAusgenommen: true,$/m)
  })

  it('Gegenprobe: eine eigene Abfrage vor gruendungsplaetze schlägt an, ein Lader nicht', () => {
    const eigene = [
      "import { prisma } from '@/lib/prisma'",
      "import { gruendungsplaetze } from '@/lib/gruendungshof'",
      'const hoefe = await prisma.farm.findMany({ select: { id: true } })',
    ].join('\n')
    expect(ohneLader(eigene)).toBe(true)
    expect(ohneLader(eigene.replace("import { prisma } from '@/lib/prisma'", "import { getAdminFarms } from '@/server/queries/admin'"))).toBe(false)
    // Auch unter anderem Namen eingebunden und aus admin-hoefe-seite.
    expect(ohneLader("import { gruendungsplatzVon as platz } from '@/lib/gruendungshof'")).toBe(true)
    expect(ohneLader("import { platzBeiFreischaltung } from '@/lib/admin-hoefe-seite'")).toBe(true)
    // Ein reiner Typ-Import ist keine Regel.
    expect(ohneLader("import { type HofFuerPlatz } from '@/lib/gruendungshof'")).toBe(false)
  })
})
