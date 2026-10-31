/**
 * Wache am Quelltext (Register N33, N35; Nr. 188): jede Admin-Action nennt
 * ihr Recht und schreibt ins Protokoll — am Syntaxbaum von TypeScript.
 *
 *  - Jede exportierte Action unter src/server/actions, die die Admin-Wache
 *    ruft (`verlangeAdminAktion` bzw. `verlangeFrischeBestaetigung`), nennt
 *    `recht` als Text. „ansehen“ steht nur mit Grund in NUR_ANSEHEN.
 *  - Jede solche Action ruft `protokolliere` — selbst oder über eine
 *    Funktion derselben Datei —, außer mit Grund in OHNE_PROTOKOLL (nur
 *    Lesen, eigener Lesestand, eigene Einrichtung, Autospeichern).
 *  - `adminRechte` wird nur in src/lib/admin-rechte.ts,
 *    src/server/admin-wache.ts und dem Team (Nr. 190: Action und Abfrage von
 *    Einstellungen › Team, nur Inhaber) gelesen.
 *  - Die Zahl der Admin-Actions steht fest: Eine neue fällt auf und bekommt
 *    ihr Recht, ihre Art (src/schemas/admin-aktion.ts) und ihren Eintrag hier.
 * Gegenproben: Schnipsel ohne Recht, mit „ansehen“ ohne Liste, ohne Protokoll.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { ADMIN_RECHTE, INHABER_RECHTE } from '@/lib/admin-rechte'

const WURZEL = process.cwd()
const ACTIONS = join(WURZEL, 'src', 'server', 'actions')
const WACHEN = new Set(['verlangeAdminAktion', 'verlangeFrischeBestaetigung'])
const RECHTE = new Set<string>(['ansehen', ...ADMIN_RECHTE, ...INHABER_RECHTE])

/** Actions, denen „ansehen“ genügt (N35: Heute, Höfe, Bestellungen, Postfach) — je mit Grund. */
const NUR_ANSEHEN: Record<string, string> = {
  triageMeldungAction: 'Meldungen triagieren (Freigabe 188, Punkt 3) — mit Protokoll',
  fasseZusammenAction: 'Meldungen zusammenfassen — schreibt über triageMeldungAction',
  trenneDuplikatAction: 'Meldungen trennen — schreibt über triageMeldungAction',
  setzeBuendelStandAction: 'Stand für alle eines Wunsch-Bündels — Teil der Triage, mit Protokoll',
  legeMeldungAbAction: 'Meldung ablegen — Teil der Triage, frisch bestätigt und mit Protokoll',
  antworteAlsTeam: 'Team-Antwort im Postfach (Freigabe 188, Punkt 3) — mit Protokoll',
  markiereGelesenTeam: 'Lesestand des Teams — nur gelesen',
  messeJetztAction: 'Betrieb jetzt messen — liest Zahlen der Dienste, mit Protokoll',
  zeigeMailVorschauAction: 'Vorschau einer Mail — nur lesend (N27)',
  schickeEinrichtungscode: 'Eigene Einrichtung des ersten Passkeys (N20) — jede Person braucht sie',
  pruefeEinrichtungscode: 'Eigene Einrichtung des ersten Passkeys (N20) — jede Person braucht sie',
}

/** Actions ohne Eintrag im Protokoll — je mit Grund. Alles andere schreibt ins Protokoll (N33). */
const OHNE_PROTOKOLL: Record<string, string> = {
  markiereGelesenTeam: 'nur der eigene Lesestand, keine Wirkung',
  zeigeMailVorschauAction: 'nur lesend, nichts gespeichert oder verschickt (N27)',
  erzeugeStartseitenVorschau: 'nur ein signierter Link zum Ansehen',
  speichereEntwurf: 'Autospeichern des Entwurfs, wirkt nicht live — Veröffentlichen und Zurückziehen stehen im Protokoll',
  schickeEinrichtungscode: 'eigene Einrichtung vor dem ersten Passkey — die Sicherheitsmail geht an die Person',
  pruefeEinrichtungscode: 'eigene Einrichtung vor dem ersten Passkey — prüft nur den Code',
  pruefeFrischFuerPasskey: 'nur die Prüfung „frisch“ vor dem Anlegen eines Passkeys, schreibt nichts',
}

/** So viele exportierte Actions rufen die Admin-Wache (Bericht 188: „alle Einstiege geprüft“; Nr. 186: +2 in admin-bestellung.ts; Nr. 187: +2 Hof sperren/aufheben; Nr. 189: +2 Notbremse; Nr. 190: +5 Konto-Anfragen, +4 Team; Nr. 191: +1 Monatsabschluss; Nr. 197: +1 Hofpreis-Stichtag; Nr. 198: +1 Plattformgebühr je Hof; Nr. 200: +1 Widerruf zuordnen). */
const ANZAHL_ADMIN_ACTIONS = 64

type Aktion = { datei: string; name: string; rechte: Array<string | null>; protokoll: boolean }

function quelle(text: string, pfad = 'x.ts'): ts.SourceFile {
  return ts.createSourceFile(pfad, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
}

function aufrufName(knoten: ts.Node): string | null {
  return ts.isCallExpression(knoten) && ts.isIdentifier(knoten.expression) ? knoten.expression.text : null
}

/** Der Text von `recht` im ersten Argument — null, wenn es fehlt oder kein Text ist. */
function rechtDes(aufruf: ts.CallExpression): string | null {
  const arg = aufruf.arguments[0]
  if (!arg || !ts.isObjectLiteralExpression(arg)) return null
  for (const e of arg.properties) {
    if (ts.isPropertyAssignment(e) && ts.isIdentifier(e.name) && e.name.text === 'recht' && ts.isStringLiteral(e.initializer)) return e.initializer.text
  }
  return null
}

function istExportiert(fn: ts.FunctionDeclaration): boolean {
  return fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) === true
}

/** Alle Admin-Actions einer Datei: Wache, Rechte, und ob sie (auch über Funktionen derselben Datei) protokolliert. */
function aktionenIn(text: string, datei: string): Aktion[] {
  const sf = quelle(text, datei)
  const funktionen = new Map<string, ts.FunctionDeclaration>()
  for (const s of sf.statements) if (ts.isFunctionDeclaration(s) && s.name) funktionen.set(s.name.text, s)

  const aufrufe = (wurzel: ts.Node): ts.CallExpression[] => {
    const liste: ts.CallExpression[] = []
    const besuche = (k: ts.Node): void => {
      if (ts.isCallExpression(k)) liste.push(k)
      ts.forEachChild(k, besuche)
    }
    besuche(wurzel)
    return liste
  }
  const protokolliert = (name: string, gesehen: Set<string>): boolean => {
    if (gesehen.has(name)) return false
    gesehen.add(name)
    const fn = funktionen.get(name)
    if (!fn) return false
    return aufrufe(fn).some((a) => {
      const n = aufrufName(a)
      return n === 'protokolliere' || (n !== null && funktionen.has(n) && protokolliert(n, gesehen))
    })
  }

  const ergebnis: Aktion[] = []
  for (const [name, fn] of funktionen) {
    if (!istExportiert(fn)) continue
    const wachen = aufrufe(fn).filter((a) => WACHEN.has(aufrufName(a) ?? ''))
    if (wachen.length === 0) continue
    ergebnis.push({ datei, name, rechte: wachen.map(rechtDes), protokoll: protokolliert(name, new Set()) })
  }
  return ergebnis
}

function maengel(aktionen: Aktion[], nurAnsehen: Record<string, string>, ohneProtokoll: Record<string, string>): string[] {
  const liste: string[] = []
  for (const a of aktionen) {
    for (const recht of a.rechte) {
      if (recht === null) liste.push(`${a.datei} ${a.name}: die Wache nennt kein \`recht\``)
      else if (!RECHTE.has(recht)) liste.push(`${a.datei} ${a.name}: unbekanntes Recht „${recht}“`)
      else if (recht === 'ansehen' && !(a.name in nurAnsehen)) liste.push(`${a.datei} ${a.name}: „ansehen“ ohne Grund in NUR_ANSEHEN`)
    }
    if (!a.protokoll && !(a.name in ohneProtokoll)) liste.push(`${a.datei} ${a.name}: ruft protokolliere nicht`)
  }
  return liste
}

function dateienUnter(ordner: string): string[] {
  return readdirSync(ordner).flatMap((n) => {
    const pfad = join(ordner, n)
    return statSync(pfad).isDirectory() ? dateienUnter(pfad) : [pfad]
  })
}

const ALLE = readdirSync(ACTIONS)
  .filter((n) => n.endsWith('.ts'))
  .flatMap((n) => aktionenIn(readFileSync(join(ACTIONS, n), 'utf8'), `src/server/actions/${n}`))

describe('Admin-Actions: Recht und Protokoll (N33, N35)', () => {
  it(`es sind ${ANZAHL_ADMIN_ACTIONS} exportierte Admin-Actions — eine neue braucht Recht, Art und Eintrag hier`, () => {
    expect(ALLE).toHaveLength(ANZAHL_ADMIN_ACTIONS)
  })

  it('jede nennt ein Recht; „ansehen“ nur mit Grund; jede protokolliert oder steht mit Grund in OHNE_PROTOKOLL', () => {
    expect(maengel(ALLE, NUR_ANSEHEN, OHNE_PROTOKOLL)).toEqual([])
  })

  it('die Listen enthalten nur Admin-Actions, die es gibt und die die Ausnahme brauchen (nichts Veraltetes)', () => {
    const namen = new Set(ALLE.map((a) => a.name))
    expect(Object.keys(NUR_ANSEHEN).filter((n) => !ALLE.some((a) => a.name === n && a.rechte.includes('ansehen')))).toEqual([])
    expect(Object.keys(OHNE_PROTOKOLL).filter((n) => !namen.has(n) || ALLE.find((a) => a.name === n)?.protokoll === true)).toEqual([])
  })

  it('adminRechte wird nur in src/lib/admin-rechte.ts, src/server/admin-wache.ts und im Team (Nr. 190) gelesen', () => {
    const erlaubt = new Set(['src/lib/admin-rechte.ts', 'src/server/admin-wache.ts', 'src/server/actions/team.ts', 'src/server/queries/team.ts'])
    const funde = dateienUnter(join(WURZEL, 'src'))
      .filter((p) => /\.tsx?$/.test(p))
      .map((p) => relative(WURZEL, p).split(sep).join('/'))
      .filter((p) => !erlaubt.has(p) && /\.adminRechte\b|adminRechte\s*:\s*true/.test(readFileSync(join(WURZEL, p), 'utf8')))
    expect(funde).toEqual([])
  }, 30_000)
})

describe('Gegenproben — die Wache schlägt an', () => {
  const kopf = "import { verlangeAdminAktion, verlangeFrischeBestaetigung } from '@/server/admin-wache'\nimport { protokolliere } from '@/server/admin-protokoll'\n"
  const pruefe = (text: string, nurAnsehen: Record<string, string> = {}, ohne: Record<string, string> = {}): string[] =>
    maengel(aktionenIn(kopf + text, 'schnipsel.ts'), nurAnsehen, ohne)

  it('ohne recht, mit unbekanntem Recht, mit Recht als Variable', () => {
    expect(pruefe('export async function a() { const w = await verlangeAdminAktion()\n await protokolliere(w) }')).toHaveLength(1)
    expect(pruefe("export async function a() { const w = await verlangeFrischeBestaetigung({ recht: 'alles' })\n await protokolliere(w) }")).toHaveLength(1)
    expect(pruefe("const r = 'geld'\nexport async function a() { const w = await verlangeAdminAktion({ recht: r })\n await protokolliere(w) }")).toHaveLength(1)
  })

  it('„ansehen“ ohne Liste fällt auf, mit Liste nicht', () => {
    const text = "export async function a() { const w = await verlangeAdminAktion({ recht: 'ansehen' })\n await protokolliere(w) }"
    expect(pruefe(text)).toHaveLength(1)
    expect(pruefe(text, { a: 'Grund' })).toEqual([])
  })

  it('ohne protokolliere fällt auf; über eine Funktion derselben Datei zählt es; die Liste nimmt es aus', () => {
    const ohne = "export async function a() { const w = await verlangeAdminAktion({ recht: 'geld' })\n return w }"
    expect(pruefe(ohne)).toHaveLength(1)
    expect(pruefe(ohne, {}, { a: 'Grund' })).toEqual([])
    expect(pruefe("async function schreibe() { await protokolliere({}) }\nexport async function a() { await verlangeAdminAktion({ recht: 'geld' })\n await schreibe() }")).toEqual([])
    // Eine nicht exportierte Funktion mit Wache ist keine Action.
    expect(aktionenIn(kopf + "async function intern() { await verlangeAdminAktion({ recht: 'geld' }) }", 'x.ts')).toEqual([])
  })
})
