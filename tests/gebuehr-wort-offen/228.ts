/**
 * Offen-Datei des Gebühren-Worts für Nr. 228 (Anmelden und Konto; Lauf 30, angelegt von Nr. 221, Runde 1).
 *
 * Die Fundstellen von „Servicegebühr“ ohne Bedingung in Dateien, die laut Dateigrenzen
 * Nr. 228 gehören. Nr. 228 stellt jede auf das Wort des Modells um (VOLLER_WARENPREIS → vollerWarenpreis(modell) aus konditionen.ts),
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
  { stelle: 'src/components/einrichten/einrichten-seite.tsx:144', text: 'VOLLER_WARENPREIS · <p className="mt-2 text-[13px] text-foreground">{VOLLER_WARENPREIS}</p>' },
]
