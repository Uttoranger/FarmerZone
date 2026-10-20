/**
 * Wache (Register K2, Änderung Nr. 116): Jede Server Action, die `approvedAt`
 * SETZT oder `gruendungAusgenommen` bzw. `gruendungPlatz` schreibt, nimmt
 * GRUENDUNGSPLAETZE_SPERRE — ebenso `reactivateFarm` (sie bringt einen Hof in
 * die Vergabe zurück) und `speichereGruendungEinstellung`. Ohne die Sperre
 * könnten zwei Wege gleichzeitig denselben letzten Platz vergeben.
 * `archiveFarm` und `revokeFarmApprovalAction` ändern keinen Platz (sie setzen
 * nur `archivedAt` bzw. `approvedAt: null`) und brauchen sie nicht. Seit Nr. 119
 * (Register N21) zählt auch `istTesthof`: Markieren gibt einen Platz frei,
 * Zurücknehmen öffnet den Weg zur Wiederaufnahme — beide unter der Sperre.
 *
 * Geprüft am Syntaxbaum von TypeScript: je Funktion in src/server/actions/ die
 * Eigenschaften `approvedAt` (Wert nicht `null`), `gruendungAusgenommen`,
 * `gruendungPlatz`, `istTesthof` in einem Objekt unter `data`; trifft eine zu, muss die
 * Funktion die Sperre nennen. Gegenprobe mit Attrappen.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, it, expect } from 'vitest'

const ORDNER = join(process.cwd(), 'src/server/actions')
const PFLICHT_AUCH_OHNE_SCHREIBEN = ['reactivateFarm', 'speichereGruendungEinstellung']

type Fund = { name: string; schreibt: boolean; sperre: boolean }

/** Je Funktion: schreibt sie Platz, Ausnahme oder eine Freischaltung — und nennt sie die Sperre? */
function funktionen(quelltext: string): Fund[] {
  const datei = ts.createSourceFile('a.ts', quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const funde: Fund[] = []
  const schreibtIn = (knoten: ts.Node): boolean => {
    let treffer = false
    const besuche = (k: ts.Node): void => {
      if (ts.isPropertyAssignment(k) && ts.isIdentifier(k.name) && k.name.text === 'data' && ts.isObjectLiteralExpression(k.initializer)) {
        for (const eigenschaft of k.initializer.properties) {
          if (!ts.isPropertyAssignment(eigenschaft) || !ts.isIdentifier(eigenschaft.name)) continue
          const name = eigenschaft.name.text
          if (name === 'gruendungAusgenommen' || name === 'gruendungPlatz' || name === 'istTesthof') treffer = true
          if (name === 'approvedAt' && eigenschaft.initializer.kind !== ts.SyntaxKind.NullKeyword) treffer = true
        }
      }
      ts.forEachChild(k, besuche)
    }
    besuche(knoten)
    return treffer
  }
  const besuche = (k: ts.Node): void => {
    if (ts.isFunctionDeclaration(k) && k.name && k.body) {
      funde.push({ name: k.name.text, schreibt: schreibtIn(k.body), sperre: k.body.getText(datei).includes('GRUENDUNGSPLAETZE_SPERRE') })
    }
    ts.forEachChild(k, besuche)
  }
  besuche(datei)
  return funde
}

const alle = readdirSync(ORDNER)
  .filter((n) => n.endsWith('.ts'))
  .flatMap((n) => funktionen(readFileSync(join(ORDNER, n), 'utf8')).map((f) => ({ ...f, datei: n })))

describe('Wache: wer Plätze vergeben kann, nimmt die Sperre der Gründungsplätze', () => {
  it('jede Action, die approvedAt setzt oder Ausnahme bzw. Platz schreibt, nennt GRUENDUNGSPLAETZE_SPERRE', () => {
    const ohne = alle.filter((f) => f.schreibt && !f.sperre).map((f) => `${f.datei}: ${f.name}`)
    expect(ohne).toEqual([])
  })

  it('reactivateFarm und speichereGruendungEinstellung nehmen sie ebenfalls', () => {
    for (const name of PFLICHT_AUCH_OHNE_SCHREIBEN) expect(alle.find((f) => f.name === name)?.sperre, name).toBe(true)
  })

  it('die Wache sieht die Wege tatsächlich — Freischalten, Ausnehmen, Wiederaufnahme, Festschreiben schreiben', () => {
    for (const name of ['approveFarmAction', 'nimmAusGruendung', 'nimmWiederAuf', 'schreibeZusagenFest', 'markiereAlsTesthof', 'nimmTesthofZurueck']) {
      expect(alle.find((f) => f.name === name)?.schreibt, name).toBe(true)
    }
    // archiveFarm und revokeFarmApprovalAction schreiben keinen Platz — sie brauchen keine Sperre.
    expect(alle.find((f) => f.name === 'revokeFarmApprovalAction')?.schreibt).toBe(false)
    expect(alle.find((f) => f.name === 'archiveFarm')?.schreibt).toBe(false)
  })

  it('Gegenprobe: ein Schreiben ohne Sperre schlägt an, mit Sperre und approvedAt: null nicht', () => {
    const ohne = funktionen("export async function x() { await prisma.farm.update({ where: {}, data: { gruendungPlatz: 3 } }) }")
    expect(ohne).toEqual([{ name: 'x', schreibt: true, sperre: false }])
    const mit = funktionen(
      'export async function y() { await tx.$executeRaw`SELECT pg_advisory_xact_lock(${GRUENDUNGSPLAETZE_SPERRE})`; await tx.farm.updateMany({ data: { approvedAt: new Date() } }) }'
    )
    expect(mit).toEqual([{ name: 'y', schreibt: true, sperre: true }])
    expect(funktionen('export async function z() { await prisma.farm.update({ data: { approvedAt: null } }) }')[0]?.schreibt).toBe(false)
    // Nr. 119: Auch nur das Testhof-Merkmal zu schreiben verlangt die Sperre (Zurücknehmen schreibt nichts anderes).
    expect(funktionen('export async function t() { await prisma.farm.updateMany({ data: { istTesthof: false } }) }')).toEqual([{ name: 't', schreibt: true, sperre: false }])
  })
})
