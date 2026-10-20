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
 *
 * Seit Nr. 119 (Register N21): Ein Testhof ist immer auch ausgenommen — nur so
 * bleiben alle Regeln, die `gruendungAusgenommen` lesen, für Testhöfe richtig.
 * Jedes `data` unter src/server, das `istTesthof: true` schreibt, schreibt im
 * selben Objekt `gruendungAusgenommen: true` und `gruendungPlatz: null`.
 * Gegenprobe: ein Markieren ohne Ausnahme schlägt an.
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
    // Nr. 116: Festschreiben, Freischaltung nach dem Festschreiben, Hinweis im Freischalt-Dialog.
    'festschreibenListe',
    'festschreibenBrauchtPlaetze',
    'zusageBeiFreischaltung',
    'freischaltHinweis',
  ],
  '@/lib/admin-hoefe-seite': ['platzBeiFreischaltung', 'gruendungAenderung', 'testhofAenderung'],
}

/** Die beiden erlaubten Quellen der Hofliste. */
const LADER = new Set(['ladeHoefeFuerGruendung', 'getAdminFarms', 'ladeHoefeFuerFestschreiben'])

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

  it('beide Selects tragen gruendungAusgenommen und den festgeschriebenen Platz (Nr. 116)', () => {
    const quelle = readFileSync(join(WURZEL, 'src/server/queries/admin.ts'), 'utf8')
    const hofFuerGruendung = quelle.slice(quelle.indexOf('const HOF_FUER_GRUENDUNG = {'), quelle.indexOf('} satisfies Prisma.FarmSelect'))
    expect(hofFuerGruendung).toMatch(/^\s*gruendungAusgenommen: true,$/m)
    expect(hofFuerGruendung).toMatch(/^\s*gruendungPlatz: true,$/m)
    const start = quelle.indexOf('export async function getAdminFarms(')
    const select = quelle.slice(start, quelle.indexOf("orderBy: { createdAt: 'desc' }", start))
    expect(select).toMatch(/^\s*gruendungAusgenommen: true,$/m)
    expect(select).toMatch(/^\s*gruendungPlatz: true,$/m)
    // Beide setzen die geltende Vergabe an jede Zeile — sonst rechneten Admin › Höfe und Finanzen nach der Reihenfolge.
    expect(quelle.slice(start)).toMatch(/gruendungFest: fest/)
    expect(quelle.slice(quelle.indexOf('export async function ladeHoefeFuerGruendung('))).toMatch(/gruendungFest: fest/)
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

/** Je `data`-Objekt mit `istTesthof: true`: schreibt es auch die Ausnahme und gibt den Platz frei? */
function testhofOhneAusnahme(quelltext: string, name = 'datei.ts'): number[] {
  const datei = ts.createSourceFile(name, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const zeilen: number[] = []
  const wert = (objekt: ts.ObjectLiteralExpression, schluessel: string): ts.Expression | undefined =>
    objekt.properties.find((e): e is ts.PropertyAssignment => ts.isPropertyAssignment(e) && ts.isIdentifier(e.name) && e.name.text === schluessel)?.initializer
  const besuche = (k: ts.Node): void => {
    if (ts.isPropertyAssignment(k) && ts.isIdentifier(k.name) && k.name.text === 'data' && ts.isObjectLiteralExpression(k.initializer)) {
      const daten = k.initializer
      if (wert(daten, 'istTesthof')?.kind === ts.SyntaxKind.TrueKeyword) {
        const ausgenommen = wert(daten, 'gruendungAusgenommen')?.kind === ts.SyntaxKind.TrueKeyword
        const platzFrei = wert(daten, 'gruendungPlatz')?.kind === ts.SyntaxKind.NullKeyword
        if (!ausgenommen || !platzFrei) zeilen.push(datei.getLineAndCharacterOfPosition(k.getStart(datei)).line + 1)
      }
    }
    ts.forEachChild(k, besuche)
  }
  besuche(datei)
  return zeilen
}

describe('Wache: ein Testhof ist immer auch ausgenommen (Register N21, Nr. 119)', () => {
  it('jedes data unter src/server mit istTesthof: true schreibt gruendungAusgenommen: true und gruendungPlatz: null', () => {
    const funde = dateien(join(WURZEL, 'src/server'))
      .map((pfad) => ({ pfad: relative(WURZEL, pfad).split('\\').join('/'), text: readFileSync(pfad, 'utf8') }))
      .filter((d) => d.text.includes('istTesthof'))
    const verstoesse = funde.flatMap((d) => testhofOhneAusnahme(d.text, d.pfad).map((z) => `${d.pfad}:${z}`))
    expect(verstoesse).toEqual([])
    // Die Wache sieht das Markieren tatsächlich.
    expect(funde.map((d) => d.pfad)).toContain('src/server/actions/gruendung.ts')
  })

  it('Gegenprobe: Markieren ohne Ausnahme oder ohne freien Platz schlägt an, Zurücknehmen nicht', () => {
    expect(testhofOhneAusnahme('tx.farm.updateMany({ data: { istTesthof: true } })')).toEqual([1])
    expect(testhofOhneAusnahme('tx.farm.updateMany({ data: { istTesthof: true, gruendungAusgenommen: true } })')).toEqual([1])
    expect(testhofOhneAusnahme('tx.farm.updateMany({ data: { istTesthof: true, gruendungAusgenommen: true, gruendungPlatz: null } })')).toEqual([])
    expect(testhofOhneAusnahme('tx.farm.updateMany({ data: { istTesthof: false } })')).toEqual([])
  })
})
