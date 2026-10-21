/**
 * YAML-Parser für Wachen über `.github/workflows/` (Nr. 127).
 *
 * Das Projekt führt kein YAML-Paket (G6: keine neuen Pakete im Lauf). `js-yaml` liegt aber im Lockfile,
 * weil ESLint es braucht (eslint → @eslint/eslintrc → js-yaml). Der Lader folgt genau dieser Kette, statt
 * eine Datei in `node_modules/.pnpm` beim Namen zu nennen. Fällt eine Stufe weg (anderes Layout, neue
 * ESLint-Version ohne js-yaml), bricht jede Wache, die ihn nutzt, mit diesem Satz — dann ist `yaml` als
 * Entwicklungspaket zu beantragen, nicht der Lader zu flicken.
 */
import { createRequire } from 'node:module'
import { join } from 'node:path'

export type YamlParser = { load(text: string): unknown }

let parser: YamlParser | null = null

/** Der Parser von js-yaml 4: `load` liest YAML 1.2 (`on` bleibt der Text „on“, kein Wahrheitswert). */
export function ladeYamlParser(): YamlParser {
  if (parser) return parser
  try {
    const vomProjekt = createRequire(join(process.cwd(), 'package.json'))
    const vonEslint = createRequire(vomProjekt.resolve('eslint/package.json'))
    const vonEslintrc = createRequire(vonEslint.resolve('@eslint/eslintrc/package.json'))
    parser = vonEslintrc('js-yaml') as YamlParser
    return parser
  } catch (fehler) {
    throw new Error(
      `Kein YAML-Parser gefunden (Kette eslint → @eslint/eslintrc → js-yaml): ${fehler instanceof Error ? fehler.message : String(fehler)}. Das Paket "yaml" als Entwicklungspaket beantragen (G6).`,
    )
  }
}

/** YAML-Text → Wert; wirft bei ungültigem YAML (Meldung des Parsers mit Zeile und Spalte). */
export function leseYaml(text: string): unknown {
  return ladeYamlParser().load(text)
}
