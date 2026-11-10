# Morgenbericht Lauf 33 (Abschnitt C, 9./10.11.2026)

**Ergebnis:** In C fertig, geprüft und im Sammelstand `integration/lauf33` sind 282 (Antworten B), 262c (Werkzeug), 278 (Einstellungen und Teilen), 281 (Admin-Mängel) und 26.1 (alter Unterseiten-Kopf gelöscht). **280 (Mails) bleibt Entwurf** ([#527](https://github.com/Uttoranger/FarmerZone/pull/527)): tester grün, pruefer, „Recht“ und „Geld“ ohne Blocker, „Sicherheit“ mit einem Blocker (ein Satz in der Mail „Zu viele falsche Codes“); die vorbereitete Nachbesserung lief nicht mehr. Die Sitzung war von etwa 22:05 bis 07:29 UTC unterbrochen (Neustart des Containers); danach habe ich nur noch abgeschlossen. Keine Migration, kein Paket, keine neue Variable. Sammel-PR: [#508](https://github.com/Uttoranger/FarmerZone/pull/508).

**Ordnungsgemäß beendet:** teilweise. Alle Nummern außer 280 sind abgeschlossen, Sammelstand grün (voller Lauf nach dem letzten Code-Merge, Integration ganz 101 Dateien, 810 Tests), Aufräumen bestätigt. Nicht gelaufen: Nachbesserung 280, Block 2 des Schluss-Durchgangs (Admin, Mail-Codes, systemseiten), Gründungs-Bilder (registrieren, rechtstexte 5), Fenster-Bilder der Dialoge, Bewertung von auswertung, kunden, postfach, einstellungen. Das Ende von C (Stunde 10, 05:19 UTC) ist überschritten; der Abschluss lief 07:29–07:41 UTC. **Ziel erreicht (5 Sterne):** nein – kein Board mit 5 Sternen in allen Fassungen (Tabelle unten; Einzelheiten in docs/nachtlauf/berichte/abnahme-lauf33.md „Schluss-Durchgang“).

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
- [ ] **Merge:** Sammel-PR [#508](https://github.com/Uttoranger/FarmerZone/pull/508) `integration/lauf33` → main per **Merge-Commit** (nicht Squash). Danach die Einzel-PRs schließen: A #503–#507, B #509–#522, C #523–#526 (ihr Inhalt ist dann auf main), dazu die PRs aus Lauf 32 (laut Morgenbericht 32 B: #466–#469, #476, #479–#489, #491–#500, Zweig nacht/2026-11-05/242-basis). **#527 (280) nicht schließen:** bleibt Entwurf für Lauf 34 (Runde 1 siehe PR-Text, danach eigener Merge in den nächsten Sammelstand).
- [ ] **Board-Korrekturen für die Design-Gruppe** (zusätzlich zur Ergänzungsliste docs/nachtlauf/berichte/lauf33-ergaenzungen.md):
  - aus deinen Antworten zu B: Kasse (Leistensatz, Reservierungskasten; Antwort 5), bestellung-link „Bezahlt“ (Antwort 6), registrieren „12 Monate keine Grundgebühr“ ist gebaut (Antwort 4), /widerruf Positionen als reine Textliste (Antwort 1 c).
  - aus A und B unverändert: ONLINE_ZAHLUNG_EINRICHTEN_SATZ (heute Bild 4, registrieren Bild 5; der Schluss-Durchgang zeigt die Abweichung weiter), Illustration im Dunkeln (F041), Quelle der Regionskarte „Kartendaten: Natural Earth“, Druck „Gesamt inkl. Plattformgebühr.“ statt „Preise inkl. …“ (druck 3 Sterne nur deshalb mit), Kasse Karte „Deine Bestellung“, Hof-Kürzel in mehr-neu.
  - neu aus C: Ergänzung Z. 9 (Satz „Die Plattformgebühr ist Teil des Preises …“ und Zeile „Plattformgebühr“) gilt auch für kasse und bestellung-link, nicht nur bestaetigung; mail-sicherheit Z. 1019 (Board-Satz „ohne Code kommt niemand in dein Konto“ stimmt für Hof- und Admin-Konten nicht); mail-sicherheit Z. 1021 (Fußsatz „Bis dahin meldest du dich mit der alten Adresse an“ nicht im Code).
- [ ] **Prüfungen in der Vorschau**, die der Container nicht kann: „[TEST]“ im Seitentitel der 500; Admin-Mail-Vorschau mail-sicherheit; die Admin-Boards (Block 2 des Schluss-Durchgangs fiel aus, siehe unten).
- [ ] **P1 an die Anwältin** samt Hof-Mail zum Rücktritt und /widerruf (a) Feld „Deine E-Mail-Adresse“ mit Zeile „Eingangsbestätigung an …“ und (b) Anschrift des Hofs (deine Antwort 1 zu B); dazu die Fragen unter „Recht“.
- [ ] **„Nachtlauf 34“:** 280 Runde 1 (vorbereitet: `.nachtlauf`-Auftrag liegt nur im Container, Inhalt steht im PR-Text #527 unter „Offen für Runde 1“), danach Merge in den nächsten Sammelstand; Schluss-Durchgang Block 2 (Admin, Mail-Codes, systemseiten, registrieren und rechtstexte 5 gegen eine DB mit `--gruendung-fest`, Dialoge als Fenster-Bild) und die nicht bewerteten Boards.

## Entscheidungen und Fragen

- **Team-Einladung (280, Board mail-team Z. 1043 B):** Das Board will einen Knopf „Admin-Zugang absichern“ (auf /admin/einrichten, ohne Token; die Seite verlangt eine Anmeldung). Die Vorlage sagt seit Nr. 190 (N35): Sicherheitsmails des Admin-Teams ohne Link zum Anmelden, weil eine solche Mail das Muster jeder gefälschten Mail ist. Der Knopf ist in #527 gebaut; Runde 1 sollte ihn bis zu deiner Entscheidung zurückstellen. Knopf ja oder nein?
- **Mail „Zu viele falsche Codes“ (280, Z. 1019):** Board-Satz „ohne Code kommt niemand in dein Konto“ stimmt nicht für Hof- und Admin-Konten (Passwort, Passkey; die Mail geht an jedes Konto mit der Adresse). Vorschlag: der alte Satz „Ohne den Code aus deiner E-Mail kommt niemand weiter.“ bleibt, Board korrigieren.
- **abmelden:** Der Hofname fehlt vor dem Klick, weil die Seite den Link erst bei „Ja, abmelden“ prüft (Liste Z. 760). Soll die Seite den Link beim Laden lesen (nur lesen, nicht abmelden)?
- **passwort:** „Vertrag widerrufen“ in Unterleiste/Fuß ohne deckende Zeile – gewollt?
- **mein-hof Kundenansicht:** Kopfzeile (Z. 558 B) gegen Q2/3.1 Nr. 2 – welche Regel gilt?
- **kasse Figur 5 (Geld-Wortlaut):** Code „(mit Plattformgebühr ab € 10,60). Dir fehlen noch Waren für € 8,60.“, Board ohne „ab“ und mit „(mit Gebühr € 5,83)“. Keine Zeile in Liste oder Ergänzung. Board oder Code?
- **Toast-Token** bleibt draußen (unverändert aus A). **ONLINE_ZAHLUNG_EINRICHTEN_SATZ:** Code bleibt (deine Antwort A 1), Board offen. **Karte „Deine Bestellung“** bleibt (Antwort A 2). **Startseite:** Platzhalter gegen Illustration – im Schluss-Durchgang ohne neuen Befund (Zusatzzeile „Noch 64 von 100 Gründungsplätzen frei …“ nicht im Board). **/api/triage und CLI-Export** bleiben bei der alten Nummer (Antwort A 3). **Was 279 bei widerruf offen ließ:** Feld und Anschrift → P1 (Antwort 1 a/b).
- **Prüf-Seed:** TP-HP-ONLINE legt der Prüf-Seed mit Status CONFIRMED an (scripts/pruefung/pruef-daten.ts Z. 242), die App zeigt dann „Bestätigt“. Der Seed (TD-0007, TP-FEHLT, TP-KUENFTIG-1, TP-HP-ONLINE) kennt die Kombination online + bezahlt + bestätigt, die die App selbst nie anlegt. Vorschlag: Prüf-Seed auf PAID.

## Nummern

| Nr | Inhalt | Status | PR | Vorschau | Migration | Weggelassen / offen |
|---|---|---|---|---|---|---|
| 282 | Antworten B: Positionsliste /widerruf als Text, Grundpreis je kg bzw. L, Test „12 Monate“ | fertig, gemergt in den Sammelstand | [#523](https://github.com/Uttoranger/FarmerZone/pull/523) | Vercel-Vorschau des PR | nein | Grundpreis bei g/ml ohne Gebinde weiter je g/ml (Entscheidung Preisangabenrecht); 1 g/1 ml ohne Grundpreis-Zeile |
| 262c | Werkzeug: `.nachtlauf/**` aus eslint und Doku-Wache, Sperre einzelner Tabellen | fertig, gemergt | [#524](https://github.com/Uttoranger/FarmerZone/pull/524) | – | nein | Regelvorschläge 3–5 nicht gebaut (nicht freigegeben); Hinweise Sicherheit unten |
| 278 | Einstellungen und Teilen | fertig, gemergt | [#525](https://github.com/Uttoranger/FarmerZone/pull/525) | Vercel-Vorschau des PR | nein | Hof-E-Mail (R, N48), Toast-Lage, Hinweiskasten-Fließtext (G3), Zustandsbilder ohne Prüfdaten |
| 281 | Admin: messbare Mängel, Schrift-Wache | fertig, gemergt | [#526](https://github.com/Uttoranger/FarmerZone/pull/526) | Vercel-Vorschau des PR | nein | Muster-Lücken der Schrift-Wache (`calc`, `clamp`, `var`, Prozent, Template-Strings); „Ab Monat Monat“ (monat-wahl.tsx); Admin-Bilder nicht aufgenommen |
| 26.1 | alter Unterseiten-Kopf gelöscht | fertig, im Sammelstand (d25f5ba29ba4) | – (Teil von #508) | – | nein | Weiter-Export hof-hilfe/lade-fehler-kasten.tsx bleibt (Importeur meine-meldungen.tsx); Kundendetail zwei h1 (Altbestand) |
| 280 | Mails | **Entwurf**, nicht gemergt | [#527](https://github.com/Uttoranger/FarmerZone/pull/527) | Vercel-Vorschau des PR | nein | Blocker Sicherheit; Runde 1 offen; Recht Z. 1035, 955/956; außerhalb der Grenze zustellung.ts, konditionen.ts, auth.ts; mail-storno nicht herstellbar |

Aus A und B: 261–270, 262b, 271–277, 279 fertig und im Sammelstand (Tabellen in den Zwischen-Morgenberichten A und B). Kein „nicht begonnen“.

## Merge-Reihenfolge

Sammel-PR `integration/lauf33` → main per **Merge-Commit** (nicht Squash). In C per `--no-ff` gemergt: 282 (#523), 262c (#524), 278 (#525), 281 (#526); 26.1 als Commit im Sammelstand. Nach jedem Merge voller Lauf grün. Konflikte nur in DEVELOPMENT.md (beide Einträge behalten), BAUSTEINE.md neu erzeugt. 280 ist nicht enthalten. Danach Einzel-PRs schließen (oben).

## Ergebnis (Schluss-Durchgang, schlechtestes Bild je Fassung: 390 hell · 390 dunkel · 1440 hell · 1440 dunkel; Mails 390 · 600 hell, Druck nur hell)

| Board | Nr. | Schluss Lauf 32 | Schluss-Durchgang 33 |
|---|---|---|---|
| startseite | 271 | 3·3·3·3 | 4·4·3·3 |
| hoefe | 271 | 2·2·3·3 | 2·2·2·2 (Figur 5 „Hof gewählt“) |
| hofseite | 271 | 3·3·4·4 | 3·3·4·3 |
| produkt | 271 | 2·2·3·2 | 3·4·3·4 |
| region | 272 | 2·2·2·2 | 2·2·2·2 |
| verkaeufe | 272 | 2·2·2·2 | 3·3·3·3 |
| korb | 276 | 3·3·5·5 | 4·4·4·4 |
| kasse, bestaetigung | 276 | 4·4·4·4 | 4·4·4·4 |
| bestellung-link | 276 | 4·4·4·4 | 3·3·3·3 (Prüf-Seed „Bestätigt“; Neuaufnahme „Bezahlt“ nicht nachbewertet) |
| anmelden | 275 | 4·4·4·4 | 3·3·3·3 |
| passwort | 275 | 4·4·4·4 | 4·4·3·3 |
| heute, bestellungen | 277 | 4·4·4·4 | 4·4·4·4 |
| bestellung | 277 | 4·4·4·4 | 4·4·3·3 (Dialog-Bild im Übergang) |
| druck (nur hell) | 277 | 4·4 | 3·3 |
| produkte | 277 | 3·3·4·4 | 3·3·3·3 |
| produkt-neu | 277 | 3·3·3·3 | 2·2·2·2 |
| mein-hof | 274 | 3·3·2·2 | 3·3·2·2 |
| meldungen | 268 | 3·3·3·3 | 4·4·3·3 |
| problem-melden | 268 | 2·2·2·2 | 4·3·4·3 |
| mehr-neu | 267 | 5·5·5·5 | 4·4·4·4 |
| hofdaten-zahlung, konto-hof, whatsapp-plakat, beitraege | 278 | 3·3·3·3 | 4·4·4·4 |
| teilen | 278 | – | 4·4·4·4 (nur Figur 2) |
| abmelden | 279 | 4·4·4·4 | 3·3·3·3 |
| neuigkeiten | 279 | 3·3·3·3 | 4·4·3·3 |
| widerruf, fehlerseiten | 279 | 3·3·3·3 | 3·3·3·3 |
| mail-betrieb · mail-hof-bestellung · mail-hof-konto · mail-kauf (Stand 280, Entwurf) | 280 | n. p. · 3·3 · n. p. · 3·3 | 3·3 · 4·4 · 3·3 · 3·3 |
| auswertung, kunden, postfach, einstellungen, rechtstexte, kundenkonto, meine-bestellungen, systemseiten, registrieren | – | siehe abnahme | nicht bewertet bzw. nicht aufgenommen (Unterbrechung) |
| übrige Mails, 12 Admin-Boards | – | siehe abnahme | nicht aufgenommen bzw. nicht abgenommen (Block 2 ausgefallen) |

Besser als Schluss Lauf 32 in mindestens einer Fassung: startseite, produkt, verkaeufe, korb (390), meldungen, problem-melden, neuigkeiten, hofdaten-zahlung, konto-hof, whatsapp-plakat, beitraege, mail-hof-bestellung. Schlechter: hoefe (Figur 5 erstmals aufgenommen), korb 1440, bestellung-link (Prüf-Seed), anmelden, passwort 1440, bestellung 1440 (Aufnahme), druck, produkte 1440, produkt-neu, mehr-neu, abmelden. Gemeinsame Ursachen: Karten-Baustein „gewählter Hof“, Rundungen G8, Abstände nach Kopf/Hinweis (G3), Vorrat-Felder ohne verbundene Beschriftung, Auswahlpunkt im Dunkeln als Ring, Posten ohne und Gesamt mit Gebühr (bestellung, druck). Mails: Knöpfe und Links erscheinen in den Vorschau-Bildern als Text oder „[Link]“ – ob das die Vorschau oder die Mail ist, ist offen.

## Geld

- **280 (Entwurf):** keine Rechnung geändert, kein Betrag anders gezeigt; nur die Positionsbeschriftung („Heumilch frisch · 4 L € 5,96“ → „**4** × Heumilch frisch (1 L) € 5,96“). Gegenlesen „Geld“ ohne Blocker; Hinweis: der neue Karte-Test unterscheidet Vor-Ort-Betrag und Online-Summe nicht (gleiche Zahl). Im PR-Text #527 ist der „In Ordnung“-Teil des Gegenlesens um die Zeilenlisten gekürzt; die ungekürzte Fassung lag nur im Container und kommt mit Runde 1 in den PR.
- **282:** Grundpreis-Hilfe auf kg bzw. L (eine Stelle), Gegenlesen „Geld“ ohne Blocker (PR #523).
- **Schluss-Durchgang:** bestellung und druck zeigen Posten ohne und das Gesamt mit Gebühr – die Summe geht sichtbar nicht auf (Darstellung, keine Rechnung). kasse Figur 5 Wortlaut siehe Fragen.

## Recht

- `git diff --name-only origin/main...integration/lauf33 -- src/lib/widerruf.ts src/lib/rechtstexte/ docs/recht/`: leer (Sammelstand). In #527 ebenfalls leer; 94 Rechtsblöcke der Mails byteweise gleich (Vergleichstest).
- Offen für die Anwältin: Datum der Rücktritts-Eingangsmail nach V9 (Z. 1035) und Hof-Mail zum Rücktritt (Z. 955/956); /widerruf (a) und (b); ausgeschlossene Positionen auf /widerruf ohne eigene Markierung (282); Grundpreis bei g/ml ohne Gebinde (282).
- Lücke im Rechtsblock-Vergleich von 280: `<td>`, `<li>` und kurze Gebühren-Sätze sind nicht erfasst (von Hand gegengelesen, unberührt).

## Sicherheit

- 280: Blocker (siehe oben); Auth-nahe Dateien nur String-Literale (16 Zeilen, geraete.ts ohne Diff). Schalter `MAIL_RECHT_SCHNAPPSCHUSS=1` schreibt die Vorher-Fassung neu und ist im selben Lauf grün – Runde 1 soll danach bewusst fehlschlagen lassen.
- 262c: `pruefeDatenbankAdressen` (scripts/pruefung/sperre.ts:79, Altbestand) liest nur den Hostnamen; `?host=` im Query-Teil würde der Treiber übernehmen. Die neuen Modi sind trotzdem dicht (Name der Kopie, `current_database()`), Vorschlag: Query-Parameter host, hostaddr, dbname ablehnen. Kein `statement_timeout`.

## Regelvorschläge (Freigabe nötig; Prüfung vor Textregel)

1. **Dialoge und Blätter als Fenster-Bild aufnehmen** (C: bestellung 3, produkte 2, verkaeufe 2, produkt-neu 1–5 im Übergang aufgenommen, Deckkraft 0,35–0,58): `seiten-bild.sh` bzw. `bild-jetzt.sh` mit Schalter ohne Ganzseite und Prüfung der berechneten Deckkraft = 1 vor dem Bild. Ort: scripts/pruefung/seiten-bild.sh.
2. **Prüfwerkzeug immer über localhost** (C: Hof-Anmeldung über 127.0.0.1 scheitert am Herkunfts-Check mit der irreführenden Meldung „E-Mail oder Passwort falsch“): `pruef-browser.sh`/`seiten-bild.sh` lehnen 127.0.0.1 ab. Ort: scripts/pruefung/.
3. **Prüf-Seed für nicht herstellbare Figuren** (pausierter Hof, pausierte Online-Zahlung, Meldung mit Antwort, Storno- und weitere Mail-Arten, TP-HP-ONLINE als PAID): Optionen in scripts/pruefung/pruef-daten.ts; Test, dass jede Option ihren Zustand anlegt.
4. **Schnappschuss-Schalter in Vergleichstests schlägt nach dem Schreiben fehl** (280): Muster für alle Vergleichsdateien. Ort: tests/mail-vorschau.test.ts und künftige Vergleichstests.

## Stabilität

- Start C 19:19 UTC (9.11.). 282 19:25–19:52 (Merge), 262c 19:42–20:14, 278 19:25–20:54 (zwei Runden), 281 20:10–21:00, 26.1 21:06–21:21, 280 21:00–21:50 (Umsetzer), Prüfungen bis 21:57. Schluss-Durchgang Block 1 21:02–21:53 (Fotografen K1, K2, H1, H2, SK, SK2, SH), pruefer-ui P1–P8 und M1 bis etwa 22:00.
- **Unterbrechung:** etwa 22:05 bis 07:29 UTC (10.11.) ohne Arbeit; danach war der Container neu gestartet (Postgres unten, alle Prüf-Server und Browser beendet). Damit überschritten: Budget 280 (hartes Ende 23:30), Schluss-Durchgang (3 h), Ende von C (Stunde 10). Nach Punkt 12 (e) blieb 280 Entwurf; der Abschluss lief 07:29–07:41 UTC.
- Volle Läufe im Sammelstand: 19:21, 19:52, 20:14, 20:54, 21:01 (751 Dateien, 13871 Tests, 208 s), 26.1 21:15 (751 Dateien, 13858 Tests, 243 s). Integration ganz am Ende auf d1690d0d9ab3 (07:30–07:37 UTC, 10.11.): 101 Dateien, 810 Tests grün, 366 s.
- Abweichungen: Zeitweise liefen zwei start-Fotografen und der dev-Fotograf von 280 gleichzeitig (drei Prüf-Server, Grenze eingehalten). 278 meldete eine unzuverlässige Systemuhr; alle Uhrzeiten des Dirigenten stammen aus `date -u`.

## Endstand der Bestandslisten (Start Lauf 33 → Ende)

- rundungen: 120 Dateien, 271 Stellen → 110 Dateien, 248 Stellen.
- kind-selektoren: 21 Dateien, 76 Stellen → 20 Dateien, 75 Stellen.
- startfokus: 1 → 1.
- unterseiten-kopf: 3 Dateien → leer, Liste gelöscht (26.1); die Werkzeug-Kopf-Wache bleibt ohne Liste.
- kaestchen (neu seit 269): 19 Dateien.
- admin-schrift (neu seit 281): 8 Dateien, 17 Stellen → 2 Dateien, 4 Stellen.

## Aufräumen

Bestätigt um 07:38 UTC (10.11.). Gelöscht: Prüf-DBs `pruef33c`, `pruef33cg`, Kopien `kopie_k_pruef33c`, `kopie_h_pruef33c`, `kopie_g_pruef33cg`, Integrations-DBs `fz_int_zw`, `fz_int_280`; `.nachtlauf/pruef-env`, Link- und Passkey-Dateien; Prüf-Worktree `schluss` samt `.next` und Fotografen-Kopien. Prüf-Server und Browser liefen nach dem Neustart nicht mehr; keine `next`-, Chromium-, agent-browser- oder Passkey-Prozesse. Es bleiben Bau- und Testprotokolle in den Nummern-Worktrees (`.nachtlauf/*.log`, ohne Geheimnisse) und das leere Profil des Board-Browsers unter `.nachtlauf/browser` (rekursives Löschen blockt der Hook); beides liegt außerhalb des Repos und fällt mit dem Container weg.

## Bilder

Im Container unter `/home/user/FarmerZone/.nachtlauf/screens/`: `schluss/<board>/` (40 Board-Ordner mit INDEX.md und Messung), `280/r1/` (72 Mail-Bilder), `boards/` (Board-Bilder), dazu die Ordner der Nummern. Nicht committet; in einer neuen Sitzung nicht mehr vorhanden.
