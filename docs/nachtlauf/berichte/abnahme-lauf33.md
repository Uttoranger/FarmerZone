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

## Zwischen-Durchgang B (9.11.2026, 15:17–15:25 UTC)

Prüfstand: Zwischenstand `integration/lauf33` 067de06c9e2e (alle Nummern von B: 261–277, 279, 262b; ohne 278, 280, 281), ein Bau unter `env -i` im eigenen Prüf-Worktree, Prüf-Seed (Stichtag Vergangenheit) in einer Wegwerf-DB, Fotograf `start` auf einer Kopie, Prüf-Browser über `pruef-browser.sh`, Bilder über `seiten-bild.sh --session`. Bewertet hat pruefer-ui (sechs Aufrufe mit frischem Kontext, nur Bild der App, Board-Bild und Abnahme-Grundlage samt §37.1) auf den Bildern der Nummern (`.nachtlauf/screens/<nr>/r1/`, bei 276 korb `r2/`, alle vier Fassungen); die Gegenprobe vom Zwischenstand (je Board 390 hell, `.nachtlauf/screens/zwischen-b/`, 40 Bilder) stimmt mit den Bildern der Nummern überein (bei 277 pixelgleich bis auf Uhrzeiten). Nicht neu bewertet: Boards, die pruefer-ui in B schon für 267 und 269 bewertet hat (hofdaten-zahlung 3·3·3·3, beitraege 3·3·3·3 → 278 in C).

### Boards

| Board | Nr. | Schluss Lauf 32 | Zwischen-Durchgang B (390 hell · 390 dunkel · 1440 hell · 1440 dunkel) | Mängel (Hauptpunkte; Rest gedeckt durch Liste/Ergänzung/3.2/Auftrag) |
|---|---|---|---|---|
| startseite | 271 | 3·3·3·3 | 4·4·3·3 | 1440: h1 drei statt zwei Zeilen, Regionskarte größer, Abschnittsabstände 48–57 statt 24–34 px; Zeile „Noch 64 von 100 Gründungsplätzen frei“ in „Für Höfe“ (Ergänzung deckt nur die Zahl); G8, G11 |
| hoefe | 271 | 2·2·3·3 | 4·3·3·3 | 390 dunkel: Illustration der Hofkarte als helles Rechteck mit dunklen Streifen (§37.1 15.5.3); Bildfläche 150 statt 97 px; Zusatzsatz „Keinen Ort gefunden …“; Bild 5 mit Ortfeld und Tage-Chips; G8 |
| hofseite | 271 | 3·3·4·4 | 3·3·4·3 | 390: Reihenfolge der Abschnitte; 1440 dunkel: Produkt-Illustration als helles Quadrat in dunkler Fläche (§37.1 15.5.3); G8, G11 |
| produkt | 271 | 2·2·3·2 | 3·3·3·3 | Merkmal-Kacheln und Raummeter-Erklärung nicht wie Board; Ausverkauft-Satz (Liste produkt B); „Vorrat: noch 33 × 6 Paket“ statt G5; dunkel: helles Quadrat (§37.1 15.5.3); G11 |
| region | 272 | 2·2·2·2 | 3·3·3·3 | Hofzeilen 44 statt 24 px; Leerzustand-Text; Bild 6 „×“ statt „Schließen“, Pin-Beschriftungen abgeschnitten |
| verkaeufe | 272 | 2·2·2·2 | 4·4·4·4 | Vorrat-Satz, Meldungstext, Link zu den Stripe-Auszahlungen fehlt, Chip doppelt; Messung h1 0 bei offenem Blatt (Bild 2, 3) |
| kunden | 273 | 3·3·3·3 | 4·4·4·4 | Vorauswahl Sortieren; Datum mit Komma; Bild 6 zeigt die 500 (db-aus, siehe unten) |
| auswertung | 273 | 3·3·3·3 | 3·3·3·3 | Grenze-Karte Serif-Titel, „55 000“; Wochenvergleich; Satz zur Gebühr fehlt; Fehlerbild 500 |
| mein-hof | 274 | 3·3·2·2 | 3·3·3·3 | Statuskarte-Text; Startfokus im Textfeld; Kundenansicht mit zusätzlicher Kopfzeile; Postfach-Symbol ohne Zähler; axe landmark-unique (1440 Bild 1, 2, 4; 390 Bild 6) |
| postfach | 274 | 3·3·4·4 | 3·3·3·3 | eigene Antwort von der Leiste verdeckt; Absenderzeile in der Blase; 1440 zweite h1 „Nachricht“; Leerzustand-Text; Fehlerbild 500 |
| registrieren | 275 | 3·3·3·3 | 3·3·3·3 | /onboarding ohne G1-Rückweg (Handy und Web), Knöpfe an späteren Schritten, Lastschrift-Symbol, Balken im Dunkeln (G13); Text „bis 31. Dezember 2027 keine Grundgebühr“ (vermutlich K2, Frage) |
| meine-bestellungen | 275 | 3·3·3·3 | 4·4·4·4 | Zeilen „Früher“ 57 statt 77 px; Zeilenabstand Einleitung |
| kundenkonto | 275 | 4·4·4·4 | 4·4·4·4 | Abstände zum Fuß und vor „Admin-Anmeldung“ |
| anmelden | 275 | 4·4·4·4 | 4·4·4·4 | Fehlerkasten höher, Rand kräftiger; Abstand vor „Admin-Anmeldung“; „Warenkorb“-Beschriftung 3 px höher (G10) |
| passwort | 275 | 4·4·4·4 | 4·4·4·4 | Erfolgskarte: Zeilenabstand, Rand; dunkel Text grau statt grün |
| korb | 276 | 3·3·5·5 | 4·4·4·4 | Positionszeile (Preis-Lage, Abstände), Stepper schmaler, dunkel Rand dunkelgrün statt Mint; Bild 3 (leer) nicht aufgenommen |
| kasse | 276 | 4·4·4·4 | 4·4·4·4 | „09:00–12:00“ statt „9:00–12:00“; Leistensatz; Mindestbestellwert-Zeile („Deine Bestellung“ gedeckt: Antwort 2 der Projektleitung, 9.11.2026) |
| bestaetigung | 276 | 4·4·4·4 | 4·4·4·4 | „15:00–18:00 Uhr“ statt „15–18 Uhr“; 1440 Abstände |
| bestellung-link | 276 | 4·4·4·4 | 4·4·4·4 | Zeitformat; Abstand Kopf → Link; Marke „Bestätigt“ statt „Bezahlt“ (online); Bild 3 nicht aufgenommen |
| heute | 277 | 4·4·4·4 | 4·4·4·4 | Leiste „Abholung heute …“ fehlt; Hinweis → Karte 32 statt 12 px (ui/werkzeug-kopf, 269); neuer Hof 1440 mit Zusatzkarten; Leerzustand „Packliste für heute“ |
| bestellungen | 277 | 4·4·4·4 | 4·4·4·4 | Hinweis → Leer-Karte 32–36 statt 12 px; Kopf → Hinweis 28 statt 13 px |
| bestellung | 277 | 4·4·4·4 | 4·4·4·4 | Aktionsleiste 1440 bis zum Rand (Liste B); „Abholzettel drucken“ am Handy |
| druck | 277 | 4·4 | 4·4 (nur hell) | „Gesamt inkl. …“ statt Board „Preise inkl. …“ = Register vor Board (Antwort 4, Auftrag Z. 112); axe landmark-one-main/region (kein `<main>`) |
| produkte | 277 | 3·3·4·4 | 4·4·4·4 | Freischalt-Hinweis über Kopf und Reitern (mein-hof-kopf, 274); Messung Felder 1 („Vorrat (L)“, nur aria-label) |
| produkt-neu | 277 | 3·3·3·3 | 3·3·3·3 | Kurzstand „Pflicht · noch offen“ grau; Registrierungen als Kasten statt Zeile; Schleier im Web verwischt (ui/dialog); Messung Felder 4 (Futter) bzw. 3 (Holz), Vorrat-Felder nur per aria-label. Gegenprobe: Erklärsatz der geöffneten Kennzeichnung steht (Runde 1) |
| neuigkeiten | 279 | 3·3·3·3 | 4·4·4·4 | Kopf-Abstand, Zeilenabstand, „←“ nicht unterstrichen (kunde-shell, 267) |
| abmelden | 279 | 4·4·4·4 | 4·4·4·4 | Bild 3: ungültiger Link zeigt das Formular statt „Link ungültig“ (zu prüfen) |
| systemseiten | 279 | 5·5·4·4 | 4·4·4·4 | Abstand Karte → Fuß 46 statt 20 px; Zeilenabstand |
| widerruf | 279 | 3·3·3·3 | 4·4·4·4 | Feld „Deine E-Mail-Adresse“, Zeile „Eingangsbestätigung an“, Anschrift des Hofs – Frage „Recht“ (Regel Z. 169) |
| fehlerseiten | 279 | 3·3·3·3 | 3·3·4·4 | „Zum Hof“ statt „Zu Hof Müller“ (Z. 789, offen); 390 Inhalt 35 px tiefer; „Problem melden“ als Link |
| rechtstexte | 279 | 4·4·4·4 | 4·4·4·4 | Karte „Aktion Gründungshöfe“ fehlt; /agb Ziele 4 (Link kontakt@…, Fließtext) und axe heading-order |
| problem-melden | 268 | 2·2·2·2 | 4·4·4·4 | Textfeld 117 statt 88 px |
| meldungen | 268 | 3·3·3·3 | 3·3·3·3 | Liste ohne „›“, Einzelkarten am Handy (Z. 573), Chips rund, Rücklink 1440 (Z. 576), Spaltenbreiten |
| mail-sicherheit | 270 | nicht prüfbar | nicht aufgenommen | Mail-Vorschau nur hinter der Admin-Anmeldung; im Zwischen-Durchgang nicht angemeldet → Schluss-Durchgang C |

Kein Board von B erreicht in diesem Durchgang 5 Sterne; gegenüber Schluss Lauf 32 besser: startseite, hoefe, produkt, region, verkaeufe, kunden, meine-bestellungen, produkte, neuigkeiten, widerruf, problem-melden, mein-hof (1440), korb 390 (3 → 4); gleich: 17 Boards; schlechter: korb 1440 (5 → 4, Positionszeile und Stepper), hofseite 1440 dunkel (4 → 3, F041-Quadrat), postfach 1440 (4 → 3, Lauf 32 nur Leerzustand prüfbar), systemseiten 390 (5 → 4, Abstand zum Fuß).

### Querschnitt

- **F041 nicht ganz erreicht (§37.1 15.5.3):** Die Dämpfung wirkt (gemessen 0,85), aber auf hoefe 390 dunkel, hofseite (Produkte) 1440 dunkel und produkt dunkel füllt die Illustration ihre Bildfläche nicht: helles Rechteck bzw. Quadrat mit dunklem Rand rundum („kein schwebendes helles Quadrat“). Hof › produkte (277) ist gerahmt wie ein Foto. Nacharbeit 271 in C.
- **G8 und G11:** Kartenradien 20–24 statt 12 px auf den Finden-Boards; Seitenfuß im Web breiter als die Inhaltsspalte (startseite, hofseite, produkt).
- **G3 Hinweiskasten:** Abstand Hinweis → erste Karte 32–36 statt 12 px (heute, bestellungen; Ursache `mb-4` in ui/werkzeug-kopf.tsx, 269).
- **Zeitformat:** „09:00–12:00“ bzw. „15:00–18:00 Uhr“ statt „9:00–12:00“/„15–18 Uhr“ auf kasse, bestaetigung, bestellung-link (gemeinsame Hilfe vermutet).
- **Zeilenabstand im Fließtext** 21–23 statt 18–20 px und **Text-/Fehlerkästen höher** als im Board (passwort, anmelden, problem-melden, neuigkeiten, systemseiten).
- **Ladefehler-Bilder** (kunden, auswertung, postfach) zeigen die 500: `fotograf.sh db-aus` schaltet die ganze DB ab, die Hof-Shell scheitert vorher (bekannt seit 262). G6 bleibt so nicht prüfbar.
- **Startfokus** in den 1440-Bildern nicht sichtbar (Aufnahme mit Klick statt Tab, Q3).

### Nachmessungen

- **/onboarding 1440** (Konto „wartender Hof“, wie 275), hell und dunkel: axe serious/critical 0; einmal „incomplete“ color-contrast am Pfeil „▾“ (Zeichen ohne Text). Der Befund aus 275 ist auf dem Zwischenstand nicht mehr da.
- **500-Seite** (eigene Kopie gesperrt, /hof-mueller): genau ein `<title>` („Fehler — Agrilo“), eine h1. Der „[TEST]“-Vorsatz ist im Prüf-Bau nicht prüfbar: der Bau läuft als Produktion, auch /impressum hat dort keinen Vorsatz. Belegt durch tests/fehlerseite-titel.test.ts und tests/hydrieren.test.ts (279); global-error ohne Vorsatz (279 Bericht §2).
- **Messung Gegenprobe:** Schrift < 12 px 0, Ziele < 44 px 0 (außer /agb: Link kontakt@… viermal, Fließtext), h1 1 bzw. „Dialog offen“; Felder ohne Beschriftung: produkt 1 (Mengen-Feld, wenn das Produkt im Korb liegt), produkt-neu 4 (Vorrat-Felder); axe nur moderate (druck landmark-one-main, region; /agb heading-order).

Bilder: `.nachtlauf/screens/zwischen-b/` (40 Bilder mit .messung.json und .axe.json, INDEX.md), Board-Bilder `.nachtlauf/screens/boards/<board>/`, Bewertungen `.nachtlauf/dirigent/ui/b-*.md` (nicht committet). Das App-Bild des Impressums zeigt den Inhalt aus der App; Bilder bleiben außerhalb des Repositorys.

### Admin

Nicht abgenommen in Abschnitt B (keine Admin-Nummer in B; Admin-Anmeldung nicht versucht; mail-sicherheit → C).

## Schluss-Durchgang (Abschnitt C, 9./10.11.2026)

Stand: Block 1 (9.11., 21:02–22:00 UTC) ist auf a47c2115c33c gebaut (alle Nummern von A und B, dazu 282, 262c, 278, 281; ohne 26.1 und 280); 26.1 ändert nichts Sichtbares (`git diff --name-only a47c2115c33c..d1690d0d9ab3 -- src`: nur Kommentare und der gelöschte alte Kopf ohne Aufrufer). Nach der Unterbrechung der Sitzung (etwa 22:05 bis 07:29 UTC, Neustart des Containers) ist der Rest am 10.11. 08:03–09:04 UTC nachgeholt: Prüfstand neu auf 0dc3ca9414fb (Prüf-DBs `pruef33e` mit Stichtag in der Vergangenheit und `pruef33eg` zusätzlich mit `--gruendung-fest`, localhost), start-Fotografen auf Port 3201 (Dialoge als Fenster-Bild) und 3202 (registrieren, rechtstexte Figur 5), dev-Fotograf auf dem Sammelstand mit Nr. 280 (237fa90b9db5) für Admin, Mail-Code und Systemseiten, die Mails als echtes HTML (unentschärfte Knöpfe; erzeugt mit `MAIL_VORSCHAU=1` aus tests/mail-vorschau.test.ts auf 237fa90b9db5). Bewertet hat pruefer-ui (P1–P14, M1–M4, A1–A3; frischer Kontext, nur Bilder, Abnahme-Grundlage samt Ergänzungsliste und §37.1; höchstens vier gleichzeitig). Bilder im Container unter `.nachtlauf/screens/schluss/<board>/` (App, INDEX.md, Messung), nicht committet.

### Ergebnis (schlechtestes Bild je Fassung: 390 hell · 390 dunkel · 1440 hell · 1440 dunkel; Mails 390 · 600 hell, Druck nur hell)

| Board | Nr. | Schluss Lauf 32 | Schluss-Durchgang 33 | Nummer abgeschlossen | Mängel (Rest gedeckt) | gedeckt durch Liste/Ergänzung/3.2/Auftrag |
|---|---|---|---|---|---|---|
| startseite | 271 | 3·3·3·3 | 4·4·3·3 | ja | 1440 Kopf 675 statt 370 px, h1 dreizeilig, Abschnittsabstände (Z. 128 B); Regionskarte größer, Pins ohne Schild (Z. 114 B); Standort-Link weiß (Z. 118 B); Zusatzzeile Gründungsplätze; G8, G11 | Erg. Z. 16 (Zahl); Kartenkacheln ohne Netz; Figur 5 nicht herstellbar (keine Höfe) |
| hoefe | 271 | 2·2·3·3 | 2·2·3·3 | ja | Figur 5 (Hof gewählt): 390 Sprechblase statt Auswahlfeld, „Schließen“ fehlt, „Zum Hof“ 34 statt 52 px; 1440 (Fenster-Bild) Popup statt Karte darunter, Pin ohne Schild (Z. 80 B), im Dunkeln Illustration ohne Rahmen (§37.1 15.5.3); Bildfläche 150 statt 96 px; G8, G11 | Z. 71–73, 77–79, 96, 98, 100; Erg. Z. 10, 18; Q2; Figuren 3, 4 nicht herstellbar (Ortssuche braucht Netz) |
| hofseite | 271 | 3·3·4·4 | 3·3·4·3 | ja | Reihenfolge der Abschnitte am Handy; Karte mit zweizeiligem Namen (Z. 141 B); 1440 dunkel helles Quadrat ohne Rand (§37.1 15.5.3); „€ … / m³“ neben „/ rm“; G8 | Z. 135/Q2, 139, 142–144; Figur 4 nicht herstellbar (kein pausierter Hof) |
| produkt | 271 | 2·2·3·2 | 3·4·3·4 | ja | Kontrast 4,41:1 der gewählten Größenkachel (axe serious, hell); Mengenfeld der Kauf-Leiste ohne verbundene Beschriftung; Ausverkauft-Satz (Z. 164 B), Raummeter-Satz (Z. 163 B), Merkmal-Kacheln (Z. 161 B), Marke „Ausverkauft“ (Z. 171 B), „Gleich mit abholen“ (Z. 162 B); G8, G11 | Z. 153 P1, 155, 157–159, 167/Q2, 169, 170; Erg. Z. 18 |
| region | 272 | 2·2·2·2 | 2·2·2·2 | ja | Hofzeilen 44 statt 24 px, Umbruch (Z. 653); gewählter Hof ohne „Schließen“, „Du“ abgeschnitten (Z. 650, 671); Größen als eigene Karten, Knopf (Z. 663); Fehlerkasten rötlich (Z. 667); Leerzustand-Text (Z. 668) | Z. 652, 657–659, 664, 672/Q1, 674; Regel 6; Q4; Erg. Z. 18 |
| verkaeufe | 272 | 2·2·2·2 | 3·3·3·3 | ja | Link zu den Stripe-Auszahlungen fehlt (Z. 706 B); „2 × …“ statt „2× …“ (Z. 707 B); Chips 36 statt 44 px; Hinweis unter dem festen Knopf; Vorrat-Satz (Fig. 3, B); Fehlerkarte orange (Fig. 6, G6); Knöpfe im Blatt 43 statt 48 px, Pille | Z. 708, 713, 721/Q4, 724/Q1; Figur 4 nicht herstellbar |
| kasse | 276 | 4·4·4·4 | 4·4·4·4 | ja | Figur 5 Mindestbestellwert: „ab“ zusätzlich, Klammer „(mit Gebühr …)“ fehlt (Entscheidung, Geld); Figur 3: Sätze „Du bestellst …“ und „Verkäufer ist …“ fehlen, dafür „Preise inkl. USt“ und Erklärsatz (Entscheidung) | Antwort A 2 (Karte „Deine Bestellung“), Antwort B 5; Erg.; Figur 4 nicht herstellbar (Zahlungsdienst Platzhalter, Liste Z. 206) |
| korb | 276 | 3·3·5·5 | 4·4·4·4 | ja | Mengenwähler 121 statt 133 px, Positionszeile 120 statt 131; dunkel Rahmen des Mengenwählers 2,6:1 (Kontrast) | G14; Erg. |
| bestaetigung | 276 | 4·4·4·4 | 4·4·4·4 | ja | h1-Zeilenabstand, Abhol-Karte 211 statt 193 px, 1440 Inhalt 41 statt 25 px unter dem Kopf | Erg. Z. 9 (Plattformgebühr-Satz sinngemäß) |
| bestellung-link | 276 | 4·4·4·4 | 4·4·4·4 | ja | Figur 1 mit online bezahlter Bestellung („Bezahlt“): Termin-Form, Abstände 42 statt 30 px, Karten höher; Zahlzeile „(6 %)“ nicht gedämpft | Antwort B 6; Erg. Z. 21; Bar-Bild „Bestätigung offen“ ohne Board-Zustand |
| anmelden | 275 | 4·4·4·4 | 3·3·3·3 | ja | Unterleiste „Warenkorb“ (Z. 773 B, G10); Maße 1440, Kartentitel größer, Abstände 390, Rand Zweitknopf | Q2 |
| passwort | 275 | 4·4·4·4 | 4·4·3·3 | ja | „Vertrag widerrufen“ im Fuß ohne deckende Zeile (Entscheidung); Pfeil im Rück-Link; Abstände; Rand Bild 5 | – |
| registrieren | 275 | 3·3·3·3 | 3·3·3·3 | ja | /verify als gerahmte Karte mit Symbol, „Weiter zum Einrichten“ fehlt als Hauptknopf, „E-Mail erneut senden“ orange statt Textknopf mit Zähler; /onboarding ohne G1-Rückweg, „Mehr“ nicht aktiv, Balken im Dunkeln (G13); „Vertrag widerrufen“ außerhalb der Spalte (G11); Links fett | Zahlen 24 Monate/100 Plätze = Prüf-Seed (U); R/Q1/Q3/Q4; Figur 2 (G1-Variante) offen, 4 und 6 nicht herstellbar |
| kundenkonto | 275 | 4·4·4·4 | 4·4·4·4 | ja | Fußlinie am Handy 40 statt 10 px unter dem Knopf und randlos (G11); Abstände Kopf → h1 50 statt 33 px (1440) bzw. 39 statt 29 px (390); Figur 4 bei 1440 in der Einblendung aufgenommen (nicht belegt) | G11, G9, G6, Q3, Liste C/R (Passwort-Auge, „Überall abmelden“, Code ohne Leerzeichen); Prüf-Seed U |
| meine-bestellungen | 275 | 3·3·3·3 | 4·4·4·4 | ja | Zeilen „Früher“ 57 statt 77 px; Kopf → h1 48 statt 32 px (1440) bzw. 39 statt 27 px (390) | Erg. (Seitenfuß 390); G4; Prüf-Seed U; Figur 5 (Ladefehler) nicht aufgenommen – die Kopie war mit dem Admin-Fotografen geteilt |
| heute | 277 | 4·4·4·4 | 4·4·4·4 | ja | Abstand Hinweis → Karte 32–37 statt 12–14 px; Satz Online-Zahlung (Board an den Code angleichen, Antwort A 1); Chip „Abholung heute“ fehlt; Unterleisten-Symbole (Z. 279 B); „PACKLISTE FÜR HEUTE“ (Z. 307 B) | Z. 290, 293, 295, 300, 302, 305, 311/Q1, 314, 57, 1106; Figur 3 nicht prüfbar (Z. 294 U) |
| bestellungen | 277 | 4·4·4·4 | 4·4·4·4 | ja | Abstände nach Kopf/Hinweis 32–44 statt 12–15 px; Unterleisten-Symbole (Z. 279 B) | Z. 273/Q4, 281/G8, G3, G4, G14, R N9, Q1, Q3; Figur 2 nicht herstellbar |
| bestellung | 277 | 4·4·4·4 | 4·4·4·4 | ja | Figur 3 (Fenster-Bild, Deckkraft 1): Hauptknopf 43 statt 52 px bzw. Pille, Kästchen 21 statt 26 px; „Anrufen“ als Pille (G8); Posten ohne, Gesamt mit Gebühr – Summe geht sichtbar nicht auf | Liste Z. 238 ff. C/U, Z. 252, 253, 258/Q1, 259; G14; R N9 |
| druck | 277 | 4·4 | 3·3 | ja | „Gesamt inkl. Plattformgebühr.“ statt „Preise inkl. …“ (Liste druck B; Antwort B 4 → Board-Korrektur); Zeile unter jedem Betrag der Packliste (B); Schrift des Abholzettels kleiner; Posten/Gesamt wie bestellung | U (Leiste „Zurück/Drucken“), G14, R N9 |
| produkte | 277 | 3·3·4·4 | 3·3·3·3 | ja | Postfach-Zähler an „Mehr“ (Z. 370 B); Hinweis über Kopf und Reitern (Z. 365/367 B, G3); Zeilen höher, „Braucht dich“ in Warnfarbe (Z. 364 B); Vorrat-Blatt (Fenster-Bild): „Speichern“ 43 statt 49 px, Vorrat-Feld ohne verbundene Beschriftung | Z. 357, 360, 361, 363, 366, 369/Q4, 377/Q1, 379; Erg. Z. 18 |
| produkt-neu | 277 | 3·3·3·3 | 2·2·2·2 | ja | Figur 2: Verkaufsgrößen als Bearbeitungsblöcke (Z. 337, 342 B), Vorrat ohne Pille (G13); alle Figuren: Seite hinter dem Dialog verwischt statt abgedunkelt, Felder und Knöpfe niedriger, Dialog 512/760 statt 680 px, Vorrat-Felder ohne Beschriftung (66 in 18 Bildern); Fehlerkasten klebt an der Karte; Figur 6 ohne „Nochmal“ (G6) | Z. 351, 322, 325, 329, 330, 335, 340, 344, 346, Q3; erfüllt laut unteren Fenster-Bildern: Z. 321, 324, 326, 328, 331, 332, 334, 336, 345, 347 |
| auswertung | 273 | 3·3·3·3 | 3·3·3·3 | ja | Ladefehler-Karte getönt, Titel orange (G6); Vergleichszeile; Grenze-Karte (Serif-Titel, „55 000“); Zeitraum-Pfeil am Titel; leeres Diagramm; 1440 Inhalt 820 statt 896 px | Liste C, Erg., G4, Q1, Q4, U |
| kunden | 273 | 3·3·3·3 | 3·3·3·3 | ja | Ladefehler-Karte getönt (G6); Sortieren-Vorauswahl; Liste 1440 (Zeilen 53 statt 61 px, Schrift 13 statt 15 px, Spalte „Status“); Name 30 statt 24 px | wie auswertung |
| postfach | 274 | 3·3·4·4 | 3·3·3·3 | ja | Ladefehler-Karte getönt (G6); Team-Blase mit Rand und Absenderzeile; zweite Überschrift „Nachricht“ bei 1440; Uhrzeit „02:02“; Absender-Quadrat mit Symbol | wie auswertung; Figur 3 nicht aufgenommen |
| mein-hof | 274 | 3·3·2·2 | 3·3·2·2 | ja | „Aktuell vom Hof“ am Web oben (Z. 549 B); Kundenansicht ohne Gründungshof-Marke/„Nächste Abholung“ (Z. 557 B); Kopfzeile der Kundenansicht (Z. 558 B gegen Q2 – Entscheidung); Unterleiste gedämpft (Z. 559 B); Radius 23 statt 12 px; Figur 3 (Fenster-Bild) 4·4 | Q2; Figur 4 nicht herstellbar (würde pausieren) |
| meldungen | 268 | 3·3·3·3 | 4·4·3·3 | ja | Rücklink-Wort gegen Erg. Z. 22, fehlt auf Figur 5 und 6 (Z. 576 B); „Alle ansehen“ (Z. 589 B); Einleitungssatz über dem Fehlerkasten (B); Fehlerkarte orange; Spalten 1440 | Z. 574, 580, 586/G4, 591, Q1; Figuren 3, 4 nicht herstellbar |
| problem-melden | 268 | 2·2·2·2 | 4·3·4·3 | ja | dunkel: Auswahlpunkt Ring statt gefüllt (Z. 640 offen); Textfeld 118 statt 88 px mit Ziehgriff; Figur 4 ohne „(Hof Müller)“ | G6/Z. 630, 633, 634/Q2, 643, 627/Q3; Erg. Z. 7 |
| mehr-neu | 267 | 5·5·5·5 | 4·4·4·4 | ja | Zeilenhöhen 60 statt 76 bzw. 57 statt 73 px; „Schließen“ 7 px versetzt; Fokusrahmen Menü 1440 nicht belegt (Z. 53–64) | Figur 2 nur 390 |
| hofdaten-zahlung | 278 | 3·3·3·3 | 4·4·4·4 | ja | Feldraster 92 statt 83 px; Zahlungskarten-Innenabstand, Marken mit Rand; Hinweiskasten-Farbe; „Shop“ statt „Hofseite“ | Figuren 3 (würde speichern) und 5 (Hof nicht im Seed) nicht herstellbar |
| konto-hof | 278 | 3·3·3·3 | 4·4·4·4 | ja | Fehlerrand 1 statt 2 px ohne Fokusring (G6); Regelliste 12 statt 14 px; Gerätezeilen 61 statt 77 px; Feldraster; Figur 6 Einleitung und Abstände | R N48 (Hof-E-Mail); Q1, Q4, Regel 6 |
| teilen | 278 | – | 4·4·4·4 | ja | nur Figur 2 bewertbar: Leer-Karte 222 statt 200 px, Trennstrich 1440 | Figuren 1 und 3 nicht herstellbar (Teilen-Ziel des Handys) |
| whatsapp-plakat | 278 | 3·3·3·3 | 4·4·4·4 | ja | QR-Code 124 statt 182 px (1440) bzw. 106 statt 132 (390); Zeilenhöhe 64 statt 80; Fußzeile der Vorschau (Z. 737, bestätigen) | Figur 2 nicht herstellbar (Beitrags-Id) |
| beitraege | 278 | 3·3·3·3 | 4·4·4·4 | ja | Fehlerrand/Fokusring (G6); Empfänger-Karten 66 statt 86 px; erledigter Schritt im Dunkeln hell | Prüfdaten leer (U) |
| einstellungen | 278 | 3·3·3·3 | 4·4·4·4 | ja | nur die Ladefehler-Karte (Figur 2): getönt, orange, „Neu laden“ 114 px breit, kein Fokus | – |
| abmelden | 279 | 4·4·4·4 | 3·3·3·3 | ja | Hofname vor dem Klick fehlt (Z. 760; die Seite prüft den Link erst bei „Ja, abmelden“ – Frage); Unterleiste (Z. 757 B, G10); Knopf 50 statt 52 px; Figur 3 (neu) für sich 4·5·4·5 | Q2 Z. 754/1077, G11, Q3 Z. 759 |
| neuigkeiten | 279 | 3·3·3·3 | 4·4·3·3 | ja | Pfeil im Rück-Link (Z. 827 offen); Zweitknopf/Hinweis Bild 4; Hofname 15 statt 16 px | – |
| rechtstexte | 279 | 4·4·4·4 | 4·4·4·4 | ja | Abstand vor Abschnittsüberschriften 44 statt 24 px; Datenschutz-Fließtext gedämpft; Impressum ohne Kicker; Konditionen-Link nicht fett; Mail-Link 118 × 18 px; Figur 5 Kartenabstand 32 statt 10 px, „€ 456“ ohne geschütztes Leerzeichen | Z. 847, 850, 851/Q2, 853, 855, 862 R; 3.1 Z. 1115; Erg. Z. 16; G11 |
| systemseiten | 279 | 5·5·4·4 | 4·4·5·5 | ja | Figur 5: Fußlinie am Handy 41 statt 13 px unter der Karte und randlos (G11) | R „24 Stunden“; Figuren 1–4 nicht herstellbar: gültige Token nur aus Mails, die der dev-Server nicht mit Link protokolliert, und der Prüf-Seed erzeugt keinen Link „sicherheit-nicht-ich“ |
| widerruf | 279 | 3·3·3·3 | 3·3·3·3 | ja | Feld „Deine E-Mail-Adresse“ und „Eingangsbestätigung an …“ fehlen (Frage (a), mit P1 an die Anwältin); Auswahlkarten 52 statt 70 px; „anrufen“ als Pille; dunkel Auswahlpunkt Ring | Z. 909–911, 913, 914, 916/Q2, 920, 921; Erg. Z. 24; Antwort B 1 (a)(b) nicht in diesem Lauf |
| fehlerseiten | 279 | 3·3·3·3 | 3·3·3·3 | ja | „Zum Hof“ statt „Zu Hof Müller“ (Z. 789 B); Zweitknopf-Rand hellgrau (Z. 788 B); 390 Abstand Kopf → Symbol 71 statt 37 px | Z. 786/Q2, 794, 795; Erg. Z. 23; Figuren 5 und 6 nicht herstellbar (Sitzungsprüfung fällt bei gesperrter DB zuerst) |
| mail-betrieb | 270/280 | nicht prüfbar | 3·3 | ja | Speicher-Warnung ohne Messzeit/Warnstufe (Z. 943 B), größte Tabelle fehlt (Z. 944 B); Abstand Bild 2 | Z. 941, 942, 946 C; G14; Q5 |
| mail-hof-bestellung | 270/280 | 3·3 | 4·4 (5·5 ohne h1-Messpunkt) | ja | sichtbar nichts offen; keine h1 im Mail-HTML | Z. 957/989 C, 958 U/N38, 960 C, 965 R, 964/Q5; § 18 FAGG, Einleitung ohne Namen bewusst nicht gebaut |
| mail-hof-konto | 270/280 | nicht prüfbar | 3·3 | ja | Warnkasten 14 Tage (Z. 972 B), Betrag (Z. 973 B), Anrede/Absätze (Z. 974 B) – Texte in konditionen.ts, außerhalb der Grenze von 280; Link „Ansehen“ 60 × 17 px | Z. 976 R, 977/Q5; Figur 1 Gründungskasten nicht belegbar (Prüfhof ohne Gründungsplatz) |
| mail-kauf | 270/280 | 3·3 | 4·4 | ja | „09:00–12:00 Uhr“ statt „9:00–12:00 Uhr“ (V9); Fußlinks 15 px hoch | Z. 986, 987, 992 R; 989 C; 991/Q5; Gewährleistungs-Grafik lädt ohne Netz nicht (U); Betrag in Bild 6 aus dem Testfall (U) |
| mail-storno | 270 | 3·3 | 4·4 | ja | Eingangszeitpunkt nicht nach V9 (Z. 1035 B, Recht); Wochentag ausgeschrieben | P1-Sätze bewusst nicht gebaut |
| mail-neuigkeiten | 270/280 | nicht prüfbar | 4·4 | ja | Absatz „Mehrere Kundinnen …“ in Grundschrift statt Nebenschrift (Z. 1003 B); Fußlink 127 × 15 px | Z. 998 R, 999 C, 1001 R, 1002 R, 1005/Q5 |
| mail-sicherheit | 270/280 | nicht prüfbar | 4·4 | ja | neue Adresse nicht genannt (Z. 1022 B; Sicherheitsabwägung der Vorlage); „Für dein Konto“ (Z. 1013); Abstand unter „Gerät“ 16 statt 10 px (Z. 1023) | Z. 1012, 1014, 1016 C; Z. 1019 Entscheidung offen (Board-Satz stimmt nicht für Hof- und Admin-Konten); Z. 1021 C |
| mail-team | 270/280 | nicht prüfbar | 3·3 | ja | Anrede ohne Namen (Z. 1053 B), Code ungegliedert (Z. 1054 B), einladende Person fehlt (Z. 1047, 1051 B), Testmail-Text (Z. 1044/1045 B) – Daten bzw. Texte außerhalb der Grenze von 280 | Z. 1048, 1049, 1052 C; Z. 1043 Knopf: Entscheidung offen (Grundsatz „keine Sicherheitsmail mit Link zum Anmelden“) |
| mail-zugang | 270/280 | nicht prüfbar | 4·4 | ja | „Hallo, … dein Konto“ statt „Hallo <Name>, … dein Hof-Konto“ (Z. 1063 B; braucht src/lib/auth.ts) | Z. 1064 R, 1065/Q5 |

Mails: Bewertet am echten Mail-HTML (DM, alle 46 Figuren; mail-storno erstmals aufgenommen). Die Admin-Vorschau entschärft absichtlich jeden Link (`entschaerfeLinks`, src/lib/betrieb-mails.ts, N27) und zeigt Knöpfe deshalb als Text bzw. „[Link]“ – das war der Befund „Q-A“ der ersten Mail-Bewertung (M1, M2) und ist kein Mangel der Mail. Die Mails haben keine h1 (axe moderate „page-has-heading-one“); M3 hat dafür je einen Stern abgezogen, M4 nicht – Frage, ob der h1-Messpunkt für Mails gilt.

**Nicht prüfbar je Bild (Grund):** wie in der Tabelle. Die Dialoge der ersten Aufnahme (bestellung 3, produkte 2, verkaeufe 2, produkt-neu 1–5) waren mitten in der Einblendung aufgenommen (die Ganzseiten-Aufnahme startet die Einblendung neu); die Nachaufnahme als Fenster-Bild zeigt sie mit Deckkraft 1 – kein Mangel der App.

### Admin (zählt nicht zum 5-Sterne-Kriterium; voller Vergleich mit dem Board)

Aufgenommen am dev-Server mit Prüf-Passkey (DA, 41 von 72 Figuren, 182 Bilder; nicht herstellbare Figuren je Board in der INDEX.md). Die Liste lauf32-board-oder-code.md hat keine Admin-Zeilen (Z. 1166); deshalb gilt jede sichtbare Abweichung als Mangel. Lauf 32 hat Admin nur nach den sechs Messpunkten gewertet; die Sterne sind daher nicht direkt vergleichbar.

| Board | Schluss Lauf 32 | Schluss-Durchgang 33 | Hauptmängel |
|---|---|---|---|
| admin-heute | 3·3·3·3 | 3·3·3·3 | Handy ohne Werkzeug-Kopf; Inhalt 1376 statt 1100 px; Kacheln; Notbremse-Dialog (Auswahlliste, Datumsformat, Knopfpaar) |
| admin-shell | 3·3·3·3 | 3·3·3·3 | Hinweiskasten „Testbetrieb“ fehlt; „Konto und Sicherheit“ im Mehr-Blatt fehlt; Unterleiste unter dem Blatt |
| admin-hoefe | 3·3·3·3 | 3·3·3·3 | Handy-Karten 250 statt 105 px; Tabelle 1440 (Breite, Spalten, Pillen) |
| admin-akte | 3·3·3·3 | 2·2·2·2 | Karten-Reihenfolge, Raster; Kontrollkästchen in Browser-Blau; Konto-schließen-Dialog anders, Startfokus im Feld statt auf „Abbrechen“ |
| admin-freischalten | 4·4·4·4 | 2·2·3·3 | Startfokus am Handy auf der zerstörenden Aktion („Ablehnen“, „Freigabe zurücknehmen“); Dialogknöpfe; Figuren 1, 2 nicht herstellbar |
| admin-bestellungen | 3·3·3·3 | 2·2·2·2 | Filter als Formular statt Chips; Betrag fehlt in der Liste; Notfall-Storno ohne „Satz für die Kundin“, Startfokus im Feld |
| admin-postfach | 3·3·3·3 | 2·2·2·2 | Ansichten Meldungen/Wünsche/Rundschreiben anders aufgebaut; „GesammeltAbgelegt“ ohne Abstand (390 dunkel) |
| admin-startseite | 3·3·3·3 | 2·2·2·2 | Reiter als Segment; Block-Editor am Handy nicht im Bild; Vorschau-Schrift sichtbar unter 12 px |
| admin-geld | 3·3·3·3 | 2·2·3·3 | Jahrestabelle 390 rechts abgeschnitten; Ausreißer-Beschriftung rechts abgeschnitten; Diagramm-Beschriftung ohne „…“; „Abrechnungszeitrau[m]“; Kostenposten-Dialog läuft bei 1440 aus dem Fenster |
| admin-betrieb | 3·3·3·3 | 2·2·2·2 | „Bestellbestätigung“ stößt an den Knopf; Mail-Suche 83 px breit; Kachel „Hofliste“ allein in der Reihe |
| admin-einstellungen | 4·4·4·4 | 3·3·3·3 | „Hofpreis-Modell ab“ als Karte statt Gruppe; axe heading-order (h3 ohne h2) |
| admin-zugang | 4·4·4·4 | 3·3·3·3 | Satz „Du willst laden: …“ fehlt; Spalte mittig |

Punkte aus Nr. 281: Ausreißer-Beschriftung der Jahresansicht am Handy lesbar, aber rechts abgeschnitten; abgeschnittene Diagramm-Beschriftung in 12 px, ohne Auslassungszeichen; StandBand der Meldungen passt ins 5-Spalten-Raster. Messung Admin: Schrift < 12 px, Ziele < 44 px, Felder ohne Beschriftung, axe serious/critical überall 0.

### Messung (Kunden- und Hof-Boards)

Schrift < 12 px: 0 auf allen Boards. Ziele < 44 px: im Ruhezustand 0 (die früheren Werte bei bestellung und verkaeufe stammten aus Dialogen in der Einblendung); rechtstexte 4 je AGB-Bild (Mail-Link im Fließtext, 118 × 18 px). Felder ohne Beschriftung: produkt 4 (Mengenfeld der Kauf-Leiste), produkte und produkt-neu (Vorrat-Felder der Verkaufsgrößen). h1 = 1 außer „Dialog offen“. axe: produkt 2 × color-contrast serious (hell), druck je Bild landmark-one-main + region (mittel), rechtstexte heading-order (mittel), sonst 0.

### Mängel – gemeinsame Ursachen

- Karten-Baustein „gewählter Hof“ (region, hoefe): Sprechblase/Popup statt Auswahlfeld mit „Schließen“, „Du“-Marke, Zoom-Knöpfe.
- Ladefehler-Karte (G6) getönt bzw. orange statt neutral (auswertung, kunden, postfach, einstellungen, verkaeufe, meldungen, region).
- Rundungen G8 (Karten 22–24 statt 12 px, Aktionsknöpfe als Pille) und Knöpfe in Dialogen 42–46 statt 48–52 px.
- Abstände nach Kopf und Hinweis-Kasten (G3) 32–44 statt 12–15 px; Zeilen- und Feldhöhen größer als das Board.
- Vorrat-Felder ohne verbundene Beschriftung (produkte, produkt-neu) und Mengenfeld der Kauf-Leiste (produkt).
- Auswahlpunkt im Dunkeln als Ring (problem-melden, widerruf); Schleier uneinheitlich (produkt-neu und „Verkauf eintragen“ verwischt, sonst abgedunkelt).
- Illustration im Dunkeln ohne Rand (hoefe, hofseite; §37.1 15.5.3 gegen Erg. Z. 18).
- Posten ohne, Gesamt mit Gebühr (bestellung, druck) – Summe geht sichtbar nicht auf.
- Admin: kein Werkzeug-Kopf am Handy, Inhalt im Web 1330–1376 statt 1100 px, Startfokus in Dialogen.

**Ziel erreicht (5 Sterne):** nein – kein Kunden- oder Hof-Board mit 5 Sternen in allen Fassungen; mail-hof-bestellung erreicht 5·5 nur ohne den h1-Messpunkt (Frage). **Ordnungsgemäß beendet:** ja, nach dem Nachholen am 10.11. (alle 49 Boards und 12 Admin-Boards aufgenommen und bewertet, nicht herstellbare Figuren je Bild begründet; Aufräumen bestätigt im Morgenbericht).
