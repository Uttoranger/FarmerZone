# Morgenbericht Lauf 30, Neustart (4./5.11.2026) · Redesign November 2026

**Ergebnis:** Alle 14 Nummern (219–232) und die Regel-Inventur 30 sind fertig. Jede Nummer hat einen eigenen PR (#450–#463, CI grün). Der Sammel-PR `integration/lauf30` enthält den Doku-PR #449 und alle 14 Nummern per `--no-ff`.

- Keine Migration, kein Paket, keine neue Variable.
- `MAIL_VORSCHAU` gibt es nur im Test.
- Nicht begonnen: keine Nummer.

Der erste Bericht dieses Laufs (`morgenbericht-2026-11-04-lauf30.md`, Stopp vor dem ersten Gate) bleibt unverändert.

**Start:**
- agent-browser 0.39.1 war vorhanden (Setup-Skript, `has_init_script: true`, `session_mode: new`), ein Bild einer lokalen Seite gelang.
- main stand unverändert auf 056a321e. #449 war offen, deshalb stapelt der Lauf auf `origin/docs/lauf30` (d89e38d5).

**Mockup-Prüfung (304 Dateien):** Sie lief am 4.11.2026 im ersten Anlauf und ist in #449 grün. Im Neustart lief sie nicht noch einmal (Abweichung vom Auftrag der Projektleitung).

**Stand-Check (Linux, 4 Kerne, 15 GB):**
- `pnpm install --frozen-lockfile` grün.
- `prisma generate`.
- Typecheck grün, Lint 0 Fehler (2 bekannte Warnungen).
- Voller Lauf: 660 Dateien, 12209 Tests grün.
- Postgres 16 lokal.

## Ausgangslage je Nummer

Jede Nummer hat die Anker aus der Freigabe am Code bestätigt. Die Abweichungen stehen in `docs/nachtlauf/berichte/<nr>.md`. Die wichtigsten:

- **219:** „Widerruf“ steht auch in `WIDERRUF_ADMIN_TEXT`, `admin-aufgaben.ts`, `betrieb-mails.ts` und `server/widerruf.ts`.
- **221:** „Servicegebühr“ steht auch in `fuer-hoefe.ts`, `geld-abgleich.ts`, `wochenlage.ts` und weiteren Dateien. Der Dirigent hat sie den Nummern 226, 230 und 232 zugeteilt.
- **222:** `OFFEN_STATUS` war eine zweite Statusliste, jetzt gibt es eine Quelle, `src/lib/bestellstatus-offen.ts`.
- **228:** `PendingApprovalBanner` wird nirgends gerendert.
- **229:** `ladeBestellDetail` las `gebuehrModell` nicht. Das Feld ist jetzt im select.
- **232:** Der Postfach-Fuß steht in `postfach.ts`, nicht in `zustellung.ts`.

## PRs

Alle PRs ohne Migration, CI (ci, integration) grün. Die Vorschau-Links stehen im jeweiligen PR unter „Vercel Preview Comments“.

| Nr. | PR | Basis | Runden | Offen bzw. weggelassen (Kurzfassung) |
|---|---|---|---|---|
| Doku | #449 | main | – | erledigt im ersten Anlauf |
| 219 Bausteine und Wortliste | #450 | docs/lauf30 | 1 | Texte der Bausteine nach src/lib (Nacharbeit) |
| 220 Shells und Navigation | #451 | integration/lauf30 | 0 | vier ui/-Punkte als eigene Nummer |
| 221 Gebühren-Texte, Gründung 12 | #452 | integration/lauf30 | 1 | Konditionen-Wortlaut prüfen (siehe Recht) |
| 222 Hof-Alltag | #456 | integration/lauf30 | 2 | zwei Rückfragen (siehe unten) |
| 223 Produkte | #460 | integration/lauf30 | 1 | N25 gegen Board; Web-Formular als Seite |
| 224 Mein Hof, Einstellungen | #462 | integration/lauf30 | 2 | Wort „Pausiert“; Kopf Mein Hof am Handy |
| 225 Hof-Werkzeuge | #461 | integration/lauf30 | 0 | Gründungshof-Satz in der Auswertung |
| 226 Finden | #453 | integration/lauf30 | 0 | Hofkarten der Startseite (Pause, Preise) |
| 227 Kauf | #454 | integration/lauf30 | 0 | Preisangabe im Korb (Recht) |
| 228 Anmelden und Konto | #463 | integration/lauf30 | 0 | **N42 e nur auf /onboarding** |
| 229 Admin Teil 1 | #457 | integration/lauf30 | 0 | Wort der Geld-Kachel; setServiceFeeAction |
| 230 Admin Teil 2 | #459 | integration/lauf30 | 1 | Abgleich-Abweichung je Modell (Abfrage) |
| 231 Rechtstexte, Fehlerseiten | #458 | integration/lauf30 | 0 | siehe Recht |
| 232 E-Mails | #455 | integration/lauf30 | 0 | siehe Recht |
| Sammel 30 | (Sammel-PR) | main | – | – |

## Merge-Reihenfolge

**Gestapelte PRs per Merge-Commit mergen, nicht per Squash.**

1. #449 (Doku), dann der Sammel-PR `integration/lauf30` → main. Der Sammel-PR enthält alle Nummern.
2. Die Einzel-PRs #450–#463 sind dann mit gemergt. Sie dienen der Abnahme je Bereich und lassen sich danach schließen.

Wer lieber einzeln mergt, nimmt diese Reihenfolge, jede Basis zuerst: #449 → #450 → #451 → #452 → #454 → #456 → #453 → #455 → #458 → #457 → #459 → #462 → #460 → #461 → #463.

Konflikte im Sammelstand:
- in DEVELOPMENT.md, DESIGN_SYSTEM.md und BAUSTEINE.md (erzeugt);
- in `tests/gebuehr-wort-wache.test.ts` (Anhänge an FESTE_LISTE bzw. NACHARBEIT, beide Seiten behalten; den Eintrag, den 226 behoben hatte, weggelassen);
- in drei Seiten-Tests, die 226 und 231 beide mockten (zu einem Mock zusammengeführt).

## Für dich zu tun

- [ ] **Abnahme in der Vorschau** je PR bzw. auf test.agrilo.at: jede Route wie ihr Board, hell und dunkel, 390 und 1440 px.
- [ ] **Admin-Bilder hinter Passkey** (229, 230, 220 AdminShell, 219 /intern/bausteine), je vor und nach dem Stichtag. Die Listen stehen in den PRs.
- [ ] **Nach dem Merge, vorher nur lesend prüfen:**
  - gruendungMonate, gruendungFestAm, gruendungBisStandard und die Höfe mit Gründungsplatz;
  - ob irgendwo „24 Monate“ oder „456 €“ zugesagt wurde (Postfach, Rundschreiben, Mails).
- [ ] **Danach** „Monate ohne Grundgebühr“ = 12 speichern, die Liste „Zusagen festschreiben“ prüfen (jedes Ende nur später) und festschreiben.
  - Folge: Die Bargebühr der Gründungshöfe wird ab dem Tag nach ihrem Ende eingezogen.
  - Bei Freischaltung vor dem Tarifstart ist das der 1.2.2028.
- [ ] **„Offen für Recht“** gesammelt an die Anwältin (Liste unten). Den Konditionen-Abschnitt vor dem Stichtag freigeben und dann die Kennzeichnung „Entwurf – …“ entfernen.
- [ ] **A001 (Impressum) vor Stripe live.** Die Anbieterzeile in den Mails verlinkt auf agrilo.at/impressum.
- [ ] **Merge per Merge-Commit:** zuerst #449, dann der Sammel-PR.
- [ ] Die Punkte unter „Bitte bestätigen“ aus dem ersten Bericht, z. B. die Adressen der Beispielwelt in den Mockups.

## Rückfragen (Entscheidung offen)

1. **222, Nr. 45:** Gilt „höchstens ein Hinweis-Kasten oben“ auch für die Pflichtkarten? Gemeint sind Team-Sperre N34, Rücktritte N39, AGB Nr. 207, Hof-E-Mail Nr. 212 und Lastschrift-Sperre. Heute stehen sie untereinander, darunter höchstens ein Stripe-Kasten.
2. **222:** Heißt der Zustand READY „Gepackt“ oder „Abholbereit“? Die Boards widersprechen sich, gebaut ist „Gepackt“.
3. **223, N25:** Soll N25 an das Board angepasst werden? Das Board zeigt im Vorrat-Blatt kein „Dazu“ und kein „Ausverkauft“. Gebaut ist nach N25.
4. **223:** Sollen die Web-Formulare für Produkte eine Seite mit Vorschau rechts werden, statt eines Dialogs? Das widerspricht N41 d (Dialog höchstens 560 px).
5. **224:** Die Marke „Pausiert“ für gesperrte Barzahlung kollidiert mit dem Hofzustand „Pausiert“. Welches Wort soll es sein?
6. **224:** Kopf von Mein Hof am Handy: Titel und Schild wie im Board, oder Titelbild-Streifen nach N3/N4?
7. **228, N42 e:** Der Balken je Stand steht nur auf /onboarding. Für alle Hof-Seiten braucht es `(hof)/layout.tsx` und `src/server/hofbereich.ts`, beide liegen außerhalb jeder Grenze. Bitte als eigene Nummer freigeben. **N42 e ist bis dahin nicht ganz erledigt.**
8. **229:** Die Geld-Kachel in Heute zählt nach Abholung, die Freigabe nennt `createdAt` als maßgeblich. Das ändert nur die Anzeige in der ersten Woche nach dem Stichtag.
9. **229:** `setServiceFeeAction` bleibt nach dem Stichtag aufrufbar (A1: nur „nicht mehr zeigen“). Ob `Farm.serviceFee*` im Hofpreis-Modell noch wirkt, ist zu klären.

## Offen für Recht (gesammelt)

- **Mindestbestellwert-Satz (A3, 221/227):** die Preisangabe.
- **Konditionen-Abschnitt „Plattformgebühr und Abrechnung“ (221/231):** steht mit der Kennzeichnung „Entwurf“.
  - Freigabe vor dem Stichtag (N38).
  - Der Wortlaut in `konditionen.ts` weicht leicht von der Vorgabe ab: in der Klammer zum eigenen Satz und bei „Agrilo zieht“/„wir ziehen“.
- **N39-Beschriftung gegen die Mockups:** Die Knöpfe „Vertrag widerrufen“ und „Widerruf bestätigen“ bleiben. In der Oberfläche steht „Rücktritt“, in Knöpfen, Belehrung und im Betreff der Eingangsbestätigung „Widerruf“. Die Begriffe sind damit gemischt (227, 231, 232).
- **Datenschutzerklärung:** Das Board schlägt Ergänzungen und eine Nummerierung vor. Der Wortlaut ist unverändert.
- **AGB 1.0** (eigener /fix): /agb zeigt nach dem Stichtag weiter „Servicegebühr“.
- **Mails (232):** Fuß und Anbieterzeile nach ECG § 6 und MedienG § 24/25. Gehört die Anschrift des Hofs in den Fuß der Beitrags-Mail?
- **Kasse (227):** Die Korbzeile zeigt Menge, Zeilensumme und Grundpreis, aber nicht mehr „Menge × Einzelpreis“.

## Regelvorschläge

### Regel-Inventur 30 (G4, nur lesen; 16 Vorschläge, 5 davon offen aus früheren Läufen)

| # | Fundstelle | Grund | Vorschlag |
|---|---|---|---|
| 1 | ARCHITECTURE.md:253 | überholt (KundenKopf gilt seit Nr. 181 nicht mehr) | auf „Jede öffentliche Seite steht in der KundeShell“ kürzen |
| 2 | CODING_STANDARDS.md:367 | „nie type=number für Dezimalwerte“ ungeprüft, 6 Treffer | Wache mit Bestandsliste oder Ausnahme benennen |
| 3 | TESTING_GUIDELINES.md:242/244, bild-format.test.ts:85 | offen aus Lauf 25; 500 ms zu knapp (in diesem Lauf 587 und 948 ms unter Last) | Grenze ≥ 1000 ms, beide Zeilen zu einer zusammenführen |
| 4 | CODING_STANDARDS.md:34–35 | offen aus Inventur 7; Rückgabetyp und `!` ungeprüft (9 + 7 Stellen) | ESLint-Regeln mit Bestandsliste |
| 5 | CODING_STANDARDS.md:32 | `any`/`@ts-ignore` schon durch ESLint abgedeckt | auf einen Verweis kürzen |
| 6 | CLAUDE.md:157–165 | Hook-Liste doppelt und driftet | auf einen Verweis auf Hook und Test kürzen |
| 7 | TESTING_GUIDELINES.md:144–149 | Migrationswache dreifach beschrieben | Absatz streichen |
| 8 | TESTING_GUIDELINES.md:156/261/263 | Telefon-Regel dreifach | eine Zeile |
| 9 | TESTING_GUIDELINES.md:156–164 | Katalog der Wachen doppelt zu deren Kopfkommentaren | auf eine Regel kürzen |
| 10 | Herkunftsvermerke in docs/ai | wiederholt aus Lauf 20; widerspricht CLAUDE.md §3 | nach DEVELOPMENT.md verlegen |
| 11 | CODING_STANDARDS.md:39, :85 | durch leistung-196.test.ts abgedeckt | kürzen |
| 12 | DESIGN_SYSTEM.md:58 | „kein Inline-SVG“ widerspricht dem Code | auf die Marke einengen |
| 13 | Farbregel an vier Stellen | durch ESLint und Wachen abgedeckt | CLAUDE.md:71 bleibt, Rest verweisen |
| 14 | offen aus Lauf 25 (Slug/KEINE_HOFSEITE) | durch reservierte-slugs.test.ts abgedeckt | als erledigt abhaken |
| 15 | offen aus Lauf 29 (Speicher für den Typecheck im Stand-Check) | nicht aufgenommen | ein Satz in den Umgebungsfallen |
| 16 | CODING_STANDARDS.md:158 (TODO) | ungeprüft, 0 Treffer | streichen oder ESLint-Warnung |

### Aus diesem Lauf

- **Dirigent: Wer hält eine Datei?** Eine Seiten-Nummer bekommt die `src/lib`-Textdateien in die Grenze, deren Konstanten nur ihre Seiten lesen. Sonst bleiben Board-Wörter liegen (230, 222, 225 und 228 nannten viele solche Fälle). Ort: `docs/nachtlauf.md` §4a Punkt 1.
- **Dirigent, Zeitgrenzen unter Last:** Laufen vier Umsetzer gleichzeitig, steigt die Last auf über 12 (4 Kerne). Dann scheitern volle Läufe an Zeitgrenzen: `mail-wege-wache` 5 s, `geld-fliesskomma`-Gegenprobe 30 s, `password-reset` 5 s, `bild-format` 500 ms.
  - Gegenmaßnahme: die Höchstzahl gleichzeitiger Umsetzer als Prüfung im Skript des Dirigenten durchsetzen, nicht als Textregel. Die Zeitgrenzen der genannten Tests anheben (eigene Nummer).
  - Ort: `docs/nachtlauf.md` §4a Punkt 9.
- **Dirigent, Nachbesserung erst nach dem tester:** Lief der tester gleichzeitig mit einer Runde im selben Worktree, war sein Ergebnis nicht verwertbar (224). Eine Nachbesserung startet erst, wenn tester und pruefer fertig sind. Ort: §4a Punkt 3.
- **Dirigent, nach einem Container-Neustart:** Alte Unteragenten wecken Nachrichten wieder auf (231). Nach einem Neustart erhalten nur die neuen Agenten Nachrichten.
- **219:** Die Wortliste-Wache soll auch gebeugte Formen prüfen („Widerrufe“), und Sentry-Aufrufe sollen wie `console.*` ausgenommen sein.
- **221:** Text-Helfer je Modell nehmen `GebuehrModell`, nie ein Datum.
- **222:** Listen, die Server und Client teilen, liegen ohne Prisma in `src/lib`; `server/queries` reicht sie weiter.
- **224:** Hof-Seiten, die das Gebühren-Wort oder die Barzahlung zeigen, lesen die Plattform-Einstellung frisch.
- **227:** Tests, die Wortlaut oder Gestalt einer Seite prüfen, gehören zur Grenze der Nummer, der die Seite gehört.
- **228:** Ein Balken, dessen Wortlaut vom Stand abhängt, bekommt den Stand vom Lader.
- **230:** Siehe den ersten Vorschlag aus diesem Lauf („Wer hält eine Datei?“).

## Nacharbeit (gesammelt, je eigener Auftrag)

- **ui/-Bausteine (220):**
  - aktive Pille der Unterleiste
  - flaches „Neu“
  - Seitenleiste ohne Symbole
  - getönte Admin-Zähler
  - „Das schicken wir automatisch mit“ im Melde-Baustein (225)
- **Abfragen außerhalb der Grenzen:**
  - `gebuehrModell` in der Abgleich-Abweichung (`server/geld-abgleich.ts`, 230)
  - Gebühren-Karte nach Zeitraum und Gründungs-Ende (`queries/auswertung.ts`, 225)
  - „Bar bis …“ in den Produkten (`queries/products.ts`, 223)
  - Uhrzeit in der Packliste (`queries/heute.ts`, 222)
- **Texte in Dateien ohne Nummer:**
  - `kasse.ts` (Bar-Zusatz, Datenschutz-Link, `SERVICEGEBUEHR_ZUSATZ`)
  - `postfach.ts` und `meldung.ts`
  - `admin-anmeldung.ts`
  - `betrieb-mails.ts`
  - `startbildschirm.ts`
  - `farm-archive.ts`
  - `hof-verkaeufe.ts`
  - Storno-Grund in `server/widerruf.ts`
- **Doku:**
  - ARCHITECTURE.md:317 (meldung-abgeben.tsx)
  - DESIGN_SYSTEM Z. 815 („Das war ich nicht“)
  - DESIGN_SYSTEM zu Problem melden (Regel statt „offen“)
  - alter Satz zum Admin-Abmelden-Knopf
- **Tote Teile:**
  - `HoefeLaden`
  - `RegistrierenSatz`
  - `pending-approval-banner.tsx` (mit Palette-Klassen)
  - `FINANZEN_JAHR_TEXT.diagrammTitel`
  - Felder `…Kurz` in einrichten.ts
- **Robustheit:**
  - `lesePlattformEinstellung()` im `Promise.all` von Admin-Heute und Akte (229)
  - `antwortAnHof` ohne Formatprüfung (232)
  - `/teilen` lädt beim „Nochmal“ alle Fotos neu
- **Zeitgrenzen:** `mail-wege-wache` liegt mit 4,9 s an der Grenze von 5 s, `bild-format` mit 500 ms ebenfalls zu knapp.

## Abweichungen vom Ablauf (offen genannt)

- **Container-Neustart:** Er unterbrach vier Umsetzer (227, 232, 231, 222 Runde 1). Fortgesetzt wurde jeweils auf dem gesicherten WIP-Stand im Worktree.
- **Höchstens drei Umsetzer:** Zweimal liefen vier gleichzeitig. Als 223 bzw. die Runde von 224 startete, hatte ich falsch gezählt.
- **Alter 231-Umsetzer:** Einen Hinweis schickte ich an den 231-Umsetzer aus der Zeit vor dem Neustart, der dadurch wieder lief. Er ist gestoppt; der neue Umsetzer hat den Stand geprüft.
- **tester 224:** Er lief gleichzeitig mit Runde 1 und ist deshalb nicht verwertbar. Geprüft hat der volle Lauf jeder Runde.
- **Volle Läufe auf dem Sammelstand:** Nach den Merges von 222 und 226 waren zwei Läufe nur an Zeitgrenzen rot (Last 12–15). Auf ruhigem Rechner war der Lauf mit 226 grün (670 Dateien, 12410 Tests). Ab dann lief nach jedem Merge ein voller Lauf, alle grün.

## Bilder

Je Nummer unter `/home/user/wt/<nr>/.nachtlauf/screens/<nr>/` im Cloud-Container, nicht committet. Die Liste je Route, Breite und Thema steht im PR. Mail-Bilder (232): 90 Stück bei 390 und 600 px. Admin-Bilder fehlen (Passkey).

## Zeitbuch

`docs/nachtlauf/berichte/zeitbuch-lauf30.md`
