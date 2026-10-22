# Zeitbuch Lauf 21 (22.10.2026, Wiener Zeit)

Vom Dirigenten laufend ergänzt (freigabe.md §25, §0 „Zeitbuch“). Rechner: 4 Kerne; bis zu drei Umsetzer gleichzeitig, jeder volle Lauf mit `--maxWorkers=1` (G10: max(1, floor((4−1)/n)) bei n ≥ 2 gleichzeitigen Läufen). Je Nummer Beginn und Ende von Umsetzer, vollen Läufen, Integration, tester, pruefer und Runden; die Zeilen schreiben die Agenten selbst bzw. `voll.sh`.

## Dirigent (Stand, Doku-PR, Starts, PRs, Zwischenfälle)

- Doku-PR Umsetzer Beginn 10:30
- Stand-Check main 211a418: install, generate, typecheck, lint (0 Fehler, 5 Warnungen), test 520 Dateien / 9653 Tests grün – fertig vor 10:35
- Doku-PR Umsetzer Ende ~10:40 (Workflow 9:51 min; voller Lauf mit --maxWorkers=2 grün, 520/9653)
- Doku-PR #346 angelegt 10:44
- Welle 1 Start 10:43: 138 (wf_e500a912-eb7, Task wddah1j9p), 137 (wf_d475e431-b93, Task wj6p0jlvx), 139 (wf_50a3e384-e9b, Task w60nb023c), Basis 0dd060c
- Postgres lokal war aus – gestartet 10:45 (vor dem ersten Integrationslauf von 137)
- 139 Workflow Ende 11:22 – Runde 1 meldet stopp (Geld-Fund-Frage)
- 144 Start 11:22 (wf_f90f92bb-446, Task wursavi5i, Basis 0dd060c); 139-Nachprüfung und Geld-Fund-Prüfung (wf_359d5c9d-08c, Task wzp8e0tu1)
- 139 Geld-Fund bestätigt (2 Prüfer), Nachprüfung grün; STOPP → Entwurf #347 11:31
- 137 Workflow Ende 11:38, PR angelegt 11:39
- 140 Start 11:41 (wf_f2e9a915-98d, Task wht2f88vw); Zwischenstand wt-int21: 137 gemergt 5111be6, voller Lauf + Integration gestartet
- 138 Workflow Ende 11:44, PR 11:45
- 142 Start 11:58 (wf_53ea87c3-986, Task whibdb400, Basis 5111be6 nach CI 137 grün und Zwischenstand grün 11:57)

## Nr. 137

- 137 umsetzer Beginn 10:43:43
- 137 Integration Beginn 11:01:03
- 137 voller Lauf Beginn 11:01:03 (137-final, maxWorkers=1)
- 137 Integration Ende 11:07:01
- 137 voller Lauf Ende 11:09:25 gruen (137-final)
- 137 umsetzer Ende 11:09:53
- 137 pruefer Beginn 11:10:17
- 137 tester Beginn 11:10:23
- 137 pruefer Ende 11:15:11
- 137 tester Ende 11:17:12
- 137 runde1 Beginn 11:17:35
- 137 voller Lauf Beginn 11:21:51 (137-runde1, maxWorkers=1)
- 137 voller Lauf Ende 11:29:34 gruen (137-runde1)
- 137 Integration Beginn 11:29:53 (runde1)
- 137 Integration Ende 11:35:09 rc=0 (runde1)
- 137 runde1 Ende 11:35:33
- 137 pruefer Beginn 11:35:59
- 137 tester Beginn 11:36:04
- 137 tester Ende 11:37:18
- 137 pruefer Ende 11:38:28

## Nr. 138

- 138 umsetzer Beginn 10:43:41
- 138 voller Lauf Beginn 11:06:41 (138-final, maxWorkers=1)
- 138 voller Lauf Ende 11:14:49 gruen (138-final)
- 138 umsetzer Ende 11:16:01
- 138 tester Beginn 11:16:24
- 138 pruefer Beginn 11:16:25
- 138 tester Ende 11:17:44
- 138 pruefer Ende 11:24:32
- 138 runde1 Beginn 11:25:21
- 138 voller Lauf Beginn 11:31:43 (138-runde1, maxWorkers=1)
- 138 voller Lauf Ende 11:39:42 gruen (138-runde1)
- 138 runde1 Ende 11:40:06
- 138 pruefer Beginn 11:40:30
- 138 tester Beginn 11:40:30
- 138 tester Ende 11:42:08
- 138 pruefer Ende 11:44:14

## Nr. 139

- 139 umsetzer Beginn 10:43:42
- 139 umsetzer Zwischenstand 10:51:44 voll.sh startet
- 139 voller Lauf Beginn 10:51:48 (139-final, maxWorkers=1)
- 139 voller Lauf Ende 11:01:53 gruen (139-final)
- 139 umsetzer Ende 11:02:29
- 139 tester Beginn 11:02:51
- 139 pruefer Beginn 11:02:51
- 139 tester Ende 11:03:49
- 139 pruefer Ende 11:06:48
- 139 runde1 Beginn 11:07:34
- 139 voller Lauf Beginn 11:12:31 (139-runde1, maxWorkers=1)
- 139 voller Lauf Ende 11:20:47 gruen (139-runde1)
- 139 runde1 Ende 11:20:59
- 139 tester-r1 Beginn 11:22:49
- 139 pruefer-nach1 Beginn 11:22:51
- 139 tester-r1 Ende 11:23:24
- 139 pruefer-nach1 Ende 11:26:24

## Nr. 144

- 144 umsetzer Beginn 11:22:51
- 144 voller Lauf Beginn 11:53:24 (144-final, maxWorkers=1)

## Nr. 140

- 140 umsetzer Beginn 11:40:18

## Nr. 142

- 142 umsetzer Beginn 11:58:28

## Zwischenstand `integration/lauf21`

- int voller Lauf Beginn 11:41:08 (int-137, maxWorkers=1)
- int voller Lauf Ende 11:51:36 gruen (int-137)
- int Integration Beginn 11:51:36 (Zwischenstand mit 137)
- int Integration Ende 11:57:09 rc=0
