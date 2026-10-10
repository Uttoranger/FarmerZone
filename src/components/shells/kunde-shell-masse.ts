/*
 * Die Maße der KundeShell — EINE Quelle für die Shell selbst und für Inhalte,
 * die genau den Platz zwischen Kopfzeile und Unterleiste füllen (Kartenmodus
 * auf /hoefe, Nachtlauf Nr. 52). Eigene Datei ohne 'use client': Auch eine
 * Server-Komponente bekäme aus einem Client-Modul nur Verweise statt der
 * Klassen.
 *
 * Die Shell setzt die Maße als CSS-Variablen an ihren Rahmen; wer rechnet,
 * nimmt die Variablen, nie eigene Zahlen. tests/kunde-shell-masse.test.ts
 * gleicht die Zahlen mit der Kopfzeile (kunde-shell.tsx) und der Unterleiste
 * (ui/bottom-nav.tsx: 68 px, Linie oben, Mittelknopf mit -mt-5) ab.
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
