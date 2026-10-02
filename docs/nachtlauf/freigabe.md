# Freigabe für den Nachtlauf

Vom Menschen auszufüllen, **bevor** der Nachtlauf startet. Nur was hier angehakt ist, darf der Lauf tun. Ein `[x]` bei „Empfehlung" übernimmt den Vorschlag aus Abschnitt 3 von `docs/umsetzungsprompt.md`; eine eigene Entscheidung steht in der Spalte daneben.

Freigegeben am: __________ · von: __________

## 1. Entscheidungen

| # | Thema | Empfehlung übernehmen | Eigene Entscheidung (statt Empfehlung) |
|---|---|---|---|
| E1 | Hofseite: Kategorie-Abschnitte statt Umschalter | [ ] | |
| E2 | Entdecken: Futtermittel als Kategorie-Chip | [ ] | |
| E3 | Verkaufsgrößen als Produktfamilie | [ ] | |
| E4 | Servicegebühr 5 %, immer aufrunden | [ ] | Satz: ___ % |
| E5 | Karte bei Abholung für neue Bestellungen ausblenden | [ ] | |
| E6 | Preismodell (Tarife, Grundgebühr, SEPA) | [ ] Tarife einführen · [ ] vorerst Gründungshof · [ ] noch offen | |
| E7 | Kunden-Anmeldung mit Code zusätzlich zum Link | [ ] | |
| E8 | Konto automatisch, Historie erst nach bestätigter E-Mail | [ ] | |
| E9 | Admin prüft Futtermittel-Nummer, Schild erst danach | [ ] | |
| E10 | Registrierungs-Fälle (LFBIS / BAES-Meldung) wie beschrieben | [ ] | |
| E11 | Brennmaterial mit Raummeter und Schüttraummeter | [ ] | |
| E12 | Beiträge als Reiter in Mein Hof | [ ] | |
| E13 | Verkauf eintragen bleibt im Neu-Menü | [ ] | |
| E14 | Artikel fehlt: Hof gibt genau den Artikelpreis zurück | [ ] | |

## 2. Schema-Änderungen (nur additiv, nur lokale Test-Datenbank)

Angehakte Punkte darf der Lauf als Migration erzeugen und im PR zeigen. Eingespielt wird erst nach deinem Merge.

- [ ] `Product.familieId` (E3)
- [ ] `Product.verpackung` (E10)
- [ ] `ProductUnit` + RAUMMETER, SCHUETTRAUMMETER (E11)
- [ ] `ProductSubcategory` + BRENNHOLZ_SCHEIT, ANZUENDHOLZ, HACKSCHNITZEL (E11)
- [ ] `BrennmaterialAngaben` (E11)
- [ ] `Farm.betriebsnummerGeprueftAm` (E9)
- [ ] `Merkliste` (Meine Höfe)
- [ ] `TeilenAufruf` und `Order.teilenKanal` (Teilen-Wirkung)
- [ ] `RueckrufAnfrage`
- [ ] Tarif-Felder und `Monatsabrechnung` (nur wenn E6 = Tarife)

## 3. Erlaubte neue Pakete

- [ ] `qrcode` (QR-Code für das Plakat, Gate 7)
- weitere: ______________________

Alles andere: Gate überspringen und im Morgenbericht nachfragen.

## 4. Haltepunkt und Rahmen

- Letzte Nummer, die in diesem Lauf noch bearbeitet werden darf: **___** (Vorschlag für die erste Nacht: 06, also Sicherheit, Servicegebühr, Bausteine und Schema)
- Kostenrahmen: ______ (wird zusätzlich beim Start als `--max-budget-usd` gesetzt)
