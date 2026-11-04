/**
 * Offen-Datei der Wortliste für Nr. 222 (Hof-Alltag; Lauf 30, angelegt von Nr. 219).
 *
 * Die Fundstellen der neuen „nicht"-Wörter aus N42 c und N43 in Dateien, die laut Dateigrenzen
 * Nr. 222 gehören. Nr. 222 stellt jeden Text auf das Wort der Tabelle um (docs/ai/DESIGN_SYSTEM.md,
 * „Wortliste"), streicht den Eintrag und löscht die Datei, sobald sie leer ist. Geglichen wird über
 * Datei, Wort und Text (`stelle` nur zum Finden, Zeile vom 4.11.2026); tests/wortliste.test.ts liest
 * den ganzen Ordner.
 */
export const OFFEN: { stelle: string; wort: string; text: string }[] = [
  { stelle: 'src/app/(druck)/orders/today/print/page.tsx:179', wort: 'Barzahlung vor Ort', text: 'Barzahlung vor Ort' },
]
