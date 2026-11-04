/**
 * Offen-Datei des Gebühren-Worts für Nr. 232 (E-Mails; Lauf 30, angelegt von Nr. 221, Runde 1).
 *
 * Die Fundstellen von „Servicegebühr“ ohne Bedingung in Dateien, die laut Dateigrenzen
 * Nr. 232 gehören. Nr. 232 stellt jede auf das Wort des Modells um (Gebührenzeile und Hinweis der Bestellmails mit dem Wort der Bestellung, wie gebuehrWort(order) in src/lib/email.ts; dazu (Entscheidung des Dirigenten, Runde 1 von Nr. 221) die Wochenlage-Mail in src/lib/wochenlage.ts),
 * streicht den Eintrag und löscht die Datei, sobald sie leer ist. Ist eine Fundstelle
 * schon nur im Modell „bisher“ erreichbar, gehört sie mit diesem Grund in FESTE_LISTE von
 * tests/gebuehr-wort-wache.test.ts. Geglichen wird über Datei und Text (`stelle` nur zum
 * Finden, Zeile vom 4.11.2026); die Wache liest den ganzen Ordner.
 *
 * Einträge mit „ · “ sind Rückfälle auf die Fassung „bisher“ ohne das Wort im Text
 * (Wert aus RUECKFALL_WERTE, Wort-Helfer ohne Wort, Leser einer festgehaltenen Vorgabe):
 * umzustellen wie oben.
 */
export const OFFEN: { stelle: string; text: string }[] = [
  { stelle: 'src/emails/onsite-confirmation.tsx:92', text: 'SERVICEGEBUEHR_BEZEICHNUNG · {mitGebuehr && <BetragsZeile links={SERVICEGEBUEHR_BEZEICHNUNG}' },
  { stelle: 'src/emails/onsite-confirmation.tsx:97', text: 'SERVICEGEBUEHR_BEZEICHNUNG · {SERVICEGEBUEHR_BEZEICHNUNG}: {SERVICEGEBUEHR_HINWEIS}' },
  { stelle: 'src/emails/order-confirmation.tsx:96', text: 'SERVICEGEBUEHR_BEZEICHNUNG · {mitGebuehr && <BetragsZeile links={SERVICEGEBUEHR_BEZEICHNUNG}' },
  { stelle: 'src/emails/order-confirmation.tsx:125', text: 'SERVICEGEBUEHR_BEZEICHNUNG · {mitGebuehr && <Text style={kleinText}>{SERVICEGEBUEHR_BEZEICHNUNG}: {SERVICEGEBUEHR_HINWEIS}</Text>}' },
  { stelle: 'src/lib/wochenlage.ts:56', text: 'Servicegebühr' },
]
