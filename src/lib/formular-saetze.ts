/**
 * Die Sätze der Zusammenfassung über einem Formular mit Feldfehlern (G6, Nr. 246; Boards s2-hofdaten-zahlung,
 * s1-produkt-neu Bild 5) — eine Quelle für den Baustein (components/shared/formular-meldungen.tsx) und das
 * Produktformular (lib/produkte-hof.ts). Eigene Datei ohne Abhängigkeiten: produkte-hof.ts zieht Zod nach, und
 * der Baustein steht im Korb der Hofseite, deren Browser-Bündel ohne Zod bleibt (tests/leistung-196.test.ts).
 */

/** Genau ein Feldfehler (Liste Lauf 32, G6). */
export const FORMULAR_PRUEFEN_EIN = 'Bitte prüfe das markierte Feld.'

/** Mehrere Feldfehler — die Karte über dem Formular statt eines Toasts (V17; Board s1-produkt-neu Bild 5). */
export const FORMULAR_PRUEFEN = 'Bitte prüfe die markierten Felder.'
