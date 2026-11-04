/**
 * Offen-Datei des Gebühren-Worts für Nr. 230 (Admin Teil 2; Lauf 30, angelegt von Nr. 221).
 *
 * Die Fundstellen von „Servicegebühr“ ohne Bedingung in Dateien, die laut Dateigrenzen
 * Nr. 230 gehören. Nr. 230 stellt jede auf das Wort des Modells um (Kennzahl, Abgleich-Satz und Regel mit gebuehrWortFuerMonat bzw. gebuehrWortFuerZeitraum),
 * streicht den Eintrag und löscht die Datei, sobald sie leer ist. Ist eine Fundstelle
 * schon nur im Modell „bisher“ erreichbar, gehört sie mit diesem Grund in FESTE_LISTE von
 * tests/gebuehr-wort-wache.test.ts. Geglichen wird über Datei und Text (`stelle` nur zum
 * Finden, Zeile vom 4.11.2026); die Wache liest den ganzen Ordner.
 */
export const OFFEN: { stelle: string; text: string }[] = [
  { stelle: 'src/app/admin/geld/page.tsx:158', text: 'Betrag, Servicegebühr und Erstattung gleich' },
  { stelle: 'src/app/admin/geld/texte.ts:22', text: 'als Kosten neben der Servicegebühr' },
]
