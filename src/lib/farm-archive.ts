// Hof-Stilllegung: eine Quelle für die Wortlaute — analog zu shop-pause.ts,
// damit Server-Antwort, Kundensicht und Bauern-Oberfläche nie auseinanderlaufen.
//
// Abgrenzung zur Pause (isPaused): Die Pause ist VORÜBERGEHEND — die Hofseite
// bleibt sichtbar und trägt ein Banner. Die Stilllegung (archivedAt) ist
// DAUERHAFT gemeint — die Hofseite verhält sich wie eine unbekannte Farm
// (404), Checkout und Reservierung lehnen ab. Beide Zustände sind unabhängig
// voneinander und widersprechen sich nicht: ein stillgelegter Hof ist gesperrt,
// egal wie isPaused steht.
//
// Durchsetzungs-Doktrin (wie bei der Pause): Die Sperre wird SERVERSEITIG
// erzwungen (/api/checkout und /api/reserve antworten mit 409) und nicht durch
// ausgeblendete Schaltflächen. Es wird NICHTS gelöscht — Bestelldaten
// unterliegen der 7-jährigen Aufbewahrungspflicht.

/** Server-Antwort (HTTP 409) beim Versuch, bei einem stillgelegten Hof zu bestellen oder zu reservieren. */
export const FARM_ARCHIVED_MESSAGE = 'Dieser Hof nimmt keine Bestellungen mehr entgegen.'

/** Balken auf jeder Farmer-Seite, solange der Hof stillgelegt ist. */
export const FARM_ARCHIVED_OWNER_BANNER =
  'Dein Hof ist stillgelegt — für Kundinnen nicht sichtbar'

/** Überschrift des Selbstbedienungs-Kastens auf /settings/account. */
export const FARM_ARCHIVE_TITLE = 'Hof stilllegen'

/** Erklärtext im Kasten, solange der Hof aktiv ist. */
export const FARM_ARCHIVE_EXPLANATION =
  'Deine Hofseite verschwindet aus dem Netz und es sind keine Bestellungen mehr möglich. ' +
  'Deine Daten bleiben vollständig erhalten — Bestellungen, Produkte, Kundinnen und Auswertungen. ' +
  'Du kannst dich weiterhin anmelden und alles einsehen, und den Hof jederzeit selbst wieder aktivieren.'

/** Erklärtext im Kasten, wenn der Hof bereits stillgelegt ist. */
export const FARM_ARCHIVED_EXPLANATION =
  'Dein Hof ist stillgelegt: Die Hofseite ist nicht mehr erreichbar und es gehen keine ' +
  'Bestellungen mehr ein. Es wurde nichts gelöscht. Beim Reaktivieren ist deine Hofseite ' +
  'unter derselben Adresse wieder erreichbar.'

/**
 * Hinweis, wenn die Stilllegung wegen offener Bestellungen nicht möglich ist.
 * Offen = weder abgeholt noch storniert (OPEN_STATUSES in src/server/queries/orders.ts).
 */
export function farmArchiveBlockedMessage(openOrders: number): string {
  return openOrders === 1
    ? 'Du hast noch 1 offene Bestellung. Schließe sie ab oder storniere sie, dann kannst du den Hof stilllegen.'
    : `Du hast noch ${openOrders} offene Bestellungen. Schließe sie ab oder storniere sie, dann kannst du den Hof stilllegen.`
}
