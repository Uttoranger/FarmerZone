# Morgenbericht Lauf 33 (Abschnitt C, 9./10.11.2026)

**Ergebnis:** Alle Nummern von Lauf 33 sind fertig, geprüft und im Sammelstand `integration/lauf33`: in C 282 (Antworten B), 262c (Werkzeug), 278 (Einstellungen und Teilen), 281 (Admin-Mängel), 26.1 (alter Unterseiten-Kopf gelöscht) und 280 (Mails, nach Runde 1). Voller Lauf auf dem Sammelstand grün (752 Dateien, 13877 Tests), Integration ganz grün (101 Dateien, 810 Tests). Keine Migration, kein Paket, keine neue Variable. Sammel-PR **bereit**: [#508](https://github.com/Uttoranger/FarmerZone/pull/508). Die Sitzung war von etwa 22:05 bis 07:29 UTC unterbrochen (Neustart des Containers); auf deinen Auftrag vom 10.11. („schau mal nach, was du nachholen musst …“) habe ich 08:03–09:04 UTC die Runde 1 von 280 und den Rest des Schluss-Durchgangs nachgeholt.

**Ordnungsgemäß beendet:** ja, mit Verspätung – Ende von C war Stunde 10 (05:19 UTC), der Lauf endete nach der Unterbrechung am 10.11. um 09:04 UTC (Commit dieses Berichts). Alle 49 Boards und die 12 Admin-Boards sind aufgenommen und bewertet, nicht herstellbare Figuren je Bild begründet, Aufräumen bestätigt. **Ziel erreicht (5 Sterne):** nein – kein Kunden- oder Hof-Board hat 5 Sterne in allen Fassungen (Tabelle unten; Einzelheiten in docs/nachtlauf/berichte/abnahme-lauf33.md „Schluss-Durchgang“). mail-hof-bestellung käme ohne den h1-Messpunkt auf 5·5 (Frage unten).

## Für dich zu tun

- [ ] **Für die Projektleitung am Tag T** (unverändert aus A005, nicht optional – die Notbremse am Vorabend sichert Bestellungen rund um Mitternacht ab, an denen Kassensatz (0.9) und Snapshot (1.0) auseinanderfallen könnten):
  - Generalprobe auf test.agrilo.at: Den Stichtag dort auf morgen setzen; der Admin erlaubt nur Tage in der Zukunft. Am Tag danach prüfen: /agb zeigt 1.0, eine Testbestellung hängt agb-<marke>-1.0.html an und verlinkt /agb/1.0, „Erneut bezahlen“ einer älteren Bestellung zeigt den alten Satz.
  - Vor T in der Produktion:
    - Stichtag im Admin setzen; er ist frei verschiebbar, bis er erreicht ist.
    - „Monate ohne Grundgebühr“ = 12 speichern und festschreiben.
    - Keinen echten Hof ohne Zustimmung zu 1.0 freischalten. Keinen um Zustimmung bitten, bevor er die Ankündigung per E-Mail mit 1.0 im Anhang hat.
  - Am Abend vor T: Admin › Notbremse von Hand setzen, spätestens um 23:29 Uhr (Wien), „bis“ 00:10 Uhr, Grund „Wartung“, Satz „Bestellen ist gerade kurz nicht möglich. Bitte versuch es nach Mitternacht wieder.“ Die Notbremse beginnt immer beim Speichern; einen späteren Start gibt es nicht. Wirkung: Bis Mitternacht verfällt jede vorher angelegte Online-Bestellung, die noch nicht bezahlt ist (30-Minuten-Frist). Über Mitternacht entsteht keine neue Bestellung. Bar angelegte Bestellungen bleiben im Modell bisher und bekommen 0.9, das ist richtig.
  - Nach 00:10 Uhr: /agb zweimal laden; es zeigt „Fassung 1.0 – gilt ab <T>“. Dazu /agb/0.9, /agb/1.0 und /konditionen (Stichtag, keine „Entwurf“-Marke).
  - In der Produktion keine Testbestellung, die als „abgeholt“ markiert wird (sonst zieht die Monatsabrechnung 6 % per echter Lastschrift ein). Wird doch eine gemacht: stornieren oder „nicht abgeholt“.
- [ ] **Gründungsplätze in Produktion auf 100 stellen** (Admin › Einstellungen › Gründungshöfe; „Plätze nur erhöhen“ lässt 12 → 100 zu), bevor eine Seite in Produktion eine Platzzahl nennt und vor jeder Werbung mit einer Zahl (sonst entsteht nachträglich künstliche Knappheit), spätestens vor dem ersten Festschreiben.
- [ ] **Die Gründungszusagen vor dem 1.1.2028 festschreiben**, sonst beginnt der Bar-Einzug der Gründungshöfe am 1.1.2028 statt am 1.2.2028 (K2/N44).
- [ ] **Musternummer:** Die Entwicklungsdatenbank trägt die alte Musternummer des Pilothof-Inhabers bis zum nächsten Seed. Bitte lesend prüfen, ob die alte Musternummer auch in Produktion steht (der Lauf ändert nichts).
- [ ] **Merge:** Sammel-PR [#508](https://github.com/Uttoranger/FarmerZone/pull/508) `integration/lauf33` → main per **Merge-Commit** (nicht Squash). Danach die Einzel-PRs schließen: A #503–#507, B #509–#522, C #523–#527 (ihr Inhalt ist dann auf main), dazu die PRs aus Lauf 32 (laut Morgenbericht 32 B: #466–#469, #476, #479–#489, #491–#500, Zweig nacht/2026-11-05/242-basis).
- [ ] **Board-Korrekturen für die Design-Gruppe** (zusätzlich zur Ergänzungsliste docs/nachtlauf/berichte/lauf33-ergaenzungen.md):
  - aus deinen Antworten zu B: Kasse (Leistensatz, Reservierungskasten; Antwort 5), bestellung-link „Bezahlt“ (Antwort 6), /widerruf Positionen als reine Textliste (Antwort 1 c); registrieren „12 Monate keine Grundgebühr“ ist gebaut (Antwort 4).
  - aus A und B unverändert: ONLINE_ZAHLUNG_EINRICHTEN_SATZ (heute Bild 4, registrieren Bild 5), Illustration im Dunkeln (F041), Quelle der Regionskarte „Kartendaten: Natural Earth“, Druck „Gesamt inkl. Plattformgebühr.“ statt „Preise inkl. …“, Kasse Karte „Deine Bestellung“, Hof-Kürzel in mehr-neu.
  - neu aus C: Ergänzung Z. 9 (Satz „Die Plattformgebühr ist Teil des Preises …“ und Zeile „Plattformgebühr“) gilt auch für kasse und bestellung-link; mail-sicherheit Z. 1019 und Z. 1021 (Board-Sätze, die der Code nicht übernimmt); Admin: Die Liste hat keine Admin-Zeilen – fertige Zusatzfunktionen (Akte-Karten, Zählfeld Meldungen, Regeln beim Rundschreiben, Zeitplan der Startseite, Geld/Jahr, Betrieb-Überblick) brauchen Board-Korrekturen oder Listenzeilen.
- [ ] **Prüfungen in der Vorschau**, die der Container nicht kann: „[TEST]“ im Seitentitel der 500; eine echt versandte Mail im Postfach (Knöpfe, Gewährleistungs-Grafik); Admin-Figuren, die der Prüf-Seed nicht hergibt (freischalten 1/2, zugang 3/4, startseite 3/5, geld 2).
- [ ] **P1 an die Anwältin** samt Hof-Mail zum Rücktritt und /widerruf (a) Feld „Deine E-Mail-Adresse“ mit Zeile „Eingangsbestätigung an …“ und (b) Anschrift des Hofs (deine Antwort 1 zu B); dazu die Fragen unter „Recht“.

## Entscheidungen und Fragen

- **Team-Einladung (280, Board mail-team Z. 1043 B):** Das Board will einen Knopf „Admin-Zugang absichern“ (auf /admin/einrichten, ohne Token; die Seite verlangt eine Anmeldung). Die Vorlage sagt seit Nr. 190 (N35): Sicherheitsmails des Admin-Teams ohne Link zum Anmelden, weil eine solche Mail das Muster jeder gefälschten Mail ist. Runde 1 hat den Knopf zurückgestellt. Knopf ja oder nein?
- **Mail „Zu viele falsche Codes“ (280, Z. 1019):** Der Board-Satz „ohne Code kommt niemand in dein Konto“ stimmt nicht für Hof- und Admin-Konten (Passwort, Passkey; die Mail geht an jedes Konto mit der Adresse). Gebaut bleibt der alte Satz „Ohne den Code aus deiner E-Mail kommt niemand weiter.“ – bitte Board korrigieren.
- **h1 in Mails:** Das Mail-HTML hat keine h1 (axe moderate „page-has-heading-one“). Ein Prüfer hat dafür je einen Stern abgezogen, der andere nicht. Gilt der h1-Messpunkt für Mails?
- **abmelden:** Der Hofname fehlt vor dem Klick, weil die Seite den Link erst bei „Ja, abmelden“ prüft (Liste Z. 760). Soll die Seite den Link beim Laden lesen (nur lesen, nicht abmelden)?
- **passwort:** „Vertrag widerrufen“ in Unterleiste/Fuß ohne deckende Zeile – gewollt?
- **mein-hof Kundenansicht:** Kopfzeile (Z. 558 B) gegen Q2/3.1 Nr. 2 – welche Regel gilt?
- **kasse (Geld-Wortlaut):** Figur 5: Code „(mit Plattformgebühr ab € 10,60). Dir fehlen noch Waren für € 8,60.“, Board ohne „ab“ und mit „(mit Gebühr € 5,83)“. Figur 3: Die Übersicht hat „Preise inkl. USt“ und einen Erklärsatz statt „Du bestellst … bar bei Abholung.“ und „Verkäufer ist …“. Keine Zeile in Liste oder Ergänzung. Board oder Code?
- **Prüf-Seed:** TP-HP-ONLINE steht auf CONFIRMED (scripts/pruefung/pruef-daten.ts Z. 242), die App zeigt dann „Bestätigt“ statt „Bezahlt“; die Gründungs-Einstellung des Prüf-Seeds hat 24 Monate statt 12. Vorschlag: Prüf-Seed auf PAID und 12 Monate.
- **Toast-Token** bleibt draußen (unverändert aus A). **ONLINE_ZAHLUNG_EINRICHTEN_SATZ:** Code bleibt (Antwort A 1), Board offen. **Karte „Deine Bestellung“** bleibt (Antwort A 2). **Startseite:** Platzhalter gegen Illustration – ohne neuen Befund; die Zusatzzeile „Noch 64 von 100 Gründungsplätzen frei …“ steht nicht im Board. **/api/triage und CLI-Export** bleiben bei der alten Nummer (Antwort A 3). **Was 279 bei widerruf offen ließ:** Feld und Anschrift → P1 (Antwort B 1 a/b).

## Nummern

| Nr | Inhalt | Status | PR | Vorschau | Migration | Weggelassen / offen |
|---|---|---|---|---|---|---|
| 282 | Antworten B: Positionsliste /widerruf als Text, Grundpreis je kg bzw. L, Test „12 Monate“ | fertig, im Sammelstand | [#523](https://github.com/Uttoranger/FarmerZone/pull/523) | Vercel-Vorschau des PR | nein | Grundpreis bei g/ml ohne Gebinde weiter je g/ml (Preisangabenrecht); 1 g/1 ml ohne Grundpreis-Zeile |
| 262c | Werkzeug: `.nachtlauf/**` aus eslint und Doku-Wache, Sperre einzelner Tabellen | fertig, im Sammelstand | [#524](https://github.com/Uttoranger/FarmerZone/pull/524) | – | nein | Regelvorschläge 3–5 aus B nicht gebaut (nicht freigegeben); Hinweise unter „Sicherheit“ |
| 278 | Einstellungen und Teilen | fertig, im Sammelstand | [#525](https://github.com/Uttoranger/FarmerZone/pull/525) | Vercel-Vorschau des PR | nein | Hof-E-Mail (R, N48), Toast-Lage, Hinweiskasten-Fließtext (G3) |
| 281 | Admin: messbare Mängel, Schrift-Wache | fertig, im Sammelstand | [#526](https://github.com/Uttoranger/FarmerZone/pull/526) | Vercel-Vorschau des PR | nein | Muster-Lücken der Schrift-Wache (`calc`, `clamp`, `var`, Prozent, Template-Strings); „Ab Monat Monat“; Ausreißer-Beschriftung am Handy rechts abgeschnitten, Diagramm-Beschriftung ohne „…“ |
| 26.1 | alter Unterseiten-Kopf gelöscht | fertig, im Sammelstand (d25f5ba29ba4) | – (Teil von #508) | – | nein | Weiter-Export hof-hilfe/lade-fehler-kasten.tsx bleibt (Importeur meine-meldungen.tsx); Kundendetail zwei h1 (Altbestand) |
| 280 | Mails | fertig nach Runde 1, im Sammelstand | [#527](https://github.com/Uttoranger/FarmerZone/pull/527) | Vercel-Vorschau des PR | nein | Team-Knopf (Z. 1043) und Board-Satz (Z. 1019) zur Entscheidung; Recht Z. 1035, 955/956; außerhalb der Grenze zustellung.ts, konditionen.ts, auth.ts (Z. 1044/1045, 972–974, 1063) |

Aus A und B: 261–270, 262b, 271–277, 279 fertig und im Sammelstand (Tabellen in den Zwischen-Morgenberichten A und B). Kein „nicht begonnen“.

## Merge-Reihenfolge

Sammel-PR `integration/lauf33` → main per **Merge-Commit** (nicht Squash). In C per `--no-ff` gemergt: 282 (#523), 262c (#524), 278 (#525), 281 (#526), 280 (#527, 237fa90b9db5); 26.1 als Commit im Sammelstand. Nach jedem Merge voller Lauf grün, Integration ganz am Ende. Konflikte nur in DEVELOPMENT.md (beide Einträge behalten), BAUSTEINE.md neu erzeugt. Danach Einzel-PRs schließen (oben).

## Ergebnis (Schluss-Durchgang; Tabelle mit Mängeln und Deckung in abnahme-lauf33.md)

| Board | Nr. | Schluss Lauf 32 | Schluss-Durchgang 33 |
|---|---|---|---|
| startseite | 271 | 3·3·3·3 | 4·4·3·3 |
| hoefe | 271 | 2·2·3·3 | 2·2·3·3 |
| hofseite | 271 | 3·3·4·4 | 3·3·4·3 |
| produkt | 271 | 2·2·3·2 | 3·4·3·4 |
| region | 272 | 2·2·2·2 | 2·2·2·2 |
| verkaeufe | 272 | 2·2·2·2 | 3·3·3·3 |
| korb | 276 | 3·3·5·5 | 4·4·4·4 |
| kasse, bestaetigung, bestellung-link | 276 | 4·4·4·4 | 4·4·4·4 |
| anmelden | 275 | 4·4·4·4 | 3·3·3·3 |
| passwort | 275 | 4·4·4·4 | 4·4·3·3 |
| registrieren | 275 | 3·3·3·3 | 3·3·3·3 |
| kundenkonto | 275 | 4·4·4·4 | 4·4·4·4 |
| meine-bestellungen | 275 | 3·3·3·3 | 4·4·4·4 |
| heute, bestellungen, bestellung | 277 | 4·4·4·4 | 4·4·4·4 |
| druck (nur hell) | 277 | 4·4 | 3·3 |
| produkte | 277 | 3·3·4·4 | 3·3·3·3 |
| produkt-neu | 277 | 3·3·3·3 | 2·2·2·2 |
| auswertung, kunden | 273 | 3·3·3·3 | 3·3·3·3 |
| postfach | 274 | 3·3·4·4 | 3·3·3·3 |
| mein-hof | 274 | 3·3·2·2 | 3·3·2·2 |
| meldungen | 268 | 3·3·3·3 | 4·4·3·3 |
| problem-melden | 268 | 2·2·2·2 | 4·3·4·3 |
| mehr-neu | 267 | 5·5·5·5 | 4·4·4·4 |
| hofdaten-zahlung, konto-hof, whatsapp-plakat, beitraege, einstellungen | 278 | 3·3·3·3 | 4·4·4·4 |
| teilen | 278 | – | 4·4·4·4 (nur Figur 2) |
| abmelden | 279 | 4·4·4·4 | 3·3·3·3 |
| neuigkeiten | 279 | 3·3·3·3 | 4·4·3·3 |
| rechtstexte | 279 | 4·4·4·4 | 4·4·4·4 |
| systemseiten | 279 | 5·5·4·4 | 4·4·5·5 (nur Figur 5) |
| widerruf, fehlerseiten | 279 | 3·3·3·3 | 3·3·3·3 |
| mail-betrieb · mail-hof-bestellung · mail-hof-konto · mail-kauf · mail-storno | 270/280 | n. p. · 3·3 · n. p. · 3·3 · 3·3 | 3·3 · 4·4 · 3·3 · 4·4 · 4·4 |
| mail-neuigkeiten · mail-sicherheit · mail-team · mail-zugang | 270/280 | n. p. | 4·4 · 4·4 · 3·3 · 4·4 |
| Admin (zählt nicht zum Ziel; voller Board-Vergleich, Lauf 32 nur Messpunkte) | 263/265/269/281 | 3–4 | heute, shell, hoefe 3·3·3·3; einstellungen, zugang 3·3·3·3; freischalten, geld 2·2·3·3; akte, bestellungen, postfach, startseite, betrieb 2·2·2·2 |

Besser als Schluss Lauf 32 in mindestens einer Fassung: startseite, produkt, verkaeufe, korb (390), meine-bestellungen, meldungen, problem-melden, neuigkeiten, hofdaten-zahlung, konto-hof, whatsapp-plakat, beitraege, einstellungen, systemseiten 1440, mail-hof-bestellung, mail-kauf, mail-storno. Schlechter: korb 1440, anmelden, passwort 1440, druck, produkte 1440, produkt-neu, mehr-neu, abmelden, systemseiten 390. Gemeinsame Ursachen: Karten-Baustein „gewählter Hof“ (region, hoefe), Ladefehler-Karte (G6) getönt statt neutral, Rundungen G8 und Knopfhöhen in Dialogen, Abstände nach Kopf/Hinweis (G3), Vorrat-Felder ohne verbundene Beschriftung, Seitenfuß am Handy (G11) zu weit unten und randlos, Auswahlpunkt im Dunkeln als Ring, Posten ohne und Gesamt mit Gebühr (bestellung, druck). Admin: kein Werkzeug-Kopf am Handy, Inhalt im Web 1330–1376 statt 1100 px, Startfokus in Dialogen auf der zerstörenden Aktion bzw. im Feld (Mangel nach Maßstab Punkt 5).

## Geld

- **280:** keine Rechnung geändert, kein Betrag anders gezeigt; nur die Positionsbeschriftung („Heumilch frisch · 4 L € 5,96“ → „**4** × Heumilch frisch (1 L) € 5,96“). Gegenlesen „Geld“ ohne Blocker (wörtlich in #527); Hinweis: der neue Karte-Test unterscheidet Vor-Ort-Betrag und Online-Summe nicht (gleiche Zahl).
- **282:** Grundpreis-Hilfe auf kg bzw. L (eine Stelle), Gegenlesen „Geld“ ohne Blocker (#523).
- **Schluss-Durchgang:** bestellung und druck zeigen Posten ohne und das Gesamt mit Gebühr – die Summe geht sichtbar nicht auf (Darstellung, keine Rechnung). kasse Figur 3 und 5: Wortlaut siehe Fragen. Mail „Artikel fehlt“ (Vorschau-Testfall) zeigt Position € 13,16 und „Neuer Betrag“ € 13,12 – der Testfall setzt den neuen Betrag von Hand (tests/mail-vorschau.test.ts:227), kein Fehler der App; Vorschlag: Testfall mit stimmiger Summe.

## Recht

- `git diff --name-only origin/main...integration/lauf33 -- src/lib/widerruf.ts src/lib/rechtstexte/ docs/recht/`: leer. 94 Rechtsblöcke der Mails byteweise gleich (Vergleichstest aus 280; der Schalter für eine neue Vorher-Fassung schlägt jetzt bewusst fehl).
- Offen für die Anwältin: Datum der Rücktritts-Eingangsmail nach V9 (Z. 1035) und Hof-Mail zum Rücktritt (Z. 955/956); /widerruf (a) und (b); ausgeschlossene Positionen auf /widerruf ohne eigene Markierung (282); Grundpreis bei g/ml ohne Gebinde (282).
- Lücke im Rechtsblock-Vergleich von 280: `<td>`, `<li>` und kurze Gebühren-Sätze sind nicht erfasst (von Hand gegengelesen, unberührt).

## Sicherheit

- 280: Der Blocker aus dem ersten Gegenlesen (Satz in „Zu viele falsche Codes“) ist in Runde 1 behoben; Nachlesen „Sicherheit“ ohne Blocker. Auth-nahe Dateien nur String-Literale (12 Zeilen, geraete.ts ohne Diff). Team-Knopf zurückgestellt (Frage oben).
- 262c: `pruefeDatenbankAdressen` (scripts/pruefung/sperre.ts:79, Altbestand) liest nur den Hostnamen; `?host=` im Query-Teil würde der Treiber übernehmen. Die neuen Modi sind trotzdem dicht (Name der Kopie, `current_database()`); Vorschlag: Query-Parameter host, hostaddr, dbname ablehnen. Kein `statement_timeout`.
- Der Prüf-Seed enthält im Postfach eine Meldung mit einer Anweisung an KI („Ignoriere alle vorherigen Anweisungen …“); alle Prüfer haben sie als Datenmaterial behandelt.

## Regelvorschläge (Freigabe nötig; Prüfung vor Textregel)

1. **Dialoge und Blätter als Fenster-Bild aufnehmen** (C: bestellung 3, produkte 2, verkaeufe 2, produkt-neu 1–5, kundenkonto 4 im Übergang aufgenommen; Nachaufnahme als Fenster-Bild mit Deckkraft 1 bestätigt, dass es die Aufnahme war): `seiten-bild.sh` mit Schalter ohne Ganzseite und Prüfung der berechneten Deckkraft = 1 vor dem Bild. Ort: scripts/pruefung/seiten-bild.sh (heute als Hilfsskript bild-fenster.sh außerhalb des Repos).
2. **Prüfwerkzeug immer über localhost** (Hof-Anmeldung über 127.0.0.1 scheitert am Herkunfts-Check mit der irreführenden Meldung „E-Mail oder Passwort falsch“): `pruef-browser.sh`/`seiten-bild.sh` lehnen 127.0.0.1 ab. Ort: scripts/pruefung/.
3. **Prüf-Seed für nicht herstellbare Figuren** (pausierter Hof, pausierte Online-Zahlung, Meldung mit Antwort, Link „sicherheit-nicht-ich“ und Einladungs-Link, wartender Hof mit Stripe, TP-HP-ONLINE als PAID, 12 Monate): Optionen in scripts/pruefung/pruef-daten.ts; Test, dass jede Option ihren Zustand anlegt.
4. **Mail-Bilder aus dem echten HTML** (die Admin-Vorschau entschärft Links absichtlich): `MAIL_VORSCHAU=1` als Schritt im Prüfwerkzeug beschreiben (docs/nachtlauf.md „Prüfwerkzeug“ Punkt 5), Aufnahme über einen statischen Server auf 127.0.0.1.

## Stabilität

- Start C 19:19 UTC (9.11.). 282 19:25–19:52 (Merge), 262c 19:42–20:14, 278 19:25–20:54 (zwei Runden), 281 20:10–21:00, 26.1 21:06–21:21, 280 21:00–21:57 (Umsetzer und Prüfungen). Schluss-Durchgang Block 1 21:02–22:00.
- **Unterbrechung:** etwa 22:05 bis 07:29 UTC (10.11.) ohne Arbeit; danach war der Container neu gestartet (Postgres unten, Prüf-Server und Browser beendet). 07:29–07:41 Abschluss mit 280 als Entwurf; um 08:03 erneut neu gestartet (Postgres unten).
- **Nachholen (10.11., 08:03–09:04 UTC):** 280 Runde 1 08:04–08:14 (voller Lauf 750 Dateien, 13878 Tests, 221 s), Prüfungen bis 08:17, Merge und voller Lauf 08:18–08:24 (752 Dateien, 13877 Tests, 287 s), Integration ganz 08:24–08:30 (101 Dateien, 810 Tests, 342 s). Prüfstand neu 08:05–08:18 (zwei Bauten, je etwa 3–5 min unter der Sperre), Fotografen SD, SG, DM, DA, DK 08:09–08:58, pruefer-ui P9–P14, M2–M4, A1–A3 08:04–09:02 (letzte Rückgabe vor 09:03).
- Budgets: Das Budget von 280 (hartes Ende 23:30) und des Schluss-Durchgangs (3 h) sind wegen der Unterbrechung überschritten; das Nachholen geschah auf deinen ausdrücklichen Auftrag.
- Obergrenzen eingehalten: höchstens ein schwerer Befehl (Sperre), höchstens drei Prüf-Server (k, g, dev), höchstens vier pruefer-ui. Alle Uhrzeiten aus `date -u`; 278 meldete eine unzuverlässige Systemuhr.

## Endstand der Bestandslisten (Start Lauf 33 → Ende)

- rundungen: 120 Dateien, 271 Stellen → 110 Dateien, 248 Stellen.
- kind-selektoren: 21 Dateien, 76 Stellen → 20 Dateien, 75 Stellen.
- startfokus: 1 → 1.
- unterseiten-kopf: 3 Dateien → leer, Liste gelöscht (26.1); die Werkzeug-Kopf-Wache bleibt ohne Liste.
- kaestchen (neu seit 269): 19 Dateien.
- admin-schrift (neu seit 281): 8 Dateien, 17 Stellen → 2 Dateien, 4 Stellen.

## Aufräumen

Bestätigt am 10.11. um 08:59 UTC: Fotografen k, g und dev gestoppt und weggeräumt (kein `$HOME/nachtlauf-dev`), Prüf-Browser gestoppt, keine `next`-, Chromium-, agent-browser- oder Passkey-Prozesse; Prüf-DBs `pruef33e`, `pruef33eg`, Kopien `kopie_k_pruef33e`, `kopie_g_pruef33eg`, `kopie_d_pruef33e` und `fz_int_zw` gelöscht (localhost:5432); `pruef-env`, Link- und Passkey-Dateien gelöscht; Prüf-Worktree `schluss` entfernt; erzeugtes Mail-HTML im Zwischenstand gelöscht. Es bleiben Bau- und Testprotokolle in den Nummern-Worktrees (`.nachtlauf/*.log`, ohne Geheimnisse) und leere Profilordner unter `.nachtlauf/browser`; beides liegt außerhalb des Repos.

## Bilder

Im Container unter `/home/user/FarmerZone/.nachtlauf/screens/`: `schluss/<board>/` (alle Boards einschließlich Mails und Admin, je mit INDEX.md und Messung), `280/r1/` (Mail-Vorschau vor Runde 1), `boards/` (Board-Bilder), dazu die Ordner der Nummern. Nicht committet; in einer neuen Sitzung nicht mehr vorhanden.
