// Initialen eines Hofnamens für die Identitätskarte in der Navigation.
//
// Sie treten an die Stelle des Logos, solange keines hochgeladen ist. Bewusst
// KEIN Platzhalter-Bildsymbol: ein durchgestrichenes Bild-Icon sieht aus wie
// ein Fehler, und der Bauer hat keinen gemacht — er hat nur noch kein Logo.
// Zwei Buchstaben auf Sandfläche sehen aus wie eine Entscheidung.
//
// Reine Funktion ohne DOM, damit die Ableitung ohne Browser prüfbar ist.

/**
 * Erster Buchstabe eines Wortes, groß.
 *
 * `[...wort][0]` statt `wort[0]`, damit ein Zeichen außerhalb der Basisebene
 * (Emoji im Hofnamen) nicht in der Mitte zerschnitten wird. Das abschließende
 * `slice(1)` fängt „ß", das beim Großschreiben zu „SS" wird und sonst allein
 * schon zwei Zeichen belegte.
 */
function ersterBuchstabe(wort: string): string {
  const zeichen = [...wort][0] ?? ''
  return zeichen.toLocaleUpperCase('de-AT').slice(0, 1)
}

/**
 * Bis zu zwei Initialen aus einem Hofnamen.
 *
 *   'Hof Müller'      → 'HM'
 *   'Müllerhof'       → 'M'
 *   'Öko-Hof Ötscher' → 'ÖH'
 *
 * Getrennt wird an Leerzeichen UND Bindestrichen: „Öko-Hof" ist gesprochen
 * zwei Wörter, und „ÖH" liest sich besser als ein einsames „Ö". Ziffern zählen
 * mit, damit „4-Jahreszeiten-Hof" nicht leer ausgeht.
 */
export function hofInitialen(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter((wort) => wort.length > 0)
    .slice(0, 2)
    .map(ersterBuchstabe)
    .join('')
}
