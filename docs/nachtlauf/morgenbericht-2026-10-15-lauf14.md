# Morgenbericht Nachtlauf 14 (15.10.2026)

Freigabe: `docs/nachtlauf/freigabe.md` §18 (im Chat erteilt am 15.10.2026). Dirigent nach `docs/nachtlauf.md`, Tempo nach Abschnitt 4a und §0 der Freigabe.

**Kurz:** Alle vier Nummern (93, 94, 95, 96) und der Doku-PR sind fertig, keine ist ein Entwurf, keine blieb liegen. Genau drei Migrationen sind entstanden (93, 95, 96), alle nur Expand, in dieser Reihenfolge gestapelt; alle drei liegen schon in der Entwicklungsdatenbank. Der Sammel-PR **#288** ist auf dem Gesamtstand grün:
- typecheck,
- **lint 0 Fehler** (5 Warnungen, wie main),
- 388 Testdateien / 7787 Tests, darunter Wortliste, Hex-Wache, Telefonnummern-Wache und Namens-Wache,
- Integration 49 Dateien / 445 Tests,
- `pnpm illustrationen` 114/114.

**Vor dem Merge bitte wissen:** Die Anzeige der Gründungsplätze ist nach dem Merge sofort **an** (Freigabe 93: `gruendungAnzeige @default(true)`, die Migration legt die Zeile so an). Mit einem freigeschalteten Hof steht dann auf Startseite, /fuer-hoefe und /register „Noch 11 von 12 Gründungsplätzen frei – Hofladen kostenlos bis 31. Dezember 2027“. Wenn du die Sätze erst prüfen willst: direkt nach dem Deploy unter Admin › Einstellungen „Auf den Seiten zeigen“ ausschalten. Plätze und Standard-Ende sind bis zur Nacharbeit fest (12 / 31.12.2027, Abschnitt 6).

## 1. PRs

| Nr | Thema | PR | Basis | Migration | Runden | Vorschau |
|---|---|---|---|---|---|---|
| Doku | README nach v104, Freigabe §18, Register K2/N12/N14/N15/N16/Z3, Wortliste, Admin-Seitenmuster, Status | #283 | main | nein | – (eine Nachbesserung) | [Vorschau](https://farmer-zone-git-docs-lauf14-bierbaron.vercel.app) |
| 93 | Gründungshöfe sichtbar, Nachricht nach Freischaltung, Admin › Einstellungen (K2, N15) | #285 | Doku (#283) | **ja** – `20261015120000_plattform_einstellung` | 1, 2 volle Durchgänge | [Vorschau](https://farmer-zone-git-nacht-2026-10-1593-gruendung-bierbaron.vercel.app) |
| 94 | Admin-Seitenmuster, Höfe und Finanzen, fünf Reiter (N15, Z3) | #284 | Doku (#283) | nein | 0, 1 Durchgang | [Vorschau](https://farmer-zone-git-nacht-2026-10-1594-admin-muster-bierbaron.vercel.app) |
| 95 | Postfach Stufe 2: Eingang, Aufgaben, Zustellung, Antwort möglich (N12, N14) | #286 | 94 (#284) + 93 (#285) | **ja** – `20261015130000_postfach_stufe2` | 2, 2 volle Durchgänge | [Vorschau](https://farmer-zone-git-nacht-2026-10-1595-postfach-stufe2-bierbaron.vercel.app) |
| 96 | Startseite gestalten: Abschnitte, Blöcke, Vorschau (N16) | #287 | 95 (#286) | **ja** – `20261015140000_startseite_gestalten` (mit Seed) | 2, 2 volle Durchgänge | [Vorschau](https://farmer-zone-git-nacht-2026-10-1596-startseite-76b428-bierbaron.vercel.app) |
| Sammel | alle oben | #288 | main | ja (die drei) | – | [Vorschau](https://farmer-zone-git-integration-lauf14-bierbaron.vercel.app) |

**Merge-Empfehlung:** Nur den **Sammel-PR** mergen, per **Merge-Commit** (nicht Squash); die Einzel-PRs gelten danach als gemergt. Einzeln in dieser Reihenfolge, jeweils per Merge-Commit: #283, dann #285 und #284 (beide auf #283), dann #286, zuletzt #287.

## 2. Sammel-PR #288

Branch `integration/lauf14` von `main` (57762a4), Merge-Reihenfolge wie in der Freigabe: docs/lauf14, 93, 94, 95, 96, je `--no-ff`.

**Konflikte und Auflösung:**
- docs/lauf14 und 93: ohne Konflikt.
- 94: dieselben fünf Konflikte wie beim Merge für 95 (`src/lib/admin-navigation.ts` – Typ `AdminReiterId`; die Einstellungen-Zeile war in beiden gleich; `tests/admin-navigation.test.ts`, `tests/admin-seiten-wache.test.ts`, `DEVELOPMENT.md`, `docs/ai/DESIGN_SYSTEM.md`). Die fünf Dateien sind aus dem schon geprüften Merge 3a2f4d0 übernommen (Branch von 95); der Baum gleicht 3a2f4d0 bis auf den neueren `status.md`.
- 95: Konflikte nur in `DEVELOPMENT.md` und `DESIGN_SYSTEM.md` – Folge der doppelten Merge-Basis (93 und 94 sind auf beiden Seiten mit derselben Auflösung zusammengeführt). Fassung von 95 übernommen; der Baum gleicht dem Branch von 95 bis auf `status.md`.
- 96: ohne Konflikt (96 enthält 95 samt Runden, df2ae50).
- `pnpm bausteine` danach: keine Änderung (die Merges der sortierten Liste waren vollständig) – kein eigener Commit nötig; `tests/bausteine-verzeichnis.test.ts` prüft die Aktualität im vollen Lauf.

**Prüfungen auf dem Gesamtstand:** typecheck grün; `pnpm lint` 0 Fehler / 5 Warnungen; `pnpm test` 388 Dateien / 7787 Tests; `pnpm test:integration` (lokale Test-DB, unter Sperre) 49 / 445; `pnpm illustrationen` 114/114; Wortliste-, Hex- und Telefonnummern-Wache grün (Teil von `pnpm test`).

**Migrationen = Schema:** `prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma` lässt sich in Prisma 7 nicht ausführen: Es braucht eine Schattendatenbank (`datasource.shadowDatabaseUrl`), und dort scheitert die alte Migration `20260804091431_enable_rls` (sie liest `_prisma_migrations`, die es in einer Schattendatenbank nicht gibt – mit einer kurzlebigen Konfiguration gegen eine Wegwerf-DB belegt). Ersatz: alle 24 Migrationen auf einer frischen lokalen Datenbank eingespielt, `migrate status` „Database schema is up to date!“, zweiter `deploy` ohne Änderung, `migrate diff --from-config-datasource --to-schema` **leer**, RLS auf allen Tabellen, Seed-Zeilen da (eine `PlattformEinstellung`, acht `StartseiteAbschnitt`). Wegwerf-DBs gelöscht.

**Vorschau und Migrationen:** Jede Migration lief beim ersten Vorschau-Build ihrer Nummer über `vercel-build` (`prisma migrate deploy`) in die Entwicklungsdatenbank:
- 93 (#285, `dpl_Eb6jNLFYeVnqjifpf8fw3fUNRP4Q`): „22 migrations found · Applying migration `20261015120000_plattform_einstellung` · All migrations have been successfully applied“.
- 95 (#286, `dpl_3AAB4d7SpwQuUfVtj2kFSkFgcT4X`): „23 migrations found · Applying migration `20261015130000_postfach_stufe2` · …successfully applied“.
- 96 (#287, `dpl_2q3xtFgYkkCoDcidZwpCa5bnNnJ3`): „24 migrations found · Applying migration `20261015140000_startseite_gestalten` · …successfully applied“.
- Sammel-PR: Sammel-PR (`integration/lauf14`, 9c3cf0b, `dpl_EfD7ZHymvtjHXvinGU13qnm65cUT`, READY): „24 migrations found in prisma/migrations · No pending migrations to apply“ – der Stand der Entwicklungsdatenbank ist vollständig (das ist hier der `migrate status` der Vorschau).
Produktion bekommt die drei Migrationen beim Merge über `vercel-build`. Alle nur Expand (neue Tabellen, neue Spalten mit Default bzw. nullable); im Deploy-Fenster läuft alter Code unverändert.

**Admin und Zähler auf dem Gesamtstand:** Auf dem Gesamtstand (lokal, Kopie der Test-Datenbank): `/admin`, `/admin/postfach`, `/admin/startseite`, `/admin/finanzen`, `/admin/einstellungen` antworten mit 200, jede Seite zeigt genau fünf Reiter (Höfe · Postfach · Startseite · Finanzen · Einstellungen). Der Zähler am Reiter Postfach stimmt mit „Offen im Eingang“ überein: 7/7 zu Beginn, 6/6 nach dem Lesen einer Antwort, 5/5 nach dem Freischalten des wartenden Hofs. `/admin/meldungen/<id>` landet im Eingang bei der Meldung (`?art=meldung&meldung=<id>`); weil die Route eine Ladeansicht hat, kommt der 308 gestreamt an (HTTP 200 mit Weiterleitung im Dokument) – für Nutzer gleich, für Suchmaschinen und `curl` kein echter 308 (Abschnitt 7). `/` liefert `X-Frame-Options: DENY`, `/?vorschau=x` `SAMEORIGIN` plus `frame-ancestors 'self'`. Serverlog: 0 Fehler, 0 Warnungen; die Mail „Dein Hof ist freigeschaltet“ nur im Log (Post-Sperre).

## 3. Nicht begonnene Nummern

Keine. Alle vier Nummern der Freigabe sind umgesetzt und geprüft, keine ist ein Entwurf.

## 4. Tempo

| Nr | Beginn | Ende (PR) | Runden | volle Testläufe | Bilder |
|---|---|---|---|---|---|
| Doku | 12:07 | 12:37 | – (eine Nachbesserung) | 1 (+3 für Status-Commits) | 0 |
| 94 | 12:39 | 14:06 | 0 | 2 (Umsetzer, Dirigent) | 4 |
| 93 | 12:39 | 14:11 | 1 | 3 (Umsetzer, Runde 1, Dirigent) + ganze Integration | 10 |
| 95 | 14:15 (Merge 93 → 94) | 16:26 | 2 | 5 (Merge, Umsetzer, Runde 1, Dirigent, Runde 2) + ganze Integration 2× | 7 |
| 96 | 15:35 | 17:40 | 2 | 4 (Umsetzer, Runde 1, Runde 2, Dirigent nach dem Merge von 95) + ganze Integration | 4 |
| Sammel | 16:31 (erste Merges) | 17:57 (PR) | – | 1 + ganze Integration + `pnpm illustrationen` | Strecke (Abschnitt 5) |

Zeiten UTC. Vom Start bis zum Sammel-PR 5 Stunden 50 Minuten, die Bilderstrecke eingerechnet (Lauf 13: 5 Stunden 2 Minuten für sieben Nummern). Fünf Runden (93 eine, 95 zwei, 96 zwei).

**Was aus 4a nicht einzuhalten war, und warum:**
- **sichter:** Den Subagenten gibt es in dieser Umgebung nicht. Nach 4a Punkt 6 b machten die Umsetzer ihre Bilder selbst; die Bilderstrecke machte ein eigener Agent auf einer Kopie der Test-Datenbank (Abschnitt 5).
- **96 startete, bevor 95 fertig war:** 95 hatte keinen Blocker aus den Prüfungen, der Dirigent stufte zwei Befunde hoch (Abschnitt 6). Damit 96 nicht 40 Minuten wartet, zweigte 96 vom Commit der Umsetzung von 95 (ae84a3a) ab; die Runden von 95 berührten keine Datei von 96 und kamen danach per Merge hinein (df2ae50, ohne Konflikt). Freigabe §1 sagt „96 (von 95)“ – erfüllt, nur früher.
- **Ganze Integrationssuite statt nur der eigenen Datei:** Der tester ließ wie beauftragt nur die eigene Integrationsdatei laufen. Der Dirigent ließ vor jedem Push mit Migration die ganze Suite laufen – bei 95 war `artikel-fehlt.int` rot (Abschnitt 6) und wurde zur Runde 2. Regelvorschlag in Abschnitt 8.
- **Eingehalten:** pruefer mit höchstens 22 Schritten je Aufruf; zweiter voller Durchgang bei 93, 95, 96, keiner bei 94; `test:integration` bei 93, 95, 96 und im Sammel-PR; Berichte 50–60 Zeilen; höchstens zwei Runden je Nummer; drei Status-Commits, je mit vollem Lauf.

## 5. Bilderstrecke (hell)

Vorher `main` (57762a4), nachher `integration/lauf14` (9c3cf0b). Beide lokal auf derselben Kopie der Test-Datenbank: 27 der 36 freigeschalteten Seed-Höfe stillgelegt, damit 9 von 12 Gründungsplätzen vergeben sind (mit allen Plätzen vergeben stünde nirgends etwas). Dazu nur erfundene Daten: ein Rundschreiben „Wichtig“ an den Kirchbauernhof mit einer Antwort des Hofs und eines „Info“ ohne Antwortmöglichkeit, eine stornierte Online-Bestellung mit offener Erstattung, zwei Zustell-Adressen @example.com (eine bestätigt), ein Saisonblock; `hof-wartend` bekam eine erfundene Stripe-Kennung und wurde für Bild 8 im Admin freigeschaltet. Die Kopie ist danach gelöscht; die gemeinsame Test-Datenbank ist unberührt. Der gelbe Streifen „TEST · Dev-DB · Stripe Test“ gehört zur lokalen Umgebung.

**Startseite, Für-Höfe-Band (1440):** Vorher Kicker, Überschrift, Beschreibung, zwei Knöpfe. Nachher steht unter der Beschreibung ein Satz mit Stern: „Noch 3 von 12 Gründungsplätzen frei – Hofladen kostenlos bis 31. Dezember 2027.“ Kein zusätzlicher Knopf, kein Banner.

![Band vorher](berichte/bilder/lauf14-strecke/1-startseite-band-1440-vorher.jpg) ![Band nachher](berichte/bilder/lauf14-strecke/1-startseite-band-1440-nachher.jpg)

**/fuer-hoefe, Kopf (1440):** Vorher „Kostenlos starten“ und darunter der Übergang K1. Nachher die Pill „Gründungsphase · noch 3 von 12 Plätzen“ über der Überschrift, der eine orange Knopf heißt „Gründungshof werden“, darunter die Fußnote „Kostenlos bis 31. Dezember 2027 · danach Tarif nach Wahl · monatlich kündbar · keine Bankdaten nötig“ (Wortlaut K2, Abschnitt 9).

![/fuer-hoefe vorher](berichte/bilder/lauf14-strecke/2-fuer-hoefe-kopf-1440-vorher.jpg) ![/fuer-hoefe nachher](berichte/bilder/lauf14-strecke/2-fuer-hoefe-kopf-1440-nachher.jpg)

**Nur nachher:**
- Registrieren (390): „Du wärst voraussichtlich Gründungshof Nr. 11 …“ (k = vergeben + wartende Höfe vor dir + 1: 9 + 1 + 1). ![Registrieren](berichte/bilder/lauf14-strecke/3-registrieren-390.jpg)
- Admin › Höfe (1440): „3 frei · 9 von 12 vergeben“, Warteliste „bekäme Gründungsplatz Nr. 10“; nach dem Freischalten „2 frei · 10 von 12“. ![Höfe](berichte/bilder/lauf14-strecke/4-admin-hoefe-1440.jpg) ![Höfe nach dem Freischalten](berichte/bilder/lauf14-strecke/8b-admin-hoefe-nach-freischaltung-1440.jpg)
- Postfach › Eingang (1440), Filter Offen: links Antworten, Meldungen und Aufgaben gemischt, rechts der Faden; zweites Bild mit der Aufgabe „Erstattung offen“ und dem Knopf zur Zahlung bei Stripe. ![Eingang](berichte/bilder/lauf14-strecke/5-admin-postfach-eingang-1440.jpg) ![Erstattung](berichte/bilder/lauf14-strecke/5b-admin-postfach-erstattung-1440.jpg)
- Postfach › Zustellung (1440): support@ fest, eine bestätigte und eine ausstehende Adresse, Regeln je Art. ![Zustellung](berichte/bilder/lauf14-strecke/6-admin-zustellung-1440.jpg)
- Admin › Einstellungen (1440 und 390 – das Handy-Bild fehlte in Nr. 94): Plätze und Standard-Ende „vorerst fest“, Anzeige an, Vorschau des Satzes und der Pill. ![Einstellungen](berichte/bilder/lauf14-strecke/7-admin-einstellungen-1440.jpg) ![Einstellungen am Handy](berichte/bilder/lauf14-strecke/7b-admin-einstellungen-390.jpg)
- Heute mit der Gründungs-Nachricht (390): Postfach-Karte „Nachricht vom Team – Du bist Gründungshof Nr. 10 – Hofladen ohne Grundgebühr bis 31. Dezember 2027. Danach gelten die normalen Tarife – ohne Wahl Hoftor, kostenlos.“ (zweiter Satz aus `baueGruendungsZusage`, Nr. 61 – Abschnitt 9). ![Heute](berichte/bilder/lauf14-strecke/8-heute-gruendungs-nachricht-390.jpg)
- Startseite mit Saisonblock (390 und 1440): Saisonkarte „Kürbis, Äpfel und Most – jetzt frisch“ direkt unter dem Kopf. ![Saisonblock 390](berichte/bilder/lauf14-strecke/9-startseite-saisonblock-390.jpg) ![Saisonblock 1440](berichte/bilder/lauf14-strecke/9b-startseite-saisonblock-1440.jpg)
- Admin › Startseite mit Vorschau (1440): „So sieht’s die Kundin“, Handy-Rahmen mit dem Band „Vorschau · Stand am Do, 15. Okt 2026“. ![Startseite gestalten](berichte/bilder/lauf14-strecke/10-admin-startseite-vorschau-1440.jpg)

## 6. Entscheidungen des Dirigenten (bitte bestätigen oder ändern)

- **93 – Blocker „Zusage mit Geldwert aus zwei Quellen“, Weg (b):** Seiten und Nachricht lasen die Einstellung, Tarif-Zeile, „Dein Stand“, Freischalt-Dialog und Admin › Höfe rechnen mit den Konstanten (fremde Dateigrenzen). Weg (a) – alle Aufrufer umstellen und vorher die Zusagen je Hof festschreiben – braucht eine weitere Migration (in diesem Lauf STOPP). Darum sperrt 93 die Felder „Plätze gesamt“ und „Kostenlos bis“ auf 12 / 31.12.2027; schaltbar ist nur die Anzeige. Die Freigabe sprach von „Feldern“ – sie sind sichtbar, aber nur lesend, mit Hinweis.
- **Kein halber Umzug beim Merge 93/94:** `MAX_PLAETZE` in `admin/page.tsx` (94, Kommentar „bis Nr. 93 gemergt ist“) bleibt bei 12, ebenso die Kachel in Finanzen – alle Aufrufer zugleich mit der Nacharbeit aus 93.
- **93 – Link der Gründungs-Nachricht `/settings/konditionen`** („Deine Konditionen“ laut Register K2) statt `/konditionen` aus der Freigabe; die öffentliche Seite nennt den Stand des Hofs nicht. Bei Widerspruch gilt das Register.
- **95 – zwei Befunde zum Blocker gestuft** (pruefer: Sollte): `bestaetigeEmpfaenger` war eine schreibende Server Action ohne Sitzungsprüfung (jeder Export einer `'use server'`-Datei ist ein öffentlicher Endpunkt; Sicherheit) – jetzt ein Server-Modul ohne `'use server'`, nur die Route ruft es auf, eine Wache prüft die Actions; der Wochenbericht ging nur bei Meldungen statt „nur wenn etwas offen ist“ (Register N14; 4a Punkt 4: Widerspruch zum Register = Blocker) – jetzt nach `zaehleOffenImEingang()`.
- **95 – Runde 2 aus dem Gesamtlauf:** `artikel-fehlt.int` (Nr. 19c) zählte zwei Mails „Erstattung offen“. Ursache belegt: Testisolation – seit 95 lädt der Nachlauf der Mail erst die Empfänger aus der Datenbank, die Mail des vorigen Falls kam nach dem Zurücksetzen der Mocks an. Kein Doppelversand im Code; nur die Tests warten den Nachlauf jetzt ab.
- **95 – „Offen“ bei Meldungen = NEU/GEPRUEFT** (Freigabe wörtlich); Vorschläge der KI zählen am Reiter nicht mehr. **Jede Hof-Antwort** geht nach Regel „sofort“ als Mail an die Liste (bis 30 je Hof und Tag, ohne Drossel). Betreff der Wochen-Mail jetzt „Postfach – Wochenstand: …“.
- **96 – Grenzerweiterung `next.config.ts`** (Runde 1): genau `/` mit dem Parameter `vorschau` darf von uns selbst eingebettet werden (`SAMEORIGIN`), sonst bleibt `DENY` – sonst bliebe der Rahmen „So sieht’s die Kundin“ leer. Keine andere Nummer fasst die Datei an.
- **96 – Link-Format der Vorschau** `/?vorschau=<Inhalt>&sig=<Signatur>` statt `/?vorschau=<token>` (N16): `sig` fällt in Sentry schon nach dem Namen weg. Geteilt wird `/admin/startseite/vorschau?vorschau=…&sig=…` (wirkt auf jedem Gerät mit Admin-Sitzung, Runde 2); die Adresszeile nach dem Öffnen wirkt auf einem anderen Gerät nicht. **ARCHITECTURE §3** hat dafür eine Ergänzung: Die Route setzt per GET nur das Draft-Mode-Cookie des eigenen Browsers, keinen Datensatz.
- **Berichte nachgetragen:** In 93, 94 und 95 hat der Dirigent die Befunde ohne Runde (zweiter Durchgang 93, Abweichungen (f)/(g) und Grenzerweiterungen 94, Nachprüfung 95) in den Bericht geschrieben – je ein eigener Doku-Commit.
- **94 – Schlusszeile des Commits** nennt das Modell des Umsetzers (Sonnet) statt des Rahmentexts – inhaltlich richtig, nicht geändert.
- **Merge-Reihenfolge und Auflösung im Sammel-PR:** wie Abschnitt 2; die Auflösung 93/94 einmal geprüft (3a2f4d0) und wiederverwendet.
- **Bilderstrecke auf einer Kopie der Test-Datenbank** mit 27 stillgelegten Höfen, damit „noch 3 von 12“ sichtbar wird (die Seed-Datenbank hat 36 freigeschaltete Höfe – alle Plätze wären vergeben und nichts stünde da).

## 7. Nacharbeit („Sollte“), gesammelt

**93**
- Aufrufer auf die Einstellung umstellen (`admin/page.tsx`, `admin/finanzen/page.tsx`, `hof-aktion-dialog.tsx`, `queries/admin.ts` `ladeGruendungBis`/`getAdminFarms`, `setzeGruendungBisAction`) – vorher die Zusagen je Hof festschreiben (Migration, Freigabe nötig), dann `pruefeGruendungSperre` heraus.
- Admin › Einstellungen nimmt noch nicht `Seitenkopf`/`Kennzahlen` aus 94.
- /fuer-hoefe bei 390: die Preiszeile steht über Kicker und Überschrift statt direkt über den Karten (Mockup mobil-k2).
- `gruendungFuerSeiten` meldet den Rohfehler an Sentry (der Kommentar sagt „ohne Text“).
- Nach dem 31.12.2027 bekäme ein freigeschalteter Hof eine Nachricht mit vergangenem Datum (`gruendungsZusageBeiFreigabe`).
- Name der Person in der Protokollzeile über eine Query statt `prisma` in der Seite; Datumsfeld zeigt im englischen Browser „12/31/2027“ (nur lesend).

**94**
- Reiter „Auszahlungen“ und „Entfallene Gebühren“ ohne Inhalt (`getFinanzen` liefert dazu nichts) – eigene Nummer.
- `Math.min(plaetze.size, MAX_PLAETZE)` als Helfer mit `max` in `src/lib/admin-hoefe-seite.ts`, mit Finanzen zusammen (s. 93).
- Kommentare in `umgebung.ts`, `umgebung-server.ts`, `env.ts` nennen „Zur Testumgebung“; Shell-Reiter 38 px (Bestand).

**95**
- Aufgabe „Erstattung offen“: jede spätere erfolgreiche Erstattung derselben Zahlung löscht sie, auch eine Teilerstattung; eine Erstattung im Stripe-Dashboard löscht sie womöglich nie (Abschnitt 9). Die Kennzahl „Davon Geld“ nennt den online bezahlten Betrag als „Erstattung offen“.
- `WARTENDER_HOF` (ohne stillgelegte) gegen `zaehleWartendeHoefe` in `queries/admin.ts` (mit stillgelegten) – ein stillgelegter, nie freigeschalteter Hof zählt am Reiter Höfe, nicht im Postfach.
- Keine Drossel für die Mail „Ein Hof hat geantwortet“; Hof-Liste ohne „keine Antwort möglich“ (`(hof)/postfach/teile.tsx`).
- `triage-form`/`ki-vorschlag` aus `app/admin/meldungen/[id]` nach `components/admin`; `MeldungListe` und `brauchtZusammenfassung` ohne Aufrufer; „offen seit Heute“ groß; ‚Problem melden‘ mit einfachen Anführungszeichen wie im Register.

**96**
- Zu kleines Bild meldet der Upload als Format-Fehler (der Satz bräuchte `image-upload.tsx`).
- `istRelativerLink` sperrt „//“ nur am Anfang; `KopfLaden` (94) und `erzeugeVorschauPfad` ohne Aufrufer außer Tests; Kommentar verweist auf ARCHITECTURE §5 statt §3; ARCHITECTURE nennt die Header-Regel „mit dem signierten `?vorschau`“, sie gilt für jeden Wert.
- Admin-Bilder zeigen Datum und Uhrzeit im US-Format des Prüfbrowsers (`--lang=de-AT` wirkt im Headless-Chromium nicht).

**Aus der Bilderstrecke und der Routenprüfung (Sammel-Stand)**
- `/admin/meldungen/<id>` leitet wegen der Ladeansicht gestreamt weiter (HTTP 200 + Weiterleitung im Dokument) statt mit einem echten 308 (95; die Freigabe sagt „redirect 308“).
- Startseite bei 390: Die Höhe über dem Saisonblock springt nach dem Laden stark (Oberkante erst bei etwa 2265 px, dann 1168 px) – vermutlich die Karte im Kopf; nur einmal gemessen, prüfen (96/59).
- Meldungen aus dem Seed zeigen „Nr. meldung-“ als Kurznummer (Seed-Kennungen; bei echten Kennungen unauffällig); „Alle Höfe“ zählt stillgelegte Höfe mit.
- Nach dem ersten Freischalten verdeckt das Blatt „Dein Hof ist online!“ auf Heute die Postfach-Karte mit der Gründungs-Nachricht, bis man es schließt.

**Doku-PR**
- Verweise auf gelöschte Mockups (Stand Sammel-PR): `admin-briefkasten` (DEVELOPMENT, `briefkasten-teile.tsx`, `lib/meldung.ts`), `admin-meldung-entscheiden` (DEVELOPMENT, `ki-vorschlag.tsx`, `triage-form.tsx`), `web-/mobil-k3-warenkorb-bezahlen` (DEVELOPMENT, `umsetzungsprompt.md`, `checkout-form.tsx`, `kasse-teile.tsx`, `kunde-shell.tsx`, Test `kasse-seite`), `web-/mobil-k0-startseite-karte-region` (`startseite-kopf.tsx`, `regionskarte-daten.ts`, `lib/startseite.ts`), `web-/mobil-k3-kasse-angaben-zum-hof` (`angaben-zum-hof.tsx`), `system-h0-navigation-postfach` (DEVELOPMENT, `entscheidungen.md`, `hof-shell.tsx`), `system-m1-marke-agrilo` (`entscheidungen.md`), `mobil-h5-mehr-auswertung-region-mein-hof` (`hof-shell.tsx`), `web-h1-einstellungen-konditionen` (DEVELOPMENT, `umsetzungsprompt.md`, `settings/konditionen/page.tsx`) – meist Kommentare; auf die Nachfolger umstellen.
- `system-farbtokens.html` steht im README mit 900×640, die Datei ist 900×980.

## 8. Regelvorschläge, gesammelt (Prüfung vor Textregel; eingetragen erst nach deiner Freigabe)

- **93:** Quelltext-Wache, dass `MAX_GRUENDUNGSHOEFE`/`GRUENDUNG_BIS_STANDARD` nur noch als Standard in `gruendungshof.ts`/`plattform-einstellung.ts` stehen – scharf mit der Nacharbeit. Ort: `tests/gruendung-seiten.test.ts`.
- **94:** Bilder, die einen Datenzustand brauchen, den die gemeinsame Seed-DB nicht hat, auf einer eigenen Kopie der DB (`pg_dump | psql`, Dev-Server mit anderem DB-Namen). Ort: Rahmen des Laufs.
- **95:** Wache: jede Datei unter `src/app/admin` ist `page`/`loading` mit `verlangeAdminSeite` oder ein `route.ts` mit Kommentar „ohne Anmeldung“. Ort: `tests/admin-seiten-wache.test.ts`. Und (seit Runde 1 in ARCHITECTURE): jeder Export einer `'use server'`-Datei prüft die Sitzung – eine Wache über alle Dateien unter `src/server/actions/` statt nur `postfach.ts`.
- **96:** `sicherheits-header.test.ts` um eine Liste „einbettbar mit Parameter“; der Dev-Server löscht `.next` vor dem Start (ein alter Ordner beantwortete jede Route außer `/` mit 404).
- **Dirigent:** (1) Der tester lässt bei Nummern, die Geldpfade anfassen (`orders.ts`, Stripe-Webhook, `nachDerAntwort`), die **ganze** Integrationssuite laufen, nicht nur die eigene Datei (95: `artikel-fehlt.int` fiel nur im Gesamtlauf auf). Ort: `docs/nachtlauf.md` 4a Punkt 2. (2) Sammel-PR-Regel „`migrate diff --from-migrations` leer“ ersetzen durch „frische DB + `migrate deploy` + `migrate diff --from-config-datasource` leer“ (Prisma 7, Abschnitt 2). Ort: Freigabe-Vorlage und `docs/nachtlauf.md`. (3) Eine gestapelte Nummer darf vom Umsetzungs-Commit ihres Vorgängers abzweigen, solange dessen Runde nur eigene Dateien anfasst; der Dirigent holt die Runde vor dem Push herein (so in diesem Lauf mit 96). Ort: `docs/nachtlauf.md` 4a Punkt 9.

## 9. Für dich zu tun

**Nach dem Merge (Freigabe §4):**
1. Admin › Einstellungen: Plätze (12) und Datum (31.12.2027) prüfen – sie sind bis zur Nacharbeit fest; die **Anzeige ist schon an** (oben). Sätze auf Startseite, /fuer-hoefe, /register ansehen.
2. Postfach › Zustellung: die eigene Adresse eintragen und über den Link in der Mail bestätigen (48 h gültig). support@ ist fest dabei.
3. Ein Rundschreiben mit „Antwort möglich“ **aus** und eines mit **an** an die Testhöfe; beide am Handy als Hof ansehen (Hinweis statt Antwortfeld bzw. Feld).
4. Admin › Startseite: einen Saisonblock mit Zeitraum anlegen und über „Vorschau öffnen“ prüfen (am Handy die Linkadresse des Knopfs verwenden, nicht die Adresszeile).
5. Vercel: Variable `NEXT_PUBLIC_PLATFORM_NAME` löschen (ungenutzt).
6. Vor der Live-Schaltung: Zahlungsdomain agrilo.at im Stripe-Live-Modus registrieren.

**Entscheidungen:**
- **93:** Nacharbeit „Zusagen festschreiben, dann umstellen“ (eine Migration) für Lauf 15 freigeben? Bis dahin bleiben Plätze und Standard-Ende fest.
- **Register K2 „keine Bankdaten nötig“** (Fußnote /fuer-hoefe): Stripe verlangt beim Einrichten ein Auszahlungskonto – Wortlaut prüfen.
- **93:** Link `/settings/konditionen` statt `/konditionen` bestätigen.
- **95:** Aufgabe „Erstattung offen“ – ein Knopf „Erstattung erledigt“ im Eingang (kleine Nummer) oder den offenen Betrag speichern (Migration)? Heute löscht eine spätere Teilerstattung die Aufgabe zu früh, eine Erstattung im Dashboard womöglich nie. Die Mail „Erstattung offen“ geht immer.
- **95:** Mail bei jeder Hof-Antwort ohne Drossel – so lassen oder höchstens eine je Faden und Stunde (wie beim Team)? Wochen-Mail heißt jetzt „Postfach – Wochenstand: …“ – Mailfilter anpassen.
- **96:** Link-Format und die Ergänzung in ARCHITECTURE §3 bestätigen (Abschnitt 6). Satz für zu kleine Bilder (Grenzerweiterung `image-upload.tsx`)?
- **94:** Inhalte für „Auszahlungen“ und „Entfallene Gebühren“ (braucht Summen in der Abfrage) – eigene Nummer?
- **Wortlaut der Zusage:** Die Gründungs-Nachricht (93) und der Freischalt-Dialog übernehmen den Satz aus `baueGruendungsZusage` (Nr. 61): „Danach gelten die normalen Tarife – ohne Wahl Hoftor, kostenlos.“ Er liest sich widersprüchlich („normale Tarife … kostenlos“). Vorschlag: „Danach wählst du deinen Tarif – ohne Wahl bleibt Hoftor, kostenlos.“ (Register K1/K2, eine Stelle in `konditionen.ts`).
- **Doku-PR (#283):** README-ADMIN-Absatz nennt die Gruppe „Benachrichtigungen“ und „(Z3 korrigieren)“ – widerspricht N15; Vorschlag: „Benachrichtigungen ·“ streichen, „(Z3, Korrektur 15.10.)“.
- **Lauf 15:** K3-Messfühler „Frage per E-Mail“; SEPA-Monatsabrechnung ab 1.2.2027; Regelvorschläge aus Abschnitt 8; Nacharbeit aus Abschnitt 7.

## 10. Wo die Bilder liegen

Je Nummer unter `docs/nachtlauf/berichte/bilder/<nr>/` (in den Einzel-PRs): 93 zehn, 94 vier, 95 sieben, 96 vier. Die Strecke liegt unter `docs/nachtlauf/berichte/bilder/lauf14-strecke/` (zwei Paare vorher/nachher, dazu die Bilder nur „nachher“, Abschnitt 5); Notizen der Aufnahme im Arbeitsverzeichnis des Laufs.
