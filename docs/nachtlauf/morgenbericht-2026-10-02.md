# Morgenbericht Nachtlauf 2026-10-02

Dirigent: Hauptsitzung in einer Cloud-Sitzung (nicht über `claude -p`, siehe „Abweichungen vom Ablauf").
Lauf gestartet am 02.10.2026, am Wochenlimit der API unterbrochen und am 05.10.2026 fortgesetzt.
Bearbeitet: Nummern 03 bis 06. **Der Haltepunkt 06 aus `freigabe.md` ist erreicht.** Nummer 07 wurde nicht begonnen.

## 1. Bearbeitete Nummern

| Nr | Gate | Status | PR | Basis | Weggelassen und warum |
|---|---|---|---|---|---|
| 03 | H3 Bar-Bestätigung per Knopf | fertig | #166 | `main` | Nichts. Die Mockup-Abweichungen hast du inzwischen freigegeben. Den Mail-Text „48 Stunden" hat dein Nachtrag im selben PR korrigiert. |
| 04 | Servicegebühr 5 %, immer aufrunden (E4) | fertig | #167 | #166 | Der Spalten-Default `@default(4.9)` bleibt, weil diese Migration für Nr. 04 nicht freigegeben war. Bestehende Höfe behalten ihren gespeicherten Satz. |
| 05 | Bausteine und Shells (Gate 2) | fertig | #168 | #167 | Wegen E8 fehlen „Meine Höfe", das Konto-Menü, „Merken" und „Neuigkeiten". Die Dreiteilung im Neu-Menü kommt mit Nr. 18. Für angemeldete Kundinnen fehlt „Meine Bestellungen", weil es unter `/account` keine Bestellseite gibt. |
| 06 | Schema-Expand (Gate 3.5) | fertig, **Entwurf** | #169 | #168 | Nicht freigegeben und deshalb weggelassen: `Farm.betriebsnummerGeprueftAm` (E9), `Merkliste` (E8) und `RueckrufAnfrage`. Es gibt keinen Feature-Code, nur Schema und Migration. |

Jedes Gate lief in derselben Reihenfolge:
- Ein Umsetzer setzte das Gate in frischem Kontext um.
- `tester` und `pruefer` prüften es anschließend.
- Es gab höchstens eine Nachbesserungsrunde; eine zweite war nie nötig.
- Vor dem Push habe ich die Tests selbst wiederholt.

Stand auf #169: 186 Testdateien mit 3118 Tests grün, Integration 12 Dateien mit 82 Tests grün. Lint meldet in keiner geänderten Zeile einen neuen Befund. Der Altbestand auf `main` ist unverändert rot, mit 26 Fehlern und 9 Warnungen.

## 2. Merge-Reihenfolge

Die PRs sind gestapelt. Nach jedem Merge stellt GitHub die Basis des nächsten PR auf `main` um.

1. **#166** Nr. 03, Basis `main`.
2. **#167** Nr. 04.
3. **#168** Nr. 05. Vorher den Slug in der Produktion prüfen, siehe Abschnitt 3.
4. **#169** Nr. 06. Den PR erst aus dem Entwurf nehmen, wenn die Geldfeld-Frage entschieden ist. **Nach dem Merge die Migration einspielen** (`pnpm db:migrate` gegen Produktion, wie üblich durch dich).

Gibt es zwischendurch einen Konflikt in `docs/nachtlauf/status.md`, ist er rein mechanisch: Es gilt jeweils die neueste Zeile.

## 3. Fragen und fehlende Freigaben

**Vor einem Merge zu klären:**
- **#169, Geldfelder:** Willst du Int-Cent (A) oder `Decimal(10,2)` (B)?
  - Betroffen sind `Order.erstattetCents` und die Beträge der `Monatsabrechnung`.
  - Variante A ist die Empfehlung des Prüfers. Sie behält Cent wie `serviceFeeCents` und braucht eine Ausnahme in `docs/ai/ARCHITECTURE.md`.
  - Variante B muss vor dem Einspielen umgesetzt werden, weil die Umstellung danach destruktiv wäre.
- **#169, Migration von Hand:** Bitte die Abweichung abnicken.
  - Der vorgeschriebene Befehl `migrate dev --create-only` scheitert an der Shadow-Datenbank mit P3006, und zwar für jede Migration.
  - Vorschlag für Regel 3 in `docs/nachtlauf.md`: `prisma migrate diff --from-schema … --to-schema … --script`. Das kommt ganz ohne Datenbank aus.
  - Beim selben Anlass sollte Regel 3 beachten, dass `prisma.config.ts` die Variable `DIRECT_URL` vor `DATABASE_URL` liest.
- **#168, Produktion nur lesend prüfen:** `SELECT slug FROM "Farm" WHERE slug = 'intern';`
  - Der Slug ist jetzt für die Vorschau-Seite reserviert.
  - Gibt es schon einen Hof mit diesem Slug, wäre seine Hofseite nach dem Deploy nicht mehr erreichbar.
- **#168, freigeben:**
  - Die kleine Änderung am Bestand: Der Link „Mehr erfahren" im Cookie-Hinweis ist auf allen Seiten immer unterstrichen und im dunklen Theme heller. Dazu kommt eine `section`-Landmarke.
  - Die Mockup-Abweichungen, die der Bericht in Abschnitt 4 aufzählt.

**Entscheidungen ohne Eile:**
- **Nr. 04, Satz des Pilothofs:** Bitte in `/admin` auf 5 % stellen.
  - Wenn neue Höfe auch ohne `createFarm` sicher 5 % bekommen sollen, brauchen wir eine nicht destruktive Migration `SET DEFAULT 5` für `Farm.serviceFeePercent`. Die müsstest du freigeben.
- **Nr. 05, vorläufige Ziele:** Sie gelten, bis die eigentlichen Seiten gebaut sind.
  - Kunden-„Bestellungen" führt abgemeldet zu `/account/login` und angemeldet zu `/account/profile`, bis Nr. 08 bzw. 14 die Seite „Bestellungen finden" baut.
  - „Region" führt zu `/analytics/umfeld`, bis Gate 8 kommt.
- **Für den nächsten Lauf:**
  - Nr. 08 braucht E7 und E8. Beide sind freigegeben, es fehlt nichts.
  - Nr. 21 braucht das Paket `qrcode`, das ist ebenfalls freigegeben.

**Aufgefallen, nicht behoben** (Altlasten, keine Gate-Aufgabe):
- In `RESERVED_SLUGS` (`src/lib/slug.ts`) fehlen mehrere Ordner aus `KEINE_HOFSEITE`, zum Beispiel `teilen`, `verify`, `konditionen`, `meldungen`, `fehler-melden`, `problem-melden`, `farm-page`, `forgot-password` und `reset-password`.
- `farmer-nav.tsx` zeigt weiterhin keinen sichtbaren Tastatur-Fokus, und `signOut()` läuft dort ohne Fehlerbehandlung. Beides verschwindet, wenn die Navigation in die HofShell umzieht.
- `storniereUnbezahlteBestellung` bucht pro Position einzeln mit `increment` zurück.

## 4. Screenshots

Sie liegen lokal in der Cloud-Sitzung unter `.nachtlauf/screens/` und sind nicht committet:
- `03/`: 9 Bilder. Die Bestätigungsseite bei 390 und 1440 px in hell und dunkel, dazu die Zustände storniert, ungültig und nach dem Bestätigen.
- `05/`: 42 Bilder. Die Vorschau `/intern/bausteine` und alle fünf Shell-Varianten bei 390, 1024 und 1440 px in beiden Themes, dazu offene Blätter und ein Bild mit Tastaturfokus.
- Nr. 04 und Nr. 06 haben keine Screenshots, weil sie keine UI ändern.

Wenn die Cloud-Sitzung endet, sind die Bilder weg. Neu erzeugen geht mit der lokalen App gegen eine Wegwerf-Datenbank, der Ablauf steht in `DEVELOPMENT.md`.

## 5. Abweichungen vom Ablauf in `docs/nachtlauf.md`

- **Ausführung:** Der Dirigent lief interaktiv in einer Cloud-Sitzung, nicht mit `claude -p` und `--max-budget-usd`. PRs entstanden über die GitHub-Schnittstelle der Sitzung, nicht über `gh pr create`. Das Pushen auf `nacht/…`-Branches hat funktioniert.
- **Unterbrechung:** Am 02.10. traf der erste Umsetzer das Wochenlimit der API. Am 05.10. setzte er seinen erhaltenen Zwischenstand fort, nichts ging verloren.
- **Testdatenbank:** Die lokale Test-Datenbank ist der Postgres-Cluster des Containers mit `TEST_DATABASE_URL` auf localhost, eingetragen in `.env.test`, das nicht committet wird. Für die Screenshots lief die App gegen genau diese Datenbank, mit Variablen direkt auf der Kommandozeile und ohne `.env.local`.
- **Nachtrag zu #166:** Den Nachtrag für #166 hast du am 05.10. selbst beauftragt (`/fix`).
  - Ich habe ihn in einem eigenen Worktree gebaut, damit der laufende Umsetzer von Nr. 05 nicht gestört wurde.
  - Danach habe ich Branch 03 per Merge-Commit in 04 und 04 in 05 übernommen, ohne Force-Push. Der Konflikt betraf nur `status.md`.
- **Migration von Hand:** Siehe Abschnitt 3, erster Punkt.
