/*
 * Die Maße der KundeShell für Inhalte, die genau den Platz zwischen Kopfzeile
 * und Unterleiste füllen (Kartenmodus auf /hoefe, Nachtlauf Nr. 52). Hier und
 * nicht unter components/shells: Komponenten binden keine Shell ein (Wache
 * „kein Big Bang" in tests/shells.test.ts) — Shell und Kartenmodus lesen
 * beide aus diesem reinen Modul. Ohne 'use client': Auch eine
 * Server-Komponente bekäme aus einem Client-Modul nur Verweise statt der
 * Klassen.
 *
 * EINE Quelle für die Karte: Die Shell setzt die Maße als CSS-Variablen an
 * ihren Rahmen und baut ihre Kopfzeile aus KUNDE_KOPF_ZEILE; der Kartenmodus
 * rechnet nur mit den Variablen, nie mit eigenen Zahlen.
 *
 * NICHT aus dieser Quelle: die Unterleiste selbst. `ui/bottom-nav.tsx` trägt
 * ihre Höhe (68 px, Linie oben) und den erhobenen Mittelknopf (-mt-5) selbst,
 * denn auch die HofShell nutzt sie. tests/kunde-shell-masse.test.ts koppelt
 * die Zahlen hier an diese Klassen (Wache) — wer die Leiste ändert, muss die
 * Variablen mitziehen. `main pb-28` der Shell ist die Luft unter dem
 * Seiteninhalt, keine Leistenhöhe.
 */

/** Die Zeile der Kopfzeile: 56 px, ab md 64 px; darunter 1 px Linie (border-b). */
export const KUNDE_KOPF_ZEILE = 'h-14 md:h-16'

/**
 * Die Maße am Rahmen der Shell:
 * - `--kunde-kopf`: Kopfzeile samt Linie (57 px, ab md 65 px);
 * - `--kunde-unterleiste`: Unterleiste samt Linie (68 + 1 px) und Abstand für
 *   den Home-Indicator — nur unter md, darüber gibt es keine Unterleiste;
 * - `--kunde-ueberstand`: so weit ragt der Mittelknopf (Warenkorb) über die
 *   Unterleiste hinaus (20 px, nur unter md).
 */
export const KUNDE_SHELL_MASSE =
  '[--kunde-kopf:57px] md:[--kunde-kopf:65px] [--kunde-unterleiste:calc(69px+env(safe-area-inset-bottom))] md:[--kunde-unterleiste:0px] [--kunde-ueberstand:20px] md:[--kunde-ueberstand:0px]'

/** Genau der Platz zwischen Kopfzeile und Unterleiste — ab md bis zum Fensterrand. */
export const KUNDE_PLATZ_HOEHE = 'h-[calc(100dvh-var(--kunde-kopf)-var(--kunde-unterleiste))]'
