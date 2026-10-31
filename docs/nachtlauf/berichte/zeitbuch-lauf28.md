# Zeitbuch Lauf 28 (31.10.2026, Wiener Zeit)

Vom Dirigenten geführt (freigabe.md §32, §0 „Zeitbuch“). Rechner: **4 Kerne** (Cloud-Container). Worker nach G10 wie Lauf 27; höchstens drei Umsetzer gleichzeitig. Typecheck mit `NODE_OPTIONS=--max-old-space-size=4096`.

## Dirigent

- 20:26 Start auf main 0eb716b1 (#432). `public/recht/gewaehrleistung-mitteilung-de.png` fehlt → Nr. 211 nicht begonnen.
- 20:33 Stand: main voll 651 Dateien, 12023 Tests grün (Lint 0 Fehler); Produktion Kasse `testbetrieb: true` (Abruf über Vercel); Vorschau sperrt Live-Schlüssel im Code.
- 20:35 Doku-PR #433 (64d62c93, Freigabe wörtlich geprüft). Welle 1 von `docs/lauf28`: 210, 212, 213; 208 ab 21:49.
- PRs gegen main (je voller Lauf vor dem Push):
  - 21:23 210 → #434 (652 Dateien, 12036 Tests)
  - 21:50 208 → #435 (652 Dateien, 12030 Tests)
  - 21:57 212 → #436 nach Dirigent-Nachbesserung (652 Dateien, 12042 Tests)
  - 22:13 213 → #437 (652 Dateien, 12036 Tests; Integration ganz 94 Dateien, 770 Tests)
- Zwischenstand `integration/lauf28`:
  - 333affe9 = docs/lauf28 + 210 → Basis für 214 (Welle 2, gestartet 21:49).
  - 57c03d24 + 208 + 212 + 213 (Konflikte nur DEVELOPMENT.md): erster voller Lauf rot nur durch die Laufzeitprüfung in `tests/bild-format.test.ts` (689 ms unter Parallel-Last, wie Lauf 26), Wiederholung 655 Dateien, 12075 Tests, Integration 94 Dateien, 770 Tests. Gepusht.
  - 4a89a89f + 214 (Konflikt nur DEVELOPMENT.md) → Sammelstand: voller Lauf grün bis auf die Telefonnummern-Wache, die das noch nicht committete Zeitbuch las (Zählungen als „n/m“ sahen wie Nummern aus; umformuliert); Integration ganz 94 Dateien, 770 Tests.
- 214 → #438 gegen `integration/lauf28` (653 Dateien, 12080 Tests; Integration ganz 94 Dateien, 768 Tests).
- Dirigent-Nachbesserung als eigene Runde: 212 (Feld leer statt Anmelde-Adresse, Pflicht serverseitig, `freischaltSperre`, Profil, Anker, dunkle Bilder). Kleine Korrekturen selbst: 213 (`utcTag`, Sentry-Merkmal). Entscheidungen im Bericht: 210, 213, 214.
- Zählung 212 in der Produktion (lesend, nur Zahlen): 0 von 4 freigeschalteten Höfen ohne Hof-E-Mail.
- Regel 3 auf frischer Wegwerf-DB (`farmerzone_r28`): alle Migrationen einschließlich `20261031200000_ruecktritt_je_produkt`, `migrate diff --exit-code` ohne Unterschied.
- Keine Container-Neustarts.
