/*
 * Maße des Werkzeug-Kopfs (werkzeug-kopf.tsx, G1, Nr. 245) — EINE Quelle für
 * den Kopf und seine Ladeansicht, damit beim Umschalten nichts springt. Eigene
 * Datei ohne 'use client': Server-Komponenten bekämen aus einem Client-Modul
 * nur Verweise statt der Klassen.
 */

/**
 * Die Leiste: am Handy steht sie fest oben (56 px samt Linie), Fläche
 * `bg-card`, über die ganze Breite. Ebene 40 wie jede Kopfzeile
 * (ARCHITECTURE §4). Ab 768 px steht derselbe Block im Fluss, ohne Fläche und
 * Linie: Textlink, h1, Unterzeile, die Aktion bündig rechts unten.
 *
 * Warum `fixed` statt `sticky` (Nr. 269, Liste Lauf 32 auswertung „Kopf …
 * scrollt weg“): `sticky` klebt nur, solange das Elternelement reicht. Die
 * Seiten der Werkzeuge setzen den Kopf in ein eigenes `<header>` mit ihrem
 * Einleitungssatz — dort scrollte er nach zwei Zeilen weg. Fest oben hängt es
 * an keinem Elternelement mehr; den Platz im Fluss hält `WERKZEUG_KOPF_PLATZ`.
 *
 * Ausnahme ohne Netz (Register N29): Die Zeile „Keine Verbindung …“ steht in
 * `<main>` über dem Inhalt (ui/netz-hinweis.tsx). Ein fester Kopf läge auf
 * ihr — solange sie da ist, klebt die Leiste wie früher (`sticky` im Rahmen
 * der Seite, `-mx-4 -mt-5` hebt dessen Polster `px-4 pt-5` auf) und der Platz
 * entfällt.
 */
export const WERKZEUG_KOPF_LEISTE =
  'fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-1 border-b border-border bg-card px-1 max-md:[main:has([data-netz-hinweis]_p)_&]:sticky max-md:[main:has([data-netz-hinweis]_p)_&]:-mx-4 max-md:[main:has([data-netz-hinweis]_p)_&]:-mt-5 max-md:[main:has([data-netz-hinweis]_p)_&]:mb-3 md:static md:z-auto md:mb-4 md:h-auto md:items-end md:gap-4 md:border-0 md:bg-transparent md:px-0 print:static print:h-auto print:border-0 print:bg-transparent'

/**
 * Der Platz der festen Leiste im Fluss (nur am Handy): so hoch wie die Leiste;
 * `-mt-5` hebt das obere Polster des Rahmens (`pt-5`) auf, der Inhalt beginnt
 * 12 px unter der Linie wie bisher. Ohne Netz entfällt er (die Leiste steht
 * dann selbst im Fluss, siehe oben).
 */
export const WERKZEUG_KOPF_PLATZ = '-mt-5 mb-3 h-14 md:hidden print:hidden max-md:[main:has([data-netz-hinweis]_p)_&]:hidden'

/** Die Spalte mit Rückweg (nur Web), h1 und Unterzeile. Ohne Rückweg am Handy links 12 px Luft statt des Knopfs. */
export const WERKZEUG_KOPF_SPALTE = 'flex min-w-0 flex-1 flex-col justify-center'

/** Der Titel: am Handy Fraunces 20 px in einer Zeile (die Leiste ist 56 px hoch), im Web 28 px und darf umbrechen. */
export const WERKZEUG_KOPF_TITEL =
  'truncate font-heading text-xl leading-tight font-semibold text-foreground md:text-[28px] md:leading-tight md:break-words md:whitespace-normal'
