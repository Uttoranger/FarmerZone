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

## 11. Lauf 7 (uttoranger, im Chat erteilt)

Entscheidungen im Register: S11, D1, R1, G3 (Sammel-PR).

- **Haltepunkt:** der Sammel-PR (`integration/lauf7`).
- **Reihenfolge (fest):** 34 (danach ggf. 34a, 34b … für Fehler aus dem Probelauf) → 35 → 36 → 37 → 38 → 39 → 40 → Sammel-PR.
- **Vor jeder neuen Nummer** `origin/main` hineinholen.
- **Migrationen:** nur bei 38 und 40, nur Expand, nach Regel 3. Entsteht anderswo eine: STOPP.
- **Nachprüfung des Fix-Commits** nach Fixes im Geld- oder Sicherheitspfad (34a ff., 35, 37, 38, 40).
- **In 34 niemals Produktion oder Live-Schlüssel.**
- **Konflikte in Code:** diese Nummer stoppen, melden, mit der nächsten unabhängigen weitermachen.
- **Checkliste je PR** (im PR-Text abhaken):
  - [ ] Register und Freigabe decken den Inhalt ab
  - [ ] `origin/main` vor dem Push hineingeholt
  - [ ] `pnpm typecheck`, `pnpm lint` (kein neuer Befund), `pnpm test` grün
  - [ ] `pnpm test:integration` grün, wenn Datenbank berührt
  - [ ] Migration: ja/nein; wenn ja, nur Expand, SQL im PR-Text
  - [ ] Geld nur als Int-Cent, Beträge nur serverseitig berechnet
  - [ ] Keine personenbezogenen Daten oder Secrets in Code, Logs, Tests
  - [ ] Neue Seiten: `loading.tsx`, beide Themes, 390 und 1440 px, Axe ohne Fehler, Touch-Ziele ≥ 44 px
  - [ ] Texte aus einer Quelle, Deutsch, per Du
  - [ ] `tester` und `pruefer` gelaufen, Befunde erledigt oder begründet
  - [ ] Entwurf, wenn eine Vorbedingung offen ist

### 34 Automatischer Probelauf (Gate 9a) als E2E-Tests in `tests/e2e/`
- **Vorbedingung:** Die Vorschau-Umgebung nutzt die Entwicklungsdatenbank und Stripe im **Testmodus**. Ohne Werte auszugeben prüfen, dass der Stripe-Schlüssel der Vorschau mit `sk_test_` beginnt. Sonst: STOPP, Nummer 34 überspringen und melden. Niemals Live-Schlüssel, niemals Produktion.
- Testhof im Stripe-Testmodus mit verbundenem Konto (per API im Testmodus anlegen oder vorhandenes nutzen), Seed-Daten aus `seed-daten.ts`.
- Abläufe: (1) Online mit Testkarte, auch 3-D-Secure; (2) Wallet — falls im Browser nicht möglich, begründet auslassen; (3) EPS im Testmodus; (4) Bar ohne Servicegebühr (B1) mit Bestätigungsknopf; (5) Bar unbestätigt → nach Frist freigegeben (Zeit im Test vorstellen); (6) Futter mit Größe inkl. Hinweis „Angaben stammen vom Hof"; (7) Artikel fehlt bei Online-Bestellung → Teilerstattung; (8) Storno online → Vollerstattung mit Transfer-Rückbuchung; (9) abgeholt und „nicht abgeholt"; (10) Bestellungen finden per Code; (11) Produkt am Handy-Viewport anlegen und Teilen-Fenster öffnen; (12) QR-Plakat erzeugt eine gültige Hofseiten-Adresse mit `?k=qr`.
- Je Ablauf gegen die Stripe-Test-API prüfen: `application_fee_amount`, Transfer-Betrag, Erstattung und Rückbuchung stimmen exakt mit den Beträgen in der Datenbank und der Anzeige überein.
- Bericht `docs/nachtlauf/berichte/34.md`: Tabelle je Ablauf (bestanden/Fehler/ausgelassen mit Grund), Screenshots lokal unter `.nachtlauf/`.
- Gefundene Fehler NICHT in 34 beheben: je Fehler eine eigene Nummer 34a, 34b … direkt nach 34, mit Test, der den Fehler zeigt.

### 35 Altlasten aus Lauf 6 §6
`bestellSummen` mit Int-Cent statt `Math.round(Zahl * 100)` · `percent` im Servicegebühr-Schema ohne `z.coerce` · `revertReady` verschickt die Mail nach der Antwort · `linkedProductIds` in Beiträgen gegen den eigenen Hof prüfen · Knöpfe unter 44 px in „Mein Auftritt" · `farm-page-view` zeigt Online-Zahlung nach `stripeAccountReady` und `acceptsOnline` (Z1), nicht nur nach `acceptsOnline`.

### 36 BAES-Angaben
`BAES_FUTTERMITTEL_URL` auf https://baes.gv.at/en/admission/feed/faq-feed, dazu Kontakt futtermittel@baes.gv.at und +43 5 0555 33216 im Kopfhinweis. **Ausnahme zu CLAUDE.md („keine echten E-Mails/Telefonnummern im Code"):** Das ist der öffentliche Kontakt einer Behörde für Kundinnen und Höfe, keine personenbezogene Angabe; vom Menschen in der Freigabe ausdrücklich verlangt. Die Werte stehen an einer Stelle (neben `BAES_FUTTERMITTEL_URL`). Wortlaut des Falls „abgepacktes Heimtierfutter" mit § 8 Abs. 7 Futtermittelverordnung 2010 abgleichen (Meldung an das BAES statt Registrierung) und im Bericht als Textänderung zum Gegenlesen markieren.

### 37 Sentry ohne IP-Adressen
`sendDefaultPii` aus, `beforeSend` entfernt `user.ip_address` und Request-Header mit IP; Test. Im Bericht vermerken, dass die Einstellung im Sentry-Dashboard zusätzlich zu prüfen ist.

### 38 S11 Double-Opt-in
Anmeldung zu Hof-Neuigkeiten und Benachrichtigungen erst nach Klick auf den Bestätigungslink (signiert, mit Ablauf); unbestätigte Anmeldungen bekommen keine werblichen Mails; Abmeldelink in jeder werblichen Mail. Bestehende Abonnenten unverändert, Anzahl im Bericht. Migration nur Expand, falls nötig.

### 39 D1 Direktverkauf senkt den Vorrat
Verkäufe, wie im Register D1.

### 40 R1 Rate-Limit über die Datenbank
Tabelle mit Schlüssel, Fenster und Zähler; Aufräumen alter Einträge im bestehenden Cron; die bestehende Bremse je Instanz bleibt als erste Stufe. Migration nur Expand.

### Sammel-PR (Haltepunkt)
Branch `integration/lauf7` von `main`, alle PRs dieses Laufs per `git merge --no-ff` in Merge-Reihenfolge; Doku-Konflikte: beide Seiten behalten; Code-Konflikte sauber zusammenführen und jede Auflösung im PR-Text begründen. Typecheck, Unit- und Integrationstests auf dem Gesamtstand grün. PRs mit offener Vorbedingung (Entwurf) NICHT aufnehmen.

### Morgenbericht (`morgenbericht-<datum>-lauf7.md`)
Ergebnis des Probelaufs zuerst (Tabelle der 12 Abläufe), dann je PR Vorschau-Link, Migration ja/nein, Basis; der Sammel-PR mit Liste der Konfliktauflösungen; „Für dich zu tun" (u. a. Sentry-Dashboard IP, Zahl der bestehenden Abonnenten, Probelauf vor Ort mit dem Pilothof).

## 12. Lauf 8 (uttoranger, im Chat erteilt)

Entscheidungen im Register: N1, N2, Z2, Z3. Wortlaut aus dem Startauftrag vom 08.10.2026: Ausgangslage, §1–§3 und §4.

Stand: main = 9c7da65 (#219 Lauf 7 gemergt, Produktion READY, beide Migrationen eingespielt).

### Ausgangslage (geprüft 08.10.2026, nur lesend)
- STRIPE_* ist bei Vercel EINE Variable für Vorschau und Produktion. Das Umgebungsbanner der Vorschau zeigt „Stripe Test", die Produktion lädt pk_test_: Beide laufen im Testmodus. Die Live-Schaltung macht der Mensch ganz am Schluss; kein Lauf schaltet um.
- Handy (390 px): Bestehende Höfe finden die Anmeldung nur ganz unten im Fuß der Startseite („Anmelden für Höfe"). Kopf der KundeShell: nur Logo und Hell/Dunkel, „Anmelden" ist unter 768 px ausgeblendet. /fuer-hoefe und das Band „Für Höfe" bieten nur Registrieren. Ein angemeldeter Hof sieht auf öffentlichen Seiten keinen Weg in seinen Bereich. Manifest startet auf /dashboard, Sitzung 7 Tage.
- Hofbereich am Handy: Rückweg „‹ …" auf Unterseiten klein und nur oben, nach dem Scrollen weg; „Einstellungen → Mein Auftritt" im Hof-Profil ist kein Link.
- Vercel-Laufzeit: (EAUTHTIMEOUT) beim Hintergrund-Neubau von /hoefe; DeprecationWarning „Calling client.query() when the client is already executing a query" auf /[farmSlug]/checkout seit 13.08.

### §1 Warteschlange (fest)
41 → 42 → 43 (gestapelt auf 42) → 44 → 45 → 46 → 47 → 48 → Sammel-PR (Haltepunkt).
Jede Nummer: Branch nacht/2026-10-08/<nr>-<kurz> von origin/main (43 von Branch 42), ein PR.

#### 41 Hof-Anmeldung am Handy und „Mein Hof" (N1)
- KundeShell und KundenKopf: unter 768 px oben rechts „Anmelden" (Fläche ≥ 44 px, gut lesbar) → /login. Im Browser heißt der Knopf ebenfalls „Anmelden" (statt „Hofbetreiber-Login"; die KundeShell führte bisher auf /account/login) und führt auf /login. /login zeigt beide Wege wie bisher, „Ich habe einen Hof" vorausgewählt.
- Hof-Sitzung (Rolle FARMER oder Admin mit eigenem Hof): statt „Anmelden" steht „Mein Hof" → /dashboard, am Handy und im Browser. Kundensitzung: „Mein Konto" wie bisher. Die Sitzung liest weiter der Browser (KundeShellMitSitzung); die Startseite bleibt statisch (kein headers()/cookies()).
- Hell/Dunkel-Schalter am Handy aus dem Kopf ins Menü-Blatt (KundenKopf) bzw. in den Seitenfuß; im Browser bleibt er im Kopf.
- /fuer-hoefe (oben und unten), Band „Für Höfe" der Startseite und /register: Link „Schon dabei? Anmelden" → /login.
- Heute (/dashboard): ganz unten eine kleine Karte „Mit einem Tipp in deinem Hof: Leg FarmerZone auf den Startbildschirm", Anleitung für iPhone und Android in je zwei Sätzen. Nur im Browser, nicht in der installierten App (display-mode: standalone); ohne Speicher im Browser (T1). Manifest nicht ändern.
- AdminShell: „← Mein Hof" nur, wenn das Konto einen Hof hat; die Initialen-Plakette wird ein Link auf /settings/account und ist auch am Handy sichtbar.
- Texte und Ziele aus einer Quelle (kunden-navigation.ts, kunden-menue.ts, admin-navigation.ts); Tests anpassen.
- Abnahme im Bericht (390 px, ausgeloggt): Startseite, /hoefe, Hofseite und /fuer-hoefe zeigen oben „Anmelden"; ein Tipp führt zur Hof-Anmeldung; mit Hof-Sitzung steht dort „Mein Hof".

#### 42 Stripe-Testbetrieb und Modus-Wache (Z2; Geld/Sicherheit)
- Stripe-Server-Client: Umgebung „preview" oder „lokal" (bestimmeUmgebung) und Schlüssel mit sk_live_ → Client startet nicht, klare Fehlermeldung, Sentry ohne Schlüssel. Test.
- Nur wenn die Produktion mit Test-Schlüssel läuft (über bestimmeUmgebung):
  - Kasse, an der Zahlart „Online bezahlen": „Testbetrieb: Echte Karten werden noch abgelehnt. Bitte wähle Bar bei Abholung." Bar bleibt wählbar, Beträge unverändert.
  - AdminShell: Hinweiskarte (orange) „Stripe läuft im Testmodus – Online-Zahlungen sind Testzahlungen, es fließt kein echtes Geld."
  - Einstellungen → Zahlung: „Online-Zahlung läuft noch im Testbetrieb."
  - Mit Live-Schlüssel verschwinden alle drei von selbst. Texte aus einer Quelle.
- Gespeichertes Hof-Konto, das Stripe nicht kennt (resource_missing / „No such account", z. B. Test-Konto nach der Live-Umstellung): gilt als nicht bereit, der Checkout bietet Online nicht an (wie ohne Konto, Z1), der Hof sieht „Online-Zahlung neu einrichten". stripeAccountId NICHT automatisch löschen. Sentry höchstens einmal je Hof und Tag, nur Hof-ID.
- Neu: docs/betrieb/stripe-live.md – Schritte für den Menschen am Schluss: Stripe live aktivieren; Connect live; zwei Live-Webhooks (Plattform und Connect; Events laut src/app/api/stripe/webhook/route.ts, mindestens refund.failed, charge.refund.updated, payment_intent.canceled, account.updated); neue Variablen nur für Production (sk_live_, pk_live_, beide Webhook-Secrets, Connect-Client-ID – STRIPE_CONNECT_WEBHOOK_SECRET fehlt heute ganz); bestehende STRIPE_* auf Preview beschränken; EPS, Apple Pay, Google Pay live aktivieren; Apple-Pay-Domain farmerzone.at; neu deployen; Höfe richten Stripe neu ein; Vorschlag, wie Testbestellungen von vor der Umstellung aus Auswertungen herausgehalten werden (nur Vorschlag). Keine Werte.
- Keine Migration, kein Aufruf an Stripe.

#### 43 Testumgebung test.farmerzone.at (Z3) – gestapelt auf 42
- src/lib/umgebung.ts: In der Umgebung „preview" zusätzlich NEXT_PUBLIC_APP_URL als vertrauenswürdige Herkunft und appUrl zulassen (nur https). Tests: Produktion unverändert, Vorschau ohne Variable unverändert, Vorschau mit Variable.
- AdminShell (nur Admins): Marke „Stripe Live" bzw. „Stripe Test" aus bestimmeUmgebung (nie der Schlüssel) und Link „Zur Testumgebung" auf NEXT_PUBLIC_TESTUMGEBUNG_URL (ohne Variable kein Link). Im Umgebungsbanner der Testumgebung ein Link „Zur echten Seite".
- E-Mails außerhalb der Produktion nur an Adressen aus TEST_EMPFAENGER (kommagetrennt) oder @example.com; alles andere wird nicht verschickt, nur gezählt (ohne Adresse). Test.
- .github/workflows/staging-nachziehen.yml: bei push auf main den Branch staging per Fast-Forward auf main setzen. Trigger push, nie pull_request_target; permissions contents: write nur in diesem Job; kein Force-Push; geht der Fast-Forward nicht, wird der Job rot statt zu überschreiben.
- Neu: docs/betrieb/testumgebung.md für den Menschen:
  - Branch staging anlegen; Domain test.farmerzone.at bei Vercel dem Branch staging zuweisen; DNS-Eintrag.
  - Branch-Variablen nur für staging: NEXT_PUBLIC_APP_URL und BETTER_AUTH_URL = https://test.farmerzone.at; optional RESEND_API_KEY mit TEST_EMPFAENGER. In Production: NEXT_PUBLIC_TESTUMGEBUNG_URL.
  - Stripe-Testmodus: einen ZWEITEN Webhook-Endpunkt https://test.farmerzone.at/api/stripe/webhook anlegen (zusätzlich, nicht statt des bestehenden – die Produktion läuft bis zur Live-Schaltung selbst im Testmodus); dessen Secret als STRIPE_WEBHOOK_SECRET nur für Branch staging. Apple-Pay-Domain test.farmerzone.at im Testmodus.
  - Abnahme: ohne Vercel-Login kein Zugriff (401); Banner zeigt „Stripe Test"; Vercel baut den Push der Action.
- Keine Migration; kein Aufruf an Vercel, DNS oder Stripe.

#### 44 Rückweg im Hofbereich (N1)
- elternseite(pfad) in src/lib/bauern-navigation.ts, getestet: /settings/* → Einstellungen; /customers/[id] → Kunden; /orders/[id] → Bestellungen; /status/new und /status/[id]/send-whatsapp → Beiträge; /fehler-melden → Hilfe und Rückmeldung; /analytics/umfeld → Auswertung; /status/plakat → Heute. Seiten der Leiste und des Mehr-Blatts haben keinen Rückweg.
- Baustein UnterseitenKopf (components/hofbereich/): am Handy fest oben (sticky, 56 px), Pfeil plus Name der Elternseite (15 px halbfett, ganze Fläche ≥ 44 px antippbar), darunter der Titel; im Browser die bisherige Zeile „‹ …". Ersetzt EinstellungenKopf, ZurueckZuEinstellungen und ZurueckLink auf allen genannten Seiten.
- Einstellungs-Unterseiten: nach erfolgreichem Speichern Toast „Gespeichert" und zurück zu /settings. Ausnahme: Abholzeiten bleibt auf der Seite.
- „Einstellungen → Mein Auftritt" im Hof-Profil wird ein Link.
- Mehr-Blatt: Zeile „Angemeldet …" wird ein Link auf „Konto und Sicherheit".

#### 45 Hofbereich kinderleicht
- Heute: höchstens ein Hinweis-Kasten oben (Vorrang: Stripe einrichten); Teilen kompakt unter die Packliste. „Umsatz heute" eindeutig („Heute eingenommen, mit Hofladen") oder Direktverkäufe getrennt; „0 Bestellungen" neben „€ 178" darf nicht widersprüchlich wirken.
- Bestellungen: genau drei Filter „Heute abholen", „Noch offen", „Erledigt".
- Kunden: Sortierung hinter einem Knopf „Sortieren", höchstens zwei Filter sichtbar.
- Unterleiste: Wort „Neu" unter dem Plus.
- Fachwörter („Primärproduktion", „Umsatzgrenze", „Kennzeichnung", „USP") durch Alltagswörter ersetzen oder mit einem Satz erklären; USP ausschreiben („Unternehmensserviceportal (USP)"), auch im Mockup mobil-h2-neues-futter-meldung-fehlt. E10-Pflichttexte nicht umformulieren, nur erklären. Texte aus einer Quelle.
- Brennholz: Anzahl der Produkte mit Einheit m³ je Hof (ohne Namen) im Bericht, mit Hinweis auf rm/srm. Daten ändert der Hof.

#### 46 Kundensicht kinderleicht (N2; Geldpfad)
- /hoefe: ein Suchfeld „Ort oder Produkt" plus „Standort nutzen"; erster Hof bei 390 × 844 ohne Scrollen sichtbar.
- Hofseite: Abholtermine entweder antippbar (übernehmen den Termin in die Kasse) oder klar als Text, keine Knopf-Optik ohne Funktion.
- Kasse: Pflicht-Haken bei Bar weg (Schema und Server prüfen ihn nicht mehr); Kaufknopf bleibt „Zahlungspflichtig bestellen"; jeder Termin mit Datum („Sa, 10. Okt"). Neuigkeiten-Haken von der Kasse auf die Bestätigungsseite (online und bar); E-Mail weiter mit Double-Opt-in über die bestehende Logik (meldeEmailAboAn), keine zweite. Ein Abo rollt nie eine Bestellung zurück. Der Testbetrieb-Satz aus 42 bleibt erhalten.
- Cookie-Hinweis verdeckt weder Unterleiste noch Kaufknopf.
- Beträge, Servicegebühr und B1 unverändert; alle Betrags-Tests bleiben grün.

#### 47 Altlasten aus Lauf 7 und Laufzeit-Befunde (Sicherheitspfad)
- loeseOffeneAnfrageAuf mit ausdrücklichem Rückgabetyp; Quelltext-Wache für optInEmail: true schärfen.
- Werbliche Mails mit List-Unsubscribe und List-Unsubscribe-Post (Ein-Klick, signierter Link).
- sentry-hygiene.ts: zusätzlich logentry, tags, extra, übrige contexts, frame.vars und Brotkrumen-Daten filtern; Test je Feld.
- Bremse über die Datenbank: Sentry bei DB-Ausfall höchstens einmal je Instanz und 10 Minuten.
- minCents-Meldungen der Servicegebühr geduzt und mit Ausweg.
- DeprecationWarning auf /[farmSlug]/checkout: die Stelle finden, an der zwei Abfragen gleichzeitig über dieselbe Verbindung laufen (typisch Promise.all mit dem Transaktions-Client), nacheinander ausführen; Test, der Promise.all mit tx im Quelltext verbietet. In pg@9 wird daraus ein Fehler.
- EAUTHTIMEOUT beim Neubau von /hoefe: öffentliche Lesepfade (getOeffentlicheHoefe) bei Verbindungsfehler 08006 genau einmal nach kurzer Pause wiederholen; nie in Schreibpfaden, nie in Transaktionen; Sentry nur, wenn auch die Wiederholung scheitert.

#### 48 Probelauf (Nachholung von 34)
- Vorbedingung A: Vorschau-Banner zeigt „Stripe Test" (am 08.10.2026 erfüllt; vor dem Start erneut lesen, nichts entschlüsseln). Vorbedingung B: Vorschau und api.stripe.com sind aus der Sitzung erreichbar.
- A und B erfüllt: Abläufe 1–12 aus freigabe.md §11 Nr. 34, nur Testkarten, nur Dev-Datenbank; Fehler als 48a, 48b … direkt danach.
- Sonst: keinen Code, sondern docs/nachtlauf/probelauf-checkliste.md – die 12 Abläufe Schritt für Schritt für den Menschen (an test.farmerzone.at, solange es die nicht gibt an der Branch-Adresse von integration/lauf8). Je Ablauf: Testkarte (4242 4242 4242 4242; 3-D-Secure 4000 0027 6000 3184; EPS im Testmodus), erwartete Beträge (Ware, Servicegebühr nach E4/B1, Hofanteil) und wo sie im Stripe-Dashboard (Testmodus) und im Admin stehen. Dazu die Abschnitte „Hof-Anmeldung am Handy" (Anmelden oben, Mein Hof, Startbildschirm) und „Rückweg" (Einstellungen → Hof-Profil → Speichern). Status „erledigt (Checkliste)".
- Im Bericht: Vorschau und Produktion teilen den Test-Schlüssel, Test-Webhooks gehen an alle Test-Endpunkte. Im Code prüfen (kein Aufruf), dass der Webhook eine unbekannte Bestellung mit 200 und ohne Fehlerflut quittiert; sonst als 48a beheben.

#### Sammel-PR (Haltepunkt)
integration/lauf8 von main; Doku-PR und alle PRs per git merge --no-ff in der Reihenfolge von §1 (43 nach 42). Doku-Konflikte: beide Seiten behalten. Code-Konflikte (erwartbar in AdminShell, kunde-shell, umgebung.ts, Kasse) sauber zusammenführen, jede Auflösung im PR-Text begründen. typecheck, lint, test und test:integration auf dem Gesamtstand grün. Entwürfe nicht aufnehmen.

### §2 Regeln
- Vor jeder Nummer origin/main hineinholen.
- Migrationen: keine. Entsteht eine: STOPP für diese Nummer, melden, nächste Nummer.
- Nie Produktion, nie Live-Schlüssel, keine schreibenden Aufrufe an Stripe, Resend, Vercel oder DNS. Die Stripe-Live-Schaltung ist nicht Teil dieses Laufs.
- Mockup-Abweichungen nur wie beschrieben, jede im Bericht mit Bild.
- Nachprüfung des Fix-Commits bei 42, 43, 46 und 47.
- Keine Personendaten in Berichten; Hof-Angaben nur als Anzahl.

### §3 Checkliste je PR (im PR-Text abhaken)
- [ ] Register und Freigabe decken den Inhalt ab
- [ ] origin/main vor dem Push hineingeholt
- [ ] pnpm typecheck, pnpm lint (kein neuer Befund), pnpm test grün
- [ ] pnpm test:integration grün, wenn Datenbank berührt
- [ ] Migration: nein
- [ ] Geld nur als Int-Cent, Beträge nur serverseitig
- [ ] Keine Personendaten oder Secrets in Code, Logs, Tests
- [ ] Bilder 390 und 1440 px vorher/nachher, beide Themes, im Bericht
- [ ] Axe ohne Fehler, Touch-Ziele ≥ 44 px, neue Seiten mit loading.tsx
- [ ] Texte aus einer Quelle, Deutsch, per Du
- [ ] tester und pruefer gelaufen, Befunde erledigt oder begründet
- [ ] Entwurf, wenn eine Vorbedingung offen ist

### §4 Morgenbericht (`morgenbericht-<datum>-lauf8.md`)
Ergebnis von 48 zuerst. Dann je PR: Vorschau-Link, Migration nein, Basis. Sammel-PR mit Konfliktauflösungen. Bilderstrecke „Handy vorher/nachher": Startseite ausgeloggt, Für Höfe, Hofseite, Kasse, Heute, Bestellungen, Kunden, Hof-Profil unten. „Für dich zu tun": Testumgebung einrichten (docs/betrieb/testumgebung.md), Probelauf nach Checkliste, und als letzter Schritt die Live-Schaltung (docs/betrieb/stripe-live.md).

### Fortsetzung (uttoranger, 09.10.2026, im Chat)
Stand laut status.md auf docs/lauf8 (70d5a80): 41, 42, 43, 44, 47 fertig (#221, #223, #226, #222, #224), 48 als Checkliste (#225, Runde 2 zu 46 offen). 45 in Nachbesserung Runde 1, 46 in tester/pruefer – beide noch NICHT gepusht.
1. Sofort: den Arbeitsstand von 45 und 46 als WIP-Commit auf ihre Branches pushen (nacht/2026-10-08/45-hofbereich, nacht/2026-10-08/46-kundensicht), damit nichts verloren geht. Kein git stash.
2. Dann nach freigabe.md §12 weiter: 45 Runde 1 abschließen (Blocker „Satz zur Umsatzgrenze passt nicht zum Code"), 46 Prüfung und ggf. Nachbesserung (Geldpfad: Nachprüfung), 48 Runde 2 (Teil zu 46).
3. Sammel-PR integration/lauf8 nach §1. Erwartete Konflikte: DEVELOPMENT.md (beide Seiten behalten); src/app/admin/layout.tsx, src/components/shells/admin-shell.tsx und src/lib/admin-navigation.ts zwischen 41 und 42/43. Alle Änderungen erhalten: „Mein Hof" und Plakette aus 41, Testmodus-Karte aus 42, Stripe-Marke und Link zur Testumgebung aus 43. Jede Auflösung im PR-Text begründen; typecheck, lint, test, test:integration grün.
4. Morgenbericht nach §4.

Hat diese Sitzung den Arbeitsstand von 45/46 nicht mehr: beide neu von origin/main nach §12 umsetzen und das im Morgenbericht vermerken.

## 13. Lauf 9 (uttoranger, im Chat erteilt, 10.10.2026)

Nachtlauf 9 – Freigabe (uttoranger, im Chat erteilt, 10.10.2026)

Arbeite als Dirigent nach docs/nachtlauf.md (§2 Regeln, §4 Ablauf je Gate, §5 Stoppen, §6 Morgenbericht). Dieser Text ist die Freigabe. Zuerst der Doku-PR (Branch docs/lauf9 von main), er enthält:
- diesen Text wörtlich als §13 „Lauf 9" in docs/nachtlauf/freigabe.md;
- in docs/nachtlauf.md §3 die Zeilen 49–57 und Sammel 9, dazu „Reihenfolge in Lauf 9" mit den Stapel-Ausnahmen aus §1 unten;
- in docs/entscheidungen.md:
  - neu N3, N4, N5 und Z4 (unten);
  - Vermerke: E12 „ergänzt durch N3"; O2 „entschieden durch N4"; F4 „Online-Zahlung einrichten nur noch im Kasten (Nr. 53); Kennzahlen 2 + 1 bis 1024 px";
  - neue offene Punkte O6 (Kachelquelle) und O7 (Gründungszusage);
- in docs/nachtlauf/status.md: 41–48 und Sammel 8 auf „gemergt (#229)".

Stand: main = 90cff24 (#229 Lauf 8 gemergt, Produktion READY). Vorschau und Produktion laufen mit Stripe im Testmodus; kein Lauf schaltet um. Der Probelauf (probelauf-checkliste.md) kommt erst nach diesem Lauf, an test.farmerzone.at.

Reicht das Budget nicht: Die Reihenfolge in §1 ist die Priorität. Nicht begonnene Nummern bleiben für Lauf 10 und stehen so im Morgenbericht.

### Ausgangslage (geprüft 10.10.2026, nur lesend, lokaler Build von 90cff24 mit Seed-Daten)
- Hof-Unterleiste (nur unter md, ui/bottom-nav.tsx): Heute · Bestellungen · Neu · Produkte · Mehr (HOF_HANDY_LEISTE, bauern-navigation.ts). Mein Hof liegt nur im Mehr-Blatt. Ab md gibt es die Seitenleiste.
- Mein Hof unter lg (farm-page/page.tsx):
  - oben der Seitenkopf mit dem Knopf „Kundenansicht ↗", der einen neuen Tab öffnet (components/mein-hof/seitenkopf.tsx);
  - darunter die Checkliste;
  - erst darunter der Umschalter „Bearbeiten | Kundenansicht" (ui/segment.tsx in farm-page-client.tsx). „Kundenansicht" ist dort die echte Hofseite im iframe, „Bearbeiten" die alte FarmPageView mit Stiften (altes Aussehen, O2).
- Mein Hof ab lg: Liste mit Formularen je Abschnitt plus echte Vorschau Handy/Web (hofseite-editor.tsx, hofseite-vorschau-rahmen.tsx).
- Mein Auftritt (settings/appearance/appearance-client.tsx): Logo, Titelbild, Tagline, Gründungsjahr, Über uns, Werte, Bereiche, Galerie; Vorschau im neuen Tab.
  - saveAppearanceAction (server/actions/appearance.ts) schreibt IMMER alle Felder: tagline, foundedYear, aboutText, sectionsConfig, und farmValues werden gelöscht und neu angelegt.
  - Ein Formular mit nur einem Teil der Felder löscht den Rest. hofseite-editor.tsx umgeht das mit auftrittBasis.
- „Über uns": hofseite-kunde.tsx (Z. 231) zeigt aboutText ?? description, die Checkliste (hofseite-fortschritt.ts Z. 152) prüft nur aboutText. Die Checkliste meldet „fehlt", obwohl Kundinnen einen Text sehen.
- Produkt-Dialog Lebensmittel (products/product-dialog.tsx): keine Käufer-Vorschau. Futter (KaeuferVorschau, E9-Schild) und Brennholz haben eine eigene.
- Hofseite unter lg, Reiter Übersicht: Fotos und Produkte erst nach Abholung, Zahlung und Anfahrt (Mockup mobil-k2-hofseite).
- Karte /hoefe am Handy (Bewertung 66/100), gemessen bei 390 × 844:
  - Die Karte (h-[60vh]) endet bei 850 px, die Unterleiste der KundeShell beginnt bei 775 px. Karussell-Karte samt „Zum Hof" und „Tippe einen Hof an" liegen darunter.
  - Beim Öffnen fällt die Fläche bis zum Laden zusammen (next/dynamic ohne loading in hoefe-client.tsx), dann springt die Karte herein.
  - Nummern-Pins überdecken sich in der Übersicht (Seed: 2/4/22, 10/11, 16/17, 19/20).
  - Querformat 844 × 390: ~100 px Karte sichtbar, 9 von 21 Pins, kein Neu-Einpassen.
  - Die Attribution „Leaflet | © OpenStreetMap-Mitwirkende" deckt oben fast die ganze Breite.
- Karte im Browser (82/100): Pins überdecken sich; nach Größenwechsel bleibt der Ausschnitt stehen (1100 px: 19 von 21 Pins). Leaflet misst nur beim Start und bei window-resize. Standortkarte (settings/standort-karte.tsx, über profile-form.tsx) ohne Lade-Platzhalter.
- Heute am Handy: acht Karten, „Online-Zahlung einrichten" dreimal (Kasten, Erste Schritte, Hofseite-Fortschritt).
- Auswertung: „Warenumsatz € 0" neben „Umsatz pro Tag € 206".
- Admin am Handy: /admin/meldungen 565 px, /admin/finanzen 661 px breit.
- Ohne KundeShell bzw. altes Design: /[farmSlug]/bestellung/[orderId], der Kopf von /[farmSlug]/bestaetigen/[token], /konditionen, /impressum, /datenschutz, /problem-melden, die not-found-Seiten ohne Shell, /forgot-password, /reset-password.
  - /reset-password trägt den Token in der Adresse, hat aber weder no-referrer noch noindex.
- Datenschutzerklärung:
  - #210 (Nr. 33, Branch nacht/2026-10-07/33-datenschutz, Stand 07.10.) ist noch Entwurf.
  - Auf main nennt sie den Knopf „In meiner Nähe", er heißt „Standort nutzen".
  - Es fehlen der Double-Opt-in (#217, 46) und der Rate-Limit-Zähler (#218, Bericht 40).
- Sentry JAVASCRIPT-NEXTJS-9 (09.10. 20:02 UTC): GET /hoefe, EAUTHTIMEOUT auch nach der Wiederholung (Nr. 47). Ob die Fehleranzeige ausgeliefert wurde, ist nicht erkennbar.
- Online-Bestellungen aus der Testzeit zählen als Umsatz bzw. Gebühr (stripe-live.md §10). Dieselbe Zuordnung steht an mehreren Stellen:
  - umsatzBestellungWhere: Auswertung und Verkäufe samt Jahressumme für die Umsatzgrenze;
  - topfVonBestellung (lib/finanzen.ts): Admin-Finanzen;
  - rohes SQL monatsSpaltenJeHof (server/queries/admin.ts): Admin-Hofliste;
  - Heute und Kunden-Umsätze.

### Entscheidungen (mit diesem Start freigegeben; ins Register)
- N3 · Mein Hof in der Handy-Leiste (ergänzt N1 und E12):
  - Unter md heißt die Leiste Heute · Bestellungen · Neu · Mein Hof · Mehr. Mein Hof hat dort die Reiter Produkte · Hofseite · Beiträge.
  - Ein Tipp auf „Mein Hof" öffnet Produkte, damit der Vorrat ein Tipp bleibt.
  - Die Route /products bleibt. Der Leistenpunkt „Mein Hof" ist aktiv auf /products*, /farm-page* und /status*.
  - Ab md bleiben Seitenleiste und Reiter wie heute (Hofseite | Beiträge).
- N4 · Hofseite an EINEM Ort bearbeiten (entscheidet O2):
  - Alles, was Kundinnen auf der Hofseite sehen, wird in Mein Hof bearbeitet. Mein Auftritt zieht dorthin; /settings/appearance leitet auf /farm-page um.
  - Unter lg steht der Umschalter „Bearbeiten · So sieht's die Kundin" ganz oben. „So sieht's die Kundin" ist die echte Hofseite in der App, kein neuer Tab.
  - „Bearbeiten" ist eine Liste der Abschnitte mit Blatt von unten. Die alte FarmPageView mit Stiften entfällt dort.
  - Nach dem Speichern auf den Reitern Hofseite und Beiträge erscheint „Gespeichert · Ansehen".
- N5 · Hofseite unter lg, Reiter Übersicht:
  - Unter dem Kopf zuerst das Schaufenster: ein Fotostreifen und bis zu vier Produkte, dazu „Alle Produkte (n)".
  - Danach unverändert: Nächste Abholung mit Abholzeiten, Zahlung & Kontakt, Über uns, Anfahrt; der Mini-Korb bleibt, wo er ist.
  - Ab lg unverändert.
- Z4 · Testzahlungen aus Auswertungen:
  - Online-Bestellungen, die vor dem Zeitpunkt in der Server-Variable STRIPE_LIVE_AB angelegt wurden, zählen nicht als Umsatz und nicht als Servicegebühr. Barbestellungen zählen immer.
  - Ohne Variable bleibt alles wie heute.
  - Abweichend von stripe-live.md §10 (Konstante) eine Variable: Zur Live-Schaltung ist dann keine Code-Änderung nötig. Den Wert setzt der Mensch.
- Offen, NICHT bauen:
  - O6 · Kachelquelle der Karten: OSM direkt, basemap.at oder ein Anbieter mit Schlüssel. Ein Wechsel ändert die Datenschutzerklärung.
  - O7 · Gründungszusage: Der Freischalt-Dialog im Admin (GRUENDUNGS_KONDITIONEN, lib/gruendungshof.ts) verspricht „keine Plattformgebühr bis 31.12.2029, danach dauerhaft 3 %". Das passt nicht zu E6 und K1. Der Mensch entscheidet; der Text bleibt.

### §1 Warteschlange (fest, zugleich Priorität)
49 → 52 → 50 (auf 49) → 55 → 53 (auf 55) → 51 → 54 → 56 → 57 (Entwurf) → Sammel-PR (Haltepunkt).
- Jede Nummer: Branch nacht/2026-10-10/<nr>-<kurz> von origin/main, ein PR.
- Ausnahmen: 50 von Branch 49, 53 von Branch 55, 57 siehe dort.

#### 49 Mein Hof in der Leiste und Kundensicht (N3, N4 Teil 1)
- bauern-navigation.ts:
  - eigener Leistenpunkt „Mein Hof" (href /products) mit eigener Aktiv-Regel nur für die Leiste; die Seitenleiste bleibt unberührt;
  - „Mein Hof" verlässt das Mehr-Blatt, „Produkte" kommt NICHT hinein (HOF_MEHR entsprechend);
  - die Reiter über MEIN_HOF_REITER_HOFBEREICH erweitern, keine zweite Liste; MEIN_HOF_HINWEIS anpassen;
  - Tests: Aktiv-Zustand bei gleicher Länge, Mehr-Blatt, Seitenleiste unverändert.
- Reiterleiste Produkte · Hofseite · Beiträge als EIN Baustein, unter md auf /products, /farm-page und /farm-page?reiter=beitraege.
- Umschalter: den bestehenden Segment-Umschalter aus farm-page-client.tsx nach ganz oben unter den Seitenkopf ziehen, beim Scrollen sichtbar.
  - Beschriftung „Bearbeiten · So sieht's die Kundin".
  - Die Kundenansicht bleibt das bestehende iframe der echten Hofseite (vorschauLink, volle Breite, Maßstab 1), keine zweite Darstellung.
  - Unter lg schaltet „Kundenansicht" im Seitenkopf auf diese Ansicht. Ein leiser Link „In neuem Tab öffnen" bleibt.
  - Auf Produkte zeigt „So sieht's die Kundin" den Reiter Produkte der Hofseite im iframe.
- „Gespeichert · Ansehen" nur auf den Reitern Hofseite und Beiträge; Produkte behält den Teilen-Moment aus Nr. 30. „Ansehen" schaltet um und springt zum Abschnitt. Dafür die vorhandene Markierung (MARKIERUNG_TYP, schemas/hofseite-vorschau.ts) mitnutzen.
- „Über uns": EINE Funktion in src/lib/, die hofseite-kunde.tsx und hofseite-fortschritt.ts nutzen. Regel: aboutText getrimmt, leer = null, dann description.
  - Tests: null, Leerzeichen, gefüllt.
  - Die Folge für den Prozentwert in Heute im Bericht nennen.
- Mockup-Abweichungen (mobil-h1-mein-hof, mobil-h5-mehr-auswertung-region-mein-hof): wie hier beschrieben, je mit Bild.
- Abnahme (390 px): „Mein Hof" in der Leiste öffnet Produkte; zwei Tipps bis zur Kundenansicht der Hofseite; kein neuer Tab. Bei 800 px: Seitenleiste wie vorher, keine Reiter „Produkte".

#### 52 Karte (/hoefe, Standortkarte im Hof-Profil, Region)
- Handy-Kartenmodus (/hoefe?ansicht=karte, unter lg):
  - Titel und Unterzeile ausblenden. Oben EINE Zeile Suche · Filter · Liste zeigen.
  - Darunter die Karte bis genau zur Oberkante der Kunden-Unterleiste (die gibt es nur unter md; von md bis lg bis zum Fensterrand): 100dvh minus Kopf, Werkzeugzeile, Unterleiste und env(safe-area-inset-bottom). Maße aus einer Quelle (KundeShell).
  - Karussell und „Tippe einen Hof an" liegen sichtbar über der Unterleiste.
  - Querformat: Die Karte füllt mindestens 70 % der sichtbaren Höhe.
  - Das Mockup zeigt den Kartenmodus nicht → DESIGN_SYSTEM.
- Laden: Platzhalter in Kartengröße („Karte lädt …", Token-Farben) für hoefe-karte und standort-karte. umfeld-karte ist ein Adapter um HoefeKarte; umfeld-anzeige hat schon einen. Kein Zusammenfallen, kein Springen.
- Größenwechsel: EIN gemeinsamer Hook für beide Leaflet-Stellen.
  - ResizeObserver am Kartencontainer ruft map.invalidateSize().
  - Solange die Nutzerin weder verschoben noch gezoomt hat, wird die Übersicht neu eingepasst (fitBounds), auch beim Drehen.
  - Standortkarte: Der feste Pin bleibt die echte Kartenmitte.
- Überlappende Pins:
  - Reine Funktion in lib/hoefe-anzeige.ts mit Tests: Pins, die sich bei der aktuellen Zoomstufe überdecken, werden ein Gruppen-Pin mit Anzahl. Ein Tipp zoomt hinein; bei maximaler Zoomstufe leicht auffächern.
  - KEIN neues Paket (Regel 4).
  - Die Nummern der Liste bleiben. Der Gruppen-Pin heißt für Screenreader „3 Höfe".
- Attribution:
  - Leaflet-Präfix weg (setPrefix(false)). „© OpenStreetMap-Mitwirkende" mit Link bleibt sichtbar (OSM-Pflicht).
  - Polster oben, damit kein Pin darunter liegt.
- Kachelquelle, helle Kacheln im Dunkelmodus und Pin-Farben bleiben (O6).
- Im Bericht ein Vorschlag zu O6: OSM-Kachelrichtlinie; basemap.at (laut Betreiber kostenlos auch kommerziell, CC BY, nur Österreich); Anbieter mit Schlüssel. Jeweils mit der Folge für die Datenschutzerklärung.
- Abnahme im Bericht (agent-browser; die Messungen brauchen keine Kacheln, nie gezielt gegen tile.openstreetmap.org messen):
  - Unterkante der Karussell-Karte ≤ Oberkante der Unterleiste bei 390 × 844, 375 × 667 und 360 × 740;
  - Querformat 844 × 390;
  - Seitenhöhe beim Öffnen der Karte unverändert;
  - keine überlappenden Pin-Nummern in der Übersicht der Seed-Daten;
  - 1440 und 1100 px: alle Pins nach dem Größenwechsel sichtbar.

#### 50 Mein Auftritt zieht in Mein Hof (N4 Teil 2) – gestapelt auf 49; Datenpfad, Nachprüfung
- „Bearbeiten" unter lg: Liste der Abschnitte in der Reihenfolge der Hofseite.
  - Zeilen: die bestehenden Fortschrittszeilen (hofseite-fortschritt.ts) plus neue Zeilen für Tagline/Gründungsjahr und Werte.
  - Jede Zeile zeigt den Stand (fertig/fehlt) und „Bearbeiten"; bearbeitet wird in einem Blatt von unten.
  - Neue Zeilen-IDs auch in die Zod-Aufzählung (schemas/hofseite-vorschau.ts).
- Bausteine: die vorhandenen Formulare je Abschnitt aus hofseite-editor.tsx. Neu herauslösen nur Tagline, Gründungsjahr und Werte aus appearance-client.tsx. Ab lg nutzt hofseite-editor.tsx dieselben Bausteine.
- Speichern: Jeder Abschnitt speichert über auftrittBasis mit frischem Stand und dieselben Server Actions, keine zweite Speicherlogik.
  - Test (Integration): Speichern eines Abschnitts lässt alle anderen Felder unverändert, auch tagline, foundedYear, aboutText, sectionsConfig und farmValues.
- /settings/appearance leitet auf /farm-page um; Lesezeichen bleiben gültig.
  - Die Zeile „Mein Auftritt" in den Einstellungen bleibt als Link auf Mein Hof.
  - Verweise anpassen: lib/hof-einstellungen.ts, EINSTELLUNG_FUER_ZEILE, revalidatePath in appearance.ts, Verweis im Hof-Profil.
- Bild-Upload unverändert (image-upload.tsx, HEIC-Regel, WebP).
- Kartenform ohne eigenen Schatten (DESIGN_SYSTEM: Fläche mit Rand); die oklch-Schattenfarbe aus appearance-client.tsx fällt weg.
- Abnahme: am Handy Logo, Titelbild und ein Galeriefoto ändern, speichern, unter „So sieht's die Kundin" sehen. Danach dasselbe ab lg. Kein anderes Feld hat sich geändert.

#### 55 Testzahlungen aus Auswertungen (Z4; Geld-Anzeige, Nachprüfung)
- EINE Regel aus einer Quelle (src/lib/), in drei Formen: Prüfung istTestzahlung(order), Prisma-Where und Prisma.sql-Baustein für rohes SQL. Regel: Zahlart online UND createdAt < STRIPE_LIVE_AB.
- Diese Stellen nutzen sie, keine zweite Stelle:
  - umsatzBestellungWhere (Auswertung, Verkäufe samt Jahressumme für die Umsatzgrenze);
  - topfVonBestellung (Admin-Finanzen);
  - monatsSpaltenJeHof (Admin-Hofliste);
  - Heute;
  - Kunden-Umsätze (paymentMethod dort mitladen).
- getDashboardStats: prüfen, ob noch genutzt. Ungenutzt → löschen, sonst über die Regel.
- Tests:
  - Quelltext-Wache wie bei optInEmail;
  - /admin und /admin/finanzen zählen gleich;
  - ohne Variable ist das Ergebnis gleich zu heute.
- STRIPE_LIVE_AB:
  - ISO-Zeitpunkt MIT Zeitzone, nur serverseitig gelesen; die Funktionen bekommen den Stichtag als Parameter (rein, testbar).
  - Ungültig oder ohne Zeitzone → ignoriert, Sentry-Warnung höchstens einmal je Instanz (Muster NEXT_PUBLIC_TESTUMGEBUNG_URL, umgebung-server.ts).
- Hinweiszeile: Ist die Variable gesetzt und betrifft sie Bestellungen, steht in Auswertung, Verkäufe und Admin-Finanzen leise „Testzahlungen vor dem <Datum> sind nicht mitgezählt."
- Bestellungen, Beträge, Checkout, Webhook, Erstattung und Storno unverändert. Keine Migration.
- docs/betrieb/stripe-live.md:
  - Schritt 4 um STRIPE_LIVE_AB ergänzen: nur Production, Wert = Beginn des Redeploys aus Schritt 8, mit Zeitzone.
  - Hinweis: Online-Bestellungen im Bau-Fenster sind noch Testzahlungen und würden mitgezählt. Darum ruhige Stunde (§0), danach Admin → Finanzen prüfen.
  - §10 auf „umgesetzt (Nr. 55, Variable statt Konstante)".

#### 53 Heute, Auswertung, Verkäufe – gestapelt auf 55
- Heute:
  - Der Stripe-Kasten bleibt der eine Hinweis oben (F4, 45).
  - „Erste Schritte" und Hofseite-Fortschritt werden EINE Liste „Zu tun" (lib/erste-schritte.ts, hofseite-fortschritt.ts, ChecklisteKompakt): jede Aufgabe einmal; was der Kasten zeigt, nicht noch einmal; Erledigtes verschwindet.
  - Kennzahlen 2 + 1 bis 1024 px. „Heute eingenommen" bleibt (45).
- Auswertung: „Warenumsatz" und „Umsatz pro Tag" werden zu „Über FarmerZone" (Bestellungen) und „Mit Hofladen" (mit Direktverkäufen). Nicht „Gesamt" (F6); Texte aus einer Quelle.
- Verkäufe bleiben beim Wortlaut aus F6 („Dieses Jahr (für die Umsatzgrenze)"); der gebundene Satz in tests/fachwort-wache.test.ts bleibt.
- Nur Beschriftung und Anordnung. Die Rechnung (lib/umsatz.ts, lib/heute.ts, Queries) bleibt bis auf 55 unverändert; alle Betrags-Tests grün.
- Abnahme mit zwei Seed-Höfen: neu ohne Stripe und fertig eingerichtet. Kartenzahl auf Heute am Handy vorher/nachher im Bericht; „Online-Zahlung einrichten" höchstens einmal.

#### 51 Hofseite: Schaufenster zuerst (N5) und Käufer-Vorschau Lebensmittel
- Hofseite unter lg nach N5. Fotos als Streifen-Variante von HofseiteFotos (heute ein Raster bis 6), Produkte über die echte ProduktKarte (hofseite/produkt-karte.tsx).
  - Anzahl je Breite statt UEBERSICHT_PRODUKTE für alle; ab lg unverändert.
  - „Alle Produkte (n)" wechselt in den Reiter Produkte.
  - Ohne Fotos fällt der Streifen weg, ohne Produkte das Schaufenster.
- Produkt-Dialog Lebensmittel: „So sehen Käufer dein Produkt" mit der echten ProduktKarte, ohne Link und ohne Korb, live aus den Formularwerten (Foto, Name, Preis, Einheit).
  - Futter (KaeuferVorschau mit E9-Schild, Mockup web-h2-neues-futter) und Brennholz bleiben, wie sie sind.
- Fokusrahmen am Akkordeon im Produkt-Dialog nach DESIGN_SYSTEM richten.
- Beträge, Preislogik und Server-Prüfung unverändert.

#### 54 Admin am Handy und alte Seiten ins neue Design (Sicherheitspfad, Nachprüfung)
- /admin/meldungen und /admin/finanzen bei 390 px ohne seitliches Wischen.
  - Zeilen umbrechen, Diagramm an die Breite anpassen, Tabellen als Karten oder mit Querscrollen nur im eigenen Kasten.
  - Im Bericht scrollWidth aller Admin-Seiten bei 390 px.
- In die KundeShell bzw. die Fokus-Variante (wie /register und /verify):
  - /[farmSlug]/bestellung/[orderId], der Kopf von /[farmSlug]/bestaetigen/[token];
  - /konditionen, /impressum, /problem-melden;
  - die not-found-Seiten ohne Shell;
  - /forgot-password und /reset-password.
  - Seiten mit eigenem Mockup (fehler-404-*, fehler-500-problem-melden-kunde) nach diesem Mockup.
- /datenschutz NICHT, das kommt in 57.
- Signierte Links, Token-Prüfung, Referrer-Policy (next.config.ts) und noindex (Seiten-Metadaten) bleiben unverändert; Test, dass sie weiter gelten.
- /reset-password bekommt no-referrer und noindex wie /verify (Token in der Adresse).
- Alten Kopf entfernen, wenn ihn nichts mehr nutzt.

#### 56 Altlasten Lauf 8 §6 und Kleinkram (Sicherheitspfad, Nachprüfung)
- sentry-hygiene.ts: E-Mail-Muster auch mit Nicht-ASCII-Zeichen; doppelt kodierte Adressen (%2540); Token in relativer Adresse in exception.value (Bericht 47). Ein Test je Fall.
- tests/integration/bargebuehr.int.test.ts: auf den Mail-Nachlauf warten statt zu früh zu prüfen.
- trustedOrigins in der Produktion: NEXT_PUBLIC_APP_URL als bereinigte https-Origin übernehmen.
  - Ist der Wert ungültig: Rohwert behalten und Sentry-Warnung, NIE leeren. Ein leerer Wert ließe APP_URL auf localhost fallen.
  - Tests.
  - Die Vercel-Adresse der Produktion bleibt, wie sie ist.
- /hoefe: Wird HoefeFehler wirklich ausgeliefert, eine Sentry-Warnung mit Tag sichtbar=ja, höchstens einmal je Instanz und 10 Minuten.
- /fehler-melden: Name nicht doppelt (44).
- Feldhinweise „Steht auf dem Sackanhänger" in product-dialog.tsx und futter-formular.tsx für eigene Ernte passend ergänzen. E10-Pflichttexte nicht umformulieren.

#### 57 Datenschutzerklärung, Nachtrag (Entwurf; nicht im Sammel-PR)
- Zuerst origin/main in nacht/2026-10-07/33-datenschutz mergen (DEVELOPMENT.md: beide Seiten behalten) und pushen; das aktualisiert #210. Dann 57 von diesem Branch abzweigen. PR als Entwurf mit Basis = dieser Branch.
- Nachtragen:
  - Neuigkeiten: Anmeldung auf der Bestätigungsseite, nur E-Mail, Double-Opt-in per Klick, Ein-Klick-Abmeldung mit List-Unsubscribe; WhatsApp ohne neuen Einstieg.
  - Umkreissuche: Knopf „Standort nutzen".
  - Rate-Limit-Zähler: HMAC aus IP, E-Mail oder Sitzung, bis etwa 25 Stunden; Satzvorschlag Bericht 40.
  - Sentry ohne IP (#215).
  - Kartenkacheln: Stand prüfen.
- /datenschutz im selben Entwurf ins neue Design.
- Im Bericht eine Tabelle Aussage → Stelle im Code zum Gegenlesen; offene Rechtsfragen als Liste. Nichts erfinden, keine Rechtsberatung.

#### Sammel-PR (Haltepunkt)
- integration/lauf9 von main; Doku-PR und 49, 52, 50, 55, 53, 51, 54, 56 per git merge --no-ff in dieser Reihenfolge. 57 nicht.
- Erwartete Konflikte:
  - bauern-navigation.ts, Mein Hof und hofseite-fortschritt.ts (49/50/53);
  - hofseite-kunde.tsx (49/51);
  - Auswertung, Heute und Admin-Finanzen (55/53/54);
  - hoefe-client.tsx (52);
  - DEVELOPMENT.md.
  - Doku: beide Seiten behalten. Code: sauber zusammenführen, jede Auflösung im PR-Text begründen.
- Auf dem Gesamtstand, als eigener Commit im Sammel-PR: docs/nachtlauf/probelauf-checkliste.md.
  - §0, §1 und §10: Ort nur noch test.farmerzone.at; die Branch-Adresse von integration/lauf8 und der Aufräumteil dazu entfallen.
  - Abläufe an die Texte aus 49–55 anpassen.
- typecheck, lint, test und test:integration auf dem Gesamtstand grün. Entwürfe nicht aufnehmen.

### §2 Regeln
- Vor jeder Nummer origin/main hineinholen.
- Migrationen: keine. Entsteht eine: STOPP für diese Nummer, melden, nächste Nummer.
- Keine neuen Pakete.
- Nie Produktion, nie Live-Schlüssel, keine schreibenden Aufrufe an Stripe, Resend, Vercel, Supabase oder DNS.
- Mockup-Abweichungen nur wie in 49–54 beschrieben, jede im Bericht mit Bild.
- Nachprüfung des Fix-Commits bei 50, 54, 55 und 56.
- Keine Personendaten in Berichten; Hof-Angaben nur als Anzahl.

### §3 Checkliste je PR (im PR-Text abhaken)
- [ ] Register und Freigabe decken den Inhalt ab
- [ ] origin/main vor dem Push hineingeholt
- [ ] pnpm typecheck, pnpm lint (kein neuer Befund), pnpm test grün
- [ ] pnpm test:integration grün, wenn Datenbank oder Geld berührt
- [ ] Migration: nein
- [ ] Geld nur als Int-Cent bzw. Decimal, Beträge nur serverseitig
- [ ] Keine Personendaten oder Secrets in Code, Logs, Tests
- [ ] Bilder 390, 375 und 1440 px vorher/nachher, beide Themes, im Bericht
- [ ] Axe ohne Fehler, Touch-Ziele ≥ 44 px, neue Seiten mit loading.tsx
- [ ] Texte aus einer Quelle, Deutsch, per Du
- [ ] tester und pruefer gelaufen, Befunde erledigt oder begründet
- [ ] Entwurf, wenn eine Vorbedingung offen ist

### §4 Morgenbericht (morgenbericht-<datum>-lauf9.md)
- Je PR: Vorschau-Link, Migration nein, Basis. Sammel-PR mit Konfliktauflösungen.
- Nicht begonnene Nummern.
- Bilderstrecke „Handy vorher/nachher" (390 px): Mein Hof (Bearbeiten und „So sieht's die Kundin"), Produkt anlegen mit Vorschau, Hofseite oben, Karte mit gewähltem Hof, Heute, Auswertung, Admin-Finanzen.
- Messwerte der Karte aus 52 als Tabelle.
- „Für dich zu tun":
  - Freigaben (Mockup-Abweichungen);
  - #210 und 57 lesen;
  - NEXT_PUBLIC_APP_URL in Production vor dem Merge von 56 prüfen;
  - Testumgebung einrichten, danach Probelauf nach Checkliste;
  - Entscheidungen O6 und O7;
  - als letzter Schritt die Live-Schaltung samt STRIPE_LIVE_AB.

### Nachtrag: Freigaben vom 12.10.2026 (uttoranger, im Chat)
Alle Mockup-Abweichungen aus den Berichten 49–54 sind freigegeben, ebenso ebee305 (Reihenfolge der Liste „Bearbeiten").

## 14. Lauf 10 (uttoranger, im Chat erteilt, 12.10.2026)

Nachtlauf 10 – Freigabe (uttoranger, im Chat erteilt, 12.10.2026; Stand main 087a5a0 nach dem Merge von #240, gegengeprüft am 11. und 12.10.)

Arbeite als Dirigent nach docs/nachtlauf.md (§2 Regeln, §4 Ablauf je Gate, §5 Stoppen, §6 Morgenbericht). Dieser Text ist die Freigabe. §0 Tempo gilt vor allem anderen; wo §0 von §4 Schritt 3 abweicht (Bilder), geht §0 vor. Zuerst der Doku-PR (Branch docs/lauf10 von main, model: sonnet), er enthält:
- diesen Text wörtlich als §14 „Lauf 10" in docs/nachtlauf/freigabe.md;
- in docs/nachtlauf.md: §3 die Zeilen 58–65 und Sammel 10; „Reihenfolge in Lauf 10" mit den Stapel-Ausnahmen aus §1; die Punkte 1–11 aus §0 als neuer Abschnitt „4a. Tempo" (dauerhaft), mit der Zuordnung Blocker/Sollte aus Punkt 4; §8 allowedTools um "Bash(pnpm dev*)" und "Bash(pnpm bausteine*)";
- in docs/entscheidungen.md: neu G4, K2, O8 und S16 (Wortlaut unter „Entscheidungen"); O7 → entschieden (Verweis auf K2); E6 → Ergänzung „ohne Wahl Hoftor"; Z4 → Ergänzung „Bestellzahl ohne Testbestellungen"; N4 → Ergänzung „die Server-Action schreibt nur mitgeschickte Felder"; O6 bleibt offen (Vorschlag aus Bericht 52 steht); Backlog-Absatz „Stand Lauf 10";
- in docs/nachtlauf/freigabe.md §13 ein Nachtrag „Freigaben vom 12.10.2026": alle Mockup-Abweichungen aus den Berichten 49–54 sind freigegeben, ebenso ebee305 (Reihenfolge der Liste „Bearbeiten");
- in docs/umsetzungsprompt.md §8 S12: „verlangeAdminSeite" → „verlangeAdminAktion" (die Seiten-Variante wirft redirect; für Actions gilt src/server/admin-wache.ts) und der Zusatz „Protokoll heute nur als DEV-Log, dauerhaft offen (Lauf 11)";
- in docs/mockups/README.md die Tabelle aus docs/mockups/README-zeilen-lauf10.md einfügen und diese Datei löschen; mobil-k4-meine-hoefe.html samt Zeile löschen (E8); bei web-h1-einstellungen-konditionen.html der Zusatz „ersetzt durch -v2 (Nr. 61)";
- in docs/nachtlauf/status.md: 49–56 und Sammel 9 auf „gemergt (#240)", 57 bleibt Entwurf.

Stand – vor dem Start prüfen, sonst STOPP und melden: main = 087a5a0 oder neuer (#240 gemergt); docs/mockups/ enthält die 17 Dateien aus README-zeilen-lauf10.md (der Mensch checkt sie vorher ein); pnpm lint zeigt 7 Fehler oder weniger. Fehlt .claude/agents/sichter.md, gilt §0 Punkt 6 b. Start interaktiv wie Lauf 9 oder mit den beiden zusätzlichen allowedTools (pnpm dev, pnpm bausteine). Vorschau und Produktion laufen mit Stripe im Testmodus; kein Lauf schaltet um.

Änderungen an Agenten, Skills, Hooks und nachtlauf.md aus diesem Lauf wirken erst ab Lauf 11 (die Sitzung liest den Startstand). Was schon gelten soll, gibt der Dirigent in jedem Aufruf mit: den Testmodus des testers, den Prüfbereich des pruefers, die Blocker/Sollte-Regel, die Bilderregel.

Reicht das Budget nicht: Die Reihenfolge in §1 ist die Priorität. Nicht begonnene Nummern bleiben für Lauf 11 und stehen so im Morgenbericht.

### §0 Tempo – gilt vor allem anderen, ohne Abstrich bei Regeln, Tests und Sicherheit
Lauf 9 lief 35 Stunden für 9 Nummern, davon rund 8 Stunden sichtbare Arbeit; der Rest war Wartezeit am Nutzungslimit. Jeder Token zählt. Deshalb:
1. Lesemappe statt Volltext. Der Dirigent gibt jedem Umsetzer: den Text seiner Nummer, die Ausgangslage (Dateien mit Textankern), die Mockup-Dateien, docs/ai/CODING_STANDARDS.md und docs/ai/TESTING_GUIDELINES.md ganz, von ARCHITECTURE.md (129 KB) und DESIGN_SYSTEM.md (108 KB) nur die in der Nummer genannten Abschnitte, aus entscheidungen.md und umsetzungsprompt.md nur die genannten Einträge, ab Nr. 59 das Bausteinverzeichnis aus 58. Weiteres sucht der Umsetzer gezielt mit Grep; keine der großen Dateien wird am Stück gelesen. CLAUDE.md liest jeder Agent ohnehin.
2. Tests gezielt. Nach jedem Schritt: pnpm typecheck und pnpm vitest related --run <geänderte Quelldateien>; der Dirigent gibt dem tester diesen Modus und die Dateiliste ausdrücklich mit („nur typecheck und vitest related, kein lint, kein voller Lauf"). Vor JEDEM Commit der volle Lauf pnpm typecheck && pnpm lint && pnpm test (CLAUDE.md §1); deshalb Commits sparsam: ein Commit je Umsetzung, ein Commit je Runde, WIP-Commits nur beim Stopp nach §5. pnpm test:integration nur bei 62 und auf dem Sammel-PR. Gemessen am 11.10.: voller Testlauf 2:48 min, typecheck 0:57, lint 0:44, related je nach Datei 0:30–1:40.
3. Prüfen in Runden, nicht alles neu. Nach einer Nachbesserung bekommt der pruefer im Aufruf den Bereich git diff <zuletzt geprüfter Commit>..HEAD und seine eigenen Befunde; nur das prüft er. Ein zweiter voller Durchgang über den Gesamt-Diff nur bei 60 (Kaufstrecke, Pflichtangaben) und 62 (Admin-Action, Migration). Bei 58, 59, 61 und 63 keiner; bei 64 und 65 ja (Sicherheits- bzw. Datenpfad).
4. Runden nur für Blocker. Blocker = Sicherheit oder Geld, Datenkonsistenz, Typisierung, rote Tests, Mockup-Abweichung ohne Begründung, Regelverstoß aus CLAUDE.md §2. Sollte = Stil, Teststärke, Doku, Benennung. Sollte-Befunde behebt der Umsetzer nur, wenn sie Dateien betreffen, die er in derselben Runde ohnehin anfasst; sonst stehen sie im Bericht unter „Nacharbeit" und gesammelt im Morgenbericht. Kein Durchgang nur für Teststärke oder Stil (Lauf 9, Nr. 54 Runde 2). Das ist für den Nachtlauf die Ausnahme von sprint Schritt 5; der Dirigent gibt die Zuordnung dem pruefer mit.
5. Höchstens zwei Runden. Rote Tests danach: Lauf stoppen (§5, unverändert). Anderer Blocker danach: PR als Entwurf, Blocker im Morgenbericht, nächste Nummer.
6. Bilder einmal. a) Mit sichter: Der Umsetzer macht keine Screenshots. Nach tester und pruefer startet der Dirigent im Worktree der Nummer den Dev-Server gegen die lokale Test-DB (DATABASE_URL und DIRECT_URL ausdrücklich gesetzt, keine .env.local im Worktree, eigener Port je Worktree) und übergibt dem sichter Adresse, Routen, Zustände und Mockups. Der sichter prüft nur diese Routen bei 390 und 1440 px in beiden Themes, ein Durchgang; seine Blocker und Abweichungen gehen als Runde an den Umsetzer; danach beendet der Dirigent den Server. b) Ohne sichter: Der Umsetzer macht genau diese Bilder selbst, keine weiteren Breiten. Keine Bilder bei 58, 63 und beim Doku-PR. Geht §4 Schritt 3 (Vorlage) vor.
7. Berichte kurz. docs/nachtlauf/berichte/<nr>.md höchstens 60 Zeilen: je Datei ein Satz, Annahmen, nicht gelöst, Testschritte, welche .md angepasst, Nacharbeit, Regelvorschlag. Messtabellen nur, wo die Nummer Zahlen verlangt. Die Checkliste §3 steht nur im PR-Text.
8. Status sparsam. status.md nur bei läuft, fertig (PR), Entwurf, blockiert – nicht bei „in Prüfung" oder „Runde 1". Ein Commit je Änderung.
9. Parallel, wo unabhängig. Erste Welle 63, 58, 64, 65 (höchstens drei gleichzeitig); zweite Welle 59, 60, 61 nach 63; 62 stapelt auf 61. Nie zwei Nummern an derselben Code-Datei (§1 nennt die Grenzen); Doku-Konflikte (CLAUDE.md, nachtlauf.md, DEVELOPMENT.md) löst der Sammel-PR nach seiner Regel.
10. Modell je Aufgabe. Doku-PR und Nr. 58 mit model: sonnet (klar spezifiziert, keine Gestaltungsfragen); 59–65 mit Opus; tester und sichter Sonnet; pruefer bleibt Opus.
11. Im Code nur prüfen, wo es nötig ist. Validierung nur an Systemgrenzen (CODING_STANDARDS §3: API-Route, Server Action, Webhook, URL-Parameter, localStorage, externe Antwort; Schemas in src/schemas/). Keine Zod-Schemas oder Null-Prüfungen zwischen eigenen Funktionen, keine doppelten Prüfungen Client und Server über das bestehende Muster hinaus, keine „sicherheitshalber"-Abfragen auf Werte, die der Typ schon garantiert, kein try/catch um Code, der nicht werfen kann. Tests für Fachregeln und Systemgrenzen, nicht für jede Hilfsfunktion; keine Tests, die nur Konstanten wiederholen. Der pruefer meldet überflüssige Prüfungen als Befund „Sollte".

### Ausgangslage (geprüft 12.10.2026, lesend, main 087a5a0; Zeilen gelten für diesen Stand – im Zweifel Textanker)
- Lint: 7 Fehler auf main (Liste in 63); pnpm lint ist damit seit Wochen rot, jeder tester-Lauf vergleicht gegen diese Grundlinie.
- Startseite: components/startseite/startseite-kopf.tsx zeigt eine Schmuckfläche (NADELN), nur ab lg, ohne Leaflet. src/app/page.tsx lädt die Höfe über ladeOeffentlicheHoefe (src/server/queries/oeffentliche-hoefe.ts, gecacht); latitude/longitude stehen in HofUebersichtEintrag (server/queries/farm.ts); lib/startseite.ts (waehleStartseitenHoefe) wirft die Koordinaten heute weg. KARTE_ADRESSE (lib/startseite.ts) ist das Ziel „Karte öffnen". Nr. 52 hat gruppierePins, weltPixel/ausWeltPixel und KARTEN_KACHELN in lib/hoefe-anzeige.ts angelegt (Bericht 52, Abschnitt „Reine Kartenlogik").
- Telefon: components/hofseite/hofseite-kunde.tsx zeigt „Anrufen" zweimal (Z. 237 und 378) und telephone und email im JSON-LD (Z. 198f); hofseite-seitenspalte.tsx Z. 143 hat den tel:-Link in „Zahlung & Kontakt". Das ganze farm-Objekt aus getPublicFarm (server/queries/farm.ts, auch von ladeHofseite in server/hofseite-vorschau.ts genutzt) geht an die Client-Komponente HofseiteKunde – phone und email stehen damit in den Seitendaten. Texte der Hofseite liegen in src/lib/hofseite-kunde.ts. Sackgassen-Texte: hofseite-kunde.tsx „… oder ruf direkt am Hof an." (Z. 232), components/checkout/checkout-form.tsx „Frag am besten direkt beim Hof nach." (Z. 642 und 773), lib/stripe-konto.ts Z. 157 derselbe Satz. Kasse: checkout/page.tsx lädt getPublicFarmGeteilt (= getPublicFarm; select enthält ownerName, address, postalCode, city, phone, email; Typ PublicFarm); die Kasse zeigt heute Name und Abholadresse (hofAdresse(farm)), nicht Inhaber, Telefon, E-Mail. Knöpfe: „Weiter zur Zahlung · €" (online) und „Zahlungspflichtig bestellen · €" (bar). confirm/[orderId]/page.tsx und bestellung/[orderId]/page.tsx laden phone und email nicht. Mails (order-confirmation, pickup-reminder, order-not-ready, artikel-fehlt) tragen farmPhone und bleiben.
- Tarif: lib/konditionen.ts hält TARIFE (Hoftor 3 Produkte, 1 Abholzeit; Hofladen 1900 Cent), START_TARIF = HOFTOR, TARIFE_AB_TAG '2027-02-01', KONDITIONEN_UEBERGANG, tarifKarte (Kommentar „statt eines erfundenen „Dein Tarif""). Farm.tarif ist bei allen Höfen null. Anzeige: components/hof-einstellungen/konditionen-ansicht.tsx (Mockup v1, „€ 19" als Aufmacher); Daten über ladeKonditionenHof (server/queries/einstellungen.ts), Typ KonditionenHof (lib/hof-einstellungen.ts, dort auch der href /settings/konditionen). HofShell (components/shells/hof-shell.tsx, 'use client') baut Seitenleiste (<aside>, nav = hofNavigation({ isAdmin }): haupt, Gruppe VERKAUF_UND_KUNDEN_TITEL, unten PersonZeile und nav.unten) und Mehr-Blatt (Sheet: Gruppe Verkauf und Kunden, PersonZeile, Gruppe „Konto und Hilfe") durch Filtern von nav.mehr; HOF_MEHR ist in lib/bauern-navigation.ts nicht exportiert, öffentlich sind hofNavigation() und hofMehrAktiv. Die Props der HofShell kommen aus src/server/hofbereich.ts (ladeHofbereich) über src/app/(hof)/layout.tsx; zweiter Aufrufer ist (auth)/onboarding/page.tsx. Kein Kasten auf Heute (Regel aus 45).
- Gründungshof: lib/gruendungshof.ts berechnet den Platz (gruendungsplaetze über alle freigeschalteten, nicht stillgelegten Höfe; Platz ≤ 12); GRUENDUNGSPHASE_ENDE ist die Konstante 2029-12-31; GRUENDUNGS_KONDITIONEN („… bis 31.12.2029, danach dauerhaft 3 %") steht im Freischalt-Dialog components/admin/hof-aktion-dialog.tsx; GRUENDUNGS_AUFNAHME_SCHRITTE wird von (public)/konditionen/page.tsx und tests/stripe-pflicht.test.ts importiert; GRUENDUNGS_ANGEBOT, GRUENDUNGS_KEINE_ZUGANGSGRENZE und GRUENDUNGS_ZAHLUNGSGEBUEHREN importiert niemand mehr. Admin: components/admin/hoefe-ansicht.tsx hat Tabelle (ab md) und Karten (Handy), bearbeitet wird in Dialogen (servicegebuehr-dialog.tsx, HofAktionDialog). Admin-Actions in server/actions/admin.ts prüfen mit verlangeAdminAktion() (server/admin-wache.ts); setServiceFeeAction schreibt nur außerhalb der Produktion ein console.log mit admin, farm und neuen Werten – ein dauerhaftes Protokoll (S12) gibt es nicht. @db.Date gibt es im Schema schon (Kostenposten.ab/bis, TeilenAufruf.tag); Vorbild für eine Expand-Migration mit lock_timeout und IF NOT EXISTS: prisma/migrations/20261007120000_teilen_momente_aus, Prüfung der Datei wie tests/migration-teilen-momente.test.ts. In Produktion sind 4 Höfe freigeschaltet, alle Testhöfe (uttoranger, 11.10.).
- Nacharbeit aus Lauf 9 (unabhängige Prüfung von #240, 12.10.): (a) Sentry-Filter lib/sentry-hygiene.ts: TELEFON_MUSTER (Z. 136f) lässt eine Nummer stehen, die links an Buchstabe, „_" oder „-" und rechts an einem Wortzeichen klebt (`Telefon06641234567Adresse`, `Hof_06641234567_foto.jpg`); bereinigePlusLesart (Z. 276–310) lässt im Suchtext einen Rest der Nummer stehen (`q=Abholung%3A+2026-10-10+0664%2F9876543` → `…[telefon entfernt]%2F9876543`); die 74 Laufzeitfälle prüfen nur eine feste Grenze von 500 ms, kein Wachstum; `ohneAnfrage` ist nur mit Ersatz-Scope getestet, nicht mit echtem SDK-Client. (b) lib/umgebung.ts produktionsAdresse (Z. 186ff): ein Wert mit „*" oder „?" bleibt roh und gilt in Better Auth als Muster; ein fremder https-Host (etwa eine Vercel-Adresse) wird ohne Warnung angenommen, obwohl istEchterHost (Z. 127) ihn erkennen könnte; tests/umgebung.test.ts:811 schreibt „keine Warnung" fest. (c) Mein Hof: server/actions/appearance.ts saveAppearanceAction schreibt weiter alle Felder (fehlende werden null bzw. [], farmValues wird immer gelöscht und neu angelegt); Schutz nur im Browser über components/mein-hof/abschnitt-speichern.ts (frischer Stand lesen, dann ganz schreiben); components/mein-hof/abschnitt-formulare.tsx (Adress-Formular, Z. 218–226) schickt nur Straße, PLZ, Ort – Land und Kartenpunkt kommen aus dem frischen Stand, der Kartenpunkt bleibt bei neuer Straße alt; die Wache tests/hofseite-editor.test.ts:91–94 prüft nur die Mein-Hof-Bausteine. (d) Testzahlungen: tests/testzahlung-wache.test.ts erlaubt STRIPE_LIVE_AB in ganz server/**, also auch in server/actions/orders.ts und server/teilerstattung.ts; die Admin-Hofliste (server/queries/admin.ts) zählt Bestellungen ohne Testbestellungen, lib/hof-kunden.ts orderCount (Z. 112) mit; Integrationstests laufen nur ohne Stichtag.
- Agenten (.claude/agents): tester (sonnet), pruefer (opus), waechter, kurator; sichter kommt mit einem eigenen PR vor diesem Lauf. .claude/settings.json: Stop-Hook mit timeout 300.

### Entscheidungen (mit diesem Start freigegeben; ins Register)
- G4 · Bausteinverzeichnis und Regelvorschläge: docs/ai/BAUSTEINE.md wird aus dem Code erzeugt (pnpm bausteine), nie von Hand geschrieben; ein Test hält es aktuell; vor jeder neuen Datei, Komponente oder Funktion wird es gelesen. Fehler, die wiederkommen können, werden bevorzugt durch eine Prüfung verhindert (Test, Lint, Hook), sonst durch eine Textregel am richtigen Ort. Agenten schlagen Regeln vor, der Mensch gibt frei; neue Regeln tragen Herkunft und Datum. Jeder fünfte Lauf (10, 15, …) beginnt mit einer Regel-Inventur: überholte, doppelte oder durch Tests abgedeckte Regeln werden zum Streichen vorgeschlagen, nicht selbst gestrichen.
- K2 · Gründungs-Enddatum je Hof (entscheidet O7, Variante b): Gründungshöfe gelten als Hofladen ohne Grundgebühr bis zu einem Enddatum; Standard 31.12.2027, je Hof im Admin änderbar, auch für die bestehenden Testhöfe. Danach gilt die normale Regel (E6-Ergänzung). Vor einer Änderung des Standards werden bestehende Zusagen je Hof festgeschrieben (eigene Migration mit Freigabe). Der Satz „danach dauerhaft 3 %" verschwindet aus jeder Anzeige.
- E6, Ergänzung: Ohne Wahl gilt Hoftor. Hofladen gibt es nur nach aktiver Wahl mit SEPA-Mandat; keine automatische Umstellung, keine Abbuchung ohne Wahl. Der Tarif-Hinweis ist eine Statuszeile ohne Preis; der Preis steht nur auf „Deine Konditionen", nach dem Nutzen und mit Bedingungen.
- O8 · Produkte über der Grenze ab 1.2.2027 (entschieden, Bau in Gate 8 / Lauf 11): Der Hof wählt die 3 sichtbaren Produkte, die übrigen ruhen, nichts wird gelöscht; ohne Wahl bleiben die 3 zuletzt verkauften sichtbar; Vorwarnung per Mail im Jänner 2027.
- Migration (freigegeben, Wortlaut): „Nr. 62 darf eine Expand-Migration anlegen: neue Spalte Farm.gruendungBis vom Typ DATE, nullable, ohne Default, ohne Backfill und ohne andere Schema-Änderung. Erzeugt mit prisma migrate diff; Produktion bekommt sie nur über vercel-build beim Merge."
- Lint ist Teil der Abschlussprüfung (Nr. 63): 0 Fehler vor jedem Commit; der Stop-Hook prüft es ab Lauf 11.
- Z4, Ergänzung: Bestellzahlen zeigen Testbestellungen nirgends mit – Auswertung, Admin-Hofliste und Kundenansicht zählen gleich.
- N4, Ergänzung: saveAppearanceAction schreibt nur die mitgeschickten Felder; farmValues nur, wenn sie mitkommen. Das Adress-Formular in Mein Hof schickt die Adresse als Ganzes (Land, Breite, Länge mit).
- S16 · trustedOrigins ohne Muster: Ein Wert von NEXT_PUBLIC_APP_URL mit „*" oder „?" gilt als ungültig (bleibt roh, Warnung); ein https-Wert mit fremdem Host (nicht farmerzone.at/www) wird angenommen, löst aber in der Produktion eine Sentry-Warnung ohne den Wert aus.
- Mockup-Abweichungen aus den Berichten 49–54 und ebee305: freigegeben (12.10.2026).
- Offen für Lauf 11 (nur vormerken): dauerhaftes Admin-Protokoll (S12) braucht eine Tabelle und damit eine Migration.

### §1 Warteschlange (fest, zugleich Priorität)
63 ∥ 58 ∥ 64 ∥ 65 → 59 ∥ 60 ∥ 61 (alle drei von Branch 63) → 62 (auf 61) → Sammel-PR (Haltepunkt).
- Branches nacht/<datum>/<nr>-<kurz>. 63, 58, 64 und 65 von origin/main; 59, 60, 61 von Branch 63 (damit lint auf ihnen 0 Fehler hat); 62 von Branch 61. Ist 63 nach zwei Runden nicht fertig: 59–61 von origin/main mit der Regel „keine neuen Lint-Fehler gegenüber der Grundlinie", 0 Fehler erst im Sammel-PR.
- Dateigrenzen (Code): 64 nur lib/sentry-hygiene.ts, lib/umgebung.ts, lib/umgebung-server.ts und ihre Tests. 65 nur server/actions/appearance.ts, schemas/auftritt.ts, components/mein-hof/abschnitt-formulare.tsx, lib/abschnitt-stand.ts, components/mein-hof/abschnitt-speichern.ts, lib/hof-kunden.ts, tests/testzahlung-wache.test.ts und Integrationstests. 59 nur startseite-kopf.tsx, lib/startseite.ts, src/app/page.tsx, neue Dateien lib/regionskarte*.ts (hoefe-anzeige.ts nur lesen). 60 Hofseite, Kasse, Bestellseite, Bestätigungsseite, lib/hofseite-kunde.ts, lib/stripe-konto.ts; keine Mails. 61 konditionen.ts, konditionen-ansicht.tsx, hof-shell.tsx, bauern-navigation.ts, server/hofbereich.ts, (hof)/layout.tsx, onboarding/page.tsx, server/queries/einstellungen.ts, lib/hof-einstellungen.ts, neue Komponente tarif-zeile; gruendungshof.ts nur lesen. 62 gruendungshof.ts, Admin (hof-aktion-dialog.tsx, hoefe-ansicht.tsx, neuer Dialog, server/actions/admin.ts, server/queries des Admins), src/schemas/, schema.prisma, Migration, server/hofbereich.ts nur um gruendungBis; konditionen.ts und konditionen-ansicht.tsx nicht (61 führt; 62 reicht nur den Wert durch).
- Fehler aus dem Probelauf (48a, 48b …) und Nacharbeiten aus dem Morgenbericht von Lauf 9 nur, wenn der Mensch sie bis zum Start als Absatz „Aus Lauf 9 und Probelauf" in §14 eingetragen hat; dann als Nummern 66 ff. nach 62.

#### 63 Lint auf null und Lint im Stop-Hook – zuerst, ohne Bilder
- Stand 087a5a0, 7 Fehler (mit pnpm lint bestätigen): react/no-unescaped-entities in (public)/datenschutz/page.tsx Z. 170; „Calling setState synchronously within an effect" in components/cookie-banner.tsx Z. 38, components/farm/product-grid.tsx Z. 519 (setOrderedIds(null) bei Produktwechsel), components/settings/pickup-slots-client.tsx Z. 89, lib/use-cart.ts Z. 46; „Cannot call impure function during render" in (hof)/status/new/page.tsx Z. 56 (Server-Komponente) und status/new/status-new-client.tsx Z. 128.
- Beheben ohne Verhaltensänderung: Anführungszeichen als Entity (&bdquo; &ldquo; &quot;); setState im Effekt durch Ableitung beim Rendern, useState-Initialisierer, key-Wechsel oder Ereignis ersetzen; Zeitpunkte nie im Client berechnen (CODING_STANDARDS §2): die Seite bestimmt jetzt einmal auf dem Server und reicht ihn als ISO-Text durch (Vorbild /[farmSlug]/page.tsx → HofseiteKunde); in status/new/page.tsx die Berechnung in eine reine Hilfsfunktion mit jetzt-Parameter. Nie eslint-disable, nie eine Regel abschalten. Der bestehende Test der Datei bleibt grün; kein neuer Test nur für Lint. Verhalten könnte sich ändern bei use-cart.ts und product-grid.tsx (optimistische Sortierung): im Bericht nennen, tester related auf diese Dateien. datenschutz/page.tsx wird von #236 (Nr. 57, Entwurf) neu geschrieben: den Fehler trotzdem beheben, der Konflikt in #236 ist eine Zeile.
- .claude/hooks/abschluss-pruefen.mjs: nach dem Typecheck pnpm lint (rot = Exit 2, gleicher Zähler); .claude/settings.json: timeout des Stop-Hooks auf 420, statusMessage „Typecheck, Lint und Tests laufen". tests/stop-hook-zaehler.test.ts bleibt. CLAUDE.md §1 Z. 35 und §4 (Hook-Absatz): Lint ergänzen.
- Abnahme: pnpm lint 0 Fehler; Warnungen dürfen bleiben, ihre Zahl steht im Bericht. Kein zweiter Prüfdurchgang.

#### 58 Bausteinverzeichnis und Regelvorschläge (G4) – Sonnet, ohne Bilder, parallel zu 63
- Neu scripts/bausteine.ts (mit tsx, Importe über das vorhandene typescript-Paket lesen; KEIN neues Paket) und das package.json-Skript „bausteine".
- Es erzeugt docs/ai/BAUSTEINE.md aus src/components, src/lib und src/server, gruppiert nach Ordner. Je Datei eine Zeile: Pfad und Exporte; Zweck = erster Satz des ersten Kopf- bzw. JSDoc-Kommentars, sonst „kein Zweck vermerkt"; Status „genutzt", „unbenutzt" (kein Import außerhalb von tests/; Seiten unter src/app zählen als Nutzer) oder „Altbestand → <Ersatz>" (Tag @altbestand <Ersatz> im Kopfkommentar). Keine Zahl der Verwendungen.
- Deterministisch: sortiert, ohne Datum, oben „Erzeugt mit pnpm bausteine – nicht von Hand ändern."
- tests/bausteine-verzeichnis.test.ts: erzeugt im Speicher und vergleicht mit der Datei; bei Abweichung „Bausteinverzeichnis veraltet – pnpm bausteine ausführen". Dazu ein Test des Generators an einem kleinen Beispielordner (Zweck, Status, Altbestand). Beide mit dem Limit aus TESTING_GUIDELINES §4 für Tests, die Quelldateien einlesen.
- Keine anderen Quelldateien ändern. Im Bericht die Liste „unbenutzt" und die Zahl „kein Zweck vermerkt" als Vorschlag zum Aufräumen.
- Verankern, je kurz: CLAUDE.md §3 eine Zeile „docs/ai/BAUSTEINE.md – vor jeder neuen Datei, Komponente oder Funktion: gibt es das schon? (erzeugt)", CLAUDE.md bleibt unter 200 Zeilen; DESIGN_SYSTEM.md „Komponenten" und ARCHITECTURE.md („Regel beim Hinzufügen") verweisen darauf; .claude/skills/sprint: Schritt 1 das Verzeichnis nach dem Stichwort durchsuchen, TASK.md mit Abschnitt „Wiederverwendet / Neu, weil", Schritt 7 pnpm bausteine, Bericht Punkt 6 „Regelvorschlag" (Ursache, Gegenmaßnahme, Ort; Vorrang Prüfung vor Textregel; eingetragen erst nach Freigabe); .claude/skills/fix (fünf Schritte): Schritt 1 Verzeichnis durchsuchen, Schritt 5 pnpm bausteine und Regelvorschlag; .claude/agents/pruefer.md: Befund bei neuer Datei oder Funktion, für die das Verzeichnis eine passende nennt, oder bei Altbestand statt Ersatz; docs/nachtlauf.md §6 Morgenbericht mit Abschnitt „Regelvorschläge", §4 die Regel-Inventur jedes fünften Laufs; docs/ai/TECH_STACK.md eine Zeile.
- Regel-Inventur (G4, erster Lauf): nach dem Verzeichnis als Abschnitt im Bericht, nur Vorschläge, nichts streichen.
- Abnahme: pnpm bausteine zweimal hintereinander ergibt dieselbe Datei. Ab Nr. 59 bekommt jeder Umsetzer git show nacht/<datum>/58-bausteine:docs/ai/BAUSTEINE.md als Lesestoff und schreibt in den PR-Text „Wiederverwendet: … / Neu, weil: …".

#### 64 Nacharbeit Lauf 9: Sentry-Filter und Herkunft (Sicherheitspfad, zweiter Durchgang; Ausgangslage (a) und (b))
- TELEFON_MUSTER: Nummern erkennen, die an Buchstaben, „_" oder „-" kleben; cuid und UUID positiv erkennen (Form, nicht Ränder) statt sie über die Grenzen zu schonen. Tests in beide Richtungen: `Telefon06641234567Adresse`, `Hof_06641234567_foto.jpg`, `10:30+436641234567` fallen; eine cuid mit „0" und acht Ziffern bleibt.
- bereinigePlusLesart/bereinigeQuery: beide Lesarten auf dem unveränderten Text bestimmen und die Bereiche vereinigen (wie ersetzeVorab), nicht nacheinander ersetzen. Tests: `q=Abholung%3A+2026-10-10+0664%2F9876543` und `q=(0664)+987+65+43+(0664%2F9876543` → keine Ziffer der Rufnummer bleibt; `?q=+43%20664%209876543` (rohes „+", %20 als Trenner) fällt.
- Vergleichstest „neu fängt mindestens, was main fängt": die Muster von 087a5a0 eingefroren im Test (wie REF_EMAIL), fester Startwert, getrennte Bausteine, einige tausend Fälle; jeder Fall, den main fing, fällt auch jetzt. Deterministisch, unter 2 s.
- Wachstumstest: t(4N)/t(N) < 8 (Median aus 3 Läufen) für ersetzeVorab, ADRESSE_IM_FREITEXT, TELEFON_MUSTER und bereinigeQuery bei 50k und 200k Zeichen.
- ohneAnfrage mit echtem @sentry/node-Client: aufzeichnender Transport, Isolation-Scope mit normalizedRequest (`/hoefe?q=…`, Referer, x-forwarded-for); im Ergebnis weder q noch Referer noch IP. Kein Netz, kein DSN nach außen.
- umgebung.ts produktionsAdresse: „*" oder „?" im Wert → ungültig (roh, Warnung „Muster"); https-Wert mit fremdem Host → angenommen, in der Produktion eine Sentry-Warnung ohne den Wert (über meldeUmgebungsWarnungen, einmal je Instanz). tests/umgebung.test.ts:811 anpassen; Fälle: IDN (`https://bäckerei.at/` → xn--), IPv6-Host (roh), `https://farmerzone.at@evil.example` (fremder Host, Warnung).
- Lesemappe: CODING_STANDARDS §3; Bericht 56 Abschnitte „Nachprüfung Runde 2 und Nacharbeit"; Register S16; sentry-hygiene.ts und umgebung.ts ganz.
- Kein Bild. Zweiter Durchgang des pruefers über den Gesamt-Diff; er bekommt die Beispiel-Eingaben oben als Prüfliste.

#### 65 Nacharbeit Lauf 9: Mein Hof speichern und Testzahlungen (Datenpfad, zweiter Durchgang; Ausgangslage (c) und (d))
- saveAppearanceAction und schemas/auftritt.ts: alle fünf Felder optional; es wird nur geschrieben, was mitkommt; deleteMany/createMany für farmValues nur bei vorhandenem Feld. components/mein-hof/abschnitt-speichern.ts (speichereAuftritt) schickt dann nur den eigenen Abschnitt (Bericht 50 „nur Geändertes" gilt damit auch in Mein Hof). Integrationstest: Aufruf mit `{ tagline, farmValues: [] }` lässt aboutText, sectionsConfig und Fotos unverändert; zwei verschränkte Speicherketten (zwei Tabs) setzen sich nicht zurück.
- Adress-Formular in Mein Hof (abschnitt-formulare.tsx Z. 218–226): Land, Breite und Länge vom Laden mitschicken; nach geänderter Straße der Hinweis „Standort auf der Karte prüfen" mit Link zum Hof-Profil. Integrationstest: anderer Tab ändert Land und Punkt, dann speichert Mein Hof die Straße – die Adresse bleibt als Ganzes stimmig; dazu der bestehende Integrationstest mit profilWieImSchema statt profilBasis und einem Altwert (Beschreibung zu kurz, E-Mail mit Großbuchstaben).
- Komponententest Hof-Profil mit echtem Absenden: nur Telefon ändern → speichereProfil bekommt nur `{ phone }`; ersetzt die Textvergleiche in tests/unterseiten-kopf.test.ts:256–262.
- Wache über ganz src/: saveAppearanceAction und updateProfile nur aus abschnitt-speichern.ts bzw. speichereProfil (tests/hofseite-editor.test.ts erweitern).
- Testzahlungen: Wache – STRIPE_LIVE_AB nur in server/queries/** und lib/umgebung-server.ts, `@/lib/testzahlung` nur in lib/** und server/queries/**, mit Gegenproben für server/actions/orders.ts und server/teilerstattung.ts. Kundenansicht (lib/hof-kunden.ts orderCount) zählt ohne Testbestellungen (Z4-Ergänzung); Integrationstests mit gesetztem Stichtag für getUmsatzAuswertung, getTopProdukte, getMeistverkaufteProduktIds und getServicegebuehrenMonat.
- Keine Migration, keine Änderung an Stripe-Aufrufen, Erstattung, Storno, Bestand oder gespeicherten Beträgen.
- Lesemappe: CODING_STANDARDS §2 und §3; TESTING_GUIDELINES §2; Berichte 50 und 55 Abschnitte „Annahmen" und „Nachbesserung"; Register N4, Z4, E8.
- Bilder: Mein Hof Adress-Formular 390, beide Themes. Zweiter Durchgang des pruefers über den Gesamt-Diff.

#### 59 Startseite: Karte der Region (Mockups web-k0-startseite-karte-region, mobil-k0-startseite-karte-region)
- Server-gerendertes SVG, kein Leaflet, keine Kacheln, kein Fremdaufruf, kein <img>. Geodaten (Orte, Inn, Salzach, Mattig, Antiesen, B148, B147, B156, A8, B141, Waldflächen) als Datei src/lib/regionskarte-daten.ts aus Natural Earth (gemeinfrei) oder OSM; bei OSM der Hinweis „Kartendaten: © OpenStreetMap-Mitwirkende" unter der Karte. Welche Quelle, steht im Bericht. Ausschnitt als Konstante (12,80–13,62 Länge, 47,93–48,40 Breite); Projektion in src/lib/regionskarte.ts als reine Funktion.
- Daten: src/app/page.tsx reicht latitude/longitude aus ladeOeffentlicheHoefe durch; waehleStartseitenHoefe behält sie (keine zweite Abfrage). Markierungen: Gruppierung mit gruppierePins aus Nr. 52 bei fester Zoomstufe (kein eigener Algorithmus), Gruppen-Pin mit Zahl; ein hervorgehobener Hof (zuletzt freigeschaltet mit Foto, sonst der erste) mit Hofkarte (Name, Ort, bis zu zwei Kategorien, nächste Abholung) und Verbindungslinie; Zähler „n Höfe in der Region" oben links. Die ganze Fläche ist EIN Link auf KARTE_ADRESSE mit aria-label „Alle n Höfe auf der Karte ansehen", das SVG aria-hidden, die Hofkarte als Text im Link.
- Handy (unter lg): Karte unter der Suche, darunter der Knopf „Alle Höfe auf der Karte". Web: rechts neben dem Text wie bisher. Farben nur über Tokens, in beiden Themes lesbar.
- Lesemappe: DESIGN_SYSTEM „Farbtokens" und „Komponenten"; ARCHITECTURE §4 „Kundenseiten: Kopfzeile und Rückweg"; Bericht 52 Abschnitt „Reine Kartenlogik".
- Tests: Projektion an den Ecken, Gruppierung übernimmt 52, Zähler, Rendering ohne img/fetch, Link-Ziel = KARTE_ADRESSE. Bilder: / bei 390 und 1440, beide Themes.

#### 60 Telefonnummer erst nach dem Kauf (Mockups web/mobil-k2-hofseite-ohne-telefon, web/mobil-k3-kasse-angaben-zum-hof, web/mobil-k4-bestellung-hof-erreichen) – zweiter Durchgang
- Hofseite: „Anrufen" (hofseite-kunde.tsx, zwei Stellen) und der tel:-Link (hofseite-seitenspalte.tsx) weg; telephone und email aus dem JSON-LD. phone und email vor dem Durchreichen an HofseiteKunde aus dem farm-Objekt entfernen (in der Hofseite, nicht in getPublicFarm – die Kasse braucht beides); Test auf die Props. An Stelle der Nummer in „Zahlung & Kontakt" der Hinweis „Fragen zu deiner Bestellung? Die Telefonnummer des Hofs steht in deiner Bestellbestätigung." als Konstante in src/lib/hofseite-kunde.ts.
- Sackgassen: hofseite-kunde.tsx „… oder ruf direkt am Hof an." → „Schau bald wieder vorbei."; checkout-form.tsx (zwei Stellen) und stripe-konto.ts „Frag am besten direkt beim Hof nach." → „Die Kontaktdaten des Hofs stehen unter „Angaben zum Hof"." (eine Konstante, drei Verwendungen).
- Kasse (checkout-form.tsx): EINE Komponente components/checkout/angaben-zum-hof.tsx, <details open>, Titel „Angaben zum Hof (dein Vertragspartner)", Zeilen Verkäufer (farm.name, farm.ownerName), Anschrift (hofAdresse(farm) wiederverwenden), Telefon, E-Mail, Satz „Du kaufst direkt beim Hof. FarmerZone vermittelt die Bestellung." Daten aus dem vorhandenen PublicFarm der Kasse, keine neue Abfrage. Lage: unter md unter „Deine Bestellung" vor dem Knopf, ab md in der rechten Spalte zwischen Übersicht und Knopf. Knopftexte bleiben.
- Bestätigungsseite (confirm/[orderId]) und /[farmSlug]/bestellung/[orderId]: Karte „Hof erreichen" (Satz „Kommst du später oder kannst du nicht kommen? Sag dem Hof kurz Bescheid.", Nummer, E-Mail, Knöpfe Anrufen tel: und E-Mail mailto:) aus EINER Komponente components/bestaetigung/hof-erreichen.tsx (kein neuer Ordner); die select beider Seiten um phone und email erweitern; nur hinter der Signatur (S1), nie über den Abholcode. Mails unverändert.
- Lesemappe: CODING_STANDARDS §2 (Serialisierung) und §3 (Systemgrenzen, JSON-LD); DESIGN_SYSTEM „Hofseite", „Kasse", „Bestätigung"; entscheidungen E8; umsetzungsprompt.md §8 S1.
- Tests: Hofseite ohne Telefonnummer, ohne tel: und ohne phone/email in den Props; JSON-LD ohne telephone/email; Kasse zeigt die vier Angaben im DOM vor dem Knopf, online und bar; Bestellseite zeigt „Hof erreichen" nur mit gültiger Signatur; Grep-Test: „ruf direkt am Hof an" und „Frag am besten direkt beim Hof nach" kommen in src/ nicht mehr vor.
- Zweiter Durchgang des pruefers: Name, Anschrift, Telefon und E-Mail des Hofs stehen vor dem Kaufknopf (§ 4 Abs. 1 Z 2 FAGG), in beiden Breiten, bei online und bar. Bilder: Hofseite, Kasse, Bestellung bei 390 und 1440, beide Themes.

#### 61 Tarif-Zeile und „Deine Konditionen" Fassung 2 (Mockups system-komponente-tarif-zeile-startphase/-hoftor/-gruendungshof, mobil-h5-mehr-tarif-*, web/mobil-h1-einstellungen-konditionen-v2)
- EINE Regel in konditionen.ts: bestimmeTarifZustand({ tarif, gruendungBis }, jetzt) → 'startphase' (jetzt vor TARIFE_AB) | 'gruendungshof' (gruendungBis gesetzt und Wiener Kalendertag heute ≤ gruendungBis; Vorrang vor startphase) | 'hoftor' (ab TARIFE_AB bei HOFTOR oder null) | 'hofladen'. gruendungBis kommt als Parameter (Date | null); in 61 liefert der Aufrufer null (Gründungshöfe erkennt erst 62). Texte je Zustand als TARIF_ZEILE in konditionen.ts: Startphase „Startphase: kostenlos" / „bis 31. Jänner 2027" (am Handy mit „· du musst nichts tun"); Gründungshof „Gründungshof" / „ohne Grundgebühr bis {Datum}"; Hoftor „Hoftor · kostenlos" / „Produkte im Shop n von 3" + „Tarife vergleichen"; Hofladen: keine Zeile. Nie ein Preis, nie eine Warnfarbe. Den Kommentar bei tarifKarte anpassen.
- Datenweg: Der Zustand wird auf dem Server berechnet (ladeHofbereich in server/hofbereich.ts, dafür tarif und die Zahl sichtbarer Produkte laden) und als Prop über (hof)/layout.tsx und onboarding/page.tsx an die HofShell gereicht; in bauern-navigation.ts nur exportierte Konstanten (DEIN_TARIF_TITEL, Ziel = der href aus lib/hof-einstellungen.ts) und ein Feld tarif in HofNavigation – kein neuer HofNavPunkt (hofAktiverPunkt und hofMehrAktiv bleiben unverändert).
- Baustein components/hofbereich/tarif-zeile.tsx: Symbol, Titel, Unterzeile, Pfeil, Link /settings/konditionen, Tippfläche ≥ 44 px. In hof-shell.tsx unten in der Seitenleiste vor der PersonZeile und als Gruppe „Dein Tarif" oben im Mehr-Blatt. Der Hoftor-Zustand ruht, bis Gate 8 Tarife vergibt; die Zahl n ist nur Anzeige, keine Sperre.
- /settings/konditionen (konditionen-ansicht.tsx, Daten über ladeKonditionenHof und KonditionenHof) nach Mockup v2: oben „Dein Stand" (Startphase – für dich ist alles kostenlos; drei Sätze; darunter KONDITIONEN_UEBERGANG wörtlich); Tarifkarten Hoftor „Gilt automatisch" mit „kostenlos" statt „€ 0", Hofladen „Wenn du mehr brauchst" mit Leistungen zuerst und dem Preis unten als „€ 19 im Monat – frühestens ab 1. Februar 2027 · monatlich kündbar · nur wenn du ihn wählst" und „Wählen kannst du ab Jänner 2027"; Vergleich „Was das ab Februar für deinen Hof heißt" mit Produkte im Shop (sichtbare Produkte des Hofs) und Abholzeiten pro Woche, Spalten Heute / Im Hoftor, Satz „… gelöscht wird nichts. Mit Hofladen bleibt alles, wie es ist."; Rechenbeispiel unverändert; „So rechnen wir ab" mit „– nur wenn du Hofladen gewählt hast". Alle Zahlen aus HOFTOR_PRODUKTE, HOFTOR_ABHOLZEITEN_JE_WOCHE und der Hof-Abfrage; MONATSABRECHNUNG_TEXT entsprechend. TARIFE.zusatz Hoftor wird „Für ein kleines Angebot" (wirkt auf /fuer-hoefe, /konditionen und Einrichten; tests/konditionen-seiten.test.ts anpassen).
- Nicht bauen: Produkt-Grenze (mobil-h2-neues-produkt-grenze-hoftor, Gate 8/O8), kein Kasten auf Heute.
- Lesemappe: konditionen.ts und hof-einstellungen.ts ganz; DESIGN_SYSTEM „Navigation (AppShells)", „Shells und Navigation – feste Einträge", „Einstellungen"; CODING_STANDARDS §2; entscheidungen E6, K1, O7; Bericht 45 (Heute ohne Kasten).
- Tests: bestimmeTarifZustand (vier Zustände, Tagesgrenze Wien, Vorrang Gründungshof), Zeile je Zustand in Seitenleiste und Mehr-Blatt, hofladen ohne Zeile, TARIF_ZEILE-Texte ohne „€" und ohne Betrag, Konditionen-Ansicht zeigt den Preis erst nach den Leistungen (DOM-Reihenfolge). Bilder: Seitenleiste 1440, Mehr-Blatt 390, /settings/konditionen 390 und 1440, /fuer-hoefe 390; beide Themes.

#### 62 Gründungs-Enddatum je Hof (K2) – gestapelt auf 61; Migration, zweiter Durchgang
- Migration wie freigegeben: Prisma gruendungBis DateTime? @db.Date auf Farm, Expand, kein Backfill, erzeugt mit prisma migrate diff; SQL von Hand absichern wie 20261007120000_teilen_momente_aus (SET lock_timeout, ADD COLUMN IF NOT EXISTS); Prüfung der Migrationsdatei wie tests/migration-teilen-momente.test.ts; Integrationstest: Spalte vorhanden, null wirkt als Standard, zweiter Lauf der Migration ist folgenlos (ARCHITECTURE §5). Die SQL steht im Bericht. DATE kommt aus Prisma als UTC-Mitternacht: nur über den Wiener Kalendertag vergleichen (kalendertagInWien aus lib/wiener-tag.ts, Vorbild teilenTag in lib/teilen-kanal.ts).
- gruendungshof.ts: GRUENDUNG_BIS_STANDARD_TAG = '2027-12-31' (Wiener Kalendertag wie TARIFE_AB_TAG) ersetzt GRUENDUNGSPHASE_ENDE und GRUENDUNGSPHASE_ENDE_TEXT; bestimmeGruendungBis(hof, hoefe) = Platz ≤ 12 ? (hof.gruendungBis ?? Standard) : null; gruendungsKonditionenText(datum) = „Hofladen ohne Grundgebühr bis {Datum}. Danach gelten die normalen Tarife – ohne Wahl Hoftor, kostenlos." ersetzt GRUENDUNGS_KONDITIONEN; GRUENDUNGS_PROVISION_PROZENT, GRUENDUNGS_ANGEBOT, GRUENDUNGS_KEINE_ZUGANGSGRENZE und GRUENDUNGS_ZAHLUNGSGEBUEHREN entfernen (tests/gruendungshof.test.ts mitziehen); GRUENDUNGS_AUFNAHME_SCHRITTE bleibt; platformFeePercent unberührt. Kopfkommentar und Test: „Wer den Standard ändert, schreibt vorher bestehende Zusagen je Hof fest (Migration mit Freigabe)."
- Verdrahten mit 61: ladeHofbereich liest gruendungBis des Hofs mit und holt für die Platzvergabe die bestehende schmale Abfrage aller freigeschalteten Höfe, die der Admin für gruendungsplaetze nutzt (wiederverwenden, nicht neu); bestimmeTarifZustand bekommt den Wert aus bestimmeGruendungBis. /settings/konditionen zeigt im Gründungshof-Zustand in „Dein Stand" das Datum (KonditionenHof um gruendungBis erweitern, Text aus konditionen.ts – das ist die einzige erlaubte Änderung an 61-Dateien).
- Admin: in hoefe-ansicht.tsx Spalte (Tabelle) und Zeile (Karte) „Gründungshof bis" mit wirksamem Datum und „Standard" bzw. „abweichend"; Bearbeiten in einem neuen Dialog nach dem Vorbild servicegebuehr-dialog.tsx mit Datum und „Auf Standard zurücksetzen"; Server Action setzeGruendungBisAction in server/actions/admin.ts: verlangeAdminAktion(), Zod-Schema in src/schemas/gruendungshof.ts (Datum oder null; nicht vor dem heutigen Wiener Tag; bestaetigt: boolean), ein früheres Datum als das bisher wirksame nur mit bestaetigt: true aus dem Dialog „Nur mit Zustimmung des Hofs (K1)"; Protokoll wie setServiceFeeAction (DEV-Log), ergänzt um den alten Wert (vor dem Update lesen); revalidatePath /admin und /settings/konditionen. Der Freischalt-Dialog (hof-aktion-dialog.tsx) zeigt gruendungsKonditionenText(Standard).
- Lesemappe: CODING_STANDARDS §2 und §3; ARCHITECTURE §3 „Die Admin-Prüfung" und §5 (Expand/Contract); TESTING_GUIDELINES §2 (Migrationswache); entscheidungen K1, K2; umsetzungsprompt.md §8 S12; gruendungshof.ts ganz.
- Tests: bestimmeGruendungBis (null, Abweichung, Platz > 12, Tagesgrenze), Schema, Action (Rolle, Validierung, Verkürzen nur bestätigt, DEV-Log mit altem Wert), Freischalt-Dialog zeigt den Standard, Anzeige nimmt das wirksame Datum; Migrationsdatei und Integrationstest wie oben. Bilder: /admin Tabelle und Dialog 1440, Karte 390, beide Themes.

#### Sammel-PR (Haltepunkt)
Branch integration/lauf10 von main; nur fertige PRs: docs/lauf10 zuerst, dann 63, 58, 64, 65, 59, 60, 61, 62 per git merge --no-ff in dieser Reihenfolge (ist 61 ein Entwurf, entfällt auch 62). docs/ai/BAUSTEINE.md nie von Hand zusammenführen: nach allen Merges pnpm bausteine auf dem Gesamtstand als eigener Commit. Konflikte in Doku beide Seiten behalten, in Code sauber zusammenführen und im PR-Text begründen. typecheck, lint (0 Fehler), test und test:integration grün. Danach Morgenbericht und STOPP.

### §2 Regeln
- Vor jeder Nummer origin/main hineinholen.
- Migration nur in 62, nur wie freigegeben. Entsteht sonst eine: STOPP für diese Nummer, melden, nächste Nummer.
- Keine neuen Pakete.
- Nie Produktion, nie Live-Schlüssel, keine schreibenden Aufrufe an Stripe, Resend, Vercel, Supabase oder DNS. Der Dev-Server läuft nur gegen die lokale Test-DB.
- Mockup-Abweichungen nur begründet, jede im Bericht mit Bild.
- Keine Personendaten in Berichten; Hof-Angaben nur als Anzahl.
- Jede Textkonstante mit Betrag, Datum oder Zusage kommt aus konditionen.ts bzw. gruendungshof.ts und hat einen Register-Eintrag; der pruefer nennt ihn.
- Namen nach CODING_STANDARDS §1: Funktionen camelCase mit Verb, Konstanten SCREAMING_SNAKE_CASE, kein Name doppelt für Feld und Funktion.

### §3 Checkliste je PR (im PR-Text abhaken)
- [ ] Register und Freigabe decken den Inhalt ab
- [ ] origin/main vor dem Push hineingeholt
- [ ] Vor jedem Commit pnpm typecheck && pnpm lint (0 Fehler) && pnpm test grün; dazwischen nur typecheck und vitest related
- [ ] pnpm test:integration grün (nur 62 und Sammel-PR)
- [ ] Migration: nein (62: ja, wie freigegeben, SQL im Bericht)
- [ ] Geld nur als Int-Cent bzw. Decimal, Beträge nur serverseitig
- [ ] Keine Personendaten oder Secrets in Code, Logs, Tests
- [ ] Bilder nur der genannten Routen, 390 und 1440 px, beide Themes, ein Durchgang (sichter oder Umsetzer)
- [ ] Axe ohne Fehler, Tippflächen ≥ 44 px, neue Seiten mit loading.tsx
- [ ] Texte aus einer Quelle, Deutsch, per Du
- [ ] Bausteinverzeichnis gelesen (ab 59); „Wiederverwendet: … / Neu, weil: …"
- [ ] Keine Prüfung im Code außerhalb einer Systemgrenze (§0 Punkt 11)
- [ ] tester und pruefer gelaufen; Blocker erledigt, „Sollte" erledigt oder unter Nacharbeit
- [ ] Entwurf, wenn eine Vorbedingung offen ist

### §4 Morgenbericht (morgenbericht-<datum>-lauf10.md)
- Je PR: Vorschau-Link, Migration ja/nein, Basis, Runden. Sammel-PR mit Konfliktauflösungen.
- Nicht begonnene Nummern.
- Tempo: je Nummer Beginn, Ende, Runden, Zahl der vollen Testläufe und der Bilder; was aus §0 nicht einzuhalten war und warum.
- Bilderstrecke 390 px vorher/nachher: Startseite, Hofseite, Kasse, Bestellung, Mehr-Blatt, Konditionen, Admin-Karte.
- Aus 58: Liste „unbenutzt", Regel-Inventur, je PR „wiederverwendet / neu". Aus 63: Zahl der Lint-Warnungen.
- Nacharbeit („Sollte") und Regelvorschläge aus allen Berichten, gesammelt.
- „Für dich zu tun": Freigaben (Mockup-Abweichungen); nach dem Merge offene Tabs von Mein Hof neu laden (65); Migration 62 beim Merge beobachten; Testhöfe vor dem Pilot stilllegen; Datum der 4 Testhöfe im Admin prüfen (Standard 31.12.2027); Entscheidungen für Lauf 11 (SEPA-Weg, Rechnung und Umsatzsteuer der Grundgebühr, Rücklastschriften, Admin-Protokoll S12 als Tabelle); als letzter Schritt die Live-Schaltung samt STRIPE_LIVE_AB.
