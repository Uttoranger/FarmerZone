# Abnahme Lauf 32 – Board × Fassung × Sterne

## Admin, Erstabnahme

Stand: Nr. 243 (Branch `nacht/2026-11-06/243-pruefwerkzeug`), Prüfstand = Commit der Nummer auf docs/lauf32. Erstmals mit Admin: Anmeldung auf /login/admin mit „Mit Passkey anmelden“ über den Prüf-Passkey der Wegwerf-DB und einen virtuellen Authenticator (freigabe.md §36, Register N46). Sterne: pruefer-ui (Opus, nur Bilder, 4 Agenten zu je 3 Boards; bewertet nur Board-Bild 1 je Fassung, Bilder 2–6/7 n. e.); „n. b.“ = App-Bild 1 zeigt nicht den Zustand von Board-Bild 1. Admin-Boards zählen nicht zum 5-Sterne-Kriterium, wohl aber zur Messung (Vorlage für 258b).

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
| admin-akte | 4 | 24 | 0 | 2 | 0 | 0 | 0 | 2 | 2 | 2 | 2 |
| admin-bestellungen | 4 | 24 | 0 | 0 | 0 | 0 | 0 | 2 | 2 | 2 | 2 |
| admin-betrieb | 4 | 24 | 0 | 0 | 0 | 0 | 0 | 2 | 2 | 2 | 2 |
| admin-einstellungen | 4 | 24 | 0 | 2 | 0 | 2 | 0 | 2 | 2 | 3 | 3 |
| admin-freischalten | 4 | 24 | 0 | 2 | 0 | 0 | 0 | n. b. | n. b. | n. b. | n. b. |
| admin-geld | 4 | 28 | 4 | 0 | 0 | 0 | 0 | 2 | 2 | 2 | 2 |
| admin-heute | 4 | 24 | 4 | 0 | 0 | 2 | 0 | 2 | 2 | 3 | 3 |
| admin-hoefe | 4 | 24 | 2 | 0 | 0 | 0 | 0 | 2 | 2 | 3 | 3 |
| admin-postfach | 4 | 24 | 0 | 0 | 0 | 0 | 0 | 2 | 2 | 2 | 2 |
| admin-shell | 4 | 24 | 4 | 0 | 0 | 2 | 0 | 3 | 3 | 4 | 4 |
| admin-startseite | 4 | 24 | 2 | 0 | 0 | 0 | 0 | 2 | 2 | 1 | 1 |
| admin-zugang | 4 | 24 | 0 | 0 | 0 | 0 | 0 | n. b. | n. b. | n. b. | n. b. |

- admin-akte: ziele: INPUT (321×44)
- admin-einstellungen: ziele: INPUT (336×44) · felder: input[checkbox]; input[email]  name@example.com
- admin-freischalten: ziele: INPUT (321×44)
- admin-geld: schrift: ERGEBNIS (10.5 px); ERSTATTUNGEN (11 px); GEBÜHR (10.5 px); KOSTEN (11 px); PLATTFORMGEBÜHR (11 px)
- admin-heute: schrift: BESTELLUNGEN HEUTE (11 px); DIENSTE (11 px); GELD · WOCHE (11 px); HÖFE (11 px) · felder: input[checkbox]
- admin-hoefe: schrift: BEST. 30 T (11 px); HOF (11 px); SIGNAL (11 px); ZUSTAND (11 px)
- admin-shell: schrift: BESTELLUNGEN HEUTE (11 px); DIENSTE (11 px); GELD · WOCHE (11 px); HÖFE (11 px) · felder: input[checkbox]
- admin-startseite: schrift: ENTWURF · NUR FÜR DICH SICHTBAR (10 px)

Lesart für 258b: „Ziele“ bei Akte, Freischalten und Einstellungen sind Eingabefelder knapp unter 44 px Höhe (gerundet 44). „Felder“ bei Heute bzw. Shell sind fünf Kästchen am Handy (Kennungen …-braucht-dich, -abholzeit, -sentry, -geld, -notfall) ohne zugeordnetes Label; bei Einstellungen ein Kästchen und das Adressfeld (nur Platzhalter). „Schrift“ sind die Großbuchstaben-Überschriften der Kacheln bzw. Tabellenköpfe (10,5–11 px) und die Marke „Entwurf · nur für dich sichtbar“ (10 px). Kein axe-Befund serious/critical, h1 überall genau eine.

### Bewertung pruefer-ui (Admin, Bild 1 je Fassung: 390 hell · 390 dunkel · 1440 hell · 1440 dunkel)

Gedeckt in allen Admin-Boards (U nach „Nicht herstellbare Bilder“): Testbanner, Chip „Stripe Test“, Entwicklungsanzeige von Next, Seed-Zahlen und Datum November 2026, Kürzel (Antwort 5); Q3 Fokus (nicht hergestellt); Unterleiste mitten im 390-Ganzseitenbild (Aufnahme). Für den Admin gibt es keine Board-oder-Code-Liste – die Abweichungen in Aufbau und Wortlaut unten sind die Vorlage für eine Admin-Board-oder-Code-Runde; gebaut wird in Lauf 32 nur Messbares (258b, Abschnitt B).

#### admin-heute — 2/2/3/3
- U: Next-Anzeige, Testbanner, „Stripe Test“, Seed-Daten/Kürzel/Datum, Jobs ohne Lauf. Q3: Fokus nicht hergestellt.
- Messbar: KPI-Kicker in Großbuchstaben 11 px (4 Stellen); 390: 5 Kästchen (Montags-Routine) ohne Beschriftung (vermutlich eingeklappt).
- 1440 Inhaltsbreite voll statt ~1140 px; KPI-Kacheln mit Symbol, Abzeichen neben der Zahl; „1 warten“ statt „1 wartet“; „Braucht dich“-Einträge anders aufgebaut, Zählung grau statt orange; „Nr. meldung-“ ohne Nummer; „Läuft von selbst“ 8 Jobs zweizeilig, andere Namen, „Unbestätigte Barbestellungen freigeben“ fehlt; „(Register N38)“ im Anzeigetext; Montags-Routine-Unterzeile; „Bestellungen anhalten …“ orange statt neutral; 390 KPI einspaltig statt 2er-Raster, Logo-Kopf statt Kopfkarte.
#### admin-shell — 3/3/4/4
- Navigation, Abzeichen, Statusleiste, Kürzel und untere Leiste wie Board.
- Mond statt Sonne im hellen Theme; Inhaltsbreite voll; 390 Logo-Kopf statt Kopfkarte „<Seite> / Admin · Stand …“.
#### admin-hoefe — 2/2/3/3
- Messbar: Spaltenköpfe in Großbuchstaben 11 px (5 Stellen).
- Tabelle volle Breite; Zustand als Pille mit „seit 1 h“ statt einzeilig; „Stripe fehlt“ beim wartenden Hof neutral statt Warnfarbe; Lupe im Suchfeld, Suchfeld-Höhe; 390 Reihenfolge Zählzeile/Suche/Chips, große Hofkarten statt kompakter Linkzeilen, Logo-Kopf.
#### admin-akte — 2/2/2/2
- Antwort 5: Kürzel „HM“ bleibt (gedeckt). Messbar: 1440 Eingabefelder 321×44 (Grenzfall, nachmessen).
- 1440 zwei statt drei Spalten, volle Breite; Knöpfe in der h1-Zeile; 390 Reihenfolge Kontakt/Aktivität/Zustand, Logo-Kopf; Unterzeile „<Ort> · <Name>“ fehlt; Kontakt/Aktivität/Zustand-Aufbau und Wortlaut anders („LFBIS …“, „30 Tage“, Chips „ok/Achtung“, „nein“ statt „keine“); Leerzustände mit Symbol (Antwort 9 → kommt mit 246); Datum ISO „Vorgabe 2028-01-01“, Datumsfeld mm/dd/yyyy (Browsersprache); Checkbox browserblau statt Token; Mond statt Sonne hell.
#### admin-freischalten — nicht bewertbar (n. b.)
- App-Bild 1 zeigt keinen offenen Dialog „Hof freischalten?“ (Seed braucht wartenden Hof MIT Stripe; Fotograf muss „Freischalten …“ öffnen) → Nachfoto.
- Sichtbar: „Eingreifen“ nicht zuerst; „Freischalten“/„Ablehnen“ ohne „…“; Sperr-Hinweis anderer Wortlaut; „Vorübergehend sperren …“ und Aktivität zusätzlich; Unterzeile fehlt; Zustand ohne „E-Mail · bestätigt“; dieselben Punkte wie akte.
#### admin-bestellungen — 2/2/2/2
- Detailspalte nicht prüfbar (keine Bestellung gewählt) → Nachfoto.
- Filter als Karte mit Auswahlfeldern statt Chips; Wortlaut/Vorgaben („E-Mail-Adresse“ statt „genaue Adresse“, „alle“, 90 statt 7 Tage, Vorauswahl); Listenzeile ohne Betrag/„bar“, andere Unterzeile; Zählkopf in der Liste; volle Breite, zusätzlicher Fußtext; 390 Logo-Kopf, „Auskunft …“, gestapelte Auswahlfelder; Mond statt Sonne.
#### admin-postfach — 2/2/2/2
- U (alle drei Boards): Testbanner, Chip „Stripe Test“, Next-Anzeige, Seed-Zahlen/Kürzel, Datum Nov. 2026; Tab-Leiste mitten im 390-Ganzseitenbild = Aufnahme.
- Mangel (alle Admin-Boards dieses Agenten): Inhaltsbreite 1440 voll statt ~1100 px; Handy-Kopf mit Logo/Theme/Kürzel statt Seitentitel + „Admin · Stand …“.
- Bild 1 „Eingang mit Faden“: App zeigt keinen geöffneten Faden (Aufnahme ohne geöffneten Eintrag → Nachfoto nötig).
- Zeilen: Meldungs-Chips statt Gesprächs-Chips; Unterzeile „Neu · Nr. meldung-“ ohne sichtbare Nummer; zusätzlicher Kartenkopf „EINGANG · FILTER OFFEN“; Fußnote anderer Wortlaut; Tab „Eingang 4“ ohne Trennpunkt; Stift-Symbol am Knopf; 390: Knopf „Rundschreiben schreiben“ im Inhalt, leerer Detailbereich + Fußnote, Betreff einzeilig abgeschnitten statt zweizeilig.
#### admin-startseite — 2/2/1/1
- 1440: Vorschau „So sieht's die Kundin“ leer (während „Compiling“) → Nachfoto nötig.
- Messbar: „ENTWURF · NUR FÜR DICH SICHTBAR“ 10 px.
- 1440 dunkel: Entwurfsleiste helle orange Vollfläche (heller Fleck); Board gedämpft.
- Segment-Schalter statt Pill-Tabs; zusätzlicher Untertitel; Statusleiste-Knöpfe in einer Zeile; Blockliste (Pfeile links, fehlende Unterzeilen, Kopfzeile, Einfüge-Zeilen, „Fuß“); zusätzliche Karten „Im Entwurf gespeichert“/„Was sich … ändert“; Vorschau-Kopf ohne „Vorschau öffnen ↗“/„nächster Block“; 390: feste Leiste „Entwurf · n Änderungen“ fehlt (evtl. Zustand), zusätzliche Fußnote.
#### admin-geld — 2/2/2/2
- Messbar: Kachel-Beschriftungen 10,5–11 px in Großbuchstaben (Board normal geschrieben).
- 390: 3 statt 5 Kacheln (Erstattungen, Kosten, Unterzeilen fehlen); 1440 Raster anders (Loch rechts); 390 Reihenfolge Monatsabschluss/Plattformgebühr; Kopf ohne „›“, Segment vorn; Abgleich als Chips statt Statustext; Monatsabschluss Chips statt Häkchen, Knopf-Reihenfolge vertauscht, gesperrter Knopf lachsfarben gefüllt; „Einzüge aller Monate“ nicht als Link erkennbar; Kosten-Knopf oben „+ Kostenposten“, zusätzliche Summe/Chips.
- Verdacht (fachlich prüfen): Kachel „€ 0 · 0 Bestellungen“, Plattformgebühr „€ 2,85 · online € 2,85“, Karte „online (von Stripe einbehalten) € 0,00“ widersprechen sich (Monatsgrenze/Testzahlungsfilter?).
- Board-Bilder 2–6/7: n. e. (Zeitbudget Admin).
#### admin-betrieb — 2/2/2/2
- Kacheln anders (5 große mit Anbieter-Pille statt 4 schmale Balken); zusätzliche Abschnitte (Vorschau-Hinweis, Dienste, Alarm-Matrix, Verlauf 90 Tage, Tarife, Vercel-Ausgaben, Größte Tabellen, Legende); Ablauf-Liste andere Jobs/Namen; „Nur im Dashboard“ Linkliste statt Tabelle; 390 Logo-Kopf, einspaltige Kacheln statt 2×2; Mond statt Sonne hell. „Noch nicht gemessen“ u. ä. = U (Prüf-DB ohne Messung).
#### admin-einstellungen — 2/2/3/3
- Messbar: 390 8 Felder ohne Beschriftung (E-Mail nur Platzhalter, 7 Checkboxen; vermutlich zugeklappter Abschnitt Benachrichtigungen); 1440 5 Eingabefelder 44 px (Grenzfall).
- „Hofpreis-Modell ab“ nicht in der Seitenspalte; Seitenspalte mit Symbolen/Hülle, abgeschnittener Untertitel; Gruppen-Kopf „Register K2“-Pille + anderer Satz; zusätzliche Felder/Erklärtexte, Schalter links; Widerspruch „36 sind schon vergeben. Trag mindestens 36 ein.“ vs. Kachel „Vergeben 12 · Frei 0“ (Anzeige-Widerspruch, P2 deckt die Zahl, nicht den Widerspruch); Datumsfelder mm/dd/yyyy; gefüllte statt umrandete Felder; 390 Akkordeon statt offener Karte, Untertitel gekürzt.
#### admin-zugang — Board 1 nicht bewertbar; hilfsweise gegen Board 5 (Anmeldung) 3/3/3/3
- App-Bild 1 zeigt /admin/einstellungen/anmeldung, Board 1 ist „Bestätigen vor dem CSV-Export“ (Passkey-Bestätigung unter Geld) → Nachfoto.
- Gegen Board 5: 1440 eine schmale Spalte statt zwei; „Passkey hinzufügen“ Textlink statt Umrandungsknopf, „n eingerichtet“ fehlt; zusätzliche Texte; 390 Logo-Kopf; Rücklink grau statt grün unterstrichen.

Durchgehend (mehrere Boards): Inhaltsbreite 1440 voll statt ~1100–1140 px; Handy-Kopf mit Logo/Theme-Knopf/Kürzel statt Kopfkarte „<Seite> / Admin · Stand …“; Theme-Knopf zeigt im hellen Theme den Mond statt der Sonne; Leerzustände mit Symbol (kommt mit 246, N46); native Datumsfelder mm/dd/yyyy (Browsersprache der Prüfumgebung – Aufnahme mit de-AT wiederholen).

Nachfotos nötig (Zustand nicht hergestellt): freischalten (Dialog „Hof freischalten?“, wartender Hof mit Stripe), zugang Bild 1 (Passkey-Bestätigung vor dem CSV-Export), bestellungen (Bestellung gewählt), postfach (Faden geöffnet), startseite 1440 (Vorschau nach dem Kompilieren).

Fachlich zu prüfen: admin-geld – Kachel „€ 0 · 0 Bestellungen“ gegen Plattformgebühr „€ 2,85 · online € 2,85“ gegen „online (von Stripe einbehalten) € 0,00“; admin-einstellungen – „36 sind schon vergeben“ gegen Kachel „Vergeben 12 · Frei 0“.
