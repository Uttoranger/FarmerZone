/**
 * Frequenzschutz für Beiträge per E-Mail: Ein Hof schreibt seinen
 * Abonnentinnen höchstens eine Mail je sieben mal 24 Stunden. Das Fenster
 * gleitet ab dem Zeitpunkt der Anfrage und zählt Stunden, keine Wiener
 * Kalendertage — so prüft auch publishStatusPost beim Versand (dort noch mit
 * eigener Rechnung). Rein: `jetzt` bestimmt die Seite einmal auf dem Server
 * (CODING_STANDARDS §2), der Assistent bekommt ihn als ISO-Text.
 */
export const MAILABSTAND_TAGE = 7

const TAG_MS = 24 * 60 * 60 * 1000

/** Ab diesem Zeitpunkt (einschließlich) sperrt eine versendete Mail den Kanal „E-Mail". */
export function berechneMailabstandBeginn(jetzt: Date): Date {
  return new Date(jetzt.getTime() - MAILABSTAND_TAGE * TAG_MS)
}
