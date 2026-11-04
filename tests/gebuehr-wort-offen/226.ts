/**
 * Offen-Datei des Gebühren-Worts für Nr. 226 (Kundschaft: Finden; Lauf 30, angelegt von Nr. 221).
 *
 * Die Fundstellen von „Servicegebühr“ ohne Bedingung in Dateien, die laut Dateigrenzen
 * Nr. 226 gehören. Nr. 226 stellt jede auf das Wort des Modells um (Hinweise der Hofseite und /fuer-hoefe je Modell; gebuehrGrundsatz aus konditionen.ts),
 * streicht den Eintrag und löscht die Datei, sobald sie leer ist. Ist eine Fundstelle
 * schon nur im Modell „bisher“ erreichbar, gehört sie mit diesem Grund in FESTE_LISTE von
 * tests/gebuehr-wort-wache.test.ts. Geglichen wird über Datei und Text (`stelle` nur zum
 * Finden, Zeile vom 4.11.2026); die Wache liest den ganzen Ordner.
 *
 * Einträge mit „ · “ sind Rückfälle auf die Fassung „bisher“ ohne das Wort im Text
 * (Wert aus RUECKFALL_WERTE, Wort-Helfer ohne Wort, Leser einer festgehaltenen Vorgabe):
 * das Beispiel der Startseite über beispielRechnung(jetzt, …, modell) und das Wort je Modell statt
 * SERVICEGEBUEHR_BEZEICHNUNG. Dazu (Entscheidung des Dirigenten, Runde 1 von Nr. 221) die Texte in
 * src/lib/fuer-hoefe.ts und die Frage „Wie bezahle ich?“ in src/lib/startseite.ts (STARTSEITE_FRAGEN).
 */
export const OFFEN: { stelle: string; text: string }[] = [
  { stelle: 'src/app/(public)/fuer-hoefe/page.tsx:23', text: 'Die Servicegebühr von' },
  { stelle: 'src/lib/hofseite-kunde.ts:252', text: '% Servicegebühr' },
  { stelle: 'src/lib/hofseite-kunde.ts:259', text: 'zzgl. Servicegebühr' },
  { stelle: 'src/lib/hofseite-kunde.ts:274', text: 'zzgl. Servicegebühr bei Online-Zahlung' },
  { stelle: 'src/components/startseite/startseite-abschnitte.tsx:230', text: 'SERVICEGEBUEHR_BEZEICHNUNG · Für dich kommen {rechnung.prozent} %' },
  { stelle: 'src/components/startseite/startseite-abschnitte.tsx:248', text: 'SERVICEGEBUEHR_BEZEICHNUNG · <Zeile name={`${SERVICEGEBUEHR_BEZEICHNUNG} · ${rechnung.prozent} %`}' },
  { stelle: 'src/components/startseite/startseite-abschnitte.tsx:465', text: 'beispielRechnung() ohne Wort · SO_FUNKTIONIERTS' },
  { stelle: 'src/lib/fuer-hoefe.ts:28', text: 'Die Servicegebühr zahlt der Kunde. Online-Zahlungen kommen per Stripe direkt auf dein Konto.' },
  { stelle: 'src/lib/fuer-hoefe.ts:29', text: 'die Servicegebühr zahlt der Kunde' },
  { stelle: 'src/lib/fuer-hoefe.ts:80', text: 'Abholung selbst. Die Servicegebühr von' },
  { stelle: 'src/lib/fuer-hoefe.ts:86', text: 'Servicegebühr fällt dann weg.' },
  { stelle: 'src/lib/startseite.ts:390', text: '% Servicegebühr, mindestens' },
]
