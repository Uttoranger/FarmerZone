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
