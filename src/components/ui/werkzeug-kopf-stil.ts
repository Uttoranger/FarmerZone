/*
 * Maße des Werkzeug-Kopfs (werkzeug-kopf.tsx, G1, Nr. 245) — EINE Quelle für
 * den Kopf und seine Ladeansicht, damit beim Umschalten nichts springt. Eigene
 * Datei ohne 'use client': Server-Komponenten bekämen aus einem Client-Modul
 * nur Verweise statt der Klassen.
 */

/**
 * Die Leiste: am Handy klebt sie oben (sticky, 56 px samt Linie), Fläche
 * `bg-card`, über die ganze Breite. Die Rahmen des Hofbereichs haben unter
 * 768 px `px-4 pt-5` — `-mx-4 -mt-5` hebt das auf, die Leiste beginnt am
 * oberen Rand. Ebene 40 wie jede Kopfzeile (ARCHITECTURE §4). Ab 768 px steht
 * derselbe Block im Fluss, ohne Fläche und Linie: Textlink, h1, Unterzeile,
 * die Aktion bündig rechts unten. Sie klebt nur, solange ihr Elternelement
 * reicht — deshalb steht sie direkt im Rahmen der Seite.
 */
export const WERKZEUG_KOPF_LEISTE =
  'sticky top-0 z-40 -mx-4 -mt-5 mb-3 flex h-14 items-center gap-1 border-b border-border bg-card px-1 md:static md:z-auto md:mx-0 md:mt-0 md:mb-4 md:h-auto md:items-end md:gap-4 md:border-0 md:bg-transparent md:px-0 print:static print:mx-0 print:mt-0 print:h-auto print:border-0 print:bg-transparent'

/** Die Spalte mit Rückweg (nur Web), h1 und Unterzeile. Ohne Rückweg am Handy links 12 px Luft statt des Knopfs. */
export const WERKZEUG_KOPF_SPALTE = 'flex min-w-0 flex-1 flex-col justify-center'

/** Der Titel: am Handy Fraunces 20 px in einer Zeile (die Leiste ist 56 px hoch), im Web 28 px und darf umbrechen. */
export const WERKZEUG_KOPF_TITEL =
  'truncate font-heading text-xl leading-tight font-semibold text-foreground md:text-[28px] md:leading-tight md:break-words md:whitespace-normal'
