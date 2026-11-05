# Zeitbuch Lauf 31 (5.11.2026, Cloud-Sitzung Linux)

Vom Dirigenten geführt (freigabe.md §35 mit den Präzisierungen). Rechner: **4 Kerne**, 15 GB (Cloud-Container). Typecheck mit `NODE_OPTIONS=--max-old-space-size=6144` (Umgebungsvariable des Laufs, keine Projektvariable).

## Dirigent

- 19:34 Vorab-Prüfung 1: `agent-browser --version` → 0.39.1; Bild einer lokalen Seite (Board s1-bestaetigung-dunkel über file://) gelungen.
- Vorab-Prüfung 2: `git fetch origin`; origin/main = bf57d8d0 „Merge pull request #465“ → #465 gemergt (`gh pr view` scheitert an GraphQL; geprüft über den Merge-Commit auf origin/main).
- Vorab-Prüfung 3: `NODE_OPTIONS=--max-old-space-size=6144` für alle Läufe gesetzt.
- Postgres 16 im Container gestartet (localhost). `pnpm install --frozen-lockfile` grün (10 s), `prisma generate`.
- Abnahme-Datenbank `fz_abnahme` auf localhost: Migrationsfolge mit `DATABASE_URL` und `DIRECT_URL` ausdrücklich auf localhost eingespielt; Seed über `tsx prisma/seed.ts` mit derselben Adresse (nicht `pnpm db:seed`, das `.env.local` lädt – im Nachtlauf verboten; die Seed-Sperre `istDevDatenbank` lässt localhost durch). Platzhalter für Stripe und Auth nur in einer Datei im Scratchpad, nicht im Projekt.
- Admin: Das Seed-Konto `admin@example.com` hat keinen Passkey; `passkeyPflicht` (src/lib/admin-anmeldung.ts) schickt jede Admin-Sitzung nach /admin/einrichten (E-Mail-Code + Passkey). Eine Test-Anmeldung ohne Passkey gibt es nicht → nach Präzisierung 2 kein STOPP, Admin-Boards „nicht abgenommen“, kein Umweg.
- Branch `docs/lauf31` von origin/main (bf57d8d0): Freigabe §35 wörtlich (Text zwischen den Marken) mit den Präzisierungen darunter; Warteschlange (233a, 233–242, Sammel 31) und Reihenfolge in nachtlauf.md §3; Status-Zeile 233a.
- Abnahme-Server: `pnpm build` + `next start` auf Port 3100 statt `pnpm dev` – Grund: kein Entwicklungs-Hinweis von Next im Bild und eine Ladezeit nahe der Produktion (die Freigabe misst „erste Inhalte nach höchstens 1 s“).
- Board-Bilder: Skript rendert jedes `figure` jedes Boards (s1–s3, w1–w3, hell und dunkel) nach `.nachtlauf/screens/abnahme/<board>/<bild>-<breite>-<thema>-board.png`.
- Board-Bilder: erster Durchgang mit festem Fenster 2400×1400 beschnitt Bilder rechts und unten (Hinweis von pruefer-ui korb, kasse, bestellung-link, meine-bestellungen); zweiter Durchgang mit Fenster = Seitenbreite × Seitenhöhe, 1133 Bilder, ohne Fehler. Die vier Bewertungen auf beschnittenen Bildern verworfen und neu gestartet.
- Voller Lauf auf ca6b6b1b (Doku-Stand): Typecheck grün, Lint 0 Fehler (2 Warnungen), 679 Dateien, 12772 Tests grün (1 Worker, n=1, 13:33 min bei laufenden Fotografen). `docs/lauf31` gepusht.
- Gate A, Fotografen (Sonnet, je eigene DB-Kopie fz_g<n> und eigener Server 311<n>): G2 Kauf fertig (Online-Zahlung und Mail-Code nicht herstellbar: kasse Bild 4, meine-bestellungen Bild 3–6); G3 Hof-Alltag fertig (105 Fälle erreichbar); G1, G4, G5 laufen.
- A2 Punkt 9 (nur gelesen): Im Hofpreis-Modell rechnet `src/app/api/checkout/route.ts` (5c) mit `Farm.plattformgebuehrProzent`; `Farm.serviceFee*` wirkt nur im Modell `bisher` (vor dem Stichtag). Nach dem Stichtag ändert `setServiceFeeAction` nichts an neuen Bestellungen.
- pruefer-ui (Opus, je Board frisch, nur Bilder + Maßstab): korb 3/3/3/3 · kasse 2/2/2/2 · bestaetigung 2/2/2/2 · bestellung-link 2/2/2/2 · meine-bestellungen 3/3/2/2 · mehr-neu 3/3/2/2 · heute 2/2/2/2 · bestellungen 2/2/2/2 · bestellung 2/2/2/2 · druck 3/–/3/– · produkte 2/2/3/2 · produkt-neu 2/2/2/2 (390h/390d/1440h/1440d).
- Abweichung vom Ablauf (Tempo): 233 und 236 starten schon während G1/G4/G5 noch fotografieren, von `docs/lauf31` (ihre Boards sind bewertet); der Abnahme-Bericht kommt danach in den Doku-PR. Worktrees /home/user/wt/<nr>, je eigene DB-Kopie fz_w<nr> und Port 32<nr>.
- G1 Finden fertig (hoefe Bild 3 „Ort mehrdeutig“ nicht herstellbar: Ortssuche erreicht den Kartendienst nicht). Hofseite am Handy (390, hell, /hof-mueller, gebaute App, 5 frische Läufe unter Last): FCP Median 860 ms, LCP 960 ms, h1 sichtbar nach 385 ms → Vorgabe ≤ 1 s erfüllt; 2 Ausreißer ~9,7 s (Tab malte spät, Rechner belastet), getrennt in ladezeit.json.
- G4 Mein Hof fertig (148 Fassungen, alle erreichbar). Voller Lauf auf 7cd8cb2f grün (679 Dateien, 12772 Tests); Push von docs/lauf31 bis 7985eb4a (danach nur Zeitbuch-Zeilen).
- pruefer-ui: startseite 2/2/2/2 · hoefe 2/2/2/2 · hofseite 2/2/2/2 · produkt 2/2/2/2 · mein-hof 2/2/2/2 · einstellungen 2/2/3/2 · region 2/2/2/2 · hofdaten-zahlung 2/2/2/2 · konto-hof 2/2/2/2 · auswertung 2/2/3/3 · kunden 2/2/2/2.
- 235 gestartet (dritter Umsetzer der Welle 1). G6 System gestartet.
