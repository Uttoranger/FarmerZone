/**
 * Admin-Kürzel-Wache (Lauf 34, Nr. 303 Gruppe B; F047 „Verständlichkeit“).
 *
 * Regel: Ein Admin-Text sagt, was ein Eingriff bewirkt — ohne Kürzel aus dem
 * Register („Register K2“, „(K1)“) und ohne Technikwörter („Deployment“,
 * „Destination Charges“, „Webhook“). Die Person am Admin ist keine Entwicklerin.
 *
 * Beweist für die Dateien, die Nr. 303 Gruppe B geändert hat (feste Liste, kein
 * readdirSync): Keine Zeichenkette, keine Vorlage (auch nicht ein Teil zwischen
 * zwei Platzhaltern) und kein JSX-Text enthält eines der Muster. „Webhook“ steht
 * nur im Objekt `TABELLEN_NAME` in src/lib/betrieb.ts (der Name der Tabelle
 * `WebhookEvent`). Geprüft wird der Syntaxbaum von TypeScript: Kommentare zählen
 * nicht. Keine Bestandsliste — die Dateien sind sauber.
 *
 * Gegenprobe im Speicher: Schnipsel mit jedem Muster in jeder Schreibweise schlagen
 * an (Zeichenkette, Vorlage, JSX-Text, Attribut), Kommentare und Bezeichner nicht,
 * „Webhook“ in TABELLEN_NAME nur in betrieb.ts.
 *
 * Weitere Fundstellen außerhalb dieser Dateien (src/app/admin/betrieb/dienste.ts,
 * src/lib/admin-aufgaben.ts) stehen im Bericht 303 als Nacharbeit.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()

/** Die Dateien, die Nr. 303 Gruppe B geändert hat — fest, damit die Wache nicht still mitwächst oder schrumpft. */
const DATEIEN = [
  'src/lib/plattform-einstellung.ts',
  'src/components/admin/einstellungen-gruppen.tsx',
  'src/lib/admin-hoefe-seite.ts',
  'src/lib/gruendungshof.ts',
  'src/app/admin/geld/texte.ts',
  'src/lib/finanzen.ts',
  'src/lib/admin-navigation.ts',
  'src/lib/meldung.ts',
  'src/lib/betrieb.ts',
  'src/components/admin/hof-aktion-dialog.tsx',
  'src/components/admin/hof-akte-ansicht.tsx',
  'src/components/admin/hof-akte-plattformgebuehr.tsx',
  'src/app/admin/einstellungen/hofpreis-stichtag.tsx',
  // Nr. 304 Punkt 5: Der Termin „Plattformgebühr im Hofpreis (Register N38)“ in „Kommt“ ist weg — die Datei ist sauber.
  'src/lib/admin-aufgaben.ts',
] as const

const MUSTER: { name: string; muster: RegExp }[] = [
  { name: 'Register-Kürzel', muster: /Register [A-Z]\d/ },
  { name: 'Kürzel in Klammern', muster: /\(K\d+\)/ },
  { name: 'Deployment', muster: /Deployment/i },
  { name: 'Destination Charges', muster: /Destination Charges/i },
  { name: 'Webhook', muster: /Webhook/i },
]

/** Wo „Webhook“ stehen darf: der Name der Tabelle `WebhookEvent` im Objekt TABELLEN_NAME (Admin › Betrieb, Speicher). */
const WEBHOOK_ERLAUBT = { datei: 'src/lib/betrieb.ts', objekt: 'TABELLEN_NAME' }

/** Liegt der Knoten in der Initialisierung der Konstante `name`? */
function inKonstante(knoten: ts.Node, name: string): boolean {
  for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) {
    if (ts.isVariableDeclaration(k) && ts.isIdentifier(k.name) && k.name.text === name) return true
  }
  return false
}

/** Alle Texte im Quelltext, die eine Person lesen kann: `Zeile Muster: Text`. Leer = in Ordnung. */
export function findeKuerzel(quelltext: string, datei: string): string[] {
  const quelle = ts.createSourceFile('schnipsel.tsx', quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const funde: string[] = []
  function besuche(knoten: ts.Node): void {
    const text =
      ts.isStringLiteral(knoten) || ts.isNoSubstitutionTemplateLiteral(knoten) || ts.isTemplateHead(knoten) || ts.isTemplateMiddle(knoten) || ts.isTemplateTail(knoten)
        ? knoten.text
        : ts.isJsxText(knoten)
          ? knoten.text
          : null
    if (text !== null) {
      for (const { name, muster } of MUSTER) {
        if (!muster.test(text)) continue
        if (name === 'Webhook' && datei === WEBHOOK_ERLAUBT.datei && inKonstante(knoten, WEBHOOK_ERLAUBT.objekt)) continue
        funde.push(`${quelle.getLineAndCharacterOfPosition(knoten.getStart()).line + 1} ${name}: ${text.trim()}`)
      }
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(quelle)
  return funde
}

describe('Gegenprobe im Speicher', () => {
  const ohneZeile = (funde: string[]): string[] => funde.map((f) => f.slice(f.indexOf(' ') + 1))

  it('jedes Muster schlägt an — als Zeichenkette, Vorlage, Teil einer Vorlage, JSX-Text und Attribut', () => {
    expect(ohneZeile(findeKuerzel(`const a = { register: 'Register K2' }`, 'x.ts'))).toEqual(['Register-Kürzel: Register K2'])
    expect(ohneZeile(findeKuerzel('const b = `Name stehen im Code (Register M1).`', 'x.ts'))).toEqual(['Register-Kürzel: Name stehen im Code (Register M1).'])
    expect(ohneZeile(findeKuerzel("const c = 'Nötig, weil er einen Platz hält (K1).'", 'x.ts'))).toEqual(['Kürzel in Klammern: Nötig, weil er einen Platz hält (K1).'])
    expect(ohneZeile(findeKuerzel('const d = `trägt ${m} (Destination Charges)`', 'x.ts'))).toEqual(['Destination Charges: (Destination Charges)'])
    expect(ohneZeile(findeKuerzel('const e = `${a} setzt das Deployment ${b} nie.`', 'x.ts'))).toEqual(['Deployment: setzt das Deployment'])
    expect(ohneZeile(findeKuerzel('const f = <p>Alte Webhook-Ereignisse</p>', 'x.tsx'))).toEqual(['Webhook: Alte Webhook-Ereignisse'])
    expect(ohneZeile(findeKuerzel('const g = <Chip titel="Register K2" />', 'x.tsx'))).toEqual(['Register-Kürzel: Register K2'])
  })

  it('Kommentare, Bezeichner und Schlüssel zählen nicht', () => {
    expect(findeKuerzel(`// 'Register K2' (K1) Deployment\n/* Webhook */\nconst webhookDeployment = 1`, 'x.ts')).toEqual([])
    expect(findeKuerzel(`const t = { WebhookEvent: '30 Tage' }`, 'x.ts')).toEqual([])
  })

  it('„Webhook“ in TABELLEN_NAME nur in betrieb.ts; daneben schlägt es auch dort an', () => {
    const schnipsel = `const TABELLEN_NAME = { WebhookEvent: 'Webhook-Ereignisse' }\nconst zweck = 'alte Webhook-Ereignisse'`
    expect(ohneZeile(findeKuerzel(schnipsel, 'src/lib/betrieb.ts'))).toEqual(['Webhook: alte Webhook-Ereignisse'])
    expect(ohneZeile(findeKuerzel(schnipsel, 'src/lib/meldung.ts'))).toEqual(['Webhook: Webhook-Ereignisse', 'Webhook: alte Webhook-Ereignisse'])
  })
})

describe('Admin-Texte der Gruppe B ohne Kürzel und Technikwörter', () => {
  it.each(DATEIEN)('%s', (datei) => {
    expect(findeKuerzel(readFileSync(join(WURZEL, datei), 'utf8'), datei)).toEqual([])
  })

  it('TABELLEN_NAME nennt die Tabelle WebhookEvent weiter (sonst wäre die Ausnahme leer)', () => {
    const betrieb = readFileSync(join(WURZEL, WEBHOOK_ERLAUBT.datei), 'utf8')
    expect(betrieb).toMatch(/const TABELLEN_NAME[^]*?WebhookEvent: 'Webhook-Ereignisse'/)
  })
})
