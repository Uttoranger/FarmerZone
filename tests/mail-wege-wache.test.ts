/**
 * Mail-Wege-Wache (Register N26, Nr. 159; Regelvorschlag 149).
 *
 * Ursache: Bis Nr. 158 schickte jede Action ihre Mails selbst — einzeln, an die
 * Anfrage gebunden, Beiträge und Rundschreiben in einer Schleife über alle
 * Empfänger. Seit Nr. 159 hat jede Art genau einen Weg (`MAIL_WEG`): Sofort
 * (Code, Einmal-Link, Bestätigungslink — direkt über sendRaw, nur Protokoll),
 * Wichtig oder Kann warten (Auftrag der Warteschlange, der Renderer baut die
 * Mail beim Versand). Eine neue `send…`-Funktion oder eine Schleife über den
 * Versand fiele sonst nicht auf.
 *
 * Beweist (Quelltext, TypeScript-Syntaxbaum, keine Datenbank):
 *  1. Jede exportierte `send…`- und `baue…`-Funktion in src/lib/email.ts (außer
 *     sendRaw, dem Versand selbst) steht
 *     in genau einer der Listen SOFORT, WICHTIG oder KANN_WARTEN, und jeder
 *     Eintrag gibt es dort; ihre Art hat in `MAIL_WEG` denselben Weg.
 *  2. Eine Sofort-Funktion verschickt selbst (sendRaw/send mit genau ihrer Art
 *     als Text); eine Wichtig- oder Kann-warten-Funktion verschickt nie selbst
 *     (kein sendRaw, send, sendeAnListe).
 *  3. `RENDERER` hat genau für die Arten mit Weg Wichtig oder Kann warten einen
 *     Eintrag, für keine Sofort-Art.
 *  4. Unter src/server und src/app steht kein Aufruf von sendRaw oder einer
 *     `send…`-Funktion aus email.ts in einer Schleife (for, while, do,
 *     forEach/map/flatMap/reduce/some/every mit Funktion).
 *
 * Gegenprobe (Quelltext im Speicher, keine Datei wird verändert): eine
 * zusätzliche `sendNeu`-Funktion, eine Wichtig-Funktion mit sendRaw und eine
 * Sofort-Funktion mit fremder Art schlagen an; eine Schleife mit sendRaw, mit
 * `(await import('@/lib/email')).sendX` und ein `.map` mit Versand werden
 * gefunden, `stelleMailEin` in einer Schleife und sendRaw außerhalb nicht.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { MAIL_ARTEN, MAIL_WEG, type MailArt } from '@/schemas/mail-auftrag'
import { RENDERER } from '@/server/mail-arten'

const WURZEL = process.cwd()
const EMAIL_TS = join(WURZEL, 'src', 'lib', 'email.ts')

/** Sofort: direkt über sendRaw, nur Protokoll — ein Token oder Code wird nie gespeichert. */
const SOFORT: Record<string, MailArt> = {
  sendAnmeldeCodeEmail: 'anmeldecode',
  sendBestellCodeEmail: 'bestellcode',
  sendEmailBestaetigung: 'email-bestaetigung',
  sendRegistrierungsHinweis: 'registrierungs-hinweis',
  sendPasswordResetEmail: 'passwort-link',
  sendZuVieleVersucheEmail: 'zu-viele-versuche',
  sendNeueAnmeldungEmail: 'neue-anmeldung',
  sendAdminSicherheitEmail: 'admin-sicherheit',
  sendEmailAendernLink: 'email-aendern-link',
  sendEmailGeaendertHinweis: 'email-geaendert-hinweis',
  sendTeamRechtGeaendert: 'team-recht-geaendert',
  sendOnsiteConfirmation: 'bar-bestaetigungslink',
  sendBetreiberBestaetigung: 'betreiber-bestaetigung',
  sendBetriebWarnung: 'betrieb-warnung',
}

/** Wichtig: Bestellungen, Höfe, Betreiber — die Funktion baut nur, der Worker verschickt. */
const WICHTIG: Record<string, MailArt> = {
  baueOrderConfirmation: 'bestellung-bestaetigung',
  baueOrderPaidToFarmer: 'bestellung-bezahlt-hof',
  baueOrderConfirmedToFarmer: 'bar-bestaetigt-hof',
  baueOrderReady: 'abholbereit',
  baueOrderNotReady: 'nicht-abholbereit',
  baueOrderCancelled: 'storniert',
  baueArtikelFehlt: 'artikel-fehlt',
  baueBestellungVerfallen: 'verfallen',
  baueZahlungZuSpaet: 'zahlung-zu-spaet',
  baueErstattungOffen: 'erstattung-offen',
  baueNewFarmNotification: 'neuer-hof',
  baueFreischaltungEmail: 'freischaltung',
  baueMeldungNotification: 'meldung',
  baueBriefkastenZusammenfassung: 'wochenbericht',
  bauePostfachMail: 'postfach',
  baueHofAntwortAnTeam: 'antwort-an-team',
  baueBetreiberTestmail: 'betreiber-testmail',
  baueAboBestaetigung: 'abo-bestaetigung',
  bauePlattformgebuehrAnkuendigung: 'plattformgebuehr-ankuendigung',
  baueLastschriftGescheitert: 'lastschrift-gescheitert',
}

/** Kann warten: Beiträge, Rundschreiben, Bescheide. `bauePostfachMail` baut auch das Rundschreiben (Art je Aufruf). */
const KANN_WARTEN: Record<string, MailArt> = {
  baueBeitragMail: 'beitrag',
  baueBescheidMail: 'bescheid',
}

/** Arten ohne eigene Funktion in email.ts — mit Grund. */
const OHNE_EIGENE_FUNKTION: Record<string, string> = {
  testmail: 'Die Testmail (/api/test-email) ruft sendRaw selbst mit ihrer Art.',
  rundschreiben: 'bauePostfachMail baut Rundschreiben und Antwort; die Art wählt der Renderer.',
  'login-link': 'Magic Links gibt es seit Nr. 178 nicht mehr (Plugin und Vorlage entfernt); die Art bleibt für alte Zeilen im Protokoll.',
}

const LISTEN = { sofort: SOFORT, wichtig: WICHTIG, kannWarten: KANN_WARTEN } as const

/** Die exportierten `send…`/`baue…`-Funktionen einer Quelle mit ihrem Rumpf. */
function versandFunktionen(quelle: string): Map<string, ts.FunctionDeclaration> {
  const datei = ts.createSourceFile('email.ts', quelle, ts.ScriptTarget.Latest, true)
  const gefunden = new Map<string, ts.FunctionDeclaration>()
  for (const knoten of datei.statements) {
    if (!ts.isFunctionDeclaration(knoten) || !knoten.name) continue
    const exportiert = knoten.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    if (exportiert && /^(send|baue)[A-Z]/.test(knoten.name.text)) gefunden.set(knoten.name.text, knoten)
  }
  return gefunden
}

/** Der Name eines Aufrufs: `sendRaw(…)` → sendRaw, `(await import(…)).sendX(…)` → sendX. */
function aufrufName(aufruf: ts.CallExpression): string | null {
  const ziel = aufruf.expression
  if (ts.isIdentifier(ziel)) return ziel.text
  if (ts.isPropertyAccessExpression(ziel)) return ziel.name.text
  return null
}

function alleAufrufe(knoten: ts.Node): ts.CallExpression[] {
  const aufrufe: ts.CallExpression[] = []
  const besuche = (k: ts.Node): void => {
    if (ts.isCallExpression(k)) aufrufe.push(k)
    ts.forEachChild(k, besuche)
  }
  besuche(knoten)
  return aufrufe
}

/** Die Texte, die als `art: '…'` im Rumpf stehen. */
function artTexte(knoten: ts.Node): string[] {
  const texte: string[] = []
  const besuche = (k: ts.Node): void => {
    if (ts.isPropertyAssignment(k) && ts.isIdentifier(k.name) && k.name.text === 'art' && ts.isStringLiteral(k.initializer)) texte.push(k.initializer.text)
    ts.forEachChild(k, besuche)
  }
  besuche(knoten)
  return texte
}

const VERSAND = new Set(['sendRaw', 'send', 'sendeAnListe'])

type Befund = string

/** Prüfung 1 und 2 an einer Quelle von email.ts. */
function pruefeEmailQuelle(quelle: string): Befund[] {
  const befunde: Befund[] = []
  const funktionen = versandFunktionen(quelle)
  for (const name of funktionen.keys()) {
    // sendRaw ist der Versand selbst, keine Mail-Art.
    if (name === 'sendRaw') continue
    const in_ = Object.entries(LISTEN).filter(([, liste]) => name in liste).map(([weg]) => weg)
    if (in_.length !== 1) befunde.push(`${name}: in ${in_.length} Listen`)
  }
  for (const [weg, liste] of Object.entries(LISTEN)) {
    for (const [name, art] of Object.entries(liste)) {
      const fn = funktionen.get(name)
      if (!fn?.body) {
        befunde.push(`${name}: fehlt in email.ts`)
        continue
      }
      if (MAIL_WEG[art] !== weg) befunde.push(`${name}: Art ${art} hat Weg ${MAIL_WEG[art]}, Liste ${weg}`)
      const versand = alleAufrufe(fn.body).filter((a) => VERSAND.has(aufrufName(a) ?? ''))
      if (weg === 'sofort') {
        // Die Art steht als `art: '…'` oder als Text-Argument des Versands (sendeAnListe(…, 'betrieb-warnung')).
        const arten = [
          ...artTexte(fn.body),
          ...versand.flatMap((a) => a.arguments.filter(ts.isStringLiteral).map((t) => t.text).filter((t) => (MAIL_ARTEN as readonly string[]).includes(t))),
        ]
        if (versand.length === 0) befunde.push(`${name}: Sofort, verschickt aber nicht selbst`)
        if (arten.length === 0 || arten.some((a) => a !== art)) befunde.push(`${name}: Art im Versand ${arten.join(',') || 'fehlt'}, erwartet ${art}`)
      } else if (versand.length > 0) {
        befunde.push(`${name}: ${weg}, verschickt aber selbst`)
      }
    }
  }
  return befunde
}

const SCHLEIFEN_METHODEN = new Set(['forEach', 'map', 'flatMap', 'reduce', 'some', 'every', 'filter'])

/** Prüfung 4: Versandaufrufe in einer Schleife — Zeilennummer und Name. */
function versandInSchleife(quelle: string, versandNamen: ReadonlySet<string>): string[] {
  const datei = ts.createSourceFile('x.ts', quelle, ts.ScriptTarget.Latest, true)
  const funde: string[] = []
  const besuche = (k: ts.Node, inSchleife: boolean): void => {
    let hier = inSchleife
    if (ts.isForStatement(k) || ts.isForOfStatement(k) || ts.isForInStatement(k) || ts.isWhileStatement(k) || ts.isDoStatement(k)) hier = true
    if (ts.isCallExpression(k)) {
      const name = aufrufName(k)
      if (inSchleife && name && versandNamen.has(name)) {
        funde.push(`${datei.getLineAndCharacterOfPosition(k.getStart()).line + 1}:${name}`)
      }
      if (name && SCHLEIFEN_METHODEN.has(name) && ts.isPropertyAccessExpression(k.expression)) {
        besuche(k.expression, inSchleife)
        for (const arg of k.arguments) besuche(arg, inSchleife || ts.isArrowFunction(arg) || ts.isFunctionExpression(arg))
        return
      }
    }
    ts.forEachChild(k, (kind) => besuche(kind, hier))
  }
  besuche(datei, false)
  return funde
}

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

const EMAIL_QUELLE = readFileSync(EMAIL_TS, 'utf8')
const VERSAND_NAMEN = new Set(['sendRaw', ...[...versandFunktionen(EMAIL_QUELLE).keys()].filter((n) => n.startsWith('send'))])

describe('Mail-Wege: jede Versandfunktion in genau einer Liste (N26, Nr. 159)', () => {
  it('jede send…/baue…-Funktion steht in genau einer Liste, mit dem Weg aus MAIL_WEG; Sofort verschickt selbst, die anderen nie', () => {
    expect(pruefeEmailQuelle(EMAIL_QUELLE)).toEqual([])
  })

  it('jede Art hat eine Funktion in einer Liste oder einen Grund ohne', () => {
    const mitFunktion = new Set(Object.values(LISTEN).flatMap((l) => Object.values(l)))
    const ohne = MAIL_ARTEN.filter((a) => !mitFunktion.has(a))
    expect(ohne.sort()).toEqual(Object.keys(OHNE_EIGENE_FUNKTION).sort())
  })

  it('RENDERER: genau die Arten Wichtig und Kann warten, keine Sofort-Art', () => {
    const erwartet = MAIL_ARTEN.filter((a) => MAIL_WEG[a] !== 'sofort').sort()
    expect(Object.keys(RENDERER).sort()).toEqual(erwartet)
  })

  it('unter src/server und src/app steht kein Versand in einer Schleife', () => {
    const funde: string[] = []
    for (const ordner of ['server', 'app']) {
      for (const pfad of quelldateien(join(WURZEL, 'src', ordner))) {
        for (const fund of versandInSchleife(readFileSync(pfad, 'utf8'), VERSAND_NAMEN)) funde.push(`${relative(WURZEL, pfad).split(sep).join('/')}:${fund}`)
      }
    }
    expect(funde).toEqual([])
  })
})

describe('Gegenprobe (Quelltext im Speicher)', () => {
  it('eine neue sendNeu-Funktion, Versand in einer Wichtig-Funktion und eine fremde Art in Sofort schlagen an', () => {
    const neu = `${EMAIL_QUELLE}\nexport async function sendNeu(an: string): Promise<void> { await send(an, 'x', 'y', { art: 'testmail' }) }\n`
    expect(pruefeEmailQuelle(neu)).toContain('sendNeu: in 0 Listen')

    const wichtigMitVersand = EMAIL_QUELLE.replace(
      'export async function baueOrderReady(order: OrderForEmail): Promise<StapelMail> {',
      "export async function baueOrderReady(order: OrderForEmail): Promise<StapelMail> {\n  await sendRaw(order.customerEmail, 'x', 'y', { art: 'abholbereit' })"
    )
    expect(wichtigMitVersand).not.toBe(EMAIL_QUELLE)
    expect(pruefeEmailQuelle(wichtigMitVersand)).toContain('baueOrderReady: wichtig, verschickt aber selbst')

    const fremdeArt = EMAIL_QUELLE.replace("{ art: 'passwort-link' }", "{ art: 'beitrag' }")
    expect(fremdeArt).not.toBe(EMAIL_QUELLE)
    expect(pruefeEmailQuelle(fremdeArt)).toContain('sendPasswordResetEmail: Art im Versand beitrag, erwartet passwort-link')
  })

  it('Schleifen mit Versand werden gefunden, stelleMailEin in der Schleife und Versand außerhalb nicht', () => {
    const namen = new Set(['sendRaw', 'sendOrderReady'])
    const quelle = [
      'async function a(liste: string[]) {',
      "  for (const an of liste) await sendRaw(an, 'x', 'y', { art: 'bescheid' })",
      '}',
      'async function b(liste: string[]) {',
      "  while (liste.length) { await (await import('@/lib/email')).sendOrderReady(liste.pop()) }",
      '}',
      'async function c(liste: string[]) {',
      "  await Promise.all(liste.map((an) => sendRaw(an, 'x', 'y', { art: 'bescheid' })))",
      '}',
      'async function d(liste: string[]) {',
      '  for (const an of liste) await stelleMailEin(an)',
      "  await sendRaw('a', 'x', 'y', { art: 'testmail' })",
      '}',
    ].join('\n')
    expect(versandInSchleife(quelle, namen)).toEqual(['2:sendRaw', '5:sendOrderReady', '8:sendRaw'])
  })
})
