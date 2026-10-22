# Morgenbericht Nachtlauf 21 (22.10.2026)

Freigabe: `docs/nachtlauf/freigabe.md` §25 (im Chat erteilt am 21. und 22.10.2026). Dirigent nach `docs/nachtlauf.md`, Tempo nach 4a und G10 (§0 der Freigabe).

- **Der Fix „Kaufen nur mit Abholtermin“ war beim Start NICHT auf main** (PR [#345](https://github.com/Uttoranger/FarmerZone/pull/345) offen, kein `export function kaufSperre`, keine `kauf-sperre-hinweis.tsx`). **Das Board** `docs/mockups/system-h1-mein-hof-v3.html` **war auf main** (Commit 211a418).
- **Nach der Rückfallregel der Freigabe** entfällt **143**, und **137** lief nur mit Punkt 3 und 4 (Hofliste erneuern, Pausen-Nachricht). Punkt 1, 2 und 5 von 137 und ganz 143 kommen, sobald #345 auf main ist.
- **139 gestoppt: Geld-Fund** (Entwurf [#347](https://github.com/Uttoranger/FarmerZone/pull/347), nicht im Sammel-PR):
  - Ursache ist die Rechnung mit Fließkomma in `src/components/products/produkt-preis.ts:146` (Hilfe für den Paketpreis), nicht das `Number()` selbst. Ein vorgeschlagener Preis, der genau auf einem halben Cent liegt, landet einen Cent zu niedrig im gespeicherten Produktpreis, mit dem die Kasse rechnet.
  - Betroffen sind nur Gebindegrößen über 1 mit Nachkommastellen. Die Abweichung geht immer nach unten, also zu Lasten des Hofs. Beispiel: 0,15 € × 1,5 ergibt 0,22 € statt 0,23 €.
  - Zwei unabhängige Prüfer konnten den Fund nicht widerlegen. Nach der Freigabe gibt es keinen Fix in diesem Lauf; deine Entscheidung steht in Abschnitt 9.
- **Keine Migration, kein neues Paket.** Regel 3 auf frischer Datenbank: 34 Migrationen wie auf main, `migrate diff` leer, keine Tabelle ohne RLS.
- **Fertig und im Sammel-PR [#354](https://github.com/Uttoranger/FarmerZone/pull/354):** Doku-PR, 137, 138, 140, 142, 144 und 141.
- **Stand des Sammel-PR:** Merges, voller Lauf (525 Dateien / 9882 Tests), ganze Integration (70 / 621) und Regel 3 grün; **CI des Sammel-PR grün** (`ci` und `integration`, 14:49–14:56).

## 1. PRs

| Nr | Thema | PR | Basis | Migration | Paket | Runden · Durchgänge | Vorschau |
|---|---|---|---|---|---|---|---|
| Doku | Freigabe §25, G10 in den Regeln, Register (G10, F11, N24, N25 und Ergänzungen), Board-Zeile, Status | [#346](https://github.com/Uttoranger/FarmerZone/pull/346) | main | nein | nein | – (Dirigent prüfte die Wörtlichkeit per Skript) | [Vorschau](https://farmer-zone-git-docs-lauf21-bierbaron.vercel.app) |
| 137 | Hofliste sofort erneuern, Pausen-Nachricht mit Grenze (N24, nur Punkt 3 und 4) | [#348](https://github.com/Uttoranger/FarmerZone/pull/348) | `docs/lauf21` | nein | nein | 1 · 1 voller Durchgang, Integration ganz | [Vorschau](https://farmer-zone-git-nacht-2026-10-22137-kaufsperre-bierbaron.vercel.app) |
| 138 | Hook: Löschen in jeder Schreibweise, Push auf main ohne Lücke, Commit-Präfix (G4) | [#349](https://github.com/Uttoranger/FarmerZone/pull/349) | `docs/lauf21` | nein | nein | 1 · 1 voller Durchgang | [Vorschau](https://farmer-zone-git-nacht-2026-10-22138-hook-bierbaron.vercel.app) |
| 139 | Geld nie mit `Number()` – **STOPP, Geld-Fund, Entwurf** | [#347](https://github.com/Uttoranger/FarmerZone/pull/347) | `docs/lauf21` | nein | nein | 1 · 1 gezielter Durchgang + Nachprüfung + 2 Prüfer zum Geld-Fund | [Vorschau](https://farmer-zone-git-nacht-2026-10-22139-geld-number-bierbaron.vercel.app) |
| 142 | Testdaten: Orte vereinheitlichen (G9) | [#350](https://github.com/Uttoranger/FarmerZone/pull/350) | `integration/lauf21` (nach 137) | nein | nein | 0 · 1 gezielter Durchgang | [Vorschau](https://farmer-zone-git-nacht-2026-10-22142-testdaten-orte-bierbaron.vercel.app) |
| 144 | Produkte am Handy: „Braucht dich“ zuerst, Vorrat mit Einheit im Blatt (N25) | [#351](https://github.com/Uttoranger/FarmerZone/pull/351) | `docs/lauf21` | nein | nein | 2 (die zweite wegen einer falschen Regel des Dirigenten) · 1 voller Durchgang | [Vorschau](https://farmer-zone-git-nacht-2026-10-22144-produkte-handy-bierbaron.vercel.app) |
| 140 | Wachen aus Inventur und Regelvorschlägen (G4) | [#352](https://github.com/Uttoranger/FarmerZone/pull/352) | `docs/lauf21` | nein | nein | 1 + Nachrunde Dirigent · 1 gezielter Durchgang | [Vorschau](https://farmer-zone-git-nacht-2026-10-22140-wachen-bierbaron.vercel.app) |
| 141 | Regeln kürzen und schärfen (G4) | [#353](https://github.com/Uttoranger/FarmerZone/pull/353) | `integration/lauf21` (mit allen anderen) | nein | nein | 2 · 1 gezielter Durchgang + 2 Nachprüfungen | [Vorschau](https://farmer-zone-git-nacht-2026-10-22141-regeln-kuerzen-bierbaron.vercel.app) |
| 143 | Mein Hof v3 – **entfällt** (Fix nicht auf main) | – | – | – | – | – | – |
| Sammel | Doku-PR, 137, 138, 142, 144, 140, 141 (ohne 139) | [#354](https://github.com/Uttoranger/FarmerZone/pull/354) | main | nein | nein | – | [Vorschau](https://farmer-zone-git-integration-lauf21-bierbaron.vercel.app) |

- **CI auf den PRs** (`ci` und `integration`): #346–#354 je `ci` und `integration` grün, jeweils beim ersten Lauf.
- **Vorschau und Entwicklungsdatenbank:** Kein PR bringt eine Migration; aus dem Nachtlauf lief kein Befehl gegen die Entwicklungsdatenbank.

## 2. Sammel-PR

Branch `integration/lauf21`, Anfang `docs/lauf21` (0dd060c = main 211a418 + Doku-PR). Gebaut im eigenen Worktree; der Hauptcheckout blieb unberührt, damit der neue Hook aus 138 nicht mitten im Lauf wirksam wurde.

**Merges** (`git merge --no-ff`, Merge-Texte über eine Datei, in dieser Reihenfolge):

| Merge | Commit | Konflikte |
|---|---|---|
| 137 | `5111be6` | keine |
| 138 | `1de5ec8` | keine |
| (Zeitbuch) | `b8fd87a` | – |
| 142 | `ce484da` | keine |
| 144 | `0ed791d` | DEVELOPMENT.md: beide Einträge behalten (137 und 144 hängen je einen an dieselbe Stelle) |
| 140 | `0a68278` | DEVELOPMENT.md: beide Einträge behalten |
| (Zeitbuch) | `eec51d8` | – |
| 141 | `78e6305` | keine |

- In docs/ai gab es keinen Konflikt. Sammel-PR und Zwischenstand haben die geteilten Dateien nach dem Merge mit `git show --cc` angesehen; die Sätze der Nummern stehen nebeneinander:
  - CLAUDE.md: Doku-PR §1, 138 „Zwei Hooks“ und §5, 141 Z. 55, 56 und 81
  - TESTING_GUIDELINES: Doku-PR, 140, 141
  - DESIGN_SYSTEM: 140 Menü-Portal, 144 Produkte, 141 Inventur 11 und 15
  - ARCHITECTURE: 137
- **Bausteinverzeichnis:** nach den Merges mit `pnpm bausteine` neu erzeugt, ohne Unterschied.
- **139 nicht drin** (Entwurf, Geld-Fund; G3: PRs mit offener Vorbedingung kommen nicht hinein).
- **143 entfällt.**

**Prüfungen auf dem Gesamtstand:**
- Unterwegs:
  - nach 137: voller Lauf 522 Dateien / 9679 Tests, Integration 70 / 621
  - vor 141: 525 / 9882, Integration 70 / 621
  - beide grün
- Endstand nach 141: typecheck grün, lint 0 Fehler / 5 Warnungen (wie main), `pnpm test` **525 Dateien / 9882 Tests** grün (mit 3 Workern in 3,3 Minuten).
- Integration ganz: **70 Dateien / 621 Tests** grün.
- **Regel 3** (frische lokale Datenbank, nur Migrationen): 34 Migrationen wie auf main, eingespielt und ein zweites Mal ohne offene Migration, `migrate diff` (Datenbank → Schema) leer, keine Tabelle ohne RLS, die Wegwerf-Datenbank danach gelöscht.
- **CI:** Die Einzel-PRs #346–#353 sind grün. Der Sammel-PR selbst: siehe oben, „Stand des Sammel-PR“.

## 3. Zu den Nummern

### 137 · Alle Actions, die die Hofliste jetzt erneuern
`updateTag(HOEFE_CACHE_TAG)` steht nach dem Schreiben in:
- `src/server/actions/farm.ts`: `updateProfile`, `addPickupSlot`, `deletePickupSlot`, `togglePickupSlotActive`, `setPause`
- `src/server/actions/farm-photos.ts`: `addFarmPhotoAction`, `deleteFarmPhotoAction`, `reorderPhotosAction` (darüber auch `moveFarmPhotoAction`); bewusst nicht `updateFarmPhotoCaptionAction`
- `src/server/actions/farm-archive.ts`: `archiveFarm`, `reactivateFarm`
- `src/server/actions/appearance.ts`: `saveAppearanceAction`, `updateFarmBannerAction` (schon vorher: `updateFarmLogoAction`)
- `src/server/actions/admin.ts`: `revokeFarmApprovalAction` (schon vorher: das Freischalten)

Die Wache `tests/hofliste-schreiber-wache.test.ts` hält das für alle Actions fest. Sie findet außer den vier Ausnahmen der Freigabe keine weitere Funktion, und sie wird rot, wenn eine Ausnahme veraltet.

**Reihenfolge der Prüfungen in /api/reserve:** unverändert Stilllegung → Freischaltung → Pause → Bestand, denn Punkt 1 (Kaufsperre vor dem Bestand) entfällt. Ohne buchbaren Abholtermin kann man also weiter bis zu 15 Minuten reservieren. Bezahlen geht nicht, denn die Kasse prüft das Abholfenster.

**Pausen-Nachricht:** höchstens 300 Zeichen (`PAUSENACHRICHT_MAX`). Ein unveränderter Altwert darüber bleibt erlaubt, damit „Fortsetzen“ nie gesperrt ist. Am Feld steht der Zeichenzähler.

### 138 · Eingabeproben des Hooks (erfundener Text, nie ausgeführt): Befehl → Exit vorher → Exit nachher
Aus dem Skript der Gegenprobe (Kopie des alten Hooks gegen den neuen, je per stdin). Von 121 Fällen weicht der neue Hook in keinem vom Soll ab; der alte lag in 53 falsch.

| Punkt | Befehle | Exit vorher | Exit nachher |
|---|---|---|---|
| 1 | `rm -fr /x`, `rm -r -f /x`, `rm -Rf /x`, `rm -rfv /x`, `rm --recursive --force /x`, `rm -rf "$HOME"`, `rm -rf ./`, `rm -rf ../`, `rm -rf ./*`, `rm -rf .*`, `rm -rf build /`, `rm -rf -- /`, `rm -rf ..`, `rm -rf ${HOME}`, `rm -rf '${HOME}'`, `rm -rf "$HOME/projekt"`, `rm -R /x`, `rm --rec -f /x`, `rm /x -rf`, `rm -rf "${HOME:?}"`, `rm -rf ${HOME:-/tmp/x}` | 0 | 2 |
| 1 | `rm -rf /x`, `rm -rf ~`, `rm -rf .`, `rm -rf *`, `/bin/rm -rf /`, `command rm -rf /`, `find . -exec rm -rf / \;`, `rm -rf ~/projekt`, `/usr/bin/rm -rf /x`, `sudo rm -rf /x`, `xargs rm -rf /x`, `\rm -rf /x`, `rm -rf .next && rm -rf /x`, `out=$(rm -rf /x)`, `sh -c "cd build && rm -rf /x"`, `echo "rm -rf ~"`, `rm -rf */`, `rm -rf *.log` | 2 | 2 |
| 1 | `rm -rf ./node_modules`, `rm -rf node_modules`, `rm -rf .next`, `rm datei.txt`, `rm -f ./x`, `rm -rf "${WT:?}/.next"`, `rm -rf .next > /dev/null 2>&1`, `rm -f /tmp/notiz.txt`, `grep -rn "rm -rf" /tmp/notizen` | 0 | 0 |
| 2 | `git push origin +main`, `git push origin HEAD:main`, `git push origin HEAD:refs/heads/main`, `git push origin refs/heads/main`, `git push origin :main`, `git push origin feature/x:refs/heads/main`, `git push origin "main"`, `git -C ../anderer-ordner push origin HEAD:main`, `git push origin +feature`, `git push origin +HEAD:feature/x`, `git -C ../anderer-ordner push --force origin feature/x` | 0 | 2 |
| 2 | `git push origin main`, `git push origin --delete main`, `git push -u origin main`, `git push origin -d main`, `git push --set-upstream origin main`, `git push origin main:main` | 2 | 2 |
| 2 | `git push origin main-fix`, `git push origin main.alt` | 2 | 0 |
| 2 | `git push origin feature/main`, `git push origin feature/main-x`, `git push -u origin nacht/2026-10-22/137-kaufsperre`, `git push origin main2`, `git push origin mainline`, `git push origin main_alt`, `git push origin HEAD:refs/heads/main-fix` | 0 | 0 |
| 3 | `git add .env.example.alt` | 0 | 2 |
| 3 | `git add .env`, `git add .env.local`, `git add .env.test`, `git add .env.test.example .env.local`, `git commit -m "fix: x" .env.local` | 2 | 2 |
| 3 | `git add .env.test.example` | 2 | 0 |
| 3 | `git add .env.example` | 0 | 0 |
| 5 | `git commit -m "test: x"`, `git commit -m "Kaufsperre"`, `git commit -F nachricht-test.txt`, `git commit -am "test: x"`, `git commit --message="test: x"`, `git commit --message "Kaufsperre"`, `git commit --amend -m "Kaufsperre"`, `git commit --file=nachricht-test.txt`, `git commit -m "x" -m "fix: y"`, `git commit -m "fixes: x"`, `git commit -m "Merge-Konflikt gelöst"`, `git add x && git commit -m "test: x"`, `git commit -F - <<EOF ⏎ test: x ⏎ EOF`, `git commit -m "$(cat <<'EOF' ⏎ test: x ⏎ ⏎ Text ⏎ EOF ⏎ )"`, `git commit -SF -m "test: x"`, `git -C <tmp>/auf-feature commit -m "x"` (ohne Repo), `cd <tmp>/auf-feature && git commit -F nachricht-test.txt` (ohne Repo) | 0 | 2 |
| 5 | `git commit -m "test: x"` (Ordner auf main: Grund „Auf main …“) | 2 | 2 |
| 5 | `git commit -m "fix: x"`, `-m "WIP: x"`, `-m "feat: x"`, `-m "docs: x"`, `-m "chore: x"`, `-m "refactor: x"`, `-m "fix: x" -m "Text"`, `-am "fix: x"`, `-m "Merge origin/nacht/… in integration/lauf21"`, `-F nachricht-docs.txt`, `-F nachricht-merge.txt` (auch über `git -C`/`cd` ohne Repo), `-F fehlt.txt`, `-m "$MSG"`, `-F - <<EOF ⏎ fix: x ⏎ EOF`, `cat <<'EOF' \| git commit -F - ⏎ docs: x ⏎ EOF`, `--no-edit`, `--amend --no-edit`, `git merge --no-ff -m "x" origin/nacht/…`, `git commit -unormal -m "fix: x"` | 0 | 0 |

Bewusst über den Wortlaut hinaus: Ziele, die mit `*` beginnen (`*/`, `*.log`), blocken weiter wie auf main. Die erste Fassung hatte sie freigegeben, der pruefer fand das (Runde 1). Wirksam wird der neue Hook erst nach dem Merge und dem Ziehen des Hauptcheckouts.

### 139 · Die drei Stellen und die Positivliste der Wache
| Stelle | Befund |
|---|---|
| `src/app/(hof)/status/new/page.tsx:75` `Number(p.price)` | nur Anzeige (`formatEuro`); an die Action gehen nur Produkt-IDs |
| `src/app/(public)/[farmSlug]/bestaetigen/[token]/page.tsx:147` `Number(item.totalPrice)` | nur Anzeige; Gebühr und Summe kommen aus Cent (`bestellSummen`) |
| `src/lib/produkt-dto.ts:21` `Number(p.price)` | Anzeige (Korb, Zeilensumme, Kilopreis) und Vorbelegung des Preisfelds im Produktdialog. **Von dort führt ein Weg in den gespeicherten Preis**: Referenzpreis → `paketpreisAntworten` → `produkt-preis.ts:146` (Fließkomma) → „Nein, … ist der Preis je …“ → Speichern. **Geld-Fund, Ursache in produkt-preis.ts.** |

Positivliste `GELD_NUMBER_BESTAND` in `tests/geld-number-wache.test.ts`: genau diese drei Einträge (Datei, Ausdruck, Anzahl 1, Grund), bei `produkt-dto.ts` mit dem offenen Weg im Grund. Ein neuer Aufruf, ein zweiter Aufruf in einer Bestandsdatei und ein veralteter Eintrag machen die Wache rot.

### 140 · Inventur und Regelvorschläge
- **Inventur 16 (Überspringen von Tests):** erledigt. `tests/test-ueberspringen-wache.test.ts` liest alle Testdateien samt `tests/integration/`; `skipIf`/`runIf` stehen nur in einer Liste mit Grund (heute `vercel-ignore`).
- **Inventur 18 (Claude in Chrome):** erledigt. `tests/claude-einstellungen-wache.test.ts` prüft den Eintrag in `permissions.deny`.
- **Regelvorschlag 132 (Menüs in der Landmarke):** erledigt.
  - `MenueZielAnbieter` in AdminShell (Kopf und Inhalt) und HofShell (nur die Seitenleiste).
  - Dialog und Blatt setzen „kein Ziel“; dafür hat der Dirigent die Grenze um `dialog.tsx` und `sheet.tsx` erweitert (Abschnitt 9).
  - Axe am offenen Menü auf /admin und im Meldungs-Werkzeug: hell und dunkel je 0 Funde.
- **Regelvorschlag 135 (Hydrieren):** erledigt. `GEPRUEFT` umfasst 12 Dateien, `AUSNAHMEN` ist leer; dazu fünf neue Fälle.
- **Regelvorschlag „Sammelstand“ (verfälschte Testwerte):** erledigt. Drei Stellen tauschen jetzt statt festzusetzen, mit Wache.

### 141 · Inventur (Kürzen) und Regelvorschläge
Grundsatz der Freigabe: gekürzt wird nur, was doppelt steht oder von einer Prüfung abgedeckt ist. Der pruefer hat jede Fundstelle am Code bzw. Text nachgeprüft.

| Nr. | erledigt wie | vorher → nachher (Zeichen) | Regel steht weiter / geprüft von |
|---|---|---|---|
| Inventur 1 | CODING_STANDARDS, Sentry-Hygiene auf wenige Regelzeilen | 11 819 → 2 110 | JSDoc in `src/lib/sentry-hygiene.ts`, `tests/sentry-hygiene-{felder,sdk,vergleich,wachstum}.test.ts`, `tests/beobachtbarkeit.test.ts` |
| Inventur 2 | CODING_STANDARDS Z. 57 auf drei Sätze; ARCHITECTURE Z. 343 bleibt die ausführliche Stelle (wie in der Freigabe) | 1 583 → 1 099 | ARCHITECTURE §5, Kopf von `src/lib/testzahlung.ts`, `tests/testzahlung-wache.test.ts` |
| Inventur 4 | Zahlen gestrichen, Zählbefehl steht da | 390 → 424 | – |
| Inventur 7 | geschärft: Rückgabetyp in src/lib, src/server, src/schemas, React ausgenommen; `!` nur mit Begründung in derselben Zeile (mit Herkunft) | 213 → 294 | `/pruefen`; Vorschlag ESLint-Warnung (Abschnitt 5) |
| Inventur 8 | §9 als Verweis auf `/pruefen`, Z. 452 entfällt; zwei Punkte, die `/pruefen` nicht nennt, bleiben als Zeilen | 736 → 399 | `.claude/skills/pruefen/SKILL.md` |
| Inventur 9 | zwei Sätze | 435 → 415 | `tests/transaktion-nacheinander.test.ts` |
| Inventur 10 | Regel mit Verweis | 627 → 590 | `eslint.config.mjs` (`DATUM_SELEKTOREN`, `DATUM_ORT_SELEKTOREN`), `tests/datums-regeln.test.ts` |
| Inventur 11 | Verweis auf ESLint und Hex-Wache; Satz zum alten Farbwert in DESIGN_SYSTEM entfernt | 557 → 614 | `FARBLITERAL_SELEKTOREN`, `tests/design-tokens.test.ts`, `tests/palette-klassen-wache.test.ts` |
| Inventur 12 | geschärft (Verb zuerst nur für Aktionen, Handler, Hooks) | 60 → 234 | – |
| Inventur 13 | Liste „Ausnahmen von der Uhr“ in §4, Gegenprobe-Pflicht einmal | 7 514 → 7 115 | TESTING_GUIDELINES §2 und §4 |
| Inventur 14 | `tests/fixtures/` und fünf lose Hilfsdateien mit Namen; nichts verschoben (wie in der Freigabe) | 173 → 629 | – |
| Inventur 15 | DESIGN_SYSTEM: doppelter Satz gestrichen, Verweise auf die Wachen | 1 992 → 1 740 | `tests/fachwort-wache.test.ts`, `tests/leerzustaende-wache.test.ts`; Einwilligung: Register S11 |
| Inventur 18 | CLAUDE.md Z. 55, 56, 81 ergänzt (Seed-Allowlist, Sperre Claude in Chrome, Hook für npm/yarn) | – | `prisma/seed.ts`, `tests/umgebung.test.ts`, `tests/claude-einstellungen-wache.test.ts` (140), Hook |
| Regelvorschläge 131, 133, 134, 124 | als Text mit Herkunft und Datum (docs/nachtlauf.md 4a Punkt 6 b und 1, TESTING §1 und §2) | – | – |

**Summe:** CODING_STANDARDS.md + TESTING_GUIDELINES.md zusammen 79 747 → 71 137 Zeichen (−8 610). TESTING_GUIDELINES allein wächst (Liste der Uhr-Ausnahmen, Hilfsdateien, 133, 124).

Runde 1 legte eine Wache für die Herkunftsvermerke an. Die Nachprüfung fand, dass F11 genau diese Wache ausschließt, und Runde 2 entfernte sie wieder.

### 142 · Zahlen
Dateien mit den gesperrten Ortsnamen: vorher 13, nachher 1. Dateien mit ihren Postleitzahlen (ohne pnpm-lock.yaml): vorher 8, nachher 1. Die eine Datei ist jeweils das Impressum. Geändert sind 13 Dateien mit zusammen 18 entfernten und 18 hinzugefügten Zeilen (Mockups je 1, Tests zusammen 12). Die Testzahlen sind vorher und nachher gleich.

### 144 · Abweichungen vom Board (alle aus der Freigabe)
- Größen bleiben je eine Zeile statt „4 Größen“. Ein Bild dazu fehlt, weil die erlaubten Seed-Konten keine Familie mit Größen haben (Nacharbeit).
- Das Vorrat-Blatt hat kein Kreuz. „Ausverkauft“ (Umriss) und „Speichern“ (grün wie im Board) stehen untereinander über die volle Breite, „Abbrechen“ ist ein Textknopf (DESIGN_SYSTEM „Dialoge und Blätter“).
- `inputMode="numeric"` statt `decimal`, weil der Vorrat eine ganze Zahl ist.
- Ab 1024 px bleibt die Tabelle gleich, nur „Nur noch 3 kg“ trägt jetzt die Einheit.

![Vorrat-Blatt 390](berichte/bilder/144/vorrat-blatt-390-hell.jpg)

## 4. Nicht begonnene bzw. gestoppte Nummern
- **143** entfällt (Fix „Kaufen nur mit Abholtermin“ nicht auf main; Rückfallregel der Freigabe).
- **139** gestoppt nach Punkt 1 wegen des Geld-Funds; die Wache und die Doku sind fertig (Entwurf #347).
- **137** Punkt 1, 2 und 5 nicht begonnen (Rückfallregel).

## 5. Regelvorschläge aus den Berichten, gesammelt (Prüfung vor Textregel; eingetragen erst nach deiner Freigabe)
- **137:** keiner neu; die Wache ist die Gegenmaßnahme (gebaut).
- **138:** Die Gegenprobe gegen die Kopie des alten Hooks als Testhilfe in `tests/gefahr-blocken.test.ts` (Umgebungsvariable für den Hook-Pfad) statt als Skript je Nummer. Ort: TESTING_GUIDELINES §2.
- **139:** Eine zweite Wache für Rechnungen mit Geld in Fließkomma ohne `Number()` (`produkt-preis.ts:146`, `use-cart.ts:176`, `cart-sheet.tsx:120`), nach der Bereinigung von `produkt-preis.ts`. Ort: `tests/`.
- **140:** keiner neu; die Wache zu Dialog und Blatt ist gebaut.
- **142:** keiner.
- **144:**
  1. Wer den Seed der geteilten Test-DB neu einspielt, nimmt dieselbe Sperre wie die Integration. Ein Integrationslauf einer anderen Nummer hatte den Seed mitten in den Bildern zurückgesetzt. Ort: `docs/nachtlauf.md` 4a Punkt 6 b. Prüfung: Das Seed-Skript nimmt die Sperre selbst.
  2. Die tester-Regel zum Alter des Integrationslogs. Erledigt beim Dirigenten, siehe unten „Dirigent“ Punkt 1.
- **141:** (a) ESLint-Warnung `@typescript-eslint/explicit-module-boundary-types` für neue Dateien in `src/lib`, `src/server`, `src/schemas` (eigener Auftrag; ESLint blieb unverändert); (b) eine Wache, die jeden Pfad `tests/…`, `src/…`, `eslint.config.mjs` aus `docs/ai/` auf Existenz prüft, mit Gegenprobe.
- **Dirigent:**
  1. Der tester vergleicht das Integrationslog mit der jüngsten geänderten Datei, nicht mit dem Commit. Im Ablauf ist das schon berichtigt.
  2. Der pruefer prüft im selben Worktree wie der tester und darf dort nichts ändern, auch nicht vorübergehend (im pruefer-Rahmen geregelt).
  3. Ein `docs:`-Commit darf keinen Code-Fix tragen (Fund aus 140). Vorschlag: der Hook aus 138 prüft künftig auch, ob ein `docs:`-Commit nur `.md` enthält.

## 6. Tempo und Zeitbuch
Wiener Zeit, 22.10.2026. Rechner: **4 Kerne**.
- Bis zu drei Umsetzer liefen gleichzeitig, dazu tester und pruefer.
- **Die vollen Läufe der Nummern liefen mit `--maxWorkers=1`**, der des Doku-Umsetzers mit 2. Nach G10, max(1, floor((4−1)/n)), ist 1 schon ab n ≥ 2 gleichzeitigen Läufen richtig.
- Der Dirigent nahm im Zwischenstand 1 bzw. 2 Worker und im Sammelstand 3, als dort jeweils nur ein Lauf lief.
- Kein sichter in diesem Lauf: Der Umsetzer von 144 machte die Bilder selbst, und 143 entfiel.
- Das ganze Zeitbuch steht in `docs/nachtlauf/berichte/zeitbuch-lauf21.md`.

| Nr | Beginn | Ende Workflow | Dauer | Umsetzer | volle Läufe (min, Ergebnis) | Runden | tester / pruefer je Durchgang (min) |
|---|---|---|---|---|---|---|---|
| Doku | 10:30 | 10:40 (PR 10:41) | 10 min | 10 | 1 (mit `--maxWorkers=2`) | – | Dirigent per Skript |
| 138 | 10:43 | 11:44 | 61 min | 32 | 8,1 · 8,0 (beide grün) | 1 (15) | 1,3/8,1 · 1,6/3,7 |
| 137 | 10:43 | 11:38 | 55 min | 26 | 8,4 · 7,7 (grün) + Integration ganz zweimal (6 bzw. 5) | 1 (18) | 6,8/4,9 · 1,2/2,5 |
| 139 | 10:43 | 11:22 (Nachprüfung und Prüfung des Geld-Funds bis 11:31) | 39 min (48 mit Prüfung) | 19 | 10,1 · 8,3 (grün) | 1 (13), dann STOPP | 1,0/3,9 · Nachprüfung und 2 Prüfer parallel 8 |
| 144 | 11:23 | 12:59 | 96 min | 40 | 9,4 · 8,8 · 8,0 (grün) | 2 (17 · 21) | 7,0/4,5 · 1,2/2,6 · 6,4/3,7 |
| 140 | 11:40 | 13:05 (mit Nachrunde) | 85 min | 50 | 9,1 (rot, Lint) · 9,0 · 8,9 · 7,6 (grün) | 1 (13) + Nachrunde Dirigent | 2,0/6,6 · 2,4/3,8 |
| 142 | 11:58 | 12:32 | 34 min | 31 | rund 10 (vom Werkzeug nach seiner Zeitgrenze abgebrochen, Neustart erst 12:19) · 8,9 (grün) | 0 | 0,8/2,5 |
| 141 | 13:16 | 14:17 | 61 min | 23 | 7,8 · 8,0 · 8,0 (grün) | 2 (12 · 10) | 0,7/6,4 · 0,7/4,2 · 0,6/4,1 |
| Zwischenstand | 11:41 | 13:16 | – | – | 10,5 (mit 137, 1 Worker) · 4,9 (vor 141, 2 Worker); Integration ganz 5,5 und 5,1 | – | – |
| Sammel | 14:22 | PR #354 14:49, CI grün 14:56 | – | – | 3,3 (3 Worker, grün); Integration ganz 5,1; Regel 3 | – | – |

**Wartezeit auf die CI:** praktisch keine.
- Vor 142 lief die CI von #348 (11:40–11:46) gleichzeitig mit dem lokalen Lauf im Zwischenstand (11:41–11:57). Gewartet wurde auf diesen Lauf.
- Vor 141 war die CI von #351/#352 um 13:10 fertig, der Zwischenstand um 13:16.
- Vor dem Sammel-PR lief die CI von #353 (14:20–14:26) gleichzeitig mit dem Lauf im Sammelstand.

**Wohin ging die Zeit?**
- Etwa ein Drittel jeder Nummer steckte in vollen Läufen (26–41 %, insgesamt rund 37 %; nur bei 142 mehr): 7,6–10,1 Minuten je Lauf mit einem Worker, und jede Runde braucht einen neuen.
- Bei 144 und 141 dauerten die zwei Runden zusammen fast so lange wie die Umsetzung selbst (38 zu 40 bzw. 21 zu 23 Minuten).
- tester und pruefer liefen gleichzeitig. Ein Durchgang kostete so viel wie der längere von beiden, 2,5–8 Minuten. Gegenüber „nacheinander“ sparte das je Durchgang 0,6–4,9 Minuten.

**Was wäre der nächste Hebel?**
- **Unnötige Runden vermeiden.** Die zweite Runde von 144 ging auf eine falsche Prüfregel des testers im Workflow zurück (inzwischen berichtigt). Die zweite Runde von 141 ging auf eine Wache zurück, die F11 ausschließt; ein Hinweis auf F11 in der Lesemappe hätte sie verhindert.
- **Die Worker dem tatsächlichen Andrang anpassen.** Nach dem Zeitbuch liefen mindestens sieben volle Läufe allein und trotzdem mit einem Worker: Runde 1 von 137 und 138, die Nachrunde von 140, die drei Läufe von 141 und der erste Zwischenstand. Zusammen sind das rund 57 Minuten; mit 3 Workern grob geschätzt etwa 23 (Sammelstand: 3,3 Minuten mit 3 Workern).

## 7. Bilderstrecke (hell, wo nicht anders genannt)
Nur 144 macht Bilder (§0); 137 hätte das Korb-Blatt gezeigt, das mit Punkt 2 entfällt.

| Bild | Datei |
|---|---|
| Mein Hof › Produkte mit „Braucht dich“, 390 hell | `docs/nachtlauf/berichte/bilder/144/produkte-390-hell.jpg` |
| dieselbe Seite, 390 dunkel | `docs/nachtlauf/berichte/bilder/144/produkte-390-dunkel.jpg` |
| Vorrat-Blatt, 390 hell | `docs/nachtlauf/berichte/bilder/144/vorrat-blatt-390-hell.jpg` |
| Tabelle ab 1024 px, 1280 hell (gleich bis auf „Nur noch 3 kg“) | `docs/nachtlauf/berichte/bilder/144/tabelle-1280-hell.jpg` |

![Produkte 390 hell](berichte/bilder/144/produkte-390-hell.jpg) ![Produkte 390 dunkel](berichte/bilder/144/produkte-390-dunkel.jpg) ![Tabelle 1280 hell](berichte/bilder/144/tabelle-1280-hell.jpg)

## 8. Nacharbeit („Sollte“/„Kann“), gesammelt
- **137:** In `docs/ai/ARCHITECTURE.md` Z. 202 den neuen Satz hinter „… leeren beide (…)“ setzen („Sollte“). In `pause-client.tsx` den Zähler mit `message.trim().length` zählen, wahlweise mit `leise` („Kann“).
- **138:**
  - Force als Gruppe kurzer Optionen (`git push -uf …`) erkennt die Force-Regel weiter nicht.
  - `rm -rf "$(pwd)"` (Ersetzung als Ziel) geht wie bisher durch.
  - Beides stand nicht in der Freigabe.
- **139:**
  - Die „Belege am Code“ in der Wache vergleichen Text; ein Fix von `produkt-preis.ts` macht sie ohne Meldung rot. Vorschlag: streichen.
  - Bericht Z. 22 nennt `produkt-preis.ts:119` statt `:120`.
  - `use-cart.ts:176` und `cart-sheet.tsx:120` rechnen `price * quantity` in Fließkomma; das ist nur Anzeige, es entsteht kein halber Cent.
- **140:**
  - Die Überspringen-Wache soll belegen, dass sie `tests/integration/` liest.
  - Die rechte Seite einer `+`-Kette prüfen („Kann“).
  - Den Kommentar in `email-bestaetigung.int` kürzen („Kann“).
  - Die Wortwahl „am body“ / „am Portal des Dialogs“ („Kann“).
  - `KartenMenue` mit 36-px-Einträgen (außerhalb der Grenze).
  - Der schnelle Lauf zu Punkt 3 lief nicht auf dem eingecheckten Stand; die Lint-Korrektur steckt im `docs:`-Commit `699393c`.
- **142:** keine.
- **144:**
  - Ein Bild mit einem Produkt in mehreren Größen fehlt.
  - Ein Render-Fall für `hatHandlung` fehlt.
  - Die Einheit im Blatt direkt bestimmen statt aus dem Text schneiden („Kann“).
  - Der Fokus nach `GEAENDERT` hat keinen Unit-Test (im Browser geprüft).
  - Der Stepper gibt keinen Ref auf sein Feld heraus; nach `GEAENDERT` stünde der Fokus besser im Feld („Kann“).
  - Größen zu einer Zeile zusammenfassen wäre ein eigener Auftrag.
- **141:** `.claude/skills/pruefen/SKILL.md` fragt den Rückgabetyp noch ohne die Ausnahme für React-Komponenten (außerhalb der Grenze); der Satz „Datum mit Uhrzeit gilt noch als Nummer“ gehört ins JSDoc von `TELEFON_NUMMER`; der Commit-Text `62a04fe` schreibt „Voller Lauf grün“ groß (nichts umgeschrieben).

## 9. Für dich zu bestätigen bzw. zu entscheiden
- **139, Geld-Fund:** Willst du die Wache allein (PR #347, Basis `docs/lauf21`) und den Fix von `produkt-preis.ts` als eigene Nummer? Oder beides zusammen? Ein Fix muss den Bestandseintrag in `tests/geld-number-wache.test.ts` mitziehen.
- **Grenzerweiterung 140:** `src/components/ui/dialog.tsx` und `sheet.tsx`. Sie setzen „kein Ziel“ um ihr Popup, wie es Punkt 3 verlangt. Keine andere Nummer dieses Laufs berührt die beiden Dateien. In der App ändert sich nichts, weil heute kein Menü in einem Dialog oder Blatt steht.
- **140 und 141: je ein Eintrag in `DEVELOPMENT.md`**, obwohl die Grenzliste ihn nicht nennt (144 hat die Datei in ihrer Grenze). Er entspricht der Doku-Pflicht des Rahmens und der Regel der Freigabe „DEVELOPMENT.md: je ein Eintrag“.
- **138:** Ziele mit `*` am Anfang blocken weiter wie auf main. Das geht über die wörtliche Liste der Freigabe hinaus, damit keine Lücke entsteht.
- **Nachrunde des Dirigenten bei 140:** Die Sätze zu Punkt 1 und 5 in TESTING_GUIDELINES stehen jetzt im Wortlaut der Freigabe. Der Umsetzer hatte sie um Beispiele erweitert; die Beispiele stehen weiter in DEVELOPMENT.md.
- **Doku-PR, N24 im Register:** Die Ergänzung zu N24 steht als eigener Eintrag mit der Zeile „Haupteintrag kommt mit dem Fix (PR #345)“. Wenn #345 kommt, gehört sein Haupteintrag dorthin, und diese Zeile entfällt.
- **Doku-PR:** Der volle Lauf lief mit `--maxWorkers=2`, weil nur die Prüfung von main gleichzeitig lief. G10 hätte bei zwei Läufen 1 verlangt. Am Ergebnis ändert das nichts.

## 10. Für dich zu tun

**Abnahme in der Vorschau** (ausführen nur durch dich):
- **137** (Hof der **Entwicklungsdatenbank**, nicht als Testhof markiert, mit aktiver Abholzeit):
  - Im Hofbereich die Pause einschalten → /hoefe zeigt sie sofort, nicht erst nach 5 Minuten.
  - Eine Abholzeit abschalten bzw. wieder einschalten oder den Hofnamen ändern → /hoefe zeigt es sofort.
  - Eine Pausen-Nachricht mit mehr als 300 Zeichen wird abgelehnt, der Zähler steht am Feld.
  - Die Prüfung „Noch nicht bestellbar“ aus Punkt 1 gibt es noch nicht, denn #345 fehlt.
- **138:** nichts in der Vorschau. Lokal: `pnpm vitest run tests/gefahr-blocken.test.ts` (322 Tests).
- **139** (Entwurf #347, erst nach deiner Entscheidung): nichts in der Vorschau. Lokal auf dem Branch: `pnpm vitest run tests/geld-number-wache.test.ts` → grün; eine neue Datei mit `Number(o.totalAmount)` → rot.
- **140:**
  - `/admin?reiter=alle` am Handy: „⋯“ bei einem Hof → Menü unter dem Knopf, Esc schließt, der Fokus kehrt zurück.
  - Dasselbe mit „Mehr zu …“ in `/admin/postfach?reiter=meldungen`.
  - Dafür braucht es ein Konto mit Admin-Recht und Passkey in der Entwicklungsdatenbank.
  - Hofbereich am Computer: „+ Neu“ in der Seitenleiste öffnet wie vorher.
- **142:** nichts in der Vorschau.
- **144** (/products, 390 px, Entwicklungsdatenbank):
  1. Ein Produkt mit 3 kg steht unter „Braucht dich“ mit „Nur noch 3 kg“.
  2. Im Blatt „+25“ und „Speichern“ → 28 kg, das Produkt steht unter „Im Shop“, der Fokus auf seinem Vorrat-Knopf.
  3. „Ausverkauft“ → 0, das Produkt steht unter „Braucht dich“ mit Schild „Ausverkauft“.
  4. Lupe → Feld über den Filtern, Fokus darin; Tippen → einfache Liste ohne Abschnitte.
  5. Ab 1024 px ist die Tabelle wie vorher.
- **141:** nichts in der Vorschau. Lokal: `wc -m docs/ai/CODING_STANDARDS.md docs/ai/TESTING_GUIDELINES.md` → zusammen 71 137 statt 79 747; eine gekürzte Regel (z. B. Zuweisungen mit „token“) steht im JSDoc von `ersetzeZuweisungen`.

**Merge:**
1. Den Sammel-PR [#354](https://github.com/Uttoranger/FarmerZone/pull/354) **per Merge-Commit** (nicht Squash). Danach gelten die Einzel-PRs als gemergt. 142 ist schon in `integration/lauf21` gemergt und kommt mit dem Sammel-PR auf main.
2. Danach die **CI auf `main`** ansehen.
3. **Ab dem Merge gilt der neue Hook** (138). Commit-Texte beginnen mit `feat:`, `fix:`, `docs:`, `chore:`, `refactor:` oder `WIP:`, Merge-Commits mit „Merge “; bei `-F <datei>` liest der Hook die erste Zeile der Datei. Eine Zeile `git commit -m …` in einem Here-Document wird mitgeprüft (gewollt vorsichtig). Das rekursive Löschen ist in jeder Schreibweise gesperrt.
4. **139** (#347) erst nach deiner Entscheidung (Abschnitt 9).
5. **#345** („Kaufen nur mit Abholtermin“) ist weiter offen. Ist er gemergt, können 143 und der Rest von 137 laufen.
6. **124** (#329) bleibt bis zur rechtlichen Prüfung liegen.

**Nach dem Merge:**
- Ab **28.10.** die CSP-Meldungen in Sentry ansehen (Tag `bereich:csp`) und den Auftrag „CSP scharf“ freigeben. Vorher im Stripe-Dashboard nachsehen, ob Link an ist (`docs/betrieb/stripe-live.md`, „0. Vorher“).

**Entscheidungen für Lauf 22:**
- Backups der Produktion.
- #345 mergen? Danach 143 (Mein Hof v3) und 137 Punkt 1, 2 und 5.
- 139: Fix von `produkt-preis.ts` (in ganzen Cent rechnen) als eigene Nummer.
- Die Nacharbeit aus Morgenbericht 20 §10 und aus diesem Bericht (Abschnitt 8).
- Die Liste „Nicht in diesem Lauf“ der Freigabe.
