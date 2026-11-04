/**
 * Offen-Datei der Wortliste für Nr. 225 (Hof-Werkzeuge; Lauf 30, angelegt von Nr. 219).
 *
 * Die Fundstellen der neuen „nicht"-Wörter aus N42 c und N43 in Dateien, die laut Dateigrenzen
 * Nr. 225 gehören. Nr. 225 stellt jeden Text auf das Wort der Tabelle um (docs/ai/DESIGN_SYSTEM.md,
 * „Wortliste"), streicht den Eintrag und löscht die Datei, sobald sie leer ist. Geglichen wird über
 * Datei, Wort und Text (`stelle` nur zum Finden, Zeile vom 4.11.2026); tests/wortliste.test.ts liest
 * den ganzen Ordner.
 *
 * „Mitteilung“ als Anlass eines Beitrags war bis Nr. 219 eine Ausnahme; seit N42 c heißt das Etikett
 * „Hinweis“ (das Enum ANNOUNCEMENT bleibt, tests/anlass-woerter-wache.test.ts).
 */
export const OFFEN: { stelle: string; wort: string; text: string }[] = [
  { stelle: 'src/app/(hof)/status/new/status-new-client.tsx:217', wort: 'Hof-Seite', text: 'auf der Hof-Seite' },
  { stelle: 'src/app/(hof)/status/new/status-new-client.tsx:331', wort: 'Hof-Seite', text: 'Auf der Hof-Seite steht die Anrede ohne Namen.' },
  { stelle: 'src/app/(hof)/status/new/status-new-client.tsx:478', wort: 'Hof-Seite', text: 'Auf meiner Hof-Seite anzeigen' },
  { stelle: 'src/app/(hof)/status/new/status-new-client.tsx:490', wort: 'E-Mail-Updates', text: 'E-Mail-Updates abonniert' },
  { stelle: 'src/app/(hof)/status/new/status-new-client.tsx:568', wort: 'Hof-Seite', text: 'Auf Hof-Seite für 7 Tage anzeigen' },
  { stelle: 'src/lib/beitrag-anlass.ts:32', wort: 'Mitteilung', text: 'Mitteilung' },
]
