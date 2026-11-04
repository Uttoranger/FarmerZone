/**
 * Offen-Datei des Gebühren-Worts für Nr. 231 (Rechtstexte, Rücktrittsrecht, Fehlerseiten; Lauf 30, angelegt von Nr. 221).
 *
 * Die Fundstellen von „Servicegebühr“ ohne Bedingung in Dateien, die laut Dateigrenzen
 * Nr. 231 gehören. Nr. 231 stellt jede auf das Wort des Modells um (Abschnitt und Beschreibung über konditionenGebuehrAbschnitt bzw. gebuehrGrundsatz),
 * streicht den Eintrag und löscht die Datei, sobald sie leer ist. Ist eine Fundstelle
 * schon nur im Modell „bisher“ erreichbar, gehört sie mit diesem Grund in FESTE_LISTE von
 * tests/gebuehr-wort-wache.test.ts. Geglichen wird über Datei und Text (`stelle` nur zum
 * Finden, Zeile vom 4.11.2026); die Wache liest den ganzen Ordner.
 */
export const OFFEN: { stelle: string; text: string }[] = [
  { stelle: 'src/app/(public)/konditionen/page.tsx:39', text: 'Die Servicegebühr von' },
  { stelle: 'src/app/(public)/konditionen/page.tsx:116', text: 'Servicegebühr und Abrechnung' },
]
