/**
 * Fabrik-Wache (Nr. 127, Regelvorschlag 119, freigegeben 20.10.2026).
 *
 * Die Regel (TESTING_GUIDELINES §5, ersetzt „keine geteilte Fixture-Datei ohne Not“ für diese Fälle): Typen, die in
 * mehr als drei Testdateien nachgebaut werden, bekommen EINE Fabrik in `tests/fabrik/<typ>.ts`; sonst bleiben Faktoren
 * lokal. Die Fabrik liefert bei jedem Aufruf ein frisches, vollständiges Objekt, die Testdatei überschreibt nur, was sie
 * prüft (`publicFarm({ isPaused: true })`, `hofRohdaten({ stripeBereit: true })`). Ein neues Pflichtfeld im Typ bricht
 * dann nur die Fabrik. Heute: `PublicFarm`, `HofRohdaten`.
 *
 * Ursache (Nr. 119): `PublicFarm` und `HofRohdaten` bekamen Pflichtfelder; elf Testdateien bauten den Typ
 * selbst nach und mussten je eine Zeile bekommen — Konfliktfläche für parallele Nummern.
 *
 * Beweist (Quelltext von `tests/`, TypeScript-Syntaxbaum, kein Netz): Außerhalb von `tests/fabrik/` steht
 * kein Objekt-Literal, das als `PublicFarm` oder `HofRohdaten` ausgeschrieben ist — weder als
 * `const x: Typ = { … }`, noch als `{ … } as Typ` / `as unknown as Typ` / `satisfies Typ`, noch als
 * Rückgabewert einer Funktion mit diesem Rückgabetyp. Ein Literal, das nur wenige Felder setzt
 * (höchstens MAX_EIGENE_FELDER, etwa `{ ...HOF, isPaused: false }`), übernimmt den Rest aus einem
 * vollständigen Hof und ist erlaubt — ein neues Pflichtfeld bricht es nicht. Ein langes Literal mit
 * `...ueber` (der alte Aufbau der Admin-Tests) zählt als Nachbau.
 *
 * Auch ohne Typangabe (Runde 1): Ein Literal als Argument (`mockResolvedValue({ … })`) oder als Wert einer Eigenschaft
 * (`createElement(Kopf, { hof: { … } })`) ist ein Nachbau, wenn es mindestens MIN_FELDER_DES_TYPS Felder des Typs hat
 * und darunter eines, das nur der Typ kennt (die Felder kommen aus dem Literal der Fabrik, das Gegenstück aus
 * `model Farm` in `prisma/schema.prisma`). Eine Datenbankzeile teilt viele Felder mit dem Typ, hat aber keines davon
 * allein, und bleibt erlaubt. Das ist eine Näherung ohne TypeChecker — Grenzen siehe unten.
 *
 * NICHT erkannt (offen, Nacharbeit): ein Nachbau ohne Typangabe mit weniger als MIN_FELDER_DES_TYPS Feldern des Typs
 * oder ganz ohne ein Feld, das nur der Typ kennt; ein Objekt, das nur aus Spreads (`{ ...a, ...b }`) besteht, weil
 * nur eigene Felder zählen. Ein Typ, dessen Felder alle in der Datenbankzeile vorkommen, bräuchte den TypeChecker
 * (`ts.Program`); der Test „bleibt nicht blind“ meldet das.
 *
 * Gegenprobe: Attrappen mit jeder Schreibweise schlagen an, ebenso ein langes Literal mit Spread und ein Literal
 * ohne Typangabe (Argument, Eigenschaft; beide Typen); ein kurzes Literal mit Spread, ein Aufruf der Fabrik, eine
 * Datenbankzeile und ein Literal eines anderen Typs nicht; die Fabriken liefern frische Objekte und lassen sich
 * überschreiben.
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

/** Die Namen der eigenen Felder eines Literals (Spreads zählen nicht); Name als Bezeichner oder Text. */
function feldNamen(literal: ts.ObjectLiteralExpression): string[] {
  return literal.properties.flatMap((p) =>
    !ts.isSpreadAssignment(p) && p.name !== undefined && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? [p.name.text] : [],
  )
}

/** Die Felder der Datenbankzeile `Farm` aus dem Schema — was sie hat, ist kein Merkmal des öffentlichen Typs. */
function datenbankFelder(): Set<string> {
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
  const rumpf = /^model Farm \{([\s\S]*?)^\}/m.exec(schema)?.[1] ?? ''
  return new Set(rumpf.split('\n').flatMap((zeile) => /^\s+([a-zA-Z]\w*)\s/.exec(zeile)?.slice(1) ?? []))
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

type Schluessel = { alle: Set<string>; nurImTyp: Set<string> }

let schluesselMerker: Record<string, Schluessel> | undefined

/** Je Fabrik-Typ: alle seine Felder (aus dem Literal der Fabrik) und die davon, die eine Datenbankzeile `Farm` nicht kennt. */
function schluesselMengen(): Record<string, Schluessel> {
  if (schluesselMerker) return schluesselMerker
  const datenbank = datenbankFelder()
  schluesselMerker = Object.fromEntries(
    Object.entries(FABRIKEN).map(([typ, pfad]) => {
      const alle = new Set<string>()
      besuche(parse(readFileSync(join(process.cwd(), pfad), 'utf8'), pfad), (k) => {
        if (ts.isObjectLiteralExpression(k) && typisiertAls(k) === typ) feldNamen(k).forEach((n) => alle.add(n))
      })
      return [typ, { alle, nurImTyp: new Set([...alle].filter((n) => !datenbank.has(n))) }]
    }),
  )
  return schluesselMerker
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

/**
 * Literale OHNE eigene Typangabe — als Argument (`mockResolvedValue({ … })`) oder als Wert einer Eigenschaft
 * (`createElement(Kopf, { hof: { … } })`) —, die einen der Typen nachbauen. Ohne TypeChecker erkennt man sie an den
 * Feldern: Ein Literal mit mindestens MIN_FELDER_DES_TYPS Feldern des Typs, darunter eines, das nur der Typ kennt (nicht
 * die Datenbankzeile `Farm`), ist ein Nachbau. Eine Datenbankzeile teilt viele Felder mit dem Typ, hat aber keines, das
 * nur er kennt, und bleibt erlaubt.
 */
const MIN_FELDER_DES_TYPS = MAX_EIGENE_FELDER + 1

function literaleOhneTypangabe(quelltext: string, name = 'attrappe.ts'): Array<{ stelle: string; typ: string }> {
  const mengen = schluesselMengen()
  const sf = parse(quelltext, name)
  const funde: Array<{ stelle: string; typ: string }> = []
  besuche(sf, (k) => {
    if (!ts.isObjectLiteralExpression(k) || typisiertAls(k) !== null) return
    const namen = new Set(feldNamen(k))
    const beste = Object.entries(mengen)
      .map(([typ, m]) => ({
        typ,
        gemeinsam: [...namen].filter((n) => m.alle.has(n)).length,
        nurImTyp: [...namen].filter((n) => m.nurImTyp.has(n)).length,
      }))
      .filter((t) => t.gemeinsam >= MIN_FELDER_DES_TYPS && t.nurImTyp > 0)
      .sort((a, b) => b.gemeinsam - a.gemeinsam)[0]
    if (beste) funde.push({ stelle: `${name}:${sf.getLineAndCharacterOfPosition(k.getStart(sf)).line + 1}`, typ: beste.typ })
  })
  return funde
}

/** Die ausgeschriebenen Literale (mit Typangabe: mehr als MAX_EIGENE_FELDER eigene Felder; ohne: siehe oben), je als „Datei:Zeile Typ“. Leer = keines. */
function ausgeschriebeneLiterale(quelltext: string, name = 'attrappe.ts'): string[] {
  return [
    ...typisierteLiterale(quelltext, name).filter((l) => l.felder > MAX_EIGENE_FELDER),
    ...literaleOhneTypangabe(quelltext, name),
  ].map((l) => `${l.stelle} ${l.typ}`)
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
    expect(funde, 'Die Fabrik nehmen: publicFarm({ … }) aus tests/fabrik/public-farm.ts bzw. hofRohdaten({ … }) aus tests/fabrik/hof-rohdaten.ts (auch ein Literal ohne Typangabe mit mindestens neun Feldern des Typs ist ein Nachbau)').toEqual([])
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

  describe('Literal ohne eigene Typangabe (Nr. 127, Runde 1)', () => {
    // Tests sind `.ts` (Vitest nimmt nur `tests/**/*.test.ts`): Statt `hof={{ … }}` steht das Literal als Wert einer
    // Eigenschaft in `createElement(Kopf, { hof: { … } })`, oder als Argument von `mockResolvedValue({ … })`.
    const mengen = schluesselMengen()
    const alsLiteral = (felder: Iterable<string>) => `{ ${[...felder].map((f) => `${f}: 1`).join(', ')} }`
    const farm = [...mengen.PublicFarm!.alle]
    const roh = [...mengen.HofRohdaten!.alle]
    const datenbank = [...datenbankFelder()]

    it('schlägt an: vollständiges Literal als Argument und als Eigenschaft einer Komponente, für beide Typen', () => {
      const faelle = [
        [`vi.mocked(getPublicFarm).mockResolvedValue(${alsLiteral(farm)})`, 'PublicFarm'],
        [`render(createElement(Kopf, { hof: ${alsLiteral(farm)}, aktiv: true }))`, 'PublicFarm'],
        [`vi.mocked(getAdminFarms).mockResolvedValue([${alsLiteral(roh)}])`, 'HofRohdaten'],
        [`render(createElement(Zeile, { hof: ${alsLiteral(roh)} }))`, 'HofRohdaten'],
      ] as const
      for (const [text, typ] of faelle) expect(ausgeschriebeneLiterale(text, 'neu.test.ts'), text).toEqual([`neu.test.ts:1 ${typ}`])
    })

    // Ein festes Grenzpaar: genau EIN Feld, das nur der Typ kennt, plus Felder, die auch `Farm` hat. So hängt die
    // Gegenprobe nur an der Feldzahl und nicht daran, wie viele berechnete Felder `PublicFarm` gerade hat.
    it('schlägt an der Grenze an: neun Felder des Typs, darunter eines, das nur der Typ kennt – acht nicht', () => {
      const nur = [...mengen.PublicFarm!.nurImTyp][0]!
      const auchInFarm = farm.filter((f) => !mengen.PublicFarm!.nurImTyp.has(f))
      const neun = [nur, ...auchInFarm.slice(0, MAX_EIGENE_FELDER)]
      const acht = [nur, ...auchInFarm.slice(0, MAX_EIGENE_FELDER - 1)]
      expect(neun).toHaveLength(MAX_EIGENE_FELDER + 1)
      expect(acht).toHaveLength(MAX_EIGENE_FELDER)
      expect(ausgeschriebeneLiterale(`g(${alsLiteral(neun)})`), 'neun').toEqual(['attrappe.ts:1 PublicFarm'])
      expect(ausgeschriebeneLiterale(`g(${alsLiteral(acht)})`), 'acht').toEqual([])
    })

    it('lässt durch: eine Datenbankzeile (alle Felder von `Farm`, keines nur im Typ), kurze Literale, fremde Felder', () => {
      for (const text of [
        `vi.mocked(prisma.farm.findUnique).mockResolvedValue(${alsLiteral(datenbank)})`,
        `g(${alsLiteral(farm.filter((f) => mengen.PublicFarm!.nurImTyp.has(f)))})`,
        `g({ ...HOF, ${[...mengen.PublicFarm!.nurImTyp].map((f) => `${f}: 1`).join(', ')}, isPaused: true })`,
        `g(${alsLiteral(Array.from({ length: 30 }, (_, i) => `x${i}`))})`,
      ]) {
        expect(ausgeschriebeneLiterale(text), text).toEqual([])
      }
    })

    it('bleibt nicht blind: jeder Typ hat mindestens ein Feld, das die Datenbankzeile `Farm` nicht kennt', () => {
      // Sonst fände die Wache keinen Nachbau ohne Typangabe mehr (sie hielte jedes Literal für eine Datenbankzeile).
      for (const [typ, m] of Object.entries(mengen)) expect([...m.nurImTyp].length, typ).toBeGreaterThan(0)
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
