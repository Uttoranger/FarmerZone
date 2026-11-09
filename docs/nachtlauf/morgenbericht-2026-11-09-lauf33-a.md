# Zwischen-Morgenbericht Lauf 33, Abschnitt A (8./9.11.2026) · Ursachen und echte Fehler

**Ergebnis Abschnitt A:** Fertig, geprüft und gepusht sind 261 (Doku), 262 (Prüfwerkzeug 2), 263 (Kurznummer), 264 (Ende der Gründungszeit) und 266 (kleine echte Fehler). Alle fünf liegen im Zwischenstand `integration/lauf33`. Der volle Lauf darauf ist grün (726 Dateien, 13456 Tests), die Integrationstests ganz auch (99 Dateien, 804 Tests). Keine Migration, kein Paket, keine neue Variable. **Nicht fertig:** 267 und 269 brachen gegen 21:05 UTC mitten in der Arbeit ab, weil das Wochenlimit der API erreicht war; 267 ist als WIP gesichert und gepusht (Arbeitsstand voll grün, ohne PR); 269 war rot (6 von 13471 Tests) und ist nach §5 nur lokal als WIP-Commit gesichert, nicht gepusht – in einer neuen Sitzung ist dieser Stand nicht mehr da. 265, 270 und 268 haben nicht begonnen → verschoben nach B. Der Sammel-PR ist als **Entwurf** offen: [#508](https://github.com/Uttoranger/FarmerZone/pull/508).

**Ordnungsgemäß beendet:** ja, mit der Einschränkung oben: Haltepunkt A, gekürzter Zwischen-Durchgang, Aufräumen bestätigt, Sammel-PR als Entwurf. **Ziel erreicht (5 Sterne):** in Abschnitt A nicht wertbar; die Gegenprobe mehr-neu bleibt bei 5 Sternen in allen vier Fassungen.

## Für dich zu tun

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
- [ ] **Gründungsplätze in Produktion auf 100 stellen** (Admin › Einstellungen › Gründungshöfe; „Plätze nur erhöhen“ lässt 12 → 100 zu), bevor eine Seite in Produktion eine Platzzahl nennt und vor jeder Werbung mit einer Zahl (sonst entsteht nachträglich künstliche Knappheit), spätestens vor dem ersten Festschreiben.
- [ ] **Die Gründungszusagen vor dem 1.1.2028 festschreiben**, sonst beginnt der Bar-Einzug der Gründungshöfe am 1.1.2028 statt am 1.2.2028 (K2/N44).
- [ ] **Musternummer:** Die Entwicklungsdatenbank trägt die alte Musternummer des Pilothof-Inhabers bis zum nächsten Seed. Bitte lesend prüfen, ob die alte Musternummer auch in Produktion steht (der Lauf ändert nichts).
- [ ] **„Nachtlauf 33 fortsetzen“** für Abschnitt B (in einer neuen Sitzung), danach noch einmal für C.
- [ ] **Merge:** erst am Ende von C (Sammel-PR per **Merge-Commit**, nicht Squash). Bis dahin bleiben die Einzel-PRs #503–#507 offen. Nach dem Merge die PRs aus Lauf 32 (laut Morgenbericht 32 B: #466–#469, #476, #479–#489, #491–#500, Zweig nacht/2026-11-05/242-basis) und aus Lauf 33 schließen.
- [ ] **Board-Korrekturen für die Design-Gruppe:** die Ergänzungsliste (docs/nachtlauf/berichte/lauf33-ergaenzungen.md); neu aus dem Zwischen-Durchgang: Hof-Kürzel in w1-mehr-neu einstellig „M“, s1 zweistellig „FM“, die App zeigt „HM“ – Vorschlag C-Zeile.
- [ ] **Prüfungen in der Vorschau**, die der Container nicht kann (Vorschau-Adressen sind aus dem Container nicht erreichbar).
- [ ] **P1 an die Anwältin** samt Hof-Mail zum Rücktritt („§ 18 FAGG“-Satz, Einleitung).

## Entscheidungen und Fragen

- **Toast-Token:** bleibt draußen (kein Regelvorschlag); nur mit deiner ausdrücklichen Freigabe.
- **ONLINE_ZAHLUNG_EINRICHTEN_SATZ** (Freigabe §10 „24“) gegen den Satz mit Google Pay im Board (heute Bild 4, registrieren Bild 5): Der Lauf ändert ihn nicht. Board oder Code?
- **Karte „Deine Bestellung“ in der Kasse** (Vertragspartner, Gewährleistung, § 4a FAGG) bleibt, wo sie ist – Frage für Recht.
- **/api/triage/status und CLI-Export** (src/lib/briefkasten-export.ts) nutzen weiter die alte achtstellige Kurznummer (Sperrzone /api). Beide passen zueinander; Anzeige und Admin-Suche nutzen die neue. Sollen auch sie auf die neue Nummer umziehen?
- **Seitentitel der 500 ohne `[TEST]`-Vorsatz** (266): Der Auftrag nennt „Fehler — <Marke>“; in Vorschau und Entwicklung ist die 500 damit der einzige Tab ohne „[TEST]“. Vorsatz ergänzen?
- **Startseite: Platzhalter gegen Illustration** – erst mit 271 in B relevant.
- **/widerruf: Feld und Anschrift** – erst mit 279 in B.
- **Bildfläche statt Illustration:** Der Startsatz fehlte in der Nachricht vom 8.11.2026; es gilt Register I1/N22, kein N49.

## Nummern

| Nr | Inhalt | Status | PR | Vorschau | Migration | Weggelassen / offen |
|---|---|---|---|---|---|---|
| 261 | Doku: Freigabe §37, N48, Ergänzungsliste, Warteschlange, Zeitbuch | fertig | [#503](https://github.com/Uttoranger/FarmerZone/pull/503) | Vercel-Vorschau des PR | nein | ohne N49 (Startsatz fehlt) |
| 262 | Prüfwerkzeug 2 | fertig | [#506](https://github.com/Uttoranger/FarmerZone/pull/506) | Vercel-Vorschau des PR | nein (nur prisma/seed-daten.ts, eine Zeile) | `db-aus` erzeugt die 500 statt des Ladefehler-Kastens (der Kasten braucht einen Teilausfall); DEVELOPMENT.md-Eintrag (Grenze) |
| 263 | Kurznummer überall gleich | fertig | [#507](https://github.com/Uttoranger/FarmerZone/pull/507) | Vercel-Vorschau des PR | nein | /api/triage und CLI-Export bei der alten Nummer (Frage); Beispiel „AB12“ in bausteine-vorschau.tsx |
| 264 | Ende der Gründungszeit in der Anzeige | fertig | [#504](https://github.com/Uttoranger/FarmerZone/pull/504) | Vercel-Vorschau des PR | nein | – |
| 265 | Gründungsplätze aus der Einstellung, eine Zählregel | verschoben nach B | – | – | – | nicht begonnen |
| 266 | Kleine echte Fehler | fertig | [#505](https://github.com/Uttoranger/FarmerZone/pull/505) | Vercel-Vorschau des PR | nein | Wort-Test grün → kein Fix (U: Seed-Bestellungen „bisher“) |
| 267 | Kunden-Bausteine G11, G10 | WIP (gesichert) | – | – | nein | Abbruch durch das Wochenlimit; läuft in B zuerst weiter |
| 268 | Meldungen | verschoben nach B | – | – | – | nicht begonnen |
| 269 | Hof-Bausteine und Kästchen-Baustein | WIP (nur lokal, rot) | – | – | nein | Abbruch durch das Wochenlimit; Arbeitsstand rot (admin-knopf-kontrast, bausteine-verzeichnis, docs-pfade-wache, ladeansichten, meldungen-ki-knoepfe) → nicht gepusht; in B neu von vorn |
| 270 | Mail-Vorschau mit Beispieldaten | verschoben nach B | – | – | – | nicht begonnen |

Echte Fehler, je mit einem Test, der vorher rot war (Namen und Ausgaben in den PR-Texten): 263 `tests/kurznummer-ueberall.test.ts`; 264 `tests/gruendung-ende-anzeige.test.ts`; 266 `tests/fehlerseite-titel.test.ts` und `tests/widerruf-eingang-h1.test.ts`. 266 Wort-Test im Admin-Bestelldetail: Code richtig, kein Fix (U). 265 (36 gegen 12) ist noch offen.

## Merge-Reihenfolge

Sammel-PR `integration/lauf33` → main am Ende von C per **Merge-Commit** (nicht Squash). Im Zwischenstand sind in dieser Reihenfolge per `--no-ff` gemergt: 264 (#504), 266 (#505), 262 (#506), 263 (#507); 261 (#503) ist die Basis. Die Einzel-PRs sind gestapelt (#504 und #506 auf `docs/lauf33`, #505 und #507 auf `integration/lauf33`) und dienen der Durchsicht.

## Geld

- **264:** Anzeige „bis <Tag>“ nennt jetzt den letzten freien Tag (einen Tag früher als vorher); Einzug, Abrechnung, Ankündigung und jede Geldberechnung unverändert. Gegenlesen „Geld“ ohne Blocker (PR #504).
- „Stellt die Projektleitung die Plätze in Produktion von 12 auf 100, werden freigeschaltete Höfe ab Platz 13 Gründungshof (ohne Grundgebühr, Bargebühr erlassen bis zum Gründungs-Ende) – so gewollt (E-026).“
- 265 (eine Zählregel für „vergeben“) ist noch nicht gebaut.

## Recht

- 266: `src/lib/widerruf.ts`, `src/lib/rechtstexte/` und `docs/recht/` ohne Diff; nur das Element der Überschrift auf /widerruf. Gegenlesen „Recht“ ohne Blocker (PR #505).
- `git diff --name-only origin/main...integration/lauf33 -- src/lib/widerruf.ts src/lib/rechtstexte/ docs/recht/`: leer.

## Regelvorschläge (Freigabe nötig; Prüfung vor Textregel)

1. **Leistungstests ohne Parallelität** (262, A-1): Die Grenze × maxWorkers macht bild-format und sentry-hygiene-felder im Normallauf lockerer (3 Worker → 1500 ms statt 500 ms); sie fangen den Fehler, gegen den sie geschrieben wurden, dann nicht mehr sicher. Vorschlag: Leistungstests als eigener Lauf mit einem Worker und fester Grenze. Ort: TESTING_GUIDELINES §4, vitest-Konfiguration.
2. **Blätter mit `aria-modal="true"`** oder Messung auf `role="dialog"` erweitern: Das Mehr-Blatt trägt nur `role="dialog"`, die Messung aus 262 meldet deshalb h1 0 statt „Dialog offen“. Prüfung: Messung zählt auch sichtbare `role="dialog"`; oder Wache, dass jedes Blatt `aria-modal` trägt. Ort: scripts/pruefung/messung.js bzw. ui/blatt.
3. **Nachbesserung erst nach dem Ende von tester und pruefer** (Dirigent, zweimal in diesem Lauf verletzt, 263 und 266; schon Regel für mich seit Lauf 32): als Prüfung im Skript des Dirigenten (Sperre je Worktree), nicht als weitere Textregel.
4. **Prüf-Worktree nach dem Anlegen: `pnpm install` UND `prisma generate`** (261: der erste volle Lauf war rot, weil der Client fehlte). Ort: umsetzer-rahmen bzw. ein Skript `scripts/pruefung/worktree.sh`.
5. **WIP am Haltepunkt pushen, wenn der volle Lauf grün ist** (Cloud-Sitzungen: Abschnitt B beginnt in einem neuen Container, ein nur lokaler WIP-Commit ginge verloren). Ort: docs/nachtlauf.md §4a Punkt 12 (g).

## Stabilität

- Rechner: 4 Kerne, 15 GB. Start 8.11.2026 19:20 UTC. Volle Läufe n = 1 unter `schwer.lock`, 3 Worker, 241–466 s Testdauer je Lauf (mit Wartezeit an der Sperre bis 1050 s samt Integration).
- **Unterbrechung:** Gegen 21:05 UTC endeten alle Agenten-Aufrufe mit dem Wochenlimit der API (HTTP 429). Bis 06:27 UTC (9.11.) lief nichts; der Container startete in der Pause neu (Postgres neu gestartet; Worktrees, Commits und Integrations-DBs erhalten). Fortgesetzt auf „Versuch es noch einmal“ der Projektleitung.
- Budgets: 261, 262, 263, 264 und 266 lagen deutlich unter ihren Budgets (fertig bis 20:47 UTC, Stunde 1,5). 267 und 269 brachen nach etwa 30 bzw. 20 Minuten ab. Die Grenzen „keine neue Nummer nach Stunde 8,5“ (03:50) und „Haltepunkt nach 11 h“ (06:20) fielen in die Pause; beim Fortsetzen um 06:27 galt Haltepunkt A sofort.
- Abweichungen: Zeitweise drei aktive Umsetzer-Aufrufe statt zwei (Nachbesserungsrunden 262, 263, 266 neben neuen Nummern). Zweimal startete eine Nachbesserung, bevor der tester derselben Nummer fertig war (263, 266; die Runden änderten Doku bzw. Dateien, die der tester nicht mehr las – Ergebnis im Zeitbuch begründet). Ein Zeitbuch-Eintrag trug zuerst eine geschätzte Uhrzeit; berichtigt nach `date -u`.

## Aufräumen

Bestätigt um 06:43 UTC: keine Prüf-Server, keine Prüf-Browser, kein Passkey-Browser, kein dev-Worktree; Prüf-DBs (`pruef33a`, `kopie_a1`) und alle Integrations-DBs (`fz_int_*`) gelöscht; `.nachtlauf/pruef-env`, `pruef-links.json`, `admin-passkey.json` und Serverprotokolle gelöscht; `.next` im Zwischenstand gelöscht. Fotograf-Worktrees: keine (`git worktree list`). Die Nummern-Worktrees unter /home/user/wt/ bleiben bis zum Ende der Sitzung; ihre Branches sind gepusht.

## Bilder

Im Container unter `/home/user/FarmerZone/.nachtlauf/screens/`: `0a/` (Probe agent-browser), `262/r1/` (Probe 6.7: Größenwahl, Brennholz „je Raummeter“, Bestätigung Hofpreis-Modell, /konditionen mit 100 Plätzen, Auswertung bei gesperrter Kopie), `zwischen-a/` (mehr-neu, Board-Bilder, Stichproben 263, 264, 266). Nicht committet; in einer neuen Sitzung nicht mehr vorhanden.

## Wiederaufnahme (für B)

- Zwischenstand: `integration/lauf33` (gepusht), Stand im Zeitbuch. Sammel-PR als Entwurf: [#508](https://github.com/Uttoranger/FarmerZone/pull/508).
- WIP-Branch `nacht/2026-11-08/267-kunden-bausteine` (gepusht, 25bebf94a5c6, Basis 233564092734, voll grün, ohne PR) läuft in B zuerst weiter (3.6), Restbudget etwa 1,5 h; Bericht fehlt noch.
- 269: lokaler WIP-Commit 248823aa7543 (rot, nicht gepusht) im Worktree /home/user/wt/269 dieses Containers. In einer neuen Sitzung ist er nicht vorhanden → 269 startet in B neu vom Zwischenstand (volles Budget 2,5 h); Startbestand der Kästchen-Liste dann neu per `git grep` zählen.
- Danach in B (verschoben aus A, in dieser Reihenfolge und mit ihren Startbedingungen, vor 271): 265 (nach 263, 264 – erfüllt), 270 (nach 263, 264 – erfüllt), 268 (nach 263 und 269).
- In der neuen Sitzung: Zeitbuch und status.md lesen, §0a ohne 1.2 und 1.3, Postgres starten (Passwort für postgres setzen), Worktrees neu anlegen, je Worktree `pnpm install --frozen-lockfile` und `pnpm exec prisma generate`.
