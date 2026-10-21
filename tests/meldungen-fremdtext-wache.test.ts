/**
 * Wache „kein Meldungstext in Sentry oder in einer Server-Log-Zeile"
 * (Register N14, Ergänzung; Nachtlauf Nr. 101; CLAUDE.md „Fremdtext").
 *
 * Meldungstexte, Antworten, Notizen und Adressen sind Fremdtext bzw.
 * Personendaten: Sie gehen nie an `console.*` und nie an `Sentry.*` — nur
 * Kennungen, Zahlen und feste Wörter. Die Wache liest die Dateien des
 * Meldungswegs mit dem Parser von TypeScript und sucht in den Argumenten
 * jedes solchen Aufrufs nach den Namen der Felder, die Fremdtext tragen.
 * Gegenproben: Ein Aufruf mit Text, Antwort oder Adresse schlägt an, ein
 * Aufruf mit Kennung und Zahl nicht.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()

/** Felder und Namen, die Fremdtext oder eine Adresse tragen. */
const FREMDTEXT = new Set(['text', 'ersteZeile', 'antwort', 'antwortAnMelder', 'triageNotiz', 'customerEmail', 'grund', 'adressen', 'kundinnen', 'wort'])

const DATEIEN = [
  'src/lib/meldung.ts',
  'src/server/actions/admin.ts',
  'src/server/queries/meldung.ts',
  // Seit Nr. 105 (Nacharbeit 101): der Weg der Meldung herein und die Schreibroute.
  'src/server/actions/meldung.ts',
  'src/app/api/triage/status/route.ts',
  'src/app/api/cron/briefkasten/route.ts',
  'src/app/admin/meldungen/route.ts',
  'src/app/admin/meldungen/[id]/route.ts',
  'src/app/admin/postfach/page.tsx',
  'src/app/admin/postfach/meldungen-reiter.tsx',
  'src/components/admin/briefkasten-teile.tsx',
  // Seit Nr. 125 (G8): CSP-Meldungen sind Fremdtext des Browsers; an Sentry gehen nur Anweisung,
  // Host und gekürzter Pfad, nie Ausschnitt, Referrer oder Query.
  'src/lib/csp.ts',
  'src/app/api/csp-bericht/route.ts',
  ...readdirSync(join(WURZEL, 'src/components/admin'))
    .filter((n) => n.startsWith('meldungen-'))
    .map((n) => `src/components/admin/${n}`),
]

/**
 * Begründete Ausnahmen je Datei: ein Name, der dort nachweislich keinen
 * Fremdtext trägt. Jede mit Grund; ein anderer Name in derselben Datei schlägt
 * weiter an (Gegenprobe unten).
 */
const AUSNAHMEN: readonly { datei: string; name: string; warum: string }[] = [
  {
    datei: 'src/server/actions/meldung.ts',
    name: 'grund',
    warum: 'der Grund einer stillen Abweisung ist ein festes Wort (Honigtopf, Zeitschranke/…), kein Text der Meldung — und nur außerhalb der Produktion',
  },
]

/** Alle Aufrufe von console.* und Sentry.*, deren Argumente einen Fremdtext-Namen enthalten. */
function fremdtextInProtokoll(quelltext: string, pfad: string): string[] {
  const ausgenommen = new Set(AUSNAHMEN.filter((a) => a.datei === pfad).map((a) => a.name))
  const datei = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, pfad.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const funde: string[] = []
  const namenIn = (knoten: ts.Node, namen: string[]): void => {
    if (ts.isIdentifier(knoten)) namen.push(knoten.text)
    ts.forEachChild(knoten, (k) => namenIn(k, namen))
  }
  const besuche = (knoten: ts.Node): void => {
    if (ts.isCallExpression(knoten) && ts.isPropertyAccessExpression(knoten.expression) && ts.isIdentifier(knoten.expression.expression)) {
      const ziel = knoten.expression.expression.text
      if (ziel === 'console' || ziel === 'Sentry') {
        const namen: string[] = []
        for (const arg of knoten.arguments) namenIn(arg, namen)
        const treffer = namen.filter((n) => FREMDTEXT.has(n) && !ausgenommen.has(n))
        if (treffer.length > 0) {
          const zeile = datei.getLineAndCharacterOfPosition(knoten.getStart()).line + 1
          funde.push(`${pfad}:${zeile} ${ziel}.${knoten.expression.name.text}(… ${treffer.join(', ')} …)`)
        }
      }
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return funde
}

describe('Wache: kein Meldungstext in Sentry oder in einer Server-Log-Zeile', () => {
  it('liest die Dateien des Meldungswegs — mindestens die drei Teile des Reiters', () => {
    expect(DATEIEN.filter((d) => d.includes('/meldungen-')).length).toBeGreaterThanOrEqual(4)
  })

  it('kein console.*- oder Sentry.*-Aufruf reicht Text, Antwort, Notiz oder Adresse weiter', () => {
    const funde = DATEIEN.flatMap((d) => fremdtextInProtokoll(readFileSync(join(WURZEL, d), 'utf8'), relative(WURZEL, join(WURZEL, d))))
    expect(funde).toEqual([])
  })

  it('Gegenprobe: eine Ausnahme gilt nur für ihren Namen in ihrer Datei', () => {
    expect(fremdtextInProtokoll('console.log(grund)', 'src/server/actions/meldung.ts')).toEqual([])
    expect(fremdtextInProtokoll('console.log(grund, m.text)', 'src/server/actions/meldung.ts')).toHaveLength(1)
    expect(fremdtextInProtokoll('console.log(grund)', 'src/server/actions/admin.ts')).toHaveLength(1)
  })

  it('Gegenprobe: Text, Antwort und Adresse schlagen an — als Variable, Feld und Kurzschreibweise', () => {
    expect(fremdtextInProtokoll('console.log(`neu: ${meldung.text}`)', 'a.ts')).toHaveLength(1)
    expect(fremdtextInProtokoll('Sentry.captureException(err, { extra: { antwort } })', 'b.ts')).toHaveLength(1)
    expect(fremdtextInProtokoll('console.error("an", m.customerEmail)', 'c.ts')).toHaveLength(1)
    expect(fremdtextInProtokoll('Sentry.addBreadcrumb({ message: ersteZeile(m.text) })', 'd.ts')).toHaveLength(1)
  })

  it('Gegenprobe: Kennung, Status und Zahlen gehen durch', () => {
    expect(fremdtextInProtokoll('console.log(`meldung=${meldungId} status=${triage.status}`)', 'e.ts')).toEqual([])
    expect(fremdtextInProtokoll("Sentry.captureException(fehler, { tags: { bereich: 'meldungen' }, extra: { gescheitert } })", 'f.ts')).toEqual([])
  })
})
