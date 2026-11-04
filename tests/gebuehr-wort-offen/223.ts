/**
 * Offen-Datei des Gebühren-Worts für Nr. 223 (Produkte und Produkt-Formulare; Lauf 30, angelegt von Nr. 221).
 *
 * Die Fundstellen von „Servicegebühr“ ohne Bedingung in Dateien, die laut Dateigrenzen
 * Nr. 223 gehören. Nr. 223 stellt jede auf das Wort des Modells um (Futter-Vorschau je Stichtag über gebuehrModellFuer),
 * streicht den Eintrag und löscht die Datei, sobald sie leer ist. Ist eine Fundstelle
 * schon nur im Modell „bisher“ erreichbar, gehört sie mit diesem Grund in FESTE_LISTE von
 * tests/gebuehr-wort-wache.test.ts. Geglichen wird über Datei und Text (`stelle` nur zum
 * Finden, Zeile vom 4.11.2026); die Wache liest den ganzen Ordner.
 */
export const OFFEN: { stelle: string; text: string }[] = [
  { stelle: 'src/components/produkte/futter-formular.tsx:647', text: 'Die Servicegebühr zahlt die Kundin zusätzlich.' },
]
