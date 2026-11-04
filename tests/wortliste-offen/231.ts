/**
 * Offen-Datei der Wortliste für Nr. 231 (Rechtstexte, Rücktrittsrecht, Fehlerseiten; Lauf 30, angelegt von Nr. 219).
 *
 * Die Fundstellen der neuen „nicht"-Wörter aus N42 c und N43 in Dateien, die laut Dateigrenzen
 * Nr. 231 gehören. Nr. 231 stellt jeden Text auf das Wort der Tabelle um (docs/ai/DESIGN_SYSTEM.md,
 * „Wortliste"), streicht den Eintrag und löscht die Datei, sobald sie leer ist. Geglichen wird über
 * Datei, Wort und Text (`stelle` nur zum Finden, Zeile vom 4.11.2026); tests/wortliste.test.ts liest
 * den ganzen Ordner.
 *
 * Nicht hier, weil Ausnahme nach N43 (1) bzw. (2) in tests/wortliste.test.ts: „Vertrag widerrufen“
 * und „Widerruf bestätigen“ (N39) und die BELEHRUNG. Die Ausnahme „Vertrag widerrufen“ deckt jeden
 * Text mit genau diesem Wortlaut in src/lib/widerruf.ts — also auch WIDERRUF_TEXT.titel, das nach
 * N43 „Rücktrittsrecht“ heißt: 231 stellt es trotzdem um (die Wache meldet es nicht). Lesart
 * (Bericht 219): Die Sätze in WIDERRUF_ADMIN_TEXT stehen in derselben Datei und damit hier, obwohl
 * die Grenze von 231 „nur WIDERRUF_TEXT“ nennt.
 */
export const OFFEN: { stelle: string; wort: string; text: string }[] = [
  { stelle: 'src/lib/widerruf.ts:219', wort: 'Widerruf', text: 'ordne den Widerruf zu' },
  { stelle: 'src/lib/widerruf.ts:223', wort: 'Widerruf', text: 'Widerruf einer Bestellung zuordnen' },
  { stelle: 'src/lib/widerruf.ts:224', wort: 'Widerruf', text: 'danach geht der Widerruf an den Hof.' },
  { stelle: 'src/lib/widerruf.ts:230', wort: 'Widerruf', text: 'Dieser Widerruf ist schon zugeordnet.' },
  { stelle: 'src/lib/widerruf.ts:232', wort: 'Widerruf', text: 'Der Hof hat den Widerruf im Postfach.' },
  { stelle: 'src/lib/widerruf.ts:233', wort: 'Widerruf', text: 'Zu Bestellungen dieses Hofs gibt es keinen Widerruf.' },
  { stelle: 'src/lib/widerruf.ts:243', wort: 'widerrufen', text: 'Hier kannst du deinen Kaufvertrag mit dem Hof widerrufen.' },
  { stelle: 'src/lib/widerruf.ts:243', wort: 'Widerruf', text: 'leitet deinen Widerruf an ihn weiter' },
  { stelle: 'src/lib/widerruf.ts:253', wort: 'widerrufen', text: 'Was willst du widerrufen?' },
  { stelle: 'src/lib/widerruf.ts:262', wort: 'Widerruf', text: 'Bitte prüfe deinen Widerruf' },
  { stelle: 'src/lib/widerruf.ts:263', wort: 'Widerruf', text: 'schickst du den Widerruf ab.' },
  { stelle: 'src/lib/widerruf.ts:265', wort: 'Widerruf', text: 'Dein Widerruf ist bei uns eingegangen' },
  { stelle: 'src/lib/widerruf.ts:269', wort: 'Widerruf', text: 'Wir leiten deinen Widerruf an ihn weiter.' },
  { stelle: 'src/lib/widerruf.ts:276', wort: 'Widerruf', text: 'Wir konnten deinen Widerruf nicht speichern.' },
  { stelle: 'src/lib/widerruf.ts:277', wort: 'widerrufen', text: 'Diese Bestellung lässt sich hier nicht mehr widerrufen.' },
  { stelle: 'src/lib/widerruf.ts:280', wort: 'Widerruf', text: 'Widerruf eingegangen' },
  { stelle: 'src/lib/widerruf.ts:281', wort: 'widerrufen', text: 'Eine Kundin hat einen Kauf widerrufen.' },
  { stelle: 'src/lib/widerruf.ts:281', wort: 'widerrufen', text: 'Kundinnen haben einen Kauf widerrufen.' },
  { stelle: 'src/lib/widerruf.ts:292', wort: 'Widerruf', text: 'Widerruf zu Bestellung' },
]
