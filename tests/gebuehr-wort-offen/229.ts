/**
 * Offen-Datei des Gebühren-Worts für Nr. 229 (Admin Teil 1; Lauf 30, angelegt von Nr. 221).
 *
 * Die Fundstellen von „Servicegebühr“ ohne Bedingung in Dateien, die laut Dateigrenzen
 * Nr. 229 gehören. Nr. 229 stellt jede auf das Wort des Modells um (Aktivität mit gebuehrWortFuerZeitraum; Knopf „Servicegebühr …“ nach A1 ab dem Stichtag nicht zeigen),
 * streicht den Eintrag und löscht die Datei, sobald sie leer ist. Ist eine Fundstelle
 * schon nur im Modell „bisher“ erreichbar, gehört sie mit diesem Grund in FESTE_LISTE von
 * tests/gebuehr-wort-wache.test.ts. Geglichen wird über Datei und Text (`stelle` nur zum
 * Finden, Zeile vom 4.11.2026); die Wache liest den ganzen Ordner.
 *
 * Einträge mit „ · “ sind Rückfälle auf die Fassung „bisher“ ohne das Wort im Text
 * (Wert aus RUECKFALL_WERTE, Wort-Helfer ohne Wort, Leser einer festgehaltenen Vorgabe):
 * T.inklGebuehr(betrag, wort) und T.gebuehrZeile(bestellung) statt T.servicegebuehr
 * (Wort über gebuehrWortFuerZeitraum bzw. je Bestellung); lageKacheln mit gebuehrWort
 * (gebuehrWortFuerZeitraum(Wochenbeginn, jetzt, hofpreisModellAb(einstellung))).
 */
export const OFFEN: { stelle: string; text: string }[] = [
  { stelle: 'src/components/admin/hof-akte-ansicht.tsx:140', text: 'Servicegebühr' },
  { stelle: 'src/components/admin/hof-akte-ansicht.tsx:195', text: 'Servicegebühr …' },
  { stelle: 'src/app/admin/bestellungen/page.tsx:264', text: 'inklGebuehr() ohne Wort · {summen.gebuehrCents > 0 && ` ${T.inklGebuehr(euro(summen.gebuehrCents))}`}' },
  { stelle: 'src/app/admin/bestellungen/page.tsx:276', text: 'ADMIN_BESTELLUNG_TEXT.servicegebuehr · <span>{T.servicegebuehr}</span>' },
  { stelle: 'src/app/admin/page.tsx:107', text: 'lageKacheln() ohne gebuehrWort · const kacheln = lageKacheln(' },
  { stelle: 'src/components/admin/hof-akte-ansicht.tsx:221', text: 'SERVICEGEBUEHR_NUR_NEUE · {SPERRE_TEXT.erklaerung} {SERVICEGEBUEHR_NUR_NEUE}' },
]
