/*
 * Der Vorsatz „[TEST] " vor jedem Seitentitel außerhalb der Produktion (Register Z3) — EINE Quelle für das
 * Wurzel-Layout (Vorlage aller Seitentitel, src/app/layout.tsx) und die 500, deren Titel ohne Vorlage gesetzt wird
 * (Antwort der Projektleitung auf den Zwischen-Morgenbericht 33 A, 9.11.2026, Punkt 4; Nr. 279).
 *
 * Ohne Server-Import: Die Fehlerseite ist eine Client-Komponente und darf src/lib/umgebung-server.ts nicht ziehen.
 * Ob der Vorsatz gilt, entscheidet allein der Server (ZEIGE_UMGEBUNGSBANNER); das Wurzel-Layout schreibt ihn in
 * das Attribut TITEL_VORSATZ_ATTRIBUT an <html>, von dort liest ihn die Fehlerseite im Browser.
 */

/** Der Vorsatz selbst — mit Leerzeichen, steht direkt vor dem Titel. */
export const TEST_VORSATZ = '[TEST] '

/** Das Attribut an <html>, in dem das Wurzel-Layout den geltenden Vorsatz ablegt (leer in der Produktion: fehlt). */
export const TITEL_VORSATZ_ATTRIBUT = 'data-titel-vorsatz'

/** Der Vorsatz für die Umgebung: „[TEST] ", wenn das Testbanner steht, sonst nichts. */
export function titelVorsatz(zeigeTestbanner: boolean): string {
  return zeigeTestbanner ? TEST_VORSATZ : ''
}

/**
 * Der Vorsatz, den das Wurzel-Layout an <html> abgelegt hat — nur ein bekannter Wert zählt, alles andere ist leer
 * (das Attribut ist kein Weg, beliebigen Text in den Titel zu schreiben).
 */
export function vorsatzAusAttribut(wert: string | null | undefined): string {
  return wert === TEST_VORSATZ ? TEST_VORSATZ : ''
}
