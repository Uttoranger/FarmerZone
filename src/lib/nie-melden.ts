/**
 * Adressen, die nie gemeldet werden — weder als CSP-Meldung (src/lib/csp.ts)
 * noch an die Seitenstatistik (src/lib/analytics-filter.ts). Eigene Datei ohne
 * Zod, weil der Statistik-Filter in jeder Seite im Browser läuft und csp.ts
 * die Meldungen mit Zod liest (Nr. 196, tests/leistung-196.test.ts).
 */

/**
 * Seiten, die NIE melden (neben den Seiten mit `Referrer-Policy: no-referrer`,
 * die next.config.ts selbst einsammelt): Ihre Adresse trägt eine Kennung, eine
 * Signatur oder einen Token, und eine Meldung schickt die ganze Adresse mit.
 */
export const NIE_MELDEN_PFADE = [
  '/:farmSlug/bestellung/:orderId',
  '/:farmSlug/bestellung/:orderId/kalender',
  '/admin/postfach/zustellung/bestaetigen',
  '/api/:pfad*',
] as const

/** Jede Adresse mit einem dieser Query-Werte meldet nie. `?beitrag=` ist eine öffentliche Kennung (Nr. 128) und fehlt bewusst. */
export const NIE_MELDEN_PARAMETER = ['s', 'sig', 'token', 't', 'code', 'vorschau', 'reorder'] as const
