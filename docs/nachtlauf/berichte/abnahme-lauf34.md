# Abnahme Lauf 34

Abnahme nach Rahmen §4 (freigabe.md §38): Geld- und Sicherheitsnummern über Tests, zweiten vollen Durchgang des pruefer, Pflicht-Gegenlesen und Integration (4.1); Nummern mit Oberfläche mit Bildern bei 390 und 1440 px, hell und dunkel, nur mit dem Prüfwerkzeug, als „Ergänzung ohne Board“ gegen den Text der Nummer und die sechs Messpunkte (4.2). Kein Sterne-Durchgang über alle Boards (4.4).

## Abschnitt A

| Abschnitt | Nummer | Route | Fassung | Ergebnis | Rest |
|---|---|---|---|---|---|
| A | 287 | Kasse `/[farmSlug]/checkout` (Hof Müller, Prüf-Seed, Hofpreis-Modell, bar) nach `GESAMT_GEAENDERT` | 390 hell, 390 dunkel, 1440 hell, 1440 dunkel (Stand df3d7d729ea8) | Ergänzung ohne Board, bestanden: Hinweis unter dem Korb, Übersicht und Knopf mit dem Betrag des Servers (Plattformgebühr 8 % statt 6 %, Gesamt € 96,12 statt € 94,34), keine Bestellung. Messpunkte in allen vier Fassungen: Schrift unter 12 px 0, Ziele unter 44 px 0, genau eine h1 („Bestellen“), Felder ohne Beschriftung 0, axe 0 Verstöße (390: ein „incomplete“ color-contrast am 12-px-Rechtstext der festen Bestellleiste, Hintergrund durch Überlappung nicht bestimmbar), Fokus sichtbar (Tab, 2-px-Rahmen; bei den Zahlart-Karten auf dem Label) | Aufnahme unter `next dev` (Dev-Knopf „N“ im Bild); in der Kopie für Online-Zahlung ein Platzhalter-Konto gesetzt, bestellt wurde bar; Runde 2 von 287 ändert nur die Form des Zustands, nicht die Anzeige ([Ergänzungsliste Zeile 287](lauf34-ergaenzungen.md)) |
| A | 283, 284, 286, 289 | – | – | ohne Oberfläche (4.1): Tests, pruefer, Gegenlesen, Integration – siehe Berichte und PR-Texte | – |

Bilder: `.nachtlauf/screens/287/r1/` im Container (nicht committet), je Bild Messung und axe als JSON, dazu ein Fokus-Belegbild.

## Abschnitt B

| Abschnitt | Nummer | Route | Fassung | Ergebnis | Rest |
|---|---|---|---|---|---|
| B | 285 | Packliste `/orders/today/print` (Hof Müller, Prüf-Seed, vier Bestellungen mit Abholtag heute) gegen Board w2-druck | 1440 hell (Stand 3fc459ab09b6) | gegen das Board bestanden: vor jeder Position das Lucide-Symbol `Square` (14 px, Strich 1,7, `aria-hidden`, Farbe aus dem Text-Token) statt „☐“, kein „☐“ mehr im Markup; einziger Unterschied: leicht gerundete Ecken des Symbols. Messpunkte: Schrift unter 12 px 0, Ziele unter 44 px 0 (der Fließtext-Link „Mehr erfahren“ im Cookie-Hinweis zählt getrennt), genau eine h1 („Packliste“), keine Felder, axe ohne serious und critical, Fokus sichtbar | vorbestehend, nicht 285: axe moderate „landmark-one-main“ und „region“ (Druckseite ohne `<main>`); „Gesamt inkl. Plattformgebühr.“ (Nr. 277), Positionszeile G14, Bildschirmleiste „Zurück“ und „Drucken“ nicht im Board; Aufnahme unter `next dev` |
