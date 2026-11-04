/**
 * Offen-Datei des Gebühren-Worts für Nr. 229 (Admin Teil 1; Lauf 30, angelegt von Nr. 221).
 *
 * Die Fundstellen von „Servicegebühr“ ohne Bedingung in Dateien, die laut Dateigrenzen
 * Nr. 229 gehören. Nr. 229 stellt jede auf das Wort des Modells um (Aktivität mit gebuehrWortFuerZeitraum; Knopf „Servicegebühr …“ nach A1 ab dem Stichtag nicht zeigen),
 * streicht den Eintrag und löscht die Datei, sobald sie leer ist. Ist eine Fundstelle
 * schon nur im Modell „bisher“ erreichbar, gehört sie mit diesem Grund in FESTE_LISTE von
 * tests/gebuehr-wort-wache.test.ts. Geglichen wird über Datei und Text (`stelle` nur zum
 * Finden, Zeile vom 4.11.2026); die Wache liest den ganzen Ordner.
 */
export const OFFEN: { stelle: string; text: string }[] = [
  { stelle: 'src/components/admin/hof-akte-ansicht.tsx:140', text: 'Servicegebühr' },
  { stelle: 'src/components/admin/hof-akte-ansicht.tsx:195', text: 'Servicegebühr …' },
]
