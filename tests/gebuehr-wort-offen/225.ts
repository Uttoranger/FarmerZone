/**
 * Offen-Datei des Gebühren-Worts für Nr. 225 (Hof-Werkzeuge; Lauf 30, angelegt von Nr. 221).
 *
 * Die Fundstellen von „Servicegebühr“ ohne Bedingung in Dateien, die laut Dateigrenzen
 * Nr. 225 gehören. Nr. 225 stellt jede auf das Wort des Modells um (Gebühren-Karte mit gebuehrWortFuerZeitraum; Postfach-Wörter über gebuehrBezeichnungFuer),
 * streicht den Eintrag und löscht die Datei, sobald sie leer ist. Ist eine Fundstelle
 * schon nur im Modell „bisher“ erreichbar, gehört sie mit diesem Grund in FESTE_LISTE von
 * tests/gebuehr-wort-wache.test.ts. Geglichen wird über Datei und Text (`stelle` nur zum
 * Finden, Zeile vom 4.11.2026); die Wache liest den ganzen Ordner.
 */
export const OFFEN: { stelle: string; text: string }[] = [
  { stelle: 'src/components/auswertung/auswertung-teile.tsx:317', text: 'Servicegebühren dieses Monats' },
  { stelle: 'src/lib/postfach.ts:763', text: 'Online bezahlt (Waren und Servicegebühr)' },
]
