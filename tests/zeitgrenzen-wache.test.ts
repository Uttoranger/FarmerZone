/**
 * Zeitgrenzen-Wache (Sammel 19, Regelvorschlag aus dem Fund der CI des Sammel-PR 19, freigegeben 21.10.2026;
 * Register G4, Ergänzung). Die Regel steht in TESTING_GUIDELINES §4: Statische Wachen, die ganz `src/` lesen und
 * parsen, tragen das Limit `30_000` nur an genau diesem `it`. Sie wurde nicht geprüft; unter Last liefen
 * `keine-emojis`, `ladeansichten`, `blob-loeschen-wache`, `sharp-wache` und `paket-mock-wache` in die 5 Sekunden des
 * Standards (Lauf 19 und 20), einzeln waren sie grün.
 *
 * Beweist (Quelltext von `tests/`, TypeScript-Syntaxbaum, kein Netz): Jedes `it` (und jeder Hook), das ganz `src/`
 * oder ganz `tests/` rekursiv liest, trägt die Zeitgrenze von mindestens 30 000 ms — als dritter Parameter
 * (`, 30_000)`) oder als `{ timeout: 30_000 }`, auch über eine Konstante der Datei.
 *
 * Was „liest ganz src/ oder tests/“ heißt: Es gibt keine gemeinsame Hilfe zum Durchlaufen; jede Datei baut ihre
 * eigene. Die Wache erkennt sie an der Form:
 *  - Ein Durchläufer ist eine benannte Funktion, die `readdirSync` ruft und sich selbst (oder `readdirSync` mit
 *    `recursive: true`). Eine Funktion, die einen Durchläufer mit einem ihrer Parameter ruft, ist selbst einer
 *    (`dateien(ordner)` um `quelldateien(join(WURZEL, ordner))`).
 *  - Ein Aufruf liest ganz, wenn sein Ordner genau `src` oder `tests` ist: als Zeichenkette, als
 *    `join`/`resolve` mit dem Rest `src` bzw. `tests` (auch `join(__dirname, '..', 'src')`), über eine Konstante,
 *    über ein Feld mit solchen Ordnern (`['src', 'tests'].flatMap((ordner) => …)`, `for (const o of ORDNER)`).
 *    `src/components/hoefe`, `src/app/admin` und ein einzelnes Auflisten ohne Rekursion zählen nicht.
 *  - Schwer ist ein `it`, wenn der Aufruf in ihm steht, oder wenn er eine Funktion bzw. eine Konstante auf Datei-
 *    oder `describe`-Ebene benutzt, in deren Rumpf ein solcher Aufruf steht (auch mittelbar, `QUELLEN` →
 *    `it`). Ein Aufruf nur auf Dateiebene, aus dem je Datei ein `it` entsteht (`for (const pfad of …) it(…)`),
 *    zählt dort nicht: Das Sammeln läuft vor den Tests, und das Limit gilt nur für den Rumpf des `it`.
 * Nicht erkannt (Näherung ohne TypeChecker): ein Durchläufer aus einer anderen Datei, `fs.globSync`, ein Ordner, der
 * erst zur Laufzeit zusammengesetzt wird. `tests/integration/` fehlt, weil die Integrationsschicht das Limit
 * selbst auf 30 000 setzt (`vitest.integration.config.ts`).
 *
 * Gegenprobe: Beispiel-Dateien ohne Zeitgrenze schlagen an — für jede Schreibweise des Ordners, über eine Konstante
 * und ein Hilfsfunktion, in einem Hook und bei `it.each`; mit Zeitgrenze, mit einer zu kleinen Grenze (10 000), für
 * einen anderen Ordner (`src/lib`), für ein Auflisten ohne Rekursion und für ein `it` mit eigener lokaler Variable
 * gleichen Namens schlagen sie nicht an. Die fünf Dateien aus dem Anlass müssen als schwer erkannt werden, sonst
 * wäre die Erkennung zu eng.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/** Die Zeitgrenze, die TESTING_GUIDELINES §4 für Wachen über ganz `src/` oder `tests/` nennt. */
const MINDEST_GRENZE = 30_000

const WURZEL = process.cwd()

/** Dateien, die in Lauf 19 und 20 unter Last in die 5 Sekunden liefen — die Erkennung muss sie finden. */
const AUS_DEM_ANLASS = [
  'tests/keine-emojis.test.ts',
  'tests/ladeansichten.test.ts',
  'tests/blob-loeschen-wache.test.ts',
  'tests/sharp-wache.test.ts',
  'tests/paket-mock-wache.test.ts',
]

const LESE_AUFRUFE = new Set(['readdirSync', 'readdir', 'opendirSync'])
const PFAD_FUNKTIONEN = new Set(['join', 'resolve'])
/** Methoden, deren Rückruf die Elemente des Feldes davor bekommt. */
const FELD_METHODEN = new Set(['map', 'flatMap', 'forEach', 'filter', 'some', 'every', 'find'])
const TEST_NAMEN = new Set(['it', 'test'])
const HOOK_NAMEN = new Set(['beforeAll', 'beforeEach', 'afterAll', 'afterEach'])

interface SchwererTest {
  datei: string
  zeile: number
  art: 'it' | 'hook'
  titel: string
  /** Die Zeitgrenze am Aufruf in ms; null, wenn keine dasteht. */
  grenze: number | null
}

type Funktion = ts.FunctionLikeDeclaration

function istFunktion(knoten: ts.Node): knoten is Funktion {
  return ts.isFunctionDeclaration(knoten) || ts.isFunctionExpression(knoten) || ts.isArrowFunction(knoten) || ts.isMethodDeclaration(knoten)
}

function ohneHuelle(ausdruck: ts.Expression): ts.Expression {
  let k = ausdruck
  while (ts.isParenthesizedExpression(k) || ts.isAsExpression(k) || ts.isSatisfiesExpression(k) || ts.isNonNullExpression(k) || ts.isTypeAssertionExpression(k)) {
    k = k.expression
  }
  return k
}

/** Der Name, mit dem ein Aufruf beginnt: `it`, `it.each(…)`, `beforeAll`, `lesen`, `fs.readdirSync` → der letzte Teil. */
function aufrufName(aufruf: ts.CallExpression): string | null {
  const ziel = ohneHuelle(aufruf.expression)
  if (ts.isIdentifier(ziel)) return ziel.text
  if (ts.isPropertyAccessExpression(ziel)) return ziel.name.text
  return null
}

/** Das erste Wort einer Aufrufkette: `it.each(x)(…)` → `it`, `describe.skip(…)` → `describe`. */
function kettenAnfang(ausdruck: ts.Expression): string | null {
  let k = ohneHuelle(ausdruck)
  for (;;) {
    if (ts.isIdentifier(k)) return k.text
    if (ts.isPropertyAccessExpression(k) || ts.isCallExpression(k)) k = ohneHuelle(k.expression)
    else return null
  }
}

function nachOben(knoten: ts.Node): ts.Node[] {
  const kette: ts.Node[] = []
  for (let k = knoten.parent; k; k = k.parent) kette.push(k)
  return kette
}

/** Die Deklaration, auf die ein Bezeichner zeigt (Parameter, Schleifenvariable, Konstante, Funktion); sonst undefined. */
function deklaration(bezeichner: ts.Identifier): ts.Node | undefined {
  const name = bezeichner.text
  for (const k of nachOben(bezeichner)) {
    if (istFunktion(k)) {
      const parameter = k.parameters.find((p) => ts.isIdentifier(p.name) && p.name.text === name)
      if (parameter) return parameter
    }
    if ((ts.isForOfStatement(k) || ts.isForInStatement(k) || ts.isForStatement(k)) && k.initializer && ts.isVariableDeclarationList(k.initializer)) {
      const treffer = k.initializer.declarations.find((d) => ts.isIdentifier(d.name) && d.name.text === name)
      if (treffer) return treffer
    }
    if (ts.isBlock(k) || ts.isSourceFile(k) || ts.isModuleBlock(k)) {
      for (const anweisung of k.statements) {
        if (ts.isVariableStatement(anweisung)) {
          const treffer = anweisung.declarationList.declarations.find((d) => ts.isIdentifier(d.name) && d.name.text === name)
          if (treffer) return treffer
        }
        if (ts.isFunctionDeclaration(anweisung) && anweisung.name?.text === name) return anweisung
      }
    }
  }
  return undefined
}

/** Steht der Bezeichner als Name einer Eigenschaft oder Deklaration, nicht als Verwendung? */
function istKeineVerwendung(b: ts.Identifier): boolean {
  const eltern = b.parent
  if (ts.isPropertyAccessExpression(eltern) && eltern.name === b) return true
  if (ts.isPropertyAssignment(eltern) && eltern.name === b) return true
  if (ts.isVariableDeclaration(eltern) && eltern.name === b) return true
  if (ts.isFunctionDeclaration(eltern) && eltern.name === b) return true
  if (ts.isParameter(eltern) && eltern.name === b) return true
  return false
}

function normalisiere(pfad: string): string {
  return pfad.split('/').filter((teil) => teil !== '' && teil !== '.').join('/')
}

/**
 * Die Ordner, die ein Ausdruck bezeichnen kann, als Pfad ab der Projektwurzel — `'?'`, wo etwas unbekannt bleibt
 * (`process.cwd()` als Anfang eines `join` ist bekannt und wird ignoriert). Nur `src` und `tests` allein zählen.
 */
function ordnerPfade(ausdruck: ts.Expression, tiefe = 0): string[] {
  if (tiefe > 6) return ['?']
  const a = ohneHuelle(ausdruck)
  if (ts.isStringLiteralLike(a)) return [normalisiere(a.text)]
  if (ts.isArrayLiteralExpression(a)) {
    return a.elements.flatMap((e) => (ts.isSpreadElement(e) ? ordnerPfade(e.expression, tiefe + 1) : ordnerPfade(e, tiefe + 1)))
  }
  if (ts.isConditionalExpression(a)) return [...ordnerPfade(a.whenTrue, tiefe + 1), ...ordnerPfade(a.whenFalse, tiefe + 1)]
  if (ts.isIdentifier(a)) {
    const stelle = deklaration(a)
    if (stelle && ts.isVariableDeclaration(stelle)) {
      // Schleifenvariable: die Elemente des Feldes; Konstante: ihr Wert.
      const liste = stelle.parent
      if (ts.isVariableDeclarationList(liste) && (ts.isForOfStatement(liste.parent) || ts.isForInStatement(liste.parent))) {
        return ordnerPfade(liste.parent.expression, tiefe + 1)
      }
      return stelle.initializer ? ordnerPfade(stelle.initializer, tiefe + 1) : ['?']
    }
    if (stelle && ts.isParameter(stelle) && istFunktion(stelle.parent)) {
      // Rückruf einer Feld-Methode (`['src', 'tests'].flatMap((ordner) => …)`): die Elemente des Feldes davor.
      const aufruf = stelle.parent.parent
      if (ts.isCallExpression(aufruf) && aufruf.arguments[0] === stelle.parent) {
        const ziel = ohneHuelle(aufruf.expression)
        if (ts.isPropertyAccessExpression(ziel) && FELD_METHODEN.has(ziel.name.text)) return ordnerPfade(ziel.expression, tiefe + 1)
      }
    }
    return ['?']
  }
  if (ts.isCallExpression(a) && PFAD_FUNKTIONEN.has(aufrufName(a) ?? '')) {
    // Möglichkeiten je Schritt ausmultiplizieren (meist genau eine). „?“ am Anfang ist der Projektordner oder ein
    // unbekannter Anfang und fällt weg; ein „?“ danach macht den Pfad unbekannt.
    let pfade: string[] = ['']
    for (const [stelle, arg] of a.arguments.entries()) {
      const optionen = ordnerPfade(arg, tiefe + 1)
      if (optionen.includes('?') && stelle > 0) return ['?']
      pfade = pfade.flatMap((vorn) =>
        optionen.map((teil) => {
          if (teil === '?') return vorn
          if (teil === '..') return normalisiere(vorn.split('/').slice(0, -1).join('/'))
          return normalisiere(`${vorn}/${teil}`)
        }),
      )
    }
    return pfade
  }
  return ['?']
}

/** Heißt der Ordner genau `src` oder `tests`? */
function liestGanz(ausdruck: ts.Expression | undefined): boolean {
  if (!ausdruck) return false
  return ordnerPfade(ausdruck).some((o) => o === 'src' || o === 'tests')
}

function enthaelt(wurzel: ts.Node, bedingung: (knoten: ts.Node) => boolean): boolean {
  let gefunden = false
  const besuche = (k: ts.Node): void => {
    if (gefunden) return
    if (bedingung(k)) {
      gefunden = true
      return
    }
    ts.forEachChild(k, besuche)
  }
  besuche(wurzel)
  return gefunden
}

function alleKnoten(wurzel: ts.Node): ts.Node[] {
  const liste: ts.Node[] = []
  const besuche = (k: ts.Node): void => {
    liste.push(k)
    ts.forEachChild(k, besuche)
  }
  besuche(wurzel)
  return liste
}

/** Der Rumpf einer benannten Funktion (Deklaration oder Konstante mit Pfeil-/Funktionsausdruck) samt ihrer Deklaration. */
function benannteFunktionen(datei: ts.SourceFile): Array<{ stelle: ts.Node; funktion: Funktion }> {
  const liste: Array<{ stelle: ts.Node; funktion: Funktion }> = []
  for (const k of alleKnoten(datei)) {
    if (ts.isFunctionDeclaration(k) && k.name && k.body) liste.push({ stelle: k, funktion: k })
    if (ts.isVariableDeclaration(k) && ts.isIdentifier(k.name) && k.initializer) {
      const wert = ohneHuelle(k.initializer)
      if (ts.isArrowFunction(wert) || ts.isFunctionExpression(wert)) liste.push({ stelle: k, funktion: wert })
    }
  }
  return liste
}

function nameDerStelle(stelle: ts.Node): string {
  if (ts.isFunctionDeclaration(stelle) && stelle.name) return stelle.name.text
  if (ts.isVariableDeclaration(stelle) && ts.isIdentifier(stelle.name)) return stelle.name.text
  return ''
}

/** Ruft der Aufruf `readdirSync` o. ä. mit `recursive: true`? */
function liestRekursiv(aufruf: ts.CallExpression): boolean {
  if (!LESE_AUFRUFE.has(aufrufName(aufruf) ?? '')) return false
  return aufruf.arguments.some(
    (arg) =>
      ts.isObjectLiteralExpression(arg) &&
      arg.properties.some((p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'recursive' && p.initializer.kind === ts.SyntaxKind.TrueKeyword),
  )
}

/** Die Durchläufer einer Datei (Deklarationen) — siehe Kopf. */
function findeDurchlaeufer(datei: ts.SourceFile): Set<ts.Node> {
  const funktionen = benannteFunktionen(datei)
  const durchlaeufer = new Set<ts.Node>()
  for (const { stelle, funktion } of funktionen) {
    const name = nameDerStelle(stelle)
    const liest = enthaelt(funktion, (k) => ts.isCallExpression(k) && LESE_AUFRUFE.has(aufrufName(k) ?? ''))
    const wiederholt = enthaelt(funktion, (k) => ts.isCallExpression(k) && (aufrufName(k) === name || liestRekursiv(k)))
    if (liest && wiederholt) durchlaeufer.add(stelle)
  }
  // Eine Funktion, die einen Durchläufer mit einem ihrer Parameter ruft, reicht den Ordner nur weiter.
  for (let geaendert = true; geaendert; ) {
    geaendert = false
    for (const { stelle, funktion } of funktionen) {
      if (durchlaeufer.has(stelle)) continue
      const parameter = new Set(funktion.parameters.flatMap((p) => (ts.isIdentifier(p.name) ? [p.name.text] : [])))
      if (parameter.size === 0) continue
      const reicht = enthaelt(funktion, (k) => {
        if (!ts.isCallExpression(k) || !ts.isIdentifier(k.expression)) return false
        const ziel = deklaration(k.expression)
        if (!ziel || !durchlaeufer.has(ziel) || !k.arguments[0]) return false
        return enthaelt(k.arguments[0], (teil) => ts.isIdentifier(teil) && parameter.has(teil.text))
      })
      if (reicht) {
        durchlaeufer.add(stelle)
        geaendert = true
      }
    }
  }
  return durchlaeufer
}

/** Ein Aufruf, der ganz `src/` oder `tests/` liest. */
function findeGanzeAufrufe(datei: ts.SourceFile, durchlaeufer: Set<ts.Node>): Set<ts.Node> {
  const treffer = new Set<ts.Node>()
  for (const k of alleKnoten(datei)) {
    if (!ts.isCallExpression(k)) continue
    if (liestRekursiv(k) && liestGanz(k.arguments[0])) {
      treffer.add(k)
      continue
    }
    const ziel = ohneHuelle(k.expression)
    if (!ts.isIdentifier(ziel)) continue
    const stelle = deklaration(ziel)
    if (stelle && durchlaeufer.has(stelle) && liestGanz(k.arguments[0])) treffer.add(k)
  }
  return treffer
}

/** Die nächste umschließende Funktion, oder undefined auf Dateiebene. */
function umschliessendeFunktion(knoten: ts.Node): Funktion | undefined {
  return nachOben(knoten).find(istFunktion)
}

/** Ist die Funktion der Rückruf eines `describe`? Dann liegt ihr Inhalt wie die Dateiebene vor den Tests. */
function istDescribeRueckruf(funktion: Funktion): boolean {
  const aufruf = funktion.parent
  return ts.isCallExpression(aufruf) && aufruf.arguments.some((arg) => arg === funktion) && ['describe', 'suite'].includes(kettenAnfang(aufruf.expression) ?? '')
}

/** Stellen, die ihr Ergebnis auf Datei- oder `describe`-Ebene festhalten und davon ein ganzes Lesen tragen. */
function findeSchwereStellen(datei: ts.SourceFile, durchlaeufer: Set<ts.Node>, ganze: Set<ts.Node>): Set<ts.Node> {
  const kandidaten: Array<{ stelle: ts.Node; rumpf: ts.Node }> = []
  for (const { stelle, funktion } of benannteFunktionen(datei)) {
    if (!durchlaeufer.has(stelle) && funktion.body) kandidaten.push({ stelle, rumpf: funktion.body })
  }
  for (const k of alleKnoten(datei)) {
    if (!ts.isVariableDeclaration(k) || !k.initializer || !ts.isIdentifier(k.name)) continue
    const wert = ohneHuelle(k.initializer)
    if (ts.isArrowFunction(wert) || ts.isFunctionExpression(wert)) continue
    const funktion = umschliessendeFunktion(k)
    if (funktion === undefined || istDescribeRueckruf(funktion)) kandidaten.push({ stelle: k, rumpf: k.initializer })
  }
  const schwer = new Set<ts.Node>()
  for (let geaendert = true; geaendert; ) {
    geaendert = false
    for (const { stelle, rumpf } of kandidaten) {
      if (schwer.has(stelle)) continue
      if (traegtLesen(rumpf, ganze, schwer)) {
        schwer.add(stelle)
        geaendert = true
      }
    }
  }
  return schwer
}

/** Steht im Teilbaum ein ganzes Lesen, oder wird eine schwere Stelle benutzt? */
function traegtLesen(teil: ts.Node, ganze: Set<ts.Node>, schwer: Set<ts.Node>): boolean {
  return enthaelt(teil, (k) => {
    if (ganze.has(k)) return true
    if (!ts.isIdentifier(k) || istKeineVerwendung(k)) return false
    const stelle = deklaration(k)
    return stelle !== undefined && schwer.has(stelle)
  })
}

function zahlWert(ausdruck: ts.Expression, tiefe = 0): number | null {
  const a = ohneHuelle(ausdruck)
  if (ts.isNumericLiteral(a)) return Number(a.text.replace(/_/g, ''))
  if (ts.isIdentifier(a) && tiefe < 4) {
    const stelle = deklaration(a)
    if (stelle && ts.isVariableDeclaration(stelle) && stelle.initializer) return zahlWert(stelle.initializer, tiefe + 1)
  }
  return null
}

/** Die Zeitgrenze an einem `it`- oder Hook-Aufruf: dritter Parameter als Zahl oder `{ timeout }`. */
function zeitgrenze(aufruf: ts.CallExpression): number | null {
  for (const arg of aufruf.arguments) {
    if (istFunktion(ohneHuelle(arg))) continue
    const zahl = zahlWert(arg)
    if (zahl !== null) return zahl
    const objekt = ohneHuelle(arg)
    if (ts.isObjectLiteralExpression(objekt)) {
      for (const p of objekt.properties) {
        if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'timeout') {
          const wert = zahlWert(p.initializer)
          if (wert !== null) return wert
        }
      }
    }
  }
  return null
}

/** Alle `it` und Hooks einer Datei, die ganz `src/` oder `tests/` lesen — mit ihrer Zeitgrenze. */
function findeSchwereTests(text: string, name: string): SchwererTest[] {
  const datei = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, name.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const durchlaeufer = findeDurchlaeufer(datei)
  if (durchlaeufer.size === 0 && !alleKnoten(datei).some((k) => ts.isCallExpression(k) && liestRekursiv(k))) return []
  const ganze = findeGanzeAufrufe(datei, durchlaeufer)
  if (ganze.size === 0) return []
  const schwer = findeSchwereStellen(datei, durchlaeufer, ganze)

  const funde: SchwererTest[] = []
  for (const k of alleKnoten(datei)) {
    if (!ts.isCallExpression(k)) continue
    const anfang = kettenAnfang(k.expression)
    const art = anfang !== null && TEST_NAMEN.has(anfang) ? 'it' : anfang !== null && HOOK_NAMEN.has(anfang) ? 'hook' : null
    const rueckruf = k.arguments.find((arg) => istFunktion(ohneHuelle(arg)))
    if (art === null || rueckruf === undefined) continue
    if (!traegtLesen(rueckruf, ganze, schwer)) continue
    const titel = k.arguments[0] && ts.isStringLiteralLike(k.arguments[0]) ? k.arguments[0].text : '(Titel zur Laufzeit)'
    funde.push({ datei: name, zeile: datei.getLineAndCharacterOfPosition(k.getStart()).line + 1, art, titel, grenze: zeitgrenze(k) })
  }
  return funde
}

/** Alle Testdateien unter `tests/` außer der Integrationsschicht (eigenes Limit in der Konfiguration). */
function testdateien(ordner: string): string[] {
  const funde: string[] = []
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) {
      if (name !== 'integration') funde.push(...testdateien(pfad))
    } else if (/\.test\.tsx?$/.test(name)) funde.push(pfad)
  }
  return funde
}

function beschreibe(fund: SchwererTest): string {
  const stand = fund.grenze === null ? 'ohne Zeitgrenze' : `mit ${fund.grenze} ms`
  return `${fund.datei}:${fund.zeile} ${fund.art} „${fund.titel}“ liest ganz src/ oder tests/, ${stand} (verlangt: mindestens ${MINDEST_GRENZE})`
}

function alleSchwerenTests(): SchwererTest[] {
  return testdateien(join(WURZEL, 'tests')).flatMap((pfad) => {
    const text = readFileSync(pfad, 'utf8')
    // Ohne Lesen des Dateisystems kann eine Datei nichts durchlaufen; das spart das Parsen der meisten Dateien.
    if (!text.includes('readdir') && !text.includes('opendir')) return []
    return findeSchwereTests(text, relative(WURZEL, pfad).split(sep).join('/'))
  })
}

describe('Zeitgrenzen — wer ganz src/ oder tests/ liest, trägt die Grenze am it', () => {
  it('jedes it und jeder Hook, der ganz src/ oder tests/ liest, hat mindestens 30 000 ms', () => {
    // Liest und parst jede Testdatei (TESTING_GUIDELINES §4: Zeitgrenze 30_000 an genau diesem it).
    const schwer = alleSchwerenTests()

    // Nicht blind: Die fünf Dateien aus dem Anlass und diese Datei selbst sind als schwer erkannt.
    const dateien = new Set(schwer.map((s) => s.datei))
    for (const erwartet of [...AUS_DEM_ANLASS, 'tests/zeitgrenzen-wache.test.ts']) expect(dateien, erwartet).toContain(erwartet)

    const zuKnapp = schwer.filter((s) => s.grenze === null || s.grenze < MINDEST_GRENZE)
    expect(zuKnapp.map(beschreibe)).toEqual([])
  }, 30_000)
})

describe('Zeitgrenzen — Gegenprobe: die Erkennung schlägt an', () => {
  /** Eine Beispiel-Datei: gemeinsamer Kopf mit einem Durchläufer, dann der Rest. */
  const datei = (rest: string): string =>
    [
      "import { readdirSync, statSync } from 'node:fs'",
      "import { join } from 'node:path'",
      'const WURZEL = process.cwd()',
      'function* quelldateien(ordner: string): Generator<string> {',
      '  for (const name of readdirSync(ordner)) {',
      '    const pfad = join(ordner, name)',
      '    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)',
      '    else yield pfad',
      '  }',
      '}',
      rest,
    ].join('\n')

  const finde = (rest: string): SchwererTest[] => findeSchwereTests(datei(rest), 'tests/beispiel.test.ts')
  const ohneGrenze = (rest: string): number => finde(rest).filter((s) => s.grenze === null || s.grenze < MINDEST_GRENZE).length

  it('schlägt an ohne Zeitgrenze, für jede Schreibweise von src und tests', () => {
    const schreibweisen = [
      "quelldateien(join(WURZEL, 'src'))",
      "quelldateien(join(process.cwd(), 'tests'))",
      "quelldateien(join(__dirname, '..', 'src'))",
      "quelldateien('src')",
      "quelldateien('src/')",
      "quelldateien(join(WURZEL, 'src/'))",
      "[...quelldateien(join(WURZEL, 'src'))].length",
      "['src', 'tests'].flatMap((ordner) => [...quelldateien(join(WURZEL, ordner))])",
      "readdirSync(join(WURZEL, 'src'), { recursive: true })",
    ]
    for (const aufruf of schreibweisen) {
      expect(ohneGrenze(`it('liest', () => { const x = ${aufruf}; expect(x).toBeTruthy() })`), aufruf).toBe(1)
    }
  })

  it('schlägt an über eine Konstante, eine Schleifenvariable und eine Funktion, die den Durchläufer umhüllt', () => {
    expect(ohneGrenze(["const SRC = join(WURZEL, 'src')", "it('liest', () => { quelldateien(SRC) })"].join('\n'))).toBe(1)
    expect(ohneGrenze(["const ORDNER = ['src', 'tests', 'public']", "it('liest', () => { for (const o of ORDNER) quelldateien(join(WURZEL, o)) })"].join('\n'))).toBe(1)
    expect(ohneGrenze(["const dateien = (ordner: string) => [...quelldateien(join(WURZEL, ordner))]", "it('liest', () => { dateien('src') })"].join('\n'))).toBe(1)
  })

  it('schlägt an, wenn das Lesen auf Dateiebene steht und das it die Konstante benutzt — und über eine Hilfsfunktion', () => {
    expect(ohneGrenze(["const QUELLEN = [...quelldateien(join(WURZEL, 'src'))]", "describe('x', () => { it('prüft', () => { expect(QUELLEN.length).toBeGreaterThan(0) }) })"].join('\n'))).toBe(1)
    expect(ohneGrenze(["function pruefe() { return quelldateien(join(WURZEL, 'tests')) }", "it('prüft', () => { pruefe() })"].join('\n'))).toBe(1)
    expect(ohneGrenze(["describe('x', () => {", "  const alle = [...quelldateien(join(WURZEL, 'src'))]", "  it('prüft', () => { expect(alle).toBeTruthy() })", '})'].join('\n'))).toBe(1)
  })

  it('schlägt an in einem Hook und bei it.each', () => {
    const hook = finde("beforeAll(() => { quelldateien(join(WURZEL, 'src')) })")
    expect(hook.map((s) => [s.art, s.grenze])).toEqual([['hook', null]])
    expect(ohneGrenze("it.each([1, 2])('liest %s', () => { quelldateien(join(WURZEL, 'src')) })")).toBe(1)
  })

  it('schlägt nicht an mit Zeitgrenze (dritter Parameter, Objekt, Konstante) — aber bei einer zu kleinen', () => {
    const lesen = "quelldateien(join(WURZEL, 'src'))"
    expect(ohneGrenze(`it('liest', () => { ${lesen} }, 30_000)`)).toBe(0)
    expect(ohneGrenze(`it('liest', { timeout: 30_000 }, () => { ${lesen} })`)).toBe(0)
    expect(ohneGrenze(`it('liest', () => { ${lesen} }, 60_000)`)).toBe(0)
    expect(ohneGrenze(`const GRENZE = 30_000\nit('liest', () => { ${lesen} }, GRENZE)`)).toBe(0)
    expect(ohneGrenze(`beforeAll(() => { ${lesen} }, 30_000)`)).toBe(0)
    expect(ohneGrenze(`it('liest', () => { ${lesen} }, 10_000)`)).toBe(1)
    expect(finde(`it('liest', () => { ${lesen} }, 30_000)`).map((s) => s.grenze)).toEqual([30000])
  })

  it('schlägt nicht an für einen Teilbaum, ein Auflisten ohne Rekursion und ein it ohne Lesen', () => {
    const teilbaeume = [
      "quelldateien(join(WURZEL, 'src', 'components', 'hoefe'))",
      "quelldateien(join(WURZEL, 'src/app/admin'))",
      "quelldateien(join(WURZEL, 'src', 'app', '(hof)'))",
      "quelldateien('src/lib')",
      "quelldateien(join(__dirname, '..', 'src', 'lib'))",
      "quelldateien(join(WURZEL, 'docs'))",
      "readdirSync(join(WURZEL, 'src'))",
      "readdirSync(join(WURZEL, 'src/lib'), { recursive: true })",
    ]
    for (const aufruf of teilbaeume) {
      expect(finde(`it('liest', () => { const x = ${aufruf}; expect(x).toBeTruthy() })`), aufruf).toEqual([])
    }
    expect(finde("it('rechnet', () => { expect(1 + 1).toBe(2) })")).toEqual([])
  })

  it('schlägt nicht an, wenn nur der Aufruf auf Dateiebene steht und je Datei ein it entsteht', () => {
    const rest = ["for (const pfad of quelldateien(join(WURZEL, 'src'))) {", "  it(`prüft ${pfad}`, () => { expect(pfad).toBeTruthy() })", '}'].join('\n')
    expect(finde(rest)).toEqual([])
  })

  it('schlägt nicht an für ein it mit eigener lokaler Variable, die so heißt wie eine schwere Konstante woanders', () => {
    const rest = [
      "describe('a', () => {",
      "  const funde = [...quelldateien(join(WURZEL, 'src'))]",
      "  it('liest', () => { expect(funde).toBeTruthy() }, 30_000)",
      '})',
      "describe('b', () => {",
      "  it('rechnet', () => { const funde = [1, 2]; expect(funde).toHaveLength(2) })",
      '})',
    ].join('\n')
    expect(finde(rest).map((s) => s.titel)).toEqual(['liest'])
  })
})
