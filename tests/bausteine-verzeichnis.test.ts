/**
 * docs/ai/BAUSTEINE.md ist erzeugt und nie von Hand geschrieben (Register G4,
 * `pnpm bausteine`) — dieser Test hält es aktuell.
 *
 * Ursache: Ein Verzeichnis, das von Hand gepflegt wird, veraltet mit dem
 * ersten Commit, der es vergisst, und führt dann in die Irre. Hier erzeugt der
 * Test es im Speicher aus dem Code und vergleicht mit der Datei im Repo.
 * Wer Dateien oder Exporte unter src/components, src/lib oder src/server
 * anlegt, umbenennt oder entfernt, führt `pnpm bausteine` aus und committet
 * die Datei mit.
 *
 * Wie der Erzeuger Zweck, Status und Altbestand ermittelt, prüft
 * tests/bausteine-generator.test.ts an einem Beispielordner.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BAUSTEINE_PFAD, erzeugeBausteine } from '../scripts/bausteine'

const WURZEL = process.cwd()

describe('Bausteinverzeichnis', () => {
  // Liest und parst ganz src/ (dazu scripts/ und prisma/) — unter Last länger als 5 s, deshalb ein eigenes Limit.
  it('stimmt mit dem Code überein: docs/ai/BAUSTEINE.md ist aktuell', () => {
    const erwartet = erzeugeBausteine(WURZEL)
    // Unter Windows kann Git die Datei mit CRLF auschecken; der Inhalt ist derselbe.
    const vorhanden = readFileSync(join(WURZEL, BAUSTEINE_PFAD), 'utf8').replace(/\r\n/g, '\n')

    expect(vorhanden, 'Bausteinverzeichnis veraltet – pnpm bausteine ausführen').toBe(erwartet)
  }, 30_000)
})
