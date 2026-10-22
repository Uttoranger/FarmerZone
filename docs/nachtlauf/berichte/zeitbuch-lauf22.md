# Zeitbuch Lauf 22 (22.10.2026, Wiener Zeit)

Vom Dirigenten geführt (freigabe.md §26, §0 „Zeitbuch“). Rechner: **4 Kerne** (Cloud-Container). Worker nach G10 und G10-Ergänzung: allein `max(2, floor(3/2)) = 2`, Dirigent allein im Zwischen- und Sammelstand `Kerne−1 = 3`, bei n gleichzeitigen vollen Läufen `max(1, floor(3/n)) = 1`. Gezählt über eine Datei je laufendem vollem Lauf im Ordner `laeufe/` der Skripte des Dirigenten (`voll.sh`), Integration unter `integration.lock` (`int.sh`).

## Dirigent

- 21:29–21:34 Stand auf main 5b13856: install, typecheck, lint 0 Fehler (5 Warnungen), test 530 / 9979 grün (n=1, 2 Worker). #345 (`kaufSperre`, `kauf-sperre-hinweis.tsx`) und #347 (`geld-fliesskomma-wache`, `geld-namen.ts`) auf main.
- Postgres im Container war aus (Neustart des Containers) – gestartet vor dem ersten Integrationslauf. Lokale Bilder-DB `farmerzone_bilder` mit Seed unter `integration.lock` angelegt.
- 21:34 Doku-PR: Worktree; Umsetzer (Sonnet) bis 21:44; PR #355 21:45.
- 21:47 Welle 1: 145, 143, 146 je als eigener Workflow (Umsetzer → tester ∥ pruefer → bis zu zwei Runden), Basis a0fa7fc2.
- 22:17 145 fertig → PR #356; Platz an 148 (Start 22:18).
- 22:27 Dev-Server 143 (Port 3143, Bilder-DB) für den sichter; sichter bis ~22:34; Blocker → Runde 1 ab 22:35.
- 22:38 146 fertig → PR #357 (Grenze `tests/marke-name-wache.test.ts` vom Dirigenten erweitert).
- 22:47 148 fertig → PR #358. Zwischenstand `integration/lauf22`: 145, 146, 148 (Konflikte nur DEVELOPMENT.md, beide Seiten).
- 22:50 143 fertig → PR #359; Merge in den Zwischenstand (Konflikt nur DEVELOPMENT.md), `pnpm bausteine` ohne Abweichung.
- 22:52:39–22:58:00 Zwischenstand voll (n=1, **3 Worker**): 535 / 10088; 22:58:00–23:02:55 Integration ganz 71 / 625. Push.
- 23:04 147 vom Zwischenstand (a9bbc613).
- 23:15 Regel 3: frische DB, 35 Migrationen, `migrate diff --exit-code` ohne Unterschied.
- 23:20 147 fertig → PR #360; Merge in den Sammelstand.
- 23:21:32–23:25:27 Sammelstand voll (n=1, **3 Worker**): 536 / 10095; 23:25:27–23:30:18 Integration ganz 71 / 625.
- CI aller PRs (#355–#359) grün vor dem Start von 147 bzw. vor dem Sammel-PR.

## Je Nummer

| Nr | Umsetzer | voller Lauf (n, Worker) | Integration | tester ∥ pruefer | Runden | sichter |
|---|---|---|---|---|---|---|
| Doku | 21:35–21:44 | 21:36:57–21:43:16 (1, 2) | – | – | – | – |
| 145 | 21:47–22:13 | 22:01:47–22:12:34 (2, 1) | 21:53:21–21:59:29 ganz | 22:13–22:16 | 0 | – (Bild vom Umsetzer) |
| 143 | 21:47–22:23 | 22:13:05–22:22:31 (2, 1); R1 22:39:00–22:48:54 (2, 1) | – | 22:23–22:27; R1 22:50–22:52 | 1 | 22:27–22:34 |
| 146 | 21:47–22:15 | 21:58:29–22:05:21 (1, 2) rot; 22:05:47–22:14:57 (2, 1); R1 22:17:31–22:26:56 (2, 1); R2 22:28:12–22:37:39 (2, 1) | – | je Runde ~2–3 min | 2 (nur Bericht) | – |
| 148 | 22:18–22:33 | 22:21:28–22:32:12 (3, 1); R1 22:36:35–22:45:23 (2, 1) | 22:20:57–22:21:16, 22:36:17–22:36:32 (eine Datei) | 22:33–22:35; R1 22:45–22:47 | 1 | – |
| 147 | 23:04–23:13 | 23:05:35–23:12:05 (1, 2); R1 23:15:02–23:19:54 (1, 2) | – | 23:13–23:15; R1 23:20 | 1 | – |

Wartezeit auf die CI: keine Wartezeit, die den Lauf aufhielt – die CI der Welle-1-PRs war fertig, bevor der Zwischenstand gepusht war.

## Drei Sätze

- **Wohin ging die Zeit?** In die vollen Läufe, wenn drei Nummern gleichzeitig liefen (je 1 Worker, 9–11 Minuten je Lauf), und in Runden, die nur den Bericht änderten (146: zwei Runden mit je vollem Lauf wegen einer Grenzfrage, die der Dirigent hätte sofort entscheiden können).
- **Was hat die G10-Ergänzung gebracht?** Allein laufende volle Läufe mit 2 Workern dauerten 4,5–6,5 Minuten, die des Dirigenten mit 3 Workern 3,9–5,4 Minuten; in Lauf 21 waren es allein mit 1 Worker rund 8 Minuten. Bei sieben solchen Läufen sind das zusammen etwa 20 Minuten weniger.
- **Nächster Hebel:** Grenzfragen und reine Berichtsänderungen ohne vollen Lauf entscheiden (der Workflow meldet „GRENZE (Dirigent)“ jetzt getrennt, ab 147), und gleichzeitige volle Läufe zeitlich versetzen, damit öfter einer allein mit 2 Workern läuft.
