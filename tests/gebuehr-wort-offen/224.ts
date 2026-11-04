/**
 * Offen-Datei des Gebühren-Worts für Nr. 224 (Mein Hof, Einstellungen, Region; Lauf 30, angelegt von Nr. 221).
 *
 * Die Fundstellen von „Servicegebühr“ ohne Bedingung in Dateien, die laut Dateigrenzen
 * Nr. 224 gehören. Nr. 224 stellt jede auf das Wort des Modells um (Rechenbeispiel und Gründe in „Deine Konditionen“ je Modell; Texte vollerWarenpreis und monatsabrechnungTeile aus konditionen.ts),
 * streicht den Eintrag und löscht die Datei, sobald sie leer ist. Ist eine Fundstelle
 * schon nur im Modell „bisher“ erreichbar, gehört sie mit diesem Grund in FESTE_LISTE von
 * tests/gebuehr-wort-wache.test.ts. Geglichen wird über Datei und Text (`stelle` nur zum
 * Finden, Zeile vom 4.11.2026); die Wache liest den ganzen Ordner.
 *
 * Einträge mit „ · “ sind Rückfälle auf die Fassung „bisher“ ohne das Wort im Text
 * (Wert aus RUECKFALL_WERTE, Wort-Helfer ohne Wort, Leser einer festgehaltenen Vorgabe):
 * VOLLER_WARENPREIS → vollerWarenpreis(modell), MONATSABRECHNUNG_TEILE → monatsabrechnungTeile(modell).
 */
export const OFFEN: { stelle: string; text: string }[] = [
  { stelle: 'src/lib/hof-einstellungen.ts:337', text: 'Für deinen Hof ist derzeit keine Servicegebühr eingestellt.' },
  { stelle: 'src/lib/hof-einstellungen.ts:338', text: 'Für deinen Hof gilt die Servicegebühr ab' },
  { stelle: 'src/lib/hof-einstellungen.ts:358', text: 'Servicegebühr (Kunde)' },
  { stelle: 'src/lib/hof-einstellungen.ts:368', text: 'Servicegebühr' },
  { stelle: 'src/lib/hof-einstellungen.ts:385', text: 'Servicegebühr (Kunde)' },
  { stelle: 'src/components/hof-einstellungen/konditionen-ansicht.tsx:62', text: 'VOLLER_WARENPREIS · <UnterseitenKopf' },
  { stelle: 'src/components/hof-einstellungen/konditionen-ansicht.tsx:104', text: 'MONATSABRECHNUNG_TEILE · <Teile teile={MONATSABRECHNUNG_TEILE} />' },
]
