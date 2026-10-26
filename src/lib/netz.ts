/**
 * Kein Netz als Zustand (Register N29) — die eine Quelle für Erkennen, Wortlaut
 * und den Schutz um einen Aufruf. Rein, ohne DOM.
 *
 * Im Stall ist ein Funkloch der häufigste Fehler. Bisher blieb „In den Korb"
 * ohne Antwort im Ladezustand hängen, und Hof-Aktionen ohne catch warfen die
 * ganze Fehlerseite („Das liegt an uns") — beides falsch: Es liegt am Netz,
 * und die Eingabe soll stehen bleiben. Wer einen Aufruf über `mitNetzSchutz`
 * schickt, bekommt nie einen Wurf, sondern eine Art, und zeigt bei `netz`
 * bzw. `zeit` den Satz `NETZ_SATZ` mit dem Knopf `NETZ_KNOPF` am Formular.
 */

/** Der Satz am Formular bzw. an der Aktion, wenn ein Aufruf am Netz scheitert (Wortlaut N29). */
export const NETZ_SATZ = 'Keine Verbindung – nichts gespeichert. Versuch es gleich noch einmal.'

/** Der Knopf daneben (Wortlaut N29). */
export const NETZ_KNOPF = 'Nochmal'

/** Die Zeile unter dem Kopf der Shells, solange der Browser offline ist (Board system-sterne-kein-netz). */
export const NETZ_ZEILE = 'Keine Verbindung – du siehst den letzten Stand.'

/** So lange wartet ein Aufruf ohne eigenes Zeitlimit — danach gilt er als Netzproblem (`zeit`). */
export const NETZ_ZEITLIMIT_MS = 15_000

/**
 * Wortlaute, mit denen ein abgerissener Request scheitert — immer als
 * TypeError, je Browser anders. Grundlage ist die Liste in @vercel/blob
 * (is-network-error), ergänzt um den Zeitablauf seines XHR-Wegs und Safaris
 * ältere Texte.
 *
 * Bewusst eine Liste statt „jeder TypeError": Auch ein Programmierfehler ist
 * ein TypeError („Cannot read properties of undefined"). Den als
 * Verbindungsabbruch zu melden, wäre genau die falsche Auskunft.
 */
const NETZFEHLER_TEXTE = new Set([
  'Failed to fetch', // Chrome
  'NetworkError when attempting to fetch resource.', // Firefox
  'Load failed', // Safari 17+
  'The Internet connection appears to be offline.', // Safari
  'The network connection was lost.', // Safari
  'The request timed out.', // Safari
  'network error',
  'Network request failed', // XHR-Weg des SDK
  'Network request timed out', // XHR-Weg des SDK
  'fetch failed', // Node (undici)
  'terminated', // Node (undici)
])

/**
 * Ein abgerissener Request — nach den Wortlauten oben. Seit Nr. 175 die eine
 * Quelle; src/lib/upload-diagnose.ts reicht sie unter dem alten Namen
 * `istNetzfehler` weiter.
 */
export function istNetzFehler(fehler: unknown): boolean {
  return fehler instanceof Error && fehler.name === 'TypeError' && NETZFEHLER_TEXTE.has(fehler.message)
}

/** Das Zeitlimit hat abgebrochen (`AbortSignal.timeout` wirft eine DOMException „TimeoutError"). */
function istZeitAblauf(fehler: unknown): boolean {
  if (typeof fehler !== 'object' || fehler === null) return false
  try {
    return (fehler as { name?: unknown }).name === 'TimeoutError'
  } catch {
    return false
  }
}

export type NetzArt = 'netz' | 'zeit' | 'server'

export type NetzErgebnis<T> = { ok: true; daten: T } | { ok: false; art: NetzArt; fehler: unknown }

/**
 * Ruft `aufruf` mit einem Signal auf, das nach `zeitlimitMs` abbricht, und
 * wirft nie: `netz` bei abgerissener Verbindung, `zeit` nach dem Zeitlimit,
 * `server` bei jedem anderen Wurf (auch einem Programmierfehler — den zeigt
 * der Aufrufer nicht als Funkloch an). Eine Antwort mit Fehlerstatus ist kein
 * Wurf; die bewertet der Aufrufer selbst.
 */
export async function mitNetzSchutz<T>(
  aufruf: (signal: AbortSignal) => Promise<T>,
  { zeitlimitMs = NETZ_ZEITLIMIT_MS }: { zeitlimitMs?: number } = {}
): Promise<NetzErgebnis<T>> {
  try {
    return { ok: true, daten: await aufruf(AbortSignal.timeout(zeitlimitMs)) }
  } catch (fehler) {
    if (istZeitAblauf(fehler)) return { ok: false, art: 'zeit', fehler }
    if (istNetzFehler(fehler)) return { ok: false, art: 'netz', fehler }
    return { ok: false, art: 'server', fehler }
  }
}
