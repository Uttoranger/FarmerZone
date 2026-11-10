/*
 * Bestandsliste der Startfokus-Wache (tests/startfokus-wache.test.ts, Nr. 246): Dateien unter src/, deren
 * `DialogMitte`/`SheetBlatt` eine Gefahr-Aktion (löschen, stornieren, pausieren, stilllegen) tragen und den
 * Startfokus heute noch nicht auf „Abbrechen“ setzen — je mit der Zahl der Stellen und dem Grund.
 *
 * Die Liste darf nur schrumpfen: Die Seiten-Nummer der Datei setzt `initialFocus` auf „Abbrechen“ und nimmt
 * den Eintrag heraus. Eigene Datei, damit spätere Nummern die Wache selbst nicht anfassen müssen.
 */
export const STARTFOKUS_BESTAND: Readonly<Record<string, { anzahl: number; grund: string }>> = {
  'src/app/intern/bausteine/bausteine-vorschau.tsx': {
    anzahl: 1,
    grund: 'Abschnitt „Blatt mit Griff“ der Vorschau (SheetBlatt „Bestellung stornieren?“ ohne Startfokus); in bausteine-vorschau.tsx zieht 246 nur das Prop symbol nach (Auftrag: Vorschau nur in vorschau-<nr>.tsx); das Beispiel mit Startfokus steht in vorschau-246.tsx.',
  },
}
