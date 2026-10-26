import { MELDUNG_KENNUNG_MAX } from '@/lib/meldung'

/**
 * Die Fehlernummer aus der Adresse — `/problem-melden?kennung=…`.
 *
 * Die URL ist eine Systemgrenze (CODING_STANDARDS §3), und der Wert reist
 * weit: von hier in ein Formularfeld, von dort in den Briefkasten und damit in
 * den Export, der in einen Agentenkontext geht. Deshalb eine Prüfung an
 * derselben Stelle wie die übrigen URL-Prüfungen (`hoefe-filter`,
 * `umfeld-filter`), und dieselbe Haltung: Was nicht passt, wird VERWORFEN,
 * nie ein Fehler — ein verstümmelter Link zeigt das Formular mit leerem Feld
 * statt einer Fehlerseite.
 *
 * ABSICHTLICH STRENGER ALS DAS FORMULARFELD: Hier entsteht der Wert aus
 * `error.digest`, also aus Ziffern — darum nur `[A-Za-z0-9_-]`. Das Feld im
 * Formular bleibt tolerant, weil ein Mensch dort auch „[L135]" aus einer
 * Meldung abtippt; seine Grenze ist allein die Länge (`diagKennung` in
 * `src/schemas/meldung.ts`). Beide lesen sie aus `MELDUNG_KENNUNG_MAX`.
 *
 * ZU LANG HEISST LEER, nicht abgeschnitten: Eine abgeschnittene Fehlernummer
 * zeigt auf den falschen Fehler. Die vollständige steht auf der Fehlerseite
 * und lässt sich von dort kopieren.
 *
 * OHNE ZOD (Nr. 196): Die Fehlerseite hängt an der Navigation, die jede
 * Kundenseite im Browser lädt (tests/leistung-196.test.ts). Kein Wert wirft.
 */
export function kennungAusUrl(roh: unknown): string {
  if (typeof roh !== 'string') return ''
  const wert = roh.trim().replace(/[^A-Za-z0-9_-]/g, '')
  return wert.length >= 1 && wert.length <= MELDUNG_KENNUNG_MAX ? wert : ''
}
