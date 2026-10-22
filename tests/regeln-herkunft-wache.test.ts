/**
 * Wache: Ein Satz in den Regeldateien, den Nr. 141 geschärft, erweitert oder neu geschrieben hat, trägt
 * seine Herkunft (Register G4: „Neue Regeln tragen weiter Herkunft und Datum“; Freigabe 141, Grundsatz;
 * Nachbesserung Runde 1 der Nr. 141).
 *
 * Ursache: Beim Kürzen und Schärfen bekam Zeile 34 von CODING_STANDARDS.md ihren Vermerk, die Zeile darunter
 * (`!` nur mit Begründung) nicht — niemand merkte es, bis der Prüfer die Zeilen einzeln las. Gegenmaßnahme
 * (Prüfung vor Textregel): jeder geschärfte Satz steht mit einem Anker aus seinem Wortlaut und der Nummer, die
 * er im Vermerk tragen muss, in der Liste unten.
 *
 * Beweist:
 *  - Die Einheit (Listenpunkt, Absatz oder Tabellenzeile), in der der Anker steht, nennt die erwartete Herkunft
 *    (z. B. „Inventur 7“) und ein Datum („21.10.2026“ bzw. „22.10.2026“).
 *  - Jeder Anker kommt genau einmal vor (ein umformulierter Satz fällt als „nicht gefunden“ auf, statt still
 *    aus der Prüfung zu fallen).
 *  - Gegenprobe: Eine Einheit ohne Vermerk wird gefunden, eine mit Vermerk nicht.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const WURZEL = process.cwd()

type Erwartung = { datei: string; anker: string; herkunft: string }

/** Geschärfte, erweiterte oder neue Sätze aus Nr. 141; neue Einträge kommen bei jeder Schärfung dazu. */
const GESCHAERFT: ReadonlyArray<Erwartung> = [
  { datei: 'docs/ai/CODING_STANDARDS.md', anker: 'Der Rückgabetyp ist **Pflicht**', herkunft: 'Inventur 7' },
  { datei: 'docs/ai/CODING_STANDARDS.md', anker: 'Keine nicht-null-Assertion `!`', herkunft: 'Inventur 7' },
  { datei: 'docs/ai/CODING_STANDARDS.md', anker: '| Funktion | `camelCase`', herkunft: 'Inventur 12' },
  { datei: 'docs/ai/TESTING_GUIDELINES.md', anker: 'Keine weiteren Unterordner, kein `.spec.ts`', herkunft: 'Inventur 14' },
  { datei: 'docs/ai/TESTING_GUIDELINES.md', anker: '**Ausnahmen von der Uhr**', herkunft: 'Inventur 13' },
  { datei: 'docs/ai/TESTING_GUIDELINES.md', anker: 'Eine Wache über Nutzertext prüft den gerenderten Text', herkunft: 'Regelvorschlag 124' },
  { datei: 'docs/ai/DESIGN_SYSTEM.md', anker: '**Ein Wortlaut für alle Leerzustände', herkunft: 'Inventur 15' },
  { datei: 'CLAUDE.md', anker: '- Seed-Konten (`@example.com`', herkunft: 'Inventur 18' },
  { datei: 'CLAUDE.md', anker: '- **Niemals** Claude in Chrome verwenden', herkunft: 'Inventur 18' },
  { datei: 'CLAUDE.md', anker: '- **Niemals** unaufgefordert Pakete installieren', herkunft: 'Inventur 18' },
]

/** Datum im Vermerk: Freigabe vom 21.10.2026, Nachbesserung und Regelvorschläge vom 22.10.2026. */
const DATUM = /\b2[12]\.10\.2026\b/

/** Listenpunkte, Absätze und Tabellenzeilen als Einheiten (Fortsetzungszeilen gehören zum Punkt davor). */
function einheiten(markdown: string): string[] {
  const ergebnis: string[] = []
  let aktuell: string | null = null
  const abschliessen = (): void => {
    if (aktuell !== null) ergebnis.push(aktuell.replace(/\s+/g, ' ').trim())
    aktuell = null
  }
  for (const zeile of markdown.split('\n')) {
    if (zeile.trim() === '') {
      abschliessen()
      continue
    }
    if (/^(\s*[-*] |\s*\d+\. |\|)|^#+ /.test(zeile)) abschliessen()
    aktuell = aktuell === null ? zeile : `${aktuell} ${zeile}`
  }
  abschliessen()
  return ergebnis
}

/** Meldet, was an einer Erwartung nicht stimmt; leer, wenn die Einheit ihre Herkunft trägt. */
function pruefe(markdown: string, e: Erwartung): string[] {
  const treffer = einheiten(markdown).filter((einheit) => einheit.includes(e.anker))
  if (treffer.length !== 1) return [`${e.datei}: Anker „${e.anker}“ kommt ${treffer.length}-mal vor (erwartet: einmal)`]
  const probleme: string[] = []
  if (!treffer[0].includes(e.herkunft)) probleme.push(`${e.datei}: „${e.anker}“ nennt „${e.herkunft}“ nicht`)
  if (!DATUM.test(treffer[0])) probleme.push(`${e.datei}: „${e.anker}“ trägt kein Datum (21.10.2026 oder 22.10.2026)`)
  return probleme
}

describe('Regeln: geschärfte Sätze tragen Herkunft und Datum (G4, Nr. 141)', () => {
  it.each(GESCHAERFT.map((e) => [e.datei, e.anker, e] as const))('%s: „%s“', (datei, _anker, e) => {
    const markdown = readFileSync(join(WURZEL, datei), 'utf8')
    expect(pruefe(markdown, e)).toEqual([])
  })

  it('Gegenprobe: ein Satz ohne Vermerk wird gefunden, einer mit Vermerk nicht', () => {
    const e: Erwartung = { datei: 'x.md', anker: 'Keine Assertion', herkunft: 'Inventur 7' }
    const ohne = '- Der Rückgabetyp ist Pflicht (Inventur 7, freigegeben 21.10.2026).\n- Keine Assertion ohne Grund.\n'
    const mit = '- Keine Assertion ohne Grund (Inventur 7, Morgenbericht 20 §3, freigegeben 21.10.2026).\n'
    expect(pruefe(ohne, e)).toHaveLength(2)
    expect(pruefe(mit, e)).toEqual([])
    expect(pruefe('- Etwas ganz anderes.\n', e)).toHaveLength(1)
  })
})
