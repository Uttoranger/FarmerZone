# Zeitbuch Lauf 24 (24.10.2026, Wiener Zeit)

Vom Dirigenten geführt (freigabe.md §28, §0 „Zeitbuch“). Rechner: **4 Kerne** (Cloud-Container). Worker nach G10 und G10-Ergänzung: allein `max(2, floor(3/2)) = 2`, Dirigent allein im Zwischen- und Sammelstand `Kerne−1 = 3`, bei n gleichzeitigen vollen Läufen `max(1, floor(3/n)) = 1`. Gezählt über eine Datei je laufendem vollem Lauf im Ordner `laeufe/` der Skripte des Dirigenten (`voll.sh`), Integration unter `integration.lock` (`int.sh`).

## Dirigent

- 12:18:26–12:26:04 Stand auf main e0e258f7 (enthält ca0f695/#372 und den Upload der Mockups): install, typecheck, lint 0 Fehler (5 Warnungen), 543 / 10331 grün (n=1, 2 Worker). Postgres im Container war aus – gestartet.
- 12:33:29–12:43:23 Doku-PR voll (n=1, 2 Worker); PR #373.
- ~12:55 Welle 1: 158, 162, 165 je als eigener Workflow (Umsetzer → tester ∥ pruefer → bis zu zwei Runden), Basis 9f059dbd.
- 13:20 162 fertig → PR #374; 163 Start. 14:00 163 fertig → PR #375; 164 Start.
- 14:13 165 fertig nach Runde 1; Integration ganz nach der Runde vom Dirigenten 14:15:16–14:22:29 (75/645) → PR #376.
- 14:30 158 fertig nach Runde 1; der Dirigent stuft „Ergebnis ohne eigene Belegung“ als Blocker (Datenkonsistenz) → Runde 2 per Agent bis 15:13; tester ∥ pruefer gezielt auf den Rundendiff; Integration ganz 15:17:24–15:24:02 (75/658) → PR #378.
- 14:38:05–14:47:25 Zwischenstand mit 162, 165, 163 voll (n=1, 3 Worker) 546/10400; Konflikt `src/lib/betrieb.ts` (162 macht `GRENZ_TEXT` zur Funktion `grenzTexte`, der Eintrag „hofliste“ aus 163 zieht dorthin).
- 14:57 164 fertig nach Runde 1 → PR #377; Merge in den Zwischenstand.
- 15:27–15:38 Zwischenstand + 158: voll rot (Test aus 164 kannte das Protokoll aus 158 nicht) → Dirigent-Fix nur am Test, voll grün 552/10481. 15:38:50–15:46:12 Integration ganz rot (Test aus 164 speicherte den Bar-Token im Klartext) → Runde 2 von 164 per Agent, 16:01:14–16:08:08 Integration ganz grün 77/665; 16:08:15–16:12:58 voll grün; Push; 159 ∥ 160 Start.
- 16:36 160 fertig → Merge, voll 16:41:58–16:47:51 (553/10500), Integration ganz 16:47:51–16:54:55 (78/670), Push, PR #379; 161 Start. (Ein eigener Hintergrundlauf mit zu kurzem Zeitlimit wurde gestoppt und neu gestartet.)
- 18:21 161 fertig nach Runde 1 → PR #380, Merge, voll 18:23:50–18:37:02.
- 18:30 159 fertig nach Runde 1 → PR #381, Merge (Konflikt ARCHITECTURE „Mails“), voll 18:38:39–18:43:29 (560/10670), Integration ganz 18:43:29–18:50:38 (80/682), Push; 167 Start.
- 19:48 167 fertig → Merge (gleicher Baum wie 167), Push; PR #382 gegen `nacht/2026-10-24/167-basis` (Merge vor dem PR); 166 Start.
- 20:23 166 fertig → PR #383, Merge; Integration ganz 20:27:40–20:35:05 (81/688); Regel 3: 35 Migrationen, `migrate diff --exit-code` ohne Unterschied.

## Je Nummer

| Nr | voller Lauf (n, Worker) | Integration | Runden |
|---|---|---|---|
| Doku | 12:33:29–12:43:23 (1, 2) | – | – |
| 162 | 13:03:57–13:12:42 rot; 13:13:36–13:20:43 (1, 2) | – | 0 |
| 165 | 13:27:05 rot; 13:38:22–13:51:54 (2, 1); R1 13:59:17–14:13:03 (3, 1) | 13:17:08–13:24:40 ganz; 14:15:16–14:22:29 ganz (Dirigent) | 1 |
| 163 | 13:46:22–14:00:48 (3, 1) | Dateien 13:40–13:44 | 0 |
| 158 | 13:32:43 rot; 13:47:08–14:00:08 (3, 1); R1 14:23:35–14:30:43 (1, 2); R2 14:57:16–15:07:16 und 15:07:32–15:13:48 | 13:24:40–13:32:26 ganz; 15:17:24–15:24:02 ganz | 2 |
| 164 | 14:24:04–14:35:55 (2, 1); R1 14:44:37–14:57:17 (3, 1); R2 15:54:25–16:00:34 (1, 2) | R2 15:47:20–15:54:21 ganz | 2 |
| 160 | 16:28:47–16:36:13 (1, 2) | Datei 16:27; ganz im Zwischenstand 16:47:51–16:54:55 | 0 |
| 159 | 17:24:57–17:33:10 und 17:43:53–17:50:40 (1, 2); R1 18:23:03–18:30:05 (1, 2) | 17:33:48–17:41:57 ganz; 18:14:08–18:21:51 ganz | 1 |
| 161 | 17:35:55 rot; 17:46:37–17:59:08 (2, 1); R1 18:14:15–18:21:08 (1, 2) | Datei | 1 |
| 167 | 19:35:35–19:41:45 und 19:42:43–19:48:50 (1, 2) | 19:27:44–19:34:35 ganz | 0 |
| 166 | 20:09:57 rot; 20:16:56–20:23:09 (1, 2) | – | 0 |

Wartezeit auf die CI: keine, die den Lauf aufhielt.

## Drei Sätze

- **Wohin ging die Zeit?** In die Kette 158 → Zwischenstand → 159/160 → 161 → 167 → 166: Jede gestapelte Nummer wartete auf den grünen Zwischenstand, und zweimal hielt ein Test einer früheren Nummer (164) den Zwischenstand auf, weil er gegen den Stand vor 158 geschrieben bzw. nur eine Integrationsdatei laufen ließ.
- **Was hat die G10-Ergänzung gebracht?** Die Läufe des Dirigenten allein mit 3 Workern dauerten 4,5–6 Minuten, die der Umsetzer allein mit 2 Workern 6–9 Minuten; mit drei gleichzeitigen Läufen und 1 Worker waren es 13–14 Minuten.
- **Nächster Hebel:** Jede Nummer, die einen gemeinsamen Schutz ändert (hier Bar-Token, Aufräumen), lässt die Integration ganz laufen, nicht nur ihre Datei; und PRs entstehen vor dem Merge in den Zwischenstand.
