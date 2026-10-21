/**
 * Wache: Jeder Storno erneuert die Hofliste (Register N19, Ergänzung 21.10.2026, Nr. 131).
 *
 * Ursache: Die Hofliste kennt seit Nr. 131 volle Abholfenster (`ausgebuchtAm`
 * im Zwischenspeicher). Ein neuer Weg, der eine Bestellung auf CANCELLED setzt,
 * ohne `erneuereHoflisteNachStorno` zu rufen, ließe ein freies Fenster bis zu
 * fünf Minuten „voll“ stehen — niemand bemerkte es.
 *
 * Beweist (Quelltext von `src/`, TypeScript-Syntaxbaum): Jede Stelle, die in
 * einem `data`-Objekt `status: 'CANCELLED'` schreibt (auch `OrderStatus.CANCELLED`
 * und `{ set: 'CANCELLED' }`), steht in einer Funktion, die
 * `erneuereHoflisteNachStorno` ruft — und zwar direkt in ihr, nicht in einem
 * Rückruf darin (etwa dem der Transaktion): nach dem Commit, nie in der offenen
 * Transaktion. Lesende Vergleiche (`where: { status: 'CANCELLED' }`) zählen nicht.
 *
 * Gegenprobe: Text-Attrappen ohne Aufruf, mit Aufruf im Transaktions-Rückruf
 * und in der Enum-Form schlagen an; der richtige Aufbau und ein lesendes
 * `where` nicht. Keine Datei im Repository wird dafür verändert.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()
const HELFER = 'erneuereHoflisteNachStorno'

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

function eigenschaftsName(name: ts.PropertyName): string | null {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null
}

/** `'CANCELLED'`, `OrderStatus.CANCELLED` oder `{ set: 'CANCELLED' }`. */
function istStorniert(wert: ts.Expression): boolean {
  if (ts.isStringLiteral(wert) || ts.isNoSubstitutionTemplateLiteral(wert)) return wert.text === 'CANCELLED'
  if (ts.isPropertyAccessExpression(wert)) return wert.name.text === 'CANCELLED'
  if (ts.isObjectLiteralExpression(wert)) {
    return wert.properties.some((e) => ts.isPropertyAssignment(e) && eigenschaftsName(e.name) === 'set' && istStorniert(e.initializer))
  }
  return false
}

function istFunktion(knoten: ts.Node): knoten is ts.FunctionLikeDeclaration {
  return ts.isFunctionDeclaration(knoten) || ts.isFunctionExpression(knoten) || ts.isArrowFunction(knoten) || ts.isMethodDeclaration(knoten)
}

/** Die äußerste Funktion um den Knoten (die Deklaration, nicht ein Rückruf in ihr). */
function aeussersteFunktion(knoten: ts.Node): ts.FunctionLikeDeclaration | null {
  let gefunden: ts.FunctionLikeDeclaration | null = null
  for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) if (istFunktion(k)) gefunden = k
  return gefunden
}

function naechsteFunktion(knoten: ts.Node): ts.FunctionLikeDeclaration | null {
  for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) if (istFunktion(k)) return k
  return null
}

/** Ruft die Funktion den Helfer direkt in ihrem eigenen Körper (nicht in einem Rückruf)? */
function ruftHelferDirekt(funktion: ts.FunctionLikeDeclaration): boolean {
  let treffer = false
  function besuche(k: ts.Node): void {
    if (ts.isCallExpression(k) && ts.isIdentifier(k.expression) && k.expression.text === HELFER && naechsteFunktion(k) === funktion) {
      treffer = true
    }
    ts.forEachChild(k, besuche)
  }
  if (funktion.body) besuche(funktion.body)
  return treffer
}

type Befund = { stelle: string; ruft: boolean }

/** Alle Stellen, die eine Bestellung auf CANCELLED setzen: `Datei:Zeile` und ob der Helfer folgt. */
function stornoStellen(quelltext: string, pfad = 'schnipsel.ts'): Befund[] {
  const datei = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const befunde: Befund[] = []
  function besuche(k: ts.Node): void {
    if (ts.isPropertyAssignment(k) && eigenschaftsName(k.name) === 'status' && istStorniert(k.initializer)) {
      const objekt = k.parent
      const eltern = objekt.parent
      if (ts.isPropertyAssignment(eltern) && eigenschaftsName(eltern.name) === 'data') {
        const funktion = aeussersteFunktion(k)
        befunde.push({
          stelle: `${pfad}:${datei.getLineAndCharacterOfPosition(k.getStart()).line + 1}`,
          ruft: funktion !== null && ruftHelferDirekt(funktion),
        })
      }
    }
    ts.forEachChild(k, besuche)
  }
  besuche(datei)
  return befunde
}

describe('Wache: jeder Storno erneuert die Hofliste', () => {
  // Liest und parst ganz src/ (TESTING_GUIDELINES §4: eigenes Limit nur an diesem it).
  it('jede Stelle in src/, die eine Bestellung auf CANCELLED setzt, ruft danach erneuereHoflisteNachStorno', () => {
    const alle: Befund[] = []
    for (const pfad of quelldateien(join(WURZEL, 'src'))) {
      alle.push(...stornoStellen(readFileSync(pfad, 'utf8'), relative(WURZEL, pfad).split(sep).join('/')))
    }

    // Die Suche findet die bekannten Wege (sonst bewiese „keine Lücke“ nichts).
    const dateien = new Set(alle.map((b) => b.stelle.split(':')[0]))
    expect(dateien).toContain('src/server/actions/orders.ts')
    expect(dateien).toContain('src/server/unbezahlte-bestellung.ts')
    expect(alle.filter((b) => !b.ruft).map((b) => b.stelle)).toEqual([])
  }, 30_000)

  it('Gegenprobe: ohne Aufruf, mit Aufruf in der Transaktion und in der Enum-Form schlägt sie an', () => {
    const ohne = `async function a(id: string) {
      await prisma.order.updateMany({ where: { id }, data: { status: 'CANCELLED' } })
    }`
    const inTransaktion = `async function b(id: string) {
      await prisma.$transaction(async (tx) => {
        await tx.order.updateMany({ where: { id }, data: { status: 'CANCELLED' } })
        erneuereHoflisteNachStorno(id)
      })
    }`
    const enumForm = `async function c(id: string) {
      await prisma.order.update({ where: { id }, data: { status: OrderStatus.CANCELLED } })
    }`
    const setForm = `const d = async (id: string) => prisma.order.update({ where: { id }, data: { status: { set: 'CANCELLED' } } })`
    for (const attrappe of [ohne, inTransaktion, enumForm, setForm]) {
      expect(stornoStellen(attrappe), attrappe).toEqual([{ stelle: expect.any(String), ruft: false }])
    }
  })

  it('Gegenprobe: der richtige Aufbau und ein lesendes where schlagen nicht an', () => {
    const richtig = `async function e(id: string) {
      const storniert = await prisma.$transaction(async (tx) => {
        const { count } = await tx.order.updateMany({ where: { id }, data: { status: 'CANCELLED' } })
        return count === 1
      })
      if (storniert) erneuereHoflisteNachStorno(id)
      return storniert
    }`
    const lesend = `function f(id: string) { return prisma.order.count({ where: { id, status: 'CANCELLED' } }) }`
    expect(stornoStellen(richtig)).toEqual([{ stelle: 'schnipsel.ts:3', ruft: true }])
    expect(stornoStellen(lesend)).toEqual([])
  })
})
