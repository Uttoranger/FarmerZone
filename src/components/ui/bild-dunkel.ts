/**
 * Bilder und Illustrationen im Dunkeln (Freigabe Lauf 31, Maßstab Punkt 4: keine hellen Flecken) — EINE Quelle
 * für Hofseite, Produktseite, /hoefe und die Startseite (vorher doppelt in `hofseite/produkt-karte.tsx` und
 * `hoefe/hof-bildflaeche.tsx`, Nr. 234/235). Bewusst ein Modul ohne `'use client'`: Eine Server-Komponente
 * (Startseite) bekäme aus einem Client-Modul nur einen Verweis statt der Klassen.
 *
 * Die Kategorie-Illustration: Ihr Crème-Grund leuchtete mit `brightness` allein noch als hellgraues Quadrat auf
 * der dunklen Karte. Darum wird das Bild im Dunkeln mit der Fläche der Hülle (`bg-muted`) multipliziert
 * (`ILLUSTRATION_BILD`): Der Grund wird zur Fläche, die Zeichnung bleibt als dunkle, gedämpfte Form; die Hülle
 * hellt das Ergebnis danach etwas auf (`ILLUSTRATION_HUELLE`), damit die Form lesbar bleibt — ihr Filter trennt
 * die Mischung vom Rest der Seite. Am Tag unverändert.
 */
export const ILLUSTRATION_HUELLE = 'dark:brightness-[1.6]'
export const ILLUSTRATION_BILD = 'dark:mix-blend-multiply'
/** Ein Foto des Hofs im Dunkeln: leicht gedämpft über die Hülle — ein Inline-Filter des Hofs bleibt am Bild. */
export const FOTO_HUELLE = 'dark:brightness-[0.85]'

/*
 * G12 (Lauf 32, Nr. 248): ALLE Bildflächen und Platzhalter im Dunkeln über diese Datei — Titelbild, Produktbild,
 * Vorschaubilder, Video (FOTO_HUELLE), dazu die Platzhalter ohne Foto und die Karten. Die Seiten-Nummern ziehen
 * ihre Stellen hierher um; neue Stellen nehmen nur diese Konstanten.
 */

/**
 * Die Fläche einer Bildstelle ohne Foto (Titelbild-, Produkt- und Vorschaubild-Platzhalter): die gedämpfte Fläche
 * des Themas, ohne eigenen Verlauf oder Grünton — sonst stand im Dunkeln ein heller Fleck bzw. eine mittelgrüne
 * Fläche (Abnahme Lauf 31, G12). Eine Illustration darauf nimmt zusätzlich `ILLUSTRATION_HUELLE`/`ILLUSTRATION_BILD`.
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
