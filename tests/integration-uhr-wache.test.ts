/**
 * Uhr-Wache für die Integrationsschicht (Nr. 112, Morgenbericht 17; Nr. 121).
 *
 * Ursache: Better Auth räumt beim Lesen abgelaufene Zeilen in `session` und `verification` weg,
 * und zwar nach der Uhr, die gerade läuft. Stellt ein Test `Date` auf einen Zeitpunkt in der Zukunft,
 * gelten in der geteilten Test-Datenbank Codes und Sitzungen anderer Nummern als abgelaufen und sind
 * weg — mitten in deren Lauf.
 *
 * Die Regel zu den Uhr-Schritten steht als ein Satz in TESTING_GUIDELINES §1 (die zur festen Uhr, Nr. 112, daneben); die Gründe
 * stehen hier: Der Schritt `advanceTimersByTime(<Zahl>)` rückt die feste Uhr um einen bekannten Betrag und darf sie nicht
 * über den 20.10.2026 heben; `advanceTimersToNextTimer` und `runAllTimers` springen ohne Obergrenze, also nie.
 *
 * Beweist (Quelltext von `tests/integration/`, TypeScript-Syntaxbaum, kein Netz): Jeder Aufruf von
 * `vi.setSystemTime` und jedes `vi.useFakeTimers({ now })` trägt entweder ein Datums-Literal
 * (`new Date('…')`, auch über eine `const` derselben Datei) vor dem 20.10.2026 — oder die Datei berührt
 * Better Auth gar nicht. Seit Nr. 127 (Regelvorschlag 121) gilt dasselbe für die Uhr-Schritte: In einer Datei
 * mit Better Auth steht `vi.advanceTimersByTime(<Zahl als Literal>)` nur, wenn die Datei eine feste Uhr in
 * der Vergangenheit stellt und der Schritt sie nicht über den 20.10.2026 hebt; `vi.advanceTimersToNextTimer`
 * und `vi.runAllTimers` (ohne Obergrenze) stehen dort nie. Berührt heißt: Import von `@/lib/auth` oder `better-auth`, Zeilen in `session`
 * oder `verification` (Prisma oder SQL) oder ein Helfer aus `setup/basis.ts`, der Better Auth ruft
 * (die Wache liest ihn dort aus dem Quelltext). Alles andere schlägt an, auch eine Variable in einer
 * Datei mit Better Auth. Kommentare zählen nicht.
 *
 * Bestand: Was die Regel verletzt, steht in UHR_BESTAND — je Datei mit Grund. Die Liste schrumpft:
 * Eine Datei, die sie nicht mehr braucht, fällt als veraltet auf. Sie ist seit Nr. 127 leer (code-bremse.int
 * stellt feste Tage und rückt in festen Schritten); sie bleibt als Ort für einen Fall, der nicht anders geht.
 *
 * Gegenprobe: Text-Attrappen — ein Literal in der Zukunft, eine Variable und eine Uhr ohne Literal
 * in einer Datei mit Better Auth schlagen an (Import, dynamischer Import, Prisma-Zeilen, SQL, Helfer),
 * ebenso ein Schritt ohne feste Uhr, mit Variable, über den Stichtag oder mit `runAllTimers`;
 * ein Literal in der Vergangenheit (auch über eine `const`), ein kleiner Schritt nach einer festen Uhr und
 * jede Uhr in einer Datei ohne Better Auth nicht.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ORDNER = join(process.cwd(), 'tests/integration')
const BASIS = join(ORDNER, 'setup/basis.ts')

/** Ab diesem Tag (UTC) gilt ein Literal als Zukunft (Regelvorschlag 112, freigegeben 19.10.2026). */
const STICHTAG_MS = Date.UTC(2026, 9, 20)

/** Dateien, die die Regel heute verletzen, je mit Grund. Nur schrumpfen — seit Nr. 127 ist der Bestand leer. */
const UHR_BESTAND: Record<string, string> = {}

const AUTH_MODUL = /^(@\/lib\/auth(\/.*)?|better-auth(\/.*)?|@better-auth\/.*)$/
const BASIS_MODUL = /(^|\/)setup\/basis$/
const AUTH_TABELLE_SQL = /\b(from|into|update|join)\s+["`]?(session|verification)["`]?(?=[\s;)"`]|$)/i

function parse(quelltext: string, name = 'attrappe.ts'): ts.SourceFile {
  return ts.createSourceFile(name, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
}

function ohneHuelle(knoten: ts.Expression): ts.Expression {
  let k = knoten
  while (ts.isParenthesizedExpression(k) || ts.isAsExpression(k) || ts.isSatisfiesExpression(k)) k = k.expression
  return k
}

function besuche(knoten: ts.Node, fn: (k: ts.Node) => void): void {
  fn(knoten)
  ts.forEachChild(knoten, (kind) => besuche(kind, fn))
}

/** Exportierte Funktionen von `setup/basis.ts`, die Better Auth rufen oder `session`/`verification` beschreiben. */
function findeAuthHelfer(quelltext: string): Set<string> {
  const helfer = new Set<string>()
  for (const anweisung of parse(quelltext, 'basis.ts').statements) {
    if (!ts.isFunctionDeclaration(anweisung) || !anweisung.name || !anweisung.body) continue
    if (!anweisung.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue
    let beruehrt = false
    besuche(anweisung.body, (k) => {
      if (ts.isIdentifier(k) && k.text === 'auth' && ts.isPropertyAccessExpression(k.parent) && k.parent.expression === k) beruehrt = true
      if (ts.isPropertyAccessExpression(k) && ts.isPropertyAccessExpression(k.parent) && ['session', 'verification'].includes(k.name.text)) beruehrt = true
    })
    if (beruehrt) helfer.add(anweisung.name.text)
  }
  return helfer
}

function moduleDesAufrufs(k: ts.CallExpression): string | null {
  const erstes = k.arguments[0]
  if (!erstes || !(ts.isStringLiteral(erstes) || ts.isNoSubstitutionTemplateLiteral(erstes))) return null
  const ziel = k.expression
  const istImport = ziel.kind === ts.SyntaxKind.ImportKeyword
  const istRequire = ts.isIdentifier(ziel) && ziel.text === 'require'
  const istMock = ts.isPropertyAccessExpression(ziel) && ts.isIdentifier(ziel.expression) && ziel.expression.text === 'vi'
    && ['mock', 'doMock', 'importActual', 'importMock'].includes(ziel.name.text)
  return istImport || istRequire || istMock ? erstes.text : null
}

function beruehrtBetterAuth(sf: ts.SourceFile, helfer: Set<string>): boolean {
  let beruehrt = false
  besuche(sf, (k) => {
    if (ts.isImportDeclaration(k) && ts.isStringLiteral(k.moduleSpecifier)) {
      const modul = k.moduleSpecifier.text
      if (AUTH_MODUL.test(modul)) beruehrt = true
      const benannt = k.importClause?.namedBindings
      if (BASIS_MODUL.test(modul) && benannt && ts.isNamedImports(benannt)) {
        if (benannt.elements.some((e) => helfer.has((e.propertyName ?? e.name).text))) beruehrt = true
      }
    }
    if (ts.isExportDeclaration(k) && k.moduleSpecifier && ts.isStringLiteral(k.moduleSpecifier) && AUTH_MODUL.test(k.moduleSpecifier.text)) beruehrt = true
    if (ts.isCallExpression(k)) {
      const modul = moduleDesAufrufs(k)
      if (modul !== null && AUTH_MODUL.test(modul)) beruehrt = true
    }
    // prisma.session.create(…), tx.verification.deleteMany(…), s.session.id
    if (ts.isPropertyAccessExpression(k) && ts.isPropertyAccessExpression(k.parent) && ['session', 'verification'].includes(k.name.text)) beruehrt = true
    if ((ts.isTemplateExpression(k) || ts.isNoSubstitutionTemplateLiteral(k) || ts.isStringLiteral(k)) && AUTH_TABELLE_SQL.test(k.getText())) beruehrt = true
  })
  return beruehrt
}

/** Zeitpunkt (ms) eines Datums-Literals `new Date('…')`, auch über `const`-Namen derselben Datei; sonst `null`. */
function literalZeitpunkt(ausdruck: ts.Expression, konstanten: Map<string, ts.Expression>, tiefe = 0): number | null {
  const k = ohneHuelle(ausdruck)
  if (ts.isIdentifier(k)) {
    const wert = konstanten.get(k.text)
    return wert && tiefe < 4 ? literalZeitpunkt(wert, konstanten, tiefe + 1) : null
  }
  if (!ts.isNewExpression(k) || !ts.isIdentifier(k.expression) || k.expression.text !== 'Date') return null
  const erstes = k.arguments?.[0]
  if (!erstes || !(ts.isStringLiteral(erstes) || ts.isNoSubstitutionTemplateLiteral(erstes))) return null
  const ms = Date.parse(erstes.text)
  return Number.isNaN(ms) ? null : ms
}

function konstantenVon(sf: ts.SourceFile): Map<string, ts.Expression> {
  const konstanten = new Map<string, ts.Expression>()
  for (const anweisung of sf.statements) {
    if (!ts.isVariableStatement(anweisung) || !(anweisung.declarationList.flags & ts.NodeFlags.Const)) continue
    for (const d of anweisung.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.initializer) konstanten.set(d.name.text, d.initializer)
    }
  }
  return konstanten
}

/** Uhr-Schritte, deren Weite die Zahl im Aufruf bestimmt; die übrigen springen ohne Obergrenze. */
const SCHRITT_MIT_ZAHL = ['advanceTimersByTime', 'advanceTimersByTimeAsync']
const SCHRITT_OHNE_GRENZE = [
  'advanceTimersToNextTimer',
  'advanceTimersToNextTimerAsync',
  'runAllTimers',
  'runAllTimersAsync',
  'runOnlyPendingTimers',
  'runOnlyPendingTimersAsync',
]

type UhrAufruf = {
  zeile: number
  text: string
  art: 'stellen' | 'schritt'
  /** Stellen: Zeitpunkt des Literals (ms). */
  zeitpunkt: number | null
  /** Schritt: Weite in ms, wenn die Zahl ein Literal ist. */
  schritt: number | null
}

/** Wert eines Zahlen-Literals, auch `60 * 1_000` oder `(2 + 3) * 1000`; sonst `null` (Variable, Aufruf, …). */
function zahlLiteral(ausdruck: ts.Expression): number | null {
  const k = ohneHuelle(ausdruck)
  if (ts.isNumericLiteral(k)) return Number(k.text)
  if (!ts.isBinaryExpression(k)) return null
  const links = zahlLiteral(k.left)
  const rechts = zahlLiteral(k.right)
  if (links === null || rechts === null) return null
  switch (k.operatorToken.kind) {
    case ts.SyntaxKind.PlusToken: return links + rechts
    case ts.SyntaxKind.MinusToken: return links - rechts
    case ts.SyntaxKind.AsteriskToken: return links * rechts
    default: return null
  }
}

/** Alle Stellen, die die Uhr stellen oder weiterschieben: `vi.setSystemTime(x)`, `vi.useFakeTimers({ now: x })`, `vi.advanceTimersByTime(n)` u. a. */
function findeUhrAufrufe(sf: ts.SourceFile): UhrAufruf[] {
  const konstanten = konstantenVon(sf)
  const treffer: UhrAufruf[] = []
  const merke = (knoten: ts.Node, rest: Pick<UhrAufruf, 'art' | 'zeitpunkt' | 'schritt'>) =>
    treffer.push({
      zeile: sf.getLineAndCharacterOfPosition(knoten.getStart(sf)).line + 1,
      text: knoten.getText(sf).split('\n')[0].trim(),
      ...rest,
    })
  const stelle = (knoten: ts.Node, wert: ts.Expression) =>
    merke(knoten, { art: 'stellen', zeitpunkt: literalZeitpunkt(wert, konstanten), schritt: null })
  besuche(sf, (k) => {
    if (!ts.isCallExpression(k) || !ts.isPropertyAccessExpression(k.expression)) return
    const ziel = k.expression
    if (!ts.isIdentifier(ziel.expression) || ziel.expression.text !== 'vi') return
    if (ziel.name.text === 'setSystemTime' && k.arguments[0]) stelle(k, k.arguments[0])
    if (SCHRITT_MIT_ZAHL.includes(ziel.name.text)) {
      merke(k, { art: 'schritt', zeitpunkt: null, schritt: k.arguments[0] ? zahlLiteral(k.arguments[0]) : null })
    }
    if (SCHRITT_OHNE_GRENZE.includes(ziel.name.text)) merke(k, { art: 'schritt', zeitpunkt: null, schritt: null })
    if (ziel.name.text === 'useFakeTimers') {
      const optionen = k.arguments[0] && ohneHuelle(k.arguments[0])
      if (!optionen || !ts.isObjectLiteralExpression(optionen)) return
      for (const eigenschaft of optionen.properties) {
        if (ts.isPropertyAssignment(eigenschaft) && ts.isIdentifier(eigenschaft.name) && eigenschaft.name.text === 'now') stelle(k, eigenschaft.initializer)
        if (ts.isShorthandPropertyAssignment(eigenschaft) && eigenschaft.name.text === 'now') stelle(k, eigenschaft.name)
      }
    }
  })
  return treffer
}

/** Verstöße einer Datei, je als Satz mit Zeile. Leer = die Datei hält die Regel. */
function uhrVerstoesse(quelltext: string, helfer: Set<string>, name = 'attrappe.ts'): string[] {
  const sf = parse(quelltext, name)
  const aufrufe = findeUhrAufrufe(sf)
  if (aufrufe.length === 0 || !beruehrtBetterAuth(sf, helfer)) return []
  const verstoesse = aufrufe
    .filter((a) => a.art === 'stellen' && (a.zeitpunkt === null || a.zeitpunkt >= STICHTAG_MS))
    .map((a) => `${name}:${a.zeile} ${a.text} — ${a.zeitpunkt === null ? 'kein Datums-Literal' : 'Literal nach dem 20.10.2026'}`)
  // Die späteste feste Uhr in der Vergangenheit; ab ihr darf ein Schritt nicht über den Stichtag führen.
  // Quelltext-Reihenfolge ist keine Ausführungsreihenfolge (Helfer stehen über dem beforeEach): Es zählt die Datei.
  const feste = aufrufe.flatMap((a) => (a.art === 'stellen' && a.zeitpunkt !== null && a.zeitpunkt < STICHTAG_MS ? [a.zeitpunkt] : []))
  const spaeteste = feste.length > 0 ? Math.max(...feste) : null
  for (const a of aufrufe.filter((x) => x.art === 'schritt')) {
    const grund =
      a.schritt === null ? 'Schritt ohne Zahl als Literal'
      : spaeteste === null ? 'Schritt ohne feste Uhr in der Vergangenheit'
      : spaeteste + a.schritt >= STICHTAG_MS ? 'Schritt führt über den 20.10.2026'
      : null
    if (grund) verstoesse.push(`${name}:${a.zeile} ${a.text} — ${grund}`)
  }
  return verstoesse
}

function dateienUnter(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? dateienUnter(join(ordner, e.name)) : e.name.endsWith('.ts') ? [join(ordner, e.name)] : []
  )
}

const KEINE_HELFER = new Set<string>()

describe('Uhr-Wache für tests/integration/ (Nr. 112)', () => {
  it('jeder Uhr-Aufruf in einer Datei mit Better Auth trägt ein Literal vor dem 20.10.2026', () => {
    const helfer = findeAuthHelfer(readFileSync(BASIS, 'utf8'))
    const verstoesse: Record<string, string[]> = {}
    for (const pfad of dateienUnter(ORDNER)) {
      const name = relative(ORDNER, pfad)
      const gefunden = uhrVerstoesse(readFileSync(pfad, 'utf8'), helfer, name)
      if (gefunden.length > 0) verstoesse[name] = gefunden
    }

    const neu = Object.keys(verstoesse).filter((n) => !(n in UHR_BESTAND))
    expect(neu.map((n) => verstoesse[n].join('\n')), 'Uhr nur als Literal in der Vergangenheit stellen (TESTING_GUIDELINES „Zeit in der Integrationsschicht“)').toEqual([])
    const veraltet = Object.keys(UHR_BESTAND).filter((n) => !(n in verstoesse))
    expect(veraltet, 'UHR_BESTAND: Datei hält die Regel jetzt, Eintrag streichen').toEqual([])
    for (const grund of Object.values(UHR_BESTAND)) expect(grund.length).toBeGreaterThan(20)
  })

  it('findet die Uhr-Aufrufe und die Helfer mit Better Auth im echten Bestand (kein leerer Fund)', () => {
    const helfer = findeAuthHelfer(readFileSync(BASIS, 'utf8'))
    expect([...helfer].sort()).toEqual(expect.arrayContaining(['erstelleHofMitAnmeldung', 'machePasskeyAdmin']))
    expect(helfer.has('raeumeAuf')).toBe(false)

    const mitUhr = dateienUnter(ORDNER).filter((p) => findeUhrAufrufe(parse(readFileSync(p, 'utf8'))).length > 0)
    expect(mitUhr.map((p) => relative(ORDNER, p))).toEqual(expect.arrayContaining(['bargebuehr.int.test.ts', 'code-bremse.int.test.ts']))
  })

  describe('Gegenprobe an Attrappen', () => {
    const MIT_AUTH = `import { auth } from '@/lib/auth'\n`

    it('schlägt bei einem Literal in der Zukunft an', () => {
      const q = `${MIT_AUTH}vi.setSystemTime(new Date('2027-01-01T00:00:00.000Z'))`
      expect(uhrVerstoesse(q, KEINE_HELFER)).toHaveLength(1)
    })

    it('schlägt bei einer Variable in einer Datei mit Better Auth an', () => {
      const q = `${MIT_AUTH}function uhrAuf(t: Date) { vi.setSystemTime(t) }`
      expect(uhrVerstoesse(q, KEINE_HELFER)).toHaveLength(1)
    })

    it('schlägt bei einem Schritt von der echten Uhr aus und bei useFakeTimers({ now }) an', () => {
      const schritt = `${MIT_AUTH}vi.setSystemTime(new Date(Date.now() + 1_000))`
      expect(uhrVerstoesse(schritt, KEINE_HELFER)).toHaveLength(1)
      const jetzt = `${MIT_AUTH}vi.useFakeTimers({ now: new Date(Date.now() + 5) })`
      expect(uhrVerstoesse(jetzt, KEINE_HELFER)).toHaveLength(1)
      const zukunft = `${MIT_AUTH}vi.useFakeTimers({ toFake: ['Date'], now: new Date('2027-05-05') })`
      expect(uhrVerstoesse(zukunft, KEINE_HELFER)).toHaveLength(1)
    })

    it('erkennt Better Auth am dynamischen Import, an Prisma-Zeilen, an SQL und am Helfer aus setup/basis', () => {
      const uhr = `vi.setSystemTime(zeit)`
      expect(uhrVerstoesse(`const { auth } = await import('@/lib/auth')\n${uhr}`, KEINE_HELFER)).toHaveLength(1)
      expect(uhrVerstoesse(`await prisma.session.deleteMany({})\n${uhr}`, KEINE_HELFER)).toHaveLength(1)
      expect(uhrVerstoesse(`await prisma.verification.findFirst({})\n${uhr}`, KEINE_HELFER)).toHaveLength(1)
      expect(uhrVerstoesse('await prisma.$executeRaw`DELETE FROM "session" WHERE true`\n' + uhr, KEINE_HELFER)).toHaveLength(1)
      const helferImport = `import { erstelleHofMitAnmeldung } from './setup/basis'\n${uhr}`
      expect(uhrVerstoesse(helferImport, new Set(['erstelleHofMitAnmeldung']))).toHaveLength(1)
    })

    it('lässt ein Literal vor dem 20.10.2026 durch, auch über eine const', () => {
      expect(uhrVerstoesse(`${MIT_AUTH}vi.setSystemTime(new Date('2026-10-14T10:00:00.000Z'))`, KEINE_HELFER)).toEqual([])
      const ueberConst = `${MIT_AUTH}const JETZT = new Date('2026-10-14T10:00:00.000Z')\nvi.useFakeTimers({ now: JETZT })\nvi.setSystemTime(JETZT)`
      expect(uhrVerstoesse(ueberConst, KEINE_HELFER)).toEqual([])
    })

    describe('Uhr-Schritte (Nr. 127, Regelvorschlag 121)', () => {
      const FEST = `vi.useFakeTimers({ now: new Date('2026-10-14T10:00:00.000Z') })\n`

      it('schlägt bei einem Schritt ohne feste Uhr in der Vergangenheit an', () => {
        expect(uhrVerstoesse(`${MIT_AUTH}vi.advanceTimersByTime(1_000)`, KEINE_HELFER)).toHaveLength(1)
        // Eine Uhr in der Zukunft ist keine feste Uhr in der Vergangenheit: der Schritt UND die Uhr schlagen an.
        const zukunft = `${MIT_AUTH}vi.setSystemTime(new Date('2027-01-01'))\nvi.advanceTimersByTime(1_000)`
        expect(uhrVerstoesse(zukunft, KEINE_HELFER)).toHaveLength(2)
      })

      it('schlägt bei einem Schritt ohne Zahl als Literal an (Variable, Aufruf, Async-Form)', () => {
        expect(uhrVerstoesse(`${MIT_AUTH}${FEST}vi.advanceTimersByTime(wartezeit)`, KEINE_HELFER)).toHaveLength(1)
        expect(uhrVerstoesse(`${MIT_AUTH}${FEST}vi.advanceTimersByTime(Date.now())`, KEINE_HELFER)).toHaveLength(1)
        expect(uhrVerstoesse(`${MIT_AUTH}${FEST}await vi.advanceTimersByTimeAsync(wartezeit)`, KEINE_HELFER)).toHaveLength(1)
        expect(uhrVerstoesse(`${MIT_AUTH}${FEST}vi.advanceTimersByTime()`, KEINE_HELFER)).toHaveLength(1)
      })

      it('schlägt bei advanceTimersToNextTimer und runAllTimers an: sie springen ohne Obergrenze', () => {
        for (const aufruf of ['vi.advanceTimersToNextTimer()', 'vi.runAllTimers()', 'await vi.runAllTimersAsync()', 'vi.runOnlyPendingTimers()']) {
          expect(uhrVerstoesse(`${MIT_AUTH}${FEST}${aufruf}`, KEINE_HELFER), aufruf).toHaveLength(1)
        }
      })

      it('schlägt bei einem Schritt an, der über den 20.10.2026 führt', () => {
        const sechsTage = `${MIT_AUTH}${FEST}vi.advanceTimersByTime(6 * 24 * 60 * 60_000)`
        expect(uhrVerstoesse(sechsTage, KEINE_HELFER)).toEqual([expect.stringContaining('führt über den 20.10.2026')])
      })

      it('lässt einen kleinen Schritt nach einer festen Uhr durch, auch als Rechnung aus Literalen', () => {
        expect(uhrVerstoesse(`${MIT_AUTH}${FEST}vi.advanceTimersByTime(1_000)`, KEINE_HELFER)).toEqual([])
        expect(uhrVerstoesse(`${MIT_AUTH}${FEST}vi.advanceTimersByTime(11 * 60_000)`, KEINE_HELFER)).toEqual([])
        expect(uhrVerstoesse(`${MIT_AUTH}${FEST}await vi.advanceTimersByTimeAsync((2 + 3) * 1000)`, KEINE_HELFER)).toEqual([])
        // Die Uhr darf unter dem Schritt stehen: Helfer stehen im Quelltext über dem beforeEach.
        const helferZuerst = `${MIT_AUTH}function weiter() { vi.advanceTimersByTime(1_000) }\n${FEST}`
        expect(uhrVerstoesse(helferZuerst, KEINE_HELFER)).toEqual([])
      })

      it('lässt jeden Schritt in einer Datei ohne Better Auth durch', () => {
        expect(uhrVerstoesse(`vi.advanceTimersByTime(wartezeit)\nvi.runAllTimers()`, KEINE_HELFER)).toEqual([])
      })
    })

    it('lässt jede Uhr in einer Datei ohne Better Auth durch', () => {
      const q = `import { raeumeAuf } from './setup/basis'\nfunction uhrAuf(t: Date) { vi.setSystemTime(t) }\nvi.setSystemTime(new Date('2030-01-01'))`
      expect(uhrVerstoesse(q, new Set(['erstelleHofMitAnmeldung']))).toEqual([])
    })

    it('zählt Better Auth im Kommentar und im Text nicht', () => {
      const q = `// import { auth } from '@/lib/auth'; prisma.session.create()\nconst hinweis = 'Better Auth räumt session auf'\nvi.setSystemTime(zeit)`
      expect(uhrVerstoesse(q, KEINE_HELFER)).toEqual([])
    })

    it('liest die Helfer aus basis.ts: nur die, die Better Auth rufen oder Sitzungen schreiben', () => {
      const basis = [
        `import { auth } from '@/lib/auth'`,
        `export async function melde() { await auth.api.signInEmail({}) }`,
        `export async function sitzungen(id: string) { await prisma.session.updateMany({}) }`,
        `export async function nurHof() { await prisma.farm.create({}) }`,
        `async function nichtExportiert() { await auth.api.signInEmail({}) }`,
      ].join('\n')
      expect([...findeAuthHelfer(basis)].sort()).toEqual(['melde', 'sitzungen'])
    })
  })
})
