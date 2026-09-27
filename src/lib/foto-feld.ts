/**
 * Die zwei Griffe an ein Datei-Feld — und wann jeder erlaubt ist.
 *
 * Anlass JAVASCRIPT-NEXTJS-4: foto-quellen.tsx leerte das Feld im onChange,
 * unmittelbar nach der Auswahl. Auf Android-Chrome zieht genau das die
 * Leseerlaubnis für ein Foto aus der Galerie zurück — die Datei-Referenz lebt
 * weiter, aber ihre Bytes kommen nicht mehr heraus: Probe und Volllesen
 * scheiterten nach 84 und 14 ms mit NotReadableError („permission problems …
 * after a reference to a file was acquired"), bei einem Foto, das 0 Tage alt
 * war. Ein Cloud-Album war es also nicht. Am schwersten wog es im
 * Produktdialog: Dort wird die Datei erst beim Absenden gelesen, Minuten
 * später.
 *
 * Daraus die Reihenfolge, die diese beiden Funktionen festhalten:
 *
 *   leereDateiFeld   VOR dem Öffnen des Auswahldialogs (onClick)
 *   dateienAusFeld   nach der Auswahl (onChange) — liest, ändert nichts
 *
 * Beides bleibt damit erhalten: Dieselbe Datei lässt sich weiter zweimal
 * hintereinander wählen (das Feld ist beim Öffnen leer, also feuert `change`
 * auch bei gleichem Namen), und keine Auswahl wird entwertet, solange sie
 * gelesen oder übertragen wird.
 *
 * Rein und ohne DOM, damit die Reihenfolge ohne Browser prüfbar ist — in
 * dieser Umgebung gibt es kein Rendering (TESTING_GUIDELINES §1).
 */

/** Das Nötige an einem `<input type="file">` — mehr braucht keine der beiden Funktionen. */
export type DateiFeld = {
  value: string
  files?: ArrayLike<File> | null
}

/**
 * Leert das Feld, damit der nächste Auswahldialog auch bei derselben Datei ein
 * `change` auslöst. Gehört an den Klick, nie an die Auswahl.
 */
export function leereDateiFeld(feld: DateiFeld): void {
  feld.value = ''
}

/**
 * Die gewählten Dateien — das Feld bleibt unangetastet.
 *
 * Kein Zurücksetzen hier: Solange diese Dateien noch gelesen oder übertragen
 * werden, entwertet jeder Schreibzugriff auf `value` sie auf Android.
 */
export function dateienAusFeld(feld: DateiFeld): File[] {
  return Array.from(feld.files ?? [])
}
