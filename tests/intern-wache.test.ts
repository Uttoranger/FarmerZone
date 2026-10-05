/**
 * Die Wache über /intern — am Quelltext geprüft (TypeScript-AST, kein Regex).
 *
 * /intern sind Werkzeugseiten für den Betreiber (heute: die Bausteine- und
 * Shell-Vorschau aus Gate 2). Kein Eintrag in proxy.ts schützt sie; jede Seite
 * schützt sich selbst. Eine neue Seite, die das vergisst, wäre für jeden
 * offen und landete in Suchmaschinen.
 *
 * Beweist für jede page.tsx unter src/app/intern (rekursiv):
 *  - Die Standard-Export-Funktion ist async und ruft als ERSTE Anweisung
 *    `await verlangeAdminSeite()` aus '@/server/admin-wache' — vor jedem
 *    Lesen von params/searchParams und vor jedem Rendern. In der Seite, nicht
 *    im Layout: Ein Layout rendert beim Wechsel zwischen Unterseiten nicht neu.
 *  - Die WIRKSAME robots-Angabe ist noindex. Next.js führt `metadata` von
 *    Layout und Seite flach zusammen: Ein Schlüssel der Seite ersetzt den des
 *    Layouts ganz, fehlt er, gilt der des nächsten Layouts darüber. Geprüft
 *    wird deshalb der zuletzt gesetzte Wert der Kette
 *    intern/layout.tsx → … → page.tsx — nicht nur, ob irgendwo „noindex" steht.
 *    (Eine Seite mit `robots: { index: true }` hebelte das Layout aus.)
 *  - src/app/intern/layout.tsx setzt selbst noindex — damit ist eine künftige
 *    Seite ohne eigene Angabe von Anfang an gedeckt.
 *  - Gegenproben: Schnipsel ohne Wache, mit Wache an zweiter Stelle, mit
 *    gleichnamiger Fälschung, mit robots index:true und mit generateMetadata
 *    werden erkannt.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import ts from 'typescript'

const WURZEL = process.cwd()
const INTERN = join(WURZEL, 'src/app/intern')
const WACHE_MODUL = '@/server/admin-wache'
const WACHE = 'verlangeAdminSeite'

function* seiten(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* seiten(pfad)
    else if (name === 'page.tsx' || name === 'page.ts') yield pfad
  }
}

function lies(quelltext: string, pfad: string): ts.SourceFile {
  return ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function hatExport(knoten: ts.Node): boolean {
  return ts.canHaveModifiers(knoten) && (ts.getModifiers(knoten) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}

function hatDefault(knoten: ts.Node): boolean {
  return ts.canHaveModifiers(knoten) && (ts.getModifiers(knoten) ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
}

function istAsync(knoten: ts.Node): boolean {
  return ts.canHaveModifiers(knoten) && (ts.getModifiers(knoten) ?? []).some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)
}

/** `as`, `satisfies` und Klammern abstreifen. */
function kern(ausdruck: ts.Expression): ts.Expression {
  let a = ausdruck
  while (ts.isAsExpression(a) || ts.isSatisfiesExpression(a) || ts.isParenthesizedExpression(a)) a = a.expression
  return a
}

type Funktion = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction

/** Die Standard-Export-Funktion: `export default function …` oder `export default X` mit X als Funktion in der Datei. */
function standardExport(datei: ts.SourceFile): Funktion | null {
  for (const anweisung of datei.statements) {
    if (ts.isFunctionDeclaration(anweisung) && hatExport(anweisung) && hatDefault(anweisung)) return anweisung
    if (ts.isExportAssignment(anweisung) && !anweisung.isExportEquals) {
      const ausdruck = kern(anweisung.expression)
      if (ts.isFunctionExpression(ausdruck) || ts.isArrowFunction(ausdruck)) return ausdruck
      if (ts.isIdentifier(ausdruck)) {
        for (const s of datei.statements) {
          if (ts.isFunctionDeclaration(s) && s.name?.text === ausdruck.text) return s
          if (ts.isVariableStatement(s)) {
            for (const d of s.declarationList.declarations) {
              if (ts.isIdentifier(d.name) && d.name.text === ausdruck.text && d.initializer) {
                const init = kern(d.initializer)
                if (ts.isFunctionExpression(init) || ts.isArrowFunction(init)) return init
              }
            }
          }
        }
      }
    }
  }
  return null
}

/** Ob `name` in dieser Datei aus '@/server/admin-wache' kommt (auch umbenannt: `import { verlangeAdminSeite as w }`). */
function wacheImportiertAls(datei: ts.SourceFile): string | null {
  for (const anweisung of datei.statements) {
    if (!ts.isImportDeclaration(anweisung) || !ts.isStringLiteral(anweisung.moduleSpecifier)) continue
    if (anweisung.moduleSpecifier.text !== WACHE_MODUL) continue
    const benannt = anweisung.importClause?.namedBindings
    if (benannt && ts.isNamedImports(benannt)) {
      for (const el of benannt.elements) {
        if ((el.propertyName ?? el.name).text === WACHE) return el.name.text
      }
    }
  }
  return null
}

/** `await <name>()` — als Ausdrucksanweisung oder als Initialisierer (`const id = await …`). */
function istWachenAufruf(anweisung: ts.Statement, name: string): boolean {
  let ausdruck: ts.Expression | undefined
  if (ts.isExpressionStatement(anweisung)) ausdruck = anweisung.expression
  else if (ts.isVariableStatement(anweisung) && anweisung.declarationList.declarations.length === 1) {
    ausdruck = anweisung.declarationList.declarations[0].initializer
  }
  if (!ausdruck) return false
  const a = kern(ausdruck)
  if (!ts.isAwaitExpression(a)) return false
  const aufruf = kern(a.expression)
  return ts.isCallExpression(aufruf) && ts.isIdentifier(aufruf.expression) && aufruf.expression.text === name && aufruf.arguments.length === 0
}

/** Was an der Wache einer Seite fehlt — leer heißt: gedeckt. */
function wachenMaengel(quelltext: string, pfad = 'schnipsel.tsx'): string[] {
  const datei = lies(quelltext, pfad)
  const name = wacheImportiertAls(datei)
  if (!name) return [`${pfad}: ${WACHE} nicht aus '${WACHE_MODUL}' importiert`]
  const funktion = standardExport(datei)
  if (!funktion) return [`${pfad}: keine Standard-Export-Funktion gefunden`]
  if (!istAsync(funktion)) return [`${pfad}: Seite ist nicht async — die Wache muss abgewartet werden`]
  const rumpf = funktion.body
  if (!rumpf || !ts.isBlock(rumpf)) return [`${pfad}: Seite ohne Anweisungsblock`]
  const erste = rumpf.statements[0]
  if (!erste || !istWachenAufruf(erste, name)) return [`${pfad}: erste Anweisung ist nicht \`await ${WACHE}()\``]
  return []
}

// ─── robots ─────────────────────────────────────────────────────────────────

type Robots = { art: 'fehlt' } | { art: 'gesetzt'; noindex: boolean } | { art: 'unpruefbar'; grund: string }

function eigenschaft(objekt: ts.ObjectLiteralExpression, name: string): ts.Expression | null {
  for (const p of objekt.properties) {
    if (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === name) return p.initializer
  }
  return null
}

/** Die robots-Angabe aus `export const metadata = { … }` einer Seite oder eines Layouts. */
function robotsAngabe(quelltext: string, pfad = 'schnipsel.tsx'): Robots {
  const datei = lies(quelltext, pfad)
  for (const anweisung of datei.statements) {
    if (ts.isFunctionDeclaration(anweisung) && hatExport(anweisung) && anweisung.name?.text === 'generateMetadata') {
      return { art: 'unpruefbar', grund: 'generateMetadata lässt sich nicht am Quelltext prüfen — statisches `metadata` nehmen' }
    }
    if (!ts.isVariableStatement(anweisung) || !hatExport(anweisung)) continue
    for (const d of anweisung.declarationList.declarations) {
      if (!ts.isIdentifier(d.name)) continue
      if (d.name.text === 'generateMetadata') {
        return { art: 'unpruefbar', grund: 'generateMetadata lässt sich nicht am Quelltext prüfen — statisches `metadata` nehmen' }
      }
      if (d.name.text !== 'metadata' || !d.initializer) continue
      const objekt = kern(d.initializer)
      if (!ts.isObjectLiteralExpression(objekt)) return { art: 'unpruefbar', grund: '`metadata` ist kein Objekt-Literal' }
      if (objekt.properties.some(ts.isSpreadAssignment)) return { art: 'unpruefbar', grund: '`metadata` mit Spread' }
      const robots = eigenschaft(objekt, 'robots')
      if (!robots) return { art: 'fehlt' }
      const wert = kern(robots)
      if (ts.isStringLiteral(wert) || ts.isNoSubstitutionTemplateLiteral(wert)) {
        return { art: 'gesetzt', noindex: /\bnoindex\b/.test(wert.text) }
      }
      if (ts.isObjectLiteralExpression(wert)) {
        const index = eigenschaft(wert, 'index')
        return { art: 'gesetzt', noindex: !!index && kern(index).kind === ts.SyntaxKind.FalseKeyword }
      }
      return { art: 'unpruefbar', grund: '`robots` ist weder Text noch Objekt-Literal' }
    }
  }
  return { art: 'fehlt' }
}

/** Layouts von src/app/intern bis zum Ordner der Seite, oben zuerst. */
function layoutKette(seite: string): string[] {
  const kette: string[] = []
  let ordner = dirname(seite)
  while (ordner.startsWith(INTERN)) {
    for (const name of ['layout.tsx', 'layout.ts']) {
      const pfad = join(ordner, name)
      if (existsSync(pfad)) kette.unshift(pfad)
    }
    if (ordner === INTERN) break
    ordner = dirname(ordner)
  }
  return kette
}

/** Die wirksame Angabe: der zuletzt gesetzte Wert in Layout → … → Seite (flaches Zusammenführen in Next.js). */
function wirksameRobots(angaben: Robots[]): Robots {
  let wirksam: Robots = { art: 'fehlt' }
  for (const a of angaben) {
    if (a.art === 'unpruefbar') return a
    if (a.art === 'gesetzt') wirksam = a
  }
  return wirksam
}

function robotsMangel(wirksam: Robots, wo: string): string[] {
  if (wirksam.art === 'unpruefbar') return [`${wo}: ${wirksam.grund}`]
  if (wirksam.art === 'fehlt') return [`${wo}: keine robots-Angabe — weder Seite noch Layout setzen noindex`]
  return wirksam.noindex ? [] : [`${wo}: wirksame robots-Angabe erlaubt das Indexieren`]
}

// ─── Tests ──────────────────────────────────────────────────────────────────

const SEITEN = [...seiten(INTERN)]

describe('Gegenproben — die Suche schlägt an', () => {
  it('erkennt eine Seite ohne Wache', () => {
    const schnipsel = `
      import { verlangeAdminSeite } from '@/server/admin-wache'
      export default async function Seite() { return <p>offen</p> }
    `
    expect(wachenMaengel(schnipsel)).toEqual(['schnipsel.tsx: erste Anweisung ist nicht `await verlangeAdminSeite()`'])
  })

  it('erkennt eine Wache, die erst nach dem Lesen der Parameter kommt', () => {
    const schnipsel = `
      import { verlangeAdminSeite } from '@/server/admin-wache'
      export default async function Seite({ params }: { params: Promise<{ id: string }> }) {
        const { id } = await params
        await verlangeAdminSeite()
        return <p>{id}</p>
      }
    `
    expect(wachenMaengel(schnipsel)).toHaveLength(1)
  })

  it('erkennt eine gleichnamige Funktion aus einem anderen Modul', () => {
    const schnipsel = `
      import { verlangeAdminSeite } from './attrappe'
      export default async function Seite() { await verlangeAdminSeite(); return <p /> }
    `
    expect(wachenMaengel(schnipsel)).toEqual(["schnipsel.tsx: verlangeAdminSeite nicht aus '@/server/admin-wache' importiert"])
  })

  it('erkennt eine Wache ohne await und eine nicht-async Seite', () => {
    const ohneAwait = `
      import { verlangeAdminSeite } from '@/server/admin-wache'
      export default async function Seite() { verlangeAdminSeite(); return <p /> }
    `
    const nichtAsync = `
      import { verlangeAdminSeite } from '@/server/admin-wache'
      export default function Seite() { return <p /> }
    `
    expect(wachenMaengel(ohneAwait)).toHaveLength(1)
    expect(wachenMaengel(nichtAsync)).toEqual(['schnipsel.tsx: Seite ist nicht async — die Wache muss abgewartet werden'])
  })

  it('lässt eine korrekte Seite durch — auch umbenannt, als Pfeilfunktion und mit Rückgabewert', () => {
    const schnipsel = `
      import { verlangeAdminSeite as wache } from '@/server/admin-wache'
      const Seite = async () => { const id = await wache(); return <p>{id}</p> }
      export default Seite
    `
    expect(wachenMaengel(schnipsel)).toEqual([])
  })

  it('robots: die Seite ersetzt das Layout — index:true in der Seite hebelt noindex im Layout aus', () => {
    const layout = robotsAngabe(`export const metadata = { robots: { index: false, follow: false } }`)
    const seite = robotsAngabe(`export const metadata: Metadata = { title: 'X', robots: { index: true } }`)
    expect(robotsMangel(wirksameRobots([layout, seite]), 'x')).toEqual(['x: wirksame robots-Angabe erlaubt das Indexieren'])
  })

  it('robots: ohne Angabe in der Seite gilt das Layout; ohne beides fehlt sie', () => {
    const layout = robotsAngabe(`export const metadata = { robots: 'noindex, nofollow' }`)
    const seite = robotsAngabe(`export const metadata = { title: 'X' }`)
    expect(robotsMangel(wirksameRobots([layout, seite]), 'x')).toEqual([])
    expect(robotsMangel(wirksameRobots([seite]), 'x')).toHaveLength(1)
  })

  it('robots: generateMetadata gilt als nicht prüfbar, nicht als gedeckt', () => {
    const layout = robotsAngabe(`export const metadata = { robots: { index: false } }`)
    const seite = robotsAngabe(`export async function generateMetadata() { return { robots: { index: true } } }`)
    expect(wirksameRobots([layout, seite]).art).toBe('unpruefbar')
  })
})

describe('jede Seite unter /intern', () => {
  it('es gibt Seiten — sonst bewiese der Rest nichts', () => {
    expect(SEITEN.length).toBeGreaterThanOrEqual(2)
    expect(SEITEN.map((p) => relative(INTERN, p).split(sep).join('/'))).toEqual(
      expect.arrayContaining(['bausteine/page.tsx', 'bausteine/shell/[variante]/page.tsx'])
    )
  })

  it('ruft als erste Anweisung `await verlangeAdminSeite()` auf', () => {
    const maengel = SEITEN.flatMap((p) => wachenMaengel(readFileSync(p, 'utf8'), relative(WURZEL, p)))
    expect(maengel).toEqual([])
  })

  it('ist wirksam noindex (Layout-Kette und Seite zusammengeführt wie in Next.js)', () => {
    const maengel = SEITEN.flatMap((p) => {
      const angaben = [...layoutKette(p), p].map((datei) => robotsAngabe(readFileSync(datei, 'utf8'), relative(WURZEL, datei)))
      return robotsMangel(wirksameRobots(angaben), relative(WURZEL, p))
    })
    expect(maengel).toEqual([])
  })

  it('das Layout von /intern setzt selbst noindex — eine künftige Seite ohne eigene Angabe ist gedeckt', () => {
    const layout = join(INTERN, 'layout.tsx')
    expect(robotsAngabe(readFileSync(layout, 'utf8'))).toEqual({ art: 'gesetzt', noindex: true })
  })
})
