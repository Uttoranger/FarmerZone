# Zeitbuch Lauf 26 (26./27.10.2026, Wiener Zeit)

Vom Dirigenten geführt (freigabe.md §30, §0 „Zeitbuch“). Rechner: **4 Kerne** (Cloud-Container), 15 GB Speicher. Worker nach G10: allein 2, Dirigent allein im Zwischen- und Sammelstand 3, bei n gleichzeitigen vollen Läufen `max(1, floor(3/n))`. Gezählt über eine Datei je laufendem vollem Lauf (`voll.sh`), Integration unter einer Sperre (`int.sh`). Typecheck mit `NODE_OPTIONS=--max-old-space-size=4096`.

## Dirigent

- 26.10. 20:36 Stand auf main 7f073ae8 voll grün. Doku-PR #403 (8212c743) grün.
- Welle 1 ab 20:55: 188, 184, 195, dann 196, 192, 194 (höchstens drei Umsetzer). PRs #404–#409 gegen main.
- Zwischenstände `integration/lauf26` (je voll + Integration ganz, dann Push):
  - 2dd20e27 = 188 + 184 + 195 + 194: voll 607/11301, Integration 85/722.
  - 62285feb + 196: voll 609/11328, Integration 85/722.
  - 2db29276 + 192: voll 11350 grün.
  - 5adf98e4 + 185, 186 (Konflikt Seitenwache, elf Seiten): voll 614/11433, Integration 86/727.
  - 339943b8 + 187 (Konflikte mit 185: /admin = Heute, /admin/hoefe = 187; Aufgaben je Hof → Akte): erster Lauf rot nur durch die Laufzeitprüfung in `tests/bild-format.test.ts` (598 ms), Wiederholung 617/11474 grün, Integration 87/729.
  - 43b24706 + 189 (189 vorher mit dem Zwischenstand zusammengeführt und Punkt 4 nachgebaut): voll 619/11504, Integration 88/736.
  - 650d5552 + 191 (Konflikte Aufgaben/Heute: beide Quellen): voll 622/11548, Integration 89/737.
  - 0bd19d02 + 197 (20 Konflikte; Kasse: Idempotenz → Notbremse → Hof → Plattformgebühr): voll rot (28 Tests: Notbremse-Leser gegen Attrappen aus 197, Ladungstyp-Wache las noch orders.ts) → Dirigent-Fix dc0c2225; voll 626/11602, Integration 89/738.
  - fdbf0dd7 + 190 (Konflikte Einstellungen, DESIGN_SYSTEM, Bestätigungsseite): voll 632/11663, Integration 90/744.
  - 8bdf5489 + 198 (Stand 9fb43d0d) → Wache Sichtbarkeit rot (zwei neue Leser) → Dirigent-Fix 53a0c1b4; voll 634/11719, Integration 91/746.
  - 7862ae2b + Nachbesserung 198: erster Lauf nur Laufzeitprüfung rot (583 ms), Wiederholung 634/11730 grün, Integration 91/746.
  - cc350e7a + 193 (ohne Konflikt) → Sammelstand.
- Container-Neustarts: drei (zuletzt auf einem anderen Rechner). Verloren: laufende Umsetzer von 187 (Prüfung), 189, 197, 191, 190 und zwei volle Läufe; neu gestartet bzw. fortgesetzt (Workflow-Cache), seitdem WIP-Commits.
- Dirigent-Nachbesserungen als eigene Runde: 189 (Nachbau Heute), 197 und 198 (Geld). Kleine Korrekturen selbst: 186, 187, 191, 192, 193, 195.
- Sammelstand cc350e7a: voll 636/11756 grün (n=1, 3 Worker), Integration ganz 91/746. Regel 3 auf frischer Wegwerf-DB: 36 Migrationen einschließlich `20261026100000_regelbetrieb`, `migrate diff --exit-code` ohne Unterschied.

## Rohzeilen (Wiener Zeit, `name start–ende n workers rc`)

| Lauf | Zeit | n | Worker | rc |
|---|---|---|---|---|
| start26-main | 20:36:29-20:42:32 | 1 | 3 | 0 |
| doku26 | 20:41:58-20:52:53 | 2 | 1 | 0 |
| int-184 | 21:12:46-21:13:08 | – | – | 0 |
| int-195 | 21:15:39-21:16:25 | – | – | 0 |
| 184 | 21:15:16-21:25:08 | 1 | 2 | 1 |
| 195 | 21:16:58-21:28:59 | 2 | 1 | 1 |
| 184 | 21:26:08-21:37:24 | 2 | 1 | 0 |
| 195 | 21:30:37-21:41:15 | 2 | 1 | 0 |
| int-188 | 21:42:17-21:42:35 | – | – | 0 |
| int-188 | 21:46:17-21:52:53 | – | – | 1 |
| 195-nb | 21:47:47-21:53:45 | 1 | 2 | 0 |
| int-188 | 21:53:33-21:54:06 | – | – | 0 |
| int-188 | 21:56:57-22:03:01 | – | – | 0 |
| int-194 | 22:03:01-22:03:18 | – | – | 0 |
| 188 | 22:03:19-22:08:50 | 1 | 2 | 1 |
| 194 | 22:04:09-22:14:37 | 2 | 1 | 1 |
| 188 | 22:09:26-22:20:06 | 2 | 1 | 0 |
| 194 | 22:15:09-22:24:55 | 2 | 1 | 0 |
| int-196 | 22:24:50-22:25:34 | – | – | 0 |
| int-188 | 22:27:21-22:27:45 | – | – | 0 |
| 188-nb1 | 22:27:48-22:33:44 | 1 | 2 | 0 |
| 194-nb1 | 22:31:11-22:40:58 | 2 | 1 | 0 |
| 196 | 22:32:45-22:42:39 | 3 | 1 | 1 |
| 188-runde2 | 22:37:26-22:47:13 | 3 | 1 | 0 |
| 196 | 22:43:35-22:52:31 | 2 | 1 | 0 |
| int26-a | 22:49:46-23:01:34 | 2 | 1 | 0 |
| 192 | 22:54:14-23:04:03 | 2 | 1 | 1 |
| int-int26-a | 23:01:34-23:07:35 | – | – | 0 |
| 192 | 23:05:44-23:10:54 | 1 | 2 | 0 |
| int26-b | 23:09:27-23:19:32 | 2 | 1 | 0 |
| 192b | 23:15:24-23:25:27 | 2 | 1 | 0 |
| int-int26-b | 23:19:32-23:26:51 | – | – | 0 |
| int26-c | 23:27:22-23:31:47 | 1 | 3 | 0 |
| int-186 | 23:34:54-23:35:13 | – | – | 1 |
| int-186 | 23:35:26-23:35:40 | – | – | 1 |
| int-186 | 23:35:59-23:36:13 | – | – | 0 |
| 186-a | 23:36:49-23:37:03 | 2 | 1 | 2 |
| 185 | 23:36:19-23:42:40 | 1 | 2 | 1 |
| 185 | 23:43:46-23:51:04 | 1 | 2 | 0 |
| int-186 | 23:47:23-23:54:11 | – | – | 0 |
| 186 | 23:54:27-23:59:20 | 1 | 2 | 0 |
| int-187 | 23:58:52-00:00:10 | – | – | 0 |
| 185-n1 | 23:59:26-00:04:25 | 1 | 2 | 0 |
| 187 | 00:02:44-00:11:16 | 2 | 1 | 0 |
| 186b | 00:04:36-00:13:01 | 2 | 1 | 1 |
| 186b | 00:16:21-00:25:43 | 1 | 3 | 1 |
| int-186b | 00:25:43-00:34:07 | – | – | 0 |
| 187-nb1 | 00:23:19-00:35:02 | 2 | 1 | 0 |
| int-189 | 00:38:47-00:39:07 | – | – | 1 |
| int-189 | 00:39:28-00:39:46 | – | – | 0 |
| int26-d | 00:36:15-00:41:34 | 1 | 3 | 0 |
| 187-r2 | 00:36:29-00:45:57 | 2 | 1 | 0 |
| int-int26-d | 00:41:34-00:47:44 | – | – | 0 |
| 187d | 00:53:22-01:00:29 | 1 | 3 | 0 |
| int-189 | 00:55:18-01:02:59 | – | – | 0 |
| int26-e | 01:04:50-01:10:08 | 1 | 3 | 1 |
| 189 | 01:10:20-01:16:09 | 1 | 2 | 0 |
| int-int26-e | 01:10:08-01:16:56 | – | – | 0 |
| int26-f | 01:17:29-01:21:27 | 1 | 3 | 0 |
| int-197 | 01:36:35-01:41:44 | – | – | 1 |
| int-197 | 01:42:30-01:42:40 | – | – | 0 |
| int-189 | 01:42:40-01:48:04 | – | – | 0 |
| 191 | 01:46:32-01:51:30 | 1 | 2 | 1 |
| int-197 | 01:52:53-01:58:44 | – | – | 0 |
| 189 | 01:49:17-01:58:53 | 2 | 1 | 0 |
| 197 | 01:54:01-02:02:20 | 2 | 1 | 1 |
| int-191 | 01:58:44-02:04:01 | – | – | 0 |
| int-191 | 02:05:32-02:05:43 | – | – | 0 |
| 189c | 02:03:29-02:07:10 | 1 | 3 | 0 |
| 197 | 02:03:31-02:11:21 | 2 | 1 | 0 |
| int26-g | 02:08:06-02:13:37 | 3 | 1 | 0 |
| 191 | 02:06:44-02:13:37 | 3 | 1 | 0 |
| int26-g | 02:15:50-02:23:19 | 1 | 3 | 0 |
| int-191 | 02:17:38-02:25:41 | – | – | 0 |
| 197-nb1 | 02:23:22-02:29:37 | 1 | 2 | 0 |
| int-int26-g | 02:25:41-02:33:37 | – | – | 0 |
| 191 | 02:25:57-02:36:45 | 2 | 1 | 0 |
| 197 | 02:39:26-02:45:20 | 1 | 2 | 0 |
| int-197 | 02:45:28-02:52:22 | – | – | 0 |
| 191b | 02:42:29-02:52:41 | 2 | 1 | 0 |
| int26-h | 02:55:39-03:00:29 | 1 | 3 | 0 |
| int-int26-h | 03:00:29-03:06:26 | – | – | 0 |
| int-190 | 03:06:26-03:06:46 | – | – | 0 |
| 190 | 03:09:15-03:15:30 | 1 | 2 | 1 |
| int26-i | 03:09:50-03:20:11 | 2 | 1 | 1 |
| int-int26-i | 03:20:11-03:26:28 | – | – | 0 |
| 190 | 03:16:48-03:27:17 | 2 | 1 | 0 |
| int26-j | 03:28:19-03:34:03 | 1 | 3 | 0 |
| int-190 | 03:36:26-03:36:44 | – | – | 0 |
| 190-nb1 | 03:37:06-03:42:19 | 1 | 2 | 0 |
| 190b | 03:45:55-03:51:04 | 1 | 3 | 0 |
| int-190b | 03:51:05-03:57:37 | – | – | 0 |
| 198 | 03:53:20-04:00:00 | 1 | 2 | 1 |
| int26-k | 04:00:28-04:04:49 | 1 | 3 | 0 |
| int-int26-k | 04:04:49-04:11:01 | – | – | 0 |
| int-198 | 04:11:01-04:11:16 | – | – | 0 |
| int-198 | 04:11:38-04:17:43 | – | – | 0 |
| 198 | 04:22:33-04:28:33 | 1 | 2 | 1 |
| 198 | 04:29:14-04:34:19 | 1 | 2 | 0 |
| int-198 | 04:45:04-04:45:16 | – | – | 0 |
| 198-nb1 | 04:46:01-04:51:16 | 1 | 2 | 0 |
| int26-l | 04:58:08-05:02:46 | 1 | 3 | 0 |
| int-int26-l | 05:02:46-05:09:33 | – | – | 0 |
| int-198 | 05:09:33-05:15:53 | – | – | 0 |
| 198 | 05:17:07-05:22:20 | 1 | 2 | 0 |
| int26-m | 05:27:18-05:34:27 | 1 | 3 | 1 |
| int-int26-m | 05:34:27-05:41:21 | – | – | 0 |
| int-193 | 05:43:27-05:43:50 | – | – | 0 |
| int26-n | 05:41:40-05:46:17 | 1 | 3 | 0 |
| 193 | 05:45:52-05:55:34 | 2 | 1 | 0 |
| 193b | 06:01:01-06:05:21 | 1 | 3 | 0 |
| sammel26 | 06:06:21-06:11:08 | 1 | 3 | 0 |
| int-sammel26 | 06:11:08-06:17:20 | – | – | 0 |
