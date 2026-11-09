import { defineConfig } from 'vitest/config'
import basis from './vitest.config'

/**
 * Eigener Lauf für Leistungstests mit fester Zeitgrenze (`pnpm pruefen:leistung`, TESTING_GUIDELINES §4;
 * Zwischen-Morgenbericht 33 A, freigegeben 9.11.2026). Im normalen `pnpm test` laufen viele Dateien parallel
 * und teilen sich die Kerne — eine feste Grenze fing dort entweder falsch an (572 statt unter 500 ms) oder
 * musste mit der Zahl der Worker wachsen und fing den Fehler dann nicht mehr sicher (3 Worker → 1500 ms).
 * Hier läuft eine Datei zur Zeit in einem Worker, und nur die Laufzeit-Tests (`testNamePattern`); die
 * übrigen Tests derselben Dateien laufen nur im normalen Lauf, nicht doppelt.
 */
declare module 'vitest' {
  export interface ProvidedContext {
    /** Nur in diesem Lauf gesetzt: Erst dann gilt die feste Zeitgrenze eines Leistungstests. */
    leistungslauf?: true
  }
}

export default defineConfig({
  ...basis,
  test: {
    ...basis.test,
    // Die Dateien mit Leistungstests; jede liest `inject('leistungslauf')` (Wache `tests/pruefung-leistung.test.ts`).
    include: ['tests/bild-format.test.ts', 'tests/sentry-hygiene-felder.test.ts'],
    // Nur Tests, deren voller Name (describe und it) dieses Wort trägt.
    testNamePattern: /Laufzeit/,
    fileParallelism: false,
    maxWorkers: 1,
    provide: { leistungslauf: true },
  },
})
