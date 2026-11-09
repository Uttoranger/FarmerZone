/**
 * Bilder und Illustrationen im Dunkeln — EINE Quelle für Hofseite, Produktseite, /hoefe und die Startseite
 * (vorher doppelt in `hofseite/produkt-karte.tsx` und `hoefe/hof-bildflaeche.tsx`, Nr. 234/235). Bewusst ein Modul
 * ohne `'use client'`: Eine Server-Komponente (Startseite) bekäme aus einem Client-Modul nur einen Verweis statt
 * der Klassen.
 *
 * Die Kategorie-Illustration steht im Dunkeln wie ein Foto (F041, Projektleitung 9.11.2026; freigabe.md §37.1,
 * Register N48): auf ihrem eigenen hellen Grund, nur leicht gedämpft — dieselbe Dämpfung wie ein Foto
 * (`ILLUSTRATION_HUELLE` = `FOTO_HUELLE`) — und gerahmt (Rand an der Hülle, kein schwebendes helles Quadrat).
 * Sie wird nicht mehr mit der Fläche verrechnet: Die Mischung ließ von der Zeichnung nur dunkle Umrisse übrig.
 * Die Regel „keine hellen Flecken“ (Maßstab §35 Punkt 4) gilt für Illustrationen nicht mehr, für Kartenkacheln
 * und Platzhalter ohne Bild weiter. Am Tag unverändert.
 */
/** Ein Foto des Hofs im Dunkeln: leicht gedämpft über die Hülle — ein Inline-Filter des Hofs bleibt am Bild. */
export const FOTO_HUELLE = 'dark:brightness-[0.85]'
// Verweis statt zweitem Literal; FOTO_HUELLE steht davor, sonst griffe der Verweis beim Laden ins Leere.
export const ILLUSTRATION_HUELLE = FOTO_HUELLE
/** Bleibt als leerer Export, damit kein Aufrufer geändert werden muss (F041: keine Mischung mehr am Bild). */
export const ILLUSTRATION_BILD = ''

/*
 * G12 (Lauf 32, Nr. 248): ALLE Bildflächen und Platzhalter im Dunkeln über diese Datei — Titelbild, Produktbild,
 * Vorschaubilder, Video (FOTO_HUELLE), dazu die Platzhalter ohne Foto und die Karten. Die Seiten-Nummern ziehen
 * ihre Stellen hierher um; neue Stellen nehmen nur diese Konstanten.
 */

/**
 * Die Fläche einer Bildstelle ohne Foto (Titelbild-, Produkt- und Vorschaubild-Platzhalter): die gedämpfte Fläche
 * des Themas, ohne eigenen Verlauf oder Grünton — sonst stand im Dunkeln ein heller Fleck bzw. eine mittelgrüne
 * Fläche (Abnahme Lauf 31, G12). Eine Illustration darauf nimmt zusätzlich `ILLUSTRATION_HUELLE` (gedämpft wie ein Foto, F041).
 */
export const PLATZHALTER_FLAECHE = 'bg-muted'

/**
 * Karten im Dunkeln (Kartenkacheln auf /hoefe, Regionskarte der Startseite; CODING_STANDARDS §7): Die hellen
 * Kacheln werden mit der Fläche der Hülle multipliziert, statt als beiges Rechteck zu leuchten. Die Hülle trägt die
 * Fläche und trennt die Mischung vom Rest der Seite (`isolate`); NUR die Kachel-Ebene bekommt `KARTE_KACHELN` —
 * Pins, Gruppen-Pins und Beschriftungen liegen darüber und bleiben, wie sie sind.
 */
export const KARTE_HUELLE = 'isolate dark:bg-muted'
export const KARTE_KACHELN = 'dark:mix-blend-multiply'
