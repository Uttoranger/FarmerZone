# Abnahme Lauf 32 – Board × Fassung × Sterne

## Admin, Erstabnahme

Stand: Nr. 243 (Branch `nacht/2026-11-06/243-pruefwerkzeug`), Prüfstand = Commit der Nummer auf docs/lauf32. Erstmals mit Admin: Anmeldung auf /login/admin mit „Mit Passkey anmelden“ über den Prüf-Passkey der Wegwerf-DB und einen virtuellen Authenticator (freigabe.md §36, Register N46). Sterne bewertet pruefer-ui danach (frischer Agent je Board); die Spalten stehen deshalb leer. Admin-Boards zählen nicht zum 5-Sterne-Kriterium, wohl aber zur Messung (Vorlage für 258b).

### So gemessen

- App: dev-Fotograf (`scripts/pruefung/fotograf.sh dev`, `next dev` auf 127.0.0.1:3000, eigener Worktree, Wegwerf-DB aus `pnpm pruefen:seed`, Stichtag 1.10.2026, Seed-Admin als Inhaberin). Prüf-Browser: Chromium mit DevTools nur auf 127.0.0.1, `--enable-features=OverlayScrollbar` (sonst rechnet die Seite wegen `scrollbar-gutter: stable` mit 375 statt 390 px). Handy 390×844, Web 1440×900, Thema über `prefers-color-scheme`, ganze Seite (`scripts/pruefung/seiten-bild.sh`).
- Boards: jedes `figure` von `docs/mockups/redesign-2026-11/s3-admin-<board>[-dunkel].dc.html` (390) und `w3-admin-<board>[-dunkel].dc.html` (1440), Fenster = ganze Board-Fläche (`scripts/pruefung/board-bilder.sh`), wie Lauf 31.
- Messung je App-Bild (`scripts/pruefung/messung.js`): Schrift < 12 px (sichtbar, ohne aria-hidden/SVG), Ziele < 44 px ohne ::before/::after (Inline-Links getrennt), Zahl der h1, Felder ohne sichtbare Beschriftung; axe-core 4.12.1 über `agent-browser a11y`, nur serious/critical. Spalten = Zahl der App-Fassungen (von 4) mit mindestens einem Befund.
- U wie in §36: Entwicklungsanzeige von Next (Knopf „N“ unten links), Banner „TEST · Dev-DB · Stripe Test“, Bestand und Datum des Seeds (Boards: 3. März 2027). Die fixe Unterleiste am Handy erscheint im Ganzseitenbild mitten im Bild (Aufnahme, U).

### Bilder

- App: `.nachtlauf/screens/243/admin/<board>/1-<390|1440>-<hell|dunkel>.png` (dazu `.messung.json`, `.axe.json`).
- Board: `.nachtlauf/screens/243/admin/<board>/<n>-<390|1440>-<hell|dunkel>-board.png`, n = 1–6 (Geld 1–7).
- Zugeordnete Route (App-Bild = Board-Bild 1): heute und shell → /admin · hoefe → /admin/hoefe · akte → /admin/hoefe/<Hof Müller> · freischalten → /admin/hoefe/<hof-wartend> · bestellungen → /admin/bestellungen · postfach → /admin/postfach · startseite → /admin/startseite · betrieb → /admin/betrieb · einstellungen → /admin/einstellungen · geld → /admin/geld · zugang → /admin/einstellungen/anmeldung.
- Nicht hergestellt in der Erstabnahme: Board-Bilder 2–6 bzw. 2–7 als App-Bild (Dialoge, Blätter, Leer-, Lade- und Fehlerzustände, Notbremse, Freischalten-Dialog, Passkey entfernen, Einrichten mit Code). Grund: Zeitbudget Admin 60 min; das Werkzeug kann sie herstellen (Dialoge per agent-browser, Fehler per eigener DB-Kopie). pruefer-ui wertet Bild 1 je Fassung; die übrigen gehen als „n. e.“ in die Wertung.

### Messung

| Board | App-Bilder | Board-Bilder | Schrift < 12 | Ziele < 44 | h1 ≠ 1 | Felder | axe | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|---|---|---|---|---|---|---|
| admin-akte | 4 | 24 | 0 | 2 | 0 | 0 | 0 | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt |
| admin-bestellungen | 4 | 24 | 0 | 0 | 0 | 0 | 0 | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt |
| admin-betrieb | 4 | 24 | 0 | 0 | 0 | 0 | 0 | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt |
| admin-einstellungen | 4 | 24 | 0 | 2 | 0 | 2 | 0 | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt |
| admin-freischalten | 4 | 24 | 0 | 2 | 0 | 0 | 0 | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt |
| admin-geld | 4 | 28 | 4 | 0 | 0 | 0 | 0 | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt |
| admin-heute | 4 | 24 | 4 | 0 | 0 | 2 | 0 | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt |
| admin-hoefe | 4 | 24 | 2 | 0 | 0 | 0 | 0 | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt |
| admin-postfach | 4 | 24 | 0 | 0 | 0 | 0 | 0 | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt |
| admin-shell | 4 | 24 | 4 | 0 | 0 | 2 | 0 | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt |
| admin-startseite | 4 | 24 | 2 | 0 | 0 | 0 | 0 | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt |
| admin-zugang | 4 | 24 | 0 | 0 | 0 | 0 | 0 | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt | pruefer-ui folgt |

- admin-akte: ziele: INPUT (321×44)
- admin-einstellungen: ziele: INPUT (336×44) · felder: input[checkbox]; input[email]  name@example.com
- admin-freischalten: ziele: INPUT (321×44)
- admin-geld: schrift: ERGEBNIS (10.5 px); ERSTATTUNGEN (11 px); GEBÜHR (10.5 px); KOSTEN (11 px); PLATTFORMGEBÜHR (11 px)
- admin-heute: schrift: BESTELLUNGEN HEUTE (11 px); DIENSTE (11 px); GELD · WOCHE (11 px); HÖFE (11 px) · felder: input[checkbox]
- admin-hoefe: schrift: BEST. 30 T (11 px); HOF (11 px); SIGNAL (11 px); ZUSTAND (11 px)
- admin-shell: schrift: BESTELLUNGEN HEUTE (11 px); DIENSTE (11 px); GELD · WOCHE (11 px); HÖFE (11 px) · felder: input[checkbox]
- admin-startseite: schrift: ENTWURF · NUR FÜR DICH SICHTBAR (10 px)

Lesart für 258b: „Ziele“ bei Akte, Freischalten und Einstellungen sind Eingabefelder knapp unter 44 px Höhe (gerundet 44). „Felder“ bei Heute bzw. Shell sind fünf Kästchen am Handy (Kennungen …-braucht-dich, -abholzeit, -sentry, -geld, -notfall) ohne zugeordnetes Label; bei Einstellungen ein Kästchen und das Adressfeld (nur Platzhalter). „Schrift“ sind die Großbuchstaben-Überschriften der Kacheln bzw. Tabellenköpfe (10,5–11 px) und die Marke „Entwurf · nur für dich sichtbar“ (10 px). Kein axe-Befund serious/critical, h1 überall genau eine.
