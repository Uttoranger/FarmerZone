/*
 * Bestandsliste der Werkzeug-Kopf-Wache (tests/werkzeug-kopf-wache.test.ts, G1, Nr. 245): Dateien unter
 * src/, die heute noch den alten Kopf `UnterseitenKopf` bzw. seine Ladeansicht `UnterseitenKopfLaden`
 * rendern oder unterseiten-kopf.tsx importieren.
 *
 * Die Liste darf nur schrumpfen: Jede Seiten-Nummer stellt ihre Route auf `WerkzeugKopf`
 * (ui/werkzeug-kopf.tsx) um und nimmt die Datei heraus. Ist die Liste leer, löscht der Dirigent im
 * Sammel-PR unterseiten-kopf.tsx und unterseiten-kopf-stil.ts (Auftrag Lauf 32, G1).
 */
export const UNTERSEITEN_KOPF_BESTAND: readonly string[] = []
