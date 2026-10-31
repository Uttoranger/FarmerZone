/**
 * Aufrufer-Wache für Server Actions (Nr. 199, Audit A1 „Rollenwechsel ohne Prüfung“).
 *
 * Ursache: `setFarmerRole` stand exportiert in src/server/actions/register.ts, „für spätere Verwendung“, ohne einen
 * einzigen Aufrufer. Jeder Export einer `'use server'`-Datei ist trotzdem ein öffentlicher Endpunkt: Next.js gibt ihm
 * eine Kennung, und wer sie kennt, ruft ihn per POST auf — auch wenn keine Seite einen Knopf dafür hat. Diese Action
 * setzte die Rolle der eigenen Sitzung ohne jede weitere Prüfung auf FARMER. Eine Action ohne Aufrufer prüft niemand
 * mehr, wenn sich die Regeln um sie herum ändern.
 *
 * Beweist (Quelltext von `src/`, TypeScript-Syntaxbaum, kein Netz): Jede exportierte Funktion einer Datei unter
 * `src/server/actions/`, die mit `'use server'` beginnt, hat mindestens einen Aufrufer unter `src/` AUSSERHALB ihrer
 * eigenen Datei. Ein Aufrufer ist eine Datei, die den Namen aus genau dieser Action-Datei importiert (`@/…` oder
 * relativ, auch umbenannt, auch weitergereicht mit `export { … } from`) und den importierten Namen außerhalb der
 * Import-Zeile benutzt; bei `import * as x` zählt `x.name`. Ausnahmen stehen in AUFRUFER_BESTAND (je Datei und Name
 * mit Grund). Der Bestand schrumpft: Ein Eintrag, der einen Aufrufer bekommen hat oder den es nicht mehr gibt, macht
 * die Wache rot (veraltet). Tests zählen nicht als Aufrufer, Kommentare und Texte auch nicht (Syntaxbaum).
 *
 * GRENZE: Ein dynamischer Import (`await import('@/server/actions/…')`) zählt nicht als Aufrufer — es gibt heute
 * keinen; wer einen braucht, trägt die Action mit Grund in den Bestand ein. Ob der Aufrufer selbst erreichbar ist
 * (eine Seite, die niemand verlinkt), sieht die Wache nicht; ebenso wenig, ob eine Datei, die eine Action mit
 * `export { … } from` weiterreicht, selbst benutzt wird.
 *
 * Gegenprobe (Text-Attrappen, keine Datei im Repository wird verändert): eine erfundene exportierte Action ohne
 * Aufrufer, eine nur im Kommentar oder Text genannte, eine nur in der eigenen Datei gerufene und eine nur importierte,
 * aber nie oder nur als Eigenschaftsname benutzte schlagen an; ein benannter, ein umbenannter, ein relativer, ein weitergereichter und ein Import
 * über `* as` nicht, ebenso wenig eine Datei ohne `'use server'`. Ein veralteter Bestandseintrag macht die Wache rot.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, posix, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()
const ACTIONS = 'src/server/actions/'

type Eintrag = { datei: string; name: string; grund: string }

/** Exportierte Actions ohne Aufrufer unter `src/`. Nur schrumpfen. */
const AUFRUFER_BESTAND: readonly Eintrag[] = [
  {
    datei: 'src/server/actions/farm-photos.ts',
    name: 'reorderPhotosAction',
    grund:
      'Fund Lauf 27: nur aus moveFarmPhotoAction derselben Datei gerufen, keine Komponente importiert sie; ' +
      'ändert nur die Reihenfolge der Fotos des eigenen Hofs (Besitz geprüft), keine Rolle, kein Admin, kein Geld',
  },
]

/** Alle `.ts`/`.tsx` unter `ordner`, als Pfad ab der Wurzel mit `/`. */
function quelldateien(ordner: string): string[] {
  const ergebnis: string[] = []
  for (const eintrag of readdirSync(ordner, { withFileTypes: true })) {
    const pfad = join(ordner, eintrag.name)
    if (eintrag.isDirectory()) ergebnis.push(...quelldateien(pfad))
    else if (/\.tsx?$/.test(eintrag.name)) ergebnis.push(relative(WURZEL, pfad).split(sep).join('/'))
  }
  return ergebnis
}

function parse(datei: string, quelltext: string): ts.SourceFile {
  const art = datei.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(datei, quelltext, ts.ScriptTarget.Latest, true, art)
}

function istServerDatei(sf: ts.SourceFile): boolean {
  const erste = sf.statements[0]
  return !!erste && ts.isExpressionStatement(erste) && ts.isStringLiteral(erste.expression) && erste.expression.text === 'use server'
}

function hatExport(k: ts.Node): boolean {
  return ts.canHaveModifiers(k) && !!ts.getModifiers(k)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}

/** Namen aller exportierten Funktionen (Deklaration, `export const f = …`, `export { f }`); Typen zählen nicht. */
function exportierteFunktionen(sf: ts.SourceFile): string[] {
  const namen: string[] = []
  for (const s of sf.statements) {
    if (ts.isFunctionDeclaration(s) && hatExport(s) && s.name) namen.push(s.name.text)
    else if (ts.isVariableStatement(s) && hatExport(s)) {
      for (const d of s.declarationList.declarations) if (ts.isIdentifier(d.name)) namen.push(d.name.text)
    } else if (ts.isExportDeclaration(s) && !s.isTypeOnly && !s.moduleSpecifier && s.exportClause && ts.isNamedExports(s.exportClause)) {
      for (const e of s.exportClause.elements) if (!e.isTypeOnly) namen.push(e.name.text)
    }
  }
  return namen
}

/** Löst `@/…` und relative Angaben zu einem Pfad ab der Wurzel auf; Pakete → null. */
function zielpfad(von: string, angabe: string, vorhanden: ReadonlySet<string>): string | null {
  let basis: string
  if (angabe.startsWith('@/')) basis = 'src/' + angabe.slice(2)
  else if (angabe.startsWith('.')) basis = posix.normalize(posix.join(dirname(von).split(sep).join('/'), angabe))
  else return null
  for (const kandidat of [basis, `${basis}.ts`, `${basis}.tsx`, `${basis}/index.ts`, `${basis}/index.tsx`]) {
    if (vorhanden.has(kandidat)) return kandidat
  }
  return null
}

/** Ob `name` in `sf` als Bezeichner außerhalb jeder Import-/Export-Zeile vorkommt. */
function wirdBenutzt(sf: ts.SourceFile, name: string): boolean {
  let gefunden = false
  function besuche(k: ts.Node, eltern?: ts.Node): void {
    if (gefunden || ts.isImportDeclaration(k)) return
    // Ein Eigenschaftsname (`obj.name`, `{ name: 1 }`) ist nicht der importierte Name.
    const eigenschaft = !!eltern && (ts.isPropertyAccessExpression(eltern) || ts.isPropertyAssignment(eltern)) && eltern.name === k
    if (ts.isIdentifier(k) && k.text === name && !eigenschaft) {
      gefunden = true
      return
    }
    ts.forEachChild(k, (kind) => besuche(kind, k))
  }
  besuche(sf)
  return gefunden
}

/** Ob `x.name` in `sf` vorkommt (Zugriff über einen Namensraum-Import). */
function wirdUeberNamensraumBenutzt(sf: ts.SourceFile, namensraum: string, name: string): boolean {
  let gefunden = false
  function besuche(k: ts.Node): void {
    if (gefunden) return
    if (ts.isPropertyAccessExpression(k) && ts.isIdentifier(k.expression) && k.expression.text === namensraum && k.name.text === name) {
      gefunden = true
      return
    }
    ts.forEachChild(k, besuche)
  }
  besuche(sf)
  return gefunden
}

/** Schlüssel `datei#name` aller benutzten Importe aus Action-Dateien, je importierender Datei. */
function benutzteImporte(datei: string, sf: ts.SourceFile, actionDateien: ReadonlySet<string>, vorhanden: ReadonlySet<string>): Set<string> {
  const benutzt = new Set<string>()
  for (const s of sf.statements) {
    const angabe = (ts.isImportDeclaration(s) || ts.isExportDeclaration(s)) && s.moduleSpecifier && ts.isStringLiteral(s.moduleSpecifier) ? s.moduleSpecifier.text : null
    if (!angabe) continue
    const ziel = zielpfad(datei, angabe, vorhanden)
    if (!ziel || ziel === datei || !actionDateien.has(ziel)) continue
    if (ts.isExportDeclaration(s)) {
      // Weitergereicht (`export { a } from …`): Die Action ist von außerhalb ihrer Datei erreichbar gemacht.
      if (s.exportClause && ts.isNamedExports(s.exportClause)) {
        for (const e of s.exportClause.elements) benutzt.add(`${ziel}#${(e.propertyName ?? e.name).text}`)
      }
      continue
    }
    if (!ts.isImportDeclaration(s)) continue
    const klausel = s.importClause
    if (!klausel || klausel.isTypeOnly || !klausel.namedBindings) continue
    if (ts.isNamespaceImport(klausel.namedBindings)) {
      benutzt.add(`${ziel}#*${klausel.namedBindings.name.text}`)
      continue
    }
    for (const e of klausel.namedBindings.elements) {
      if (e.isTypeOnly) continue
      if (wirdBenutzt(sf, e.name.text)) benutzt.add(`${ziel}#${(e.propertyName ?? e.name).text}`)
    }
  }
  return benutzt
}

/** Alle exportierten Actions ohne Aufrufer außerhalb ihrer eigenen Datei, als `datei#name`. */
function actionsOhneAufrufer(quellen: ReadonlyMap<string, string>): { alle: string[]; ohne: string[] } {
  const vorhanden = new Set(quellen.keys())
  const baeume = new Map<string, ts.SourceFile>()
  for (const [datei, text] of quellen) baeume.set(datei, parse(datei, text))

  const actions = new Map<string, string[]>()
  for (const [datei, sf] of baeume) {
    if (datei.startsWith(ACTIONS) && istServerDatei(sf)) actions.set(datei, exportierteFunktionen(sf))
  }
  const actionDateien = new Set(actions.keys())

  const benutzt = new Set<string>()
  for (const [datei, sf] of baeume) {
    // Nur Code unter src/ ist ein Aufrufer; ein Test, der die Action importiert, macht sie nicht erreichbar.
    if (!datei.startsWith('src/')) continue
    for (const schluessel of benutzteImporte(datei, sf, actionDateien, vorhanden)) {
      const [ziel, rest] = schluessel.split('#')
      if (rest.startsWith('*')) {
        // Namensraum-Import: jede Action zählt, auf die als `x.name` zugegriffen wird.
        for (const name of actions.get(ziel) ?? []) if (wirdUeberNamensraumBenutzt(sf, rest.slice(1), name)) benutzt.add(`${ziel}#${name}`)
      } else benutzt.add(schluessel)
    }
  }

  const alle = [...actions].flatMap(([datei, namen]) => namen.map((n) => `${datei}#${n}`)).sort()
  return { alle, ohne: alle.filter((s) => !benutzt.has(s)) }
}

/** Neue Funde (nicht im Bestand) und veraltete Bestandseinträge. */
function abgleich(ergebnis: { alle: string[]; ohne: string[] }, bestand: readonly Eintrag[]): { neu: string[]; veraltet: string[] } {
  const imBestand = new Set(bestand.map((e) => `${e.datei}#${e.name}`))
  const ohne = new Set(ergebnis.ohne)
  return {
    neu: ergebnis.ohne.filter((s) => !imBestand.has(s)),
    veraltet: [...imBestand].filter((s) => !ohne.has(s)),
  }
}

function echteQuellen(): Map<string, string> {
  return new Map(quelldateien(join(WURZEL, 'src')).map((d) => [d, readFileSync(join(WURZEL, d), 'utf8')]))
}

describe('Aufrufer-Wache: jede exportierte Server Action hat einen Aufrufer unter src/', () => {
  // Liest und parst jede Datei unter src/ — eigenes Limit nach TESTING_GUIDELINES §4.
  it('keine Action ohne Aufrufer außerhalb des Bestands, kein veralteter Eintrag', () => {
    const ergebnis = actionsOhneAufrufer(echteQuellen())
    // Die Erkennung muss die Actions überhaupt finden, sonst wäre die Wache leer und grün.
    expect(ergebnis.alle.length).toBeGreaterThan(100)
    expect(ergebnis.alle).toContain('src/server/actions/register.ts#registerFarmer')
    expect(ergebnis.alle.some((s) => s.endsWith('#setFarmerRole'))).toBe(false)
    expect(abgleich(ergebnis, AUFRUFER_BESTAND)).toEqual({ neu: [], veraltet: [] })
  }, 30_000)

  it('jeder Bestandseintrag hat einen Grund und steht nur einmal da', () => {
    const schluessel = AUFRUFER_BESTAND.map((e) => `${e.datei}#${e.name}`)
    expect(new Set(schluessel).size).toBe(schluessel.length)
    for (const e of AUFRUFER_BESTAND) expect(e.grund.length, e.name).toBeGreaterThan(20)
  })
})

describe('Aufrufer-Wache: Gegenprobe mit Text-Attrappen', () => {
  const ACTION = 'src/server/actions/attrappe.ts'
  const actionText = `'use server'
export async function gebraucht() { return 1 }
export async function erfunden() { return 2 }
export const pfeil = async () => 3
async function intern() { return 4 }
export { intern }
export type Nur = { a: 1 }
`
  function ohne(weitere: Record<string, string>, action = actionText): string[] {
    return actionsOhneAufrufer(new Map([[ACTION, action], ...Object.entries(weitere)])).ohne
  }
  const nutztAlle = "import { gebraucht, pfeil, intern } from '@/server/actions/attrappe'\nexport function K() { gebraucht(); pfeil(); intern() }\n"

  it('eine erfundene exportierte Action ohne Aufrufer schlägt an, Typen nicht', () => {
    expect(ohne({ 'src/app/seite.tsx': nutztAlle })).toEqual([`${ACTION}#erfunden`])
  })

  it('Nennung nur im Kommentar, im Text oder in der eigenen Datei zählt nicht', () => {
    const eigene = actionText + 'export async function ruftSelbst() { return erfunden() }\n'
    const seite = `${nutztAlle}// erfunden()\nconst t = 'erfunden'\nexport const u = t\n`
    expect(ohne({ 'src/app/seite.tsx': seite }, eigene)).toEqual([`${ACTION}#erfunden`, `${ACTION}#ruftSelbst`])
  })

  it('nur importiert, aber nie benutzt, zählt nicht', () => {
    const seite = `${nutztAlle}import { erfunden } from '@/server/actions/attrappe'\n`
    expect(ohne({ 'src/app/seite.tsx': seite })).toEqual([`${ACTION}#erfunden`])
  })

  it('nur als Eigenschaftsname benutzt zählt nicht', () => {
    const seite = `${nutztAlle}import { erfunden } from '@/server/actions/attrappe'\nexport const o = { erfunden: 1 }\nexport const p = o.erfunden\n`
    expect(ohne({ 'src/app/seite.tsx': seite })).toEqual([`${ACTION}#erfunden`])
  })

  it('ein Test ist kein Aufrufer', () => {
    const test = "import { erfunden } from '@/server/actions/attrappe'\nerfunden()\n"
    expect(ohne({ 'src/app/seite.tsx': nutztAlle, 'tests/x.test.ts': test })).toEqual([`${ACTION}#erfunden`])
  })

  it('umbenannt, relativ, weitergereicht und über * as zählt', () => {
    const umbenannt = "import { erfunden as e } from '@/server/actions/attrappe'\nexport const x = () => e()\n"
    const relativ = "import { erfunden } from '../server/actions/attrappe'\nexport const x = () => erfunden()\n"
    const weiter = "export { erfunden } from '@/server/actions/attrappe'\n"
    const namensraum = "import * as A from '@/server/actions/attrappe'\nexport const x = () => A.erfunden()\n"
    for (const [datei, text] of [
      ['src/app/u.tsx', umbenannt],
      ['src/lib/r.ts', relativ],
      ['src/lib/w.ts', weiter],
      ['src/app/n.tsx', namensraum],
    ]) {
      expect(ohne({ 'src/app/seite.tsx': nutztAlle, [datei]: text }), datei).toEqual([])
    }
  })

  it('eine Datei ohne use server ist keine Action', () => {
    expect(ohne({}, actionText.replace("'use server'\n", ''))).toEqual([])
  })

  it('ein veralteter Bestandseintrag und ein neuer Fund machen die Wache rot', () => {
    const ergebnis = actionsOhneAufrufer(new Map([[ACTION, actionText], ['src/app/seite.tsx', nutztAlle]]))
    expect(abgleich(ergebnis, [{ datei: ACTION, name: 'gebraucht', grund: 'veraltet' }])).toEqual({
      neu: [`${ACTION}#erfunden`],
      veraltet: [`${ACTION}#gebraucht`],
    })
  })
})
