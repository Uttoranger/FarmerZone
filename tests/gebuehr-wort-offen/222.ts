/**
 * Offen-Datei des Gebühren-Worts für Nr. 222 (Hof-Alltag; Lauf 30, angelegt von Nr. 221).
 *
 * Die Fundstellen von „Servicegebühr“ ohne Bedingung in Dateien, die laut Dateigrenzen
 * Nr. 222 gehören. Nr. 222 stellt jede auf das Wort des Modells um (gebuehrBezeichnungFuer bzw. gebuehrHinweisFuer je Bestellung; Storno nach dem Geldweg in src/server/stornieren.ts),
 * streicht den Eintrag und löscht die Datei, sobald sie leer ist. Ist eine Fundstelle
 * schon nur im Modell „bisher“ erreichbar, gehört sie mit diesem Grund in FESTE_LISTE von
 * tests/gebuehr-wort-wache.test.ts. Geglichen wird über Datei und Text (`stelle` nur zum
 * Finden, Zeile vom 4.11.2026); die Wache liest den ganzen Ordner.
 *
 * Einträge mit „ · “ sind Rückfälle auf die Fassung „bisher“ ohne das Wort im Text
 * (Wert aus RUECKFALL_WERTE, Wort-Helfer ohne Wort, Leser einer festgehaltenen Vorgabe):
 * GEBUEHR_ERSTATTUNG_OFFEN_HINWEIS → gebuehrErstattungOffenHinweisFuer(bestellung).
 */
export const OFFEN: { stelle: string; text: string }[] = [
  { stelle: 'src/app/(druck)/orders/[orderId]/print/page.tsx:131', text: 'Servicegebühr' },
  { stelle: 'src/app/(druck)/orders/[orderId]/print/page.tsx:155', text: '(davon Servicegebühr' },
  { stelle: 'src/app/(druck)/orders/today/print/page.tsx:39', text: 'Servicegebühr' },
  { stelle: 'src/components/hof-bestellungen/storno-dialog.tsx:91', text: '+ Servicegebühr' },
  { stelle: 'src/components/hof-bestellungen/storno-dialog.tsx:103', text: 'Die Servicegebühr erstattet' },
  { stelle: 'src/lib/storno.ts:86', text: 'Warenpreis + Servicegebühr' },
  { stelle: 'src/lib/storno.ts:91', text: 'Die Servicegebühr erstattet' },
  { stelle: 'src/components/hof-bestellungen/bestell-detail.tsx:376', text: 'GEBUEHR_ERSTATTUNG_OFFEN_HINWEIS · {GEBUEHR_ERSTATTUNG_OFFEN_HINWEIS}' },
]
