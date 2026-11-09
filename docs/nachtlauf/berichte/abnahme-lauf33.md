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
