/**
 * Der Ablauf hinter „Abmelden" in der HofShell (components/shells/hof-shell.tsx)
 * — rein, damit er ohne Browser prüfbar ist (tests/abmelden.test.ts).
 *
 * Zwei Fälle, die die Shell allein nicht unterscheiden kann:
 *  - In der Vorschau unter /intern sitzt ein echter Admin vor der Shell. Dort
 *    darf der Knopf ihn nicht abmelden — die Vorschau gibt einen Ersatz mit.
 *  - Better Auth meldet einen Fehlschlag auf zwei Wegen: als `{ error }` in
 *    der Antwort oder als Wurf (kein Netz). Beides heißt für den Bauern
 *    dasselbe: Er ist noch angemeldet und soll es noch einmal versuchen —
 *    nie stillschweigend zur Anmeldung geschickt werden, als hätte es geklappt.
 */

export const ABMELDEN_FEHLGESCHLAGEN = 'Abmelden hat nicht geklappt. Versuch es bitte noch einmal.'

export const ABMELDEN_IN_VORSCHAU = 'In der Vorschau meldet dich das nicht ab.'

export type AbmeldenSchritte = {
  /** Gesetzt nur in der Vorschau: ersetzt das echte Abmelden ganz. */
  ersatz?: () => void
  /** Das echte Abmelden (signOut aus src/lib/auth-client). */
  abmelden: () => Promise<unknown>
  /** Zeigt dem Bauern einen Satz (Toast). */
  beiFehler: (satz: string) => void
  /** Nach geglücktem Abmelden: zur Anmeldung. */
  danach: () => void
}

function hatFehler(antwort: unknown): boolean {
  return typeof antwort === 'object' && antwort !== null && 'error' in antwort && antwort.error != null
}

export async function fuehreAbmeldenAus({ ersatz, abmelden, beiFehler, danach }: AbmeldenSchritte): Promise<void> {
  if (ersatz) {
    ersatz()
    return
  }
  let geklappt: boolean
  try {
    geklappt = !hatFehler(await abmelden())
  } catch {
    // Kein Netz oder ein Wurf aus dem Client — der Satz unten ist die Behandlung;
    // nach Sentry gehört das nicht, die Sitzung ist unverändert.
    geklappt = false
  }
  if (geklappt) danach()
  else beiFehler(ABMELDEN_FEHLGESCHLAGEN)
}
