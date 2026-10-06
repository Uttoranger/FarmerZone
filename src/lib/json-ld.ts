/**
 * Strukturierte Daten (JSON-LD) für ein <script type="application/ld+json">.
 *
 * Warum nicht JSON.stringify allein: Der Browser beendet den Script-Block beim
 * ersten `</script>` — egal, ob es in einem JSON-Text steht. Ein Hofname wie
 * `</script><script>…` liefe sonst als Skript (die Texte kommen vom Hof, also
 * von außen). Deshalb werden `<`, `>` und `&` als \u-Folgen geschrieben, dazu
 * U+2028/U+2029 (in JavaScript-Text Zeilenenden). Für JSON ist das
 * gleichbedeutend: JSON.parse liefert dieselben Daten (tests/json-ld.test.ts).
 */
const MASKE: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
}

export function jsonLdSicher(daten: unknown): string {
  return JSON.stringify(daten).replace(/[<>&\u2028\u2029]/g, (zeichen) => MASKE[zeichen] ?? zeichen)
}
