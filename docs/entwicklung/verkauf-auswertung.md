# Verkauf eintragen und Auswertung mit Vergleich

Stand: 2026-09-29, Branch `feature/verkauf-auswertung`.

Diese Datei hält fest, was der Sprint gebaut und entschieden hat. Sie steht
getrennt, weil drei Sprints gleichzeitig liefen und `DEVELOPMENT.md` sowie
`docs/ai/*` in dieser Zeit nicht angefasst werden durften — beim Nachziehen
dorthin übertragen (Regeln → `docs/ai/`, Verlauf → `DEVELOPMENT.md`).

## Die eine Umsatzregel

Vorher rechneten drei Stellen den Umsatz, jede anders:

| Stelle | Woche | Zeit | Geld |
|---|---|---|---|
| Heute (`getHeute`) | Wien | manuelle Verkäufe nach Zeitpunkt | Cent |
| Verkauf (`getSalesOverview`) | `date-fns` in Serverzeit | Serverzeit | `number` |
| Auswertung (`getAnalyticsData`) | `setHours` in Serverzeit | Serverzeit | `number` |

Jetzt gilt überall `src/lib/umsatz.ts`:

- **Umsatz = abgeholte Bestellungen nach `pickedUpAt` + manuelle Verkäufe nach
  ihrem Wiener Kalendertag.**
- Manuelle Verkäufe haben nur einen Tag (gespeichert um 12:00 UTC). Zählten sie
  nach Zeitpunkt, fehlte ein heute eingetragener Verkauf bis Mittag in „diese
  Woche" — das war auf Heute bisher so. Jetzt zählt der ganze Tag, auch im
  fairen Vergleich.
- Woche ab Montag 0 Uhr Wien über `wienWochenMontag` (`kalender.ts`), Monat und
  Jahr ab dem 1. um 0 Uhr Wien.
- Geld in Cent; Decimal → Cent nur in `src/server/queries/umsatz.ts`
  (`centAusDecimal`).
- Fenster: `umsatzfenster(periode, jetzt, zurueck)`. Die Datenbankbedingungen
  `umsatzBestellungWhere` / `umsatzVerkaufWhere` und die Speicherregel
  `zaehlt` sagen dasselbe (Test „Datenbankbedingung umfasst genau die Wiener
  Tage").
- `wochenfenster` aus `src/lib/heute.ts` ist darin aufgegangen; seine Tests
  stehen jetzt in `tests/umsatz.test.ts`.
- Die 55.000-€-Grenze (`getYtdRevenue`) zählt das Wiener Kalenderjahr nach
  derselben Regel und summiert in Cent.

### Fairer Vergleich

Die laufende Periode zählt bis jetzt und wird mit der Vorperiode bis zum
selben Tag und zur selben Uhrzeit verglichen (wie bisher Heute). Gibt es den
Tag in der Vorperiode nicht — 31. März gegen Februar, 29. Februar gegen das
Vorjahr —, zählt der letzte Tag davor ganz. Eine vergangene Periode vergleicht
ganz gegen ganz. Die blassen Balken zeigen immer die **ganze** Vorperiode als
Rahmen; die Zahl oben vergleicht fair.

## Verkauf eintragen

- Betrag zuerst: `DezimalFeld` mit `inputMode="decimal"` — das Komma wird nicht
  mehr verschluckt (vorher `type="number"`, Audit).
- „Wo verkauft?": Hofladen, Markt, WhatsApp, Betrieb (`BUSINESS`) als
  Symbolknöpfe, „Anderer Weg" (`OTHER`) als kleiner Link. Der zuletzt benutzte
  Kanal ist vorausgewählt — `src/lib/verkaufskanal-speicher.ts`, ein Schlüssel,
  Zod, nichts wirft. Gemerkt wird nur beim Eintragen, nicht beim Bearbeiten.
- „Was? — freiwillig": die drei meistverkauften Produkte der letzten 90 Tage
  (nach Anzahl der Verkäufe, dann Betrag), aufgefüllt aus dem Katalog, dazu
  „Anderes" mit freiem Namen.
- Ohne Produkt speichert die Action `productName = "Ohne Angabe"` und
  `quantity = 1` — beide Spalten sind Pflicht, eine Schemaänderung war nicht
  beauftragt. Diese Verkäufe fehlen in „Was lief am besten".
- Die Action prüft jetzt, dass ein gewähltes Produkt dem eigenen Hof gehört,
  und antwortet mit `{ error }` statt zu werfen; das Bearbeiten schreibt per
  `updateMany` mit Hof-Bedingung.
- Datum klein im Kopf („Heute", „Gestern", „Fr, 25. Sep"), antippbar;
  Standard heute in Wien (vorher UTC-Tag des Browsers).

## Auswertung, Reiter „Umsatz"

- Woche · Monat · Jahr (das Quartal entfällt), darunter ‹ Zeitraum ›, beides als
  Links: `/analytics?periode=monat&zurueck=1` (`src/schemas/auswertung.ts`,
  Unpassendes wird verworfen).
- Großer Betrag, Vergleich in Worten (`vergleichssatz`): „▲ 12 % mehr als im
  August", „▼ 5 % weniger als letzte Woche", ohne Vorperiode „Noch kein
  Vorjahr zum Vergleich".
- Balken: Woche → Tage, Monat → Abschnitte nach Tag im Monat (1.–7., …, ab 29.),
  Jahr → Monate. Monat nach Tag im Monat statt Kalenderwoche, damit jeder Monat
  dieselben Balken hat und der Vormonat daneben passt. Gezeichnet als Kästen
  mit Tailwind-Farben statt Recharts — so stimmen beide Themes ohne
  JavaScript-Umschaltung, und die Seite braucht keinen Client-Teil.
- Einsicht (`einsichtSatz`): stärkster Kanal mit Anteil, dazu der stärkste Tag
  (Woche, Monat) bzw. Monat (Jahr) — nur, wenn es mindestens zwei Tage mit
  Umsatz gab.
- „Wo kam das Geld her": Kanäle mit Anteilsbalken. „Was lief am besten": drei
  Produkte mit Menge in der Grundeinheit und Betrag (`getTopProdukte` in
  `analytics.ts`).
- Die Karte zur 55.000-€-Grenze steht jetzt unter dem Zeitraum: Sie gilt fürs
  ganze Jahr, unabhängig von der Wahl oben.
- Eigene `formatEuro` der Seite und der Verkaufsseite entfallen; alles über
  `src/lib/format.ts`.

## Offen

- `getDashboardStats` (`src/server/queries/dashboard.ts`) rechnet noch in
  Serverzeit — seit Heute ungenutzt, nicht angefasst.
- Menge bei manuellen Verkäufen eines Produkts mit Gebinde (z. B. 2 kg):
  eingetragen wird in der Einheit (kg). Wer dort Gebinde zählt, sieht in „Was
  lief am besten" eine zu kleine Menge — nur Anzeige, kein Geld.
- Regeln für `docs/ai/` (Umsatzregel, Kanal-Speicher in der State-Tabelle,
  Altlast „Wochengrenzen in Serverzeit" erledigt) nach dem Merge nachtragen.
