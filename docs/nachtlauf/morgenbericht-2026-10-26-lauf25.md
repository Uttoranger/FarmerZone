# Morgenbericht Lauf 25 (25./26.10.2026)

**Ausgangslage je Nummer am Code bestätigt:** 168 ja · 169 ja · 170 ja · 171 ja (die Bestätigungsseite liegt unter `src/app/account/neuigkeiten-bestaetigen`, nicht unter `(public)`; ohne Belang) · 172 ja · 173 ja · 174 ja · 175 ja · 176 ja · 177 ja · 178 ja · 179 ja (nur die Zeilennummern in auth.ts verschoben) · 180 ja (die Hofseite teilte ihre Daten mit den Metadaten schon über `ladeHofseiteGeteilt`; doppelt war nur das Teilen-Bild) · 181 ja · 182 ja · 183 ja (src/lib/netz.ts gab es auf dem Zwischenstand noch nicht).

**Nicht begonnen:** keine. Alle 16 Nummern sind gebaut, **180 nur teilweise** (ein Blocker ausgelagert, siehe unten). Keine Migration, kein neues Paket, keine neue Variable. Regel 3 auf frischer DB: 35 Migrationen, `migrate diff --exit-code` ohne Unterschied. Haltepunkt: Sammel-PR `integration/lauf25`, **181 als letzter Merge, der Text der Datenschutzerklärung wartet auf deine Freigabe.**

Unterbrechung: Der erste Start am 25.10. abends scheiterte sofort am Wochenlimit des Kontingents (nichts gebaut). Neustart am 26.10. um 11:29.

Bilder: mit dem vorinstallierten Playwright gegen die lokale Bilder-DB (Seed, erfundene Daten); agent-browser fehlt im Cloud-Container. Admin-Bilder (170, 182, 183) machst du in der Vorschau. Manche Bilder zeigen unten links das Dev-Emblem von Next.

## PRs

| Nr | PR | Basis | Runden |
|---|---|---|---|
| Doku | [#385](https://github.com/Uttoranger/FarmerZone/pull/385) | main | – |
| 182 | [#386](https://github.com/Uttoranger/FarmerZone/pull/386) | main (auf `docs/lauf25`) | 0 |
| 169 | [#387](https://github.com/Uttoranger/FarmerZone/pull/387) | main (auf `docs/lauf25`) | 0 |
| 171 | [#388](https://github.com/Uttoranger/FarmerZone/pull/388) | main (auf `docs/lauf25`) | 0 |
| 168 | [#389](https://github.com/Uttoranger/FarmerZone/pull/389) | main (auf `docs/lauf25`) | 2 (Runde 2 vom Dirigenten) |
| 172 | [#390](https://github.com/Uttoranger/FarmerZone/pull/390) | main (auf `docs/lauf25`) | 0 |
| 183 | [#391](https://github.com/Uttoranger/FarmerZone/pull/391) | `integration/lauf25` | 1 |
| 173 | [#392](https://github.com/Uttoranger/FarmerZone/pull/392) | main (auf `docs/lauf25`) | 0 |
| 175 | [#393](https://github.com/Uttoranger/FarmerZone/pull/393) | `integration/lauf25` | 0 |
| 170 | [#394](https://github.com/Uttoranger/FarmerZone/pull/394) | `integration/lauf25` | 0 (Testadressen vom Dirigenten) |
| 178 | [#395](https://github.com/Uttoranger/FarmerZone/pull/395) | main (auf `docs/lauf25`) | 0 |
| 181 | [#396](https://github.com/Uttoranger/FarmerZone/pull/396) | main (auf `docs/lauf25`) | 2 |
| 176 | [#397](https://github.com/Uttoranger/FarmerZone/pull/397) | `integration/lauf25` | 1 |
| 177 | [#398](https://github.com/Uttoranger/FarmerZone/pull/398) | `integration/lauf25` | 1 |
| 174 | [#399](https://github.com/Uttoranger/FarmerZone/pull/399) | `integration/lauf25` | 2 |
| 180 | [#400](https://github.com/Uttoranger/FarmerZone/pull/400) | `integration/lauf25` | 2, **teilweise** |
| 179 | [#401](https://github.com/Uttoranger/FarmerZone/pull/401) | `integration/lauf25` | 0 |
| Sammel 25 | Sammel-PR `integration/lauf25` → main (Link im Chat) | main | – |

**Sammel-PR:** `integration/lauf25` = `docs/lauf25` + 182, 169, 168, 175, 183, 173, 170, 178, 171, 172, 176, 177, 174, 180, 179, 181 (zuletzt), je `--no-ff`. Die PRs der gestapelten Nummern standen vor jedem Push des Zwischenstands.
- **Konflikte:** `DEVELOPMENT.md` (beide Seiten), `BAUSTEINE.md` (je über `pnpm bausteine`); `src/server/actions/orders.ts` (178 brachte die lokale `stelleEinOhneRisiko` zurück, die 168 in die Warteschlange verlegt hat → nur `bestellKennungSchema` aus 178 behalten); `docs/ai/ARCHITECTURE.md`, Absatz KundenKopf/Vorschau (Fassung aus 182, die Änderungen aus 181 von Hand eingesetzt).
- **Dirigent-Fixes am Zwischenstand:**
  - `src/lib/analytics-filter.ts`: `/startseite-vorschau` in die Zusatzliste (182 schickt dort no-referrer, die Wache aus 172 gleicht ab).
  - `tests/fehlertext-wache.test.ts` und `tests/feld-schriftgroesse-wache.test.ts`: Bestandslisten gekürzt (174 behebt Einträge der Wache aus 176 und umgekehrt).
  - `tests/actions-zod-wache.test.ts`: Bestand ohne die von 181 entfernten Onboarding-Actions (jetzt 20 statt 22).
- **Lint:** 0 Fehler, 12 Warnungen (vorher 5). Neu sind ungenutzte Namen in Tests aus 176 (`kasse-formular`, `kasse-vertrauen`) und in `hofseite-vorschau.ts` (180) sowie eine überflüssige eslint-Ausnahme in `fehler-ansicht.tsx` (175). Nacharbeit, kein Fehler.
- **Unter Last rot, allein grün:** die Laufzeitprüfung in `tests/bild-format.test.ts` (539 bzw. 640 ms gegen 500 ms, zweimal) und einmal `bremse-datenbank.int` (Zähler-Aufräumen). Beide Wiederholungen grün. Die Grenzen sind nicht gelockert (Regelvorschlag unten).
- **Sammelstand:** typecheck grün, lint 0 Fehler (12 Warnungen), 596 Testdateien / 11156 Tests (n=1, 3 Worker); Integration ganz 84 Dateien / 717 Tests; Regel 3 grün.

## Bitte entscheiden

1. **NETZ_SATZ bei Storno und Bestellschritten (175):** N29 sagt „nichts gespeichert“. Ging nur die Antwort verloren, kann der Server die Aktion aber ausgeführt haben. Soll der Satz dort lauten „Wir wissen nicht, ob es gespeichert ist – lade die Seite neu“?
2. **Hof-E-Mail (174):** Die Freigabe sagt „freiwillig; leer heißt Anmelde-Adresse“. Vier Leser (Bestellmails an den Hof in `src/lib/email.ts`, `queries/mails.ts`, `stripe-connect.ts`) fallen nicht auf die Anmelde-Adresse zurück. Darum bleibt die Hof-E-Mail Pflicht, sobald einmal eine gespeichert ist. **Vorschlag:** ein eigener Auftrag „Rückfall auf owner.email“, danach die Pflicht streichen.
3. **Admin-Passkey ab `adminSeit` (179):** neue Regel zu N20/E7. **Vor dem Merge in Produktion** muss diese Abfrage 0 ergeben:
   `SELECT count(*) FROM "Passkey" p JOIN "User" u ON u.id = p."userId" WHERE u."isAdmin" AND u."adminSeit" IS NOT NULL AND p."createdAt" < u."adminSeit";`
4. **`weiterBeiEnter` in der Kasse (176):** Enter springt zum nächsten Feld und schickt nie zahlungspflichtig ab. Beauftragt war nur `enterKeyHint`. Der Dirigent hat es behalten, weil die Tastatur sonst „Weiter“ zeigt und dabei abschickt.
5. **Hofzeile am Handy vor dem Scrollen (177):** Weil Hofzeile, Reiter und Chips als ein Block kleben, steht die Hofzeile erst unter Titelbild und Kaufsperre-Hinweis. Darüber gibt es am Handy keinen Zurück-Link. Das Board zeigt nur die gescrollte Seite.
6. **Unterleiste im Hofbereich 12 px (177):** „Bestellungen“ wird bei 320–390 px abgeschnitten (bei 320 px 58 von 76 px). Vorschlag: ein kürzeres Wort oder 11 px nur im Hof.
7. **Datenschutzerklärung (181):**
   - Sind Geräte-Cookie (400 Tage) und „Bestellungen finden“ (30 min) technisch notwendig, also ohne Einwilligung? Der Text trifft die Einstufung nicht.
   - „7 Tage nach Ablauf“ freigeben oder streichen?
   - `Session.userAgent` aufnehmen?
8. **Slug `app` (172):** Vor dem Merge prüfen, dass kein Hof in Produktion `app` heißt. Auslegung von N31: „Hof“ = Rolle FARMER; ein Konto mit Rolle FARMER ohne Hof landet im Onboarding, auch wenn es Admin ist.
9. **Wortliste Korb/Warenkorb (176):** „In den Korb“ (rund 15 Stellen) bleibt. Soll „Korb“ in die Wortliste oder überall „Warenkorb“ stehen?
10. **Kicker „Aus der Region“ (176):** steht jetzt direkt über „Höfe aus der Region“. Kürzen?

## Zu einzelnen Nummern

**168 – Ein Mail-Auftrag hält nie eine Bestellung auf.**

| Ort | Weg |
|---|---|
| Webhook bezahlt, Zahlung zu spät; Barbestätigung; abholbereit, nicht abholbereit, Storno | in der Transaktion **mit Hilfe** `stelleMailEinInTransaktion`; bei `'nachholen'` nach dem Commit mit demselben Objekt |
| Webhook Erstattung offen, Zahlung zu spät (Vermerk gescheitert); orders Erstattung offen, Artikel fehlt | nach dem Commit, mit Hilfe `stelleEinOhneRisiko` |
| Postfach Team-Antwort, Beitrag, Rundschreiben | in der Transaktion, `stelleMailEin(…, tx)` – alles oder nichts, unverändert |
| Verfallen, Abo-Anmeldung, Admin, Meldung, Onboarding, Postfach an Team/Testmail, Cron Briefkasten, Betrieb | nach dem Commit bzw. ohne Transaktion, unverändert |

- **Weg A trägt** (verschachtelte `tx.$transaction`, Savepoint über @prisma/adapter-pg). Beleg in `tests/integration/webhook-zahlung.int.test.ts`: Eine Trigger-Funktion lässt jedes INSERT in `MailAuftrag` scheitern. Die Bestellung steht trotzdem auf PAID, die Antwort ist 200, eine Sentry-Meldung geht raus; danach wird nachgeholt, ohne Doppel.
- **Sentry-Tags:** `{ bereich: 'mail-warteschlange', art, grund }`, `extra.bestellungId`. `grund` ist `bezug_ungueltig` (error), `in_transaktion_gescheitert` (warning) oder `einstellen_gescheitert` (error).
- **Runde 2 (Dirigent):** Teils ungültige Aufträge setzten die ganze Liste auf „nachholen“. Jetzt werden die gültigen in der Transaktion eingestellt, wie es der Wortlaut verlangt.
- Offen (Sollte): Bei „Erstattung offen“ ohne Bestellung trägt die Nachlauf-Meldung keine Refund-Kennung; die Meldung „erstattung_eintragen“ in orders.ts hat noch die alten Tags.

**169 – Prüfmomente des Warenkorbs:**
1. Hofseite beim Laden: Abgleich im Browser, **ohne Halt**, ohne Server.
2. Kasse beim Öffnen: `/api/warenkorb/pruefen`, **mit Halt**.
3. Kauf: `POST /api/checkout`, **verbindlich**.

`reserveIp` zählt jetzt **drei Wege** (Reservieren, Prüfen, Freigeben). **Randfall „Hofseite ohne ProductGrid“:** ohne verfügbare Produkte und ohne Abholzeit kein Abgleich; nur die Zahl am Korb-Symbol zeigt den gespeicherten Korb, die Kasse prüft beim Öffnen.

**170 – je Punkt:**
1. erledigt: Das Aufräumen gibt Aufträge „in Arbeit“ nicht mehr frei.
2. erledigt: Der Zähler zählt in einem Schritt.
3. erledigt: tote Abfragen entfernt.
4. erledigt: gesendete Beitrags-Mails werden vor dem Löschen gesichert.
5. erledigt: `leseBegrenzt` als Hilfe.
6. erledigt: Cron-Prüfungen je eigenes try; „Jetzt schicken“ nicht bei „in Arbeit“.
7. erledigt: Bar-Token nur über `neuerBarToken`, mit Wache.
8. erledigt: „Alle nochmal schicken“ lädt gebündelt.
9. erledigt: `NOCHMAL_STAENDE` eingeengt, Grund je Stand.

**171 – je Punkt:**
1. erledigt: Abrechnungszeitraum im Text.
2. erledigt: Land auch bei „neu einrichten“.
3. erledigt: Double-Opt-in über `signiereLink` mit dem Zweck `abo-optin`; ohne `LINK_SECRET` bitgleich mit dem alten Link.
4. erledigt: .env.example.

**Gegenrichtung beim vertauschten Zweck:**
- **Ursache:** Nachbestell- und Abmelde-Token signieren im Altformat den nackten Inhalt, mit demselben Geheimnis wie der alte Abo-Token. Ein alter Abo-Token besteht deshalb deren Signaturprüfung. Das war schon vor 171 so.
- **Auswirkung:** keine. Die Hofseite prüft `farmId`, die Abmeldung findet kein Abo.
- **Fix:** kommt mit `LINK_SECRET`, weil mit Kennung `2.` jeder Zweck sein Präfix trägt; beide Richtungen sind getestet.

**172 – Vercel Analytics** speichert laut Doku (vercel.com/docs, Web-Analytics-API und Drain-Format) `requestPath`, `route`, `requestHostname`, `referrerHostname`, `utm*`, Land, Gerät, Browser, Betriebssystem und `deviceId`; im Drain `origin` und `path`. Ob die Query gespeichert wird, steht dort nicht ausdrücklich. Der Filter streicht sie deshalb vorsorglich und verwirft Seiten mit Token in der Adresse ganz.

**173:** Die Bestandsliste „xs/sm ohne Fläche“ hat **0** Einträge. Umgebrochen ist bei 390 und 1440, hell und dunkel, **keine Stelle** (Playwright-Messung über /dashboard, /products, Produktformular, /orders/[id], /settings/*, Kasse, Hofseiten, /hoefe). Das Token `--fz-feldrand` liegt hell bei 3,63/3,38:1 und dunkel bei 3,62/3,96:1.

**175 – Aufrufe ohne Schutz:**
- **Vorher:** alle Fetches in use-cart.ts (`addItem`, `updateQuantity`) und alle Server-Actions aus Client-Bauteilen im Hofbereich.
- **Nachher geschützt:**
  - use-cart (POST/DELETE `/api/reserve`)
  - Pause (2 Bauteile, 4 Aufrufe), Sichtbarkeit
  - alle Bestellschritte, Storno, „Artikel fehlt“, Vorrat
  - alle Nutzer von `speichernOhneWurf`
  - mit 174 die Abholzeiten und die Hof-Formulare
- **Weiter ohne Schutz** (in der Bestandsliste der Wache):
  - `bild-bausteine.tsx` (10)
  - `profile-form.tsx` (`holeAdresseZumPunkt`)
  - Banner und Produktbild auf der Hofseite (Hof-Ansicht)
  - Erste-Schritte-Schalter, Stripe-Dashboard-Link
  - Postfach-Antwort und Nachladen
  - Archivieren (2), Abzeichen, Beitrag veröffentlichen (2)

**178:**
- **status-image:** prüft jetzt die Sichtbarkeit. Vorschlag: nach Ankündigung entfernen (nirgends verlinkt, das Teilen-Bild ersetzt es); Route und Test löschen, zwei Wachen kürzen.
- **Magic-Link:** Nachweis erbracht (grep, `tests/magic-link-entfernt.test.ts`: kein Plugin, keine Endpunkte, 404). Plugin, Vorlage und `sendMagicLinkEmail` sind entfernt.

**180:**
- **Messwerte:** lokaler Build, Client-Chunks je Route. Keine Verkleinerung, sondern +0,4 bis 1 KB (/ 644 055 → 644 421 B, Hofseite 934 224 → 934 624 B, Kasse 560 293 → 561 329 B). Zod bleibt über andere Client-Dateien in jeder Route. js.stripe.com lädt erst beim Zeichnen der Zahlung.
- **SQL je Hofseite:** 14 SELECT vorher (e1f89496) und 14 nachher, gezählt im neuen `hofseite-abfragen.int`. Es wird nur gleichzeitig gewartet.
- **Sentry C:** `bildStil` las `fokusX` an undefined (Zwischenspeicher-Daten von vor Nr. 98); behoben.
- **Sentry 8:** nicht belegbar (Roboter-Browser ohne eigenen Quelltext-Rahmen), kein geratener Fix.
- **Offen (Blocker, ausgelagert):** Das Teilen-Bild fragt Hof, Produkte und Abholzeiten ein zweites Mal ab (3 der 14 SELECT). Der Fix braucht `queries/farm.ts` und berührt die Prüfsumme des Bildes; Vorschlag einer eigenen Nummer im PR.

**181:** Der Text der Datenschutzerklärung wartet auf deine Freigabe (Tabelle alt → neu → Beleg in #396). Vorschlag ungenutzte Pakete: `@tanstack/react-query`, `recharts` (nur Vorschlag).

**182:** Build lokal RC=0: `┌ ○ /  5m 1y` (ISR), `├ ƒ /startseite-vorschau` (dynamisch); `/admin/startseite/vorschau` steht nicht mehr in der Tabelle. Prüfliste in #386.

**183 – Notizen:**
- In der doppelten Stunde beim Wechsel auf Winterzeit nimmt `zeitpunktAusEingabe` still die zweite 02:xx.
- Geplante Fassungen schaltet kein Cron live.
- Fund 9 (Netzsatz) wartet, weil 175 beim Start von 183 nicht im Zwischenstand war; jetzt ist es ein kleiner Folgepunkt.

## Sterne nach Lauf 25

Quelle: Board `docs/mockups/system-sterne-bogen.html` (13 Kategorien, heute Ø 3,7, Stufe 1 Ø 4,2). Bewertet aus Code, Tests und Bildern dieses Laufs, **nicht am Gerät gemessen**; was nicht gebaut ist, zählt nicht.

| Kategorie | heute | nach Lauf 25 | Beleg | fehlt noch |
|---|---|---|---|---|
| Menüführung Kundin | 4 | 4,5 | #398 (aktiv, klebender Block, Blatt nur beim ersten „+“), #396 (/datenschutz in der KundeShell) | Hofzeile vor dem Scrollen (Entscheidung 5) |
| Menüführung Hof | 4 | 4,5 | #396 (Druckseiten eigenes Layout), #393 (Hof-Fehlerseite) | Kundenfilter/Suche beim Zurück, Postfach in zwei Tipps |
| Design & Konsistenz | 4 | 4,5 | #390 (Schrift-Preload, Manifest dunkel), #392 (44 px), #398 (Fokus-Kopf 56 px) | 134 Stellen ≤ 11,5 px |
| Funktionalität | 4 | 4,5 | #399 (Profil speicherbar), #393 (Korb hängt nicht), #397 (Pause-Karte) | Kundenfilter beim Zurück |
| Sicherheit | 4 | 4,5 | #395 (30 Tage, Geräte, Bremse, Passwortregeln), #401 (Passkey für Höfe), #390 (Analytics-Filter) | CSP scharf (G8); 181 erst nach Freigabe |
| Barrierefreiheit | 3,5 | 4,5 | #392 (Kontrast, Auge 44 px, Fokusring), #397 (Video-Pause, Fokus Code-Login) | Sortieren nur per Ziehen; keine Prüfung mit axe |
| Formulare & Eingabe | 3,5 | 4,5 | #392, #399 (16 px, Feldfehler verknüpft, Feldtypen, „(freiwillig)“) | Mein-Hof-Kontakt mit Browser-Blase |
| Performance | 3 | 3,5 | #400 (Stripe erst beim Zahlen, sizes, parallel) | Bündel nicht kleiner, Zod in jeder Seite, nichts gemessen |
| Plattform & Offline | 3 | 4 | #390 (viewport-fit, start_url /app), #393 (Netz-Zeile), #397 (Zeitlimit Kasse) | Karten fangen das Scrollen |
| UX-Writing | 4 | 4,5 | #397, #399 (Meldungen mit Grund), #398 (Servertexte geglättet) | Korb/Warenkorb (Entscheidung 9) |
| Zustände & Rückmeldung | 3 | 4 | #393 (Kein Netz, Fehlerseite, leerer Korb mit Ausweg), #399 (inline statt Toast) | Bild-/Kartenfehler, restliche Toasts |
| Vertrauen & Transparenz | 3,5 | 4 | #397 (Datenschutz-Link, inkl. USt, „aus der Region“), #396 (Text, nach Freigabe) | Rücktritt in Kasse und Mail |
| Onboarding | 3,5 | 4 | #397 (Satz am Handy, „sofort“ ehrlich), #399 (Profil speichert) | zwei Checklisten, Hilfe nur per Mail |
| **Ø** | **3,7** | **4,3** | | |

## Für dich zu tun

- **Abnahmen in der Vorschau:**
  - 169: Preis ändern → Satz im Korb-Blatt; aus dem Korb nehmen → sofort reservierbar
  - 175: Flugmodus → Satz, nichts hängt
  - 177: bis „Honig“ scrollen; zwei Produkte in den Korb
  - 178: Geräte als Kundin, „Überall abmelden“, schwaches Passwort, sechsmal „Passwort vergessen“
  - 183: Fehler nach Verwerfen ist weg
  - Admin-Bilder 170 (Warnkarte, „Alle Mails“), 182, 183
- **Prüfliste 182** am Vorschau-Deployment (fünf Schritte in #386).
- **iPhone (172):** installiert und in Safari. Die Unterleiste steht über dem Home-Indikator; Blätter und Kasse sind nicht abgeschnitten.
- **Passkey (179):** YubiKey 5C NFC und Handy-Biometrie, mit der Abfrage aus „Bitte entscheiden“ 3.
- **Freigabe des Datenschutztexts (181)**, danach Merge des Sammel-PR per Merge-Commit; danach in der Produktion eine Testbestellung mit Stripe im Testmodus → in Admin › Betrieb › E-Mails gesendet.
- Zip der 8 Boards: nicht nötig, sie liegen auf main (bc3ede21).
- **Länge von `BETTER_AUTH_SECRET`** in Vercel prüfen (für das spätere min(32)).
- **Stufe 3 der Sterne:** drei Höfe, drei Aufgaben (Vorrat ändern, Woche pausieren, Logo finden); Zeit und Fehltipps notieren.
- **Erinnerung:** die Entscheidung zur Servicegebühr bei Barzahlung ab 1.2.2027 bis Dezember.
- PR #382 (167 aus Lauf 24) ist über #384 schon in main und kann geschlossen werden, ebenso der Hilfsbranch `nacht/2026-10-24/167-basis`.

## Vorschläge für eigene Nummern

- Rückfall der Hof-E-Mail auf die Anmelde-Adresse in den Bestellmails (174).
- Teilen-Bild aus `getPublicFarm` bauen (180).
- Zod aus den Client-Dateien der Routen /, /hoefe, Hofseite und Kasse (180); danach ein Bündel-Budget.
- Feldrand der Kasse und von `anmelden/stil.ts` auf `--fz-feldrand` (173, 176).
- Geräteliste ohne Sitzungen über 30 Tage (178); Mail an den Hof bei Passkey-Änderung (179).
- Netzsatz im Startseiten-Editor (183, Fund 9); „Nochmal“ an Pause und „Fortsetzen“ (175); `bild-bausteine.tsx` mit Netzschutz.

## Regelvorschläge

- Eine Laufzeitprüfung in einem Unit-Test (z. B. `bild-format`) misst unter Last falsch. Grenze mit Abstand wählen oder die Prüfung nur allein laufen lassen; der Dirigent wiederholt einmal.
- Nummern mit einer Wache, die eine Bestandsliste führt, nennen in der Freigabe die Nummern, die Einträge daraus beheben (174 × 176).
- Eine neue Route auf oberster Ebene nennt `src/lib/slug.ts` und `KEINE_HOFSEITE` in der Grenze (172).
- Stripe.js nur über `@stripe/stripe-js/pure`, mit Wache (180).
- Ein Fehler, der nur beim Hoster auftritt, wird vor dem Fix an einer Vorschau-Adresse nachgestellt (182).
