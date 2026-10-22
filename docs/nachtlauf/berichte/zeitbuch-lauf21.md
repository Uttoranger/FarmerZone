# Zeitbuch Lauf 21 (22.10.2026, Wiener Zeit)

Vom Dirigenten laufend ergänzt (freigabe.md §25, §0 „Zeitbuch“). Rechner: 4 Kerne; bis zu drei Umsetzer gleichzeitig, jeder volle Lauf mit `--maxWorkers=1` (G10: max(1, floor((4−1)/n)) bei n ≥ 2 gleichzeitigen Läufen). Je Nummer Beginn und Ende von Umsetzer, vollen Läufen, Integration, tester, pruefer und Runden; die Zeilen schreiben die Agenten selbst bzw. `voll.sh`.

## Dirigent (Stand, Doku-PR, Starts, PRs, Zwischenfälle)

- Doku-PR Umsetzer Beginn 10:30
- Stand-Check main 211a418: install, generate, typecheck, lint (0 Fehler, 5 Warnungen), test 520 Dateien / 9653 Tests grün – fertig vor 10:35
- Doku-PR Umsetzer Ende ~10:40 (Workflow 9:51 min; voller Lauf mit --maxWorkers=2 grün, 520/9653)
- Doku-PR #346 angelegt 10:41 (laut GitHub; zuvor irrtümlich 10:44 notiert)
- Welle 1 Start 10:43: 138 (wf_e500a912-eb7, Task wddah1j9p), 137 (wf_d475e431-b93, Task wj6p0jlvx), 139 (wf_50a3e384-e9b, Task w60nb023c), Basis 0dd060c
- Postgres lokal war aus – gestartet 10:45 (vor dem ersten Integrationslauf von 137)
- 139 Workflow Ende 11:22 – Runde 1 meldet stopp (Geld-Fund-Frage)
- 144 Start 11:22 (wf_f90f92bb-446, Task wursavi5i, Basis 0dd060c); 139-Nachprüfung und Geld-Fund-Prüfung (wf_359d5c9d-08c, Task wzp8e0tu1)
- 139 Geld-Fund bestätigt (2 Prüfer), Nachprüfung grün; STOPP → Entwurf #347 11:31
- 137 Workflow Ende 11:38, PR angelegt 11:39
- 140 Start 11:41 (wf_f2e9a915-98d, Task wht2f88vw); Zwischenstand wt-int21: 137 gemergt 5111be6, voller Lauf + Integration gestartet
- 138 Workflow Ende 11:44, PR 11:45
- 142 Start 11:58 (wf_53ea87c3-986, Task whibdb400, Basis 5111be6 nach CI 137 grün und Zwischenstand grün 11:57)
- 142 Workflow Ende 12:32, PR 12:33; Hinweis: Ende des abgebrochenen ersten Laufs von 142 (12:19:48) ist die Zeit des Neustarts, nicht des Abbruchs; integration/lauf21 = 5111be6 gepusht (Basis für 142)
- 144 Workflow Ende 12:58, PR 13:00; Runde 2 von 144 ging auf eine falsche tester-Regel des Dirigenten zurück (Integrationslog gegen Commit-Zeit) – Regel berichtigt
- 140 Nachrunde Dirigent 67e7cf2 (voller Lauf 12:57–13:05 grün), PR 13:05
- Zwischenstand: 137, 138, 142, 144, 140 gemergt (Konflikte nur DEVELOPMENT.md, beide Seiten), BAUSTEINE neu erzeugt ohne Unterschied 13:05
- Zwischenstand eec51d8 voll grün (525/9882, Integration 70/621), gepusht; 141 Start 13:16
- 141 Workflow Ende 14:17, PR 14:19
- Sammelstand voll grün 14:25 (525/9882, 3 Worker 3,3 min), Integration 70/621 14:30, Regel 3 grün; CI #353 grün; Morgenbericht-Entwurf 14:31

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
- 144 voller Lauf Ende 12:02:49 gruen (144-final)
- 144 umsetzer Ende 12:03:02
- 144 pruefer Beginn 12:03:23
- 144 tester Beginn 12:03:25
- 144 pruefer Ende 12:07:52
- 144 tester Ende 12:10:25
- 144 runde1 Beginn 12:10:44
- 144 voller Lauf Beginn 12:18:36 (144-runde1, maxWorkers=1)
- 144 voller Lauf Ende 12:27:26 gruen (144-runde1)
- 144 runde1 Ende 12:27:43
- 144 pruefer Beginn 12:28:09
- 144 tester Beginn 12:28:16
- 144 tester Ende 12:29:28
- 144 pruefer Ende 12:30:43
- 144 runde2 Beginn 12:31:23
- 144 voller Lauf Beginn 12:43:54 (144-runde2, maxWorkers=1)
- 144 voller Lauf Ende 12:51:53 gruen (144-runde2)
- 144 runde2 Ende 12:52:33
- 144 pruefer Beginn 12:52:53
- 144 tester Beginn 12:52:55
- 144 pruefer Ende 12:56:35
- 144 tester Ende 12:59:19

## Nr. 140

- 140 umsetzer Beginn 11:40:18
- 140 Punkt 3 Code committed 12:03:28
- 140 voller Lauf Beginn 12:09:43 (140-final, maxWorkers=1)
- 140 voller Lauf Ende 12:18:47 rot (140-final)
- 140 voller Lauf Beginn 12:19:45 (140-final, maxWorkers=1)
- 140 voller Lauf Ende 12:28:44 gruen (140-final)
- 140 umsetzer Ende 12:30:00
- 140 pruefer Beginn 12:30:53
- 140 tester Beginn 12:30:57
- 140 tester Ende 12:32:57
- 140 pruefer Ende 12:37:29
- 140 runde1 Beginn 12:38:10
- 140 voller Lauf Beginn 12:41:51 (140-runde1, maxWorkers=1)
- 140 voller Lauf Ende 12:50:47 gruen (140-runde1)
- 140 runde1 Ende 12:51:38
- 140 pruefer Beginn 12:52:07
- 140 tester Beginn 12:52:07
- 140 tester Ende 12:54:33
- 140 pruefer Ende 12:55:55
- 140 voller Lauf Beginn 12:57:29 (140-nachrunde, maxWorkers=1)
- 140 voller Lauf Ende 13:05:07 gruen (140-nachrunde)

## Nr. 142

- 142 umsetzer Beginn 11:58:28
- 142 voller Lauf Beginn 12:00:59 (142-final, maxWorkers=1)
- 142 voller Lauf Ende 12:19:48 abgebrochen (Zeitgrenze des Werkzeugs 10 min, kein Befund)
- 142 voller Lauf Beginn 12:19:48 (142-final, maxWorkers=1)
- 142 voller Lauf Ende 12:28:40 gruen (142-final)
- 142 umsetzer Ende 12:29:44
- 142 pruefer Beginn 12:30:01
- 142 tester Beginn 12:30:04
- 142 tester Ende 12:30:51
- 142 pruefer Ende 12:32:28

## Zwischenstand `integration/lauf21`

- int voller Lauf Beginn 11:41:08 (int-137, maxWorkers=1)
- int voller Lauf Ende 11:51:36 gruen (int-137)
- int Integration Beginn 11:51:36 (Zwischenstand mit 137)
- int Integration Ende 11:57:09 rc=0
- int voller Lauf Beginn 13:05:47 (int-alle, maxWorkers=2)
- int voller Lauf Ende 13:10:42 gruen (int-alle)
- int Integration Beginn 13:10:42 (Zwischenstand mit allen)
- int Integration Ende 13:15:45 rc=0
- int Regel 3 Beginn 13:16:35
- int Regel 3 Ende 13:16:44

## Nr. 141

- 141 umsetzer Beginn 13:16:25
- 141 voller Lauf Beginn 13:30:56 (141-final, maxWorkers=1)
- 141 voller Lauf Ende 13:38:42 gruen (141-final)
- 141 umsetzer Ende 13:39:20
- 141 tester Beginn 13:39:39
- 141 pruefer Beginn 13:39:40
- 141 tester Ende 13:40:22
- 141 pruefer Ende 13:46:04
- 141 runde1 Beginn 13:46:46
- 141 voller Lauf Beginn 13:50:07 (141-runde1, maxWorkers=1)
- 141 voller Lauf Ende 13:58:05 gruen (141-runde1)
- 141 runde1 Ende 13:58:17
- 141 pruefer Beginn 13:58:36
- 141 tester Beginn 13:58:38
- 141 tester Ende 13:59:21
- 141 pruefer Ende 14:02:50
- 141 runde2 Beginn 14:03:21
- 141 voller Lauf Beginn 14:04:45 (141-runde2, maxWorkers=1)
- 141 voller Lauf Ende 14:12:45 gruen (141-runde2)
- 141 runde2 Ende 14:12:56
- 141 pruefer Beginn 14:13:19
- 141 tester Beginn 14:13:22
- 141 tester Ende 14:13:56
- 141 pruefer Ende 14:17:25

## Sammel-PR

- sammel Beginn 14:22:03 (141 gemergt 78e6305, Statuszeilen gesetzt)
- sammel voller Lauf Beginn 14:22:03 (sammel-final, maxWorkers=3)
- sammel voller Lauf Ende 14:25:22 gruen (sammel-final)
- sammel Integration Beginn 14:25:22
- sammel Integration Ende 14:30:30 rc=0
