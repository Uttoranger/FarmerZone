# Zeitbuch Lauf 27 (30./31.10.2026, Wiener Zeit)

Vom Dirigenten geführt (freigabe.md §31, §0 „Zeitbuch“). Rechner: **4 Kerne** (Cloud-Container). Worker nach G10: allein 2, Dirigent allein im Zwischen- und Sammelstand 3, bei n gleichzeitigen vollen Läufen `max(1, floor(3/n))`. Gezählt über eine Datei je laufendem vollem Lauf (`voll.sh`), Integration unter einer Sperre (`int.sh`). Typecheck mit `NODE_OPTIONS=--max-old-space-size=4096`. Höchstens drei Umsetzer gleichzeitig.

## Dirigent

- 30.10. 23:06 Stand auf main add624fb (enthält #420 und #421): voll 637/11769 grün. Produktion: Kasse mit `testbetrieb: true` (Abruf über Vercel), Vorschau sperrt Live-Schlüssel im Code.
- 23:24 Doku-PR #422 (f2fcbafd): voll 637/11769 grün.
- Welle 1 ab 23:26 von `docs/lauf27`: 199, 200, 201; danach in der Reihenfolge der Priorität 202 (23:54), 203 (00:00), 206 (00:31), 205 (01:01).
- PRs gegen main (je voller Lauf vor dem Push, Integration nach Freigabe):
  - 00:05 199 → #423 (638/11779; Integration ganz 91/746)
  - 00:15 201 → #424 (638/11784)
  - 00:43 203 → #425 (639/11815; Integration der Webhook-Dateien 4/53)
  - 01:19 202 → #426 (638/11790; Integration ganz 92/751)
  - 01:29 206 → #427 (638/11815)
  - 01:40 205 → #428 (638/11780)
  - 02:29 200 → #429 (639/11825; Integration ganz 92/757)
- Zwischenstand `integration/lauf27` (je voll + Integration ganz):
  - 513225a9 = 199 + 201 + 203 + 202 + 206 (Konflikte nur DEVELOPMENT.md): voll 643/11907, Integration 92/751.
  - 9bf9b605 + 205 (ohne Konflikt) → Basis für 204.
  - c4dd8245 + 200 (Konflikte `admin-aufgaben.ts` 201 × 200: beide Quellen; `admin-heute.ts` Lader; Tests `admin-aufgaben`, `bestaetigung-seite` 202 × 200: beide Blöcke; Bestätigungsseite ohne Konflikt mit Korb und Widerruf-Link): voll 646/11974, Integration 93/762. Gepusht.
  - 97dbabd7 + 204 (ohne Konflikt) → Sammelstand: voll 646/11978 (n=1, 3 Worker), Integration ganz 93/762.
- Welle 2: 01:48 Nr. 204 von 9bf9b605 gestartet, **vor** dem Zusammenführen von 200 (Abweichung von §1: 200 lief in der zweiten Nachbesserung, 204 berührt nur die CSP-Dateien). PR #430 gegen `integration/lauf27`.
- Dirigent-Nachbesserungen als eigene Runde: 200 Runde 2 (Freigabe Punkt 6 fehlte: Admin-Ansicht, Zuordnen; dazu Link nach der Abholung, Mail bei Teilabbruch) und Runde 3 (Rest eines Teilwiderrufs, Sollte → Blocker). Kleine Korrekturen selbst: 199, 201, 203, 202, 206, 204.
- Auswertung der CSP-Meldungen für 204 vom Dirigenten aus Sentry (die Umsetzer haben keinen Zugriff).
- Regel 3 auf frischer Wegwerf-DB (`farmerzone_r27`): alle Migrationen einschließlich `20261030100000_widerruf`, `migrate diff --exit-code` ohne Unterschied.
- Keine Container-Neustarts in diesem Lauf.

## Volle Läufe und Integration (Rohdaten aus `voll.sh` / `int.sh`)

| Lauf | von–bis | n | Worker | RC |
|---|---|---|---|---|
| start27-main | 23:12–23:18 | 1 | 3 | 0 |
| doku27 | 23:18–23:23 | 1 | 2 | 0 |
| 199 | 23:40–23:51 | 2 | 1 | 0 |
| 201 (erster, rot: admin-seiten-wache) | 23:38–23:44 | 1 | 2 | 1 |
| 201 | 23:45–23:54 | 2 | 1 | 0 |
| 199b (Dirigent) | 23:54–00:04 | 2 | 1 | 0 |
| 201b (Dirigent) | 00:04–00:15 | 2 | 1 | 0 |
| 202 (rot: drei Wachen) | 00:15–00:27 | 2 | 1 | 1 |
| 203 | 00:16–00:27 | 2 | 1 | 0 |
| 200-b | 00:23–00:35 | 3 | 1 | 0 |
| 202 | 00:28–00:40 | 2 | 1 | 0 |
| 203b (Dirigent) | 00:31–00:42 | 3 | 1 | 0 |
| 206 | 00:43–00:49 | 1 | 2 | 0 |
| 202-nb1 | 00:49–00:58 | 2 | 1 | 0 |
| 200-final | 00:49–00:58 | 3 | 1 | 0 |
| 206-nachb1 | 00:56–01:05 | 3 | 1 | 0 |
| 202b (Dirigent) + Integration ganz | 01:01–01:18 | 2 | 1 | 0 |
| 205 | 01:09–01:20 | 2 | 1 | 0 |
| 200-nb1 | 01:10–01:20 | 3 | 1 | 0 |
| 206b (Dirigent) | 01:18–01:28 | 3 | 1 | 0 |
| 205-nachbesserung1 | 01:26–01:35 | 2 | 1 | 0 |
| int27a + Integration ganz | 01:29–01:47 | 2 | 1 | 0 |
| 200c (rot: admin-rechte-wache) | 01:44–01:49 | 1 | 2 | 1 |
| 200c + Integration ganz | 01:51–02:00 | 1 | 2 | 0 |
| 204 | 02:06–02:13 | 1 | 2 | 0 |
| 200d + Integration ganz | 02:10–02:25 | 2 | 1 | 0 |
| 204-nb1 | 02:17–02:26 | 2 | 1 | 0 |
| 204-r2 | 02:29–02:34 | 1 | 2 | 0 |
| int27b + Integration ganz | 02:29–02:45 | 2 | 1 | 0 |
| int27c (Sammelstand 97dbabd7) + Integration ganz | 02:45–02:55 | 1 | 3 | 0 |
