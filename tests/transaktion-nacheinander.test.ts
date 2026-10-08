/**
 * Eine Verbindung, eine Abfrage zur Zeit (Nr. 47).
 *
 * Auf /[farmSlug]/checkout meldete Vercel seit dem 13.08. die pg-Warnung
 * „Calling client.query() when the client is already executing a query" —
 * ab pg@9 ist das ein Fehler. Der Fund (Bericht Nr. 47): Metadaten und Seite
 * luden den Hof getrennt über `getPublicFarm`. Zwei solche Abfragen im
 * selben Takt bündelt Prisma 7 zu einem Batch und führt ihn in EINER
 * Transaktion aus; darin laufen die Teilabfragen der Relationen gleichzeitig
 * über dieselbe Verbindung. Seitdem lädt die Kasse über `getPublicFarmGeteilt`
 * (React `cache`, einmal je Anfrage) — wie die Hofseite (`ladeHofseiteGeteilt`).
 *
 * Zwei Wachen am Quelltext (TypeScript-Parser, mit Gegenproben):
 *  1. Kein `Promise.all`/`allSettled`/`race`/`any` mit Aufrufen auf dem
 *     Transaktions-Client — dem Parameter einer `$transaction(async (tx) => …)`
 *     oder einem Parameter vom Typ `Prisma.TransactionClient` (auch über einen
 *     Typ-Alias derselben Datei). Prisma 7.8 reiht Aufrufe auf `tx` zwar
 *     selbst nacheinander ein; darauf baut der Code nicht, und lesbar
 *     nacheinander ist es ohnehin. Die Wache folgt dem Client auch über
 *     „Träger" im Rumpf (seit Nachbesserung 1): einen destrukturierten
 *     Parameter (`async ({ order }) => …`), eine vorher gebaute Liste oder
 *     Variable, deren Startwert ihn ohne `await` nennt (`const s = [tx.a(),
 *     tx.b()]; Promise.all(s)`, `const r = repo(tx)`), eine Liste, in die
 *     solche Aufrufe geschoben werden (`s.push(tx.a())`), und Träger von
 *     Trägern. Ein abgewartetes Ergebnis (`const x = await tx.a()`) ist kein
 *     Träger.
 *     Grenzen: Ein Client, der erst nach der Deklaration zugewiesen wird
 *     (`let db; db = tx`) oder in einem Objektfeld reist (`{ db: tx }` an
 *     eine Hilfsfunktion, die ihn als `typeof prisma` nimmt), und Helfer in
 *     anderen Dateien ohne den Typ `TransactionClient` werden nicht verfolgt.
 *     Gleichnamige Variablen in anderen Gültigkeitsbereichen des Rumpfs
 *     zählen mit — die sichere Richtung.
 *  2. Eine Seite mit `generateMetadata` ruft dieselbe Server-Abfrage
 *     (Import aus `@/server/…`) nie in Metadaten UND Seite direkt auf — nur
 *     über eine geteilte Fassung (Name endet auf `Geteilt`).
 *     Grenzen: Die Wache sieht nur eine page-Datei mit `generateMetadata`
 *     und Standard-Export als Funktionsdeklarationen. Layout und Seite (zwei
 *     Dateien, die denselben Hof laden), `export const generateMetadata =
 *     async …` und ein lokaler Helfer, der die Abfrage umhüllt, werden nicht
 *     verfolgt — heute lädt kein Layout unter `[farmSlug]` den Hof.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, it, expect } from 'vitest'

const SRC = join(process.cwd(), 'src')
const APP = join(SRC, 'app')

function dateien(ordner: string, passt: (name: string) => boolean): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) return dateien(pfad, passt)
    return passt(name) ? [pfad] : []
  })
}

function lies(text: string, pfad = 'schnipsel.ts'): ts.SourceFile {
  return ts.createSourceFile(pfad, text, ts.ScriptTarget.Latest, true, pfad.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}

// ─── Wache 1: Promise.all mit dem Transaktions-Client ──────────────────────

const SAMMLER = new Set(['all', 'allSettled', 'race', 'any'])

/** Typ-Aliasse der Datei, die den Transaktions-Client meinen (`type Db = Prisma.TransactionClient | …`). */
function transaktionsAliasse(datei: ts.SourceFile): Set<string> {
  const namen = new Set<string>()
  for (const s of datei.statements) {
    if (ts.isTypeAliasDeclaration(s) && s.type.getText(datei).includes('TransactionClient')) namen.add(s.name.text)
  }
  return namen
}

/** Ist dieser Parameter ein Transaktions-Client? Über den Typ — oder als Parameter des $transaction-Rückrufs. */
function istTransaktionsParameter(p: ts.ParameterDeclaration, datei: ts.SourceFile, aliasse: Set<string>): boolean {
  const funktion = p.parent
  const aufruf = funktion.parent
  const alsRueckruf =
    (ts.isArrowFunction(funktion) || ts.isFunctionExpression(funktion)) &&
    ts.isCallExpression(aufruf) &&
    aufruf.arguments[0] === funktion &&
    ts.isPropertyAccessExpression(aufruf.expression) &&
    aufruf.expression.name.text === '$transaction'
  if (alsRueckruf) return true
  const typ = p.type?.getText(datei) ?? ''
  return typ.includes('TransactionClient') || [...aliasse].some((alias) => new RegExp(`\\b${alias}\\b`).test(typ))
}

/** Kommt der Name als Wert vor (nicht als Eigenschaftsname hinter einem Punkt)? */
function nenntWert(knoten: ts.Node, name: string): boolean {
  let gefunden = false
  const besuche = (k: ts.Node): void => {
    if (gefunden) return
    if (ts.isIdentifier(k) && k.text === name) {
      const eltern = k.parent
      const istEigenschaftsname = ts.isPropertyAccessExpression(eltern) && eltern.name === k
      if (!istEigenschaftsname) gefunden = true
    }
    ts.forEachChild(k, besuche)
  }
  besuche(knoten)
  return gefunden
}

/** Die Namen eines Parameters — auch jeder Teil eines destrukturierten (`{ order, product }`). */
function parameterNamen(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text]
  return name.elements.flatMap((el) => (ts.isOmittedExpression(el) ? [] : parameterNamen(el.name)))
}

/** Ohne Klammern, `as` und `!` — `(await x)` bleibt ein abgewartetes Ergebnis. */
function ohneHuelle(ausdruck: ts.Expression): ts.Expression {
  let a = ausdruck
  while (ts.isParenthesizedExpression(a) || ts.isAsExpression(a) || ts.isSatisfiesExpression(a) || ts.isNonNullExpression(a)) a = a.expression
  return a
}

/**
 * Alle Namen im Rumpf, die den Client oder schon gestartete Aufrufe auf ihm
 * tragen: die Parameter-Namen, jede Variable, deren Startwert einen Träger
 * ohne `await` nennt, und jede Liste, in die ein solcher Wert geschoben wird
 * — wiederholt, bis nichts mehr dazukommt (Träger von Trägern).
 */
function traeger(rumpf: ts.Node, namen: string[]): Set<string> {
  const gefunden = new Set(namen)
  const kandidaten: { name: string; wert: ts.Node }[] = []
  const sammle = (k: ts.Node): void => {
    if (ts.isVariableDeclaration(k) && ts.isIdentifier(k.name) && k.initializer && !ts.isAwaitExpression(ohneHuelle(k.initializer))) {
      kandidaten.push({ name: k.name.text, wert: k.initializer })
    }
    if (
      ts.isCallExpression(k) &&
      ts.isPropertyAccessExpression(k.expression) &&
      ts.isIdentifier(k.expression.expression) &&
      (k.expression.name.text === 'push' || k.expression.name.text === 'unshift')
    ) {
      for (const argument of k.arguments) kandidaten.push({ name: k.expression.expression.text, wert: argument })
    }
    ts.forEachChild(k, sammle)
  }
  sammle(rumpf)
  for (let weiter = true; weiter; ) {
    weiter = false
    for (const { name, wert } of kandidaten) {
      if (!gefunden.has(name) && [...gefunden].some((t) => nenntWert(wert, t))) {
        gefunden.add(name)
        weiter = true
      }
    }
  }
  return gefunden
}

function promiseAllMitTransaktion(text: string, pfad = 'schnipsel.ts'): string[] {
  const datei = lies(text, pfad)
  const aliasse = transaktionsAliasse(datei)
  const funde: string[] = []
  const besuche = (knoten: ts.Node): void => {
    if (ts.isParameter(knoten) && istTransaktionsParameter(knoten, datei, aliasse)) {
      const rumpf = (knoten.parent as ts.FunctionLikeDeclaration).body
      const namen = rumpf ? traeger(rumpf, parameterNamen(knoten.name)) : new Set<string>()
      const suche = (k: ts.Node): void => {
        if (
          ts.isCallExpression(k) &&
          ts.isPropertyAccessExpression(k.expression) &&
          ts.isIdentifier(k.expression.expression) &&
          k.expression.expression.text === 'Promise' &&
          SAMMLER.has(k.expression.name.text) &&
          k.arguments.some((a) => [...namen].some((name) => nenntWert(a, name)))
        ) {
          const zeile = datei.getLineAndCharacterOfPosition(k.getStart(datei)).line + 1
          funde.push(`${pfad}:${zeile} ${k.getText(datei).replace(/\s+/g, ' ').slice(0, 120)}`)
        }
        ts.forEachChild(k, suche)
      }
      if (rumpf) suche(rumpf)
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return funde
}

describe('Wache 1: kein Promise.all mit dem Transaktions-Client', () => {
  it('in ganz src/ läuft auf einem Transaktions-Client nichts gleichzeitig', () => {
    const treffer = dateien(SRC, (n) => /\.(ts|tsx)$/.test(n)).flatMap((pfad) =>
      promiseAllMitTransaktion(readFileSync(pfad, 'utf8'), relative(SRC, pfad))
    )
    expect(treffer).toEqual([])
  })

  it('Gegenprobe: Promise.all mit tx im $transaction-Rückruf schlägt an — auch über map, allSettled und anderen Namen', () => {
    expect(promiseAllMitTransaktion('prisma.$transaction(async (tx) => { await Promise.all([tx.order.count(), tx.product.count()]) })')).toHaveLength(1)
    expect(promiseAllMitTransaktion('prisma.$transaction(async (tx) => Promise.all(ids.map((id) => tx.product.update({ where: { id }, data }))))')).toHaveLength(1)
    expect(promiseAllMitTransaktion('await prisma.$transaction(async function (db) { return Promise.allSettled([db.a.findMany(), x]) })')).toHaveLength(1)
  })

  it('Gegenprobe: ein Parameter vom Typ TransactionClient zählt mit — auch über einen Typ-Alias der Datei', () => {
    expect(promiseAllMitTransaktion('async function f(tx: Prisma.TransactionClient) { await Promise.all([tx.a.count(), tx.b.count()]) }')).toHaveLength(1)
    expect(
      promiseAllMitTransaktion('type Db = Prisma.TransactionClient | typeof prisma\nfunction g(db: Db) { return Promise.all([db.a.count(), db.b.count()]) }')
    ).toHaveLength(1)
  })

  it('Gegenprobe: nacheinander in der Transaktion und Promise.all außerhalb bleiben erlaubt', () => {
    expect(promiseAllMitTransaktion('prisma.$transaction(async (tx) => { await tx.a.count(); await tx.b.count() })')).toEqual([])
    expect(promiseAllMitTransaktion('await Promise.all([prisma.a.count(), prisma.b.count()])')).toEqual([])
    // Ein gleichnamiges Feld eines anderen Objekts ist nicht der Client.
    expect(promiseAllMitTransaktion('prisma.$transaction(async (tx) => { await Promise.all([stripe.tx, warte()]) })')).toEqual([])
  })

  it('Gegenprobe (Nachbesserung 1): der Client über Träger — vorher gebaute Liste, push, Helfer, Destrukturierung', () => {
    const inTransaktion = (rumpf: string) => promiseAllMitTransaktion(`prisma.$transaction(async (tx) => { ${rumpf} })`)
    expect(inTransaktion('const s = [tx.a.count(), tx.b.count()]; await Promise.all(s)')).toHaveLength(1)
    expect(inTransaktion('const s = ids.map((id) => tx.p.update({ where: { id }, data })); return Promise.allSettled(s)')).toHaveLength(1)
    expect(inTransaktion('const s: Promise<number>[] = []; for (const id of ids) s.push(tx.p.count({ where: { id } })); await Promise.all(s)')).toHaveLength(1)
    // Träger von Trägern und ein Helfer, der den Client bindet.
    expect(inTransaktion('const s = [tx.a.count()]; const t = s.concat([x]); await Promise.race(t)')).toHaveLength(1)
    expect(inTransaktion('const repo = baueRepo(tx); await Promise.all([repo.a(), repo.b()])')).toHaveLength(1)
    // Destrukturierter Parameter: jeder Teil ist ein Stück des Clients.
    expect(promiseAllMitTransaktion('prisma.$transaction(async ({ order, product }) => Promise.all([order.count(), product.count()]))')).toHaveLength(1)
    expect(promiseAllMitTransaktion('async function f({ order }: Prisma.TransactionClient) { await Promise.all([order.count(), x]) }')).toHaveLength(1)
  })

  it('Gegenprobe (Nachbesserung 1): abgewartete Ergebnisse sind keine Träger', () => {
    const inTransaktion = (rumpf: string) => promiseAllMitTransaktion(`prisma.$transaction(async (tx) => { ${rumpf} })`)
    expect(inTransaktion('const zeilen = await tx.a.findMany(); await Promise.all(zeilen.map((z) => schicke(z)))')).toEqual([])
    expect(inTransaktion('const zahl = (await tx.a.count()) as number; const s = [zahl]; await Promise.all(s.map(warte))')).toEqual([])
  })
})

// ─── Wache 2: Metadaten und Seite laden geteilt ────────────────────────────

/** Unter welchem lokalen Namen ist was aus `@/server/…` importiert? */
function serverImporte(datei: ts.SourceFile): Set<string> {
  const namen = new Set<string>()
  for (const s of datei.statements) {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier) || !s.moduleSpecifier.text.startsWith('@/server/')) continue
    const benannt = s.importClause?.namedBindings
    if (benannt && ts.isNamedImports(benannt)) for (const el of benannt.elements) if (!el.isTypeOnly) namen.add(el.name.text)
  }
  return namen
}

function aufgerufen(knoten: ts.Node | undefined): Set<string> {
  const namen = new Set<string>()
  const besuche = (k: ts.Node): void => {
    if (ts.isCallExpression(k) && ts.isIdentifier(k.expression)) namen.add(k.expression.text)
    ts.forEachChild(k, besuche)
  }
  if (knoten) besuche(knoten)
  return namen
}

function exportierteFunktion(datei: ts.SourceFile, pruefe: (f: ts.FunctionDeclaration) => boolean): ts.FunctionDeclaration | undefined {
  return datei.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && pruefe(s))
}

function hatModifikator(f: ts.FunctionDeclaration, art: ts.SyntaxKind): boolean {
  return (ts.getModifiers(f) ?? []).some((m) => m.kind === art)
}

/** Server-Abfragen, die eine Seite in Metadaten UND Seite direkt (ungeteilt) aufruft. */
function doppeltGeladen(text: string, pfad = 'page.tsx'): string[] {
  const datei = lies(text, pfad)
  const metadaten = exportierteFunktion(datei, (f) => f.name?.text === 'generateMetadata')
  if (!metadaten) return []
  const seite = exportierteFunktion(datei, (f) => hatModifikator(f, ts.SyntaxKind.DefaultKeyword))
  const server = serverImporte(datei)
  const inSeite = aufgerufen(seite?.body)
  return [...aufgerufen(metadaten.body)].filter((name) => server.has(name) && inSeite.has(name) && !name.endsWith('Geteilt'))
}

describe('Wache 2: Metadaten und Seite laden eine Server-Abfrage nur geteilt', () => {
  const seiten = dateien(APP, (n) => n === 'page.tsx' || n === 'page.ts')

  it('keine Seite mit generateMetadata ruft dieselbe Server-Abfrage zweimal ungeteilt auf', () => {
    const treffer = seiten.flatMap((pfad) => doppeltGeladen(readFileSync(pfad, 'utf8'), pfad).map((n) => `${relative(SRC, pfad)}: ${n}`))
    expect(treffer).toEqual([])
  })

  it('die Kasse lädt den Hof in Metadaten und Seite über getPublicFarmGeteilt', () => {
    const kasse = readFileSync(join(APP, '(public)/[farmSlug]/checkout/page.tsx'), 'utf8')
    expect(kasse.match(/\bgetPublicFarmGeteilt\(/g)).toHaveLength(2)
    expect(kasse).not.toMatch(/\bgetPublicFarm\(/)
    // Die geteilte Fassung ist React `cache` um genau diese Abfrage.
    expect(readFileSync(join(SRC, 'server/queries/farm.ts'), 'utf8')).toMatch(/export const getPublicFarmGeteilt(?:: typeof getPublicFarm)? = cache\(getPublicFarm\)/)
  })

  it('Gegenprobe: das alte Muster der Kasse (zweimal getPublicFarm) schlägt an, die Hofseite nicht', () => {
    const alt = `
      import { getPublicFarm } from '@/server/queries/farm'
      export async function generateMetadata({ params }) { const farm = await getPublicFarm((await params).farmSlug); return {} }
      export default async function Seite({ params }) { const farm = await getPublicFarm((await params).farmSlug); return null }`
    expect(doppeltGeladen(alt)).toEqual(['getPublicFarm'])
    const hofseite = readFileSync(join(APP, '(public)/[farmSlug]/page.tsx'), 'utf8')
    expect(hofseite).toMatch(/generateMetadata/)
    expect(doppeltGeladen(hofseite)).toEqual([])
    // Ohne generateMetadata gibt es nichts zu teilen.
    expect(doppeltGeladen(alt.replace('generateMetadata', 'andereFunktion'))).toEqual([])
  })
})
