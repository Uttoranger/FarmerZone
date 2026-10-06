# Freigabe für den Nachtlauf

Vom Menschen auszufüllen, **bevor** der Nachtlauf startet. Nur was hier angehakt ist, darf der Lauf tun. Ein `[x]` bei „Empfehlung" übernimmt den Vorschlag aus Abschnitt 3 von `docs/umsetzungsprompt.md`. Steht in der rechten Spalte eine **eigene Entscheidung**, gilt diese – auch wenn sie vom Umsetzungsprompt abweicht.

> Vorausgefüllt aus der Planungs-Session (Oktober 2026), mit den Entscheidungen zu E7, E8, E9 und dem Vorschlag zu E14. **Freigabe erteilt – siehe Datum und Name unten.**

Freigegeben am: **02.10.2026** · von: **uttoranger** (Repo-Inhaber, im Chat erteilt)

> **Entscheidungen stehen ab 06.10.2026 im Register `docs/entscheidungen.md`.** Bei Widerspruch gilt das Register. Diese Datei hält fest, was ein Lauf tun darf (Schema, Pakete, Haltepunkt, Aufträge); die Tabelle in Abschnitt 1 bleibt als Nachweis der ersten Freigabe stehen.

## 1. Entscheidungen

| # | Thema | Empfehlung übernehmen | Eigene Entscheidung / Quelle |
|---|---|---|---|
| E1 | Hofseite: Kategorie-Abschnitte statt Umschalter | [x] | „Ordne die Hofseiten wieder nach Kategorie an" – Abschnitte Eier & Brot, Gemüse, Honig, Futtermittel, Brennmaterial |
| E2 | Entdecken: Futtermittel als Kategorie-Chip | [x] | Entdecken-Mockups mit Futtermittel-Chip und Mengenfilter abgenommen; „alles an einem Platz" |
| E3 | Verkaufsgrößen als Produktfamilie | [x] | Verkaufsgrößen vom Sackerl bis zum Rundballen („auch Kleintierhalter"); Produktfamilie ist die technische Umsetzung, die zu den bestehenden Invarianten passt |
| E4 | Servicegebühr 5 %, immer aufrunden | [x] | **5 %**, mind. € 0,50, **immer aufrunden** (Preismodell aus der Excel, „Es wird aufgerundet") |
| E5 | Karte bei Abholung für neue Bestellungen ausblenden | [x] | Preismodell kennt nur online und bar bei Abholung |
| E6 | Preismodell (Tarife, Grundgebühr, SEPA) | [x] Tarife einführen · [ ] vorerst Gründungshof · [ ] noch offen | Preismodell aus der Excel (Hoftor 0 €, Hofladen 19 €/Monat, Servicegebühr zahlt der Kunde, SEPA-Monatsabrechnung) |
| E7 | Kunden-Anmeldung mit Code | [x] | **Entschieden:** Anmeldung per Code aus der E-Mail (Better Auth `emailOTP`). Gilt für die bestehende freiwillige Kunden-Anmeldung und für „Bestellungen finden" (siehe E8). Höfe bleiben bei E-Mail und Passwort. |
| E8 | Kundenkonto | [ ] | **Entschieden: vorläufig kein Kundenkonto.** Bestellen als Gast; kein automatisches Konto beim Checkout, kein Satz dazu im Checkout. Jede Bestellung ist über den **signierten Link** aus der Bestätigungsmail erreichbar. Unter „Bestellungen" findet die Kundin ihre Bestellungen mit **E-Mail und Code** (nur für diese Sitzung, kein dauerhaftes Konto). **Nicht bauen:** „Meine Höfe", Konto-Seite, „Neuigkeiten deiner Höfe", „Merken". Die bestehenden Seiten unter `/account` bleiben unverändert erhalten und werden nur ins neue Design gezogen. Handy-Unterleiste vorerst: Entdecken · [Warenkorb] · Bestellungen. |
| E9 | Prüfung der Futtermittel-Nummer | [ ] | **Entschieden: keine Prüfung durch die Plattform** (wie im Konzept Bereiche). Der Hof bestätigt die Richtigkeit selbst (`bestaetigtAm`). Das Schild beim Kunden erscheint sofort, Wortlaut: „Futtermittelbetrieb · LFBIS <Nummer>", in der Kennzeichnung mit dem Zusatz „laut Angabe des Hofs". Im Admin wird die Nummer nur angezeigt, es gibt keinen Haken „geprüft". |
| E10 | Registrierungs-Fälle (LFBIS / BAES-Meldung) wie beschrieben | [x] | Deine fachliche Klärung: eigene Ernte lose oder in Ballen genügt LFBIS; abgepacktes Heimtierfutter mit Etikett, Zukauf und Mischen brauchen aktive BAES-Meldung. Texte vor dem Livegang gegenlesen lassen |
| E11 | Brennmaterial mit Raummeter und Schüttraummeter | [x] | Holz als Kategorie gewünscht, erweitert zu „Brennmaterial" mit Hackschnitzeln; nur Abholung |
| E12 | Beiträge als Reiter in Mein Hof | [x] | Mein-Hof-Umbau („mach es so") mit Reitern Hofseite \| Beiträge |
| E13 | Verkauf eintragen bleibt im Neu-Menü | [x] | Bestehende Funktion bleibt erhalten |
| E14 | Artikel fehlt | [x] | **Entschieden:** Vorschlag aus Abschnitt 1a übernommen |

### 1a. E14 – „Artikel fehlt" (entschieden)

Grundsatz: **Die Servicegebühr gilt nur für das, was tatsächlich übergeben wird.** Sie wird auf den verbleibenden Warenwert neu berechnet, mit derselben Regel wie beim Bestellen (5 %, immer aufrunden, mindestens € 0,50). Der Hof verliert nie mehr als den Preis des fehlenden Artikels.

**Bar bei Abholung**
- Neuer Barbetrag = verbleibender Warenwert + neu berechnete Gebühr.
- Beispiel: Eier € 4,50 + Brot € 5,80, Brot fehlt → Gebühr neu € 0,50 → **Bar zu kassieren € 5,00** (statt € 10,82).
- Die Monatsabrechnung nimmt die neue Gebühr (€ 0,50), nicht die ursprüngliche.

**Online bezahlt**
- Die Kundin bekommt zurück: Artikelpreis + Differenz der Gebühr. Beispiel: € 5,80 + (€ 0,52 − € 0,50) = **€ 5,82**.
- Vom Hof wird **genau der Artikelpreis** zurückgeholt (€ 5,80) – über eine Rückbuchung mit festem Betrag, nicht anteilig.
- Die Gebührendifferenz (€ 0,02) kommt aus der einbehaltenen Plattformgebühr. Das ist kein Verlust, sondern Gebühr, die für nicht gelieferte Ware nie hätte anfallen sollen.
- Erstattung mit Idempotenz-Schlüssel (`teilstorno-<orderId>-<itemId>`), Beträge nur serverseitig berechnet.

**Sonderfälle**
- Fehlt alles, ist es ein normaler Storno (Regeln wie K1).
- Fehlen mehrere Artikel nacheinander, wird jedes Mal vom aktuellen Stand neu gerechnet; die Summe der Erstattungen übersteigt nie den bezahlten Betrag.
- Die Kundin bekommt sofort eine E-Mail mit dem neuen Betrag, bevor sie losfährt.
- Der Hof sieht im Dialog vor dem Speichern, was die Kundin zurückbekommt und was von seiner Auszahlung abgezogen wird.

## 2. Schema-Änderungen (nur additiv, nur lokale Test-Datenbank)

Angehakte Punkte darf der Lauf als Migration erzeugen und im PR zeigen. Eingespielt wird erst nach deinem Merge.

- [x] `Product.familieId` (E3)
- [x] `Product.verpackung` (E10)
- [x] `ProductUnit` + RAUMMETER, SCHUETTRAUMMETER (E11)
- [x] `ProductSubcategory` + BRENNHOLZ_SCHEIT, ANZUENDHOLZ, HACKSCHNITZEL (E11)
- [x] `BrennmaterialAngaben` (E11)
- [ ] `Farm.betriebsnummerGeprueftAm` – entfällt (E9: keine Prüfung)
- [ ] `Merkliste` – entfällt vorerst (E8: kein Kundenkonto)
- [x] `TeilenAufruf` und `Order.teilenKanal` (Teilen-Wirkung, ohne Personenbezug)
- [ ] `RueckrufAnfrage` – offen, nie besprochen
- [x] Tarif-Felder und `Monatsabrechnung` (E6 = Tarife)
- [x] Teilstorno-Felder je Position (z. B. `OrderItem.fehltSeit`, `Order.erstattetCents`), soweit das Modell sie für E14 braucht

## 3. Erlaubte neue Pakete

- [x] `qrcode` (QR-Code für das Plakat, Gate 7)
- weitere: keine

Alles andere: Gate überspringen und im Morgenbericht nachfragen.

## 4. Hinweise für den Lauf aus diesen Entscheidungen

- **Nr. 08 Anmelden:** Kunden-Anmeldung auf Code umstellen (E7); kein neues Konto-Angebot.
- **Nr. 12 Checkout:** ohne Kontosatz; Bestätigungsmail mit signiertem Link ist der Weg zur Bestellung.
- **Nr. 14 Konto und Meine Höfe:** ersetzt durch „Bestellungen finden per E-Mail-Code" und den Umbau der bestehenden `/account`-Seiten ins neue Design. Keine neuen Konto-Funktionen.
- **Nr. 20 Futter:** Schild ohne Prüfvermerk, Zusatz „laut Angabe des Hofs" in der Kennzeichnung (E9).
- **Nr. 05 Shells:** Kunden-Unterleiste am Handy mit drei Einträgen (E8).

## 5. Haltepunkt und Rahmen

- Letzte Nummer, die in diesem Lauf noch bearbeitet werden darf: **19** (Lauf 4, siehe §8; Lauf 3 endete bei 17)
- Kostenrahmen: **40 USD** (wird zusätzlich beim Start als `--max-budget-usd` gesetzt; mit Abo gelten dessen Nutzungsgrenzen)

## 6. Nachtrag 05.10.2026 (uttoranger)

- Geldfelder: Variante A (Int-Cent), Ausnahme in ARCHITECTURE.md.
- Migrationsweg `prisma migrate diff` statt `migrate dev --create-only` freigegeben.
- Mockup-Abweichungen und Cookie-Änderung aus Nr. 05 freigegeben.
- Haltepunkt für den nächsten Lauf: **14**.

## 7. Nachtrag 06.10.2026 (uttoranger, im Chat erteilt)

- Haltepunkt für Lauf 3: **17** (Nr. 15 Für Höfe/Registrieren/Einrichten, 16 Mein Hof mit Vorschau, 17 Heute). Gestapelt auf #178, solange #170–#178 offen sind.

## 8. Lauf 4 (06.10.2026, uttoranger)

- **Haltepunkt: 19.** Reihenfolge: 17a → 17b → 17c → 17d → 18 → 19. Alle Stapel bis #181 sind gemergt; das erste Gate zweigt von `main` ab.
- Entscheidungen dazu: Register `docs/entscheidungen.md` (E8, S3, K1).

### 17a E8 – Checkout ohne Kundenkonto
- `/api/checkout` legt kein User-Konto mehr an und verknüpft keine Bestellung mit einem Konto (`customerId` bleibt `null`). Keine Migration.
- Alles, was bisher `customerId` las (Mails, `/account`, Kennzahlen), arbeitet mit der normalisierten `customerEmail`.
- `/account` zeigt nach Code-Anmeldung nur Bestellungen der bestätigten, angemeldeten Adresse.
- Bestehende ruhende Konten bleiben unangetastet (keine Datenänderung in Produktion).
- Tests: Checkout erzeugt keinen User; zwei Bestellungen mit gleicher Adresse verknüpfen nichts; `/account` zeigt nur die eigene Adresse; Hof-Kundenliste unverändert.

### 17b S3 – E-Mail-Bestätigung für neue Höfe
- Better Auth `emailVerification` mit Versand über den bestehenden Mailweg; `/verify` im neuen Design („Bestätige deine E-Mail", „Erneut senden" mit Bremse).
- Anmelden bleibt möglich. Bis zur Bestätigung gesperrt: Foto-Uploads und „Hof online stellen"; Einrichten (Texte, Abholzeiten) erlaubt.
- Gilt nur für Konten, die nach einem Stichtag angelegt werden (Konstante, Tag des Deploys). Bestehende Höfe unberührt, keine Datenänderung in Produktion.
- Admin-Liste zeigt „E-Mail bestätigt: ja/nein".
- Tests für Sperren, Stichtag und Erneut-senden-Bremse.

### 17c Slug-Prüfung absichern
- `checkSlugAvailability`: Zod (Länge, Format wie Slug-Regeln), Rate-Limit, Antwort nur „frei" oder „vergeben" ohne Hinweis auf den Freischaltungsstand; reservierte Slugs gelten als vergeben. Tests.

### 17d K1 – Konditionen-Übergang
- Datum laut Register K1: **1. Februar 2027** (gesetzt am 06.10.2026). Das Datum steht nur in `src/lib/konditionen.ts`.
- Text aus `src/lib/konditionen.ts` auf `/fuer-hoefe`, `/konditionen` und am Registrieren-Link: „In der Startphase kostenlos. Die Tarife gelten ab 1. Februar 2027. Bereits freigeschaltete Höfe behalten ihre zugesagten Konditionen."
- Admin-Freischaltung unverändert, dort ein Hinweis, welches Modell derzeit gilt. Tests: Text aus einer Quelle.

### Danach
Wie geplant **18** Produkte und „Was legst du an?" und **19** Bestellungen, Storno, Artikel fehlt (Freigaben E13, E14 aus Abschnitt 1).
