/**
 * Die gewählte Größe der Produktseite in der Adresse
 * (`/[hof]/produkt/[id]?groesse=<id>`, Nr. 11). Die Adresse ist eine
 * Systemgrenze: Was nicht wie eine Produkt-ID aussieht, fällt still weg —
 * dann gilt das Produkt aus dem Pfad. Ob die ID zur Familie gehört,
 * entscheidet gewaehlteGroesse in src/lib/produktdetail.ts.
 *
 * Ohne Zod (Nr. 196): src/lib/produktdetail.ts liest den Parameternamen und
 * läuft im Browser (tests/leistung-196.test.ts).
 */
export const GROESSE_PARAMETER = 'groesse'

/** Produkt-IDs sind cuids; großzügig gefasst, aber ohne Sonderzeichen und mit Längengrenze. */
const GROESSE_MUSTER = /^[A-Za-z0-9_-]{1,64}$/

/** Der Wert aus den Suchparametern der Seite; steht er mehrfach da, zählt der letzte (wie bei ansichtsModus). */
export function leseGroesse(roh: string | string[] | undefined): string | null {
  const wert = Array.isArray(roh) ? roh.at(-1) : roh
  return typeof wert === 'string' && GROESSE_MUSTER.test(wert) ? wert : null
}
