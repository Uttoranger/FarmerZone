# Lauf 32 · Board oder Code – Entscheidung je Mangel aus dem Schluss-Durchgang Lauf 31

Design-Gruppe, 06.11.2026. Grundlage: `docs/nachtlauf/berichte/abnahme-lauf31.md` ab Zeile 1986 (Schluss-Durchgang, 49 Boards), Morgenbericht Lauf 31, Register `docs/entscheidungen.md`, `docs/ai/DESIGN_SYSTEM.md` (DS), Vorgaben V1–V93. Stand main c8aadaed. Nur gelesen, nichts geändert.

## 1. Kopf

### Regeln, nach denen entschieden wurde
1. Recht, Datenschutz, Geld und Register gehen vor → R (oder C, wenn der Code eine Register-Regel umsetzt und das Board sie nicht kennt).
2. Fertige, nützliche Funktion bleibt → C. Bricht sie das Layout, dann B mit einer Lösung, die die Funktion behält.
3. Aufbau, Abstände, Größen, Farben, Köpfe, Leisten, Reihenfolge und wörtliche Texte → B. Ausnahme: Text durch Register oder Wortliste festgelegt → R.
4. Widerspricht sich ein Board, gilt die stimmigere Fassung (genannt).
5. Beispieldaten, nicht herstellbare Zustände, Aufnahme- und Umgebungsfehler → U.
6. Die Entscheidungen der Projektleitung aus dem Auftrag gelten als R (Video, Pflichtkarten, „Gepackt“, N25, Dialog, „Bar gesperrt“, Mein-Hof-Kopf, Balken, Packliste, Passwort-Auge, „Willkommen, Vorname“, „HM“, 24 Stunden, Bar-Mail an den Hof, „Dieselbe Bestellung nochmal“ entfällt, Leerzustände ohne Symbol, Bot-Bremse, „Höchstens zweimal“ entfällt, Geld-Kachel, Gewährleistungs-Grafik, „Ab Hof“ nicht bauen).

### Fünf Querschnitts-Regeln, die viele Zeilen auf einmal entscheiden
- **Q1 „Konto · Franz Müller“ (C).** Das Board widerspricht sich (w1-mehr-neu Bild 1/2 zeigt „Konto · Franz Müller“, die übrigen Boards „Konto“), DS „HofShell, Seitenleiste“ legt „Konto · <Name>“ fest. Gilt für alle Hof-Web-Boards.
- **Q2 „Anmelden“ im Handy-Kopf der Kundschaft (R).** Register N1: Öffentliche Seiten zeigen oben immer „Anmelden“, auch am Handy. Ausnahme, die wir neu festlegen (B): auf der Anmelde- und der Registrierseite selbst entfällt der Knopf.
- **Q3 Fokus (C, außer wo gar keiner da ist).** Die Form des Fokus ist `FOKUS_RAHMEN` (DS, getestet, WCAG); die eckigen Rahmen der Boards sind Zeichnung. Auf Seiten landet der erste Tab im Kopf (Rückweg), nicht im ersten Feld – das ist die richtige Tab-Reihenfolge. In Dialogen und nach Fehlern setzt der Code den Fokus gezielt (B, wo er fehlt).
- **Q4 „Startphase: kostenlos · bis 31. Jänner 2027“ in der Seitenleiste (U).** Register K1 gilt bis zum Tarifstart; die Prüfdaten stehen im November 2026, die Boards am 3. März 2027.
- **Q5 Ersatz-Serife in Mails (U).** Container ohne Webfonts (Morgenbericht).

### Zählung

| Entscheidung | Anzahl Zeilen |
|---|---|
| B (Board gilt, Code wird angeglichen) | 502 |
| C (Code gilt, Board wird korrigiert) | 115 |
| R (Register/Freigabe/Recht gilt) | 73 |
| U (Umgebung, Aufnahme, Beispieldaten) | 75 |
| P (Projektleitung) | 4 Zeilen in 2 Punkten (P1, P2) |
| **Summe** | **769** |

Eine Zeile fasst gleichartige Befunde über Fassungen und Bilder zusammen (z. B. „390 hell/dunkel“ eine Zeile). Viele B-Zeilen sind dieselbe Ursache auf vielen Boards; sie verschwinden mit den gemeinsamen Bausteinen G1–G14 (Abschnitt 3).

### Welche Boards voraussichtlich auf 5 kommen
- **Sofort mit Board-Korrektur, ohne Code:** kasse (nur noch C und R).
- **Mit wenigen, kleinen B-Änderungen (≤ 6 Punkte, meist Bausteine):** mehr-neu, korb, bestellung-link, neuigkeiten, abmelden, systemseiten, passwort, anmelden, druck, mail-zugang, mail-neuigkeiten, bestaetigung, meine-bestellungen, kundenkonto, fehlerseiten.
- **Mit den gemeinsamen Bausteinen G1–G8 plus Seitenarbeit (mittel):** einstellungen, hofdaten-zahlung, konto-hof, kunden, meldungen, postfach, problem-melden, teilen, whatsapp-plakat, beitraege, bestellungen, bestellung, produkte, hofseite, mail-betrieb, mail-hof-bestellung, mail-hof-konto, mail-kauf, mail-sicherheit, mail-team, widerruf.
- **Viel Arbeit, 5 erst nach eigenem Umbau:** heute, auswertung, verkaeufe, region, mein-hof, startseite, hoefe, produkt-neu, registrieren.
- **Hängen an P:** produkt und mail-storno (P1), rechtstexte (P2). Ohne Antwort bleiben sie bei 4.

Boards mit nicht herstellbaren Bildern (meine-bestellungen 3–6, neuigkeiten 1–3, systemseiten 1–4, abmelden 2, widerruf 1/5, registrieren 2/4, fehlerseiten 6, kasse 4) können nur auf 5 kommen, wenn die Abnahme diese Bilder als „nicht prüfbar“ aus der Wertung nimmt oder einen Weg für signierte Links im Prüf-Seed bekommt (Empfehlung: Prüf-Seed erzeugt die signierten Links selbst, nur in der Wegwerf-DB).

---

## 2. Entscheidungen je Board

Vermerk Lauf 32 B (7.11.2026): ‚G5‘ in Fehlerkarten-Zeilen zu ‚G6‘ berichtigt (Regelvorschlag 9, Morgenbericht 32 A, freigegeben 7.11.2026).

Spalten: Mangel (kurz) · Fassung · Entsch. · Begründung · Umsetzung (B) bzw. Board-Korrektur (C).
Verweise G1 … G14 = gemeinsame Bausteine (Abschnitt 3).

### mehr-neu

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Große Postfach-Karte statt Zeile „Neue Nachricht im Postfach“ | 1440 h/d, Bild 1/2 | R | Register N12: ungelesene Nachricht steht auf Heute ganz oben lesbar mit „Antworten“, „Gelesen“. | Board w1-mehr-neu Bild 1/2: Karte wie N12 statt Zeile. |
| Wochen-Balken im Dunkeln dunkelgrün | 1440 d | B | Farbe folgt Board; Kontrast zu schwach. | G13 Diagrammfarbe dunkel. |
| Menü „Was legst du an?“: 2. Eintrag hervorgehoben, kein Fokusring | 1440 h/d, Bild 3 | B | DS: per Tastatur geöffnet trägt der erste Eintrag die Hervorhebung, Fokus sichtbar. | Erster Eintrag fokussiert, `FOKUS_RAHMEN`; Tönung nur zusätzlich. |
| Knopf „Ausblenden“ an „Zu tun“ | 1440 h/d | C | Fertige Funktion, hilft fertigen Höfen. | Board: „Ausblenden“ rechts im Kartenkopf zeigen. |
| Karte „Mit einem Tipp in deinem Hof“ im Hintergrund | 1440 h/d, Bild 1/2 | U | Zustand der Seite Heute hinter dem Menü, nicht Teil dieses Boards. | – |
| „Konto“ vs „Konto · Franz Müller“ | 1440 | C | Q1. | Board Bild 3: „Konto · Franz Müller“. |
| Startfokus im Blatt auf „Schließen“ sichtbar | 390 | C | DS: Blatt setzt den Fokus auf das Schließen-Element. | Board: Fokusring am Schließen zeigen. |
| Admin-Zeile fehlt | alle | U | Admin ohne Passkey nicht erreichbar. | – |

### hoefe

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Bild 5 Kartenzustand nicht erreicht, Liste statt Karte, Filter „10 km“ hängt | 390/1440 | U | Aufnahmefolge (Dirigent). | Aufnahme mit frischer Seite. |
| Leeres Suchfeld + grüner Kasten „Wir zeigen Höfe rund um deinen Standort … Ort ändern“ statt Feld mit Ort | alle | C | Fertige Funktion, macht den Ort sichtbar und änderbar. | Board: Kasten mit „Ort ändern“ unter dem Feld zeigen. |
| Kategorie-Chips „Milch & Molkerei“, „Eier“, „Fleisch & Wurst“ | alle | C | Kategorien aus echten Daten (Taxonomie). | Board: Chip-Namen aus der Taxonomie. |
| Reihenfolge-Satz lang und zweizeilig | alle | R | Wortlaut `REIHENFOLGE_HINWEIS` (§ 4a FAGG) liegt bei Recht (Morgenbericht). | Board: Code-Satz übernehmen, bis Recht kürzt. |
| Hofkarte ohne „inkl. Plattformgebühr“ | alle, Bild 1/5 | B | Register N38 verlangt den Zusatz an Karten. | `ProduktKurzliste` zeigt „inkl. Plattformgebühr“ einmal je Karte. |
| Produkte als Tabelle mit „+ 1 weiteres Produkt“ statt Fließzeile | alle, Bild 1/5 | B | Aufbau folgt Board. | Fließzeile „Name Menge € Preis · …“, ohne „+ n weitere“. |
| Abholzeile normal mit Uhr statt fett grün | alle | B | Aufbau/Farbe folgt Board. | Abholzeile fett, `text-brand-text`, ohne Symbol. |
| Marke „Gründungshof“ fehlt | alle | U | Prüfhof ist kein Gründungshof. | – |
| Hinweis „Ein Hof hat noch keinen Kartenpunkt …“ | 1440 | C | Fertige, hilfreiche Funktion (DS). | Board: Hinweis links oben auf der Karte. |
| Marker als Häufchen „4 Höfe“ | 1440 | C | Regel N22 (Namen erst ≤ 12 Pins bzw. Zoom 12); viele Höfe im Seed. | Board: Häufchen als Zustand bei vielen Höfen ergänzen. |
| Einzel-Pins weiß mit grünem Rand statt dunkler Nummernkreis mit Namensschild | 1440 | B | Form folgt Board. | Pin-Baustein: dunkler Nummernkreis, Namensschild. |
| Suche „Eier“ am Handy: alle Chip-Reihen, Filter/Liste/Karte, Aktive-Filter-Zeile, Reihenfolge-Satz | 390, Bild 2 | B | Seite wird unruhig; Board zeigt nach der Suche nur Hinweis und Produkte. | Bei Produktsuche Chip-Reihen und Reihenfolge-Satz ausblenden, Filter bleibt im Knopf „Filter“; Zeile „Aktive Filter: Suche“ entfällt (Suche steht im Feld). |
| Produktkarte gequetscht (Umbruch, Ort abgeschnitten, Preis rechts) | 390, Bild 2 | B | Aufbau folgt Board. | Name, Meta-Zeile, darunter fetter Preis + „inkl. Plattformgebühr“. |
| Produktkarten ohne „inkl. Plattformgebühr“, Knopf „Zum Hof ›“, Preis oben rechts | alle, Bild 2 | B | N38 und Aufbau Board. | Ganze Karte ist der Link (kein Extra-Knopf), Preis unter der Meta-Zeile. |
| Marke „Bio“ | alle, Bild 2 | U | Beispieldaten (Produkt ist Bio). | – |
| Hinweis „Produkte statt Höfe …“ fehlt (Web) bzw. steht unter h1 ohne Punkt (Handy) | alle, Bild 2 | B | Text und Lage folgen Board. | Satz unter „Standort nutzen“, mit Punkt, auch im Web. |
| Offene Vorschlagsliste und Löschen-× nach der Suche | 1440, Bild 2 | B | Funktion bleibt, aber offen über den Ergebnissen ist es unruhig. | Vorschläge nur beim Tippen; nach Absenden zu. Das × im Feld bleibt (C-Anteil, Board ergänzt das ×). |
| h1 mit geradem Anführungszeichen „Eier"“ | alle | B | Typografie. | Typografische Zeichen „…“ aus einer Hilfe. |
| Leerzustand mittig, gestrichelt, Lupe, Serif, grüner Knopf | alle, Bild 4 | B | PL: Leerzustände ohne Symbol; Board-Form. | G4; Satz „Mit 25 km sind es n Höfe mit Fleisch.“ aus derselben Zählung wie die Umkreis-Stufen, sonst allgemeiner Satz. |
| Aktive Filter: Vorsatz, Reihenfolge, nicht getönt, eigene Zeile | alle, Bild 4 | B | Form folgt Board. | Getönte Chips „Fleisch ×“, „10 km ×“ + „Alle zurücksetzen“ in einer Zeile, ohne Vorsatz. |
| Karte ohne „Du“-Marke und Umkreis-Kreis | 1440, Bild 4 | B | Board; hilft beim Einordnen. | Standort-Marke und gestrichelter Kreis bei gesetztem Umkreis. |
| Bild 4 gescrollt aufgenommen | 390 | U | Aufnahmefehler. | – |
| Bild 5 Auswahlkarte unter der Karte nicht im Bild | 1440 | U | Aufnahme gescrollt. | – |
| Listenkarte des gewählten Hofs hervorgehoben | 1440, Bild 5 | C | Zeigt den Zusammenhang Karte–Liste. | Board: gewählte Listenkarte getönt. |
| Graue Unterzeile auf grüner Auswahlkarte zu blass (axe) | 1440 h, Bild 5 | B | Kontrast WCAG AA. | Unterzeile `text-foreground/80` bzw. Token mit ≥ 4,5:1 auf Tönung. |
| h1 26 statt 20 px, kein Kopfstreifen mit Linie | 390 | B | Größe/Aufbau Board. | Kopfstreifen mit Linie, h1 20 px. |
| Chips flacher als im Board | 390 | C | Chips dürfen kleiner sein (Trefferfläche über `::before`). | Board: Chips 36 px sichtbar. |
| Knopf „Filter“ mit Regler-Symbol | alle | B | Board ohne Symbol. | Symbol weg, Zähler bleibt. |
| Kopf „Agrilo“ + „Anmelden“ am Handy | 390 | R | Q2 (N1). | Board: Handy-Kopf mit „Anmelden“. |
| „Warenkorb“ in der Unterleiste dünn/blass | 390 | B | Board. | G10. |
| „Darstellung: hell/dunkel“ im Seitenfuß | 390, Bild 4 | R | DS Unterleiste/Seitenfuß (V10, N22). | Board: Pille im Fuß zeigen. |
| Blaue Textmarkierung im Feld | 1440 d | U | Aufnahmezustand (Text markiert). | – |

### startseite

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| „So funktioniert’s“: Überzeile, große h2, Schritte ohne Karte mit Beschreibung | 1440, Bild 3 | B | Aufbau Board. | h2 „In drei Schritten zum Hofkorb“, Liste in einer Karte, nur Titel. |
| „Warum direkt vom Hof?“ anders | 1440, Bild 3 | B | Aufbau/Text Board (V93: „Der Hof bekommt …“ ist richtig, Board-Satz „Der Hof setzt seinen Preis selbst“ ebenso). | Karte mit Titel und drei Punkten wie Board. |
| Kasten „BEISPIEL“ zeigt Servicegebühr 5 % | 1440, Bild 3 | U | Vorgerendert gegen DB vor Stichtag. | Im Vorschau-Build mit Stichtag nachprüfen; Fließtext wie Board (V93). |
| „Für Höfe“ als großer Banner mit zwei Knöpfen, Pfirsich-Verlauf | 1440, Bild 3/4 | B | Aufbau/Farbe Board. | Schlichte Karte, ein breiter Knopf „Für Höfe“. |
| „Gut zu wissen“ zweispaltig, Akkordeon, andere Fragen | 1440/390, Bild 4 | B | Board legt die drei Fragen fest (inkl. „Was ist die Plattformgebühr?“). | Halbbreite Karte mit drei Zeilen; Aufklappen darf bleiben. |
| Seitenfuß am Handy mit Markenblock und zwei Linkspalten | 390, Bild 4 | R | Register N22-Ergänzung: der Fuß der Startseite erscheint nur noch am Handy. | Board s1-startseite: Startseiten-Fuß zeigen. |
| Fußlinks nicht unterstrichen | 390, Bild 4 | B | Board. | G11. |
| Regionskarte: Pille „35 Höfe“, Infokarte, „Karte öffnen“, keine Zoom-Knöpfe, kein Link | 1440, Bild 1/5 | B | Aufbau Board. | Karte mit Zoom „+/−“, Nummern-Pins, darunter „Alle Höfe auf der Karte →“. |
| Untertitel länger / ohne „Fleisch“, „sogar“ | alle, Bild 1 | B | Wörtlicher Text. | „Eier, Gemüse, Fleisch, Brot – und sogar Heu für die Hasen.“ |
| Suche: Knopf unter dem Feld statt daneben | 390, Bild 1 | B | Aufbau Board. | Feld und „Höfe finden“ nebeneinander. |
| Eigene h2 und Pille über der Karte | 390, Bild 1 | B | Aufbau Board. | Karte direkt unter der Häkchenliste, Link darunter. |
| Standort-Link weiß, fett, mit Symbol | alle | B | Board. | Grüner, unterstrichener Textlink. |
| Häkchenliste zweispaltig | 1440 | B | Board. | Einspaltig. |
| Abschnittskopf große Serif-h2 + Knopf statt Überzeile | alle, Bild 1/2/5 | B | Board. | Kicker „HÖFE AUS DER REGION“, Link als Textlink links neben „Oder direkt suchen:“. |
| Hofkarten ohne „inkl. Plattformgebühr“ | alle, Bild 2 | B | N38. | `ProduktKurzliste` (siehe hoefe). |
| Chips „Oder direkt suchen:“ als Kategorien statt Produkte | 1440, Bild 2 | B | Board nennt Produkte (Eier, Heumilch, Heu, Brennholz, Honig). | Liste der Such-Chips als Konstante nach Board. |
| Chipzeile am Handy nicht im Bild | 390, Bild 2 | U | Bildausschnitt. | – |
| Bild 3 zeigt Seitenkopf statt Abschnitte | 390 | U | Aufnahme. | – |
| Leerzustand: Standort-Link und Häkchenliste trotzdem da | 1440, Bild 5 | B | Board. | Ohne Höfe beides ausblenden. |
| Leer-Karte mit Symbol und zusätzlichem Knopf | alle, Bild 5 | B | PL: ohne Symbol; Board. | G4, nur Knopf „Für Höfe“. |
| Fokusrahmen der Hofkarte oben offen | 1440, Bild 2 | B | Fokus muss die ganze Karte umschließen. | `FOKUS_RAHMEN` am äußeren Link. |
| Inhaltsbreite, Kopfhöhe, Abstände | 1440 | B | Maße Board. | Inhalt 1098 px (Rand 171 px), Abschnittsabstände nach Board. |
| Video im Dunkeln wenig gedämpft | 390/1440 d | B | Video bleibt (A1), Dämpfung wie Fotos. | `FOTO_HUELLE` aus `ui/bild-dunkel.ts` auf das Video. |

### hofseite

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Zusätzlicher Agrilo-Kopf über dem Hof-Kopf, zwei feste Leisten | 390 | R + B | „Anmelden“ bleibt (N1); zwei feste Leisten sind aber unruhig. | Agrilo-Kopf scrollt auf Hof- und Produktseite weg, nur der Hof-Kopf klebt (G9). Board: Agrilo-Kopf oben zeigen. |
| Warenkorb-Leiste als schwebende Pille über dem Inhalt | 390 | B | Inhalt darf nicht darunter laufen (V28). | Volle Leiste in eigenem Band über der Unterleiste, Inhalt mit Abstand. |
| Zähler am Warenkorb orange statt grün mit Ring | 390 | B | Kundschaft grün (N42). | G10. |
| Preiszeile nur „€ 1,49 / L“ statt Preis fett + Grundpreis darunter | alle | B | Board; N38 Grundpreis inkl. Gebühr. | Preis fett, Grundpreis grau darunter (eine Hilfe für Hofseite und Produktseite). |
| Futter-Hinweis in der Warenkorb-Karte | 1440 | R | Register E10a: Hinweis bei jedem Futter, auch im Warenkorb, wörtlich. | Board: Hinweis in der Karte zeigen, wenn Futter im Warenkorb liegt. |
| Titelbild-Platzhalter dunkel mit hellem Fleck | 1440/390 d | B | Board. | G12. |
| Knöpfe einer Reihe ungleich hoch | 1440, Bild 3 | B | Board. | Karte als Spalte, Knopf `mt-auto`. |
| Pausiert: unter den Produkten noch Preis-Satz und „Über uns“ | 1440, Bild 4 | C | Board vermutlich gekürzt; „Über uns“ und Preisangabe gehören auch bei Pause dazu (N24: Produkte bleiben sichtbar). | Board Bild 4 bis „Über uns“ verlängern. |
| Block Abholzeiten unter „Nächste Abholung“ | 390, Bild 2 | R | Register N5: „Nächste Abholung mit Abholzeiten“. | Board: Block zeigen. |
| Gründungshof-Marke, Leitsatz, Aktuell vom Hof, Seit 1987, Zahlung, Parken | alle | U | Beispieldaten des Seeds. | – |

### produkt

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Größen-Karten ohne Radio, Name ohne Komma, Preis links, „noch 14 × 25 kg“ | alle, Bild 1 | B | Board. | G5 Größenkachel. |
| Reihenfolge der Größen Big Bag → Sack → Lose | alle, Bild 1 | B | Board: klein nach groß. | Aufsteigend nach Menge, solange der Hof keine eigene Reihenfolge gesetzt hat. |
| „Lose 1 t“ ohne Preis und ohne „gerade nicht da“ | alle, Bild 1 | B | Board; Preis gehört auch zur leeren Größe. | G5: Preis und „gerade nicht da“. |
| Zeile „14 Tage Rücktrittsrecht ab Abholung – Details in den AGB.“ fehlt | alle, Bild 1/3 | P | Recht: eine pauschale Zeile kann bei schnell verderblicher Ware falsch sein. | Siehe P1. |
| Marke „Nur an Betriebe“ + Absatz | alle, Bild 1 | U | Beispieldaten (Produkt ist „nur an Betriebe“). | – |
| Chip „Futtermittelbetrieb · LFBIS … · laut Hof“ mit Schild | alle, Bild 1 | R | Register E9-Ergänzung, wörtlich, ohne Haken-Symbol. | Board: Schild nach E9. Code: Schild-Symbol prüfen (E9 sagt „ohne Haken-Symbol“ – Schild ist erlaubt). |
| Lange Beschreibung über „Größe wählen“ | alle, Bild 1/2 | B | Reihenfolge Board. | Kurzer Hinweis oben, Beschreibung unter den Größen vor „Kennzeichnung“. |
| Kennzeichnung mit acht Zeilen | 390, Bild 2 | R | Futtermittelrecht (Kennzeichnung, E10). | Board: acht Zeilen. |
| Futter-Hinweis anderer Wortlaut | alle | R | E10a wörtlich. | Board: E10a-Satz. |
| Futter-Hinweis in der Seitenspalte | 1440 | R | E10a (Warenkorb). | Board ergänzen. |
| Bild 2 bytegleich mit Bild 1 | 1440 | U | Aufnahmefehler. | – |
| Merkmal-Kacheln Holzart/Länge/Gelagert fehlen | alle, Bild 3 | B | Board; Daten sind im Brennholz-Formular da. | Drei Kacheln aus den Brennholz-Angaben (E11). |
| „€ 100,70 / m³“ statt „je Raummeter“ | alle, Bild 3 | B | Raummeter ist nicht m³ (E11, Wortliste). | Einheit „je Raummeter“. |
| Erklärzeile „1 Raummeter = …“ fehlt | alle, Bild 3 | B | Board. | Zeile aus einer Konstante (auch im Formular genutzt). |
| Ausverkauft-Text anders | alle, Bild 3 | B | Wörtlicher Text. | „<Hof> hat gerade kein <Produkt>. Schau, was es sonst gibt.“ |
| Zusätzlicher Beschreibungsabsatz | alle, Bild 3 | U | Beispieldaten. | – |
| Bildfläche im Dunkeln mittelgrün | 390/1440 d | B | Board. | G12. |
| Kopf „Agrilo“ am Handy | 390 | R | Q2. | Board ergänzen; Kopf scrollt weg (G9). |
| Feste Kauf-Leiste ohne Linie, überdeckt „Lose 1 t“ | 1440, Bild 1 | B | Board, V28. | Linie oben, Inhalt endet darüber (Abstand unten = Leistenhöhe). |
| „Zahlung & Kontakt“ nur bar | 1440 | U | Hof bietet nur bar. | – |
| Minus-Knopf bei Menge 1 ausgegraut | 390 | C | Verhindert Menge 0; richtig für Tastatur und Screenreader. | Board: Minus bei 1 gedämpft. |
| Marke „Ausverkauft“ fast ohne Fläche | 1440 h | B | V19: neutrale graue Pille. | `Abzeichen ton="neutral"`. |

### bestaetigung

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Neuigkeiten-Karte: längerer Text, Satz zur Bestätigungs-Mail, Datenschutz-Satz | alle, Bild 2 | C | S11 (Double-Opt-in) und DSGVO-Information gehören zur Anmeldung; „Höchstens zweimal im Monat“ entfällt (PL). | Board: „Höchstens zweimal …“ streichen, DOI- und Datenschutz-Satz aufnehmen. |
| Neuigkeiten-Karte höher als „Erzähl’s weiter“ | 1440, Bild 2 | B | Board: gleich hoch. | Raster `items-stretch`, Inhalt oben. |
| „Online · Bezahlt · inkl. Plattformgebühr“ | alle, Bild 1/2 | B | Wörtlicher Text Board. | „Online bezahlt · inkl. Plattformgebühr (6 %)“, Satz aus der Bestellung. |
| „Bar bei Abholung · Noch offen · inkl. …“ | alle, Bild 3 | B | Board. | „Bar bei Abholung · inkl. Plattformgebühr (6 %)“. |
| Frist „heute, Fr, 6. Nov, 06:25 Uhr“ | alle, Bild 3 | C | V9: immer mit Wochentag und Datum; Board widerspricht V9. | Board: „Bitte bis heute, Mi 3. März, 09:40 Uhr bestätigen“. |
| Link „Vertrag widerrufen“ unter allen Karten | 1440, Bild 1 | C | Board Bild 1 und 2 widersprechen sich, App folgt Bild 2. | Board Bild 1 wie Bild 2. |
| Karten „Erzähl’s weiter“/Neuigkeiten in Bild 1 | 1440, Bild 1 | C | Board-Widerspruch, App folgt Bild 2. | Board Bild 1 wie Bild 2. |
| h1 größer, Karte 560 statt 520 px, h1-Umbruch | 390/1440 | B | Maße Board. | h1-Größe nach Board, Karte `max-w-[520px]`. |
| „Erzähl’s weiter“ stärker gerundet, mehr Innenabstand | alle, Bild 2 | B | Board. | G8. |
| Fokus als dünner Doppelring | 1440 | C | Q3. | – |
| „Abholbereit“ statt „Gepackt“ in der Schritt-Leiste | alle | R | Register N9-Nachtrag. | Board: „Abholbereit“. |

### bestellung-link

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Kein Fokus sichtbar in Bild 2 | 1440 d | U | Aufnahme ohne Tab (Bild 3/4 zeigen Fokus). | – |
| „Bar bei Abholung“ ohne „· inkl. Plattformgebühr“ | alle, Bild 2 | B | N38, Board. | Zahlzeile aus EINER Hilfe für Bestätigung und Bestellseite. |
| „Online · Bezahlt“ und Zeile zu klein | alle, Bild 1 | B | Board. | „Online bezahlt · € … inkl. Plattformgebühr“ in Positionsgröße. |
| Fokusring rund und eng | 1440 | C | Q3. | – |
| Link kleiner, h1 größer | 390/1440 | B | Maße Board. | Linkgröße 15 px, h1 nach Board, Abstand 12 px. |
| Trennlinie nur Spaltenbreite, Pfeil nicht unterstrichen | 1440, Bild 2 | B | Board. | Linie über die Kartenbreite; Pfeil im Link. |

### kasse

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Gewährleistungs-Grafik im Dunkeln nicht gedämpft | 1440 d | R | PL: bleibt wie gesetzlich vorgegeben; DS „Amtliche Grafiken unverändert“. | Board w1-kasse-dunkel: Grafik ungedämpft zeigen. |
| Platzhalter „z. B. komme später“ | 390 | C | Board widerspricht sich (Web zeigt ihn). | Board s1-kasse: Platzhalter zeigen. |
| Bild 4 und Leiste im Web nicht prüfbar | alle | U | Stripe, Bildausschnitt. | Aufnahme mit gescrollter Leiste. |

### korb

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Hinweis „Eine Position ist nicht mehr verfügbar …“ ohne Produkt | alle, Bild 2 | B | Board nennt Produkt und Grund – klarer. | „<Produkt> ist gerade ausverkauft – wir haben es herausgenommen.“ (Genus über „es“ neutral). |
| Fokusring rund statt eckig | 1440 | C | Q3. | – |
| „Höfe entdecken“ etwas kleiner | 1440, Bild 3 | B | Maß Board. | 15 px halbfett. |
| Fokusring nach letztem Klick | 390, Bild 3 | U | Aufnahmezustand. | – |
| Seite hinter dem Blatt in anderem Zustand | alle | U | Aufnahme. | – |

### meine-bestellungen

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Knopf „Andere E-Mail-Adresse“ | alle, Bild 2 | C | Fertige Funktion; ohne sie kommt man bei Tippfehler nicht weiter. | Board: Textlink unter „Code erneut senden“. |
| Einleitungssatz oben in der Karte | alle, Bild 1 | B | Wörtlicher Text Board. | Satz weg; Hinweis „ohne Konto“ steht im Seitenkopf, falls Board ihn dort hat, sonst entfällt er. |
| Kein Fokus am Knopf | 1440 d, Bild 2 | U | Aufnahme ohne Tab. | – |
| Feldname „6-stelliger Code aus der E-Mail“ | alle, Bild 2 | B | Board „Code“. | Beschriftung „Code“, Satz darüber erklärt die Herkunft. |
| Einleitungssatz grau, Adresse fett | alle, Bild 2 | B | Board. | Textfarbe, Adresse normal. |
| Code in Festbreitenschrift | alle, Bild 2 | B | Board. | Grundschrift, `tabular-nums`. |
| Code ohne Gruppierung „48 217“ | alle, Bild 2 | C | V56: einfaches Feld; Leerzeichen im Feld stören beim Einfügen. | Board: Code ohne Leerzeichen. |
| h1 30 statt 24 px | 1440 | B | Board. | h1 24 px (Kopf-Baustein). |
| „Code erneut senden“ 14 statt 16 px | 1440 | B | Board. | 16 px. |
| „Warenkorb“ in der Unterleiste dünn | 390 | B | Board. | G10. |
| Bilder 3–6 nicht prüfbar | alle | U | Mail-Code. | Prüf-Seed mit Code (siehe Kopf). |

### bestellung (Hof)

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Zusätzliche Tab-Leiste unter der Aktionsleiste | 390, Bild 1/2/4 | B | Zwei feste Leisten; Board zeigt nur die Aktionsleiste. | Bestelldetail als Fokus-Seite ohne Unterleiste (wie Kasse). |
| Kopf: eigene Zeile „← Bestellungen“, große h1, keine Unterzeile, Telefon nicht im Kopf | 390 | B | PL: feste Köpfe wie Board. | G1 mit Aktion rechts (Telefon). |
| „Abholung rückgängig“ als oranger Hauptknopf | alle, Bild 4 | B | Eine Hauptaktion (N1); Rückgängig ist Nebenaktion. | Textknopf. |
| Toast hell oben, verdeckt h1, „Rückgängig“ gefüllt | alle, Bild 2 | B | Board. | G7. |
| „Bar zu kassieren“ nur Warenpreis | alle, Bild 1/2 | B | V1, N38 (Gründungshof erlassen). | Satz „Du bekommst die vollen € … – bis <Gründungsende> zahlst du auf Barverkäufe keine Plattformgebühr.“ aus `plattformgebuehr.ts`; ohne Gründungsplatz der Satz des Modells. |
| „Online bezahlt“ mit Servicegebühr € 0,50 | alle, Bild 4 | U | Bestellung vor dem Stichtag (V63 erlaubt „Servicegebühr“). | Für Bestellungen ab Stichtag Board-Satz „Du bekommst € … · die Kundin zahlt € … – die Gebühr ist online einbehalten.“ prüfen. |
| Marke „Abgeholt“ grau statt grün | alle, Bild 4 | B | Board (Status fertig). | `Abzeichen ton="fertig"`. |
| „Packliste“ ohne Zähler | alle, Bild 4 | B | Board. | „Packliste · n von m“. |
| „· abgeholt um 16:05“ fehlt | alle, Bild 4 | B | Board; Zeitpunkt ist gespeichert. | Zeitzeile ergänzen. |
| Mengen nicht fett voran („Heumilch frisch · 4 L“) | alle | B | Board. | G14 Positionszeile. |
| Rücklink „‹ Bestellungen“ grau statt „← Zurück“ grün | 1440 | C (Wort) + B (Stil) | Name der Elternseite führt besser (DS, V36); Stil wie übrige Boards. | Board: „‹ Bestellungen“. Code: grüner, unterstrichener Textlink (G1). |
| Unterzeile „Bestellungen“ unter der h1 fehlt | 1440 | B | Board. | G1. |
| „Abholzettel drucken“ in der Karte Kundin | 1440 | C | Fertige, nützliche Funktion. | Board: Link mit Drucker-Symbol ergänzen. |
| Inhalt bis an den rechten Rand | 1440 | B | Board. | `max-w` 1200 px. |
| Dialog „Was fehlt …“: Stornieren neben dem Hauptknopf | 1440, Bild 3 | B | Board. | Hauptknopf rechts, darunter „Ganze Bestellung stornieren …“. |
| Aktionsleiste hinter dem Dialog sichtbar | 1440, Bild 3 | B | Schleier deckt alles. | Leiste unter den Schleier (z-Ebene). |
| „Bestellt: …“ ohne „· bar, bezahlt wird bei Abholung“ | 1440 | B | Board. | Zusatz aus der Zahlart. |
| Fokus nach „Als abgeholt“ am Knopf „Abholung rückgängig“ | 1440, Bild 4 | C | Fokus bleibt nach einer Aktion am auslösenden Element. | Board: Fokus am Knopf. |
| Fokusring um die ganze Packlisten-Zeile | 1440 | C | Die Zeile ist das Bedienelement (große Trefferfläche). | Board: Ring um die Zeile. |
| Toast „Als abgeholt gespeichert“ in Bild 4 | alle | U | Aufnahme kurz nach der Aktion; Lage regelt G7. | – |
| „Konto · Franz Müller“ | 1440 | C | Q1. | – |
| Gewählte Zeile „fehlt“ getönt | 390, Bild 3 | C | Zeigt die Wahl deutlich. | Board: Tönung zeigen. |
| „Gepackt“ statt „Abholbereit“ | alle | R | Register N9 (Hof sieht „Gepackt“). | Board s2-bestellung: „Gepackt“. |

### bestellungen

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Bild 1 zeigt Detailseite statt Liste mit Vorschau | 1440 | U | Aufnahmefehler (Route seit 237 anders). | Aufnahme über die neue Route. |
| Feste Leiste, fehlende Vorschau-Karte, „Packliste drucken“ | 1440, Bild 1 | U | Folgt aus der falschen Route. | Nach neuer Aufnahme neu bewerten. |
| Hinweis-Kasten über der h1 | alle, Bild 3 | B | Board, Dirigent. | G3 (Balken unter dem Seitenkopf). |
| Leer-Karte „Teile deine Hofseite …“ | alle, Bild 3 | B | Board; Teilen geht vor der Freischaltung nicht. | Text nach Board aus einer Konstante je Stand. |
| Knopf „Zu Mein Hof“ statt Link „Was bis zur Freischaltung noch fehlt →“ | alle, Bild 3 | B | Board. | Textlink auf /onboarding. |
| Leer-Karte zentriert, Symbol, gestrichelt, Serif, schmal | alle, Bild 3 | B | PL ohne Symbol; Board. | G4. |
| Hinweis mit Uhr, Hof-ID, Nachsatz; Titel nicht in Warnfarbe | alle, Bild 3 | B | Board. | G3. |
| Karte „Startphase“ | 1440, Bild 3 | U | Q4. | – |
| Bild 2 „0 offen“ statt „2 offen“ | alle | U | Prüfdaten anderer Tag. | – |
| „Nächste Abholung: Heute …“ unter „Heute holt niemand etwas ab.“ | alle, Bild 2 | B | Liest sich als Widerspruch; V40: die Zeile nennt ihre Zahl. | „Nächste Abholung: <Fenster> · n Bestellungen“; mit 0 Bestellungen nennt die Zeile das nächste Fenster mit Bestellungen. |
| Fokus auf „Packliste drucken“ | 1440, Bild 2 | C | Q3 (Kopf-Aktion kommt zuerst). | – |
| Kopf enger, Leer-Karte stärker gerundet | 1440 | B | Board. | G1 Abstände, G8. |
| „Konto · …“ | 1440 | C | Q1. | – |
| Unterleiste: Beschriftungen kleiner, andere Symbole | 390 | B | Board. | 12 px ab 360 px; Symbole nach Board (Hof-Unterleiste in `ui/bottom-nav.tsx`). |
| Nicht gewählte Chips im Dunkeln ohne Umriss | 390 d | B | Board. | Chip-Rand `border` in beiden Themes. |
| Karten stärker gerundet | alle | B | Board. | G8. |
| „Gepackt“ | alle | R | N9. | – |

### heute

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Freischalt-Hinweis über dem Kopf | 390/1440, Bild 4 | B | Board, Dirigent. | G3. |
| Beim Scrollen läuft alles mit (Kopf und rechte Spalte) | 1440, Bild 2 | B | Board: nur die Hauptspalte scrollt. | Kopf und rechte Spalte `sticky`. |
| Block „Was gibt’s Neues am Hof?“ | alle | R | Register N11-Ergänzung: Anstoß für einen Beitrag auf Heute (E12). | Board: Block nach „Teilen“ zeigen. |
| Reihenfolge am Handy unten | 390, Bild 2 | B | Board (N11: Packliste → Braucht dich → Teilen). | Braucht dich → Teilen → Was gibt’s Neues → Nächste Abholung → Umsatz → Tipp; „Zu tun“ nicht im Handy-Strom. |
| Packlisten-Zeilen mit „15:00–18:00 ·“ vorn, abgeschnitten | 390 | B | PL: ohne Uhrzeit; die Zeit steht im Kopf des Fensters. | Zeile: Kurzname + Positionen, ohne Zeit, zweizeilig statt abgeschnitten. |
| Board zeigt Uhrzeit-Spalte und vollen Namen | 390 | C | PL: Packliste mit Kurzname und ohne Uhrzeit. | Board s1-heute: Uhrzeit-Spalte weg, Kurzname. |
| Zustand „Online-Zahlung ist pausiert“ nicht erreicht | alle, Bild 3 | U | Stripe-Zustand nicht herstellbar. | – |
| AGB-Karte mit „Ich stimme den AGB zu“ | alle, Bild 4/5 | R | Register O4 / Nr. 207, Umschaltung auf AGB 1.0 nach recht/F021. | Board: Text der Karte nach der AGB-Umschaltung (A005). |
| Freischalt-Hinweis mit Hof-ID, Nachsatz, Uhr | alle, Bild 4 | B | Board. | G3. |
| Pflichtkarte „Online-Zahlung einrichten“ fehlt in der Hauptspalte | 1440, Bild 4 | B | N11: Stripe-Hinweis ist der eine Kasten oben. | Karte in der Hauptspalte; in „Zu tun“ dann ohne Doppelung. |
| Leerer Packlisten-Satz anders | 1440, Bild 4 | B | Wörtlicher Text Board. | `ABHOLZEITEN_FEHLEN` = „Ohne Abholzeit kann niemand bei dir bestellen. Trag ein, wann man bei dir abholen kann.“ |
| „Zu tun“: Einleitungssatz, „festlegen“, Beschreibungen, Karte „Nächste Abholung · Noch keine Abholzeiten“ | 1440, Bild 4 | B | Board, Wortliste „eintragen“. | Nur Überschrift und Links „Abholzeiten eintragen“ …; die zusätzliche Karte entfällt (DS-Satz anpassen). |
| „Ausblenden“ an „Zu tun“ | alle | C | Funktion (siehe mehr-neu). | Board ergänzen. |
| Beschreibungszeile unter jedem Zu-tun-Eintrag | alle | B | Board. | Weg. |
| Kennzahl „€ 0,00“ | alle | C | Geldformat mit zwei Stellen überall gleich. | Board: „€ 0,00“. |
| Zusatz „mit Hofladen“ unter der Kennzahl | alle | B | Board „Heute eingenommen“. | Zusatz weg. |
| Umsatz-Karte: Satz zu Mo/Di fehlt, Vergleich „+472 % … Freitag, 04:24“ | 1440 | B | Board, verständlicher. | „Mehr/Weniger als letzte Woche bis <Wochentag> (€ …).“ + Satz zu selbst eingetragenen Verkäufen. |
| Postfach-Karte und Zähler fehlen | alle | U | Keine ungelesene Nachricht in den Prüfdaten. | – |
| Titel der Hinweis-/Pflichtkarten klein, neutrale Farbe | alle | B | Board. | G3. |
| „Packliste für heute“ statt „Packliste“ | 1440 | B | Board. | – |
| „Braucht dich“-Zeilen ohne Erklärzeile | 1440, Bild 3 | B | Board. | Erklärzeile je Grund aus `brauchtDich`. |
| Balken im Dunkeln dunkelgrün | d | B | Board. | G13. |
| Karten stärker gerundet und höher | alle | B | Board. | G8. |
| „Konto · Franz Müller“ | 1440 | C | Q1. | – |
| Karte „Startphase“ | 1440, Bild 4 | U | Q4. | – |
| Knopf „Teilen“ mit Symbol | alle, Bild 2 | B | Board. | Symbol weg. |
| Pflichtkarten untereinander | alle | R | PL / N11. | – |

### produkt-neu

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Fehler „Keine Verbindung / Wir wissen nicht, ob …“ ohne „Nochmal“ | alle, Bild 6 | B | N29: Speichern eines Produkts ist keine der „unsicheren“ Aktionen; Eingaben bleiben, „Nochmal“ gehört dazu. | Board-Kasten „Speichern hat nicht geklappt … Nochmal“ (G6); Doppelanlage beim zweiten Versuch über einen Idempotenz-Schlüssel wie in der Kasse abfangen. |
| Kopf am Handy: × rechts, keine Unterzeile, Erklärsatz | 390 | B | Board. | Zurück-Pfeil links, Titel, Unterzeile Produktart; Erklärsatz entfällt. |
| Rechte Spalte „So sehen Kunden dein Produkt“ fehlt | 1440 | R | PL / N41-Ergänzung (2. Fassung): Formular bleibt Dialog, keine Vorschau rechts. | Board w1-produkt-neu: als Dialog ohne Vorschau neu zeichnen. |
| Grüner Kasten „Du bekommst € 7,50 · die Kundin zahlt € 7,95 / Bar … ohne Gebühr“ fehlt | alle | B | V1; zeigt dem Hof sein Geld. | Kasten unter dem Preis, Beträge aus `plattformgebuehr.ts` (Geld-Anzeige, mit Test). |
| Zeile „Kunden sehen: € 7,50 / Stück“ | alle | B | Ab Stichtag sieht die Kundin den Endpreis; die Zeile wäre falsch. | Ersetzt durch den Kasten oben. |
| Einheit als Auswahl, Schalter „feste Pakete“, eigenes Vorrat-Feld | alle | C | Datenmodell (E3, Paketpreis). | Board: Einheit-Auswahl, Paket-Schalter, Vorrat-Feld zeigen. |
| Einheit und Preis nicht nebeneinander | alle | B | Board. | Zwei Felder in einer Reihe. |
| Schalter „Nur saisonal verfügbar“ | 1440 | C | Fertige Funktion. | Board ergänzen. |
| Kartenköpfe ohne Zusammenfassung | alle | B | Board. | Unterzeile je Karte („Waldhonig · Honig …“, „500 g · € 7,50 · Vorrat 12“). |
| Feld „Kurzbeschreibung“ | alle | C | Fertige Funktion (Karten auf /hoefe). | Board ergänzen. |
| Kategorie als Zeile mit Pfeil | alle | C | Lange Liste öffnet ein Auswahl-Blatt. | Board: Zeile mit Pfeil. |
| Hauptknopf „Noch 1 Angabe fehlt“ | alle | B | Board „Speichern“; ein deaktivierter Knopf mit wechselndem Text ist für Screenreader schwer. | Immer „Speichern“, Prüfung beim Speichern (G6). |
| Fehlerzusammenfassung abgeschnitten, Fokus auf Kartenkopf, Feld ohne Fehlerrand | alle, Bild 5 | B | V17, Board. | G6. |
| Vorschlag „Passt das? Honig & Bienenprodukte“ | alle, Bild 5 | C | Fertige Funktion. | Board ergänzen. |
| Kartentitel in Fehlerfarbe | alle, Bild 5 | B | Board: nur Unterzeile „Bitte prüfen“ farbig. | – |
| Futter: Chip-Gruppen „Kategorie“ und „Sorte“ | alle, Bild 2 | C | Taxonomie, die Region und Suche brauchen. | Board ergänzen. |
| Hilfetext unter Name (Futter) | alle, Bild 2 | B | Wörtlicher Text. | Board-Satz. |
| Verkaufsgrößen als Chips + Bearbeitungskarten statt Karte mit Größen-Zeilen | alle, Bild 2/3 | B | Board; Geldzeile je Größe fehlt sonst. | Karte „Verkaufsgrößen“ mit Zeilen „ca. 15 kg · Du bekommst … · die Kundin zahlt … · Vorrat …“ und „+ Größe hinzufügen“; die Schnellwahl-Chips stehen im Blatt hinter „+ Größe hinzufügen“. |
| „Nur an landwirtschaftliche Betriebe“ als Chip | alle, Bild 3 | B | Wichtige Einstellung mit Folge in der Kasse; Board: Schalter mit Satz. | Schalter + „Dann fragt die Kasse nach der Betriebsnummer.“ |
| Abholung als Chip-Gruppe statt Textfeld | alle, Bild 3 | R | Register N23: Abholhinweise als feste Auswahl. | Board: Chips. |
| Karte „Kennzeichnung · Pflicht“ nicht im Bild | alle, Bild 3 | U | Bild zeigt das Dialogende nicht. | Aufnahme gescrollt. |
| Registrierungen: Inhalt (BAES-Fall, Futterarten) | 390, Bild 3 | C | E10: BAES-Fall muss sichtbar sein. | Board ergänzen. |
| Registrierungen: farbige Karten statt einer Zeile | 390, Bild 3 | B | Form Board. | Kompakte Zeilen wie Board, BAES-Fall als zweite Zeile. |
| Vorschau am Handy groß, mit „Die Servicegebühr zahlt die Kundin zusätzlich“ | 390, Bild 3 | B | Board; Satz ist ab Stichtag falsch (V63). | Eine Zeile „<Name> · ab € … · ab € … / kg“, Gebührenwort je Modell. |
| Blöcke „Rücktritt“ und Rücksendekosten | 1440, Bild 3 | R | Register N39-Ergänzung (Nr. 214). | Board ergänzen. |
| Holz-Angaben: Aufbau ohne Karte | alle, Bild 4 | B | Board. | Aufklappbare Karte, Holzart/Scheitlänge nebeneinander, Schalter „Überdacht gelagert“. |
| Holz: zusätzliche Felder „Art“, „Trocknung“ | alle, Bild 4 | C | Fertige Daten (E11). | Board ergänzen. |
| Hilfetext unter Name (Holz) | alle, Bild 4 | B | Board ohne. | Weg. |
| Verkaufsgrößen Holz unter langen Chips | 390, Bild 4 | B | Reihenfolge Board. | Karte Verkaufsgrößen vor den Chips. |
| Beschriftungen „Vorrat“, „Andere Holzart“, „Lagerung“ kleiner | 1440 | B | Alle Feldbeschriftungen gleich. | Feld-Baustein. |
| Kästchen im Dunkeln hellgrau | 1440 d | B | Board. | Checkbox-Token dunkel. |
| Formular als Dialog | 1440 | R | PL. | – |

### produkte

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Karte „Nimmt Bestellungen an · Pausieren“ | 390, Bild 1/4 | R | Register N3-Ergänzung 22.10.: Zustandszeile auf allen drei Reitern (vom 5.11. nicht berührt). | Board s1-produkte: Zustandszeile zeigen. |
| „Du bekommst … · die Kundin zahlt …“ fehlt in den Zeilen | 390, Bild 1 | B | V1. | Zeile aus `plattformgebuehr.ts`. |
| Preisspalte einzeilig | 1440 | B | V1. | Zweizeilig „Du bekommst … / die Kundin zahlt …“. |
| „Braucht dich · 3“ mit Brennholz (0) | 390, Bild 1 | R | Register N25: Vorrat 0 und wenig Vorrat gehören zu „Braucht dich“. | Board: Brennholz unter „Braucht dich“. |
| Produkt ohne Kategorie: Vorschlag mit Funkeln | alle | C | Fertige Funktion. | Board: Vorschlag als Aktion zeigen. |
| Status „Im Shop“ bei Produkt ohne Kategorie | 1440 | B | Board und Heute sagen: ohne Kategorie nicht im Shop. | Status „Kategorie ergänzen“; Vorschlag bleibt darunter. |
| Waldhonig als letzte Zeile, Schalter an | 1440 | U | Beispieldaten. | – |
| „Braucht dich“ ohne getönten Grund | 390 | B | Board. | Getönte Karte. |
| Hinweis über Kopf und Reitern | alle, Bild 3 | B | Board. | G3. |
| Chip-Zeile fehlt bei 0 Produkten | 1440, Bild 3 | C | DS: Kopfzeile schweigt ohne Produkt; Filter ohne Inhalt sind Lärm. | Board: keine Chips im Leerzustand. |
| Hinweis mit Hof-ID, Uhr; Titel neutral | alle, Bild 3 | B | Board. | G3. |
| Leerzustände zentriert mit Symbol | alle, Bild 3/4 | B | PL. | G4. |
| Karte „Startphase“ | 1440 | U | Q4. | – |
| Postfach-Symbol im Kopf fehlt | 390 | B | PL: Mein-Hof-Kopf wie Board. | Postfach mit Zähler rechts im Kopf. |
| Produktbilder im Dunkeln auf hellen Kreisen | d | B | Board. | G12. |
| Startfokus auf „Neues Produkt“ | 1440 | C | Q3. | – |
| Vorrat-Blatt: zwei runde Knöpfe und große Zahl statt Pille „− 3 +“ | alle, Bild 2 | B | Board. | G13 Stepper. |
| Hintergrund hinter dem Blatt unscharf | 390 | B | DS: Schleier abgedunkelt statt verwischt. | `backdrop-blur` weg. |
| Chips/Suchfeld kleiner, Tabellenkopf ohne Tönung, Tabelle stark gerundet | alle | B | Board. | Chip 15 px, Feld 48 px, Kopf getönt, G8. |
| Spalte „Einheit“ klein und blass | 1440 | B | Board. | 15 px, Textfarbe. |
| „Konto · …“ | 1440 | C | Q1. | – |
| „an.“ allein in Zeile 2 | 1440, Bild 4 | B | Board. | `text-wrap: pretty`. |
| Vorrat-Blatt mit „Dazu“ und „Ausverkauft“ | alle | R | PL / N25. | – |

### auswertung

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Kopf ohne Zurück-Pfeil, scrollt weg | 390 | B | Board; Auswertung ist am Handy Unterseite von „Mehr“. | G1. |
| Gebühren-Karte vor dem Hinweis | 390, Bild 2 | B | Reihenfolge Board. | Diagramm → Hinweis → Wo kam das Geld her → Was lief am besten → Plattformgebühr + Grenze. |
| Zeitraum als Segment statt drei Pillen | alle | B | Board. | G11 Chip-Gruppe (aktiv dunkel/hell gefüllt). |
| Monatswahl in derselben Zeile | 1440 | B | Board. | Eigene Zeile, mittig. |
| Inhalt bis zum Rand | 1440 | B | Board: ~900 px. | `max-w-[900px]`. |
| Grenze-Karte volle Breite unten | 1440, Bild 3 | C | Board widerspricht sich (Bild 2 volle Breite); App folgt Bild 2. | Board Bild 3 wie Bild 2. |
| Bild 5: Links-Karte volle Breite statt nebeneinander | 1440 | B | Board. | Zwei Spalten wie Board. |
| Gebühren-Karte: Titel, Unterzeile, Erklärtext, Lastschrift-Absatz, Zeilen ohne Linien | alle | B | V41, Board. | „Plattformgebühr im <Monat>“ / „… diese Woche“; Erklärsatz je Stand (Gründungshof: erlassen bis …; sonst Lastschrift-Satz); Zeilen mit Trennlinien. |
| Woche zeigt die Gebühr des Monats | alle, Bild 4 | B | Fehler. | Gebühr für den gewählten Zeitraum. |
| Vergleichszeile „▲ 472 % …“ ohne Betrag; Fußsatz Mo/Di fehlt | alle, Bild 4 | B | Board. | „+n % · verglichen bis zum selben Zeitpunkt (€ …)“ + Fußsatz. |
| Woche am Handy: Links-Karte vor dem Diagramm | 390, Bild 4 | B | Reihenfolge Board. | Diagramm direkt unter den Kennzahlen. |
| Vergleichsbalken und Legende | alle | C | Fertige, hilfreiche Funktion (Vergleich). | Board: Vergleichsbalken + Legende ergänzen. |
| Balken im Dunkeln dunkelgrün, Vergleich kaum sichtbar | d | B | Board. | G13. |
| Grenze-Karte: Titel mit Betrag, großer Betrag, Marke darunter, erster Satz fehlt | alle | B | Board. | Titel „Grenze Be- & Verarbeitung <Jahr>“, Marke rechts, „€ … von € 55.000“ in einer Zeile, Satz „Nur verarbeitete Produkte wie Bergkäse. …“. |
| Zeile „Noch € … Spielraum“ | alle | C | Hilft dem Hof. | Board ergänzen; „Anteil 0 %“ entfällt (B). |
| Hinweis als Karte mit Glühbirne | alle, Bild 2 | B | Board. | Grün getönter Streifen, Text grün fett, ohne Symbol. |
| Bild 5 nicht freigegeben nicht erreicht | alle | U | Testhof freigegeben. | – |
| Leeres Diagramm mit „€ 0,00“, Symbol, ohne Erklärsatz | 1440, Bild 5 | B | PL; Board. | G4 mit Satz „Verkaufst du auch am Markt …“ und Knopf „Verkauf eintragen“. |
| Fehler-Karte getönt, kleiner Knopf | alle, Bild 6 | B | Board. | G6. |
| Link „Region“ ohne Unterstrich; Fokus frisst Leerzeichen | alle | B | Board. | `Textlink`, Leerzeichen außerhalb des Links, Punkt am Satzende. |
| Leere Links-Karte mit Knopf „Hof teilen auf Heute“ | alle | B | Board ohne Knopf. | Knopf weg; Fußsatz „Gezählt werden Besuche, keine Bestellungen.“ – „ohne Cookies“ darf im Satz bleiben. |
| „Konto · …“, Kürzel „HM“ | 1440 | C / R | Q1; PL „HM“. | – |
| „2.–8. Nov“ statt „1.–7. März“ | alle, Bild 4 | B | Monat ausgeschrieben. | „2.–8. November“. |
| Zeile „Deine Zahlen – … Region“ immer | 1440 | C | Board in sich uneinheitlich. | Board: Zeile in allen Bildern. |
| Beträge in „Was lief am besten“ fett | 1440 | B | Board. | normal. |

### beitraege

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Kopf: nur „← Beiträge“, Titel in der Karte, keine Brotkrumen | 390 | B | Board. | G1 mit Unterzeile „Mein Hof › Beiträge“. |
| Feste Leiste mit „Weiter …“ fehlt | 390 | B | Board. | G2 (mit „← Zurück“ darunter in Schritt 2/3). |
| Web: Karte mittig, Pillen-Zurück, kleine h1 | 1440 | B | Board. | Linksbündig, Textlink „‹ Beiträge“, große h1, Brotkrumen. |
| „Neuer Beitrag“ fehlt in Schritt 2/3 | alle | B | Board. | h1 in jedem Schritt. |
| „Zurück“ als kleiner Link oben | alle, Bild 3/4 | B | Board. | Handy unter dem Hauptknopf, Web umrandet links neben dem Hauptknopf. |
| Fokus am Zurück-Knopf | 1440 | C | Q3. | – |
| Anlass als 2×2-Kacheln mit Symbolen | alle | B | Board. | Einzeilige Chips ohne Symbol. |
| „Inhalt erstellen“ als Unterzeile | alle | B | Board. | Abschnittsüberschrift. |
| Zähler „27/80“ | alle | C | Fertige Funktion (Längengrenze). | Board ergänzen. |
| „(freiwillig)“ statt „(optional)“ | alle | C | Hausstil „freiwillig“ (überall in der App, z. B. Kasse „Notiz … (freiwillig)“). | Board: „(freiwillig)“. |
| Produkt-Chips mit Preis, klein, blass | 1440 | B | Board. | Nur Name, kräftige Schrift. |
| Feldfehler klein, nicht fett; Platzhalter im leeren Feld | alle, Bild 2 | B | Board, V17. | G6; Platzhalter weg. |
| Empfänger-Karten mit Symbol und Haken-Kreis | alle, Bild 3 | B | Board. | Checkbox links, kein Symbol. |
| Hinweis in grauem Kasten | alle, Bild 3 | B | Board. | Einfacher Text. |
| „Vorschau ansehen →“ mit Pfeil | alle | B | Board. | Ohne Pfeil. |
| Vorschau: Marke über dem Titel, „{Vorname}“, winzige Chip-Schrift | alle, Bild 4 | B | Board; Vorschau soll zeigen, wie es ankommt. | Beispielname einsetzen („Hallo Anna!“), Hinweis „Name wird je Person eingesetzt“ klein darunter; keine Marke. |
| Produkt in der Vorschau als kleine Marke | alle, Bild 4 | B | Board. | Umrandete Pille „Bergkäse · € 6,58“. |
| Empfänger-Block grau, Haken im Kreis | alle, Bild 4 | B | Board. | Weiße Karte, Kopf „EMPFÄNGER“, Haken „✓“. |
| Schrittzeiger mit Linien, erledigt dunkel | 390 | B | Board. | Ohne Linien, zentriert, erledigt grün mit Haken. |
| „Konto · …“ | 1440 | C | Q1. | – |

### einstellungen

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Fehlerkarte: kleiner Pillen-Knopf, getönt, kleine Überschrift | alle, Bild 2 | B | Board. | G6. |
| Kopf ohne Zurück-Pfeil und Leiste | 390, Bild 1/2 | B | Board. | G1. |
| Unterzeile „Hof Müller“ fehlt | 1440, Bild 2 | B | Board. | G1. |
| Zeile „Teilen-Hinweise“ zeigt Zustand | alle, Bild 1 | C | Übersicht zeigt sonst auch Werte (LFBIS, Tarif); Zustand hilft. | Board: „An · wir fragen einmal, ob du teilen willst“. |
| „Eigene Ernte (Primärproduktion) · LFBIS …“ | alle, Bild 1 | B | Board einfacher, ohne Fachwort. | „Futtermittel-Nummer (LFBIS) …“; beim BAES-Fall zusätzlich „BAES-Meldung …“. |
| „Gründungshof · ohne Grundgebühr bis …“ | 1440 | B | Wörtlicher Text Board. | „Gründungshof bis <Datum> · ohne Grundgebühr“. |
| „Konto · …“ | 1440 | C | Q1. | – |
| Spalten schmaler, Inhalt endet bei 1223 px | 1440 | B | Board. | Spaltenbreite nach Board. |
| Statuspunkt auf Höhe der Unterzeile | 390 | B | Board. | `items-center` zur Titelzeile. |

### hofdaten-zahlung

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Eine schmale Spalte statt zwei | 1440, Bild 1–3 | B | Board. | Zwei Spalten, Knopf rechts unten. |
| Feste Leiste „Hofdaten speichern“ fehlt | 390 | B | Board. | G2. |
| Kopf mit eigener Leiste, h1 darunter, ohne Hof-Unterzeile | 390 | B | Board. | G1. |
| Unterzeile fehlt, Rücklink grau | 1440 | B | Board. | G1. |
| Nach dem Speichern Sprung auf Einstellungen | alle, Bild 3 | R | Register N1: Einstellungs-Unterseiten führen nach dem Speichern zur Übersicht. | Board Bild 3: Übersicht mit Meldung zeigen. |
| Meldung hellgrün oben, überdeckt Inhalt; Kontrast zu schwach (axe) | alle, Bild 3 | B | Board, WCAG. | G7. |
| „Bitte prüfe das markierte Feld.“ fehlt | 390, Bild 2 | B | Board, V17. | G6. |
| PLZ-Fehlertext „mindestens 4 Ziffern“ | alle, Bild 2 | C | Land DE ist erlaubt (N8-Ergänzung), dort hat die PLZ 5 Ziffern; der Board-Satz wäre falsch. | Board: Code-Satz. |
| Fehlertext klein, nicht fett | alle, Bild 2 | B | Board, V17. | G6. |
| PLZ und Ort im Fehlerfall nebeneinander | 390 | B | Board. | Untereinander, wenn ein Fehler daran steht. |
| Kein Fokusring am Fehlerfeld | 1440 | B | Fokus muss sichtbar sein. | `FOKUS_RAHMEN` außen um den Fehlerrand. |
| Fehlerrand im Dunkeln dunkelrot | d | B | V17: orange. | Token `status-offen`. |
| Abschnittsüberschriften, Beschriftungen, Pillen-Felder | alle | B | Board. | Kicker in Großbuchstaben, Beschriftungen fett, Felder 10 px rund (G8). |
| „Auf der Karte suchen“ klein links | 1440 | B | Board. | Volle Breite, fett. |
| Karte mit Zoom unter „Auf der Karte suchen“ | 390, Bild 2 | C | Zeigt dem Hof den gefundenen Punkt. | Board ergänzen. |
| Kartentitel in Grundschrift, Marken unter der Beschreibung | alle, Bild 4/5 | B | Board. | Titel Serif, Marke rechts daneben. |
| Stripe-Text „Testbetrieb“, „Status prüfen“ | alle, Bild 4 | U | Stripe nicht verbunden (Z2). | – |
| Kasten „Richte deinen Hof …“ ganz oben, mit Hof-ID und Uhr | alle, Bild 5 | B | Board. | G3. |
| Hinweis-Text und Kartensatz zur Stripe-Einrichtung | alle, Bild 5 | U | Anderer Stand (nicht begonnen statt begonnen). | Mit begonnener Einrichtung nachprüfen. |
| Zusätzlicher Knopf „Status prüfen“ | 1440, Bild 5 | C | Fertige Funktion nach der Rückkehr von Stripe. | Board ergänzen (umrandet). |
| Knöpfe „Einrichtung fortsetzen“, „Lastschrift einrichten“ schmal | alle, Bild 5 | B | Board. | Volle Kartenbreite; Symbol „öffnet Stripe“ darf bleiben. |
| „Konto · …“ | 1440 | C | Q1. | – |

### konto-hof

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Kopf: Leiste „← Einstellungen“, große h1, ohne Hof-Zeile | 390 | B | Board. | G1. |
| Unterzeile fehlt, Rücklink grau | 1440 | B | Board. | G1. |
| Fehler beim Speichern nur als Meldung oben, ohne „Nochmal“ | alle, Bild 6 | B | N29, Board. | G6: Kasten in der Karte mit „Nochmal“, Fokus darauf. |
| Meldung verdeckt h1, halbdurchsichtig, grell rot | 390, Bild 6 | B | V17 orange; nichts verdecken. | G7 entfällt hier (Fehler inline). |
| Passwort falsch: Felder geleert, Kasten über dem Knopf, kein „Passwort vergessen?“ | alle, Bild 3 | B | Board; leere Felder zwingen zum Neutippen. | Feld „Aktuelles Passwort“ behält Eingabe, Fehler darunter, Link „Passwort vergessen?“. |
| Regelliste graue Punkte | alle, Bild 3 | B | Folgt aus dem Leeren. | Felder behalten Eingabe → Haken. |
| Karte „Anmelden mit Fingerabdruck oder Gesicht“ | alle, Bild 1 | R | Register E7-Ergänzung (Passkey für Höfe), DS. | Board: Karte oben. |
| Augen-Knöpfe | alle | R | PL: Passwort-Auge bleibt. | – |
| Unterzeile „Passwort für dein Agrilo-Konto“, Platzhalter, Trennlinie | alle | B | Board. | Weg. |
| Regelliste schon vor der Eingabe | alle | C | Hilft beim ersten Versuch. | Board: Liste mit leeren Kreisen. |
| Knopf „Passwort ändern“ schmal, ausgegraut, orange | alle | B | Board; deaktivierte Knöpfe sind schlecht bedienbar. | Heller Knopf mit Rand, volle Breite, immer bedienbar. |
| Symbole vor Kartenüberschriften | alle | B | Board. | Weg. |
| Anmelde-Adresse in derselben Zeile | 390 | B | Board. | Eigene Zeile, fett. |
| „Angemeldete Geräte“ als Karte mit Zähler und Symbolen | alle, Bild 2 | B | Board (neuer als system-h1-angemeldete-geraete). | Kicker, Liste, „Alle anderen abmelden“ außerhalb, heller Knopf. |
| Geräte-Hinweis mit Sicherheits-Zusatz, „angemeldet seit …“ | alle, Bild 2 | C | S18, hilft beim Erkennen fremder Geräte. | Board ergänzen. |
| „Darstellung“ als Segment mit Symbolen + Absatz | alle | B | Board. | „Gilt für dieses Gerät.“ + drei Chips (G11). |
| „Hof stilllegen“ drei Absätze | alle | B | Wörtlicher Text Board. | Board-Absatz. |
| Hinweis „offene Bestellungen“ neutral, nur Textlink | alle, Bild 4 | B | Board. | Titel fett, Warnfarbe; Knopf „Zu den Bestellungen“ volle Breite. |
| Knopf „Hof stilllegen“ trotz offener Bestellungen | alle, Bild 4 | B | Der Server lehnt ohnehin ab (`farm-archive.ts`); der Knopf führt ins Leere. | Knopf ausblenden, solange `getOpenOrdersCount > 0`. |
| „Konto löschen“ anderer Text, Textlink, Symbol | alle | B | Board (nennt die 7 Jahre Aufbewahrung). | Board-Text, Knopf „Support schreiben“. |
| „… sofort im Shop steht“ | alle, Bild 5/6 | B | Wortliste N42 „Hofseite“. | „… auf deiner Hofseite steht“. |
| „Wann wir fragen“ klein Sans, Listenpunkte grau | alle | B | Board. | Serif-Kartenüberschrift, Textfarbe. |
| Teilen-Symbol in der Schalterzeile | alle | B | Board. | Weg. |
| Fokus um die ganze Schalterzeile | 1440 | C | Zeile ist das Bedienelement. | Board ergänzen. |
| „Konto · …“ | 1440 | C | Q1. | – |

### kunden

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Kopf fehlt (Liste) bzw. anders (Kundin) | 390 | B | Board. | G1. |
| Profil in Karte, Marke unter dem Namen, „E-Mail“ bricht um | 390, Bild 3 | B | Board. | Profil frei, Marke daneben, drei Kontaktknöpfe in einer Zeile. |
| Karte „Neuigkeiten von dir“ fehlt | 1440, Bild 3 | B | Board; zeigt dem Hof, wer zugestimmt hat (S11-Daten vorhanden). | Karte mit E-Mail-/WhatsApp-Zustand rechts. |
| Kontakt und Lieblingsprodukte anders aufgebaut | 1440, Bild 3 | B | Board. | Beschriftung links, Wert rechts unterstrichen; Menge rechts („38 L“, „9×“). |
| Profilkopf in breiter Karte; Rücklink grau | 1440, Bild 3 | B | Board. | Frei auf dem Grund; G1. |
| Kennzahl-Kacheln zentriert | alle, Bild 3 | B | Board. | Beschriftung oben links, Wert darunter. |
| Bestellzeilen ohne Abholtermin | alle, Bild 3 | B | Board. | Fett „<Abholtag>, <Fenster>“, darunter Nummer · Positionen. |
| „Abbrechen“ oben fehlt (Blatt) bzw. unten (Dialog) | alle, Bild 2 | B | V11: ein Schließen-Element im Kopf. | „Abbrechen“ oben rechts, Startfokus darauf. |
| „Sortieren nach“ einspaltig, „Reihenfolge“ untereinander | alle, Bild 2 | B | Board. | Zweispaltig bzw. nebeneinander. |
| Gewählte Option und Knopf grün; Titel nicht in Versalien; Optionen normal | alle, Bild 2 | B | Hof orange (V51); Board. | Orange, Kicker, fett. |
| Vorauswahl „Anzahl Bestellungen“ | alle, Bild 2 | B | Board: „Letzte Bestellung“ zuerst ist der häufigste Blick. | Vorgabe „Letzte Bestellung, zuletzt zuerst“. |
| Suchfeld rechts neben „Sortieren“ | 1440 | B | Board. | Direkt nach den Chips. |
| Sichtbare Beschriftung „Kundin suchen“ | 1440 | C | Barrierefreiheit (sichtbare Beschriftung). | Board ergänzen. |
| „Sortieren“ mit „⇅“ | alle | B | Board. | Weg. |
| Avatare beige; Marke mit Rand | alle, Bild 1 | B | Board. | Grün getönt, grüne Schrift; Marke ohne Rand. |
| „Konto · …“ | 1440 | C | Q1. | – |
| Leer-Kasten zentriert mit Symbol | alle, Bild 4/5 | B | PL. | G4. |
| Freischalt-Hinweis über der h1, mit Hof-ID | alle, Bild 5 | B | Board. | G3. |
| Karte „Startphase“ | 1440 | U | Q4. | – |
| Fehlerzustand: Unterzeile fehlt, kleiner Knopf | alle, Bild 6 | B | Board. | G1 + G6. |
| Kein Fokus auf „Noch einmal versuchen“ | 1440 d, Bild 6 | B | Nach einem Ladefehler gehört der Fokus auf den Ausweg. | G6 setzt den Fokus. |
| Dialog-Hintergrund weichgezeichnet | 1440 | B | DS. | Abdunkeln ohne Weichzeichnen. |
| „Gepackt“ | alle | R | N9. | – |
| Maria Huber statt Anna Berger, Weizberghof | alle | U | Beispieldaten. | – |

### mein-hof

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| „Hof pausieren“ als Blatt unten statt Dialog | 1440, Bild 3 | B | V11 / N41 d. | `DialogMitte` ≤ 560 px. |
| Startfokus im Textfeld statt auf „Abbrechen“ | 1440, Bild 3 | B | Dialog mit orangem Hauptknopf: Fokus auf „Abbrechen“ (Regelvorschlag 239). | `initialFocus` = Abbrechen. |
| Pause-Texte anders, Schluss-Satz fehlt | alle, Bild 3 | B | Board; „Offene Bestellungen bleiben bestehen …“ ist wichtig. | Titel „Hof pausieren“, Feld „Nachricht an deine Kundschaft (freiwillig)“, Kasten „SO STEHT ES AUF DEINER HOFSEITE“ mit „…“, Schluss-Satz. |
| „Abbrechen“ unten statt oben | 390, Bild 3 | B | V11. | Oben rechts; Pause-Symbol am Knopf weg. |
| Bild 2 nicht gescrollt | 1440 | U | Aufnahmefehler. | – |
| Kopf und Reiter scrollen weg | 390, Bild 2 | B | PL: Kopf wie Board. | Kopf + Reiter `sticky`. |
| Postfach-Symbol fehlt | 390 | B | PL. | Siehe produkte. |
| Fortschritt als Karte „Noch 3 Punkte offen · 8 von 11“ | 390 | R | Register N4-Ergänzung: Karte „Noch n Punkte offen“ unter lg. | Board s1-mein-hof: Karte zeigen. |
| Fortschritt als Karte mit „Es fehlen noch …“ | 1440 | B | Ab lg gilt das Board. | Zeile „Noch n Punkt(e) offen“ mit flachem Balken. |
| Karte „Aktuell vom Hof“ oben | alle | B | Board: letzter Abschnitt. | Unter „Über uns“. |
| Abschnitte „AUFTRITT“ statt vier Gruppen | 1440 | B | Board und N4 (vier Gruppen nach Ort). | Gruppen „Oben auf der Seite“, „Aufbau und Fotos“, „Abholen und Bezahlen“, „Über uns“. |
| Zeilentitel anders | 390 | B | Board. | Titel wie Board („Titelbild und Logo“, „Name und Leitspruch“, …). |
| Erledigt-Häkchen fehlen | 390 | R | Register N4: unter lg keine Häkchen. | Board s1-mein-hof: Häkchen weg. |
| Marken „Fehlt“ statt „offen“ | alle | R | Register N4: Schilder nur „Fehlt“ und „Online fehlt“. | Board: „Fehlt“. |
| Kopier-Symbol in der Unterzeile | 1440 | C | N3: Kopieren bleibt ab lg. | Board ergänzen. |
| Vorsatz „Öffentlich ·“ fehlt | 1440 | B | Board. | Ergänzen. |
| Vorschau im Handy-Rahmen mit Kopfzeile, Rahmen läuft aus dem Bild | 1440 | B | Board. | Schlichte Karte, Segment „Handy | Web“ gefüllt, Höhe passt in den Bildschirm. |
| Gründungshof-Marke und „Nächste Abholung“ in der Kundenansicht fehlen | alle, Bild 6 | B | Hof ist laut Seitenleiste Gründungshof (K2: sichtbar); N5. | Kundenansicht nutzt denselben Kopf wie die Hofseite. |
| Kundenansicht: zusätzliche Kopfzeile, oranger Balken | 390, Bild 6 | B | Board, N4-Ergänzung (Band und „Fertig“). | Neutrales Band mit Serif-Titel, ohne Kopfzeile. |
| „Warenkorb“ blass | 390, Bild 6 | B | Board. | G10. |
| Zustand mit Beiträgen nicht gezeigt | alle, Bild 5 | U | Prüfhof ohne Beitrag. | – |
| Statuskarten im Dunkeln neutral | d | B | Board. | Grün/rostrot getönt mit farbiger Überschrift. |
| „Konto · …“ | 1440 | C | Q1. | – |
| Logo rund statt abgerundetes Quadrat | 390, Bild 6 | R | Freigabe §19 Nr. 98 (Logo rund). | Board: rund. |

### meldungen (Hof)

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Kopf Bild 1–3 und 4–6 anders | 390 | B | PL: feste Köpfe wie Board. | G1 (Titel in der Leiste, damit entfällt die doppelte h1-Regel aus Nr. 56). |
| Feste Leiste „Absenden“ fehlt | 390 | B | Board. | G2. |
| Fehler als Kasten oben statt am Feld | alle, Bild 2 | B | V17, Board. | G6. |
| Kein Fokus im Fehlerfeld | 1440, Bild 2 | B | Fokus ins erste Fehlerfeld. | G6. |
| Liste als einzelne Karten, ohne Pfeile, „Nr. …“, aufgeklappte Antworten | alle, Bild 4 | B | Board. | Eine Liste, Zeilen mit Art + Datum, Titel, Status, „›“; Antwort klappt in der Zeile auf („Antwort lesen“). Kurznummer nach G14. |
| „+ Neue Meldung“ in der Liste | 390, Bild 4–6 | C | Sonst kein Weg zur neuen Meldung von dieser Seite. | Board ergänzen. |
| „+ Neue Meldung“ und „Meldung schreiben“ im Leerzustand | 1440, Bild 5 | B | Zwei gleiche Aktionen. | Im Leerzustand nur „Meldung schreiben“. |
| Rücklink und Unterzeile fehlen | 1440 | B | Board. | G1. |
| Auswahl „Worum geht es?“ als Kacheln nebeneinander | 1440 | B | Board. | Drei Zeilen untereinander. |
| Reihenfolge Fehlernummer/Bildschirmfoto, Knopftext | alle | B | Board. | Bildschirmfoto zuerst, „+ Bildschirmfoto hinzufügen (optional)“. |
| Fehlernummer ohne Platzhalter, schmal | alle | B | Board. | „z. B. A7F3“, volle Breite. |
| Fokus auf erster Auswahl fehlt | 1440, Bild 1 | C | Q3. | – |
| Fokus auf „+ Neue Meldung“ | 1440, Bild 4–6 | C | Q3. | – |
| „Zu deinen Meldungen“ | alle, Bild 3 | B | Wortliste N8 „Meine Meldungen“. | „Meine Meldungen“. |
| „Deine Kurznummer: …“ | alle, Bild 3 | C | Hilft beim Nachfragen. | Board ergänzen. |
| Langer Gedankenstrich „—“ | alle | B | Hausstil „–“. | Wache auf „—“ in Nutzertexten. |
| Knöpfe schmal; Einleitungssatz über der Bestätigung | alle, Bild 3 | B | Board. | Beide volle Breite untereinander; Einleitung weg. |
| Leerzustand mit Rettungsring | alle, Bild 5 | B | PL. | G4. |
| Fehlerkasten klein, Einleitungssatz darüber | alle, Bild 6 | B | Board. | G6. |
| Ränder im Dunkeln kaum sichtbar, Fehlerkarte grünlich | d | B | Board. | G4/G6 dunkel. |
| Seitenspalte schmal, „Alle ansehen“ mittig, Brief-Symbol | 1440 | B | Board. | Nach Board. |
| Auswahlzeilen niedriger | 390 | B | Board. | 64 px. |
| Kasten „Das schicken wir automatisch mit“ | 1440 | R | DS (Board s2-meldungen zeigt ihn). | – |

### postfach

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Kopf (Nachricht und Liste) | 390 | B | Board. | G1. |
| Team-Antwort von der Antwort-Leiste verdeckt | 390, Bild 3 | B | V28. | Abstand unten = Höhe der Antwort-Leiste. |
| Listenzeile anders | alle, Bild 1 | B | Board. | Kopfzeile „Absender · Datum (· Wichtig)“, Betreff fett mehrzeilig, „›“. |
| „Du hast geantwortet“ als Chip | alle | B | Board. | Graue Unterzeile. |
| „Problem melden“ im Fußtext ohne Link | alle | B | Board. | Grüner Textlink. |
| Leer-Zustand zentriert mit Symbol, anderer Text | alle, Bild 5 | B | PL; Board. | G4 mit „… und als Karte auf Heute.“ und „Alle Nachrichten zeigen“. |
| Fehler ohne Überschrift, Satz fehlt | alle, Bild 6 | B | Board. | G6. |
| Knopf „Ansehen“ | alle, Bild 2–4 | B | Board nennt das Ziel. | Knopftext aus dem Ziel („<Seitenname> ansehen“), eine Zuordnung Route → Name. |
| Blase mit Absenderzeile, Uhrzeit außerhalb | alle | B | Board. | Uhrzeit in der Blase „8:10 · auch per E-Mail“. |
| „auch per E-Mail“ fehlt | alle, Bild 4 | B | Board; Daten da (Haken Betriebsmitteilung). | Ergänzen. |
| Datumstrennung über der Blase | alle, Bild 4 | C | Hilft in langen Fäden. | Board ergänzen. |
| Eigene Antwort satt grün | alle, Bild 3 | B | Board. | Zart grün getönt, dunkle Schrift. |
| „· gelesen“ fehlt | alle, Bild 3 | B | Board; Lesestand des Teams ist gespeichert (`gelesenBis`). | Ergänzen. |
| Hinweis „nicht antworten“ anders | alle, Bild 4 | B | Board. | Grau gefüllt, Link unterstrichen ohne Anführungszeichen. |
| Pillen-Zurück | 1440 | B | Board. | G1 Textlink. |
| Überschrift der Nachricht größer | 1440 | B | Board. | Größe nach Board. |
| Schloss-Symbol | alle | B | Board. | Weg. |
| „Konto · …“ | 1440 | C | Q1. | – |
| Zähler „1“ an „Mehr“ | 390 | C | Zeigt, dass im Mehr-Blatt eine Nachricht wartet (DS Mehr-Blatt). | Board ergänzen. |
| Zähler an „Postfach“ nach Öffnen bzw. im Fehler | 1440 | B | Zähler muss nach dem Lesen fallen; im Fehler bleibt der letzte Stand. | Nach Öffnen `router.refresh` des Zählers; Zähler unabhängig vom Ladefehler der Liste. |
| Fokusring um „Alle“ abgeschnitten | 1440 | B | Fokus sichtbar. | Polster bzw. `FOKUS_RAHMEN_INNEN`. |
| Rand der Listenkarte im Dunkeln hell | d | B | Board. | `border` dunkel. |
| Absender-Symbol rund mit Keimling, Chip ohne Rand | alle | B | Board. | Grünes Quadrat; Chip mit Rand. |

### problem-melden (Kundschaft)

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Auswahl als schmale Kacheln | 1440 | B | Board. | Drei Karten untereinander, 64 px. |
| Karten mittig statt in der Inhaltsspalte | 1440 | B | Board. | Linksbündig, x = Fuß. |
| Kein Fokus sichtbar | 1440 | U | Aufnahme ohne Tab. | – |
| Kasten „Das schicken wir automatisch mit“ bei Hof-Sitzung | 1440, Bild 4 | B | Board s3; DS: die Kundin behält den Satz – das gilt für die Seite, auch mit Hof-Sitzung. | Auf /fehler-melden immer der Satz. |
| Fehlernummer auch bei „Ich hätte gern …“ | alle, Bild 3 | B | Board. | Feld nur bei „Etwas funktioniert nicht“. |
| Speicherfehler führt zur Seite „Fehler 500“ | alle, Bild 6 | B | N29: nie die ganze Fehlerseite. | Banner „Wir konnten deine Meldung gerade nicht speichern. Dein Text ist noch da …“ (G6). |
| Hilfetext zu eckigen Klammern | alle | B | Board s3; DS sieht ihn nur im Hofbereich vor. | Nur im Hofbereich. |
| Fehlernummer halb so breit | 1440 | B | Board. | Volle Breite. |
| „Mitgeschickt: Fehlernummer …“ | 1440, Bild 2 | C | Sagt genau, was mitgeht (Datenschutz). | Board ergänzen. |
| „Anmelden“ im Handy-Kopf | 390 | R | Q2. | – |
| Auswahlkarten 46 statt 64 px | 390 | B | Board. | 64 px. |
| „Bildschirmfoto“ mittig mit Kamera | alle | B | Board. | Linksbündig mit „+“. |
| Zeichenzähler linksbündig | alle | B | Board. | Rechtsbündig. |
| Beschriftungen nur erstes Wort fett | alle | B | Board. | Ganz fett. |
| Fuß mit Logo, breiter | 1440 | B | Board. | G11. |
| Auswahlpunkt im Dunkeln Ring statt gefüllt | d | B | Board. | Radio-Baustein dunkel. |
| Fußlinks nicht unterstrichen | 390 | B | Board. | G11. |
| Kurznummer „cmw4fc4j“ statt „4F8M“ | alle, Bild 5 | B | Board: kurz, groß. | G14 Kurznummer. |
| „Vertrag widerrufen“ im Fuß | alle | R | N39. | – |

### region

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Nur Liste mit „Liste / Karte“ statt Liste + Karte | 1440, Bild 1/2/5 | B | Board, N23 (Karte mit Namen an den Pins). | Zwei Spalten ab 1024 px, Inhalt bis 1400 px. |
| Gewählter Hof als Overlay mit „×“, Karte statt Liste | alle, Bild 6 | B | Register N23: Hofkarte am Pin geht als Bereich mit „Schließen“ auf. | Feld unter der Karte „1 · Hof am Bach · 4 km“ + „Schließen“; „Du“ rund mit Beschriftung. |
| Sortenzeile anders aufgebaut | 390, Bild 1 | B | Board. | „Name“ + Zeile „n Höfe · Spanne · Mitte“, „Deins“ rechts neben dem Pfeil. |
| Sortenname „Trinkmilch“ | 390 | C | Name aus der Taxonomie. | Board: Taxonomie-Name. |
| Aufgeklappt: Block je Hof, grüner Rahmen, ohne „1 weiterer Hof“ | alle, Bild 1 | B | Board. | Eine Zeile je Hof, Schluss „n weitere(r) Hof · Kaufen geht über die Hofseite.“, Rahmen neutral. |
| Umschalter „Hofladen / Futtermittel“ als Segment, orange | alle | B | Board. | G11 Chip-Gruppe. |
| Umkreis als Segment, „10 km 4“ | alle | B | Board; N23: jede Stufe nennt die Zahl. | Chips „10 km · 1“. |
| „Liste / Karte“ neben dem Hinweis; Hinweis ohne Punkt | 390 | B | Board. | Eigene Zeile unter dem Umkreis; Punkt. |
| Zeile „1 Hof hat noch keinen Standort …“ | alle | C | Hilfreich (wie /hoefe). | Board ergänzen. |
| Sorten-Chips aus der Taxonomie | alle, Bild 2/6 | C | Echte Daten. | Board ergänzen. |
| Zusätzliche Mengen-Zeile | alle, Bild 2/6 | C | Fertige Filterfunktion. | Board ergänzen. |
| Uhr-Symbol vor der Tage-Zeile | alle | B | Board. | Weg. |
| „10 Angebote · nur Höfe mit LFBIS-Nummer“ | 390, Bild 2 | B | Board zählt Höfe (E9-Wort „Höfe mit LFBIS-Nummer“). | „n Höfe mit LFBIS-Nummer“. |
| Hinweis ohne Umkreis | 1440 | B | Board. | „… im Umkreis von 25 km – du kaufst für deine Tiere.“ |
| Futterkarte anders, ohne Größenwahl | alle, Bild 2 | B | Board, Register N23 (Größenwahl, ein Knopf je Größe). | Titel Produkt, Hof + km, Abholzeile mit „Aufladen hilft der Hof“, „ab € … / kg“, Größe als Optionen, „Bestellen …“. |
| Schild „Futtermittelbetrieb · LFBIS … · laut Hof“ | alle | R | E9. | Board: Schild nach E9. |
| „Wo liegt dein Hof?“ als gestrichelter Leer-Kasten | alle, Bild 3 | B | Board. | G4, Knopf orange (Hof) volle Breite. |
| „So steht dein Hof …“ als volle Hofkarte | alle, Bild 3 | C | DS: `ProduktKurzliste` ist eine Gestalt, auch für die eigene Hofkarte in Region; der Hof sieht echt, was Kundinnen sehen. | Board: volle Hofkarte. |
| Fehlerkasten grau, kleiner Knopf | alle, Bild 4 | B | Board. | G6. |
| Leer-Zustand mit Symbol, anderer Text | alle, Bild 5 | B | PL; Board. | G4: „Gerade verkauft im Umkreis von 10 km kein Hof <Sorte>“, „Mit 25 km ist es 1 Hof.“, „Auf 25 km erweitern“. |
| Sorten-Chips im Leerzustand auf „Alle“ reduziert, Zählzeile | alle, Bild 5 | B | Board. | Chips bleiben mit gewählter Sorte; Zählzeile weg. |
| Kartenansicht am Handy mit allen Filterzeilen | 390, Bild 6 | B | Unruhig, Karte rutscht unter den Falz. | In der Kartenansicht nur Umkreis + „Liste / Karte“, übrige Filter im Knopf „Filter“. |
| Kartenausschnitt: „Du“ abgeschnitten, Marke verdeckt, Quelle oben | 390, Bild 6 | B | V91/V92. | Beschriftung nach innen, Zoom nicht über Pins, Quelle unten rechts. |
| „Konto · …“ | 1440 | C | Q1. | – |
| Kopf ohne Trennlinie | 390 | B | Board. | Kopfstreifen mit Linie. |
| Karten ohne Kacheln | alle | U | Kartendienst nicht erreichbar. | – |

### teilen

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Auswahl „Titelbild / Hofgalerie“ fehlt | alle, Bild 1/3 | B | Board; nützliche Wahl beim Teilen eines Fotos. | Zwei Radio-Karten, Vorgabe Hofgalerie; Ziel an die Upload-Aktion. |
| Knopf „In die Hofgalerie laden“ im Inhalt als Pille | 390 | B | Board. | G2. |
| Kopfleiste fehlt | 390/1440 | B | Board (Fokus-Seite ohne Shell). | Handy G1; Web Leiste mit Marke, „Geteilte Fotos“, „← Zu Heute“ rechts. |
| Knopf im Web volle Breite als Pille | 1440 | B | Board. | Schmal, linksbündig. |
| Fehlertext anders | alle, Bild 3 | B | N29, Board. | Board-Absatz mit „Keine Verbindung …“ und „Nochmal“. |
| Fehlercode „[S139]“ | alle, Bild 3 | C | DS: Kürzel in eckigen Klammern helfen bei „Problem melden“. | Board ergänzen. |
| „Nochmal“ volle Breite, neutral | alle, Bild 3 | B | Board. | Klein, linksbündig, Warnfarbe (G6). |
| Radius Fehlerkasten und Vorschaubilder | alle | B | Board. | G8. |
| Fotos im Dunkeln ungedämpft | d | B | DS: Fotos leicht gedämpft. | G12. |
| Fokus nach Erfolg auf dem Kopf-Link | 1440, Bild 2 | B | Nach dem Hochladen gehört der Fokus auf das Ergebnis. | Fokus auf „Zu Heute“ im Kasten. |
| Erklärtext kräftig, großer Zeilenabstand | alle, Bild 2 | B | Board. | Gedämpft, 1,45. |
| Spalte 450 statt 520 px | 1440 | B | Board. | 520 px. |

### verkaeufe

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Fehlerzustand im Dialog nicht sichtbar | 1440, Bild 3 | U | Aufnahme hat den Fehler nicht ausgelöst. | – |
| Kein „Nochmal“, längerer Text | 390, Bild 3 | C | Ein zweiter Versuch kann den Verkauf doppelt buchen und den Vorrat doppelt senken (D1); der Code-Satz schützt davor. | Board: Code-Satz, kein „Nochmal“. |
| Kastentext neutral statt Warnfarbe | 390, Bild 3 | B | V17. | G6 Farbe. |
| Kopf fehlt | 390 | B | Board. | G1. |
| Feste Leiste „Verkauf eintragen“ fehlt | 390 | B | Board. | G2. |
| Karte „Diese Woche“ mit Umsatzgrenze | alle | B | Doppelt zu Auswertung; Board ohne. | Weg; Grenze bleibt in Auswertung. |
| „Online“ / „Bar“ untereinander | 390 | B | Board. | Zweispaltig. |
| Web: drei Karten voll breit, keine rechte Spalte | 1440 | B | Board. | Zwei Karten links, rechte Spalte „Noch einmal eintragen“. |
| Abschnitt „Noch einmal eintragen“ fehlt | alle | B | Board; spart Tipparbeit. | Chips aus den letzten Einträgen je Kanal und Betrag. |
| Link „Auszahlungen bei Stripe ansehen“ fehlt | alle | B | Board. | Link unter den Karten (nur mit Stripe-Konto). |
| Listenzeilen anders (Symbol, Kanal-Chip, ohne Menge) | alle | B | Board. | Marke „Eingetragen“/„Bestellung“ unter dem Betrag, Titel „4× Bergkäse“, „Name · Nummer“. |
| Kanal „Hofladen“ statt „Ab Hof“ | alle | R | Freigabe: „Ab Hof“ wird nicht gebaut. | Board: „Hofladen“. |
| Bestätigung hellgrün oben, anderer Text, Kontrast | alle, Bild 4 | B | Board, WCAG. | G7; „Verkauf eingetragen · <Produkt>: noch n auf Vorrat“. |
| Blatt fast bildschirmhoch | 390 | B | DS: höchstens 86 %. | – |
| „Abbrechen“ oben fehlt; Datum als Auswahl | alle, Bild 2/3 | B | V11, Board. | Abbrechen oben rechts; Chip „Heute, <Wochentag> <Datum>“ unter dem Titel. |
| Kanal-Knöpfe mit Symbolen, „Anderer Weg“ als Chip | alle | B | Board. | Ohne Symbole; „Anderes“ als Textlink. |
| Chip „Anderes“ bei den Produkten | alle | C | Fertige Funktion (freie Position). | Board ergänzen. |
| Reihenfolge Vorrat vor Menge, Menge hinter Klappe | alle | B | Board. | Menge (schmal) + „Stück · Notiz ergänzen“, danach Vorrat. |
| Vorrat-Satz anders | alle | B | Board. | „<Produkt>: n auf Vorrat, danach m“. |
| Hinweis „Nur Verkäufe, die nicht über Agrilo …“ nur nach Scrollen; Fußleiste; verschwommen | 1440 | B | Board. | Dialog ohne Bildlauf in der Grundhöhe, kein Weichzeichnen. |
| Startfokus auf „Hofladen“ | 1440 | B | Board: der Betrag ist die erste Eingabe. | `initialFocus` Betragsfeld. |
| Betrag in Serif; Kasten-Rahmen | alle | B | Board. | Grotesk; nur Unterstrich. |
| Hinweis über der h1, Uhr, Hof-ID, Titel neutral | alle, Bild 5 | B | Board. | G3. |
| Leerzustand mit Überschrift, Symbol, Knopf | 1440, Bild 5 | B | PL; Board. | G4 mit zweitem Satz, ohne zweiten Knopf. |
| Karte „Startphase“ | 1440 | U | Q4. | – |
| Fehlerkarte klein; Kopf ohne Unterzeile | alle, Bild 6 | B | Board. | G6 + G1. |
| Knopf „Verkauf eintragen“ fehlt im Fehlerzustand | 1440 | B | Board. | Kopf-Aktion unabhängig vom Ladefehler. |
| „Konto · …“ | 1440 | C | Q1. | – |
| Knopf mit „+“ tiefer gesetzt | 1440 | B | Board. | Bündig neben der h1 (G1 Aktion rechts). |

### whatsapp-plakat

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Knopf „Öffnen“ je Zeile fehlt | alle, Bild 1 | B | Hauptaktion des Zustands (W1). | Gefüllt bei der nächsten Person, umrandet bei den übrigen. |
| Plakat anders aufgebaut | alle, Bild 3 | B | Board. | Zentriert, Wortmarke oben, Hof fett unter der Schlagzeile, QR mittig, drei Schritte nebeneinander. |
| Fußzeile mit Abholzeiten und Bar | alle, Bild 3 | C | Hilft am Aushang. | Board ergänzen. |
| Zusätzlicher Satz „Handy-Kamera …“ | alle, Bild 3 | B | Board. | Weg. |
| Feste Leiste „Drucken“ fehlt; „Plakat drucken“ oben | 390 | B | Board. | G2 mit „Drucken“. |
| Knopftext und Lage; Plakat zu breit | 1440 | B | Board. | „Drucken“ neben der h1, Vorschau ~420 px. |
| Schrift im Plakat bis 6,5 px | 390 | B | Nie unter 12 px. | Vorschau skaliert als Bild, nicht der Text. |
| Kopf ohne Brotkrumen, Pillen-Zurück | alle | B | Board. | G1 mit „Mein Hof › Beiträge“. |
| Zurück-Ziel „Heute“ | alle, Bild 3/4 | B | N1: Rückweg zur Elternseite (Beiträge). | Elternseite „Beiträge“. |
| Karte „DEIN BEITRAG“, Fortschrittsbalken | alle, Bild 1 | B | Board. | Nur Zeile mit Titel und „1 von 3 geöffnet / 2 ausstehend“. |
| Hinweis „WhatsApp öffnet sich …“ unter der h1 | alle | B | Board. | Unter der Liste. |
| Geöffnete Zeile: zwei Links, Haken statt Initialen | alle | B | Board. | „✓ Geöffnet“ oben rechts, ein Link „Doch nicht gesendet?“. |
| Einzelne Karten, getönt, Telefonnummer, Zähler blass | alle | B | Board. | Eine Karte mit Linien; „1 von 3“ fett, „2 ausstehend“ fett in Akzentfarbe; Nummer weg. |
| Inhalt mittig | 1440 | B | Board. | Linksbündig an der Seitenleiste, 670 px. |
| Leer-Kasten ohne Überschrift, mit Symbol | alle, Bild 2 | B | PL; Board. | h1 „WhatsApp versenden“ + Zeile; G4. |
| Hinweis über dem Kopf, Hof-ID, Uhr | alle, Bild 4 | B | Board. | G3. |
| Einleitungstext und Kasten mit Drucker-Symbol | alle, Bild 4 | B | Board. | Einleitung weg; G4. |
| „Konto · …“ | 1440 | C | Q1. | – |

### abmelden

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| „Anmelden“ im Handy-Kopf | 390 | R | Q2. | Board ergänzen. |
| Fußlinks nicht unterstrichen | 390 | B | Board. | G11. |
| Abstand Karte → Fuß 40 statt 10 px | 390 | B | Board. | Abstand nach Board (Fuß-Baustein). |
| „Warenkorb“ dünn | 390 | B | Board. | G10. |
| Logo im Fuß, Fuß breiter | 1440 | B | Board. | G11. |
| Fokusrahmen abgerundet | 1440 | C | Q3. | – |
| „dieses Hofs“ statt Hofname | alle | U | Ungültiges Prüf-Token. | – |
| Bild 2 nicht prüfbar | alle | U | Signierter Link. | – |

### anmelden

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Knopf „Anmelden“ im Kopf der Anmeldeseite | 390, Bild 1/2 | B | Auf der Anmeldeseite selbst führt er nirgends hin; N1 gilt sinngemäß nicht. | Auf /login und /register im Kopf weglassen. |
| Passwort-Auge | alle | R | PL. | Board ergänzen. |
| Rote Feldrahmen bei „E-Mail oder Passwort falsch“ | alle, Bild 2 | B | Board; der Fehler gehört zu keinem einzelnen Feld. | Nur Hinweis-Kasten. |
| Hinweis-Kasten fast Pillenform | alle | B | Board. | G8. |
| Fuß mit Logo, breiter | 1440 | B | Board. | G11. |
| Trennlinie unter „Admin-Anmeldung“ fehlt | 390 | B | Board. | Linie. |
| „Warenkorb“ blass, Knopf größer | 390 | B | Board. | G10. |
| Karte „Mit Ersatzcode“ stärker gerundet | alle | B | Board. | G8. |
| Marke „Admin“ mit Rand | alle, Bild 3/4 | B | Board. | Flächig ohne Rand. |
| Fokus auf E-Mail der Kunden-Karte | 1440 | U | Board hat die E-Mail vorbelegt. | – |
| Passkey-Knopf und Einleitung anders gesetzt | 390 | B | Board. | Schrift nach Board. |
| Beispiel-E-Mail | alle | U | Beispieldaten. | – |

### fehlerseiten

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Kopf „Heute“ fehlt auf der Hof-Fehlerseite | 390, Bild 5 | B | Board; der Hof soll wissen, wo er ist. | Fehlergrenze im Hofbereich rendert den Seitenkopf mit. |
| Kunden-Kopf mit Suchfeld, zwei Links, Personen-Symbol | 1440, Bild 4 | B | V12. | G9. |
| „Anmelden“ im Handy-Kopf | 390, Bild 1–3 | R | Q2. | Board ergänzen. |
| Personen-Symbol im Handy-Kopf | 390, Bild 4 | B | G9: „Mein Konto“ bzw. „Anmelden“ als Pille. | G9. |
| Zweitknopf mit schwachem Rand | alle | B | Board. | Rand `border-foreground/60`. |
| „Zum Hof“ statt „Zu Hof Müller“ | alle, Bild 3 | B | Board; Name ist aus der Adresse bekannt. | „Zu <Hofname>“. |
| Überschrift bricht zweizeilig bzw. anders um | 1440/390 | B | Board. | Breite/Größe nach Board, `text-wrap: balance`. |
| Logo im Fuß | 1440 | B | Board. | G11. |
| Fußlinks nicht unterstrichen | 390 | B | Board. | G11. |
| „Darstellung“ vom Warenkorb-Knopf verdeckt | 390 | B | V28. | G10 (Abstand unten). |
| „Konto · …“ | 1440, Bild 5 | C | Q1. | – |
| Beschriftung „Hof oder Produkt suchen“ | alle, Bild 1 | R | DS (A1, `SUCHE_BESCHRIFTUNG`, sichtbare Beschriftung). | Board ergänzen. |
| Suchfeld im Kopf 38 px | 1440, Bild 4 | B | Folgt aus G9. | Suchfeld im Kopf entfällt. |
| Bild 6 nicht herstellbar | alle | U | global-error. | – |

### kundenkonto

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Kopf angemeldet: Suchfeld, zwei Links, Personen-Knopf | 1440, Bild 3–5 | B | V12. | G9 mit „Mein Konto“ als Pille. |
| „Anmelden“ im Kopf der Anmeldeseite | 390, Bild 1/2 | B | Wie anmelden. | Weglassen. |
| Leerzustand mit durchgezogenem Rand | alle, Bild 5 | C | Board weicht hier von allen anderen Leerzuständen ab (sonst durchgezogen, Regel 4). | Board: durchgezogener Rand (G4). |
| Block „KONTO“ in Bild 5 | alle | C | Board 3/4 zeigen ihn; Lücke im Board 5. | Board 5 ergänzen. |
| Links „Code erneut senden“, „Andere E-Mail“ kleiner | alle, Bild 2 | B | Board. | 16 px, Abstand nach Board. |
| Ausgeschalteter Schalter zu blass | h | B | Kontrast (3:1 für Bedienelemente). | Schalter-Baustein: Knopf grau mit Kontur. |
| Rahmen der Löschen-Knöpfe blass | h | B | Board. | Kräftiger Rand `status-offen`. |
| Fußlinks / Fuß breiter mit Logo | 390/1440 | B | Board. | G11. |
| „angemeldet seit 6.11.“ statt „zuletzt heute“ | alle | C | Derselbe Geräte-Baustein wie beim Hof (siehe konto-hof). | Board: „dieses Gerät · angemeldet seit …“. |
| „Darstellung“ verdeckt | 390 d | B | V28. | G10. |
| Passwort-Auge | 1440 | R | PL. | – |
| Schalter kleiner; Personen-Symbol mit Kreis | 390 | B | Board. | Schalter-Maß nach Board; Symbol ohne Kreis. |
| „Überall abmelden“ | alle | R | S18. | – |

### neuigkeiten

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Variante „Link abgelaufen“ nicht aufgenommen | alle, Bild 4 | U | Prüf-Token nur „ungültig“. | Prüf-Seed mit abgelaufenem Token. |
| Hinweis-Kasten zu rund | alle | B | Board. | G8. |
| Kastentitel größer | alle | U | Andere Variante mit längerem Text. | – |
| Spalte schmaler, Überschrift tiefer | 1440 | B | Board. | 520 px, Abstand nach Board. |
| „Vertrag widerrufen“ im Fuß nicht ausgerichtet | 1440 | B | Board. | G11. |
| Fokus Doppelring | 1440 | C | Q3. | – |
| Pfeil bei „← Zur Startseite“ nicht unterstrichen | 1440 | B | Board. | Pfeil im Link. |
| Bilder 1–3 nicht prüfbar | alle | U | Signierte Links. | – |

### passwort

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Leeres Formular zeigt schon einen Fehler | 1440, Bild 3 | B | Fehler erst nach dem Absenden. | Prüfung beim Absenden bzw. nach dem Verlassen des Feldes. |
| „Für dein Agrilo-Konto.“ fehlt | alle, Bild 3/4 | B | Board. | Unterzeile. |
| Augen-Knöpfe | alle | R | PL. | Board ergänzen. |
| Fokus auf „Neues Passwort“ mit markiertem Inhalt | 1440, Bild 4 | B | Fokus ins fehlerhafte Feld (G6). | – |
| Anforderungsliste klein und eng | alle | B | Board. | Schrift/Abstände nach Board. |
| Karten zu rund | alle, Bild 2/5 | B | Board. | G8. |
| Text größer, Link kleiner | 390, Bild 2 | B | Board. | – |
| Spalte 488 statt 520 px | 1440 | B | Board. | 520 px. |

### rechtstexte

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Impressum: Fließtext und Pilotbetrieb-Kasten statt Karte mit UID/Firmenbuch/Aufsicht | alle, Bild 4 | R | Impressum-Inhalt liegt bei Recht (A001/A004). | Nach A004 Form wie Board. |
| Karte „Aktion 12 Gründungshöfe“ fehlt | 390, Bild 5 | P | Zahl der Plätze offen (Register K2 sagt 100, Boards 12). | Siehe P2. |
| Verzeichnis ohne Hervorhebung; gewählter Eintrag nicht sichtbar | 1440, Bild 1–3 | B | Board. | Aktiver Abschnitt grün fett, Spalte scrollt den Eintrag ins Bild. |
| Marke „Entwurf, Anwältin prüft“ fehlt | alle | C | V29: Mockup-Hinweise gehören nicht in die App; Stand-Vermerk regelt O4/F021. | Board: Marke in die Bildunterschrift. |
| „Anmelden“ im Handy-Kopf | 390 | R | Q2. | – |
| Impressum/Konditionen mittig, Fuß breiter mit Logo | 1440 | B | Board. | Linksbündig x ≈ 221; G11. |
| Fokus in Bild 6 / Bild 4 / Bild 5 | 1440 | U | Aufnahme (Fokus springt, Seite gescrollt). | – |
| Startfokus auf „Drucken/Speichern“ | 1440 | C | Q3. | – |
| Datenschutz-Verzeichnis: letzte vier ohne Nummer | 1440 | R | Wortlaut und Gliederung der Datenschutzerklärung (Recht). | – |
| Verzeichnis: Teil-Überschriften klein, Spalte scrollt intern | 1440 | B | Board. | Teil-Überschriften in Eintragsgröße; geschlossene Karte. |
| h1 zweizeilig, größer | 1440 | B | Board. | Größe nach Board. |
| Trennlinie nach „Kurz erklärt“ | 1440 | B | Board. | Weg. |
| „Hof registrieren“ volle Breite | 390, Bild 6 | B | Board. | Inhaltsbreite. |
| Bild 2 an #punkt-17 | 390 | U | Aufnahme. | – |
| Fußlinks / „Warenkorb“ | 390 | B | Board. | G11, G10. |
| Wortlaut 0.9, Servicegebühr (vorgerendert) | alle | R / U | Recht; Vorrendern. | – |

### registrieren

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Zustand „gerade registriert“ nicht gezeigt (/verify) | alle, Bild 3 | U | Aufnahme über /verify statt nach dem Absenden. | Aufnahme direkt nach der Registrierung. |
| Kopfleiste fehlt | 390, Bild 5 | B | Board. | G1. |
| Zustand „wartet auf Prüfung“ nicht gezeigt | alle, Bild 6 | U | Prüfhof mit 2 von 5. | – |
| „← Zurück“ fehlt | 1440, Bild 5 | B | Board. | G1. |
| Inhalt zu breit | 1440 | B | Board. | 1200 px. |
| Hinweis mit Hof-ID (bricht mitten im Wort), Uhr | alle, Bild 5 | B | Board. | G3. |
| Tarife-Karte mit Satz vor dem Stichtag | 1440 | U | Modell-Stand der Prüfung (vgl. Vorrendern). | Im Vorschau-Build nachprüfen. |
| Karte „Startphase“ | 1440 | U | Q4. | – |
| Orange auf „Mit Stripe einrichten“ statt auf „Weiter“ (Hofseite) | 1440 | B | N1: eine Hauptaktion, der nächste offene Schritt in der Reihenfolge. | Hauptknopf am ersten offenen Schritt. |
| Online-Zahlung-Text | 1440 | B | Wörtlicher Text Board. | Board-Satz. |
| Lastschrift-Text „ab dem Einzug“, „sie“ | 1440, Bild 6 | C | Genauer (N38: Einzugsbeginn je Hof) und grammatisch richtig. | Board: Code-Satz. |
| Link nicht unterstrichen, Symbol als Umriss | 1440 | B | Board. | `Textlink`, graue Scheibe. |
| „Anmelden“ im Kopf | 390, Bild 1 | B | Wie anmelden. | Weglassen; unten „Schon dabei? Anmelden“. |
| Hilfetext „Wird zu deiner Adresse …“ | alle | B | Board. | „Deine Adresse wird: agrilo.at/…“. |
| Passwort-Auge | alle | R | PL. | – |
| Seitenspalte Schritt 3 | 1440 | B | Board. | Board-Satz. |
| „Schon dabei?“ nur „Anmelden“ als Link | 1440 | B | Board. | Ganzer Satz ist der Link. |
| Fokus am Link in der Kopfleiste | 1440 | C | Q3. | – |
| Hinweis im Dunkeln in heller Grundschrift | d | B | Board. | G3. |
| „Mehr“ nicht aktiv | 390 | B | Board. | Aktiv auf /onboarding. |
| „Willkommen, Thomas“ | alle | R | PL. | – |
| „Konto · …“ | 1440 | C | Q1. | – |
| Hilfe-Karte: dünner Rahmen, Symbol, kein Unterstrich | 1440 | B | Board. | Kräftiger Rand, fett, ohne Symbol; Link unterstrichen. |
| „Vertrag widerrufen“ links außerhalb | 1440, Bild 3 | B | Board. | G11 (Ausrichtung an der Inhaltsspalte). |
| KONDITIONEN_UEBERGANG, AGB-Karte, Lastschrift-Pflichtkarte | alle | R | K1, O4, N38. | – |

### systemseiten

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| „Anmelden“ im Handy-Kopf | 390 | R | Q2. | Board ergänzen. |
| Fußlinks nicht unterstrichen | 390 | B | Board. | G11. |
| Karte zu rund, Zeilenabstand größer | alle | B | Board. | G8. |
| Fuß mit Logo, breiter, Karte 8 px versetzt | 1440 | B | Board. | G11. |
| Fokus Doppelring | 1440 | C | Q3. | – |
| Bilder 1–4 nicht prüfbar | alle | U | Signierte Links. | – |

### widerruf

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Auswahlgruppe statt Textfeld „Welche Artikel?“ | alle, Bild 2 | R | Register N39: ganze Bestellung oder einzelne Positionen. | Board: Auswahlgruppe. |
| Feld „Nachricht an den Hof (freiwillig)“ | alle, Bild 2 | C | Fertige Funktion. | Board ergänzen. |
| Hinweis unter E-Mail „… Eingangsbestätigung“ | alle, Bild 2 | C | Sagt, wofür die Adresse dient (Datenschutz). | Board ergänzen. |
| Seitentitel und Einleitung über der Bestätigung | alle, Bild 4 | B | Board. | Ausblenden nach dem Absenden. |
| Schritt-Liste anderer Wortlaut | alle, Bild 4 | R | Wortlaut zum Ablauf nach N39 prüft die Anwältin. | Board-Satz an Recht geben; bis dahin Code. |
| Zeilen Bestellung, Was, Name, Eingangsbestätigung | alle, Bild 4 | R | N39: Eingangsbestätigung mit Inhalt, Datum, Uhrzeit. | Board ergänzen. |
| Datum ohne Wochentag, mit „Uhr“ | alle, Bild 4 | B | V9. | „Mi, 3. März 2027, 19:40“. |
| „Anmelden“ im Handy-Kopf | 390 | R | Q2. | – |
| „Drucken oder speichern“ volle Breite | 1440 | B | Board. | Textbreit, links. |
| Karte breiter, Zeilenabstände größer | 1440 | B | Board. | 600 px. |
| Fehlerkasten zu rund | alle | B | Board. | G8. |
| Platzhalter „[Name, Anschrift … des Hofs]“ in der Belehrung | 390, Bild 4 | U | Fall ohne Link; fachlich an Recht melden (siehe P1-Hinweis). | – |
| „Vertrag widerrufen“, „Widerruf bestätigen“, Belehrung | alle | R | N39/N43. | – |
| Bilder 1/5 nicht prüfbar | alle | U | Signierte Links. | – |

### druck

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Fußzeile ohne „Preise inkl. Plattformgebühr.“ | 390/1440, Bild 1 | B | N38. | Satz voran. |
| Zeile „inkl. € … Servicegebühr“ unter dem Betrag | 390/1440, Bild 2 | B | Board; Papier zeigt nur den Betrag. | Zeile weg. |
| E-Mail bricht mitten im Wort | 390, Bild 1 | B | Board. | Umbruch nur an „@“ bzw. `overflow-wrap: anywhere` erst als letztes. |
| „Die nächste Abholung ist heute, Fr 6. Nov …“ unter „Heute keine Bestellungen“ | 390, Bild 3 | B | Wie bestellungen. | Nächstes Fenster mit Bestellungen nennen; Format „Sa, 6. März, 9–12 Uhr“. |
| Leiste „Zurück/Drucken“ | 1440 | U | Bildschirm- statt Druckansicht. | – |
| Kundenhinweis kursiv | alle | U | Daten. | – |
| Tabellenkopf normal | alle | B | Board. | Fett. |
| „Gepackt“ | alle | R | N9. | – |

### mail-betrieb

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Wochenmail mit sieben Zeilen und Fußnote | alle, Bild 4 | C | Fertige, für den Betrieb nützliche Übersicht. | Board neu nach der Code-Mail. |
| Erstattungs-Mail: Zeilen und Warnkasten anders | alle, Bild 3 | C | Die Mail hat einen anderen, echten Auslöser (Erstattung gescheitert) als das Board (24 h unbestätigt). | Board auf den echten Auslöser umzeichnen. |
| Speicher-Mail: 500 MB gegen 8 GB im selben Satz | alle, Bild 6 | B | Widerspruch. | Ein Grenzwert aus einer Quelle (N18, Plan), Satz nach Board „Die Messung von <Zeit> liegt über der Warnstufe 80 %: … von …“. |
| Speicher-Mail: Fließtext ohne größte Tabelle | alle, Bild 6 | B | Board; Daten sind auf Betrieb vorhanden. | „Größte Tabelle: <Name> (<Größe>). …“ |
| Knopf „Betrieb ansehen“ | alle, Bild 6 | B | Board. | „In Betrieb ansehen →“. |
| Fußnote zur Häufigkeit | alle, Bild 6 | C | Erklärt, warum die Mail kommt. | Board ergänzen. |
| Zeile „Fehlt noch“ fehlt, Hof ohne Ort | alle, Bild 1 | B | Board. | Ergänzen. |
| „Neue Fehlermeldung cmeldung“ | alle, Bild 2 | B | Kurznummer kaputt. | G14. |
| Ersatz-Serife | alle | U | Q5. | – |

### mail-hof-bestellung

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Rücktritts-Hinweis mit „§ 18 FAGG“ | alle, Bild 4 | B | Mail an den Hof, ohne Fachwort (CLAUDE.md §5); keine Rechtswirkung gegenüber der Kundin. | Board-Satz. |
| Einleitung ohne Kundinnen-Namen, mit Zeitpunkt | alle, Bild 4 | B | Board. | „<Name> ist von ihrer Bestellung <Nr> zurückgetreten: …“; Zeitpunkt in einer eigenen Zeile. |
| Bar-Mail ohne Frist | alle, Bild 2 | B | V87; PL: Bar-Mail an den Hof wird gebaut. | „<Name> bestätigt bis <Frist>. Erst dann packst du.“ |
| Gebühren-Satz unter „Bar zu kassieren“ | alle, Bild 3 | U | Anderer Fall (Prüfhof ohne Gründungsplatz). | Gründungshof-Fall im Vorschau-Build prüfen. |
| „Bar zu kassieren:“ mit Doppelpunkt | alle | B | Board. | Ohne. |
| Zeile „Kundin · Name · Telefon“ | alle, Bild 1–3 | C | Hof kann direkt anrufen. | Board ergänzen. |
| Produktzeilen „Name · Menge“ | alle | B | Board. | G14 Positionszeile. |
| Trennlinie unter „Abholung“ | alle | B | Board. | Linie. |
| „09:00–12:00 Uhr“ | 390 | B | Board/V9. | Stunde ohne führende Null. |
| Ersatz-Serife | alle | U | Q5. | – |
| Anbieterzeile im Fuß | alle | R | A001, Recht prüft. | – |

### mail-hof-konto

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Kasten „Du bist Gründungshof Nr. n …“ fehlt | alle, Bild 1 | B | Board; K2-Ergänzung (sichtbar). | Kasten, wenn ein Gründungsplatz vergeben ist. |
| Warnkasten „Klappt es in 14 Tagen nicht …“ fehlt | alle, Bild 3 | B | N38 (Sperre nach 14 Tagen) – der Hof muss die Folge sehen. | Warnkasten. |
| Text ohne Betrag | alle, Bild 3 | B | Board. | Board-Satz mit Monat und Betrag; der Satz „Bitte sorg für Deckung …“ darf als Handlung bleiben. |
| Ankündigung: Anrede, Gründungshof-Satz, Absätze | alle, Bild 2 | B | Board. | Board-Text. |
| „Antworten geht in der App …“ länger | alle, Bild 4/5 | B | Board. | „Antworten geht in der App, im Postfach.“ |
| Anbieterzeile | alle | R | A001. | – |
| Ersatz-Serife, Umbruch | alle | U | Q5. | – |
| Abstände enger | 390 | B | Board. | Mail-Layout-Polster nach Board. |

### mail-kauf

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Link „Dieselbe Bestellung nochmal aufgeben“ | alle, Bild 4 | B | PL: entfällt. | Link weg (auch O3 damit erledigt). |
| Positionsliste in der Änderungs-Mail fehlt | alle, Bild 6 | B | Board; Kundin muss sehen, was bleibt. | Zeilen vor „Neuer Betrag“. |
| Gebührensatz in der Bar-Bestätigung | alle, Bild 3 | R | N38 (Mails zeigen inkl. Gebühr), Recht prüft. | Board ergänzen. |
| Gebührensatz anders, ohne Satz zum Vertragspartner | alle, Bild 1/2 | R | N38-Satz; Board-Satz liegt bei der Anwältin. | – |
| Positionszeilen | alle | B | Board. | G14. |
| Frist „bis Mittwoch, 3. März …“ statt „bis heute“ | alle, Bild 2 | C | Eine Mail wird auch später gelesen; Tag und Datum sind eindeutig. | Board: „bis Mittwoch, 3. März, 09:40 Uhr“. |
| Adresse bricht um | 390 | B | Board. | Werte-Spalte breiter / Schrift nach Board. |
| Ersatz-Serife | alle | U | Q5. | – |
| Belehrung, Formular, Gewährleistung, AGB-Satz, Impressum-Zeile | alle | R | Recht vor Board. | – |

### mail-neuigkeiten

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Marke „Hinweis“ statt „Neuigkeit“ | alle, Bild 3 | R | Wortliste: Anlass heißt „Hinweis“, „Neuigkeit“ als Sache ist verboten. | Board: „Hinweis“. |
| „… und bestätige auf der Seite.“ | alle, Bild 1 | C | Sicherheit: Bestätigung erst auf der Seite, damit Mail-Scanner den Link nicht auslösen. | Board: Code-Satz. |
| „Hof Müller“ nicht fett | alle, Bild 1 | B | Board. | Fett. |
| Auftragszeile ohne Hofanschrift | alle, Bild 2/3 | R | V79 ist Vorschlag, Recht prüft (A001). | – |
| Anbieterzeile | alle | R | A001. | – |
| Absatz nicht gedämpft | alle, Bild 4 | B | Board. | Nebenschrift. |
| Fotofläche zu hoch | 1440, Bild 2 | B | Board. | 180 px. |
| Ersatz-Serife | alle | U | Q5. | – |
| „Abmelden“ bricht um | 1440 | U | Fensterbreite 600 px. | – |

### mail-sicherheit

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Knopf „Passwort zurücksetzen“ fehlt in der Sperr-Mail | alle, Bild 3 | C | Sicherheit: Warn-Mails ohne Handlungs-Link schützen vor Nachahmung; der Weg über „Passwort vergessen“ ist genannt. | Board: Knopf weg, Satz zeigen. |
| Sperr-Mail: Satzbau | alle, Bild 3 | B | Board. | „Für dein Hof-Konto wurde mehrmals …“; Zeit als „bis <Wochentag>, <Datum>, 09:15 Uhr“ (siehe mail-kauf). |
| Zusatzabsatz „Wir fragen dich nie …“ | alle | C | Schutz vor Phishing. | Board ergänzen. |
| Überschrift „Neue Anmeldung bei deinem Hof-Konto“ | alle, Bild 1 | B | Board. | „Neue Anmeldung“. |
| Grauer Absatz zum Knopf | alle, Bild 1 | C | Erklärt Link, Gültigkeit, Phishing-Schutz. | Board ergänzen. |
| „2.3. um 21:14“ | alle, Bild 1 | B | V9. | „Di, 2. März 2027, 21:14 Uhr“. |
| Code-Sperre: Satzbau | alle, Bild 2 | B | Board. | Board-Satz; Zeit wie oben. |
| Code-Sperre: Hinweis mit Zusatz | alle, Bild 2 | B + C | Board-Satz; Schutzsatz bleibt. | Board-Satz + „Gib Codes nie an andere weiter – wir fragen dich nie danach.“ |
| Adresse bestätigen: Überschrift und Text | alle, Bild 4 | B | Board. | Board-Text. |
| Fußsatz „24 Stunden“ statt „7 Tage“ | alle, Bild 4 | C | PL: 24 Stunden. | Board: „Der Link gilt 24 Stunden. Bis dahin meldest du dich mit der alten Adresse an.“ |
| Adresse geändert: neue Adresse nicht genannt | alle, Bild 5 | B | Board; der Inhaber sieht, wohin gewechselt wurde. | Neue Adresse nennen. |
| Abstand unter „Gerät“ | alle, Bild 1 | B | Board. | – |
| Anbieterzeile | alle | R | A001. | – |
| Ersatz-Serife | alle | U | Q5. | – |

### mail-storno

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Satz „Ist die Rückgabe bestätigt, kommt das Geld auf demselben Weg zurück.“ fehlt | alle, Bild 5 | P | Rechtliche Aussage zur Rückzahlung. | Siehe P1. |
| Hinweis „Bei schnell verderblicher Ware gilt das Rücktrittsrecht meist nicht …“ fehlt | alle, Bild 5 | P | Rechtliche Aussage an Verbraucherinnen. | Siehe P1. |
| „nicht rechtzeitig bestätigt“ ohne Frist | alle, Bild 3 | B | Board, V87. | „… nicht bis <Wochentag>, <Datum>, <Uhrzeit> bestätigt.“ |
| „storniert“ statt „abgelaufen“ | alle, Bild 4 | B | Board; die Kundin versteht „abgelaufen“. | Wort nach Board. |
| „Mittwoch, … 19:40 Uhr“ | alle, Bild 5 | B | Board. | „Mi, 3. März 2027, 19:40“. |
| Ersatz-Serife | alle | U | Q5. | – |
| Anbieterzeile, zusätzliche Impressum-Zeile | alle | R | A001. | – |

### mail-team

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| Knopf „Admin-Zugang absichern“ fehlt | alle, Bild 3 | B | Hauptaktion der Einladung. | Knopf zur Passkey-Einrichtung. |
| Absendersatz „Gesendet am … aus …“ fehlt | alle, Bild 5 | B | Board. | Eigene graue Zeile. |
| Testmail: Überschrift und Fließtext | alle, Bild 5 | B | Board. | Board-Text. |
| Passkey-Mail: Überschrift und Text | alle, Bild 2 | B | Board, V9. | Board-Text mit Wochentag und Jahr. |
| Einladung: einladende Person fehlt | alle, Bild 3 | B | Board; schafft Vertrauen. | „<Name> hat dich … aufgenommen.“ |
| Einladung: Satz „in den nächsten 24 Stunden …“ | alle, Bild 3 | C | Nennt die Frist. | Board ergänzen. |
| Hinweis „Inhaberin oder Inhaber“ statt „Projektleitung“ | alle, Bild 3 | C | Rollen nach N35. | Board: Code-Satz. |
| Schriftwechsel in Zeile 2 | 1440, Bild 3 | B | Fehler. | Eine Schrift im Absatz. |
| Empfänger-Mail länger, Person fehlt | alle, Bild 4 | B | Board. | Board-Text, Person nennen. |
| „10 Minuten und nur in der Sitzung“ | alle, Bild 1 | C | Echte Regel im Code. | Board: Code-Satz. |
| Anrede ohne Name; gerades Anführungszeichen | alle, Bild 1 | B | Board. | „Hallo <Name>,“; typografisch. |
| Code ungeteilt | alle, Bild 1 | B | Lesbarkeit in der Mail. | „482 917“ (nur Anzeige). |
| Rechte-Liste Einzug | alle, Bild 3 | B | Board. | Listen-Einzug. |
| Anbieterzeile | alle | R | A001. | – |
| Ersatz-Serife | alle | U | Q5. | – |

### mail-zugang

| Mangel | Fassung | Entsch. | Begründung | Umsetzung / Board-Korrektur |
|---|---|---|---|---|
| „Hallo, … dein Konto“ | alle, Bild 3 | B | Board. | „Hallo <Name>, … dein Hof-Konto“. |
| Anbieterzeile | alle | R | A001. | – |
| Ersatz-Serife | alle | U | Q5. | – |

---

## 3. Am Ende

### 3.1 Board-Korrekturen (alle C, dazu die R-Nachträge) – Auftrag für die Mockup-Dateien

Ort: `docs/mockups/redesign-2026-11/*.dc.html`, jeweils helle und dunkle Datei, s- und w-Fassung.

**Querschnitt (alle betroffenen Boards):**
1. Seitenleiste aller Hof-Web-Boards: „Konto · Franz Müller“ (Q1).
2. Handy-Kopf aller Kunden-Boards außer Anmelde-/Registrierseite: Marke + „Anmelden“-Pille (Q2, N1); auf Hof- und Produktseite oben vor dem Hof-Kopf, nicht fest.
3. Fokus-Bilder: Fokus in der Form `FOKUS_RAHMEN` (abgerundet, doppelt); auf Seiten am ersten Element in Tab-Reihenfolge (Kopf/Rückweg), in Dialogen nach DS (Q3).
4. Seitenleisten-Karte „Startphase“ nicht als Mangel werten (Q4) – keine Zeichnungsänderung, Vermerk in der Bildunterschrift.
5. Futter-Schild überall „Futtermittelbetrieb · LFBIS … · laut Hof“ (E9) und Futter-Hinweis nach E10a wörtlich (produkt, hofseite, region).
6. „Gepackt“ im Hofbereich, „Abholbereit“ bei der Kundin (N9) – s2-bestellung, s1-bestaetigung.
7. Leerzustände durchgezogen, ohne Symbol (kundenkonto Bild 5 angleichen).

**Je Board:**
- mehr-neu: Postfach-Karte nach N12 statt Zeile; „Ausblenden“ an „Zu tun“; Fokus am Schließen im Blatt.
- hoefe: Kasten „… Ort ändern“; Kategorie-Chips aus der Taxonomie; Code-Satz zur Reihenfolge; Hinweis „kein Kartenpunkt“; Häufchen bei vielen Höfen; Löschen-× im Feld; gewählte Listenkarte getönt; Chips 36 px; „Darstellung“ im Fuß.
- startseite: Startseiten-Fuß am Handy (N22).
- hofseite: Bild 4 bis „Über uns“; Block Abholzeiten am Handy (N5); Futter-Hinweis in der Warenkorb-Karte.
- produkt: Kennzeichnung mit acht Zeilen; Minus bei Menge 1 gedämpft; Futter-Hinweis in der Seitenspalte.
- bestaetigung: Neuigkeiten-Karte ohne „Höchstens zweimal“, mit DOI- und Datenschutz-Satz; Frist mit Wochentag (V9); Bild 1 wie Bild 2 (Link, Karten); „Abholbereit“.
- kasse: Grafik dunkel ungedämpft; Platzhalter in der Notiz am Handy.
- meine-bestellungen: „Andere E-Mail-Adresse“; Code ohne Leerzeichen.
- bestellung: „‹ Bestellungen“; „Abholzettel drucken“; Fokus am auslösenden Knopf; Ring um die Packlisten-Zeile; Tönung der gewählten Zeile; „Gepackt“.
- bestellungen: Fokus an der Kopf-Aktion.
- heute: „Was gibt’s Neues am Hof?“ nach „Teilen“; Packliste ohne Uhrzeit, mit Kurzname; AGB-Karte nach der Umschaltung; „Ausblenden“; „€ 0,00“.
- produkt-neu: als Dialog ohne Vorschau rechts (N41); Einheit-Auswahl, Paket-Schalter, Vorrat-Feld, „Nur saisonal“, Kurzbeschreibung, Kategorie-Zeile, Vorschlag „Passt das?“, Futter-Chips Kategorie/Sorte, BAES-Fall, Rücktritt/Rücksendekosten (N39), Holz „Art“/„Trocknung“, Abholhinweise als Chips (N23).
- produkte: Zustandszeile (N3); Brennholz (0) unter „Braucht dich“ (N25); Kategorie-Vorschlag als Aktion; ohne Produkte keine Chips; Fokus an „Neues Produkt“.
- auswertung: Bild 3 Grenze-Karte wie Bild 2; Vergleichsbalken und Legende; „Noch € … Spielraum“; Region-Zeile in allen Bildern.
- beitraege: Zähler „27/80“; „(freiwillig)“; Fokus am Rückweg.
- einstellungen: Zeile „Teilen-Hinweise“ mit Zustand.
- hofdaten-zahlung: Bild 3 als Übersicht mit Meldung (N1); PLZ-Satz „mindestens 4 Ziffern“; Karte nach der Suche; „Status prüfen“.
- konto-hof: Passkey-Karte (E7); Passwort-Auge; Regelliste vor der Eingabe; Geräte-Zusatz und „angemeldet seit“; Fokus um die Schalterzeile.
- kunden: sichtbare Beschriftung „Kundin suchen“.
- mein-hof: Karte „Noch n Punkte offen“ am Handy (N4); keine Häkchen unter lg; Marken „Fehlt“; Kopieren ab lg; Logo rund.
- meldungen: „+ Neue Meldung“ in der Liste; Kurznummer in der Bestätigung; Fokus nach Q3; Kasten „Das schicken wir automatisch mit“.
- postfach: Datumstrennung; Zähler an „Mehr“.
- problem-melden: „Mitgeschickt: Fehlernummer …“.
- region: Taxonomie-Namen und -Chips; Mengen-Zeile; Zeile „kein Standort“; volle eigene Hofkarte; Schild E9.
- teilen: Fehlercode in eckigen Klammern.
- verkaeufe: Fehler ohne „Nochmal“, mit Code-Satz; Chip „Anderes“ bei Produkten; Kanal „Hofladen“.
- whatsapp-plakat: Fußzeile mit Abholzeiten und Bar.
- anmelden, passwort, registrieren, kundenkonto: Passwort-Auge.
- kundenkonto: Block „KONTO“ in Bild 5; „angemeldet seit“.
- fehlerseiten: Beschriftung über dem Suchfeld (A1).
- rechtstexte: Marke „Entwurf, Anwältin prüft“ in die Bildunterschrift; Datenschutz-Verzeichnis wie Code.
- registrieren: Lastschrift-Satz „ab dem Einzug … sie“; „Willkommen, Vorname“.
- widerruf: Auswahlgruppe (N39); Feld „Nachricht an den Hof“; Hinweis unter E-Mail; Zeilen der Eingangsbestätigung.
- mail-betrieb: Wochenmail nach Code; Erstattungs-Mail auf den echten Auslöser; Fußnote zur Häufigkeit.
- mail-hof-bestellung: Zeile „Kundin · Name · Telefon“.
- mail-kauf: Frist mit Tag und Datum; Gebührensatz in der Bar-Bestätigung.
- mail-neuigkeiten: Marke „Hinweis“; „… und bestätige auf der Seite.“
- mail-sicherheit: Sperr-Mail ohne Knopf; Phishing-Sätze; „24 Stunden“.
- mail-team: Frist-Satz der Einladung; „Inhaberin oder Inhaber“; „10 Minuten und nur in der Sitzung“.

Erfolg ist erkennbar daran, dass der nächste Schluss-Durchgang diese Punkte nicht mehr als Mangel führt.

### 3.2 Gemeinsame Bausteine (B, mehrere Boards, gehören nach `src/components/ui/`)

| Nr. | Baustein | Was er festlegt | Boards |
|---|---|---|---|
| G1 | **Werkzeug-Kopf** (Ablösung von `UnterseitenKopf`, nach `ui/`) | Handy: feste Leiste 56 px, `bg-card`, Linie unten; links „‹“, daneben Titel (h1) und Unterzeile („Hof Müller · Stand …“ bzw. Elternseite/Brotkrumen), rechts optional eine Aktion (Telefon, Postfach). Web: grüner, unterstrichener Textlink „‹ <Elternseite>“, h1, Unterzeile „<Hof>“, Aktion bündig rechts. Name und Ziel weiter nur aus `elternseite`. Ersetzt die Regel „h1 sr-only, wenn Titel = Elternseite“. | auswertung, beitraege, einstellungen, hofdaten-zahlung, konto-hof, kunden, meldungen, postfach, verkaeufe, whatsapp-plakat, teilen, bestellung, registrieren, region, hoefe (Kopfstreifen) |
| G2 | **Feste Aktionsleiste am Handy** | Über der Unterleiste, ein Hauptknopf volle Breite, optional „← Zurück“ darunter; Inhalt endet darüber (V28). Im Web Knöpfe am Formularende (V47). | beitraege, hofdaten-zahlung, meldungen, verkaeufe, teilen, whatsapp-plakat |
| G3 | **Hinweiskasten / Hof-Balken** | Steht unter dem Seitenkopf in der Inhaltsspalte (nicht über der h1, nicht über die ganze Breite); Titel in `text-status-offen`, etwas größer, dunkel auf braun getönter Fläche; Radius 12 px; ohne Uhr-Symbol, ohne Hof-ID-Zeile und ohne Nachsatz (die Hof-ID steckt im vorausgefüllten Link „Frage zur Freischaltung stellen“). `HofBalken` wird vom Werkzeug-Kopf (G1) bzw. Seitenkopf gerendert, die Quelle bleibt `ladeHofbereich`. | heute, bestellungen, produkte, hofdaten-zahlung, kunden, verkaeufe, whatsapp-plakat, registrieren |
| G4 | **Leerzustand ohne Symbol** (`EmptyState`) | Linksbündige Karte, durchgezogener Rand, Titel Grundschrift fett, ein Satz, ein Knopf mit Rand über die volle Breite (Hof: orange, wo Hauptaktion). Kein Symbol (PL), kein gestrichelter Rand. Register N9 nachziehen („Symbol“ streichen). | hoefe, startseite, bestellungen, produkte, auswertung, kunden, meldungen, postfach, region, verkaeufe, whatsapp-plakat, kundenkonto |
| G5 | **Größenkachel** | Radio links, Name „Sack, 25 kg“, darunter „€ 0,51 / kg · 14 da“ bzw. „gerade nicht da“, Preis rechts; auch leere Größe mit Preis. | produkt, region (Futterkarte) |
| G6 | **Formularfehler und „Nochmal“** | Feldfehler unter dem Feld, Rand orange, `aria-invalid`, Text in Fließtextgröße fett; Zusammenfassung oben „Bitte prüfe das markierte Feld.“; Fokus ins erste Fehlerfeld; Netzfehler als Kasten am Formular mit `NETZ_SATZ` + „Nochmal“ (N29), nur bei unsicheren Aktionen `NETZ_SATZ_UNSICHER` ohne Knopf. Knöpfe nie deaktiviert, Prüfung beim Absenden. | produkt-neu, hofdaten-zahlung, konto-hof, meldungen, problem-melden, beitraege, passwort, teilen, verkaeufe |
| G7 | **Meldung (Toast)** | Dunkler Balken unten über der Aktions- bzw. Unterleiste, verdeckt nie die h1, „Rückgängig“ als oranger Textknopf, Kontrast ≥ 4,5:1 in beiden Themes. | bestellung, hofdaten-zahlung, verkaeufe, konto-hof |
| G8 | **Rundungen in Pixeln** | Karten 12 px, Felder 10 px, Hinweise 12 px, Blätter 16 px – statt `rounded-xl/2xl`, die mit `--radius` wachsen. Als Wache (Regelvorschlag 233/236). | fast alle |
| G9 | **Kopf der Kunden-Shell** | Web in jedem Zustand nach V12: vier Links, rechts „Warenkorb · n“, Sonne/Mond, „Anmelden“ bzw. „Mein Konto“/„Mein Hof“ als Umriss-Pille; kein Suchfeld im Kopf. Handy: Marke + Pille (N1); auf /login, /register ohne Pille; auf Hof- und Produktseite scrollt er weg, nur der Hof-Kopf klebt. | fehlerseiten, kundenkonto, hofseite, produkt, alle Kunden-Boards |
| G10 | **Unterleiste der Kundschaft** | „Warenkorb“ fett in Textfarbe wie die anderen Wörter; Zähler grün mit hellem Ring; Abstand unten so, dass Seitenfuß und „Darstellung“ frei bleiben (V28). | hoefe, hofseite, meine-bestellungen, mein-hof, abmelden, anmelden, fehlerseiten, kundenkonto, rechtstexte |
| G11 | **Seitenfuß und Chip-Gruppe** | Fuß: Handy Fußlinks unterstrichen; Web ohne Logo, Breite = Inhaltsspalte, „Vertrag widerrufen“ in derselben Ausrichtung. Chip-Gruppe statt Segment für Zeitraum, Umkreis, Hofladen/Futter, Darstellung (aktiv dunkel/hell gefüllt, Zahl mit „ · “). | abmelden, anmelden, fehlerseiten, kundenkonto, systemseiten, rechtstexte, neuigkeiten, problem-melden, registrieren, auswertung, region, konto-hof |
| G12 | **Bilder im Dunkeln** | Alle Bildflächen und Platzhalter über `ui/bild-dunkel.ts` gedämpft (Titelbild, Produktbild, Vorschaubilder, Video). | hofseite, produkt, produkte, teilen, startseite |
| G13 | **Stepper und Diagrammfarbe** | Stepper als gerahmte Pille „− n +“ mit Einheit (Vorrat-Blatt, Menge). Diagramm-Balken dunkel in hellem Mint (`status-fertig` dunkel), Vergleichsbalken sichtbar. | produkte, produkt, mehr-neu, heute, auswertung |
| G14 | **Positionszeile und Kurznummer** | Eine Hilfe für „**4** × Heumilch frisch (1 L)“ in Packliste, Abholzettel, Mails und Verkäufen; eine Hilfe für die Kurznummer von Meldungen (groß geschrieben, aus derselben ID, Länge so, dass sie eindeutig bleibt – Board auf diese Länge angleichen). | bestellung, mail-hof-bestellung, mail-kauf, verkaeufe, meldungen, problem-melden, mail-betrieb |

Dazu je eine Hilfe für Geldsätze nach V1 („Du bekommst … · die Kundin zahlt …“, „Bar … erlassen“) aus `src/lib/plattformgebuehr.ts` – keine neue Rechnung, nur Anzeige, mit Test (produkt-neu, produkte, bestellung, auswertung, mail-hof-konto). Diese gehört nach `src/lib/`, nicht nach `ui/`.

Reihenfolge-Empfehlung für Lauf 32: G8 → G1 → G3 → G4 → G6 → G9/G10/G11 → G7 → G2 → G5/G13/G14 → G12, danach die Seiten. G1 und G3 allein tragen gut 20 Boards ein Stück weiter.

### 3.3 Punkte für die Projektleitung

**P1 · Rücktritts-Hinweise an Kundinnen (Produktseite, Storno-Mail)**
- Betrifft: Zeile „14 Tage Rücktrittsrecht ab Abholung – Details in den AGB.“ auf der Produktseite; in der Rücktritts-Bestätigung an die Kundin „Ist die Rückgabe bestätigt, kommt das Geld auf demselben Weg zurück.“ und „Bei schnell verderblicher Ware gilt das Rücktrittsrecht meist nicht – der Hof prüft das.“
- Warum P: Das sind Aussagen über Rechte von Verbraucherinnen (FAGG § 11, § 15, § 18). Eine pauschale Zeile kann bei ausgenommener Ware falsch sein, „meist nicht“ ist unbestimmt.
- Empfehlung: Die Produktseite bekommt die Zeile, aber aus den Angaben je Produkt (N39-Ergänzung, Nr. 214): „14 Tage Rücktrittsrecht ab Abholung – Details in den AGB.“ bei nicht ausgenommener Ware, „Kein Rücktritt: verdirbt schnell.“ bei ausgenommener. In der Storno-Mail den Satz zur Rückzahlung aufnehmen (§ 15 FAGG verlangt dasselbe Zahlungsmittel); den „meist nicht“-Hinweis weglassen und stattdessen die Angabe des Produkts nennen. Wortlaut vor dem Bau der Anwältin vorlegen. Dazu: Der sichtbare Platzhalter „[Name, Anschrift … des Hofs]“ in der Belehrung auf /widerruf ohne Link mit vorlegen.

**P2 · Zahl der Gründungsplätze auf der Konditionen-Seite**
- Betrifft: Karte „Aktion 12 Gründungshöfe“ im Board s3/w3-rechtstexte Bild 5; Register K2 nennt 100 Plätze, die Boards 12 (V39 „offen für die Projektleitung“).
- Warum P: Konditionen sind Vertragsinhalt und berühren Geld; die Zahl muss vor dem Tarifstart 1.2.2027 feststehen.
- Empfehlung: 12 Plätze festlegen (passt zu allen Boards, knapp und glaubwürdig im Pilot), als Ergänzung zu K2 ins Register; dann die Karte auf /konditionen bauen. Bis zur Entscheidung zeigt die Seite keine Aktion-Karte.

---

## Annahmen und Grenzen
- Der Code wurde nur dort gelesen, wo es die Entscheidung brauchte (Server-Sperre beim Stilllegen, Lesestand im Postfach, Herkunft der Futter- und Konditionen-Sätze, DS-Abschnitte). „Fertig und getestet“ ist bei den C-Funktionen aus dem Bericht und dem DS übernommen, nicht je Funktion durch Testlauf geprüft.
- Admin-Boards sind nicht abgenommen und hier nicht enthalten.
- Die Zählung zählt Tabellenzeilen; eine Zeile mit „B + C“ oder „C / R“ zählt beim ersten Buchstaben.
