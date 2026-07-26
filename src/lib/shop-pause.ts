// Shop-Pause: eine Quelle für die Wortlaute, damit Server-Antwort und
// Kundensicht nie auseinanderlaufen.
//
// Durchsetzungs-Doktrin: Die Pause wird SERVERSEITIG erzwungen
// (/api/checkout und /api/reserve antworten mit 409), nicht durch
// ausgeblendete Schaltflächen. Die UI-Zustände hier sind Höflichkeit,
// kein Schutz.

/** Server-Antwort (HTTP 409) beim Versuch, im pausierten Shop zu bestellen oder zu reservieren. */
export const SHOP_PAUSED_MESSAGE = 'Der Hofladen ist derzeit pausiert.'

/** Banner-Text auf der Hof-Seite, wenn der Bauer keine eigene Nachricht hinterlegt hat. */
export const SHOP_PAUSED_FALLBACK = 'Derzeit keine Bestellungen möglich.'

/** Beschriftung der deaktivierten Kauf-Schaltflächen. */
export const SHOP_PAUSED_BUTTON_LABEL = 'Pausiert'
