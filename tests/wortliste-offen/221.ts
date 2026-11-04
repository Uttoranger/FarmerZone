/**
 * Offen-Datei der Wortliste für Nr. 221 (Gebühren-Texte und Gründungszeit; Lauf 30, angelegt von Nr. 219).
 *
 * Die Fundstellen der neuen „nicht"-Wörter aus N42 c und N43 in Dateien, die laut Dateigrenzen
 * Nr. 221 gehören. Nr. 221 stellt jeden Text auf das Wort der Tabelle um (docs/ai/DESIGN_SYSTEM.md,
 * „Wortliste"), streicht den Eintrag und löscht die Datei, sobald sie leer ist. Geglichen wird über
 * Datei, Wort und Text (`stelle` nur zum Finden, Zeile vom 4.11.2026); tests/wortliste.test.ts liest
 * den ganzen Ordner.
 *
 * Lesart (Bericht 219): 221 trägt die Wörter seiner Dateien selbst; die Datei steht trotzdem hier,
 * weil die Wache sonst rot wäre. src/lib/admin-aufgaben.ts gehört 221 (Grenze „Geld-Kachel“);
 * die Rücktritts-Texte der Aufgaben und des Protokolls stehen in derselben Datei und damit hier.
 */
export const OFFEN: { stelle: string; wort: string; text: string }[] = [
  { stelle: 'src/lib/admin-aufgaben.ts:669', wort: 'Widerruf', text: 'Widerruf offen' },
  { stelle: 'src/lib/admin-aufgaben.ts:681', wort: 'Widerruf', text: 'Widerruf ohne Bestellung' },
  { stelle: 'src/lib/admin-aufgaben.ts:683', wort: 'Widerruf', text: 'Der Widerruf passt zu keiner Bestellung.' },
  { stelle: 'src/lib/admin-aufgaben.ts:987', wort: 'Widerruf', text: 'Widerruf einer Bestellung zugeordnet' },
  { stelle: 'src/lib/admin-aufgaben.ts:988', wort: 'Widerruf', text: 'Widerruf abgelehnt (Hof)' },
  { stelle: 'src/lib/admin-finanzen-seite.ts:14', wort: 'Finanzen', text: 'Finanzen' },
  { stelle: 'src/lib/admin-finanzen-seite.ts:16', wort: 'Finanzen', text: 'Finanzen in Zahlen' },
  { stelle: 'src/lib/admin-finanzen-seite.ts:17', wort: 'Finanzen', text: 'Ansicht der Finanzen' },
  { stelle: 'src/lib/finanzen.ts:802', wort: 'Finanzen', text: 'Zeitraum der Finanzen' },
]
