/**
 * decrement-Wache (CLAUDE.md §2: nie ein blindes `decrement` auf den Bestand).
 *
 * Ursache: `data: { stock: { decrement: n } }` ohne Bedingung zieht den Bestand unter 0, sobald
 * zwei Käufe gleichzeitig kommen — der Hof verkauft Ware, die es nicht gibt. Bisher prüften nur
 * einzelne Tests ihre Pfade (`tests/checkout-kritisch.test.ts`, `tests/verkauf-vorrat.test.ts`);
 * ein dritter Weg mit nacktem `decrement` bliebe unbemerkt.
 *
 * Beweist (Quelltext von `src/`, TypeScript-Syntaxbaum, kein Netz, keine Datenbank): Jedes
 * `decrement: …` steht in `data: { <Spalte>: { decrement } }` eines `updateMany`-Aufrufs, dessen
 * `where` als Objekt dieselbe Spalte mit einer `gte`-Bedingung trägt (`stock: { gte: menge }`).
 * Sonst meldet die Wache die Stelle — auch `update`, `upsert` und ein `where`, das nur eine Variable
 * ist (die Bedingung muss im Aufruf sichtbar stehen). Kommentare zählen nicht.
 *
 * Gegenprobe: Text-Attrappen — nacktes `decrement` in `update`, `updateMany` ohne Bedingung oder mit
 * `lt`/`gt`, `gte` auf einer anderen Spalte, `where` als Variable — schlagen an; die bedingte Form
 * und ein Kommentar nicht. Keine Datei im Repository wird dafür verändert.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

/** Der Name einer Eigenschaft im Objekt-Literal (`stock`, `'stock'`) — sonst null. */
function eigenschaftsName(name: ts.PropertyName): string | null {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null
}

/** Die Eigenschaft `name` eines Objekt-Literals, deren Wert wieder ein Objekt-Literal ist. */
function objektWert(objekt: ts.ObjectLiteralExpression, name: string): ts.ObjectLiteralExpression | null {
  for (const e of objekt.properties) {
    if (ts.isPropertyAssignment(e) && eigenschaftsName(e.name) === name && ts.isObjectLiteralExpression(e.initializer)) return e.initializer
  }
  return null
}

/** Ob das Objekt-Literal eine Eigenschaft `name` hat (auch in Kurzform `{ gte }`). */
function hatEigenschaft(objekt: ts.ObjectLiteralExpression, name: string): boolean {
  return objekt.properties.some((e) => (ts.isPropertyAssignment(e) || ts.isShorthandPropertyAssignment(e)) && eigenschaftsName(e.name) === name)
}

/** Alle Stellen mit `decrement`, die keine bedingte Buchung sind: `Datei:Zeile Grund`. Leer = in Ordnung. */
function pruefeDecrement(quelltext: string, pfad = 'schnipsel.ts'): string[] {
  const datei = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const befunde: string[] = []

  function stelle(knoten: ts.Node): string {
    return `${pfad}:${datei.getLineAndCharacterOfPosition(knoten.getStart()).line + 1}`
  }

  function besuche(knoten: ts.Node): void {
    if (ts.isPropertyAssignment(knoten) && eigenschaftsName(knoten.name) === 'decrement') {
      const grund = ablehnung(knoten)
      if (grund) befunde.push(`${stelle(knoten)} ${grund}`)
    }
    ts.forEachChild(knoten, besuche)
  }

  /** Warum das `decrement` keine bedingte Buchung ist — null, wenn es eine ist. */
  function ablehnung(decrement: ts.PropertyAssignment): string | null {
    // decrement ← { decrement } ← <Spalte>: { … } ← data: { … } ← Argument von updateMany(…)
    const spaltenWert = decrement.parent
    const spalte = ts.isPropertyAssignment(spaltenWert.parent) ? eigenschaftsName(spaltenWert.parent.name) : null
    const dataObjekt = spaltenWert.parent?.parent
    const dataEigenschaft = dataObjekt?.parent
    const argument = dataEigenschaft?.parent
    const aufruf = argument?.parent
    if (
      !spalte ||
      !ts.isObjectLiteralExpression(dataObjekt) ||
      !ts.isPropertyAssignment(dataEigenschaft) ||
      eigenschaftsName(dataEigenschaft.name) !== 'data' ||
      !ts.isObjectLiteralExpression(argument) ||
      !ts.isCallExpression(aufruf) ||
      !ts.isPropertyAccessExpression(aufruf.expression)
    ) {
      return 'decrement außerhalb von data: { <Spalte>: { decrement } } eines Prisma-Aufrufs'
    }
    const methode = aufruf.expression.name.text
    if (methode !== 'updateMany') return `decrement in ${methode} — nur updateMany mit gte-Bedingung (stock >= Menge)`
    const where = objektWert(argument, 'where')
    if (!where) return 'updateMany ohne where als Objekt — die Bedingung muss im Aufruf stehen'
    const bedingung = objektWert(where, spalte)
    if (!bedingung || !hatEigenschaft(bedingung, 'gte')) return `updateMany ohne ${spalte}: { gte } im where`
    return null
  }

  besuche(datei)
  return befunde
}

describe('decrement-Wache — nie ein blindes decrement im Quelltext', () => {
  it('jedes decrement in src/ steht in einem updateMany mit gte-Bedingung auf dieselbe Spalte', () => {
    const dateien = [...quelldateien(join(WURZEL, 'src'))]
    // Die Wache muss die beiden Buchungswege tatsächlich sehen.
    const relativ = dateien.map((d) => relative(WURZEL, d).split(sep).join('/'))
    expect(relativ).toContain('src/app/api/checkout/route.ts')
    expect(relativ).toContain('src/server/actions/manual-sales.ts')
    const befunde = dateien.flatMap((d) => pruefeDecrement(readFileSync(d, 'utf8'), relative(WURZEL, d).split(sep).join('/')))
    expect(befunde).toEqual([])
  }, 30_000)
})

describe('decrement-Wache — Gegenprobe: die Suche schlägt an', () => {
  it('findet ein nacktes decrement in update, upsert und updateMany ohne Bedingung', () => {
    for (const text of [
      'await prisma.product.update({ where: { id }, data: { stock: { decrement: 1 } } })',
      'await prisma.product.upsert({ where: { id }, update: {}, create: {}, data: { stock: { decrement: 1 } } })',
      'await prisma.product.updateMany({ where: { id }, data: { stock: { decrement: 1 } } })',
      'await prisma.product.updateMany({ data: { stock: { decrement: 1 } } })',
      "await tx.product.update({ where: { id }, data: { 'stock': { 'decrement': menge } } })",
    ]) {
      expect(pruefeDecrement(text), text).toHaveLength(1)
    }
  })

  it('findet eine Bedingung, die den Bestand nicht schützt: lt, gt, andere Spalte, Variable, ohne Objekt', () => {
    for (const text of [
      'await p.updateMany({ where: { id, stock: { lt: 5 } }, data: { stock: { decrement: 1 } } })',
      'await p.updateMany({ where: { id, stock: { gt: 0 } }, data: { stock: { decrement: 1 } } })',
      'await p.updateMany({ where: { id, reserved: { gte: 1 } }, data: { stock: { decrement: 1 } } })',
      'await p.updateMany({ where: { id, stock: 5 }, data: { stock: { decrement: 1 } } })',
      'await p.updateMany({ where: bedingung, data: { stock: { decrement: 1 } } })',
      'await p.updateMany({ where: { id }, data: daten })\nconst daten = { stock: { decrement: 1 } }',
    ]) {
      expect(pruefeDecrement(text), text).toHaveLength(1)
    }
  })

  it('nennt die Zeile des Fundes', () => {
    const text = 'const a = 1\n\nawait prisma.product.update({ data: { stock: { decrement: 1 } } })'
    expect(pruefeDecrement(text, 'src/x.ts')).toEqual([expect.stringMatching(/^src\/x\.ts:3 /)])
  })

  it('lässt die bedingte Buchung durch — auch mit weiteren Bedingungen und anderer Spalte', () => {
    for (const text of [
      'await p.updateMany({ where: { id, stock: { gte: menge } }, data: { stock: { decrement: menge } } })',
      'await tx.product.updateMany({ where: { id: produktId, farmId, stock: { gte } }, data: { stock: { decrement: menge } } })',
      "await p.updateMany({ where: { id, 'stock': { gte: 1 } }, data: { stock: { decrement: 1 } } })",
      'await p.updateMany({ where: { id, platz: { gte: n } }, data: { platz: { decrement: n } } })',
    ]) {
      expect(pruefeDecrement(text), text).toEqual([])
    }
  })

  it('zählt Kommentare und Texte nicht, und increment ist nicht Sache der Wache', () => {
    for (const text of [
      '// nie data: { stock: { decrement: 1 } }\nconst x = 1',
      '/* data: { stock: { decrement: n } } */',
      "const hinweis = 'data: { stock: { decrement: n } }'",
      'await p.update({ where: { id }, data: { stock: { increment: 1 } } })',
    ]) {
      expect(pruefeDecrement(text), text).toEqual([])
    }
  })
})
