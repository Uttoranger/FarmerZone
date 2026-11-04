/**
 * Offen-Datei der Wortliste für Nr. 224 (Mein Hof, Einstellungen, Region; Lauf 30, angelegt von Nr. 219).
 *
 * Die Fundstellen der neuen „nicht"-Wörter aus N42 c und N43 in Dateien, die laut Dateigrenzen
 * Nr. 224 gehören. Nr. 224 stellt jeden Text auf das Wort der Tabelle um (docs/ai/DESIGN_SYSTEM.md,
 * „Wortliste"), streicht den Eintrag und löscht die Datei, sobald sie leer ist. Geglichen wird über
 * Datei, Wort und Text (`stelle` nur zum Finden, Zeile vom 4.11.2026); tests/wortliste.test.ts liest
 * den ganzen Ordner.
 */
export const OFFEN: { stelle: string; wort: string; text: string }[] = [
  { stelle: 'src/app/(hof)/settings/account/page.tsx:90', wort: 'Login-E-Mail', text: 'Deine aktuelle Login-E-Mail:' },
  { stelle: 'src/app/(hof)/settings/profile/page.tsx:11', wort: 'Hof-Profil', text: 'Hof-Profil' },
  { stelle: 'src/app/(hof)/settings/profile/page.tsx:31', wort: 'Hof-Seite', text: 'auf deiner öffentlichen Hof-Seite sichtbar' },
]
