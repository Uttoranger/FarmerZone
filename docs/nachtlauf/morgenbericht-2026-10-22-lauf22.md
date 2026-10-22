# Morgenbericht Lauf 22 (22.10.2026)

**Keine Nummer übersprungen oder gestoppt.** #345 („Kaufen nur mit Abholtermin“, 8fac76a) und #347 („Paketpreis in ganzen Cent“, 5b13856) waren beim Start auf main; Stand-Check auf 5b13856 grün (typecheck, lint 0 Fehler, 530 / 9979). Keine Migration, kein neues Paket. Haltepunkt: Sammel-PR `integration/lauf22`.

Zwei Abweichungen von der Umgebung, die der Lauf nicht lösen durfte:
- **agent-browser ist im Cloud-Container nicht installiert** (eine Installation wäre ein Paket ohne Freigabe). Bilder und Messungen liefen mit dem vorinstallierten Playwright, eigene Chromium-Instanz ohne Anmeldungen, nie Claude in Chrome. **Axe** war nicht verfügbar (axe-core fehlt); Kontrast und Tippflächen sind über berechnete Stile gemessen.
- Einen Agenten **„sichter“** gibt es im Repository nicht; der Dirigent hat ihn als allgemeinen Agenten (Sonnet) mit Playwright eingesetzt.

## PRs

| Nr | PR | Vorschau | Migration | Basis | Runden |
|---|---|---|---|---|---|
| Doku | [#355](https://github.com/Uttoranger/FarmerZone/pull/355) | [Vorschau](https://farmer-zone-git-docs-lauf22-bierbaron.vercel.app) | nein | main | – |
| 145 | [#356](https://github.com/Uttoranger/FarmerZone/pull/356) | [Vorschau](https://farmer-zone-git-nacht-2026-10-22145-kaufsperre-78e6c7-bierbaron.vercel.app) | nein | `docs/lauf22` | 0 |
| 143 | [#359](https://github.com/Uttoranger/FarmerZone/pull/359) | [Vorschau](https://farmer-zone-git-nacht-2026-10-22143-mein-hof-v3-bierbaron.vercel.app) | nein | `docs/lauf22` | 1 (sichter) |
| 146 | [#357](https://github.com/Uttoranger/FarmerZone/pull/357) | [Vorschau](https://farmer-zone-git-nacht-2026-10-22146-hook-bierbaron.vercel.app) | nein | `docs/lauf22` | 2 (nur Bericht) |
| 148 | [#358](https://github.com/Uttoranger/FarmerZone/pull/358) | [Vorschau](https://farmer-zone-git-nacht-2026-10-22148-nacharbeit-code-bierbaron.vercel.app) | nein | `docs/lauf22` | 1 |
| 147 | [#360](https://github.com/Uttoranger/FarmerZone/pull/360) | Vorschau im PR | nein | `integration/lauf22` | 1 (Sollte) |
| Sammel 22 | Sammel-PR `integration/lauf22` → main (Link im Chat) | Vorschau im PR | nein | main | – |

CI (`ci`, `integration`) und Vercel-Vorschau: grün bei #355–#359 vor dem Start von 147 bzw. vor dem Sammel-PR.

**Sammel-PR:** `integration/lauf22` = `docs/lauf22` + 145, 146, 148, 143 (Zwischenstand) + 147, je `--no-ff`. Konflikte nur in DEVELOPMENT.md (alle Seiten hängen an, beide behalten). docs/ai ohne Konflikt (143, 145, 146, 148 an je eigenen Stellen); `pnpm bausteine` nach den Merges ohne Abweichung. Sammelstand voll: typecheck grün, lint 0 Fehler (5 Warnungen), 536 / 10095 (n=1, 3 Worker); Integration ganz 71 / 625. **Regel 3:** frische lokale DB, `migrate deploy` (35 Migrationen), `migrate diff --exit-code` ohne Unterschied.

## Zu einzelnen Nummern

**143 – Abweichungen vom Board** (Bilder unter `docs/nachtlauf/berichte/bilder/143/`): Blatt ohne Kreuz, Hauptaktion volle Breite (DESIGN_SYSTEM „Dialoge und Blätter“, `pausieren-blatt-390-hell.jpg`); Zeit im Hausformat („Samstag 09:00–12:00“); Zustandszeile ~70 statt 60 px (Satz bricht um); „Eintragen“/„Abholzeiten“ nach /settings/pickup-slots (`hofseite-offen-390-hell.jpg`); „Noch nicht freigegeben“ nur ohne Balken; Listenzeilen 56 statt 58 px. **Höhe der Reiter: Oberkante 219,8 px auf Produkte, Hofseite und Beiträge**, hell und dunkel gleich (`produkte-390-hell.jpg`, `hofseite-390-hell.jpg`, `beitraege-390-hell.jpg`). Der Seed-Hof ist nicht zu 100 % fertig; „Hofseite vollständig“ ist nur im Test belegt.

**145 – Reihenfolge der Prüfungen in /api/reserve:** Stilllegung → Freischaltung → Pause → Kaufsperre (`keine-abholzeit`/`ausgebucht`, 409 mit Titel aus `kaufSperreHinweis`) → Bestand. Bild: `docs/nachtlauf/berichte/bilder/145/korb-blatt-sperre-390-hell.jpg`.

**146 – Eingabeproben des Hooks** (erfundener Text, nie ausgeführt; Gegenprobe mit `GEFAHR_HOOK` auf die Kopie aus a0fa7fc2: 27 rot = 26 neue Fälle + der erwartete Fall, 341 grün; neuer Hook 368/368):

| Befehle | Exit vorher | nachher |
|---|---|---|
| `git push -uf origin feature/x`, `-fu`, `-vf`, über `git -C` | 0 | 2 |
| `git push -f origin x`, `--force-if-includes` | 2 | 2 |
| `git push -u …`, `--force-with-lease`, `--follow-tags` | 0 | 0 |
| `rm -rf "$(pwd)"`, `$(pwd)`, Gravis `pwd`, `"$PWD"`, `$PWD`, `"${PWD}/"`, `"$OLDPWD"`, `"$(git rev-parse --show-toplevel)"`, `"$(pwd)/.next"`, `"$PWD/."`, `"$PWD/*"` | 0 | 2 |
| `rm -rf "$PWD/.next"`, `"${PWD}/node_modules"`, `"${WT:?}/.next"`, `.next`, `node_modules`, `echo "$(pwd)"` | 0 | 0 |
| `docs:` mit vorgemerktem Code (`-m`, `-F`, Here-Document, `git add … &&`, `-am`, `--all`, Pfade mit Code) | 0 | 2 |
| `docs:` nur mit Doku, Pfade nur unter docs/, `-F nachricht-docs.txt`, `fix:`/`Merge` mit Code, `MERGE_HEAD`, ohne Repository, ohne git | 0 | 0 |
| Fall „ohne `GEFAHR_HOOK` der echte Hook“ mit gesetzter Variable | rot (erwartet) | grün ohne Variable |

**147:** 655 Pfade je Datei (ARCHITECTURE 335, DESIGN_SYSTEM 177, TESTING_GUIDELINES 54, CODING_STANDARDS 47, TECH_STACK 25, CLAUDE.md 17), davon 536 verschieden; 9 Muster, 4 Platzhalter nicht geprüft. 0 Funde, **kein Pfad berichtigt**.

**148:** (1) Menüeinträge 44 px im Baustein `ITEM`, örtliche Höhen entfernt – erledigt, mit Wache und Gegenprobe; (2) `showOnFarmPage` aus `getStatusPostForWhatsApp`, keine zweite Abfrage – erledigt; (3) `beitragIdImLink` im Teilen-Fenster – erledigt; (4) `BeitragBlockArt` – erledigt; (5) Kopfkommentar `hofuebersicht.ts` – erledigt; (6) Render-Fall `hatHandlung` – erledigt (Gegenprobe am Quelltext, Rot ohne Ausnahme von Hand belegt); (7) Doku – erledigt.

## Grenzen erweitert (Dirigent)
- 146: `tests/marke-name-wache.test.ts` – eine Ausnahmezeile gestrichen, die auf den in 146 Punkt 5 entfernten festen Pfad zeigte; keine andere Nummer berührt die Datei.

## Regelvorschläge
- **143:** Die Wache der Knopfhöhen (`tests/mein-auftritt-knoepfe.test.ts`) erkennt auch beliebige `min-h-[NNpx]` ≥ 44, damit Maße aus dem Board nicht auf Tailwind-Stufen ausweichen (Prüfung).
- **147:** Funktionsnamen in Backticks in docs/ai wie die Pfade prüfen (Suche in `src/`) – nur Vorschlag (Prüfung).
- **Dirigent:** Im Nachtlauf-Workflow ist ein Befund, der nur eine Grenzerweiterung durch den Dirigenten braucht, kein Blocker für eine Runde, sondern geht direkt an den Dirigenten (Lauf 22: zwei Runden bei 146 ohne Codeänderung). Ort: docs/nachtlauf.md 4a Punkt 4.
- **Dirigent:** agent-browser und axe-core fehlen im Cloud-Container. Entweder die Umgebung bekommt agent-browser (Setup-Skript der Umgebung, Freigabe nötig), oder docs/nachtlauf.md erlaubt für Cloud-Läufe das vorinstallierte Playwright ausdrücklich.

## Nicht begonnen
Keine. Alle Nummern aus §1 sind fertig.

## Bilderstrecke
- 143: `docs/nachtlauf/berichte/bilder/143/` – hofseite-fertig-390-hell/-dunkel, hofseite-offen-390-hell, pausieren-blatt-390-hell, produkte-pausiert-390-hell, produkte-390-hell, hofseite-390-hell, beitraege-390-hell (lokale Bilder-DB, Seed-Hof `hof-mueller`; unter `integration.lock` kurz beide Abholzeiten aus und Pause an, danach zurückgesetzt und geprüft).
- 145: `docs/nachtlauf/berichte/bilder/145/korb-blatt-sperre-390-hell.jpg` (Seed-Hof `hof-sonnleiten`; beide Abholzeiten kurz aus, danach wieder an).

## Nacharbeit („Sollte“)
- 143: Filter-Chips auf /products 36 px und „… bearbeiten“-Knöpfe in Produktzeilen 20–40 px (Altlast, nicht aus 143); ARCHITECTURE Z. ~300 („Der Kopf zeigt die Adresse …“) gilt nur noch ab lg; `setPause` erneuert /farm-page und /products nicht (der Kopf verlässt sich auf `router.refresh()`); „Ware wieder da“ auf /products rechnet weiter mit `naechstesAbholfenster`; das Dev-Symbol von Next verdeckt auf einem Bild ein Wort.
- 145: `as never` in tests/reservations.test.ts (Typ von `HOF.archivedAt`); der Streifen der Testumgebung verdeckt im Bild den Kopf des Blatts.
- 146: `statusPfade` ohne `--untracked-files=all` (ein neuer Ordner außerhalb von docs/ nur mit .md blockt `docs:` fälschlich); Kommentar zu `ersetzungFolgt` bei `$((…))`.
- 147: `existsSync` zählt auch ungetrackte Dateien; Formulierung „nur dieser Test nutzt es nicht“; Bericht 147 hat 62 statt höchstens 60 Zeilen; CODING_STANDARDS Z. ~129 (Dezimalzahl mit 0 gilt als Nummer) passt nicht zum Muster `TELEFON_NUMMER`.
- 148: Render-Gegenprobe zu `hatHandlung` nur von Hand; Bericht nennt „12/12“ statt 13/13.

## Zeitbuch
`docs/nachtlauf/berichte/zeitbuch-lauf22.md` (4 Kerne; je Nummer Umsetzer, volle Läufe mit n und Workern, tester ∥ pruefer, Runden, sichter, Integration; drei Sätze zu Zeit, G10-Ergänzung und nächstem Hebel).

## Für dich zu tun
- [ ] **Abnahme 145** (Vorschau, Entwicklungsdatenbank, Hof mit aktiver Abholzeit, NICHT als Testhof markiert): Produkt in den Korb; im zweiten Tab alle Abholzeiten aus; Hofseite neu laden → im Korb-Blatt keine Mengen-Knöpfe; in einer NICHT neu geladenen Hofseite „In den Korb“ bei einem weiteren Produkt → „Noch nicht bestellbar.“; Abholzeit wieder an → alles wie vorher.
- [ ] **Abnahme 143** (dieselbe Datenbank, Hof nicht als Testhof): Pausieren mit Nachricht → Kopf „Pausiert“, Hofseite zeigt die Karte mit der Nachricht; Fortsetzen → „Nimmt Bestellungen an“ mit der nächsten Abholung; alle Abholzeiten aus → „Noch nicht bestellbar“ mit „Eintragen“.
- [ ] **Blick 148:** /admin › Postfach › Meldungen, „Mehr zu …“ am Handy → Einträge so hoch wie im Menü der Hofliste; „+ Neu“ in der Seitenleiste am Computer öffnet wie vorher.
- [ ] **Merge:** den Sammel-PR per Merge-Commit (nicht Squash); danach die CI auf main ansehen. Ab dem Merge gilt der Hook aus 146 (`docs:` nur mit Doku) – auch für Zeitbuch- und Berichts-Commits.
- [ ] **Bestätigen:** die Grenzerweiterung bei 146 (`tests/marke-name-wache.test.ts`) und das Werkzeug für Bilder in diesem Lauf (Playwright statt agent-browser, kein Axe).
- [ ] **Ab 28.10.:** CSP-Meldungen in Sentry ansehen (Tag `bereich:csp`) und den Auftrag „CSP scharf“ freigeben; vorher im Stripe-Dashboard nachsehen, ob Link an ist (docs/betrieb/stripe-live.md, „0. Vorher“).
- [ ] **Entscheidungen für Lauf 23:** Backups der Produktion; Größen zusammenfassen; die Liste „Nicht in diesem Lauf“ aus freigabe.md §26; die Regelvorschläge oben; ob die Umgebung agent-browser bekommt.
