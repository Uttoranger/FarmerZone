# Zeitbuch Lauf 32 (6.11.2026, Cloud-Sitzung Linux)

Vom Dirigenten geführt (freigabe.md §36). Rechner: **4 Kerne**, 15 GB (Cloud-Container). Typecheck und Bau mit `NODE_OPTIONS=--max-old-space-size=6144` (Umgebungsvariable des Laufs, keine Projektvariable). Start des Laufs: 6.11.2026 19:59 UTC (20:59 Wien).

Zeitbudget je Phase (Abschnitt A, Wanduhr ab Start; Abbruchregel: Phase überschritten → Nummer mit dem fertigen Stand abschließen bzw. als Entwurf, Rest im Bericht, nächste Nummer): 243a 45 min · 243 2,5 h (davon Admin 60 min) · 244 75 min · 259 3,75 h (inkl. zweiter Bau vor T) · 245–248 je 2 h · 256 90 min · 258 75 min · 249 2,5 h · Merges in den Zwischenstand zusammen ca. 1,5–2 h · Haltepunkt A mit Zwischen-Durchgang 2 h. Keine neue Nummer nach Stunde 11; Haltepunkt spätestens 13 h nach dem Start.

- 256 freigegeben: ja (Zeile 2 der Startnachricht)
- Geld-Kachel-Regel bestätigt: ja (Zeile 3 der Startnachricht)
- A005-Datei: ja (auf main, Wachen grün, keine Mail-Adressen außer erlaubten, keine Schlüssel-Präfixe)
- Register-Nummern: F = N45 (259/A005), N46 und N47 (dieser Lauf)

## Ausgangslage

main 6ce17420 = c8aadaed7 + nur docs/nachtlauf/berichte/{a005-agb-1-0-stichtag.md, a009b-auftrag-lauf32.md, lauf32-board-oder-code.md}; Ausgangslage im Code unverändert.

## Dirigent

- 19:59 §0a: agent-browser 0.39.1, Bild einer lokalen Seite gelungen.
- Postgres 16 im Container gestartet (localhost:5432).
- `pnpm install --frozen-lockfile` grün; `prisma generate` (der erste Typecheck war ohne generierten Client rot – Umgebung, kein Code).
- Kein `sk_live_`/`rk_live_` in der Umgebung (nur das Präfix geprüft).
- Doku-Wachen mit Liste und A005-Datei grün (3 Dateien, 49 Tests).
- 20:20 Grundlauf auf main 6ce17420 (n=1, 3 Worker, unter schwer.lock): Typecheck grün (51 s), Lint 0 Fehler/5 Warnungen (64 s), Test 686 Dateien, 12896 Tests, davon 1 rot: `tests/bild-format.test.ts` Laufzeitgrenze (572 ms statt < 500 ms unter Last). Allein dreimal wiederholt: 10/10 grün → Wackler unter Last, kein Code-Fehler; §0a gilt als bestanden. Regelvorschlag für den Morgenbericht (Laufzeit-Grenzen unter Last).
- 20:35 Doku-PR 243a (Sonnet): Commit 563acc21; Dirigent prüft §36 mechanisch gegen Auftragsdatei Z. 14–489 (diff leer) und korrigiert die N32-Ergänzung wörtlich („…ohne Testzahlungen; ersetzt …“).
- Startsätze, Register, A005: siehe Kopf. Worktrees unter /home/user/wt/<nr>, Integrations-DB je Nummer fz_int_<nr> auf localhost:5432; Sperren und laeufe/ unter .nachtlauf/dirigent/ im Haupt-Klon.
