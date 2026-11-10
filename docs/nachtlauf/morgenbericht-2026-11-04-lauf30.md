# Morgenbericht Lauf 30 (4.11.2026) · Redesign November 2026 – STOPP vor dem ersten Gate

**Ergebnis:** Lauf 30 ist nach Hinweis 6 der Schaltzentrale **gestoppt**, bevor eine Nummer begann. Fertig ist nur der **Doku-PR** (Branch `docs/lauf30`). **Nicht begonnen:** Regel-Inventur 30 und alle Nummern 219–232; sie stehen in `status.md` weiter auf „offen“, der nächste Lauf setzt nach §7 dort fort. Keine Migration, kein Paket, keine Variable, kein Code geändert.

**Stopp-Grund:** agent-browser ließ sich im Container nicht installieren. Die Rechteprüfung dieser Cloud-Sitzung (Auto-Modus) hat die Installation zweimal abgelehnt, mit dem Grund „Code from External“:
1. `pnpm add -g agent-browser` (neueste Version)
2. `pnpm add -g agent-browser@0.39.1` (feste Version vom 13.10.2026, also älter als 14 Tage nach G6)

Beide Versuche liefen global im Container, ohne Änderung an package.json, pnpm-lock.yaml oder pnpm-workspace.yaml. Hinweis 6 sagt dazu: „Klappt das nicht, gilt die Freigabe: STOPP … Es gibt dann keinen Lauf ohne Bilder.“ Einen Umweg (npx, Playwright, Chromium direkt) habe ich bewusst nicht versucht: CLAUDE.md lässt Browser-Prüfungen nur über agent-browser zu, und ein Umweg um die Ablehnung wäre gegen ihren Sinn.

**Ausgangslage je Nummer:** nicht am Code bestätigt, weil keine Nummer begann. main stand beim Start auf 056a321e; seitdem ist nichts dazugekommen. Die Ausgangslage aus der Freigabe gilt also ungeprüft weiter.

## Stand-Check (Linux, Cloud-Container, 4 Kerne)

| Punkt | Ergebnis |
|---|---|
| main enthält 056a321e | ja (origin/main = 056a321e) |
| Mockups: 304 Namen gleich der Soll-Liste | **ja.** Der Ordner und LISTE.txt (Zeile 1 „304“) stimmen genau mit der Soll-Liste aus der Freigabe überein; es gibt kein canvas.json und keine fremden Dateien |
| Skripte | nur `<script src="./support.js">` (304×) und `<script type="text/x-dc">` |
| Externe Verweise | nur `https://fonts.googleapis.com` (304×) |
| E-Mail-Adressen | nur `beispiel.at` und Subdomains (`hof-am-moos.`, `hof-am-bach.`, `agrilo.`, `neu.beispiel.at`) sowie `agrilo.at` – siehe „Bitte bestätigen“ |
| Telefonnummern-Wache | grün (12 Tests), ohne neue Ausnahme |
| Postgres lokal | läuft (Postgres 16, localhost) |
| agent-browser | **nicht installierbar** (siehe oben) → STOPP |
| install, typecheck, lint, test | siehe Zeitbuch (voller Lauf vor dem Push des Doku-PR) |
| Stripe | Produktion: Kasse meldet `testbetrieb: true` (über Vercel gelesen). Vorschau: Live-Schlüssel sind im Code gesperrt |

## PRs

| Nr. | PR | Basis | Migration | Inhalt |
|---|---|---|---|---|
| Doku 30 | (dieser PR) | main | nein | Mockups (6ce5aa98) samt LISTE.txt, Auftragsdatei (f179cabc), Freigabe §34 wörtlich mit „Ergänzung Ort und Mockups“, Mockup-Index Redesign November 2026, Register N41–N44 mit A1–A3, Warteschlange 219–232, Status, dieser Bericht |

Hinweis zu den Commits: 6ce5aa98 (nur Mockups) und f179cabc (nur docs/nachtlauf/auftrag-lauf30.md) entstanden ausnahmsweise von Windows aus ohne vollen grünen Lauf, mit Freigabe der Projektleitung. Die CI prüft sie mit diesem PR.

## Bitte bestätigen

1. **E-Mail-Adressen in den Mockups:** Subdomains von beispiel.at (zum Beispiel `kontakt@hof-am-moos.beispiel.at`) hat die Schaltzentrale als erfunden und harmlos eingestuft; sie bleiben stehen (Hinweis 5).
2. **Register N41–N44:** Die Überschriften enden vor dem Doppelpunkt, und der wörtliche Text steht in der Entscheidungszeile darunter, wie bei N38–N40. Dazu kam je eine Zeile „Umsetzung: Nr. …“.
3. **Mockup-Index:** Die Zuordnung mancher t-/w-Boards zu Routen (z. B. t-d zu /dashboard und /orders, t-m zu /admin/hoefe) ist aus Dateiname und Notiz abgeleitet. Steht sie nicht eindeutig fest, heißt es „siehe Notiz im Board“. Nicht zugeordnet („–“) sind: t-b2, t-e, t-g, t-h, t-i, t-j, t-k, t-m, t-n, t-q und t-r.

## Für dich zu tun

- [ ] **agent-browser ermöglichen**, dann Lauf 30 neu starten. Er setzt bei der Regel-Inventur 30 und Nr. 219 fort; der Doku-PR ist dann erledigt. Zwei Wege:
  - Im Setup-Skript der Cloud-Umgebung `pnpm add -g agent-browser@<Version ≥ 14 Tage>` und `agent-browser install` ausführen lassen.
  - Oder in den Einstellungen der Sitzung eine Regel erlauben, die genau diesen Befehl zulässt.
  - Danach prüft der Dirigent mit einem Bild einer lokalen Seite, dass agent-browser läuft.
- [ ] Diesen Doku-PR mergen, **per Merge-Commit**. Er ändert nur Doku und Mockups.
- [ ] Die drei Punkte unter „Bitte bestätigen“.
- [ ] Offen aus der Freigabe (unverändert, erst mit den Nummern relevant):
  - Vor dem Festschreiben lesend prüfen: gruendungMonate, gruendungFestAm, gruendungBisStandard, Höfe mit Gründungsplatz, und ob irgendwo „24 Monate“ oder „456 €“ zugesagt wurde.
  - A001 (Impressum) vor Stripe live.
- [ ] Zur Kenntnis: PR #448 (Impressum) ist offen. Lauf 30 hat ihn nicht berührt.

## Regelvorschläge

- **Dirigent:** Der Stand-Check prüft agent-browser als Erstes, noch vor install, typecheck und test. Dann bricht ein Lauf nicht erst nach dem Doku-Auftrag ab. Besser als eine Textregel ist eine Prüfung: Das Setup-Skript der Cloud-Umgebung installiert agent-browser, und ein Schritt `agent-browser --version` steht am Anfang des Stand-Checks (Ort: docs/nachtlauf.md §8 „Starten“).
- Die Regel-Inventur 30 (G4) ist nicht gelaufen und kommt in den Neustart.

## Bilder

Keine (agent-browser fehlt).

## Zeitbuch

docs/nachtlauf/berichte/zeitbuch-lauf30.md
