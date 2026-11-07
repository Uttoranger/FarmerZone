# Morgenbericht Lauf 32 (Abschnitt B, 7.11.2026) · Seiten nach den Boards, Antworten der Projektleitung, Schluss-Durchgang

**Ergebnis Abschnitt B:** Alle Nummern von Abschnitt B sind gebaut, geprüft, gepusht und im Sammelstand `integration/lauf32b` zusammengeführt: Doku-Nummer 260 (Regelvorschläge 1–12 aus Morgenbericht 32 A, Register-Ergänzungen N1/N32/N46), 252 (Finden), 253 (Kauf und Konto), 249b (Abholzettel nach Antwort 8 und Mängel Hof-Alltag), 250 (Einstellungen und Teilen), 257 (Abholung nach Absprache), 255 (E-Mails), 251 (Hof-Werkzeuge), 258b (Admin: messbare Mängel), 254 (System und Rechtsrahmen). Keine Nummer entfallen, keine als Entwurf. Auf dem Sammelstand sind der volle Lauf (717 Dateien, 13351 Tests) und die Integrationstests ganz (98 Dateien, 798 Tests) grün. Keine Migration, kein Paket, keine neue Variable. Der Sammel-PR [#501](https://github.com/Uttoranger/FarmerZone/pull/501) ist **bereit** (Merge-Commit).
- Schluss-Durchgang: alle 49 Boards plus 12 Admin-Boards fotografiert (Fotografen A/B/C, 864 App- und 1127 Board-Bilder) und von pruefer-ui bewertet (9 Gruppen). Bilanz siehe Tabelle unten und `docs/nachtlauf/berichte/abnahme-lauf32.md`, Abschnitt „Schluss-Durchgang“.
- **Ziel „5 Sterne überall“ nicht erreicht.** Auf 5 in allen Fassungen: mehr-neu, einstellungen (dazu korb im Web). Deutlich besser als Schluss Lauf 31 u. a. heute (2 → 4), bestellungen (3·3·2·2 → 4), bestellung (2·2·3·3 → 4), druck (3 → 4), passwort/anmelden (3 → 4), kundenkonto (3·3·2·2 → 4), produkt-neu (2 → 3), auswertung/kunden/meldungen/beitraege/konto-hof/hofdaten-zahlung/whatsapp-plakat (2 → 3). Gleich oder schlechter: hoefe, region, verkaeufe (2), produkt (3 → 2·2·3·2 – Bildfläche und „je Raummeter“). Die Mängelliste ist vollständig; viele Mängel teilen wenige Ursachen (Abschnitt „Mängel – Ursachen“).

Verlauf: `docs/nachtlauf/berichte/zeitbuch-lauf32.md` (Abschnitt B). Bewertung je Board: `docs/nachtlauf/berichte/abnahme-lauf32.md` („Schluss-Durchgang“).

## Für dich zu tun

- [ ] **AGB 1.0 ist mit #490 schon auf main.** Der Hinweis aus Abschnitt A gilt weiter: Mit dem Stichtag sehen alle Höfe mit Fassung 0.9 die Karte „AGB 1.0 zustimmen“ (E-019); vorher sicherstellen, dass kein echter Hof freigeschaltet ist, der die Ankündigung noch nicht hat.
- [ ] **Merge:** Sammel-PR [#501](https://github.com/Uttoranger/FarmerZone/pull/501) `integration/lauf32b` → main nach Durchsicht per **Merge-Commit** (nicht Squash). Danach die Einzel-PRs #491–#500 schließen (ihr Inhalt ist dann auf main).
- [ ] **Für die Projektleitung am Tag T** (unverändert aus A005, nicht optional – die Notbremse am Vorabend sichert Bestellungen rund um Mitternacht ab, an denen Kassensatz (0.9) und Snapshot (1.0) auseinanderfallen könnten):
  - Generalprobe auf test.agrilo.at: Den Stichtag dort auf morgen setzen; der Admin erlaubt nur Tage in der Zukunft. Am Tag danach prüfen: /agb zeigt 1.0, eine Testbestellung hängt agb-<marke>-1.0.html an und verlinkt /agb/1.0, „Erneut bezahlen“ einer älteren Bestellung zeigt den alten Satz.
  - Vor T in der Produktion:
    - Stichtag im Admin setzen; er ist frei verschiebbar, bis er erreicht ist.
    - „Monate ohne Grundgebühr“ = 12 speichern und festschreiben.
    - Keinen echten Hof ohne Zustimmung zu 1.0 freischalten. Keinen um Zustimmung bitten, bevor er die Ankündigung per E-Mail mit 1.0 im Anhang hat.
  - Am Abend vor T: Admin › Notbremse von Hand setzen, spätestens um 23:29 Uhr (Wien), „bis“ 00:10 Uhr, Grund „Wartung“, Satz „Bestellen ist gerade kurz nicht möglich. Bitte versuch es nach Mitternacht wieder.“ Die Notbremse beginnt immer beim Speichern; einen späteren Start gibt es nicht. Wirkung: Bis Mitternacht verfällt jede vorher angelegte Online-Bestellung, die noch nicht bezahlt ist (30-Minuten-Frist). Über Mitternacht entsteht keine neue Bestellung. Bar angelegte Bestellungen bleiben im Modell bisher und bekommen 0.9, das ist richtig.
  - Nach 00:10 Uhr: /agb zweimal laden; es zeigt „Fassung 1.0 – gilt ab <T>“. Dazu /agb/0.9, /agb/1.0 und /konditionen (Stichtag, keine „Entwurf“-Marke).
  - In der Produktion keine Testbestellung, die als „abgeholt“ markiert wird (sonst zieht die Monatsabrechnung 6 % per echter Lastschrift ein). Wird doch eine gemacht: stornieren oder „nicht abgeholt“.
  - Nichts deployen.
- [ ] **Board-Korrekturen für die Design-Gruppe** (der Lauf ändert keine Datei unter docs/mockups/): aus deinen Antworten 5 (Kurznummer 6 Zeichen), 9 (Kasse 1440: Spaltenbreite, Rückweg-Symbol), 10 (Bestätigung im Hofpreis-Modell mit „Ware · Plattformgebühr · Gesamt“); neu aus dem Schluss-Durchgang: hoefe Bild 2 (390) ohne Reihenfolge-Satz – der Satz bleibt aus Rechtsgründen (§ 4a FAGG); einstellungen Statuspunkt zur Titelzeile; meine-bestellungen 390 ohne Fuß (kundenkonto zeigt ihn); passwort Bild 5 ohne „Für dein Agrilo-Konto.“ (Bild 3/4 mit); bestellung-link Frist mit Wochentag (V9, wie bei bestaetigung); kunden Bild 2 (Board einspaltig, Liste zweispaltig).
- [ ] **Vermutete echte Fehler aus dem Schluss-Durchgang** (nicht mehr gebaut, Stunde 8 und Schluss-Durchgang haben Vorrang):
  - Kurznummer der Meldungen erscheint auf /fehler-melden und /problem-melden (Danke-Seite) als 8 Zeichen klein geschrieben – entgegen deiner Antwort 5 (6 Zeichen) und G14 (Großbuchstaben).
  - Einstellungen › Zahlung: „Bis 1. Jänner 2028 zahlst du als Gründungshof …“, /settings sagt „Gründungshof bis 31. Dezember 2027“ (Ende exklusiv angezeigt?).
  - Admin › Heute: Postfach-Aufgabe „Nr. meldung-“ ohne Nummer; Admin-Bestelldetail sagt „Servicegebühr“, sonst „Plattformgebühr“.
  - Admin › Einstellungen › Gründungshöfe: „36 sind schon vergeben“ gegen „Vergeben 12“ (schon in A gemeldet).
  - Fehlerseite 500 bei DB-Ausfall ohne Seitentitel (axe document-title); /widerruf nach dem Absenden ohne h1.
- [ ] **Entscheidungen** (siehe Abschnitt unten).
- [ ] **Prüfungen, die der Container nicht kann:** Vercel-Vorschauen (Proxy) – die Adressen in der Nummern-Tabelle folgen dem Muster der Vercel-Kommentare und sind nicht aus dem Container geprüft; ersten CI-Lauf des Sammel-PR ansehen.
- [ ] **E-025:** AGB 1.0 nur sichtbar oder Stichtag vorziehen ist keine Code-Frage – es entscheidet allein der Stichtag-Wert im Admin.
- [ ] **P2:** Zahl der Gründungsplätze 12 (Boards) oder 100 (Register Nr. 116)? In Produktion steht gruendungPlaetze, sofern nicht geändert, auf dem Vorgabewert 12.
- [ ] **Startsätze:** „256 freigegeben“ und „Geld-Kachel-Regel bestätigt“ lagen in Abschnitt A vor; 256 und 258 sind gebaut (dass die Sätze in der Nachricht von B fehlten, ändert daran nichts).
- [ ] **Toast-Token:** Toast-Farben bleiben aus den vorhandenen Tokens (Antwort 6). Ein eigenes Toast-Token gibt es nur mit deiner ausdrücklichen Freigabe; ebenso ein Checkbox-Token (Regelvorschlag 8, offen).
- [ ] **Aufräumen auf GitHub (nur du):** PRs #466, #467, #468, #469, #476 schließen, Zweig `nacht/2026-11-05/242-basis` löschen; nach dem Merge von #501 die PRs #479–#489 (falls noch offen) und #491–#500 schließen.
- [ ] **P1 an die Anwältin (O9):** Rücktritts-Zeile je Produkt, die zwei Sätze in der Storno-Mail, Platzhalter in der Belehrung auf /widerruf. Neu dazu: Hof-Mail zum Rücktritt (Satz ohne § 18 FAGG, Einleitung mit Namen – B-Zeilen mail-hof-bestellung, nicht gebaut, Rücktritts-Wortlaut).
- [ ] **Admin-Mängelliste** für eine Admin-Board-oder-Code-Runde: abnahme-lauf32.md „Schluss-Durchgang“, Admin-Gruppen (Aufbau und Wortlaut; die sechs Messpunkte sind auf den in A gemessenen Seiten behoben, neue Funde: Postfach 3/4 und Startseite 2/4 unter 12 px, Felder ohne Beschriftung in Startseite 2 und Geld-Dialog, „KI“-Pille 39 px, Mail-Tabelle 16 px hohe Links).
- [ ] **Regelvorschlag Produkt-„Nochmal“** (aus A): weiter offen, nicht gebaut.
- [ ] **Backlog:** Beispiel-Domain `beispiel.at` prüfen; Seed-Telefonnummer des Beispielhof-Inhabers (prisma/seed-daten.ts, Inhaber des Beispielhofs, nicht aus Lauf 32) – Musternummer, aber nicht genullt wie die übrigen; prüfen, ob sie genullt werden soll.
- [ ] **Container:** Der Ordner `/home/user/wt/schluss2/.nachtlauf/fotograf/` war vom Fotografen per Hook nicht löschbar; er wird mit `git worktree remove --force` beim Aufräumen entfernt (siehe Aufräumen).

## Entscheidungen und Fragen

- **Hof-E-Mail auf Hofdaten** (250, Board hofdaten-zahlung): Die App zeigt ein Feld „Hof-E-Mail“ mit Hinweis auf die Rücktrittsbelehrung, das Board nicht. Register/Recht (R) oder Board-Fehler?
- **„hat gerade kein <Produkt>“** (252, Wortlaut der Liste): passt bei weiblichen Produktnamen nicht („kein Milch“) – Wortlaut ändern?
- **Abholzettel, Annahme 249b:** „Nichts zu kassieren“ gilt auch für stornierte Bestellungen ohne gesetzte Gebühren-Erstattung (Altbestand) – so gewollt?
- **Packliste** (249b): behält „Preise inkl. Plattformgebühr.“ über Positionen ohne Gebühr – Board-Korrektur oder Nacharbeit (Anzeige wie Abholzettel „Gesamt inkl. …“)?
- **Breite /onboarding** (253): Liste 1200 px, Board 896 px Inhalt.
- **Mail im Hofpreis-Modell bei entfallener Gebühr** (255): Kasten „Bring bitte … mit“ entfällt (nur Admin-Vorschau, Bestellung ist dann storniert/nicht abgeholt) – so gewollt?
- **h1 = 0 bei offenem Dialog/Blatt** (Messung): Die Messung zählt die h1 hinter dem Overlay nicht; pruefer-ui werteten das unterschiedlich. Vorschlag: nicht als Mangel (Regelvorschlag 5).

## Nummern

| Nr. | Inhalt | Status | PR | Vorschau (Muster) | Migration | Weggelassen und warum |
|---|---|---|---|---|---|---|
| 260 | Doku: Regelvorschläge 1–12 (Morgenbericht 32 A), Register-Ergänzungen N1/N32/N46 | fertig | [#491](https://github.com/Uttoranger/FarmerZone/pull/491) | – (nur Doku) | nein | Vorschlag 1 und 8 (brauchen Code) |
| 252 | Finden: startseite, hoefe, hofseite, produkt | fertig, 1 Runde | [#492](https://github.com/Uttoranger/FarmerZone/pull/492) | farmer-zone-git-nacht-2026-11-06252-finden-bierbaron.vercel.app | nein | Regionskarte Zoom/Pins (Kartenquelle, NICHT); Merkmal-Kacheln (Seed); P1-Zeile |
| 253 | Kauf und Konto (9 Boards), Zahlzeile, /account/login ohne Pille, Meine Bestellungen bei Storno | fertig, 1 Runde | [#493](https://github.com/Uttoranger/FarmerZone/pull/493) | farmer-zone-git-nacht-2026-11-06253-kauf-konto-bierbaron.vercel.app | nein | Einrichten-Texte (lib/einrichten.ts u. a.), Korb-Hinweis (lib/reservierung.ts) – außerhalb der Grenze |
| 249b | Abholzettel „Nichts zu kassieren“/„Zu kassieren“ (Antwort 8), Mängel Hof-Alltag | fertig | [#494](https://github.com/Uttoranger/FarmerZone/pull/494) | farmer-zone-git-nacht-2026-11-06249b-hof-alltag-nach-bierbaron.vercel.app | nein | Packlisten-Satz, Stepper-Pille (ui/), Verkaufsgrößen-/Holz-Karte |
| 250 | Einstellungen und Teilen (6 Boards), /settings „‹ Mehr“ (Antwort 1), Abholzeiten-Satz (Antwort 4) | fertig, 2 Runden | [#496](https://github.com/Uttoranger/FarmerZone/pull/496) | farmer-zone-git-nacht-2026-11-06250-einstellungen-bierbaron.vercel.app | nein | Angemeldete Geräte (components/konto), Titelbild/Galerie-Wahl (neue Upload-Regel) |
| 257 | Abholung nach Absprache (N47) | fertig | [#495](https://github.com/Uttoranger/FarmerZone/pull/495) | farmer-zone-git-nacht-2026-11-06257-absprache-bierbaron.vercel.app | nein | – |
| 255 | E-Mails: Mail-Gesamt, Abholbereit ohne Nachbestell-Link (Antwort 8), h1, Textdateien | fertig, 1 Runde | [#497](https://github.com/Uttoranger/FarmerZone/pull/497) | farmer-zone-git-nacht-2026-11-06255-mails-bierbaron.vercel.app | nein | 33 von etwa 47 B-Zeilen (Texte unter src/lib, Auth, P2, Rücktritts-Wortlaut) |
| 251 | Hof-Werkzeuge (7 Boards), Gebühr je Zeitraum | fertig, 1 Runde | [#498](https://github.com/Uttoranger/FarmerZone/pull/498) | farmer-zone-git-nacht-2026-11-06251-hof-werkzeuge-bierbaron.vercel.app | nein | Region nebeneinander, Futterkarte; Dateien außerhalb der Grenze (queries/customers, schemas) |
| 258b | Admin: messbare Mängel, Kachel-Wort „Bestellwert“ (Antwort 3) | fertig | [#499](https://github.com/Uttoranger/FarmerZone/pull/499) | farmer-zone-git-nacht-2026-11-06258b-admin-maengel-bierbaron.vercel.app | nein | Aufbau und Wortlaut des Admins (nur Liste) |
| 254 | System und Rechtsrahmen (7 Boards), /agb-Link ≥ 44 px | fertig | [#500](https://github.com/Uttoranger/FarmerZone/pull/500) | farmer-zone-git-nacht-2026-11-06254-system-bierbaron.vercel.app | nein | problem-melden-Zeilen in den Meldungs-Bausteinen (251), Hof-Fehlerseite, Pfeil im Kunden-Kopf |
| Sammel 32b | `integration/lauf32b` → main | bereit | [#501](https://github.com/Uttoranger/FarmerZone/pull/501) | farmer-zone-git-integration-lauf32b-bierbaron.vercel.app | **nein** | – |

**Geld:** Keine Geldberechnung, kein gespeicherter Betrag, keine bestehende Geld-Testerwartung aufgeweicht. Neu sind nur Anzeige-Hilfen: `zahlzeileFuer`/`barBestaetigenZahlzeile` (253, Satz nur aus dem Snapshot), `druckKasse` (249b, nur Titel), `kundenPositionen`/`kundenGebuehr` (255, Mail im Hofpreis-Modell bei entfallener Gebühr), `gebuehrenKarteFuerZeitraum` und die lesende Abfrage `getServicegebuehrenZeitraum` (251, dieselbe Regel wie die Abrechnung). Pflicht-Gegenlesen „Geld“ (249b, 251, 253, 255) und „Daten“ (257) je im PR-Text; drei Gegenlese-Befunde wurden als Blocker in Runden behoben (253 Rückfall auf 6 %, 255 inkl.-Satz bei entfallener Gebühr, 251 Gebühren-Karte nach dem gewählten Zeitraum).

## Merge-Reihenfolge

**Gestapelte PRs per Merge-Commit mergen, nicht per Squash.**

1. Sammel-PR [#501](https://github.com/Uttoranger/FarmerZone/pull/501) `integration/lauf32b` → main (Merge-Commit). Er enthält 260, 252, 253, 249b, 250, 257, 255, 251, 258b, 254 in dieser Folge, jeweils per `--no-ff`.
2. Danach #491–#500 schließen.

## Recht

- Kein Recht-Wortlaut geändert: Diff auf `src/lib/rechtstexte/**`, `src/lib/widerruf.ts`, `src/lib/konditionen.ts`, `docs/recht/**` im ganzen Abschnitt B leer (254 und 255 je gegengeprüft; 255 belegt die Rechtsblöcke der Mails mit einem byteweisen Render-Vergleich).
- Reihenfolge-Satz (§ 4a FAGG) auf /hoefe steht wieder in jeder Ergebnisansicht, auch am Handy (252 Runde 1); das Board hoefe Bild 2 (390) zeigt ihn nicht → Board-Korrektur.
- Kasse im Hofpreis-Modell mit „Ware · Plattformgebühr · Gesamt“ (AGB 1.0 Punkt 10.2): Register gilt (Antwort 10).
- Offen für die Anwältin (P1/O9): siehe „Für dich zu tun“; Hof-Mail zum Rücktritt neu dazu. P2 unverändert offen.
- Feld „Hof-E-Mail“ mit Rücktritts-Hinweis auf Hofdaten: Frage oben.

## Regelvorschläge (Freigabe nötig; Prüfung vor Textregel)

1. **Uhrzeit nie schätzen** (Dirigent): Zeitbuch-Einträge nehmen die Uhrzeit aus `date -u` bzw. der Commit-Zeit; in B standen drei Stunden lang geschätzte, zu späte Zeiten (berichtigt). Ort: docs/nachtlauf.md §4a Punkt 12 (g).
2. **Commit-Kurzwerte in der Doku mit 12 Zeichen** (Dirigent): Ein achtstelliger Kurzwert aus reinen Ziffern hielt die Telefonnummern-Wache für eine Nummer. Ort: docs/nachtlauf.md §4a Punkt 7.
3. **agent-browser immer mit eigener Sitzung** (Fotografen A/B): Ohne `--session` landen Befehle in der gemeinsamen Sitzung „default“, die an einem fremden Prüf-Browser hängen kann (B lenkte kurz den Tab von 254). Prüfung: `seiten-bild.sh`/`board-bilder.sh` brechen ohne Sitzungsnamen ab. Ort: scripts/pruefung, docs/nachtlauf.md „Prüfwerkzeug“.
4. **Prüf-Seed vervollständigen** (252, 251, 250, Fotografen): Größen-Familie, Brennholz in Raummeter mit Holzangaben, Postfach-Nachrichten und Rundschreiben, Abonnentin mit WhatsApp, Hof mit Mindestbestellwert, offene Bar-Bestellung im Hofpreis-Modell, Hof ohne Produkte im Zustand „wartet auf Freigabe“ – viele Board-Bilder waren sonst „nicht herstellbar“. Ort: scripts/pruefung/pruef-seed.ts (Nummer mit Grenze scripts/pruefung).
5. **Messung: h1 hinter offenen Dialogen nicht zählen, Inhalte geschlossener `<details>` ausnehmen** (258b, pruefer-ui): `messung.js` mit `checkVisibility` und Ausnahme für `aria-modal`-Overlays. Ort: scripts/pruefung/messung.js.
6. **Prüf-Browser mit `--lang=de-AT`** (pruefer-ui Admin): Datumsfelder erschienen im US-Format. Ort: docs/nachtlauf.md „Prüfwerkzeug“ Punkt 4 und Skripte.
7. **Integrationstests bei geänderten Texten** (250): Ändert eine Nummer ohne Integrationsauftrag einen Text, den ein Integrationstest erwartet (`git grep` des alten Wortlauts in tests/integration), läuft sie diese Integrationstests. Ort: docs/nachtlauf.md §4a Punkt 2.
8. **Kein leerer Abschluss-Commit** (251): Ein Umsetzer schloss mit einem leeren Commit nach dem letzten WIP ab, damit der letzte Commit kein WIP ist; besser: letzter WIP mit vollem Lauf als normaler Commit (`git commit --amend` ist erlaubt, solange nicht gepusht). Ort: docs/nachtlauf.md §4a Punkt 2.
9. **Aufräumen von `.nachtlauf/fotograf/` über `git worktree remove`** (Fotograf C): Der Hook blockt `rm -rf` im Projektbaum; Fotografen in eigenen Worktrees räumen über den Worktree ab. Ort: docs/nachtlauf.md „Prüfwerkzeug“ Punkt 6.
10. **Admin-Schrift-Wache** (258b): Wache „keine Schriftgröße unter 12 px (`text-[10px]`, `text-[11px]`) unter src/app/admin und src/components/admin“ mit Bestandsliste. Ort: tests/.

## Stabilität

- Rechner: 4 Kerne, 15 GB. **Kein Container-Neustart** in B.
- Zeitbudget: Start 08:19 UTC; alle Nummern bis 13:20 im Sammelstand (letzte Nummer 254 gestartet 12:42, Stunde 4,4 – vor Stunde 8). Kein Phasenbudget überschritten (je Nummer 45–70 min Umsetzung). Schluss-Durchgang 12:50–(Ende siehe Zeitbuch), unter 5 h.
- Grenzen eingehalten: höchstens zwei Umsetzer gleichzeitig; ein schwerer Befehl gleichzeitig (flock); höchstens drei Prüf-Server (254 + Fotografen A und B, danach B und C); höchstens vier pruefer-ui gleichzeitig.
- Abweichungen: Schluss-Durchgang Teil 1 begann auf dem Stand ohne 254 (254 ändert keine Datei der übrigen Boards), die 254-Boards folgten mit eigenem Bau auf dem Sammelstand; zwei Doku-Commits des Dirigenten mit Fehlern (geschätzte Uhrzeiten; ein Commit mit roter Telefonnummern-Wache – sofort berichtigt, siehe Zeitbuch).
- Volle Läufe des Dirigenten: n = 1 unter schwer.lock, 3 Worker, 232–377 s; Integration ganz 383–390 s.

## Ergebnis-Tabelle (Schluss Lauf 31 → Schluss-Durchgang Lauf 32)

Fassungen: 390 hell · 390 dunkel · 1440 hell · 1440 dunkel (Mails 390 · 600, Druck nur hell). Begründung je Abweichung: abnahme-lauf32.md, „Schluss-Durchgang“.

| Board | Nummer(n) | Schluss Lauf 31 | Schluss-Durchgang 32 | Nummer abgeschlossen | Mängel (Rest gedeckt durch Liste/Auftrag) |
|---|---|---|---|---|---|
| startseite | 252 | 2·2·2·2 | 3·3·3·3 | ja | 6 |
| hoefe | 252 | 2·2·2·2 | 2·2·3·3 | ja | 7 |
| hofseite | 252 | 3·3·4·4 | 3·3·4·4 | ja | 6 |
| produkt | 252 | 3·3·3·3 | 2·2·3·2 | ja | 7 |
| korb | 253 | 4·4·3·3 | 3·3·5·5 | ja | 3 |
| region | 251 | 2·2·2·2 | 2·2·2·2 | ja | 7 |
| kasse | 253 (259) | 5·5·5·4 | 4·4·4·4 | ja | 2 |
| bestaetigung | 253 (244) | 3·3·3·3 | 4·4·4·4 | ja | 2 (Zahlzeile „Online · Bezahlt“/„Noch offen“: Seed-Bestellungen im Modell „bisher“ → bisherige Zahlzeile nach Auftrag, vom Dirigenten als gedeckt gewertet) |
| bestellung-link | 253 (244) | 4·4·4·3 | 4·4·4·4 | ja | 1 (Zahlzeile wie bei bestaetigung gedeckt) |
| anmelden | 253 (247) | 3·3·3·3 | 4·4·4·4 | ja | 3 |
| passwort | 253 | 3·3·3·3 | 4·4·4·4 | ja | 2 |
| registrieren | 253 | 2·2·2·2 | 3·3·3·3 | ja | 9 |
| heute | 249, 249b | 2·2·2·2 | 4·4·4·4 | ja | 6 |
| bestellungen | 249, 249b | 3·3·2·2 | 4·4·4·4 | ja | 4 |
| bestellung | 249, 249b, 257 | 2·2·3·3 | 4·4·4·4 | ja | 1 |
| druck | 249, 249b | 3·–·3·– | 4·4 (nur hell) | ja | 1 |
| produkte | 249, 249b | 3·3·3·3 | 3·3·4·4 | ja | 6 |
| produkt-neu | 249, 249b | 2·2·2·2 | 3·3·3·3 | ja | 6 |
| auswertung | 251 | 2·2·2·2 | 3·3·3·3 | ja | 9 |
| kunden | 251 | 2·2·2·2 | 3·3·3·3 | ja | 11 |
| verkaeufe | 251 | 2·2·2·2 | 2·2·2·2 | ja | 12 |
| postfach | 251 | 2·2·3·3 | 3·3·4·4 (nur Leerzustand prüfbar) | ja | 2 |
| meldungen | 251 | 2·2·2·2 | 3·3·3·3 | ja | 9 |
| mein-hof | 251 | 2·2·2·2 | 3·3·2·2 | ja | 14 |
| mehr-neu | 249 | 5·5·4·3 | 5·5·5·5 | ja | 0 |
| meine-bestellungen | 253 | 3·3·3·3 | 3·3·3·3 | ja | 5 |
| kundenkonto | 253 | 3·3·2·2 | 4·4·4·4 | ja | 4 |
| mail-kauf | 255 (257) | 3·–·3·– | 3·3 (390·600 hell) | ja | 4 |
| mail-storno | 255 | 3·–·3·– | 3·3 (390·600 hell) | ja | 3 |
| mail-hof-bestellung | 255 (256) | 3·–·3·– | 3·3 (390·600 hell) | ja | 3 |
| mail-betrieb | 255 | 2·–·2·– | nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten) | ja | – |
| mail-hof-konto | 255 | 3·–·3·– | nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten) | ja | – |
| mail-neuigkeiten | 255 | 3·–·3·– | nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten) | ja | – |
| mail-sicherheit | 255 | 3·–·3·– | nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten) | ja | – |
| mail-team | 255 | 3·–·3·– | nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten) | ja | – |
| mail-zugang | 255 | 3·–·3·– | nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten) | ja | – |
| abmelden | 254 | 3·3·3·3 | 4·4·4·4 | ja | 2 |
| neuigkeiten | 254 | 4·4·4·4 | 3·3·3·3 | ja | 4 |
| rechtstexte | 254 (259) | 3·3·3·3 | 4·4·4·4 | ja | 3 |
| problem-melden | 254 (251) | 3·3·2·2 | 2·2·2·2 | ja | 10 |
| abmelden | 254 | 3·3·3·3 | 4·4·4·4 | ja | 2 |
| neuigkeiten | 254 | 4·4·4·4 | 3·3·3·3 | ja | 4 |
| systemseiten | 254 | 3·3·3·3 | 5·5·4·4 (Bilder 1–4 nicht prüfbar) | ja | 1 |
| widerruf | 254 | 3·3·3·3 | 3·3·3·3 (Bild 5 nicht prüfbar) | ja | 6 |
| rechtstexte | 254 (259) | 3·3·3·3 | 4·4·4·4 (Wortlaut, Stichtag, P2 nicht gewertet) | ja | 3 |
| fehlerseiten | 254 | 3·3·3·3 | 3·3·3·3 (Bild 1 nicht wertbar, Bild 6 global-error) | ja | 6 |
| problem-melden | 254 (251) | 3·3·2·2 | 2·2·2·2 | ja | 10 |


Admin (nicht im 5-Sterne-Kriterium): heute, shell, höfe, akte, bestellungen, postfach, startseite, geld, betrieb je 3·3·3·3; freischalten, einstellungen, zugang 4·4·4·4. Die sechs Messpunkte aus der Erstabnahme sind behoben (258b); neue Messfunde siehe „Für dich zu tun“.

## Offen (für einen nächsten Lauf, je Nummer im Bericht)

- G11 Seitenfuß der Kundschaft (`kunde-fuss.tsx`): Breite im Web, Lage von „Vertrag widerrufen“ – in B in keiner Grenze; betrifft 13 Boards.
- G12 Bildfläche statt Kategorie-Illustration und „je Raummeter“ (E11) auf hofseite, produkt, korb, hoefe, region.
- Meldungs-Bausteine für die Kundschaft nach Board problem-melden (Kartenhöhe, Zähler, Beschriftungen, Bildschirmfoto-Feld, Satz bei Hof-Sitzung); Kurznummer der Meldungen auf 6 Zeichen groß.
- Einstellungsseiten 1440 auf 671 px; konto-hof Angemeldete Geräte (`src/components/konto`), Felder 10 px; teilen-Kopfleiste 1440; beitraege ohne Karte, Schrittzeiger über volle Breite.
- registrieren /onboarding (G1, G3, Orange auf dem ersten offenen Schritt, Texte in `einrichten.ts`/`konditionen.ts`/`fuer-hoefe.ts`), Einrichten-Breite (Frage).
- region: Liste und Karte nebeneinander, Futterkarte mit Größenwahl; mein-hof: Kopf klebend, Gruppen ab lg; verkaeufe: Dialog, „Eintragen“ nie deaktiviert (G6).
- Mails: 33 offene B-Zeilen (Texte unter src/lib, Auth, P2, Rücktritt); Positionszeile G14 in Mails; Mail-Vorschau für Codes, Betreiber-Mails, Rundschreiben und Beiträge fehlt (6 Mail-Boards „nicht prüfbar“).
- Nacharbeit aus den Prüfungen (je PR): 255 Kommentar in `email.ts` und Test „Bitte zahle … mit Karte“; 251 zwei Knopf-Rundungen der Kundschaft auf /problem-melden, `LadeFehlerKasten` als ui-Variante, unbenutztes `kanal-symbol.tsx`; 252 tote Exporte in `src/lib/startseite.ts`, `vorschau-247.tsx` „folgt mit Nr. 252“; 254 `rounded-[12px]` statt RUNDUNG an fünf Stellen, Datumshelfer nach `src/lib/format.ts`; 249b Funktion `druckKasse` nach `src/lib/hof-bestellungen.ts`; 258b weitere Admin-Stellen < 12 px.
- Bestandslisten (Endstand, nur geschrumpft): rundungen 158 → 120, unterseiten-kopf 20 → 3 (Dateien bleiben, Liste nicht leer), kind-selektoren 22 → 21, startfokus 2 → 1.

## Bilder

Im Container: `/home/user/FarmerZone/.nachtlauf/screens/` – je Nummer `<nr>/` (Bilder der Umsetzer), `schluss/<board>/` (Schluss-Durchgang mit INDEX.md und Messwerten), `b-start/` (§0a). Nicht committet.

## Aufräumen

Bestätigt um 14:17 UTC: keine Prüf-Server, keine Prüf-Browser, kein Passkey-Browser, kein dev-Worktree (`$HOME/nachtlauf32-dev` entfernt); alle Prüf-Worktrees der Fotografen (`wt/schluss`, `wt/schluss2`) und der Nummern (`wt/260`, `252`, `253`, `249b`, `250`, `257`, `255`, `251`, `258b`, `254`) mit `git worktree remove --force` entfernt – damit auch der von Fotograf C nicht löschbare Ordner `.nachtlauf/fotograf/`; alle Prüf-DBs (`fz_p*`, `fz_ps*`) und Integrations-DBs (`fz_int_*`) gelöscht; keine `pruef-env`, `admin-passkey*.json`, `pruef-links*.json`, Serverprotokolle oder `.next`-Kopien mehr; Postgres-Protokoll geleert; laeufe/ leer. Es bleiben nur die Bilder unter `/home/user/FarmerZone/.nachtlauf/screens/` und der Worktree des Sammelstands (`/home/user/wt/int32b`).
