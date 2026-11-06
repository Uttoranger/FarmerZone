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
