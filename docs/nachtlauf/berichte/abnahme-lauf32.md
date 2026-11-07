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

## Zwischen-Durchgang A

Stand: Zwischenstand `integration/lauf32` 90ba8d01 (243, 244, 245, 246, 247, 256, 258, 259; 248 ändert keine Seite, 249 folgt unten). Bilder: `.nachtlauf/screens/zwischen-a/<board>/` (App `<bild>-<breite>-<thema>.png` mit `.messung.json`/`.axe.json`, Board `…-board.png`), im Container, nicht committet. Fotograf: Prüfwerkzeug aus Nr. 243 (zwei eigene Bauten: Stichtag in der Vergangenheit, Port 3311; Stichtag in der Zukunft, Port 3312; dev-Fotograf für den Admin mit Prüf-Passkey). Bewertung: pruefer-ui (Opus, je Board ein frischer Agent, nur Bilder, Maßstab §35/§36, Liste mit Q1–Q5, Auftragsabschnitte „Antworten der Projektleitung“, „P-Punkte“, „Nicht herstellbare Bilder“). Boards nicht begonnener Nummern: offen (Abschnitt B).

### Ergebnis (schlechtestes Bild je Fassung: 390 hell · 390 dunkel · 1440 hell · 1440 dunkel; Mails nur hell)

| Board | Nummer(n) dieses Laufs | Schluss Lauf 31 | Zwischen-Durchgang A | Nummer abgeschlossen | gedeckt / offen |
|---|---|---|---|---|---|
| bestaetigung | 244 (253 in B) | 3·3·3·3 | 2·2·2·2 (schlechter: Bild 3 ist jetzt eine Bar-Bestellung nach dem Stichtag mit Gebührenzeile; pruefer-ui wertete das als Mangel, der Dirigent als R nach AGB 10.2 – ohne diesen Punkt bliebe Bild 3 wegen der offenen B-Zeilen von 253 bei 2–3) | 244 ja, 253 nein | offene B-Zeilen 253; R: Ware · Plattformgebühr · Gesamt (AGB 10.2) |
| bestellung-link | 244 (253 in B) | 4·4·4·3 | 4·4·4·4 | 244 ja, 253 nein | offene B-Zeilen 253 |
| kasse | 259 (253 in B) | 5·5·5·4 | 5·5·4·4 | 259 ja | Spaltenbreite 1440 und Rückweg ohne Listenzeile (Board oder Code) |
| einstellungen | 245 (250 in B) | 3·3·3·3 | 3·3·3·3 | 245 ja, 250 nein | „‹“ (Frage N1), offene B-Zeilen 250, Abstände |
| rechtstexte | 259 (254 in B) | 3·3·3·3 | 4·4·3·3 | 259 ja, 254 nein | offene B-Zeilen 254; Mangel 259: Ziel „Frühere Fassung 0.9“ < 44 px |
| mail-hof-bestellung | 256 (255 in B) | 3 (390) · 3 (600) | Bild 2: 4 (390) · 4 (600) | 256 ja, 255 nein | Uhrzeit, Positionszeile (255) |
| admin-heute | 258 | Admin n. a. | 2·2·3·3 | 258 ja | Admin zählt nicht zum Kriterium |

(Spalte „Schluss Lauf 31“ aus docs/nachtlauf/berichte/abnahme-lauf31.md, Schluss-Durchgang.)

### Messung

Alle Kunden- und Hof-Bilder dieses Teils: Schrift < 12 px 0, Ziele < 44 px 0 (außer „Frühere Fassung 0.9“ auf /agb, 18 px), h1 genau 1, Felder ohne Beschriftung 0, axe ohne serious/critical. Mail: h1 nicht im HTML (Überschrift sichtbar), axe document-title (Mail-typisch). Admin › Heute: Schrift 11 px an vier Kachel-Überschriften, 390 fünf Kästchen ohne sichtbare Beschriftung.

### DB-Abfragen je Aufruf (Nr. 259, lokal gemessen)

| Seite | 1. Aufruf | 2. Aufruf |
|---|---|---|
| /agb | 1 (Tagesmessung BetriebMessung nach dem Start, nicht die Seite) | 0 |
| /agb/1.0 | 0 | 0 |
| /konditionen | 3 | 3 |

/konditionen fragt je Aufruf COUNT Farm, PlattformEinstellung und Farm ab (vorher einmal je Stunde); A005 4e: so gelassen, kein neuer Cache.

### Befunde je Board

#### bestaetigung (Nr. 244 gebaut; Seiten-Nummer 253 in B) — Gesamt 2/2/2/2 (Bild 3 ohne den R-Punkt: 2, wegen der offenen B-Zeilen von 253)
| Bild | 390 h | 390 d | 1440 h | 1440 d |
|---|---|---|---|---|
| 1 Online bezahlt | 3 | 3 | 3 | 3 |
| 2 weiter unten (in 1) | 3 | 3 | 3 | 3 |
| 3 Bar, wartet auf Bestätigung | 2 | 2 | 2 | 2 |
| 4 Ohne gültigen Link | 4 | 4 | 4 | 4 |
Messung sauber (Schrift 0, Ziele 0, h1 = 1, Felder 0, axe 0).
- Vom Dirigenten eingeordnet (pruefer-ui wertete „Mangel“): Bild 3 zeigt im Hofpreis-Modell eine eigene Zeile „Plattformgebühr · € 5,56“ und „Gesamt € 98,16“ (Waren € 92,60 + Gebühr) neben „Die Plattformgebühr ist Teil des Preises“ – das verlangen AGB 1.0 Punkt 10.2 („Die Kasse weist sie zur Information getrennt aus (‚Ware · Plattformgebühr · Gesamt‘)“) und N38 → R (Recht/Register vor Board), kein Mangel; Board-Korrektur. Nr. 244 berührt diesen Fall nicht.
- Mangel, B-Zeilen offen (Nr. 253): Zahlzeilen „Online bezahlt · inkl. Plattformgebühr (n %)“ / „Bar bei Abholung · inkl. …“ (Z. 177, 178), h1-Größe/Kartenbreite (Z. 182), Rundung „Erzähl’s weiter“ (Z. 183), Höhe Neuigkeiten-Karte (Z. 176).
- Mangel ohne Listenzeile: Abholzeit „15:00–18:00 Uhr“ statt „15–18 Uhr“; Logo im Web-Fuß fehlt (G11 sagt „Web ohne Logo“ – Board-Korrektur?).
- U/Prüf-Seed: Bild 1 mit Altmodell-Bestellung (TD-0009) statt Hofpreis-Modell → Prüf-Seed um eine Online-Bestellung im Hofpreis-Modell ergänzen.
- Gedeckt: Z. 175, 179, 180, 181, 184, 185, Q3.
- Regel Nr. 244 erfüllt: TD-0005 „Servicegebühr (entfällt) · ~~€ 4,75~~“, Gesamt € 95,00 = Warenpreis; TD-0015 (Hofpreis, storniert) ohne Gebührenzeile, Gesamt = Ware. Beobachtung: TD-0005 zeigt den Satz „Für Bereitstellung, Abwicklung …“ trotz entfallener Gebühr; storniert zeigt in der Zahlzeile „Noch offen“ (→ 253).

#### bestellung-link (Nr. 244 gebaut; Seiten-Nummer 253 in B) — Gesamt 4/4/4/4
| Bild | 390 h | 390 d | 1440 h | 1440 d |
|---|---|---|---|---|
| 1 Bestellung ansehen | 4 | 4 | 4 | 4 |
| 2 Bar bestätigen | 4 | 4 | 4 | 4 |
| 3 verfallen | 5 | 5 | 4 | 4 |
| 4 Signatur ungültig | 4 | 4 | 4 | 4 |
Messung sauber (Schrift 0, Ziele 0, h1 = 1, Felder 0, axe 0).
- Mangel, B-Zeilen offen (Nr. 253): Zahlzeile „Online bezahlt · … inkl. Plattformgebühr“ in Positionsgröße (Z. 192), Link-/h1-Größe (Z. 194), „Bar bei Abholung · inkl. …“ (Z. 191; Prüf-Seed braucht dafür eine Bar-Bestellung MIT Gebühr), Trennlinie und Pfeil (Z. 196).
- Mangel ohne Listenzeile: Bild 4 mit Seitenfuß (Board ohne) – Pflicht-Links/G11, Board-Korrektur vorgeschlagen.
- Gedeckt: Gebührenzeile vor dem Stichtag (N38/V63), Q3, Z. 190 (U), „Vertrag widerrufen“ (N39), Uhrzeit-Format (Register Nr. 82, DS V9 – Liste ohne Zeile, Board-Korrektur), Beispieldaten (U).
- Regel Nr. 244 erfüllt (Gebühr gilt: Gesamt mit Gebühr; TD-0005 entfallen: durchgestrichen, Gesamt = Warenpreis; Gebühr 0: keine Zeile). Nicht in Bildern belegt: online erstattet, NOT_PICKED_UP mit offener Erstattung, Hofpreis mit entfallener Gebühr (durch Tests in 244 belegt).
- Zur Kenntnis (→ 253): stornierte Bestellung zeigt „Noch offen“ in der Zahlzeile.

#### kasse (Nr. 259 Kassensatz gebaut; Darstellung 253 in B) — Gesamt 5/5/4/4 (nur Board-Bild 1; übrige n. e., Stripe nicht prüfbar)
Messung sauber (Schrift 0, Ziele 0, h1 = 1, Felder 0, axe 0).
- Mangel ohne Listenzeile (Board-oder-Code-Frage, Kasse hat nur C/R/U): 1440 Spalten breiter als im Board (Inhalt 1152 statt 1104 px, Hauptspalte 744 statt 680, Abstand 28 statt 64, Übersicht 380 statt 360, Termin-Kacheln 63 statt 70 px); Rückweg „Zurück zum Hof“ mit Symbol statt unterstrichenem „←“ (bei bestellung-link deckt Z. 196 dasselbe als B).
- Gedeckt: Stripe/Online nicht prüfbar (Auftrag), Z. 202 (Grafik dunkel ungedämpft, R), Z. 203, Z. 204 (U), N10-Bar-Satz, Register vor Board (Reservierungsfrist F9, USt, N38-Satz, „Angaben zum Hof“, „Deine Bestellung“ über dem Knopf, Gewährleistung vor dem Knopf), Beispieldaten (U), Q3. Grundpreis „€ 18,87 / kg“ (N38, ohne Listenzeile – bitte bestätigen).
- A005 Schritt 6 erfüllt: ab T „Es gelten die AGB von Agrilo. Dein Vertragspartner ist der Hof.“ (Link „AGB“), vor T zusätzlich „Mit dem Bestellen stimmst du zu, dass Agrilo die Vermittlung sofort ausführt.“; Rücktrittssatz unverändert.

#### einstellungen (Nr. 245 Beispiel-Route /settings; Seiten-Nummer 250 in B) — Bild 1: 3/3/3/3 (Bild 2 Fehlerkarte n. e.)
Messung sauber (Schrift 0, Ziele 0, h1 = 1, Felder 0, axe 0).
- Mangel, Frage N1: „‹“ vor „Einstellungen“ am Handy fehlt (/settings hat keine Elternseite) – Z. 439 nur halb (Leiste weg, Pfeil fehlt).
- Mangel, B-Zeilen offen (Nr. 250): Futtermittel-Nummer statt „Eigene Ernte …“ (Z. 442), Gründungshof-Zeile (Z. 443), Spaltenbreite 1440 (Z. 445).
- Mangel ohne Listenzeile: Abstände unter dem Kopf (1440: erste Karte ~34 px tiefer; 390: 29 statt 17 px, 31 statt 21 px) – Kopf G1 (245) bzw. Seite (250).
- Erledigt durch 245: Z. 440 (Unterzeile), Leisten-Teil von Z. 439, Z. 446 (Statuspunkt).
- Gedeckt: Z. 441, Z. 444/Q1, Q3, Seed (U), A1.
- Ohne die offenen B-Zeilen von 250, das „‹“ und die Abstände wäre Bild 1 in allen Fassungen 5 Sterne.

#### rechtstexte (Nr. 259 gebaut; Rahmen-Nummer 254 in B) — Gesamt 4/4/3/3
| Bild | 390 h | 390 d | 1440 h | 1440 d |
|---|---|---|---|---|
| 1 /agb | 4 | 4 | 3 | 3 |
| 2 /agb#punkt-15 | 4 | 4 | 3 | 3 |
| 3 /datenschutz | 4 | 4 | 3 | 3 |
| 4 /impressum | 4 | 4 | 3 | 3 |
| 5 /konditionen (P2 ohne Wertung) | 4 | 4 | 3 | 3 |
| 6 /konditionen#gebuehr | 4 | 4 | 3 | 3 |
Messung: Schrift 0, h1 = 1, Felder 0, axe ohne serious/critical (heading-order moderate im Rechtstext: R).
- **Mangel Nr. 259 (Nacharbeit):** Link „Frühere Fassung 0.9 (für Bestellungen bis …)“ steht frei, Ziel 18 px (1440) bzw. 42 px (390) hoch, unter 44 px.
- Mangel, B-Zeilen offen (Nr. 254): Verzeichnis ohne aktiven Eintrag und ohne Mitscrollen (Z. 847), Teil-Überschriften (Z. 854), h1 (Z. 855), Trennlinien (Z. 856), Fußbreite und Ausrichtung (Z. 850, G11), Impressum/Konditionen mittig statt linksbündig (Z. 850), „Hof registrieren“ volle Breite (Z. 857), Fußlinks am Handy (Z. 859); ohne Listenzeile: Fließtext gedämpft statt Vordergrund, Drucker-Symbol, Impressum-Kopfzeile „RECHTLICHES“.
- Gedeckt: Z. 845, 846 (P2), 848, 849 (Q2), 851, 852 (Q3), 853, 858, 860, A1; „kontakt@agrilo.at“ ist Inline-Link (Messung ordnet ihn falsch ein).
- A005 erfüllt: vor T /agb = 0.9 mit „Ab 6. Dezember 2026 gilt Fassung 1.0. Fassung 1.0 lesen“; ab T /agb = 1.0; /agb/0.9 und /agb/1.0 verweisen auf /agb; /konditionen ab T ohne „Entwurf“.
- DB-Abfragen je Aufruf (lokal gemessen, Server mit Stichtag in der Vergangenheit): /agb 0 (erster Aufruf nach dem Start 1 – Tagesmessung BetriebMessung, nicht die Seite), /agb/1.0 0, /konditionen 3 je Aufruf (COUNT Farm, PlattformEinstellung, Farm) – wie im Bericht 259 aus dem Code abgeleitet; A005 4e: so gelassen, kein neuer Cache.

#### mail-hof-bestellung (Nr. 256 gebaut = Bild 2; übrige Bilder Nr. 255 in B) — Bild 2: 390 hell 4 · 600 hell 4
- Mangel, B-Zeilen offen (Nr. 255): Abholzeit „09:00–12:00 Uhr“ statt „9:00–12:00 Uhr“ (Z. 961, auch 600); Positionszeile „Bergkäse · 2 × 250 g“ statt „3× Bergkäse (250 g)“ (Z. 959, G14).
- Nicht sichtbar, für 255 zu prüfen: Die Überschrift „Neue Bestellung eingegangen“ steht nicht in einem `<h1>` (Auftrag 256 nennt „h1“) – vermutlich die ganze Vorlage; Betreff aus dem Bild nicht prüfbar (Test in 256 prüft ihn).
- Gedeckt: Frist mit Wochentag und Datum (Auftrag), Zeile „Kundin“ nur mit Namen (C Z. 958; ohne Telefon nach Auftrag), Fuß (R Z. 963), Ersatz-Serife (U Z. 962, Q5), gezeichneter Mail-Kopf des Boards.
- Wie im Board: Reihenfolge, h1-Text, Einleitungssatz, Bestellnummer, Warnkasten, „Bar zu kassieren“ ohne Doppelpunkt, „Bei Heute ansehen →“, „Versandt von Agrilo.“.

#### admin-heute (Nr. 258 gebaut; Admin zählt nicht zum 5-Sterne-Kriterium) — 2/2/3/3 (gleich wie Erstabnahme)
- Nr. 258: Geld-Kachel und „Woche: n“ sichtbar in allen Fassungen („€ 233 Umsatz der Höfe · Plattformgebühr € 2,85“, „Woche: 6 (+500 % zur Vorwoche)“ im Board-Format); bei der Erstabnahme (gleicher Seed, alte Regel) „€ 0“ und „Woche: 0“ → inhaltlich besser. Zahlen belegt der Integrationstest von 258, nicht das Bild.
- Wort-Frage (Board): „Umsatz der Höfe“ zählt jetzt auch unbestätigte Bar-Bestellungen – „Bestellwert“?
- Messbar (→ 258b): Kachel-Überschriften 11 px (4 Stellen); 390: 5 Kästchen ohne sichtbare Beschriftung (vermutlich eingeklappte Montags-Routine).
- Aufbau/Wortlaut (Liste für eine Admin-Board-oder-Code-Runde): „1 warten“ statt „1 wartet“; Dienste „4 von 4 laufen“ bei fünf Namen; Pillen-Lage; volle Breite; „Braucht dich“-Aufbau; „Läuft von selbst“ mit acht anderen Abläufen; Montags-Routine-Unterzeile; „Bestellungen anhalten …“ orange; 390 Kopf und einspaltige Kacheln am Ende.

