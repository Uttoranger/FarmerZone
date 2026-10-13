/**
 * Telefonnummern einheitlich anzeigen (Register N8): „+43 660 000 0000“ —
 * Ländercode, Vorwahl, der Rest in Dreier- und Vierergruppen. Gespeichert bleibt,
 * was jemand eingegeben hat; hier entstehen nur die Anzeige und der tel:-Link.
 *
 * Gelesen wird nur, was sich eindeutig lesen lässt: Ziffern, Leerraum und die
 * üblichen Trenner. Alles andere (Buchstaben, „ab 18 Uhr“, zwei Nummern in einem
 * Feld) kommt unverändert zurück — lieber die Eingabe zeigen als eine Nummer
 * erraten, die nicht stimmt.
 */

/** Mehr Ziffern hat keine Nummer samt Ländercode (E.164). */
const MAX_ZIFFERN = 15

/** Ziffern, Leerraum und die üblichen Trenner; ein „+“ nur ganz vorn. */
const LESBAR = /^\+?[\d\s()./-]+$/

/**
 * Ohne 0, 00 und + ist nur eine Mobil-Vorwahl (65x–69x) eindeutig österreichisch
 * — so tippen Höfe ihre Nummer oft („664 0000000“, auch „43 664 …“). Bei Festnetz
 * ohne 0 würde geraten.
 */
const MOBIL_OHNE_NULL = /^(?:43)?6[5-9]\d/

/**
 * Wie viele Ziffern der Ländercode hat (E.164): eine bei 1 und 7, drei in den
 * Blöcken 21x–26x, 29x, 35x, 37x, 38x, 42x, 50x, 59x, 67x–69x, 85x, 87x, 88x,
 * 96x, 97x und 99x (etwa 421 für die Slowakei), sonst zwei (43, 49, 41 …).
 */
const LAENDERCODE = /^(?:[17]|(?:2[1-69]|3[578]|42|50|59|6[789]|8[578]|9[679])\d|\d\d)/

/**
 * Festnetz-Vorwahlen mit drei Stellen (ohne die 0): Graz, Klagenfurt, Innsbruck,
 * Salzburg, Linz. Wien hat eine, alle anderen Orte vier (St. Pölten 2742,
 * Bregenz 5574, Wels 7242 …); die Mobil-Vorwahlen 65x–69x haben drei. Nummern
 * aus den Sonderbereichen (0720, 0800, 0900 …) bekommen vier: Dann weicht nur die
 * Gruppierung ab, die Ziffern nie.
 */
const DREISTELLIGE_ORTE = new Set(['316', '463', '512', '662', '732'])

type Nummer = {
  /** Ländercode ohne „+“, etwa „43“. */
  land: string
  /** Die Nummer ohne Ländercode und ohne Wahl-Null. */
  national: string
}

function vorwahlLaenge(national: string): number {
  if (national.startsWith('1')) return 1
  if (/^6[5-9]/.test(national) || DREISTELLIGE_ORTE.has(national.slice(0, 3))) return 3
  return 4
}

/** Von links in Dreiergruppen; was überbleibt, macht die letzten ein oder zwei Gruppen zu Vierern (7 → 3+4, 8 → 4+4, 10 → 3+3+4). */
function inGruppen(ziffern: string): string[] {
  const anzahl = ziffern.length
  // Aus Dreiern und Vierern lässt sich keine Fünf bilden; bis fünf Ziffern bleiben beisammen.
  if (anzahl <= 5) return [ziffern]
  const vierer = anzahl % 3
  const dreier = (anzahl - vierer * 4) / 3
  const gruppen: string[] = []
  let stelle = 0
  for (const laenge of [...Array<number>(dreier).fill(3), ...Array<number>(vierer).fill(4)]) {
    gruppen.push(ziffern.slice(stelle, stelle + laenge))
    stelle += laenge
  }
  return gruppen
}

/** Die Nummer in ihre Teile zerlegt — oder null, wenn sie sich nicht eindeutig lesen lässt. */
function liesNummer(eingabe: string): Nummer | null {
  const text = eingabe.trim()
  if (!LESBAR.test(text)) return null
  const ziffern = text.replace(/\D/g, '')

  let international: string
  if (text.startsWith('+')) international = ziffern
  else if (ziffern.startsWith('00')) international = ziffern.slice(2)
  else if (ziffern.startsWith('0')) international = `43${ziffern.slice(1)}`
  else if (MOBIL_OHNE_NULL.test(ziffern)) international = ziffern.startsWith('43') ? ziffern : `43${ziffern}`
  else return null

  if (!/^[1-9]/.test(international)) return null
  const land = LAENDERCODE.exec(international)?.[0]
  if (!land) return null

  if (land === '43') {
    // „+43 (0) 660 …“: Die 0 gehört zur Wahl im Inland, nicht zur Nummer. Österreichische Nummern haben 7 bis 13 Ziffern.
    const national = international.slice(2).replace(/^0/, '')
    return /^[1-9]\d{6,12}$/.test(national) ? { land, national } : null
  }
  const national = international.slice(land.length)
  return /^\d{5,}$/.test(national) && international.length <= MAX_ZIFFERN ? { land, national } : null
}

/**
 * So steht eine Telefonnummer in Anzeigen: „+43 660 000 0000“. Eine Eingabe, die
 * sich nicht eindeutig lesen lässt, kommt unverändert zurück, nie leer. Bei
 * fremden Ländercodes ist die Ortsvorwahl unbekannt; dort bestimmen allein die
 * Dreier- und Vierergruppen, wo die Leerzeichen stehen.
 */
export function formatiereTelefon(eingabe: string): string {
  const nummer = liesNummer(eingabe)
  if (!nummer) return eingabe
  const vorwahl = nummer.land === '43' ? vorwahlLaenge(nummer.national) : 0
  const teile = [`+${nummer.land}`]
  if (vorwahl > 0) teile.push(nummer.national.slice(0, vorwahl))
  return [...teile, ...inGruppen(nummer.national.slice(vorwahl))].join(' ')
}

/**
 * Der Link zum Anrufen: `tel:+436600000000`, aus denselben Ziffern, die die
 * Anzeige zeigt. Lässt sich die Eingabe nicht eindeutig lesen (zwei Nummern in
 * einem Feld, „ab 18 Uhr“, keine oder zu viele Ziffern), gibt es keinen Link: Er
 * wählte sonst eine andere Nummer, als dort steht. Wer den Link weglässt, zeigt
 * die Nummer als Text — `formatiereTelefon` gibt die Eingabe dann unverändert zurück.
 */
export function telefonLink(eingabe: string): string | null {
  const nummer = liesNummer(eingabe)
  return nummer ? `tel:+${nummer.land}${nummer.national}` : null
}
