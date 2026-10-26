# Zeitbuch Lauf 25 (25./26.10.2026, Wiener Zeit)

Vom Dirigenten geführt (freigabe.md §29, §0 „Zeitbuch“). Rechner: **4 Kerne** (Cloud-Container), 15 GB Speicher. Worker nach G10 und G10-Ergänzung: allein `max(2, floor(3/2)) = 2`, Dirigent allein im Zwischen- und Sammelstand `Kerne−1 = 3`, bei n gleichzeitigen vollen Läufen `max(1, floor(3/n)) = 1`. Gezählt über eine Datei je laufendem vollem Lauf (`voll.sh`), Integration unter einer Sperre (`int.sh`). Typecheck mit `NODE_OPTIONS=--max-old-space-size=4096` (ohne lief tsc im Doku-PR in einen Speicherüberlauf).

## Dirigent

- 25.10. 20:33–20:40 Stand auf main bc3ede21 voll grün (n=1, 2 Worker). Doku-PR 20:45 (rc=134, Speicherüberlauf tsc) und 20:46–20:54 grün → PR #385.
- 25.10. abends: Welle 1 (168, 169, 182) scheiterte sofort am Wochenlimit des Kontingents; nichts gebaut, Worktrees unverändert.
- 26.10. 11:29 Neustart Welle 1 (168, 169, 182) auf b3ea3012; danach je freiem Platz 171, 183, 172, 173, 175, 178, 181, 170, 176, 177, 174, 180, 179 (höchstens drei Umsetzer zugleich).
- Zwischenstände `integration/lauf25` (je voll + Integration ganz, dann Push):
  - 7ac12ae4 = 182 (gleicher Baum wie 182, kein eigener Lauf).
  - e1f89496 + 169: erster voller Lauf rot nur durch die Laufzeitprüfung in `tests/bild-format.test.ts` (539 ms > 500 ms unter Last, allein grün); Wiederholung grün; Integration 82/691.
  - b8d1ea26 + 168: wieder nur die Laufzeitprüfung (640 ms); Wiederholung grün; Integration 82/696.
  - 873248df + 175, 183, 173: voll 10898 grün, Integration 82/699.
  - 1bd8096c + 170, 178: Konflikt `orders.ts` (178 brachte eine von 168 verlegte Hilfe zurück); voll grün; Integration einmal rot (`bremse-datenbank.int`, Zähler-Aufräumen, allein 11/11 grün), Wiederholung 83/710 grün.
  - + 171, 172, 176, 177: voll rot (`analytics-filter`: 182 schickt für /startseite-vorschau no-referrer, die Liste aus 172 kannte die Seite nicht) → Dirigent-Fix 64519af7.
  - + 174: voll rot (zwei Wachen mit Bestandsliste, 174 × 176) → Dirigent-Fix ba8e908c; voll 11126 grün, Integration 83/710; Push ba8e908c.
  - + 180, 179, 181 (zuletzt; Konflikt ARCHITECTURE-Absatz KundenKopf, 182-Fassung mit den Änderungen aus 181 von Hand) → Sammelstand. Voll rot (Zod-Wache aus 178 führte die von 181 entfernten Onboarding-Actions) → Dirigent-Fix 5862d686; voll 596/11156 grün (3 Worker), Integration ganz 84/717.
- Runde 2 von 168 (teils ungültige Mail-Aufträge) und der Tausch der Testadressen in 170 vom Dirigenten selbst.
- Regel 3 auf frischer Wegwerf-DB: 35 Migrationen, `migrate diff --exit-code` ohne Unterschied; keine neue Migration im Lauf.

## Rohzeilen (Wiener Zeit, `name start–ende n workers rc`)

| Lauf | Zeit | n | Worker | rc |
|---|---|---|---|---|
| start25-main | 20:33:45-20:40:47 | 1 | 2 | 0 |
| doku25 | 20:45:12-20:46:41 | 1 | 2 | 134 |
| doku25 | 20:46:50-20:54:01 | 1 | 2 | 0 |
| int-169 | 11:41:20-11:41:45 | – | – | 0 |
| int-182 | 11:43:10-11:43:35 | – | – | 0 |
| int-169 | 11:47:38-11:53:54 | – | – | 0 |
| int-168-teil | 11:53:54-11:54:19 | – | – | 1 |
| 182-vorschau | 11:47:44-11:54:48 | 1 | 2 | 1 |
| int-168-teil | 11:56:43-11:57:10 | – | – | 0 |
| 169-warenkorb | 11:54:59-12:01:57 | 1 | 2 | 1 |
| int-168 | 11:58:39-12:05:21 | – | – | 0 |
| 182-vorschau | 11:56:49-12:06:56 | 2 | 1 | 0 |
| 169-warenkorb | 12:04:33-12:13:54 | 2 | 1 | 0 |
| 168-mail | 12:06:09-12:15:40 | 3 | 1 | 0 |
| int25-169 | 12:17:48-12:26:01 | 1 | 3 | 1 |
| int-171 | 12:26:50-12:27:19 | – | – | 0 |
| 168-r2 | 12:25:40-12:37:12 | 2 | 1 | 0 |
| int25-169b | 12:26:22-12:37:34 | 2 | 1 | 0 |
| 171-nacharbeit | 12:27:45-12:39:08 | 3 | 1 | 0 |
| 172-plattform | 12:31:08-12:43:20 | 4 | 1 | 1 |
| int-168-r2 | 12:37:12-12:44:23 | – | – | 0 |
| 172-plattform2 | 12:44:02-12:49:18 | 1 | 2 | 0 |
| int-int25-169 | 12:44:23-12:50:46 | – | – | 0 |
| int-183 | 12:50:46-12:51:09 | – | – | 0 |
| int25-168 | 12:51:11-12:58:20 | 1 | 3 | 1 |
| 183-editor | 12:51:19-13:03:59 | 2 | 1 | 0 |
| int25-168b | 12:58:38-13:09:28 | 2 | 1 | 0 |
| int-int25-168 | 13:09:28-13:17:38 | – | – | 0 |
| 175-netz | 13:09:44-13:18:14 | 1 | 2 | 1 |
| 183-nb1 | 13:09:45-13:21:10 | 2 | 1 | 0 |
| int-175 | 13:24:29-13:31:09 | – | – | 0 |
| 173-grundbausteine | 13:19:16-13:31:18 | 2 | 1 | 1 |
| int-170 | 13:36:46-13:37:10 | – | – | 1 |
| int-170 | 13:37:24-13:37:42 | – | – | 0 |
| 173-grundbausteine | 13:32:03-13:37:58 | 1 | 2 | 0 |
| 175-netz | 13:32:18-13:43:41 | 2 | 1 | 0 |
| int-170 | 13:40:57-13:47:25 | – | – | 0 |
| 170-mails | 13:48:22-13:54:48 | 1 | 2 | 1 |
| int25-175 | 13:49:08-14:01:36 | 2 | 1 | 0 |
| 170-mails | 13:55:17-14:06:21 | 2 | 1 | 0 |
| int-int25-175 | 14:01:36-14:08:48 | – | – | 0 |
| int-178 | 14:08:48-14:09:50 | – | – | 0 |
| 170-nb | 14:11:16-14:18:01 | 1 | 2 | 0 |
| int-178 | 14:11:11-14:18:42 | – | – | 0 |
| 181-altrouten | 14:12:16-14:23:43 | 2 | 1 | 143 |
| 181-altrouten2 | 14:23:51-14:31:30 | 1 | 2 | 0 |
| 178-sicherheit | 14:26:11-14:40:22 | 2 | 1 | 1 |
| 176-kasse-texte | 14:37:28-14:48:02 | 2 | 1 | 1 |
| 181-nachbesserung1 | 14:38:49-14:49:24 | 3 | 1 | 0 |
| 178-sicherheit | 14:41:11-14:51:44 | 3 | 1 | 0 |
| 176-kasse-texte | 14:49:25-14:59:49 | 2 | 1 | 0 |
| 181-runde2 | 14:51:23-15:02:25 | 3 | 1 | 0 |
| int25-178 | 14:58:50-15:10:14 | 3 | 1 | 0 |
| 176-nachbesserung1 | 15:05:20-15:16:43 | 2 | 1 | 0 |
| int-int25-178 | 15:10:14-15:17:57 | – | – | 1 |
| int-int25-178-einzel | 15:18:20-15:18:35 | – | – | 0 |
| int-int25-178b | 15:18:52-15:26:30 | – | – | 0 |
| int-174 | 15:27:42-15:28:13 | – | – | 0 |
| 174-hof-formulare | 15:28:46-15:38:29 | 1 | 2 | 1 |
| 177-hofseite | 15:31:52-15:44:11 | 2 | 1 | 1 |
| 180-leistung | 15:35:57-15:45:47 | 3 | 1 | 0 |
| 174-hof-formulare | 15:39:14-15:49:42 | 3 | 1 | 0 |
| 177-hofseite2 | 15:45:00-15:55:25 | 3 | 1 | 0 |
| 180-leistung | 15:46:12-15:56:06 | 3 | 1 | 1 |
| 174-nachbesserung1 | 15:54:13-16:04:18 | 3 | 1 | 0 |
| 180-leistung | 15:56:24-16:06:07 | 2 | 1 | 0 |
| int-180 | 16:11:57-16:12:17 | – | – | 1 |
| int-180 | 16:12:22-16:12:37 | – | – | 1 |
| 174-nachbesserung1b | 16:04:38-16:15:08 | 2 | 1 | 0 |
| int-180 | 16:16:12-16:16:32 | – | – | 0 |
| 177-nb1 | 16:07:15-16:18:15 | 2 | 1 | 0 |
| 180-nachbesserung1 | 16:16:36-16:26:37 | 2 | 1 | 1 |
| 174-runde2 | 16:17:54-16:28:25 | 3 | 1 | 0 |
| int25-177 | 16:22:53-16:34:31 | 3 | 1 | 1 |
| 180-nachbesserung1 | 16:27:11-16:37:20 | 3 | 1 | 0 |
| int-179 | 16:39:41-16:40:21 | – | – | 0 |
| int-180 | 16:40:21-16:40:35 | – | – | 0 |
| int25-174 | 16:35:19-16:46:31 | 2 | 1 | 1 |
| 180-runde2 | 16:40:40-16:51:02 | 2 | 1 | 0 |
| int25-174b | 16:47:24-16:57:57 | 2 | 1 | 0 |
| 179-passkey | 16:51:02-17:02:01 | 3 | 1 | 0 |
| int-int25-174 | 16:57:57-17:04:08 | – | – | 0 |
| int-179 | 17:04:08-17:05:39 | – | – | 0 |
| sammel25 | 17:11:33-17:16:07 | 1 | 3 | 1 |
| sammel25b | 17:17:01-17:20:52 | 1 | 3 | 0 |
| int-sammel25 | 17:20:52-17:26:49 | – | – | 0 |

Legende: Einträge mit `int-` sind Integrationsläufe; rc=1 im vollen Lauf eines Umsetzers ist ein roter erster Lauf, der in derselben Nummer behoben wurde; rc=143 ein abgebrochener Lauf (neu gestartet).
