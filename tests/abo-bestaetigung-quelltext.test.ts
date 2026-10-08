/**
 * Wache am Quelltext (Double-Opt-in, Register S11, Nr. 38; über den
 * TypeScript-Parser seit Nr. 47):
 *  - Empfänger werblicher Mails kommen nur über `WERBEMAIL_EMPFAENGER`
 *    (src/server/abo-anmeldung.ts), nie über `optInEmail: true` als Filter.
 *  - Den Haken SCHREIBT nur der Knopf (`data` in `bestaetigeEmailAbo`).
 *    Setzte ihn ein anderer Weg, gälte ein zurückgesetztes Abo („nie
 *    angefragt") als Bestand und bekäme Werbung ohne Bestätigung.
 *
 * Wie die Wache liest: Für jedes `optInEmail` in einem Objekt entscheidet der
 * INNERSTE umschließende Schlüssel, was der Wert bedeutet.
 *  - Schreiben (`data`, `create`, `update`): nur das Literal `false`.
 *  - Filtern (`where`, `having` und die Relations- und Logikfilter `some`,
 *    `every`, `none`, `is`, `isNot`, `AND`, `OR`, `NOT`) — auch unter einer
 *    Auswahl (`include: { abos: { where: … } }`, `_count`): nur das Literal
 *    `false`, und auch das nicht unter einer Verneinung (`NOT`, `none`,
 *    `isNot`), denn `NOT: { optInEmail: false }` filtert nach `true`.
 *  - Lesen (`select`, `include`, `orderBy`): alles — `true` heißt „mitlesen".
 *  - Sonst (Konstanten, Antworten, Formulare): kein konstantes `true` — eine
 *    Konstante mit dem Haken kann später als `data` oder `where` dienen.
 * Vor dem Vergleich fallen Klammern, `as`, `satisfies`, `<T>` und `!` weg;
 * „konstant true" ist auch `!0` oder `!!1`. Jeder andere Wert — Variable,
 * Bedingung, Objekt wie `{ equals: true }`, Kurzschreibweise — zählt in
 * Schreib- und Filterobjekten als Verstoß.
 *
 * Die erlaubten Stellen, nur in abo-anmeldung.ts (Test „…genau die vier
 * erlaubten Stellen"):
 *  1. `data` in `bestaetigeEmailAbo` — der Knopf.
 *  2. `WERBEMAIL_EMPFAENGER` — DER Empfängerfilter (gilt als Filter).
 *  3. `EMAIL_ABO_STAND` — eine Auswahl für `select` (gilt als Lesen).
 *  4. Die Vorbedingung in `meldeEmailAboAn` (`where: { optInEmail:
 *     abo.optInEmail, … }`): schreibt nur auf genau den gelesenen Stand —
 *     ein Vergleich mit dem Feld des gelesenen Abos, kein Empfängerfilter.
 *
 * Grenzen (bewusst, mit Blick auf heutigen Code): Die Wache sieht
 * Objekt-Literale dort, wo sie stehen. Ein Wert aus einer Variablen
 * (`const w = { optInEmail: x }; findMany({ where: w })`) fällt nur auf, wenn
 * er konstant `true` ist; ein in JavaScript gefiltertes `optInEmail` (statt
 * `werbemailErlaubt`) und rohes SQL sieht sie nicht — beides gibt es heute
 * nicht. Vorher prüfte sie Zeilen: Ein einzeiliges `update({ data: {
 * optInEmail: true }, select: … })`, ein nicht-literaler Wert, ein Filter
 * unter einer Auswahl und `true as const` gingen durch. Mit Gegenproben genau
 * dafür.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, it, expect } from 'vitest'

const WURZEL = join(process.cwd(), 'src')
const ABO_ANMELDUNG_PFAD = 'server/abo-anmeldung.ts'

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) return dateien(pfad)
    return /\.(ts|tsx)$/.test(name) ? [pfad] : []
  })
}

/** Schlüssel, deren Wert in die Datenbank geschrieben wird. */
const SCHREIB_SCHLUESSEL = new Set(['data', 'create', 'update'])
/** Schlüssel, deren Wert Zeilen auswählt — auch als Relations- und Logikfilter. */
const FILTER_SCHLUESSEL = new Set(['where', 'having', 'some', 'every', 'none', 'is', 'isNot', 'AND', 'OR', 'NOT'])
/** Filter, die ihren Inhalt verneinen: Darunter heißt `false` „true". */
const VERNEINUNG = new Set(['NOT', 'none', 'isNot'])
/** Schlüssel, unter denen ein `true` nur „mitlesen" heißt. */
const LESE_AUSWAHL = new Set(['select', 'include', 'orderBy'])

type Fund = { zeile: number; grund: string; text: string }
type Ort = { art: 'schreiben' | 'filtern' | 'lesen' | 'sonst'; verneint: boolean; empfaengerFilter: boolean }

const GRUND_SCHREIBT = 'schreibt optInEmail mit einem Wert außer false'
const GRUND_FILTERT = 'filtert nach optInEmail mit einem Wert außer false (Empfänger nur über WERBEMAIL_EMPFAENGER)'
const GRUND_TRUE = 'optInEmail: true außerhalb von Auswahl und Filter (kann später als data oder where dienen)'

/** Der Name einer Objekt-Eigenschaft — auch als Text- oder berechneter Schlüssel. */
function eigenschaftsName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text
  if (ts.isComputedPropertyName(name)) {
    const ausdruck = name.expression
    if (ts.isStringLiteral(ausdruck) || ts.isNoSubstitutionTemplateLiteral(ausdruck)) return ausdruck.text
  }
  return null
}

/** Der Wert ohne Hüllen, die an ihm nichts ändern: `(x)`, `x as T`, `x satisfies T`, `<T>x`, `x!`. */
function abgestreift(ausdruck: ts.Expression): ts.Expression {
  let a = ausdruck
  while (ts.isParenthesizedExpression(a) || ts.isAsExpression(a) || ts.isSatisfiesExpression(a) || ts.isTypeAssertionExpression(a) || ts.isNonNullExpression(a)) {
    a = a.expression
  }
  return a
}

const UNBEKANNT = Symbol('unbekannt')

/** Der Wert, wenn er ohne Ausführen feststeht (`true`, `!0`, `!!1` …), sonst UNBEKANNT. */
function konstante(ausdruck: ts.Expression): unknown {
  const a = abgestreift(ausdruck)
  if (a.kind === ts.SyntaxKind.TrueKeyword) return true
  if (a.kind === ts.SyntaxKind.FalseKeyword) return false
  if (ts.isNumericLiteral(a)) return Number(a.text)
  if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) return a.text
  if (ts.isPrefixUnaryExpression(a) && a.operator === ts.SyntaxKind.ExclamationToken) {
    const innen = konstante(a.operand)
    return innen === UNBEKANNT ? UNBEKANNT : !innen
  }
  return UNBEKANNT
}

/**
 * Was ein `optInEmail` an dieser Stelle bedeutet: Der innerste Schlüssel aus
 * Schreiben, Filtern oder Lesen entscheidet; eine Verneinung irgendwo
 * darüber merkt sich die Wache. In abo-anmeldung.ts gelten die beiden
 * Konstanten als das, wofür sie da sind: `WERBEMAIL_EMPFAENGER` als Filter
 * (erlaubt), `EMAIL_ABO_STAND` als Auswahl.
 */
function zusammenhang(knoten: ts.Node, istAboAnmeldung: boolean): Ort {
  let art: Ort['art'] | null = null
  let verneint = false
  let empfaengerFilter = false
  for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) {
    if (ts.isPropertyAssignment(k)) {
      const name = eigenschaftsName(k.name)
      if (name === null) continue
      if (VERNEINUNG.has(name)) verneint = true
      if (art !== null) continue
      if (SCHREIB_SCHLUESSEL.has(name)) art = 'schreiben'
      else if (FILTER_SCHLUESSEL.has(name)) art = 'filtern'
      else if (LESE_AUSWAHL.has(name)) art = 'lesen'
    } else if (art === null && istAboAnmeldung && ts.isVariableDeclaration(k) && ts.isIdentifier(k.name)) {
      if (k.name.text === 'WERBEMAIL_EMPFAENGER') {
        art = 'filtern'
        empfaengerFilter = true
      } else if (k.name.text === 'EMAIL_ABO_STAND') art = 'lesen'
    }
  }
  return { art: art ?? 'sonst', verneint, empfaengerFilter }
}

/** Liegt der Knoten in der Funktion `name`? */
function inFunktion(knoten: ts.Node, name: string): boolean {
  for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) {
    if (ts.isFunctionDeclaration(k) && k.name?.text === name) return true
  }
  return false
}

/**
 * Alle Verstöße einer Datei. `istAboAnmeldung` schaltet die erlaubten
 * Stellen frei, die es nur in src/server/abo-anmeldung.ts gibt.
 */
function verstoesse(quelltext: string, pfad: string, istAboAnmeldung: boolean): Fund[] {
  const datei = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, pfad.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const funde: Fund[] = []
  const melde = (knoten: ts.Node, grund: string) =>
    funde.push({ zeile: datei.getLineAndCharacterOfPosition(knoten.getStart(datei)).line + 1, grund, text: knoten.getText(datei) })

  const besuche = (knoten: ts.Node): void => {
    const kurz = ts.isShorthandPropertyAssignment(knoten) && knoten.name.text === 'optInEmail'
    const lang = ts.isPropertyAssignment(knoten) && eigenschaftsName(knoten.name) === 'optInEmail'
    if (kurz || lang) {
      // Kurzschreibweise `{ optInEmail }`: ein Variablenwert, also nie `false`.
      const wert = lang ? abgestreift((knoten as ts.PropertyAssignment).initializer) : null
      const istFalse = wert?.kind === ts.SyntaxKind.FalseKeyword
      const ort = zusammenhang(knoten, istAboAnmeldung)
      if (ort.art === 'schreiben') {
        const knopf = istAboAnmeldung && inFunktion(knoten, 'bestaetigeEmailAbo')
        if (!istFalse && !knopf) melde(knoten, GRUND_SCHREIBT)
      } else if (ort.art === 'filtern') {
        // Die Vorbedingung des bedingten Schreibens: der Wert des gelesenen Abos.
        const vorbedingung =
          istAboAnmeldung &&
          inFunktion(knoten, 'meldeEmailAboAn') &&
          wert !== null &&
          ts.isPropertyAccessExpression(wert) &&
          wert.name.text === 'optInEmail'
        if ((!istFalse || ort.verneint) && !ort.empfaengerFilter && !vorbedingung) melde(knoten, GRUND_FILTERT)
      } else if (ort.art === 'sonst' && wert !== null && konstante(wert) === true) {
        melde(knoten, GRUND_TRUE)
      }
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return funde
}

/** Für die Gegenproben: ein Schnipsel als fremde Datei bzw. als abo-anmeldung.ts. */
function schnipsel(text: string, alsAboAnmeldung = false): Fund[] {
  return verstoesse(text, alsAboAnmeldung ? ABO_ANMELDUNG_PFAD : 'schnipsel.ts', alsAboAnmeldung)
}

const ABO_ANMELDUNG = readFileSync(join(WURZEL, ABO_ANMELDUNG_PFAD), 'utf8')

describe('Den Haken setzt nur der Knopf, Empfänger nur über WERBEMAIL_EMPFAENGER', () => {
  it('in ganz src/ schreibt kein Weg optInEmail außer false, und true steht nur in Lese-Auswahlen und den erlaubten Stellen', () => {
    const treffer = dateien(WURZEL).flatMap((pfad) => {
      const rel = relative(WURZEL, pfad).split('\\').join('/')
      return verstoesse(readFileSync(pfad, 'utf8'), rel, rel === ABO_ANMELDUNG_PFAD).map((f) => `${rel}:${f.zeile} ${f.grund} — ${f.text}`)
    })
    expect(treffer).toEqual([])
  })

  it('ohne die Ausnahmen meldet die Wache in abo-anmeldung.ts genau die vier erlaubten Stellen', () => {
    // Die Ausnahmen schneiden also genau diese Stellen aus und nicht mehr.
    const ohneAusnahmen = verstoesse(ABO_ANMELDUNG, 'fremd.ts', false)
    const zeile = (f: Fund) => ABO_ANMELDUNG.split('\n')[f.zeile - 1]
    const je = (grund: string) => ohneAusnahmen.filter((f) => f.grund === grund)
    expect(ohneAusnahmen).toHaveLength(4)
    // 1. Der Knopf schreibt den Haken.
    expect(je(GRUND_SCHREIBT)).toHaveLength(1)
    expect(zeile(je(GRUND_SCHREIBT)[0])).toMatch(/data:\s*\{\s*optInEmail:\s*true/)
    // 4. Die Vorbedingung in meldeEmailAboAn vergleicht mit dem gelesenen Abo.
    expect(je(GRUND_FILTERT).map((f) => f.text)).toEqual(['optInEmail: abo.optInEmail'])
    // 2. und 3. Die beiden Konstanten — als fremde Datei bloß Objekte mit `true`.
    const inKonstante = (name: string) => (f: Fund) => {
      const zeilen = ABO_ANMELDUNG.split('\n')
      const von = zeilen.findIndex((z) => z.startsWith(`export const ${name} =`)) + 1
      const bis = zeilen.findIndex((z, i) => i >= von && z.startsWith('}')) + 1
      return von > 0 && f.zeile > von && f.zeile < bis
    }
    expect(je(GRUND_TRUE)).toHaveLength(2)
    expect(je(GRUND_TRUE).filter(inKonstante('WERBEMAIL_EMPFAENGER'))).toHaveLength(1)
    expect(je(GRUND_TRUE).filter(inKonstante('EMAIL_ABO_STAND'))).toHaveLength(1)
  })

  it('der Versand der Beiträge und der Zähler auf „Neuer Beitrag" nehmen den Filter', () => {
    const versand = readFileSync(join(WURZEL, 'server/actions/status-posts.ts'), 'utf8')
    const zaehler = readFileSync(join(WURZEL, 'app/(hof)/status/new/page.tsx'), 'utf8')
    expect(versand).toMatch(/where:\s*\{\s*farmId:\s*farm\.id,\s*\.\.\.WERBEMAIL_EMPFAENGER\s*\}/)
    expect(zaehler).toMatch(/count\(\{\s*where:\s*\{\s*farmId:\s*farm\.id,\s*\.\.\.WERBEMAIL_EMPFAENGER\s*\}/)
  })
})

describe('Gegenproben: was die alte Zeilen-Wache durchließ, schlägt jetzt an', () => {
  it('einzeiliges update mit data und select auf derselben Zeile', () => {
    expect(schnipsel('prisma.customerFarmSubscription.update({ where: { id }, data: { optInEmail: true }, select: { id: true } })')).toHaveLength(1)
  })

  it('ein nicht-literaler Wert und die Kurzschreibweise in Schreib-Objekten', () => {
    expect(schnipsel('await prisma.customerFarmSubscription.updateMany({ where: wo, data: { optInEmail: eingabe.x } })')).toHaveLength(1)
    expect(schnipsel('await prisma.customerFarmSubscription.create({ data: { customerEmail, farmId, optInEmail } })')).toHaveLength(1)
    expect(schnipsel('upsert({ where: wo, create: { optInEmail: false }, update: { optInEmail: wert } })')).toHaveLength(1)
    // Auch bedingt eingestreut und als Text-Schlüssel.
    expect(schnipsel("update({ data: { ...(an ? { optInEmail: true } : {}) } })")).toHaveLength(1)
    expect(schnipsel("updateMany({ data: { 'optInEmail': wert } })")).toHaveLength(1)
  })

  it('ein zweiter Schreibweg in abo-anmeldung.ts selbst — etwa in meldeEmailAboAn', () => {
    const mitZweitemWeg = ABO_ANMELDUNG.replace(
      'data: { optInEmail: false, emailOptInAngefragtAm: jetzt, emailOptInBestaetigtAm: null }',
      'data: { optInEmail: true, emailOptInAngefragtAm: jetzt, emailOptInBestaetigtAm: null }'
    )
    expect(mitZweitemWeg).not.toBe(ABO_ANMELDUNG)
    expect(schnipsel(mitZweitemWeg, true)).toHaveLength(1)
    expect(schnipsel(ABO_ANMELDUNG, true)).toEqual([])
  })

  it('der alte Filter mit optInEmail: true schlägt weiter an — auch über mehrere Zeilen', () => {
    expect(schnipsel('findMany({\n  where: { farmId: farm.id, optInEmail: true },\n})')).toHaveLength(1)
    expect(schnipsel('count({ where: { farmId, optInEmail:true } })')).toHaveLength(1)
    // Eine eigene Konstante mit dem Haken, die später als data oder where dient.
    expect(schnipsel('const daten = { optInEmail: true }')).toHaveLength(1)
  })

  it('ein Filter unter einer Auswahl: include mit where und _count mit where (Nachbesserung 1)', () => {
    expect(schnipsel('findMany({ include: { subscriptions: { where: { optInEmail: true } } } })')).toEqual([
      expect.objectContaining({ grund: GRUND_FILTERT }),
    ])
    expect(schnipsel('findMany({ select: { _count: { select: { subscriptions: { where: { optInEmail: true } } } } } })')).toEqual([
      expect.objectContaining({ grund: GRUND_FILTERT }),
    ])
  })

  it('Relations- und Logikfilter zählen als Filter', () => {
    for (const filter of [
      'where: { subscriptions: { some: { optInEmail: true } } }',
      'where: { subscriptions: { every: { optInEmail: true } } }',
      'where: { abo: { is: { optInEmail: true } } }',
      'where: { AND: [{ farmId }, { optInEmail: true }] }',
      'where: { OR: [{ optInEmail: true }] }',
    ]) {
      expect(schnipsel(`findMany({ ${filter} })`), filter).toEqual([expect.objectContaining({ grund: GRUND_FILTERT })])
    }
  })

  it('unter einer Verneinung filtert auch false nach dem Haken', () => {
    expect(schnipsel('findMany({ where: { NOT: { optInEmail: false } } })')).toHaveLength(1)
    expect(schnipsel('findMany({ where: { AND: [{ NOT: [{ OR: [{ optInEmail: false }] }] }] } })')).toHaveLength(1)
    expect(schnipsel('findMany({ where: { subscriptions: { none: { optInEmail: false } } } })')).toHaveLength(1)
    expect(schnipsel('findMany({ where: { abo: { isNot: { optInEmail: false } } } })')).toHaveLength(1)
  })

  it('jeder Filterwert außer dem Literal false: Variable, Operator-Objekt, Kurzschreibweise', () => {
    expect(schnipsel('count({ where: { farmId, optInEmail: eingabe.an } })')).toHaveLength(1)
    expect(schnipsel('count({ where: { optInEmail: { equals: true } } })')).toHaveLength(1)
    expect(schnipsel('count({ where: { optInEmail: { not: false } } })')).toHaveLength(1)
    expect(schnipsel('count({ where: { farmId, optInEmail } })')).toHaveLength(1)
    // Die Vorbedingung aus meldeEmailAboAn ist woanders ein gewöhnlicher Filter —
    // auch in abo-anmeldung.ts selbst, außerhalb dieser Funktion.
    expect(schnipsel('updateMany({ where: { id, optInEmail: abo.optInEmail }, data: { optInEmail: false } })')).toHaveLength(1)
    expect(schnipsel('async function andere() { await updateMany({ where: { id, optInEmail: abo.optInEmail } }) }', true)).toHaveLength(1)
  })

  it('Klammern, as, satisfies, <T> und konstante Ausdrücke wie !0 tarnen true nicht', () => {
    for (const wert of ['true as const', '(true)', '!0', '!!1', 'true satisfies boolean', '<boolean>true', '((true as boolean))']) {
      expect(schnipsel(`count({ where: { optInEmail: ${wert} } })`), `where ${wert}`).toHaveLength(1)
      expect(schnipsel(`update({ data: { optInEmail: ${wert} } })`), `data ${wert}`).toHaveLength(1)
      expect(schnipsel(`const daten = { optInEmail: ${wert} }`), `Konstante ${wert}`).toHaveLength(1)
    }
  })

  it('die Ausnahme für WERBEMAIL_EMPFAENGER gilt nicht für andere Konstanten in abo-anmeldung.ts', () => {
    expect(schnipsel('export const ANDERE = { where: { optInEmail: true } }', true)).toHaveLength(1)
    expect(schnipsel('export const ANDERE = { optInEmail: true }', true)).toHaveLength(1)
    // Und ein Schreib-Objekt IN der Konstante bleibt ein Schreib-Objekt.
    expect(schnipsel('export const WERBEMAIL_EMPFAENGER = { optInEmail: true, abos: { data: { optInEmail: true } } }', true)).toEqual([
      expect.objectContaining({ grund: GRUND_SCHREIBT }),
    ])
  })
})

/**
 * `loeseOffeneAnfrageAuf` gibt ein VERZÖGERTES Prisma-Promise zurück: Es
 * wirkt nur mit `await` oder als Schritt in `$transaction([...])`. Jeder
 * Aufruf in src/ muss genau so stehen (oder als `return` weitergereicht
 * werden) — sonst bliebe die offene Anfrage stehen, ohne dass es jemand merkt.
 */
function lockereAufrufe(quelltext: string, pfad: string): string[] {
  const datei = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, pfad.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const funde: string[] = []
  const besuche = (knoten: ts.Node): void => {
    if (ts.isCallExpression(knoten) && ts.isIdentifier(knoten.expression) && knoten.expression.text === 'loeseOffeneAnfrageAuf') {
      const eltern = knoten.parent
      const awaited = ts.isAwaitExpression(eltern)
      const zurueck = ts.isReturnStatement(eltern)
      const inTransaktion =
        ts.isArrayLiteralExpression(eltern) &&
        ts.isCallExpression(eltern.parent) &&
        ts.isPropertyAccessExpression(eltern.parent.expression) &&
        eltern.parent.expression.name.text === '$transaction'
      if (!awaited && !zurueck && !inTransaktion) funde.push(knoten.getText(datei))
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return funde
}

describe('loeseOffeneAnfrageAuf — verzögert, deshalb ausdrücklich getippt und immer ausgeführt', () => {
  it('trägt den ausdrücklichen Rückgabetyp Prisma.PrismaPromise<Prisma.BatchPayload>', () => {
    const datei = ts.createSourceFile(ABO_ANMELDUNG_PFAD, ABO_ANMELDUNG, ts.ScriptTarget.Latest, true)
    const funktion = datei.statements.find(
      (s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === 'loeseOffeneAnfrageAuf'
    )
    expect(funktion?.type?.getText(datei)).toBe('Prisma.PrismaPromise<Prisma.BatchPayload>')
  })

  it('jeder Aufruf in src/ wird abgewartet, steht in $transaction([...]) oder wird zurückgegeben', () => {
    const treffer = dateien(WURZEL).flatMap((pfad) =>
      lockereAufrufe(readFileSync(pfad, 'utf8'), pfad).map((t) => `${relative(WURZEL, pfad)}: ${t}`)
    )
    expect(treffer).toEqual([])
    // Gegenprobe: Die Suche findet die echten Aufrufe (heute in $transaction).
    expect(readFileSync(join(WURZEL, 'server/actions/subscriptions.ts'), 'utf8')).toContain('loeseOffeneAnfrageAuf(')
  })

  it('Gegenprobe: ein liegen gelassener Aufruf schlägt an, die drei richtigen Formen nicht', () => {
    expect(lockereAufrufe('function f() { loeseOffeneAnfrageAuf(wo); return 1 }', 'a.ts')).toEqual(['loeseOffeneAnfrageAuf(wo)'])
    expect(lockereAufrufe('const schritt = loeseOffeneAnfrageAuf(wo)', 'a.ts')).toHaveLength(1)
    expect(lockereAufrufe('async function f() { await loeseOffeneAnfrageAuf(wo) }', 'a.ts')).toEqual([])
    expect(lockereAufrufe('await prisma.$transaction([loeseOffeneAnfrageAuf(wo), speichern])', 'a.ts')).toEqual([])
    expect(lockereAufrufe('function f() { return loeseOffeneAnfrageAuf(wo) }', 'a.ts')).toEqual([])
  })
})

describe('Gegenproben: was erlaubt bleibt', () => {
  it('false in Schreib-Objekten und Filtern, Auswahl in select, Kommentare', () => {
    expect(schnipsel('updateMany({ where: wo, data: { optInEmail: false, optInWhatsApp: false } })')).toEqual([])
    expect(schnipsel('update: { optInWhatsApp: x, ...(an ? {} : { optInEmail: false }) }')).toEqual([])
    expect(schnipsel('update({ data: { optInEmail: (false as boolean) } })')).toEqual([])
    expect(schnipsel('count({ where: { farmId, optInEmail: false } })')).toEqual([])
    expect(schnipsel('findMany({ where: { NOT: { id }, optInEmail: false } })')).toEqual([])
    expect(schnipsel('findMany({ select: { customerEmail: true, optInEmail: true } })')).toEqual([])
    expect(schnipsel('findMany({ include: { subscriptions: { select: { optInEmail: true } } }, orderBy: { optInEmail: "desc" } })')).toEqual([])
    expect(schnipsel('// früher: data: { optInEmail: true }\nconst a = 1')).toEqual([])
  })

  it('die Vorbedingung des bedingten Schreibens in meldeEmailAboAn', () => {
    const text = 'export async function meldeEmailAboAn(abo) { await updateMany({ where: { id: abo.id, optInEmail: abo.optInEmail }, data: { optInEmail: false } }) }'
    expect(schnipsel(text, true)).toEqual([])
    expect(schnipsel(text)).toHaveLength(1)
  })

  it('Daten außerhalb der Datenbank (Formular, Antwort an den Browser) sind kein Schreib-Objekt', () => {
    expect(schnipsel('JSON.stringify({ optInEmail: data.optInEmail ?? false })')).toEqual([])
    expect(schnipsel('return { optInEmail: werbemailErlaubt(s), emailWartet }')).toEqual([])
    expect(schnipsel('schema.safeParse({ farmId, optInEmail, optInWhatsApp })')).toEqual([])
    expect(schnipsel('const schema = z.object({ optInEmail: z.boolean().default(false) })')).toEqual([])
  })

  it('die beiden Konstanten gelten nur in abo-anmeldung.ts', () => {
    const text = 'export const WERBEMAIL_EMPFAENGER = { optInEmail: true, OR: [] }'
    expect(schnipsel(text, true)).toEqual([])
    expect(schnipsel(text)).toHaveLength(1)
  })
})
