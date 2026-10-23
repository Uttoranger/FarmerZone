# Zeitbuch Lauf 23 (23.10.2026, Wiener Zeit)

Vom Dirigenten geführt (freigabe.md §27, §0 „Zeitbuch“). Rechner: **4 Kerne** (Cloud-Container). Worker nach G10 und G10-Ergänzung: allein `max(2, floor(3/2)) = 2`, Dirigent allein im Zwischen- und Sammelstand `Kerne−1 = 3`, bei n gleichzeitigen vollen Läufen `max(1, floor(3/n)) = 1`. Gezählt über eine Datei je laufendem vollem Lauf im Ordner `laeufe/` der Skripte des Dirigenten (`voll.sh`), Integration unter `integration.lock` (`int.sh`).

## Dirigent

- 20:28:31–20:35:59 Stand auf main: typecheck, lint 0 Fehler (5 Warnungen), test grün (n=1, 2 Worker).
- 20:37:59–20:46:27 Doku-PR voll (n=1, 2 Worker); PR #362 20:47.
- 20:47 Welle 1: 151, 154, 149 je als eigener Workflow (Umsetzer → tester ∥ pruefer → bis zu zwei Runden), Basis d951aefa.
- ~21:04 154: Umsetzer endet ohne Commit (sein voller Lauf im Hintergrund brach mit dem Agenten ab) → Hilfsagent läuft voll im Vordergrund, 21:05:47–21:21:22 (n=2, 1 Worker), committet; das Workflow-Skript verlangt seitdem volle Läufe im Vordergrund. 156 Start 21:06.
- 21:26 154 fertig → PR #363 (0 Runden). 21:27:26–21:44:51 Zwischenstand mit 154 voll (n=3, 1 Worker), 21:44:51–21:55:23 Integration ganz 72/628; Push.
- 21:28 149 fertig → PR #364 (1 Runde); 150 Start.
- ~21:46 151 Umsetzer fertig, pruefer ohne Blocker; Runde 1 nur Kommentare und Doku (Grenze vom Dirigenten erweitert), voll 21:49:31–22:07:55 (n=2, 1 Worker). 152 Start 21:49.
- 22:00 156 fertig → PR #365 (0 Runden); 155 Start vom Zwischenstand.
- 22:08 150 fertig → PR #366; 151 → PR #367 (Rundendiff vom Dirigenten gelesen).
- 22:09 Zwischenstand + 151, 156, 149, 150: voll 22:09:43–22:22:29 (n=2, 1 Worker) **rot** – `tests/status-new-mailsperre.test.ts` (149) kannte die Wache aus 156 nicht; Integration 22:22:29–22:28:50 grün 74/641. Dirigent-Fix (nur die Attrappe im Test).
- 22:17 152 fertig → PR #368; Merge in den Zwischenstand.
- 22:29:53–22:35:18 Zwischenstand voll (n=1, **3 Worker**) 541/10285; 22:35:18–22:41:55 Integration ganz 74/641; Push. 22:43 153 und 157 vom Zwischenstand (dc5ce097).
- 22:57 155 fertig ohne Bilder → PR #369; Merge in den Zwischenstand, voll 22:58:36–23:12:04 (n=3, 1 Worker) 542/10303; Push.
- 23:13 153 → PR #370, 157 → PR #371 (Bilder vom Dirigenten angesehen).
- Sammelstand: + 153, voll 23:14:18–23:18:45 (n=1, 3 Worker) 542/10321; + 157, voll 23:19:00–23:24:15 (n=1, 3 Worker) 543/10331; Integration ganz 23:24:26–23:30:32 74/641; Regel 3: frische DB, 34 Migrationen, `migrate diff --exit-code` ohne Unterschied.
- CI aller PRs #362–#368 grün (ci, integration, Vercel) vor dem Sammel-PR.

## Je Nummer

| Nr | Umsetzer | voller Lauf (n, Worker) | Integration | Runden | Bilder |
|---|---|---|---|---|---|
| Doku | 20:37–20:47 | 20:37:59–20:46:27 (1, 2) | – | – | – |
| 154 | 20:47–21:04, Abschluss bis 21:22 | 21:05:47–21:21:22 (2, 1) | 20:59:12–20:59:50, 21:21:38–21:22:45 (Dateien) | 0 | – |
| 149 | 20:47–21:10 | 20:58:11–21:06:58 (1, 2); R1 21:11:46–21:26:02 (3, 1) | 20:56:50–20:57:24 (Dateien) | 1 | – |
| 151 | 20:47–21:46 | 21:09:53–21:28:10 (2, 1) rot; 21:28:59–21:42:54 (3, 1); R1 21:49:31–22:07:55 (2, 1) | 20:59:50–21:07:07 ganz | 1 (nur Doku) | Umsetzer |
| 156 | 21:06–21:50 | 21:19:57–21:33:26 (4, 1) rot; 21:34:12–21:48:30 (3, 1) | – | 0 | – |
| 150 | 21:28–22:04 | 21:44:14–22:03:09 (3, 1) | 21:34:14–21:42:50 ganz | 0 | – |
| 152 | 21:49–22:14 | 21:57:40–22:13:31 (3, 1) | – | 0 | – |
| 155 | 22:00–22:30 | 22:15:26–22:28:37 (2, 1); R1 22:35:11–22:46:47 (2, 1); R2 22:48:51–22:56:36 (1, 2) | – | 2 (Bilder nicht herstellbar) | fehlen (Passkey) |
| 157 | 22:43–23:09 | 22:53:47–23:08:58 (2, 1) | – | 0 | Umsetzer |
| 153 | 22:43–23:11 | 22:56:02–23:11:00 (3, 1) | – | 0 | Umsetzer |

Wartezeit auf die CI: keine, die den Lauf aufhielt.

## Drei Sätze

- **Wohin ging die Zeit?** In volle Läufe mit drei gleichzeitigen Nummern (je 1 Worker, 13–19 Minuten je Lauf) und in zwei Runden bei 155, die nur einen Bild-Blocker wiederholten, den keine Runde lösen konnte (Admin hinter Passkey).
- **Was hat die G10-Ergänzung gebracht?** Die Läufe des Dirigenten allein mit 3 Workern dauerten 4,5–5,5 Minuten (22:29, 23:14, 23:19) gegenüber 13–17 Minuten mit 1 Worker bei drei gleichzeitigen Läufen – der größte Hebel blieb, Läufe nicht zu stapeln.
- **Nächster Hebel:** Ein Bild, das nach begründeter Prüfung nicht herstellbar ist, wertet der Workflow als „GRENZE (Dirigent)“ statt als Blocker; dazu ein Skript des Dirigenten für Admin-Bilder auf dem echten Anmeldeweg.
