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


### Zwischen-Durchgang A, Teil 2 (Nr. 249, Hof-Alltag; Stand 39bb825f)

Fotograf: ein Bau, Stichtag in der Vergangenheit, Port 3321, Wegwerf-DB und eine DB-Kopie für „neuer Hof“ (Achleitenhof ohne Abholzeiten und Produkte). 97 App-Bilder; Dialoge und Blätter als Fensterbilder.

| Board | Nummer(n) | Schluss Lauf 31 | Zwischen-Durchgang A | Nummer abgeschlossen | gedeckt / offen |
|---|---|---|---|---|---|
| heute | 249 | 2·2·2·2 | 4·4·4·4 | ja | Mängel Nr. 249 (Nächste Abholung, Kacheln, Spalte) |
| bestellungen | 249 | 3·3·2·2 | 2·2·2·2 (Bild 1/2: 4·4·4·4) | ja | Bild 3 „nicht freigeschaltet“ nicht aufgenommen (Nachfoto) |
| bestellung | 249 | 2·2·3·3 | 4·4·3·3 | ja | Breite 1440, Datumsformat |
| druck | 249, 244 | 3·–·3·– | 4 (390) · 4 (1440), nur hell | ja | Mangel 249: „Preise inkl. Plattformgebühr“ bei Positionen ohne Gebühr; Frage „Bar zu kassieren“ bei nicht abgeholt/Karte |
| produkte | 249 | 3·3·3·3 | 3·3·3·3 | ja | Chips, Stepper-Pille, Tabelle |
| produkt-neu | 249 | 2·2·2·2 | 3·3·3·3 | ja | Verkaufsgrößen-Karte, Vorschau, Holz-Karte offen |
| mehr-neu | 249 | 5·5·4·3 | **5·5·5·5** (Bild 2 n. e.) | ja | alles gedeckt |

Messung (alle 97 Bilder): Schrift < 12 px 0, Ziele < 44 px 0, axe ohne serious/critical; h1 = 0 nur bei offenen Dialogen/Blättern (Seite inert); Felder ohne sichtbare Beschriftung nur die Vorrat-Felder der Größen (produkt-neu Bild 2/4, produkte Bild 2).

#### heute (Nr. 249 gebaut) — Gesamt 4/4/4/4 (Schluss Lauf 31: 2·2·2·2)
| Bild | 390 h | 390 d | 1440 h | 1440 d |
|---|---|---|---|---|
| 1 Abholtag mit Packliste | 4 | 4 | 4 | 4 |
| 2 weiter unten | 4 | 4 | 4 | 4 |
| 3 Online-Zahlung pausiert | n. e. (Stripe) | n. e. | n. e. | n. e. |
| 4 Neuer Hof ohne Abholzeiten | 4 | 4 | 4 | 4 |
| 5 Pflichtkarte AGB oben | 4 | 4 | 4 | 4 |
Messung sauber (h1 = 1, Schrift 0, Ziele 0, Felder 0, axe 0); dunkel ohne helle Flecken, Balken hellmint (Z. 307 erledigt).
- Erfüllt: Antwort 2 (Packliste „Maria H.“ ohne Uhrzeit, Positionen zweizeilig; Z. 290/291), Z. 289, 296, 299, 302, 306, 311; AGB-Karte (259, Z. 293).
- Mangel Nr. 249: rechte Spalte klebt beim Scrollen höher als im Board (Z. 287 halb); „Nächste Abholung“ ohne „· n Bestellungen“ (Z. 273) und zeigt das heutige statt des nächsten Fensters; Text der Karte „Online-Zahlung einrichten“ (Board: „Kundschaft“, „Google Pay“; falls Google Pay absichtlich fehlt, fehlt eine R-Zeile); „Packliste für heute“ statt „Packliste“ (Z. 305) in Bild 4; Kennzahl-Kacheln 92 statt 80 px (Z. 308); Tagesname „heute“ fett im Diagramm; Unterzeile „<Hof> · <Datum>“ (Board widerspricht sich).
- Gedeckt: Z. 288 (R), 295, 298, 300 (C), 303 (U), 309/Q1, 310/Q4, 312, Antwort 5, Q3, P2, U (Prüfdaten, anderer Hof in Bild 4).

#### bestellungen (Nr. 249 gebaut) — Gesamt 2/2/2/2 (Bild 1 und 2: 4/4/4/4; Schluss Lauf 31: 3·3·2·2)
| Bild | 390 h | 390 d | 1440 h | 1440 d |
|---|---|---|---|---|
| 1 Noch offen | 4 | 4 | 4 | 4 |
| 2 Ruhiger Tag | 4 (Zustand n. p.) | 4 | 4 | 4 |
| 3 Neuer Hof | 2 | 2 | 2 | 2 |
Messung sauber.
- Bild 3: Der Prüfhof (Achleitenhof, DB-Kopie ohne Abholzeiten/Produkte) ist offenbar freigeschaltet – der Board-Zustand „nicht freigeschaltet“ (Hof-Balken, Konstante je Stand, Link auf /onboarding; Z. 266–270) ist nicht aufgenommen → Nachfoto in B mit nicht freigeschaltetem Hof, dann bewerten; Leer-Karte am Web schmal statt volle Breite (Z. 269, Mangel).
- Mangel: Unterleiste (Z. 277, 247-Dateien); Kopf 1440 lockerer, „Packliste drucken“ nicht auf h1-Höhe (Z. 275); Chips 36 statt 44 px hoch (ohne Listenzeile); Positionsformat in der Vorschau (G14 noch nicht genutzt).
- Erfüllt: Z. 264/265, Chip-Rand dunkel sichtbar (Z. 278 für die Chips), Rundung 12 px (Z. 279).
- Gedeckt: Antwort 5 („HM“), Q1/Z. 276, P2, Q4/Z. 271, U (Prüfdaten Z. 272; Bild 2 mit Bestellung des Fotografen), R Z. 280; Bildmarke statt Board-Platzhalter (A1).

#### bestellung (Hof) (Nr. 249 gebaut) — Gesamt 4/4/3/3 (Schluss Lauf 31: 2·2·3·3)
| Bild | 390 h | 390 d | 1440 h | 1440 d |
|---|---|---|---|---|
| 1 Bar, zu packen (App: „Bestätigung offen“) | 4 | 4 | 3 | 3 |
| 2 Gepackt | 4 | 4 | 3 | 3 |
| 3 „Artikel fehlt“ (Dialog) | 4 | 4 | 3 | 3 |
| 4 Online bezahlt, abgeholt | 4 | 4 | 3 | 3 |
Messung sauber (axe 0; h1 = 0 im Dialogbild ist Messartefakt).
- Erfüllt: Z. 236, 237, 238 (Textknopf), 240, 242, 243, 244, 245, 246, 247, 250, 251 (Aktionsleiste unter dem Schleier abgedunkelt), 252.
- Mangel Nr. 249: 1440 Inhalt und Aktionsleiste bis x ≈ 1400 statt ≈ 1197 (Z. 249, `max-w` wirkt nicht); „Bestellt: Samstag, 7. November, 02:50 Uhr“ statt Kurzformat „heute, 07:12“; „Abholung rückgängig“ orange statt Textfarbe (Z. 238); im Dialog kein sichtbarer Fokus (Board: „Abbrechen“) – bis zur Messung von activeElement.
- Prüf-Seed (243): Bild 2 und 3 mit Online-Bestellungen statt bar, Toast nicht ausgelöst – Zustände des Boards nur teilweise.
- Gedeckt: U Bestätigungslink nur per Mail (Bild 1), Z. 241 (U), Z. 245 (G14), Z. 246, 248, 255, 256/Q1, 257 (C), Z. 258 (R), Q3, Antwort 5.

#### druck (Nr. 249 und 244 gebaut; nur hell) — 390 hell 4 · 1440 hell 4
| Bild | 390 hell | 1440 hell |
|---|---|---|
| 1 Abholzettel | 4 | 4 |
| 2 Packliste | 4 | 4 |
| 3 Packliste leer | 4 (Vorbehalt) | – (kein Board-Bild) |
Messung: Schrift 0, Ziele 0, h1 = 1, Felder 0; axe nur moderate (kein main-Element).
- Erfüllt: Z. 928 („Preise inkl. Plattformgebühr.“), Z. 929, Z. 934; Z. 932 (U), Z. 933 (R); Packliste mit Kurzname ohne Uhrzeit (Antwort 2).
- **Mangel Nr. 249 (Geld-Anzeige, nur Text):** Abholzettel Bild 1 – Positionen € 1,40 + € 10,80 = € 12,20, „Gesamt“ und „Bar zu kassieren“ € 12,95, darunter „Preise inkl. Plattformgebühr.“ – die Positionen stehen ohne Gebühr, der Satz behauptet „inkl.“; im Board ergibt die Summe der Positionen genau „Gesamt“. Entweder Positionen inkl. Gebühr anzeigen (Anzeige, keine Rechnung) oder den Satz anders fassen → Nacharbeit 249 in B; Geld-Gegenlesen nötig.
- Mangel: Packliste Bild 2 zeigt den Satz „Preise inkl. Plattformgebühr.“ zusätzlich (Board nicht) – oder Z. 928 per Board-Korrektur auf Bild 2 ausweiten.
- Nicht belegt: Bild 3 „Die nächste Abholung ist …“ (Z. 931) – Prüfhof ohne solches Fenster.
- Zusatzbild TD-0005 (Karte bei Abholung, nicht abgeholt, Gebühr entfallen): Regel aus 244 erfüllt („Gesamt € 95,00“, „Servicegebühr (entfällt)“ durchgestrichen). Widersprüchlich für den Hof: darunter „**Bar** zu kassieren: € 99,75 (davon Servicegebühr € 4,75)“ bei „Zahlung: Karte bei Abholung“ und Status „Nicht abgeholt“ – „Bar zu kassieren“ ist laut Auftrag der Snapshot (unverändert). Frage an die Projektleitung: bei „Nicht abgeholt“/entfallener Gebühr den Kasten ausblenden oder „Nichts mehr zu kassieren“, bei Karte „Zu kassieren“ statt „Bar“? Dazu zwei Wörter (Servicegebühr bei Altbestellungen vor dem Stichtag, V63).

#### produkte (Nr. 249 gebaut) — Gesamt 3/3/3/3 (Schluss Lauf 31: 3·3·3·3)
| Bild | 390 h | 390 d | 1440 h | 1440 d |
|---|---|---|---|---|
| 1 Liste | 4 | 4 | 3 | 3 |
| 2 Vorrat ändern | 3 | 3 | 4 | 4 |
| 3 Neuer Hof ohne Produkte | 4 | 4 | 5* | 5* |
| 4 Suche ohne Treffer | 4 | 4 | 4 | 4 |
\* unter Vorbehalt: Prüfhof freigeschaltet, Zustand „nicht freigeschaltet“ (Z. 362/364) nicht aufgenommen.
Messung sauber (Dialog h1 = 0 Messartefakt).
- Mangel, B-Zeilen offen/teilweise: Postfach-Zähler im Handy-Kopf (Z. 367, Mein-Hof-Kopf außerhalb der Grenze); Chips 36 statt 44 px, Such-Knopf am Handy (Z. 372 teilweise); Tabelle stark gerundet (Z. 372, G8); Blatt-Hintergrund unscharf (Z. 371); Stepper-Pille zu breit und neutral statt grün (Z. 370 teilweise).
- Mangel ohne Listenzeile: Tabellenkopf blass/klein; zweite Preiszeile kleiner; Vorrat-Knopf getönt; Einheit „je L“ statt „1 L“ (Beispieldaten prüfen).
- Erfüllt: Z. 356, 365 (G4), 375, G12; gedeckt: R Z. 354, 376; C Z. 363, 369/Q3, 374/Q1; Q4/Z. 366; Antwort 5; U (Seed ohne „Braucht dich“).

#### produkt-neu (Nr. 249 gebaut) — Gesamt 3/3/3/3 (Schluss Lauf 31: 2·2·2·2)
| Bild | 390 h | 390 d | 1440 h | 1440 d |
|---|---|---|---|---|
| 1 Lebensmittel | 4 | 4 | 4 | 4 |
| 2 Futtermittel mit Größen | 3 | 3 | 3 | 3 |
| 3 Futter, Kennzeichnung | n. e. | n. e. | n. e. | n. e. |
| 4 Brennmaterial | 3 | 3 | 3 | 3 |
| 5 Feldfehler | 4 | 4 | 4 | 4 |
| 6 Speichern fehlgeschlagen | n. e. | n. e. | n. e. | n. e. |
Messung: Schrift 0, Ziele 0, axe 0; Felder ohne sichtbare Beschriftung: Vorrat-Felder der Größen (Bild 2: 4, Bild 4: 3) – Teil der offenen Zeilen Z. 335/347.
- Erfüllt: Z. 319 (Handy-Kopf), 326, 329, 330, 332, 334, 345; ohne „Nochmal“ (C).
- Mangel, B-Zeilen offen (Nr. 249 bzw. B): Verkaufsgrößen als Karte mit Zeilen + „+ Größe hinzufügen“ (Z. 335), Beschriftung Vorrat (Z. 347), Vorschau auf eine Zeile (Z. 341), Holz-Angaben aufklappbar (Z. 343), Größen-Reihenfolge am Handy (Z. 346).
- Mangel ohne Listenzeile: Fußzeile „n Größen sind sofort sichtbar …“; 1440 Erklärsatz statt Unterzeile „Futtermittel/Brennmaterial“ und fehlende Unterzeile „Lebensmittel“; Abstand Fehlerkasten; „Abbrechen“ nicht halbfett.
- Nicht beurteilbar: leere statt gefüllte Dialoge (Z. 321 Geld-Kasten, Z. 324), anderer Fehlerfall (Z. 331), Kästchen dunkel (Z. 348), Bild 3/6.
- Gedeckt: Q3, R Z. 349/320, C Z. 327, 328, 333, 344.

#### mehr-neu (Nr. 249 gebaut) — Gesamt 5/5/5/5 (Bild 2 n. e.; Schluss Lauf 31: 5·5·4·3) – erstes Board mit 5 Sternen in allen Fassungen (soweit hergestellt)
| Bild | 390 h | 390 d | 1440 h | 1440 d |
|---|---|---|---|---|
| 1 Blatt „Mehr“ / Seitenleiste | 5 | 5 | 5 | 5 |
| 2 „ans Ende gescrollt“ | n. e. | n. e. | n. e. | n. e. |
| 3 „Was legst du an?“ / Menü „Neu“ | 5 | 5 | 5 | 5 |
Messung sauber (h1 = 0 bei offenem Blatt: Seite inert, Messartefakt).
- Alle Abweichungen gedeckt: U (Prüfdaten ohne ungelesene Nachricht, Tarif-Datum, Aufnahmehöhe), Z. 55 (R), 56 (G13 erfüllt), 57 (erfüllt; kein Eintrag mehr fälschlich hervorgehoben), 58, 59, 60/Q1, 61, 62, Antwort 5, Antwort 2, Q3, Stripe nicht prüfbar.
- Offen: Bild 2 (inneres Scrollen) und der Tastatur-Fokus der Blatt- und Menüzustände (Aufnahme mit Tab + Enter).

### Boards nicht begonnener Nummern

offen (Abschnitt B): startseite, hoefe, hofseite, produkt (252); korb, meine-bestellungen, kundenkonto, anmelden, passwort, registrieren (253; bestaetigung, bestellung-link, kasse oben nur für 244/259); einstellungen (übrige Bilder), hofdaten-zahlung, konto-hof, teilen, whatsapp-plakat, beitraege (250); auswertung, kunden, verkaeufe, postfach, meldungen, region, mein-hof (251); abmelden, neuigkeiten, systemseiten, widerruf, fehlerseiten, problem-melden (254); alle übrigen mail-* (255); Abholung nach Absprache (257); Admin außer heute (258b nur messbare Mängel).

## Schluss-Durchgang (Abschnitt B, 7.11.2026)

Stand: Sammelstand `integration/lauf32b` – Fotografen A und B auf 2a3fb78c (alle Nummern von B außer 254), Fotograf C auf f4e37bbf (mit 254) für die Boards von 254; 250 Runde 2 (nur Futtermittel-Zeile ohne doppeltes „LFBIS“) kam danach und ändert kein bewertetes Bild sichtbar außer dieser Zeile. Frische Prüf-DBs nach dem Stichtag (2026-10-01) aus `pnpm pruefen:seed`, Probebilder /konditionen und Startseiten-Beispiel mit „Plattformgebühr“. Fotograf A: `next start` (Port 3201) für Kunden- und Hof-Boards; Fotograf B: dev-Fotograf (Port 3000) mit Prüf-Passkey für Admin, Mails (Admin-Vorschau) und Mail-Code-Bilder; Fotograf C: `next start` (Port 3202) für die Boards von 254. pruefer-ui je Gruppe (9 Aufrufe, höchstens vier gleichzeitig) mit nur Bildern, Maßstab (§35), Listenabschnitt, Q1–Q5, den Auftragsabschnitten und den Antworten vom 7.11.2026. Bilder im Container unter `/home/user/FarmerZone/.nachtlauf/screens/schluss/<board>/` (App, Board, INDEX.md mit Messwerten), nicht committet.

### Ergebnis (schlechtestes Bild je Fassung: 390 hell · 390 dunkel · 1440 hell · 1440 dunkel; Mails 390 · 600, Druck nur hell)

| Board | Nummer(n) | Schluss Lauf 31 | Schluss-Durchgang 32 | Nummer abgeschlossen | Mängel (Rest gedeckt durch Liste/Auftrag) |
|---|---|---|---|---|---|
| startseite | 252 | 2·2·2·2 | 3·3·3·3 | ja | 6 |
| hoefe | 252 | 2·2·2·2 | 2·2·3·3 | ja | 7 |
| hofseite | 252 | 3·3·4·4 | 3·3·4·4 | ja | 6 |
| produkt | 252 | 3·3·3·3 | 2·2·3·2 | ja | 7 |
| korb | 253 | 4·4·3·3 | 3·3·5·5 | ja | 3 |
| region | 251 | 2·2·2·2 | 2·2·2·2 | ja | 7 |
| kasse | 253 (259) | 5·5·5·4 | 4·4·4·4 | ja | 2 |
| bestaetigung | 253 (244) | 3·3·3·3 | 4·4·4·4 | ja | 2 (Zahlzeile „Online · Bezahlt“/„Noch offen“: Seed-Bestellungen im Modell „bisher“ → bisherige Zahlzeile nach Auftrag, vom Dirigenten als gedeckt gewertet) |
| bestellung-link | 253 (244) | 4·4·4·3 | 4·4·4·4 | ja | 1 (Zahlzeile wie bei bestaetigung gedeckt) |
| anmelden | 253 (247) | 3·3·3·3 | 4·4·4·4 | ja | 3 |
| passwort | 253 | 3·3·3·3 | 4·4·4·4 | ja | 2 |
| registrieren | 253 | 2·2·2·2 | 3·3·3·3 | ja | 9 |
| heute | 249, 249b | 2·2·2·2 | 4·4·4·4 | ja | 6 |
| bestellungen | 249, 249b | 3·3·2·2 | 4·4·4·4 | ja | 4 |
| bestellung | 249, 249b, 257 | 2·2·3·3 | 4·4·4·4 | ja | 1 |
| druck | 249, 249b | 3·–·3·– | 4·4 (nur hell) | ja | 1 |
| produkte | 249, 249b | 3·3·3·3 | 3·3·4·4 | ja | 6 |
| produkt-neu | 249, 249b | 2·2·2·2 | 3·3·3·3 | ja | 6 |
| auswertung | 251 | 2·2·2·2 | 3·3·3·3 | ja | 9 |
| kunden | 251 | 2·2·2·2 | 3·3·3·3 | ja | 11 |
| verkaeufe | 251 | 2·2·2·2 | 2·2·2·2 | ja | 12 |
| postfach | 251 | 2·2·3·3 | 3·3·4·4 (nur Leerzustand prüfbar) | ja | 2 |
| meldungen | 251 | 2·2·2·2 | 3·3·3·3 | ja | 9 |
| mein-hof | 251 | 2·2·2·2 | 3·3·2·2 | ja | 14 |
| mehr-neu | 249 | 5·5·4·3 | 5·5·5·5 | ja | 0 |
| meine-bestellungen | 253 | 3·3·3·3 | 3·3·3·3 | ja | 5 |
| kundenkonto | 253 | 3·3·2·2 | 4·4·4·4 | ja | 4 |
| mail-kauf | 255 (257) | 3·–·3·– | 3·3 (390·600 hell) | ja | 4 |
| mail-storno | 255 | 3·–·3·– | 3·3 (390·600 hell) | ja | 3 |
| mail-hof-bestellung | 255 (256) | 3·–·3·– | 3·3 (390·600 hell) | ja | 3 |
| mail-betrieb | 255 | 2·–·2·– | nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten) | ja | – |
| mail-hof-konto | 255 | 3·–·3·– | nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten) | ja | – |
| mail-neuigkeiten | 255 | 3·–·3·– | nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten) | ja | – |
| mail-sicherheit | 255 | 3·–·3·– | nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten) | ja | – |
| mail-team | 255 | 3·–·3·– | nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten) | ja | – |
| mail-zugang | 255 | 3·–·3·– | nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten) | ja | – |
| abmelden | 254 | 3·3·3·3 | 4·4·4·4 | ja | 2 |
| neuigkeiten | 254 | 4·4·4·4 | 3·3·3·3 | ja | 4 |
| rechtstexte | 254 (259) | 3·3·3·3 | 4·4·4·4 | ja | 3 |
| problem-melden | 254 (251) | 3·3·2·2 | 2·2·2·2 | ja | 10 |
| abmelden | 254 | 3·3·3·3 | 4·4·4·4 | ja | 2 |
| neuigkeiten | 254 | 4·4·4·4 | 3·3·3·3 | ja | 4 |
| systemseiten | 254 | 3·3·3·3 | 5·5·4·4 (Bilder 1–4 nicht prüfbar) | ja | 1 |
| widerruf | 254 | 3·3·3·3 | 3·3·3·3 (Bild 5 nicht prüfbar) | ja | 6 |
| rechtstexte | 254 (259) | 3·3·3·3 | 4·4·4·4 (Wortlaut, Stichtag, P2 nicht gewertet) | ja | 3 |
| fehlerseiten | 254 | 3·3·3·3 | 3·3·3·3 (Bild 1 nicht wertbar, Bild 6 global-error) | ja | 6 |
| problem-melden | 254 (251) | 3·3·2·2 | 2·2·2·2 | ja | 10 |

(Spalte „Schluss Lauf 31“ aus abnahme-lauf31.md, Schluss-Durchgang; „Mängel“ = Abweichungen, die keine C-, R-, U-, P1-/P2-Zeile, Q-Regel oder Auftragspunkt deckt; die übrigen Abweichungen stehen mit der deckenden Zeile in den Abschnitten je Gruppe.)

### Admin (zählt nicht zum 5-Sterne-Kriterium; Mängel = nur die sechs Messpunkte)

| Board | Erstabnahme A | Schluss-Durchgang | Mängel (Messpunkte) |
|---|---|---|---|
| admin-heute | 2·2·3·3 | 3·3·3·3 | 0 |
| admin-shell | 3·3·4·4 | 3·3·3·3 | 0 |
| admin-hoefe | 2·2·3·3 | 3·3·3·3 | 0 |
| admin-akte | 2·2·2·2 | 3·3·3·3 | 0 |
| admin-freischalten | n. b. | 4·4·4·4 (Bild 1/2 nicht herstellbar) | 0 |
| admin-bestellungen | 2·2·2·2 | 3·3·3·3 | 0 |
| admin-postfach | 2·2·2·2 | 3·3·3·3 | 3 (Schrift < 12 px Bild 3/4; Ziele knapp < 44 px 1440) |
| admin-startseite | 2·2·1·1 | 3·3·3·3 | 4 (Schrift < 12 px Bild 2/4; 4 Felder ohne Beschriftung Bild 2) |
| admin-geld | 2·2·2·2 | 3·3·3·3 | 3 („KI“ 39 px; 2 Auswahlfelder ohne Beschriftung im Dialog) |
| admin-betrieb | 2·2·2·2 | 3·3·3·3 | 3 (Links der Mail-Tabelle 16 px hoch) |
| admin-einstellungen | 2·2·3·3 | 4·4·4·4 | 0 |
| admin-zugang | n. b. | 4·4·4·4 | 0 |

h1 = 0 bei offenem Dialog oder Blatt: von den Admin-Gruppen unterschiedlich gewertet (g7 nicht, g8 als Mangel); der Dirigent wertet es nicht als Mangel (die Seiten-h1 liegt hinter dem Overlay, auch das Board zeigt im Dialog keine) – Regelvorschlag an die Messung.

### Messung (Kunden- und Hof-Boards)

Schrift < 12 px: 0 auf allen App-Bildern. axe serious/critical: 0, außer Mails (document-title, Mail-HTML ohne `<title>`) und der 500-Seite bei DB-Ausfall (document-title). Ziele < 44 px: produkt (Mengen-Stepper, 3 Ziele 36–42 px), kunden Bild 3 (Telefon/E-Mail-Link 18 px), rechtstexte (Mail-Verweise im AGB-Text – Inline-Link, Messfehler). Felder ohne sichtbare Beschriftung: produkt (Mengenfeld), produkt-neu Bild 2–4 (Vorrat je Größe), produkte Bild 2 („Vorrat“), hoefe Bild 5 (390, Suchfeld der Karte). h1 ≠ 1: nur bei offenen Blättern/Dialogen (Messart) und /widerruf nach dem Absenden (h1 fehlt – Mangel).

### Mängel – gemeinsame Ursachen

- G11 Fuß im Web breiter als die Inhaltsspalte, „Vertrag widerrufen“ links außerhalb (anmelden, passwort, registrieren, bestaetigung, bestellung-link, kundenkonto, abmelden, systemseiten, widerruf, rechtstexte, fehlerseiten, problem-melden, neuigkeiten) – `kunde-fuss.tsx` lag in B in keiner Grenze.
- G12 Bildfläche: bunte Kategorie-Illustrationen statt neutraler Fläche (hoefe, hofseite, produkt, region) und „€ … / m³“ statt „je Raummeter“ (hofseite, produkt, korb).
- G1-Kopf am Handy ohne „‹“ und wegscrollend (auswertung, kunden, verkaeufe, postfach, Meine Meldungen); G3-Fließtext neutral statt Warnfarbe (hofdaten-zahlung, whatsapp-plakat, registrieren, Freischalt-Hinweise).
- G4 Leerkasten durchgezogen statt gestrichelt (teilen, whatsapp-plakat); Umriss-Knöpfe niedrig, dünn, blass (heute, produkte, whatsapp-plakat, hofdaten-zahlung, beitraege); Felder vollrund statt 10 px (konto-hof); Beschriftungen nicht fett (konto-hof, beitraege, hofdaten-zahlung).
- Spaltenbreite 1440 der Einstellungsseiten (605–607 statt 671 px; konto-hof, hofdaten-zahlung, whatsapp-plakat).
- problem-melden: B-Zeilen liegen in den Meldungs-Bausteinen (251 hat nur die Hof-Seite und das, was das Kunden-Board zeigt, umgestellt).
- Kurznummer der Meldungen 8 Zeichen klein statt 6 groß (meldungen, problem-melden).

### Aufnahme nachholen (U, kein Mangel des Codes)

anmelden Bild 2 (Fehlerzustand nicht entstanden), auswertung Bild 1–3/5 (Reiter Woche statt Monat), korb 1440 Bild 1/2 (Blatt nicht geöffnet), region Bild 1/6, mehr-neu 3-1440 (Menü nicht offen; über die Fokus-Bilder bewertet), fehlerseiten Bild 1 (Haus-404 mit mehrteiliger Adresse aufnehmen), konto-hof Bild 5 (Board-Bild falsch zugeordnet), verkaeufe Bild 4 dunkel (Toast im Ausblenden).

### Bewertung je Gruppe (pruefer-ui, wörtlich bzw. verdichtet)


#### Gruppe 1

##### pruefer-ui Schluss-Durchgang Lauf 32 – Gruppe 1 (startseite, hoefe, hofseite, produkt, korb, region)

Grundlage: nur App- und Board-Bilder unter `/home/user/wt/schluss/.nachtlauf/screens/schluss/<board>/`, INDEX.md je Board, Maßstab freigabe.md §35 Z. 10334 ff. und §36 Z. 10506, Q1–Q5 und Board-Abschnitte aus lauf32-board-oder-code.md, §36 „Antworten der Projektleitung“, „P-Punkte“, „Nicht herstellbare Bilder“, Antworten der Projektleitung vom 7.11.2026.
Fassungen: a = 390 hell · b = 390 dunkel · c = 1440 hell · d = 1440 dunkel. Es zählt das schlechteste Bild je Fassung.
Allgemein gilt (U, Auftrag 7.11.): feste Unterleiste mitten im Ganzseitenbild, Seed-Daten/-Datum, fehlender Tastatur-Fokus in den App-Bildern (INDEX), Entwicklungs- und Test-Banner.

---

##### startseite — 3/3/3/3

| Bild | a 390 h | b 390 d | c 1440 h | d 1440 d |
|---|---|---|---|---|
| 1 Kopf mit Karte | 3 | 3 | 3 | 3 |
| 2 Höfe aus der Region | 4 | 4 | 5 | 5 |
| 3 Futter … So funktioniert’s | 4 | 4 | 4 | 4 |
| 4 Beispiel, Für Höfe, Gut zu wissen, Fuß | 3 | 3 | 3 | 3 |
| 5 Leer | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |

Abweichungen:
1. Bild 1, alle: Kopf als Video-Hintergrund mit weißer Schrift, weißem Standort-Link und Pause-Knopf → gedeckt: Kopf Regel 6 „Video“ (R) bzw. startseite-Zeile „Video im Dunkeln wenig gedämpft … Video bleibt (A1)“. Dämpfung im Dunkeln sichtbar, keine hellen Flecken.
2. Bild 1, alle: Suchfeld als eine Pille mit Lupen-Symbol, Knopf „Höfe finden“ innen im Feld; Board: eigenes gerahmtes Feld ohne Symbol und daneben eigener Knopf → **Mangel** (Aufbau Punkt 1; keine Zeile deckt Symbol und Pillenform).
3. Bild 1, alle: Regionskarte ohne Zoom „+/−“ und ohne sichtbare Quelle „© OpenStreetMap-Mitwirkende“ → **Mangel** (B-Zeile „Karte mit Zoom +/−, Nummern-Pins …“ nicht umgesetzt).
4. Bild 1, alle: Häufchen „8“, „5“ statt Nummern-Pins mit Namensschild, Haus-Symbole der Kartenkacheln → gedeckt: Register N22 (Namen erst ≤ 12 Pins), C-Zeile hoefe „Marker als Häufchen“; Kachelinhalt U.
5. Bild 2/4, alle: Hofkarten ohne km, ohne „Gründungshof“, kein pausierter Hof → U (Beispieldaten, kein Standort).
6. Bild 2, 390: zusätzlicher Link „Alle Höfe auf der Karte →“ in eigener Zeile über „Oder direkt suchen:“ (Board 390 zeigt dort keinen Link; der Link steht schon unter der Karte) → **Mangel** (gering).
7. Bild 4, alle: Beispiel-Text „Der Hof verlangt € 20,00 für deinen Einkauf. Du zahlst € 21,20 …“ statt „€ 4,50 für 10 Eier … € 4,77 … € 4,50“ → **Mangel** (Text wörtlich Punkt 2; U-Zeile deckt nur den Prozentsatz, verlangt „Fließtext wie Board (V93)“).
8. Bild 4, alle: Zusatzzeile „Schon dabei? Anmelden“ in der Karte „Du hast einen Hof?“ → **Mangel**.
9. Bild 4, alle: „Gut zu wissen“ mit Aufklapp-Pfeilen → gedeckt (B-Zeile „Aufklappen darf bleiben“). Web halbbreit → wie B-Zeile.
10. Bild 4, 390: Startseiten-Fuß mit Markenblock und Linkspalten → gedeckt: R-Zeile „Seitenfuß am Handy …“ (N22). Link „Vertrag widerrufen“ → Rechtstext (Punkt 2).
11. Bild 4, 1440: Web-Fuß ohne Agrilo-Marke links (Board: Marke + Links) → **Mangel** (gering).
12. Bild 5: nicht prüfbar – „Prüf-Seed hat freigeschaltete Höfe; ‚Noch keine Höfe‘ nur mit leerer DB – nicht herstellbar“ (INDEX).

---

##### hoefe — 2/2/3/3

| Bild | a 390 h | b 390 d | c 1440 h | d 1440 d |
|---|---|---|---|---|
| 1 Liste | 3 | 3 | 3 | 3 |
| 2 Suche „Eier“ | 3 | 3 | 3 | 3 |
| 3 Ortssuche | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 4 Umkreis leer | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 5 Karte | 2 | 2 | U (Zustand) | U (Zustand) |

Abweichungen:
1. 390, alle Bilder: Agrilo-Kopf mit „Anmelden“ → Q2 (R).
2. Bild 1, alle: leeres Suchfeld statt „5280 Braunau am Inn“ → C-Zeile „Leeres Suchfeld + grüner Kasten …“. Zusätzlich Lupen-Symbol im Feld (Board ohne) → **Mangel** (gering).
3. Bild 1, alle: Chips „Milch & Molkerei“, „Eier“ → C (Taxonomie).
4. Bild 1/2/5, alle: Reihenfolge-Satz lang, zweizeilig, auch bei Produktsuche → R-Zeile + Auftrag 7.11. (§ 4a FAGG, in jeder Ergebnisansicht).
5. Bild 1/2, alle: Hof- und Produktkarten zeigen bunte Kategorie-Illustrationen (Milchkanne, Fisch, Eierkorb …) statt der neutralen Bildfläche des Boards; dieselben Höfe zeigen auf der Startseite den Platzhalter → **Mangel** (Aufbau Punkt 1, uneinheitlich; keine Zeile).
6. Bild 1, alle: Zeile „⌀ Nicht auf der Karte“ mit Symbol in der Hofkarte → **Mangel** (gering; die C-Zeile deckt nur den Hinweis auf der Karte).
7. Bild 1, 1440: Hinweis „Ein Hof hat noch keinen Kartenpunkt …“ → C. Häufchen „4 Höfe“, Pins ohne Namensschild → C (N22). Karte ohne Kacheln → U (wie region „Kartendienst nicht erreichbar“). Gründungshof fehlt, kein km → U.
8. Bild 1/2/5, 1440: Inhalt beginnt bei 144 px statt 171 px, Karte reicht bis 1296 px; Quelle „© OpenStreetMap-Mitwirkende“ rechts abgeschnitten → **Mangel** (gering).
9. Bild 2, alle: Suchbegriff steht nicht im Feld (leer), dafür Zeile „Suche: Eier ×“ + „Alle zurücksetzen“ → **Mangel** (B-Zeile „Zeile ‚Aktive Filter: Suche‘ entfällt (Suche steht im Feld)“ nicht umgesetzt).
10. Bild 2, alle: Produktkarte mit eigener grüner Abholzeile und „Hof · PLZ Ort“ statt einer grauen Meta-Zeile „Hof · km · Abholung …“ → **Mangel** (Aufbau; B-Zeile „Name, Meta-Zeile, darunter fetter Preis“). Fehlende km → U. Marke „Bio“ → U.
11. Bild 2, 1440: Chip-Reihen sichtbar → B-Zeile betrifft nur 390; Board 1440 zeigt sie auch – kein Mangel.
12. Bild 5, 390: Kartenansicht ohne sichtbaren Kopf (h1/Unterzeile), ohne Kategorie-Chips, kompakte Suchpille ohne sichtbare Beschriftung (Messung „Felder o. Beschr.: 1“) mit abgeschnittenem Platzhalter „Ort oder Prod…“, Knopf „≡ Liste“ mit Symbol statt Reihe „Filter · Liste · Karte“, Quelle oben statt unten rechts → **Mangel** (Punkt 1 und 3).
13. Bild 5, 1440: App zeigt Karte über volle Breite ohne Liste und ohne Auswahl; Board zeigt Liste + Karte mit gewähltem Hof → U (Aufnahmezustand, INDEX: Auswahl „Hof Müller“ nicht erreicht); Auswahlkarte nicht prüfbar.
14. Bild 3/4: nicht prüfbar – „Ortssuche über Nominatim“ bzw. „Umkreis braucht Ortsauflösung über Nominatim“ (INDEX).
15. 390 Fuß „Darstellung: hell“ → R.

---

##### hofseite — 3/3/4/4

| Bild | a 390 h | b 390 d | c 1440 h | d 1440 d |
|---|---|---|---|---|
| 1 Übersicht | 3 | 3 | 4 | 4 |
| 2 weiter unten | 3 | 3 | 4 | 4 |
| 3 Reiter Produkte | 4 | 4 | 4 | 4 |
| 4 pausiert | 4 | 4 | 4 | 4 |

Abweichungen:
1. 390: Agrilo-Kopf über dem Hof-Kopf → R-Zeile + Auftrag 7.11. (scrollt weg).
2. Alle: Warenkorb leer (keine Warenkorb-Leiste 390, keine Karte „Dein Warenkorb“ und kein „Warenkorb · 3“ 1440) → U (Aufnahmezustand); Leiste und Zähler (G10) hier nicht prüfbar.
3. Alle: kein Gründungshof, kein Leitsatz, andere Adresse/Texte, „Aktuell vom Hof“ fehlt bzw. anderer Beitrag, nur bar → U (Beispieldaten).
4. Bild 1/2, 390: Reihenfolge Produkte → „Alle Produkte (6)“ → Preis-Satz → Nächste Abholung → Abholzeiten → Zahlung → Anfahrt → Über uns; Board: Nächste Abholung direkt unter den Reitern, dann Aktuell, Produkte, Über uns, Zahlung → **Mangel** (Punkt 1 Reihenfolge).
5. Bild 1/4, 390: zusätzlicher Knopf „Alle Produkte (6) ›“ unter der Liste (Board nur „Alle ansehen →“ oben) → **Mangel**.
6. Bild 1, 390: Nächste Abholung als Kicker mit zwei Terminen statt Satz „Nächste Abholung: heute, …“ → Board widerspricht sich (1440 zeigt die Kicker-Form); Abholzeiten-Block → R (N5). Kein Mangel.
7. Alle: Produktbilder als Kategorie-Illustrationen statt Bildfläche → **Mangel** (wie hoefe 5).
8. Bild 1/3/4, alle: Brennholz mit Grundpreis „€ 100,70 / m³“ (Board „€ 100,70 / RM“) → **Mangel** (E11 „Raummeter ist nicht m³“, produkt-B-Zeile).
9. Bild 3, alle: Chips/Gruppen „Milch & Molkerei“, „Eier“, „Fleisch & Wurst“ → C (Taxonomie). Futter ohne „Größe wählen“, Brennholz nicht ausverkauft → U.
10. Bild 3/4, 390: großer Startseiten-Fuß (Markenblock, Linkspalten) auf der Hofseite; R-Zeile N22 nennt den Fuß der Startseite, /hoefe zeigt den kurzen Fuß → **Mangel** (gering, uneinheitlich).
11. Bild 4, alle: „Derzeit keine Bestellungen möglich.“ statt Urlaubssatz des Hofs → U (Seed ohne Pausen-Notiz). Unter den Produkten Preis-Satz, Über uns, Abholzeiten, Zahlung, Anfahrt → C-Zeile „Pausiert: … gehört dazu“.
12. Dunkel: Titelfläche gedämpft ohne hellen Fleck (G12 erfüllt); Illustrationen gedämpft.

---

##### produkt — 2/2/3/2

| Bild | a 390 h | b 390 d | c 1440 h | d 1440 d |
|---|---|---|---|---|
| 1 Futter, Größe wählen | 3 | 3 | 3 | 3 |
| 2 Kennzeichnung | 3 | 3 | 3 | 3 |
| 3 Brennholz ausverkauft | 2 | 2 | 3 | 2 |

Abweichungen:
1. Bild 1/2, alle: Seed-Produkt „Hafer im Big Bag“ ohne Größenwahl → Größenkacheln (G5), Reihenfolge, „Lose 1 t … gerade nicht da“ nicht prüfbar (INDEX „Zustand weicht ab“).
2. Bild 1/3, alle: Zeile „14 Tage Rücktrittsrecht …“ fehlt → P1 (aus der Wertung).
3. Bild 1, alle: „Nur an Betriebe“ + Absatz → U; Schild „Futtermittelbetrieb · LFBIS … · laut Hof“ → R (E9); Kennzeichnung mit acht Zeilen → R (E10); Futter-Hinweis anderer Wortlaut → R (E10a).
4. Bild 1/2, alle: Messung „Ziele<44: 3“ (Mengen-Knöpfe 42 px, Feld 36 px) und „Felder o. Beschr.: 1“ (Mengenfeld) → **Mangel** (Punkt 3).
5. Bild 1/2, alle: „Gleich mit abholen“ zeigt Name ohne Menge und Preis einzeilig („€ 1,49 / L“, „€ 3,82 für 6 Pakete“) statt Name mit Menge, Preis, Grundpreis darunter; Brennholz „€ 100,70 / m³“ → **Mangel** (Board Bild 2; hofseite-B-Zeile „eine Hilfe für Hofseite und Produktseite“; E11).
6. Bild 1–3, alle: Produktbild als Kategorie-Illustration → **Mangel** (wie hoefe 5).
7. Bild 1, 1440: feste Kauf-Leiste mitten im Ganzseitenbild → U; im Fensterbild (Bild 2) mit Linie oben – B erfüllt. Futter-Hinweis in der Seitenspalte / Warenkorb-Karte fehlen → U (Korb leer).
8. Bild 3, alle: Merkmal-Kacheln Holzart/Länge/Gelagert fehlen, „€ 100,70 · € 100,70 / m³“ statt „€ 100,70 je Raummeter“, Erklärzeile „1 Raummeter = …“ fehlt → **Mangel** (drei B-Zeilen nicht umgesetzt). Zusatzabsatz → U.
9. Bild 3, 390: zwei Warenkorb-Symbole mit Zähler (im Agrilo-Kopf und im Unterkopf) → **Mangel**.
10. Bild 3, alle: Illustration auf hellgrauem Quadrat in der Bildfläche (hell: grauer Fleck); dunkel: Bildfläche mittelgrün (Board dunkelgrau) → **Mangel** (G12-Zeile „Bildfläche im Dunkeln mittelgrün“ nicht behoben).
11. Bild 3: Marke „Ausverkauft“ neutral → B erfüllt. Ausverkauft-Text wörtlich → erfüllt.
12. 390: großer Startseiten-Fuß → **Mangel** (gering, wie hofseite 10; nicht gesondert gezählt).

---

##### korb — 3/3/5/5

| Bild | a 390 h | b 390 d | c 1440 h | d 1440 d |
|---|---|---|---|---|
| 1 Warenkorb mit 3 Produkten | 4 | 4 | U (Blatt nicht geöffnet) | U |
| 2 Vorrat geändert | 3 | 3 | U (Blatt nicht geöffnet) | U |
| 3 Leer | 5 | 5 | 5 | 5 |

Abweichungen:
1. Alle: Fokusring an „Schließen“ rund → C (Q3); sichtbar im App-Bild → U (Aufnahme). Seite hinter dem Blatt anders → U.
2. Bild 1/2, 390: Positionen „Heumilch frisch“, „Bio-Freilandeier“ ohne Menge, Grundpreis „€ 3,82 für 6 Pakete“ statt „€ 0,64 / Paket“ → **Mangel** (Board „Name, Menge“ + Grundpreis je Einheit).
3. Bild 1, 390: Brennholz „€ 100,70 / m³“ → **Mangel** (E11).
4. Bild 2, 390 hell: Hinweis „Eine Position ist nicht mehr verfügbar und wurde entfernt.“ statt „Bergkäse ist gerade ausverkauft – wir haben ihn herausgenommen.“ → **Mangel** (B-Zeile nicht umgesetzt). 390 dunkel: Hinweis fehlt ganz (Zustand nicht erreicht oder Hinweis nur einmal sichtbar; INDEX erklärt es nicht) → zählt unter demselben Mangel, Punkt 6.
5. Bild 1/2, 1440: App zeigt die Warenkorb-Spalte statt des geöffneten Seitenblatts → U (Aufnahme, INDEX „1440: Warenkorb-Spalte rechts“); das Blatt ist in Bild 3 vorhanden. Positionen und Änderungshinweis im Web-Blatt nicht prüfbar. 1440 bewertet nach Bild 3 (eingeschränkt).

---

##### region — 2/2/2/2

| Bild | a 390 h | b 390 d | c 1440 h | d 1440 d |
|---|---|---|---|---|
| 1 Preise vergleichen | 3 | 3 | 2 | 2 |
| 2 Futter kaufen | 2 | 2 | 2 | 2 |
| 3 Ohne Standort | 4 | 4 | 4 | 4 |
| 4 Ladefehler | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 5 Leer im Umkreis | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 6 Karte | 2 | 2 | 3 | 3 |

Abweichungen:
1. Bild 1/2, 1440: nur Liste, darüber „Liste / Karte“; Board: Liste und Karte nebeneinander ab 1024 px, Inhalt bis 1400 px → **Mangel** (B-Zeile nicht umgesetzt).
2. Bild 1, alle: keine Sorte aufgeklappt → U (Aufnahme); aufgeklappte Hofzeilen nicht prüfbar.
3. Bild 1, alle: Sortenzeile „Name … 3 Höfe ⌄“, Preisspanne in Zeile 2, „Deins“ als Pille in Zeile 3; jede Sorte als eigene Karte statt einer Karte mit Trennlinien; Zusatz „Preis je Paket, nicht vergleichbar“ → **Mangel** (B-Zeile „‚Name‘ + Zeile ‚n Höfe · Spanne · Mitte‘, ‚Deins‘ rechts neben dem Pfeil“). Sortennamen „Trinkmilch“, „Freiland“ → C.
4. Alle: „1 Hof hat noch keinen Standort …“ → C; Sorten- und Mengen-Chips → C; „Konto · Franz Müller“ → Q1; Gründungshof-Karte „bis 31. Dezember 2027“ → U (Prüfdaten); Seitenleiste endet bei Fensterhöhe im Ganzseitenbild → U.
5. Bild 2, 390: „10 Angebote · nur Höfe mit LFBIS-Nummer“ statt „n Höfe mit LFBIS-Nummer“ → **Mangel** (B-Zeile). 1440: Hinweis ohne Umkreis („Höfe mit LFBIS-Nummer – du kaufst für deine Tiere.“) → **Mangel** (B-Zeile „… im Umkreis von 25 km …“).
6. Bild 2, alle: Futterkarte mit Hof als fetter Titel, Produkt klein darüber, PLZ/Ort, Grundpreis-Block rechts, „€ 8,48 · € 0,42 / kg“, je Größe eigene Karte, „Bestellen · € 8,48“; Board: Produkt als Titel, „Hof · km“, Abholzeile mit „Aufladen hilft der Hof“, „ab € … / kg“, Größe als Optionen, „Bestellen …“ → **Mangel** (B-Zeile, N23). Schild nach E9 → R.
7. Bild 3, alle: volle Hofkarte → C; darin Kategorie-Illustration und Zeile „Nicht auf der Karte“ → wie hoefe 5/6 (dort gezählt). Knopf orange, volle Breite → erfüllt.
8. Bild 6, alle: Reiter „Preise vergleichen“ statt „Futter kaufen“, kein Hof gewählt → U (INDEX „ohne gewählten Hof“); Auswahlfeld nicht prüfbar. Sichtbar: „Du“-Marke eckig braun und überdeckt ein Häufchen („öfe“), Quelle oben statt unten rechts, Karte ohne Kacheln (U) → **Mangel** (B-Zeile „Beschriftung nach innen, Zoom nicht über Pins, Quelle unten rechts“, „Du rund mit Beschriftung“).
9. Bild 6, 390: in der Kartenansicht bleiben Hofladen/Futtermittel, Umkreis, Hinweise sichtbar; Karte rutscht unter den Falz → **Mangel** (B-Zeile „In der Kartenansicht nur Umkreis + ‚Liste / Karte‘“).
10. Bild 4/5: nicht prüfbar – „Ladefehler: nur mit kaputter DB/Server herstellbar …“ bzw. „Leer im Umkreis: Seed hat in jedem Umkreis Höfe“ (INDEX).

---

##### Zusammenfassung

startseite | 3·3·3·3 | Mängel: 6
hoefe | 2·2·3·3 | Mängel: 7
hofseite | 3·3·4·4 | Mängel: 6
produkt | 2·2·3·2 | Mängel: 7
korb | 3·3·5·5 | Mängel: 3
region | 2·2·2·2 | Mängel: 7

Hinweise:
1. Board-übergreifend: Kategorie-Illustrationen statt neutraler Bildfläche (hoefe, hofseite, produkt, region; Startseite und Korb zeigen den Platzhalter) und „€ … / m³“ statt „je Raummeter“ (hofseite, produkt, korb) – je eine Ursache.
2. Mehrere B-Zeilen der Liste sind sichtbar nicht umgesetzt: hoefe „Suche steht im Feld“, korb Ausverkauft-Hinweis mit Produkt, produkt Brennholz-Kacheln/Raummeter, region Zwei-Spalten-Web, Sortenzeile, Futterkarte, Kartenansicht.
3. Aufnahme-Lücken (U): korb 1440 Bild 1/2 ohne geöffnetes Blatt, korb 390 dunkel Bild 2 ohne Änderungshinweis, hoefe/region Karte ohne gewählten Hof, region Bild 1 ohne aufgeklappte Sorte, region Bild 6 im falschen Reiter, hofseite ohne Warenkorb-Inhalt.
4. produkt: Messung meldet Ziele < 44 px und ein Feld ohne sichtbare Beschriftung am Mengen-Stepper (Punkt 3).
5. Großer Startseiten-Fuß erscheint am Handy auch auf Hof- und Produktseite, /hoefe hat den kurzen Fuß – uneinheitlich.

#### Gruppe 2

##### pruefer-ui Schluss-Durchgang Lauf 32: kasse, bestaetigung, bestellung-link, anmelden, passwort, registrieren

Ich habe alle hergestellten App- und Board-Bilder unter `/home/user/wt/schluss/.nachtlauf/screens/schluss/<board>/` als Bildpaare angesehen. Bewertet habe ich nach §35 Punkt 1–7 und §36 Z. 10506, mit Q1–Q5, den Board-Zeilen aus `lauf32-board-oder-code.md`, den PL-Antworten zu Morgenbericht 31, den P-Punkten, den „Nicht herstellbaren Bildern“ und den Antworten vom 7.11. Ich habe nichts geändert und nichts committet.

Für alle Boards gilt (laut INDEX.md je Board):
- **Fokus:** „Fokus am ersten Bedienelement“ im Board, App-Bilder ohne Tastatur-Fokus → U.
- **Feste Unterleiste mitten im Ganzseitenbild** → U.
- **Beispieldaten** (Datum, Bestellnummer, Hof, Adresse) → U.
- **Messwerte:** in allen hergestellten Bildern Schrift<12: 0, Ziele<44: 0, h1: 1, Felder ohne Beschriftung: 0, axe s/c: 0.
- **Link „Vertrag widerrufen“:** wo er zusätzlich steht, ist er Rechtstext (§35 Punkt 2) → kein Mangel.

---

##### kasse — 4/4/4/4

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Korb, ganze Seite | 4 | 4 | 4 | 4 |
| 2 Deine Daten | 5 | 5 | 5 | 5 |
| 3 Bar gewählt | 4 | 4 | 4 | 4 |
| 4 Zahlung abgelehnt | nicht prüfbar (Stripe-Zustand, §36 „Nicht herstellbare Bilder“) | ← | ← | ← |
| 5 Mindestbestellwert | nicht prüfbar (kein Seed-Hof mit Mindestbestellwert) | ← | ← | ← |

Abweichungen:
- **Bild 1/3, alle Fassungen:** Unterzeile der Bar-Option lautet „Du bestätigst per E-Mail.“, das Board sagt „Du bestätigst per E-Mail, dann packt der Hof.“ → **Mangel** (Text nicht wörtlich, keine Zeile).
- **Bild 1/3, alle Fassungen:** Die Übersicht hat einen Reservierungs-Kasten („bis 14:19 Uhr reserviert“), „Preise inkl. USt“ und einen Satz zur Plattformgebühr. Die Board-Zeilen „Du bestellst: … · Abholung … / Verkäufer ist … Es gilt die gesetzliche Gewährleistung.“ fehlen dort; die App zeigt sie als eigene Karte „Deine Bestellung“ unter der Zahlart. → **Mangel** (Aufbau, keine Zeile). Wahrscheinlich ist das Register- bzw. Rechtsinhalt; dann braucht es eine C-Zeile.
- Karte „Angaben zum Hof (dein Vertragspartner)“, AGB-/Rücktritt-Sätze unter dem Knopf, Link „Vertrag widerrufen“ → Rechtstexte (§35 Punkt 2 und A005), gedeckt.
- Gewährleistungs-Grafik im Dunkeln nicht gedämpft → R-Zeile, gedeckt.
- Option „Online bezahlen“ fehlt → U (Stripe-Platzhalter, §36).
- Satz „Wähl noch, wann du abholst …“, kein Abholtermin gewählt → U (Aufnahme ohne gewählten Termin).
- Platzhalter „z. B. komme später“ → C-Zeile.
- Leiste im Web → U-Zeile.
- Spaltenbreite und Rückweg-Symbol bei 1440 → PL 7.11., gedeckt.
- Termin „ausgebucht“ und „Bestellschluss“ fehlen → U (Seed).

##### bestaetigung — 4/4/4/4

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 online, abholbereit | 4 | 4 | 4 | 4 |
| 2 Seitenende | 4 | 4 | 4 | 4 |
| 3 bar | 4 | 4 | 4 | 4 |
| 4 Link ungültig | 4 | 4 | 4 | 4 |

Abweichungen:
- **Bild 1/2, alle Fassungen:** Die Zahlzeile lautet „Online · Bezahlt · inkl. Servicegebühr“. → **Mangel**: Die B-Zeile („Online bezahlt · inkl. Plattformgebühr (6 %)“) ist nicht umgesetzt. „Servicegebühr“, die eigene Gebührenzeile und „Für Bereitstellung …“ kommen aus der Seed-Bestellung im alten Modell → U. Die Form „Online · Bezahlt“ bleibt trotzdem ein Mangel.
- **Bild 3, alle Fassungen:** „Bar bei Abholung · Noch offen“ → **Mangel**: B-Zeile nicht umgesetzt.
- **Bild 3/4, 390:** Die h1 bricht anders um als im Board („Danke, deine / Bestellung ist da!“, „Deine Bestellung / ist eingegangen“). → **Mangel**: B-Zeile „h1-Umbruch“ offen.
- **Bild 1/2/4, 1440:** Der Fuß hat kein Logo, das Board (Bild 2) zeigt das Agrilo-Logo. → **Mangel**: keine Zeile.
- Neuigkeiten-Karte (DOI-Satz, Datenschutz-Satz) → C-Zeile.
- „Vertrag widerrufen“ statt „Rücktrittsrecht“, Lage wie Board Bild 2 → C-Zeile und Rechtstext.
- „Abholbereit“ → R.
- Karten auf 1440 gleich hoch → B umgesetzt.
- **Bild 3:** Der Seed liefert eine bestätigte statt einer wartenden Bar-Bestellung (INDEX). Fristkasten und „Erneut senden“ sind deshalb **nicht prüfbar** → U. Bild 1 zeigt „abholbereit“ statt „bezahlt“ → U (Seed).

##### bestellung-link — 4/4/4/4

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Bestellseite | 4 | 4 | 4 | 4 |
| 2 Bar bestätigen | 5 | 5 | 5 | 5 |
| 3 Frist vorbei | 5 | 5 | 5 | 5 |
| 4 Link ungültig | 5 | 5 | 4 | 4 |

Abweichungen:
- **Bild 1, alle Fassungen:** „Online · Bezahlt · € 9,70 inkl. Servicegebühr“ → **Mangel**: B-Zeile („Online bezahlt · € … inkl. Plattformgebühr“) offen. Servicegebühr-Zeile und Erklärsatz → U (Seed, altes Modell).
- **Bild 1/4, 1440:** Fuß ohne Logo, das Board zeigt das Logo → **Mangel**: keine Zeile.
- **Bild 2:** „Bar bei Abholung“ ohne „· inkl. Plattformgebühr“. Die Seed-Bestellung hat keine Gebühr (Gesamt = Ware), nach Nr. 244 (e) also keine Gebührenzeile → U, so nicht entscheidbar.
- **Bild 2/3:** Frist mit Wochentag und Datum → V9, wie die C-Zeile bei bestaetigung. Für dieses Board fehlt die Board-Korrektur noch.
- „Vertrag widerrufen“ statt bzw. zusätzlich zu „Rücktrittsrecht“ → Rechtstext.
- **390, Bild 1/4:** Die App zeigt einen Fuß, das Board 390 nicht, das Board 1440 aber schon. Das Board widerspricht sich; ich werte es nicht als Mangel.

##### anmelden — 4/4/4/4

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 /login | 4 | 4 | 4 | 4 |
| 2 falsches Passwort | nicht prüfbar (Aufnahmefehler) | ← | ← | ← |
| 3 /login/admin | 5 | 5 | 5 | 5 |
| 4 Ersatzcode | 5 | 5 | 5 | 5 |

Abweichungen:
- **Bild 1/2, 390:** Die Trennlinie unter „Admin-Anmeldung“ fehlt → **Mangel**: B-Zeile offen.
- **Bild 1/2, 390:** Warenkorb-Knopf mit deutlich größerem Taschen-Symbol als im Board → **Mangel**: B-Zeile G10 nur teilweise umgesetzt. Mittlere Sicherheit.
- **Bild 1/2, 1440:** Der Fuß ist breiter als die Inhaltsspalte (etwa 148–1292 px statt 273–1169 px) → **Mangel**: B-Zeile G11 offen.
- **Bild 2, alle Fassungen:** Der Kasten „E-Mail oder Passwort falsch.“ fehlt, weil der Zustand nicht hergestellt wurde.
  - Das Hof-E-Mail-Feld ist leer (bei 1440 steht die E-Mail im Kunden-Feld).
  - Beim Passwort-Feld liegt ein halb sichtbarer Browser-Hinweis.
  - → Aufnahmefehler (U, Regel 5): **neu aufnehmen**. Ob die roten Feldrahmen weg sind, ist so nicht prüfbar.
- Passwort-Auge → R.
- Kein „Anmelden“ im Handy-Kopf → PL 7.11. bzw. Q2.
- Beispiel-E-Mail → U.

##### passwort — 4/4/4/4

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 vergessen | 5 | 5 | 4 | 4 |
| 2 abgeschickt | 5 | 5 | 4 | 4 |
| 3 Formular | 5 | 5 | 4 | 4 |
| 4 verschieden | 5 | 5 | 4 | 4 |
| 5 Link abgelaufen | 4 | 4 | 4 | 4 |

Abweichungen:
- **1440, alle Bilder:** „Vertrag widerrufen“ steht links außerhalb der Inhaltsspalte (x≈145 statt 460). → **Mangel**: Für passwort gibt es keine Zeile; die registrieren-Zeile mit G11 meint dasselbe.
- **Bild 5, alle Fassungen:** Die App zeigt „Für dein Agrilo-Konto.“, das Board Bild 5 nicht, Board Bild 3/4 schon. → **Mangel (gering)**: Das Board widerspricht sich; Vorschlag ist eine C-Zeile.
- **Bild 3:** Formular leer statt ausgefüllt → U (Aufnahme).
- **Bild 4:** Fokus im fehlerhaften Feld → B umgesetzt. Augen-Knöpfe → R.

##### registrieren — 3/3/3/3

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 /register | 5 | 5 | 4 | 4 |
| 2 Variante G1 | nicht prüfbar (Vorschlag, nicht gebaut) | ← | ← | ← |
| 3 /verify | U | U | 4 | 4 |
| 4 E-Mail bestätigt | nicht prüfbar (Better-Auth-Token nicht herstellbar) | ← | ← | ← |
| 5 /onboarding | 3 | 3 | 3 | 3 |
| 6 alles erledigt | nicht prüfbar (kein Seed-Hof in diesem Zustand) | ← | ← | ← |

Abweichungen (alle **Mangel**, offene B-Zeilen):
- **Bild 5, 390:** Kopf ohne Rückweg-Pfeil (G1).
- **Bild 5, 390:** „Mehr“ in der Unterleiste nicht aktiv.
- **Bild 5, 1440:** „← Zurück“ fehlt (G1).
- **Bild 5, 1440:** Inhalt breiter als im Board.
- **Bild 5, alle Fassungen:** Orange liegt auf „Mit Stripe einrichten“; „Weiter“ bei Hofseite ist nur umrandet.
- **Bild 5, alle Fassungen:** Online-Zahlung-Text mit „richte bitte die Online-Zahlung ein.“ statt des Board-Satzes.
- **Bild 5, alle Fassungen:** Text im Hinweis in Grundschrift statt Warnfarbe, hell und dunkel (G3).
- **Bild 1, 1440:** Seitenspalte Schritt 3 lautet „über Stripe, etwa 10 Minuten – gehört zum Start; …“ statt „mit Stripe, etwa 10 Minuten; für SEPA ist jetzt nichts zu tun“.
- **Bild 1/3, 1440:** „Vertrag widerrufen“ links außerhalb der Inhaltsspalte (G11).

Gedeckt bzw. kein Mangel:
- Gründungshöfe-Karte statt Startphase-Satz, AGB-Karte, Lastschrift-Karte → R (K1/O4/N38).
- Lastschrift-Text → C. „Willkommen, Thomas“ → R. „Konto · Thomas Weiz“ → Q1.
- Startphase in der Seitenleiste → Q4. Tarife-Satz → U-Zeile.
- Bild 3 über /verify → U-Zeile. Schritte 2 von 5, Postfach-Zahl → U (Seed).
- Kein „Anmelden“ im Kopf → B umgesetzt. „Schon dabei? Anmelden“ als ganzer Link → B umgesetzt.

---

kasse | 4·4·4·4 | Mängel: 2
bestaetigung | 4·4·4·4 | Mängel: 4
bestellung-link | 4·4·4·4 | Mängel: 2
anmelden | 4·4·4·4 | Mängel: 3
passwort | 4·4·4·4 | Mängel: 2
registrieren | 3·3·3·3 | Mängel: 9

Was der Koordinator wissen muss:
- **anmelden Bild 2 neu aufnehmen.** Der Fehlerzustand ist nicht entstanden: Die E-Mail wurde ins falsche Feld getippt, und ein Browser-Hinweis liegt halb im Bild.
- **„Online · Bezahlt“ und „Noch offen“ betreffen zwei Boards.** Die B-Zeile für die Zahlzeile ist auf bestaetigung und bestellung-link nicht umgesetzt.
- **Fuß ohne Logo bzw. zu breit, und „Vertrag widerrufen“ außerhalb der Spalte (G11):** Das zieht sich über mehrere Boards. Für bestaetigung, bestellung-link und passwort gibt es dafür keine eigene Zeile.

Meine Prüfbilder (App und Board nebeneinander) liegen in `/tmp/claude-0/-home-user-FarmerZone/f4b6a1aa-4ebd-56f7-88c8-d388380d7114/scratchpad/ui/`.

#### Gruppe 3

##### pruefer-ui · Schluss-Durchgang Lauf 32 · Gruppe 3 (heute, bestellungen, bestellung, druck, produkte, produkt-neu)

Grundlage: nur App-/Board-Bilder unter `.nachtlauf/screens/schluss/<board>/`, INDEX.md, Maßstab freigabe.md §35 (Z. 10334 ff.) und §36, Q1–Q5 und die Board-Abschnitte aus `lauf32-board-oder-code.md`, Antworten der Projektleitung vom 7.11.2026. Kein Code gelesen.

Allgemein U (gilt für alle Boards, wird unten nicht wiederholt): Seed-Daten und Datum (Nov 2026 statt März 2027, andere Namen und Beträge), Cookie-Banner, feste Unterleiste bzw. Aktionsleiste mitten im Ganzseitenbild, fehlender Tastatur-Fokus in den App-Bildern (INDEX), „h1: 0“ bei offenem Blatt (Messartefakt laut INDEX), Spalt über Vollbild-Blättern in Ganzseitenbildern (1142 px hoch; in Bildern mit Fensterhöhe kein Spalt), Q1 „Konto · Name“ (C), Q4 Karte „Startphase“ (U), „€ 0,00“ (C, heute).

Wie geprüft: hell wurde jedes Bildpaar verglichen. Dunkel wurden diese Paare einzeln geöffnet: heute 390 Bild 1/2 und 1440 Bild 4; bestellungen 390 Bild 1/3 und 1440 Bild 2; bestellung 390 Bild 3 und 1440 Bild 2; produkte 390 Bild 1/2. Die übrigen dunklen Bilder wurden nicht geöffnet. Ihre Wertung übernimmt die Mängel, die nicht vom Theme abhängen. Eigene Mängel nur im Dunkeln habe ich in keinem geöffneten Bild gefunden.

---

##### heute — 4/4/4/4

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Abholtag mit Packliste | 4 | 4 | 4 | 4 |
| 2 weiter unten | 4 | 4 | 4 | 4 |
| 3 Online-Zahlung pausiert | nicht prüfbar (Stripe-Zustand, INDEX/§36) | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 4 neuer Hof | 4 | 4 | 4 | 4 |
| 5 AGB-Karte (= Bild 1) | 5 | 5 | 5 | 5 |

Abweichungen:
- Bild 1/2, alle: Packliste leer statt Abholtag mit 4 Bestellungen; keine Postfach-Karte → U (Seed/Datum; Liste „Postfach-Karte und Zähler fehlen | U“). Der Zustand „Abholtag mit Packliste“ ist damit nicht prüfbar.
- Bild 1/4, alle: Pflichtkarten „AGB bestätigen“ und „Online-Zahlung einrichten“ über den Kennzahlen → R (Liste „AGB-Karte … | R“, „Pflichtkarten untereinander | R“, „Pflichtkarte … in der Hauptspalte | B“ ist umgesetzt).
- Block „Was gibt’s Neues am Hof?“ → R (Liste N11-Ergänzung).
- „Zu tun“ mit „Ausblenden“ → C.
- 1440 Bild 2: Die rechte Spalte rückt beim Scrollen etwas nach oben, weil „Zu tun“ drei Einträge hat; Kopf und Spalte bleiben stehen → Liste „Beim Scrollen … | B“ ist umgesetzt, der Rest kommt aus den Daten (U).
- 1440 Bild 4: Hof mit Abholzeiten statt „ohne Abholzeiten“ → U. Der Leertext `ABHOLZEITEN_FEHLEN` (Auftrag 7.11.) ist damit nicht prüfbar.
- **Mangel**, alle Fassungen, Bild 1/2: Knopf „Teilen“ ist niedriger (etwa 44 statt 52 px), hat kleinere und dünnere Schrift und einen blassen Rand. „So geht’s“ auf derselben Seite entspricht dem Board. Keine Zeile deckt das (die Liste nennt nur „Symbol weg“).
- **Mangel**, alle Fassungen, Bild 4 (390 und 1440): Text der Karte „Online-Zahlung einrichten“ weicht vom Board ab. Board: „Damit deine Kundschaft auch mit Karte, Apple Pay, Google Pay oder EPS zahlen kann. Dauert etwa 10 Minuten.“ App: „Damit deine Kundinnen auch mit Karte, Apple Pay oder EPS zahlen können, richte bitte die Online-Zahlung ein. …“ (Punkt 2, kein R, kein Auftragspunkt; ob Google Pay fehlen soll, muss das Register sagen).
- **Mangel**, alle Fassungen: Umsatz-Karte. Die Balkenfläche ist deutlich höher (etwa 80 statt 35 px), die Balken sind voll gerundet statt leicht, und „Auswertung →“ ist kleiner mit dünnem Pfeil. Die Liste nennt Text und Farbe (G13), nicht die Form.
- **Mangel**, 1440 Bild 4: Abstand zwischen Freischalt-Hinweis und erster Pflichtkarte etwa 36 px statt dem Kartenabstand (Board 12 px).
- **Mangel**, 1440 Bild 1/4: Einträge in „Zu tun“ heißen nur „Titelbild“, „Logo“, „Fotos“. Das Board nennt die Handlung („Abholzeiten eintragen“, „Waldhonig: Kategorie ergänzen“; Liste „… Links ‚Abholzeiten eintragen‘ … | B“).
- Mangel (klein), Bild 4, alle: Der Fließtext im Freischalt-Hinweis ist neutral, das Board zeigt ihn im Warnton (Titel stimmt; G3).

##### bestellungen — 4/4/4/4

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Noch offen | 5 | 5 | 4 | 4 |
| 2 Heute abholen, leer | 5 | 5 | 4 | 4 |
| 3 neuer Hof | 4 | 4 | 4 | 4 |

Abweichungen:
- Bild 1/2: andere Zahlen und Fenster, „Abholbereit“ im Board statt „Gepackt“ → U bzw. R (N9).
- Bild 2: „Nächste Abholung: Mi, 11. Nov, 15–18 Uhr“ ohne „· n Bestellungen“. In den Prüfdaten gibt es kein künftiges Fenster mit Bestellungen (beide offenen liegen im Oktober) → U, nicht abschließend prüfbar.
- 1440 Bild 1: Vorschau „Warenpreis … + Servicegebühr … – die Gebühr ist online einbehalten.“ → U (Bestellung vor dem Stichtag, wie Liste bestellung „Online bezahlt mit Servicegebühr | U“).
- **Mangel**, 1440 alle Bilder: Kopf weiter als im Board. Von der Unterzeile bis zu den Chips etwa 50 statt 29 px; „Packliste drucken“ kleiner (Liste „Kopf enger … | B | G1 Abstände“ nur teilweise umgesetzt).
- **Mangel**, 1440 Bild 1: Die Positionszeile in der Vorschau („Hafer im Big Bag · 2 Big Bags“) ist anders gebaut als die Liste daneben und das Board („2× …“ bzw. „4× Heumilch frisch, 1 L“; G14).
- **Mangel**, 1440 Bild 3: Leer-Karte „Noch keine Bestellungen“ schmal (etwa 440 px) statt voller Spaltenbreite (Liste „Leer-Karte … schmal | B | G4“). Abstand Hinweis → Karte etwa 36 statt 12 px.
- **Mangel** (klein), Bild 3, alle: Fließtext im Hinweis neutral statt im Warnton (G3).

##### bestellung — 4/4/4/4

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 zu packen | 5 | 5 | 5 | 5 |
| 2 gepackt | 5 (Toast nicht prüfbar) | 5 | 5 | 5 |
| 3 Artikel fehlt | 4 | 4 | 4 | 4 |
| 4 abgeholt | 5 | 5 | 5 | 5 |

Abweichungen:
- Bild 1/2: online statt bar (Seed ohne offene Bar-Bestellung, INDEX) → U. „Bar zu kassieren“ mit Gründungssatz ist nicht prüfbar.
- „Online bezahlt“ mit Servicegebühr → U (Liste).
- Bild 2: Toast „Als gepackt markiert“ nicht im Bild (Aufnahme ohne vorherige Aktion) → G7 nicht prüfbar (U).
- Rücklink „‹ Bestellungen“ (1440) → C; „Abholzettel drucken“ → C; „Gepackt“ → R; Fokusring um „Abbrechen“ im Dialog → Q3.
- Bild 3, 1440: Aktionsleiste liegt unter dem Schleier → B ist umgesetzt.
- **Mangel**, Bild 3, alle Fassungen: Die Positionszeile im Dialog „Was fehlt“ lautet „Hafer im Big Bag · 2 Big Bags“ statt „2 × Hafer im Big Bag …“ mit fetter Menge vorn (Board „1 × Freilandeier, 10 Stk.“; Liste „Mengen nicht fett voran | B | G14“). Sie passt auch nicht zur Seite („2 × Hafer im Big Bag (1 Big Bag)“).

##### druck — 4·4 (nur hell)

| Bild | 390 hell | 1440 hell |
|---|---|---|
| 1 Abholzettel | 4 | 4 |
| 2 Packliste | nicht prüfbar (keine Bestellung heute, Daten) | nicht prüfbar (Daten) |
| 3 Packliste leer | 5 | – (kein Board-Bild, kein App-Bild 1440) |

Abweichungen:
- Bild 1: online bezahlte, gepackte Bestellung statt bar. Darum gibt es keinen Kasten „Bar zu kassieren“ und keinen Satz „Preise inkl. Plattformgebühr.“, dafür die Zeilen „Zwischensumme (Warenpreis) / Servicegebühr“ → U (Bestellung vor dem Stichtag, wie Liste bestellung). Kasten und Fußsatz (N38, Auftrag 7.11.) sind nicht prüfbar.
- Leiste „Zurück/Drucken“ → U (Liste).
- Tabellenkopf fett → umgesetzt. E-Mail bricht nicht mitten im Wort → umgesetzt.
- Bild 3: nächstes Fenster im Format „Mi, 11. Nov, 17–19 Uhr“ → passt zum Board.
- **Mangel**, Bild 1, 390 und 1440: Einheiten heißen „Heumilch frisch (1 l)“ und „Bio-Freilandeier (6 Pak.)“. Das Board schreibt „(1 L)“, und die Bestellseite derselben Bestellung zeigt „(1 L)“ bzw. „(6 Pakete)“. Punkt 2, keine Zeile deckt das.

##### produkte — 3/3/4/4

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Liste | 4 | 4 | 4 | 4 |
| 2 Vorrat ändern | 3 | 3 | 4 | 4 |
| 3 neuer Hof | 3 | 3 | 4 | 4 |
| 4 Suche ohne Treffer | 4 | 4 | 4 | 4 |

Abweichungen:
- Zustandszeile „Nimmt Bestellungen an · Pausieren“ → R. „Dazu“ und „Ausverkauft“ im Blatt → R.
- „Braucht dich“ fehlt (kein Produkt mit Grund) → U. Bild 3: Hof hat 2 Produkte, Leerzustand nicht prüfbar (INDEX) → U.
- Dunkel: Produktbilder gedämpft → G12 umgesetzt.
- **Mangel**, Bild 3, 390 und 1440: Der Freischalt-Hinweis steht über Kopf und Reitern (Liste „Hinweis über Kopf und Reitern | B | G3“, nicht umgesetzt).
- **Mangel**, Bild 2, 390: Hinter dem Blatt ist alles verwischt, mit hellem statt abgedunkeltem Schleier (Liste „Hintergrund hinter dem Blatt unscharf | B | backdrop-blur weg“, nicht umgesetzt; bei 1440 korrekt).
- **Mangel** (klein), Bild 2, alle: Rand des Steppers grau statt grün wie im Board (G13).
- **Mangel**, Bild 1, alle: Die Einheit heißt „je L“, „je m³“, „je Big Bag“. Das Board schreibt „1 L“, „1 Raummeter“/„1 RM“ (Punkt 2).
- **Mangel**, 1440 Bild 1/2/3: Tabellenkopf ist getönt, aber die Beschriftungen sind klein, dünn und grau. Das Board zeigt sie fett in Textfarbe. Die zweite Preiszeile „die Kundin zahlt …“ ist kleiner als im Board (Liste „Tabellenkopf ohne Tönung … | B“, „Spalte Einheit … | B“).
- **Mangel**, 390 Bild 4: Bei aktiver Suche fehlt das beschriftete Feld „Produkt suchen“ mit dem Suchwort, das Board zeigt es. Bei 1440 ist es da. Der Knopf „Suche zurücksetzen“ ist niedriger, mit kleinerer Schrift und blassem Rand (wie „Teilen“ auf heute).

##### produkt-neu — 3/3/3/3

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Lebensmittel | 4 | 4 | 4 | 4 |
| 2 Futter | 4 | 4 | 4 | 4 |
| 3 Futter, Kennzeichnung | 3 | 3 | 3 | 3 |
| 4 Brennmaterial | 3 | 3 | 3 | 3 |
| 5 Feldfehler | 4 | 4 | 4 | 4 |
| 6 Speichern fehlgeschlagen | nicht prüfbar (Serverfehler, INDEX) | nicht prüfbar | nicht prüfbar | nicht prüfbar |

Abweichungen:
- 1440 als Dialog ohne rechte Vorschau → R (PL/N41). Kopf am Handy mit Zurück-Pfeil, Titel und Unterzeile → umgesetzt. Kategorie als Zeile mit Pfeil, Kurzbeschreibung, Chip-Gruppen Kategorie/Sorte, Art (Holz), Trocknung → C. Abholung als Chips → R. Rücksendekosten-Block → R. Unterzeilen der Kartenköpfe → umgesetzt. Bild 5: „Bitte prüfen“ nur in der Unterzeile, Fehlerrand und Fokus am Feld → umgesetzt.
- Formular leer statt ausgefüllt → U. Der grüne Kasten „Du bekommst … · die Kundin zahlt …“ ist ohne Preis nicht prüfbar.
- Bild 6 → zusätzlich C laut §36 (ohne „Nochmal“). Das Bild ist nicht hergestellt.
- **Mangel**, Bild 1, alle: Die Karte „Preis & Verfügbarkeit“ ist zugeklappt, das Board zeigt sie offen mit Einheit und Preis nebeneinander.
- **Mangel**, 1440 Bild 1/3/4: Hinter dem Dialog ist alles hell verwischt statt abgedunkelt (DS-Regel aus der Liste produkte „Schleier abgedunkelt statt verwischt“; der Vorrat-Dialog auf /products macht es richtig).
- **Mangel**, Bild 2/3, alle: Über „Speichern“ steht in der festen Leiste der Satz „2 Größen sind sofort sichtbar. 2 Größen folgen nach der Meldung.“ Er ist nicht im Board, keine C-Zeile deckt ihn, und bei leerem Formular verwirrt er.
- **Mangel**, Bild 3, alle: „Kennzeichnung“ ist eine offene Strecke von Feldern (Futtermittelart, Tiere, Zusammensetzung, Analytische Bestandteile …). Das Board zeigt eine aufklappbare Karte „Kennzeichnung · Pflicht · noch offen“ mit Satz und Knopf „Angaben eintragen“. Keine Zeile deckt das (die Liste hat nur „nicht im Bild | U“).
- **Mangel**, Bild 4, alle: „Holz-Angaben“ steht ohne Karte, Holzart und Scheitlänge sind Chip-Gruppen statt zweier Felder nebeneinander. Die Verkaufsgrößen stehen nicht vor den Chips (Liste „Holz-Angaben: Aufbau ohne Karte | B“, „Verkaufsgrößen Holz unter langen Chips | B“, nicht umgesetzt).
- **Mangel** (klein), Bild 5, alle: Die Zeile „Kategorie“ hat eine Fehlermeldung, aber keinen Fehlerrand (G6).

---

heute | 4·4·4·4 | Mängel: 6
bestellungen | 4·4·4·4 | Mängel: 4
bestellung | 4·4·4·4 | Mängel: 1
druck | 4·4 (nur hell) | Mängel: 1
produkte | 3·3·4·4 | Mängel: 6
produkt-neu | 3·3·3·3 | Mängel: 6

#### Gruppe 4

##### einstellungen (250) — 5/5/5/5
Bild 2 (Ladefehler) nicht prüfbar (Serverfehler nötig). Abweichungen gedeckt: Teilen-Hinweise-Zeile (C), „LFBIS LFBIS“ = Seed-Wert (U), Zustände Auftritt/Zahlung (U), Statuspunkt zur Titelzeile (B-Zeile „items-center zur Titelzeile“; Board-Korrektur).

##### hofdaten-zahlung (250) — 3/3/3/3
Mängel (10): 390 Abschnitte als eigene Karten statt auf Seitengrund; 1440 vier statt zwei Karten, Logo-Hinweis außerhalb, „Hofdaten speichern“ klein rechts unten statt volle Breite unter der rechten Spalte (B-Zeile „Zwei Spalten, Knopf rechts unten“ halb); zusätzliches Feld „Hof-E-Mail“ mit Rücktritts-Hinweis fehlt im Board (vermutlich R – Entscheidung nötig); LFBIS-Hinweis Wortlaut/Stelle; „Mein Hof → Hofseite“ statt „›“; Auswahlfelder mit Browser-Pfeil statt G8-Chevron; Toast mit Haken, 1440 mittig 356 px statt linksbündig ~544 px (klein); „Bis 1. Jänner 2028“ gegen „Gründungshof bis 31. Dezember 2027“ auf /settings (vermutlich Anzeigefehler Enddatum exklusiv); 1440 Spalte 607 px ab x=296 statt 671 ab 301; „Lastschrift einrichten“ nicht fett/blasser Rand; G3-Kastentext Textfarbe statt Warnfarbe (klein). Gedeckt: Karte mit Zoom (C), Stripe-Zustände (U), Kasten „Bitte prüfe…“ 1440 (Board widersprüchlich, V17), Rücksprung (N1), Toast-Farbe (PL 7.11.).

##### konto-hof (250) — 3/3/3/3
Bild 6 nicht prüfbar (Serverfehler); Bild 5 Board-Bild falsch zugeordnet (zeigt teilen Bild 1) – gegen Board 6 ohne Abweichung. Mängel (6): Angemeldete Geräte als Karte mit Symbol statt Kicker+Liste (B-Zeile offen, src/components/konto); Passwortfelder vollrund statt 10 px; Feldbeschriftungen nicht fett, Serif-Titel kleiner; 1440 Anmelde-Adresse zweizeilig; „Konto löschen“ neutral statt Warnfarbe; 1440 Spalte 605 px ab 295 statt 671 ab 301. Gedeckt: Passkey-Karte (R), Augen (PL 3), Regelliste (C), Geräte-Hinweis (C), Bild 3 und 2/4 wie Board.

##### teilen (250) — 3/3/2/2
Bild 1 (geteilte Fotos, nur über das Teilen-Ziel der App) und 3 (Upload-Fehler) nicht prüfbar. Mängel (3): 1440 Kopfleiste fehlt, Inhalt links statt 520-px-Spalte zentriert; 390 h1 unter der Leiste fehlt; Leerkasten durchgezogen statt gestrichelt (G4).

##### whatsapp-plakat (250) — 3/3/3/3
Bild 1 nicht prüfbar (Seed ohne Abonnentin mit WhatsApp). Mängel (6): Unterzeile ohne Hofname; Leerkasten durchgezogen (G4); Knöpfe vollrund/nicht fett/blasser Rand; Schritte als Nummernkreise statt fett in einer Zeile (klein); 1440 „Drucken“ mit Symbol und über die Spalte hinaus; Bild 4 1440 815 statt 670 px. Gedeckt: Plakat-Fußzeile (C), URL localhost (U), Seed-Namen (U).

##### beitraege (250) — 3/3/3/3
Mängel (7): Assistent in einer großen Karte statt auf Seitengrund; Schrittzeiger eng statt über volle Breite; Beschriftungen nicht fett, Titelfeld-Rand blass; 1440 „Weiter zu Empfängern“ volle Breite statt kompakt rechts; 1440 Zurück/Hauptknopf links statt rechts; Bild 3 Zusatz-Unterzeile „Kanäle auswählen“, gewählte Karten neutral statt getönt mit orangem Rand; Bild 4 Vorschau-Text grau/klein, Trennlinie (klein). Gedeckt: Zähler, „(freiwillig)“ (C), Fokus (C/Q3), Eingaben (U).

#### Gruppe 5

##### pruefer-ui Schluss-Durchgang Lauf 32 – Gruppe g5

Boards: auswertung, kunden, verkaeufe, postfach, meldungen, mein-hof.
Grundlage: App- und Board-Bilder unter `/home/user/wt/schluss/.nachtlauf/screens/schluss/<board>/`, Maßstab freigabe.md §35 Punkte 1–7 und §36 Z. 10506, Liste `lauf32-board-oder-code.md` (Q1–Q5 und Abschnitt je Board), §36 „Antworten der Projektleitung auf Morgenbericht 31“, „P-Punkte“, „Nicht herstellbare Bilder“, Antworten der Projektleitung vom 7.11.2026.
Immer U und kein Mangel: Stand-Datum und Seed-Daten (Namen, Beträge, Zähler, „Gründungshof noch 14 Monate (bis 31. Dezember 2027)“), Karte „Startphase“ (Q4), „Konto · Franz Müller“ (Q1), Kürzel „HM“ (R), Tastaturfokus fehlt in den App-Bildern (Aufnahme ohne Tastatur, INDEX), fixe Unterleiste mitten im Ganzseitenbild, h1: 0 bei offenem Blatt oder Dialog (Messartefakt, INDEX).
Querschnitt G3: Im Freischalt-Hinweis ist der Fließtext neutral dunkel, auf dem Board rostrot getönt (auswertung, kunden, verkaeufe, meldungen Bild 5, beide Themes). Keine Zeile deckt das → in jedem dieser Boards einmal als Mangel gezählt.

---

##### auswertung — 3/3/3/3

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Monat oben | 3 (App zeigt Woche) | 3 | 3 (App zeigt Woche) | 3 |
| 2 Monat gescrollt | 3 | 3 | 3 | 3 |
| 3 Monat ganz unten | 3 | 3 | 3 | 3 |
| 4 Woche | 3 | 3 | 3 | 3 |
| 5 nicht freigegeben | 3 | 3 | 3 | 3 |
| 6 Ladefehler | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |

Bild 6: nicht prüfbar – „Ladefehler: nur mit kaputter DB/Server herstellbar, Prüf-Seed und Werkzeug bieten keinen Schalter“ (INDEX).

Abweichungen:
1. Bild 1–3 und 5, alle Fassungen: Laut INDEX ist der Monat aufgenommen, die App-Bilder zeigen aber den Reiter „Woche“ (2.–8. November). Bild 1 ist pixelgleich mit Bild 4. Der Zustand Monat ist damit nicht belegt. → Aufnahme (Hinweis an den Dirigenten); bewertet wird nur, was im Bild steht.
2. 390, alle Bilder: Der Kopf hat kein „‹“ und scrollt weg (Bild 2/3 ohne Kopf). → Mangel (B „Kopf ohne Zurück-Pfeil, scrollt weg“, G1, nicht gebaut).
3. Bild 4 (und 1), alle Fassungen: Die Vergleichszeile lautet „▲ 472 % mehr als letzte Woche · verglichen bis zum selben Zeitpunkt“, ohne Betrag in Klammern. Der Fußsatz „Mo und Di: Verkäufe, die du selbst eingetragen hast …“ fehlt. → Mangel (B „Vergleichszeile … ohne Betrag; Fußsatz fehlt“).
4. Vergleichsbalken und Legende „2.–8. November · Woche davor“ → C „Vergleichsbalken und Legende“, kein Mangel.
5. Alle Fassungen: Der Erklärtext der Gebühren-Karte ist ein allgemeiner Satz („Sie wird je Stück aufgerundet … als Gründungshof erst nach deiner Gründungszeit …“). Das Board zeigt „6 % je Stück, aufgerundet – … Bar zahlst du als Gründungshof bis 31. Jänner 2028 keine.“ bzw. „Darum € … und nicht glatt 6 % …“. → Mangel (B Gebühren-Karte „Erklärsatz je Stand (Gründungshof: erlassen bis …)“).
6. 390, Bild 3: Die Marke „Im grünen Bereich“ steht in der Grenze-Karte unter dem Titel statt rechts daneben. → Mangel (B Grenze-Karte „Marke rechts“). Bei 1440 steht sie richtig.
7. Alle Fassungen: Die Zahlen stehen als „€ 55 000“ und „€ 54 742“ mit Leerzeichen da, das Board schreibt „€ 55.000“. → Mangel (Punkt 2, Text wörtlich; keine Zeile).
8. 1440, Bild 1–4: Das Diagramm geht über die volle Breite, die Gebühren-Karte steht nicht daneben, und die Links-Karte steht nach dem Diagramm statt davor (Board Bild 1/3/4: Links → Diagramm | Gebühr). → Mangel (Punkt 1, Aufbau; keine Zeile deckt es).
9. 1440, Bild 5: Links-Karte und leeres Diagramm sowie Gebühr und Grenze stehen untereinander statt in zwei Spalten. → Mangel (B „Bild 5: Links-Karte volle Breite statt nebeneinander“).
10. Die Grenze-Karte in voller Breite unten (1440) → C „Grenze-Karte volle Breite unten“, kein Mangel.
11. Bild 5: In der Links-Karte fehlt der Satz „Teilen geht, sobald dein Hof online ist.“ (Board). → Mangel (Punkt 2).
12. Bild 5: Der G3-Hinweis hat neutralen Fließtext. → Mangel (Querschnitt G3).
13. Das leere Diagramm nach G4 mit „Noch keine Verkäufe in diesem Zeitraum“, Satz und „Verkauf eintragen“ ist gebaut. Der Knopf ist orange, auf dem Board dunkel → G4 („Hof: orange, wo Hauptaktion“), kein Mangel.
14. Gebaut und richtig: Zeitraum-Pillen, Monatswahl in eigener Zeile, Hinweis als grüner Streifen, Beträge in „Was lief am besten“ normal, Zeile „Deine Zahlen – …“ immer (C), dunkle Balken hellgrün (G13), Gebührenzeilen mit Linien, „Noch € … Spielraum“ (C).
15. Postfach-Zähler und Gründungshof-Text in der Seitenleiste → U (Seed/Datum).

---

##### kunden — 3/3/3/3

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Liste | 3 | 3 | 3 | 3 |
| 2 Sortieren | 3 | 3 | 3 | 3 |
| 3 Kundin | 3 | 3 | 3 | 3 |
| 4 Suche ohne Treffer | 4 | 4 | 4 | 4 |
| 5 nicht freigegeben | 3 | 3 | 4 | 4 |
| 6 Ladefehler | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |

Bild 6: nicht prüfbar – Ladefehler nicht herstellbar (INDEX).

Abweichungen:
1. 390, Bild 1/2/4/5: Der Kopf hat kein „‹“. → Mangel (B „Kopf fehlt (Liste)“, G1).
2. 390, Bild 3: Der Kopf zeigt den Namen „Maria Huber“ / „Kunde seit …“, das Board „Kundin“ / „Kunden“. Im Profil fehlt der große Name neben dem Avatar (Board: Avatar, Name in Serif, Marke, „Kunde seit“). Bei 1440 steht der Name als h1 über dem Avatar statt daneben. → Mangel (B „Profil frei, Marke daneben“ bzw. „Profilkopf frei“, Aufbau nicht wie Board).
3. Bild 3, alle Fassungen: Die Bestellzeilen zeigen „TD-0006 / vor 2 Tagen · 3× …“ statt fett „<Abholtag>, <Fenster>“ mit Nummer und Positionen darunter. → Mangel (B „Bestellzeilen ohne Abholtermin“).
4. Bild 3, alle Fassungen: WhatsApp und E-Mail tragen Symbole, auf dem Board nicht. Zusätzlich gibt es die Marke „🔔 bekommt Neuigkeiten“ neben „Stammkunde“. → Mangel (Punkt 1/2; keine Zeile).
5. Bild 3, alle Fassungen: Kontakt, Lieblingsprodukte und Neuigkeiten tragen Titel als Versal-Kicker („KONTAKT“) statt Serif-Titel; die Werte sind dunkel statt grün unterstrichen, und die Neuigkeiten-Zeilen haben Symbole. → Mangel (B „Kontakt und Lieblingsprodukte anders aufgebaut“, nur teilweise gebaut).
6. Bild 3, alle Fassungen: Telefon und E-Mail sind als Ziele nur 18 px hoch (Messung „Ziele<44: 2“). → Mangel (Punkt 3).
7. Die Karte „Neuigkeiten von dir“ (1440) ist gebaut. Am Handy steht sie auch → B erfüllt, kein Mangel.
8. Bild 2, alle Fassungen: Vorauswahl „Anzahl Bestellungen“ / „Meiste zuerst“ statt „Letzte Bestellung“ / „Zuletzt bestellt zuerst“. → Mangel (B „Vorauswahl ‚Anzahl Bestellungen‘“).
9. Bild 2, 390: „Sortieren nach“ steht zweispaltig, das Board-Bild 390 zeigt es einspaltig. → durch die B-Zeile „Zweispaltig bzw. nebeneinander“ gedeckt (Board widerspricht der Liste; Hinweis).
10. Bild 2: „Abbrechen“ steht oben rechts mit Startfokus, die Auswahl ist orange → B erfüllt.
11. 1440, Bild 1: Das Suchfeld steht rechts neben „Sortieren“ statt direkt nach den Chips. → Mangel (B „Suchfeld rechts neben ‚Sortieren‘“). Die sichtbare Beschriftung „Kundin suchen“ → C, kein Mangel (gilt auch am Handy).
12. Bild 1, alle Fassungen: Die Status-Marken haben einen Rand, auf dem Board nicht. → Mangel (B „Marke mit Rand → ohne Rand“).
13. 1440, Bild 1: Die Spalte Umsatz ist fett, auf dem Board normal. → Mangel (Punkt 1; gering).
14. Bild 4/5: Der Leerzustand hat einen durchgezogenen Rand, das Board einen gestrichelten → G4/PL-Antwort 9, kein Mangel. Der orange Knopf im Bild 5 → G4.
15. Bild 5: Der G3-Hinweis hat neutralen Fließtext. → Mangel (Querschnitt G3; 390 zusammen mit Punkt 1).
16. „Gepackt“ → R N9. Maria Huber statt Anna Berger → U.
17. Dunkel: Ränder, Marken und Avatare sind sichtbar, keine hellen Flecken; der Dialog ist abgedunkelt ohne Weichzeichnen. Kein Mangel aus dem Thema.

---

##### verkaeufe — 2/2/2/2

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Liste | 3 | 3 | 3 | 3 |
| 2 Verkauf eintragen | 2 | 2 | 2 | 2 |
| 3 Speichern fehlgeschlagen | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 4 Eingetragen | 3 | 3 (siehe 11) | 3 | 3 |
| 5 nicht freigegeben | 4 | 4 | 4 | 4 |
| 6 Ladefehler | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |

Schlechtestes Bild je Fassung ist Bild 2 (Eintragen-Blatt) → 2 Sterne.
Bild 3: nicht prüfbar – „Speichern fehlgeschlagen: braucht Serverfehler – nicht herstellbar“. Bild 6: nicht prüfbar – Ladefehler (INDEX).

Abweichungen:
1. 390, alle Bilder: Der Kopf hat kein „‹“. → Mangel (B „Kopf fehlt“, G1).
2. Bild 1/4, alle Fassungen: Unter dem Betrag steht der Kanal-Chip („Geschäftskunde“, „Hofladen“, „WhatsApp“, „Bar · Abholung“) statt der Marke „Eingetragen“/„Bestellung“. Am Handy ist die Unterzeile abgeschnitten („Heute · Direktver…“). → Mangel (B „Listenzeilen anders (Symbol, Kanal-Chip, ohne Menge)“).
3. Bild 1, alle Fassungen: Der Link „Auszahlungen bei Stripe ansehen“ fehlt. Laut B-Zeile gilt er nur mit Stripe-Konto, die Prüf-Umgebung hat einen Platzhalter-Schlüssel → nicht beurteilbar, kein Mangel (Hinweis).
4. 1440, Bild 1: Der Knopf „+ Verkauf eintragen“ hat ein „+“ und sitzt tiefer als die h1. → Mangel (B „Knopf mit ‚+‘ tiefer gesetzt“).
5. Die feste Leiste „Verkauf eintragen“ (G2), „Online“/„Bar“ zweispaltig, die Karte „Diese Woche“ ist weg, die rechte Spalte „Noch einmal eintragen“ (1440) und „Hofladen“ (R) → erfüllt bzw. gedeckt.
6. Bild 2, alle Fassungen: Das Datum steht als Auswahl „📅 Heute ⌄“ statt als Chip „Heute, Mi 3. März“. → Mangel (B „Datum als Auswahl“).
7. Bild 2, alle Fassungen: Der Betrag steht in Serif in einem gerahmten Kasten („€ 0,00“). → Mangel (B „Betrag in Serif; Kasten-Rahmen“).
8. Bild 2, alle Fassungen: „Anderes“ ist ein orange Textlink unter den Kanal-Knöpfen, auf dem Board ein unterstrichener Link rechts neben „Wo verkauft?“. → Mangel (B Kanal-Knöpfe: „‚Anderes‘ als Textlink“ – nur teilweise; die Position weicht ab).
9. Bild 2, alle Fassungen: Die Menge steckt hinter der Klappe „Menge oder Notiz ergänzen“ statt „Menge [ ] Stück · Notiz ergänzen“, danach Vorrat. → Mangel (B „Reihenfolge Vorrat vor Menge, Menge hinter Klappe“).
10. Bild 2, alle Fassungen: Der Knopf „Eintragen“ ist deaktiviert (blass). → Mangel (G6 „Knöpfe nie deaktiviert“).
11. Bild 2, 1440: Der Hintergrund des Dialogs ist weichgezeichnet, und es gibt eine abgesetzte Fußleiste. → Mangel (B „Fußleiste; verschwommen … kein Weichzeichnen“).
12. Bild 2, 390: Das Blatt ist etwa 95 % hoch. → Mangel (B „Blatt fast bildschirmhoch“, höchstens 86 %).
13. Bild 2: Startfokus im Betragsfeld, „Abbrechen“ oben rechts → B erfüllt. Der Chip „Anderes“ bei den Produkten → C.
14. Bild 4, 390 dunkel: Der Toast „Verkauf eingetragen“ ist fast durchsichtig und kaum lesbar über der Liste. Wahrscheinlich ist er im Ausblenden aufgenommen. → Mangel unter Vorbehalt (Punkt 4, Kontrast); bitte nachfotografieren. Hell und 1440 ist der Toast dunkel wie auf dem Board. Ohne Produkt fehlt „· <Produkt>: noch n auf Vorrat“ zu Recht.
15. Bild 5: Der G3-Hinweis hat neutralen Fließtext. → Mangel (Querschnitt G3). Der Leerzustand mit durchgezogenem Rand → G4.
16. Kanal „Hofladen“ → R. „Konto · …“ → Q1.

---

##### postfach — 3/3/4/4

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Liste, 1 neu | 3 (Zustand weicht ab: leer) | 3 | 4 (leer) | 4 |
| 2 Nachricht | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 3 Antwort | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 4 Rundschreiben | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 5 Filter „Ungelesen“ | nicht erreicht (zeigt leer) | dto. | dto. | dto. |
| 6 Ladefehler | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |

Nicht prüfbar laut INDEX: Bild 2 „Seed hat keine Unterhaltung für Hof Müller; ein Hof kann keine anlegen“, Bild 3 „wie 2“, Bild 4 „kein Rundschreiben im Seed“, Bild 6 Ladefehler. Die Tabelle im INDEX führt für Bild 2 trotzdem eine App-Datei; sie ist das leere Postfach, also dasselbe Bild wie 1 und 5 → nicht prüfbar.
Die Wertung stützt sich nur auf den Zustand „noch nie eine Nachricht“. Den zeigt das Board nicht, gewertet wird nach den DS-Regeln.

Abweichungen:
1. 390: Der Kopf hat kein „‹“. → Mangel (B „Kopf (Nachricht und Liste)“, G1).
2. Bild 1/5, alle Fassungen: Der Fußtext „Hier schreibt dir das Agrilo-Team … unter ‚Problem melden‘“ mit grünem Link fehlt; das Board zeigt ihn in Liste und Leerzustand. → Mangel (B „‚Problem melden‘ im Fußtext ohne Link“; Fußtext fehlt ganz).
3. Bild 5: Chips und Leerzustand „Alles gelesen“ mit „Alle Nachrichten zeigen“ sind nicht erreicht, weil keine Nachricht da ist → U (Seed).
4. Die Leerkarte ist linksbündig, ohne Symbol und mit durchgezogenem Rand → G4 erfüllt (ohne Knopf, weil es nichts zu zeigen gibt).
5. Zähler an „Postfach“/„Mehr“ und „1 neu“ → U (Seed).

---

##### meldungen — 3/3/3/3

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Problem melden | 4 | 4 | 3 | 3 |
| 2 Feldfehler | 3 | 3 | 3 | 3 |
| 3 Danke | 3 | 3 | 3 | 3 |
| 4 Meine Meldungen | 3 | 3 | 3 | 3 |
| 5 keine Meldungen | 3 | 3 | 3 | 3 |
| 6 Ladefehler | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |

Bild 6: nicht prüfbar – Ladefehler (INDEX).

Abweichungen:
1. Bild 3 und 4, alle Fassungen: Die Kurznummer ist „cmw6fkmg“, also klein geschrieben und 8 Zeichen lang. Das Board zeigt „7K2Q“, G14 verlangt groß geschrieben, die Projektleitung am 7.11. 6 Zeichen. → Mangel (G14 und Antwort PL 7.11. „Kurznummer 6 Zeichen“). Der Satz „Deine Kurznummer: …“ selbst → C.
2. 390, Bild 4/5: Der Kopf „Meine Meldungen“ hat kein „‹“. → Mangel (B „Kopf Bild 1–3 und 4–6 anders“, G1). Bild 1–3 haben den Kopf mit „‹“ (erfüllt).
3. 1440, Bild 1/2: Über „Problem melden“ steht der Rücklink „‹ Problem melden“, der auf die eigene Seite zeigt; das Board hat dort keinen. 1440, Bild 4/5: Auf „Meine Meldungen“ fehlt der Rücklink „‹ Problem melden“, den das Board zeigt. Der Rücklink sitzt also auf der falschen Seite. → Mangel (B „Rücklink und Unterzeile fehlen“, G1).
4. Bild 4, alle Fassungen: Die Art steht als Klartext („Fehler · Heute“) statt als Marke, und „›“ fehlt in der Zeile. → Mangel (B „Liste … Zeilen mit Art + Datum, Titel, Status, ‚›‘“).
5. 1440, Bild 4: „+ Neue Meldung“ steht links unter dem Einleitungssatz, das Board zeigt „Neue Meldung“ oben rechts neben der h1. → Mangel (Punkt 1; die C-Zeile deckt nur, dass es den Knopf gibt).
6. Bild 2, alle Fassungen: Der Feldfehler lautet „Bitte beschreibe es mit mindestens 10 Zeichen.“, das Board „Schreib bitte etwas mehr – mindestens 10 Zeichen, damit wir die Stelle finden.“. → Mangel (Punkt 2, Text wörtlich).
7. Bild 2: Das Fehlerfeld zeigt den grünen Fokusrahmen (Fokus im Fehlerfeld, G6), den orangen Rand sieht man darunter nicht → Q3, kein Mangel.
8. 1440, Bild 1/2: Das Formular steckt in einer Karte, auf dem Board liegt es frei auf dem Grund. → Mangel (Punkt 1; keine Zeile).
9. 1440, Bild 1/2: In der Seitenspalte steht „Alle ansehen ›“ mit Pfeil, ohne Unterstrich und eingerückt. Der Knopf „E-Mail schreiben“ hat einen dünnen Rand und normale Schrift (Board: fett, dunkler Rand). → Mangel (B „Seitenspalte … ‚Alle ansehen‘ mittig … nach Board“).
10. Bild 1: Kasten „Das schicken wir automatisch mit“ → R. Auswahl in Zeilen untereinander, Bildschirmfoto vor Fehlernummer, Platzhalter „z. B. A7F3“, feste Leiste „Absenden“ (G2), „Meine Meldungen“, beide Knöpfe in voller Breite → erfüllt.
11. Bild 5: Die App-Aufnahme nutzt den nicht freigegebenen Hof (bauer-d), das Board Hof Müller. Der G3-Hinweis kommt dadurch dazu → U (Zustand), der Fließtext → Mangel (Querschnitt G3). Leerzustand nach G4 nur mit „Meldung schreiben“ → erfüllt.
12. Dunkel: Ränder sichtbar, keine grünliche Fehlerkarte → erfüllt.

---

##### mein-hof — 3/3/2/2

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Reiter Hofseite | 3 | 3 | 2 | 2 |
| 2 gescrollt | 3 | 3 | 2 | 2 |
| 3 Pausieren | 4 | 4 | 4 | 4 |
| 4 Pausiert | 3 | 3 | 2 | 2 |
| 5 Reiter Beiträge | 3 | 3 | 3 | 3 |
| 6 Kundenansicht / Vorschau | 2 | 2 | kein Board-Bild 1440 (App-Bild vorhanden) | dto. |

Alle Bilder sind hergestellt (INDEX „keine“). Für Bild 6 gibt es bei 1440 kein Board-Bild; die Vorschau wird an Bild 1 gemessen.

Abweichungen:
1. 390, Bild 2: Kopf und Reiter scrollen weg. → Mangel (B „Kopf und Reiter scrollen weg“ → sticky).
2. 390, Bild 1/2/4: Die Zeilentitel weichen ab: „Titelbild“ und „Logo“ getrennt, „Name und Kurzbeschreibung“, „Leitspruch und Gründungsjahr“, „Adresse und Standort“, „Abschnitte der Hofseite“, „Zahlungsarten“, „Werte“ statt „Titelbild und Logo“, „Name und Leitspruch“, „Adresse und Karte“, „Abschnitte“, „Zahlung“, „Über uns“. → Mangel (B „Zeilentitel anders“).
3. Alle Fassungen: In den Unterzeilen steht der lange Gedankenstrich „—“ („Farbverlauf — ein eigenes Foto …“, „Freiwillig — …“). → Mangel (Hausstil „–“, B-Zeile „Langer Gedankenstrich“ aus meldungen; das Board zeigt „–“).
4. 390: Fortschritt als Karte „Noch n Punkte offen · 8 von 11“ (R N4), keine Häkchen (R N4), Marken „Fehlt“/„Online fehlt“ (R N4), Postfach-Symbol im Kopf, „Aktuell vom Hof“ zuletzt → gedeckt bzw. erfüllt.
5. 1440, Bild 1/2/4: Der Fortschritt ist eine Karte „Noch 3 Punkte offen · 8 von 11“ statt einer Zeile „Noch n Punkt(e) offen“ mit flachem Balken. → Mangel (B „Fortschritt als Karte … 1440“).
6. 1440, Bild 1: „Aktuell vom Hof“ steht ganz oben. → Mangel (B „Karte ‚Aktuell vom Hof‘ oben“).
7. 1440, Bild 1: Die Abschnitte heißen „AUFTRITT“, „ABHOLEN UND BEZAHLEN“, „SICHTBARKEIT“ statt der vier Gruppen nach Ort. → Mangel (B „Abschnitte ‚AUFTRITT‘ statt vier Gruppen“).
8. 1440, Bild 1: Jede Zeile hat links ein Symbol, auf dem Board nicht. → Mangel (Punkt 1; keine Zeile).
9. 1440, Bild 1: Die Vorschau steckt in einem Handy-Rahmen mit Agrilo-Kopfzeile, das Segment „Handy | Web“ ist nicht gefüllt, und es gibt zusätzliche Knöpfe „Vergrößern“/„Neuer Tab“ mit Erklärsatz. → Mangel (B „Vorschau im Handy-Rahmen mit Kopfzeile …“).
10. 1440: Kopier-Symbol → C. „Öffentlich“-Marke vorhanden; dahinter steht die Adresse der Hofseite statt der Hofadresse → N3/C (Kopieren), kein Mangel.
11. Bild 3: Als Dialog in der Mitte (1440), „Abbrechen“ oben rechts mit Startfokus, Titel, Feld und Schluss-Satz nach Board → erfüllt. Abweichung: Der Kasten „SO STEHT ES AUF DEINER HOFSEITE“ ist orange getönt, hat ein Pause-Symbol und den Text „Derzeit keine Bestellungen möglich.“; das Board zeigt ihn neutral, ohne Symbol, mit der Nachricht in „…“. Bei 1440 geht der Knopf „Pausieren“ über die volle Breite statt rechtsbündig. → Mangel (B „Pause-Texte anders“ bzw. Punkt 1).
12. Bild 4: Die Status-Karte „Pausiert“ zeigt keine Nachricht, weil keine eingegeben wurde → U. Status-Karten im Dunkeln sind getönt → B erfüllt.
13. Bild 4, dunkel: Der Fortschrittsbalken ist dunkelgrün auf dunklem Grund, das Board zeigt ihn hellgrün. → Mangel (Punkt 4; G13 analog).
14. Bild 5, alle Fassungen: Die Beiträge sind anders aufgebaut. Der Einleitungssatz steht ohne Karte, der Knopf ist eine Pille „+ Neuer Beitrag“ statt eines Knopfs über die volle Breite in der Karte. Der Abschnitt heißt „AKTIV“ statt „LÄUFT · 1“ / „FRÜHER · 2“, und die Zeilen haben die Knöpfe „Teilen / Deaktivieren / Löschen“ statt „›“. → Mangel (Punkt 1/2; keine Zeile in mein-hof deckt es; die frühere U-Zeile „Zustand mit Beiträgen nicht gezeigt“ ist überholt).
15. Bild 6, 390: Über der Hofseite steht eine zusätzliche Kopfzeile „Agrilo | Mein Hof“, und das Band ist orange getönt mit Augen-Symbol statt neutral mit Serif-Titel. → Mangel (B „Kundenansicht: zusätzliche Kopfzeile, oranger Balken“).
16. Bild 6, 390, und Vorschau 1440: Die Marke „Gründungshof“ und die Karte „Nächste Abholung: …“ fehlen, obwohl die Seitenleiste „Gründungshof“ zeigt. → Mangel (B „Gründungshof-Marke und ‚Nächste Abholung‘ fehlen“). Der Leitspruch fehlt, weil er im Seed fehlt → U.
17. Bild 6, 390: „Warenkorb“ ist blass. → Mangel (B „‚Warenkorb‘ blass“, G10).
18. Logo rund → R. „Konto · …“ → Q1.
19. Kontakt „eine nicht genullte Seed-Nummer (prisma/seed-daten.ts, Inhaber des Beispielhofs) · bauer@example.com“ → U (Seed). Hinweis: Die Nummer ist nicht genullt (vgl. §35 „Telefonnummern genullt“ für neue Seed-Daten).

---

##### Zusammenfassung

auswertung | 3·3·3·3 | Mängel: 9
kunden | 3·3·3·3 | Mängel: 11
verkaeufe | 2·2·2·2 | Mängel: 12
postfach | 3·3·4·4 (nur Leerzustand prüfbar) | Mängel: 2
meldungen | 3·3·3·3 | Mängel: 9
mein-hof | 3·3·2·2 | Mängel: 14

#### Gruppe 6

##### pruefer-ui Schluss-Durchgang Lauf 32 – Gruppe g6

Grundlage: Bilder unter `/home/user/wt/schluss/.nachtlauf/screens/schluss/<board>/` (INDEX.md, bei meine-bestellungen/kundenkonto zusätzlich INDEX-dev.md), Maßstab freigabe.md §35 Z. 10334 ff., §36 Z. 10506, Liste lauf32-board-oder-code.md (Kopf Q1–Q5 und Board-Abschnitte), §36 „Antworten der Projektleitung auf Morgenbericht 31“, „P-Punkte“, „Nicht herstellbare Bilder“, Antworten der Projektleitung vom 7.11.2026.
Sterne: 5 = keine sichtbare Abweichung ohne deckende Zeile; 4 = ein bis zwei kleine Mängel (Text, Format, Abstand); 3 = drei oder mehr Mängel oder ein fehlendes Aufbauelement. Je Fassung zählt das schlechteste Bild.

Allgemein U (in allen Boards nicht einzeln wiederholt): Banner „TEST · Dev-DB · Stripe Test“, Next-Knopf „N“, Seed-Daten und Datum (Nov. 2026 statt März 2027, Bestellnummern TD-/TP-/HB-), fixe Unterleiste mitten im Ganzseitenbild, App-Bilder ohne Tastaturfokus (INDEX allgemein), Logo-Bildmarke statt Platzhalter-Quadrat, Mails: Ersatz-Serife (Q5), Links in der Admin-Vorschau unkenntlich („[Link]“, Knöpfe als Text), fehlender Posteingangs-Kopf (Board-Rahmen). Maßstab Punkt 2: Rechtstexte bleiben (Link „Vertrag widerrufen“ im Fuß, Belehrung usw.).

---

##### mehr-neu — 5/5/5/5

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Blatt „Mehr“ / Seitenleiste | 5 | 5 | 5 | 5 |
| 2 Blatt ans Ende gescrollt / Seitenleiste | 5 | 5 | 5 | 5 |
| 3 „Neu“ geöffnet | 5 | 5 | 5 (über fokus-neu-1440-hell) | 5 (über fokus-neu-1440-dunkel) |

Abweichungen:
- 1/2/3 390 h/d: Fokusring am „Schließen“ bzw. „Abbrechen“ des Blatts, Board ohne Ring → C „Startfokus im Blatt auf ‚Schließen‘ sichtbar | 390 | C“.
- 1/2 390: Postfach ohne „1 neue Nachricht“/Zähler, Admin-Zeile fehlt → U „Admin-Zeile fehlt | alle | U“; Postfach-Zähler Beispieldaten (U).
- 1 390: „noch 14 Monate (bis 31. Dezember 2027)“ statt „noch 11 Monate (bis 31. Jänner 2028)“ → U (Beispieldaten/Datum).
- 1/2/3 1440 h/d: Heute-Inhalt anders (AGB-Karte, „Online-Zahlung einrichten“, Zu-tun-Karte, „Mit einem Tipp …“, keine Postfach-Karte) → U „Karte ‚Mit einem Tipp in deinem Hof‘ im Hintergrund | U: Zustand der Seite Heute, nicht Teil dieses Boards“; Postfach-Karte zusätzlich R (N12) – hier ohne ungelesene Nachricht nicht sichtbar.
- 1440: „Ausblenden“ im Zu-tun-Kopf → C „Knopf ‚Ausblenden‘ an ‚Zu tun‘“.
- 1440: Kürzel „HM“ statt „M“ → Antwort PL Nr. 5 („HM“ bleibt). „Konto · Franz Müller“ → Q1.
- 1440 dunkel: Wochenbalken hellgrün wie Board → G13 umgesetzt, keine Abweichung.
- 3 1440 h/d: Das App-Bild 3-1440-* zeigt das Menü NICHT geöffnet (Aufnahmefehler, U); bewertet über die Zusatzbilder fokus-neu-1440-{hell,dunkel}: erster Eintrag „Lebensmittel“ mit `FOKUS_RAHMEN` hervorgehoben, Aufbau und Texte wie Board → B-Zeile „Menü … 2. Eintrag hervorgehoben“ erfüllt.

Mängel: 0.

---

##### meine-bestellungen — 3/3/3/3

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 E-Mail eingeben | 4 | 4 | 4 | 4 |
| 2 Code unvollständig | 4 | 4 | 4 | 4 |
| 3 Liste | 3 | 3 | 3 | 3 |
| 4 Keine Bestellungen | 4 | nicht hergestellt (INDEX-dev nennt nur 4-390-hell und 4-1440-hell, kein Grund angegeben) | 4 | nicht hergestellt (wie links) |
| 5 Fehler beim Laden | nicht prüfbar – „Fehler beim Laden – kein Auslöser per Klick“ (INDEX-dev) | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 6 Abgelaufen | nicht prüfbar – „Ansicht-Cookie hat maxAge = Gültigkeit, Browser löscht ihn selbst; Seite zeigt danach normales Formular ohne Abgelaufen-Hinweis“ (INDEX-dev) | nicht prüfbar | nicht prüfbar | nicht prüfbar |

Abweichungen:
- 2/4: Knopf „Andere E-Mail-Adresse“ → C „Knopf ‚Andere E-Mail-Adresse‘“.
- 2: Code „123“ ohne Gruppierung → C „Code ohne Gruppierung“. Beschriftung „Code“, Satz normal, Adresse normal → B-Zeilen erfüllt.
- 1: Einleitungssatz im Seitenkopf wie Board → B-Zeile erfüllt.
- 2/3/4 390: Kopf „Mein Konto“ statt „Anmelden“ → U (Aufnahme mit angemeldeter Kundin, dev-Fotograf); Mail-Adressen/Bestellnummern → U.
- 1–4 alle: Link „Vertrag widerrufen“ im Fuß zusätzlich → Maßstab Punkt 2 (Rechtstexte bleiben).
- **Mangel** 3 alle: Zeilentexte im Format anders als Board: „Bezahlt · Heute, 15:00–18:00 Uhr“ statt „Bezahlt · heute, Mi 3. März, 15–18 Uhr“; Früher-Zeilen „Storniert · 7. Nov.“ statt „Abgeholt · Sa, 20. Februar“ (Wochentag fehlt, Monat abgekürzt, „Heute“ groß, Uhrzeit mit „:00“). Keine Zeile deckt das (Maßstab Punkt 2, Texte wörtlich).
- **Mangel** 3 alle: Hofname in den Früher-Zeilen normal statt fett wie im Board.
- **Mangel** 1–4 1440 h/d: zweite Fußzeile (Impressum … Vertrag widerrufen) rechtsbündig, Board linksbündig unter der ersten Zeile.
- **Mangel (formal)** 1–4 390 h/d: Fuß mit Rechtslinks und „Darstellung“ sichtbar, Board 390 zeigt keinen Fuß. Vermutlich Board-Lücke (kundenkonto-Board zeigt den Fuß am Handy; Regel 4 der Liste) – keine Zeile deckt es, daher formal Mangel.
- **Mangel (gering)** 4 1440: Leerzustandskarte mit deutlich größerem Innenabstand oben (ca. 36 statt 22 px) als im Board.

Mängel: 5.

---

##### kundenkonto — 4/4/4/4

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Anmelden mit Code | 5 | 5 | 4 | 4 |
| 2 Code eingeben | 5 | 5 | 4 | 4 |
| 3 Mein Konto | 4 | 4 | 4 | 4 |
| 4 Konto löschen? | 4 | 4 | 4 | 4 |
| 5 Noch keine Abonnements | 4 | 4 | 4 | 4 |

Abweichungen:
- 1/2 390: keine Pille „Anmelden“ im Kopf → B-Zeile erfüllt (Antwort PL 7.11.). 1/2 1440: Pille „Anmelden“ wie Board.
- 1/2 1440: Passwort-Auge → R „Passwort-Auge | R | PL“; Block „Test-Konten“ → U (Entwicklungsumgebung).
- 2: „Andere E-Mail-Adresse“, „Code erneut senden“ in Boardgröße → B-Zeile erfüllt.
- 3–5: „dieses Gerät · angemeldet seit 7.11.“ statt „zuletzt heute“ → C „‚angemeldet seit 6.11.‘ statt ‚zuletzt heute‘“. „Linux · Chrome“ statt „iPhone · Safari“ → U. Nur ein Abo statt zwei → U.
- 3/4: „Überall abmelden“ → R „S18“. 5: Leerzustand durchgezogener Rand → C; Block „KONTO“ in Bild 5 → C.
- 1440 3–5: Kopf mit „Mein Konto“-Pille wie Board → B-Zeile G9 erfüllt.
- 4: Kein sichtbarer Startfokus auf „Abbrechen“ → U (App-Bilder ohne Tastaturfokus, INDEX); 4 390: Scrollstand anders, N-Knopf über „Abbrechen“ → U. 4 dunkel mit neu@example.com (Hintergrund Leerzustand) → U.
- **Mangel** 3–5 390 h/d: Kopf zeigt Pille „Mein Konto“, Board 390 zeigt ein Personen-Symbol (B-Zeile „Schalter kleiner; Personen-Symbol mit Kreis | 390 | B | Symbol ohne Kreis“ nicht umgesetzt; gilt sichtbar auch für meine-bestellungen 2–4 390).
- **Mangel** 1–5 1440 h/d: Fuß deutlich breiter als der Inhalt (ca. 144–1296 px statt Inhaltsbreite 221/273–1169/1221 px) → B-Zeile „Fußlinks / Fuß breiter mit Logo | 390/1440 | B | G11“ noch offen.
- **Mangel (gering)** 3–5 390: Trennlinie über dem Fuß randlos über die ganze Breite, Board eingerückt (Teil G11).
- **Mangel (gering)** 3–5 alle: Pille „dieses Gerät“ mit Kontur, Board ohne Rand.

Mängel: 4.

---

##### mail-kauf — 390: 3 · 600: 3 (nur hell)

| Bild | 390 hell | 600 hell |
|---|---|---|
| 1 Online-Bestellbestätigung | nicht prüfbar – „Online-Bestellbestätigung braucht eine Stripe-Zahlung“ | nicht prüfbar |
| 2 Bitte bestätige, bar | 3 | 3 |
| 3 Bestellbestätigung bar | 4 | 4 |
| 4 Abholbereit | 4 | 5 |
| 5 Doch nicht abholbereit | 4 | 4 |
| 6 Änderung (Artikel fehlt) | nicht prüfbar – „Online-Bestellungen des Seeds unbezahlt, Bar-Bestellungen nur ein Artikel“ | nicht prüfbar |

Abweichungen:
- 2: Frist „bis Samstag, 7. November, 16:31 Uhr“ statt „bis heute, 09:40 Uhr“ → C „Frist ‚bis Mittwoch, 3. März …‘ statt ‚bis heute‘“.
- 2: Gebührensatz länger, mit Satz zum Vertragspartner → R „Gebührensatz anders, ohne Satz zum Vertragspartner | R | N38“. AGB-Satz, volle Belehrung Teil A/B, Gewährleistung, Impressum-Zeile → R „Belehrung, Formular, Gewährleistung, AGB-Satz, Impressum-Zeile | R“.
- 2/3: Gewährleistungs-Grafik als kaputtes Bild mit Alt-Text → U (Vorschau als lokale Datei ohne Bildquelle); Hinweis an den Dirigenten.
- 4: Link „Dieselbe Bestellung nochmal aufgeben“ fehlt → B-Zeile erfüllt (PL Nr. 8).
- 3: kein Gebührensatz unter „Bar bei Abholung“ – R-Zeile „Gebührensatz in der Bar-Bestätigung | R | N38“ verlangt ihn; vermutlich Hof ohne Gebühr (Prüfhof Bergwiesenhof) → nicht gewertet, Hinweis.
- **Mangel** 2/3: Positionszeilen „Wiesenheu Kleinballen · 1 Ballen“ / „Futtermais · 2 kg“ statt Board-Form „3× Bergkäse (250 g)“ → B-Zeile „Positionszeilen | B | G14“ offen.
- **Mangel** 2: Abholzeit „08:00–12:00 Uhr“ mit führender Null (Board „9:00–12:00 Uhr“, V9).
- **Mangel** 3/5: Telefonnummer in „Fragen? Ruf direkt beim Hof an:“ normal statt fett.
- **Mangel** 2/4/5 390: Abholzeit- und Adresswert brechen um („…08:00–12:00 / Uhr“, „…4950 / Altheim“) → B-Zeile „Adresse bricht um | 390 | B“ offen (Adresse im Seed länger, Abholzeile bricht aber auch).

Mängel: 4.

---

##### mail-storno — 390: 3 · 600: 3 (nur hell)

| Bild | 390 hell | 600 hell |
|---|---|---|
| 1 Storniert, online: Erstattung (App: 1 und 1b) | 4 | 4 |
| 2 Storniert, bar | 4 | 4 |
| 3 Verfallen | nicht prüfbar – „entsteht nur über den Cron, ohne Cron-Geheimnis“ | nicht prüfbar |
| 4 Zahlung zu spät | nicht prüfbar – „Stripe“ | nicht prüfbar |
| 5 Rücktritt eingegangen | 3 | 3 |
| 6 Rücktritt erledigt: erstattet | 5 | 5 |

Abweichungen:
- 1/1b: Bar-Satz „Da du vor Ort bezahlst …“ statt Erstattungskasten → U (INDEX: im Seed unbezahlt). Grund fehlt in 1/2 → U (Beispieldaten ohne Grund; 1b zeigt „Grund: Widerruf der Kundin“).
- 6: „Der Hof hat dir den Betrag bar zurückgegeben.“ statt Kasten „Zurück an dich € …“ → U (anderer Fall, bar statt online).
- 5: die beiden Sätze „Ist die Rückgabe bestätigt …“ und „Bei schnell verderblicher Ware …“ fehlen → P1 (fällt aus der Wertung). Absatz „So geht es weiter“ mit anderem Wortlaut (Vertragspartner, Weiterleitung) → Maßstab Punkt 2 / P1 (Rechtsaussage, Anwältin).
- Fuß „Versandt von Agrilo. / Agrilo · agrilo.at/impressum“ → R „Anbieterzeile, zusätzliche Impressum-Zeile | R | A001“.
- **Mangel** 1/1b/2: Telefonnummer in „Fragen? Ruf direkt beim Hof an:“ normal statt fett.
- **Mangel** 5: „Eingegangen 7. November 2026, 14:24 Uhr“ ohne Wochentag und mit „Uhr“ → B-Zeile „‚Mittwoch, … 19:40 Uhr‘ → ‚Mi, 3. März 2027, 19:40‘“ offen.
- **Mangel** 5: Zeile „Vertragspartner · <Hof>“ fehlt im Wertebereich (steht nur im Fließtext).

Mängel: 3.

---

##### mail-hof-bestellung — 390: 3 · 600: 3 (nur hell)

| Bild | 390 hell | 600 hell |
|---|---|---|
| 1 Neue Bestellung, online | nicht prüfbar – „bezahlte Online-Bestellung braucht Stripe“ | nicht prüfbar |
| 2 Neue Bestellung, bar | 4 | 4 |
| 3 Bar-Bestellung bestätigt | 5 | 5 |
| 4 Rücktritt an den Hof | 3 | 3 |

Abweichungen:
- 2: Bar-Mail mit Frist „Anna Berger bestätigt bis Samstag, 7. November, 16:31 Uhr. Erst dann packst du.“ → B-Zeile erfüllt. „Bar zu kassieren“ ohne Doppelpunkt, Trennlinie unter „Abholung“, „8:00–12:00 Uhr“ ohne führende Null → B-Zeilen erfüllt.
- 2/3: Zeile „Kundin · Name (· Telefon)“ → C „Zeile ‚Kundin · Name · Telefon‘“ (in 2 ohne Telefon: Gast ohne Nummer, U).
- 3: Gebührensatz „Bei Barzahlung fällt bis 31. Jänner 2027 keine Servicegebühr an …“ statt Gründungshof-Satz → U „Gebühren-Satz unter ‚Bar zu kassieren‘ | U | anderer Fall“.
- 2/3: „Bei Heute ansehen →“ als Text statt Knopf; 4: „[Link]“ → U (Vorschau, Links unkenntlich).
- Fuß „Versandt von Agrilo. / Agrilo · agrilo.at/impressum“ → R „Anbieterzeile im Fuß | R | A001“.
- **Mangel** 2: Produktzeilen „Wiesenheu Kleinballen · 1 Ballen“ statt „3× Bergkäse (250 g)“ → B-Zeile „Produktzeilen ‚Name · Menge‘ | B | G14“ offen.
- **Mangel** 4: Hinweis „Ausnahmen nach § 18 FAGG (etwa schnell verderbliche Ware) prüfst du im Einzelfall.“ → B-Zeile „Rücktritts-Hinweis mit ‚§ 18 FAGG‘ | B | Board-Satz“ offen.
- **Mangel** 4: Einleitung „Zur Bestellung TD-0016 ist am 7. November 2026, 14:05 Uhr ein Rücktritt eingegangen …“ ohne Kundinnen-Namen, mit Zeitpunkt im Satz → B-Zeile „Einleitung ohne Kundinnen-Namen, mit Zeitpunkt | B“ offen.

Mängel: 3.

---

##### Ohne App-Bilder (nicht bewertet)

- mail-betrieb: nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten)
- mail-hof-konto: nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten)
- mail-neuigkeiten: nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten)
- mail-sicherheit: nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten)
- mail-team: nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten)
- mail-zugang: nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten)

---

##### Zusammenfassung

mehr-neu | 5·5·5·5 | Mängel: 0
meine-bestellungen | 3·3·3·3 | Mängel: 5
kundenkonto | 4·4·4·4 | Mängel: 4
mail-kauf | 3·3 (390·600 hell) | Mängel: 4
mail-storno | 3·3 (390·600 hell) | Mängel: 3
mail-hof-bestellung | 3·3 (390·600 hell) | Mängel: 3
mail-betrieb | nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten) | –
mail-hof-konto | nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten) | –
mail-neuigkeiten | nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten) | –
mail-sicherheit | nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten) | –
mail-team | nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten) | –
mail-zugang | nicht prüfbar (keine Mail-Vorschau im Admin für diese Arten) | –

#### Gruppe 7

##### pruefer-ui Schluss-Durchgang Lauf 32 – Gruppe g7 (Admin)

Grundlage: App- und Board-Bilder unter `/home/user/wt/schluss/.nachtlauf/screens/schluss/<board>/`, Maßstab freigabe.md §35 (Punkte 1–7) mit §36 Z. 10506, Q1–Q5, §36 „Antworten der Projektleitung auf Morgenbericht 31“, „P-Punkte“, „Nicht herstellbare Bilder“, die Antworten der Projektleitung vom 7.11.2026.

Sonderregel Admin (Auftrag des Dirigenten, §36 „Prüf-Umgebung und Admin-Abnahme“): Für den Admin gibt es keine Board-oder-Code-Liste. Bewertet wird nur gegen Board und Maßstab. Abweichungen in Aufbau und Wortlaut heißen **„Admin-Abweichung“**, kommen auf die Liste für eine Admin-Board-oder-Code-Runde und senken die Sterne, sind aber **kein Mangel**. Als **Mangel** zählen nur die sechs Messpunkte: Schrift < 12 px, Ziele < 44 px, h1 ≠ 1, Felder ohne Beschriftung, axe serious/critical, Fokus unsichtbar. Admin-Boards zählen nicht zum 5-Sterne-Kriterium.

Was in allen sechs Boards gleich ist und **nicht** als Abweichung zählt:
- U (Auftrag 7.11. und „Nicht herstellbare Bilder“): gelbes Band „TESTUMGEBUNG · Dev-Datenbank · Stripe Test · lokal“, Plakette „Stripe Test“ statt „Stripe Live“, Next-Knopf „N“, die feste Unterleiste mitten im Ganzseitenbild, Seed-Daten (37 offen statt 2, Weizberghof statt „Hof am Moos“, Tallerhof statt „Hof Müller“, Datum Nov 2026 statt März 2027, „noch kein Lauf“ bei den Abläufen, Kürzel „AA/Anna Adler“ statt „CW/Clara Wimmer“).
- Q3: Fokusrahmen in der Form `FOKUS_RAHMEN` statt der eckigen Board-Rahmen.
- Auftrag: Kachel-Wort „Bestellwert“ in Admin › Heute (statt „Umsatz der Höfe“).
- Thema-Knopf: Mond im hellen Thema statt Sonne. Das ist eine Zeichnungsfrage, beide Themes sind erreichbar. Notiert als Admin-Abweichung, nur einmal bei admin-shell.

Messung (INDEX.md je Board): Alle App-Bilder haben Schrift < 12: 0, Ziele < 44: 0, Felder ohne Beschriftung: 0, axe serious/critical: keine. **h1 = 0** zeigen nur Bilder mit offenem modalem Dialog oder Blatt (Viewport-Bilder: admin-heute 4, admin-shell 4-390, admin-akte 4 und 6, admin-freischalten 3–5, admin-bestellungen 3, 4 und 5b). Dieselbe Seite ohne Dialog misst jeweils h1 = 1, und auch das Board zeigt im Dialogzustand keine eigene h1 (Dialogtitel, Seite abgedunkelt). Gewertet als Messwert des modalen Zustands (die Seite dahinter ist inert/verdeckt), **nicht als Mangel**. Siehe Hinweis an den Dirigenten.

Fokus: Wo ein Dialog ein Feld hat (Notbremse, Sperren, Konto schließen, Gründungshof bis, Notfall-Storno, Kundin schreiben, Zuordnen), ist der Startfokus als Rahmen sichtbar. Bei den Dialogen ohne Feld (Endgültig löschen, Freigabe zurücknehmen) und im Konto-Menü der Plakette sieht man in keinem Bild einen Fokusrahmen. Die Dialoge wurden per Klick geöffnet, und `:focus-visible` zeigt nach einem Klick auf einen Knopf keinen Rahmen. Darum ist das aus den Bildern **nicht prüfbar**, nicht „Fokus unsichtbar“. Eine Tastatur-Probe steht aus (Hinweis 2).

---

##### admin-heute — 3/3/3/3

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 gefüllt | 3 | 3 | 3 | 3 |
| 2 Braucht dich im Detail | 3 | 3 | 3 | 3 |
| 3 leer | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 4 Notbremse Blatt/Dialog | 3 | 3 | 3 | 3 |
| 5 Notbremse aktiv | 3 | 3 | 3 | 3 |
| 6 Seitenfehler | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |

Nicht prüfbar: Bild 3 (Grund laut INDEX: Leer-Zustand, der Prüf-Seed hat 37+ offene Aufgaben, per Klick nicht zu leeren), Bild 6 (Grund laut INDEX: Seitenfehler, kein Auslöser per Klick, ein Datenbankfehler wäre nötig).

Abweichungen:
1. 1/2/5 · 1440: Das Board hält den Inhalt in einer schmalen Spalte (ca. 1140 px, rechts frei). Die App nutzt die volle Breite, „Braucht dich“ ist breit, „Läuft von selbst“ steht rechts schmal. → Admin-Abweichung (Aufbau).
2. 1 · alle: Kachelköpfe stehen in GROSSBUCHSTABEN mit Symbol („BESTELLUNGEN HEUTE“). Im Board stehen sie in normaler Schreibweise ohne Symbol, die Pille oben rechts im Kopf. In der App steht die Pille neben der Zahl. → Admin-Abweichung.
3. 1 · alle: Kachel „Geld · Woche“ ohne Pille „stimmt“ und ohne die Zeile „Abgleich mit Stripe ohne Abweichung“. Kachel „Höfe“ ohne die Zeile „n pausiert“. Kachel „Dienste“ zählt „4 von 4“ (Board „5 von 5“). → Admin-Abweichung. Das Kachel-Wort „Bestellwert“ ist Auftrag.
4. 1/2 · alle: Aufgaben in „Braucht dich“: Knopf rechts neben dem Text (Board: darunter, „Prüfen“ als Rahmenknopf). Die Frist steht als Pille „überfällig · seit n Tagen“ (Board: roter Text). Am Ende steht der Erklärsatz „Alles aus Höfe …“ in der Karte (Board: unter der Karte). → Admin-Abweichung.
5. 1 · 1440: „Montags-Routine“ steht unter „Braucht dich“. Untertitel „10 Minuten“ (Board „10 Minuten · nur in diesem Browser“), Zusatzzeile „0 von 5 erledigt“. „Kommt“ und „Zuletzt im Protokoll“ ohne Untertitel „nächste Termine / wer hat was getan“ in der Form des Boards. → Admin-Abweichung. Inhalt der Abläufe = U.
6. 1 · 390: Das Board zeigt die Kacheln als 2×2-Raster direkt unter „Braucht dich“. Die App stapelt sie einspaltig ganz unten, danach Zeilen mit Pfeil „Läuft von selbst / Kommt / Montags-Routine / Zuletzt im Protokoll“ und eine eigene Karte „Notfall“. Der Handy-Kopf im Board ist „Heute · Admin · Stand …“ als Seitenkopf, in der App die Marke „Agrilo“ mit h1 darunter. → Admin-Abweichung.
7. 1 · alle: Der Knopf „Bestellungen anhalten …“ ist in Warnfarbe (Board: neutraler Rahmenknopf). → Admin-Abweichung.
8. 4 · alle: Grund als Auswahlliste (Board: vier Auswahl-Pillen). Zusätzlicher Kasten „So sieht es die Kundschaft …“ und Satz „Steht danach als Aufgabe ganz oben in Heute …“. Hauptknopf „Mit Passkey anhalten“ hell (Board: grün gefüllt, „Abbrechen“ als Rahmenknopf daneben). 390: „Abbrechen“ steht als Textlink unter dem Hauptknopf (Board: beide nebeneinander). Datumsfeld „11/07/2026, 03:00 PM“ (Board „03.03.2027, 12:00“; siehe Hinweis 4). → Admin-Abweichung.
9. 5 · alle: Notbremse aktiv. Es fehlen das Band „Neue Bestellungen sind angehalten.“ über den Kacheln und der Kopfknopf „Angehalten bis 12:00“ (die App zeigt weiter „Bestellungen anhalten …“). Die Aufgabe „Notbremse aktiv“ ist da, aber „Freigeben“ ist ein heller Rahmenknopf (Board: grün gefüllt). → Admin-Abweichung (Zustand des Boards nur teilweise gleich).
10. 1/2 · alle: In den Postfach-Aufgaben steht „Nr. meldung-“ ohne Nummer. → Admin-Abweichung, vermutlich echter Anzeigefehler (Hinweis 3).
11. 4 · alle: h1 = 0 im Dialogbild → kein Mangel (siehe oben).

Mängel: 0.

##### admin-shell — 3/3/3/3

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Heute aktiv | 3 | 3 | 3 | 3 |
| 2 Testbetrieb (App-Bild 1) | 3 | 3 | 3 | 3 |
| 3 Zahlen an den Reitern (App-Bild 1) | 4 | 4 | 4 | 4 |
| 4 Blatt „Mehr“ / Konto-Menü | 3 | 3 | 3 | 3 |
| 5 Laden | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 6 Seitenfehler | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |

Nicht prüfbar: Bild 5 (Grund laut INDEX: KopfLaden nur Sekundenbruchteile, nicht stabil aufnehmbar), Bild 6 (Grund laut INDEX: AdminFehler, kein Auslöser per Klick). Bild 3, Teil „Punkt an Betrieb / Warnkarte Datenbank“: Im Prüfstand gibt es keine offene Warnung. Diesen Teil prüft kein Bild, geprüft sind nur die Zahlen an den Reitern.

Abweichungen:
1. 2 · alle: Das Board zeigt im Testbetrieb über dem Seiteninhalt die Karte „Testbetrieb – Stripe läuft im Testmodus – Online-Zahlungen sind Testzahlungen, es fließt kein echtes Geld.“ Die App zeigt nur die Plakette „Stripe Test“ und das gelbe Umgebungsband (U). Die Karte fehlt. → Admin-Abweichung.
2. 1 · 390: Handy-Kopf: Das Board zeigt den Seitentitel im Kopf („Heute · Admin · Stand …“). Die App zeigt die Marke „Agrilo“, Thema-Knopf und Kürzel, die h1 steht im Inhalt. → Admin-Abweichung.
3. 1 · alle: Thema-Knopf zeigt einen Mond (Board: Sonne im hellen Thema). Der Kopf ist voll breit, die Reiter-Zahlen stehen als Pillen in Warnfarbe. → Admin-Abweichung (klein).
4. 4 · 390: Im Blatt „Mehr“ fehlt die Zeile „Konto und Sicherheit · <Name>“. Bei „Handbuch“ fehlt der Zusatz „· öffnet in neuem Tab“. „Abmelden“ ist ein eigener runder Knopf (Board: Zeile mit Pfeil). → Admin-Abweichung.
5. 4 · 1440: Im Konto-Menü der Plakette fehlen der Eintrag „Konto und Sicherheit“ und die Rolle „· Inhaberin“ hinter dem Namen. Ein Fokusrahmen ist im Bild nicht zu sehen (Board: Rahmen auf dem ersten Eintrag). → Admin-Abweichung. Fokus nicht prüfbar (per Klick geöffnet, siehe oben).
6. 4-390 · h1 = 0 bei offenem Blatt → kein Mangel (siehe oben).

Mängel: 0.

##### admin-hoefe — 3/3/3/3

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Braucht Blick | 3 | 3 | 3 | 3 |
| 2 Alle | 3 | 3 | 3 | 3 |
| 3 Verkauft | 3 | 3 | 3 | 3 |
| 4 Leer | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 5 Suche ohne Treffer | 4 | 4 | 4 | 4 |
| 6 Laden | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |

Nicht prüfbar: Bild 4 (Grund laut INDEX: im Prüf-Seed brauchen 37 Höfe Blick), Bild 6 (Grund laut INDEX: Laden-Zustand nicht stabil aufnehmbar).

Abweichungen:
1. 1/2/3/5 · 1440: Das Board hält Tabelle und Suche in einer Spalte von ca. 760 px. Die App zieht die Tabelle über die volle Breite: „Hof“ sehr breit, Zahlen ganz rechts, Spaltenköpfe in GROSSBUCHSTABEN. → Admin-Abweichung (Aufbau).
2. 2 · alle: Die Spalte „Tarif“ und die Fußzeile „Gründungsplätze 4 von 12 vergeben, Aktion bis …“ fehlen. Das Board kennzeichnet die Tarif-Spalte selbst als „Vorschlag nach t-m, im Code nicht gebaut; V64“. Die Fußzeile fehlt zusätzlich, in der App steht dort der Satz von „Braucht Blick“. Gründungsplätze berühren P2 (rechtstexte, Zahl offen). → Tarif-Spalte: vom Board selbst als nicht gebaut gekennzeichnet. Fußzeile: Admin-Abweichung (P2-nah, Hinweis an die Admin-Runde).
3. 1 · alle: Der Zustand steht als Pille, „seit 1 h“ darunter (Board: Pille und „seit 9 Tagen“ in einer Zeile). Das Signal ist neutral gesetzt („Stripe fehlt“ beim wartenden Hof schwarz, Board rot). → Admin-Abweichung (klein). Zeilen „Zuletzt aktiv –“ = U (Seed).
4. 1/2/3 · 390: Das Board zeigt kompakte Karten mit Pfeil (ganze Karte als Link, Meta in einer Zeile, Tarif-Zeile). Die App zeigt hohe Karten mit beschrifteten Feldern „Signal / Bestellungen 30 Tage / Zuletzt aktiv“ und eigenen Knöpfen „Prüfen“/„Akte“. Die Suche hat in der App ein Lupen-Symbol. Die Zählzeile „1 von 5 Höfen brauchen Blick …“ steht in der App unter den Filtern (Board: darüber). → Admin-Abweichung.
5. 5 · alle: Die Leerkarte hat einen durchgezogenen Rand (Board: gestrichelt), der Knopf „Suche löschen“ ist flach. Zusätzlich stehen die Zeile „0 Höfe“ und der Satz zu „Braucht Blick“ darunter. → Admin-Abweichung (klein).

Mängel: 0.

##### admin-akte — 3/3/3/3

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Kontakt, Zustand, Aktivität | 3 | 3 | 3 | 3 |
| 2 weiter unten (App-Bild 1) | 3 | 3 | 3 | 3 |
| 3 wartet, Freischalten gesperrt | 3 | 3 | 3 | 3 |
| 4 Dialog Sperren | 4 | 4 | 4 | 4 |
| 5 Plattformgebühr gespeichert | 3 | 3 | 3 | 3 |
| 6 Dialog Konto schließen | 3 | 3 | 3 | 3 |

Nicht prüfbar: keine.

Abweichungen:
1. 1/2 · 1440: Reihenfolge und Raster weichen ab. Board Bild 1: drei Spalten „Kontakt · Aktivität · Zustand“. Board Bild 2: „Eingreifen + Konto-Anfragen“ links, „Plattformgebühr“ rechts, „Akte“ darunter. Die App zeigt „Kontakt · Aktivität“, dann „Zustand · Eingreifen“, dann „Konto-Anfragen“, dann „Akte“ über volle Breite. Die Karte „Plattformgebühr“ und „Rücktritte“ stehen darunter in einer eigenen, eingerückten Spalte (links und rechts ca. 150 px Rand, nicht bündig mit dem Raster darüber). → Admin-Abweichung (Aufbau; die versetzte Spalte sieht wie ein Layoutfehler aus, Hinweis 5).
2. 1 · alle: Der Kopf hat Knöpfe rechts neben dem Namen, die Pillen „Verkauft / freigeschaltet seit … / Stripe fehlt / Gründungshof · Platz 4“ stehen unter dem Namen. „‹ Höfe“ ist ein grauer Textlink mit Symbol (Board: grüner unterstrichener Link). Die Werte im Kontakt stehen linksbündig (Board: rechtsbündig). Zustand mit Pillen „ok/Achtung“ (Board: farbiger Text). Aktivität in großen Zahlen (Board: Tabellenzeilen). Zusatzkarte „Rücktritte“. → Admin-Abweichung.
3. 1 · 390: Handy-Kopf „‹ Akte · Admin · Stand …“ (Board) gegen Marke „Agrilo“ und den Link „‹ Höfe“ in der App. Im Board ist „Plattformgebühr …“ am Handy ein Knopf unter „Eingreifen“, in der App eine ganze Karte. → Admin-Abweichung.
4. 1/5 · alle: Unter „Plattformgebühr“ fehlt die Kopfzeile „Hofpreis-Modell seit … (N38)“, „Letzte Abrechnungen“ ist leer (Seed = U). Die Felder stehen drei nebeneinander plus „Einzug ab“ als Datumsfeld „mm/dd/yyyy“ mit Knopf „zurücksetzen“ (Board: zwei Spalten, „01.02.2028“ als Text). Der Hinweis „Gründungshöfe erst nach ihrem Ende“ fehlt. Der Speicherknopf ist schmal (Board: volle Breite). → Admin-Abweichung (Datumsformat siehe Hinweis 4).
5. 3 · alle: Die Sperre wird anders begründet: App „Stripe fehlt – Freischalten erst nach Stripe möglich.“, Board „Geht erst, wenn die Online-Zahlung (Stripe) eingerichtet ist.“ Der Grund steht unter dem Erklärsatz, nicht direkt am Knopf. Zusätzlich gibt es den Knopf „Vorübergehend sperren …“. Laut INDEX fehlt auch LFBIS, die App nennt nur Stripe. „Freischalten“ ist gesperrt in blassem Grün (gesperrte Bedienelemente sind von der AA-Pflicht ausgenommen). → Admin-Abweichung.
6. 4 · alle: Text „Sperren stoppt neue Bestellungen …“ statt „<Hof> ist danach nicht mehr bestellbar …“. Der Kasten „Satz für die Kundschaft: Bestellen ist bei diesem Hof gerade nicht möglich.“ statt „Kundinnen sehen: ‚Dieser Hof nimmt gerade keine Bestellungen an.‘“. Der Knopf heißt „Sperren“ (Board „Mit Passkey sperren“), Hauptknopf hell. 390: „Abbrechen“ als Textlink darunter. Startfokus im Feld „Grund“ ist sichtbar. → Admin-Abweichung.
7. 5 · alle: Im App-Bild ist keine Erfolgsmeldung „Plattformgebühr gespeichert …“ zu sehen. Auch 1440 hell, laut INDEX direkt nach dem Speichern aufgenommen, zeigt keine. Die Akte-Zeile „Plattformgebühr geändert · Satz 6 → 6 % · Mandat Pflicht ja → ja · …“ ist da, aber ausführlicher als im Board. → Admin-Abweichung (Zustand des Boards nicht gleich).
8. 6 · alle: Die Wahl „Wann? Nach 30 Tagen / Sofort“ fehlt (die App beschreibt nur den 30-Tage-Weg). Dazu kommen ein Pflichtfeld „Grund (für das Protokoll)“ und lange Erklärkästen „Sofort / Nach 30 Tagen, endgültig“. Titel „Konto von Tallerhof schließen“ (Board „Konto schließen?“). Der Startfokus liegt im Feld „Grund“ und ist sichtbar. Maßstab Punkt 5 „Startfokus bei Löschen auf ‚Abbrechen‘“ wäre hier zu klären. Das Board selbst zeigt den Fokus auf dem ersten Bedienelement (Auswahl „Nach 30 Tagen“). → Admin-Abweichung.
9. 4/6 · h1 = 0 im Dialogbild → kein Mangel (siehe oben).

Mängel: 0.

##### admin-freischalten — 4/4/4/4

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Hof freischalten? | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 2 Freigeschaltet: Toast | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 3 Endgültig löschen? | 4 | 4 | 4 | 4 |
| 4 Freigabe zurücknehmen? | 4 | 4 | 4 | 4 |
| 5 Gründungshof bis | 3 | 3 | 3 | 3 |
| 6 Freischalten gesperrt | 3 | 3 | 3 | 3 |

Fassungswert: Hier zählt ausnahmsweise nicht das schlechteste Bild (sonst 3 je Fassung), sondern die Einordnung des Boards als Ganzes, weil 5 und 6 Akte-Ansichten sind, die in admin-akte schon mit 3 gezählt werden. Streng nach der Regel „schlechtestes Bild“: 3/3/3/3.

Nicht prüfbar: Bild 1 (Grund laut INDEX: der einzige wartende Hof, Weizberghof, hat kein Stripe-Konto, Freischalten ist gesperrt, Stripe Connect ist in der Prüf-Umgebung nicht prüfbar), Bild 2 (Grund laut INDEX: folgt aus Bild 1).

Abweichungen:
1. 3 · alle: Wortlaut gleich bis auf den Untertitel „Weizberghof“. Knöpfe: Hauptknopf „Endgültig löschen“ hell (Board: kräftige Warnfarbe), „Abbrechen“ als flacher Knopf (Board: Rahmenknopf mit Fokusrahmen). 390: „Abbrechen“ als Textlink unter dem Hauptknopf (Board: nebeneinander). Ein Fokusrahmen auf „Abbrechen“ ist im Bild nicht zu sehen (Board zeigt ihn). → Admin-Abweichung. Fokus: nicht prüfbar (per Klick geöffnet, siehe Hinweis 2).
2. 4 · alle: Wortlaut gleich. Knopfgestaltung wie oben, im Bild kein Fokusrahmen. → Admin-Abweichung. Fokus: nicht prüfbar.
3. 5 · alle: Natives Datumsfeld „mm/dd/yyyy“, leer (Board: Textfeld mit „31.08.2027“). Hinweis „Leer = Standard (31. Dezember 2027)“. Der Zweig „Früher als bisher: Nur mit Zustimmung des Hofs (K1)“ mit Häkchen „<Hof> hat zugestimmt“ ist im Bild nicht zu sehen (in der App erst nach Eingabe eines früheren Datums?). Knopf „Speichern“ (Board „Mit Passkey speichern“). Startfokus sichtbar. → Admin-Abweichung (Zustand K1 nicht gezeigt, Datumsformat Hinweis 4).
4. 6 · alle: wie admin-akte Abweichung 5 (Wortlaut des Grundes, Reihenfolge der Karten, zusätzlicher Knopf „Vorübergehend sperren …“). → Admin-Abweichung.
5. 3/4/5 · h1 = 0 im Dialogbild → kein Mangel (siehe oben).

Mängel: 0.

##### admin-bestellungen — 3/3/3/3

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Liste mit Detail | 3 | 3 | 3 | 3 |
| 2 Detail bar, Bestätigung offen | 3 | 3 | 3 | 3 |
| 3 Notfall-Storno | 3 | 3 | 3 | 3 |
| 4 Kundin schreiben | 3 | 3 | 3 | 3 |
| 5/5b Rücktritte ohne Bestellung, Zuordnen | 3 | 3 | 3 | 3 |
| 6 keine Bestellung gefunden | 3 | 3 | 3 | 3 |

Nicht prüfbar: keine.

Abweichungen:
1. 1/2/5/6 · alle: Filter anders aufgebaut. Board: Suchfeld „Bestellnummer oder genaue Adresse“, Pillen „Offen / Abgeholt / Nicht abgeholt / Storniert“, Auswahl „Hof“ und „Zeitraum 7 Tage“, „Zurücksetzen“, Zählzeile „25 Bestellungen · neueste zuerst“. App: Karte mit Feld „Bestellnummer oder E-Mail-Adresse“ und Knopf „Suchen“, drei Auswahllisten „Stand / Hof / Zeitraum 90 Tage“, Knöpfe „Anzeigen“ und „Zurücksetzen“. → Admin-Abweichung.
2. 1/2 · alle: In den Listenzeilen fehlen Betrag und „bar“ (Board: „€ 17,31 bar“). Stattdessen steht „bestellt <Datum>“. → Admin-Abweichung.
3. 1/2 · alle: Im Detail fehlen „In Stripe ansehen ↗“, der Abschnitt „Positionen“ als eigene Liste (die App zeigt die Ware in einer Zeile) und der farbige „Was tun“-Kasten (die App zeigt einen neutralen Kasten mit anderem Text). Dazu kommen die Knöpfe „Kundin schreiben … / Hof schreiben / Notfall-Storno …“ und der Abschnitt „E-Mails zu dieser Bestellung“. Wortlaut: „inkl. € 1,40 Servicegebühr“ und eine Zeile „Servicegebühr“. Board und der Rest des Admin sagen „Plattformgebühr“. → Admin-Abweichung (Begriff, Hinweis 3).
4. 1/2 · 390: Das Board zeigt Liste und Detail als eigene Ansichten (Detail mit Kopf „‹ HM-0303-7E15“). Die App zeigt alles auf einer Seite: Filter, dann Detail, dann Liste. → Admin-Abweichung.
5. 3 · alle: Notfall-Storno: Grund ist ein freies Feld (Board: Auswahlliste mit Vorschlag) und es fehlt das Feld „Satz für die Kundin“. Der Text erklärt den Ablauf allgemein und nennt weder Betrag noch Adresse (Board: „bekommt € 28,62 über Stripe zurück …“). Knopf „Stornieren“ (Board „Mit Passkey stornieren“). Startfokus sichtbar. → Admin-Abweichung.
6. 4 · alle: Titel „Volle Adresse der Kundin anzeigen?“ mit freiem Feld „Grund“ (Board „Kundin schreiben“ mit Auswahl „Wozu brauchst du die Adresse?“). Den Zustand „Adresse angezeigt + E-Mail öffnen“ zeigt kein Bild. → Admin-Abweichung.
7. 5/5b · alle: Abschnitt „Rücktritte ohne Bestellung“ als eigene Karte über volle Breite über der Liste (Board: Karte in der linken Spalte mit „Diese Nummer gibt es nicht. Noch 31 h bis zum Ziel.“ in Warnfarbe). Ohne Fristangabe. Dialog „Rücktritt einer Bestellung zuordnen“ mit leeren Feldern „Bestellnummer“ und „Grund“. Der Vorschlag „Ähnliche Bestellung derselben Adresse“ (Board: Auswahlfeld mit HM-0224-9F3E) fehlt. Knopf „Zuordnen“ (Board „Zuordnen und weiterleiten“). → Admin-Abweichung.
8. 6 · alle: Die App zeigt zusätzlich die Fehlermeldung „Bitte eine Bestellnummer oder eine ganze E-Mail-Adresse eingeben.“ (Eingabe „zzzz“). Die Leerkarte steht in der Listenspalte mit anderem Text „Mit diesem Filter gibt es keine Bestellung …“ und Knopf „Zurücksetzen“ (Board: gestrichelte Karte über volle Breite, „Prüf die Nummer …“, „Suche löschen“). Rechts steht „Wähl links eine Bestellung …“. → Admin-Abweichung.
9. 3/4/5b · h1 = 0 im Dialogbild → kein Mangel (siehe oben).

Mängel: 0.

---

##### Zusammenfassung

admin-heute | 3·3·3·3 | Mängel: 0
admin-shell | 3·3·3·3 | Mängel: 0
admin-hoefe | 3·3·3·3 | Mängel: 0
admin-akte | 3·3·3·3 | Mängel: 0
admin-freischalten | 4·4·4·4 (streng nach schlechtestem Bild 3·3·3·3) | Mängel: 0
admin-bestellungen | 3·3·3·3 | Mängel: 0

##### Hinweise an den Dirigenten

1. h1 = 0 in allen Dialog- und Blattbildern (Messwert). Gewertet als Folge des modalen Zustands, weil die Seite ohne Dialog jeweils h1 = 1 misst. Liest die Abnahme „h1 ≠ 1“ auch für Dialogzustände streng, wären das 13 Bildgruppen in fünf Boards. Bitte entscheiden.
2. Fokus ohne Feld (Endgültig löschen, Freigabe zurücknehmen, Konto-Menü der Plakette): In keinem Bild ist ein Fokusrahmen zu sehen. Die Bilder sind per Klick geöffnet. Eine Tastatur-Probe (Tab, Enter) entscheidet, ob „Fokus unsichtbar“ vorliegt und ob der Startfokus bei Löschen auf „Abbrechen“ liegt.
3. Vermutete echte Fehler: In den Postfach-Aufgaben auf Admin › Heute steht „Nr. meldung-“ ohne Nummer. Im Bestelldetail heißt die Gebühr „Servicegebühr“, sonst überall „Plattformgebühr“.
4. Datumsfelder zeigen das US-Format (mm/dd/yyyy, 03:00 PM): Notbremse, Einzug ab, Gründungshof bis. Wahrscheinlich die Sprache des Prüf-Browsers (U). Zu prüfen ist, ob der Prüf-Chromium mit `--lang=de-AT` laufen soll.
5. Akte 1440: Die Karten „Plattformgebühr“ und „Rücktritte“ stehen in einer eingerückten Spalte, nicht bündig mit dem Raster darüber. Das sieht nach einem Layoutfehler aus, nicht nach Absicht. Außerdem ist im Akte-Bild 5 keine Speichermeldung zu sehen.

#### Gruppe 8

##### pruefer-ui Schluss-Durchgang Lauf 32 – Gruppe g8 (Admin)

Grundlage: Bilder und INDEX.md unter `/home/user/wt/schluss/.nachtlauf/screens/schluss/<board>/` (Prüfstand 2a3fb78c, dev-Fotograf B), Maßstab freigabe.md §35 Punkte 1–7, §36 Z. 10506 und Z. 10526 (Admin), Q1–Q5, Auftragspunkte vom 7.11.2026.

Sonderregel Admin (Auftrag): Für den Admin gibt es in lauf32-board-oder-code.md keinen Abschnitt. Abweichungen in Aufbau und Wortlaut heißen **„Admin-Abweichung (Liste für eine Admin-Board-oder-Code-Runde)“**, nicht Mangel. **Mangel** sind nur die sechs Messpunkte (Schrift < 12 px, Ziele < 44 px, h1 ≠ 1, Felder ohne Beschriftung, axe serious/critical, Fokus unsichtbar). Admin-Boards zählen nicht zum 5-Sterne-Kriterium (Z. 10526), die Sterne unten sind deshalb nur Orientierung.

Sternevergabe: 5 = keine sichtbare Abweichung; 4 = nur Admin-Abweichungen; 3 = Admin-Abweichungen plus mindestens ein Mangel nach Messung; schlechtestes Bild je Fassung zählt.

Allgemein für alle sechs Boards (U, kein Mangel):
- Band „TESTUMGEBUNG · Dev-Datenbank · Stripe Test · lokal“ bzw. „TEST · Dev-DB · Stripe Test“, Pille „Stripe Test“ statt „Stripe Live“, N-Knopf von Next (Entwicklungsanzeige), Seed-Daten und Datum (Nov 2026 statt März 2027, „AA“ statt „CW“, Zählerstände 38/39 offen), fixe Unterleiste mitten im Ganzseitenbild am Handy.
- Unterschiedliche Datenstände zwischen hell und dunkel (z. B. Betrieb Protokoll 1 vs. 9 Einträge, Alle Mails 1 vs. 20, Geld Jahr Gebühren € 47,20 vs. € 28,80): Aufnahmezeitpunkt auf gemeinsamer Prüf-DB → U.
- Fokus: INDEX.md enthält keine Fokus-Messung; die App-Bilder zeigen keinen Fokuszustand (Boards zeigen „Fokus am ersten Bedienelement“). „Fokus unsichtbar“ ist deshalb **nicht prüfbar** (kein Messwert) – kein Mangel gezählt.
- axe serious/critical: in allen App-Bildern „keine“.

Querschnitts-Admin-Abweichungen (gelten für alle Boards, Liste für eine Admin-Board-oder-Code-Runde):
- A0.1 Web 1440: Board hat eine schmale Inhaltsspalte (~720 px, linksbündig), App nutzt die volle Breite mit anderer Spaltenaufteilung.
- A0.2 Handy: Board hat einen Seitenkopf „<Titel> · Admin · Stand …“ (mit ‹ bei Unterseiten); App zeigt den allgemeinen Agrilo-Kopf (Logo, Thema, Kürzel) und darunter die h1 mit eigener Unterzeile.
- A0.3 Agrilo-Logo: App mit „Ä“-Bildmarke, Board mit grünem Quadrat (Board-Zeichnung vermutlich Platzhalter).

---

##### admin-postfach — 3/3/3/3

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Eingang mit Faden | 4 | 4 | 3 | 3 |
| 2 Handy: Faden mit Antwort | 4 | 4 | – (nur 390) | – (nur 390) |
| 3 Meldungen: Ablauf | 3 | 3 | 3 | 3 |
| 4 Wünsche gebündelt | 3 | 3 | 3 | 3 |
| 5 Rundschreiben | 4 | 4 | 4 | 4 |
| 6 Leer (Ersatz: Filter „Antwort“ leer) | 4 | 4 | 4 | 4 |

Abweichungen:
- P-M1 **Mangel** – Bild 3, alle Fassungen: Schrift 11,5 px („Braucht dich“, „In Arbeit“, „Erledigt“ am Handy, 10 Stellen; „gestern“, „5. Nov“, „4. Nov“ im Web, 5 Stellen). Messpunkt Schrift < 12 px.
- P-M2 **Mangel** – Bild 4, alle Fassungen: Schrift 11,5 px (Handy, 6 Stellen) bzw. 11 px „Stimmen“ (Web). Messpunkt Schrift < 12 px.
- P-M3 **Mangel** – Bild 1, 1440 hell/dunkel: 2 Ziele < 44 px (Felder „Bündel-Stichwort“/„Sprint“, gemessen unter 44, gerundet 44 px hoch – knapp). Messpunkt Ziele < 44 px.
- P-A1 Admin-Abweichung – Bild 1: Board zeigt im Eingang Gespräche mit Höfen (Hof am Bach, Hof Müller, Rundschreiben „4 von 4 gelesen“) und rechts den Faden mit Antwortfeld, „Als Wichtig markieren“, „Auch per E-Mail“, „Link einfügen“, „Antworten“; App zeigt im Eingang Meldungen (Fehler/Frage/Wunsch) mit Kopf „EINGANG · FILTER OFFEN“ und rechts das Meldungs-Panel „Entscheiden“ (Status, Bündel-Stichwort, Sprint, Antwort an den Hof, Interne Notiz, Speichern, Als Duplikat markieren, „AUTOMATISCH MITGESCHICKT“) plus Fußsatz „Im Postfach stehen nur noch Gespräche …“.
- P-A2 Admin-Abweichung – Bild 1/2, 390: Board zeigt am Handy nur die Liste bzw. den Faden als eigene Seite mit Kopf „‹ Hof am Bach“; App zeigt Liste und Detail untereinander, kein eigener Faden-Kopf. Bild 2 der App zeigt kein Antwortfeld eines Hof-Fadens, sondern die eingetippte Antwort im Meldungs-Panel.
- P-A3 Admin-Abweichung – Bild 3: Board „Stand: 1 neu · 1 mit KI-Vorschlag · 1 geplant · 4 erledigt in 30 Tagen“ und vier schlanke Spalten (Neu, KI-Vorschlag, Geplant, Erledigt); App mit Zählkarte „5 Meldungen“ + Balken + fünf Zahlen, Filterpillen „Alle/Fehler/Wunsch/Frage · Von: Höfe/Kundschaft“ (Web) bzw. „Braucht dich/In Arbeit/Erledigt…“ (Handy), große Karten mit „Ansehen“/„…“, Klappzeilen „Gesammelt“/„Abgelegt“, Absatz „Wohin eine Meldung geht …“ und Kasten „Was die KI hier tut“.
- P-A4 Admin-Abweichung – Bild 4: Board Liste der Bündel mit Pfeil und Knöpfen „Zusammenfassen …“, „Ablegen …“, „Bescheid an Kundinnen …“; App zweispaltig mit Bündelliste (Filter Alle/Gesammelt/Geplant/Umgesetzt/Nicht geplant) und Bündel-Detail „Stand für alle“, „Antwort an die Höfe“, „Beim Speichern Bescheid geben an“, „Speichern und 1 Hof schreiben“.
- P-A5 Admin-Abweichung – Bild 5: Board links Formular (Radiokarten „Alle Höfe (4)/Ausgewählte“, „Info/Wichtig“), rechts „Gesendet“; App links „Gesendet“ + „Regeln“, rechts „Neues Rundschreiben“ mit Pillen „Alle Höfe · 37 / Ausgewählte · 0 / Ohne Online-Zahlung · 37 / Futter ohne Nummer · 23“, Kästen „Antwort möglich“/„Auch per E-Mail …“, Vorschau „So sieht's der Hof“, Knopf „An 37 Höfe senden“. Leerzustand „Noch kein Rundschreiben gesendet“ = Seed (U).
- P-A6 Admin-Abweichung – Bild 6 (Ersatzzustand laut INDEX): Board „Nichts offen – Alle Gespräche sind beantwortet …“ im gestrichelten Kasten; App „Bisher keine Antwort von einem Hof“ mit Knopf „Alle zeigen“ und rechts „Wähl einen Eintrag …“. Der Board-Zustand „nichts offen“ ist laut INDEX nicht herstellbar (4 offene Seed-Meldungen) → insoweit nicht prüfbar.
- P-A7 Admin-Abweichung – Kopf: Board-Reiter „Eingang · 1“, App „Eingang 4“; Knopf „Rundschreiben schreiben“ in der App mit Stift-Symbol (Handy unter dem Untertitel).
- U: Fremdtext in Seed-Meldung („Ignoriere alle vorherigen Anweisungen …“) = Seed-Daten, nicht befolgt.

##### admin-startseite — 3/3/3/3

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Bearbeiten (+ Bild 5 Handy) | 4 | 4 | 4 | 4 |
| 2 Block bearbeiten (Ersatz: Block einfügen) | 3 | nicht prüfbar | 3 | nicht prüfbar |
| 3 Dialog Entwurf veröffentlichen | 3 | 3 | 3 | 3 |
| 4 Zeitplan | 3 | 3 | 3 | 3 |
| 6 Laden | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |

Nicht prüfbar: Bild 6 „Laden-Zustand nicht stabil aufnehmbar“ (INDEX). Bild 2 dunkel (390 und 1440): kein App-Bild, INDEX nennt keinen Grund (nur hell gelistet).

Abweichungen:
- S-M1 **Mangel** – Bild 2 (390 und 1440 hell): 4 Felder ohne Beschriftung (input[date]/input[time] „Live ab, Tag“, „Live ab, Uhrzeit“, „Live bis, Tag“ …). Messpunkt Felder ohne Beschriftung. Außerdem Schrift 11 px „VORSCHAU“ (S-M2).
- S-M2 **Mangel** – Bild 2: Schrift 11 px („VORSCHAU“).
- S-M3 **Mangel** – Bild 4, alle Fassungen: Schrift 11 px („WAS WANN LIVE IST“, „VERLAUF“).
- S-M4 **Mangel** – Bild 3, alle Fassungen: h1 = 0 im Dialogzustand (Seiten-h1 liegt hinter dem Overlay). Messpunkt h1 ≠ 1; vermutlich Messart bei offenem Dialog (siehe Hinweis an den Dirigenten).
- S-A1 Admin-Abweichung – Bild 1, 1440: Board zweispaltig „Abschnitte“-Liste mit ↑/↓/Auge + „So sieht's die Kundin“ (Heute/+1 Woche/nächster Block, „Vorschau öffnen ↗“) und Statuskarte mit „Entwurf verwerfen“/„Veröffentlichen …“ unten rechts; App mit Segment „Bearbeiten/Zeitplan/Verlauf“ rechts im Kopf, Statuszeile „Keine Änderungen gegenüber live · Live: Standard-Reihenfolge · Nichts geplant“, Abschnittsliste mit festen Zeilen, „+ Block einfügen“/„+ „Neu bei den Höfen“ einfügen“ zwischen den Abschnitten, Kästen „Im Entwurf gespeichert“ und „Was sich gegenüber live ändert“, Vorschau mit „Handy/Web“ und „Entwurf/Live/am –“.
- S-A2 Admin-Abweichung – Bild 1, 1440 hell/dunkel: Vorschaufläche der App ist leer (nur Band „ENTWURF · NUR FÜR DICH SICHTBAR“, kein Seiteninhalt), Board zeigt eine Vorschau. In Bild 2/3 ist die Vorschau gefüllt → vermutlich Ladezeitpunkt der Aufnahme.
- S-A3 Admin-Abweichung – Bild 1/5, 390: Board mit fester Leiste „Entwurf · 2 Änderungen · Veröffentlichen …“ über der Unterleiste; App ohne diese Leiste und ohne sichtbaren Knopf „Veröffentlichen …“ am Handy, Reiter als Segment „Bearbeiten/Zeitplan/Verlauf“.
- S-A4 Admin-Abweichung – Bild 2: Board „Saisonkarte bearbeiten“ (Vorlage, Überzeile, Titel, Text, Live ab/bis, „Fertig“); App „Neuer Block“ (Vorlagen-Pillen, Überzeile/Titel/Text freiwillig, Bild wählen, Link-Ziel). Am Handy zeigt das App-Bild den Editor nicht im Ausschnitt (nur die Liste mit „Saisonkarte · neu · ab 7. Nov“). Ein eigenes „Block bearbeiten“ gibt es laut INDEX nicht.
- S-A5 Admin-Abweichung – Bild 3: Board „Wann? Jetzt / Zu einem Zeitpunkt“ mit Zeitpunktfeld und „Für Mo, 8. März, 07:00 planen“, Knöpfe nebeneinander links; App mit Kasten „Was sich gegenüber live ändert“, Untertexten je Wahl, Knöpfe „Abbrechen“/„Jetzt veröffentlichen“ rechts. Dialog-Overlay und Dämpfung im Dunkeln in Ordnung.
- S-A6 Admin-Abweichung – Bild 4: Board „Geplant · 1 Fassung“ mit „Als Entwurf übernehmen“/„Zurückziehen“, Kasten „So funktioniert's“, rechts Vorschau; App mit Zeitleiste „WAS WANN LIVE IST“ (Live · Standard-Reihenfolge · Ansehen), „VERLAUF · Noch keine früheren Fassungen“, rechts lange „So funktioniert's“-Liste, keine Vorschau. Geplante Fassung fehlt = Seed (U).

##### admin-geld — 3/3/3/3

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Monat (+ Bild 5 Handy) | 4 | 4 | 4 | 4 |
| 2 abschließbar (Ersatz: Oktober) | 4 | 4 | 4 | 4 |
| 3 Dialog Kosten | 3 | 3 | 3 | 3 |
| 4 Jahr | 4 | 4 | 4 | 4 |
| 6 Fehler | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 7 Zusatzfigur | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |

Nicht prüfbar: Bild 6 „Fehlerzustand ohne Auslöser per Klick“; Bild 7 „zusätzliche Board-Figur ohne Nummer im Titel; kein eigener App-Zustand zugeordnet“; Bild 2 „abschließbar“ nicht herstellbar (Knopf bis Monatsende gesperrt) – Ersatz Oktober bewertet.

Abweichungen:
- G-M1 **Mangel** – Bild 3, alle Fassungen: Ziel < 44 px (Pille „KI“, 39 × 44 px). Messpunkt Ziele < 44 px.
- G-M2 **Mangel** – Bild 3, alle Fassungen: 2 Felder ohne Beschriftung (zwei select „Ab Monat“ Monat/Jahr – nur eine gemeinsame Überschrift). Messpunkt Felder ohne Beschriftung.
- G-M3 **Mangel** – Bild 3, alle Fassungen: h1 = 0 im Dialogzustand (vermutlich Messart, siehe Hinweise).
- G-A1 Admin-Abweichung – Bild 1, Kopf: Board „‹ März 2027 › Monat Jahr“ als Pillen rechts; App Segment „Monat/Jahr“ + „‹ November 2026“ ohne „›“. Kacheln in der App mit Großbuchstaben-Überschriften („UMSATZ DER HÖFE“ …).
- G-A2 Admin-Abweichung – Bild 1, 1440: Board-Raster Abgleich | Plattformgebühr, Monatsabschluss | Kosten; App Abgleich | Monatsabschluss oben, darunter Plattformgebühr und Kosten einspaltig links (rechte Spalte leer). Abgleich in der App mit Status-Pillen (offen/gebucht/erledigt/noch keiner) statt grüner Textwerte; Monatsabschluss mit Pillen statt Häkchen und Kreisen, Kopf „2 von 4 erledigt“.
- G-A3 Admin-Abweichung – Bild 1: Knopf „November abschließen …“ gesperrt als gefüllte Lachs-/Braunfläche (Board: umrandeter Knopf „März abschließen …“); „CSV 2026 laden“ mit Symbol. Kosten-Karte mit Knopf „+ Kostenposten“ im Kopf statt „Kostenposten hinzufügen …“ unten, Zeilen mit Kategorie-Pille und Zeile „Summe im Monat“.
- G-A4 Admin-Abweichung – Bild 1/5, 390: Board fünf Kacheln (2 × 2 + Ergebnis breit) mit Unterzeilen; App drei schmale Kacheln „UMSATZ/GEBÜHR/ERGEBNIS“ ohne Unterzeilen, Monatsabschluss vor Plattformgebühr.
- G-A5 Admin-Abweichung – Bild 3: Board Dialog/Sheet „Kostenposten hinzufügen“ (Bezeichnung, Betrag im Monat + ab, Wiederholt sich, Hinweis Stripe-Gebühren, „Abbrechen“/„Speichern“ grün); App Seitenblatt rechts (Web) bzw. Blatt (Handy) „Kosten eintragen“ mit ×, Feldern Name/Kategorie-Pillen/Betrag/Rhythmus-Pillen/Ab Monat (2 Selects)/Notiz und einem orangen Knopf „Posten eintragen“ (Akzentfarbe statt Primärgrün, gewählte Pillen orange), kein „Abbrechen“.
- G-A6 Admin-Abweichung – Bild 4: Board Diagramm + Tabelle „Monat · Umsatz der Höfe · Gebühr · Kosten · Ergebnis · Abschluss“ + „CSV 2027“; App mit vier Kacheln (Gebühren/Kosten/Ergebnis/Bis Jahresende), Reitern „Übersicht/Kosten 5/Auszahlungen/Entfallene Gebühren“, Schalter „mit 2025 vergleichen“, Tabelle „Gebühren · Kosten · Ergebnis · Bestellungen“ ohne Spalte Umsatz/Abschluss, „CSV 2026“ oben rechts.
- U: Monat/Jahr 2026 statt 2027, Beträge, Beispielposten.

##### admin-betrieb — 3/3/3/3

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Überblick | 4 | 4 | 4 | 4 |
| 2 E-Mails | 4 | 4 | 4 | 4 |
| 3 Mail-Suche mit Detail | 3 | 3 | 3 | 3 |
| 4 Dialog Nochmal schicken | 3 | 3 | 3 | 3 |
| 5 Protokoll | 4 | 4 | 4 | 4 |
| 6 Laden | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |

Nicht prüfbar: Bild 6 „Laden-Zustand nicht stabil aufnehmbar“.

Abweichungen:
- B-M1 **Mangel** – Bild 3, 1440 hell (1) und dunkel (15): Ziele < 44 px – Art-Links in der Tabelle „Einzelne Mails“ nur 16 px hoch („Widerruf: Eingangsbestätigung“, „Abholbereit“, „Neue Bestellung bar (an den Hof)“ …). Messpunkt Ziele < 44 px.
- B-M2 **Mangel** – Bild 3, 390 hell/dunkel: h1 = 0 (Detail als Blatt über der Seite, Seiten-h1 dahinter). Vermutlich Messart wie bei Dialogen.
- B-M3 **Mangel** – Bild 4, alle Fassungen: h1 = 0 im Dialogzustand (vermutlich Messart).
- B-A1 Admin-Abweichung – Bild 1: Board kompakt (vier Balken-Kacheln, Tabelle „Abläufe“ mit 5 Zeilen, „Nur im Dashboard“, Knöpfe „Messungen als CSV“, „Bilder ohne Verwendung (3)“); App deutlich umfangreicher: Hinweisband „Vorschau: Bilder gemeinsam mit der Produktion …“, fünf Kacheln (Bilder, Datenbank, E-Mails heute, Bild-Vorgänge, Hofliste), „Dienste“, „Alarm-Matrix“, „Verlauf · 90 Tage“, „Abläufe“ (8 Zeilen), „Größte Tabellen“, „Tarife und Grenzen“, „Vercel-Ausgaben“, „Nur im Dashboard“, „Bilder ohne Verwendung“; Kopf „Noch nicht gemessen“ + „↻ Jetzt messen“. Reiter „Überblick“ im Board mit grünem Fokusrahmen (Board-Zeichnung des Fokus).
- B-A2 Admin-Abweichung – Bild 2: Board vier Kacheln (Zustellung/Warteschlange/Gescheitert/Monatsgrenze), „Je Art“ nach Weg, Suchfeld mit Treffern; App fünf Kacheln mit Status-Pillen, Tabelle „Je Art“ je Mail-Art, Kasten „Mails suchen“, „Braucht dich“, „Verlauf 30 Tage“, „Warteschlange gerade jetzt“, Kopf „Stand … · jede Minute neu“ + „Alle Mails · 90 Tage“, Untertitel abweichend („E-Mails live, der Rest jeden Morgen gemessen“).
- B-A3 Admin-Abweichung – Bild 3: Board bleibt auf Betrieb › E-Mails mit Suchfeld, Trefferliste und Detail „Bestellbestätigung“ (Weg, Gesendet, Zugestellt, Geöffnet, Betreff, „Ansehen“/„Nochmal schicken …“); App eigene Seite „Alle Mails“ mit Brotkrumen, Filterzeile (Art/Weg/Stand/Zeitraum/Hof, „nur vom Support“, „Filter anwenden“, „Zurücksetzen“), Tabelle „Einzelne Mails“ und Detail „Widerruf: Eingangsbestätigung“ mit Verlauf, gesperrtem „Nochmal schicken“, „Vorschau zeigen“; am Handy als Blatt mit „Detail schließen“.
- B-A4 Admin-Abweichung – Bild 4: Board-Dialog Fließtext + „Heute 0 von 3 …“, Knöpfe „Abbrechen“/„Mit Passkey schicken“ links; App mit drei Häkchenzeilen, Knöpfe rechts, Wortlaut „Mit Passkey bestätigen und schicken“.
- B-A5 Admin-Abweichung – Bild 5: Board Filterpillen „Alle/Du/Team/System · 7 Tage/30 Tage“ + Kästchen, Tabelle, Knopf „CSV mit Passkey“ unten; App Filterkarte mit Selects (Wer/Art/Zeitraum) + „Bezug suchen“ + „Anwenden“, Überschrift „Protokoll der letzten 30 Tage“, Passkey-Spalte „bestätigt“ statt ✓, Link „CSV mit Passkey“, Untertitel „Technik im Detail. Was dich braucht, steht in Heute.“ statt Board-Untertitel.
- U: unterschiedliche Datenstände hell/dunkel (Alle Mails 1 vs. 20, Protokoll 1 vs. 9), Status „gesperrt“ bei allen Mails (kein Resend-Schlüssel in der Prüfumgebung).

##### admin-einstellungen — 4/4/4/4

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Gründungshöfe (+ Bild 6 Handy-Klappliste) | 4 | 4 | 4 | 4 |
| 2 Team und Rechte | 4 | 4 | 4 | 4 |
| 3 Benachrichtigungen | 4 | 4 | 4 | 4 |
| 4 Hofpreis-Modell, Stichtag erreicht | 4 | 4 | 4 | 4 |
| 5 vor dem Stichtag | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |

Nicht prüfbar: Bild 5 „vor dem Stichtag braucht eine Prüf-DB mit Stichtag in der Zukunft (nicht Teil dieses Fotografen)“.

Mängel: keine (alle Messwerte 0, h1 = 1, axe keine).

Abweichungen:
- E-A1 Admin-Abweichung – Seitenleiste: Board-Gruppen ohne Symbole mit eigenem Eintrag „Hofpreis-Modell ab · Stichtag der Plattformgebühr“, gewählte Gruppe hell umrandet; App mit Symbolen, ohne Eintrag „Hofpreis-Modell“, gewählte Gruppe als dunkle (hell) bzw. helle (dunkel) Pille; die Karte „Hofpreis-Modell ab“ steht in der App unter jeder Gruppe.
- E-A2 Admin-Abweichung – Bild 1: App mit Kennzeichen „Register K2“, zusätzlichen Feldern „Bisheriges Standard-Ende (fest)“, Hinweis „Weniger Plätze als vergeben …“, „So steht es auf den Seiten“ als eigener Kasten, Erklärsätzen, Statuszeile „Noch nie geändert – es gelten die Standardwerte“, Kasten „Zusagen festschreiben …“ rechts; Board kompakter, „Zuletzt geändert von …“.
- E-A3 Admin-Abweichung – Bild 1, 390: Board zeigt Gruppenseite mit Kacheln; App als Klappliste (Gruppen-Akkordeon, Untertitel „Gruppen, jede mit eigenem Speichern.“), Kacheln „Plätze gesamt/Vergeben/Frei“ fehlen am Handy.
- E-A4 Admin-Abweichung – Bild 1: Datumsfelder in der App zeigen „mm/dd/yyyy“ bzw. „10/01/2026“ (US-Format des Prüf-Browsers vermutet), Board „31.03.2027“/„01.02.2027“.
- E-A5 Admin-Abweichung – Bild 2: Board Personenliste mit Rechte-Schaltern, „Person einladen …“, „Rechte mit Passkey speichern“, Zeile „Notfallzugang · versiegelt“; App „Person einladen …“ oben rechts, Zeile „Du · Inhaber“, Erklärsatz, Kasten „Notfallzugang“ mit Link „Ersatzcodes unter „Anmeldung““. Nur eine Person = Seed (U).
- E-A6 Admin-Abweichung – Bild 3: Board Empfängerliste + „Regeln je Art“ (sofort · alle …), Knöpfe „Empfänger hinzufügen …“, „Testmail schicken“; App zweispaltig „Empfänger“ (fest + Adresse hinzufügen) und „Welche Einträge per E-Mail“ (Kästchenliste), Knöpfe „Testmail an alle senden“, „Verwerfen“, „Speichern“. Kästchen in Akzent-Orange.
- E-A7 Admin-Abweichung – Bild 4: Board zeigt die Gruppe „Hofpreis-Modell ab“ allein; App zeigt dabei die Gruppe „Plattform“ (Name/Adresse) und darunter die Hofpreis-Karte.

##### admin-zugang — 4/4/4/4

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Bestätigen vor CSV-Export | 4 | 4 | 4 | 4 |
| 2 nach Bestätigung | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 3 Einrichten mit Code | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 4 folgt aus 3 | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 5 Anmeldung (Passkeys, Ersatzcodes, Geräte) | 4 | 4 | 4 | 4 |
| 6 Entfernen | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |

Nicht prüfbar (INDEX): Bild 2 „nach der Passkey-Bestätigung startet der Download, die Seite bleibt sichtbar unverändert“; Bild 3 „Einrichten mit Code braucht eine Einladung und den Einrichtungscode einer zweiten Person“; Bild 4 „folgt aus Bild 3“; Bild 6 „Entfernen ist beim einzigen Passkey gesperrt“.

Mängel: keine (alle Messwerte 0, h1 = 1, axe keine).

Abweichungen:
- Z-A1 Admin-Abweichung – Bild 1: Board-Karte linksbündig schmal, Kopfzeile „Bitte bestätige mit deinem Passkey“ vor Marke „Heikle Aktion“ (breites Band), Satz „Du willst laden: Bestellungen März 2027 als CSV. …“, Knopf über volle Breite; App Karte zentriert, Marke „Heikle Aktion“ mit Symbol über der Überschrift, Satz „Der Download geht erst nach einer frischen Bestätigung mit deinem Passkey.“ (ohne Nennung der Aktion), schmaler Knopf mit Symbol, längerer Hinweistext („… Gilt danach 5 Minuten …“). Hauptnavigation: Board markiert „Geld“ aktiv, App markiert keinen Reiter.
- Z-A2 Admin-Abweichung – Bild 5: Board zweispaltig (Passkeys | Ersatzcodes + Angemeldete Geräte), „Passkey hinzufügen“ unten, Ersatzcodes „8 von 10 übrig …“; App einspaltig zentriert, „+ Passkey hinzufügen“ im Kartenkopf, Satz „Den letzten Passkey kannst du nicht entfernen.“, Geräte-Karte mit Symbolen, Marke „dieses Gerät“, Erklärsatz, Fußsatz „Admin-Sitzungen enden nach 12 Stunden …“. Am Handy Board-Kopf „‹ Anmeldung · Admin · Stand …“, App Link „‹ Einstellungen“ unter dem Agrilo-Kopf. Ein Passkey, keine Ersatzcodes, ein Gerät = Seed (U).

---

##### Zusammenfassung

admin-postfach | 3·3·3·3 | Mängel: 3
admin-startseite | 3·3·3·3 | Mängel: 4
admin-geld | 3·3·3·3 | Mängel: 3
admin-betrieb | 3·3·3·3 | Mängel: 3
admin-einstellungen | 4·4·4·4 | Mängel: 0
admin-zugang | 4·4·4·4 | Mängel: 0

(Admin-Boards zählen nicht zum 5-Sterne-Kriterium, Z. 10526; Sterne nur zur Orientierung. Von den 13 Mängeln sind 4 „h1 = 0 im Dialog-/Blattzustand“ – startseite 3, geld 3, betrieb 3-390, betrieb 4 – vermutlich Messart.)

#### Gruppe 9

##### pruefer-ui · Schluss-Durchgang Lauf 32 · Gruppe g9

Boards: abmelden, neuigkeiten, systemseiten, widerruf, rechtstexte, fehlerseiten, problem-melden (7 Boards, eins mehr als „höchstens 6 je Aufruf“; so beauftragt).
Grundlage: Bilder unter `/home/user/wt/schluss/.nachtlauf/screens/schluss/<board>/` (App und Board je Paar verglichen), Maßstab §35 Punkte 1–7, §36 Z. 10506, Liste lauf32-board-oder-code.md (Kopf Q1–Q5 und Board-Abschnitte), §36 „Antworten der Projektleitung“, „P-Punkte“, „Nicht herstellbare Bilder“, Antworten der Projektleitung vom 7.11.2026.
Sterne: Fassungen in der Reihenfolge 390 hell · 390 dunkel · 1440 hell · 1440 dunkel. Je Fassung zählt das schlechteste Bild.

Für alle Boards gilt und ist kein Mangel:
- „Anmelden“-Pille im Handy-Kopf: Q2 (R).
- „Vertrag widerrufen“ im Fuß: R (N39, siehe Zeilen „Vertrag widerrufen im Fuß | R | N39“ unter problem-melden/widerruf).
- Fokusrahmen in den Board-Bildern, App-Bilder ohne Tastaturfokus: U (INDEX, Aufnahme) bzw. Q3 (C).
- Unterleiste mitten im Ganzseitenbild, Testmodus-Banner, Seed-Daten und Datum (Bestellnummer TD-0004 statt HM-0303-2C91, „Sa, 7. November 2026“ statt „Mi, 3. März 2027“, Fehlernummern): U (Auftragspunkt 7.11. bzw. Kopf-Regel 5).
- Zusatzbilder ohne Board-Bild (x-…) werden nicht gewertet.

---

##### abmelden — 4/4/4/4

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Abmelden? | 5 | 5 | 4 | 4 |
| 2 Erfolgreich abgemeldet | 4 | 4 | 4 | 4 |
| 3 Link ungültig | 5 | 5 | 4 | 4 |

Abweichungen:
- Bild 1–3, alle: „dieses Hofs“ / „diesem Hof“ statt „Hof Müller“ → gedeckt durch Zeile abmelden „‚dieses Hofs‘ statt Hofname | alle | U | Ungültiges Prüf-Token“. Achtung: laut INDEX war der Link diesmal gültig – siehe Hinweis an den Dirigenten.
- Bild 2, alle: Erfolgskarte ohne Häkchen-Kreis und ohne grün getönte Fläche (Board: grüne Karte mit Häkchen) → **Mangel** (Zustand war in Lauf 31 nicht prüfbar, keine Zeile deckt das).
- 1440, alle Bilder: Fuß breiter als die Inhaltsspalte (Linie und Links ab x≈110 bis 990; Board 168–932) → **Mangel** (Zeile „Logo im Fuß, Fuß breiter | 1440 | B | G11“: Logo ist weg, die Breite ist geblieben).
- 390: Fußlinks unterstrichen, Abstand Karte → Fuß und „Warenkorb“ entsprechen dem Board (B-Zeilen erfüllt).
- „Anmelden“ im Handy-Kopf → Q2. „Vertrag widerrufen“ → N39 (R).

---

##### neuigkeiten — 3/3/3/3

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Bestätigen | 5 | 5 | 4 | 4 |
| 2 Bestätigt | 3 | 3 | 3 | 3 |
| 3 Schon angemeldet | 4 | 4 | 3 | 3 |
| 4 Link abgelaufen | 5 | 5 | 4 | 4 |

Abweichungen:
- Bild 2, alle: App zeigt Überschrift und Text frei auf der Seite und einen vollbreiten grünen Knopf „Zu Hof Müller“; Board zeigt eine grün getönte Erfolgskarte mit Häkchen-Kreis und „Zu Hof Müller“ als unterstrichenen Textlink → **Mangel** (Bilder 1–3 waren in Lauf 31 nicht prüfbar; keine Zeile).
- Bild 3, alle: „Zu Hof Müller“ als vollbreiter grüner Knopf statt Textlink → **Mangel**.
- 1440, alle Bilder: „Vertrag widerrufen“ steht bei x≈110 statt in der Inhaltsspalte → **Mangel** (Zeile „‚Vertrag widerrufen‘ im Fuß nicht ausgerichtet | 1440 | B | G11“ nicht umgesetzt). Dass der Link da ist: N39 (R).
- 1440, alle Bilder: „← Zur Startseite“ – Unterstreichung beginnt erst nach dem Pfeil → **Mangel** (Zeile „Pfeil bei ‚← Zur Startseite‘ nicht unterstrichen | 1440 | B“).
- Bild 4: Hinweiskasten, Spaltenbreite und Abstände wie Board (G8 und 520-px-Zeile erfüllt).
- Fokus-Doppelring → Q3 (C).

---

##### systemseiten — 5/5/4/4

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Neue Anmelde-Adresse bestätigen | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 2 Adresse gilt | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 3 Das war ich nicht | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 4 Alle Geräte abgemeldet | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 5 Link gilt nicht mehr | 5 | 5 | 4 | 4 |

Nicht prüfbar (INDEX): Bild 1 und 3 brauchen einen gültigen Einmal-Link (Better-Auth-Ablauf bzw. Mail „Neue Anmeldung“), den der Prüf-Seed nicht erzeugt; Bild 2 und 4 folgen erst darauf. Gedeckt durch Zeile „Bilder 1–4 nicht prüfbar | alle | U“.

Abweichungen:
- 1440, Bild 5: Fuß breiter als die Inhaltsspalte (x≈110–990 statt 168–932) → **Mangel** (Zeile „Fuß mit Logo, breiter, Karte 8 px versetzt | 1440 | B | G11“; Logo weg, Karte sitzt richtig, Breite nicht).
- 390: Karte, Zeilenabstand, Fußlinks wie Board (G8, G11 erfüllt). „Anmelden“ → Q2. „Vertrag widerrufen“ → N39.

---

##### widerruf — 3/3/3/3

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Schritt 1 mit Link | 3 | 3 | 3 | 3 |
| 2 Schritt 1 ohne Link | 4 | 4 | 4 | 4 |
| 3 Schritt 2 prüfen | 4 | 4 | 3 | 3 |
| 4 Eingangsbestätigung | 4 | 4 | 3 | 3 |
| 5 Nicht mehr möglich | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |
| 6 Speicherfehler | 4 | 4 | 3 | 3 |

Nicht prüfbar (INDEX): Bild 5 braucht einen signierten Rücktritts-Link einer stornierten bzw. abgeholten und abgelaufenen Bestellung; der Prüf-Seed erzeugt nur widerruf-TD-0004 (offen) und einen ungültigen. Gedeckt durch Zeile „Bilder 1/5 nicht prüfbar | alle | U“.

Abweichungen:
- Bild 1, alle: Unter „Die ganze Bestellung“ fehlt die Liste der Positionen mit Häkchen (Board: „2× Bergkäse … · € 13,16“ usw. angehakt) → **Mangel**. Der Hinweis „Schnell verderblich – hier gilt das Rücktrittsrecht meist nicht“ im Board ist P1 (nicht gebaut, kein Mangel).
- Bild 1, alle: Feld „Deine E-Mail-Adresse“ samt Hinweis fehlt; Bild 3 und 6: Zeile „Eingangsbestätigung an maria.huber@…“ fehlt → **Mangel** (keine Zeile; der Hinweis unter dem Feld ist laut C-Zeile sogar gewollt). Falls die Adresse aus der Bestellung kommen soll: als C-Zeile nachtragen.
- Bild 1, 3, 6, alle: „Hof Müller, Hofgasse 12, 5280 Braunau am Inn“ bzw. „TD-0004 bei Hof Müller, Hofgasse 12, …“ statt nur „Hof Müller“ → **Mangel** (in Bild 4 deckt die Zeile „Zeilen Bestellung, Was, Name, Eingangsbestätigung | Bild 4 | R | N39“ den Inhalt; für Schritt 1/2 keine Zeile. Wenn die Anschrift aus Rechtsgründen gewollt ist (Identität des Unternehmers): als R nachtragen).
- Bild 1/2, alle: Auswahlkarten „Die ganze Bestellung / Einzelne Artikel“ etwa 46 px hoch mit normaler Schrift; Board etwa 70 px, Beschriftung fett → **Mangel**.
- Bild 4, alle: keine h1 auf der Seite („Dein Rücktritt ist bei uns eingegangen“ ist keine Überschrift erster Ordnung; Messung h1 = 0, vom Fotografen bestätigt) → **Mangel** (Maßstab Punkt 3).
- 1440, Bild 2–6: Fuß breiter als die Inhaltsspalte (wie abmelden) → **Mangel** (G11; die Liste nennt widerruf nicht, das Board zeigt den Fuß in der Spaltenbreite).
- Bild 2, alle: Felder im Board befüllt, in der App leer → U (Zustand/Beispieldaten, Kopf-Regel 5).
- Bild 2: Auswahlgruppe statt „Welche Artikel?“ → R (N39). „Nachricht an den Hof (freiwillig)“ → C. Hinweis unter E-Mail → C. „Vertrag widerrufen“/„Widerruf bestätigen“ statt „Weiter zur Prüfung“/„Rücktritt bestätigen“, Belehrung unter dem Formular → R (N39/N43).
- Bild 2: Platzhalter „[Name, Anschrift … des Hofs]“ in der Belehrung → U bzw. P1.
- Bild 4: Schritt-Liste im anderen Wortlaut → R. Datum mit Wochentag, ohne „Uhr“ → B-Zeile erfüllt. Seitentitel über der Bestätigung entfällt → B-Zeile erfüllt. Karte 600 px, „Drucken oder speichern“ textbreit links (1440) → erfüllt. In 390 verdeckt die Unterleiste den Knopf → U (Ganzseitenbild).
- Bild 6: Fehlerkasten wie Board (G8 erfüllt).

---

##### rechtstexte — 4/4/4/4

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 AGB ganze Seite | 4 | 4 | 4 | 4 |
| 2 AGB oben / Punkt 15 | 4 | 4 | 4 | 4 |
| 3 Datenschutz | 4 | 4 | 4 | 4 |
| 4 Impressum | 5 | 5 | 4 | 4 |
| 5 Konditionen | 4 | 4 | 4 | 4 |
| 6 Konditionen Plattformgebühr | 4 | 4 | 4 | 4 |

Kein Mangel nach Auftrag: Wortlaut und Gliederung von AGB, Datenschutz, Impressum, Konditionen (35 statt 26 Punkte, 14 statt 15 Abschnitte, „Kurz erklärt“-Punkte, Abschnitte „So läuft die Aufnahme“ usw.) → §35 Punkt 2 / R. „gilt ab 1. Oktober 2026“, „Stand 1. Oktober 2026“ → Stichtag der Prüf-DB (U). Aktion-Karte „12 Gründungshöfe“ (Bild 5) → P2, aus der Wertung. Marke „Entwurf, Anwältin prüft“ fehlt → C. Impressum als Fließtext mit Pilotbetrieb-Kasten statt Karte, ohne „RECHTLICHES“ → R (Zeile Impressum, A001/A004). Startfokus auf „Drucken/Speichern“ → C. Bild 1 390: Board zeigt kein „Inhalt“-Feld, Bild 2 zeigt es → Board widerspricht sich, Bild 2 gilt (Kopf-Regel 4). Ziele < 44 px („kontakt@agrilo.at“, 118 × 18): Verweis im Fließtext (Punkt 1.1 der AGB), damit Ausnahme, kein Mangel.

Abweichungen:
- Bild 1–6, alle: Fließtext der Rechtstexte in gedämpfter Farbe (hellgrau), Board in voller Textfarbe → **Mangel** (Farbe, keine Zeile).
- Bild 1–3, alle: Knopf „Drucken/Speichern“ mit Drucker-Symbol, Board ohne; „Inhalt“ (390) mit Chevron statt Dreieck → **Mangel** (klein).
- 1440, alle Bilder: Fuß breiter als die Inhaltsspalte (x≈110–990 statt 168–932) → **Mangel** (Zeile „Impressum/Konditionen mittig, Fuß breiter mit Logo | 1440 | B | Linksbündig x ≈ 221; G11“: linksbündig erfüllt, Logo weg, Breite nicht).
- 1440, Bild 1/2: Verzeichnis-Karte schneidet die untersten Einträge ab und scrollt intern → Grenzfall, nicht gezählt (Zeile „Spalte scrollt intern | B | geschlossene Karte“; mit 35 Punkten passt die Liste rechtlich bedingt nicht in den Bildschirm; Karte ist geschlossen, aktiver Eintrag „15.“ grün und fett → Hervorhebungs-Zeile erfüllt).
- Erfüllt: „Hof registrieren“ in Inhaltsbreite (390), Trennlinie nach „Kurz erklärt“ weg, h1 einzeilig (1440), Teil-Überschriften in Eintragsgröße, Impressum/Konditionen linksbündig.

---

##### fehlerseiten — 3/3/3/3

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 404 Haus | nicht wertbar (siehe unten) | nicht wertbar | nicht wertbar | nicht wertbar |
| 2 404 Hof | 4 | 4 | 4 | 4 |
| 3 404 Produkt | 3 | 3 | 3 | 3 |
| 4 500 Kundschaft | 4 | 4 | 3 | 3 |
| 5 500 Hofbereich | 3 | 3 | 4 | 4 |
| 6 global-error | nicht prüfbar | nicht prüfbar | nicht prüfbar | nicht prüfbar |

Nicht prüfbar (INDEX): Bild 6 „global-error ohne Shell: ein Fehler im Wurzel-Layout lässt sich ohne Codeänderung nicht auslösen“ → §36 „Nicht herstellbare Bilder“ (global-error) und Zeile „Bild 6 nicht herstellbar | U“.

Abweichungen:
- Bild 1, alle: Unter /gibt-es-nicht-xyz zeigt die App die **Hof**-404 („Diesen Hof gibt es hier nicht (mehr)“, „Höfe entdecken“ zuerst, kein Suchfeld), Board zeigt die Haus-404 („Diese Seite gibt es nicht (mehr)“, „Zur Startseite“ zuerst, Suchfeld). App-Bild 1 ist inhaltlich gleich App-Bild 2. Vermutlich trifft eine einteilige Adresse die Hof-Route; die Haus-404 ist damit nicht aufgenommen → nicht gewertet, Hinweis an den Dirigenten (neu aufnehmen mit mehrteiliger Adresse). Ist die Haus-404 so gar nicht erreichbar: Mangel.
- Bild 1–3, 390: Überschrift bricht anders um („Diesen Hof gibt es / hier nicht (mehr)“, „Dieses Produkt gibt / es hier nicht (mehr)“; Board: „… gibt es hier / nicht (mehr)“) → **Mangel** (Zeile „Überschrift bricht zweizeilig bzw. anders um | 1440/390 | B“; 1440 jetzt einzeilig wie Board).
- Bild 3, alle: „Zum Hof“ statt „Zu Hof Müller“ → **Mangel** (Zeile „‚Zum Hof‘ statt ‚Zu Hof Müller‘ | alle, Bild 3 | B“).
- Bild 5, 390: Seitenkopf („Heute“ · „Hof Müller · Stand …“) fehlt über der Fehlerkarte → **Mangel** (Zeile „Kopf ‚Heute‘ fehlt auf der Hof-Fehlerseite | 390, Bild 5 | B“). Aktiver Reiter „Mein Hof“ statt „Heute“ → U (Fehler auf /farm-page ausgelöst).
- 1440, Bild 1–4: Fuß breiter als die Inhaltsspalte → **Mangel** (Zeile „Logo im Fuß | 1440 | B | G11“; Logo weg, Breite nicht).
- Lage und Größen: 1440 Bild 1–4 Inhalt etwa 70 px tiefer als im Board; Bild 5 1440 Fehlerblock mittig in der ganzen Fläche (x≈650) statt in der Inhaltsspalte (Board x≈520); Textlink „Problem melden“ kleiner als im Board (Bild 4/5); Bild 4 390 Abstand zum Fuß deutlich größer → **Mangel** (Aufbau, keine Zeile).
- Bild 4, alle: Die 500-Seite hat keinen `<title>` (axe serious „document-title“) → **Mangel** (messbar; nicht im Bild sichtbar, aber axe serious).
- Erfüllt: Kunden-Kopf am Web ohne Suchfeld nach G9; am Handy Pille „Anmelden“ statt Personen-Symbol (Bild 4); Zweitknopf-Rand; Fußlinks unterstrichen; „Darstellung“ frei (außerhalb des Ganzseitenbild-Artefakts).
- „Konto · Franz Müller“ (Bild 5, 1440) → Q1 (C). „Gründungshof noch 14 Monate (bis 31. Dezember 2027)“ → U (Seed/Datum).

---

##### problem-melden — 2/2/2/2

| Bild | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel |
|---|---|---|---|---|
| 1 Leer | 2 | 2 | 2 | 2 |
| 2 Fehlernummer vorbelegt | 2 | 2 | 2 | 2 |
| 3 Wunsch gewählt | 2 | 2 | 2 | 2 |
| 4 Angemeldeter Hof | 2 | 2 | 2 | 2 |
| 5 Danke mit Kurznummer | 4 | 4 | 4 | 4 |
| 6 Serverfehler | 3 | 3 | 3 | 3 |

Abweichungen (alle B-Zeilen der Liste, die im Bild noch offen sind):
- Bild 1–4/6, alle: Auswahlkarten etwa 46–48 px hoch statt 64 px → **Mangel** (Zeile „Auswahlkarten 46 statt 64 px | 390 | B“; am Web ebenso niedriger als Board).
- Bild 1–4/6, alle: Zeichenzähler „0 / 2000“ linksbündig statt rechtsbündig → **Mangel** (Zeile „Zeichenzähler linksbündig | alle | B“).
- Bild 1–4/6, alle: Beschriftungen „Fehlernummer (optional)“ und „Deine E-Mail · nur für unsere Antwort, optional“ nur im ersten Wort fett → **Mangel** (Zeile „Beschriftungen nur erstes Wort fett | alle | B“).
- Bild 1–4/6, alle: Hilfetext „Manche Fehlermeldungen enden auf ein Kürzel in eckigen Klammern …“ steht auf der Kundenseite → **Mangel** (Zeile „Hilfetext zu eckigen Klammern | alle | B | Nur im Hofbereich“).
- Bild 3, alle: Feld „Fehlernummer“ auch bei „Ich hätte gern, dass …“ → **Mangel** (Zeile „Fehlernummer auch bei ‚Ich hätte gern …‘ | alle, Bild 3 | B“).
- Bild 4, alle: „+ Bildschirmfoto hinzufügen (optional)“ mittig mit durchgezogenem Rand und vor der Fehlernummer; Board linksbündig, gestrichelt, ohne „(optional)“, nach der Fehlernummer → **Mangel** (Zeile „‚Bildschirmfoto‘ mittig mit Kamera | alle | B | Linksbündig mit ‚+‘“; das „+“ ist da, Ausrichtung, Rand und Reihenfolge nicht).
- Bild 4, alle: Kasten „Das schicken wir automatisch mit“ (Seite, Gerät, Hof) bei Hof-Sitzung statt des Satzes „Mitgeschickt: Seite, Gerät und dein Hof (Hof Müller). Keine IP-Adresse, keine Cookies.“ → **Mangel** (Zeile „Kasten … bei Hof-Sitzung | 1440, Bild 4 | B | Auf /fehler-melden immer der Satz“).
- Dunkel, Bild 1–4/6: gewählter Auswahlpunkt als heller Ring mit dunkler Mitte statt gefülltem grünen Punkt → **Mangel** (Zeile „Auswahlpunkt im Dunkeln Ring statt gefüllt | d | B“).
- Bild 5, alle: Kurznummer „cmw6h0v1“ / „cmw6gqnl“ – 8 Zeichen, klein geschrieben; Board „4F8M“ → **Mangel** (Zeile „Kurznummer … | B | G14 Kurznummer“: groß geschrieben; Antwort der Projektleitung 7.11.: 6 Zeichen, Board wird auf 6 angeglichen – die App hat 8 und klein, erfüllt also weder G14 noch die Antwort).
- 1440, alle Bilder: Fuß breiter als die Inhaltsspalte → **Mangel** (Zeile „Fuß mit Logo, breiter | 1440 | B | G11“; Logo weg, Breite nicht).
- Bild 6: Fehlerkasten über dem Formular statt Seite „Fehler 500“ → B-Zeile erfüllt; Knopf „Nochmal“ im Kasten (Board ohne) → G6/N29 (Netzfehler mit „Nochmal“), kein Mangel.
- Erfüllt: drei Karten untereinander, linksbündig in der Inhaltsspalte (1440), Fehlernummer volle Breite, „Mitgeschickt: Fehlernummer …“ (C), Fußlinks unterstrichen (390).
- „Anmelden“ → Q2. „Vertrag widerrufen“ im Fuß → R (N39). „Mein Hof“-Pille bei Hof-Sitzung (Bild 4) → G9.

---

##### Zusammenfassung

abmelden | 4·4·4·4 | Mängel: 2
neuigkeiten | 3·3·3·3 | Mängel: 4
systemseiten | 5·5·4·4 | Mängel: 1 (Bilder 1–4 nicht prüfbar)
widerruf | 3·3·3·3 | Mängel: 6 (Bild 5 nicht prüfbar)
rechtstexte | 4·4·4·4 | Mängel: 3
fehlerseiten | 3·3·3·3 | Mängel: 6 (Bild 1 nicht wertbar, Bild 6 nicht prüfbar)
problem-melden | 2·2·2·2 | Mängel: 10
