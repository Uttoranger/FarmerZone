/**
 * Der Erzeuger des Bausteinverzeichnisses (scripts/bausteine.ts, Register G4),
 * geprüft an einem kleinen Beispielordner mit erfundenen Inhalten
 * (tests/fixtures/bausteine-beispiel).
 *
 * Ursache des Vorhabens: Neue Dateien und Funktionen entstanden doppelt, weil
 * niemand wusste, dass es sie schon gab. Das Verzeichnis beantwortet "gibt es
 * das schon?" aus dem Code selbst, nie aus einer Liste von Hand.
 *
 * Beweist: Zweck ist der erste Satz des ersten Kommentars der Datei; "genutzt"
 * heißt, dass eine andere Datei außerhalb von tests/ sie einbindet (statisch,
 * per import() oder per export … from); ein Tag @altbestand nennt den Ersatz;
 * die Ausgabe ist nach Ordner und Datei sortiert. Dass docs/ai/BAUSTEINE.md
 * zum echten Code passt, prüft tests/bausteine-verzeichnis.test.ts.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { join } from 'node:path'
import { erzeugeBausteine, loeseImportAuf } from '../scripts/bausteine'

const BEISPIEL = join(process.cwd(), 'tests/fixtures/bausteine-beispiel')

let text = ''

/** Die Zeile einer Datei im erzeugten Text. */
function zeileZu(pfad: string): string | undefined {
  return text.split('\n').find((zeile) => zeile.startsWith(`- ${pfad} · `))
}

describe('Bausteinverzeichnis aus einem Beispielordner', () => {
  // Der erste Aufruf lädt den Parser von TypeScript an; unter Last reicht das Standardlimit nicht (TESTING_GUIDELINES §4).
  beforeAll(() => {
    text = erzeugeBausteine(BEISPIEL)
  }, 30_000)

  it('beginnt mit dem Hinweis "erzeugt" und führt je Datei eine Zeile, gruppiert nach Ordner und sortiert', () => {
    expect(text.startsWith('# Bausteinverzeichnis\n\nErzeugt mit pnpm bausteine – nicht von Hand ändern.\n')).toBe(true)

    expect(text.slice(text.indexOf('## '))).toBe(
      [
        '## src/components/ui',
        '',
        '- src/components/ui/alter-knopf.tsx · AlterKnopf · Der erste Knopf der Beispiel-App, noch an zwei Stellen im Einsatz. · Altbestand → src/components/ui/knopf.tsx',
        '- src/components/ui/knopf.tsx · Knopf · Der Knopf der Beispiel-Seite, z. B. zum Bestellen. · genutzt',
        '- src/components/ui/ohne-zweck.tsx · OhneZweck · kein Zweck vermerkt · genutzt',
        '',
        '## src/lib',
        '',
        '- src/lib/nur-im-test.ts · nurImTest · Wird nur von einem Test benutzt. · unbenutzt',
        '- src/lib/preis.ts · PREIS_FAKTOR, inCent · Rechnet Preise in ganzen Cent. · genutzt',
        '- src/lib/sammel.ts · GRENZE, type Posten · Reicht den Zähler weiter. · unbenutzt',
        '- src/lib/selbst.ts · SELBST, ladeMich · Bindet nur sich selbst ein. · unbenutzt',
        '- src/lib/skript-hilfe.ts · skriptHilfe · Hilfe für das Skript im Beispielordner. · genutzt',
        '- src/lib/verwaist.ts · GRUND, default, type Betrag · Hängt nirgends dran. · unbenutzt',
        '- src/lib/zaehler.ts · MAX_POSTEN, type Posten · Zählt Posten einer Bestellung. · genutzt',
        '',
        '## src/server',
        '',
        '- src/server/aktion.ts · legeBestellungAn · Legt in der Beispiel-App eine Bestellung an. · genutzt',
        '',
      ].join('\n')
    )
  })

  it('nimmt als Zweck den ersten Satz des ersten Kommentars: Block, JSDoc, Zeilenkommentare, nach Importen', () => {
    // Block-Kommentar (/* */) und JSDoc (/** */) vor der ersten Anweisung.
    expect(zeileZu('src/lib/preis.ts')).toContain(' · Rechnet Preise in ganzen Cent. · ')
    // "z. B." beendet den Satz nicht, der zweite Satz bleibt draußen.
    expect(zeileZu('src/components/ui/knopf.tsx')).toContain(' · Der Knopf der Beispiel-Seite, z. B. zum Bestellen. · ')
    // Mehrere // -Zeilen sind ein Kommentar.
    expect(zeileZu('src/server/aktion.ts')).toContain(' · Legt in der Beispiel-App eine Bestellung an. · ')
    // Der Kommentar steht erst nach der Importzeile.
    expect(zeileZu('src/components/ui/alter-knopf.tsx')).toContain(' · Der erste Knopf der Beispiel-App, noch an zwei Stellen im Einsatz. · ')
  })

  it('vermerkt "kein Zweck vermerkt", wenn die Datei nur im Rumpf kommentiert ist', () => {
    expect(zeileZu('src/components/ui/ohne-zweck.tsx')).toContain(' · kein Zweck vermerkt · ')
  })

  it('nennt eine Datei "genutzt", wenn sie statisch, per import() oder per export … from eingebunden ist — auch nur von einem Skript', () => {
    expect(zeileZu('src/components/ui/knopf.tsx')?.endsWith(' · genutzt')).toBe(true) // import … from
    expect(zeileZu('src/lib/preis.ts')?.endsWith(' · genutzt')).toBe(true) // await import(…)
    expect(zeileZu('src/lib/zaehler.ts')?.endsWith(' · genutzt')).toBe(true) // export … from
    expect(zeileZu('src/lib/skript-hilfe.ts')?.endsWith(' · genutzt')).toBe(true) // nur scripts/werkzeug.ts
  })

  it('nennt eine Datei "unbenutzt", wenn nur tests/ oder sie selbst sie einbinden — oder niemand', () => {
    expect(zeileZu('src/lib/nur-im-test.ts')?.endsWith(' · unbenutzt')).toBe(true) // nur tests/nur-test.ts
    expect(zeileZu('src/lib/selbst.ts')?.endsWith(' · unbenutzt')).toBe(true) // import('./selbst') in sich selbst
    expect(zeileZu('src/lib/verwaist.ts')?.endsWith(' · unbenutzt')).toBe(true)
    expect(zeileZu('src/lib/sammel.ts')?.endsWith(' · unbenutzt')).toBe(true)
  })

  it('trägt bei @altbestand den Ersatz ein — auch wenn die Datei noch benutzt wird', () => {
    // alter-knopf.tsx wird von der Seite eingebunden und bleibt trotzdem Altbestand.
    expect(zeileZu('src/components/ui/alter-knopf.tsx')?.endsWith(' · Altbestand → src/components/ui/knopf.tsx')).toBe(true)
  })

  it('listet default und Typen mit, auch wenn sie nur weitergereicht werden', () => {
    expect(zeileZu('src/lib/verwaist.ts')).toContain(' · GRUND, default, type Betrag · ')
    // export { … as GRENZE } from und export type { … } from
    expect(zeileZu('src/lib/sammel.ts')).toContain(' · GRENZE, type Posten · ')
  })
})

describe('Auflösung eines Imports auf eine Datei im Projekt', () => {
  const BEKANNT = new Set(['src/lib/preis.ts', 'src/components/ui/knopf.tsx', 'src/lib/werkzeug/index.ts'])

  it.each([
    ['@/lib/preis', 'src/app/seite.tsx', 'src/lib/preis.ts'],
    ['@/components/ui/knopf', 'src/lib/preis.ts', 'src/components/ui/knopf.tsx'],
    ['../lib/preis', 'src/app/seite.tsx', 'src/lib/preis.ts'],
    ['./preis', 'src/lib/anderes.ts', 'src/lib/preis.ts'],
    ['@/lib/werkzeug', 'src/app/seite.tsx', 'src/lib/werkzeug/index.ts'],
    ['../src/lib/preis', 'scripts/werkzeug.ts', 'src/lib/preis.ts'],
  ])('löst %s aus %s auf %s auf', (spezifizierer, von, erwartet) => {
    expect(loeseImportAuf(spezifizierer, von, BEKANNT)).toBe(erwartet)
  })

  it.each([
    ['react', 'src/app/seite.tsx'],
    ['@base-ui/react/button', 'src/components/ui/knopf.tsx'],
    ['@/lib/gibt-es-nicht', 'src/app/seite.tsx'],
    ['../../../ausserhalb', 'src/lib/preis.ts'],
  ])('lässt %s aus %s unaufgelöst (Paket oder keine Datei im Projekt)', (spezifizierer, von) => {
    expect(loeseImportAuf(spezifizierer, von, BEKANNT)).toBeNull()
  })
})
