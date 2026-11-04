/**
 * Offen-Datei des Gebühren-Worts für Nr. 230 (Admin Teil 2; Lauf 30, angelegt von Nr. 221).
 *
 * Die Fundstellen von „Servicegebühr“ ohne Bedingung in Dateien, die laut Dateigrenzen
 * Nr. 230 gehören. Nr. 230 stellt jede auf das Wort des Modells um (Kennzahl, Abgleich-Satz und Regel mit gebuehrWortFuerMonat bzw. gebuehrWortFuerZeitraum),
 * streicht den Eintrag und löscht die Datei, sobald sie leer ist. Ist eine Fundstelle
 * schon nur im Modell „bisher“ erreichbar, gehört sie mit diesem Grund in FESTE_LISTE von
 * tests/gebuehr-wort-wache.test.ts. Geglichen wird über Datei und Text (`stelle` nur zum
 * Finden, Zeile vom 4.11.2026); die Wache liest den ganzen Ordner.
 *
 * Einträge mit „ · “ sind Rückfälle auf die Fassung „bisher“ ohne das Wort im Text
 * (Wert aus RUECKFALL_WERTE, Wort-Helfer ohne Wort, Leser einer festgehaltenen Vorgabe):
 * das Wort aus gebuehrWortFuerJahr bzw. gebuehrWortFuerMonat als Argument an jahrKennzahlen,
 * jahrAlsCsv, diagrammBeschriftung und legendeVorjahr, legendeGebuehren(wort) statt
 * legendeServicegebuehren, Titel der Karte in /admin/geld. Dazu (Entscheidung des Dirigenten,
 * Runde 1 von Nr. 221) ABWEICHUNG_FELD_TEXT in src/lib/geld-abgleich.ts.
 */
export const OFFEN: { stelle: string; text: string }[] = [
  { stelle: 'src/app/admin/geld/page.tsx:158', text: 'Betrag, Servicegebühr und Erstattung gleich' },
  { stelle: 'src/app/admin/geld/texte.ts:22', text: 'als Kosten neben der Servicegebühr' },
  { stelle: 'src/app/admin/finanzen/export/route.ts:38', text: 'jahrAlsCsv() ohne Wort · return new NextResponse(jahrAlsCsv(daten.rechnung), {' },
  { stelle: 'src/app/admin/finanzen/jahr-monate.tsx:129', text: 'FINANZEN_JAHR_TEXT.legendeServicegebuehren · {text.legendeServicegebuehren}' },
  { stelle: 'src/app/admin/finanzen/jahr-monate.tsx:231', text: 'legendeVorjahr() ohne Wort · {text.legendeVorjahr(vorjahr)}' },
  { stelle: 'src/app/admin/finanzen/jahr-monate.tsx:236', text: 'FINANZEN_JAHR_TEXT.legendeServicegebuehren · {text.legendeServicegebuehren}' },
  { stelle: 'src/app/admin/finanzen/jahr-monate.tsx:293', text: 'diagrammBeschriftung() ohne Wort · aria-label={FINANZEN_JAHR_TEXT.diagrammBeschriftung(jahr)}' },
  { stelle: 'src/app/admin/finanzen/jahr-monate.tsx:400', text: 'FINANZEN_JAHR_TEXT.legendeServicegebuehren · ? `${m.bezeichnung}: ${FINANZEN_JAHR_TEXT.legendeServicegebuehren}' },
  { stelle: 'src/app/admin/finanzen/jahr-seite.tsx:107', text: 'jahrKennzahlen() ohne Wort · <Kennzahlen beschriftung={FINANZEN_SEITE.kennzahlen} eintraege={jahrKennzahlen(rechnung, laufendesJahr)} />' },
  { stelle: 'src/app/admin/geld/page.tsx:109', text: 'SERVICEGEBUEHR_BEZEICHNUNG · titel: SERVICEGEBUEHR_BEZEICHNUNG,' },
  { stelle: 'src/lib/geld-abgleich.ts:69', text: 'Servicegebühr' },
]
