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

Stand: Block 1 ist auf a47c2115c33c gebaut (alle Nummern von A und B, dazu 282, 262c, 278, 281; ohne 26.1 und 280). Der Sammelstand `integration/lauf33` d1690d0d9ab3 unterscheidet sich davon unter src/ nur durch 26.1 (Kommentare, gelöschter alter Kopf ohne Aufrufer; `git diff --name-only a47c2115c33c..d1690d0d9ab3 -- src`: 9 Dateien, kein sichtbarer Unterschied). Prüf-DBs auf localhost: `pruef33c` (Prüf-Seed, Stichtag Vergangenheit, alle Optionen aus 262) und `pruef33cg` (zusätzlich `--gruendung-fest`). start-Fotografen k (Port 3201) und h (Port 3202) mit eigener `.next`-Kopie, eigener Kopie der DB und eigenem Prüf-Browser je Fotograf (K1, K2, H1, H2, SK, SK2, SH). Ladefehler-Kästen über `tabelle-aus` (262c), Serverfehler über `db-aus`. Bewertet hat pruefer-ui (P1–P8, M1; frischer Kontext, nur Bilder, Abnahme-Grundlage samt Ergänzungsliste und §37.1; höchstens vier gleichzeitig). Bilder im Container unter `.nachtlauf/screens/schluss/<board>/` (App, INDEX.md, Messung), Mail-Bilder von Nr. 280 unter `.nachtlauf/screens/280/r1/`, nicht committet.

**Abgebrochen:** Die Sitzung war von etwa 22:05 bis 07:29 UTC unterbrochen (Neustart des Containers). Nicht mehr gelaufen: Block 2 (dev-Fotograf für Admin, Mail-Codes, systemseiten-Token), Fotograf SG (registrieren, rechtstexte Figur 5 gegen `pruef33cg`), Fenster-Bilder der Dialoge (SD), die Bewertung von auswertung, kunden, postfach, einstellungen (Bilder liegen vor) und die Nachwertungen nach SK2/SH. Diese Boards stehen unten als „nicht bewertet“ bzw. „nicht aufgenommen“ mit Grund.

### Ergebnis (schlechtestes Bild je Fassung: 390 hell · 390 dunkel · 1440 hell · 1440 dunkel; Mails 390 · 600 hell, Druck nur hell)

| Board | Nr. | Schluss Lauf 32 | Schluss-Durchgang 33 | Nummer abgeschlossen | Mängel (Rest gedeckt) | gedeckt durch Liste/Ergänzung/3.2/Auftrag |
|---|---|---|---|---|---|---|
| startseite | 271 | 3·3·3·3 | 4·4·3·3 | ja | 1440 Kopf 675 statt 370 px, h1 dreizeilig, Abschnittsabstände (Z. 128 B); Regionskarte größer, Pins ohne Schild (Z. 114 B); Standort-Link weiß (Z. 118 B); Zusatzzeile Gründungsplätze; G8, G11 | Erg. Z. 16 (Zahl); Kartenkacheln ohne Netz; Figur 5 nicht herstellbar (keine Höfe) |
| hoefe | 271 | 2·2·3·3 | 2·2·2·2 | ja | Figur 5 (Hof gewählt): 390 Sprechblase statt Auswahlfeld, „Schließen“ fehlt, „Zum Hof“ 34 statt 52 px; 1440 ohne Auswahlfeld (Aufnahme oder App, nicht getrennt); Bildfläche 150 statt 96 px, im Dunkeln ohne Rand (§37.1 15.5.3); Pins ohne Schild (Z. 80 B); G8 | Z. 71–73, 77–79, 96, 98, 100; Erg. Z. 10, 18; Q2; Figuren 3, 4 nicht herstellbar (Ortssuche braucht Netz) |
| hofseite | 271 | 3·3·4·4 | 3·3·4·3 | ja | Reihenfolge der Abschnitte am Handy; Karte mit zweizeiligem Namen (Z. 141 B); 1440 dunkel helles Quadrat ohne Rand (§37.1 15.5.3); „€ … / m³“ neben „/ rm“; G8 | Z. 135/Q2, 139, 142–144; Figur 4 nicht herstellbar (kein pausierter Hof) |
| produkt | 271 | 2·2·3·2 | 3·4·3·4 | ja | Kontrast 4,41:1 der gewählten Größenkachel (axe serious, hell); Mengenfeld der Kauf-Leiste ohne verbundene Beschriftung; Ausverkauft-Satz (Z. 164 B), Raummeter-Satz (Z. 163 B), Merkmal-Kacheln (Z. 161 B), Marke „Ausverkauft“ (Z. 171 B), „Gleich mit abholen“ (Z. 162 B); G8, G11 | Z. 153 P1, 155, 157–159, 167/Q2, 169, 170; Erg. Z. 18 |
| region | 272 | 2·2·2·2 | 2·2·2·2 | ja | Hofzeilen 44 statt 24 px, Umbruch (Z. 653); gewählter Hof ohne „Schließen“, „Du“ abgeschnitten (Z. 650, 671); Größen als eigene Karten, Knopf (Z. 663); Fehlerkasten rötlich (Z. 667); Leerzustand-Text (Z. 668) | Z. 652, 657–659, 664, 672/Q1, 674; Regel 6; Q4; Erg. Z. 18 |
| kasse | 276 | 4·4·4·4 | 4·4·4·4 | ja | Figur 5 Mindestbestellwert: „ab“ zusätzlich, Klammer „(mit Gebühr …)“ fehlt (Entscheidung, Geld); Figur 3 mit gewähltem Termin neu aufgenommen (SK2), nicht nachbewertet | Antwort 5 (Code bleibt, Board korrigieren); Figur 4 nicht herstellbar (Zahlungsdienst Platzhalter, Liste Z. 206) |
| korb | 276 | 3·3·5·5 | 4·4·4·4 | ja | Mengenwähler 121 statt 133 px, Positionszeile 120 statt 131; dunkel Rahmen des Mengenwählers 2,6:1 (Kontrast) | G14; Erg. |
| bestaetigung | 276 | 4·4·4·4 | 4·4·4·4 | ja | h1-Zeilenabstand, Abhol-Karte 211 statt 193 px, 1440 Inhalt 41 statt 25 px unter dem Kopf | Erg. Z. 9 (Plattformgebühr-Satz sinngemäß) |
| bestellung-link | 276 | 4·4·4·4 | 3·3·3·3 | ja | gewertet auf Figur 1 mit Marke „Bestätigt“ (Prüf-Seed TP-HP-ONLINE CONFIRMED); Neuaufnahme mit PAID („Bezahlt“) liegt vor, nicht nachbewertet; Zahlzeile „(6 %)“ nicht gedämpft; Bar-Bild „Bestätigung offen“ | Antwort 6 (Code bleibt, Board korrigieren); Erg. Z. 21 |
| anmelden | 275 | 4·4·4·4 | 3·3·3·3 | ja | Unterleiste „Warenkorb“ (Z. 773 B, G10); Maße 1440, Kartentitel größer, Abstände 390, Rand Zweitknopf | Q2 |
| passwort | 275 | 4·4·4·4 | 4·4·3·3 | ja | „Vertrag widerrufen“ im Fuß ohne deckende Zeile (Entscheidung); Pfeil im Rück-Link; Abstände; Rand Bild 5 | – |
| registrieren | 275 | 3·3·3·3 | nicht aufgenommen | ja | – | Fotograf SG gegen `pruef33cg` fiel mit der Unterbrechung aus |
| kundenkonto | 275 | 4·4·4·4 | nicht bewertet | ja | – | 2 von 5 Figuren aufgenommen (K2), Rest braucht den Mail-Code (dev-Fotograf, Block 2 ausgefallen) |
| meine-bestellungen | 275 | 3·3·3·3 | nicht bewertet | ja | – | 2 von 6 Figuren (K2), Rest wie kundenkonto |
| heute | 277 | 4·4·4·4 | 4·4·4·4 | ja | Abstand Hinweis → Karte 32–37 statt 12–14 px; Satz Online-Zahlung (Board an den Code angleichen, Antwort A 1); Chip „Abholung heute“ fehlt (Prüfdaten?); Unterleisten-Symbole (Z. 279 B); „PACKLISTE FÜR HEUTE“ (Z. 307 B) | Z. 290, 293, 295, 300, 302, 305, 311/Q1, 314, 57, 1106; Figur 3 nicht prüfbar (Z. 294 U) |
| bestellungen | 277 | 4·4·4·4 | 4·4·4·4 | ja | Abstände nach Kopf/Hinweis 32–44 statt 12–15 px; Unterleisten-Symbole (Z. 279 B) | Z. 273/Q4, 281/G8, G3, G4, G14, R N9, Q1, Q3; Figur 2 nicht herstellbar (U) |
| bestellung | 277 | 4·4·4·4 | 4·4·3·3 | ja | 1440 nur wegen Figur 3 (Dialog in der Einblendung aufgenommen, Fenster-Bild nicht mehr gelaufen); „Anrufen“ als Pille (G8); Posten ohne, Gesamt mit Gebühr – Summe geht sichtbar nicht auf (Geld, Darstellung) | Liste Z. 238 ff. C/U, Z. 258/Q1, G14, R N9 |
| druck | 277 | 4·4 | 3·3 | ja | „Gesamt inkl. Plattformgebühr.“ statt „Preise inkl. …“ (Liste druck B; Antwort 4 aus B → Board-Korrektur); Zeile unter jedem Betrag der Packliste (B); Schrift des Abholzettels kleiner; Posten/Gesamt wie bestellung | U (Leiste „Zurück/Drucken“), G14, R N9 |
| produkte | 277 | 3·3·4·4 | 3·3·3·3 | ja | Postfach-Zähler an „Mehr“ (Z. 370 B); Hinweis über Kopf und Reitern (Z. 365/367 B, G3); Zeilen höher, „Braucht dich“ in Warnfarbe (Z. 364 B); Vorrat-Feld ohne verbundene Beschriftung; Figur 2 bei 1440 im Übergang (nicht belegt) | Z. 357, 360, 361, 363, 366, 369/Q4, 377/Q1, 379; Erg. Z. 18 |
| produkt-neu | 277 | 3·3·3·3 | 2·2·2·2 | ja | Verkaufsgrößen als aufgeklappte Blöcke (Z. 337, 342 B), Vorrat ohne Pille (G13), 44 Vorrat-Felder ohne verbundene Beschriftung; Fehlerkasten ohne Abstand; System-Auswahl bei Brennmaterial; Seite verwischt statt abgedunkelt; Dialogmaße in der Einblendung (nicht belegt) | Z. 351, 322, 325, 329, 330, 335, 340, 344, 346, Q3; Figur 6 neu aufgenommen (SH), nicht bewertet |
| verkaeufe | 272 | 2·2·2·2 | 3·3·3·3 | ja | Link zu den Stripe-Auszahlungen fehlt (Z. 706 B); „2 × …“ statt „2× …“ (Z. 707 B); Chips 36 statt 44 px; Hinweis schaut unter dem festen Knopf hervor; Figur 2 bei 1440 im Übergang | Z. 708, 713, 721/Q4, 724/Q1; Figuren 3 und 6 neu aufgenommen (SH), nicht bewertet; Figur 4 nicht herstellbar |
| auswertung | 273 | 3·3·3·3 | nicht bewertet | ja | – | Bilder samt Ladefehler-Figur 5 (`tabelle-aus ManualSale`) liegen vor; pruefer-ui P9 lief nicht mehr |
| kunden | 273 | 3·3·3·3 | nicht bewertet | ja | – | wie auswertung (Figur 6 über `tabelle-aus CustomerFarmSubscription`) |
| postfach | 274 | 3·3·4·4 | nicht bewertet | ja | – | wie auswertung (Figur 6 über `tabelle-aus Rundschreiben`) |
| mein-hof | 274 | 3·3·2·2 | 3·3·2·2 | ja | „Aktuell vom Hof“ am Web oben (Z. 549 B); Kundenansicht ohne Gründungshof-Marke/„Nächste Abholung“ (Z. 557 B); Kopfzeile der Kundenansicht (Z. 558 B gegen Q2 – Entscheidung); Unterleiste gedämpft (Z. 559 B); Radius 23 statt 12 px; Figur 3 bei 1440 neu aufgenommen (SH), nicht nachbewertet | Q2; Figur 4 nicht herstellbar (würde pausieren) |
| meldungen | 268 | 3·3·3·3 | 4·4·3·3 | ja | Rücklink-Wort auf /problem-melden gegen Erg. Z. 22, fehlt auf Figur 5 (Z. 576 B); „Alle ansehen“ (Z. 589 B); Spalten 1440 schmaler; „E-Mail schreiben“ als Pille (G8) | Z. 574, 580, 586/G4, 591, Q1; Figuren 3, 4 nicht herstellbar; Figur 6 neu aufgenommen, nicht bewertet |
| problem-melden | 268 | 2·2·2·2 | 4·3·4·3 | ja | dunkel: Auswahlpunkt Ring statt gefüllt (Z. 640 offen); Textfeld 118 statt 88 px mit Ziehgriff; Figur 4 ohne „(Hof Müller)“ | G6/Z. 630, 633, 634/Q2, 643, 627/Q3; Erg. Z. 7; Figuren 2, 4 leere Felder U |
| mehr-neu | 267 | 5·5·5·5 | 4·4·4·4 | ja | Zeilenhöhen 60 statt 76 bzw. 57 statt 73 px; „Schließen“ 7 px versetzt; Fokusrahmen Menü 1440 nicht belegt (Z. 53–64) | Figur 2 nur 390 |
| hofdaten-zahlung | 278 | 3·3·3·3 | 4·4·4·4 | ja | Feldraster 92 statt 83 px; Zahlungskarten-Innenabstand, Marken mit Rand; Hinweiskasten-Farbe; „Shop“ statt „Hofseite“ | Figuren 3 (würde speichern) und 5 (Hof nicht im Seed) nicht herstellbar |
| konto-hof | 278 | 3·3·3·3 | 4·4·4·4 | ja | Fehlerrand 1 statt 2 px ohne Fokusring (G6); Regelliste 12 statt 14 px; Gerätezeilen 61 statt 77 px; Feldraster | Figur 6 (`db-aus`) neu aufgenommen, nicht bewertet; R N48 (Hof-E-Mail) |
| teilen | 278 | – | 4·4·4·4 | ja | nur Figur 2 bewertbar: Leer-Karte 222 statt 200 px, Trennstrich 1440 | Figuren 1 und 3 nicht herstellbar (Teilen-Ziel des Handys im Prüf-Browser) |
| whatsapp-plakat | 278 | 3·3·3·3 | 4·4·4·4 | ja | QR-Code 124 statt 182 px (1440) bzw. 106 statt 132 (390); Zeilenhöhe 64 statt 80; Fußzeile der Vorschau (Z. 737, bestätigen) | Figur 2 nicht herstellbar (Beitrags-Id) |
| beitraege | 278 | 3·3·3·3 | 4·4·4·4 | ja | Fehlerrand/Fokusring (G6); Empfänger-Karten 66 statt 86 px; erledigter Schritt im Dunkeln hell | Prüfdaten leer (U) |
| einstellungen | 278 | 3·3·3·3 | nicht bewertet | ja | – | Figur 2 (Ladefehler über `tabelle-aus PickupSlot`) aufgenommen (SH), pruefer-ui lief nicht mehr |
| abmelden | 279 | 4·4·4·4 | 3·3·3·3 | ja | Hofname vor dem Klick fehlt (Z. 760; Seite prüft den Link erst bei „Ja, abmelden“ – Frage); Unterleiste (Z. 757 B, G10); Knopf 50 statt 52 px. Figur 3 neu aufgenommen und für sich 4·5·4·5 (P8); Gesamt vom Dirigenten aus P1 ohne die falsch aufgenommene Figur 3 abgeleitet | Q2 Z. 754/1077, G11, Q3 Z. 759 |
| neuigkeiten | 279 | 3·3·3·3 | 4·4·3·3 | ja | Pfeil im Rück-Link (Z. 827 offen); Zweitknopf/Hinweis Bild 4; Hofname 15 statt 16 px | – |
| rechtstexte | 279 | 4·4·4·4 | nicht bewertet | ja | – | 5 von 6 Figuren aufgenommen (K2), Figur 5 braucht `pruef33cg` (SG ausgefallen); pruefer-ui lief nicht |
| systemseiten | 279 | 5·5·4·4 | nicht bewertet | ja | – | 1 von 5 Figuren; Rest braucht gültige Token (dev-Fotograf, Block 2 ausgefallen) |
| widerruf | 279 | 3·3·3·3 | 3·3·3·3 | ja | Feld „Deine E-Mail-Adresse“ und „Eingangsbestätigung an …“ fehlen (Frage (a), mit P1 an die Anwältin); Auswahlkarten 52 statt 70 px; „anrufen“ als Pille; dunkel Auswahlpunkt Ring | Z. 909–911, 913, 914, 916/Q2, 920, 921; Erg. Z. 24; Antwort 1 (a)(b) nicht in diesem Lauf |
| fehlerseiten | 279 | 3·3·3·3 | 3·3·3·3 | ja | „Zum Hof“ statt „Zu Hof Müller“ (Z. 789 B); Zweitknopf-Rand hellgrau (Z. 788 B); 390 Abstand Kopf → Symbol 71 statt 37 px | Z. 786/Q2, 794, 795; Erg. Z. 23; Figuren 5 und 6 nicht herstellbar (Sitzungsprüfung fällt bei gesperrter DB zuerst) |
| mail-betrieb | 270/280 | nicht prüfbar | 3·3 (Stand 280, Entwurf) | nein (280 Entwurf) | Messzeit/Warnstufe im Speicher-Kasten (Z. 943 B), größte Tabelle (Z. 944 B); Knöpfe als schlichter Text („Q-A“, siehe unten) | Z. 941, 942, 946 C; 3.2 G14; Q5 |
| mail-hof-bestellung | 270/280 | 3·3 | 4·4 (Stand 280) | nein | nur Q-A | Z. 958 U/N38, 960 C, 965 R, 964/Q5; Figur 4 nicht herstellbar |
| mail-hof-konto | 270/280 | nicht prüfbar | 3·3 (Stand 280) | nein | Gründungshof-Kasten (Z. 971 B), Anrede/Absätze (Z. 974 B), Warnkasten 14 Tage (Z. 972 B), Betrag (Z. 973 B) – teils außerhalb der Grenze von 280 | Z. 976 R, 977 U/Q5 |
| mail-kauf | 270/280 | 3·3 | 3·3 (Stand 280) | nein | Telefonnummer in der Kundenmail nicht fett; Q-A | Z. 986, 987, 992 R; Z. 991/Q5; Figuren 2, 5, 6 nicht herstellbar (Z. 985 nicht prüfbar) |
| mail-neuigkeiten, mail-sicherheit, mail-team, mail-zugang | 270/280 | nicht prüfbar | nicht bewertet | nein | – | Bilder von 280 liegen vor (`screens/280/r1/`), pruefer-ui M2 lief nicht mehr |
| mail-storno | 270 | 3·3 | nicht aufgenommen | – | – | keine Storno-Mail im Prüf-Seed |

**Q-A (Mails):** Auf allen 17 bewerteten Mail-Bildern stehen Knöpfe und Links als schlichter Text oder als „[Link]“. Ob die Admin-Vorschau Links entschärft (dann Aufnahme) oder die Mail so verschickt wird, ist nicht geklärt; die Sterne ohne Q-A: mail-betrieb 4·4, mail-hof-bestellung 5·5, mail-kauf 4·4. Die Mail-Bilder zeigen den Stand von Nr. 280 (Entwurf, nicht im Sammelstand); der Sammelstand trägt die Mails von Nr. 270.

**Nicht prüfbar je Bild (Grund):** wie in der Tabelle; dazu Dialoge bei 1440 (bestellung 3, produkte 2, verkaeufe 2, produkt-neu 1–5), die im Übergang aufgenommen sind (Deckkraft 0,35–0,58): Die Ganzseiten-Aufnahme ändert die Fenstergröße und startet die Einblendung neu; ein Fenster-Bild nach dem Übergang war vorbereitet, lief aber nicht mehr.

### Admin (zählt nicht zum 5-Sterne-Kriterium)

Nicht abgenommen: admin-heute, admin-shell, admin-hoefe, admin-akte, admin-freischalten, admin-bestellungen, admin-postfach, admin-startseite, admin-geld, admin-betrieb, admin-einstellungen, admin-zugang. Grund: Block 2 (dev-Fotograf mit Prüf-Passkey) fiel mit der Unterbrechung aus. Die Punkte aus 281 (Ausreißer-Beschriftung der Jahresansicht am Handy, `truncate` in 12 px im Finanzdiagramm, StandBand meldungen-teile im 5-Spalten-Raster) sind damit nicht im Bild geprüft. Schluss Lauf 32 bleibt der letzte Stand (3·3·3·3, freischalten/einstellungen/zugang 4·4·4·4).

### Messung (Kunden- und Hof-Boards)

Schrift < 12 px: 0 auf allen Boards. Ziele < 44 px: nur in Dialog-Bildern der Einblendung (bestellung 4, verkaeufe 9), bei 390 und im Ruhezustand 0; rechtstexte 4 je Bild (Mail-Link im Fließtext, 118 × 18 px, wie im Zwischen-Durchgang). Felder ohne Beschriftung: produkt 4 (Mengenfeld der Kauf-Leiste), produkte 4 und produkt-neu 44 (Vorrat-Felder der Verkaufsgrößen). h1 = 1 außer „Dialog offen“. axe: produkt 2 × color-contrast serious (hell), druck je Bild landmark-one-main + region (mittel), sonst 0.

### Mängel – gemeinsame Ursachen

- Karten-Baustein „gewählter Hof“ (region, hoefe): Sprechblase/Auswahlfeld ohne „Schließen“, „Du“-Marke, Zoom-Knöpfe.
- Rundungen G8 (Karten 22–24 statt 12 px, Aktionsknöpfe als Pille) auf den Finden-Boards, region, widerruf, meldungen, bestellung.
- Abstände nach Kopf und Hinweis-Kasten (G3) 32–44 statt 12–15 px (heute, bestellungen, produkte); Zeilen- und Feldhöhen größer als das Board (region, widerruf, problem-melden, Hof-Formulare).
- Vorrat-Felder ohne verbundene Beschriftung (produkte, produkt-neu) und Mengenfeld der Kauf-Leiste (produkt).
- Auswahlpunkt im Dunkeln als Ring (problem-melden, widerruf). Schleier uneinheitlich (verwischt gegen abgedunkelt).
- Illustration im Dunkeln ohne Rand (hoefe 390, hofseite 1440; §37.1 15.5.3 gegen Erg. Z. 18).
- Posten ohne, Gesamt mit Gebühr (bestellung, druck) – Summe geht sichtbar nicht auf.

**Ziel erreicht (5 Sterne):** nein – kein Board mit 5 Sternen in allen Fassungen. **Ordnungsgemäß beendet:** Schluss-Durchgang nur teilweise (Block 1 bewertet, Block 2 und Nachwertungen nach der Unterbrechung ausgefallen); Aufräumen bestätigt im Morgenbericht C.
