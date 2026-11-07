# Zwischen-Morgenbericht Lauf 32, Abschnitt A (6./7.11.2026) · Board oder Code, Bausteine zuerst, AGB 1.0 mit dem Stichtag

**Ergebnis Abschnitt A:** Alle Nummern von Abschnitt A sind gebaut, geprüft, gepusht und im Zwischenstand `integration/lauf32` zusammengeführt: Doku-PR 243a, 243 (Prüfwerkzeug), 244 (Geldanzeige), 259 (AGB 1.0 mit dem Stichtag), 245–248 (Bausteine G1–G14 und Geldsätze V1), 256 (Mail „Neue Bestellung bar“), 258 (Geld-Kachel) und – trotz eines Container-Neustarts – auch 249 (Hof-Alltag), das nach Plan in B gerutscht wäre. Auf dem Zwischenstand sind der volle Lauf (706 Dateien, 13209 Tests) und die Integrationstests ganz (97 Dateien, 789 Tests) grün. Keine Migration, kein Paket, keine neue Variable.
- Der Admin ist erstmals abgenommen (Prüf-Passkey in der Wegwerf-DB, N46): Bild 1 je Board, meist 2–3 Sterne; die Admin-Mängel stehen als Liste unten.
- Zwischen-Durchgang A für die Boards der fertigen Nummern: 14 Boards bewertet (Tabelle in abnahme-lauf32.md). Besser als Schluss Lauf 31: heute 2→4, bestellung 2·2·3·3→4·4·3·3, produkt-neu 2→3, rechtstexte 3→4 am Handy, mail-hof-bestellung 3→4, mehr-neu 5·5·4·3→**5·5·5·5**. Gleich: kasse (5·5·4·4), einstellungen, produkte, bestellung-link (4), druck. Schlechter: bestaetigung 3→2 (Bild 3 jetzt eine Bar-Bestellung nach dem Stichtag) und bestellungen 3·3·2·2→2 (Bild 3 mit einem schon freigeschalteten Prüfhof aufgenommen – Nachfoto nötig).
- Kein Board erreicht in A überall 5 Sterne; fast alle offenen Punkte sind B-Zeilen der Seiten-Nummern in Abschnitt B (250–255) oder durch Liste/Auftrag gedeckt. Der Sammel-PR ist als **Entwurf** offen.

Verlauf der Nacht: `docs/nachtlauf/berichte/zeitbuch-lauf32.md`. Bewertung je Board: `docs/nachtlauf/berichte/abnahme-lauf32.md` (Abschnitte „Admin, Erstabnahme“ und „Zwischen-Durchgang A“).

## Für dich zu tun

- [ ] **Mit dem Merge sehen alle Höfe mit Fassung 0.9 die Karte ‚AGB 1.0 zustimmen‘ (E-019). Vor dem Merge sicherstellen, dass kein echter Hof freigeschaltet ist, der die Ankündigung noch nicht hat. Wer 259 allein mergt, mergt vorher den Doku-PR; der bringt auch Freigabe §36 und die Register-Einträge von Lauf 32 auf main.** (gilt für #483 allein und für den Sammel-PR)
- [ ] **Für die Projektleitung am Tag T** (wörtlich aus A005; nicht optional – die Notbremse am Vorabend sichert Bestellungen rund um Mitternacht ab, an denen Kassensatz (0.9) und Snapshot (1.0) auseinanderfallen könnten):
  - Generalprobe auf test.agrilo.at: Den Stichtag dort auf morgen setzen; der Admin erlaubt nur Tage in der Zukunft. Am Tag danach prüfen: /agb zeigt 1.0, eine Testbestellung hängt agb-<marke>-1.0.html an und verlinkt /agb/1.0, „Erneut bezahlen“ einer älteren Bestellung zeigt den alten Satz.
  - Vor T in der Produktion:
    - Stichtag im Admin setzen; er ist frei verschiebbar, bis er erreicht ist.
    - „Monate ohne Grundgebühr“ = 12 speichern und festschreiben.
    - Keinen echten Hof ohne Zustimmung zu 1.0 freischalten. Keinen um Zustimmung bitten, bevor er die Ankündigung per E-Mail mit 1.0 im Anhang hat.
  - Am Abend vor T: Admin › Notbremse von Hand setzen, spätestens um 23:29 Uhr (Wien), „bis“ 00:10 Uhr, Grund „Wartung“, Satz „Bestellen ist gerade kurz nicht möglich. Bitte versuch es nach Mitternacht wieder.“ Die Notbremse beginnt immer beim Speichern; einen späteren Start gibt es nicht. Wirkung: Bis Mitternacht verfällt jede vorher angelegte Online-Bestellung, die noch nicht bezahlt ist (30-Minuten-Frist). Über Mitternacht entsteht keine neue Bestellung. Bar angelegte Bestellungen bleiben im Modell bisher und bekommen 0.9, das ist richtig.
  - Nach 00:10 Uhr: /agb zweimal laden; es zeigt „Fassung 1.0 – gilt ab <T>“. Dazu /agb/0.9, /agb/1.0 und /konditionen (Stichtag, keine „Entwurf“-Marke).
  - In der Produktion keine Testbestellung, die als „abgeholt“ markiert wird (sonst zieht die Monatsabrechnung 6 % per echter Lastschrift ein). Wird doch eine gemacht: stornieren oder „nicht abgeholt“.
  - Nichts deployen.
- [ ] **Prüfungen, die der Container nicht konnte** (die Vercel-Vorschau ist aus dem Container nicht erreichbar):
  - „Punkt im Pfad“: Kommen `/agb/0.9` und `/agb/1.0` auf der Vorschau von #483 bzw. des Sammel-PR als Seite an (nicht 404)? Wenn nicht: Kennungen im Pfad als „0-9“ und „1-0“ (A005 Schritt 4b) – dann melden.
  - Bilder „vor T auf der Dev-DB“: /agb, /agb/1.0, /konditionen und die Kasse auf der Vorschau ansehen (Entwicklungsdatenbank mit Stichtag in der Zukunft). Lokal mit eigener Wegwerf-DB vor T gemacht: /agb zeigt 0.9 mit „Ab <Tag> gilt Fassung 1.0. Fassung 1.0 lesen“, Kasse mit dem Satz „… dass Agrilo die Vermittlung sofort ausführt“.
  - Ersten CI-Lauf des Integrationstests `pruefung-seed` ansehen (eigener Zweig für Postgres als Dienst-Container, lokal nur der Loopback-Zweig gelaufen).
- [ ] **E-025:** AGB 1.0 nur sichtbar oder Stichtag vorziehen ist keine Code-Frage – es entscheidet allein der Stichtag-Wert im Admin.
- [ ] **P2:** Zahl der Gründungsplätze 12 (Boards) oder 100 (Register Nr. 116)? In Produktion steht gruendungPlaetze, sofern nicht geändert, auf dem Vorgabewert 12.
- [ ] **Startsätze:** „256 freigegeben“ und „Geld-Kachel-Regel bestätigt“ lagen vor (Zeile 2 und 3 der Startnachricht); 256 und 258 sind gebaut, N46 trägt beide Sätze.
- [ ] **Abschnitt B** startet nur mit **„Nachtlauf 32 fortsetzen“** (neue Sitzung). Offen für B: Welle 4b 252 ∥ 253, danach 250, 251; Welle 5 257 (Abholung nach Absprache, braucht 253), 254, 255 (mit den Mail-Gesamt-Stellen aus 244), 258b (messbare Admin-Mängel); Sammel-PR „bereit“, Schluss-Durchgang (5 h). Integrationszweig: Wird der Entwurf-PR von A gemergt, startet B von `integration/lauf32b` (von main); sonst arbeitet B auf `integration/lauf32` weiter, und dieser PR wird zum Sammel-PR von A+B.
- [ ] **Aufräumen auf GitHub (nur du):** PRs #466, #467, #468, #469 und #476 schließen, Zweig `nacht/2026-11-05/242-basis` löschen.
- [ ] **P1 an die Anwältin (O9):** Rücktritts-Zeile je Produkt, die zwei Sätze in der Storno-Mail (Rückzahlung, verderbliche Ware), Platzhalter in der Belehrung auf /widerruf.
- [ ] **Admin-Mängelliste** als Vorlage für eine Admin-Board-oder-Code-Runde: `abnahme-lauf32.md`, „Admin, Erstabnahme“ (Bewertung je Board) und „Zwischen-Durchgang A“ (admin-heute). Messbar (für 258b in B): Schrift < 12 px an Kachel- und Tabellenköpfen (Heute, Höfe, Geld) und an der Marke „Entwurf · nur für dich sichtbar“ (Startseite), Kästchen ohne sichtbare Beschriftung (Heute/Einstellungen am Handy), Eingabefelder an der 44-px-Grenze (Akte, Freischalten, Einstellungen). Fachlich prüfen: admin-geld (Kachel € 0 gegen Plattformgebühr € 2,85 gegen „online einbehalten € 0,00“), admin-einstellungen („36 sind schon vergeben“ gegen „Vergeben 12“), admin-heute („4 von 4 laufen“ bei fünf Diensten, „1 warten“).
- [ ] **Regelvorschlag Produkt-„Nochmal“:** Ein „Nochmal“ beim Anlegen eines Produkts wäre über eine Formular-ID möglich (bräuchte Gegenlesen „Daten/Sicherheit“: Format-Prüfung, ID eines fremden Hofs ergibt einen Fehler ohne Auskunft). Lauf 32 baut es nicht.
- [ ] **Backlog:** Beispiel-Domain `beispiel.at` prüfen (gehört sie jemandem? sonst auf eine reservierte Domain umstellen).

## Entscheidungen und Fragen (aus den Nummern)

- **/settings am Handy ohne „‹“** (245): Board s1-einstellungen zeigt es, `elternseite('/settings')` ist null (N1 sieht für Seiten des Mehr-Blatts keine Elternseite vor). Soll /settings „Mehr“ als Elternseite bekommen?
- **/account/login** (247): zeigt am Handy weiter die Pille „Anmelden“; Q2 nennt „die Anmeldeseite“, G9 nur /login und /register. Auch auf /account/login weglassen?
- **Kachel-Wort „Umsatz der Höfe“** (258): zählt jetzt auch unbestätigte Bar-Bestellungen; „Bestellwert“? /admin/geld nutzt dasselbe Wort mit anderer Regel.
- **Abholzeiten-Satz** (249): neuer Wortlaut nach Liste heute Z. 296 steht als Übergang neben `ABHOLZEITEN_FEHLEN.satz` (Einstellungen/Hof einrichten); Vorschlag: Nr. 250 stellt die eine Konstante um.
- **Kurznummer** (248): 6 statt 4 Zeichen (bei 4 hätten bei 1.000 Meldungen etwa 25 % eine doppelte) – Board auf 6 angleichen? Alte 8-Zeichen-Nummern werden übergangsweise erkannt.
- **Toast-Farben** (246): aus vorhandenen Tokens statt der Board-Werte; ein eigenes Toast-Token bräuchte deine Freigabe.
- **Geldsatz-Wortlaut** (248): „Du bekommst die vollen € … – für diesen Barverkauf zahlst du keine <Gebühr>.“ für eine erlassene Bestellung mit abgelaufener Frist ist eigener Wortlaut (die Liste gibt keinen vor).
- **Abholzettel (druck)**: Bei einer nicht abgeholten Bestellung mit Karte bei Abholung (TD-0005) steht unter „Gesamt € 95,00“ weiter „**Bar** zu kassieren: € 99,75 (davon Servicegebühr € 4,75)“ – „Bar zu kassieren“ ist laut Auftrag 244 der unveränderte Snapshot. Kasten bei „Nicht abgeholt“/entfallener Gebühr ausblenden oder „Nichts mehr zu kassieren“? Bei Karte „Zu kassieren“ statt „Bar“?
- **Kasse 1440** (Zwischen-Durchgang): Spalten breiter als im Board und Rückweg mit Symbol statt „←“ im Link – keine Listenzeile (Kasse hat nur C/R/U): Board oder Code?
- **Bestätigung im Hofpreis-Modell**: Die App zeigt „Ware · Plattformgebühr · Gesamt“ getrennt, wie AGB 1.0 Punkt 10.2 und N38 es verlangen; das Board zeigt keine Gebührenzeile → Board-Korrektur (vom Dirigenten als R eingeordnet).

## Nummern

| Nr. | Inhalt | PR | Vorschau (Muster) | Migration | Weggelassen und warum |
|---|---|---|---|---|---|
| 243a | Doku: Freigabe §36, Register N46/N47, Warteschlange, Stabilität, Zeitbuch | [#479](https://github.com/Uttoranger/FarmerZone/pull/479) | farmer-zone-git-docs-lauf32-bierbaron.vercel.app | nein | – |
| 243 | Prüfwerkzeug mit Loopback-Sperre, Prüf-Seed, Passkey-Browser; Admin-Erstabnahme | [#482](https://github.com/Uttoranger/FarmerZone/pull/482) | –¹ | nein | Admin-Zustände 2–6/7 (Zeit); Links „nicht ich“/„E-Mail bestätigen“ (Better-Auth-Token) |
| 244 | Geldanzeige: Gesamt ohne entfallene Gebühr (Bestätigung, Bestellseite, Abholzettel) | [#480](https://github.com/Uttoranger/FarmerZone/pull/480) | farmer-zone-git-nacht-2026-11-06244-geldanzeige-bierbaron.vercel.app | nein | Mail-Gesamt, Admin-Vorschau (→ 255), Meine Bestellungen |
| 259 | AGB 1.0 mit dem Stichtag (A005, N45) | [#483](https://github.com/Uttoranger/FarmerZone/pull/483) | farmer-zone-git-nacht-2026-11-06259-agb-1-0-bierbaron.vercel.app | nein | – (Punkt im Pfad: für dich) |
| 258 | Geld-Kachel nach Antwort 1 (Startsatz lag vor) | [#481](https://github.com/Uttoranger/FarmerZone/pull/481) | farmer-zone-git-nacht-2026-11-06258-geld-kachel-bierbaron.vercel.app | nein | Kachel-Wort (Frage) |
| 245 | Bausteine Teil 1: G8 Rundungen, G1 Werkzeug-Kopf, G3 Hinweiskasten/Hof-Balken, G2 Aktionsleiste | [#484](https://github.com/Uttoranger/FarmerZone/pull/484) | farmer-zone-git-nacht-2026-11-06245-bausteine-1-bierbaron.vercel.app | nein | „‹“ auf /settings (Frage) |
| 256 | Mail „Neue Bestellung bar“ an den Hof (Startsatz lag vor) | [#485](https://github.com/Uttoranger/FarmerZone/pull/485) | farmer-zone-git-nacht-2026-11-06256-bar-mail-hof-bierbaron.vercel.app | nein | Positionszeile, Uhrzeit (→ 255) |
| 247 | Bausteine Teil 3: G9 Kunden-Kopf, G10 Unterleiste, G11 Fuß und Chip-Gruppe | [#486](https://github.com/Uttoranger/FarmerZone/pull/486) | farmer-zone-git-nacht-2026-11-06247-bausteine-3-bierbaron.vercel.app | nein | Produktseite: Wegscrollen erst mit 252 |
| 246 | Bausteine Teil 2: G4 Leerzustand ohne Symbol, G6 Formularfehler, G7 Toast, Startfokus- und `[&>`-Wache | [#487](https://github.com/Uttoranger/FarmerZone/pull/487) | farmer-zone-git-nacht-2026-11-06246-bausteine-2-bierbaron.vercel.app | nein | G6 an den Formularen (Seiten-Nummern) |
| 248 | Bausteine Teil 4: G5, G12, G13, G14, Geldsätze V1 | [#488](https://github.com/Uttoranger/FarmerZone/pull/488) | farmer-zone-git-nacht-2026-11-06248-bausteine-4-bierbaron.vercel.app | nein | Seiten stellen auf die Varianten um (B) |
| 249 | Hof-Alltag: heute, bestellungen, bestellung, druck, produkte, produkt-neu, mehr-neu | [#489](https://github.com/Uttoranger/FarmerZone/pull/489) | farmer-zone-git-nacht-2026-11-06249-hof-alltag-bierbaron.vercel.app | nein | siehe PR (Grenzen 247/Mein Hof, Checkbox-Token) |
| Sammel 32 | `integration/lauf32` → main (Entwurf) | [#490](https://github.com/Uttoranger/FarmerZone/pull/490) (Entwurf) | farmer-zone-git-integration-lauf32-bierbaron.vercel.app | **nein** | – |
| 250–255, 257, 258b | Abschnitt B | – | – | – | offen (B) |

¹ Vercel-Vorschauen: alle Bauten der Lauf-32-Branches waren um 00:30 UTC READY; die Adressen folgen dem Muster der Vercel-Kommentare (nicht aus dem Container geprüft).

**Geld:** Keine Geldberechnung, kein gespeicherter Betrag, keine bestehende Geld-Testerwartung geändert. Neu sind nur Anzeige-Hilfen (244 `anzeigeGesamtCents`/`gebuehrEntfallenVermerk`, 248 `geldsaetzeFuer`), die Zählregel der Geld-Kachel (258) und der eine Mail-Auftrag in /api/checkout (256). Pflicht-Gegenlesen „Geld“ je in den PRs.

## Merge-Reihenfolge

**Gestapelte PRs per Merge-Commit mergen, nicht per Squash.**

1. Den **Sammel-PR [#490](https://github.com/Uttoranger/FarmerZone/pull/490) `integration/lauf32` → main** (Entwurf) nach Durchsicht auf „bereit“ stellen und per Merge-Commit mergen. Er enthält den Doku-PR #479, 243 (#482), 244 (#480), 259 (#483) und den Zwischenstand mit 245–248, 256, 258 und 249.
2. Danach #479–#489 schließen, ihr Inhalt ist dann auf main.

Wer 259 vorziehen will (Go-live T): erst #479 (Doku) → main, dann #483 → `docs/lauf32` bzw. nach dem Umstellen der Basis auf main. Den Merge-Hinweis oben beachten.

## Offen

- Mail-Gesamt und Admin-Vorschau zeigen bei entfallener Gebühr noch den alten Betrag (betrifft nur die Admin-Vorschau; Kundinnen- und Hof-Mails gehen vorher raus). Kommt mit 255.
- „Meine Bestellungen“ zeigt bei stornierten Bestellungen noch Warenpreis + Gebühr, die verlinkte Bestätigung jetzt den Warenpreis (Server-Lesepfad braucht `serviceFeeRefundedAt`) – Nacharbeit mit 255 oder eigener Nummer.
- 259: Link „Frühere Fassung 0.9 (für Bestellungen bis …)“ auf /agb ist als Ziel unter 44 px (Zwischen-Durchgang) – Nacharbeit (254 im Rahmen oder 259).
- 247: Produktseite behält bis 252 den klebenden Agrilo-Kopf (Weg zum Korb); 252 öffnet das Wegscrollen.
- 248: Größenkachel und Stepper als Varianten – die Seiten-Nummern setzen `form="zeile"`/`form="pille"`.
- 249: Produkt anlegen – Verkaufsgrößen als Chips mit Bearbeitungskarten, Holz-Angaben aufklappbar, Kästchen im Dunkeln (Checkbox-Token fehlt); Postfach-Symbol im Produkte-Kopf; Unterleiste/Chip-Rand auf Bestellungen.
- **249 Abholzettel:** Der Satz „Preise inkl. Plattformgebühr.“ steht über Positionen ohne Gebühr (Positionen € 12,20, Gesamt € 12,95) – Positionen inkl. Gebühr anzeigen (nur Anzeige) oder Satz ändern; Nacharbeit 249 in B mit Gegenlesen „Geld“.
- 249 weitere Mängel aus dem Zwischen-Durchgang (Liste in abnahme-lauf32.md): heute „Nächste Abholung“ ohne Bestellzahl und mit dem heutigen Fenster, Kachelhöhe; bestellung 1440 zu breit, Datumsformat; produkte Chips 36 px, Stepper-Pille zu breit; produkt-neu Vorschau, Unterzeilen am Web.
- Nachfotos in B: bestellungen Bild 3 und produkte Bild 3 mit einem nicht freigeschalteten Hof; Admin-Zustände 2–6/7; Tastatur-Fokus der Blätter und Menüs.
- 256: Überschrift der Hof-Mail steht nicht in einem `<h1>` (Vorlage, → 255).

## Recht

- AGB 1.0 nach A005 gebaut (259): Wortgleichheit Zeichen für Zeichen (Test `agb-wortgleich`; ausgenommen „Kurz erklärt“ in der Mail-Datei, wie seit Nr. 207), Fassung 0.9 eingefroren, `src/lib/widerruf.ts` unverändert; Gegenlesen „Recht“ ohne Blocker. Fehler im AGB-Text: keiner. Beobachtung ohne Änderung: Anhang 1 sagt „nach der Lieferung“, Punkt 14.2 „nach der Übergabe“.
- Die Kasse weist im Hofpreis-Modell „Ware · Plattformgebühr · Gesamt“ getrennt aus (AGB 1.0 Punkt 10.2); das Board bestaetigung zeigt keine Gebührenzeile → Board-Korrektur.
- P1 (O9) und P2 unverändert offen.

## Regelvorschläge (Freigabe nötig; Prüfung vor Textregel)

1. **Laufzeit-Grenzen unter Last** (Grundlauf: `bild-format` 572 ms statt < 500 ms bei 3 Workern, allein grün): Zeitgrenzen in Leistungstests an die Worker-Zahl koppeln oder als eigener Lauf ohne Parallelität. Ort: TESTING_GUIDELINES.
2. **Prüf-Browser immer mit `--enable-features=OverlayScrollbar`** (243): sonst rechnet die Seite wegen `scrollbar-gutter: stable` mit 375 statt 390 px – betrifft vermutlich auch die Lauf-31-Bilder. Ort: docs/nachtlauf.md „Prüfwerkzeug“ (im Werkzeug schon so).
3. **Anzeige-Betrag mit eigener Funktion** (244): Ein Betrag, der vom Snapshot abweicht, bekommt eine Funktion mit JSDoc „nur Anzeige“ und eine Import-Wache gegen Server, API und Abrechnung. Ort: CODING_STANDARDS „Geld“.
4. **generateStaticParams ohne DB beim Bau** (259): Eine Seite mit `generateStaticParams` liest beim Bau nie ohne catch aus der Datenbank, vorher `connection()`. Ort: ARCHITECTURE §4 (steht schon bei „Rechtstext mit Fassungen“).
5. **Bestandslisten-Ordner** (245): `tests/bestandslisten/` in TESTING_GUIDELINES §1 nennen.
6. **Vorschau-Einhängepunkte je Nummer** (247): Der Test der Einhängepunkte prüft je Nummer nur deren eigene Datei, damit parallele Nummern nicht dieselbe Testzeile ändern (drei Merge-Konflikte in `bausteine-245.test.ts`).
7. **Mail im Zustand** (256): Eine Mail, die nur in einem Zustand passt, prüft ihn im Renderer und in `passtNochmal` über eine gemeinsame exportierte Regel.
8. **Checkbox-Baustein** (249): ein Kästchen-Baustein in `ui/` mit Token für beide Themes.
9. **Liste 3.2 berichtigen** (248): Die Zeilen „Fehlerkarte … → G5“ (Z. 401, 438, 528, 585, 601, 665, 720) meinen G6.
10. **Nachbesserung erst nach tester und pruefer** (Dirigent): Eine Runde im selben Worktree startet erst, wenn tester und pruefer fertig sind (248: tester sah einen Zwischenstand). Ort: docs/nachtlauf.md §4a Punkt 3.
11. **Zählungen ohne Schrägstrich in Doku** (Dirigent): eine Zählung „Dateien Schrägstrich Tests“ hielt die Telefonnummern-Wache für eine Nummer; Zählungen als „690 Dateien, 12968 Tests“. Ort: docs/nachtlauf.md §4a Punkt 7.
12. **Umsetzer prüfen Ergebnisse mit `set -o pipefail`** (245, 248): zweimal lief ein WIP-Commit trotz rotem Typecheck durch, weil `| tail` den Exit-Code schluckte. Ort: umsetzer-Rahmen bzw. sprint-Skill.

## Stabilität

- Rechner: 4 Kerne, 15 GB. Ein **Container-Neustart** (etwa 00:45 UTC) während 249; Wiederaufnahme nach §4a Punkt 12: Postgres neu, Sperren und laeufe/ geleert, keine Prüfreste, 249 ab seinen zwei WIP-Commits von einem neuen Umsetzer fortgesetzt; nichts verloren außer dem laufenden Agenten.
- Zeitbudget: Abschnitt A deutlich unter Plan (Start 19:59 UTC, alle Nummern bis 01:40 UTC im Zwischenstand; geplant war 249 frühestens in Stunde 9–12). Kein Phasenbudget überschritten; 243 lag mit zwei Nachbesserungsrunden knapp im Budget.
- Abweichungen: kurzzeitig sechs pruefer-ui gleichzeitig statt höchstens vier (Teil 2 des Zwischen-Durchgangs); kurzzeitig drei aktive Umsetzer-Aufrufe statt zwei (258 auf dem Platz von 243 vor dessen Blocker-Runden; Nachbesserungen von 246/247 neben 248) – Speicher blieb unkritisch; tester 248 lief parallel zu Runde 1 (Zwischenstand gesehen, wiederholt); pruefer-ui Admin mit 4 Agenten zu je 3 Boards statt einem je Board.
- Volle Läufe: n = 1 unter `schwer.lock`, 3 Worker; 200–415 s je Lauf.

## Aufräumen

Bestätigt um 02:15 UTC: keine Prüf-Server, keine Prüf-Browser, kein Passkey-Browser, kein dev-Worktree (`$HOME/nachtlauf32-dev` entfernt), Fotografen-Worktrees `foto-a1`/`foto-a2` entfernt; alle Prüf-DBs (`fz_p*`, `fz_za*`) und Integrations-DBs (`fz_int_*`) gelöscht; keine `pruef-env`, `admin-passkey*.json`, `pruef-links*.json`, Server-Logs oder `.next`-Kopien der Fotografen mehr in den Worktrees; Postgres-Protokoll (enthielt Statements der Messung von /konditionen) geleert. Es bleiben nur die Bilder unter `.nachtlauf/screens/`. Abschnitt B legt die Prüf-Umgebung neu an.

## Bilder

Im Container unter `/home/user/FarmerZone/.nachtlauf/screens/`: `243/admin/` (Admin-Erstabnahme), `245/r1/`, `246/r1/`, `247/r1/`, `248/r1/` (Vorschau und Beispiel-Routen der Bausteine), `zwischen-a/<board>/` (Zwischen-Durchgang A), `249/` (Bilder von 249 im Zwischen-Durchgang). Nicht committet.

## Wiederaufnahme

- Zwischenstand: `integration/lauf32` (Worktree /home/user/wt/int32, Stand im Zeitbuch); alle Nummern-Branches gepusht, Worktrees unter /home/user/wt/<nr> (im neuen Container nicht vorhanden – neu anlegen).
- Für B: `docs/nachtlauf/berichte/zeitbuch-lauf32.md` und `docs/nachtlauf/status.md` lesen, §0a ohne 243a erneut, Integrationszweig nach Haltepunkt A wählen, dann 252 ∥ 253.
- Aufträge der Seiten-Nummern stehen im Auftrag §36 (UMSETZUNG, Abschnitt B); die Bausteine G1–G14 liegen im Zwischenstand, die Seiten stellen Route für Route um (Varianten `form="zeile"`/`form="pille"`, Werkzeug-Kopf, Hinweiskasten, Toast nur im Geltungsbereich).
