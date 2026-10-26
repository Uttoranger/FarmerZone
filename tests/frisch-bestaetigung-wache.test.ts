/**
 * Wache am Quelltext (Register N20, Ergänzung Lauf 18; Nr. 115): Die heiklen
 * Admin-Aktionen verlangen eine frische Bestätigung mit Passkey — die Regel
 * selbst (5 Minuten, „frisch") prüfen tests/admin-wache.test.ts und die
 * Integrationsschicht; hier steht nur, DASS und WO sie hängt:
 *  - jede heikle Action ruft als ERSTE Anweisung
 *    `await verlangeFrischeBestaetigung()` aus '@/server/admin-wache';
 *  - jeder CSV-Export unter /admin fragt direkt nach seiner Admin-Wache
 *    `frischOderBestaetigen` (303 auf /admin/bestaetigen);
 *  - jede Oberfläche ruft die heikle Action nur über useFrischBestaetigt.
 * Gegenproben: Schnipsel ohne Aufruf, mit Aufruf an zweiter Stelle, mit
 * direktem Aufruf der Action.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const lies = (pfad: string): string => readFileSync(join(process.cwd(), pfad), 'utf8')

const HEIKLE_AKTIONEN: Array<{ datei: string; namen: string[] }> = [
  // Ergänzung 23.10.2026 (Nr. 154): Freischalten, Servicegebühr, „Gründungshof bis", Rundschreiben, Empfänger, Startseite.
  { datei: 'src/server/actions/admin.ts', namen: ['revokeFarmApprovalAction', 'rejectFarmAction', 'approveFarmAction', 'setServiceFeeAction', 'setzeGruendungBisAction'] },
  { datei: 'src/server/actions/gruendung.ts', namen: ['nimmAusGruendung', 'nimmWiederAuf', 'schreibeZusagenFest', 'markiereAlsTesthof', 'nimmTesthofZurueck'] },
  { datei: 'src/server/actions/postfach.ts', namen: ['markiereErstattungErledigt', 'sendeRundschreiben', 'fuegeEmpfaengerHinzu'] },
  { datei: 'src/server/actions/startseite.ts', namen: ['veroeffentlicheStartseite'] },
  { datei: 'src/server/actions/admin-anmeldung.ts', namen: ['erstelleErsatzcodes', 'entfernePasskey', 'pruefeFrischFuerPasskey'] },
  // Nr. 188 (Audit D10): was live wirkt oder löscht — Zurückziehen, Block löschen, Ablegen, Kostenposten, Gründungs-Einstellungen.
  { datei: 'src/server/actions/startseite.ts', namen: ['zieheFassungZurueck', 'loescheStartseitenBlock'] },
  { datei: 'src/server/actions/admin.ts', namen: ['legeMeldungAbAction'] },
  { datei: 'src/server/actions/finanzen.ts', namen: ['kostenpostenAnlegen', 'kostenpostenAendern', 'kostenpostenBeenden', 'kostenpostenLoeschen'] },
  { datei: 'src/server/actions/plattform-einstellung.ts', namen: ['speichereGruendungEinstellung'] },
  { datei: 'src/server/actions/postfach.ts', namen: ['entferneEmpfaenger', 'speichereZustellRegeln'] },
  // Nr. 187 (N34): Hof sperren und Sperre aufheben.
  { datei: 'src/server/actions/admin-hof.ts', namen: ['sperreHof', 'hebeHofSperreAuf'] },
]

const EXPORTE = ['src/app/admin/finanzen/export/route.ts', 'src/app/admin/betrieb/export/route.ts', 'src/app/admin/betrieb/bilder-export/route.ts']

const OBERFLAECHEN: Array<{ datei: string; aktionen: string[] }> = [
  { datei: 'src/components/admin/hof-aktion-dialog.tsx', aktionen: ['revokeFarmApprovalAction', 'rejectFarmAction', 'approveFarmAction'] },
  { datei: 'src/components/admin/servicegebuehr-dialog.tsx', aktionen: ['setServiceFeeAction'] },
  { datei: 'src/components/admin/gruendung-bis-dialog.tsx', aktionen: ['setzeGruendungBisAction'] },
  { datei: 'src/components/admin/postfach-zustellung.tsx', aktionen: ['fuegeEmpfaengerHinzu'] },
  { datei: 'src/components/admin/startseite-gestalten.tsx', aktionen: ['veroeffentlicheStartseite'] },
  { datei: 'src/app/admin/postfach/rundschreiben-formular.tsx', aktionen: ['sendeRundschreiben'] },
  { datei: 'src/components/admin/gruendung-ausnehmen-dialog.tsx', aktionen: ['nimmAusGruendung', 'nimmWiederAuf'] },
  { datei: 'src/components/admin/testhof-dialog.tsx', aktionen: ['markiereAlsTesthof', 'nimmTesthofZurueck'] },
  { datei: 'src/components/admin/einstellungen-gruendung.tsx', aktionen: ['schreibeZusagenFest'] },
  { datei: 'src/app/admin/postfach/erstattung-erledigt.tsx', aktionen: ['markiereErstattungErledigt'] },
  { datei: 'src/app/admin/einstellungen/anmeldung/anmeldung-verwalten.tsx', aktionen: ['entfernePasskey', 'erstelleErsatzcodes', 'pruefeFrischFuerPasskey'] },
  // Nr. 188 (Audit D10)
  { datei: 'src/components/admin/startseite-gestalten.tsx', aktionen: ['zieheFassungZurueck', 'loescheStartseitenBlock'] },
  { datei: 'src/components/admin/meldungen-werkzeug.tsx', aktionen: ['legeMeldungAbAction'] },
  { datei: 'src/app/admin/finanzen/kosten-sheet.tsx', aktionen: ['kostenpostenAnlegen', 'kostenpostenAendern', 'kostenpostenBeenden', 'kostenpostenLoeschen'] },
  { datei: 'src/components/admin/einstellungen-gruendung.tsx', aktionen: ['speichereGruendungEinstellung'] },
  { datei: 'src/components/admin/postfach-zustellung.tsx', aktionen: ['entferneEmpfaenger', 'speichereZustellRegeln'] },
  // Nr. 187
  { datei: 'src/components/admin/hof-akte-sperre-dialog.tsx', aktionen: ['sperreHof', 'hebeHofSperreAuf'] },
]

function datei(quelltext: string): ts.SourceFile {
  return ts.createSourceFile('x.tsx', quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function funktion(quelle: ts.SourceFile, name: string): ts.FunctionDeclaration | null {
  for (const s of quelle.statements) if (ts.isFunctionDeclaration(s) && s.name?.text === name) return s
  return null
}

/** Ist die Anweisung `const x = await <name>(…)` bzw. `await <name>(…)`? */
function istAwaitAufruf(anweisung: ts.Statement | undefined, name: string): boolean {
  if (!anweisung) return false
  let ausdruck: ts.Expression | undefined
  if (ts.isExpressionStatement(anweisung)) ausdruck = anweisung.expression
  else if (ts.isVariableStatement(anweisung) && anweisung.declarationList.declarations.length === 1) ausdruck = anweisung.declarationList.declarations[0].initializer
  if (!ausdruck || !ts.isAwaitExpression(ausdruck)) return false
  const aufruf = ausdruck.expression
  return ts.isCallExpression(aufruf) && ts.isIdentifier(aufruf.expression) && aufruf.expression.text === name
}

function importiertAusWache(quelle: ts.SourceFile, name: string): boolean {
  return quelle.statements.some(
    (s) =>
      ts.isImportDeclaration(s) &&
      ts.isStringLiteral(s.moduleSpecifier) &&
      s.moduleSpecifier.text === '@/server/admin-wache' &&
      s.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(s.importClause.namedBindings) &&
      s.importClause.namedBindings.elements.some((e) => e.name.text === name)
  )
}

/** Wie oft ruft der Körper `<name>(…)` auf, gleich wo (auch verschachtelt)? */
function zaehleAufrufe(wurzel: ts.Node, name: string): number {
  let anzahl = 0
  const besuche = (knoten: ts.Node): void => {
    if (ts.isCallExpression(knoten) && ts.isIdentifier(knoten.expression) && knoten.expression.text === name) anzahl += 1
    ts.forEachChild(knoten, besuche)
  }
  besuche(wurzel)
  return anzahl
}

/** Was an einer heiklen Action fehlt — leer heißt gedeckt. */
function aktionsMaengel(quelltext: string, name: string): string[] {
  const quelle = datei(quelltext)
  if (!importiertAusWache(quelle, 'verlangeFrischeBestaetigung')) return [`${name}: verlangeFrischeBestaetigung nicht aus '@/server/admin-wache'`]
  const fn = funktion(quelle, name)
  if (!fn) return [`${name}: nicht gefunden`]
  if (!istAwaitAufruf(fn.body?.statements[0], 'verlangeFrischeBestaetigung')) return [`${name}: erste Anweisung ist nicht \`await verlangeFrischeBestaetigung()\``]
  // Eine Wache je Aktion (Nr. 126): Sie prüft schon alles von verlangeAdminAktion, userId und sitzungId liefert sie mit.
  const maengel: string[] = []
  if (zaehleAufrufe(fn, 'verlangeFrischeBestaetigung') !== 1) maengel.push(`${name}: verlangeFrischeBestaetigung wird mehr als einmal aufgerufen`)
  if (zaehleAufrufe(fn, 'verlangeAdminAktion') > 0) maengel.push(`${name}: ruft zusätzlich verlangeAdminAktion — eine zweite Wache dahinter ist überflüssig`)
  return maengel
}

/** Ruft eine Oberfläche die Action nur über useFrischBestaetigt? */
function oberflaechenMaengel(quelltext: string, aktion: string): string[] {
  const maengel: string[] = []
  if (!new RegExp(`useFrischBestaetigt\\(${aktion}\\b`).test(quelltext)) maengel.push(`${aktion}: nicht mit useFrischBestaetigt umhüllt`)
  if (new RegExp(`\\b${aktion}\\(`).test(quelltext)) maengel.push(`${aktion}: wird noch direkt aufgerufen`)
  return maengel
}

/**
 * Wie viele der genannten Passkey-Dialoge (`<name>.dialog`) stehen im Inhalt eines JSX-Elements `<huelle>`?
 * Ein Dialog, der nur in einem anderen, gerade geschlossenen Dialog eingehängt ist, erscheint nie —
 * die Aktion wartete dann ohne Meldung (Nr. 188, Runde 2).
 */
function dialogeInHuelle(quelltext: string, huelle: string, namen: string[]): string[] {
  const funde: string[] = []
  const besuche = (knoten: ts.Node, drin: boolean): void => {
    const istHuelle = ts.isJsxElement(knoten) && knoten.openingElement.tagName.getText() === huelle
    if (drin && ts.isPropertyAccessExpression(knoten) && knoten.name.text === 'dialog' && ts.isIdentifier(knoten.expression) && namen.includes(knoten.expression.text)) {
      funde.push(knoten.expression.text)
    }
    ts.forEachChild(knoten, (kind) => besuche(kind, drin || istHuelle))
  }
  besuche(datei(quelltext), false)
  return funde
}

describe('Passkey-Dialoge hängen dort, wo ihre Aktion ausgelöst wird', () => {
  it('Zurückziehen und Block löschen stehen nicht im Veröffentlichen-Dialog (Nr. 188, Runde 2)', () => {
    const quelltext = lies('src/components/admin/startseite-gestalten.tsx')
    expect(dialogeInHuelle(quelltext, 'VeroeffentlichenDialog', ['frischZurueckziehen', 'frischLoeschen'])).toEqual([])
    expect(quelltext).toMatch(/\{frischZurueckziehen\.dialog\}/)
    expect(quelltext).toMatch(/\{frischLoeschen\.dialog\}/)
  })

  it('Gegenprobe: ein Dialog in der Hülle schlägt an', () => {
    const schnipsel = '<div><VeroeffentlichenDialog offen={x}>{frischVeroeffentlichen.dialog}{frischLoeschen.dialog}</VeroeffentlichenDialog>{frischZurueckziehen.dialog}</div>'
    expect(dialogeInHuelle(schnipsel, 'VeroeffentlichenDialog', ['frischZurueckziehen', 'frischLoeschen'])).toEqual(['frischLoeschen'])
  })
})

describe('heikle Aktionen verlangen die frische Bestätigung (N20)', () => {
  it('jede heikle Action ruft als erste Anweisung await verlangeFrischeBestaetigung()', () => {
    const maengel = HEIKLE_AKTIONEN.flatMap(({ datei: pfad, namen }) => namen.flatMap((n) => aktionsMaengel(lies(pfad), n).map((m) => `${pfad} ${m}`)))
    expect(maengel).toEqual([])
  })

  it('jeder CSV-Export fragt direkt nach der Admin-Wache frischOderBestaetigen', () => {
    for (const pfad of EXPORTE) {
      const quelle = datei(lies(pfad))
      const get = funktion(quelle, 'GET')
      expect(importiertAusWache(quelle, 'frischOderBestaetigen'), pfad).toBe(true)
      const [erste, zweite, dritte] = get?.body?.statements ?? []
      expect(istAwaitAufruf(erste, 'verlangeAdminAktion'), pfad).toBe(true)
      expect(zweite && ts.isIfStatement(zweite), pfad).toBe(true)
      expect(istAwaitAufruf(dritte, 'frischOderBestaetigen'), pfad).toBe(true)
    }
  })

  it('jede Oberfläche ruft die heikle Action nur über useFrischBestaetigt', () => {
    const maengel = OBERFLAECHEN.flatMap(({ datei: pfad, aktionen }) => aktionen.flatMap((a) => oberflaechenMaengel(lies(pfad), a).map((m) => `${pfad} ${m}`)))
    expect(maengel).toEqual([])
  })
})

describe('Gegenproben — die Suche schlägt an', () => {
  const kopf = "import { verlangeAdminAktion, verlangeFrischeBestaetigung } from '@/server/admin-wache'\n"
  it('erkennt eine Action ohne Aufruf, mit Aufruf an zweiter Stelle und aus einem anderen Modul', () => {
    expect(aktionsMaengel(`${kopf}export async function a() { const g = await verlangeAdminAktion()\n return g }`, 'a')).toHaveLength(1)
    expect(aktionsMaengel(`${kopf}export async function a() { const g = await verlangeAdminAktion()\n const f = await verlangeFrischeBestaetigung()\n return f }`, 'a')).toHaveLength(1)
    expect(aktionsMaengel("import { verlangeFrischeBestaetigung } from '@/lib/falsch'\nexport async function a() { await verlangeFrischeBestaetigung() }", 'a')).toHaveLength(1)
    expect(aktionsMaengel(`${kopf}export async function a() { const f = await verlangeFrischeBestaetigung()\n return f }`, 'a')).toEqual([])
    // Eine Wache je Aktion (Nr. 126): eine zweite Wache dahinter oder eine zweite Frage an dieselbe schlägt an.
    expect(aktionsMaengel(`${kopf}export async function a() { const f = await verlangeFrischeBestaetigung()\n const g = await verlangeAdminAktion()\n return [f, g] }`, 'a')).toHaveLength(1)
    expect(aktionsMaengel(`${kopf}export async function a() { const f = await verlangeFrischeBestaetigung()\n const g = await verlangeFrischeBestaetigung()\n return [f, g] }`, 'a')).toHaveLength(1)
    expect(aktionsMaengel(`${kopf}export async function a() { const f = await verlangeFrischeBestaetigung()\n return async () => verlangeAdminAktion() }`, 'a')).toHaveLength(1)
  })

  it('erkennt eine Oberfläche, die die Action direkt ruft oder gar nicht umhüllt', () => {
    expect(oberflaechenMaengel('const e = await revokeFarmApprovalAction(hof.id)', 'revokeFarmApprovalAction')).toHaveLength(2)
    expect(oberflaechenMaengel('const f = useFrischBestaetigt(revokeFarmApprovalAction)\nawait revokeFarmApprovalAction(id)', 'revokeFarmApprovalAction')).toHaveLength(1)
    expect(oberflaechenMaengel('const f = useFrischBestaetigt(revokeFarmApprovalAction)\nawait f.ausfuehren(id)', 'revokeFarmApprovalAction')).toEqual([])
  })
})
