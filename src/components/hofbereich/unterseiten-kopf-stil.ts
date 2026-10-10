/*
 * Maße des Unterseiten-Kopfs (unterseiten-kopf.tsx) — EINE Quelle für den
 * Kopf und die Ladeansichten der Unterseiten (hof-laden.tsx), damit beim
 * Umschalten nichts springt. Eigene Datei ohne 'use client': Server-
 * Komponenten (Ladeansichten) bekämen aus einem Client-Modul nur Verweise
 * statt der Klassen.
 */

/**
 * Am Handy die feste Leiste: klebt oben (sticky, 56 px) über die ganze
 * Breite. Alle Rahmen des Hofbereichs haben unter 768 px px-4 pt-5
 * (UNTERSEITE_RAHMEN, EINSTELLUNGEN_RAHMEN, KUNDEN_RAHMEN, MELDEN_RAHMEN …) —
 * -mx-4 -mt-5 hebt das auf, die Leiste beginnt am oberen Rand. Ebene 40 wie
 * jede Kopfzeile (ARCHITECTURE §4): Dialoge und Blätter (50) liegen davor,
 * das Umgebungsbanner (60) steht im Fluss darüber und scrollt weg. Eigene
 * Fläche (bg-card) mit Linie, damit gescrollter Inhalt nicht durchscheint.
 * Sie klebt nur, solange ihr Elternelement reicht — deshalb steht sie direkt
 * im Rahmen der Seite (bzw. der Spalte), nie in einem Kasten nur um den Kopf.
 */
export const LEISTE_HANDY =
  'sticky top-0 z-40 -mx-4 -mt-5 mb-4 flex h-14 items-center border-b border-border bg-card px-2 md:hidden print:hidden'

/** Im Browser (ab 768 px) die bisherige Zeile „‹ …": 44 px hoch, leise Schrift. */
export const ZEILE_BROWSER = 'hidden md:flex print:hidden'
