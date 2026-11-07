/*
 * Rundungen in Pixeln (Baustein G8, Nr. 245; Liste Lauf 32, Abschnitt 3.2).
 *
 * Warum feste Pixel statt `rounded-xl`/`rounded-2xl`: Diese Klassen rechnen
 * mit `--radius` (globals.css), und der wächst im neuen Design auf 1rem —
 * `rounded-xl` wird dort 22 px, `rounded-2xl` 29 px statt der 12/16 px der
 * Boards. Die Tokens in globals.css bleiben, wie sie sind (Bestandsseiten
 * nutzen sie); neuer Code nimmt diese Konstanten. Eigene Datei ohne
 * 'use client', damit auch Server-Komponenten die Klassen bekommen.
 *
 * tests/rundungen-wache.test.ts lässt `rounded-xl/2xl/3xl` nur noch in den
 * Dateien der Bestandsliste zu (tests/bestandslisten/rundungen.ts); die Liste
 * schrumpft mit jeder Seiten-Nummer.
 */

/** Die Maße in Pixeln — für Texte, Tests und die Vorschau. */
export const RUNDUNG_PX = {
  /** Karten, Kästen, Listen auf einer Fläche. */
  karte: 12,
  /** Eingabefelder, Auswahl, kleine Einträge (Seitenleiste). */
  feld: 10,
  /** Hinweiskasten und Hof-Balken (G3). */
  hinweis: 12,
  /** Blätter von unten und Dialoge im Blatt. */
  blatt: 16,
} as const

export type RundungArt = keyof typeof RUNDUNG_PX

/**
 * Die Klassen dazu. Als ausgeschriebene Literale, damit Tailwind sie beim
 * Bau findet (kein zusammengesetzter Klassenname).
 */
export const RUNDUNG = {
  karte: 'rounded-[12px]',
  feld: 'rounded-[10px]',
  hinweis: 'rounded-[12px]',
  blatt: 'rounded-[16px]',
} as const satisfies Record<RundungArt, string>
