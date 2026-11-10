import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import leistung from '../vitest.leistung.config'

/**
 * Leistungstests laufen in einem eigenen Lauf mit einem Worker und fester Grenze (Nr. 262b, Zwischen-Morgenbericht
 * 33 A, freigegeben 9.11.2026; TESTING_GUIDELINES §4). Die Grenze wirkt nur, wenn alles zusammenpasst:
 *  - `vitest.leistung.config.ts`: ein Worker, keine parallelen Dateien, `provide: { leistungslauf: true }`;
 *  - jede Datei des Laufs liest `inject('leistungslauf')` und hat mindestens einen Titel, auf den das
 *    Namensmuster passt — sonst liefe dort nichts oder ohne Grenze, und der Lauf bliebe trotzdem grün;
 *  - keine Testdatei skaliert eine Grenze mehr mit der Zahl der Worker (`__vitest_worker__`, frühere Regel A-1);
 *  - `pnpm pruefen:leistung` ruft genau diese Konfiguration, und die CI ruft das Skript.
 * Gegenprobe: an Schnipseln ohne `inject`, ohne passenden Titel und mit der alten Worker-Skalierung.
 */

const WURZEL = process.cwd()
const lies = (pfad: string): string => readFileSync(join(WURZEL, pfad), 'utf8')

/** Die Titel aller `describe(…)`- und `it(…)`-Aufrufe mit festem Text (Anführungszeichen oder Backtick). */
function titel(quelle: string): string[] {
  return [...quelle.matchAll(/\b(?:describe|it)\(\s*(['"`])((?:(?!\1).)*)\1/g)].map((t) => t[2] ?? '')
}

/** Was einer Datei im Leistungslauf fehlt; leer, wenn sie dort mit fester Grenze läuft. */
function maengel(quelle: string, muster: RegExp): string[] {
  const liste: string[] = []
  if (!/\binject\(\s*'leistungslauf'\s*\)/.test(quelle)) liste.push("liest inject('leistungslauf') nicht")
  if (!titel(quelle).some((t) => muster.test(t))) liste.push(`kein Titel passt auf ${String(muster)}`)
  return liste
}

/** Die frühere Regel A-1: eine Grenze aus der Zahl der Worker. */
const WORKER_SKALIERUNG = /__vitest_worker__|availableParallelism\(\)/

const test = leistung.test ?? {}
const muster = test.testNamePattern instanceof RegExp ? test.testNamePattern : /(?!)/
const dateien = Array.isArray(test.include) ? test.include : []

describe('Leistungslauf (vitest.leistung.config.ts)', () => {
  it('läuft mit einem Worker, ohne parallele Dateien und mit gesetztem leistungslauf', () => {
    expect(test.maxWorkers).toBe(1)
    expect(test.fileParallelism).toBe(false)
    expect(test.provide).toEqual({ leistungslauf: true })
    expect(dateien.length).toBeGreaterThan(0)
  })

  it('jede Datei des Laufs liest leistungslauf und hat einen passenden Titel', () => {
    for (const datei of dateien) expect(maengel(lies(datei), muster), datei).toEqual([])
  })

  it('keine der Dateien skaliert ihre Grenze mit der Zahl der Worker', () => {
    for (const datei of dateien) expect(WORKER_SKALIERUNG.test(lies(datei)), datei).toBe(false)
  })

  it('pnpm pruefen:leistung ruft diese Konfiguration, die CI ruft das Skript im Job ci', () => {
    const skripte = (JSON.parse(lies('package.json')) as { scripts: Record<string, string> }).scripts
    expect(skripte['pruefen:leistung']).toBe('vitest run --config vitest.leistung.config.ts')
    const ci = lies('.github/workflows/ci.yml')
    const jobCi = ci.slice(ci.indexOf('\n  ci:'), ci.indexOf('\n  integration:'))
    expect(jobCi).toMatch(/\n\s+run: pnpm pruefen:leistung\n/)
  })
})

describe('Gegenprobe', () => {
  it('eine Datei ohne inject meldet den Mangel', () => {
    expect(maengel("describe('Laufzeit', () => { it('x', () => {}) })", /Laufzeit/)).toEqual(["liest inject('leistungslauf') nicht"])
  })

  it('eine Datei ohne passenden Titel meldet den Mangel — auch wenn das Wort nur im Kommentar steht', () => {
    const quelle = "// Laufzeit\nconst g = inject('leistungslauf') ? 500 : Infinity\ndescribe('Tempo', () => { it(`schnell`, () => {}) })"
    expect(maengel(quelle, /Laufzeit/)).toEqual(['kein Titel passt auf /Laufzeit/'])
  })

  it('eine passende Datei hat keinen Mangel', () => {
    expect(maengel("const g = inject('leistungslauf') ? 500 : Infinity\ndescribe(\"x — Laufzeit\", () => {})", /Laufzeit/)).toEqual([])
  })

  it('die alte Skalierung mit der Zahl der Worker schlägt an', () => {
    expect(WORKER_SKALIERUNG.test('const w = globalThis.__vitest_worker__?.config?.maxWorkers')).toBe(true)
    expect(WORKER_SKALIERUNG.test('Math.max(1, availableParallelism() - 1)')).toBe(true)
    expect(WORKER_SKALIERUNG.test('const GRENZE_MS = 500')).toBe(false)
  })
})
