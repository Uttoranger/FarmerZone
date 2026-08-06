// Lebenszeichen eines Hofes: was der Bauer seit der Anmeldung angelegt hat.
//
// Wozu: Seit die Registrierung offen ist, landen automatisierte Anmeldungen in
// der Liste. Das verlässlichste Unterscheidungsmerkmal ist Aktivität — ein Bot
// meldet sich an und kommt nie wieder, ein echter Bauer legt Produkte, Fotos
// oder Abholzeiten an. Der Admin-Bereich zeigt diese Zahlen bisher nicht.
//
// AUSDRÜCKLICH KEINE BEWERTUNG: keine Punktzahl, keine Ampel, keine
// Empfehlung, keine automatische Ablehnung. Hier stehen Zahlen, entschieden
// wird von Hand. Diese Datei rechnet deshalb nichts zusammen, sie beschriftet
// nur — analog zu gruendungshof.ts eine reine, ohne Datenbank testbare Einheit.

export type FarmAktivitaet = {
  produkte: number
  fotos: number
  abholzeiten: number
  hatBeschreibung: boolean
  hatLogo: boolean
}

/** Wortlaut, wenn ein Hof noch gar nichts eingerichtet hat. */
export const AKTIVITAET_LEER = 'Noch keine Inhalte'

function zahlwort(anzahl: number, einzahl: string, mehrzahl: string): string {
  return `${anzahl} ${anzahl === 1 ? einzahl : mehrzahl}`
}

/**
 * Die Bestandteile der Aktivitätszeile, z. B.
 * `['3 Produkte', '2 Fotos', '1 Abholzeit', 'Beschreibung']`.
 *
 * Was null ist, fehlt ganz — eine Zeile voller Nullen läse sich wie ein
 * Mangelbericht, und genau das soll sie nicht sein. Die Liste wird als
 * einzelne Elemente zurückgegeben statt als fertiger Satz, damit die Anzeige
 * bei 375px sauber umbrechen kann, statt eine lange Zeichenkette zu zerreißen.
 */
export function aktivitaetsTeile(a: FarmAktivitaet): string[] {
  const teile: string[] = []
  if (a.produkte > 0) teile.push(zahlwort(a.produkte, 'Produkt', 'Produkte'))
  if (a.fotos > 0) teile.push(zahlwort(a.fotos, 'Foto', 'Fotos'))
  if (a.abholzeiten > 0) teile.push(zahlwort(a.abholzeiten, 'Abholzeit', 'Abholzeiten'))
  if (a.hatBeschreibung) teile.push('Beschreibung')
  if (a.hatLogo) teile.push('Logo')
  return teile
}

/** Kein einziges Lebenszeichen — weder Zählwert noch Beschreibung noch Logo. */
export function istOhneInhalt(a: FarmAktivitaet): boolean {
  return aktivitaetsTeile(a).length === 0
}
