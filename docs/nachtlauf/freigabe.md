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

- Letzte Nummer, die in diesem Lauf noch bearbeitet werden darf: **22f** (Lauf 5, siehe §9; Lauf 4 endete bei 19)
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

## 9. Lauf 5 (06.10.2026, uttoranger)

- **Haltepunkt: 22f.**
- **Reihenfolge:** 19c → 19a → 19b → 22a → 22b → 22d → 22e → 20 → 21 → 22c → 22f. 19c steht vor 19a, weil beide dieselbe Geldlogik berühren.
- Entscheidungen dazu: Register `docs/entscheidungen.md` (B1, E3, E9, E10, E11, E12, E13, K1).
- **Basis:** #188 (Nr. 19) ist gemergt, ohne die vier offenen Punkte aus Morgenbericht Lauf 4 §4. Deshalb kommt zuerst 19c. Das erste Gate zweigt von `main` ab.
- **Migrationen:** Braucht eine Nummer eine, gilt Regel 3 in `docs/nachtlauf.md`: nur Expand, und im Morgenbericht hervorheben.
- **Offen und NICHT anfassen:**
  - Wortwahl „Entwurf"/„Nicht im Shop";
  - Name und Telefon aus Alt-Registrierungen;
  - Ablehnungssperre für den Altbestand;
  - Fehler-Token (O1);
  - S11 (O3);
  - Rückruf (O5).

### 19c Geldpfad „Artikel fehlt" nachziehen (Morgenbericht Lauf 4 §4)
- Rest-Storno: bezahlten Betrag aus Stripe (`latest_charge.amount`) statt aus der Datenbank; bei Abweichung nichts buchen, Sentry.
- Sentry-Anweisung im Rest-Pfad korrekt formulieren (Teil-, nicht Vollerstattung).
- Hof-Text „manuell über das Stripe Dashboard erstatten" ersetzen durch „Wir kümmern uns um die Erstattung und melden uns." plus Meldung an den Admin.
- Webhook für `refund.failed` / `charge.refund.updated`: gescheiterte Erstattung zurücknehmen und melden.
- Test für `restNachTeilerstattung` mit Provision > 0.

### 19a B1 – Bargebühr bis Stichtag
- `berechneServicegebuehr` bekommt die Zahlungsart: `ONSITE_CASH` vor `BAR_SERVICEGEBUEHR_AB` → 0; online immer nach bestehender Regel. Konstante neben `TARIFE_AB`, Standard = `TARIFE_AB`.
- Dieselbe Funktion in Checkout-Server, Kasse/Warenkorb, Artikel fehlt (E14), Admin-Finanzen. Im Checkout beim Wechsel auf Bar sofort neu rechnen, Hinweis „Bei Barzahlung bis <Vortag des Stichtags> ohne Servicegebühr".
- Mail „Vor-Ort-Bestellung bestätigt", `/konditionen`, `/fuer-hoefe` und Startseiten-Beispiel ehrlich angleichen (Text aus einer Quelle).
- Bestehende Bestellungen unverändert. Keine Migration.
- Tests: Matrix bar/online × vor/nach Stichtag, Grenzzeitpunkt, Artikel fehlt bei Bar ohne Gebühr, Admin-Summen.

### 19b Sicherheits-Altlasten (Morgenbericht Lauf 4 §7)
- `addFarmPhotoAction`: URL nur aus dem eigenen Blob-Speicher und dem Pfad des eigenen Hofs, sonst ablehnen.
- Registrierung: neutrale Meldung statt „bereits registriert".
- Übergangsweg `/magic-link/verify` mit alten Tokens schließen, falls nicht mehr gebraucht; toten Export `authClient.signUp` entfernen.
- Zod für `updateSubscription` (`farmId`) und `loeseOrtAuf`.
- `revertOrderStatus`: `paymentStatus` mit `paidAt` stimmig halten; `queries/orders.ts`: Geld als Int-Cent statt `Number(…)`.
- Kalender-Route: Frist prüfen, signierten Link aus `DESCRIPTION` nehmen.
- Admin-Knopf „Ablehnen & löschen": Kontrast ≥ 4,5:1.
- Tests je Punkt.

### 22a Kunden und Kundendetail
Route in die Gruppe `(hof)` (HofShell), ohne Mockup nach `docs/ai/DESIGN_SYSTEM.md`.

### 22b Verkäufe und „Verkauf eintragen"
In die HofShell (E13).

### 22d Einstellungen
Übersicht nach Mockup, alle sechs Unterseiten in die HofShell, `/settings/konditionen` nach K1.

### 22e Beiträge, Hilfe, Meine Meldungen
Beiträge als Reiter in Mein Hof (E12, `/status` leitet um), Hilfe und Meine Meldungen in die HofShell.

### 20 Futter und Brennmaterial
Nach Gate 6 (E3, E9 ohne Prüfung, E10, E11). Das Schema aus #169 ist vorhanden, eine neue Migration wird nicht erwartet.

### 21 Teilen
Nach Gate 7 (`TeilenAufruf` aus #169, Paket `qrcode` erlaubt, siehe §3).

### 22c Auswertung und Region
- `/region` als eigene Route mit den Reitern Preise vergleichen | Futter kaufen.
- `/analytics/umfeld` leitet um, die Navigation zeigt auf `/region`.
- Die Auswertung bekommt die Teilen-Wirkung (aus 21) und die Servicegebühren dieses Monats (ohne SEPA bis zum Stichtag, B1).

### 22f Admin
In eine eigene AdminShell nach den admin-Mockups. Freischalten bleibt gesperrt ohne Stripe; keine Nummernprüfung (E9).

## 10. Lauf 6 (07.10.2026, uttoranger)

Freigabe im Chat erteilt (Mensch: uttoranger, 07.10.2026). Entscheidungen dazu im Register: E10a, E11 (Label), E12 (Stand), F6, F7, B2–B4, Z1, T1, O1, O3–O5, Backlog.

- **Haltepunkt: 33.**
- **Reihenfolge (fest):** 23 → 24 → 25 → 26 → 27 → 28 → 29 → 30 → 31 → 32 → 33.
- **Migrationen:** nur bei Nr. 30, nur Expand (neue Spalten mit Default oder nullable), erzeugt nach Regel 3 in `docs/nachtlauf.md`, im Morgenbericht hervorheben. Entsteht bei einer anderen Nummer eine Migration: STOPP.
- **Nach Fixes im Geld- oder Sicherheitspfad** (23, 24, 27, 32) eine kurze Nachprüfung des Fix-Commits.
- **PRs mit offener Vorbedingung** bleiben Entwurf.
- **Konflikte:** in Doku mechanisch lösen; in Code diese Nummer stoppen, melden und mit der nächsten unabhängigen weitermachen.
- **NICHT anfassen:** O4 (AGB werden separat erstellt). Backlog (Register) gehört nicht in diesen Lauf.
- Mockup-Abweichungen aus Lauf 5 (#192–#201) sind freigegeben (F7).

### 23 #198 Nachtrag Futter (Branch `nacht/2026-10-06/20-futter-brennmaterial`)
- Pflicht-Haken im Futter-Formular (Web, Handy) mit dem Wortlaut aus E10a. Serverseitig erzwingen, auch über Produktfamilie und Kategoriewechsel; Zeitpunkt in `FutterKennzeichnung.bestaetigtAm`; jede inhaltliche Änderung verlangt eine erneute Bestätigung.
- Kopfhinweis über den sieben Fällen (Wortlaut E10a) mit Link zur BAES-Seite für Futtermittelbetriebe.
- Kundenseite bei jedem Futter (Produktdetail, Größenkacheln, Warenkorb mit Futter): Verantwortungs-Hinweis aus E10a, bei „nur an Betriebe" der Zusatz. Texte aus einer Quelle.
- E11-Label „Brennmaterial".
- Danach Entwurf aufheben.

### 24 Z1 Stripe-Pflicht und #201 auf `main` (neuer Branch von `main`)
- Code aus `nacht/2026-10-06/22f-admin` übernehmen (cherry-pick oder merge, kein Force-Push). `freischaltSperre` sperrt immer ohne `stripeAccountReady`; Label „Nur bar" entfernen; Kennzeichen „Stripe fehlt" für freigeschaltete Höfe ohne Stripe. #201 schließen mit Verweis auf den neuen PR.
- Einstellungen: Wahl „nur bar" entfernen; der Server lehnt `acceptsOnline = false` von Höfen ab; Notbremse unverändert.
- Einrichten: „Hof online stellen" erst mit Stripe, Text „Damit deine Kundinnen auch mit Karte, Apple Pay oder EPS zahlen können, richte bitte die Online-Zahlung ein. Dauert etwa 10 Minuten." Heute: deutlicher Hinweis „Online-Zahlung einrichten" für freigeschaltete Höfe ohne Stripe. Keine Abschaltung.
- Öffentliche Texte (`/fuer-hoefe`, `/konditionen`, Registrieren): Stripe-Einrichtung als Teil des Starts nennen, keine Bar-Option für Höfe andeuten. Texte aus `konditionen.ts`.

### 25 #199 Teilen nach T1 (Branch `nacht/2026-10-06/21-teilen`, vorher den neuen Stand von 20 hineinholen)
- Browser-Speicher entfernen (`teilen-herkunft.ts` und Aufrufer), Besuchszählung serverseitig über `?k=`, keine Bestell-Zuordnung, Texte „ohne Cookies" prüfen.
- Danach Entwurf aufheben.

### 26 #200 Auswertung und Region (Branch `nacht/2026-10-06/22c-auswertung-region`, vorher 21 hineinholen)
- Euro-Betrag in der Teilen-Karte weg (T1), Zählregel wie Admin, Rest unverändert.
- Slug `region` ist in Produktion frei (geprüft 07.10.2026).
- Danach Entwurf aufheben.

### 27 Konto und Geld, klein (Branch von `main`)
19c Vollerstattung mit Merkmalen · 19b gleiche Antwort und Mail an das bestehende Konto · B3 · B4.

### 28 Oberfläche und Wortwahl (Branch von `main`)
B2 · 22a · 22b (Wortwahl, Knopf am Handy) · 22e (Kurznummer, „N per E-Mail") · O1 Fehler-Farbe · 19a `/konditionen` stündlich neu bauen.

### 29 22c „Betrieb" bei Futter kaufen vorbelegen (gestapelt auf 26)

### 30 Teilen-Momente „gespeichert" und Abschalten in den Einstellungen (gestapelt auf 25)
Migration erlaubt: nur Expand (neue Spalten mit Default oder nullable), nach Regel 3, im Morgenbericht hervorheben.

### 31 Tab-Wechsel im Hofbereich beschleunigen (Branch von `main`)
Befund (Messung 06.10.2026): Server-Rechenzeit gering (Sentry p50 7–35 ms, `/dashboard` ~315 ms), aber jeder Produktionsaufruf zeigt das Modul-Log „[E-Mail] Init" → nahezu jeder Tab-Wechsel ist ein Kaltstart; ohne `loading.tsx` gibt es weder sofortige Rückmeldung noch Vorladen.
- `loading.tsx` für jede Route in `(hof)`, als Rückfall für die Gruppe, sowie für `(farmer)`- und `/admin`-Routen ohne eigene; Skeletons nach DESIGN_SYSTEM.md in den Abmessungen der echten Seite.
- E-Mail-, Stripe- und andere schwere Module nur dort und erst bei Bedarf laden (dynamischer Import in Versandfunktionen bzw. Actions); kein Seitenmodul zieht sie über Sammel-Importe mit. Modul-Log „[E-Mail] Init" entfernen.
- `/dashboard`: unabhängige Abfragen mit `Promise.all`; Freigabe verwaister Bestellungen nicht blockierend vor dem Rendern, wenn fachlich zulässig (sonst begründen).
- Im PR belegen: Bundle-Größe der Hof-Routen vorher/nachher aus `next build` und die Zahl der Module, die `/orders` beim Start lädt.

### 32 Altlasten aus Morgenbericht Lauf 5 §5 (Branch von `main`)
`revertPickedUp` korrigieren · `Number(...)` für Geld in `queries/orders.ts` und im Servicegebühr-Dialog durch Int-Cent ersetzen · `status-posts.ts`: Zod an allen Actions, Besitzprüfung im selben Schreibvorgang statt per vorgelagertem `findFirst` · 36-px-Felder in „Mein Auftritt" auf mindestens 44 px. Tests je Punkt.

### 33 Datenschutzerklärung auf Sachstand bringen (Branch von `main`)
Nur Tatsachen korrigieren, keine neuen Rechtsformulierungen: Anmeldung per Code statt Link; kein automatisches Kundenkonto (E8); Teilen zählt nur Besuche, ohne Speicher im Browser (T1); Stripe als Zahlungsdienst; Sentry; Aufbewahrung von Bestelldaten. Jede geänderte Stelle im Bericht auflisten, damit der Mensch sie rechtlich prüfen lassen kann.

### Morgenbericht (`morgenbericht-<datum>-lauf6.md`)
Je PR: Vorschau-Link, „enthält Migration: ja/nein", Basis, Merge-Reihenfolge (Merge-Commit, nicht Squash), „Für dich zu tun" (u. a. Heu-Produkte bestätigen, Höfe ohne Stripe ansprechen, Stripe-Events `refund.failed` und `charge.refund.updated`, EPS/Apple Pay/Google Pay, geänderte Stellen der Datenschutzerklärung prüfen lassen).
