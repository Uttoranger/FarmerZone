/**
 * Wache am Quelltext (Register Z4, Nachtlauf Nr. 55; Muster wie die Wache für
 * `optInEmail`, tests/abo-bestaetigung-quelltext.test.ts): Die Regel
 * „Testzahlung" gibt es genau einmal, in src/lib/testzahlung.ts — als Prüfung
 * (`istTestzahlung`), Prisma-Bedingung (`testzahlungWhere`,
 * `ohneTestzahlungenWhere`) und SQL-Baustein (`ohneTestzahlungenSql`). Der
 * TypeScript-Parser liest jede Datei unter src/ und meldet:
 *
 *  1. Lesen der Variable außerhalb der einen Stelle: `env.STRIPE_LIVE_AB`
 *     bzw. `process.env.STRIPE_LIVE_AB` nur in src/lib/umgebung-server.ts;
 *     `<werte>.STRIPE_LIVE_AB` nur in src/lib/umgebung.ts (dort wird der
 *     übergebene Rohwert rein geprüft).
 *  2. Den Stichtag holt nur die Servergrenze (src/server/**): der Import von
 *     `STRIPE_LIVE_AB` und, seit Runde 1, `UMGEBUNG.stripeLiveAb` — reine
 *     Regeln bekommen ihn als Parameter.
 *  3. Eine zweite Fassung der Regel außerhalb von testzahlung.ts: ein
 *     Größer/Kleiner-Vergleich, ein Prisma-Vergleich (`lt`, `lte`, `gt`,
 *     `gte`) oder eine Vorlage (rohes SQL, Text) mit dem Stichtag; der
 *     Stichtag unter anderem Namen (`const ab = STRIPE_LIVE_AB`); ein
 *     Prisma-Filter aus `paymentMethod: 'ONLINE'` und einem Bereich auf
 *     `createdAt`; rohes SQL mit `"paymentMethod" = 'ONLINE' AND "createdAt" <`.
 *  4. Die Regel abgeschaltet: ein Aufruf der Regel oder einer Summe, die sie
 *     anwendet, mit dem Literal `null` als Stichtag; seit Runde 1 auch ein
 *     eigenes `AND` im selben Objekt wie `...umsatzBestellungWhere(…)`,
 *     `...ohneTestzahlungenWhere(…)` oder (Runde 2) `...umsatzTestzahlungenWhere(…)`
 *     — die Regel steckt dort im `AND`, ein zweites ersetzte sie still (ein
 *     eigenes `NOT` daneben ist erlaubt).
 *  5. `getDashboardStats` ist entfallen (seit Heute ungenutzt, Nr. 55) und
 *     kommt nicht zurück.
 *
 * Zwei benannte Ausnahmen: `topfVonBestellung(b, null)` in
 * `testzahlungenBetroffen` (lib/finanzen.ts) — dort ist genau „ohne die
 * Regel" die Frage —, und `stichtagWeitInDerZukunft` (lib/umgebung.ts), die
 * den Wert der Variable mit `jetzt` vergleicht: eine Plausibilitätsprüfung,
 * keine Fassung der Regel.
 *
 * Grenzen (bewusst, Stand Runde 1):
 *  - Den Stichtag erkennt die Wache an seinen Namen (`STRIPE_LIVE_AB`,
 *    `stripeLiveAb`). Unter fremdem Namen weitergereicht — etwa als Parameter
 *    `ab`, ohne `const x = …` —, sieht sie einen eigenen Vergleich nicht.
 *  - `null` erkennt sie nur als Literal. Eine Variable, die `null` trägt
 *    (`const keiner = null; f(x, keiner)`), geht durch.
 *  - `UMGEBUNG.stripeLiveAb` meldet sie außerhalb von src/server; ein unter
 *    anderem Namen eingebundenes `UMGEBUNG` nicht.
 *  - Ein eigenes `AND` sieht sie nur im selben Objekt wie der Spread der
 *    Bedingung, nicht über eine Zwischenvariable (`const w = umsatzBestellungWhere(…);
 *    f({ ...w, AND: … })`).
 *  - Eine NEUE Summe, die die Regel gar nicht benutzt (etwa ein `aggregate`
 *    über `totalAmount` ohne `umsatzBestellungWhere`), findet sie
 *    grundsätzlich nicht. Dafür stehen die Regel in CODING_STANDARDS §2
 *    („Umsatz und Servicegebühr ohne Testzahlungen") und die
 *    Integrationstests.
 * Gegenproben unten zeigen, dass jede Suche anschlägt.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, it, expect } from 'vitest'

const WURZEL = join(process.cwd(), 'src')
const REGEL_DATEI = 'lib/testzahlung.ts'
const LESE_DATEI = 'lib/umgebung-server.ts'
const PRUEF_DATEI = 'lib/umgebung.ts'

const STICHTAG_NAMEN = new Set(['STRIPE_LIVE_AB', 'stripeLiveAb'])
const VERGLEICH = new Set([
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
])
const PRISMA_BEREICH = new Set(['lt', 'lte', 'gt', 'gte'])

/** Wo der Stichtag als Argument steht — die Regel selbst und jede Summe, die sie anwendet. */
const STICHTAG_ARGUMENT: Record<string, number> = {
  istTestzahlung: 1,
  testzahlungWhere: 0,
  ohneTestzahlungenWhere: 0,
  ohneTestzahlungenSql: 1,
  testzahlungenBetroffen: 1,
  finanzseiteLaesstTestzahlungenAus: 2,
  topfVonBestellung: 1,
  einnahmenImMonat: 2,
  servicegebuehrenImMonat: 2,
  fasseKundinZusammen: 3,
  umsatzBestellungWhere: 2,
  umsatzTestzahlungenWhere: 2,
  umsatzBuchungen: 2,
  monatsSpaltenJeHof: 2,
  testzahlungenHinweisFuerHof: 2,
  getAdminFarms: 1,
  getFinanzen: 2,
  getHeute: 3,
  getSalesOverview: 2,
  getMeistverkaufteProduktIds: 2,
  getUmsatzAuswertung: 4,
  getTopProdukte: 3,
  getYtdRevenue: 2,
  getKennzahlen: 2,
  getServicegebuehrenMonat: 2,
  getCustomersForFarm: 2,
  getCustomerDetail: 3,
}

/** Bedingungen, die die Regel als `AND` mitbringen — ein eigenes `AND` im selben Objekt verdrängte sie. */
const REGEL_IM_AND = new Set(['umsatzBestellungWhere', 'ohneTestzahlungenWhere', 'umsatzTestzahlungenWhere'])

type Fund = { datei: string; zeile: number; grund: string }

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) return dateien(pfad)
    return /\.(ts|tsx)$/.test(name) ? [pfad] : []
  })
}

function eigenschaftsName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text
  if (ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression)) return name.expression.text
  return null
}

function abgestreift(ausdruck: ts.Expression): ts.Expression {
  let a = ausdruck
  while (ts.isParenthesizedExpression(a) || ts.isAsExpression(a) || ts.isSatisfiesExpression(a) || ts.isNonNullExpression(a)) a = a.expression
  return a
}

function aufrufName(knoten: ts.CallExpression): string | null {
  const aufgerufen = abgestreift(knoten.expression)
  if (ts.isIdentifier(aufgerufen)) return aufgerufen.text
  if (ts.isPropertyAccessExpression(aufgerufen)) return aufgerufen.name.text
  return null
}

/**
 * Steht der Stichtag in diesem Teilbaum — als Name oder als Eigenschaft
 * (`x.stripeLiveAb`)? Ein Aufruf der Regel oder einer Summe, die sie anwendet
 * (`ohneTestzahlungenSql(Prisma.sql, stripeLiveAb)`), reicht ihn nur weiter
 * und zählt nicht.
 */
function enthaeltStichtag(knoten: ts.Node): boolean {
  if (ts.isIdentifier(knoten) && STICHTAG_NAMEN.has(knoten.text)) return true
  if (ts.isCallExpression(knoten) && (aufrufName(knoten) ?? '') in STICHTAG_ARGUMENT) return false
  return ts.forEachChild(knoten, (kind) => (enthaeltStichtag(kind) ? true : undefined)) ?? false
}

/** Ist der Ausdruck genau der Stichtag (ohne Rechnung)? */
function istStichtag(ausdruck: ts.Expression): boolean {
  const a = abgestreift(ausdruck)
  if (ts.isIdentifier(a)) return STICHTAG_NAMEN.has(a.text)
  if (ts.isPropertyAccessExpression(a)) return STICHTAG_NAMEN.has(a.name.text)
  return false
}

function istOnline(ausdruck: ts.Expression): boolean {
  const a = abgestreift(ausdruck)
  if (ts.isStringLiteralLike(a)) return a.text === 'ONLINE'
  if (ts.isIdentifier(a)) return a.text === 'TESTZAHLUNG_ZAHLART'
  if (ts.isObjectLiteralExpression(a)) {
    return a.properties.some((p) => ts.isPropertyAssignment(p) && eigenschaftsName(p.name) === 'equals' && istOnline(p.initializer))
  }
  return false
}

function umschliessendeFunktion(knoten: ts.Node): string | null {
  for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) {
    if (ts.isFunctionDeclaration(k) && k.name) return k.name.text
  }
  return null
}

/** Die Wache für eine Datei — `datei` relativ zu src/, mit `/`. */
function pruefeQuelle(datei: string, text: string): Fund[] {
  const quelle = ts.createSourceFile(datei, text, ts.ScriptTarget.Latest, true, datei.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const funde: Fund[] = []
  const melde = (knoten: ts.Node, grund: string) =>
    funde.push({ datei, zeile: quelle.getLineAndCharacterOfPosition(knoten.getStart(quelle)).line + 1, grund })
  const regelDatei = datei === REGEL_DATEI

  function besuche(knoten: ts.Node): void {
    // 1. Lesen der Variable
    const gelesen =
      (ts.isPropertyAccessExpression(knoten) && knoten.name.text === 'STRIPE_LIVE_AB') ||
      (ts.isElementAccessExpression(knoten) && ts.isStringLiteralLike(knoten.argumentExpression) && knoten.argumentExpression.text === 'STRIPE_LIVE_AB')
    if (gelesen) {
      const traeger = knoten.expression.getText(quelle)
      const ausUmgebung = traeger === 'env' || traeger === 'process.env'
      if (ausUmgebung && datei !== LESE_DATEI) melde(knoten, 'liest STRIPE_LIVE_AB außerhalb von src/lib/umgebung-server.ts')
      if (!ausUmgebung && datei !== PRUEF_DATEI) melde(knoten, 'liest einen Rohwert STRIPE_LIVE_AB außerhalb von src/lib/umgebung.ts')
    }

    // 2. Import des Stichtags
    if (ts.isImportDeclaration(knoten) && ts.isStringLiteral(knoten.moduleSpecifier) && knoten.moduleSpecifier.text === '@/lib/umgebung-server') {
      const benannt = knoten.importClause?.namedBindings
      const holt = benannt && ts.isNamedImports(benannt) && benannt.elements.some((e) => (e.propertyName ?? e.name).text === 'STRIPE_LIVE_AB')
      if (holt && !datei.startsWith('server/')) melde(knoten, 'importiert den Stichtag außerhalb der Servergrenze (src/server)')
    }
    if (
      ts.isPropertyAccessExpression(knoten) &&
      knoten.name.text === 'stripeLiveAb' &&
      ts.isIdentifier(knoten.expression) &&
      knoten.expression.text === 'UMGEBUNG' &&
      datei !== LESE_DATEI &&
      !datei.startsWith('server/')
    ) {
      melde(knoten, 'liest den Stichtag über UMGEBUNG außerhalb der Servergrenze (src/server)')
    }

    // 3. Zweite Fassung der Regel
    if (!regelDatei) {
      const plausibilitaet = datei === PRUEF_DATEI && umschliessendeFunktion(knoten) === 'stichtagWeitInDerZukunft'
      if (ts.isBinaryExpression(knoten) && VERGLEICH.has(knoten.operatorToken.kind) && enthaeltStichtag(knoten) && !plausibilitaet) {
        melde(knoten, 'vergleicht selbst mit dem Stichtag (Regel: src/lib/testzahlung.ts)')
      }
      if (ts.isPropertyAssignment(knoten) && PRISMA_BEREICH.has(eigenschaftsName(knoten.name) ?? '') && enthaeltStichtag(knoten.initializer)) {
        melde(knoten, 'Prisma-Vergleich mit dem Stichtag (Regel: ohneTestzahlungenWhere)')
      }
      if (ts.isTemplateExpression(knoten) && enthaeltStichtag(knoten)) {
        melde(knoten, 'Stichtag in einer Vorlage — rohes SQL nur über ohneTestzahlungenSql')
      }
      if (ts.isVariableDeclaration(knoten) && knoten.initializer && istStichtag(knoten.initializer)) {
        const name = ts.isIdentifier(knoten.name) ? knoten.name.text : ''
        if (!STICHTAG_NAMEN.has(name)) melde(knoten, 'reicht den Stichtag unter anderem Namen weiter')
      }
      if (ts.isObjectLiteralExpression(knoten)) {
        const eigenschaften = knoten.properties.filter(ts.isPropertyAssignment)
        const online = eigenschaften.some((p) => eigenschaftsName(p.name) === 'paymentMethod' && istOnline(p.initializer))
        const bereich = eigenschaften.some((p) => {
          const wert = abgestreift(p.initializer)
          return (
            eigenschaftsName(p.name) === 'createdAt' &&
            ts.isObjectLiteralExpression(wert) &&
            wert.properties.some((q) => ts.isPropertyAssignment(q) && PRISMA_BEREICH.has(eigenschaftsName(q.name) ?? ''))
          )
        })
        if (online && bereich) melde(knoten, 'eigener Prisma-Filter für Testzahlungen (Regel: testzahlungWhere)')
      }
      if (ts.isNoSubstitutionTemplateLiteral(knoten) || ts.isTemplateHead(knoten) || ts.isTemplateMiddle(knoten) || ts.isTemplateTail(knoten)) {
        if (/"paymentMethod"\s*=\s*'ONLINE'\s+AND\s+"createdAt"\s*</.test(knoten.text)) {
          melde(knoten, 'eigenes SQL für Testzahlungen (Regel: ohneTestzahlungenSql)')
        }
      }
    }

    // 4. Die Regel mit null abgeschaltet
    if (ts.isCallExpression(knoten)) {
      const name = aufrufName(knoten)
      const stelle = name === null ? undefined : STICHTAG_ARGUMENT[name]
      const argument = stelle === undefined ? undefined : knoten.arguments[stelle]
      if (argument && abgestreift(argument).kind === ts.SyntaxKind.NullKeyword) {
        const erlaubt = datei === 'lib/finanzen.ts' && name === 'topfVonBestellung' && umschliessendeFunktion(knoten) === 'testzahlungenBetroffen'
        if (!erlaubt) melde(knoten, `${name} mit null als Stichtag — die Regel wäre abgeschaltet`)
      }
    }
    if (ts.isObjectLiteralExpression(knoten)) {
      const traegtRegel = knoten.properties.some((p) => {
        if (!ts.isSpreadAssignment(p)) return false
        const a = abgestreift(p.expression)
        return ts.isCallExpression(a) && REGEL_IM_AND.has(aufrufName(a) ?? '')
      })
      const eigenesAnd = knoten.properties.some(
        (p) => (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && eigenschaftsName(p.name) === 'AND'
      )
      if (traegtRegel && eigenesAnd) melde(knoten, 'eigenes AND neben der Regel ersetzte sie still — die Bedingung als Element der AND-Liste nehmen')
    }

    // 5. getDashboardStats bleibt weg
    if (ts.isIdentifier(knoten) && knoten.text === 'getDashboardStats') melde(knoten, 'getDashboardStats ist entfallen (Nr. 55)')

    ts.forEachChild(knoten, besuche)
  }
  besuche(quelle)
  return funde
}

describe('Testzahlung — eine Regel aus einer Quelle (Register Z4)', () => {
  it(
    'kein Fund in src/: Variable an einer Stelle gelesen, Regel nur in testzahlung.ts, nie mit null abgeschaltet',
    () => {
      // Liest und parst jede Datei unter src/ — eigenes Limit nur für diesen Fall (TESTING_GUIDELINES §4).
      const funde = dateien(WURZEL).flatMap((pfad) => {
        const datei = relative(WURZEL, pfad).split('\\').join('/')
        return pruefeQuelle(datei, readFileSync(pfad, 'utf8'))
      })
      expect(funde).toEqual([])
    },
    30_000
  )

  it('die drei Formen stehen in testzahlung.ts, die Variable wird in umgebung-server.ts gelesen', () => {
    const regel = readFileSync(join(WURZEL, REGEL_DATEI), 'utf8')
    for (const form of ['export function istTestzahlung', 'export function ohneTestzahlungenWhere', 'export function ohneTestzahlungenSql']) {
      expect(regel).toContain(form)
    }
    expect(readFileSync(join(WURZEL, LESE_DATEI), 'utf8')).toContain('STRIPE_LIVE_AB: env.STRIPE_LIVE_AB')
  })
})

describe('Gegenproben — jede Suche schlägt an', () => {
  const gruende = (datei: string, text: string) => pruefeQuelle(datei, text).map((f) => f.grund)

  it('1. Lesen der Variable außerhalb der einen Stelle', () => {
    expect(gruende('server/queries/x.ts', 'const a = env.STRIPE_LIVE_AB')).toContain('liest STRIPE_LIVE_AB außerhalb von src/lib/umgebung-server.ts')
    expect(gruende('lib/x.ts', "const a = process.env['STRIPE_LIVE_AB']")).toContain('liest STRIPE_LIVE_AB außerhalb von src/lib/umgebung-server.ts')
    expect(gruende('lib/umgebung.ts', 'const a = process.env.STRIPE_LIVE_AB')).toContain('liest STRIPE_LIVE_AB außerhalb von src/lib/umgebung-server.ts')
    expect(gruende('lib/x.ts', 'const a = werte.STRIPE_LIVE_AB')).toContain('liest einen Rohwert STRIPE_LIVE_AB außerhalb von src/lib/umgebung.ts')
    // Erlaubt:
    expect(gruende('lib/umgebung-server.ts', 'const u = f({ STRIPE_LIVE_AB: env.STRIPE_LIVE_AB })')).toEqual([])
    expect(gruende('lib/umgebung.ts', 'const s = leseStripeLiveAb(werte.STRIPE_LIVE_AB)')).toEqual([])
  })

  it('2. Import des Stichtags außerhalb der Servergrenze', () => {
    const zeile = "import { STRIPE_LIVE_AB } from '@/lib/umgebung-server'"
    expect(gruende('lib/finanzen.ts', zeile)).toContain('importiert den Stichtag außerhalb der Servergrenze (src/server)')
    expect(gruende('app/(hof)/analytics/page.tsx', zeile)).toContain('importiert den Stichtag außerhalb der Servergrenze (src/server)')
    expect(gruende('components/x.tsx', "import { STRIPE_LIVE_AB as ab } from '@/lib/umgebung-server'")).toHaveLength(1)
    expect(gruende('server/queries/heute.ts', zeile)).toEqual([])
    // Über UMGEBUNG am Import vorbei (Runde 1):
    expect(gruende('components/x.tsx', 'f(UMGEBUNG.stripeLiveAb)')).toEqual([
      'liest den Stichtag über UMGEBUNG außerhalb der Servergrenze (src/server)',
    ])
    expect(gruende('lib/hof-kunden.ts', 'const s = UMGEBUNG.stripeLiveAb')).toContain(
      'liest den Stichtag über UMGEBUNG außerhalb der Servergrenze (src/server)'
    )
    expect(gruende('server/queries/x.ts', 'f(UMGEBUNG.stripeLiveAb)')).toEqual([])
    expect(gruende('lib/umgebung-server.ts', 'export const STRIPE_LIVE_AB: Date | null = UMGEBUNG.stripeLiveAb')).toEqual([])
  })

  it('3. eine zweite Fassung der Regel', () => {
    expect(gruende('lib/x.ts', 'const t = b.createdAt < stripeLiveAb')).toContain('vergleicht selbst mit dem Stichtag (Regel: src/lib/testzahlung.ts)')
    expect(gruende('lib/x.ts', 'const t = b.createdAt.getTime() >= STRIPE_LIVE_AB.getTime()')).toHaveLength(1)
    expect(gruende('server/x.ts', 'f({ createdAt: { lt: stripeLiveAb } })')).toContain('Prisma-Vergleich mit dem Stichtag (Regel: ohneTestzahlungenWhere)')
    expect(gruende('server/x.ts', 'const s = Prisma.sql`"createdAt" < ${stripeLiveAb}`')).toContain(
      'Stichtag in einer Vorlage — rohes SQL nur über ohneTestzahlungenSql'
    )
    expect(gruende('server/x.ts', 'const ab = STRIPE_LIVE_AB')).toContain('reicht den Stichtag unter anderem Namen weiter')
    expect(gruende('server/x.ts', "f({ paymentMethod: 'ONLINE', createdAt: { lt: new Date('2026-11-02') } })")).toContain(
      'eigener Prisma-Filter für Testzahlungen (Regel: testzahlungWhere)'
    )
    expect(gruende('server/x.ts', "const q = Prisma.sql`SELECT 1 WHERE \"paymentMethod\" = 'ONLINE' AND \"createdAt\" < ${d}`")).toContain(
      'eigenes SQL für Testzahlungen (Regel: ohneTestzahlungenSql)'
    )
    // Erlaubt: dieselben Formen in der Regel-Datei, Weiterreichen als Argument,
    // Abfrage „ist einer gesetzt", und die Kasse mit Zahlart und Zeitpunkt (fristVon).
    expect(gruende('lib/testzahlung.ts', 'const t = b.createdAt.getTime() < stripeLiveAb.getTime()')).toEqual([])
    // Die Plausibilitätsprüfung des Werts ist erlaubt — derselbe Vergleich in einer anderen Funktion nicht.
    expect(
      gruende('lib/umgebung.ts', 'export function stichtagWeitInDerZukunft(stripeLiveAb, jetzt) { return stripeLiveAb.getTime() - jetzt.getTime() > 1 }')
    ).toEqual([])
    expect(gruende('lib/umgebung.ts', 'export function andere(stripeLiveAb, b) { return b.createdAt < stripeLiveAb }')).toContain(
      'vergleicht selbst mit dem Stichtag (Regel: src/lib/testzahlung.ts)'
    )
    expect(gruende('server/x.ts', 'umsatzBestellungWhere(farmId, fenster, stripeLiveAb)')).toEqual([])
    expect(gruende('server/x.ts', 'const q = Prisma.sql`WHERE ${von} < 1 AND ${ohneTestzahlungenSql(Prisma.sql, stripeLiveAb)}`')).toEqual([])
    expect(gruende('server/x.ts', 'if (stripeLiveAb === null) return null')).toEqual([])
    expect(gruende('app/api/checkout/route.ts', "fristVon({ paymentMethod: 'ONLINE', createdAt: order.createdAt })")).toEqual([])
    expect(gruende('server/x.ts', 'const s = Prisma.sql`WHERE "paymentMethod" = \'ONLINE\' AND "paymentStatus" = \'PAID\'`')).toEqual([])
  })

  it('4. die Regel mit null abgeschaltet', () => {
    expect(gruende('server/queries/x.ts', 'umsatzBestellungWhere(farmId, fenster, null)')).toContain(
      'umsatzBestellungWhere mit null als Stichtag — die Regel wäre abgeschaltet'
    )
    expect(gruende('app/admin/page.tsx', 'getAdminFarms(jetzt, null)')).toHaveLength(1)
    expect(gruende('server/queries/finanzen.ts', 'finanzseiteLaesstTestzahlungenAus(fuerRegel, monat, null)')).toHaveLength(1)
    expect(gruende('lib/finanzen.ts', 'export function andere() { return topfVonBestellung(b, null) }')).toHaveLength(1)
    // Die eine Ausnahme und gewöhnliche Aufrufe:
    expect(gruende('lib/finanzen.ts', 'export function testzahlungenBetroffen() { return topfVonBestellung(b, null) }')).toEqual([])
    expect(gruende('server/x.ts', 'getHeute(farm.id, jetzt, freigabe)')).toEqual([])
    expect(gruende('server/x.ts', 'fasseKundinZusammen(liste, abo ?? null, jetzt, stripeLiveAb)')).toEqual([])
  })

  it('4. die Regel von einem eigenen AND verdrängt (Runde 1)', () => {
    const grund = 'eigenes AND neben der Regel ersetzte sie still — die Bedingung als Element der AND-Liste nehmen'
    expect(gruende('server/x.ts', 'f({ ...umsatzBestellungWhere(farmId, fenster, stripeLiveAb), AND: [{ total: { gt: 0 } }] })')).toEqual([grund])
    expect(gruende('server/x.ts', 'f({ AND: liste, ...ohneTestzahlungenWhere(stripeLiveAb) })')).toEqual([grund])
    expect(gruende('server/x.ts', 'f({ ...umsatzBestellungWhere(farmId, fenster, stripeLiveAb), AND })')).toEqual([grund])
    // Runde 2: Die Bedingung der Hinweiszeile trägt ihre Regel ebenso im AND.
    expect(gruende('server/x.ts', 'f({ ...umsatzTestzahlungenWhere(farmId, fenster, stripeLiveAb), AND: [{ id: x }] })')).toEqual([grund])
    // Erlaubt: ein eigenes NOT daneben, die Regel als Element der AND-Liste, ein AND neben anderem Spread.
    expect(gruende('server/x.ts', 'f({ ...umsatzBestellungWhere(farmId, fenster, stripeLiveAb), NOT: { id: x } })')).toEqual([])
    expect(gruende('server/x.ts', 'f({ farmId, AND: [ohneTestzahlungenWhere(stripeLiveAb), { total: { gt: 0 } }] })')).toEqual([])
    expect(gruende('lib/umsatz.ts', 'f({ ...abgeholtImFenster(farmId, fenster), AND: [testzahlungWhere(stripeLiveAb)] })')).toEqual([])
  })

  it('5. getDashboardStats', () => {
    expect(gruende('server/queries/dashboard.ts', 'export async function getDashboardStats() {}')).toEqual(['getDashboardStats ist entfallen (Nr. 55)'])
  })
})
