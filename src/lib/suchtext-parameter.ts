/**
 * Der Name des Suchtext-Parameters in der Adresse (`/hoefe?q=…`). Eigene Datei
 * ohne Zod: Kopfzeile und Shells brauchen nur den Namen, und das Schema
 * (src/schemas/hoefe-filter.ts) hätte Zod in das Bündel jeder Seite gezogen.
 */
export const SUCHTEXT_PARAMETER = 'q'
