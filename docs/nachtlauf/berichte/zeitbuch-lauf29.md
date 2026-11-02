# Zeitbuch Lauf 29 (2.11.2026, Cloud-Sitzung Linux)

Vom Dirigenten geführt (freigabe.md §33, §0 „Zeitbuch“). Rechner: **4 Kerne**, 15 GB (Cloud-Container). Typecheck mit `NODE_OPTIONS=--max-old-space-size=6144` (ohne: Speichermangel bei 2 GB Standard-Heap). Worker nach G10 über `laeufe/` (Skript `voll.sh` des Dirigenten). Höchstens drei Umsetzer gleichzeitig.

## Dirigent

- 19:2x Start auf main 96a43e30. Erster Start auf dem Windows-Rechner der Projektleitung war vor jedem Gate gestoppt (CRLF, Backslash-Pfade); kein Branch, kein Commit.
- Stand: `pnpm install --frozen-lockfile` grün; `prisma generate` nachgeholt (wie CI-Schritt; ohne Client Typecheck rot); Typecheck grün, Lint 0 Fehler (2 Warnungen), voller Lauf 656 Dateien, 12119 Tests grün (3 Worker, 233 s). Integration ganz auf lokaler Wegwerf-DB: 94 Dateien, 770 Tests grün (416 s).
- Stripe: Produktion Kasse `testbetrieb: true` (Abruf über Vercel, testhof); Vorschau sperrt Live-Schlüssel im Code (`stripeStartGesperrt`).
- Lokales Postgres 16 gestartet; je Worktree eine eigene Test-DB (`farmerzone_test_<nr>`), daher keine Integrationssperre nötig.
- agent-browser nicht installiert (globale Installation wäre ein Paket ohne Freigabe) → alle Bilder entfallen.
- Doku-PR #441 (fad0c99, Freigabe byte-gleich per diff geprüft).
- Welle 1 von `docs/lauf29`: 211, 218, 216 gleichzeitig; 217 folgt bei freiem Platz.
- Sentry (lesend): letzte 7 Tage ein Ereignis aus Erweiterungen (NEXTJS-H); -8 zuletzt vor 16 Tagen.
- 216 → #442 gegen `docs/lauf29` (e0c9427; voller Lauf 656 Dateien, 12135 Tests; pruefer gezielt grün, 4 Sollte als Nacharbeit; tester entfällt, Commit schon voll geprüft).
- 218: 74c025b (voller Lauf 657 Dateien, 12144 Tests; Integration futter-familie 11 Tests); tester und pruefer gleichzeitig.
- 217 gestartet, als 216 fertig war.
- 218 → #443 gegen `docs/lauf29` (tester gezielt 138 Tests, Integration 25 Tests; pruefer voll grün, 3 Sollte als Nacharbeit; Grenze erweitert: ruecktritt-felder.tsx, ein Satz ARCHITECTURE).
- 211 → #444 gegen `docs/lauf29` (b169fe9 Aufräumen, 29c2507 Einbinden; voller Lauf 658 Dateien, 12144 Tests; erster voller Lauf des Umsetzers rot nur durch die Zeitgrenzen-Wache am neuen Test, behoben; tester gezielt 284 Dateien, Integration 31 Dateien mit 253 Tests; pruefer voll grün, 5 Punkte Nacharbeit).
- Zwischenstand `integration/lauf29` = docs/lauf29 + 211 (b171598a, Baum gleich 29c2507, daher kein zweiter voller Lauf) → Basis für 215 (Welle 2).
- 217: eba1de9 (voller Lauf 656 Dateien, 12127 Tests; Integration widerruf 12 Tests); pruefer gezielt.
- 215 gestartet vom Zwischenstand.
- 217 Runde 1 (Blocker: zwei Seiten-Tests mockten noch `reorderPhotosAction`) → d8e5b95e, voller Lauf grün, Nachprüfung grün → #445 gegen `docs/lauf29`.
- 215: 36b8ead8 (voller Lauf 659 Dateien, 12160 Tests; Integration zahlung-erneut 6 Tests); tester und pruefer gleichzeitig.
- Sammelstand lokal (noch nicht gepusht, bis der 215-PR offen ist): + 216 (d40330db; voller Lauf 658 Dateien, 12160 Tests, 2 Worker), + 218 (86c871e5; 659 Dateien, 12185 Tests), + 217 (6cca5f3b). Konflikte nur DEVELOPMENT.md (beide Einträge behalten, Skript), BAUSTEINE.md nach jedem Merge mit `pnpm bausteine` neu erzeugt.
- 215 → #446 gegen `integration/lauf29` (tester gezielt 156 + 191 Tests, Integration 31 Dateien mit 253 Tests; pruefer voll grün, 4 Sollte).
- + 215 in den Sammelstand (76ae7f41, Konflikt nur DEVELOPMENT.md): voller Lauf 660 Dateien, 12209 Tests (2 Worker); Integration ganz 94 Dateien, 776 Tests (370 s).
- Regel 3 auf frischer Wegwerf-DB `farmerzone_r29`: `migrate deploy` aller Migrationen, `migrate diff --exit-code` ohne Unterschied; keine neue Migration im Lauf.
- CI (ci, integration) grün auf #441–#445; alle sieben Vorschauen READY.
- Merge-Reihenfolge in den Sammelstand: docs/lauf29 → 211 (Zwischenstand) → 216 → 218 → 217 → 215.
- Keine Container-Neustarts.
