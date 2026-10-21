/**
 * Fabrik-Wache (Nr. 127, Regelvorschlag 119, freigegeben 20.10.2026).
 *
 * Ursache (Nr. 119): `PublicFarm` und `HofRohdaten` bekamen Pflichtfelder; elf Testdateien bauten den Typ
 * selbst nach und mussten je eine Zeile bekommen — Konfliktfläche für parallele Nummern. Seitdem gibt es
 * für Typen, die in mehr als drei Testdateien nachgebaut werden, EINE Fabrik in `tests/fabrik/<typ>.ts`
 * (TESTING_GUIDELINES §5).
 *
 * Beweist (Quelltext von `tests/`, TypeScript-Syntaxbaum, kein Netz): Außerhalb von `tests/fabrik/` steht
 * kein Objekt-Literal, das als `PublicFarm` oder `HofRohdaten` ausgeschrieben ist — weder als
 * `const x: Typ = { … }`, noch als `{ … } as Typ` / `as unknown as Typ` / `satisfies Typ`, noch als
 * Rückgabewert einer Funktion mit diesem Rückgabetyp. Ein Literal, das nur wenige Felder setzt
 * (höchstens MAX_EIGENE_FELDER, etwa `{ ...HOF, isPaused: false }`), übernimmt den Rest aus einem
 * vollständigen Hof und ist erlaubt — ein neues Pflichtfeld bricht es nicht. Ein langes Literal mit
 * `...ueber` (der alte Aufbau der Admin-Tests) zählt als Nachbau. Damit bricht ein neues Feld im Typ nur
 * noch die Fabrik (der Typecheck zeigt es dort).
 *
 * Gegenprobe: Attrappen mit jeder Schreibweise schlagen an, ebenso ein langes Literal mit Spread; ein
 * kurzes Literal mit Spread, ein Aufruf der Fabrik und ein Literal eines anderen Typs nicht; die Fabriken
 * liefern frische Objekte und lassen sich überschreiben.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { hofRohdaten } from './fabrik/hof-rohdaten'
import { publicFarm } from './fabrik/public-farm'

const ORDNER = join(process.cwd(), 'tests')

/** Mehr eigene Felder als diese setzt kein Literal, das den Rest aus einem vollständigen Hof übernimmt. */
const MAX_EIGENE_FELDER = 8

/** Typ → seine Fabrik. Ein Typ kommt hierher, sobald mehr als drei Testdateien ihn nachbauen. */
const FABRIKEN: Record<string, string> = {
  PublicFarm: 'tests/fabrik/public-farm.ts',
  HofRohdaten: 'tests/fabrik/hof-rohdaten.ts',
}

function parse(quelltext: string, name = 'attrappe.ts'): ts.SourceFile {
  return ts.createSourceFile(name, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
}

function besuche(knoten: ts.Node, fn: (k: ts.Node) => void): void {
  fn(knoten)
  ts.forEachChild(knoten, (kind) => besuche(kind, fn))
}

const typName = (t: ts.TypeNode | undefined): string | null =>
  t && ts.isTypeReferenceNode(t) && ts.isIdentifier(t.typeName) ? t.typeName.text : null

/** Als welchen der Fabrik-Typen das Literal geschrieben ist (Annotation, `as`, `satisfies`, Rückgabetyp); sonst `null`. */
function typisiertAls(literal: ts.ObjectLiteralExpression): string | null {
  let knoten: ts.Node = literal
  let eltern: ts.Node = literal.parent
  while (ts.isParenthesizedExpression(eltern) || ts.isAsExpression(eltern) || ts.isSatisfiesExpression(eltern)) {
    if ((ts.isAsExpression(eltern) || ts.isSatisfiesExpression(eltern)) && typName(eltern.type) !== null && typName(eltern.type)! in FABRIKEN) {
      return typName(eltern.type)
    }
    knoten = eltern
    eltern = eltern.parent
  }
  if (ts.isVariableDeclaration(eltern) && eltern.initializer === knoten) {
    const name = typName(eltern.type)
    return name !== null && name in FABRIKEN ? name : null
  }
  // return { … } in einer Funktion mit Rückgabetyp, und die Kurzform () => ({ … })
  let funktion: ts.Node | undefined
  if (ts.isReturnStatement(eltern)) {
    funktion = eltern.parent
    while (funktion && !ts.isFunctionLike(funktion)) funktion = funktion.parent
  } else if (ts.isArrowFunction(eltern) && eltern.body === knoten) {
    funktion = eltern
  }
  if (funktion && ts.isFunctionLike(funktion)) {
    const name = typName(funktion.type)
    return name !== null && name in FABRIKEN ? name : null
  }
  return null
}

/** Steht das Literal unter `as unknown as …`? */
function ueberUnknown(literal: ts.ObjectLiteralExpression): boolean {
  for (let k: ts.Node = literal.parent; ts.isParenthesizedExpression(k) || ts.isAsExpression(k) || ts.isSatisfiesExpression(k); k = k.parent) {
    if (ts.isAsExpression(k) && k.type.kind === ts.SyntaxKind.UnknownKeyword) return true
  }
  return false
}

/** Alle Objekt-Literale eines Quelltexts, die als einer der Fabrik-Typen geschrieben sind, mit der Zahl ihrer eigenen Felder. */
function typisierteLiterale(quelltext: string, name = 'attrappe.ts'): Array<{ stelle: string; typ: string; felder: number }> {
  const sf = parse(quelltext, name)
  const funde: Array<{ stelle: string; typ: string; felder: number }> = []
  besuche(sf, (k) => {
    if (!ts.isObjectLiteralExpression(k)) return
    const typ = typisiertAls(k)
    if (typ === null) return
    // `as unknown as Typ` verbirgt fehlende Felder vor dem Typecheck: immer ein Nachbau, egal wie kurz.
    const felder = ueberUnknown(k) ? Number.POSITIVE_INFINITY : k.properties.filter((p) => !ts.isSpreadAssignment(p)).length
    funde.push({ stelle: `${name}:${sf.getLineAndCharacterOfPosition(k.getStart(sf)).line + 1}`, typ, felder })
  })
  return funde
}

/** Die ausgeschriebenen Literale (mehr als MAX_EIGENE_FELDER eigene Felder), je als „Datei:Zeile Typ“. Leer = keines. */
function ausgeschriebeneLiterale(quelltext: string, name = 'attrappe.ts'): string[] {
  return typisierteLiterale(quelltext, name)
    .filter((l) => l.felder > MAX_EIGENE_FELDER)
    .map((l) => `${l.stelle} ${l.typ}`)
}

function dateienUnter(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? dateienUnter(join(ordner, e.name)) : e.name.endsWith('.ts') ? [join(ordner, e.name)] : [],
  )
}

describe('Fabrik-Wache: ein neues Feld im Typ bricht nur die Fabrik (Nr. 119)', () => {
  it('kein Test schreibt PublicFarm oder HofRohdaten noch einmal aus', () => {
    const funde = dateienUnter(ORDNER)
      .map((pfad) => ({ name: relative(ORDNER, pfad).split(sep).join('/'), pfad }))
      .filter((d) => !d.name.startsWith('fabrik/') && d.name !== 'fabrik-wache.test.ts')
      .flatMap((d) => ausgeschriebeneLiterale(readFileSync(d.pfad, 'utf8'), d.name))
    expect(funde, 'Die Fabrik nehmen: publicFarm({ … }) aus tests/fabrik/public-farm.ts bzw. hofRohdaten({ … }) aus tests/fabrik/hof-rohdaten.ts').toEqual([])
  })

  it('die Fabriken liegen dort, wo FABRIKEN sie nennt, und schreiben das Literal je einmal aus', () => {
    for (const [typ, pfad] of Object.entries(FABRIKEN)) {
      const text = readFileSync(join(process.cwd(), pfad), 'utf8')
      const lang = typisierteLiterale(text, pfad).filter((l) => l.felder > MAX_EIGENE_FELDER)
      expect(lang.map((l) => l.typ), pfad).toEqual([typ])
    }
  })

  describe('Gegenprobe an Attrappen', () => {
    // Ein Nachbau hat deutlich mehr als MAX_EIGENE_FELDER Felder.
    const FELDER = Array.from({ length: MAX_EIGENE_FELDER + 3 }, (_, i) => `f${i}: ${i}`).join(', ')

    it('schlägt bei jeder Schreibweise an: Annotation, as, as unknown as, satisfies, Rückgabetyp, Kurzform', () => {
      const faelle = [
        `const HOF: PublicFarm = { ${FELDER} }`,
        `const HOF = { ${FELDER} } as PublicFarm`,
        `const hof = { ${FELDER} } as unknown as PublicFarm`,
        `const HOF = { ${FELDER} } satisfies PublicFarm`,
        `function roh(): HofRohdaten { return { ${FELDER} } }`,
        `const roh = (): HofRohdaten => ({ ${FELDER} })`,
      ]
      for (const text of faelle) expect(ausgeschriebeneLiterale(text), text).toHaveLength(1)
    })

    it('schlägt auch bei einem langen Literal mit Spread an (der alte Aufbau `…, ...ueber` der Admin-Tests)', () => {
      const roh = `function roh(id: string, ueber: Partial<HofRohdaten> = {}): HofRohdaten {\n  return { ${FELDER}, ...ueber }\n}`
      expect(ausgeschriebeneLiterale(roh)).toHaveLength(1)
    })

    it('schlägt bei `as unknown as Typ` auch bei einem kurzen Literal an (verbirgt fehlende Felder)', () => {
      expect(ausgeschriebeneLiterale(`const farm = { name: 'Hof Test', slug: 'hof-test' } as unknown as PublicFarm`)).toHaveLength(1)
    })

    it('nennt Datei, Zeile und Typ', () => {
      expect(ausgeschriebeneLiterale(`import x from 'x'\n\nconst HOF: PublicFarm = { ${FELDER} }`, 'neu.test.ts')).toEqual(['neu.test.ts:3 PublicFarm'])
    })

    it('lässt ein kurzes Literal mit Spread, die Fabrik und andere Typen durch', () => {
      for (const text of [
        `const HOF_OFFEN: PublicFarm = { ...HOF, isPaused: false }`,
        `const hof: PublicFarm = { ...HOF, products: HOF.products.map((p) => p) }`,
        `const hof = publicFarm({ isPaused: true })`,
        `const roh = hofRohdaten({ stripeBereit: true })`,
        `const x: Partial<PublicFarm> = { ${FELDER} }`,
        `const foto: PublicFarmPhoto = { ${FELDER} }`,
        `const ueber = { ${FELDER} }`,
      ]) {
        expect(ausgeschriebeneLiterale(text), text).toEqual([])
      }
    })
  })

  describe('Die Fabriken', () => {
    it('liefern bei jedem Aufruf ein frisches Objekt, auch in Listen und Daten', () => {
      expect(publicFarm()).not.toBe(publicFarm())
      expect(publicFarm().pickupSlots).not.toBe(publicFarm().pickupSlots)
      expect(hofRohdaten().createdAt).not.toBe(hofRohdaten().createdAt)
      expect(hofRohdaten().monat).not.toBe(hofRohdaten().monat)
    })

    it('überschreiben genau das, was die Testdatei nennt', () => {
      expect(publicFarm({ isPaused: true, name: 'Testhof A' })).toMatchObject({ isPaused: true, name: 'Testhof A', slug: 'hof-test' })
      expect(hofRohdaten({ stripeBereit: true }).stripeBereit).toBe(true)
      expect(hofRohdaten().stripeBereit).toBe(false)
    })
  })
})
