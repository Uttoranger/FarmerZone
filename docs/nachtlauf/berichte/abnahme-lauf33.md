# Abnahme Lauf 33

Abnahme-Grundlage: freigabe.md §37 „Abnahme-Grundlage“ (Liste docs/nachtlauf/berichte/lauf32-board-oder-code.md mit Q1–Q5 und Abschnitt 3.2, Ergänzungsliste docs/nachtlauf/berichte/lauf33-ergaenzungen.md, Maßstab freigabe.md §35 Punkte 1–7). Bilder nur mit dem Prüfwerkzeug aus Nr. 262 gegen eine Wegwerf-DB auf localhost; sie liegen im Container unter `.nachtlauf/screens/` und werden nicht committet.

## Zwischen-Durchgang A (9.11.2026, 06:29–06:45 UTC, gekürzt)

**Warum gekürzt:** Die Umsetzer 267 und 269 brachen gegen 21:05 UTC durch das Wochenlimit der API ab; danach lief bis 06:27 UTC nichts. Haltepunkt A galt damit sofort (Auftrag 3.2). Von den Nummern mit Zwischen-Durchgang-Boards ist keine fertig: 268 (problem-melden, meldungen) hat nicht begonnen, 267 (abmelden, passwort, rechtstexte) und 269 (kunden, heute, hofdaten-zahlung) sind WIP, 270 (mail-sicherheit) hat nicht begonnen. Nach 3.2 bleibt die Gegenprobe mehr-neu; dazu Stichproben der fertigen echten Fehler (263, 264, 266) ohne Board-Wertung.

Prüfstand: Zwischenstand `integration/lauf33` 262af8084cc1 (261–264, 266), ein Bau unter `env -i`, Prüf-Seed (Stichtag Vergangenheit) in einer Wegwerf-DB, Fotograf `start` auf einer Kopie, Prüf-Browser über `pruef-browser.sh`, Bilder über `seiten-bild.sh --session`. pruefer-ui mit frischem Kontext und nur den Eingaben aus „Abnahme-Grundlage“.

### Boards

| Board | Schluss Lauf 32 | Zwischen-Durchgang A (390 hell · 390 dunkel · 1440 hell · 1440 dunkel) | Mängel | gedeckt durch Liste/Ergänzung/3.2/Auftrag |
|---|---|---|---|---|
| mehr-neu (Gegenprobe) | 5 · 5 · 5 · 5 | 5 · 5 · 5 · 5 | keine | Beispieldaten und Prüfdatum (U, Q4); „Problem melden“ unter der Fensterhöhe (U, Aufnahme); Startfokus (C, Q3); Admin-Zeile (U); Team-Karte (R, N12); „Ausblenden“ (C); „Online-Zahlung einrichten“ (Auftrag, Register vor Board); Hof-Kürzel „HM“ (Board widerspricht sich selbst, s1 zeigt zweistellig – Vorschlag Ergänzungsliste C) |
| problem-melden, meldungen (268) | – | offen (Abschnitt B) | – | 268 nicht begonnen |
| abmelden, passwort, rechtstexte (267) | – | offen (Abschnitt B) | – | 267 WIP |
| kunden, heute, hofdaten-zahlung (269) | – | offen (Abschnitt B) | – | 269 WIP |
| mail-sicherheit (270) | – | offen (Abschnitt B) | – | 270 nicht begonnen |

Messung mehr-neu: Schrift unter 12 px 0, Ziele unter 44 px 0, Felder ohne Beschriftung 0, axe serious/critical 0 in allen vier Fassungen; h1 1 bei 1440. Bei 390 ist das Mehr-Blatt offen und die Messung meldet h1 0 statt „Dialog offen“: Das Blatt trägt `role="dialog"`, aber kein `aria-modal="true"` – kein Mangel (Antwort 7, U), aber die Regel aus 262 greift dort nicht (Nacharbeit, Morgenbericht).

Nicht aufgenommen (offen für B): mehr-neu Bild 2 und 3 bei 390, Bild 3 bei 1440 (Neu-Menü mit Fokus; „Aufnahme nachholen“ aus Lauf 32 bleibt offen).

### Stichproben der echten Fehler (keine Board-Wertung)

- **264** (/settings/payments, /settings/konditionen, Hof Müller, 390 hell): „Bis 31. Dezember 2027 zahlst du als Gründungshof auf Barverkäufe keine Plattformgebühr; die Lastschrift brauchst du erst danach.“ und Karte „Barzahlung“: „Einzug ab 1. Jänner 2028 · Bis 31. Dezember 2027 behältst du die Plattformgebühr aus Barbestellungen – wir verzichten darauf.“ Messung je 1 h1, sonst 0, axe 0.
- **263** (/problem-melden, nach sechs Sekunden abgeschickt, 390 hell): Danke-Seite mit Kurznummer aus sechs Zeichen in Großbuchstaben. Messung 1 h1, sonst 0, axe 0.
- **266** (/widerruf mit Rücktritts-Link, 390 hell): nach dem Absenden genau eine sichtbare h1 („Dein Rücktritt ist bei uns eingegangen“), sonst 0, axe 0. 500 hergestellt über `fotograf.sh db-aus` auf der eigenen Kopie: Seitentitel „Fehler — Agrilo“, eine h1, axe 0 (auch kein document-title).

Bilder: `.nachtlauf/screens/zwischen-a/` (mehr-neu je Fassung, Board-Bilder board-s1-mehr-neu und board-w1-mehr-neu, 263-danke, 264-payments, 264-konditionen, 266-widerruf-eingang, 266-widerruf-500, je mit .messung.json und .axe.json).

### Admin

Nicht abgenommen in Abschnitt A (keine Admin-Nummer fertig; Admin-Anmeldung nicht versucht).
