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

/** Was der Banner bei pausiertem Shop zeigt. */
export type PausenBanner = {
  /** Der Hinweis für den Hof selbst („Dein Shop ist pausiert — Pause beenden"). */
  hofHinweis: boolean
  /** Der Text, den Kundinnen sehen — null, wenn er hier nicht erscheint. */
  kundenText: string | null
}

/**
 * Der Text für Kundinnen: die Nachricht des Hofs, sonst der Rückfall.
 * EINE Stelle, damit Hofseite und Vorschau denselben Satz zeigen.
 */
export function kundenPausenText(pauseMessage: string | null | undefined): string {
  return pauseMessage?.trim() || SHOP_PAUSED_FALLBACK
}

/**
 * Welcher Banner erscheint. Kundinnen sehen den Text. Der Hof sieht im
 * Bearbeiten-Modus nur den Hinweis mit Weg zurück; in der Kundenansicht
 * (Vorschau) ZUSÄTZLICH genau den Text der Kundinnen — sonst glaubt er, seine
 * Nachricht fehle, obwohl die öffentliche Seite sie zeigt.
 */
export function pausenBanner(eingabe: {
  ownerMode: boolean
  vorschau: boolean
  pauseMessage: string | null | undefined
}): PausenBanner {
  if (!eingabe.ownerMode) return { hofHinweis: false, kundenText: kundenPausenText(eingabe.pauseMessage) }
  return { hofHinweis: true, kundenText: eingabe.vorschau ? kundenPausenText(eingabe.pauseMessage) : null }
}
