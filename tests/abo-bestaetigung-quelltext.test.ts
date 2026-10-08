/**
 * Wache am Quelltext (Double-Opt-in, Register S11, Nr. 38; über den
 * TypeScript-Parser seit Nr. 47):
 *  - Empfänger werblicher Mails kommen nur über `WERBEMAIL_EMPFAENGER`
 *    (src/server/abo-anmeldung.ts), nie über `optInEmail: true` als Filter.
 *  - Den Haken SCHREIBT nur der Knopf: In einem Schreib-Objekt (`data`,
 *    `create`, `update`) steht `optInEmail` überall sonst höchstens mit dem
 *    Literal `false` — auch kein Variablenwert (`optInEmail: eingabe.x`) und
 *    keine Kurzschreibweise (`{ optInEmail }`). Die eine Ausnahme ist `data`
 *    in `bestaetigeEmailAbo`. Setzte ihn ein anderer Weg, gälte ein
 *    zurückgesetztes Abo („nie angefragt") als Bestand und bekäme Werbung
 *    ohne Bestätigung.
 *  - Ein Literal `true` ist sonst nur in Lese-Auswahlen erlaubt (`select`,
 *    `include`, `orderBy`) und in den beiden Konstanten `WERBEMAIL_EMPFAENGER`
 *    und `EMAIL_ABO_STAND`.
 * Vorher prüfte die Wache Zeilen: Ein einzeiliges
 * `update({ data: { optInEmail: true }, select: … })` und ein nicht-literaler
 * Wert gingen durch. Mit Gegenproben genau dafür.
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
/** Schlüssel, unter denen ein `true` nur „mitlesen" heißt. */
const LESE_AUSWAHL = new Set(['select', 'include', 'orderBy'])
/** Die beiden erlaubten Konstanten in abo-anmeldung.ts (Filter und Auswahl). */
const ERLAUBTE_KONSTANTEN = new Set(['WERBEMAIL_EMPFAENGER', 'EMAIL_ABO_STAND'])

type Fund = { zeile: number; grund: string; text: string }

/** Der Name einer Objekt-Eigenschaft — auch als Text- oder berechneter Schlüssel. */
function eigenschaftsName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text
  if (ts.isComputedPropertyName(name)) {
    const ausdruck = name.expression
    if (ts.isStringLiteral(ausdruck) || ts.isNoSubstitutionTemplateLiteral(ausdruck)) return ausdruck.text
  }
  return null
}

/** Der innerste umschließende Objekt-Schlüssel, der Schreiben oder Lesen bedeutet. */
function zusammenhang(knoten: ts.Node): 'schreiben' | 'lesen' | 'sonst' {
  for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) {
    if (ts.isPropertyAssignment(k)) {
      const name = eigenschaftsName(k.name)
      if (name && SCHREIB_SCHLUESSEL.has(name)) return 'schreiben'
      if (name && LESE_AUSWAHL.has(name)) return 'lesen'
    }
  }
  return 'sonst'
}

/** Liegt der Knoten in der Funktion `name` bzw. in der Konstante `name`? */
function liegtIn(knoten: ts.Node, pruefe: (k: ts.Node) => boolean): boolean {
  for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) if (pruefe(k)) return true
  return false
}

function inFunktion(knoten: ts.Node, name: string): boolean {
  return liegtIn(knoten, (k) => ts.isFunctionDeclaration(k) && k.name?.text === name)
}

function inErlaubterKonstante(knoten: ts.Node): boolean {
  return liegtIn(knoten, (k) => ts.isVariableDeclaration(k) && ts.isIdentifier(k.name) && ERLAUBTE_KONSTANTEN.has(k.name.text))
}

/**
 * Alle Verstöße einer Datei. `istAboAnmeldung` schaltet die beiden
 * Ausnahmen frei, die es nur in src/server/abo-anmeldung.ts gibt.
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
      const wert = lang ? (knoten as ts.PropertyAssignment).initializer : null
      const istFalse = wert?.kind === ts.SyntaxKind.FalseKeyword
      const istTrue = wert?.kind === ts.SyntaxKind.TrueKeyword
      const ort = zusammenhang(knoten)
      const knopf = istAboAnmeldung && inFunktion(knoten, 'bestaetigeEmailAbo') && ort === 'schreiben'
      if (ort === 'schreiben' && !istFalse && !knopf) melde(knoten, 'schreibt optInEmail mit einem Wert außer false')
      else if (istTrue && ort !== 'lesen' && !knopf && !(istAboAnmeldung && inErlaubterKonstante(knoten))) {
        melde(knoten, 'optInEmail: true außerhalb einer Lese-Auswahl (Filter nur über WERBEMAIL_EMPFAENGER)')
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

  it('die Wache sieht die eine erlaubte Schreibstelle: bestaetigeEmailAbo setzt den Haken', () => {
    // Ohne die Ausnahme meldet die Wache genau diese Stelle — sie schneidet also
    // die richtige aus und nicht mehr.
    const ohneAusnahme = verstoesse(ABO_ANMELDUNG, 'fremd.ts', false)
    expect(ohneAusnahme.map((f) => f.text)).toContain('optInEmail: true')
    const knopf = ohneAusnahme.filter((f) => f.grund.startsWith('schreibt'))
    expect(knopf).toHaveLength(1)
    expect(ABO_ANMELDUNG.split('\n')[knopf[0].zeile - 1]).toMatch(/data:\s*\{\s*optInEmail:\s*true/)
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
  it('false in Schreib-Objekten, Auswahl in select, Filter mit Variablenwert, Kommentare', () => {
    expect(schnipsel('updateMany({ where: wo, data: { optInEmail: false, optInWhatsApp: false } })')).toEqual([])
    expect(schnipsel('update: { optInWhatsApp: x, ...(an ? {} : { optInEmail: false }) }')).toEqual([])
    expect(schnipsel('findMany({ select: { customerEmail: true, optInEmail: true } })')).toEqual([])
    expect(schnipsel('updateMany({ where: { id, optInEmail: abo.optInEmail }, data: { optInEmail: false } })')).toEqual([])
    expect(schnipsel('// früher: data: { optInEmail: true }\nconst a = 1')).toEqual([])
  })

  it('Daten außerhalb der Datenbank (Formular, Antwort an den Browser) sind kein Schreib-Objekt', () => {
    expect(schnipsel('JSON.stringify({ optInEmail: data.optInEmail ?? false })')).toEqual([])
    expect(schnipsel('return { optInEmail: werbemailErlaubt(s), emailWartet }')).toEqual([])
  })

  it('die beiden Konstanten gelten nur in abo-anmeldung.ts', () => {
    const text = 'export const WERBEMAIL_EMPFAENGER = { optInEmail: true, OR: [] }'
    expect(schnipsel(text, true)).toEqual([])
    expect(schnipsel(text)).toHaveLength(1)
  })
})
