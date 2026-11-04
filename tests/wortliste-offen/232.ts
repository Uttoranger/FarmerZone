/**
 * Offen-Datei der Wortliste für Nr. 232 (E-Mails; Lauf 30, angelegt von Nr. 219).
 *
 * Die Fundstellen der neuen „nicht"-Wörter aus N42 c und N43 in Dateien, die laut Dateigrenzen
 * Nr. 232 gehören. Nr. 232 stellt jeden Text auf das Wort der Tabelle um (docs/ai/DESIGN_SYSTEM.md,
 * „Wortliste"), streicht den Eintrag und löscht die Datei, sobald sie leer ist. Geglichen wird über
 * Datei, Wort und Text (`stelle` nur zum Finden, Zeile vom 4.11.2026); tests/wortliste.test.ts liest
 * den ganzen Ordner.
 *
 * Nicht hier, weil Ausnahme „Recht prüft“ (Betreff der Eingangsbestätigung nach § 13a FAGG):
 * „Dein Widerruf ist eingegangen“ in src/emails/widerruf.tsx und src/lib/email.ts.
 */
export const OFFEN: { stelle: string; wort: string; text: string }[] = [
  { stelle: 'src/emails/new-order-notification.tsx:81', wort: 'Dashboard', text: 'Im Dashboard ansehen →' },
  { stelle: 'src/emails/order-confirmed.tsx:37', wort: 'Vor-Ort-Bestellung', text: 'Vor-Ort-Bestellung' },
  { stelle: 'src/emails/order-confirmed.tsx:38', wort: 'Vor-Ort-Bestellung', text: 'Vor-Ort-Bestellung bestätigt' },
  { stelle: 'src/emails/order-confirmed.tsx:92', wort: 'Dashboard', text: 'Im Dashboard ansehen →' },
  { stelle: 'src/emails/password-reset.tsx:18', wort: 'Button', text: 'Klicke auf den Button unten' },
  { stelle: 'src/emails/status-update.tsx:106', wort: 'E-Mail-Updates', text: 'weil du E-Mail-Updates für' },
  { stelle: 'src/emails/widerruf.tsx:31', wort: 'Widerruf', text: 'Wir haben deinen Widerruf am' },
  { stelle: 'src/emails/widerruf.tsx:69', wort: 'Widerruf', text: 'Widerruf zu Bestellung' },
  { stelle: 'src/emails/widerruf.tsx:70', wort: 'widerrufen', text: 'Eine Kundin hat widerrufen' },
  { stelle: 'src/emails/widerruf.tsx:72', wort: 'Widerruf', text: 'ein Widerruf eingegangen.' },
  { stelle: 'src/emails/widerruf.tsx:105', wort: 'Widerruf', text: 'Dein Widerruf wurde abgelehnt' },
  { stelle: 'src/emails/widerruf.tsx:105', wort: 'Widerruf', text: 'Dein Widerruf ist zum Teil erledigt' },
  { stelle: 'src/emails/widerruf.tsx:105', wort: 'Widerruf', text: 'Dein Widerruf ist erledigt' },
  { stelle: 'src/emails/widerruf.tsx:112', wort: 'Widerruf', text: 'hat deinen Widerruf zur Bestellung' },
  { stelle: 'src/lib/email.ts:1128', wort: 'Vor-Ort-Bestellung', text: 'Neue Vor-Ort-Bestellung für' },
  { stelle: 'src/lib/email.ts:1469', wort: 'Widerruf', text: 'Widerruf zu Bestellung' },
  { stelle: 'src/lib/email.ts:1490', wort: 'Widerruf', text: 'Dein Widerruf wurde abgelehnt ·' },
  { stelle: 'src/lib/email.ts:1492', wort: 'Widerruf', text: 'Dein Widerruf ist zum Teil erledigt ·' },
  { stelle: 'src/lib/email.ts:1493', wort: 'Widerruf', text: 'Dein Widerruf ist erledigt ·' },
]
