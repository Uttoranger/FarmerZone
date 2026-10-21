/**
 * YAML-Parser für Wachen über `.github/workflows/` (Nr. 127, umgestellt mit Nr. 135, G6-Ergänzung 21.10.2026).
 *
 * Gelesen wird mit dem Entwicklungspaket `yaml`. Es liest wie js-yaml 4 standardmäßig YAML 1.2: `on` bleibt
 * der Text „on“, kein Wahrheitswert (anders als in YAML 1.1). Das hält ein Fall in
 * `tests/workflows-yaml-wache.test.ts` fest. Der Umweg über das `js-yaml` von ESLint entfällt.
 */
import { parse, YAMLParseError } from 'yaml'

/**
 * YAML-Text → Wert; wirft bei ungültigem YAML mit „(Zeile:Spalte)“ am Ende der Meldung.
 * `yaml` selbst schreibt „at line 6, column 14“; die Wachen erwarten wie bei js-yaml „(6:14)“.
 */
export function leseYaml(text: string): unknown {
  try {
    return parse(text)
  } catch (fehler) {
    if (fehler instanceof YAMLParseError) {
      const ort = fehler.linePos?.[0]
      // Erste Zeile der Meldung ohne das „at line …, column …:“, das die Position doppelt nennen würde.
      const meldung = fehler.message.split('\n')[0].replace(/ at line \d+, column \d+:?$/, '')
      throw new Error(ort ? `${meldung} (${ort.line}:${ort.col})` : meldung, { cause: fehler })
    }
    throw fehler
  }
}
