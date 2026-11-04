/**
 * Offen-Datei des Gebühren-Worts für Nr. 226 (Kundschaft: Finden; Lauf 30, angelegt von Nr. 221).
 *
 * Die Fundstellen von „Servicegebühr“ ohne Bedingung in Dateien, die laut Dateigrenzen
 * Nr. 226 gehören. Nr. 226 stellt jede auf das Wort des Modells um (Hinweise der Hofseite und /fuer-hoefe je Modell; gebuehrGrundsatz aus konditionen.ts),
 * streicht den Eintrag und löscht die Datei, sobald sie leer ist. Ist eine Fundstelle
 * schon nur im Modell „bisher“ erreichbar, gehört sie mit diesem Grund in FESTE_LISTE von
 * tests/gebuehr-wort-wache.test.ts. Geglichen wird über Datei und Text (`stelle` nur zum
 * Finden, Zeile vom 4.11.2026); die Wache liest den ganzen Ordner.
 */
export const OFFEN: { stelle: string; text: string }[] = [
  { stelle: 'src/app/(public)/fuer-hoefe/page.tsx:23', text: 'Die Servicegebühr von' },
  { stelle: 'src/lib/hofseite-kunde.ts:252', text: '% Servicegebühr' },
  { stelle: 'src/lib/hofseite-kunde.ts:259', text: 'zzgl. Servicegebühr' },
  { stelle: 'src/lib/hofseite-kunde.ts:274', text: 'zzgl. Servicegebühr bei Online-Zahlung' },
]
