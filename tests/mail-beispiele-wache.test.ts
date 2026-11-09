/**
 * Wache am Syntaxbaum (Register N48, Nr. 270): Die Beispiele in Admin ›
 * Betrieb › Mails verschicken nie, speichern nie und protokollieren nie.
 *
 * Beweist (TypeScript-Syntaxbaum, kein Regex):
 *  1. src/server/mail-arten/beispiele.ts bindet weder statisch noch per
 *     `await import()` sendRaw, eine `send…`-Funktion, versendeStapel,
 *     stelleMailEin, stelleEinOhneRisiko, protokolliere… oder prisma ein —
 *     auch nicht über ein Modul, das sie trägt (Prisma, Warteschlange,
 *     Admin-Protokoll, Resend), und nie als ganzes Modul (`import * as`, ein
 *     dynamischer Import ohne Zerlegung), über den ein Name am Blick vorbei
 *     käme; kein `console`.
 *  2. zeigeMailBeispielAction (src/server/actions/betrieb.ts) nennt in ihrem
 *     Rumpf — und im Rumpf jeder Funktion derselben Datei, die sie ruft —
 *     keinen dieser Namen und kein `console`; ihre erste Anweisung ist die
 *     Wache `verlangeAdminAktion({ recht: 'ansehen' })`.
 *  3. Jede Inhalts-Funktion aus Nr. 270 in src/lib/email.ts nimmt genau einen
 *     Parameter ohne Empfänger (`email`, `an`, `to`), loggt nie und
 *     verschickt nie; ihre `send…`-Funktion ruft sie.
 *  4. Jede Funktion, die beispiele.ts aus src/lib/email.ts holt (Inhalts- und
 *     `baue…`-Funktionen), loggt und verschickt nie — auch nicht über eine
 *     Hilfe derselben Datei, die sie ruft. Zu 1 zählen auch `export … from`
 *     und `require()` (Runde 1, Gegenlesen „Sicherheit“).
 * Gegenprobe je Regel: Schnipsel mit dem Verstoß werden gefunden, die echten
 * Dateien nicht.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const WURZEL = process.cwd()
const lies = (pfad: string): string => readFileSync(join(WURZEL, pfad), 'utf8')

const VERBOTENE_NAMEN = new Set(['sendRaw', 'send', 'sendeAnListe', 'versendeStapel', 'stelleMailEin', 'stelleEinOhneRisiko', 'prisma', 'console'])
const istVerboten = (name: string): boolean => VERBOTENE_NAMEN.has(name) || /^send[A-Z]/.test(name) || /^protokolliere/.test(name)
const VERBOTENE_MODULE = ['@/lib/prisma', '@/server/mail-warteschlange', '@/server/admin-protokoll', 'resend', '@prisma/client']

function baum(quelle: string): ts.SourceFile {
  return ts.createSourceFile('x.ts', quelle, ts.ScriptTarget.Latest, true)
}

function besuche(knoten: ts.Node, f: (k: ts.Node) => void): void {
  f(knoten)
  ts.forEachChild(knoten, (k) => besuche(k, f))
}

/** Regel 1 an einer Quelle: Importe (statisch und dynamisch) und Namen. */
function pruefeBeispiele(quelle: string): string[] {
  const datei = baum(quelle)
  const funde: string[] = []
  for (const s of datei.statements) {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier)) continue
    const modul = s.moduleSpecifier.text
    if (VERBOTENE_MODULE.includes(modul)) funde.push(`Modul ${modul}`)
    const b = s.importClause?.namedBindings
    if (b && ts.isNamespaceImport(b)) funde.push(`ganzes Modul ${modul}`)
    if (b && ts.isNamedImports(b)) for (const e of b.elements) if (istVerboten((e.propertyName ?? e.name).text)) funde.push(`Name ${(e.propertyName ?? e.name).text}`)
  }
  // Weiterreichen zählt wie Einbinden: `export { x } from …`, `export * from …`.
  for (const s of datei.statements) {
    if (!ts.isExportDeclaration(s) || !s.moduleSpecifier || !ts.isStringLiteral(s.moduleSpecifier)) continue
    const modul = s.moduleSpecifier.text
    if (VERBOTENE_MODULE.includes(modul)) funde.push(`Modul ${modul}`)
    if (s.exportClause && ts.isNamedExports(s.exportClause)) {
      for (const e of s.exportClause.elements) if (istVerboten((e.propertyName ?? e.name).text)) funde.push(`Name ${(e.propertyName ?? e.name).text}`)
    } else {
      funde.push(`ganzes Modul ${modul}`)
    }
  }
  besuche(datei, (k) => {
    if (ts.isCallExpression(k) && k.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const ziel = k.arguments[0]
      const modul = ziel && ts.isStringLiteral(ziel) ? ziel.text : '?'
      if (VERBOTENE_MODULE.includes(modul) || modul === '?') funde.push(`dynamisch ${modul}`)
      // `const { a, b } = await import(…)` — sonst käme jeder Name des Moduls mit.
      const warte = ts.isAwaitExpression(k.parent) ? k.parent : null
      const deklaration = warte && ts.isVariableDeclaration(warte.parent) ? warte.parent : null
      if (!deklaration || !ts.isObjectBindingPattern(deklaration.name)) funde.push(`dynamisch ungeteilt ${modul}`)
      else for (const e of deklaration.name.elements) {
        const name = e.propertyName && ts.isIdentifier(e.propertyName) ? e.propertyName.text : ts.isIdentifier(e.name) ? e.name.text : '?'
        if (istVerboten(name)) funde.push(`dynamisch Name ${name}`)
      }
    }
    if (ts.isCallExpression(k) && ts.isIdentifier(k.expression) && k.expression.text === 'require') funde.push('require')
    if (ts.isIdentifier(k) && istVerboten(k.text)) funde.push(`Bezeichner ${k.text}`)
  })
  return [...new Set(funde)].sort()
}

/** Regel 2: die Action und die Funktionen derselben Datei, die sie ruft. */
function pruefeAction(quelle: string, name: string): string[] {
  const datei = baum(quelle)
  const funktionen = new Map<string, ts.FunctionDeclaration>()
  for (const s of datei.statements) if (ts.isFunctionDeclaration(s) && s.name) funktionen.set(s.name.text, s)
  const action = funktionen.get(name)
  if (!action?.body) return [`${name} fehlt`]
  const funde: string[] = []
  const erste = action.body.statements[0]
  const wacheText = erste ? erste.getText(datei).replace(/\s+/g, ' ') : ''
  if (!/await verlangeAdminAktion\(\{ recht: 'ansehen' \}\)/.test(wacheText)) funde.push('Wache nicht zuerst')
  const gesehen = new Set<string>()
  const pruefe = (fn: ts.FunctionDeclaration): void => {
    if (!fn.name || gesehen.has(fn.name.text) || !fn.body) return
    gesehen.add(fn.name.text)
    besuche(fn.body, (k) => {
      if (ts.isIdentifier(k)) {
        if (istVerboten(k.text)) funde.push(`${fn.name?.text}: ${k.text}`)
        const lokal = funktionen.get(k.text)
        if (lokal) pruefe(lokal)
      }
      if (ts.isCallExpression(k) && k.expression.kind === ts.SyntaxKind.ImportKeyword) funde.push(`${fn.name?.text}: dynamischer Import`)
    })
  }
  pruefe(action)
  return [...new Set(funde)]
}

/** Die Inhalts-Funktionen aus Nr. 270 und die `send…`-Funktion, die sie ruft. */
const INHALTE: Record<string, string> = {
  anmeldecodeInhalt: 'sendAnmeldeCodeEmail',
  bestellcodeInhalt: 'sendBestellCodeEmail',
  emailBestaetigungInhalt: 'sendEmailBestaetigung',
  registrierungsHinweisInhalt: 'sendRegistrierungsHinweis',
  passwortLinkInhalt: 'sendPasswordResetEmail',
  zuVieleVersucheInhalt: 'sendZuVieleVersucheEmail',
  neueAnmeldungInhalt: 'sendNeueAnmeldungEmail',
  adminSicherheitInhalt: 'sendAdminSicherheitEmail',
  emailAendernLinkInhalt: 'sendEmailAendernLink',
  emailGeaendertHinweisInhalt: 'sendEmailGeaendertHinweis',
  teamRechtGeaendertInhalt: 'sendTeamRechtGeaendert',
  betreiberBestaetigungInhalt: 'sendBetreiberBestaetigung',
  betriebWarnungInhalt: 'sendBetriebWarnung',
}
const EMPFAENGER = new Set(['email', 'an', 'to', 'empfaenger', 'adresse'])
const LOG_ODER_VERSAND = new Set(['console', 'Sentry', 'sendRaw', 'send', 'sendeAnListe', 'protokolliere', 'versendeStapel', 'inhaltOderFehler'])

/** Regel 3 an einer Quelle von email.ts. */
function pruefeInhalte(quelle: string): string[] {
  const datei = baum(quelle)
  const funktionen = new Map<string, ts.FunctionDeclaration>()
  for (const s of datei.statements) if (ts.isFunctionDeclaration(s) && s.name) funktionen.set(s.name.text, s)
  const funde: string[] = []
  for (const [inhalt, versand] of Object.entries(INHALTE)) {
    const fn = funktionen.get(inhalt)
    if (!fn?.body) {
      funde.push(`${inhalt} fehlt`)
      continue
    }
    if (fn.parameters.length !== 1) funde.push(`${inhalt}: ${fn.parameters.length} Parameter`)
    for (const p of fn.parameters) {
      if (ts.isIdentifier(p.name) && EMPFAENGER.has(p.name.text)) funde.push(`${inhalt}: Empfänger ${p.name.text}`)
      if (p.type && ts.isTypeLiteralNode(p.type))
        for (const m of p.type.members) if (m.name && ts.isIdentifier(m.name) && EMPFAENGER.has(m.name.text)) funde.push(`${inhalt}: Empfänger ${m.name.text}`)
    }
    besuche(fn.body, (k) => {
      if (ts.isIdentifier(k) && LOG_ODER_VERSAND.has(k.text)) funde.push(`${inhalt}: ${k.text}`)
    })
    const sender = funktionen.get(versand)
    let ruft = false
    if (sender?.body) besuche(sender.body, (k) => {
      if (ts.isCallExpression(k) && ts.isIdentifier(k.expression) && k.expression.text === inhalt) ruft = true
    })
    if (!ruft) funde.push(`${versand} ruft ${inhalt} nicht`)
  }
  return [...new Set(funde)]
}

/** Die Namen, die beispiele.ts per `const { … } = await import('@/lib/email')` holt. */
function namenAusEmail(quelle: string): string[] {
  const namen = new Set<string>()
  besuche(baum(quelle), (k) => {
    if (!ts.isCallExpression(k) || k.expression.kind !== ts.SyntaxKind.ImportKeyword) return
    const ziel = k.arguments[0]
    if (!ziel || !ts.isStringLiteral(ziel) || ziel.text !== '@/lib/email') return
    const deklaration = ts.isAwaitExpression(k.parent) && ts.isVariableDeclaration(k.parent.parent) ? k.parent.parent : null
    if (deklaration && ts.isObjectBindingPattern(deklaration.name))
      for (const e of deklaration.name.elements) {
        const name = e.propertyName && ts.isIdentifier(e.propertyName) ? e.propertyName.text : ts.isIdentifier(e.name) ? e.name.text : null
        if (name) namen.add(name)
      }
  })
  return [...namen].sort()
}

/** Regel 4: jede dieser Funktionen in email.ts — samt jeder Hilfe derselben Datei, die sie ruft — loggt und verschickt nie. */
function pruefeBaufunktionen(beispiele: string, emailQuelle: string): string[] {
  const datei = baum(emailQuelle)
  const funktionen = new Map<string, ts.FunctionDeclaration>()
  for (const s of datei.statements) if (ts.isFunctionDeclaration(s) && s.name) funktionen.set(s.name.text, s)
  const funde: string[] = []
  for (const name of namenAusEmail(beispiele)) {
    const fn = funktionen.get(name)
    if (!fn?.body) {
      funde.push(`${name} fehlt`)
      continue
    }
    const gesehen = new Set<string>()
    const pruefe = (f: ts.FunctionDeclaration): void => {
      if (!f.name || gesehen.has(f.name.text) || !f.body) return
      gesehen.add(f.name.text)
      besuche(f.body, (k) => {
        if (!ts.isIdentifier(k)) return
        if (LOG_ODER_VERSAND.has(k.text)) funde.push(`${name}: ${k.text}`)
        const lokal = funktionen.get(k.text)
        if (lokal) pruefe(lokal)
      })
    }
    pruefe(fn)
  }
  return [...new Set(funde)].sort()
}

describe('Beispiele verschicken, speichern und protokollieren nie', () => {
  it('beispiele.ts: keine verbotenen Module, Namen oder ungeteilten Importe', () => {
    expect(pruefeBeispiele(lies('src/server/mail-arten/beispiele.ts'))).toEqual([])
  })

  it('Gegenprobe beispiele.ts: jeder Leckweg wird gefunden', () => {
    expect(pruefeBeispiele(`import { prisma } from '@/lib/prisma'`)).toEqual(['Bezeichner prisma', 'Modul @/lib/prisma', 'Name prisma'])
    expect(pruefeBeispiele(`import * as email from '@/lib/email'`)).toEqual(['ganzes Modul @/lib/email'])
    expect(pruefeBeispiele(`import { sendRaw as s } from '@/lib/email'`)).toEqual(['Bezeichner sendRaw', 'Name sendRaw'])
    expect(pruefeBeispiele(`async function f() { const { sendAnmeldeCodeEmail } = await import('@/lib/email') }`)).toEqual(['Bezeichner sendAnmeldeCodeEmail', 'dynamisch Name sendAnmeldeCodeEmail'])
    expect(pruefeBeispiele(`async function f() { const m = await import('@/lib/email'); m.versendeStapel([], 'x') }`)).toEqual(['Bezeichner versendeStapel', 'dynamisch ungeteilt @/lib/email'])
    expect(pruefeBeispiele(`async function f() { const { stelleEinOhneRisiko } = await import('@/server/mail-warteschlange') }`)).toEqual([
      'Bezeichner stelleEinOhneRisiko',
      'dynamisch @/server/mail-warteschlange',
      'dynamisch Name stelleEinOhneRisiko',
    ])
    expect(pruefeBeispiele(`function f(html: string) { console.log(html) }`)).toEqual(['Bezeichner console'])
    expect(pruefeBeispiele(`import { protokolliere } from '@/server/admin-protokoll'`)).toEqual(['Bezeichner protokolliere', 'Modul @/server/admin-protokoll', 'Name protokolliere'])
  })

  it('Gegenprobe beispiele.ts: Weiterreichen und require werden gefunden', () => {
    expect(pruefeBeispiele(`export { sendRaw } from '@/lib/email'`)).toEqual(['Bezeichner sendRaw', 'Name sendRaw'])
    expect(pruefeBeispiele(`export * from '@/lib/prisma'`)).toEqual(['Modul @/lib/prisma', 'ganzes Modul @/lib/prisma'])
    expect(pruefeBeispiele(`const m = require('@/lib/email')`)).toEqual(['require'])
  })

  it('Baufunktionen, die beispiele.ts aus email.ts holt: loggen und verschicken nie, auch nicht über eine Hilfe', () => {
    const beispiele = lies('src/server/mail-arten/beispiele.ts')
    expect(namenAusEmail(beispiele).length).toBeGreaterThan(20)
    expect(pruefeBaufunktionen(beispiele, lies('src/lib/email.ts'))).toEqual([])
  })

  it('Gegenprobe Baufunktionen: ein Log in der Funktion und ein Versand in einer Hilfe werden gefunden', () => {
    const beispiele = lies('src/server/mail-arten/beispiele.ts')
    const echt = lies('src/lib/email.ts')
    const mitLog = echt.replace('export async function baueBetreiberTestmail(an: string): Promise<StapelMail> {', 'export async function baueBetreiberTestmail(an: string): Promise<StapelMail> {\n  console.log(an)')
    expect(pruefeBaufunktionen(beispiele, mitLog)).toEqual(['baueBetreiberTestmail: console'])
    const hilfeSchickt = echt.replace('async function toHtml(element: React.ReactElement): Promise<string> {', 'async function toHtml(element: React.ReactElement): Promise<string> {\n  await sendRaw(\'x@example.com\', \'x\', \'x\', { art: \'testmail\' })')
    // Über die Hilfe toHtml erreicht jede Funktion den Versand — und mit ihm sendRaw selbst (Log, Protokoll).
    const funde = pruefeBaufunktionen(beispiele, hilfeSchickt)
    for (const name of namenAusEmail(beispiele)) expect(funde, name).toContain(`${name}: sendRaw`)
    expect(mitLog).not.toBe(echt)
    expect(hilfeSchickt).not.toBe(echt)
  })

  it('zeigeMailBeispielAction: Wache zuerst, kein Versand, kein Protokoll, keine Datenbank, kein Log', () => {
    expect(pruefeAction(lies('src/server/actions/betrieb.ts'), 'zeigeMailBeispielAction')).toEqual([])
  })

  it('Gegenprobe Action: ein Aufruf mit Datenbank, Protokoll oder Versand — auch über eine Hilfe derselben Datei — und eine späte Wache werden gefunden', () => {
    const mitHilfe = `
      function hilfe() { return prisma.mailAuftrag.count() }
      export async function a(e: unknown) { const wache = await verlangeAdminAktion({ recht: 'ansehen' }); await hilfe() }`
    expect(pruefeAction(mitHilfe, 'a')).toEqual(['hilfe: prisma'])
    const spaet = `export async function a(e: unknown) { const x = 1; const wache = await verlangeAdminAktion({ recht: 'ansehen' }); await protokolliere({}); await stelleMailEin([]) }`
    expect(pruefeAction(spaet, 'a')).toEqual(['Wache nicht zuerst', 'a: protokolliere', 'a: stelleMailEin'])
    const dynamisch = `export async function a() { const wache = await verlangeAdminAktion({ recht: 'ansehen' }); const { sendRaw } = await import('@/lib/email') }`
    expect(pruefeAction(dynamisch, 'a')).toEqual(['a: sendRaw', 'a: dynamischer Import'])
  })

  it('Inhalts-Funktionen in email.ts: ein Parameter ohne Empfänger, kein Log, kein Versand, ihre send…-Funktion ruft sie', () => {
    expect(pruefeInhalte(lies('src/lib/email.ts'))).toEqual([])
  })

  it('Gegenprobe Inhalts-Funktionen: Empfänger, Log und Versand werden gefunden', () => {
    const echt = lies('src/lib/email.ts')
    const mitEmpfaenger = echt.replace('export async function anmeldecodeInhalt(daten: { code: string })', 'export async function anmeldecodeInhalt(daten: { code: string; an: string })')
    expect(pruefeInhalte(mitEmpfaenger)).toEqual(['anmeldecodeInhalt: Empfänger an'])
    const mitLog = echt.replace("return { betreff: `Dein Anmeldecode für ${MARKE}`, html }", "console.log(html)\n  return { betreff: `Dein Anmeldecode für ${MARKE}`, html }")
    expect(pruefeInhalte(mitLog)).toEqual(['anmeldecodeInhalt: console'])
    const ohneRuf = echt.replace('inhaltOderFehler(() => bestellcodeInhalt({ code }))', 'inhaltOderFehler(() => anmeldecodeInhalt({ code }))')
    expect(pruefeInhalte(ohneRuf)).toEqual(['sendBestellCodeEmail ruft bestellcodeInhalt nicht'])
    expect(mitEmpfaenger).not.toBe(echt)
    expect(mitLog).not.toBe(echt)
    expect(ohneRuf).not.toBe(echt)
  })
})
