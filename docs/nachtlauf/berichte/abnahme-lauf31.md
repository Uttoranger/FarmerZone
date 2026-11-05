# Abnahme Lauf 31 – Board × Fassung × Sterne

Stand: Gate A (Nr. 233a) auf `docs/lauf31` = main bf57d8d0. Bewertet von pruefer-ui (frischer Unteragent je Board, nur App-Bild, Board-Bild und Maßstab aus freigabe.md §35). Bilder: `.nachtlauf/screens/abnahme/<board>/<bild>-<breite>-<thema>.png` (App) und `…-board.png` (Board), im Container, nicht committet.

## So gemessen

- App: gebaute App (`pnpm build`, `next start`) gegen lokales Postgres mit Seed; je Fotografen-Gruppe eine eigene DB-Kopie (Zustände wie „pausiert“, „leer“, Fehler durch kurzes Umbenennen einer Tabelle, nach dem Stichtag `PlattformEinstellung.hofpreisModellAb` = 2026-10-01). Handy 390×844, Web 1440×900, Thema über `prefers-color-scheme`.
- Boards: jedes `figure` jedes Board-HTML im Browser gerendert (Fenster = ganze Board-Fläche).
- Messung je Seite und Fassung (Skript im Browser, agent-browser `eval`): sichtbare Texte < 12 px (ohne aria-hidden und SVG), Ziele < 44 px ohne ::before/::after (Inline-Links im Fließtext getrennt gezählt), sichtbare h1, Felder ohne sichtbare Beschriftung (Platzhalter oder aria-label allein zählen nicht); axe-core 4.12 über `agent-browser a11y`, nur „serious/critical“.
- Spalten „Schrift/Ziele/h1/Felder/axe“ = Zahl der Bild-Fassungen mit mindestens einem Befund; „n. e.“ = Bild-Fassungen, die nicht herstellbar waren (Grund in der Bewertung). h1 ≠ 1 ist oft ein Messartefakt bei offenem Blatt/Dialog (die Seite dahinter gilt dann als verdeckt).

## Ergebnis

| Board | Nr. | 390 hell | 390 dunkel | 1440 hell | 1440 dunkel | Schrift < 12 | Ziele < 44 | h1 ≠ 1 | Felder | axe | n. e. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mehr-neu | 233 | 3 | 3 | 2 | 2 | 0 | 6 | 6 | 0 | 0 | 0 |
| hoefe | 234 | 2 | 2 | 2 | 2 | 4 | 10 | 2 | 16 | 1 | 4 |
| startseite | 234 | 2 | 2 | 2 | 2 | 20 | 10 | 0 | 0 | 0 | 0 |
| hofseite | 235 | 2 | 2 | 2 | 2 | 0 | 14 | 0 | 12 | 0 | 0 |
| produkt | 235 | 2 | 2 | 2 | 2 | 12 | 12 | 0 | 8 | 0 | 0 |
| bestaetigung | 236 | 2 | 2 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| bestellung-link | 236 | 2 | 2 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| kasse | 236 | 2 | 2 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 4 |
| korb | 236 | 3 | 3 | 3 | 3 | 0 | 0 | 12 | 0 | 0 | 0 |
| meine-bestellungen | 236 | 3 | 3 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 16 |
| bestellung | 237 | 2 | 2 | 2 | 2 | 12 | 4 | 4 | 0 | 1 | 0 |
| bestellungen | 237 | 2 | 2 | 2 | 2 | 4 | 0 | 0 | 0 | 0 | 0 |
| heute | 237 | 2 | 2 | 2 | 2 | 0 | 20 | 0 | 0 | 0 | 0 |
| produkt-neu | 237 | 2 | 2 | 2 | 2 | 24 | 12 | 24 | 24 | 0 | 0 |
| produkte | 237 | 2 | 2 | 3 | 2 | 6 | 4 | 10 | 4 | 0 | 0 |
| auswertung | 238 | 2 | 2 | 3 | 3 | 20 | 0 | 0 | 0 | 0 | 0 |
| beitraege | 238 | 2 | 2 | 2 | 2 | 16 | 0 | 0 | 8 | 0 | 0 |
| einstellungen | 238 | 2 | 2 | 3 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| hofdaten-zahlung | 238 | 2 | 2 | 2 | 2 | 8 | 8 | 0 | 0 | 3 | 0 |
| konto-hof | 238 | 2 | 2 | 2 | 2 | 16 | 0 | 0 | 0 | 0 | 0 |
| kunden | 238 | 2 | 2 | 2 | 2 | 8 | 4 | 4 | 0 | 0 | 0 |
| mein-hof | 238 | 2 | 2 | 2 | 2 | 20 | 12 | 24 | 0 | 0 | 0 |
| meldungen | 238 | 2 | 2 | 2 | 2 | 4 | 0 | 6 | 8 | 0 | 0 |
| postfach | 238 | 2 | 2 | 2 | 2 | 16 | 2 | 0 | 0 | 0 | 0 |
| problem-melden | 238 | 3 | 3 | 2 | 2 | 0 | 0 | 4 | 4 | 0 | 0 |
| region | 238 | 2 | 2 | 2 | 2 | 20 | 4 | 0 | 0 | 0 | 0 |
| teilen | 238 | 2 | 2 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| verkaeufe | 238 | 2 | 2 | 2 | 2 | 12 | 0 | 8 | 8 | 2 | 0 |
| whatsapp-plakat | 238 | 2 | 2 | 2 | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| abmelden | 239 | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 4 |
| anmelden | 239 | 2 | 2 | 2 | 2 | 8 | 0 | 0 | 0 | 0 | 0 |
| fehlerseiten | 239 | 2 | 2 | 2 | 2 | 0 | 0 | 0 | 4 | 0 | 4 |
| kundenkonto | 239 | 2 | 2 | 2 | 2 | 8 | 4 | 4 | 0 | 0 | 0 |
| neuigkeiten | 239 | 2 | 2 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 12 |
| passwort | 239 | 3 | 3 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| rechtstexte | 239 | 3 | 3 | 3 | 3 | 0 | 8 | 0 | 0 | 0 | 0 |
| registrieren | 239 | 2 | 2 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 8 |
| systemseiten | 239 | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 16 |
| widerruf | 239 | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 2 | 8 |
| druck | 241 | 3 | – (Druck nur hell) | 3 | – (Druck nur hell) | 0 | 0 | 2 | 0 | 0 | 0 |
| mail-betrieb | 241 | 2 | – | 2 | – | 8 | 0 | 12 | 0 | 12 | 0 |
| mail-hof-bestellung | 241 | 2 | – | 2 | – | 4 | 0 | 6 | 0 | 6 | 2 |
| mail-hof-konto | 241 | 3 | – | 3 | – | 0 | 0 | 10 | 0 | 10 | 0 |
| mail-kauf | 241 | 2 | – | 2 | – | 4 | 0 | 12 | 0 | 12 | 0 |
| mail-neuigkeiten | 241 | 1 | – | 1 | – | 2 | 0 | 6 | 0 | 6 | 2 |
| mail-sicherheit | 241 | 2 | – | 2 | – | 0 | 0 | 12 | 0 | 12 | 0 |
| mail-storno | 241 | 2 | – | 2 | – | 4 | 0 | 12 | 0 | 12 | 0 |
| mail-team | 241 | 3 | – | 3 | – | 0 | 0 | 10 | 0 | 10 | 0 |
| mail-zugang | 241 | 3 | – | 3 | – | 0 | 0 | 8 | 0 | 8 | 0 |

Mails und Druck nur hell; bei Mails ist „1440“ die Kennung des Web-Boards (Mail 600 px breit).

### Admin (Nr. 240) – nicht abgenommen

Der Admin ist ohne Passkey nicht erreichbar (Seed-Konto ohne Passkey, `passkeyPflicht` → /admin/einrichten mit E-Mail-Code und Passkey). Nach Präzisierung 2 stehen diese Boards als „nicht abgenommen“ und fallen aus dem Fertig-Kriterium; kein Umweg in Code oder Daten.

| Board | Stand |
|---|---|
| admin-akte | nicht abgenommen – Admin ohne Passkey nicht erreichbar (Präzisierung 2) |
| admin-bestellungen | nicht abgenommen – Admin ohne Passkey nicht erreichbar (Präzisierung 2) |
| admin-betrieb | nicht abgenommen – Admin ohne Passkey nicht erreichbar (Präzisierung 2) |
| admin-einstellungen | nicht abgenommen – Admin ohne Passkey nicht erreichbar (Präzisierung 2) |
| admin-freischalten | nicht abgenommen – Admin ohne Passkey nicht erreichbar (Präzisierung 2) |
| admin-geld | nicht abgenommen – Admin ohne Passkey nicht erreichbar (Präzisierung 2) |
| admin-heute | nicht abgenommen – Admin ohne Passkey nicht erreichbar (Präzisierung 2) |
| admin-hoefe | nicht abgenommen – Admin ohne Passkey nicht erreichbar (Präzisierung 2) |
| admin-postfach | nicht abgenommen – Admin ohne Passkey nicht erreichbar (Präzisierung 2) |
| admin-shell | nicht abgenommen – Admin ohne Passkey nicht erreichbar (Präzisierung 2) |
| admin-startseite | nicht abgenommen – Admin ohne Passkey nicht erreichbar (Präzisierung 2) |
| admin-zugang | nicht abgenommen – Admin ohne Passkey nicht erreichbar (Präzisierung 2) |

### Befunde außerhalb der Optik (aus den Fotografen-Gruppen; nicht von pruefer-ui bewertet)

- Ladezeit Hofseite am Handy (390, hell, `/hof-mueller`, gebaute App, 5 frische Läufe, Rechner unter Last): FCP Median 860 ms, LCP 960 ms, h1 mit Hofname sichtbar nach 385 ms → Vorgabe „erste Inhalte ≤ 1 s“ erfüllt; 2 Ausreißer ~9,7 s (Tab malte spät). Die in der Ausgangslage genannten „über 2 s Skelett“ auf test.agrilo.at waren lokal nicht nachzustellen (Ursache vermutlich Netz/Kaltstart beim Hoster; dort nachmessen).
- `/fehler-melden`: Absenden in den ersten 3 s nach dem Öffnen zeigt „Danke“, ohne zu speichern (Bot-Bremse). Für Menschen selten, aber ein stiller Scheinerfolg – Rückfrage im Morgenbericht.
- `/problem-melden`: Ein Serverfehler führt auf „Fehler 500“ statt auf den Hinweis im Formular (Board Bild 6).
- Sicherheits-Mail Bild 4: Board nennt eine Frist von 7 Tagen, die Mail „24 Stunden und einmal“ – Frist ist Geschäftsregel, nicht Optik; Rückfrage im Morgenbericht.
- Mails: Die Vorschau-Dateien haben kein `<title>` und keine h1 (Messartefakt der Vorschau, keine Abweichung der Mail); h1- und axe-Spalte der Mails zählen nur das.
- Nicht herstellbar ohne echte Mail, Zahlung oder Netz: kasse Bild 4 (abgelehnte Online-Zahlung), meine-bestellungen 3–6 (Mail-Code), hoefe 3 (Ortssuche erreicht den Kartendienst nicht), abmelden 2, neuigkeiten 1–3, systemseiten 1–4, registrieren 4, widerruf 1 und 5 (signierte Links), registrieren 2 (Willkommenszeit G1 offen, nicht gebaut), fehlerseiten 6 (global-error nur bei kaputtem Root-Layout), mail-hof-bestellung 2 und mail-neuigkeiten 3 (Vorschau erzeugt den Fall nicht). Kartenkacheln laden im Container nicht.
- Impressum: Rahmen weicht vom Board ab; das Impressum fasst dieser Lauf nicht an (PR #448 offen, A001).

## Mängel je Board

### mehr-neu

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 3 | 3 | 0 |
| 390 dunkel | 3 | 3 | 0 |
| 1440 hell | 2 | 3 | 0 |
| 1440 dunkel | 2 | 3 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 1440 hell+dunkel · Bild 1/2/3 · Punkt 1 · Kopf der Seitenleiste fehlt: Board zeigt oben Logo „Agrilo“ und darunter die Karte „Hof Müller / Hofseite ansehen“; in der App fehlt das Logo, die Hof-Karte ist oben angeschnitten (beginnt bei y=0) · .nachtlauf/screens/abnahme/mehr-neu/1-1440-hell.png
- 1440 hell+dunkel · Bild 1/2/3 · Punkt 1 · Seitenleiste hat vor jedem Eintrag ein Symbol (Heute, Bestellungen, Postfach, Produkte, Mein Hof, Kunden, Verkäufe, Auswertung, Region, Einstellungen, Problem melden); Board zeigt reine Texteinträge ohne Symbole · .nachtlauf/screens/abnahme/mehr-neu/1-1440-hell.png
- 1440 dunkel · Bild 1/2 · Punkt 4 · Aktiver Eintrag „Heute“ ist eine helle cremefarbene Pille mit dunkler Schrift (heller Fleck im Dunkeln); Board: gedämpft dunkelgrüne Fläche mit heller Schrift · .nachtlauf/screens/abnahme/mehr-neu/1-1440-dunkel.png
- 1440 hell · Bild 1/2 · Punkt 4 · Aktiver Eintrag „Heute“ ist eine schwarze Pille mit weißer Schrift; Board: hellgrüne Fläche mit grüner Schrift · .nachtlauf/screens/abnahme/mehr-neu/1-1440-hell.png
- 390+1440 alle · Bild 1/2 · Punkt 6 · Board zeigt das Betreiber-Konto mit Eintrag „Admin“ und Zähler 3 (Handy: zwischen „Problem melden“ und „Darstellung“; Web: zwischen „Problem melden“ und „Konto · Franz Müller“); in der App fehlt „Admin“ ganz, der Zustand „Betreiber-Konto“ wurde nicht erreicht (Manifest: Konto ist kein Admin) · .nachtlauf/screens/abnahme/mehr-neu/2-390-hell.png
- 390 hell+dunkel · Bild 1/2 · Punkt 1+2 · Tarif-Karte anders aufgebaut und anders formuliert: Board zeigt grüne Marke „GRÜNDUNGSHOF“ mit Keimling und darunter „noch 11 Monate (bis 31. Jänner 2028) · Konditionen und Tarif“; App zeigt Stern-Symbol im Kästchen, Titel „Gründungshof“ und „ohne Grundgebühr bis 31. Dezember 2027“ (Satzbau und „Konditionen und Tarif“ fehlen) · .nachtlauf/screens/abnahme/mehr-neu/1-390-hell.png
- 1440 hell+dunkel · Bild 1/2/3 · Punkt 2 · Tarif-Karte der Seitenleiste: Board „noch 11 Monate (bis 31. Jänner 2028)“ mit Funkel-Symbol; App „ohne Grundgebühr bis 31. Dezember 2027“ mit Stern-Symbol · .nachtlauf/screens/abnahme/mehr-neu/1-1440-hell.png
- 390 hell+dunkel · Bild 1 · Punkt 1+6 · Zeile „Postfach“ ohne Unterzeile „1 neue Nachricht“ und ohne Zähler-Marke; Board zeigt beides (möglicherweise nur Datenstand, aber der Board-Zustand mit neuer Nachricht ist nicht gezeigt) · .nachtlauf/screens/abnahme/mehr-neu/1-390-hell.png
- 390 hell+dunkel · Bild 1/2 · Punkt 1 · Blatt „Mehr“ reicht fast bis an den oberen Rand (Oberkante ca. y=35); Board lässt oben den Seitenkopf „Heute / Datum“ mit Postfach-Symbol abgedunkelt sichtbar (Oberkante ca. y=140); damit ist in der App keine Seitenüberschrift zu sehen · .nachtlauf/screens/abnahme/mehr-neu/1-390-hell.png
- 390 hell+dunkel · Bild 1/2/3 · Punkt 1 · Blatt ist schmaler als der Bildschirm: rechts ein ca. 15 px breiter Streifen des Hintergrunds neben dem Blatt; Board: Blatt über die volle Breite · .nachtlauf/screens/abnahme/mehr-neu/3-390-hell.png
- 390 hell+dunkel · Bild 1/2 · Punkt 1 · Listenzeilen sichtbar niedriger (ca. 51 px statt ca. 56 px) und Beschriftungen („Kunden“, „Verkäufe“, „Einstellungen“ …) in normaler statt fetter Schrift wie im Board · .nachtlauf/screens/abnahme/mehr-neu/1-390-dunkel.png
- 390 hell+dunkel · Bild 3 · Punkt 1 · Karten „Lebensmittel“ … „Verkauf eintragen“ niedriger (ca. 64 px statt ca. 74 px), Titel weniger fett; Hintergrundseite unscharf verwischt statt nur abgedunkelt wie im Board · .nachtlauf/screens/abnahme/mehr-neu/3-390-hell.png
- 1440 hell+dunkel · Bild 3 · Punkt 1 · Menü „Was legst du an?“ schmaler (ca. 288 px statt ca. 335 px, Board ragt über den Rand der Seitenleiste) und dichter (Einträge ca. 54 px statt ca. 66 px hoch) · .nachtlauf/screens/abnahme/mehr-neu/3-1440-hell.png
- 1440 hell+dunkel · Bild 3 · Punkt 1 · Knopf „+ Neu“ zeigt im geöffneten Zustand einen Pfeil nach oben; Board zeigt „▾“ · .nachtlauf/screens/abnahme/mehr-neu/3-1440-dunkel.png
- 1440 hell · Bild 1/2/3 · Punkt 4 · Zähler-Marke an „Bestellungen“ hellorange mit weißer Ziffer (schwacher Kontrast); Board: dunkles Rostrot · .nachtlauf/screens/abnahme/mehr-neu/1-1440-hell.png
- 1440 dunkel · Bild 1/2/3 · Punkt 1 · Darstellungs-Knopf neben „Konto · Franz Müller“ zeigt eine Sonne; Board zeigt auch im Dunkeln den Mond · .nachtlauf/screens/abnahme/mehr-neu/1-1440-dunkel.png
- 1440 hell+dunkel · Bild 1/2/3 · Punkt 1 · Hauptspalte (Heute) anders aufgebaut als im Board: Kennzahlen über die volle Breite statt nur in der linken Spalte, kein Kasten „Online-Zahlung ist pausiert“, keine Zeile „Neue Nachricht im Postfach“, zusätzliche Karte „Was gibt’s Neues am Hof?“ (gehört vermutlich zum Heute-Board; hier nur als Hinweis, nicht in die Sterne gerechnet) · .nachtlauf/screens/abnahme/mehr-neu/1-1440-hell.png

Begründete Ausnahmen gesehen:
- Register vor Board: In der Packliste des Hofbereichs steht „Gepackt“ (stimmt mit dem Board überein).
- Chips „Frisches Produkt“, „Neue Saison“, „Aktion“, „Hinweis“ und Textlinks („Titelbild“, „Logo“, „Fotos“) sichtbar kleiner als 44 px – erlaubt.

Nicht prüfbar:
- keine

### hoefe

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 4 | 1 |
| 390 dunkel | 2 | 4 | 1 |
| 1440 hell | 2 | 4 | 1 |
| 1440 dunkel | 2 | 4 | 1 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell/dunkel · Bild 1, 2, 4 · Punkt 1 · Die Kategorie-Chips („Alle“, „Milch & Eier“, „Fleisch“, „Futtermittel“) und die Leiste „Filter“ / „Liste“ / „Karte“ fehlen. Stattdessen gibt es den Knopf „Filter“ neben der h1 und eine Kartenvorschau mit „Karte öffnen“ · .nachtlauf/screens/abnahme/hoefe/1-390-hell.png
- 390 hell/dunkel · Bild 1, 4 · Punkt 1 · Statt Feld und „Standort nutzen“ + „Nichts wird gespeichert.“ zeigt die App einen zusätzlichen grünen Kasten „Wir zeigen Höfe rund um deinen Standort – nichts wird gespeichert.“ mit „Ort ändern“ · .nachtlauf/screens/abnahme/hoefe/1-390-hell.png
- 390/1440 alle · Bild 1, 2, 4, 5 · Punkt 3 · Das Suchfeld hat keine sichtbare Beschriftung „Ort oder Produkt“, es gibt nur einen Platzhalter mit Lupe · .nachtlauf/screens/abnahme/hoefe/1-1440-hell.png
- 390/1440 alle · Bild 1, 5 · Punkt 2 · Board: „Reihenfolge: nach Entfernung. Keine bezahlte Platzierung.“. App: „22 Höfe · nach Entfernung“ (der Satz „Keine bezahlte Platzierung.“ fehlt) · .nachtlauf/screens/abnahme/hoefe/1-390-hell.png
- 390/1440 alle · Bild 1, 5 · Punkt 1 · In der Hofkarte fehlt die Marke „GRÜNDUNGSHOF“. Die App zeigt statt der Kurzliste „Name … Preis“ eine Produktliste mit Vorschaubildern und „+ 1 weiteres Produkt“; Board: „inkl. Plattformgebühr“, App: „Preise inkl. Plattformgebühr“ · .nachtlauf/screens/abnahme/hoefe/1-1440-hell.png
- 1440 hell/dunkel · Bild 1, 5 · Punkt 1 · Hofkarte: Im Board sitzt „Zum Hof“ als großer Knopf unter dem Bild links. In der App ist es ein kleiner Knopf unter dem Text, und rechts oben steht zusätzlich die Entfernung · .nachtlauf/screens/abnahme/hoefe/1-1440-hell.png
- 1440 hell/dunkel · Bild 1, 2, 4, 5 · Punkt 1 · Filterbereich anders: Kategorien in voller Breite und anders benannt („Milch & Molkerei“, „Eier“, „Fleisch & Wurst“, „Fisch“, „Gemüse“ … statt „Milch & Eier“, „Fleisch“, „Futtermittel“, „Brennmaterial“). Dazu kommen die Zeilen „Abholung“, „Umkreis 10/25/50 km/Alle“ und „Siegel“. „Filter“ / „Liste“ / „Karte“ fehlen · .nachtlauf/screens/abnahme/hoefe/1-1440-hell.png
- 1440 hell/dunkel · Bild 1, 2, 4, 5 · Punkt 1 · Raster anders: Die App ist breiter (Inhalt ab etwa x=137, Feld über die volle Breite), und die Karte läuft über den Inhaltsrand bis an den rechten Fensterrand. Im Board sitzt der Inhalt mittig, das Feld ist halb so breit und die Karte endet bündig · .nachtlauf/screens/abnahme/hoefe/1-1440-hell.png
- 1440 hell/dunkel · Bild 1, 2 · Punkt 1 · Die Unterzeile unter der h1 („Frisch vom Hof – …“ bzw. „Produkte statt Höfe, weil du nach einem Produkt suchst“) steht im Kopf, das Board zeigt hier keine. Bei der Suche steht der Satz im Board über der Liste und endet mit Punkt · .nachtlauf/screens/abnahme/hoefe/2-1440-hell.png
- 1440 hell/dunkel · Bild 1, 2, 4, 5 · Punkt 5 · Der gezeigte Fokus sitzt auf „Zum Inhalt springen“ und verdeckt das Logo. Im Board liegt er als grüner Ring auf dem Feld „Ort oder Produkt“ · .nachtlauf/screens/abnahme/hoefe/1-1440-hell.png
- 390/1440 alle · Bild 2 · Punkt 2 · Die h1 hat ein gerades Schlusszeichen: „Eier" statt „Eier“ · .nachtlauf/screens/abnahme/hoefe/2-390-hell.png
- 390/1440 alle · Bild 2 · Punkt 1 · „Standort nutzen“ ist ein gefüllter grüner Knopf, im Board umrandet. Zusätzlich gibt es die Zeile „Aktive Filter: Suche: Eier ×“ mit „Alle zurücksetzen“, dazu „7 Treffer“ und die Tageschips · .nachtlauf/screens/abnahme/hoefe/2-1440-hell.png
- 390 hell/dunkel · Bild 2 · Punkt 1 · Die Produktkarte ist zerbrochen: Der Name bricht mitten im Wort um („Freilandeie / r 10er“), der Hof wird gekürzt („Waldrandh…“), und der Preis steht in einer eigenen rechten Spalte. Im Board steht der Preis unter dem Text · .nachtlauf/screens/abnahme/hoefe/2-390-hell.png
- 1440 hell/dunkel · Bild 2 · Punkt 1 · Die Produktkarten haben zusätzlich einen Knopf „Zum Hof“ und den Preis rechts. Im Board steht der Preis links unter der Zeile „Hof · km · Abholung“ · .nachtlauf/screens/abnahme/hoefe/2-1440-hell.png
- 390/1440 alle · Bild 4 · Punkt 2 · Board: „Mit 25 km sind es 2 Höfe mit Fleisch.“. App: „Nimm den Umkreis weiter, dann siehst du mehr Höfe.“ · .nachtlauf/screens/abnahme/hoefe/4-1440-hell.png
- 390/1440 alle · Bild 4 · Punkt 1 · Der Leerzustand ist zentriert, hat ein Lupen-Symbol, eine gestrichelte Umrandung und einen kleinen gefüllten Knopf „Auf 25 km erweitern“. Im Board ist er linksbündig ohne Symbol, und der umrandete Knopf geht über die volle Breite · .nachtlauf/screens/abnahme/hoefe/4-390-hell.png
- 1440 hell/dunkel · Bild 4 · Punkt 1 · Auf der Karte fehlen die Marke „Du / Dein Standort“ und der gestrichelte Umkreis. Die Filter-Chips heißen „Umkreis: 10 km ×“ und „Fleisch & Wurst ×“, im Board „Fleisch ×“ und „10 km ×“ · .nachtlauf/screens/abnahme/hoefe/4-1440-hell.png
- 390 hell/dunkel · Bild 5 · Punkt 3 · Es ist keine h1 sichtbar (Messung h1 = 0), die Kopfleiste verdeckt das Suchfeld halb („Ort oder Produ…“). Im Board stehen h1 „Höfe in deiner Nähe“ und die Unterzeile über der Karte · .nachtlauf/screens/abnahme/hoefe/5-390-hell.png
- 390 hell/dunkel · Bild 5 · Punkt 1 · Statt Kategorie-Chips und „Filter / Liste / Karte“ zeigt die App ein Filtersymbol, den Knopf „Liste“ und die Zeile „Aktive Filter: Rund um deinen Standort ×, Umkreis: 10 km ×, Alle zurücksetzen“ · .nachtlauf/screens/abnahme/hoefe/5-390-hell.png
- 390/1440 alle · Bild 5 · Punkt 1/2 · Board: Unter der Karte steht ein Blatt „1 · Hof Müller“ mit „Schließen“ und dem breiten Knopf „Zum Hof“. App 390: Eine schwebende Hofkarte mit Produktliste liegt über der Karte, ohne „Schließen“ und ohne „1 ·“, dazu ein kleiner Knopf „Zum Hof“. App 1440: Das Blatt fehlt ganz, stattdessen ist die Listenkarte grün hervorgehoben · .nachtlauf/screens/abnahme/hoefe/5-1440-hell.png
- 390/1440 alle · Bild 5 · Punkt 3 · Die Zoomknöpfe „+“ / „−“ sind klein (30 px, Leaflet-Standard, weiß). Im Board sind es eigene, rund 44 px große Knöpfe · .nachtlauf/screens/abnahme/hoefe/5-390-hell.png
- 390/1440 alle · Bild 1, 5 · Punkt 2 · Zusätzlicher Hinweis auf der Karte: „Ein Hof hat noch keinen Kartenpunkt – …“, den das Board nicht zeigt · .nachtlauf/screens/abnahme/hoefe/1-1440-hell.png
- 390/1440 dunkel · Bild 1, 2, 5 · Punkt 4 · Helle Flecken im Dunkeln: Die Hof- und Produktbilder stehen ungedämpft auf hellgrauem Grund, ebenso die weißen Kartenmarken „Hof Müller“ / „Innbogenhof“ und die weiße Zuordnungsleiste. Die Kartenvorschau (390) ist kräftig grün. Im Board sind Bildflächen und Karte dunkel gedämpft · .nachtlauf/screens/abnahme/hoefe/1-390-dunkel.png
- 1440 dunkel · Bild 1, 2, 4, 5 · Punkt 1 · Der Themenknopf zeigt im Dunkeln eine Sonne, im Board einen Mond · .nachtlauf/screens/abnahme/hoefe/1-1440-dunkel.png
- 390 hell/dunkel · Bild 1, 2 · Punkt 1 · Die App zeigt oben eine Kopfleiste mit Logo und „Anmelden“, die h1 ist größer und bricht zweizeilig um. Im Board beginnt die Seite mit dem Blatt „Höfe in deiner Nähe“ ohne Kopfleiste · .nachtlauf/screens/abnahme/hoefe/1-390-hell.png

Begründete Ausnahmen gesehen:
- keine (die grauen Kartenflächen ohne Kacheln sind laut Auftrag keine Abweichung der App und nicht gewertet)

Nicht prüfbar:
- Bild 3 (390/1440): Die Ortssuche löst "Neukirchen" über Nominatim auf (Server-Aktion loeseOrtAuf); der Rechner hat keinen Zugang zu nominatim.openstreetmap.org, die Auswahl "Welches Neukirchen?" erscheint nicht (stattdessen "Keinen Ort gefunden").

### startseite

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 5 | 0 |
| 390 dunkel | 2 | 5 | 0 |
| 1440 hell | 2 | 5 | 0 |
| 1440 dunkel | 2 | 5 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell/dunkel · Bild 2 · Punkt 1 · Höfe-Karten: Im Board stehen sie untereinander in voller Breite mit Marke „Gründungshof“, Ort · km, „Abholung heute, …“, Produktliste mit Preisen und „inkl. Plattformgebühr“; die App zeigt ein waagrechtes Karussell (erste Karte klebt am linken Rand) mit Buchstaben-Platzhalter, Kategorien statt Produkten und Preisen, ohne km und ohne „inkl. Plattformgebühr“ · .nachtlauf/screens/abnahme/startseite/2-390-hell.png
- 1440 hell/dunkel · Bild 2 · Punkt 1 · Höfe-Karten: Board hat 3 Spalten mit Produkten und Preisen, die pausierte Karte gestrichelt mit „Macht gerade Pause – Bestellen geht bald wieder“; die App hat 4 Spalten ohne Preise, und ein Pausiert-Zustand ist nicht zu sehen · .nachtlauf/screens/abnahme/startseite/2-1440-hell.png
- 390/1440 alle · Bild 2, 3, 5 · Punkt 1 · „Futter vom Hof“: Im Board eine kleine Karte mit Satz und Link „Futter in deiner Nähe →“; die App hat einen großen Block mit h2, Einleitungstext und illustrierten Karten („Für Hase & Meerschwein“, „Kleinmengen finden“, „Ballen finden“) · .nachtlauf/screens/abnahme/startseite/3-390-hell.png
- 390/1440 alle · Bild 2, 3 · Punkt 1 · Die Karte „Brennmaterial vom Hof“ mit „Brennholz und Hackschnitzel aus dem eigenen Wald“ / „Brennmaterial in deiner Nähe →“ fehlt in den App-Bildern · .nachtlauf/screens/abnahme/startseite/2-1440-hell.png
- 1440 hell/dunkel · Bild 1 · Punkt 1 · Kopf: Board zeigt kompakten Kopf, Suchfeld und Knopf daneben, rechts eine schlichte Karte mit +/−, darunter „Alle Höfe auf der Karte →“, gleich darunter „Höfe aus der Region“ mit Karten; die App hat eine große Bühne (h1 dreizeilig und viel größer), eine Karte mit „35 Höfe in der Region“, Hof-Popup und „Karte öffnen“, kein +/−, und die Hofkarten liegen unter dem Falz · .nachtlauf/screens/abnahme/startseite/1-1440-hell.png
- 390 hell/dunkel · Bild 1 · Punkt 1 · Kopf: Im Board steht der Knopf „Höfe finden“ neben dem Feld und die Karte direkt unter den Häkchen, ohne Überschrift; in der App steht der Knopf in voller Breite unter dem Feld, und vor der Karte stehen die zusätzliche Überschrift „Höfe in deiner Region“ und die Marke „35 Höfe in der Region“ · .nachtlauf/screens/abnahme/startseite/1-390-hell.png
- 390/1440 alle · Bild 1, 5 · Punkt 3 · Das Board zeigt über dem Suchfeld die sichtbare Beschriftung „Hof oder Produkt“ mit dem Platzhalter „z. B. Eier oder Heu“; in der App gibt es keine sichtbare Beschriftung, nur den Platzhalter „Hof oder Produkt, z. B. Eier oder Heu“ · .nachtlauf/screens/abnahme/startseite/1-390-hell.png
- 390/1440 alle · Bild 1 · Punkt 2 · Unterzeile: Board „Eier, Gemüse, Fleisch, Brot – und sogar Heu für die Hasen.“; App „Eier, Gemüse, Brot – und Heu für die Hasen. Von Höfen aus deiner Gegend.“ (1440: „… Von Bäuerinnen und Bauern aus deiner Gegend, ohne Umweg über den Supermarkt.“) · .nachtlauf/screens/abnahme/startseite/1-1440-hell.png
- 390/1440 alle · Bild 1 · Punkt 1 · „In deiner Nähe suchen – mit Postleitzahl oder Standort“: Im Board ein unterstrichener grüner Textlink; in der App weiß und fett mit Standort-Symbol und ohne Unterstreichung · .nachtlauf/screens/abnahme/startseite/1-390-hell.png
- 1440 hell/dunkel · Bild 1, 2 · Punkt 1 · „Alle Höfe auf der Karte“: Im Board ein Textlink mit Pfeil unter der Karte bzw. vor „Oder direkt suchen:“; in der App ein Pillen-Knopf mit „>“ rechts neben der großen h2 „Höfe aus der Region“, die im Board eine kleine Eyebrow-Zeile ist · .nachtlauf/screens/abnahme/startseite/2-1440-hell.png
- 390/1440 alle · Bild 2, 5 · Punkt 1 · „Oder direkt suchen:“: Im Board fett, die Chips in einer Zeile (390 waagrecht scrollbar) und im Leer-Zustand gar nicht vorhanden; in der App normal gesetzt, die Chips (390) auf drei Zeilen umgebrochen und auch im Leer-Zustand sichtbar · .nachtlauf/screens/abnahme/startseite/5-390-hell.png
- 390/1440 alle · Bild 3 · Punkt 1 · So funktioniert’s: Board zeigt drei nummerierte Zeilen in einer Karte ohne Beschreibung; App ohne Karte, mit Eyebrow „So funktioniert’s“ und Beschreibungstext je Schritt · .nachtlauf/screens/abnahme/startseite/3-1440-hell.png
- 390/1440 alle · Bild 3 · Punkt 2 · Board „Warum direkt vom Hof?“ als Karte mit drei Punkten („Du weißt, von welchem Hof es kommt.“ …); App mit Eyebrow „Warum direkt vom Hof?“, h2 „Du weißt, woher es kommt“ und zwei anderen Punkten („Der Hof bekommt den vollen Preis“, „Kurze Wege, persönlich“) · .nachtlauf/screens/abnahme/startseite/3-1440-hell.png
- 390/1440 alle · Bild 3, 4 · Punkt 1/2 · Für Höfe: Im Board eine schlichte Karte „Du hast einen Hof? Dein Hofladen, online.“ mit einem Umrissknopf „Für Höfe“ in voller Breite; in der App ein apricotfarbener Verlaufsblock mit Eyebrow „Für Höfe“, Absatz, zwei Knöpfen „Mehr für Höfe“ und „Hof registrieren“ (orange) und „Schon dabei? Anmelden“ – andere Farbwirkung · .nachtlauf/screens/abnahme/startseite/3-1440-hell.png
- 390/1440 alle · Bild 3, 4 · Punkt 2 · Gut zu wissen: Board hat drei Fragen („Wie bezahle ich?“, „Was ist die Plattformgebühr?“, „Wo finde ich meine Bestellung?“) in einer Karte, im Web halb breit; die App hat Eyebrow „Fragen“ und h2 „Gut zu wissen“ in zwei Spalten, andere Fragen („Brauche ich ein Konto?“, „Was, wenn ich nicht abholen kann?“, „Wird auch geliefert?“), die erste ist aufgeklappt, Pfeile, keine Karte · .nachtlauf/screens/abnahme/startseite/4-1440-hell.png
- 390 hell/dunkel · Bild 4 · Punkt 1 · Seitenfuß: Board zeigt nur Rechtslinks (unterstrichen) und „Darstellung: hell“; die App hat einen großen Fuß mit Logo, Werbesatz, ©-Zeile und zwei Linkspalten („Agrilo“, „Für Höfe“: Hof registrieren, Anmelden für Höfe, Konditionen); die Links sind nicht unterstrichen · .nachtlauf/screens/abnahme/startseite/4-390-hell.png
- 1440 hell/dunkel · Bild 4 · Punkt 1 · Fußlinks „Höfe entdecken“, „Für Höfe“, „So funktioniert’s“ und die Rechtslinks sind in der App grau und nicht unterstrichen; das Board zeigt sie grün und unterstrichen · .nachtlauf/screens/abnahme/startseite/4-1440-hell.png
- 390/1440 alle · Bild 5 · Punkt 2/6 · Leer-Zustand: Board „Schau bald wieder vorbei – oder erzähl einem Hof von Agrilo.“ mit Umrissknopf „Für Höfe“ in voller Breite, links ausgerichtet; App zentriert in gestrichelter Karte mit Symbol, „Schau bald wieder vorbei. Du hast selbst einen Hof? Dann mach den Anfang.“ und dem kleinen Knopf „Hof registrieren“ · .nachtlauf/screens/abnahme/startseite/5-1440-hell.png
- 390 dunkel · Bild 1 · Punkt 4 · Die Regionskarte ist im Dunkeln hell (beige Kacheln, helle Marke „35 Höfe“), ein heller Fleck; das Board zeigt eine dunkle Karte · .nachtlauf/screens/abnahme/startseite/1-390-dunkel.png
- 1440 dunkel · Bild 1 · Punkt 4 · Karte und Hof-Popup „Bergwiesenhof“ sind im Dunkeln hell, ein großer heller Fleck; im Board ist die Karte dunkel · .nachtlauf/screens/abnahme/startseite/1-1440-dunkel.png
- 390/1440 dunkel · Bild 2, 3, 5 · Punkt 4 · Die Futter-Illustrationen (Heuballen, Sack) liegen im Dunkeln auf hellgrauem Grund, ungedämpft und damit helle Flecken · .nachtlauf/screens/abnahme/startseite/2-1440-dunkel.png
- 1440 hell/dunkel · Bild 1–5 · Punkt 5 · Das Board zeigt den Fokus am ersten Inhalts-Bedienelement (Suchfeld, erste Hofkarte, „Für Höfe“, Fußlink); in der App sitzt der Fokus auf „Zum Inhalt springen“, und dieser Link überdeckt oben links das Logo · .nachtlauf/screens/abnahme/startseite/1-1440-hell.png
- 1440 dunkel · Bild 1–5 · Punkt 1 · Der Theme-Knopf zeigt im Dunkeln eine Sonne; das Board zeigt in beiden Themes das Mond-Symbol · .nachtlauf/screens/abnahme/startseite/1-1440-dunkel.png
- 390 hell/dunkel · Bild 1–5 · Punkt 1 · Untere Leiste: Im Board hat „Entdecken“ eine aktive Pille, „Entdecken“ ist grün, der Warenkorb trägt ein Taschen-Symbol; in der App gibt es keine aktive Pille, „Entdecken“ ist schwarz/weiß und das Warenkorb-Symbol ist ein Korb · .nachtlauf/screens/abnahme/startseite/1-390-hell.png
- 390/1440 alle · Bild 1–5 · Punkt 4 · Die Eyebrow-Zeilen („Futter vom Hof“, „Höfe aus der Region“ usw.) sind im Board grau-gedämpft; in der App sind sie grün, gesperrt gesetzt und anders gewichtet · .nachtlauf/screens/abnahme/startseite/3-390-hell.png

Begründete Ausnahmen gesehen:
- Board-Fehler (A1): Das Video im Kopf (Weizenfeld mit Pausenknopf) bleibt in der App, in allen Fassungen. Nicht als Mangel gewertet; die übrigen Abweichungen im Kopf schon (Aufbau, Texte, Karte).
- Recht vor Board: Im Seitenfuß der App steht zusätzlich „Vertrag widerrufen“ (390 und 1440).
- Fußlinks, Chips und Textlinks kleiner als 44 px: sichtbar, als Ausnahme behandelt.

Nicht prüfbar:
- keine (alle 20 App-Bilder erreichbar)

### hofseite

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 4 | 0 |
| 390 dunkel | 2 | 4 | 0 |
| 1440 hell | 2 | 4 | 0 |
| 1440 dunkel | 2 | 4 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell/dunkel · Bild 1–4 · Punkt 1 · Kopf: App zeigt oben eine zusätzliche Leiste „Agrilo“ + „Anmelden“, darunter ein vollbreites Kopffoto mit Name und Adresse im Bild und einen runden Zurück-Knopf; das Board zeigt nur die App-Leiste (‹, „Hof Müller“, Untertitel, Teilen) und darunter einen ruhigen Banner. In der App steht die App-Leiste mit ‹/Teilen erst unter dem Foto, also doppelt geführt · .nachtlauf/screens/abnahme/hofseite/1-390-hell.png
- 390 hell/dunkel · Bild 1, 4 · Punkt 1 · Hof-Kopf fehlt: kein quadratisches Logo „HM“, keine Marke „GRÜNDUNGSHOF“, kein Leitsatz („Heumilch seit drei Generationen“), Name als Bildtext statt unter dem Banner · .nachtlauf/screens/abnahme/hofseite/1-390-hell.png
- 390 hell/dunkel · Bild 1 · Punkt 1/2 · Knöpfe: Board „Route“ · „Teilen“ · „Bestellen“ (drei gleiche, umrandet); App „Anfahrt“ (umrandet) + „Bestellen“ (grün gefüllt), „Teilen“ fehlt in der Knopfreihe · .nachtlauf/screens/abnahme/hofseite/1-390-hell.png
- 390 hell/dunkel · Bild 1 · Punkt 1 · Inhalt der Übersicht: Board zeigt „Nächste Abholung: heute, …“ mit „Deinen Abholtermin wählst du beim Bestellen. Bar oder online.“, dann „AKTUELL VOM HOF“ mit Beitrag und „Weiterlesen“, dann „PRODUKTE / Alle ansehen →“; App springt direkt zu „Produkte 6 verfügbar“, Abholung und „Aktuell vom Hof“ fehlen · .nachtlauf/screens/abnahme/hofseite/1-390-hell.png
- 390 hell/dunkel · Bild 1–4 · Punkt 2 · Untertitel: Board „nimmt Bestellungen an“ / „pausiert gerade“, App „Nimmt Bestellungen an“ / „Pausiert“ · .nachtlauf/screens/abnahme/hofseite/4-390-hell.png
- 390 hell/dunkel · Bild 1, 3 · Punkt 1 · Reiter: Board zwei gleich breite Reiter über die volle Breite, aktiv mit grüner Linie; App linksbündige Reiter mit dunkler Linie · .nachtlauf/screens/abnahme/hofseite/3-390-hell.png
- 390 hell/dunkel · Bild 1–3 · Punkt 2 · Warenkorb-Leiste: Board „3 Produkte · € … / Zum Warenkorb ›“ (höher, fett), App „3 Artikel · € … / Zum Warenkorb“ mit Korb-Symbol, flacher; Board-Navigation hebt „Entdecken“ mit Pille hervor, App ohne Pille · .nachtlauf/screens/abnahme/hofseite/1-390-hell.png
- 390 hell/dunkel · Bild 1–3 · Punkt 1 · Produktzeilen: Board eine Liste in einer Karte mit rundem „+“ je Zeile (bzw. „Größe wählen ›“, Marke „Ausverkauft“); App einzelne Karten mit Mengenwähler „− 1 +“, Kurzbeschreibung und Foto · .nachtlauf/screens/abnahme/hofseite/3-390-hell.png
- 390 hell/dunkel · Bild 2 · Punkt 1/2 · Reihenfolge weiter unten: Board „PRODUKTE“ → Fußsatz „Preise inkl. Plattformgebühr (6 %) – online und bar gleich.“ → „ÜBER UNS“ (Marke „Seit 1987“, Häkchenliste) → „ZAHLUNG & KONTAKT“; App zeigt Abholtermin-Liste, Karte „Abholzeiten“, „Zahlung & Kontakt“ und eine Kartenansicht, „Über uns“ fehlt in diesem Abschnitt · .nachtlauf/screens/abnahme/hofseite/2-390-hell.png
- 390 hell/dunkel · Bild 2 · Punkt 2 · „Zahlung & Kontakt“: Board Überzeile in Versalien mit „Online bezahlen oder bar bei Abholung. Die Telefonnummer des Hofs steht in deiner Bestellbestätigung.“ + „Preise inkl. Plattformgebühr (6 %) – online und bar gleich.“; App Kartentitel, „Bar bei Abholung“, Kasten „Fragen zu deiner Bestellung? …“ und „… Die Plattformgebühr ist Teil des Preises. Der Hof zahlt damit die Bestellplattform Agrilo.“ · .nachtlauf/screens/abnahme/hofseite/2-390-hell.png
- 390 hell/dunkel · Bild 2 · Punkt 1 · App hält Agrilo-Leiste, Hof-Leiste und Reiter beim Scrollen fest oben; Board zeigt nur die App-Leiste fest · .nachtlauf/screens/abnahme/hofseite/2-390-hell.png
- 390 hell/dunkel · Bild 3 · Punkt 1/2 · Reiter Produkte: App zeigt weiterhin das große Kopffoto und Knöpfe; Board beginnt direkt mit Reitern und Chips. App setzt einen Hinweiskasten „Preise inkl. …“ über die Liste (Board: keiner) und Gruppenüberschriften als Serif-Titel „Milch & Molkerei 1 Produkt“ statt Überzeile „MILCH & EIER · 3 PRODUKTE“; Chips in der App flacher als im Board · .nachtlauf/screens/abnahme/hofseite/3-390-hell.png
- 390 hell/dunkel · Bild 4 · Punkt 2/6 · Pause-Kasten: Board „Hof Müller pausiert gerade.“ + „„Wir sind im Urlaub bis 15. März.“ Du kannst dir das Angebot ansehen. Dein Warenkorb bleibt gespeichert.“; App nur die Hofnachricht ohne Anführungszeichen, beide festen Sätze fehlen, zusätzlich Pause-Symbol · .nachtlauf/screens/abnahme/hofseite/4-390-hell.png
- 390 hell/dunkel · Bild 4 · Punkt 1 · Pausiert: Board ohne Warenkorb-Leiste, ohne Reiter, Produkte ohne Bedienelement; App zeigt Warenkorb-Leiste, Reiter und je Produkt eine Marke „Pausiert“; Knopf „Teilen“ fehlt (Board „Route“ + „Teilen“, App nur „Anfahrt“) · .nachtlauf/screens/abnahme/hofseite/4-390-hell.png
- 390 dunkel · Bild 1, 3, 4 · Punkt 4 · Produktbilder als helle beige Kacheln und Kopffoto mit hellem Verlauf rechts; Board zeigt im Dunkeln gedämpfte dunkle Flächen · .nachtlauf/screens/abnahme/hofseite/1-390-dunkel.png
- 1440 hell/dunkel · Bild 1, 3, 4 · Punkt 1 · Aufbau: Board zweispaltig ab oben (Banner nur in der linken Spalte, Seitenspalte beginnt neben dem Banner); App mit zusätzlichem Link „‹ Alle Höfe“, vollbreitem Kopfbild über beide Spalten, Seitenspalte erst unter Kopf und Reitern · .nachtlauf/screens/abnahme/hofseite/1-1440-hell.png
- 1440 hell/dunkel · Bild 1, 3, 4 · Punkt 1/2 · Hof-Kopf: rundes, grün gefülltes Logo statt quadratischem „HM“, keine Marke „GRÜNDUNGSHOF“, kein Leitsatz; Knöpfe „Anfahrt“ statt „Route“, „Jetzt bestellen“ grün gefüllt statt umrandet; Reiter linksbündig statt halbe Breite je Reiter · .nachtlauf/screens/abnahme/hofseite/1-1440-hell.png
- 1440 hell/dunkel · Bild 1–4 · Punkt 5 · Fokus: Board zeigt den Fokusring am Knopf „Route“ (Bild 1, 3, 4) bzw. „Alle ansehen →“ (Bild 2); App zeigt den Fokus auf „Zum Inhalt springen“, das das Logo „Agrilo“ überdeckt · .nachtlauf/screens/abnahme/hofseite/1-1440-hell.png
- 1440 hell/dunkel · Bild 1–4 · Punkt 1/2 · Seitenspalte: Board Karten in Versal-Überzeilen „DEIN WARENKORB“ („3 Produkte · € … · inkl. Plattformgebühr“, „Zur Kasse“), „NÄCHSTE ABHOLUNG“, „ABHOLZEITEN“, „ZAHLUNG & KONTAKT“, „ANFAHRT“ mit „Route planen →“; App „Dein Warenkorb“ mit Symbol, Artikelliste und „3 Artikel“, „Zahlung & Kontakt“ mit anderem Text, „Anfahrt“ mit Kartenbild statt Link · .nachtlauf/screens/abnahme/hofseite/2-1440-hell.png
- 1440 hell/dunkel · Bild 1 · Punkt 1 · Übersicht links: Board „AKTUELL VOM HOF“ (Beitrag + „Weiterlesen“) vor „PRODUKTE“; App stattdessen Karte „Über uns“ mit anderem Text, „Aktuell vom Hof“ fehlt · .nachtlauf/screens/abnahme/hofseite/1-1440-hell.png
- 1440 hell/dunkel · Bild 2 · Punkt 1 · Produktkarten mit Mengenwähler „− 1 +“ bzw. grünem „+ In den Korb“ statt umrandetem „In den Korb“ über volle Breite; Fußsatz „Preise inkl. Plattformgebühr (6 %) – online und bar gleich.“ und „ÜBER UNS“ („Seit 1987“, Häkchenliste) fehlen unter den Produkten · .nachtlauf/screens/abnahme/hofseite/2-1440-hell.png
- 1440 hell/dunkel · Bild 2 · Punkt 1 · Feste Reiterleiste unter dem Kopf beim Scrollen (Board: keine); feste Warenkorb-Karte liegt über der Karte darunter, deren Reste oben angeschnitten durchscheinen · .nachtlauf/screens/abnahme/hofseite/2-1440-hell.png
- 1440 hell/dunkel · Bild 3 · Punkt 1/2 · Reiter Produkte: Kopfbild bleibt groß stehen; Chips umbrechen in zwei Reihen und sind flacher; zusätzlicher Hinweiskasten „Preise inkl. …“; Gruppentitel „Milch & Molkerei 1 Produkt“ als Serif-Titel statt Überzeile „MILCH & EIER · 3 PRODUKTE“ · .nachtlauf/screens/abnahme/hofseite/3-1440-hell.png
- 1440 hell/dunkel · Bild 4 · Punkt 1/2 · Pausiert: Pause-Kasten über volle Breite statt in der linken Spalte, ohne die Sätze „Du kannst dir das Angebot ansehen. Dein Warenkorb bleibt gespeichert.“; Seitenspalte ohne Hinweis „Hof Müller pausiert gerade.“ in der Warenkorb-Karte; links „Über uns“ statt „PRODUKTE“ ohne Bedienelemente · .nachtlauf/screens/abnahme/hofseite/4-1440-hell.png
- 1440 dunkel · Bild 1–4 · Punkt 4 · Kopfbild mit fast weißem Verlauf rechts und Produktbilder als helle graue Kacheln – helle Flecken; Board zeigt gedämpfte dunkle Flächen · .nachtlauf/screens/abnahme/hofseite/1-1440-dunkel.png

Begründete Ausnahmen gesehen:
- Chips (Kategorie-Filter) kleiner als 44 px – zulässig (Trefferfläche über ::before), daher nicht als Mangel gezählt.
- Beispieldaten (Adresse „Hofgasse“ statt „Dorfstraße“, Produktnamen, Kategorien, Preise, Anzahl „Produkte · 6“ statt „· 5“, Abholtage) nicht gewertet.

Nicht prüfbar:
- keine

### produkt

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 3 | 0 |
| 390 dunkel | 2 | 3 | 0 |
| 1440 hell | 2 | 3 | 0 |
| 1440 dunkel | 2 | 3 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell/dunkel · Bild 1 · Punkt 1 · „Größe wählen“: Board zeigt eine senkrechte Liste mit Auswahlkreisen (Sack, Big Bag, Lose; Preis rechts) frei auf der Seite; App zeigt Kacheln in zwei Spalten in einer Karte, ohne Auswahlkreise, Reihenfolge Big Bag, Sack, Lose; Lose 1 t ist im ersten Bildschirm abgeschnitten · .nachtlauf/screens/abnahme/produkt/1-390-hell.png
- 1440 hell/dunkel · Bild 1 · Punkt 1 · „Größe wählen“: Board senkrechte Liste mit Auswahlkreisen über volle Spaltenbreite; App drei Kacheln nebeneinander (Big Bag, Sack, Lose), Lose mit durchgestrichenem Preis und „ausverkauft“ statt „gerade nicht da“ · .nachtlauf/screens/abnahme/produkt/1-1440-hell.png
- 1440 hell/dunkel · Bild 1/2 · Punkt 1 · Feste Leiste fehlt: Board zeigt unten an der Hauptspalte die feste Leiste „In den Korb · € 190,80“ (links, breit) mit Mengen-Stepper (rechts); App hat keine feste Leiste, Stepper links und Knopf rechts stehen in der Größen-Karte · .nachtlauf/screens/abnahme/produkt/1-1440-hell.png
- 1440 hell/dunkel · Bild 1/2/3 · Punkt 1 · Hauptspalte: Board Foto breit über dem Titel, darunter Titel und Text untereinander; App Foto als Quadrat links neben Titel und Text (zweispaltig) · .nachtlauf/screens/abnahme/produkt/1-1440-hell.png
- 1440 hell/dunkel · Bild 1/2/3 · Punkt 1 · Seitenspalte: Board beginnt mit Karte „DEIN WARENKORB“ (3 Produkte · Summe · Knopf „Zur Kasse“) und zeigt im Kopf „Warenkorb · 3“; App ohne Warenkorb-Karte und ohne Warenkorb-Knopf im Kopf · .nachtlauf/screens/abnahme/produkt/1-1440-hell.png
- 1440 hell/dunkel · Bild 1/2/3 · Punkt 1 · Seitenspalte-Karten: Board Überschriften als kleine Großbuchstaben-Zeile („NÄCHSTE ABHOLUNG“, „ABHOLZEITEN“, „ZAHLUNG & KONTAKT“, „ANFAHRT“) ohne Symbole; App fette Titel in gemischter Schreibung mit Kalender-Symbolen, „Anfahrt“ mit Karte statt Adresszeile „… · Parken im Hof“ · .nachtlauf/screens/abnahme/produkt/1-1440-hell.png
- 1440 hell/dunkel · Bild 2 · Punkt 1 · Seitenspalte bleibt im Board beim Scrollen stehen (alle Karten sichtbar); in der App ist sie weggescrollt, nur „Anfahrt“ sichtbar · .nachtlauf/screens/abnahme/produkt/2-1440-hell.png
- 1440 hell/dunkel · Bild 1/2/3 · Punkt 2 · Zahlung & Kontakt: Board „Online bezahlen oder bar bei Abholung. Die Telefonnummer des Hofs steht in deiner Bestellbestätigung.“ + „Preise inkl. Plattformgebühr (6 %) – online und bar gleich.“; App „Bar bei Abholung“, Kasten „Fragen zu deiner Bestellung? …“ und zusätzlicher Satz „Die Plattformgebühr ist Teil des Preises. Der Hof zahlt damit …“ · .nachtlauf/screens/abnahme/produkt/1-1440-hell.png
- alle Fassungen · Bild 1/3 · Punkt 2 · Zeile „14 Tage Rücktrittsrecht ab Abholung – Details in den AGB.“ unter dem Titel fehlt in der App · .nachtlauf/screens/abnahme/produkt/1-390-hell.png
- alle Fassungen · Bild 1 · Punkt 2 · Titel: Board h1 „Futterhafer“ mit Größe in der Auswahl; App h1 „Futterhafer, Big Bag 500 kg“; zusätzlich Kategoriezeile „GETREIDE & KÖRNER · HAFER · HOF MÜLLER“ und Marke „Nur an Betriebe“, die das Board nicht zeigt · .nachtlauf/screens/abnahme/produkt/1-390-hell.png
- alle Fassungen · Bild 1 · Punkt 2 · Marke: Board „Futtermittel-Nummer laut Hof“; App „Futtermittelbetrieb · LFBIS … · laut Hof“ mit Schild-Symbol; zusätzlicher fester Satz „Dieses Futtermittel gibt der Hof nur an landwirtschaftliche Betriebe ab …“ · .nachtlauf/screens/abnahme/produkt/1-390-hell.png
- alle Fassungen · Bild 1 · Punkt 2 · Futter-Hinweis: Board „Futter: Die Angaben macht der Hof. Für die richtige Fütterung deiner Tiere bist du selbst verantwortlich.“; App (1440) „Die Angaben zu Registrierung und Kennzeichnung stammen vom Hof … Agrilo vermittelt nur …“, auf 390 im ersten Bildschirm gar nicht; Board-Fußzeile „Grundpreis zum Vergleichen · Preise inkl. Plattformgebühr …“ steht in der App als Kopfzeile rechts in der Karte · .nachtlauf/screens/abnahme/produkt/1-1440-hell.png
- alle Fassungen · Bild 1 · Punkt 2 · Vorrat-Wortlaut je Größe: Board „€ 0,51 / kg · 14 da“; App „noch 14 × 25 kg“ in eigener Zeile · .nachtlauf/screens/abnahme/produkt/1-390-hell.png
- 390 hell/dunkel · Bild 1/3 · Punkt 1 · Kopf: Board zeigt oben die Zeile „‹ Alle Produkte von Hof Müller“ ohne Seitenkopf; App zeigt den Seitenkopf (Agrilo, Anmelden) und nur einen runden Zurück-Knopf ohne Text über dem Foto · .nachtlauf/screens/abnahme/produkt/1-390-hell.png
- 1440 hell/dunkel · Bild 1/2/3 · Punkt 2 · Zurück-Link: Board „‹ Zurück zu allen Produkten“; App „‹ Alle Produkte“ · .nachtlauf/screens/abnahme/produkt/1-1440-hell.png
- 390 hell/dunkel · Bild 1/2 · Punkt 1 · Feste Leiste: Board Stepper als umrandete Pille, Knopf „In den Korb · € 190,80“ ohne Symbol; App getrennte runde Stepper-Knöpfe, Korb-Symbol im Knopf, Text abgeschnitten „€ 190,…“ · .nachtlauf/screens/abnahme/produkt/1-390-hell.png
- alle Fassungen · Bild 2 · Punkt 1/2 · Kennzeichnung: Board Karte mit zweispaltiger Tabelle (Zusammensetzung, Inhaltsstoffe, Gebrauch) ohne Auf-/Zuklapp-Pfeil; App aufklappbare Karte mit Pfeil und gestapelten Großbuchstaben-Beschriftungen, neun statt drei Zeilen („Analytische Bestandteile“ statt „Inhaltsstoffe“, „Gebrauchshinweis“ statt „Gebrauch“, zusätzlich Art, Für, Gehalte, Nettomenge, Betriebsnummer, Verantwortlich) und Zusatzsatz „Charge und Mindesthaltbarkeit stehen auf dem Sackanhänger.“ · .nachtlauf/screens/abnahme/produkt/2-390-hell.png
- alle Fassungen · Bild 2 · Punkt 1 · Futter-Hinweis direkt unter der Kennzeichnung fehlt in der App · .nachtlauf/screens/abnahme/produkt/2-390-hell.png
- alle Fassungen · Bild 2/3 · Punkt 1/2 · „Gleich mit abholen“: Board kleine Großbuchstaben-Zeile „GLEICH MIT ABHOLEN“, Liste mit Vorschaubild, Preis, Grundpreis und rundem „+“-Knopf, darunter „Preise inkl. Plattformgebühr“; App große Serifen-Überschrift, Hinweis daneben/darüber, auf 1440 drei Kacheln nebeneinander ohne Vorschaubild mit Knopf „+ In den Korb“ · .nachtlauf/screens/abnahme/produkt/2-1440-hell.png
- alle Fassungen · Bild 3 · Punkt 6 · Ausverkauft-Zustand: Board Karte „Gerade ausverkauft“ mit „Hof Müller hat gerade kein Brennholz Buche. Schau, was es sonst gibt.“ und Knopf „Zum Angebot von Hof Müller“; App ohne diese Karte, stattdessen grauer Knopf „Ausverkauft“ (390 als feste Leiste unten, die das Board nicht zeigt; 1440 in einer Preiskarte) · .nachtlauf/screens/abnahme/produkt/3-390-hell.png
- alle Fassungen · Bild 3 · Punkt 1 · Brennholz-Angaben: Board drei Kacheln „Holzart / Länge / Gelagert seit“, Preis „€ 100,70 je Raummeter“ mit Erklärung „1 Raummeter = 1 m × 1 m × 1 m geschlichtetes Holz mit Zwischenräumen.“ und „Preise inkl. Plattformgebühr (6 %) – online und bar gleich.“; App ohne Kacheln und Erklärung, Preis „€ 100,70 / m³“ in eigener Karte · .nachtlauf/screens/abnahme/produkt/3-1440-hell.png
- alle Fassungen · Bild 3 · Punkt 1 · Zusätzliche Blöcke: App zeigt „Kennzeichnung“ (zugeklappt) und „Gleich mit abholen“ unter dem ausverkauften Brennholz; das Board zeigt beides dort nicht · .nachtlauf/screens/abnahme/produkt/3-390-hell.png
- alle Fassungen · Bild 3 · Punkt 1 · Marke „Ausverkauft“: Board neben dem Titel; App in der Markenzeile unter dem Titel · .nachtlauf/screens/abnahme/produkt/3-1440-hell.png
- 390 dunkel / 1440 dunkel · Bild 1/3 · Punkt 4 · Produktbild steht im Dunkeln auf hellem grauem Quadrat (heller Fleck, nicht gedämpft); Board zeigt die Bildfläche dunkel · .nachtlauf/screens/abnahme/produkt/1-390-dunkel.png
- 1440 hell/dunkel · Bild 1/2/3 · Punkt 5 · Fokus: Board zeigt den Fokusrahmen am Zurück-Link; in der App sitzt er am Link „Zum Inhalt springen“ (vor dem Logo eingeblendet) – sichtbar, aber anderes erstes Element; Zurück-Link ohne Unterstreichung · .nachtlauf/screens/abnahme/produkt/1-1440-hell.png

Begründete Ausnahmen gesehen:
- Recht vor Board: Fußlinks „Impressum“, „Datenschutz“, „AGB“, „Vertrag widerrufen“ im Seitenfuß (1440, Bild 2) – Wortlaut bleibt.
- Chips/Marken („Nur Abholung am Hof“, „Ausverkauft“) und Textlinks („‹ Alle Produkte“, „Route planen →“) sichtbar kleiner als 44 px – zulässig.

Nicht prüfbar:
- keine

### bestaetigung

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 4 | 0 |
| 390 dunkel | 2 | 4 | 0 |
| 1440 hell | 2 | 4 | 0 |
| 1440 dunkel | 2 | 4 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 1440 hell, 1440 dunkel · Bild 1–3 · Punkt 1 · Board zeigt eine feste Aktionsleiste am unteren Fensterrand (Trennlinie, rechts „Weiter einkaufen“ + „Bestellung ansehen“), in Bild 1–3 immer an derselben Stelle; App setzt die Aktionszeile in den Seitenfluss nach den Karten, im ersten Bildschirm (Bild 1, 3) ist sie gar nicht sichtbar · .nachtlauf/screens/abnahme/bestaetigung/1-1440-hell.png, 2-1440-hell.png, 3-1440-hell.png (dunkel ebenso)
- 1440 hell, 1440 dunkel · Bild 1–4 · Punkt 5 · Board zeigt Fokusring am ersten Bedienelement („In den Kalender“, „Hof Müller teilen“, „Mail nicht bekommen? Erneut senden“, „Höfe entdecken“); App zeigt in keinem der vier Bilder einen sichtbaren Fokus · .nachtlauf/screens/abnahme/bestaetigung/1-1440-hell.png … 4-1440-dunkel.png
- 390 hell, 390 dunkel · Bild 1–4 · Punkt 1 · Kopf: Board zeigt eine Titelleiste „Bestellung bei Hof Müller“ (Bild 4: „Bestellung“) in Serifenschrift ohne Logo und ohne „Anmelden“; App zeigt den allgemeinen Kopf mit Logo „Agrilo“ und Knopf „Anmelden“, „Bestellung bei Hof Müller“ nur als kleine Überzeile über der h1, in Bild 4 gar nicht · .nachtlauf/screens/abnahme/bestaetigung/1-390-hell.png, 4-390-hell.png (Bild 2, 3 und dunkel ebenso)
- alle Fassungen · Bild 2, 3 · Punkt 1/2 · Bestellkarte: Board einzeilig je Posten („2 × Bergkäse, 250 g · € 13,16“), dann „Gesamt € 19,12“ fett in einer Zeile und Fußzeile „Online bezahlt · inkl. Plattformgebühr (6 %)“ bzw. „Bar bei Abholung · inkl. Plattformgebühr (6 %)“; App zweispaltig mit rechtsbündigen Preisen, eigene Zeile „Plattformgebühr € 5,92“, „Gesamt“ und Betrag getrennt, Fußzeile „Online · Bezahlt“ bzw. „Bar bei Abholung · Noch offen“ plus Zusatzsatz „Die Plattformgebühr ist Teil des Preises. Der Hof zahlt damit die Bestellplattform Agrilo.“ (begründet nur, falls das N39-Wortlaut ist) · .nachtlauf/screens/abnahme/bestaetigung/2-390-hell.png, 3-1440-hell.png
- alle Fassungen · Bild 2 · Punkt 2 · Karte „Neuigkeiten vom Hof per E-Mail“: Board „Höchstens zweimal im Monat. Abmelden jederzeit.“; App „Möchtest du erfahren, wenn es bei Hof Müller frische Produkte oder Aktionen gibt? Freiwillig – abmelden kannst du dich jederzeit.“; im Web zusätzlich zwei Absätze unter dem Knopf („Wir schicken dir zuerst eine E-Mail … zum Bestätigen …“, „Abmelden kannst du dich jederzeit … Datenschutzerklärung“), die das Board nicht zeigt (begründet nur, falls Datenschutz-Pflichttext) · .nachtlauf/screens/abnahme/bestaetigung/2-390-hell.png, 2-1440-hell.png
- 1440 hell, 1440 dunkel · Bild 3 · Punkt 1 · Zustand „Bar, wartet auf Bestätigung“: App zeigt nach „Deine Bestellung“ zusätzlich die Karte „Neuigkeiten vom Hof per E-Mail“; das Board zeigt nach der Bestellkarte nichts mehr · .nachtlauf/screens/abnahme/bestaetigung/3-1440-hell.png
- 1440 hell, 1440 dunkel · Bild 3 · Punkt 2 · Bestellkarte hat in der App eine zusätzliche Zeile „Bestellnummer … · Abholung: … · <Adresse>“, die das Board nicht zeigt · .nachtlauf/screens/abnahme/bestaetigung/3-1440-hell.png
- alle Fassungen · Bild 3 · Punkt 2 · Fristzeile: Board „Bitte bis heute, 09:40 Uhr bestätigen“; App „Bitte bis heute, Do, 5. Nov, 22:51 Uhr bestätigen“ (Wochentag und Datum hinter „heute“ zusätzlich, im Handy dadurch zweizeilig) · .nachtlauf/screens/abnahme/bestaetigung/3-390-hell.png
- 1440 hell, 1440 dunkel · Bild 1 · Punkt 1 · Board setzt den Link „Rücktrittsrecht“ in die rechte Spalte direkt unter die Karte „Hof erreichen“; App hat dort keinen Link (er steht erst unten nach den Karten, siehe Bild 2) · .nachtlauf/screens/abnahme/bestaetigung/1-1440-hell.png
- 1440 hell, 1440 dunkel · Bild 2 · Punkt 1 · Fuß: Board zeigt den Fuß in Inhaltsbreite direkt unter dem Widerrufslink und über der festen Leiste, Links grün unterstrichen; App zeigt die Aktionszeile vor dem Fuß, Fuß über volle Breite, Links grau ohne Unterstrich · .nachtlauf/screens/abnahme/bestaetigung/2-1440-hell.png
- 390 hell, 390 dunkel · Bild 4 · Punkt 1 · App zeigt unter der Karte einen Fuß (Impressum, Datenschutz, AGB, Problem melden, Vertrag widerrufen) und den Knopf „Darstellung: hell“/„Darstellung: dunkel“; Board zeigt unter der Karte nichts · .nachtlauf/screens/abnahme/bestaetigung/4-390-hell.png
- 1440 hell, 1440 dunkel · Bild 4 · Punkt 1 · App zeigt unter der Karte einen Fuß mit Logo und Links; Board zeigt unter der Karte nichts · .nachtlauf/screens/abnahme/bestaetigung/4-1440-hell.png
- 390 hell, 390 dunkel · Bild 2 · Punkt 1 · Link „Rücktrittsrecht“ steht im Board sichtbar nach den Karten über der festen Leiste; in der App ist im Bild kein Widerrufslink zu sehen (Newsletter-Karte läuft unter die feste Leiste) · .nachtlauf/screens/abnahme/bestaetigung/2-390-hell.png
- 390 dunkel, 1440 dunkel · Bild 1–3 · Punkt 4 · Schritt-Leiste: erledigte Schritte im Board hell mintgrün, in der App dunkelgrün, mit deutlich weniger Kontrast zum dunklen Grund · .nachtlauf/screens/abnahme/bestaetigung/1-390-dunkel.png, 1-1440-dunkel.png
- 1440 dunkel · Bild 1–4 · Punkt 1 · Darstellungs-Knopf im Kopf: Board zeigt Mond-Symbol, App zeigt Sonnen-Symbol · .nachtlauf/screens/abnahme/bestaetigung/1-1440-dunkel.png
- 1440 hell, 1440 dunkel · Bild 1–4 · Punkt 1 · Kopf im Board über volle Fensterbreite (Logo am linken, „Anmelden“ am rechten Rand); in der App auf Inhaltsbreite eingerückt (klein) · .nachtlauf/screens/abnahme/bestaetigung/1-1440-hell.png

Begründete Ausnahmen gesehen:
- Register vor Board: Schritt-Leiste der Bestätigung zeigt „Abholbereit“ statt „Gepackt“ (Bild 1–3, alle Fassungen).
- Recht vor Board: Widerrufslink heißt „Vertrag widerrufen“ statt „Rücktrittsrecht“ (Bild 2, 1440), „Vertrag widerrufen“ zusätzlich im Fuß (Bild 2 und 4).

Nicht prüfbar:
- keine (alle 16 App-Bilder laut Manifest erreichbar)

### bestellung-link

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 4 | 0 |
| 390 dunkel | 2 | 4 | 0 |
| 1440 hell | 2 | 4 | 0 |
| 1440 dunkel | 2 | 4 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell/dunkel · Bild 1 · Punkt 1 · Kopf anders: Board zeigt Titelleiste „Deine Bestellung“, App zeigt Seitenkopf mit Logo „Agrilo“ und Knopf „Anmelden“ · .nachtlauf/screens/abnahme/bestellung-link/1-390-hell.png
- 390 hell/dunkel · Bild 1 · Punkt 1 · zusätzliche feste Leiste unten (Entdecken / Warenkorb / Bestellungen), Board zeigt keine; sie verdeckt die Positionen · .nachtlauf/screens/abnahme/bestellung-link/1-390-dunkel.png
- 390 hell/dunkel · Bild 4 · Punkt 1 · Kopf anders (Board „Deine Bestellung“, App Logo + „Anmelden“), zusätzlich Fußlinks (Impressum, Datenschutz, AGB, Problem melden, Vertrag widerrufen), Knopf „Darstellung: hell/dunkel“ und feste Leiste unten; Board zeigt nur die Karte · .nachtlauf/screens/abnahme/bestellung-link/4-390-hell.png
- 1440 hell/dunkel · Bild 2 · Punkt 1 · Kopf anders: Board Logo „Agrilo“ | „Bestätigen“ links und Link „← Zurück zum Hof“ rechts; App nur Pfeil „<“ + „Bestätigen“, kein Logo, kein „Zurück zum Hof“ · .nachtlauf/screens/abnahme/bestellung-link/2-1440-hell.png
- 1440 hell/dunkel · Bild 3 · Punkt 1 · Kopf anders wie Bild 2 (kein Logo, kein „← Zurück zum Hof“, stattdessen Pfeil „<“) · .nachtlauf/screens/abnahme/bestellung-link/3-1440-hell.png
- 1440 hell/dunkel · Bild 2 · Punkt 1 · Knopfleiste („Doch nicht – Bestellung stornieren“ / „Ja, ich hole verbindlich ab“) steht im Board unten am Bildschirmrand, in der App direkt unter dem Inhalt mitten auf der Seite · .nachtlauf/screens/abnahme/bestellung-link/2-1440-dunkel.png
- 1440 hell/dunkel · Bild 1 · Punkt 5 · Fokus am ersten Bedienelement fehlt: Board zeigt Fokusrahmen um „Deine Bestellung bei Hof Müller“, App ohne Rahmen · .nachtlauf/screens/abnahme/bestellung-link/1-1440-hell.png
- 1440 hell/dunkel · Bild 3 · Punkt 5 · Fokusrahmen um „Zurück zu Hof Müller“ fehlt · .nachtlauf/screens/abnahme/bestellung-link/3-1440-dunkel.png
- 1440 hell/dunkel · Bild 4 · Punkt 5 · Fokusrahmen um „Zur Hofübersicht“ fehlt · .nachtlauf/screens/abnahme/bestellung-link/4-1440-hell.png
- 1440 dunkel · Bild 2 · Punkt 5 · Board zeigt Fokusrahmen um „Ja, ich hole verbindlich ab“, App ohne Rahmen · .nachtlauf/screens/abnahme/bestellung-link/2-1440-dunkel.png
- alle Fassungen · Bild 1 · Punkt 1/2 · Positionen anders aufgebaut: Board knapp „2 × Bergkäse, 250 g · € 13,16“ und eine Zeile „Online bezahlt · € 19,12 inkl. Plattformgebühr“; App Tabelle mit Preisen rechts, eigener Zeile „Plattformgebühr“, fettem „Gesamt“, „Online · Bezahlt“ und Erklärsatz „Die Plattformgebühr ist Teil des Preises …“ · .nachtlauf/screens/abnahme/bestellung-link/1-1440-hell.png
- alle Fassungen · Bild 1 · Punkt 2 · zusätzlicher Satz unter der Überschrift „Deine Bestellung ist bezahlt und beim Hof eingegangen — abholbar am …“, im Board nicht vorhanden · .nachtlauf/screens/abnahme/bestellung-link/1-390-hell.png
- alle Fassungen · Bild 2 · Punkt 1/2 · Positionen als Tabelle mit eigener Zeile „Plattformgebühr“ und „Gesamt“ links / Betrag rechts; Board: „Bar bei Abholung · inkl. Plattformgebühr“ und „Gesamt € 29,28“ in einer Zeile; App nur „Bar bei Abholung“ · .nachtlauf/screens/abnahme/bestellung-link/2-390-hell.png
- 390 hell/dunkel · Bild 2 · Punkt 1/2 · Unterzeile „Zurück zu Hof Müller“ unter „Bestätigen“ im Kopf fehlt · .nachtlauf/screens/abnahme/bestellung-link/2-390-dunkel.png
- 390 hell/dunkel · Bild 3 · Punkt 1 · zusätzlicher Zurück-Pfeil „<“ im Kopf, Board zeigt nur „Bestätigen“ · .nachtlauf/screens/abnahme/bestellung-link/3-390-hell.png
- alle Fassungen · Bild 2 und 3 · Punkt 1/4 · zusätzlicher Link „Vertrag widerrufen“ (im Board nicht vorhanden) wirkt als blasser grauer Text ohne Unterstreichung; im Web steht er links außerhalb der Inhaltsspalte · .nachtlauf/screens/abnahme/bestellung-link/3-1440-hell.png
- 1440 hell/dunkel · Bild 4 · Punkt 1 · zusätzlicher Seitenfuß (Logo, Höfe entdecken, Für Höfe, So funktioniert's, Impressum … Vertrag widerrufen), Board zeigt hier keinen Fuß · .nachtlauf/screens/abnahme/bestellung-link/4-1440-dunkel.png
- 1440 hell/dunkel · Bild 3 und 4 · Punkt 1 · Karte deutlich breiter als im Board (Bild 3 ca. 670 px statt ca. 520 px) · .nachtlauf/screens/abnahme/bestellung-link/3-1440-hell.png
- 1440 hell/dunkel · Bild 2 · Punkt 1 · Knöpfe voll abgerundet (Pille) statt abgerundetem Rechteck wie im Board · .nachtlauf/screens/abnahme/bestellung-link/2-1440-hell.png
- 1440 hell/dunkel · Bild 1/4 · Punkt 1 · Kopfleiste auf schmale Spalte begrenzt (Logo bei ca. 137 px statt am Rand bei ca. 40 px wie im Board) · .nachtlauf/screens/abnahme/bestellung-link/1-1440-dunkel.png
- 1440 dunkel · Bild 1/4 · Punkt 2 · Darstellungs-Knopf zeigt Sonne, Board zeigt im Dunkeln den Mond · .nachtlauf/screens/abnahme/bestellung-link/4-1440-dunkel.png
- alle Fassungen · Bild 1 · Punkt 2 · Abholzeit anders geschrieben: Board „heute, Mi 3. März, 15–18 Uhr“, App „Mi, 11. Nov, 15:00–18:00 Uhr“ (Uhrzeit mit Minuten); Adresszeile in der App blasser als im Board · .nachtlauf/screens/abnahme/bestellung-link/1-390-hell.png
- 1440 hell/dunkel · Bild 1 · Punkt 1 · Seitenfuß des Boards (Logo, Höfe entdecken … Problem melden) im App-Bild nicht sichtbar (Bild endet unter „Stornieren geht hier nicht …“), daher nicht beurteilbar · .nachtlauf/screens/abnahme/bestellung-link/1-1440-hell.png

Begründete Ausnahmen gesehen:
- Recht vor Board: Bild 1 „Vertrag widerrufen“ statt „Rücktrittsrecht“ (Wortlaut). Dass der Link in Bild 2/3 überhaupt zusätzlich erscheint und in Bild 4 in den Fußlinks steht, ist ebenfalls rechtlich begründbar; Gestaltung und Platz siehe Mängel.
- Recht vor Board: Fußlinks Impressum, Datenschutz, AGB in Bild 4 (Wortlaut); dass ein Fuß dort erscheint, bleibt als Aufbau-Abweichung gelistet.

Nicht prüfbar:
- keine

### kasse

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 4 | 1 |
| 390 dunkel | 2 | 4 | 1 |
| 1440 hell | 2 | 4 | 1 |
| 1440 dunkel | 2 | 4 | 1 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell + dunkel · Bild 5 · Punkt 6/1 · Zustand ganz anders: Board zeigt oben den Hinweis-Kasten „Mindestbestellwert: Waren für 10 € (mit Plattformgebühr € 10,60).“ / „Dir fehlen noch Waren für € 5,50 (mit Gebühr € 5,83). Leg noch etwas dazu.“ mit Knopf „Zurück zum Angebot“, darunter nur die Übersicht (Artikelzeile, Ware, Plattformgebühr, Gesamt). Die App zeigt stattdessen das volle Formular (Warenkorb, Abholung, Deine Daten) und einen gesperrten Knopf „Zahlungspflichtig bestellen“. Der Hinweis steht nur als kleiner Satz unter dem Knopf: „Mindestbestellwert: Waren für 10 € (mit Plattformgebühr ab € 10,60). Dir fehlen noch Waren für € 6,40.“ Es fehlen der Kasten, der Knopf „Zurück zum Angebot“, der Betrag „mit Gebühr“ und „Leg noch etwas dazu.“ · .nachtlauf/screens/abnahme/kasse/5-390-hell.png, .nachtlauf/screens/abnahme/kasse/5-390-dunkel.png
- 390 hell + dunkel · Bild 5 · Punkt 1 · Die App hat unten eine feste Kaufleiste. Das Board zeigt in diesem Zustand keine · .nachtlauf/screens/abnahme/kasse/5-390-hell.png
- 1440 hell + dunkel · Bild 5 · Punkt 6/1 · Zustand ganz anders: Das Board ist einspaltig und mittig, ohne Seitenspalte, mit Mindestbestellwert-Kasten, „Zurück zum Angebot“ und Übersicht. Die App ist zweispaltig mit vollem Formular und Seitenspalte (Übersicht mit Reservierung, „Angaben zum Hof“, „Deine Bestellung“, Gewährleistung). Kasten und Knopf „Zurück zum Angebot“ fehlen · .nachtlauf/screens/abnahme/kasse/5-1440-hell.png, .nachtlauf/screens/abnahme/kasse/5-1440-dunkel.png
- 1440 hell + dunkel · Bild 1, 2, 3, 5 · Punkt 1 · Kopf anders: Board mit Agrilo-Logo links und Textlink „← Zurück zum Hof“ rechts. App mit Zurückpfeil, „Bestellen“ und rechts „Hof Müller“, also der Handy-Kopf · .nachtlauf/screens/abnahme/kasse/1-1440-hell.png
- 1440 hell + dunkel · Bild 1, 2, 3, 5 · Punkt 1/2 · Seitenüberschrift: Board mit großer h1 „Bestellen bei Hof Müller“ über dem Inhalt. Die App hat keine Seitenüberschrift, nur „Bestellen“ im Kopf · .nachtlauf/screens/abnahme/kasse/1-1440-hell.png
- 1440 hell + dunkel · Bild 1, 3 · Punkt 5 · Das Board zeigt einen Fokusrahmen am ersten Bedienelement („Ändern“). In der App ist kein Fokus sichtbar · .nachtlauf/screens/abnahme/kasse/1-1440-hell.png, .nachtlauf/screens/abnahme/kasse/3-1440-dunkel.png
- 1440 hell + dunkel · Bild 2, 3 · Punkt 1 · Kaufknopf: Im Board steht er in der linken Spalte direkt unter „Bezahlen“, nach einer Trennlinie, mit dem Satz daneben bzw. darunter. In der App steht er in der Seitenspalte unter der Gewährleistungs-Grafik, und die linke Spalte endet leer. Nur zum Teil durch „Zusammenfassung unmittelbar über dem Kaufknopf“ gedeckt, denn zwischen „Deine Bestellung“ und dem Knopf steht die Grafik · .nachtlauf/screens/abnahme/kasse/3-1440-hell.png
- 1440 dunkel · Bild 2, 3, 5 · Punkt 4 · Die Gewährleistungs-Grafik ist im Dunkeln nicht gedämpft. Eine große cremeweiße Fläche (ca. 340 × 480 px) bildet einen hellen Fleck · .nachtlauf/screens/abnahme/kasse/3-1440-dunkel.png
- 390 + 1440 alle Themen · Bild 1 (1440), 3 (390), 5 (1440) · Punkt 1 · Zusätzlicher Hinweis in der Übersicht: „Deine Ware ist bis 21:05 Uhr für dich reserviert (noch 15 Minuten).“ Das Board zeigt ihn nicht · .nachtlauf/screens/abnahme/kasse/3-390-hell.png
- 390 + 1440 alle Themen · Bild 1 (1440), 3 · Punkt 1/2 · Übersicht anders: Die App hat zusätzlich „Preise inkl. USt“ und „Die Plattformgebühr ist Teil des Preises. Der Hof zahlt damit die Bestellplattform Agrilo.“ Es fehlen die Board-Sätze „Du bestellst: … · bar bei Abholung.“ und „Verkäufer ist Hof Müller, … Es gilt die gesetzliche Gewährleistung.“ Den Verkäufer zeigt die App in einer zusätzlichen aufklappbaren Karte „Angaben zum Hof (dein Vertragspartner)“ · .nachtlauf/screens/abnahme/kasse/3-390-hell.png
- 390 + 1440 alle Themen · Bild 1, 5 · Punkt 2/1 · Warenkorb-Karte: Zusätzlicher Satz „Preise inkl. Plattformgebühr“. Die Preise stehen in einer eigenen rechten Spalte statt angehängt („3 × Bergkäse, 250 g · € 19,74“) · .nachtlauf/screens/abnahme/kasse/1-390-hell.png
- 390 + 1440 alle Themen · Bild 2 (und 1440 Bild 1, 5) · Punkt 2 · Datenschutz-Link: In der App steht „Was passiert damit?“, im Board „Wie wir deine Daten verwenden (Datenschutz)“ · .nachtlauf/screens/abnahme/kasse/2-390-hell.png
- 390 + 1440 alle Themen · Bild 2 (und 1440 Bild 1, 5) · Punkt 2 · Zusätzlicher Hilfetext unter E-Mail: „Dorthin schicken wir dir die Bestätigung mit dem Link zu deiner Bestellung.“ Im Web zusätzlich „Nur für Rückfragen des Hofs.“, das Board zeigt im Web unter den Feldern keine Hilfetexte · .nachtlauf/screens/abnahme/kasse/2-1440-hell.png
- 390 hell + dunkel · Bild 2 · Punkt 1 · „Notiz an den Hof (freiwillig)“ ist ein einzeiliges Feld mit Platzhalter. Im Board ist es ein mehrzeiliges Textfeld, etwa 66 px hoch · .nachtlauf/screens/abnahme/kasse/2-390-hell.png
- 390 + 1440 alle Themen · Bild 2, 3, 5 · Punkt 2 · Bar-Karte: In der App steht „Du bestätigst per E-Mail.“, im Board „Du bestätigst per E-Mail, dann packt der Hof.“ · .nachtlauf/screens/abnahme/kasse/3-390-hell.png
- 390 hell + dunkel · Bild 1, 2, 3, 5 · Punkt 1/2 · Kopf: Im Board steht unter „Bestellen“ die Unterzeile „bei Hof Müller“. In der App steht „Hof Müller“ rechtsbündig im Kopf, ohne „bei“ · .nachtlauf/screens/abnahme/kasse/1-390-hell.png
- 390 + 1440 alle Themen · alle Bilder · Punkt 1 · Eingabefelder und Abhol-/Bezahl-Karten sind deutlich stärker gerundet, fast pillenförmig. Im Board sind sie nur leicht gerundet · .nachtlauf/screens/abnahme/kasse/2-390-hell.png
- 390 + 1440 dunkel · Bild 1, 3, 5 · Punkt 4 · Gewählte Karte und Radio: Im Board haben sie einen hellen Mintrahmen und einen gefüllten Mintpunkt. In der App ist der Rahmen dunkelgrün mit weniger Kontrast zur Fläche, das Radio ein weißer Ring · .nachtlauf/screens/abnahme/kasse/1-390-dunkel.png
- 390 + 1440 alle Themen · Bild 1 (1440), 3 · Punkt 1 · Das Info-Symbol neben „Plattformgebühr (6 %)“ ist sichtbar kleiner und dünner als der Kreis mit „i“ im Board · .nachtlauf/screens/abnahme/kasse/3-390-hell.png
- 1440 hell + dunkel · Bild 2 · Punkt 5 · Fokus: Das Board zeigt ihn am ersten Feld (E-Mail), die App am Telefonfeld, weil dort zuletzt getippt wurde. Der Fokus ist sichtbar, aber an einem anderen Element · .nachtlauf/screens/abnahme/kasse/2-1440-hell.png

Begründete Ausnahmen gesehen:
- Recht vor Board (Kasse): Sätze unter jedem Kaufknopf („Es gelten die AGB von Agrilo. Dein Vertragspartner ist der Hof. …“ und „Du kannst vom Kauf innerhalb von 14 Tagen … Rücktritt“) statt der Board-Sätze („Du zahlst im nächsten Schritt …“ bzw. „Mit dem Klick bestellst du verbindlich …“).
- Recht vor Board (Kasse): Gewährleistungs-Grafik in der Seitenspalte (1440).
- Recht vor Board (Kasse): Zusammenfassung „Deine Bestellung“ (Waren, Abholung, Vertragspartner, Gesamt) über dem Kaufknopf (1440).
- Kein Mangel, sondern Beispieldaten: Hof Müller bietet nur „Bar bei Abholung“ an, deshalb fehlt die Karte „Online bezahlen“ und Bild 1/2 tragen schon „Zahlungspflichtig bestellen“ statt „Weiter zur Zahlung“ (das Board zeigt diesen Text für Bar ebenso). Ebenso fehlt „Bestellschluss für heute: 15:00 Uhr.“, weil es in den Daten keinen Termin für heute gibt.

Nicht prüfbar:
- Bild 4 (390/1440, hell/dunkel): Braucht Online-Zahlung: Hof Mueller bietet nur Bar an (Stripe nicht bereit, Platzhalter-Schluessel); der Abgelehnt-Hinweis entsteht nur nach einer abgelehnten Stripe-Zahlung im Browser.

### korb

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 3 | 3 | 0 |
| 390 dunkel | 3 | 3 | 0 |
| 1440 hell | 3 | 3 | 0 |
| 1440 dunkel | 3 | 3 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 1440 hell · Bild 1 · Punkt 5 · Board zeigt einen sichtbaren Fokusrahmen um „Schließen“ (erstes Bedienelement), in der App ist kein Fokus zu sehen · .nachtlauf/screens/abnahme/korb/1-1440-hell.png
- 1440 hell · Bild 2 · Punkt 5 · wie Bild 1: Fokusrahmen um „Schließen“ fehlt · .nachtlauf/screens/abnahme/korb/2-1440-hell.png
- 1440 hell · Bild 3 · Punkt 5 · wie Bild 1: Fokusrahmen um „Schließen“ fehlt · .nachtlauf/screens/abnahme/korb/3-1440-hell.png
- 1440 dunkel · Bild 1/2/3 · Punkt 5 · Board zeigt einen hellgrünen Fokusrahmen um „Schließen“, in der App fehlt er in allen drei Bildern · .nachtlauf/screens/abnahme/korb/1-1440-dunkel.png
- 390/1440 hell+dunkel · Bild 3 · Punkt 1 · Leer-Zustand anders aufgebaut: Board = linksbündiger Hinweiskasten („Dein Warenkorb ist leer.“ fett in Grundschrift + Satz), darunter außerhalb des Kastens der volle breite Knopf „Zum Angebot“, dann „Höfe entdecken“; App = zentrierte Karte mit zusätzlichem Korb-Symbol im Kreis, Überschrift zentriert in Serifenschrift und „Zum Angebot“ innerhalb der Karte · .nachtlauf/screens/abnahme/korb/3-390-hell.png
- 390/1440 hell+dunkel · Bild 3 · Punkt 1 · App zieht unter dem Kopf „Warenkorb · Schließen“ eine Trennlinie, das Board zeigt im Leer-Zustand keine · .nachtlauf/screens/abnahme/korb/3-1440-hell.png
- 390/1440 hell+dunkel · Bild 2 · Punkt 2 · fester Satz im Hinweis anders: Board „<Produkt> ist gerade ausverkauft – wir haben ihn herausgenommen.“, App „Eine Position ist nicht mehr verfügbar und wurde entfernt.“ (nennt das Produkt nicht) · .nachtlauf/screens/abnahme/korb/2-390-hell.png
- 390/1440 hell · Bild 2 · Punkt 4 · Hinweis-Farbwirkung anders: Board Überschrift und Satz in Warnfarbe (rotbraun), App Überschrift und Satz in normaler dunkler Schrift; App-Kasten stark gerundet (fast Pillenform) statt leicht gerundet · .nachtlauf/screens/abnahme/korb/2-1440-hell.png
- 390/1440 dunkel · Bild 2 · Punkt 4 · Hinweis im Board mit braun getönter Fläche und orangefarbener Schrift, in der App dunkle Fläche mit orangem Rand und weißer Schrift · .nachtlauf/screens/abnahme/korb/2-390-dunkel.png
- 390/1440 hell+dunkel · Bild 2 · Punkt 1 · Board trennt Hinweis und erste Position mit einer Linie, in der App fehlt diese Linie · .nachtlauf/screens/abnahme/korb/2-390-hell.png
- 390/1440 hell+dunkel · Bild 1/2/3 · Punkt 1 · Blatt bzw. Seitenspalte reicht nicht bis zum rechten Rand: rechts bleibt ein etwa 15 px breiter Streifen in anderer Farbe (Scrollleisten-Spalte), im Board schließt das Blatt bündig ab · .nachtlauf/screens/abnahme/korb/1-390-hell.png
- 390/1440 hell+dunkel · Bild 1/2 · Punkt 1 · Produktbild-Platzhalter in den Positionen rund (Kreis) statt abgerundetes Quadrat wie im Board · .nachtlauf/screens/abnahme/korb/1-390-hell.png
- 1440 dunkel · Bild 1/2/3 · Punkt 4 · hinter dem Blatt leuchten die Produktbilder der Hofseite als helle Quadrate durch die Abdunklung; im Board sind die Bildflächen dunkel gedämpft · .nachtlauf/screens/abnahme/korb/1-1440-dunkel.png
- 390 hell+dunkel · Bild 1/2/3 · Punkt 1 · Hintergrund: App zeigt über dem Hofkopf zusätzlich die Leiste „Agrilo · Anmelden“ und (Bild 2/3) den großen Hof-Kopf mit „Anfahrt/Bestellen“, Board zeigt nur den kompakten Hofkopf mit Reitern; Untertitel „Nimmt Bestellungen an“ groß statt „nimmt“ klein (gehört eher zum Board der Hofseite) · .nachtlauf/screens/abnahme/korb/1-390-hell.png

Begründete Ausnahmen gesehen:
- keine

Nicht prüfbar:
- keine

### meine-bestellungen

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 3 | 2 | 4 |
| 390 dunkel | 3 | 2 | 4 |
| 1440 hell | 2 | 2 | 4 |
| 1440 dunkel | 2 | 2 | 4 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell · Bild 2 · Punkt 1/3 · Code-Feld: Board zeigt ein einzelnes Eingabefeld mit sichtbarer Beschriftung „Code“, App zeigt sechs Einzelkästchen ohne sichtbare Beschriftung „Code“ · .nachtlauf/screens/abnahme/meine-bestellungen/2-390-hell.png
- 390 dunkel · Bild 2 · Punkt 1/3 · wie 390 hell: sechs Einzelkästchen statt eines Felds, Beschriftung „Code“ fehlt · .nachtlauf/screens/abnahme/meine-bestellungen/2-390-dunkel.png
- 1440 hell · Bild 2 · Punkt 1/3 · wie 390: sechs Einzelkästchen statt eines breiten Felds, Beschriftung „Code“ fehlt · .nachtlauf/screens/abnahme/meine-bestellungen/2-1440-hell.png
- 1440 dunkel · Bild 2 · Punkt 1/3 · wie 1440 hell: sechs Einzelkästchen, Beschriftung „Code“ fehlt · .nachtlauf/screens/abnahme/meine-bestellungen/2-1440-dunkel.png
- 1440 hell · Bild 1 · Punkt 5 · Board zeigt deutlichen Fokusring am E-Mail-Feld, App zeigt an keinem Bedienelement einen sichtbaren Fokus · .nachtlauf/screens/abnahme/meine-bestellungen/1-1440-hell.png
- 1440 dunkel · Bild 1 · Punkt 5 · Board zeigt hellgrünen Fokusring am E-Mail-Feld, App zeigt keinen sichtbaren Fokus · .nachtlauf/screens/abnahme/meine-bestellungen/1-1440-dunkel.png
- 1440 dunkel · Bild 2 · Punkt 5 · Board zeigt Fokusring am Knopf „Bestellungen anzeigen“, App zeigt keinen sichtbaren Fokus · .nachtlauf/screens/abnahme/meine-bestellungen/2-1440-dunkel.png
- 1440 hell/dunkel · Bild 1+2 · Punkt 1 · Fußbereich: Board zeigt Links in der Inhaltsspalte unter einer Trennlinie in zwei Zeilen („Höfe entdecken · Für Höfe · So funktioniert’s“ / „Impressum · Datenschutz · AGB · Problem melden“, unterstrichen), App zeigt eine seitenbreite Fußleiste mit Logo, Links in einer Zeile, nicht unterstrichen · .nachtlauf/screens/abnahme/meine-bestellungen/1-1440-hell.png
- alle Fassungen · Bild 2 · Punkt 1/2 · App zeigt im Code-Schritt weiter den Einleitungssatz „Hier findest du alle Bestellungen … nur für diesen Besuch.“ unter der h1; Board zeigt im Code-Schritt keinen Einleitungssatz · .nachtlauf/screens/abnahme/meine-bestellungen/2-390-hell.png
- alle Fassungen · Bild 2 · Punkt 2 · Fehlertext: Board „Bitte gib alle 6 Ziffern ein.“, App „Bitte gib alle 6 Ziffern aus der E-Mail ein.“ · .nachtlauf/screens/abnahme/meine-bestellungen/2-390-hell.png
- alle Fassungen · Bild 2 · Punkt 2 · Zusatzsatz „Er gilt 10 Minuten.“ hinter „… geschickt.“, im Board nicht vorhanden; E-Mail-Adresse in der App fett, im Board normal · .nachtlauf/screens/abnahme/meine-bestellungen/2-1440-hell.png
- alle Fassungen · Bild 2 · Punkt 1 · zusätzlicher Link „Andere E-Mail“ rechts neben „Code erneut senden“; Board zeigt nur „Code erneut senden (30 s)“ mittig · .nachtlauf/screens/abnahme/meine-bestellungen/2-390-hell.png
- 390 hell/dunkel · Bild 2 · Punkt 2 · zusätzlicher Hinweis „Der Code wird beim Antippen automatisch aus der E-Mail übernommen, wenn dein Telefon das kann.“ in der Karte, im Board nicht vorhanden · .nachtlauf/screens/abnahme/meine-bestellungen/2-390-hell.png
- alle Fassungen · Bild 2 · Punkt 1 · Satz „Jede Bestellung erreichst du auch über den Link in deiner Bestätigungsmail.“ steht in der App auch im Code-Schritt unter der Karte; Board zeigt ihn dort nicht · .nachtlauf/screens/abnahme/meine-bestellungen/2-1440-hell.png
- alle Fassungen · Bild 2 · Punkt 4 · Farbwirkung Fehler: Board zeigt Fehlerrand und Fehlertext in Rostbraun/Orange (dunkel: Apricot), App in Rot · .nachtlauf/screens/abnahme/meine-bestellungen/2-390-dunkel.png
- alle Fassungen · Bild 1 · Punkt 2 · zusätzlicher Satz in der Karte über dem Feld: „Gib die E-Mail-Adresse ein, mit der du bestellt hast. Wir schicken dir einen 6-stelligen Code – ein Konto brauchst du dafür nicht.“; Board beginnt die Karte direkt mit „E-Mail“ · .nachtlauf/screens/abnahme/meine-bestellungen/1-390-hell.png
- alle Fassungen · Bild 1 · Punkt 3 · Feldbeschriftung „E-Mail“ in der App klein und grau, im Board fett in Textfarbe und größer · .nachtlauf/screens/abnahme/meine-bestellungen/1-1440-hell.png
- 390 hell/dunkel · Bild 1+2 · Punkt 1 · zusätzlicher Fußbereich (Impressum, Datenschutz, AGB, Problem melden, Vertrag widerrufen) und Knopf „Darstellung: hell/dunkel“ unter dem Inhalt; Board zeigt auf 390 keinen Fußbereich und keinen Darstellungs-Knopf · .nachtlauf/screens/abnahme/meine-bestellungen/1-390-hell.png
- 390 hell/dunkel · Bild 1+2 · Punkt 1 · untere Leiste: aktiver Reiter „Bestellungen“ im Board mit hinterlegter Pille um das Symbol und grüner Schrift, in der App ohne Pille, schwarze/weiße Schrift; Warenkorb-Symbol anders (Korb statt Tasche) · .nachtlauf/screens/abnahme/meine-bestellungen/1-390-dunkel.png
- alle Fassungen · Bild 1 · Punkt 4 · E-Mail-Feld in der App mit getönter Fläche (hell: beige, dunkel: fast schwarz) statt der Kartenfläche mit Rand wie im Board; Karte stärker gerundet · .nachtlauf/screens/abnahme/meine-bestellungen/1-390-hell.png
- 1440 dunkel · Bild 1+2 · Punkt 1 · Darstellungs-Knopf im Kopf zeigt in der App eine Sonne, im Board den Mond · .nachtlauf/screens/abnahme/meine-bestellungen/1-1440-dunkel.png
- 1440 hell/dunkel · Bild 1+2 · Punkt 1 · Kopf in der App auf Inhaltsbreite eingerückt (Logo und Anmelden weiter innen), im Board bis an den Rand; kleine Abweichung · .nachtlauf/screens/abnahme/meine-bestellungen/1-1440-hell.png

Begründete Ausnahmen gesehen:
- Recht vor Board: Fußlink „Vertrag widerrufen“ (App, 390 und 1440) – Wortlaut bleibt; die Lage des Fußbereichs ist oben trotzdem als Abweichung geführt.
- Fußlinks und Textlinks („Code erneut senden“, „Andere E-Mail“, Fußlinks) sichtbar kleiner als 44 px – erlaubt (Trefferfläche über ::before).

Nicht prüfbar:
- Bild 3 (390/1440): Mail-Code: Die Liste erscheint erst nach einem richtigen 6-stelligen Code per Mail; lokal geht keine Mail raus, Code/Cookie wurde nicht umgangen.
- Bild 4 (390/1440): Mail-Code (siehe Bild 3); „Keine Bestellungen gefunden“ folgt erst nach bestandenem Code.
- Bild 5 (390/1440): Mail-Code und Datenbankfehler nötig (Ladefehler der Liste); nicht herstellbar.
- Bild 6 (390/1440): Braucht einen gültigen, dann abgelaufenen Zugangs-Cookie (Mail-Code); nicht herstellbar.

### bestellung

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 4 | 0 |
| 390 dunkel | 2 | 4 | 0 |
| 1440 hell | 2 | 4 | 0 |
| 1440 dunkel | 2 | 4 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 1440 hell+dunkel · Bild 1, 2, 4 · Punkt 1 · Board zeigt eine eigene Detailseite („← Zurück“, h1 „Bestellung HM-…“, Unterzeile „Bestellungen“, darunter Name + Marke, Geldkasten und Packliste links, Kundin-Karte rechts daneben); App zeigt Liste + Detail nebeneinander (h1 „Bestellungen“, „5 offen“, Segmente „Heute abholen · Noch offen · Erledigt“, „Packliste drucken“, Bestellkarten links, Detail rechts, Kundin-Karte unter dem Detail statt daneben) · .nachtlauf/screens/abnahme/bestellung/1-1440-hell.png
- 1440 hell+dunkel · Bild 1, 2, 4 · Punkt 1 · Board hat feste Aktionsleiste unten rechts („Artikel fehlt“ · „Weitere Aktionen …“ · „Als gepackt markieren“ bzw. „„Nicht abgeholt“ kostet dich nichts.“ · „Nicht abgeholt“ · „Weitere Aktionen …“ · „Abgeholt und € … kassiert“ bzw. „Abholung rückgängig“); App hat die Knöpfe in der Karte, statt „Weitere Aktionen …“ die Textlinks „Nicht abgeholt“ und „Stornieren“, zusätzlich „Doch nicht gepackt“ (Bild 2) und „Artikel fehlt“ auch nach dem Packen · .nachtlauf/screens/abnahme/bestellung/2-1440-hell.png
- 390 hell+dunkel · Bild 1, 2, 4 · Punkt 1 · Board: feste Leiste unten mit großem Hauptknopf und zwei Knöpfen „Artikel fehlt“/„Nicht abgeholt“ + „Weitere Aktionen …“, keine Tab-Leiste; App: Knöpfe im Fluss der Karte, „Nicht abgeholt“/„Stornieren“ als Textlinks, „Doch nicht gepackt“ zusätzlich, untere Tab-Leiste (Heute, Bestellungen, Neu, Mein Hof, Mehr) sichtbar · .nachtlauf/screens/abnahme/bestellung/1-390-hell.png
- 390 hell+dunkel · Bild 1, 2, 4 · Punkt 1 · Kopf: Board „‹ Bestellung HM-…“ mit Unterzeile „Bestellungen“ und Telefon-Symbol in einer Kopfzeile, dann h1-artig „Anna Berger“ ohne Karte; App: Zeile „← Bestellungen“, darunter h1 „Bestellung TD-…“, Name + Marke in einer umrahmten Karte · .nachtlauf/screens/abnahme/bestellung/1-390-dunkel.png
- alle · Bild 3 · Punkt 1+2 · Dialog „Was fehlt bei …“ anders aufgebaut: Board hat „Abbrechen“ oben rechts, Satz „Tipp an, was du nicht mitgeben kannst. Der Betrag wird automatisch angepasst.“, Kästchen je Artikel mit Wort „fehlt“, Zeile „Neu zu kassieren: € … statt € …“, Knopf „Ohne Freilandeier übergeben“, Link „Ganze Bestellung stornieren …“; App hat Unterzeile mit Nummer/Datum, „Tipp auf den Artikel, der fehlt.“, Chips „da“/„fehlt“, zwei Optionsfelder „Ohne diesen Artikel übergeben“/„Ganze Bestellung stornieren“ mit Beschreibungen, Kasten „Bar zu kassieren bisher … Neu: Warenpreis … + Servicegebühr …“, Knopf „Änderung speichern und Anna informieren“ (390 zusätzlich „Abbrechen“ unten statt oben) · .nachtlauf/screens/abnahme/bestellung/3-390-hell.png
- 390 hell+dunkel · Bild 3 · Punkt 1 · Board-Blatt nimmt gut die halbe Höhe ein, Seite dahinter gedimmt lesbar; App-Blatt fast bildschirmhoch, Seite dahinter verschwommen · .nachtlauf/screens/abnahme/bestellung/3-390-dunkel.png
- 1440 hell+dunkel · Bild 3 · Punkt 5 · Board zeigt den Startfokus sichtbar auf „Abbrechen“; App zeigt keinen Fokusring auf „Abbrechen“ (dunkel eher am ersten Optionsfeld) · .nachtlauf/screens/abnahme/bestellung/3-1440-hell.png
- alle · Bild 1, 2, 4 · Punkt 2 · Geldkasten: Board „Bar zu kassieren“/„Online bezahlt“ in normaler Schreibung, Betrag rechts daneben, Satz „Du bekommst die vollen € … – bis 31. Jänner 2028 zahlst du auf Barverkäufe keine Plattformgebühr.“ bzw. „Du bekommst € … · die Kundin zahlt € … – die Gebühr ist online einbehalten.“; App „BAR ZU KASSIEREN“/„ONLINE BEZAHLT“ in Großbuchstaben, Betrag darunter, Satz „Warenpreis € …“ bzw. „Warenpreis € … + Servicegebühr € … – die Gebühr ist online einbehalten.“ · .nachtlauf/screens/abnahme/bestellung/1-390-hell.png
- alle · Bild 1, 2, 4 · Punkt 1+2 · Packliste: Board als umrahmte Gruppe mit Titel „Packliste · 1 von 3“, eckige Kästchen, Menge fett vorne („4 × Heumilch frisch, 1 L“); App „PACKLISTE 1 von 3 erledigt“, runde Haken, Menge hinten („Heumilch frisch · 4 L“), erledigte Zeilen durchgestrichen · .nachtlauf/screens/abnahme/bestellung/2-390-hell.png
- alle · Bild 4 · Punkt 1+2 · Abgeholt: Board zeigt Packliste „2 von 2“ mit Haken; App zeigt Packliste ohne Kästchen und ohne Zähler; Zusatz „· abgeholt um …“ in der Datumszeile fehlt; Zeile „Bestellnummer … – nur zum Abgleich …“ fehlt; „Abholung rückgängig“ als kleiner Knopf in der Karte statt feste Leiste; App zusätzlich „Drucken“ (1440) · .nachtlauf/screens/abnahme/bestellung/4-1440-hell.png
- alle · Bild 1, 2, 4 · Punkt 1+2 · Kundin-Karte: Board Knöpfe „Anrufen“ und „Per WhatsApp erinnern“, E-Mail als unterstrichener Link, Notiz als „Notiz: „…““; App zeigt Name, Telefonnummer als grüner Link, „Per WhatsApp erinnern“ als Textlink, E-Mail als grauer Text, Notiz in grauem Kasten ohne „Notiz:“ · .nachtlauf/screens/abnahme/bestellung/1-1440-hell.png
- alle · Bild 1, 2 · Punkt 1 · Reihenfolge: Board hat „Bestellnummer … – nur zum Abgleich …“ direkt unter Datum; App unter der Packliste; App zeigt „„Nicht abgeholt“ kostet dich nichts.“ schon im Zustand „zu packen“ (Board 390 erst ab Bild 2) · .nachtlauf/screens/abnahme/bestellung/1-390-hell.png
- alle · Bild 2 · Punkt 1+2 · Rückmeldung: Board dunkler Balken unten „Als gepackt markiert“ · „Rückgängig“ (Textlink); App oben, mintgrün, „Gepackt – Anna bekommt Bescheid“ mit kleinem dunklen/hellen „Rückgängig“-Knopf, verdeckt am Handy den Kopf · .nachtlauf/screens/abnahme/bestellung/2-390-hell.png
- 1440 hell · Bild 2 · Punkt 4 · Grüner Text auf Mint in der Rückmeldung wirkt kontrastschwach · .nachtlauf/screens/abnahme/bestellung/2-1440-hell.png
- 1440 dunkel · Bild 1, 2, 4 · Punkt 4 · Helle Flecken: aktiver Seitenspalten-Eintrag „Bestellungen“ als cremefarbene Fläche und Segment „Noch offen · 5“ hell; Board zeigt den aktiven Eintrag dunkelgrün getönt · .nachtlauf/screens/abnahme/bestellung/1-1440-dunkel.png
- 390 dunkel · Bild 2 · Punkt 4 · „Rückgängig“-Knopf in der Rückmeldung als helle Fläche · .nachtlauf/screens/abnahme/bestellung/2-390-dunkel.png
- 1440 hell+dunkel · Bild 1, 2, 4 · Punkt 5 · Board zeigt Fokus am ersten Kästchen der Packliste; App: Bild 1 Fokus um die ganze Zeile, Bild 2 kein Fokus sichtbar, Bild 4 Fokus auf „Packliste drucken“ · .nachtlauf/screens/abnahme/bestellung/2-1440-dunkel.png
- 1440 hell+dunkel · Bild 1–4 · Punkt 1 · Seitenspalte: App mit Symbolen vor jedem Eintrag, aktiver Eintrag dunkel gefüllt statt hell getönt, „Gründungshof“-Text „ohne Grundgebühr bis 31. Dezember 2027“ statt „noch 11 Monate (bis 31. Jänner 2028)“, „Konto · Franz Müller“ statt „Konto“; Bild 4 Seitenspalte weggescrollt (Logo abgeschnitten) · .nachtlauf/screens/abnahme/bestellung/4-1440-dunkel.png
- 390 + 1440 · Bild 1–4 · Punkt 4 · Rechter Rand der App-Bilder: schmaler Streifen in anderer Fläche (Bild 3: nicht mitgedimmt) · .nachtlauf/screens/abnahme/bestellung/3-1440-hell.png
- alle · Bild 4 · Punkt 4 · Marke „Abgeholt“ grau umrandet statt grün getönt wie im Board · .nachtlauf/screens/abnahme/bestellung/4-390-hell.png

Begründete Ausnahmen gesehen:
- Register vor Board: Im Hofbereich heißt der Stand „Gepackt“ (Marke in Bild 2 und in der Bestellliste), das Board zeigt „Abholbereit“.
- Chips/Segmente/Textlinks kleiner als 44 px (Segmente „Heute abholen · Noch offen · Erledigt“, Chips „da“/„fehlt“) – zulässig.

Nicht prüfbar:
- keine

### bestellungen

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 3 | 0 |
| 390 dunkel | 2 | 3 | 0 |
| 1440 hell | 2 | 3 | 0 |
| 1440 dunkel | 2 | 3 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 1440 hell+dunkel · Bild 1 · Punkt 1/2 · Detailspalte ganz anders aufgebaut: Board zeigt kompakte Vorschau (Name + Marke, darunter „Bestellnummer … · heute, …“, einzeilige Zeile „Bar zu kassieren … € 17,31“, Satz „Du bekommst die vollen € … – bis … zahlst du auf Barverkäufe keine Plattformgebühr.“, Artikelzeile, breiter Knopf „Als gepackt markieren“, Link „Ganze Bestellung öffnen →“); App zeigt die volle Bestellung: großer Block „BAR ZU KASSIEREN“ mit „Warenpreis …“, Packliste mit Haken, zusätzliche Knöpfe „Artikel fehlt“, „Nicht abgeholt“, „Stornieren“, Satz „„Nicht abgeholt“ kostet dich nichts.“, zweite Karte „KUNDIN“ mit Telefon, WhatsApp, E-Mail, Notiz; Satz zur Plattformgebühr und Link „Ganze Bestellung öffnen →“ fehlen; Bestellnummer rechts oben statt unter dem Namen · .nachtlauf/screens/abnahme/bestellungen/1-1440-hell.png
- 390 hell+dunkel · Bild 3 · Punkt 1 · Hinweis-Kasten steht über der h1 „Bestellungen“; Board: Kopf „Bestellungen / Hof am Moos“ zuerst, Kasten darunter · .nachtlauf/screens/abnahme/bestellungen/3-390-hell.png
- 390 hell+dunkel · Bild 3 · Punkt 2 · Überschrift des Kastens „Dein Hof wird noch geprüft – Kundinnen sehen ihn noch nicht“ statt „Richte deinen Hof fertig ein – Kundinnen sehen ihn noch nicht“; zusätzliche Zeile „Deine Hof-ID: …“ und Zusatz „– die Hof-ID ist in der Nachricht schon eingetragen.“; zusätzliches Uhr-Symbol · .nachtlauf/screens/abnahme/bestellungen/3-390-hell.png
- 390 hell+dunkel · Bild 3 · Punkt 1 · Filterleiste „Heute abholen · 0 / Noch offen · 0 / Erledigt“ sichtbar; Board zeigt für den neuen Hof keine Filter · .nachtlauf/screens/abnahme/bestellungen/3-390-hell.png
- 390 hell+dunkel · Bild 3 · Punkt 1/2 · Leer-Karte anders: Board linksbündig, Text „Sobald dein Hof freigeschaltet ist, kommen hier die Bestellungen an. Dann kannst du deine Hofseite teilen.“ und Link „Was bis zur Freischaltung noch fehlt →“; App zentriert mit Postfach-Symbol, gestrichelter Rand, Text „Teile deine Hofseite, damit Kundinnen bei dir bestellen können.“ und Knopf „Zu Mein Hof“ · .nachtlauf/screens/abnahme/bestellungen/3-390-hell.png
- 1440 hell+dunkel · Bild 3 · Punkt 1/2 · dieselben Abweichungen wie bei 390: Kasten über der h1, Überschrift „Dein Hof wird noch geprüft …“ samt Hof-ID-Zeilen, Filterleiste zusätzlich, Leer-Karte mit „Teile deine Hofseite …“ und „Zu Mein Hof“ statt „Was bis zur Freischaltung noch fehlt →“; Leer-Karte nur halb breit statt über die volle Inhaltsbreite · .nachtlauf/screens/abnahme/bestellungen/3-1440-hell.png
- 1440 hell+dunkel · Bild 3 · Punkt 1 · Seitenspalte: Logo „Agrilo“ fehlt oben; zusätzliche Karte „Startphase: kostenlos / bis 31. Jänner 2027“, die das Board für den neuen Hof nicht zeigt · .nachtlauf/screens/abnahme/bestellungen/3-1440-hell.png
- 390 dunkel · Bild 3 · Punkt 4 · Kasten-Überschrift und Link „Frage zur Freischaltung stellen“ in Weiß statt in der Warnfarbe (Board: Orange auf dunklem Braun) · .nachtlauf/screens/abnahme/bestellungen/3-390-dunkel.png
- 390 hell+dunkel · Bild 1–3 · Punkt 1 · Untere Leiste: „Neu“ als runder, über die Leiste ragender Knopf mit Beschriftung darunter; Board: flacher, abgerundeter orangefarbener Knopf in der Leiste, „Neu“ fett darunter; aktiver Reiter im Board in Akzentfarbe mit getöntem Hintergrund um das Symbol, in der App nur fett schwarz/weiß · .nachtlauf/screens/abnahme/bestellungen/1-390-hell.png
- 390 hell+dunkel · Bild 1–3 · Punkt 2 · Reiter-Beschriftung abgeschnitten „Bestellun…“ statt „Bestellungen“ · .nachtlauf/screens/abnahme/bestellungen/1-390-hell.png
- 390 hell+dunkel · Bild 1 · Punkt 1 · Bestellungen je Abholfenster als einzelne Karten mit Abstand; Board: eine gemeinsame Karte je Abholfenster mit Trennlinien zwischen den Zeilen · .nachtlauf/screens/abnahme/bestellungen/1-390-hell.png
- 1440 hell+dunkel · Bild 1 · Punkt 1 · Liste ebenso als Einzelkarten statt einer Karte je Abholfenster; gewählte Zeile mit grünem Rahmen statt grün getöntem Hintergrund · .nachtlauf/screens/abnahme/bestellungen/1-1440-hell.png
- 1440 dunkel · Bild 1–2 · Punkt 4 · aktiver Eintrag „Bestellungen“ in der Seitenspalte als heller, cremefarbener Balken (heller Fleck im Dunkeln); Board: dunkelgrün getönt mit grüner Schrift · .nachtlauf/screens/abnahme/bestellungen/1-1440-dunkel.png
- 1440 hell · Bild 1–2 · Punkt 4 · aktiver Eintrag „Bestellungen“ dunkel gefüllt mit weißer Schrift; Board: hellgrün getönt mit grüner Schrift · .nachtlauf/screens/abnahme/bestellungen/1-1440-hell.png
- 390 hell+dunkel · Bild 2 · Punkt 2/6 · Leer-Zeile „Nächste Abholung: Heute, Do 5. Nov, 23–23:30 Uhr“ ohne „· 2 Bestellungen“; außerdem widersprüchlich: „Heute holt niemand etwas ab.“ und als nächste Abholung „Heute“ · .nachtlauf/screens/abnahme/bestellungen/2-390-hell.png
- 1440 hell+dunkel · Bild 2 · Punkt 2/6 · wie bei 390: „· 2 Bestellungen“ fehlt, nächste Abholung „Heute“ trotz „Heute holt niemand etwas ab.“ · .nachtlauf/screens/abnahme/bestellungen/2-1440-hell.png
- 1440 hell+dunkel · Bild 1–3 · Punkt 1 · Seitenspalte mit Symbolen vor jedem Eintrag; Board ohne Symbole · .nachtlauf/screens/abnahme/bestellungen/1-1440-hell.png
- 1440 hell+dunkel · Bild 1–2 · Punkt 2 · Karte Gründungshof: „ohne Grundgebühr bis 31. Dezember 2027“ statt „noch 11 Monate (bis 31. Jänner 2028)“ (fester Teil „ohne Grundgebühr“ vs. „noch … Monate“) · .nachtlauf/screens/abnahme/bestellungen/1-1440-hell.png
- 1440 hell+dunkel · Bild 1–2 · Punkt 1/2 · Fuß der Seitenspalte: „Konto · Franz Müller“ statt „Konto“, Zeile unten abgeschnitten, „Abmelden“ im Bild nicht sichtbar · .nachtlauf/screens/abnahme/bestellungen/2-1440-hell.png
- 390 hell+dunkel · Bild 1–3 · Punkt 1 · Kopf: Druck-Symbol in einem runden Knopf mit Rahmen; Board: freistehendes Symbol, Kopf als abgesetzte Leiste mit Trennlinie · .nachtlauf/screens/abnahme/bestellungen/1-390-hell.png
- 390 hell+dunkel · Bild 1–2 · Punkt 1 · Filter „Erledigt“ rechts angeschnitten; Board zeigt alle drei Filter vollständig · .nachtlauf/screens/abnahme/bestellungen/1-390-hell.png
- 390/1440 · Bild 1 · Punkt 3 · Überschriften der Abholfenster („HEUTE, DO 5. NOV, 23–23:30 UHR · 4“) wirken kleiner als 12 px (Messung: 11 px) · .nachtlauf/screens/abnahme/bestellungen/1-390-hell.png
- 1440 hell+dunkel · Bild 1 · Punkt 1 · Knopf „Als gepackt markieren“ schmal neben weiteren Knöpfen statt über die volle Breite der Detailkarte · .nachtlauf/screens/abnahme/bestellungen/1-1440-hell.png

Begründete Ausnahmen gesehen:
- Register vor Board: Im Hofbereich heißt der fertige Stand „Gepackt“ (Board zeigt „Abholbereit“), Bild 1, 390 und 1440.

Nicht prüfbar:
- keine

### heute

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 5 | 0 |
| 390 dunkel | 2 | 5 | 0 |
| 1440 hell | 2 | 5 | 0 |
| 1440 dunkel | 2 | 5 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 1440 hell/dunkel · Bild 1–5 · Punkt 1 · Spalten anders: Im Board stehen Pflichtkarten, Kennzahlen (3 schmale Kacheln) und Postfach-Karte nur in der Hauptspalte, die rechte Spalte (Zu tun, Nächste Abholung, Umsatz, Tipp) beginnt oben neben „Heute“. In der App laufen Pflichtkarten und Kennzahl-Kacheln über die ganze Breite, die rechte Spalte fängt erst unter den Kacheln an · .nachtlauf/screens/abnahme/heute/1-1440-hell.png
- 1440 hell/dunkel · Bild 2 · Punkt 1 · Board: nur die Hauptspalte scrollt, Kopf „Heute“ und rechte Spalte bleiben stehen. App: ganze Seite gescrollt, Kopf und rechte Spalte (Zu tun) sind mit weggescrollt · .nachtlauf/screens/abnahme/heute/2-1440-hell.png
- 1440 hell/dunkel · Bild 2 · Punkt 5 · Board zeigt den Fokus auf der ersten Packlisten-Zeile (Anna Berger). In der App ist kein Fokusrahmen zu sehen · .nachtlauf/screens/abnahme/heute/2-1440-dunkel.png
- 1440 dunkel · Bild 1–5 · Punkt 4 · Aktiver Menüpunkt „Heute“ in der Seitenspalte ist eine helle cremefarbene Fläche mit dunkler Schrift, also ein heller Fleck im Dunkeln. Im Board ist er eine gedämpfte dunkelgrüne Fläche · .nachtlauf/screens/abnahme/heute/1-1440-dunkel.png
- 1440 hell · Bild 1–5 · Punkt 4 · Aktiver Menüpunkt „Heute“ ist schwarz mit weißer Schrift, im Board blassgrün mit grüner Schrift (andere Farbwirkung) · .nachtlauf/screens/abnahme/heute/1-1440-hell.png
- 1440 · Bild 1–5 · Punkt 1 · Seitenspalte: oben fehlt das Logo „Agrilo“ (die Spalte beginnt angeschnitten mit der Hof-Karte), die Menüpunkte haben zusätzliche Icons, „Konto · Franz Müller“ statt „Konto“ · .nachtlauf/screens/abnahme/heute/1-1440-hell.png
- 390 hell/dunkel · Bild 1–5 · Punkt 1 · Kopf fehlt: Im Board gibt es eine feste Kopfleiste mit „Heute“, Datum darunter und rechts das Postfach-Icon mit Zähler. In der App gibt es kein Postfach-Icon, „Heute“ ist eine große freistehende Überschrift ohne Leiste und scrollt mit (Bild 2) · .nachtlauf/screens/abnahme/heute/1-390-hell.png
- 390 hell/dunkel · Bild 1–5 · Punkt 1 · Untere Leiste: Im Board ist „Neu“ ein flacher oranger Knopf in der Leiste und „Heute“ hat eine farbige Pille. In der App ist „Neu“ ein runder, herausstehender Knopf ohne Pille, und „Bestellungen“ wird zu „Bestellung…“ gekürzt · .nachtlauf/screens/abnahme/heute/1-390-dunkel.png
- 390/1440 · Bild 1, 2, 5 · Punkt 1 · Packliste: Im Board steht links eine eigene Spalte mit Uhrzeit, fett (15:00) und der volle Name. In der App fehlt die Uhrzeit-Spalte (390: Zeitfenster „15:00–18:00“ in der Unterzeile; 1440: Fenster statt Einzelzeit), Namen sind gekürzt („Anna B.“), und es gibt eine zusätzliche Zeile „Samstag: 1 Bestellung“ · .nachtlauf/screens/abnahme/heute/1-390-hell.png
- 390/1440 · Bild 1, 2 · Punkt 1 · Zusätzlicher Block „Was gibt’s Neues am Hof?“ mit Chips (Frisches Produkt, Neue Saison, Aktion, Hinweis), den es im Board nicht gibt. Er steht vor der Teilen-Karte und verschiebt die Reihenfolge · .nachtlauf/screens/abnahme/heute/2-390-hell.png
- 390 · Bild 2 · Punkt 1 · Reihenfolge Board: Braucht dich → Teilen → Nächste Abholung → Umsatz diese Woche → Tipp. App: Alle Bestellungen → Was gibt’s Neues → Teilen → „ZU TUN · 3“ mit „Ausblenden“ und Link-Liste. Im sichtbaren Teil fehlen Braucht dich, Nächste Abholung und Umsatz · .nachtlauf/screens/abnahme/heute/2-390-hell.png
- 390/1440 · Bild 3 · Punkt 2/6 · Zustand „Online-Zahlung pausiert“ wird nicht gezeigt. Board: „Online-Zahlung ist pausiert“ / „Stripe braucht noch eine Angabe von dir. Bar bei Abholung geht weiter.“ / Knopf „Bei Stripe ergänzen“. App: „Online-Zahlung einrichten“ / „Damit deine Kundinnen … richte bitte die Online-Zahlung ein …“ / „Jetzt einrichten“ · .nachtlauf/screens/abnahme/heute/3-390-hell.png
- 390/1440 · Bild 4 · Punkt 2 · Freigabe-Karte: Board „Richte deinen Hof fertig ein – Kundinnen sehen ihn noch nicht“, App „Dein Hof wird noch geprüft – Kundinnen sehen ihn noch nicht“. Zusätzlich gibt es die Zeile „Deine Hof-ID: …“ und den Nachsatz „– die Hof-ID ist in der Nachricht schon eingetragen.“ · .nachtlauf/screens/abnahme/heute/4-390-hell.png
- 390/1440 · Bild 4 · Punkt 1 · Die Freigabe-Karte steht in der App über der h1 „Heute“ (1440 über die volle Breite), im Board unter dem Kopf in der Hauptspalte. Die Karte „Online-Zahlung einrichten“ fehlt in der Hauptspalte. Dafür steht eine AGB-Karte da, die das Board nicht zeigt. „Hof am Moos ·“ fehlt vor dem Datum · .nachtlauf/screens/abnahme/heute/4-1440-hell.png
- 1440 · Bild 4 · Punkt 2 · Leere Packliste: Board „Ohne Abholzeit kann niemand bei dir bestellen. Trag ein, wann man bei dir abholen kann.“, App „Trag deine Abholzeiten ein, damit deine Kundinnen bei dir bestellen können.“ „Zu tun“ hat einen zusätzlichen Einleitungssatz und Beschreibungen unter jedem Link, im Board stehen nur 2 Links. In der Seitenspalte steht zusätzlich die Karte „Startphase: kostenlos“ · .nachtlauf/screens/abnahme/heute/4-1440-dunkel.png
- 390/1440 · Bild 5 · Punkt 2 · AGB-Karte: Board „Bitte bestätige die neuen AGB“ / „Ab 1. April 2027 gelten neue AGB für Agrilo. Lies sie in Ruhe – das Wichtigste steht ganz oben.“ / ein Knopf „AGB lesen und bestätigen“ über die ganze Breite. App „AGB bestätigen“ / „Bitte lies die AGB (Fassung 0.9) …“ / zwei Knöpfe „AGB lesen“ und „Ich stimme den AGB zu“ · .nachtlauf/screens/abnahme/heute/5-390-hell.png
- 390/1440 · Bild 3–5 · Punkt 1 · Pflichtkarten haben in der App ein Icon links und einen kleinen gefüllten Knopf (1440: Knopf rechts in einer Zeile). Im Board gibt es kein Icon, und der Knopf läuft über die volle Breite (Umriss bzw. gefüllt) · .nachtlauf/screens/abnahme/heute/5-1440-hell.png
- 1440 · Bild 2 · Punkt 1/2 · Tipp-Karte: Board steht sie in der rechten Spalte mit „Mit einem Tipp in deinem Hof“ / „Leg Agrilo auf den Startbildschirm.“ / Knopf „So geht’s“. App: Karte über die ganze Breite mit iPhone-/Android-Anleitung und ohne Knopf · .nachtlauf/screens/abnahme/heute/2-1440-hell.png
- 1440 · Bild 1, 2 · Punkt 2/4 · Umsatz diese Woche: Der heutige Balken ist orange hervorgehoben, im Board sind alle Balken grün. Der feste Satz „Mehr als letzte Woche bis Mittwoch (€ …)“ heißt in der App „+472 % gegenüber der Vorwoche bis Donnerstag, 20:49“ · .nachtlauf/screens/abnahme/heute/2-1440-dunkel.png
- 390/1440 · Bild 1, 3, 5 · Punkt 1 · Unter „Heute eingenommen“ steht die zusätzliche Zeile „mit Hofladen“. Der Betrag hat das Format „€ 0,00“ statt „€ 0“ (Bild 4) · .nachtlauf/screens/abnahme/heute/1-390-hell.png
- 1440 · Bild 1, 3, 5 · Punkt 2 · Gründungshof-Karte: Board „noch 11 Monate (bis 31. Jänner 2028)“, App „ohne Grundgebühr bis 31. Dezember 2027“ · .nachtlauf/screens/abnahme/heute/1-1440-hell.png
- 390/1440 · Bild 3, 4 · Punkt 1 · Zeilen bei „Braucht dich“ haben in der App ein Icon in einem Kästchen. Im Board steht nur Titel und Unterzeile („Ohne Kategorie bleibt er nicht im Shop.“), die in der App fehlt · .nachtlauf/screens/abnahme/heute/3-1440-hell.png
- 390/1440 · Bild 1–5 · Punkt 1 · Die Karte „Neue Nachricht im Postfach“ fehlt in allen App-Bildern (vielleicht keine ungelesene Nachricht in den Testdaten, an keinem Bild prüfbar) · .nachtlauf/screens/abnahme/heute/3-390-hell.png
- 390 · Bild 2 · Punkt 1 · Der Knopf „Teilen“ hat in der App ein Teilen-Icon und ist flacher, im Board steht der Knopf ohne Icon · .nachtlauf/screens/abnahme/heute/2-390-dunkel.png

Begründete Ausnahmen gesehen:
- Register vor Board: Im Hofbereich heißt der fertige Stand „Gepackt“ (Packliste, alle Fassungen). Das stimmt mit dem Board überein.
- Register vor Board: Pflichtkarten stehen untereinander (Bild 5: AGB-Karte und Karte Online-Zahlung). Das Board zeigt nur einen Kasten. Den Wortlaut der Karten selbst führe ich oben als Mangel, weil Online-Zahlung und AGB-Hinweis nicht in der Liste der Pflichtkarten stehen.
- Chips (Frisches Produkt, Neue Saison …) und Textlinks („Alle Bestellungen ansehen“, Links bei „Zu tun“) sind kleiner als 44 px sichtbar, das ist erlaubt.

Nicht prüfbar:
- keine (alle 20 App-Bilder erreichbar)

### produkt-neu

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 6 | 0 |
| 390 dunkel | 2 | 6 | 0 |
| 1440 hell | 2 | 6 | 0 |
| 1440 dunkel | 2 | 6 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 1440 hell/dunkel · Bild 6 · Punkt 6 · Zustand „Speichern fehlgeschlagen“ im Bild nicht zu sehen: Dialog steht mitten im Formular (Kurzbeschreibung, Preis & Verfügbarkeit), kein Fehlerkasten und kein „Nochmal“; Board zeigt oben den Kasten „Speichern hat nicht geklappt“ mit dem Knopf „Nochmal“ im Fokus · .nachtlauf/screens/abnahme/produkt-neu/6-1440-hell.png
- 390 hell/dunkel · Bild 6 · Punkt 2/6 · Fehlerkasten „Keine Verbindung / Wir wissen nicht, ob es geklappt hat – lade die Seite neu, bevor du es nochmal tust.“ ohne Knopf; Board: „Speichern hat nicht geklappt / Deine Eingaben sind noch da. Prüf den Empfang und versuch es noch einmal.“ mit Knopf „Nochmal“ · .nachtlauf/screens/abnahme/produkt-neu/6-390-hell.png
- 390 alle · Bild 1–6 · Punkt 1 · Kopf: Schließen-X rechts statt Zurück-Pfeil links; Unterzeile „Lebensmittel“/„Futtermittel“/„Brennmaterial“ fehlt, bei Futter/Brenn steht dafür ein langer Satz („Vom Sackerl für den Hasen bis zum Rundballen – …“, „Brennholz, Anzündholz oder Hackschnitzel – …“) · .nachtlauf/screens/abnahme/produkt-neu/1-390-hell.png
- 390/1440 alle · Bild 1, 5, 6 · Punkt 1 · Abschnitte (Grunddaten, Preis & Verfügbarkeit, Details) sind Trennlinien mit kleiner Überschrift statt eigener Karten mit fetter Überschrift und Zusammenfassung („Waldhonig · Honig und Aufstriche“, „500 g · € 7,50 · Vorrat 12“); Grunddaten nicht zugeklappt · .nachtlauf/screens/abnahme/produkt-neu/1-390-hell.png
- 390/1440 alle · Bild 1, 5, 6 · Punkt 1 · Lebensmittel: zusätzliche Elemente Kurzbeschreibung, Einheit als Auswahl „Stück“, Schalter „Ich verkaufe in festen Paketen“, eigenes Feld „Vorrat (Stück)“, Schalter „Nur saisonal verfügbar“; Board hat Einheit + „Preis je Glas“ nebeneinander, darunter „Im Shop“ · .nachtlauf/screens/abnahme/produkt-neu/1-1440-hell.png
- 390/1440 alle · Bild 1, 6 · Punkt 1/2 · Geldkasten „Du bekommst € 7,50 · die Kundin zahlt € 7,95 / Bar bis … ohne Gebühr für dich.“ fehlt; statt dessen Kleintext „Kunden sehen: € 7,50 / Stück“ · .nachtlauf/screens/abnahme/produkt-neu/1-390-hell.png
- 390/1440 alle · Bild 1, 6 · Punkt 2 · Speicherknopf „Produkt veröffentlichen“ statt „Speichern“ (Bild 2/3: „Futter speichern“; Bild 5: „Noch 1 Angabe fehlt“) · .nachtlauf/screens/abnahme/produkt-neu/1-1440-hell.png
- 390 alle · Bild 1, 5, 6 · Punkt 1 · Fußleiste Lebensmittel: „Abbrechen“ und Speicherknopf nebeneinander, Speicherknopf schmal; Board: breiter Knopf „Speichern“ über ganzer Breite, „Abbrechen“ darunter (bei Futter/Brenn in der App gestapelt, also uneinheitlich) · .nachtlauf/screens/abnahme/produkt-neu/1-390-hell.png
- 1440 alle · Bild 1–6 · Punkt 1 · Im Dialog fehlt die rechte Spalte „So sehen Kunden dein Produkt/Futter/Brennholz“ samt Geldkasten neben dem Formular; Dialog einspaltig · .nachtlauf/screens/abnahme/produkt-neu/1-1440-hell.png
- 390/1440 alle · Bild 1 · Punkt 5 · Fokus liegt auf „Vorrat (Stück)“ mitten im Formular, Board zeigt Fokus auf dem ersten Element (Kopf „Grunddaten“); Formular ist dafür weggescrollt, Label „Kurzbeschreibung (freiwillig)“ unter dem Dialogkopf angeschnitten · .nachtlauf/screens/abnahme/produkt-neu/1-1440-hell.png
- 1440 alle · Bild 2 · Punkt 5 · Fokus auf „Beschreibung (freiwillig)“ statt auf „Name“ wie im Board · .nachtlauf/screens/abnahme/produkt-neu/2-1440-hell.png
- 1440 alle · Bild 3, 6 · Punkt 5 · kein sichtbarer Fokus im Bild; Board zeigt Fokus am Schalter „Nur an landwirtschaftliche Betriebe“ bzw. an „Nochmal“ · .nachtlauf/screens/abnahme/produkt-neu/3-1440-hell.png
- 390/1440 alle · Bild 2 · Punkt 1 · zusätzliche Chip-Gruppen „Kategorie“ (Heu & Stroh …) und „Sorte“ (Wiesenheu …); Verkaufsgrößen als Chips + „Eigene Größe“ + Größen-Tabelle statt Karten je Größe (Kleinballen/Rundballen mit „Du bekommst … · Vorrat …“) und Knopf „+ Größe hinzufügen“; „Hinweise für Kunden (freiwillig)“ nicht zu sehen · .nachtlauf/screens/abnahme/produkt-neu/2-1440-hell.png
- 390/1440 alle · Bild 2 · Punkt 2 · Hilfetext unter Name „Jede Größe heißt im Shop „Name + Größe“, z. B. „Bergwiesen-Heu 5 kg-Sack“.“ statt „Name und Größe, z. B. „Heu, 1. Schnitt, Kleinballen““ · .nachtlauf/screens/abnahme/produkt-neu/2-390-hell.png
- 390/1440 alle · Bild 2, 3 · Punkt 1 · zusätzliche Zeile in der Fußleiste „2 Größen sind sofort sichtbar. 2 Größen folgen nach der Meldung.“ (Board hat keine); widerspricht der Vorschau „0 Größen sichtbar“ in Bild 3 · .nachtlauf/screens/abnahme/produkt-neu/3-390-hell.png
- 390/1440 alle · Bild 3 · Punkt 1 · unterer Teil ganz anders: Schalter „Nur an landwirtschaftliche Betriebe“, Karte „Abholung“ mit „Hinweis“, Karte „Kennzeichnung – Pflicht · noch offen“ mit „Angaben eintragen“ und Zeile „Futtermittel-Nummer (LFBIS)“ unter „Deine Futtermittel-Registrierungen“ fehlen; statt dessen BAES-Hinweiskasten, Link „Meldung eingetragen? Hier bestätigen“, Karten „Eigene Ernte, lose oder in Ballen“/„Eigene Ernte als Heimtierfutter abgepackt – BAES-Meldung · fehlt“, Zeile „Alle Futterarten anzeigen (Handel, Mischfutter, BARF …)“ · .nachtlauf/screens/abnahme/produkt-neu/3-1440-hell.png
- 390/1440 alle · Bild 3 · Punkt 2 · Vorschaukarte mit anderem Inhalt („0 Größen sichtbar“, Marke „Futtermittelbetrieb · LFBIS … · laut Hof“, zwei Sätze zur Servicegebühr/Hofseite) statt „Heu, 1. Schnitt · ab € 2,65 · ab € 0,16 / kg / Preise inkl. Plattformgebühr (6 %)“ · .nachtlauf/screens/abnahme/produkt-neu/3-390-hell.png
- 390/1440 alle · Bild 4 · Punkt 1 · Holz-Angaben ohne Kartenrahmen; zusätzliche Chips „Art“ und „Trocknung“ sowie Feld „Andere Holzart“; Holzart und Scheitlänge als Chips statt zwei Textfelder nebeneinander; „Gelagert seit (freiwillig)“ als native Auswahl „Keine Angabe“, „Überdacht gelagert“ als Kontrollkästchen unter „Lagerung“ statt Schalter mit „Unter Dach, vor Regen geschützt“; Karte „Verkaufsgrößen / 1 Raummeter, geschlichtet“ nicht zu sehen · .nachtlauf/screens/abnahme/produkt-neu/4-1440-hell.png
- 390/1440 alle · Bild 5 · Punkt 1/2 · Kasten „Bitte prüfe die markierten Felder.“ oben fehlt; Abschnitt ohne Unterzeile „Bitte prüfen“ (nur Überschrift eingefärbt); Fehlertext „Bitte gib einen Preis ein, z. B. 5,99.“ statt „Trag einen Preis ein, z. B. 7,50.“; Vorschau „Preis fehlt noch“ fehlt (1440) · .nachtlauf/screens/abnahme/produkt-neu/5-1440-hell.png
- 390/1440 alle · Bild 1, 5, 6 · Punkt 4 · Schalter „Im Shop“ eingeschaltet orange statt grün wie im Board · .nachtlauf/screens/abnahme/produkt-neu/1-390-hell.png
- 390/1440 alle · Bild 1–6 · Punkt 1/3 · Feldbeschriftungen in normaler Stärke und kleiner als im Board (Board: fett, z. B. „Was verkaufst du?“, „Name“); Knopftext „Speichern“/„Futter speichern“ dünner als im Board · .nachtlauf/screens/abnahme/produkt-neu/2-390-hell.png
- 390 dunkel · Bild 6 · Punkt 2 · Kategorie zeigt „Honig & Bienenprodukte ›“ mit Hilfetext „Eine Unterkategorie hilft Kundinnen beim Finden …“ (Board: Auswahl „Honig und Aufstriche“ ohne Hilfetext) · .nachtlauf/screens/abnahme/produkt-neu/6-390-dunkel.png
- 390 dunkel / 1440 dunkel · Bild 1 · Punkt 4 · Zahlfeld „Vorrat“ mit hellem Pfeil-Drehknopf am rechten Rand (kleiner heller Fleck) · .nachtlauf/screens/abnahme/produkt-neu/1-390-dunkel.png

Begründete Ausnahmen gesehen:
- Register vor Board: Produkt-Formulare im Web als Dialog über der Produktliste (1440, alle Bilder) statt eigener Seite mit „← Zurück“ und Seitenspalte.
- Chips (Kategorie, Sorte, Größen, Holzart) sichtbar kleiner als 44 px – zulässig, aber die Chips selbst sind im Board nicht vorgesehen (siehe Mängel).

Nicht prüfbar:
- keine

### produkte

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 4 | 0 |
| 390 dunkel | 2 | 4 | 0 |
| 1440 hell | 3 | 4 | 0 |
| 1440 dunkel | 2 | 4 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell/dunkel · Bild 1, 2, 4 · Punkt 1 · Zusätzliche Karte „Nimmt Bestellungen an · Nächste Abholung … / Pausieren“ zwischen Kopf und Reitern; das Board zeigt dort keine Karte, die Reiter folgen direkt auf den Kopf · .nachtlauf/screens/abnahme/produkte/1-390-hell.png
- 390 hell/dunkel · Bild 1–4 · Punkt 1 · Untere Leiste anders: Board hat „Neu“ als flachen orangen Knopf in der Reihe und „Mein Hof“ aktiv mit hellorangem Hintergrund und orangem Text; die App hat einen runden, erhabenen orangen Knopf über der Leiste, „Mein Hof“ nur fett ohne Hintergrund, „Bestellungen“ abgeschnitten zu „Bestellung…“ · .nachtlauf/screens/abnahme/produkte/1-390-hell.png
- 390 hell/dunkel · Bild 1, 2, 4 · Punkt 1 · Im Kopf fehlt das Postfach-Symbol mit Zähler (Board: Teilen, Ansehen, Postfach mit „1“; App: nur Teilen und Ansehen); auch im leeren Zustand (Bild 3) fehlt es · .nachtlauf/screens/abnahme/produkte/1-390-dunkel.png
- 390 hell/dunkel · Bild 1 · Punkt 1 · Gruppe „Braucht dich“ anders befüllt: Board nur Waldhonig (Kategorie fehlt), Freilandeier mit „Nur noch 3 …“ und Brennholz mit Vorrat 0 stehen im Board unter „Im Shop · 5 · deine Reihenfolge“; die App zieht Brennholz und Eier nach oben („Braucht dich 3“, „Im Shop 4“) · .nachtlauf/screens/abnahme/produkte/1-390-hell.png
- 390 hell/dunkel · Bild 1 · Punkt 2 · Zeilentext ohne Preisaufteilung: Board „500 g · Du bekommst € 7,50 · die Kundin zahlt € 7,95 · nicht im Shop“; App nur „je Paket · € 7,50“ · .nachtlauf/screens/abnahme/produkte/1-390-hell.png
- 390 hell/dunkel · Bild 1 · Punkt 2 · Waldhonig: Board zeigt die Marke „Kategorie ergänzen“; die App zeigt einen gestrichelten Vorschlag mit Funkensymbol „Honig & Bienenprodukte · Waldhonig übernehmen“ (über vier Zeilen umbrochen, Zeile wird hoch) · .nachtlauf/screens/abnahme/produkte/1-390-hell.png
- 390 hell/dunkel · Bild 1 · Punkt 1 · Vorratsknopf: Board nur die Zahl („12“, „40“, „0“, bei Größen „Je Größe“); die App zeigt „12 Pakete“ mit Unterzeile „Vorrat“ in einem breiteren Knopf · .nachtlauf/screens/abnahme/produkte/1-390-hell.png
- 390 hell/dunkel · Bild 1 · Punkt 4 · Überschrift „Braucht dich“ in Orange-Rot und Zähler abgesetzt; Board grau/grün wie „Im Shop“ und „Braucht dich · 1“ in einem Zug · .nachtlauf/screens/abnahme/produkte/1-390-hell.png
- 390 dunkel · Bild 1 · Punkt 4 · Produktbilder auf hellbeigen Kacheln wirken als helle Flecken; das Board zeigt im Dunkeln gedämpfte dunkelgrüne Kacheln · .nachtlauf/screens/abnahme/produkte/1-390-dunkel.png
- 390 hell/dunkel · Bild 2 · Punkt 1 · Zähler anders: Board eine umrandete Pille „− 3 +“; App zwei getrennte runde Knöpfe und ein Eingabefeld mit Unterstrich „3 Pakete“ in sehr großer Schrift · .nachtlauf/screens/abnahme/produkte/2-390-hell.png
- 390 hell/dunkel · Bild 3 · Punkt 1 · Hinweis-Kasten steht über dem Kopf „Mein Hof“ (ganz oben); im Board steht er unter Kopf und Reitern · .nachtlauf/screens/abnahme/produkte/3-390-hell.png
- 390/1440 hell/dunkel · Bild 3 · Punkt 2 · Hinweis-Überschrift: Board „Richte deinen Hof fertig ein – Kundinnen sehen ihn noch nicht“; App „Dein Hof wird noch geprüft – Kundinnen sehen ihn noch nicht“, dazu Uhr-Symbol, zusätzliche Zeile „Deine Hof-ID: …“ und Zusatz „– die Hof-ID ist in der Nachricht schon eingetragen.“ · .nachtlauf/screens/abnahme/produkte/3-1440-hell.png
- 390/1440 hell/dunkel · Bild 3 und 4 · Punkt 1 · Leerkarte anders: Board durchgezogene Karte, Text linksbündig, fette Sans-Überschrift, Knopf über die ganze Breite („Erstes Produkt anlegen“ orange bzw. „Suche zurücksetzen“ umrandet); App gestrichelte Karte, zentriert, Symbol im Kreis, Serifen-Überschrift, schmaler Knopf · .nachtlauf/screens/abnahme/produkte/4-1440-hell.png
- 1440 hell/dunkel · Bild 3 · Punkt 1 · Hinweis-Kasten steht über der Überschrift „Produkte“; im Board darunter · .nachtlauf/screens/abnahme/produkte/3-1440-dunkel.png
- 1440 hell/dunkel · Bild 3 · Punkt 1 · Filterleiste „Alle · 0 / Lebensmittel / Futtermittel / Brennmaterial / Nicht im Shop · 0“ fehlt in der App; die Board-Reihenfolge Überschrift → Hinweis → Chips → Leerkarte ist nicht erreicht · .nachtlauf/screens/abnahme/produkte/3-1440-hell.png
- 1440 hell/dunkel · Bild 1, 2 · Punkt 2 · Spalte „Preis“: Board zweizeilig „Du bekommst € 7,50 / die Kundin zahlt € 7,95“; App nur „€ 1,40“ (bei Fleisch zusätzlich „€ 17,80 / kg“) · .nachtlauf/screens/abnahme/produkte/1-1440-hell.png
- 1440 hell/dunkel · Bild 1 · Punkt 1 · Zeile, die Hilfe braucht (Waldhonig, „Kategorie ergänzen“), steht im Board ganz oben und hinterlegt; in der App steht sie als letzte Zeile ohne Hinterlegung, mit gestricheltem Vorschlag statt Marke „Kategorie ergänzen“ · .nachtlauf/screens/abnahme/produkte/1-1440-hell.png
- 1440 hell/dunkel · Bild 1, 2 · Punkt 2/3 · Tabellenkopf in kleinen Großbuchstaben („PRODUKT“, „EINHEIT“, „PREIS“ …) und sichtbar kleiner; Board „Produkt“, „Einheit“, „Preis“ in normaler Schreibung und Größe · .nachtlauf/screens/abnahme/produkte/1-1440-hell.png
- 1440 hell/dunkel · Bild 1–4 · Punkt 1 · Seitenspalte: Marke „Agrilo“ mit Logo oben fehlt (Hofkarte stößt oben an); Menüpunkte mit Symbolen, im Board ohne; aktiver Punkt „Produkte“ als dunkle (hell) bzw. cremefarbene (dunkel) Pille statt hellgrüner Fläche mit grüner Schrift · .nachtlauf/screens/abnahme/produkte/1-1440-hell.png
- 1440 dunkel · Bild 1–4 · Punkt 4 · Aktiver Menüpunkt „Produkte“ als cremeweiße Pille und Produktbilder auf hellen Kreisen sind helle Flecken im Dunkeln; Board dunkelgrün gedämpft · .nachtlauf/screens/abnahme/produkte/1-1440-dunkel.png
- 1440 hell/dunkel · Bild 1–4 · Punkt 2 · Seitenspalte Texte: Board „Gründungshof · noch 11 Monate (bis …)“ und „Konto“; App „ohne Grundgebühr bis …“ und „Konto · Franz Müller“; in Bild 3 zusätzliche Karte „Startphase: kostenlos“, die das Board nicht zeigt · .nachtlauf/screens/abnahme/produkte/3-1440-hell.png
- 1440 hell/dunkel · Bild 2 · Punkt 5 · Im Dialog kein sichtbarer Fokusrahmen; das Board zeigt den Fokus als Rahmen auf „Abbrechen“ · .nachtlauf/screens/abnahme/produkte/2-1440-hell.png
- 1440 hell/dunkel · Bild 1, 4 · Punkt 5 · Fokus sitzt auf einem anderen Element: Board zeigt den Ring auf dem Chip „Alle · 7“; App auf „Neues Produkt“ (Bild 1) bzw. im Suchfeld (Bild 4) · .nachtlauf/screens/abnahme/produkte/1-1440-dunkel.png
- 1440 hell/dunkel · Bild 4 · Punkt 1/2 · Zusätzliche Zeile „PRODUKTE · 7 · 7 SICHTBAR“ über der Leerkarte (Board: keine, widerspricht „Kein Produkt passt“); zusätzliches Löschen-× im Suchfeld, im Hellen blau statt Token-Farbe · .nachtlauf/screens/abnahme/produkte/4-1440-hell.png
- 390/1440 hell/dunkel · Bild 1–4 · Punkt 1 · Rechts ein rund 15 px breiter Streifen neben Blatt, Abdunklung und unterer Leiste (Seite nicht ganz breit); im Board reicht alles bis zum Rand · .nachtlauf/screens/abnahme/produkte/2-1440-dunkel.png

Begründete Ausnahmen gesehen:
- Register vor Board: Vorrat-Blatt mit „Dazu“ (+5, +10, +25, +50) und „Ausverkauft“ (390 als Blatt, 1440 als Dialog), Bild 2 alle Fassungen.
- Chips (Filter „Alle · 7“, „Lebensmittel“ …) sichtbar kleiner als 44 px – zulässig.

Nicht prüfbar:
- keine (alle Bilder im Manifest erreichbar)

### auswertung

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 6 | 0 |
| 390 dunkel | 2 | 6 | 0 |
| 1440 hell | 3 | 6 | 0 |
| 1440 dunkel | 3 | 6 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell/dunkel · Bild 1–6 · Punkt 1 · Kopf fehlt: Board zeigt feste Kopfleiste mit Zurück-Pfeil, „Auswertung“ und Zeile „<Hof> · Stand <Wochentag, Datum>“; App hat nur große h1 ohne Zurück-Pfeil und ohne Hof-/Stand-Zeile · .nachtlauf/screens/abnahme/auswertung/1-390-hell.png
- 390 hell/dunkel · Bild 1–6 · Punkt 1 · Untere Leiste anders: Board hat „Neu“ als flachen Orange-Knopf in der Leiste und „Mehr“ als getönte Pille; App hat runden, überstehenden Orange-Kreis und „Mehr“ nur fett ohne Pille; „Bestellungen“ ist in der App abgeschnitten („Bestellung…“) · .nachtlauf/screens/abnahme/auswertung/1-390-hell.png
- 390/1440 alle · Bild 1, 4, 5 · Punkt 1 · Zeitraum-Wahl: Board zeigt drei einzelne umrandete Pillen (aktiv dunkel gefüllt, im Dunkeln hell gefüllt); App zeigt einen Segment-Schalter mit getöntem aktiven Segment · .nachtlauf/screens/abnahme/auswertung/1-1440-hell.png
- 390/1440 alle · Bild 1, 4, 5 · Punkt 1 · Monatsnavigation: Board zentriert „Februar 2027“ mit ‹ links und › rechts in eigener Zeile; App: Monat linksbündig (390) bzw. rechts neben dem Schalter (1440), nur ‹, kein › · .nachtlauf/screens/abnahme/auswertung/1-1440-hell.png
- 390/1440 alle · Bild 1, 4, 5 · Punkt 2 · Kennzahl-Karten: Board-Beschriftungen in normaler Schreibung, fett („Über Agrilo“, „Ø Bestellung“, „Nicht abgeholt“); App in Versalien mit Sperrung („ÜBER AGRILO“); Unterzeile Board „abgeholt im Februar“ / „abgeholt 1.–7. März“, App „November 2026 · abgeholte Bestellungen“ / „Diese Woche · abgeholte Bestellungen“ · .nachtlauf/screens/abnahme/auswertung/1-390-hell.png
- 390/1440 alle · Bild 4 · Punkt 2 · Zeitraum-Überschrift Woche: Board „1.–7. März“, App „Diese Woche“ · .nachtlauf/screens/abnahme/auswertung/4-390-hell.png
- 390/1440 alle · Bild 2–5 · Punkt 2 · Titel der Umsatzkarte: Board „Abgeholte Bestellungen und eingetragene Verkäufe“; App „Mit Hofladen“ (Board-Titel nur als kleine Unterzeile), zusätzlich Zeitraum rechts im Kartenkopf · .nachtlauf/screens/abnahme/auswertung/2-1440-hell.png
- 390/1440 alle · Bild 2, 4 · Punkt 2 · Vergleichszeile: Board „+17 % zum Jänner (€ 2.110)“ bzw. „+4 % · verglichen bis zum selben Zeitpunkt (€ 431,20)“ grün neben/unter dem Betrag; App „▲ 472 % mehr als letzte Woche“ bzw. „Noch kein Vormonat zum Vergleich“, dazu Vergleichsbalken mit Legende („November 2026 / Oktober“, „Diese Woche / Woche davor“), die das Board nicht zeigt · .nachtlauf/screens/abnahme/auswertung/4-1440-hell.png
- 390/1440 alle · Bild 2, 3 · Punkt 2 · Gebührenkarte: Board „Plattformgebühr im Februar“ mit Zeilen „Online bezahlt“, „Bar bei Abholung“, „Zusammen“ und einem Erklärabsatz („Darum € … und nicht glatt 6 % …“); App „Servicegebühren dieses Monats“ mit Unterzeile Monat, ohne Zeile „Bar bei Abholung“, drei andere Erklärsätze („Die zahlen deine Kunden zusätzlich …“) · .nachtlauf/screens/abnahme/auswertung/2-390-hell.png
- 1440 hell/dunkel · Bild 4 · Punkt 6 · Woche: Board zeigt „Plattformgebühr diese Woche“ mit Wochenwerten; App zeigt auch in der Wochenansicht „Servicegebühren dieses Monats · November 2026“ · .nachtlauf/screens/abnahme/auswertung/4-1440-hell.png
- 390 hell/dunkel · Bild 2, 3 · Punkt 1 · Reihenfolge: Board Umsatz → Hinweis → Wo kam das Geld her → Was lief am besten → Plattformgebühr → Grenze; App setzt die Gebührenkarte direkt hinter den Umsatz, vor Hinweis und „Wo kam das Geld her“ · .nachtlauf/screens/abnahme/auswertung/2-390-hell.png
- 1440 hell/dunkel · Bild 3 · Punkt 1 · Board 2b zeigt Plattformgebühr und Grenze nebeneinander oben, darunter Wo kam/Was lief; App zeigt (wie Board-Bild 2) Grenze breit ganz unten; App-Bild ist identisch mit Bild 2 (kein eigener Zustand aufgenommen) · .nachtlauf/screens/abnahme/auswertung/3-1440-hell.png
- 390/1440 alle · Bild 2, 3 · Punkt 1/4 · Hinweis-Satz: Board als grün getönter Streifen ohne Symbol; App als neutrale Karte mit Glühbirnen-Symbol · .nachtlauf/screens/abnahme/auswertung/2-1440-hell.png
- 390/1440 alle · Bild 3 · Punkt 2 · Grenze-Karte: Board „GRENZE BE- & VERARBEITUNG 2027“, Marke „Im grünen Bereich“ rechts im Kopf, „€ 1.630 von € 55.000“, Satz beginnt „Nur verarbeitete Produkte wie Bergkäse.“; App „€ 55 000 GRENZE BE- & VERARBEITUNG 2026“, Marke unter dem Betrag (390), zusätzliche Zeilen „Anteil an der Grenze 0 %“ und „Noch € … Spielraum“, Tausender mit Leerzeichen („€ 55 000“), Satz „Nur verarbeitete Produkte wie Bergkäse.“ fehlt · .nachtlauf/screens/abnahme/auswertung/3-390-hell.png
- 390/1440 alle · Bild 2, 3 · Punkt 1/2 · „Was lief am besten“: App mit Rangziffern 1, 2 und Menge in zweiter Zeile; Board einzeilig „Heumilch frisch · 214 L“ ohne Ränge, mit Trennlinien; Fußsatz „Nur Bestellungen über Agrilo, Warenpreis.“ fehlt in der App · .nachtlauf/screens/abnahme/auswertung/2-1440-hell.png
- 390/1440 alle · Bild 1, 4, 5 · Punkt 2 · Linkkarte: Fußsatz Board „Gezählt werden Besuche, keine Bestellungen.“, App „Wir zählen nur Besuche über deinen Link – ohne Cookies und ohne Speicher im Browser.“; App zeigt zusätzlich Zeitraum-Unterzeile und Knopf „Hof teilen auf Heute“ · .nachtlauf/screens/abnahme/auswertung/1-390-hell.png
- 390 hell/dunkel · Bild 4 · Punkt 1 · Wochenansicht: Board zeigt nach den Kennzahlen direkt die Umsatzkarte; App schiebt die Linkkarte dazwischen; Board zeigt in der Woche keinen Einleitungssatz „Deine Zahlen – …“, App schon · .nachtlauf/screens/abnahme/auswertung/4-390-hell.png
- 390/1440 alle · Bild 5 · Punkt 6 · Zustand „nicht freigegeben“ nicht gezeigt: Hinweiskarte „Richte deinen Hof fertig ein – Kundinnen sehen ihn noch nicht“ mit „Frage zur Freischaltung stellen“ fehlt (laut Manifest freigegebener Hof aufgenommen); Linkkarte zeigt Teilen-Knopf statt „Teilen geht, sobald dein Hof online ist.“ · .nachtlauf/screens/abnahme/auswertung/5-390-hell.png
- 1440 hell/dunkel · Bild 5 · Punkt 1/2 · Leerer Umsatz: Board Titel, fetter Satz „Noch keine Verkäufe in diesem Zeitraum“, Satz „Verkaufst du auch am Markt oder ab Hof? Trag es ein, dann siehst du hier alles zusammen.“ und breiter Knopf „Verkauf eintragen“; App gestrichelter Kasten mit Symbol, kleiner Knopf, erklärender Satz fehlt; Linkkarte im Board halbe Breite neben der Umsatzkarte, in der App volle Breite · .nachtlauf/screens/abnahme/auswertung/5-1440-hell.png
- 390/1440 alle · Bild 6 · Punkt 1/4 · Fehler: Board neutrale Karte mit breitem umrandeten Knopf „Noch einmal versuchen“ unter dem Text; App orange getönte Karte mit Warnsymbol, kleiner Knopf (390 links unter dem Text, 1440 rechts daneben) · .nachtlauf/screens/abnahme/auswertung/6-1440-hell.png
- 1440 hell/dunkel · Bild 1–6 · Punkt 1 · Kopf: Board zeigt unter „Auswertung“ die Hofzeile („Hof Müller“), Einleitungssatz als eigenen Absatz; App ohne Hofzeile; Inhalt in der App deutlich breiter (bis an den rechten Rand) als im Board (endet bei ca. 1200 px) · .nachtlauf/screens/abnahme/auswertung/1-1440-hell.png
- 1440 hell/dunkel · Bild 1–6 · Punkt 5 · Board zeigt Fokus am ersten Bedienelement (Rahmen um „Region“, „Woche“, „Auswertung“ bzw. „Frage zur Freischaltung stellen“); in der App ist kein Fokus zu sehen · .nachtlauf/screens/abnahme/auswertung/1-1440-hell.png
- 1440 dunkel · Bild 1–6 · Punkt 4 · Heller Fleck: aktiver Seitenspalten-Eintrag „Auswertung“ ist eine helle, fast weiße Pille; Board zeigt dort eine dunkelgrün getönte Fläche (im Hellen umgekehrt: App dunkel gefüllt, Board hellgrün getönt) · .nachtlauf/screens/abnahme/auswertung/1-1440-dunkel.png
- 390/1440 dunkel · Bild 1–3 · Punkt 4 · Balken: Board-Balken im Dunkeln hell mintgrün, App mittelgrün; Vergleichsbalken und Legendenpunkt „Oktober“ heben sich kaum vom Kartengrund ab · .nachtlauf/screens/abnahme/auswertung/2-1440-dunkel.png
- 1440 hell/dunkel · Bild 1–6 · Punkt 1/2 · Seitenspalte: App mit Symbolen vor jedem Eintrag, Gründungshof-Zeile „ohne Grundgebühr bis …“ statt „noch 11 Monate (bis …)“, unten „Konto · <Name>“ statt „Konto“, „Abmelden“ unten nicht sichtbar · .nachtlauf/screens/abnahme/auswertung/1-1440-hell.png

Begründete Ausnahmen gesehen:
- keine (Segment-Schalter ist sichtbar unter 44 px hoch, als Segment erlaubt)

Nicht prüfbar:
- keine (alle Bilder erreichbar; Bild 5 zeigt laut Manifest einen freigegebenen Hof, die Hinweiskarte „nicht freigegeben“ ließ sich daher nicht vergleichen, siehe Mängel; Bild 3 Web ist dieselbe Aufnahme wie Bild 2)

### beitraege

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 4 | 0 |
| 390 dunkel | 2 | 4 | 0 |
| 1440 hell | 2 | 4 | 0 |
| 1440 dunkel | 2 | 4 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell/dunkel · Bild 1–4 · Punkt 1 · Kopf anders: Board zeigt Zurück-Pfeil + h1 „Neuer Beitrag“ + Brotkrume „Mein Hof › Beiträge“ im Seitenkopf, darunter Schritt-Leiste; App zeigt eine Leiste „← Beiträge“, dann eine umrandete Karte mit Schritt-Leiste zuerst und „Neuer Beitrag“ erst darunter; Brotkrume fehlt · .nachtlauf/screens/abnahme/beitraege/1-390-hell.png
- 390 hell/dunkel · Bild 1–4 · Punkt 1 · Feste Leiste über der Navigation fehlt: Board hat „Weiter zu Empfängern“ / „Vorschau ansehen“ / „Versand starten“ fest unten (bei 3 und 4 mit „← Zurück“ darunter); App setzt den Knopf in den Fluss der Karte (bei 1 und 2 nicht im Bild sichtbar) · .nachtlauf/screens/abnahme/beitraege/3-390-hell.png
- 390 + 1440 · Bild 3–4 · Punkt 1 · „← Zurück“ an anderer Stelle und in anderer Form: Board am Ende (390: Textknopf unter dem Hauptknopf; 1440: umrandeter Knopf links neben dem Hauptknopf); App: kleiner grauer Textlink über der Überschrift · .nachtlauf/screens/abnahme/beitraege/3-1440-hell.png
- 1440 hell/dunkel · Bild 1–4 · Punkt 1 · Inhaltsbereich anders: Board linksbündig in der Hauptspalte ohne Karte, Textlink „‹ Beiträge“, große h1 „Neuer Beitrag“ + Brotkrume, Abschnittsüberschrift („Inhalt erstellen“ usw.) unter der Schritt-Leiste; App mittig in einer umrandeten Karte, „Beiträge“ als Umriss-Pillenknopf, h1 klein in der Karte unter der Schritt-Leiste, keine Brotkrume · .nachtlauf/screens/abnahme/beitraege/1-1440-hell.png
- 390 + 1440 · Bild 1–2 · Punkt 1 · Anlass-Auswahl anders: Board Pillen-Chips in einer Reihe (1440) bzw. umbrechend (390) ohne Symbole; App 2×2-Kacheln mit Symbolen und Haken-Symbol · .nachtlauf/screens/abnahme/beitraege/1-390-hell.png
- 390 + 1440 · Bild 3 · Punkt 1 · Empfänger-Karten anders: Board mit Kontrollkästchen links; App mit Symbol-Kachel (Haus/Brief) links und rundem Haken rechts oben · .nachtlauf/screens/abnahme/beitraege/3-390-hell.png
- 390 + 1440 · Bild 3 · Punkt 1 · Hinweis „Nur Kundinnen, die selbst zugestimmt haben …“ im Board als schlichter Text, in der App in einem grauen Kasten · .nachtlauf/screens/abnahme/beitraege/3-1440-hell.png
- 390 + 1440 · Bild 1–4 · Punkt 2 · Zusätzlicher Untertitel: App zeigt „Inhalt erstellen“ als graue Unterzeile unter „Neuer Beitrag“ (Board: Abschnittsüberschrift) und bei Bild 3 „Kanäle auswählen“, das im Board fehlt · .nachtlauf/screens/abnahme/beitraege/3-390-hell.png
- 390 + 1440 · Bild 1–2 · Punkt 2 · Zusätzliche Zähler „28/80“, „131/500“ (bzw. „0/80“, „0/500“) an Titel und Nachricht, im Board nicht vorhanden · .nachtlauf/screens/abnahme/beitraege/1-1440-hell.png
- 390 + 1440 · Bild 1–2 · Punkt 2 · Hilfetext: Board „{Vorname} wird automatisch ersetzt. …“; App „Tipp: {Vorname} wird automatisch ersetzt. …“ mit Code-Markierung · .nachtlauf/screens/abnahme/beitraege/1-390-hell.png
- 1440 · Bild 1–2 · Punkt 2 · „Produkte verlinken (optional)“ im Board, „(freiwillig)“ in der App; Produkt-Chips zusätzlich mit Preis („Heumilch frisch — € 1,40“), im Board nur der Name · .nachtlauf/screens/abnahme/beitraege/1-1440-hell.png
- 390 + 1440 · Bild 4 · Punkt 2 · Vorschau setzt den Namen nicht ein: Board „Hallo Anna! …“, App „Hallo {Vorname} ! …“ als Code-Marke · .nachtlauf/screens/abnahme/beitraege/4-390-hell.png
- 390 + 1440 · Bild 4 · Punkt 1 · Zusätzliche Anlass-Marke „Frisches Produkt“ über dem Titel der Vorschau; Produkt als kleine graue Marke „… — € 1,40“ statt umrandetem Knopf „Bergkäse · € 6,58“ · .nachtlauf/screens/abnahme/beitraege/4-1440-hell.png
- 390 + 1440 · Bild 4 · Punkt 1 · Empfänger-Block: Board weiße Karte mit Großbuchstaben-Label „EMPFÄNGER“ und schlichten Haken; App grauer Kasten mit „Empfänger“ und eingekreisten Haken · .nachtlauf/screens/abnahme/beitraege/4-390-hell.png
- 1440 hell/dunkel · Bild 2 · Punkt 5 · Fokus nach dem Feldfehler: Board setzt den Fokus sichtbar auf das leere Titelfeld; App lässt den Fokus auf „Beiträge“ (Zurück-Knopf) · .nachtlauf/screens/abnahme/beitraege/2-1440-hell.png
- 1440 hell/dunkel · Bild 1, 3, 4 · Punkt 5 · Fokus am ersten Bedienelement: Board zeigt ihn am ersten Formular-Element (Chip „Frisches Produkt“, Kontrollkästchen „Auf meiner Hofseite anzeigen“, Produkt-Knopf); App am Pillenknopf „Beiträge“ · .nachtlauf/screens/abnahme/beitraege/3-1440-dunkel.png
- 390 + 1440 · Bild 2 · Punkt 6 · Fehlerzustand nicht gleich: Board nur Titel leer mit einer Meldung, Nachricht gefüllt; App auch Nachricht leer mit zweiter Meldung „Bitte schreib eine Nachricht – sie ist der Inhalt deines Beitrags.“ (Zustand anders hergestellt) · .nachtlauf/screens/abnahme/beitraege/2-390-hell.png
- 390 + 1440 · Bild 2 · Punkt 3 · Fehlermeldung „Bitte gib einen Titel ein – …“ in der App sichtbar kleiner und dünner als im Board · .nachtlauf/screens/abnahme/beitraege/2-1440-hell.png
- 1440 dunkel · Bild 1–4 · Punkt 4 · Aktiver Navigationspunkt „Mein Hof“ in der Seitenspalte als heller cremefarbener Balken (heller Fleck); Board zeigt ihn gedämpft dunkelgrün mit grüner Schrift · .nachtlauf/screens/abnahme/beitraege/1-1440-dunkel.png
- 1440 hell · Bild 1–4 · Punkt 1 · Aktiver Navigationspunkt „Mein Hof“ dunkel gefüllt mit heller Schrift; Board hellgrün getönt mit grüner Schrift; Seitenspalte in der App zusätzlich mit Symbolen vor jedem Eintrag · .nachtlauf/screens/abnahme/beitraege/1-1440-hell.png
- 390 hell/dunkel · Bild 1–4 · Punkt 1 · Untere Navigation: Board „Neu“ als orange abgerundetes Rechteck in der Leiste, „Mein Hof“ aktiv mit orange Hinterlegung und oranger Schrift; App runder, herausstehender orange Knopf, „Mein Hof“ nur fett ohne Hinterlegung; „Bestellungen“ in der App abgeschnitten („Bestellung…“) · .nachtlauf/screens/abnahme/beitraege/1-390-hell.png
- 390 + 1440 · Bild 3–4 · Punkt 1 · Erledigte Schritte in der Schritt-Leiste: Board grüne Kreise mit Haken; App dunkle (hell: schwarz, dunkel: cremefarbene) Kreise; App zusätzlich mit Verbindungslinien · .nachtlauf/screens/abnahme/beitraege/4-390-dunkel.png
- 390 + 1440 · Bild 3 · Punkt 2 · Knopf „Vorschau ansehen →“ mit zusätzlichem Pfeil; E-Mail-Satz ohne „…, die letzte ging am 17. Feb raus“ (kann an den Daten liegen) · .nachtlauf/screens/abnahme/beitraege/3-390-hell.png
- 1440 · Bild 3–4 · Punkt 1 · Hauptknopf über die volle Kartenbreite statt rechtsbündig neben „← Zurück“ · .nachtlauf/screens/abnahme/beitraege/4-1440-hell.png

Begründete Ausnahmen gesehen:
- keine (fehlendes Foto und anderes verlinktes Produkt sind laut Manifest Datenänderungen, keine Abweichung)

Nicht prüfbar:
- keine

### einstellungen

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 2 | 0 |
| 390 dunkel | 2 | 2 | 0 |
| 1440 hell | 3 | 2 | 0 |
| 1440 dunkel | 2 | 2 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell/dunkel · Bild 1 + 2 · Punkt 1 · Kopf fehlt: Board zeigt eine Kopfleiste mit Zurück-Pfeil links, Titel „Einstellungen“ und Unterzeile „Hof Müller · Stand <Datum>“, durch eine Linie abgesetzt; App zeigt nur eine freie h1 „Einstellungen“ ohne Zurück-Pfeil und ohne Unterzeile · .nachtlauf/screens/abnahme/einstellungen/1-390-hell.png
- 390 hell/dunkel · Bild 1 + 2 · Punkt 1 · Feste Leiste unten anders: Board zeigt „Neu“ als orange Rechteck-Taste mit fetter Beschriftung in der Leiste und „Mehr“ als aktiven Eintrag mit getönter Pille; App zeigt einen runden, über die Leiste ragenden „+“-Knopf und „Mehr“ nur fett ohne Pille · .nachtlauf/screens/abnahme/einstellungen/1-390-hell.png
- 390 hell/dunkel · Bild 1 + 2 · Punkt 2 · Leisten-Beschriftung abgeschnitten: Board „Bestellungen“, App „Bestellung…“; Leisten-Beschriftungen in der App sichtbar kleiner und dünner als im Board · .nachtlauf/screens/abnahme/einstellungen/1-390-dunkel.png
- 390 hell/dunkel · Bild 2 · Punkt 2 · Fehlertext anders: Board „Deine Angaben sind nicht verloren. Versuch es noch einmal.“, App „Es ist nichts verloren gegangen. Versuch es bitte gleich noch einmal.“ · .nachtlauf/screens/abnahme/einstellungen/2-390-hell.png
- 390 hell/dunkel · Bild 2 · Punkt 2/6 · Fehlerknopf anders: Board volle Breite, umrandet, „Neu laden“; App kleine, kaum abgesetzte Pille „Noch einmal versuchen“ · .nachtlauf/screens/abnahme/einstellungen/2-390-hell.png
- 390 hell/dunkel · Bild 2 · Punkt 1/4 · Fehlerkasten anders: Board neutrale Karte ohne Symbol mit größerer, fetter Überschrift; App orange getönter Kasten mit orangem Rand und Warnsymbol, Überschrift kleiner · .nachtlauf/screens/abnahme/einstellungen/2-390-dunkel.png
- 1440 dunkel · Bild 1 + 2 · Punkt 4 · Heller Fleck: aktiver Seitenspalten-Eintrag „Einstellungen“ ist in der App eine helle Creme-Pille mit dunkler Schrift; Board zeigt eine dunkle, grün getönte Fläche mit grüner Schrift · .nachtlauf/screens/abnahme/einstellungen/1-1440-dunkel.png
- 1440 hell · Bild 1 + 2 · Punkt 4 · Aktiver Seitenspalten-Eintrag „Einstellungen“: Board hellgrüne Fläche mit grüner Schrift, App fast schwarze Pille mit weißer Schrift (andere Farbwirkung) · .nachtlauf/screens/abnahme/einstellungen/1-1440-hell.png
- 1440 hell/dunkel · Bild 1 · Punkt 1 · „Problem melden“ falsch platziert und anders: Board umrandeter Knopf in voller Spaltenbreite unter der Karte „Konto“ (rechte Spalte); App kleine Pille mit Symbol unter der Liste „Dein Hof“ (linke Spalte) · .nachtlauf/screens/abnahme/einstellungen/1-1440-hell.png
- 1440 hell/dunkel · Bild 1 + 2 · Punkt 1/2 · Unterzeile unter der h1 fehlt: Board „Hof Müller“ unter „Einstellungen“, App ohne Unterzeile · .nachtlauf/screens/abnahme/einstellungen/1-1440-hell.png
- 1440 hell/dunkel · Bild 1 · Punkt 5 · Fokus nicht sichtbar: Board zeigt laut Bildunterschrift den Fokus am ersten Bedienelement (grüner Rahmen um „Hofdaten“), App-Bild zeigt keinen Fokusrahmen · .nachtlauf/screens/abnahme/einstellungen/1-1440-hell.png
- 1440 hell/dunkel · Bild 2 · Punkt 5 · Fokus nicht sichtbar: Board zeigt Fokusrahmen am Knopf „Neu laden“, App-Bild zeigt keinen Fokus · .nachtlauf/screens/abnahme/einstellungen/2-1440-hell.png
- 1440 hell/dunkel · Bild 2 · Punkt 1/2/6 · Fehlerzustand anders: Board neutrale Karte, Text „Deine Angaben sind nicht verloren. Versuch es noch einmal.“, darunter Knopf volle Breite „Neu laden“; App orange getönter Streifen mit Warnsymbol, Text „Es ist nichts verloren gegangen. Versuch es bitte gleich noch einmal.“, kleine Pille „Noch einmal versuchen“ rechts in derselben Zeile · .nachtlauf/screens/abnahme/einstellungen/2-1440-hell.png
- 1440 hell/dunkel · Bild 1 + 2 · Punkt 1 · Seitenspalte: App zeigt vor jedem Eintrag ein Symbol, Board zeigt keine Symbole; unten im Board „Konto“ und „Abmelden“ sichtbar, in der App „Konto · Franz Müller“ angeschnitten und „Abmelden“ nicht im Bild · .nachtlauf/screens/abnahme/einstellungen/1-1440-hell.png
- 1440 hell/dunkel · Bild 1 · Punkt 2 · Feste Satzteile anders: Gründungshof-Karte Board „noch 11 Monate (bis <Datum>)“, App „ohne Grundgebühr bis <Datum>“; Konditionen Board „Gründungshof bis <Datum> · ohne Grundgebühr“, App „Gründungshof · ohne Grundgebühr bis <Datum>“ · .nachtlauf/screens/abnahme/einstellungen/1-1440-hell.png
- alle Fassungen · Bild 1 · Punkt 2 · Unterzeilen anders: Abholzeiten Board „Mi 15–18 Uhr · Sa 9–12 Uhr“, App ohne „Uhr“ („Mi 15–18 · Sa 9–12“); Teilen-Hinweise Board „Was beim Teilen deiner Hofseite erscheint“, App „An · wir fragen einmal, ob du teilen willst“; Futtermittel Board „Futtermittel-Nummer (LFBIS) <Nr>“, App „Eigene Ernte (Primärproduktion) · LFBIS <Nr>“ · .nachtlauf/screens/abnahme/einstellungen/1-390-hell.png
- 1440 hell/dunkel · Bild 1 + 2 · Punkt 1 · Inhalt beginnt deutlich weiter rechts und höher (h1 bei ca. x 385 statt x 301); Karten mit deutlich größerem Eckenradius als im Board · .nachtlauf/screens/abnahme/einstellungen/1-1440-hell.png
- 390 hell/dunkel · Bild 1 · Punkt 1 · Karten mit deutlich größerem Eckenradius als im Board · .nachtlauf/screens/abnahme/einstellungen/1-390-hell.png

Begründete Ausnahmen gesehen:
- keine

Nicht prüfbar:
- keine

### hofdaten-zahlung

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 5 | 0 |
| 390 dunkel | 2 | 5 | 0 |
| 1440 hell | 2 | 5 | 0 |
| 1440 dunkel | 2 | 5 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- alle · Bild 3 · Punkt 6 · Zustand „Hofdaten gespeichert“ ganz anders: Board bleibt auf Hofdaten und zeigt eine dunkle Meldeleiste „Hofdaten gespeichert“ unten (Handy über der Speicherleiste, Web unter dem Formular); App springt auf die Einstellungen-Übersicht, grüner Hinweis oben, der im Web die h1 „Einstellungen“ verdeckt · .nachtlauf/screens/abnahme/hofdaten-zahlung/3-1440-hell.png
- 1440 hell/dunkel · Bild 1–3 · Punkt 1 · Board: zwei Spalten (links Karte Hof-Informationen + Adresse, rechts Karte Kontakt + Betriebsnummer, darunter „Hofdaten speichern“); App: eine mittige Spalte, Adresse als eigene Karte, rechte Spalte fehlt · .nachtlauf/screens/abnahme/hofdaten-zahlung/1-1440-hell.png
- alle · Bild 1/3 · Punkt 1 · Abschnitte „Kontakt“ (Telefon) und „Betriebsnummer“ (Was für ein Betrieb bist du?, Betriebsnummer, LFBIS-Hinweis, Link „Mein Hof › Hofseite“) in keinem App-Bild der Hofdaten zu sehen; die Übersicht führt „Futtermittel-Registrierung“ als eigene Seite · .nachtlauf/screens/abnahme/hofdaten-zahlung/3-390-hell.png
- 390 hell/dunkel · Bild 1–5 · Punkt 1 · Kopf: Board zeigt Zurück-Pfeil + h1 „Hofdaten“/„Zahlung“ + Zeile „Hof Müller · Stand …“ in einer Kopfleiste; App zeigt Leiste „← Einstellungen“ und h1 darunter im Inhalt, ohne Hofzeile · .nachtlauf/screens/abnahme/hofdaten-zahlung/1-390-hell.png
- 1440 hell/dunkel · Bild 1, 2, 4, 5 · Punkt 1 · Unterzeile „Hof Müller“/„Hof am Moos“ unter der h1 fehlt; Inhalt im Board links an der Seitenspalte (x≈300), in der App mittig (x≈540) · .nachtlauf/screens/abnahme/hofdaten-zahlung/4-1440-hell.png
- 390 hell/dunkel · Bild 1–3 · Punkt 1 · Feste Leiste „Hofdaten speichern“ über der Tab-Leiste fehlt in der App · .nachtlauf/screens/abnahme/hofdaten-zahlung/1-390-hell.png
- 390 hell/dunkel · Bild 1–5 · Punkt 1 · Tab-Leiste: Board „Neu“ als flacher Knopf in der Leiste mit fetter Beschriftung, „Mehr“ farbig hinterlegt, „Bestellungen“ ganz; App runder schwebender Plus-Knopf, „Mehr“ nur fett, „Bestellung…“ abgeschnitten · .nachtlauf/screens/abnahme/hofdaten-zahlung/1-390-hell.png
- alle · Bild 1–3 · Punkt 1/2 · Formular: Board Abschnittsköpfe in Versalien („HOF-INFORMATIONEN“, „ADRESSE“) ohne Kartenrahmen (Handy), Feldbeschriftungen fett, Felder mit kleinem Radius; App Karten mit „Hof-Informationen“/„Adresse“ in normaler Schreibung, Beschriftungen dünn, Felder als Pillen · .nachtlauf/screens/abnahme/hofdaten-zahlung/1-1440-hell.png
- alle · Bild 1 · Punkt 1 · „Auf der Karte suchen“: Board volle Breite, umrandet, fett; App kleiner Pillenknopf; App zeigt zusätzlich eine Karte mit Zoom-Knöpfen, die das Board nicht zeigt · .nachtlauf/screens/abnahme/hofdaten-zahlung/2-390-hell.png
- 390 hell/dunkel · Bild 2 · Punkt 6 · Sammelhinweis „Bitte prüfe das markierte Feld.“ über dem Formular fehlt · .nachtlauf/screens/abnahme/hofdaten-zahlung/2-390-hell.png
- alle · Bild 2 · Punkt 2 · Feldfehler: Board „Die Postleitzahl hat in Österreich 4 Ziffern.“ (fett); App „Bitte gib die Postleitzahl an – sie gehört zur Abholadresse.“ (klein, dünn) – falsche Meldung für eine zu kurze Postleitzahl · .nachtlauf/screens/abnahme/hofdaten-zahlung/2-1440-hell.png
- alle · Bild 1–5 (Web) / Bild 2 · Punkt 5 · Board zeigt Fokusring (Bild 1/3 im Feld Hof-Name, Bild 2 grüner Ring um das Postleitzahl-Feld, Bild 4 um „Auszahlungen bei Stripe ansehen“, Bild 5 um „Frage zur Freischaltung stellen“); App zeigt keinen Fokus, im Fehlerfeld nur roten Rand · .nachtlauf/screens/abnahme/hofdaten-zahlung/2-1440-hell.png
- 1440 dunkel · Bild 1–5 · Punkt 4 · Aktiver Eintrag „Einstellungen“ in der Seitenspalte ist ein heller Fleck (helle Pille); Board dunkelgrün gedämpft. Im Hellen ist er schwarz statt hellgrün · .nachtlauf/screens/abnahme/hofdaten-zahlung/1-1440-dunkel.png
- 1440 hell/dunkel · Bild 1–5 · Punkt 1 · Seitenspalte: App mit Symbolen vor jedem Eintrag, „Konto · Franz Müller“ statt „Konto“, „Abmelden“ unten nicht sichtbar · .nachtlauf/screens/abnahme/hofdaten-zahlung/1-1440-hell.png
- alle · Bild 5 · Punkt 6 · Zustand „Lastschrift fehlt“ nicht erreicht: Bar bei Abholung zeigt Marke „Aktiv“ statt „Braucht Lastschrift“; Satz „Barzahlung gibt es, sobald du die Lastschrift … einrichtet hast …“ und Knopf „Lastschrift einrichten“ fehlen · .nachtlauf/screens/abnahme/hofdaten-zahlung/5-1440-hell.png
- alle · Bild 5 · Punkt 1/2 · Freischalt-Hinweis: Board im Inhalt unter dem Kopf mit Titel „Richte deinen Hof fertig ein – Kundinnen sehen ihn noch nicht“; App über der ganzen Seite (Handy über der Leiste „Einstellungen“, Web volle Breite), Titel „Dein Hof wird noch geprüft – …“, zusätzlich Uhr-Symbol, Zeile „Deine Hof-ID: …“ und „– die Hof-ID ist in der Nachricht schon eingetragen.“ · .nachtlauf/screens/abnahme/hofdaten-zahlung/5-390-hell.png
- alle · Bild 5 · Punkt 2 · Stripe-Hinweis: Board „Die Einrichtung bei Stripe ist noch nicht ganz fertig.“ / „Bitte setz sie fort – erst mit Online-Zahlung können wir deinen Hof freischalten.“; App „Online-Zahlung einrichten“ / „Damit deine Kundinnen auch mit Karte, Apple Pay oder EPS zahlen können …“ · .nachtlauf/screens/abnahme/hofdaten-zahlung/5-1440-hell.png
- alle · Bild 5 · Punkt 1/2 · Stripe-Karte: Satz „Bei Stripe fehlen noch Angaben. Das dauert etwa 10 Minuten.“ fehlt; „Einrichtung fortsetzen“ im Board volle Breite, in der App kleiner Knopf mit Symbol plus zusätzlicher Knopf „Status prüfen“; im Handy verdeckt der Plus-Knopf den Kaufknopf · .nachtlauf/screens/abnahme/hofdaten-zahlung/5-390-hell.png
- alle · Bild 4/5 · Punkt 2 · Beschreibung „Kundinnen zahlen online mit Karte, Apple Pay, Google Pay oder EPS.“ lautet in der App „… mit Karte und weiteren Zahlungsarten.“ · .nachtlauf/screens/abnahme/hofdaten-zahlung/4-1440-hell.png
- alle · Bild 4 · Punkt 6 · Bar-Karte: Gründungshof-Satz „Bis 31. Jänner 2028 zahlst du als Gründungshof auf Barverkäufe keine Plattformgebühr; die Lastschrift brauchst du erst danach.“ fehlt · .nachtlauf/screens/abnahme/hofdaten-zahlung/4-390-hell.png
- alle · Bild 4 · Punkt 6 · Stripe verbunden: Satz „Dein Stripe-Konto ist verbunden. Auszahlungen kommen auf dein Konto, das auf 7788 endet.“ und Link „Auszahlungen bei Stripe ansehen“ fehlen, dafür „Online-Zahlung läuft noch im Testbetrieb.“ und „Status prüfen“ (laut Manifest Folge des Prüfaufbaus ohne Stripe; nicht als App-Fehler gewichtet) · .nachtlauf/screens/abnahme/hofdaten-zahlung/4-1440-hell.png
- alle · Bild 4/5 · Punkt 1/3 · Kartentitel im Board in Serifenschrift und größer, in der App serifenlos klein; Marken im Handy unter dem Text statt oben rechts; Markenschrift 11,5 px (unter 12) · .nachtlauf/screens/abnahme/hofdaten-zahlung/4-390-hell.png
- 390 dunkel · Bild 2 · Punkt 4 · Zoom-Knöpfe „+“/„−“ der Karte weiß im Dunkeln (heller Fleck), Zoom-Knöpfe 30 px (unter 44); Quellenlink OpenStreetMap mit zu wenig Kontrast (axe) · .nachtlauf/screens/abnahme/hofdaten-zahlung/2-390-dunkel.png
- 390 hell / 1440 hell · Bild 3 · Punkt 4 · Grüne Schrift „Hofdaten gespeichert“ auf hellgrünem Grund zu wenig Kontrast (axe) · .nachtlauf/screens/abnahme/hofdaten-zahlung/3-1440-hell.png
- 1440 hell/dunkel · Bild 1–5 · Punkt 1 · Gründungshof-Kasten: Board „noch 11 Monate (bis …)“, App „ohne Grundgebühr bis …“ bzw. „Startphase: kostenlos“ · .nachtlauf/screens/abnahme/hofdaten-zahlung/1-1440-hell.png

Begründete Ausnahmen gesehen:
- Register vor Board: Pflichtkarten untereinander (Bild 5: Freischalt-Hinweis und Stripe-Hinweis als eigene Kästen) – die Anordnung als zwei Kästen ist gedeckt, Wortlaut und Lage des Freischalt-Hinweises nicht.
- Hinweis aus dem Auftrag: Kartenkacheln laden im Prüf-Container nicht (graue Fläche in Bild 2) – nicht als Abweichung gewertet; die Karte selbst ist ein Zusatz gegenüber dem Board.

Nicht prüfbar:
- keine (alle 20 App-Bilder erreichbar)

### konto-hof

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 6 | 0 |
| 390 dunkel | 2 | 6 | 0 |
| 1440 hell | 2 | 6 | 0 |
| 1440 dunkel | 2 | 6 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell/dunkel · Bild 6 · Punkt 6 · Fehler beim Umschalten: Board zeigt einen Hinweis-Kasten in der Karte „Teilen-Hinweise zeigen“ mit „Wir konnten die Einstellung nicht speichern. Die Teilen-Hinweise sind weiter an.“ und Knopf „Nochmal“; App zeigt nur eine schwebende Meldung oben („… Bitte versuch es noch einmal.“), ohne „Nochmal“, die Meldung verdeckt Kopf und h1 · .nachtlauf/screens/abnahme/konto-hof/6-390-hell.png
- 1440 hell/dunkel · Bild 6 · Punkt 6 · wie oben: schwebende Meldung über der h1 statt Kasten in der Karte, kein „Nochmal“, anderer zweiter Satz; Meldung wirkt in kräftigem Rot statt im Hinweis-Ton des Boards · .nachtlauf/screens/abnahme/konto-hof/6-1440-hell.png
- 390/1440 alle · Bild 3 · Punkt 6 · Passwort falsch: Board zeigt den Fehler direkt unter „Aktuelles Passwort“ (Feld rot umrandet, Eingaben bleiben stehen), darunter Link „Passwort vergessen?“ und grün abgehakte Regeln; App leert alle Felder, zeigt den Fehler als Kasten über dem Knopf, kein roter Feldrand, kein Link „Passwort vergessen?“, Regeln grau ohne Haken · .nachtlauf/screens/abnahme/konto-hof/3-390-hell.png
- 390 hell/dunkel · alle Bilder · Punkt 1 · Kopf: Board hat eine Kopfleiste mit Zurück-Pfeil, Titel „Konto und Sicherheit“/„Teilen-Hinweise“ und Unterzeile „Hof Müller · Stand …“; App zeigt Leiste „← Einstellungen“ und die h1 erst darunter im Inhalt, ohne Hof-Unterzeile · .nachtlauf/screens/abnahme/konto-hof/1-390-hell.png
- 390 hell/dunkel · alle Bilder · Punkt 1 · Feste Leiste unten: Board hat „Neu“ als orange Kachel in der Leiste und „Mehr“ als aktive Pille in Akzentfarbe; App hat einen runden, über die Leiste ragenden „+“-Knopf (verdeckt Inhalt, z. B. „Dunkel“ in Bild 2), „Mehr“ nur fett, „Bestellungen“ abgeschnitten zu „Bestellung…“ · .nachtlauf/screens/abnahme/konto-hof/2-390-hell.png
- alle Fassungen · Bild 1 · Punkt 1 · Zusätzliche Karte „Anmelden mit Fingerabdruck oder Gesicht“ mit orangem Knopf „Auf diesem Handy/Gerät einrichten“ ganz oben; im Board nicht vorhanden · .nachtlauf/screens/abnahme/konto-hof/1-1440-hell.png
- alle Fassungen · Bild 1/3 · Punkt 1/2 · Passwort-Karte: zusätzliche Unterzeile „Passwort für dein Agrilo-Konto“, Augen-Knöpfe in den Feldern, Platzhalter „Mindestens 8 Zeichen“, Regel-Liste schon im Leerzustand; Knopf „Passwort ändern“ im Board breit mit Umriss, in der App orange gefüllt, blass (gesperrt), im Web nur schmal links · .nachtlauf/screens/abnahme/konto-hof/1-1440-hell.png
- 1440 hell/dunkel · alle Bilder · Punkt 1 · Inhaltsspalte steht in der App mittig (ab ca. 540 px), im Board linksbündig direkt neben der Seitenspalte (ab ca. 300 px); Unterzeile „Hof Müller“ unter der h1 fehlt · .nachtlauf/screens/abnahme/konto-hof/5-1440-hell.png
- 1440 hell/dunkel · alle Bilder · Punkt 5 · Board zeigt sichtbaren Fokus am ersten Bedienelement (Support-Link, „Abmelden“, Feld „Aktuelles Passwort“, Chip „Hell“/„Dunkel“, Schalter, „Nochmal“); in der App ist nirgends ein Fokusring zu sehen · .nachtlauf/screens/abnahme/konto-hof/2-1440-hell.png
- 1440 dunkel · alle Bilder · Punkt 4 · Aktiver Eintrag „Einstellungen“ in der Seitenspalte ist eine helle cremefarbene Pille (heller Fleck im Dunkeln); Board zeigt eine gedämpfte dunkelgrüne Fläche mit grüner Schrift · .nachtlauf/screens/abnahme/konto-hof/1-1440-dunkel.png
- 1440 hell · alle Bilder · Punkt 4 · Aktiver Eintrag „Einstellungen“ ist schwarz gefüllt mit weißer Schrift; Board zeigt hellgrüne Fläche mit grüner Schrift · .nachtlauf/screens/abnahme/konto-hof/1-1440-hell.png
- alle Fassungen · Bild 2 · Punkt 1 · Geräte: Board hat Überschrift „ANGEMELDETE GERÄTE“ als Abschnittszeile über der Karte und „Alle anderen abmelden“ als breiten Umriss-Knopf außerhalb der Karte; App hat Kartentitel mit Symbol und Zähler „2“, Geräte-Symbole, den Knopf orange getönt mit Symbol innerhalb der Karte · .nachtlauf/screens/abnahme/konto-hof/2-1440-hell.png
- alle Fassungen · Bild 2 · Punkt 2 · Geräte-Hinweis: App hängt „Danach melden wir dich zur Sicherheit ab – bei einem neuen Gerät bekommst du eine E-Mail.“ an; Zeile „dieses Gerät · angemeldet seit …“ statt „zuletzt heute“ · .nachtlauf/screens/abnahme/konto-hof/2-390-hell.png
- alle Fassungen · Bild 2/4 · Punkt 1/2 · Darstellung: Board „Gilt für dieses Gerät.“ mit drei einzelnen Chips „Hell/Dunkel/System“; App „Hell, dunkel — oder so, wie dein Gerät es eingestellt hat.“, Segment-Leiste mit Symbolen und zusätzlicher Absatz „Die Einstellung gilt nur auf diesem Gerät und in diesem Browser …“ · .nachtlauf/screens/abnahme/konto-hof/2-1440-hell.png
- 1440 hell/dunkel · Bild 2 · Punkt 1 · Bild zeigt „Hof stilllegen“ und „Konto löschen“ nicht (Ausschnitt endet bei Darstellung), Board zeigt beide; stattdessen oben noch Passwort-Karte · .nachtlauf/screens/abnahme/konto-hof/2-1440-hell.png
- alle Fassungen · Bild 4 · Punkt 1/2 · Offene Bestellungen: Board zeigt fetten Titel „Du hast noch 6 offene Bestellungen.“ in Warnfarbe und breiten Knopf „Zu den Bestellungen“ statt des Stilllegen-Knopfs; App zeigt schlichten Fließtext, „Zu den Bestellungen“ nur als Textlink, und der Knopf „Hof stilllegen“ steht zusätzlich darunter · .nachtlauf/screens/abnahme/konto-hof/4-1440-hell.png
- alle Fassungen · Bild 4 · Punkt 2 · „Hof stilllegen“-Text: App teilt in drei Absätze und ergänzt „— Bestellungen, Produkte, Kundinnen und Auswertungen. Du kannst dich weiterhin anmelden und alles einsehen“; Symbol vor dem Titel zusätzlich · .nachtlauf/screens/abnahme/konto-hof/4-390-hell.png
- alle Fassungen · Bild 4 · Punkt 1/2 · „Konto löschen“: Board-Text „Schreib dem Agrilo-Support – die Nachricht ist bereits vorausgefüllt. Bestelldaten müssen wir aus steuerrechtlichen Gründen 7 Jahre aufbewahren. Nur den Hof schließen? …“ plus Knopf „Support schreiben“; App: „Wenn du dein Konto löschen möchtest, schreib dem Agrilo-Support — … Die Löschung wird innerhalb weniger Werktage bearbeitet. Beachte: …“, nur Textlink, kein Knopf, Papierkorb-Symbol, Text dunkel statt Warnfarbe · .nachtlauf/screens/abnahme/konto-hof/4-1440-hell.png
- alle Fassungen · Bild 5/6 · Punkt 2 · Aufzählung: Board „das sofort auf deiner Hofseite steht“, App „das sofort im Shop steht“ · .nachtlauf/screens/abnahme/konto-hof/5-390-hell.png
- alle Fassungen · Bild 5/6 · Punkt 1 · „Wann wir fragen“ im Board als Serifen-Überschrift in Kartentitel-Größe mit normal großer Aufzählung; App kleine fette Grotesk-Zeile und kleinere Aufzählung; zusätzliches Teilen-Symbol vor „Teilen-Hinweise zeigen“ · .nachtlauf/screens/abnahme/konto-hof/5-1440-hell.png
- 390 hell/dunkel · Bild 1 · Punkt 1 · Anmelde-Adresse steht im Board fett in eigener Zeile unter „Deine Anmelde-Adresse:“, in der App in derselben Zeile; Kartentitel mit zusätzlichen Symbolen (Brief, Schild) · .nachtlauf/screens/abnahme/konto-hof/1-390-hell.png
- 1440 hell/dunkel · alle Bilder · Punkt 1/2 · Seitenspalte: zusätzliche Symbole vor allen Einträgen; Gründungshof-Karte „ohne Grundgebühr bis …“ statt „noch 11 Monate (bis …)“; unten „Konto · Franz Müller“ statt „Konto“ · .nachtlauf/screens/abnahme/konto-hof/1-1440-hell.png

Begründete Ausnahmen gesehen:
- keine

Nicht prüfbar:
- keine

### kunden

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 6 | 0 |
| 390 dunkel | 2 | 6 | 0 |
| 1440 hell | 2 | 6 | 0 |
| 1440 dunkel | 2 | 6 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell/dunkel · Bild 1, 4, 5, 6 · Punkt 1 · Kopf fehlt: Board zeigt eine Kopfleiste mit Zurück-Pfeil, „Kunden“ und darunter „Hof Müller · Stand Mittwoch, 3. März 2027“. In der App steht nur die große Überschrift „Kunden“ mit „2 Personen · 2 Stammkunden“ darunter, ohne Zurück-Pfeil und ohne die Zeile „Hof · Stand …“ · .nachtlauf/screens/abnahme/kunden/1-390-hell.png
- 390 hell/dunkel · Bild 1, 4, 5, 6 · Punkt 1 · Untere Leiste anders: Im Board sitzt „Neu“ als oranges Rechteck in der Leiste, und „Mehr“ ist aktiv mit Pille und oranger Schrift. In der App schwebt ein runder Knopf über der Leiste, „Mehr“ ist nur fett, „Bestellungen“ ist abgeschnitten („Bestellung…“), und rechts bleibt ein etwa 15 px breiter Streifen frei · .nachtlauf/screens/abnahme/kunden/1-390-hell.png
- alle · Bild 1, 4 · Punkt 1 · Werkzeugzeile anders: Im Board steht „Sortieren“ in der Chip-Zeile (Handy) bzw. neben dem Suchfeld in derselben Zeile (Web). In der App steht „Sortieren“ mit Pfeil-Symbol in einer zusätzlichen Zeile unter der Suche, zusammen mit einer zusätzlichen Zählung „2 Kunden“ bzw. „0 Kunden“, die das Board nicht hat · .nachtlauf/screens/abnahme/kunden/1-1440-hell.png
- alle · Bild 1, 4 · Punkt 2 · Suchfeld: Im Board steht „Name, Telefon oder E-Mail“ ohne Lupe, im Web 360 px breit neben den Chips. In der App steht „Kundin suchen“ mit Lupe, im Web rechtsbündig, schmal und niedrig (36 px) · .nachtlauf/screens/abnahme/kunden/1-1440-hell.png
- 1440 hell/dunkel · Bild 1, 3, 4, 5, 6 · Punkt 1 · Unter der h1 fehlt die Unterzeile mit dem Hofnamen („Hof Müller“ bzw. „Hof am Moos“). In der App steht dort die Zählung bzw. „Alle, die bisher bei dir bestellt haben“; die Zählzeile „7 Personen · 3 Stammkunden“ steht im Board getrennt darunter · .nachtlauf/screens/abnahme/kunden/1-1440-hell.png
- 390 hell/dunkel · Bild 1 · Punkt 1 · Listenzeile anders: Im Board stehen Name und Marke in einer Zeile, darunter zwei Zeilen („9 Bestellungen · heute bestellt“, „Häufig: …“), keine Betragsanzeige, und der Anruf-Knopf ist ein runder Knopf mit Rahmen. Die App zeigt zusätzlich einen Betrag („€ 24,80“), setzt die Marke in die dritte Zeile neben ein abgeschnittenes „Häufig: …“ und zeigt den Anruf nur als Symbol ohne Rahmen · .nachtlauf/screens/abnahme/kunden/1-390-hell.png
- 1440 hell/dunkel · Bild 1 · Punkt 1/2 · Tabelle: Die Spaltenköpfe stehen im Board in normaler Schreibung („Name“, „Status“, „Häufig bestellt“), in der App in Großbuchstaben („NAME“, „HÄUFIG BESTELLT“). Den Anruf-Knopf zeigt das Board als 44-px-Kreis mit Rahmen, die App nur als Symbol · .nachtlauf/screens/abnahme/kunden/1-1440-hell.png
- 1440 hell/dunkel · alle Bilder · Punkt 1 · Seitenspalte anders: Im Board hat die Navigation keine Symbole, und „Kunden“ ist aktiv mit hellgrüner Pille und grüner Schrift. In der App hat die Navigation Symbole, und „Kunden“ ist eine voll gefüllte Pille (im Hellen schwarz, im Dunkeln cremeweiß). Der Gründungshof-Text heißt im Board „noch 11 Monate (bis …)“, in der App „ohne Grundgebühr bis …“, und „Konto“ heißt in der App „Konto · Franz Müller“ · .nachtlauf/screens/abnahme/kunden/1-1440-dunkel.png
- 1440 dunkel · alle Bilder · Punkt 4 · Heller Fleck: Die aktive Navigationspille „Kunden“ ist im Dunkeln cremeweiß gefüllt. Das Board zeigt dort eine gedämpfte dunkelgrüne Pille · .nachtlauf/screens/abnahme/kunden/1-1440-dunkel.png
- 1440 hell/dunkel · Bild 1, 2, 3, 4, 5, 6 · Punkt 5 · Kein Fokus beim Laden zu sehen. Das Board zeigt einen Fokusring am ersten Bedienelement („Alle · 7“, „Abbrechen“ im Dialog, „Anrufen“, „Frage zur Freischaltung stellen“, „Noch einmal versuchen“), die App zeigt keinen; im Dialog liegt er auf „Anzahl Bestellungen“ statt auf „Abbrechen“ · .nachtlauf/screens/abnahme/kunden/2-1440-hell.png
- alle · Bild 2 · Punkt 1 · Sortieren: Im Board steht „Abbrechen“ oben rechts im Kopf des Blatts bzw. Dialogs. In der App steht „Abbrechen“ unten (Handy: unter „Übernehmen“, abgeschnitten; Web: links neben „Übernehmen“) · .nachtlauf/screens/abnahme/kunden/2-390-hell.png
- alle · Bild 2 · Punkt 4 · Farbwirkung im Sortieren: Im Board sind gewählte Optionen ton-/orangefarben gerahmt und hinterlegt, und „Übernehmen“ ist orange. In der App sind gewählte Optionen grün und „Übernehmen“ ist grün. Im Web ist der Hintergrund weichgezeichnet statt nur abgedunkelt · .nachtlauf/screens/abnahme/kunden/2-1440-hell.png
- 1440 hell/dunkel · Bild 2 · Punkt 1 · Im Dialog stehen die Optionen unter „Sortieren nach“ im Board zweispaltig, in der App einspaltig · .nachtlauf/screens/abnahme/kunden/2-1440-hell.png
- 390 hell/dunkel · Bild 2 · Punkt 1/3 · „Reihenfolge“ steht im Board nebeneinander, in der App untereinander. Die Optionen sind in der App deutlich niedriger (etwa 46 statt 64 px) und in normaler statt fetter Schrift. Die Abschnittstitel stehen im Board in Großbuchstaben („SORTIEREN NACH“), in der App nicht („Sortieren nach“) · .nachtlauf/screens/abnahme/kunden/2-390-hell.png
- alle · Bild 2 · Punkt 2 · „Zeigen“-Optionen: Das Board zeigt „Neu · n“, „Lange nicht gesehen · n“, „Diesen Monat aktiv · n“ in dieser Reihenfolge. Die App zeigt „Diesen Monat · n“, „Lange weg · n“, „Neu · n“ · .nachtlauf/screens/abnahme/kunden/2-1440-hell.png
- 1440 hell/dunkel · Bild 3 · Punkt 1 · Die Karte „Neuigkeiten von dir“ (E-Mail-Neuigkeiten an/aus, WhatsApp-Neuigkeiten an/aus) fehlt in der App ganz · .nachtlauf/screens/abnahme/kunden/3-1440-hell.png
- alle · Bild 3 · Punkt 1/2 · Kontakt: Im Board gibt es die Überschrift „Kontakt“ (Serifenschrift) mit den Zeilen „Telefon“ und „E-Mail“, Wert rechtsbündig. In der App steht „KONTAKT“ als kleine Großbuchstaben-Zeile, die Werte stehen mit Symbol und ohne Beschriftung da. Bei „Lieblingsprodukte“ zeigt das Board die Überschrift in Serifenschrift und Mengen („38 L“, „9×“), die App eine nummerierte Liste mit „10× bestellt“ · .nachtlauf/screens/abnahme/kunden/3-1440-hell.png
- alle · Bild 3 · Punkt 1 · Kopf der Kundin: Das Board zeigt Avatar, Name und Marke frei auf der Seite, die Marke in der Zeile des Namens. In der App steckt dies in einer gerahmten Karte, und die Marke steht unter dem Namen. Auf dem Handy heißt der Kopf im Board „Kundin“ mit der Unterzeile „Kunden“, in der App nur „← Kunden“. Im Web ist der Zurück-Link im Board grün und unterstrichen („‹ Kunden“), in der App grau · .nachtlauf/screens/abnahme/kunden/3-390-hell.png
- alle · Bild 3 · Punkt 1 · Kennzahl-Kacheln: Im Board steht die Beschriftung oben links und der Wert darunter, linksbündig. In der App steht der Wert oben mittig und die Beschriftung darunter · .nachtlauf/screens/abnahme/kunden/3-1440-hell.png
- alle · Bild 3 · Punkt 1 · Bestellzeilen: Im Board sind Abholtag und Zeit die Titelzeile („Mi 3. März, 15–18 Uhr“), darunter Nummer und Waren. In der App ist die Bestellnummer die Titelzeile („TD-0006“), darunter „vor 2 Tagen · …“. Der Hinweis „… weitere Bestellungen findest du unter Bestellungen bei ‚Noch offen‘ und ‚Erledigt‘“ fehlt; die App zeigt 4 statt höchstens 3 Zeilen · .nachtlauf/screens/abnahme/kunden/3-1440-hell.png
- 390 hell/dunkel · Bild 3 · Punkt 1 · Die Aktionsknöpfe passen im Board in eine Zeile, in der App rutscht „E-Mail“ in eine zweite Zeile · .nachtlauf/screens/abnahme/kunden/3-390-hell.png
- alle · Bild 4, 5 · Punkt 1 · Leerer Zustand: Das Board zeigt einen gestrichelten Kasten mit linksbündiger, fetter, serifenloser Überschrift und einem Knopf über die volle Breite mit dunklem Rahmen. In der App ist alles zentriert, darüber steht ein Symbol im Kreis, die Überschrift ist in Serifenschrift, der Knopf ist klein mit schwachem Rahmen, und der Strich des Kastens ist kaum sichtbar · .nachtlauf/screens/abnahme/kunden/4-1440-hell.png
- alle · Bild 5 · Punkt 1/2 · Hinweis „nicht freigegeben“: Im Board steht er unter dem Seitenkopf, in der App über der h1. Der Titel heißt im Board „Richte deinen Hof fertig ein – Kundinnen sehen ihn noch nicht“, in der App „Dein Hof wird noch geprüft – Kundinnen sehen ihn noch nicht“. Zusätzlich stehen in der App „Deine Hof-ID: …“ und „– die Hof-ID ist in der Nachricht schon eingetragen.“ sowie ein Uhr-Symbol. Falls das der N39-Wortlaut ist, ist es begründet · .nachtlauf/screens/abnahme/kunden/5-390-hell.png
- alle · Bild 6 · Punkt 1/4 · Fehler-Zustand: Das Board zeigt eine neutrale, gerahmte Karte mit fettem Knopf „Noch einmal versuchen“ über die volle Breite. Die App zeigt eine ton-/orange hinterlegte Karte mit Warnsymbol und einem kleinen Knopf mit kaum sichtbarem Rahmen (Web: rechts in der Zeile; im Dunkeln fast unsichtbar) · .nachtlauf/screens/abnahme/kunden/6-390-dunkel.png

Begründete Ausnahmen gesehen:
- Register vor Board: Im Hofbereich heißt der Stand „Gepackt“ (Kundin, Bestellung TD-0004).
- Chips („Alle · n“, „Stammkunden · n“) und Textlinks („Hofseite ansehen“, „Frage zur Freischaltung stellen“) sind sichtbar kleiner als 44 px.

Nicht prüfbar:
- keine (alle Bilder erreichbar; Bild 3 zeigt Kundin Maria Huber statt Anna Berger, Bild 5 zeigt Weizberghof statt Hof am Moos, beides Beispieldaten)

### mein-hof

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 6 | 0 |
| 390 dunkel | 2 | 6 | 0 |
| 1440 hell | 2 | 6 | 0 |
| 1440 dunkel | 2 | 6 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 1440 hell+dunkel · Bild 1/2/6 · Punkt 1+3 · Kopf anders: Board hat große Überschrift „Mein Hof“, darunter Zeile „Öffentlich · Hof Müller · Adresse“, Teilen/Kundenansicht rechts oben frei; App zeigt eine Kopfkarte mit HM-Logo, „Hof Müller“, Marke und Link-Zeile mit Kopierknopf, keine sichtbare Überschrift „Mein Hof“ · .nachtlauf/screens/abnahme/mein-hof/1-1440-hell.png
- 1440 hell+dunkel · Bild 1/2/6 · Punkt 1 · Statuskarte „Nimmt Bestellungen an“ mit Knopf „Pausieren“ über der Liste fehlt im Web ganz; stattdessen Zeile „Bestellungen“ in neuer Gruppe „SICHTBARKEIT“ ganz unten · .nachtlauf/screens/abnahme/mein-hof/2-1440-hell.png
- 1440 hell+dunkel · Bild 3 · Punkt 6 · Zustand „Pausieren“ nicht zu sehen: Board zeigt Dialog „Hof pausieren“ mit Feld, Vorschau-Kasten, Hinweissatz, „Pausieren“ und Fokus auf „Abbrechen“; App-Bild ist identisch mit Bild 1 (kein Dialog, keine aufgeklappte Zeile im Bild) · .nachtlauf/screens/abnahme/mein-hof/3-1440-hell.png
- 1440 hell+dunkel · Bild 4 · Punkt 1+2 · Pausiert-Karte mit „Bestellen kann gerade niemand. „Wir sind im Urlaub …““ und Knopf „Fortsetzen“ fehlt; nur die Marke „Pausiert“ im Kopf zeigt den Stand · .nachtlauf/screens/abnahme/mein-hof/4-1440-hell.png
- 390 hell+dunkel · Bild 1/2/4 · Punkt 1 · Reihenfolge: Board hat Kopf + Reiter fest oben, Statuskarte unter den Reitern; App hat Statuskarte über den Reitern, Kopf und Reiter scrollen weg (Bild 2 ohne Kopf) · .nachtlauf/screens/abnahme/mein-hof/2-390-hell.png
- 390 hell+dunkel · Bild 1/2/4/5 · Punkt 1 · Postfach-Symbol mit Zahl rechts im Kopf fehlt (Board: Teilen, Auge, Postfach) · .nachtlauf/screens/abnahme/mein-hof/1-390-hell.png
- alle Fassungen · Bild 1/2 · Punkt 1+2 · Fortschritt anders: Board „Noch 1 Punkt offen“ als schlichte Zeile mit Balken; App zusätzliche Karte „Noch 3 Punkte offen · 8 von 11“ (Handy mit Liste Titelbild/Logo/Fotos, Web mit Satz „Es fehlen noch: …“) · .nachtlauf/screens/abnahme/mein-hof/1-390-hell.png
- alle Fassungen · Bild 1/2 · Punkt 1 · Zusätzliche Karte „Aktuell vom Hof · Kein Beitrag · Neuer Beitrag“ oben; im Board steht „AKTUELL VOM HOF“ als letzte Gruppe unten · .nachtlauf/screens/abnahme/mein-hof/1-1440-hell.png
- alle Fassungen · Bild 1/2 · Punkt 2 · Gruppen und Zeilen anders benannt: Board „Titelbild und Logo“, „Name und Leitspruch“, „Adresse und Karte“, „Abschnitte“, „Zahlung“; App „Titelbild“, „Logo“ getrennt, „Name und Kurzbeschreibung“, „Leitspruch und Gründungsjahr“, „Adresse und Standort“, „Abschnitte der Hofseite“, „Zahlungsarten“, zusätzlich „Werte“; Web-Gruppe „AUFTRITT“ statt „OBEN AUF DER SEITE“/„AUFBAU UND FOTOS“, Gruppe „ÜBER UNS“ fehlt im Web · .nachtlauf/screens/abnahme/mein-hof/2-1440-hell.png
- alle Fassungen · Bild 1/2 · Punkt 1 · Offene Punkte als Marke „Fehlt“/„Online fehlt“ statt Wort „offen“ in Akzentfarbe; Handy ohne grüne Häkchen bei erledigten Zeilen; Web mit zusätzlichem Symbol vor jeder Zeile · .nachtlauf/screens/abnahme/mein-hof/2-390-hell.png
- 1440 hell+dunkel · Bild 1/2/6 · Punkt 1 · Vorschau anders: Board schlichte Karte „VORSCHAU“ mit Segment Handy/Web (dunkel gefüllt) und Hofseiten-Inhalt (Logo, „Gründungshof“, Leitspruch, Route/Teilen/Bestellen, „Nächste Abholung“), fest stehend; App Handy-Rahmen mit Agrilo-Kopf, „Mein Hof“-Knopf, Bild-Hero, Anfahrt/Bestellen, scrollt mit; zusätzlich „Vergrößern“, „Neuer Tab“, Erklärsatz und Link „Produkte verwaltest du links unter „Produkte““ · .nachtlauf/screens/abnahme/mein-hof/2-1440-hell.png
- 1440 hell+dunkel · Bild 1–6 · Punkt 5 · Board zeigt Fokus am ersten Bedienelement (Rahmen um Reiter „Hofseite“/„Beiträge“); App zeigt keinen sichtbaren Fokus · .nachtlauf/screens/abnahme/mein-hof/5-1440-hell.png
- 1440 hell+dunkel · Bild 1–6 · Punkt 1 · Reiter als Unterstrich-Text statt breiter Segment-Reiter; Seitenspalte mit Symbolen und „Mein Hof“ als dunkle Pille (Board: hellgrün getönt, ohne Symbole); „Abmelden“ unten nicht sichtbar · .nachtlauf/screens/abnahme/mein-hof/1-1440-hell.png
- 1440 dunkel · Bild 1–6 · Punkt 4 · Aktiver Eintrag „Mein Hof“ in der Seitenspalte ist eine helle Creme-Pille – heller Fleck im Dunkeln (Board: dunkelgrün getönt) · .nachtlauf/screens/abnahme/mein-hof/1-1440-dunkel.png
- 390 hell+dunkel · Bild 3 · Punkt 1+2 · Pausier-Blatt anders: Board Titel „Hof pausieren“ mit „Abbrechen“ oben rechts, Feld „Nachricht an deine Kundschaft (freiwillig)“, Kasten „SO STEHT ES AUF DEINER HOFSEITE“, Satz „Offene Bestellungen bleiben bestehen. Neue Bestellungen sind erst nach „Fortsetzen“ möglich.“; App „Bestellungen pausieren?“ mit drei Aufzählungspunkten, „Nachricht an deine Kundinnen“, „Abbrechen“ unten als Textknopf, Vorschau „Derzeit keine Bestellungen möglich.“, Knopf mit Pause-Symbol · .nachtlauf/screens/abnahme/mein-hof/3-390-hell.png
- 390 hell+dunkel · Bild 4 · Punkt 2+4 · Pausiert-Karte ohne die Nachricht „Wir sind im Urlaub bis 15. März.“ (nur „Bestellen kann gerade niemand.“); „Fortsetzen“ grün gefüllt statt Rahmenknopf; Karte nur umrandet statt getönt · .nachtlauf/screens/abnahme/mein-hof/4-390-hell.png
- 390 hell+dunkel · Bild 1/3 · Punkt 1 · Statuskarte im Handy neutral mit Punkt statt grün getönt, Text „Nächste Abholung: Samstag …“; Knopf „Pausieren“ mit Symbol · .nachtlauf/screens/abnahme/mein-hof/1-390-hell.png
- alle Fassungen · Bild 5 · Punkt 6 · Board-Zustand mit Beiträgen (Einleitungskarte „Was du deinen Kunden erzählst …“ + großer Knopf „Neuer Beitrag“, Gruppen „LÄUFT · 1“, „FRÜHER · 2“) nicht gezeigt; App zeigt Leer-Zustand „Noch kein Beitrag“ / „Ersten Beitrag schreiben“ · .nachtlauf/screens/abnahme/mein-hof/5-390-hell.png
- 390 hell+dunkel · Bild 5 · Punkt 1 · Statuskarte „Nimmt Bestellungen an“ steht auch im Reiter Beiträge; Board zeigt sie dort nicht · .nachtlauf/screens/abnahme/mein-hof/5-390-hell.png
- 390 hell+dunkel · Bild 6 · Punkt 1+2 · Kundenansicht ganz anders: zusätzliche Agrilo-Kopfleiste mit „Mein Hof“, Bild-Hero mit Namen statt Titelbild + Logo „HM“, Marke „GRÜNDUNGSHOF“ und Leitspruch fehlen, Knöpfe „Anfahrt“/„Bestellen“ statt „Route“/„Teilen“/„Bestellen“, Karte „Nächste Abholung …“ fehlt, Hof-Kopf mit Zurück-Pfeil doppelt unter dem Hero, Kunden-Fußleiste Entdecken/Warenkorb/Bestellungen zusätzlich · .nachtlauf/screens/abnahme/mein-hof/6-390-hell.png
- 390 hell+dunkel · Bild 6 · Punkt 1 · Leiste „Kundenansicht“ orange getönt mit Augen-Symbol statt neutraler Kopfzeile · .nachtlauf/screens/abnahme/mein-hof/6-390-dunkel.png
- 390 dunkel · Bild 6 · Punkt 4 · Produktbilder auf hellen Creme-Kacheln – helle Flecken im Dunkeln (gleich in der Web-Vorschau dunkel) · .nachtlauf/screens/abnahme/mein-hof/6-390-dunkel.png
- 390 hell+dunkel · Bild 1–5 · Punkt 1+3 · Fußleiste: „Neu“ als runder schwebender Knopf statt eckiger Pille in der Leiste; „Bestellung…“ abgeschnitten statt „Bestellungen“; aktiver Eintrag „Mein Hof“ ohne getönte Pille · .nachtlauf/screens/abnahme/mein-hof/1-390-hell.png
- 390 hell+dunkel · Bild 1–6 · Punkt 1 · Rechts ein schmaler Streifen ohne Inhalt (Seite ca. 15 px schmaler als das Bild, Fußleiste endet vor dem Rand) · .nachtlauf/screens/abnahme/mein-hof/6-390-hell.png
- 1440 hell+dunkel · Bild 4 · Punkt 2 · Pause-Hinweis in der Vorschau ohne Satz „Du kannst dir das Angebot ansehen. Dein Warenkorb bleibt gespeichert.“ · .nachtlauf/screens/abnahme/mein-hof/4-1440-hell.png

Begründete Ausnahmen gesehen:
- keine

Nicht prüfbar:
- keine

### meldungen

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 6 | 0 |
| 390 dunkel | 2 | 6 | 0 |
| 1440 hell | 2 | 6 | 0 |
| 1440 dunkel | 2 | 6 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell/dunkel · Bild 1–6 · Punkt 1 · Kopf anders: Board zeigt Kopfleiste mit Zurück-Pfeil, großer Serifen-Überschrift und Unterzeile „Hof Müller · Stand …“; App zeigt bei Bild 1–3 nur eine kleine Leiste „← Problem melden“ ohne Unterzeile, bei Bild 4–6 eine große Überschrift „Meine Meldungen“ ohne Zurück-Pfeil und ohne Unterzeile · .nachtlauf/screens/abnahme/meldungen/1-390-hell.png
- 390 hell/dunkel · Bild 1 · Punkt 1 · Feste Leiste „Absenden“ über der Navigation fehlt; der Knopf liegt im Fluss und wird vom runden „+“-Knopf der Navigation verdeckt („Ab…en“ angeschnitten) · .nachtlauf/screens/abnahme/meldungen/1-390-hell.png
- 390 hell/dunkel · Bild 1–6 · Punkt 1 · Untere Navigation anders: Board „Neu“ als eckiger Knopf in der Leiste, „Bestellungen“ ausgeschrieben, „Mehr“ mit hinterlegtem Aktiv-Feld; App runder, überstehender „+“-Knopf, „Bestellung…“ abgeschnitten, „Mehr“ nur fett · .nachtlauf/screens/abnahme/meldungen/1-390-dunkel.png
- 390 + 1440 · Bild 2 · Punkt 1/6 · Feldfehler fehlt: Board zeigt am Textfeld roten Rahmen und darunter „Schreib bitte etwas mehr – mindestens 10 Zeichen, damit wir die Stelle finden.“; App zeigt stattdessen oben einen Kasten „Das hat nicht geklappt / Bitte beschreibe es mit mindestens 10 Zeichen.“, Textfeld ohne Fehlerrahmen · .nachtlauf/screens/abnahme/meldungen/2-390-hell.png
- 390 + 1440 · Bild 1–2 · Punkt 1 · Reihenfolge: Board „Bildschirmfoto hinzufügen“ vor „Fehlernummer“; App umgekehrt · .nachtlauf/screens/abnahme/meldungen/1-1440-hell.png
- 390 + 1440 · Bild 1–2 · Punkt 2 · Knopftext Board „+ Bildschirmfoto hinzufügen (optional)“ (durchgezogener Rahmen); App „Bildschirmfoto hinzufügen“ mit Kamera-Symbol, gestrichelt, ohne „(optional)“ · .nachtlauf/screens/abnahme/meldungen/1-390-hell.png
- 390 + 1440 · Bild 1–2 · Punkt 2 · Fehlernummer-Feld ohne Platzhalter „z. B. A7F3“; im Web fehlt zusätzlich der Hilfesatz „Manche Fehlermeldungen enden auf ein Kürzel in eckigen Klammern – das hilft uns, die Stelle zu finden.“ und das Feld ist schmal statt volle Breite · .nachtlauf/screens/abnahme/meldungen/1-1440-hell.png
- 1440 hell/dunkel · Bild 1–2 · Punkt 1 · Block „DAS SCHICKEN WIR AUTOMATISCH MIT“ mit Zeilen Seite / Gerät / Hof fehlt; App hat nur den Satz „Mitgeschickt: Seite, Gerät und dein Hof. Keine IP-Adresse, keine Cookies.“ (auch im Handy zusätzlich) · .nachtlauf/screens/abnahme/meldungen/1-1440-hell.png
- 1440 hell/dunkel · Bild 1–2 · Punkt 1 · Auswahl „Worum geht es?“: Board drei volle Zeilen untereinander; App drei Kacheln nebeneinander mit umbrechendem Text · .nachtlauf/screens/abnahme/meldungen/1-1440-dunkel.png
- 390 + 1440 · Bild 1–2 · Punkt 1 · Formular liegt in der App in einer zusätzlichen Karte; Board ohne Karte. Auswahlzeilen im Handy deutlich niedriger (ca. 46 px statt ca. 66 px) · .nachtlauf/screens/abnahme/meldungen/1-390-hell.png
- 1440 hell/dunkel · Bild 1–6 · Punkt 1/2 · Unterzeile „Hof Müller“ unter der Überschrift fehlt; bei Bild 4–6 fehlt der Zurück-Link „‹ Problem melden“ über der Überschrift · .nachtlauf/screens/abnahme/meldungen/4-1440-hell.png
- 1440 hell/dunkel · Bild 1–2 · Punkt 5 · Board zeigt grünen Fokusrahmen am ersten Bedienelement (Bild 1 Auswahl, Bild 2 Textfeld); App zeigt keinen erkennbaren Fokusrahmen · .nachtlauf/screens/abnahme/meldungen/2-1440-hell.png
- 390 + 1440 · Bild 4 · Punkt 1 · Liste anders: Board eine Gruppe mit Trennlinien, je Eintrag Art-Marke + Datum oben, Titel, Stand-Marke unten, Pfeil rechts; App einzelne Karten (Web einzeilig mit Datum/Stand rechts), keine Pfeile, zusätzlich „Nr. cmg5me00“ und aufgeklappte Antwort-Blöcke „Antwort: …“ · .nachtlauf/screens/abnahme/meldungen/4-1440-hell.png
- 390 hell/dunkel · Bild 4–6 · Punkt 1 · Zusätzlicher Knopf „+ Neue Meldung“ über dem Einleitungssatz; Board zeigt im Handy keinen solchen Knopf · .nachtlauf/screens/abnahme/meldungen/4-390-hell.png
- 1440 hell/dunkel · Bild 5 · Punkt 1 · Zusätzlicher Knopf „+ Neue Meldung“ im Kopf; Board zeigt im leeren Zustand keinen · .nachtlauf/screens/abnahme/meldungen/5-1440-hell.png
- 390 + 1440 · Bild 4 · Punkt 4 · Art-Marke „Wunsch“ in der App grün, im Board neutral grau · .nachtlauf/screens/abnahme/meldungen/4-390-hell.png
- 1440 hell/dunkel · Bild 4–6 · Punkt 5 · Fokus liegt in der App auf „Neue Meldung“; Board zeigt ihn auf dem ersten Listeneintrag (Bild 4), „Meldung schreiben“ (Bild 5) bzw. „Noch einmal versuchen“ (Bild 6) · .nachtlauf/screens/abnahme/meldungen/6-1440-hell.png
- 390 + 1440 · Bild 3 · Punkt 2 · Knopf Board „Meine Meldungen“, App „Zu deinen Meldungen“; zusätzlicher Satz „Deine Kurznummer: …“; Knöpfe nicht volle Breite (Web nebeneinander statt untereinander); zusätzlicher Einleitungssatz über der Danke-Karte · .nachtlauf/screens/abnahme/meldungen/3-1440-hell.png
- 390 + 1440 · Bild 5 · Punkt 1 · Leerzustand mittig mit Symbol und Serifen-Überschrift, kleiner Pillenknopf „Meldung schreiben“; Board linksbündig ohne Symbol, Knopf volle Breite mit kräftigem Rahmen · .nachtlauf/screens/abnahme/meldungen/5-390-hell.png
- 390 dunkel / 1440 dunkel · Bild 5–6 · Punkt 4 · Knöpfe „Meldung schreiben“ und „Noch einmal versuchen“ mit kaum sichtbarem Rahmen, geringe Abgrenzung vom Untergrund; Board mit hellem, deutlichem Rahmen · .nachtlauf/screens/abnahme/meldungen/5-390-dunkel.png
- 390 + 1440 · Bild 6 · Punkt 1/4 · Fehlerkasten in der App rot/orange getönt mit Warnsymbol, Knopf klein (Web rechts daneben); Board neutrale Karte, Knopf „Noch einmal versuchen“ volle Breite darunter; zusätzlicher Einleitungssatz über dem Fehler · .nachtlauf/screens/abnahme/meldungen/6-1440-hell.png
- 1440 dunkel · Bild 1–6 · Punkt 4 · Aktiver Seitenspalten-Eintrag „Problem melden“ als heller, fast weißer Balken – heller Fleck im Dunkeln; Board dunkelgrün getönt mit grüner Schrift · .nachtlauf/screens/abnahme/meldungen/1-1440-dunkel.png
- 1440 hell · Bild 1–6 · Punkt 4 · Aktiver Seitenspalten-Eintrag „Problem melden“ schwarz gefüllt mit weißer Schrift; Board hellgrün getönt mit grüner Schrift · .nachtlauf/screens/abnahme/meldungen/1-1440-hell.png
- 1440 hell/dunkel · Bild 1–6 · Punkt 1/2 · Seitenspalte: Symbole vor allen Einträgen (Board ohne); Gründungshof-Text „ohne Grundgebühr bis …“ statt „noch 11 Monate (bis …)“; unten „Konto · Name“ angeschnitten, „Abmelden“ nicht sichtbar · .nachtlauf/screens/abnahme/meldungen/3-1440-hell.png
- 1440 hell/dunkel · Bild 1–3 · Punkt 1 · Karte „Deine Meldungen“: Zeilen ohne Trennlinien, „Alle ansehen“ mittig mit Pfeil statt linksbündiger unterstrichener Textlink; „E-Mail schreiben“ mit Briefsymbol und schwächerem Rahmen · .nachtlauf/screens/abnahme/meldungen/1-1440-hell.png

Begründete Ausnahmen gesehen:
- keine (die Bilder zeigen keinen der als „Register vor Board“, „Recht vor Board“ oder „Board-Fehler“ aufgeführten Fälle; kleine Marken/Chips unter 44 px sind nach der Chip-Ausnahme nicht als Mangel gewertet)

Nicht prüfbar:
- keine (alle 24 App-Bilder erreichbar)

### postfach

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 6 | 0 |
| 390 dunkel | 2 | 6 | 0 |
| 1440 hell | 2 | 6 | 0 |
| 1440 dunkel | 2 | 6 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- alle Fassungen · Bild 6 · Punkt 6 · Fehlerzustand ohne Knopf „Neu laden“; die fette Überschrift „Wir konnten dein Postfach gerade nicht laden.“ und der Satz „Deine Nachrichten sind nicht verloren.“ fehlen; statt der neutralen Karte steht ein orange getönter Hinweisstreifen „Wir konnten dein Postfach gerade nicht laden. Lade die Seite bitte neu.“; im Web liegt der Fokus deshalb auf „Zum Inhalt springen“ (über dem Logo) statt auf „Neu laden“ · .nachtlauf/screens/abnahme/postfach/6-390-hell.png (ebenso 6-390-dunkel, 6-1440-hell, 6-1440-dunkel)
- 390 hell/dunkel · Bild 1, 5, 6 · Punkt 1 · Kopf anders: Im Board steht ein Zurück-Pfeil „‹“ vor „Postfach“ und darunter die Zeile „Hof Müller · Stand Mittwoch, 3. März 2027“, „1 neu“ steht rechts; in der App fehlen Pfeil und Unterzeile, „1 neu“ steht direkt neben der Überschrift · .nachtlauf/screens/abnahme/postfach/1-390-hell.png
- 390 hell/dunkel · Bild 2, 3, 4 · Punkt 1/2 · Kopf der Nachricht anders: Im Board steht „‹ Nachricht“ mit der Unterzeile „Postfach“; in der App nur ein Link „← Postfach“, die Überschrift „Nachricht“ fehlt · .nachtlauf/screens/abnahme/postfach/2-390-hell.png
- 390 hell/dunkel · alle Bilder · Punkt 1 · Untere Leiste anders: Im Board ist „Neu“ ein rechteckiger orangefarbener Knopf in der Leiste und „Mehr“ ist aktiv mit getönter Pille und oranger Schrift; in der App ist „Neu“ ein schwebender runder Knopf über der Leiste, „Mehr“ ohne Pille; „Bestellungen“ wird zu „Bestellung…“ abgeschnitten · .nachtlauf/screens/abnahme/postfach/1-390-hell.png
- 1440 hell/dunkel · alle Bilder · Punkt 1 · Inhaltsspalte steht mittig (ab ca. x 497), im Board linksbündig direkt neben der Seitenspalte (ab x 300) · .nachtlauf/screens/abnahme/postfach/1-1440-hell.png
- 1440 dunkel · alle Bilder · Punkt 4 · Der aktive Eintrag „Postfach“ in der Seitenspalte ist eine helle cremefarbene Pille, also ein heller Fleck im Dunkeln; das Board zeigt eine dunkelgrün getönte Fläche mit grüner Schrift · .nachtlauf/screens/abnahme/postfach/1-1440-dunkel.png
- 1440 hell · alle Bilder · Punkt 1/4 · Der aktive Eintrag „Postfach“ ist schwarz gefüllt mit weißer Schrift; das Board zeigt eine hellgrün getönte Fläche mit grüner Schrift · .nachtlauf/screens/abnahme/postfach/1-1440-hell.png
- 1440 hell/dunkel · Bild 1, 5, 6 · Punkt 1 · Die Unterzeile „Hof Müller“ unter der h1 fehlt; „1 neu“ steht neben dem Titel statt rechts am Spaltenrand · .nachtlauf/screens/abnahme/postfach/1-1440-hell.png
- alle Fassungen · Bild 1 · Punkt 2 · Filter heißt „Ungelesen“, im Board „Ungelesen · 1“ (die Zahl fehlt) · .nachtlauf/screens/abnahme/postfach/1-390-hell.png
- alle Fassungen · Bild 1 · Punkt 1 · Listenzeile anders aufgebaut: Im Board steht oben klein „Agrilo-Team · heute, 8:10“, darunter der fette Betreff (auf dem Handy zweizeilig) und rechts ein Pfeil „›“; in der App ist der Absender fett, das Datum steht rechts, der Betreff ist einzeilig abgeschnitten („…schon einget…“) und der Pfeil fehlt; statt grüner Quadrate runde Sprossen-Bilder · .nachtlauf/screens/abnahme/postfach/1-390-hell.png
- alle Fassungen · Bild 1 · Punkt 1 · Die Marke „Wichtig“ steht in der App vor dem Betreff, im Board in der Absenderzeile; „Du hast geantwortet · …“ ist in der App ein umrandeter Chip, im Board einfacher grauer Text · .nachtlauf/screens/abnahme/postfach/1-1440-hell.png
- alle Fassungen · Bild 1, 5 · Punkt 1/2 · Im Erklärsatz ist „Problem melden“ im Board ein unterstrichener grüner Link; in der App ist es grauer Text ohne Link · .nachtlauf/screens/abnahme/postfach/5-390-hell.png
- alle Fassungen · Bild 5 · Punkt 2/6 · Leerer Zustand anders: Im Board stehen „Alles gelesen“ linksbündig, der Satz „Neue Nachrichten vom Team erscheinen hier und als Karte auf Heute.“ und ein breiter Knopf „Alle Nachrichten zeigen“; in der App ist alles mittig mit einem Häkchen-Bild und Serifen-Überschrift, der Satz endet nach „erscheinen hier.“ und der kleine Knopf heißt „Alle zeigen“ · .nachtlauf/screens/abnahme/postfach/5-390-hell.png
- alle Fassungen · Bild 2, 3, 4 · Punkt 2 · Der Knopf in der Nachricht heißt „Ansehen“, im Board „Abholzeiten ansehen“ bzw. „Verkäufe ansehen“ · .nachtlauf/screens/abnahme/postfach/2-390-hell.png
- alle Fassungen · Bild 2, 3, 4 · Punkt 1 · In der Team-Blase gibt es zusätzlich die Kopfzeile „Agrilo-Team“ mit Sprossen-Bild und einen grünen Rand; die Uhrzeit steht unter der Blase statt in der Blase („8:10 · auch per E-Mail“) · .nachtlauf/screens/abnahme/postfach/2-1440-hell.png
- alle Fassungen · Bild 4 · Punkt 1/2 · Über der Nachricht steht zusätzlich die Datumszeile „Di, 20. Okt“ (das Board zeigt hier keine); „auch per E-Mail“ fehlt; der Hinweis „Auf diese Nachricht kannst du nicht antworten…“ ist eine umrandete Karte statt eines grau gefüllten Kastens, und der Link heißt „„Problem melden““ (in Anführungszeichen, nicht unterstrichen) statt „Problem melden“ (unterstrichen) · .nachtlauf/screens/abnahme/postfach/4-390-hell.png
- alle Fassungen · Bild 3 · Punkt 1/4 · Die eigene Antwort ist eine kräftig dunkelgrüne Blase mit weißer Schrift; im Board ist sie hellgrün getönt mit dunkler Schrift. „9:02 · gelesen“ fehlt (nur eine Uhrzeit unter der Blase); die Team-Antwort trägt die Zeile „… · Agrilo-Team“ außerhalb statt innerhalb der Blase · .nachtlauf/screens/abnahme/postfach/3-1440-hell.png
- 390 hell/dunkel · Bild 3 · Punkt 1 · Das Antwortfeld deckt die Team-Antwort „Super, danke dir – schöne Ostern!“ halb zu; im Board sind beide Blasen ganz über dem Antwortbereich zu sehen · .nachtlauf/screens/abnahme/postfach/3-390-hell.png
- 1440 hell/dunkel · Bild 2, 3, 4 · Punkt 1 · Zurück-Link „‹ Postfach“ ist im Board ein unterstrichener grüner Textlink; in der App ist es ein umrandeter Pillen-Knopf mit grauer Schrift; die h1 ist deutlich größer als im Board und bricht bei Bild 4 auf zwei Zeilen um · .nachtlauf/screens/abnahme/postfach/2-1440-hell.png
- alle Fassungen · Bild 2, 3 · Punkt 1 · Antwortbereich: zusätzliches Schloss-Bild vor „Deine Antwort geht nur an das Agrilo-Team.“; das Feld zeigt einen Griff zum Größerziehen · .nachtlauf/screens/abnahme/postfach/2-1440-hell.png
- 1440 hell/dunkel · alle Bilder · Punkt 1/2 · Seitenspalte: zusätzliche Bilder vor jedem Eintrag; Gründungshof-Karte mit „ohne Grundgebühr bis …“ statt „noch 11 Monate (bis …)“; unten „Konto · Franz Müller“ statt „Konto“, „Abmelden“ ist nicht zu sehen · .nachtlauf/screens/abnahme/postfach/1-1440-hell.png
- 1440 hell/dunkel · Bild 1, 5 · Punkt 5 · Der Fokusring um „Alle“ ist am linken Rand abgeschnitten · .nachtlauf/screens/abnahme/postfach/5-1440-hell.png

Begründete Ausnahmen gesehen:
- keine

Nicht prüfbar:
- keine

### problem-melden

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 3 | 6 | 0 |
| 390 dunkel | 3 | 6 | 0 |
| 1440 hell | 2 | 6 | 0 |
| 1440 dunkel | 2 | 6 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 1440 hell/dunkel · Bild 1–4, 6 · Punkt 1 · Die Auswahl „Worum geht es?“ steht im Board als drei volle Karten untereinander, in der App als drei Kacheln nebeneinander mit zweizeiligem Text („Etwas / funktioniert nicht“) · .nachtlauf/screens/abnahme/problem-melden/1-1440-hell.png
- 1440 hell/dunkel · Bild 1–6 · Punkt 1 · Formular- und Danke-Karte stehen im Board links im Inhaltsbereich (bündig mit dem Fuß), in der App mittig auf der Seite · .nachtlauf/screens/abnahme/problem-melden/5-1440-hell.png
- 1440 hell/dunkel · Bild 1–4, 6 · Punkt 5 · Das Board zeigt den Fokusrahmen am ersten Auswahlknopf („Etwas funktioniert nicht“), in der App ist auf diesen Bildern kein Fokus sichtbar (nur Bild 5 zeigt ihn an „Noch etwas melden“) · .nachtlauf/screens/abnahme/problem-melden/1-1440-dunkel.png
- alle Fassungen · Bild 3 · Punkt 1/6 · Bei „Ich hätte gern, dass …“ blendet das Board das Feld „Fehlernummer (optional)“ aus (nach dem Text folgt gleich „Deine E-Mail“), die App zeigt es weiter · .nachtlauf/screens/abnahme/problem-melden/3-390-hell.png
- alle Fassungen · Bild 6 · Punkt 2/6 · Board-Hinweis „Wir konnten deine Meldung gerade nicht speichern. Dein Text ist noch da – versuch es bitte gleich noch einmal.“, App zeigt „Zu viele Meldungen in kurzer Zeit — bitte versuche es in einer Stunde noch einmal.“; der Speicherfehler-Zustand des Boards ist im Bild nicht zu sehen · .nachtlauf/screens/abnahme/problem-melden/6-1440-hell.png
- 1440 hell/dunkel · Bild 1–4, 6 · Punkt 1 · Feld „Fehlernummer“ im Board volle Kartenbreite, in der App nur etwa halbe Breite · .nachtlauf/screens/abnahme/problem-melden/2-1440-hell.png
- 1440 hell/dunkel · Bild 2 · Punkt 2 · Board „Mitgeschickt: Seite und Gerät. Keine IP-Adresse, keine Cookies.“, App „Mitgeschickt: Fehlernummer 3141592653, Seite und Gerät. Keine IP-Adresse, keine Cookies.“ (zweizeilig) · .nachtlauf/screens/abnahme/problem-melden/2-1440-dunkel.png
- alle Fassungen · Bild 4 · Punkt 2 · Board „Mitgeschickt: Seite, Gerät und dein Hof (Hof Müller).“, App „Mitgeschickt: Seite, Gerät und dein Hof.“ – der Hofname fehlt · .nachtlauf/screens/abnahme/problem-melden/4-1440-hell.png
- alle Fassungen · Bild 4 · Punkt 1 · Knopf „Bildschirmfoto hinzufügen“: im Board linksbündig mit „+“, in der App mittig mit Kamera-Symbol · .nachtlauf/screens/abnahme/problem-melden/4-390-hell.png
- 390 hell/dunkel · Bild 1–6 · Punkt 1 · Kopfzeile: Board zeigt nur das Logo, die App zeigt zusätzlich den Knopf „Anmelden“ bzw. „Mein Hof“ · .nachtlauf/screens/abnahme/problem-melden/1-390-hell.png
- 390 hell/dunkel · Bild 1–4, 6 · Punkt 1 · Auswahlkarten im Board eckig-abgerundet und höher (ca. 64 px), in der App pillenförmig und flacher (ca. 46 px); Eingabefelder in der App ebenfalls pillenförmig statt leicht gerundet · .nachtlauf/screens/abnahme/problem-melden/2-390-hell.png
- alle Fassungen · Bild 1–4, 6 · Punkt 1 · Zeichenzähler („0 / 2000“) steht im Board rechtsbündig unter dem Textfeld, in der App linksbündig · .nachtlauf/screens/abnahme/problem-melden/1-390-dunkel.png
- alle Fassungen · Bild 1–4, 6 · Punkt 2 · Beschriftung „Fehlernummer (optional)“ und „Deine E-Mail · nur für unsere Antwort, optional“ im Board ganz fett, in der App nur „Fehlernummer“/„Deine E-Mail“ fett, der Rest normal · .nachtlauf/screens/abnahme/problem-melden/1-1440-hell.png
- 1440 hell/dunkel · Bild 1–4, 6 · Punkt 1 · Knöpfe „Abbrechen“/„Absenden“ im Board sichtbar größer (ca. 52 px hoch, eckiger), in der App ca. 44 px, pillenförmig · .nachtlauf/screens/abnahme/problem-melden/3-1440-hell.png
- 390 dunkel / 1440 dunkel · Bild 1–4, 6 · Punkt 4 · Gewählter Auswahlpunkt im Board heller Mint-Punkt mit Mint-Rand der Karte, in der App weißer Ring mit dunkelgrünem Kern und dunklerem Kartenrand – gewählte Option wirkt schwächer · .nachtlauf/screens/abnahme/problem-melden/1-390-dunkel.png
- alle Fassungen · Bild 5 · Punkt 2 · Kurznummer im Board kurz und in Großbuchstaben („4F8M“), in der App eine achtstellige Kennung in Kleinbuchstaben („cmw3zwu0“) – sieht nicht wie eine Kurznummer zum Merken aus · .nachtlauf/screens/abnahme/problem-melden/5-390-hell.png
- 1440 hell/dunkel · Bild 1–6 · Punkt 1 · Fuß: App zeigt zusätzlich das Agrilo-Logo links; Fußlinks im Board unterstrichen (links grün, rechts grau), in der App grau ohne Unterstreichung · .nachtlauf/screens/abnahme/problem-melden/3-1440-dunkel.png
- 390 hell/dunkel · Bild 5 · Punkt 1 · Fußlinks im Board unterstrichen, in der App ohne Unterstreichung; App zeigt den Fuß breiter abgesetzt unter der Karte · .nachtlauf/screens/abnahme/problem-melden/5-390-dunkel.png
- 1440 dunkel · Bild 1–6 · Punkt 1 · Darstellungsknopf im Kopf: Board zeigt im Dunkeln den Mond, die App die Sonne · .nachtlauf/screens/abnahme/problem-melden/2-1440-dunkel.png

Begründete Ausnahmen gesehen:
- Recht vor Board: Fußlink „Vertrag widerrufen“ zusätzlich in der App (390 Bild 5, 1440 alle Bilder).
- Fußlinks sichtbar kleiner als 44 px (zulässig, Trefferfläche über ::before).

Nicht prüfbar:
- keine

### region

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 6 | 0 |
| 390 dunkel | 2 | 6 | 0 |
| 1440 hell | 2 | 6 | 0 |
| 1440 dunkel | 2 | 6 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 1440 hell/dunkel · Bild 1, 2, 5 · Punkt 1 · Board zeigt im Web Liste und Karte nebeneinander (Liste links, Karte mit Umkreis rechts, ohne Umschalter); App zeigt nur eine Spalte Liste plus Umschalter „Liste | Karte“, keine Karte · .nachtlauf/screens/abnahme/region/1-1440-hell.png
- 1440 hell/dunkel · Bild 6 · Punkt 1 · Board: Liste links, Karte rechts, gewählter Hof als Karte unter der Karte mit „Schließen“; App: nur Karte über volle Breite, Liste fehlt, gewählter Hof als Overlay-Karte in der Karte mit „×“ · .nachtlauf/screens/abnahme/region/6-1440-hell.png
- alle Fassungen · Bild 1–6 · Punkt 1/2 · Kopf: Board zeigt unter „Region“ die Zeile „Hof Müller · Stand …“ (Web: „Hof Müller“), danach den Satz mit Punkt „… Futter kaufen.“; App hat keine Hof-Zeile und den Satz ohne Schlusspunkt · .nachtlauf/screens/abnahme/region/1-390-hell.png
- alle Fassungen · Bild 1–6 · Punkt 1 · Reiter: Board zeigt zwei gleich breite Reiter über die volle Breite (aktiver mit Unterstrich, Web mit Fokusrahmen); App zeigt zwei schmale linksbündige Reiter · .nachtlauf/screens/abnahme/region/1-1440-hell.png
- alle Fassungen · Bild 1 · Punkt 1 · Filter: Board hat Chips „Hofladen | Futtermittel“, eigene Chip-Zeile „10 km | 25 km | 50 km“ und eigene Chip-Zeile „Liste | Karte“; App hat ein orangefarbenes Segment mit Symbolen (Hofladen/Futtermittel), ein km-Segment und „Liste | Karte“ rechts neben dem Hinweistext · .nachtlauf/screens/abnahme/region/1-390-hell.png
- alle Fassungen · Bild 1 · Punkt 2 · Zusatzzeile „1 Hof hat noch keinen Standort auf der Karte und fehlt hier.“ steht nicht im Board; Hinweis im Board endet mit „Angebot.“, App ohne Punkt · .nachtlauf/screens/abnahme/region/1-390-hell.png
- alle Fassungen · Bild 1 · Punkt 6 · Zustand „eine Sorte offen“ fehlt: Board zeigt die erste Sorte aufgeklappt (Hofzeilen „Hof am Bach · 4 km · … / L“ und „1 weiterer Hof · Kaufen geht über die Hofseite.“); in der App sind alle Sorten zu · .nachtlauf/screens/abnahme/region/1-390-hell.png
- alle Fassungen · Bild 1 · Punkt 1 · Sortenzeile: Board „5 Höfe · € 1,43 – 1,60 · Mitte € 1,52“ in einer Zeile, Marke „Deins: € 1,49“ rechts neben dem Pfeil, Zeilen in einer gemeinsamen Karte; App: „3 Höfe“ rechts, Preis darunter, Marke „Deins“ in eigener Zeile, jede Sorte als eigene Karte · .nachtlauf/screens/abnahme/region/1-390-hell.png
- alle Fassungen · Bild 2, 5, 6 · Punkt 1/2 · Futter-Filter: Board Chips „10 km · 1“ usw., Kategorien „Alle | Heu | Stroh | Getreide | Silage“, Tage ohne Symbol; App km-Segment mit hochgestellter Zahl, Kategorien „Heu & Stroh | Getreide & Körner | Mischfutter | Ergänzungsfutter“, zusätzliche Zeile „Alle Mengen | Kleinmengen | Ballen & mehr“, Uhr-Symbol vor den Tagen · .nachtlauf/screens/abnahme/region/2-390-hell.png
- alle Fassungen · Bild 2 · Punkt 2 · Hinweis: Board 390 „2 Höfe mit LFBIS-Nummer“, Web „Höfe mit LFBIS-Nummer im Umkreis von 25 km – du kaufst für deine Tiere.“; App 390 „10 Angebote · nur Höfe mit LFBIS-Nummer“, Web ohne „im Umkreis von 25 km“ · .nachtlauf/screens/abnahme/region/2-1440-hell.png
- alle Fassungen · Bild 2 · Punkt 1/2 · Angebotskarte: Board Produkt fett, „Hof am Bach · 4 km“, Abholzeile, „ab € 0,15 / kg“ mit Marke „Futtermittel-Nummer laut Hof“, Auswahl „Größe“ mit Radios, Knopf „Bestellen …“; App: Hofname groß in Serifenschrift, Adresse, Marke „Futtermittelbetrieb · LFBIS … · laut Hof“, „Grundpreis“ rechts, keine Größen-Auswahl, Knopf „Bestellen · € 8,48“ · .nachtlauf/screens/abnahme/region/2-390-hell.png
- alle Fassungen · Bild 3 · Punkt 1 · „Wo liegt dein Hof?“: Board linksbündige Karte mit vollbreitem orangem Knopf; App gestrichelte, zentrierte Leer-Karte mit Pin-Symbol, Überschrift in Serifenschrift, kleiner grüner Knopf · .nachtlauf/screens/abnahme/region/3-390-hell.png
- alle Fassungen · Bild 3 · Punkt 1 · „So steht dein Hof …“: Board Überschrift in der Karte, nur Hofname und „Nicht auf der Karte“; App Überschrift über der Karte, großes Titelbild, Adresse, Abholzeile, Produktliste, „Preise inkl. Plattformgebühr“ · .nachtlauf/screens/abnahme/region/3-1440-hell.png
- alle Fassungen · Bild 4 · Punkt 2/6 · Fehler: Board „Prüf den Empfang und versuch es noch einmal.“ und Knopf „Nochmal“ (vollbreit, umrandet, neutrale Karte); App „Es ist nichts verloren gegangen. Versuch es bitte gleich noch einmal.“ und Knopf „Noch einmal versuchen“ (klein), orange getönte Karte mit Warnsymbol · .nachtlauf/screens/abnahme/region/4-390-hell.png
- alle Fassungen · Bild 5 · Punkt 2 · Leer: Board „Gerade verkauft im Umkreis von 10 km kein Hof Silage“ / „Mit 25 km ist es 1 Hof.“ / „Auf 25 km erweitern“ (vollbreit); App „Gerade kein Futter in der Nähe“ / „Im Umkreis von 10 km verkauft gerade kein Hof mit LFBIS-Nummer Futter.“ / „Umkreis auf 25 km“, zentrierte gestrichelte Karte mit Symbol · .nachtlauf/screens/abnahme/region/5-390-hell.png
- alle Fassungen · Bild 5 · Punkt 6 · Kategorie-Chips fehlen bis auf „Alle“ (Board zeigt alle Kategorien mit „Silage“ gewählt); App zeigt zusätzlich Hinweiszeile und „Liste | Karte“, die das Board im Leerzustand nicht zeigt · .nachtlauf/screens/abnahme/region/5-390-hell.png
- 390 hell/dunkel · Bild 6 · Punkt 1 · Board Kartenansicht: nur km-Chips und „Liste | Karte“, darunter Karte, gewählter Hof als Karte unter der Karte mit Knopf „Schließen“, „Größe“-Radios, „Bestellen …“; App: alle Filterzeilen über der Karte, gewählter Hof als Overlay in der Karte mit „×“, ohne Größen-Auswahl · .nachtlauf/screens/abnahme/region/6-390-hell.png
- alle Fassungen · Bild 6 · Punkt 1/3 · Zoomknöpfe links oben, 30 px, Leaflet-Standard; Board rechts oben, große runde Knöpfe; Quellenhinweis oben statt unten rechts · .nachtlauf/screens/abnahme/region/6-1440-hell.png
- 390/1440 dunkel · Bild 6 · Punkt 4 · helle Flecken: weiße Zoomknöpfe, weißer Quellenhinweis und weiße Namensschilder der Marker im Dunkeln (Board dunkle Schilder) · .nachtlauf/screens/abnahme/region/6-390-dunkel.png
- 390/1440 dunkel · Bild 2, 3 · Punkt 4 · Produktbilder bzw. Titelbild (hellgrauer Grund) im Dunkeln nicht gedämpft, wirkt als heller Fleck · .nachtlauf/screens/abnahme/region/3-390-dunkel.png
- 1440 dunkel · Bild 1–6 · Punkt 4 · aktiver Seitenspalten-Eintrag „Region“ als helle cremefarbene Fläche (Board: dunkelgrüne Fläche mit grüner Schrift) · .nachtlauf/screens/abnahme/region/1-1440-dunkel.png
- 1440 hell · Bild 1–6 · Punkt 1 · Seitenspalte: aktiver Eintrag schwarz gefüllt (Board hellgrün mit grüner Schrift), Einträge mit Symbolen, „Gründungshof“-Text anders; Inhalt schmal zentriert statt über die volle Breite · .nachtlauf/screens/abnahme/region/1-1440-hell.png
- 1440 hell/dunkel · Bild 1 · Punkt 6 · Menü „Neu“ („Was legst du an?“) steht offen und verdeckt die Seitenspalte; Board zeigt es geschlossen · .nachtlauf/screens/abnahme/region/1-1440-hell.png
- 1440 hell/dunkel · Bild 1–6 · Punkt 5 · Board zeigt den Fokusrahmen am ersten Bedienelement (aktiver Reiter); in der App ist kein Fokusrahmen sichtbar · .nachtlauf/screens/abnahme/region/4-1440-hell.png
- 390 hell/dunkel · Bild 1–6 · Punkt 1 · untere Leiste: Board „Neu“ als orange Kachel in der Leiste, „Bestellungen“ ausgeschrieben, „Mehr“ mit hinterlegter Fläche; App runder, herausstehender Knopf, „Bestellung…“ abgeschnitten, „Mehr“ nur fett · .nachtlauf/screens/abnahme/region/1-390-hell.png

Begründete Ausnahmen gesehen:
- Kartenkacheln fehlen im Prüf-Container (Bild 6), nicht als Abweichung gewertet.
- Chips/Segmente kleiner als 44 px (km-, Tage-, Kategorie-Chips) nicht als Mangel gewertet.

Nicht prüfbar:
- keine

### teilen

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 3 | 0 |
| 390 dunkel | 2 | 3 | 0 |
| 1440 hell | 2 | 3 | 0 |
| 1440 dunkel | 2 | 3 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell/dunkel · Bild 1–3 · Punkt 1 · Kopfleiste fehlt: Board zeigt eine App-Leiste mit Zurück-Pfeil „‹“ und Titel „Geteilte Fotos“, die App hat stattdessen nur einen Textlink „← Zu Heute“ über der h1 · .nachtlauf/screens/abnahme/teilen/1-390-hell.png
- 1440 hell/dunkel · Bild 1–3 · Punkt 1 · Kopfleiste fehlt: Board zeigt eine volle Kopfleiste (Agrilo-Logo, Trenner, „Geteilte Fotos“ links, „← Zu Heute“ rechts), die App hat keine Kopfleiste, nur einen Pillen-Link „← Zu Heute“ über der h1 · .nachtlauf/screens/abnahme/teilen/1-1440-hell.png
- alle Fassungen · Bild 1 und 3 · Punkt 1 · Auswahl „Titelbild“ / „Hofgalerie“ (zwei Optionskarten mit Radio, „Hofgalerie“ gewählt) fehlt in der App vollständig · .nachtlauf/screens/abnahme/teilen/1-390-hell.png
- 390 hell/dunkel · Bild 1 · Punkt 1 · Feste Leiste unten mit „In die Hofgalerie laden“ fehlt; in der App steht der Knopf in der Karte direkt unter den Fotos · .nachtlauf/screens/abnahme/teilen/1-390-dunkel.png
- 1440 hell/dunkel · Bild 1 · Punkt 1 · Knopf „In die Hofgalerie laden“ im Board kompakt, linksbündig unter der Auswahl; in der App volle Kartenbreite als Pille · .nachtlauf/screens/abnahme/teilen/1-1440-dunkel.png
- alle Fassungen · Bild 1 und 3 · Punkt 1 · Fotos und Hinweis liegen in der App in einer zusätzlichen umrandeten Karte; im Board stehen sie frei auf der Seite. Vorschauen im Board zweispaltig über die volle Breite (breite Kacheln), in der App kleine quadratische Kacheln linksbündig · .nachtlauf/screens/abnahme/teilen/1-390-hell.png
- alle Fassungen · Bild 1 und 3 · Punkt 1 · „2 Fotos – sie gehen in die Hofgalerie.“ im Board fett in Fließtextgröße, in der App klein, dünn und grau · .nachtlauf/screens/abnahme/teilen/1-1440-hell.png
- 390/1440 dunkel · Bild 1 und 3 · Punkt 4 · Foto-Vorschauen im Dunkeln nicht gedämpft: hell leuchtende Kacheln (grün/beige) auf dunkler Karte, wirken als helle Flecken · .nachtlauf/screens/abnahme/teilen/1-390-dunkel.png
- alle Fassungen · Bild 3 · Punkt 2 · Fehlertext weicht ab. Board: „Keine Verbindung – die Fotos sind nicht hochgeladen, sie liegen noch hier. Prüf den Empfang und tippe auf „Nochmal“. Du kannst sie auch später unter Mein Hof › Hofseite hochladen.“ App: Überschrift „Die Fotos sind nicht hochgeladen – sie liegen noch hier.“, dann zweimal „Verbindung unterbrochen — bitte nochmal versuchen. [S139]“, dann „Du kannst sie auch später unter Mein Hof › Hofseite hochladen.“ · .nachtlauf/screens/abnahme/teilen/3-390-hell.png
- alle Fassungen · Bild 3 · Punkt 2 · Zeile „Verbindung unterbrochen … [S139]“ doppelt und mit technischem Code „[S139]“ sichtbar · .nachtlauf/screens/abnahme/teilen/3-1440-hell.png
- alle Fassungen · Bild 3 · Punkt 1 · Fehlerkasten im Board ein flacher Hinweis-Kasten unter der Auswahl mit kompaktem, umrandetem Knopf „Nochmal“ (Fehlerfarbe); in der App ein stark gerundeter Kasten in der Karte mit „Nochmal“ über die volle Breite in neutraler Farbe · .nachtlauf/screens/abnahme/teilen/3-390-dunkel.png
- alle Fassungen · Bild 2 · Punkt 1 · Leer-Zustand: Board zeigt gestrichelt umrandeten Kasten ohne Symbol; App zeigt eine durchgezogene Karte mit zusätzlichem Bild-Symbol oben · .nachtlauf/screens/abnahme/teilen/2-390-hell.png
- alle Fassungen · Bild 2 · Punkt 2 · Überschrift „Gerade wurde nichts geteilt“ (fett, eigene Zeile) fehlt als Überschrift; in der App steht sie als normaler Satz im Fließtext vor „So geht’s: …“ · .nachtlauf/screens/abnahme/teilen/2-1440-hell.png
- alle Fassungen · Bild 2 · Punkt 1 · „Zu Heute“ im Board ein umrandeter Knopf über die volle Kastenbreite; in der App nur ein unterstrichener Textlink · .nachtlauf/screens/abnahme/teilen/2-390-dunkel.png
- 1440 hell/dunkel · Bild 2 und 3 · Punkt 5 · Board zeigt den Fokus am Knopf im Kasten („Zu Heute“ bzw. „Nochmal“, dort sind die Kopfleisten-Links nicht fokussiert); App zeigt den Fokus am Link „← Zu Heute“ oben. Fokus ist sichtbar, liegt aber auf anderem Element (Folge der fehlenden Kopfleiste) · .nachtlauf/screens/abnahme/teilen/2-1440-dunkel.png
- 1440 hell/dunkel · Bild 1 · Punkt 5 · Board zeigt Fokus an der Option „Titelbild“; in der App fehlt die Option, Fokus sitzt an „← Zu Heute“ · .nachtlauf/screens/abnahme/teilen/1-1440-hell.png

Begründete Ausnahmen gesehen:
- keine

Nicht prüfbar:
- keine

### verkaeufe

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 6 | 0 |
| 390 dunkel | 2 | 6 | 0 |
| 1440 hell | 2 | 6 | 0 |
| 1440 dunkel | 2 | 6 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- alle · Bild 1/4/5 · Punkt 1 · Zusätzliche große Karte „Diese Woche“ (€-Summe, „Dieses Jahr (für die Umsatzgrenze)“, Umsatzgrenze-Erklärung) vor „Online bezahlt“/„Bar kassiert“; das Board zeigt nur die zwei Karten „Online bezahlt“ und „Bar kassiert“ nebeneinander (auch im Handy zweispaltig, in der App untereinander) · .nachtlauf/screens/abnahme/verkaeufe/1-390-hell.png
- alle · Bild 1/4 · Punkt 1 · Textlink „Auszahlungen bei Stripe ansehen“ fehlt in der App (Board: unter den Geldkarten; im Web trägt er dort den Startfokus) · .nachtlauf/screens/abnahme/verkaeufe/1-1440-hell.png
- 1440 hell/dunkel · Bild 1/4 · Punkt 1 · Board: „Noch einmal eintragen“ mit Chips („Markt · € 290,00“, „Ab Hof · € 160,00“) als rechte Spalte neben den Geldkarten, Liste schmal links; App: Karten über volle Breite, „Noch einmal eintragen“ erst unter der Liste (unter dem Falz) · .nachtlauf/screens/abnahme/verkaeufe/1-1440-hell.png
- 390 hell/dunkel · Bild 1/4 · Punkt 1 · Board: „Noch einmal eintragen“ mit Chips zwischen Stripe-Link und „Letzte Verkäufe“; App: an dieser Stelle nicht vorhanden · .nachtlauf/screens/abnahme/verkaeufe/1-390-hell.png
- 390 hell/dunkel · Bild 1/4/5/6 · Punkt 1 · Kopf fehlt: Board hat Zurück-Pfeil, h1 „Verkäufe“ und Unterzeile „Hof Müller · Stand …“; App nur h1 und (Bild 1/4/5) „Was du diese Woche eingenommen hast“, keine Zurück-Taste, keine Hof-Zeile · .nachtlauf/screens/abnahme/verkaeufe/1-390-hell.png
- 390 hell/dunkel · Bild 1/4/5 · Punkt 1 · Feste Leiste „Verkauf eintragen“ über der Tab-Leiste fehlt; App hat stattdessen einen Knopf „+ Verkauf eintragen“ oben unter der h1 · .nachtlauf/screens/abnahme/verkaeufe/1-390-hell.png
- 390 hell/dunkel · alle Bilder · Punkt 1 · Tab-Leiste anders: Board „Neu“ als orange Pille in der Leiste mit fetter Beschriftung, „Mehr“ als hinterlegte Pille; App runder schwebender „+“-Knopf, Beschriftung „Bestellung…“ abgeschnitten, Leiste endet rechts vor dem Rand (Streifen sichtbar) · .nachtlauf/screens/abnahme/verkaeufe/6-390-hell.png
- 1440 hell/dunkel · Bild 1/4/5/6 · Punkt 1 · Unterzeile „Hof Müller“/„Hof am Moos“ unter der h1 fehlt; App zeigt stattdessen „Was du diese Woche eingenommen hast“ direkt unter der h1 · .nachtlauf/screens/abnahme/verkaeufe/1-1440-hell.png
- alle · Bild 1/4 · Punkt 1/2 · Listenzeilen anders: Board Marke „Eingetragen“ bzw. „Bestellung“ unter dem Betrag; App ohne diese Marken, dafür Rund-Symbol links und Kanal-Marken („Geschäftskunde“, „Hofladen“, „WhatsApp“, „Bar · Abholung“) unter dem Titel; im Handy Titel abgeschnitten („Rindfleisch-Paket g…“) · .nachtlauf/screens/abnahme/verkaeufe/1-1440-hell.png
- alle · Bild 4 · Punkt 1/6 · Der neue Verkauf steht nicht oben in der Liste (Board: „4× Bergkäse · Heute“ als erste Zeile); App: „Rindfleisch-Paket gemischt“ bleibt oben · .nachtlauf/screens/abnahme/verkaeufe/4-1440-hell.png
- alle · Bild 4 · Punkt 1/2/4 · Meldung: Board dunkler Balken unten, Text „Verkauf eingetragen · Bergkäse: noch 14 auf Vorrat“; App hellgrüner Balken oben, der die h1 „Verkäufe“ überdeckt, Text „Verkauf eingetragen. Vorrat jetzt: 46 L.“, grüne Schrift auf Hellgrün mit schwachem Kontrast (hell) · .nachtlauf/screens/abnahme/verkaeufe/4-1440-hell.png
- alle · Bild 3 · Punkt 2/6 · Fehlerkasten: Board „Wir konnten den Verkauf nicht speichern. Deine Angaben sind noch da.“ mit Knopf „Nochmal“ (Startfokus); App „Wir konnten den Verkauf nicht speichern. Bitte versuch es noch einmal.“ ohne „Nochmal“-Knopf · .nachtlauf/screens/abnahme/verkaeufe/3-390-hell.png
- 1440 hell/dunkel · Bild 3 · Punkt 6 · Fehlerkasten im Dialog unter der festen Fußleiste abgeschnitten, Text nicht lesbar; Fokus auf „Hofladen“ statt auf „Nochmal“ · .nachtlauf/screens/abnahme/verkaeufe/3-1440-hell.png
- alle · Bild 2/3 · Punkt 1/2 · Formularkopf: Board Datum-Chip „Heute, Mi 3. März“ unter dem Titel und „Abbrechen“ oben rechts; App Auswahl „Heute ▾“ oben rechts, „Abbrechen“ fehlt im Handy ganz, im Web nur in der Fußleiste · .nachtlauf/screens/abnahme/verkaeufe/2-390-hell.png
- alle · Bild 2/3 · Punkt 3 · Beschriftung „Betrag in Euro“ über dem Betragsfeld fehlt (Feld ohne sichtbare Beschriftung) · .nachtlauf/screens/abnahme/verkaeufe/2-1440-hell.png
- alle · Bild 2/3 · Punkt 1/2 · „Wo verkauft?“: Board Chips „Ab Hof / Markt / WhatsApp / Betrieb“ ohne Symbole und Textlink „Anderes“ rechts neben der Frage; App „Hofladen“ statt „Ab Hof“, Symbole in den Chips, zusätzlicher Chip „Anderer Weg“ in eigener Zeile statt Link „Anderes“ · .nachtlauf/screens/abnahme/verkaeufe/2-390-hell.png
- alle · Bild 2/3 · Punkt 1 · „Was hast du verkauft?“: zusätzlicher gestrichelter Chip „Anderes“ · .nachtlauf/screens/abnahme/verkaeufe/2-390-hell.png
- alle · Bild 2/3 · Punkt 1/2 · Reihenfolge und Wortlaut Menge/Vorrat: Board Feld „Menge“ mit „Stück · Notiz ergänzen“ vor „Vorrat abziehen“; App „Vorrat abziehen“ zuerst, danach Klappe „Menge oder Notiz ergänzen“ mit Feldern „Menge“ und „Notiz“ (in Bild 3 zugeklappt, Menge nicht sichtbar) · .nachtlauf/screens/abnahme/verkaeufe/2-1440-hell.png
- alle · Bild 2/3 · Punkt 2 · Vorrat-Zeile: Board „Bergkäse: 18 auf Vorrat, danach 14“; App „Im Vorrat: 50 L. Wir ziehen 4 L ab.“ · .nachtlauf/screens/abnahme/verkaeufe/2-390-hell.png
- alle · Bild 2 · Punkt 1 · Hinweissatz „Nur Verkäufe, die nicht über Agrilo bestellt wurden …“ und Knopf „€ 24,80 eintragen“ im Handy nicht im Bild (Blatt endet mit „Notiz“); im Web steht der Hinweissatz nicht über dem Kaufknopf, sondern ist weggescrollt; Web-Fußleiste zusätzlich mit Knopf „Abbrechen“ · .nachtlauf/screens/abnahme/verkaeufe/2-1440-hell.png
- 1440 hell/dunkel · Bild 2 · Punkt 5 · Startfokus: Board auf dem Betragsfeld, App auf „Hofladen“ · .nachtlauf/screens/abnahme/verkaeufe/2-1440-hell.png
- alle · Bild 5 · Punkt 1/2 · Hinweiskasten: Board „Richte deinen Hof fertig ein – Kundinnen sehen ihn noch nicht“ unter dem Kopf; App „Dein Hof wird noch geprüft – Kundinnen sehen ihn noch nicht“, über der h1 (Web: über volle Breite außerhalb der Inhaltsspalte), zusätzlich Uhr-Symbol, „Deine Hof-ID: …“ und Satz „– die Hof-ID ist in der Nachricht schon eingetragen.“ · .nachtlauf/screens/abnahme/verkaeufe/5-1440-hell.png
- alle · Bild 5 · Punkt 1/2 · Leerzustand: Board gestrichelter, linksbündiger Kasten „Noch keine Verkäufe“ mit zweitem Satz „Was du am Markt oder ab Hof verkaufst, trägst du mit „Verkauf eintragen“ ein.“; App zentriert mit Symbol, zweiter Satz fehlt, zusätzlicher Knopf „Verkauf eintragen“, Überschrift „Letzte Verkäufe“ zusätzlich; im Handy nicht im ersten Bild · .nachtlauf/screens/abnahme/verkaeufe/5-1440-hell.png
- alle · Bild 6 · Punkt 1/4 · Fehler beim Laden: Board neutrale Karte mit Knopf „Noch einmal versuchen“ über volle Breite unter dem Text; App orange getönter Kasten mit Warnsymbol, kleiner Knopf (Handy links, Web rechts neben dem Text), im Handy blasser Knopfrand; im Web fehlt „Verkauf eintragen“ oben rechts · .nachtlauf/screens/abnahme/verkaeufe/6-1440-hell.png
- 1440 dunkel · Bild 1/4/5/6 · Punkt 4 · Aktiver Menüpunkt „Verkäufe“ als helle Creme-Pille in der Seitenspalte (heller Fleck); Board dunkelgrün hinterlegt · .nachtlauf/screens/abnahme/verkaeufe/1-1440-dunkel.png

Begründete Ausnahmen gesehen:
- keine

Nicht prüfbar:
- keine

### whatsapp-plakat

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 4 | 0 |
| 390 dunkel | 2 | 4 | 0 |
| 1440 hell | 2 | 4 | 0 |
| 1440 dunkel | 2 | 4 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- alle · Bild 1 · Punkt 1/6 · Die Empfängerzeilen haben keinen Knopf „Öffnen“ (Board: gefüllter Akzent-Knopf in der ersten offenen Zeile, umrandeter Knopf in den weiteren); die Hauptaktion der Seite fehlt im Bild · .nachtlauf/screens/abnahme/whatsapp-plakat/1-390-hell.png
- alle · Bild 1 · Punkt 1 · Zusätzliche Karte „DEIN BEITRAG“ mit Nachrichtentext und zusätzlicher Fortschrittsleiste; Board zeigt nur den Beitragstitel „Frischer Bergkäse ab Samstag“ und die Zeile „1 von 3 geöffnet / 2 ausstehend“ · .nachtlauf/screens/abnahme/whatsapp-plakat/1-1440-hell.png
- alle · Bild 1 · Punkt 1 · Hinweissatz „WhatsApp öffnet sich mit dem Text …“ steht direkt unter der h1 statt unter der Liste; Empfänger als einzelne Karten statt einer gemeinsamen Listenkarte mit Trennlinien; Zeilen zeigen zusätzlich die Telefonnummer · .nachtlauf/screens/abnahme/whatsapp-plakat/1-390-hell.png
- alle · Bild 1 · Punkt 2 · Geöffnete Zeile: Board „✓ Geöffnet“ + Link „Doch nicht gesendet?“; App: Fließtext „Doch nicht gesendet?“ + zusätzlicher Link „Zurücksetzen“, „Geöffnet“ ohne Haken · .nachtlauf/screens/abnahme/whatsapp-plakat/1-390-hell.png
- alle · Bild 1 · Punkt 4 · „2 ausstehend“ im Board in Akzentfarbe und fett, in der App grau und normal · .nachtlauf/screens/abnahme/whatsapp-plakat/1-390-dunkel.png
- alle · Bild 1–4 · Punkt 1/2 · Kopf: Board Zurück + Titel + Brotkrume „Mein Hof › Beiträge“ (Bild 2: „Hof am Bach · Mein Hof › Beiträge“); App ohne Brotkrume, Zurück heißt in Bild 3/4 „Heute“ statt „Beiträge“ · .nachtlauf/screens/abnahme/whatsapp-plakat/3-390-hell.png
- alle · Bild 2 · Punkt 1 · h1 „WhatsApp versenden“ und Beitragstitel „Frische Eier vom Freilandstall“ fehlen; Leer-Karte zentriert mit zusätzlichem Sprechblasen-Symbol und Serifentitel, Knopf „Zu den Beiträgen“ klein statt volle Breite mit kräftigem Rand · .nachtlauf/screens/abnahme/whatsapp-plakat/2-1440-hell.png
- alle · Bild 3 · Punkt 1 · Plakat anders aufgebaut: Board zentriert (Agrilo-Logo oben, Überschrift, „Hof Müller · Braunau am Inn“, QR mittig, Adresse darunter, drei Schritte nebeneinander); App linksbündig mit Hofzeile in Versalien über der Überschrift, zusätzlichem Satz „Handy-Kamera auf den Code halten …“, Schritte senkrecht neben dem QR, zusätzlicher Fuß mit „Abholung“-Zeiten, Logo und „Bar bei der Abholung bezahlen“ · .nachtlauf/screens/abnahme/whatsapp-plakat/3-390-hell.png
- 390 · Bild 3 · Punkt 1/2 · Board: feste Leiste unten mit vollbreitem Knopf „Drucken“; App: Knopf „Plakat drucken“ mit Symbol neben dem Einleitungstext, keine feste Leiste · .nachtlauf/screens/abnahme/whatsapp-plakat/3-390-hell.png
- 1440 · Bild 3 · Punkt 1/2 · Knopf heißt „Plakat drucken“ statt „Drucken“ und steht rechts neben dem Einleitungstext statt neben der h1; Plakat etwa doppelt so groß (ca. 800 px breit, reicht über den Bildrand) statt ca. 420 px · .nachtlauf/screens/abnahme/whatsapp-plakat/3-1440-hell.png
- 1440 dunkel · Bild 3 · Punkt 4 · Durch das übergroße Plakat füllt eine große helle Fläche den dunklen Bildschirm; im Board ist die Papierfläche klein · .nachtlauf/screens/abnahme/whatsapp-plakat/3-1440-dunkel.png
- alle · Bild 4 · Punkt 1 · Hinweis-Kasten steht ganz oben über Zurück und h1 (Web: volle Breite über der Inhaltsspalte); Board: unter h1/Brotkrume in der Inhaltsspalte · .nachtlauf/screens/abnahme/whatsapp-plakat/4-1440-hell.png
- alle · Bild 4 · Punkt 2 · Überschrift „Dein Hof wird noch geprüft – Kundinnen sehen ihn noch nicht“ statt „Richte deinen Hof fertig ein – Kundinnen sehen ihn noch nicht“; zusätzlich Zeile „Deine Hof-ID: …“ und „– die Hof-ID ist in der Nachricht schon eingetragen.“, zusätzliches Uhr-Symbol (falls das N39-Wortlaut ist, als Register begründen – im Auftrag nicht so ausgewiesen) · .nachtlauf/screens/abnahme/whatsapp-plakat/4-390-hell.png
- alle · Bild 4 · Punkt 1 · Zusätzlicher Einleitungstext „Zum Aushängen im Hofladen …“ (Board zeigt ihn in diesem Zustand nicht); Leer-Karte zentriert mit Drucker-Symbol, Knopf „Hofseite einrichten“ klein statt volle Breite · .nachtlauf/screens/abnahme/whatsapp-plakat/4-390-hell.png
- alle · Bild 4 · Punkt 4 · Link „Frage zur Freischaltung stellen“ im Board in Hinweisfarbe (braun/orange), in der App in Textfarbe · .nachtlauf/screens/abnahme/whatsapp-plakat/4-1440-dunkel.png
- 390 · Bild 1–4 · Punkt 1 · Untere Leiste: Board „Neu“ als Pille in der Leiste mit Beschriftung, aktiver Reiter „Mein Hof“ in Akzentfarbe auf heller Pille; App runder schwebender Knopf über der Leiste, „Mein Hof“ nur fett; „Bestellungen“ abgeschnitten zu „Bestellung…“ · .nachtlauf/screens/abnahme/whatsapp-plakat/1-390-hell.png
- 1440 · Bild 1–4 · Punkt 1 · Inhaltsspalte mittig (ab ca. x 430–590) statt linksbündig ab x 300 neben der Seitenspalte; Zurück als umrandete Pille statt Textlink „‹ Beiträge“ · .nachtlauf/screens/abnahme/whatsapp-plakat/1-1440-hell.png
- 1440 · Bild 1–4 · Punkt 1 · Seitenspalte: zusätzliche Symbole vor jedem Eintrag; aktiver Eintrag „Mein Hof“ als dunkle Pille statt hellgrüner Fläche; untere Einträge passen nicht ins Bild („Konto“ angeschnitten, „Abmelden“ nicht sichtbar) · .nachtlauf/screens/abnahme/whatsapp-plakat/1-1440-hell.png
- 1440 dunkel · Bild 1–4 · Punkt 4 · Aktiver Eintrag „Mein Hof“ als helle cremefarbene Pille – heller Fleck im Dunkeln (Board: dunkelgrüne Fläche) · .nachtlauf/screens/abnahme/whatsapp-plakat/1-1440-dunkel.png
- 1440 · Bild 1/2/4 · Punkt 5 · Startfokus liegt auf dem Zurück-Link; Board zeigt ihn auf „Doch nicht gesendet?“ (Bild 1), „Zu den Beiträgen“ (Bild 2), „Frage zur Freischaltung stellen“ (Bild 4 – App dort gleich) · .nachtlauf/screens/abnahme/whatsapp-plakat/2-1440-hell.png

Begründete Ausnahmen gesehen:
- keine der aufgeführten Ausnahmen trifft hier zu. Hinweis: Plakat-Papierfläche bleibt auch im Dunkeln hell – so auch im Board, daher keine Abweichung. Hof-Namen, Kontonamen, Abonnentinnen-Kennungen, Adresse (localhost) und Gründungshof-Text sind Beispieldaten. Text in der verkleinerten Plakat-Vorschau (390) nicht nach Schriftgröße gewertet.

Nicht prüfbar:
- keine

### abmelden

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 3 | 2 | 1 |
| 390 dunkel | 3 | 2 | 1 |
| 1440 hell | 3 | 2 | 1 |
| 1440 dunkel | 3 | 2 | 1 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell/dunkel · Bild 1 · Punkt 1 · Kopf zeigt zusätzlich einen Knopf „Anmelden“ rechts; im Board steht im Handy-Kopf nur die Marke „Agrilo“ · .nachtlauf/screens/abnahme/abmelden/1-390-hell.png
- 390 hell/dunkel · Bild 3 · Punkt 1 · derselbe zusätzliche Knopf „Anmelden“ im Handy-Kopf · .nachtlauf/screens/abnahme/abmelden/3-390-hell.png
- 1440 hell/dunkel · Bild 1 · Punkt 1 · Karte schmal und mittig auf der Seite; im Board steht sie links bündig in der Inhaltsspalte (gleiche linke Kante wie Trennlinie und Fußlinks, ca. 520 px breit) · .nachtlauf/screens/abnahme/abmelden/1-1440-hell.png
- 1440 hell/dunkel · Bild 3 · Punkt 1 · Karte ebenso mittig statt links bündig in der Inhaltsspalte · .nachtlauf/screens/abnahme/abmelden/3-1440-hell.png
- alle Fassungen · Bild 1 · Punkt 1 · zusätzliches Symbol (durchgestrichene Glocke) über „Abmelden?“; Überschrift und Text mittig gesetzt; im Board kein Symbol, Überschrift und Text links bündig · .nachtlauf/screens/abnahme/abmelden/1-390-hell.png
- alle Fassungen · Bild 3 · Punkt 1 · zusätzliches Warndreieck über „Link ungültig“; Inhalt mittig statt links bündig · .nachtlauf/screens/abnahme/abmelden/3-390-hell.png
- alle Fassungen · Bild 3 · Punkt 4 · Überschrift „Link ungültig“ in Textfarbe (schwarz bzw. hell); im Board in der Warnfarbe (rostbraun hell, lachsfarben dunkel), die Warnfarbe trägt in der App nur das Symbol · .nachtlauf/screens/abnahme/abmelden/3-390-dunkel.png
- alle Fassungen · Bild 3 · Punkt 1 · „Abonnements verwalten“ ohne Unterstreichung (im Web als umrandeter Pillenknopf mit Fokusring); im Board unterstrichener Textlink mit eckigem Fokusrahmen · .nachtlauf/screens/abnahme/abmelden/3-1440-hell.png
- alle Fassungen · Bild 1 · Punkt 2 · Fließtext „…von den Neuigkeiten dieses Hofs abmelden?“; im Board „…von den Neuigkeiten von **Hof Müller** abmelden?“ (Hofname fett). Vermutlich Folge des ungültigen Tokens (Hof unbekannt), Satzbau weicht aber sichtbar ab · .nachtlauf/screens/abnahme/abmelden/1-390-hell.png
- alle Fassungen · Bild 1 · Punkt 4 · Fließtext in gedämpfter Grauschrift und kleiner; im Board in voller Textfarbe · .nachtlauf/screens/abnahme/abmelden/1-1440-hell.png
- alle Fassungen · Bild 1/3 · Punkt 1 · Karte mit deutlich größerem Innenabstand und stärker gerundeten Ecken, Karte im Handy dadurch merklich höher als im Board · .nachtlauf/screens/abnahme/abmelden/1-390-hell.png
- 1440 hell/dunkel · Bild 1/3 · Punkt 1 · Fußzeile zeigt zusätzlich die Marke „Agrilo“ links; im Board beginnt sie direkt mit „Höfe entdecken“ · .nachtlauf/screens/abnahme/abmelden/1-1440-dunkel.png
- alle Fassungen · Bild 1/3 · Punkt 4 · Fußlinks grau und ohne Unterstreichung; im Board unterstrichen, im Web „Höfe entdecken / Für Höfe / So funktioniert's“ in Grün · .nachtlauf/screens/abnahme/abmelden/1-1440-hell.png
- 1440 dunkel · Bild 1/3 · Punkt 1 · Darstellungs-Knopf im Kopf zeigt im Dunkeln eine Sonne; im Board in beiden Themes der Mond · .nachtlauf/screens/abnahme/abmelden/1-1440-dunkel.png
- 1440 hell/dunkel · Bild 1/3 · Punkt 1 · Kopf-Inhalt schmaler eingerückt (Marke bei ca. 137 px statt 41 px), Kopf ohne Rahmen um die Seite; kleine Abweichung · .nachtlauf/screens/abnahme/abmelden/1-1440-hell.png

Begründete Ausnahmen gesehen:
- Recht vor Board: Fußlink „Vertrag widerrufen“ zusätzlich zu Impressum, Datenschutz, AGB, Problem melden (alle Fassungen, Bild 1 und 3).
- Chips, Fußlinks und Textlinks sichtbar kleiner als 44 px (Fußlinks, „Zur Startseite“) – zulässig.

Nicht prüfbar:
- Bild 2 (390/1440): ‚Abgemeldet‘ braucht einen gültigen signierten Abmelde-Link aus einer Mail; Tokens werden nicht selbst erzeugt

### anmelden

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 4 | 0 |
| 390 dunkel | 2 | 4 | 0 |
| 1440 hell | 2 | 4 | 0 |
| 1440 dunkel | 2 | 4 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 1440 hell/dunkel · Bild 3 · Punkt 1 · Board: schmale Spalte mittig, ohne Karte, Inhalt frei auf der Fläche; App: Inhalt in einer Karte, links an den Rand gesetzt (rechts zwei Drittel leer) · .nachtlauf/screens/abnahme/anmelden/3-1440-hell.png
- 1440 hell/dunkel · Bild 4 · Punkt 1 · wie Bild 3: Karte links statt mittiger Spalte ohne Karte · .nachtlauf/screens/abnahme/anmelden/4-1440-hell.png
- 1440 hell/dunkel · Bild 3/4 · Punkt 1 · Kopf: Board zeigt Marke „Admin“ rechts neben dem Theme-Knopf; App setzt sie links direkt hinter das Logo · .nachtlauf/screens/abnahme/anmelden/3-1440-dunkel.png
- 390 + 1440 · Bild 4 · Punkt 1/6 · Board: im Ersatzcode-Zustand ist „Mit Passkey anmelden“ weg, stattdessen eigene Karte „Mit Ersatzcode anmelden“; App: Passkey-Knopf bleibt oben, Ersatzcode nur als Abschnitt unter Trennlinie in derselben Karte · .nachtlauf/screens/abnahme/anmelden/4-390-hell.png
- 390 + 1440 · Bild 4 · Punkt 1 · Überschrift „Mit Ersatzcode anmelden“ im Board in Serifenschrift (Kartentitel), in der App kleine serifenlose Zwischenzeile · .nachtlauf/screens/abnahme/anmelden/4-1440-hell.png
- 390 + 1440 · Bild 3/4 · Punkt 1 · Hinweis „Kein Passwort, kein Code per SMS …“ im Board als schlichter kleiner Text unter dem Inhalt; App: farbiger Hinweis-Kasten mit Schild-Symbol · .nachtlauf/screens/abnahme/anmelden/3-390-hell.png
- 390 · Bild 3 · Punkt 1 · Board ohne Karte, Inhalt randbreit; App packt alles in eine Karte mit Innenabstand · .nachtlauf/screens/abnahme/anmelden/3-390-dunkel.png
- 390 + 1440 · Bild 3 · Punkt 1 · „Ersatzcode eingeben“ im Board dunkel, fett, größer; App kleiner und grün · .nachtlauf/screens/abnahme/anmelden/3-390-hell.png
- 390 hell/dunkel · Bild 1/2 · Punkt 2 · h1 heißt im Board „Willkommen zurück“, in der App „Anmelden“; Untertitel „Kunden melden sich mit einem Code an, Höfe mit Passwort.“ fehlt · .nachtlauf/screens/abnahme/anmelden/1-390-hell.png
- 390 hell/dunkel · Bild 1/2 · Punkt 1 · Überzeile „ICH HABE EINEN HOF“ und Zwischenüberschrift „Hof-Anmeldung“ unter dem Umschalter fehlen · .nachtlauf/screens/abnahme/anmelden/1-390-dunkel.png
- 390 hell/dunkel · Bild 1/2 · Punkt 1 · Kopf: App zeigt zusätzlich Knopf „Anmelden“ rechts oben, Board nur Logo · .nachtlauf/screens/abnahme/anmelden/1-390-hell.png
- 390 + 1440 · Bild 2 · Punkt 6 · Fehler: Board zeigt Hinweis-Kasten über dem E-Mail-Feld mit fetter Zeile „E-Mail oder Passwort falsch.“ und zweiter Zeile „Bitte nochmals versuchen.“; App: roter Fließtext unter dem Passwortfeld in einer Zeile plus rote Feldränder · .nachtlauf/screens/abnahme/anmelden/2-390-hell.png
- 390 + 1440 · Bild 1/2 · Punkt 1 · zusätzliche Trennzeile „oder“ zwischen „Anmelden“ und „Mit Passkey anmelden“, im Board nicht vorhanden · .nachtlauf/screens/abnahme/anmelden/1-1440-hell.png
- 390 + 1440 · Bild 1–4 · Punkt 1 · zusätzliche Symbole: Auge im Passwortfeld, Schlüssel auf „Mit Passkey anmelden“; Board zeigt beide ohne Symbol · .nachtlauf/screens/abnahme/anmelden/1-390-hell.png
- 1440 hell/dunkel · Bild 1/2 · Punkt 1 · „Passwort vergessen?“ und „Noch kein Hof? Registrieren“ stehen nebeneinander in einer Zeile; Board untereinander · .nachtlauf/screens/abnahme/anmelden/1-1440-hell.png
- 1440 hell/dunkel · Bild 1/2 · Punkt 1 · „Willkommen zurück“ samt Untertitel mittig gesetzt und größer; Board linksbündig über der linken Karte · .nachtlauf/screens/abnahme/anmelden/1-1440-dunkel.png
- 390 + 1440 · Bild 1/2 · Punkt 1 · Textlinks („Passwort vergessen?“, „Noch kein Hof? Registrieren“, „Admin-Anmeldung“) im Board unterstrichen, in der App ohne Unterstreichung · .nachtlauf/screens/abnahme/anmelden/1-390-hell.png
- 390 hell/dunkel · Bild 1 · Punkt 1 · Fußzeile „Vertrag widerrufen“ wird von der unteren Leiste angeschnitten und teils verdeckt · .nachtlauf/screens/abnahme/anmelden/1-390-hell.png
- 390 hell · Bild 1/2 · Punkt 4 · Umschalter: Board hebt „Ich habe einen Hof“ hell/weiß mit Schatten hervor, App mit beigem Feld; nicht gewählte Seite in der App deutlich blasser · .nachtlauf/screens/abnahme/anmelden/1-390-hell.png
- 390 + 1440 hell · Bild 1/2/4 · Punkt 4 · Felder in der App beige gefüllt mit schwachem Rand; Board helle Felder mit deutlichem dunklem Rand · .nachtlauf/screens/abnahme/anmelden/4-1440-hell.png
- 390 + 1440 · Bild 1–4 · Punkt 1 · Feldbeschriftungen („E-Mail“, „Passwort“, „Ersatzcode“) in der App sichtbar kleiner und grauer als im Board · .nachtlauf/screens/abnahme/anmelden/2-1440-hell.png
- 390 + 1440 · Bild 3/4 · Punkt 3 · Marke „Admin“ im Kopf wirkt sehr klein (laut Manifest 11,5 px) · .nachtlauf/screens/abnahme/anmelden/3-390-hell.png

Begründete Ausnahmen gesehen:
- Recht vor Board: Fußzeile mit Impressum, Datenschutz, AGB, Problem melden und „Vertrag widerrufen“ (390 und 1440), im Board ohne „Vertrag widerrufen“.
- Fuß- und Textlinks sichtbar kleiner als 44 px (Trefferfläche über ::before).

Nicht prüfbar:
- keine (alle 16 App-Bilder erreichbar; Bild 2 mit E-Mail bauer@example.com statt der Board-Adresse, Bild 4 Ersatzcode-Block nur aufgeklappt – beides Beispieldaten bzw. Zustand wie Board)

### fehlerseiten

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 5 | 1 |
| 390 dunkel | 2 | 5 | 1 |
| 1440 hell | 2 | 5 | 1 |
| 1440 dunkel | 2 | 5 | 1 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell/dunkel · Bild 4 · Punkt 1 · 500 Kundschaft ganz ohne Shell: Kopf mit Agrilo-Logo, Fußlinks (Impressum, Datenschutz, AGB, Problem melden), Knopf „Darstellung: …“ und untere Leiste (Entdecken, Warenkorb, Bestellungen) fehlen; Inhalt senkrecht mittig statt oben unter dem Kopf · .nachtlauf/screens/abnahme/fehlerseiten/4-390-hell.png, 4-390-dunkel.png
- 1440 hell/dunkel · Bild 4 · Punkt 1 · 500 Kundschaft ohne Kopf (Logo, Hauptnavigation, Darstellung, „Anmelden“) und ohne Fußzeile; Block senkrecht mittig statt oben · .nachtlauf/screens/abnahme/fehlerseiten/4-1440-hell.png, 4-1440-dunkel.png
- 390 hell/dunkel · Bild 5 · Punkt 1 · Kopf der HofShell fehlt („Heute“ + „Hof Müller · Stand …“); Inhalt beginnt ohne Kopf · .nachtlauf/screens/abnahme/fehlerseiten/5-390-hell.png, 5-390-dunkel.png
- 390 hell/dunkel · Bild 5 · Punkt 1 · Untere Leiste: aktiv ist „Mein Hof“ statt „Heute“ (Board: „Heute“ mit hinterlegter Pille); „Neu“ als runder schwebender Knopf statt eckiger Pille in der Leiste; Beschriftung „Bestellung…“ abgeschnitten statt „Bestellungen“ · .nachtlauf/screens/abnahme/fehlerseiten/5-390-hell.png
- 1440 hell/dunkel · Bild 5 · Punkt 1 · Seitenspalte passt nicht in die Höhe: „Konto“ unten abgeschnitten, „Abmelden“ nicht sichtbar (Board zeigt Einstellungen, Problem melden, Konto, Abmelden vollständig) · .nachtlauf/screens/abnahme/fehlerseiten/5-1440-hell.png, 5-1440-dunkel.png
- 1440 hell/dunkel · Bild 5 · Punkt 1 · Aktiver Eintrag „Mein Hof“ als dunkle (hell) bzw. cremefarbene (dunkel) Vollpille statt „Heute“ in zartgrüner Hinterlegung; Einträge mit Symbolen, die das Board nicht zeigt · .nachtlauf/screens/abnahme/fehlerseiten/5-1440-hell.png
- 1440 dunkel · Bild 5 · Punkt 4 · Cremefarbene Pille „Mein Hof“ ist ein heller Fleck in der dunklen Seitenspalte · .nachtlauf/screens/abnahme/fehlerseiten/5-1440-dunkel.png
- 1440 hell/dunkel · Bild 5 · Punkt 2 · Gründungshof-Karte: „ohne Grundgebühr bis …“ statt Board „noch 11 Monate (bis …)“; Kontozeile „Konto · <Name>“ statt „Konto“ · .nachtlauf/screens/abnahme/fehlerseiten/5-1440-hell.png
- 1440 hell/dunkel · Bild 5 · Punkt 1 · Fehlerblock in der Mitte der Inhaltsfläche (x≈845) statt weiter links wie im Board (x≈680) · .nachtlauf/screens/abnahme/fehlerseiten/5-1440-hell.png
- 390/1440 hell/dunkel · Bild 3 · Punkt 2 · Erster Knopf „Zum Hof“ statt Board „Zu <Hofname>“ („Zu Hof Müller“) · .nachtlauf/screens/abnahme/fehlerseiten/3-390-hell.png, 3-1440-hell.png
- 390 hell/dunkel · Bild 1–3 · Punkt 1 · Kopf zeigt zusätzlich Knopf „Anmelden“, den das Board in der Handy-Fassung nicht zeigt · .nachtlauf/screens/abnahme/fehlerseiten/1-390-hell.png
- 390 hell/dunkel · Bild 1–3, 5 · Punkt 1 · Kopflinie und untere Leiste enden bei x≈375, rechts bleibt ein 15-px-Streifen Seitenhintergrund (Board: volle Breite) · .nachtlauf/screens/abnahme/fehlerseiten/1-390-hell.png, 5-390-hell.png
- alle Fassungen · Bild 1–5 · Punkt 4 · Zweitknopf („Höfe entdecken“, „Zur Startseite“, „Zu Heute“) mit kaum sichtbarem Rand; Board zeigt deutlich dunklen (hell) bzw. hellen (dunkel) Rahmen · .nachtlauf/screens/abnahme/fehlerseiten/1-390-dunkel.png, 4-1440-hell.png
- 1440 hell/dunkel · Bild 1–3 · Punkt 1 · Fußzeile mit zusätzlichem Agrilo-Logo links; Links ohne Unterstreichung und linke Gruppe nicht grün wie im Board · .nachtlauf/screens/abnahme/fehlerseiten/1-1440-hell.png
- 390 hell/dunkel · Bild 1–3 · Punkt 1 · Fußlinks ohne Unterstreichung (Board unterstrichen) · .nachtlauf/screens/abnahme/fehlerseiten/2-390-hell.png
- 1440 hell/dunkel · Bild 2, 3 · Punkt 1 · Überschrift bricht zweizeilig um („Diesen Hof gibt es / hier nicht (mehr)“), Board einzeilig · .nachtlauf/screens/abnahme/fehlerseiten/2-1440-hell.png, 3-1440-hell.png
- 390 hell/dunkel · Bild 1–3 · Punkt 1 · Überschrift schmaler gesetzt, Umbruch „Diese Seite gibt / es nicht (mehr)“ statt „Diese Seite gibt es nicht / (mehr)“ · .nachtlauf/screens/abnahme/fehlerseiten/1-390-hell.png
- 1440 hell/dunkel · Bild 1–3 · Punkt 1 · Kopf auf schmalen Inhaltsbereich begrenzt (Logo bei x≈137, „Anmelden“ bei x≈1290) statt volle Breite wie im Board (x≈40 bis 1400); deutlich mehr Abstand über dem Fehlerblock · .nachtlauf/screens/abnahme/fehlerseiten/1-1440-hell.png
- 390/1440 hell/dunkel · Bild 1 · Punkt 1 · Suchfeld mit Lupen-Symbol, das Board zeigt keins · .nachtlauf/screens/abnahme/fehlerseiten/1-1440-hell.png
- 1440 dunkel · Bild 1–3 · Punkt 1 · Darstellungs-Knopf zeigt Sonne, Board zeigt Mond · .nachtlauf/screens/abnahme/fehlerseiten/1-1440-dunkel.png

Begründete Ausnahmen gesehen:
- Recht vor Board: zusätzlicher Fußlink „Vertrag widerrufen“ (Bild 1–3, 390 und 1440).
- Fußlinks sichtbar kleiner als 44 px (Trefferfläche über ::before zulässig).

Nicht prüfbar:
- Bild 6 (390/1440, hell/dunkel): global-error erscheint nur, wenn das Root-Layout selbst fehlschlägt; das nutzt keine Datenbank, ohne Codeänderung nicht herstellbar

### kundenkonto

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 5 | 0 |
| 390 dunkel | 2 | 5 | 0 |
| 1440 hell | 2 | 5 | 0 |
| 1440 dunkel | 2 | 5 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 1440 hell/dunkel · Bild 4 · Punkt 5 · Startfokus im Lösch-Dialog liegt auf „Konto löschen“ statt auf „Abbrechen“ (Board: Fokusring auf „Abbrechen“) · .nachtlauf/screens/abnahme/kundenkonto/4-1440-hell.png
- 390 hell/dunkel · Bild 4 · Punkt 1 · Board zeigt ein Blatt von unten mit Griff und zwei gleich breiten Knöpfen „Abbrechen“ | „Konto löschen“ nebeneinander unten; App zeigt einen mittigen Dialog, „Abbrechen“ oben rechts neben der Überschrift, „Konto löschen“ klein links unter dem Text · .nachtlauf/screens/abnahme/kundenkonto/4-390-hell.png
- 1440 hell/dunkel · Bild 4 · Punkt 1 · Dialog-Knöpfe: Board zwei gleich breite umrandete Knöpfe nebeneinander unter dem Text; App „Abbrechen“ als randloser Textknopf oben rechts, „Konto löschen“ allein links darunter · .nachtlauf/screens/abnahme/kundenkonto/4-1440-hell.png
- 1440 hell/dunkel · Bild 5 · Punkt 1 · Board einspaltig über volle Breite (Abos, Geräte, „Überall abmelden“, kein Konto-Block); App zweispaltig mit Geräte-Karte rechts und zusätzlichem Block „Konto“ mit Löschknopf · .nachtlauf/screens/abnahme/kundenkonto/5-1440-hell.png
- 390 hell/dunkel · Bild 1+2 · Punkt 2 · h1 „Willkommen zurück“ im Board, in der App „Anmelden“; Untertitel „Kunden melden sich mit einem Code an, Höfe mit Passwort.“ fehlt · .nachtlauf/screens/abnahme/kundenkonto/1-390-hell.png
- 390 hell/dunkel · Bild 1+2 · Punkt 1 · Unter dem Segment fehlen die Kennzeile „ICH KAUFE EIN“ und die Überschrift „Mit E-Mail-Code anmelden“ · .nachtlauf/screens/abnahme/kundenkonto/1-390-hell.png
- 390 hell/dunkel · Bild 1+2 · Punkt 1 · Kopf der App hat zusätzlich den Knopf „Anmelden“ oben rechts (Board: nur Marke) · .nachtlauf/screens/abnahme/kundenkonto/1-390-hell.png
- 390 hell · Bild 1+2 · Punkt 4 · Segment-Farbwirkung umgekehrt: Board aktives Segment hell auf dunklerer Schiene, App aktives Segment dunkler beige auf heller Schiene · .nachtlauf/screens/abnahme/kundenkonto/1-390-hell.png
- 390/1440 alle · Bild 2 · Punkt 3/1 · Board: ein Feld mit sichtbarer Beschriftung „6-stelliger Code aus der E-Mail“ und Platzhalter „6 Ziffern“; App: sechs Einzelkästchen ohne sichtbare Beschriftung · .nachtlauf/screens/abnahme/kundenkonto/2-390-hell.png
- 390/1440 alle · Bild 2 · Punkt 2 · „Andere E-Mail“ statt „Andere E-Mail-Adresse“; Zusatzsatz „Er gilt 10 Minuten.“; „Code erneut senden“ und „Andere E-Mail“ nebeneinander statt untereinander zentriert · .nachtlauf/screens/abnahme/kundenkonto/2-1440-hell.png
- 390 hell/dunkel · Bild 2 · Punkt 2 · zusätzlicher Hinweis „Der Code wird beim Antippen automatisch aus der E-Mail übernommen, wenn dein Telefon das kann.“ · .nachtlauf/screens/abnahme/kundenkonto/2-390-hell.png
- 390/1440 alle · Bild 3 · Punkt 1 · Abos: Board eine Karte mit Trennlinie zwischen den Höfen; App je Hof eine eigene Karte, mit zusätzlichen Symbolen (Brief, Sprechblase), Bezeichnungen nicht fett, WhatsApp-Zeile ausgegraut · .nachtlauf/screens/abnahme/kundenkonto/3-390-hell.png
- 390/1440 alle · Bild 3+5 · Punkt 1 · Geräte: Board Kennzeile „ANGEMELDETE GERÄTE“ außerhalb, Gerätekarte, darunter eigener Knopf „Überall abmelden“; App eine Karte mit Serif-Titel „Angemeldete Geräte“, Symbol, Zähler „1“ und Knopf darin · .nachtlauf/screens/abnahme/kundenkonto/3-1440-hell.png
- 390/1440 alle · Bild 3+5 · Punkt 4 · „Überall abmelden“ im Board neutral umrandet (weiß/dunkel), in der App rot-orange getönt mit Symbol · .nachtlauf/screens/abnahme/kundenkonto/5-390-hell.png
- 1440 hell/dunkel · Bild 3+5 · Punkt 2 · zusätzlicher Link „Was wir speichern“ in der Geräte-Karte · .nachtlauf/screens/abnahme/kundenkonto/3-1440-hell.png
- 1440 hell/dunkel · Bild 3–5 · Punkt 1 · Kopf angemeldet: App mit Suchfeld „Hof oder Produkt suchen …“, ohne „So funktioniert's“ und „Für Höfe“, Rundsymbol statt Knopf „Mein Konto“ · .nachtlauf/screens/abnahme/kundenkonto/3-1440-hell.png
- 390/1440 alle · Bild 5 · Punkt 1 · Leerzustand: Board linksbündig, fette Sans-Zeile, Knopf „Höfe entdecken“ volle Breite; App mittig mit Glockensymbol, Serif-Überschrift, kleiner Pillenknopf · .nachtlauf/screens/abnahme/kundenkonto/5-390-hell.png
- 390 hell/dunkel · Bild 3+5 · Punkt 3 · Kennzeile „MEINE ABONNEMENTS“ sichtbar sehr klein (wirkt unter 12 px) · .nachtlauf/screens/abnahme/kundenkonto/3-390-hell.png
- 1440 hell/dunkel · Bild 1+2 · Punkt 1 · Überschrift „Willkommen zurück“ mittig und größer statt linksbündig über den Karten; Trennzeile „oder“ und Augen-Symbol im Passwortfeld zusätzlich; „Passwort vergessen?“ und „Noch kein Hof? Registrieren“ nebeneinander statt untereinander · .nachtlauf/screens/abnahme/kundenkonto/1-1440-hell.png
- 1440 hell/dunkel · Bild 1+2 · Punkt 2 · Platzhalter Hof-E-Mail „name@hof.at“ statt „name@beispiel.at“ · .nachtlauf/screens/abnahme/kundenkonto/1-1440-hell.png
- 1440 dunkel · Bild 1+2 · Punkt 4 · „Mit Passkey anmelden“: Board kräftiger heller Rand, App kaum sichtbarer Rand · .nachtlauf/screens/abnahme/kundenkonto/1-1440-dunkel.png
- 390/1440 alle · Bild 1–5 · Punkt 1 · Fuß: Links in der App nicht unterstrichen, im Web zusätzlich Marke im Fuß; Knöpfe als Pillen statt abgerundeter Rechtecke · .nachtlauf/screens/abnahme/kundenkonto/1-1440-hell.png
- 390 hell/dunkel · Bild 3+5 · Punkt 1 · Knopf „Abmelden“ mit zusätzlichem Symbol und deutlich breiter, Kopf-Konto-Symbol als gefüllter Kreis · .nachtlauf/screens/abnahme/kundenkonto/3-390-hell.png

Begründete Ausnahmen gesehen:
- Recht vor Board: Fußlink „Vertrag widerrufen“ zusätzlich (alle Bilder, 390 und 1440).
- Fußlinks und Segmente sichtbar kleiner als 44 px (erlaubt).

Nicht prüfbar:
- keine

### neuigkeiten

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 1 | 3 |
| 390 dunkel | 2 | 1 | 3 |
| 1440 hell | 1 | 1 | 3 |
| 1440 dunkel | 1 | 1 | 3 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- alle · Bild 4 · Punkt 6 · Der Zustand „Link abgelaufen“ ist nicht erreicht: Die App zeigt den Zustand „Link nicht gültig“ (laut Manifest mit ?token=abc). Alles Folgende vergleicht also eine andere Variante mit dem Board · .nachtlauf/screens/abnahme/neuigkeiten/4-390-hell.png
- 1440 hell · Bild 4 · Punkt 1 · Kopf anders: Im Board stehen Marke „Agrilo“ mit Logo, Trennstrich, „Anmeldung bestätigen“ (fett, serifenlos) und rechts der Link „← Zur Startseite“. In der App stehen Zurück-Pfeil und „Anmeldung bestätigen“ (Serifenschrift), Logo, Marke und „Zur Startseite“ fehlen · .nachtlauf/screens/abnahme/neuigkeiten/4-1440-hell.png
- 1440 dunkel · Bild 4 · Punkt 1 · gleicher Kopf-Unterschied wie in 1440 hell (Logo, „Agrilo“ und „← Zur Startseite“ fehlen, Zurück-Pfeil zusätzlich) · .nachtlauf/screens/abnahme/neuigkeiten/4-1440-dunkel.png
- alle · Bild 4 · Punkt 2 · h1: Board „Der Link ist abgelaufen“, App „Das hat nicht geklappt“ · .nachtlauf/screens/abnahme/neuigkeiten/4-390-hell.png
- alle · Bild 4 · Punkt 1 · Aufbau: Im Board stehen h1 frei auf der Seite, darunter ein getönter Hinweis-Kasten (Warnton) mit fetter Zeile „Er gilt 7 Tage.“ und Text, dann Knopf, dann Textlink. In der App steht alles in einer hellen Karte mit Symbol (zerbrochenes Kettenglied) links neben der h1, ohne Hinweis-Kasten und ohne die Zeile „Er gilt 7 Tage.“ · .nachtlauf/screens/abnahme/neuigkeiten/4-390-hell.png
- alle · Bild 4 · Punkt 2 · Fließtext: Board „Melde dich einfach noch einmal an – beim nächsten Einkauf oder unter „Mein Konto“. Dann schicken wir dir einen neuen Link.“. In der App steht davor zusätzlich „Dieser Link ist nicht gültig. Vielleicht wurde er beim Kopieren abgeschnitten.“ · .nachtlauf/screens/abnahme/neuigkeiten/4-390-hell.png
- alle · Bild 4 · Punkt 2 · Knopftext: Board „Mein Konto“, App „Zu „Mein Konto““ · .nachtlauf/screens/abnahme/neuigkeiten/4-390-hell.png
- alle · Bild 4 · Punkt 1 · Knopfart: Im Board ist „Mein Konto“ ein Umriss-Knopf mit kleinen Ecken. In der App ist es ein grün gefüllter Hauptknopf in Pillenform · .nachtlauf/screens/abnahme/neuigkeiten/4-390-hell.png
- alle · Bild 4 · Punkt 1 · Im Board ist „Höfe entdecken“ ein unterstrichener grüner Textlink, in der App ein Umriss-Knopf in Pillenform · .nachtlauf/screens/abnahme/neuigkeiten/4-390-hell.png
- 390 hell · Bild 4 · Punkt 1 · Kopf: Im Board ist der Kopf ein getöntes Blatt mit runden oberen Ecken und größerer Titelschrift. In der App ist der Kopf flach ohne Blattfläche, „Anmeldung bestätigen“ ist sichtbar kleiner · .nachtlauf/screens/abnahme/neuigkeiten/4-390-hell.png
- 390 dunkel · Bild 4 · Punkt 1 · gleicher Kopf-Unterschied wie in 390 hell (keine Blattfläche, kleinere Titelschrift) · .nachtlauf/screens/abnahme/neuigkeiten/4-390-dunkel.png
- 390 dunkel · Bild 4 · Punkt 4 · Der warme, gedämpfte Hinweis-Kasten aus dem Board fehlt, die Farbwirkung ist dadurch anders (nur grüner Knopf und dunkle Karte). Helle Flecken gibt es keine · .nachtlauf/screens/abnahme/neuigkeiten/4-390-dunkel.png
- 1440 hell · Bild 4 · Punkt 1 · Breite und Lage: Im Board steht der Inhalt linksbündig in einer Spalte von etwa 520 px ohne Karte. In der App steht eine mittige Karte von etwa 490 px mit Innenabstand · .nachtlauf/screens/abnahme/neuigkeiten/4-1440-hell.png
- 1440 dunkel · Bild 4 · Punkt 4 · Der warme Hinweis-Kasten des Boards fehlt. Keine hellen Flecken, die Karte ist gedämpft · .nachtlauf/screens/abnahme/neuigkeiten/4-1440-dunkel.png

Begründete Ausnahmen gesehen:
- Recht vor Board: Der Fußlink „Vertrag widerrufen“ steht in der App unter dem Inhalt (in allen vier Fassungen), obwohl das Board ihn nicht zeigt.
- Fokus 1440: Den Fokus zeigt das Board am ersten Bedienelement („Mein Konto“), die App zeigt ihn sichtbar am ersten Bedienelement („Zu „Mein Konto““). Der Fokus selbst ist also in Ordnung, nur der Knopf ist ein anderer (siehe oben).

Nicht prüfbar:
- Bild 1 (390/1440): ‚Anmeldung bestätigen‘ braucht einen gültigen signierten Link aus der Bestätigungs-Mail
- Bild 2 (390/1440): ‚Bestätigt‘ braucht einen gültigen signierten Link aus einer Mail
- Bild 3 (390/1440): ‚Schon angemeldet‘ braucht einen gültigen signierten Link und ein bereits bestätigtes Abo

### passwort

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 3 | 5 | 0 |
| 390 dunkel | 3 | 5 | 0 |
| 1440 hell | 2 | 5 | 0 |
| 1440 dunkel | 2 | 5 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 1440 hell/dunkel · Bild 1–5 · Punkt 1 · Kopf anders: Im Board steht links das Agrilo-Logo, ein Trennstrich und der Seitenname in kleiner serifenloser Schrift, rechts der Link „← Zurück zur Anmeldung“. Die App zeigt den Handy-Kopf mit Zurück-Pfeil und Serifen-Titel, ohne Logo und ohne den Link rechts · .nachtlauf/screens/abnahme/passwort/1-1440-hell.png
- 390+1440 hell/dunkel · Bild 1–5 · Punkt 1 · Die App setzt den ganzen Inhalt in eine eigene abgerundete Karte. Im Board stehen Überschrift, Felder und Knopf direkt auf der Seitenfläche, nur die Hinweis-Kästen sind gerahmt · .nachtlauf/screens/abnahme/passwort/1-390-hell.png
- 390+1440 hell/dunkel · Bild 1, 3, 4, 5 · Punkt 1 · Zusätzlicher Link „Zurück zur Anmeldung“ unter dem Knopf bzw. dem Kasten. Das Board hat ihn hier nicht (im Web nur oben rechts im Kopf, am Handy gar nicht) · .nachtlauf/screens/abnahme/passwort/3-390-hell.png
- 390+1440 hell/dunkel · Bild 2 · Punkt 1/4 · Erfolgskasten anders: Im Board ein grün getönter Kasten mit grünem Rand, gefülltem grünem Kreis mit Haken, links ausgerichtet, ein Absatz in Grün und der Link unterstrichen. Die App zeigt eine neutrale Karte mit Umriss-Symbol (Briefumschlag mit Haken), alles zentriert, den Text in zwei Absätze geteilt (der zweite kleiner und grau) und den Link ohne Unterstreichung · .nachtlauf/screens/abnahme/passwort/2-390-hell.png
- 1440 hell/dunkel · Bild 2 · Punkt 1 · „Zurück zur Anmeldung“ ist in der App eine zentrierte Pille mit Rand. Im Board ein links ausgerichteter, unterstrichener Textlink · .nachtlauf/screens/abnahme/passwort/2-1440-hell.png
- 390+1440 hell/dunkel · Bild 5 · Punkt 2 · Zusätzliche Unterzeile „Für dein Agrilo-Konto.“ unter der Überschrift; das Board zeigt im Zustand „Link abgelaufen“ keine Unterzeile · .nachtlauf/screens/abnahme/passwort/5-390-hell.png
- 390+1440 hell/dunkel · Bild 5 · Punkt 1 · Fehlerkasten anders: Die App hat ein zusätzliches Warnsymbol. Die Kastenüberschrift ist dunkel statt rostfarben wie im Board, der Fließtext ist dunkel statt rostfarben. Im Web steht der Knopf rechts neben dem Text statt in voller Breite darunter · .nachtlauf/screens/abnahme/passwort/5-1440-hell.png
- 390 hell/dunkel · Bild 5 · Punkt 1/4 · „Neuen Link anfordern“ ist schmal, pillenförmig und ohne sichtbaren Rand. Im Board ein Umriss-Knopf in voller Breite mit klarem Rand. Im Dunkeln hebt sich der Knopf kaum vom Kasten ab · .nachtlauf/screens/abnahme/passwort/5-390-dunkel.png
- 390+1440 hell/dunkel · Bild 4 · Punkt 4 · Die Fehlerfarbe ist in der App rot (Rand und Meldung „Die Passwörter stimmen nicht überein.“). Im Board ist sie rost/terrakotta, der Rand dicker · .nachtlauf/screens/abnahme/passwort/4-390-hell.png
- 390+1440 hell/dunkel · Bild 4 · Punkt 1 · „Passwort speichern“ ist in der App ausgegraut bzw. gedämpft (im Dunkeln braun mit wenig Kontrast). Im Board ist der Knopf im Fehlerzustand voll orange und aktiv · .nachtlauf/screens/abnahme/passwort/4-390-dunkel.png
- 1440 hell/dunkel · Bild 4 · Punkt 5 · Im Board liegt der Fokus auf dem fehlerhaften Feld „Passwort wiederholen“, in der App auf „Neues Passwort“ · .nachtlauf/screens/abnahme/passwort/4-1440-hell.png
- 390+1440 hell/dunkel · Bild 3 · Punkt 6 · Zustand nicht gleich gezeigt: Im Board sind beide Felder gefüllt, alle vier Regeln grün abgehakt und der Knopf aktiv. Die App zeigt leere Felder, graue Kreise statt Haken und einen ausgegrauten Knopf, deshalb lassen sich Regelliste und Knopf nicht vergleichen · .nachtlauf/screens/abnahme/passwort/3-1440-hell.png
- 390+1440 hell/dunkel · Bild 3, 4 · Punkt 1 · Zusätzlicher Augen-Knopf (Passwort zeigen) in beiden Passwortfeldern, das Board hat keinen. Platzhalter „Mindestens 8 Zeichen“ im ersten Feld · .nachtlauf/screens/abnahme/passwort/4-390-hell.png
- 390+1440 hell/dunkel · Bild 1, 3, 4 · Punkt 1/4 · Felder sind grau gefüllt mit schwachem Rand. Im Board sind sie hell (Kartenfläche) mit deutlichem dunklem Rand. Feldbeschriftungen („E-Mail“, „Neues Passwort“) sind in der App kleiner und grau statt dunkel und fett · .nachtlauf/screens/abnahme/passwort/1-390-hell.png
- 390+1440 hell/dunkel · Bild 1, 3, 4 · Punkt 1 · Hauptknopf („Link anfordern“, „Passwort speichern“) ist pillenförmig mit dunklerem Rand. Im Board ist er ein Rechteck mit mäßiger Rundung, ohne Rand · .nachtlauf/screens/abnahme/passwort/1-1440-hell.png
- 390 hell/dunkel · Bild 1–5 · Punkt 1 · Der Kopftitel ist in der App kleiner als im Board, und die Trennlinie unter dem Kopf endet rechts etwa 15 px vor dem Bildrand · .nachtlauf/screens/abnahme/passwort/2-390-hell.png

Begründete Ausnahmen gesehen:
- Recht vor Board: Fußlink „Vertrag widerrufen“ unter dem Inhalt, in allen Bildern und Fassungen.

Nicht prüfbar:
- keine

### rechtstexte

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 3 | 6 | 0 |
| 390 dunkel | 3 | 6 | 0 |
| 1440 hell | 3 | 6 | 0 |
| 1440 dunkel | 3 | 6 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- alle Fassungen · Bild 4 · Punkt 1 · Impressum-Kopf anders: Board zeigt Overline „RECHTLICHES“ + h1 + Unterzeile „Angaben gemäß § 5 ECG (Österreich) · Stand …“ + Marke; App hat keine Overline, die Unterzeile ist eine eigene Zwischenüberschrift (h2-Größe) · .nachtlauf/screens/abnahme/rechtstexte/4-390-hell.png
- alle Fassungen · Bild 4 · Punkt 1 · Board zeigt die Angaben als Karte mit Zeilen (Betreiber, Anschrift, E-Mail, UID-Nummer, Firmenbuch, Aufsichtsbehörde; Bezeichnung links, Wert rechts); App zeigt Fließtext „Betreiber der Plattform:“ mit Zeilen darunter, keine Karte, keine Zeilen UID/Firmenbuch/Aufsichtsbehörde (ob die Felder fehlen dürfen, ist Rechtsfrage; die Karte selbst ist Rahmen) · .nachtlauf/screens/abnahme/rechtstexte/4-1440-hell.png
- alle Fassungen · Bild 4 · Punkt 1 · zusätzlicher Warnkasten „Pilotbetrieb — …“ mit Warndreieck über den Angaben, im Board nicht vorhanden (falls rechtlich verlangt: als Recht vor Board begründen) · .nachtlauf/screens/abnahme/rechtstexte/4-390-dunkel.png
- alle Fassungen · Bild 1–6 · Punkt 1 · Marke „Entwurf, Anwältin prüft“ neben/unter der Stand-Zeile fehlt auf AGB, Datenschutz, Impressum und Konditionen (App: bei AGB nur „Entwurf“ im Fließtext der Fassungszeile, sonst gar nicht) · .nachtlauf/screens/abnahme/rechtstexte/1-390-hell.png
- alle Fassungen · Bild 5 · Punkt 1 · Karte „Aktion 12 Gründungshöfe“ unter den Tarif-Karten fehlt; in der App folgt direkt der Abschnitt „Servicegebühr und Abrechnung“ · .nachtlauf/screens/abnahme/rechtstexte/5-390-hell.png
- 1440 hell/dunkel · Bild 4, 5, 6 · Punkt 1 · Inhalt steht in einer schmalen, mittig gesetzten Spalte (ab ca. x=392); im Board bündig links am Seitenraster (x=221, gleiche Kante wie Fußzeile) · .nachtlauf/screens/abnahme/rechtstexte/4-1440-hell.png
- alle Fassungen · Bild 6 · Punkt 1 · „So läuft die Aufnahme“: Board schlichte nummerierte Liste (1.–3.), App Schrittliste mit eingekreisten Ziffern, fett gesetztem Titel und Beschreibung je Schritt · .nachtlauf/screens/abnahme/rechtstexte/6-1440-hell.png
- alle Fassungen · Bild 6 · Punkt 3 · Knopf „Hof registrieren“ sichtbar kleiner (App ca. 44 px hoch, ca. 14 px Schrift; Board 390 ca. 50 px / 1440 ca. 56 px hoch, 16 px fett) · .nachtlauf/screens/abnahme/rechtstexte/6-390-hell.png
- alle Fassungen · Bild 5 · Punkt 3 · Tarif-Karten: Titel „Hoftor“/„Hofladen“ und Preis sichtbar kleiner als im Board (App ca. 17 px, Board ca. 20 px), Karten mit deutlich runderen Ecken · .nachtlauf/screens/abnahme/rechtstexte/5-390-hell.png
- 1440 hell/dunkel · Bild 1, 2, 3 · Punkt 6 · aktiver Eintrag im Verzeichnis nicht hervorgehoben: Board zeigt den gewählten/aktuellen Punkt grün und fett („8. …“, „15. …“, „14. …“); in der App ist kein Eintrag markiert, bei #punkt-17 ist der Eintrag nicht einmal im sichtbaren Teil des Verzeichnisses (Liste endet bei 13, scrollt nicht mit) · .nachtlauf/screens/abnahme/rechtstexte/2-1440-hell.png
- 1440 hell/dunkel · Bild 1, 3 · Punkt 5 · Startfokus: Board zeigt ihn am ersten Verzeichnis-Eintrag („Kurz erklärt“ bzw. „1. Verantwortliche Stelle“), App auf „Drucken/Speichern“ – Verzeichnis kommt in der Tab-Reihenfolge erst nach dem Kopf des Textes · .nachtlauf/screens/abnahme/rechtstexte/1-1440-hell.png
- 1440 hell/dunkel · Bild 4, 5 · Punkt 5 · Startfokus: Board am ersten Kopf-Link „Höfe entdecken“, App im Inhalt (E-Mail-Link bzw. „Hof registrieren“); bei Bild 5 scrollt die Seite dadurch weg vom Tarif-Teil, Board-Zustand „Tarife und Aktion“ ist im App-Bild nicht zu sehen · .nachtlauf/screens/abnahme/rechtstexte/5-1440-hell.png
- 1440 hell/dunkel · Bild 1, 2 · Punkt 1 · Textspalte schmaler als im Board (ca. 640 statt 715 px), h1 „Allgemeine Geschäftsbedingungen (AGB) von Agrilo“ bricht auf zwei Zeilen um, Board einzeilig · .nachtlauf/screens/abnahme/rechtstexte/1-1440-hell.png
- 1440 hell/dunkel · Bild 5, 6 · Punkt 1 · Fußzeile anders: App mit Logo links und Links ohne Unterstreichung in Grau; Board ohne Logo, Links unterstrichen (links grün, rechts gedämpft) · .nachtlauf/screens/abnahme/rechtstexte/6-1440-dunkel.png
- 390 hell/dunkel · Bild 6 · Punkt 1 · Fußlinks am Handy ohne Unterstreichung, Board unterstrichen · .nachtlauf/screens/abnahme/rechtstexte/6-390-hell.png
- alle Fassungen · Bild 1–6 · Punkt 4 · Fließtext in der App gedämpft grau (nur Fettes in Vordergrundfarbe), im Board volle Vordergrundfarbe – sichtbar andere Farbwirkung, v. a. Datenschutz, Impressum, Konditionen · .nachtlauf/screens/abnahme/rechtstexte/3-1440-hell.png
- 390 hell/dunkel · Bild 1–6 · Punkt 1 · Kopf am Handy mit Knopf „Anmelden“ rechts; Board-Kopf zeigt nur das Logo · .nachtlauf/screens/abnahme/rechtstexte/1-390-hell.png
- 1440 dunkel · Bild 1–6 · Punkt 1 · Theme-Knopf zeigt im Dunkeln eine Sonne, Board zeigt in beiden Themes den Mond · .nachtlauf/screens/abnahme/rechtstexte/1-1440-dunkel.png
- alle Fassungen · Bild 1, 3 · Punkt 1 · Knopf „Drucken/Speichern“ mit zusätzlichem Drucker-Symbol; Verzeichnis-Knopf am Handy mit Chevron statt ▼, deutlich rundere Ecken · .nachtlauf/screens/abnahme/rechtstexte/3-390-hell.png

Begründete Ausnahmen gesehen:
- Recht vor Board: Wortlaut, Anzahl und Nummerierung der Punkte in AGB („29 Punkte“, Punkt 17 statt 15), Datenschutz (14 statt 15 Abschnitte, teils unnummerierte Abschnitte im Verzeichnis), Konditionen („€ 19 / Monat“, Servicegebühr-Abschnitt, Einleitungssatz zur Startphase) und Impressum (Betreiberangaben, Abschnitte „Haftungsausschluss“, „Urheberrecht“); Fassungs- und Standangaben.
- Recht vor Board: Link „Vertrag widerrufen“ in der Fußzeile (Bild 5/6).
- Fußlinks und Textlinks (z. B. „Impressum“, „kontakt@…“ im AGB-Text, „Fragen vorab? Schreib uns.“) kleiner als 44 px – zulässig.
- Bild 2 Handy: App-Bild zeigt den angesprungenen Punkt 17 statt des Seitenkopfs; der Board-Zustand „Inhalt zu“ ist im App-Bild 1 sichtbar und entspricht dem Board (Aufnahmeausschnitt, keine Abweichung).
- Bild 6 1440: App-Bild ohne Fokusring (ans Ende gescrollt); der Fokus auf „Hof registrieren“ ist im App-Bild 5 sichtbar und gleich.

Nicht prüfbar:
- keine

### registrieren

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 4 | 2 |
| 390 dunkel | 2 | 4 | 2 |
| 1440 hell | 2 | 4 | 2 |
| 1440 dunkel | 2 | 4 | 2 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390+1440 hell/dunkel · Bild 3 · Punkt 6/2 · Board-Zustand „nach der Registrierung“ nicht gezeigt: Im Board stehen „Wir haben dir einen Link an <E-Mail> geschickt …“, „Einrichten kannst du deinen Hof schon jetzt …“, Knopf „Weiter zum Einrichten“, „E-Mail erneut senden (45 s)“ und der Spam-Hinweis. Die App zeigt eine andere Fassung: „Öffne den Link aus unserer E-Mail …“, „Du findest die E-Mail nicht mehr? Melde dich an …“, Knopf „Anmelden“ · .nachtlauf/screens/abnahme/registrieren/3-390-hell.png, 3-1440-hell.png
- 390+1440 hell/dunkel · Bild 3 · Punkt 1 · Inhalt steht in der App in einer Karte mit Brief-Symbol vor der Überschrift; im Board ohne Karte und ohne Symbol · .nachtlauf/screens/abnahme/registrieren/3-1440-hell.png
- 1440 hell/dunkel · Bild 1 · Punkt 1 · Kopf anders: Board mit Agrilo-Marke, Trennstrich, „Hof registrieren“ und rechts dem Link „← Zurück zu Für Höfe“; App mit Zurück-Pfeil, „Hof registrieren“ in Serifenschrift und rechts „Schon dabei?“ und Knopf „Anmelden“ · .nachtlauf/screens/abnahme/registrieren/1-1440-hell.png
- 1440 hell/dunkel · Bild 3 · Punkt 1 · Kopf anders: Board mit Agrilo-Marke, „E-Mail bestätigen“ und dem Link „← Zur Startseite“; App nur mit Zurück-Pfeil und Titel, ohne Marke und ohne Link · .nachtlauf/screens/abnahme/registrieren/3-1440-hell.png
- 390+1440 hell/dunkel · Bild 1 · Punkt 1/2 · Hinweis-Kasten mit Stern „Gründungshöfe zahlen 12 Monate keine Grundgebühr – auch im Hofladen. Noch 8 von 12 Plätzen, Zusage mit der Freischaltung.“ fehlt; die App zeigt stattdessen Fließtext ohne Kasten „In der Startphase kostenlos. Die Tarife gelten ab 1. Februar 2027. …“ (falls das der N39-Wortlaut ist, ist nur der fehlende Kasten eine Abweichung; vom Prüfer nicht feststellbar) · .nachtlauf/screens/abnahme/registrieren/1-390-hell.png
- 1440 hell/dunkel · Bild 1 · Punkt 5 · Das Board zeigt den Fokus am ersten Feld „Name deines Hofs“ (dicker grüner Ring); in der App ist kein Fokus zu sehen · .nachtlauf/screens/abnahme/registrieren/1-1440-hell.png
- 1440 hell/dunkel · Bild 1 · Punkt 1 · Seitenspalte „So geht’s weiter“: Im Board ist sie eine Karte mit Serifen-Überschrift, grün gefüllten Ziffern und dem Knopf „E-Mail schreiben“ in derselben Karte; die App zeigt eine Überzeile in Großbuchstaben ohne Karte, orange umrandete Ziffern und eine eigene Karte für „Fragen vorab?“ mit hellem Knopf und Brief-Symbol · .nachtlauf/screens/abnahme/registrieren/1-1440-hell.png
- 1440 hell/dunkel · Bild 1 · Punkt 2 · Schritt 3: Board „mit Stripe, etwa 10 Minuten; für SEPA ist jetzt nichts zu tun“, App „über Stripe, etwa 10 Minuten – gehört zum Start; für SEPA ist jetzt nichts zu tun“ · .nachtlauf/screens/abnahme/registrieren/1-1440-hell.png
- 390+1440 hell/dunkel · Bild 1 · Punkt 1 · Das Formular steht in der App in einer umrandeten Karte; im Board liegt es direkt auf der Seite · .nachtlauf/screens/abnahme/registrieren/1-390-hell.png
- 390 hell/dunkel · Bild 1 · Punkt 1 · Im Kopf ein zusätzlicher Knopf „Anmelden“ (fehlt im Board); „Schon dabei? Anmelden“ unter dem Kaufknopf ist im App-Bild nicht zu sehen · .nachtlauf/screens/abnahme/registrieren/1-390-hell.png
- 390+1440 hell/dunkel · Bild 1 · Punkt 2 · Hilfetext: Board „Deine Adresse wird: agrilo.at/hof-am-moos“, App „Wird zu deiner Adresse: agrilo.at/hof-am-moos“ · .nachtlauf/screens/abnahme/registrieren/1-390-hell.png
- 390+1440 hell/dunkel · Bild 1 · Punkt 1 · Zusätzliches Augen-Symbol (Passwort zeigen) im Passwortfeld; das Board zeigt es nicht · .nachtlauf/screens/abnahme/registrieren/1-390-hell.png
- 1440 hell/dunkel · Bild 1 · Punkt 1/2 · „Schon dabei? Anmelden“: Im Board ist das ein einziger Link, linksbündig; in der App steht es mittig und nur „Anmelden“ ist Link · .nachtlauf/screens/abnahme/registrieren/1-1440-hell.png
- 390 hell/dunkel · Bild 5 · Punkt 1 · Kopfleiste fehlt: Board mit Zurück-Pfeil, „Hof einrichten“ und Unterzeile „<Hof> · Stand Mittwoch, 3. März 2027“; die App beginnt direkt mit der h1 „Hof einrichten“ und dem Hofnamen, ohne Pfeil und ohne Stand-Datum · .nachtlauf/screens/abnahme/registrieren/5-390-hell.png
- 1440 hell/dunkel · Bild 5/6 · Punkt 1 · Der Link „← Zurück“ über der h1 „Hof einrichten“ fehlt · .nachtlauf/screens/abnahme/registrieren/5-1440-hell.png
- 390+1440 hell/dunkel · Bild 5 · Punkt 1 · Zusätzliche Karte „AGB bestätigen“ mit den Knöpfen „AGB lesen“ und „Ich stimme den AGB zu“ zwischen Begrüßung und Fortschritt; das Board hat sie nicht, und sie steht auch nicht auf der Liste der Pflichtkarten · .nachtlauf/screens/abnahme/registrieren/5-390-hell.png
- 390+1440 hell/dunkel · Bild 5 · Punkt 1/2 · Hinweis „Richte deinen Hof fertig ein …“: Die App zeigt zusätzlich ein Uhr-Symbol, die Zeile „Deine Hof-ID: …“ und den Zusatz „– die Hof-ID ist in der Nachricht schon eingetragen.“; die Überschrift ist neutral statt akzentfarben (im Dunkeln weiß statt orange) · .nachtlauf/screens/abnahme/registrieren/5-1440-hell.png
- 390+1440 hell/dunkel · Bild 5/6 · Punkt 1 · Schritt-Symbole: Board mit Häkchen bzw. leerem Kreis bzw. „i“ für Lastschrift; App mit nummerierten Kreisen (2, 4, 5, 6). Der Knopf „Weiter“ ist in der App hell umrandet statt orange gefüllt · .nachtlauf/screens/abnahme/registrieren/5-1440-hell.png
- 1440 hell/dunkel · Bild 5/6 · Punkt 1 · Seitenspalte der Navigation: Die App hat Symbole vor jedem Eintrag und die zusätzliche Karte „Startphase: kostenlos · bis 31. Jänner 2027“; „Konto“ steht als „Konto · <Name>“; „Abmelden“ ist im Bild nicht zu sehen · .nachtlauf/screens/abnahme/registrieren/5-1440-hell.png
- 1440 hell/dunkel · Bild 5 · Punkt 1 · Der Inhaltsbereich ist in der App deutlich breiter (Hinweis und Seitenspalte bis etwa 1390 px statt bis etwa 1195 px im Board) · .nachtlauf/screens/abnahme/registrieren/5-1440-hell.png
- 1440 hell/dunkel · Bild 5/6 · Punkt 2 · Karte „Tarife“: Board „Die Plattformgebühr (6 %) steckt im Preis, den die Kundin zahlt – online wie bar.“, App „In der Startphase kostenlos. … Die Servicegebühr zahlt der Kunde – du behältst den vollen Warenpreis.“ (falls das der N39-Wortlaut ist, begründet; vom Prüfer nicht feststellbar). „Konditionen ansehen“ ist fett statt unterstrichen, „E-Mail schreiben“ hell mit Symbol statt dunkel umrandet · .nachtlauf/screens/abnahme/registrieren/5-1440-hell.png
- 390 hell/dunkel · Bild 5/6 · Punkt 1/2 · Untere Leiste: „Bestellungen“ ist in der App auf „Bestellung…“ gekürzt; „Neu“ ist ein runder, erhöhter Knopf statt der orangen Pille in der Leiste; der aktive Eintrag „Mehr“ ist nicht hervorgehoben · .nachtlauf/screens/abnahme/registrieren/5-390-hell.png
- 390+1440 hell/dunkel · Bild 5 · Punkt 2 · Board „Willkommen“, App „Willkommen, <Vorname>“ · .nachtlauf/screens/abnahme/registrieren/5-390-hell.png
- 390+1440 hell/dunkel · Bild 6 · Punkt 6 · Board-Zustand „Dein Hof wird noch geprüft“ mit „4 von 5 Schritten“ und „wartet auf uns“ wird nicht gezeigt (laut Manifest Seed-Stand mit offener Online-Zahlung); in 1440 ist dadurch auch der Fokus am ersten Bedienelement nicht zu sehen. Feste Texte weichen ab: Lastschrift Board „gibt es bei dir kein …“ / „brauchst du es nicht“, App „gibt es bei dir ab dem Einzug kein …“ / „brauchst du sie nicht“; „Lastschrift einrichten“ fett statt unterstrichen · .nachtlauf/screens/abnahme/registrieren/6-1440-hell.png

Begründete Ausnahmen gesehen:
- Recht vor Board: Fußlink „Vertrag widerrufen“ auf /verify (Bild 3, 390 und 1440), im Board nicht gezeigt.
- Register vor Board: Pflichtkarte Lastschrift als eigener Schritt in der Liste (Bild 5/6) – entspricht dem Board.

Nicht prüfbar:
- Bild 2 (390/1440): Variante G1 ‚mit Willkommenszeit‘ ist ein offener Vorschlag und nicht gebaut; die App zeigt den Text von Bild 1
- Bild 4 (390/1440): ‚E-Mail bestätigt‘ braucht den Bestätigungs-Link aus der Mail an einen frisch registrierten Hof; Tokens werden nicht selbst erzeugt

### systemseiten

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 3 | 1 | 4 |
| 390 dunkel | 3 | 1 | 4 |
| 1440 hell | 3 | 1 | 4 |
| 1440 dunkel | 3 | 1 | 4 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell · Bild 5 · Punkt 1 · Handlung „Zur Anmeldung“: Board zeigt einen umrandeten Knopf über die volle Kartenbreite, App zeigt nur einen grünen Textlink links unter dem Text · .nachtlauf/screens/abnahme/systemseiten/5-390-hell.png
- 390 dunkel · Bild 5 · Punkt 1 · wie hell: Board-Knopf „Zur Anmeldung“ in voller Breite mit Rahmen, App nur grüner Textlink · .nachtlauf/screens/abnahme/systemseiten/5-390-dunkel.png
- 1440 hell · Bild 5 · Punkt 1 · Board zeigt „Zur Anmeldung“ als Knopf über die volle Kartenbreite (mit Fokusrahmen), App als kleinen Textlink, der Fokusring liegt nur eng um den Link · .nachtlauf/screens/abnahme/systemseiten/5-1440-hell.png
- 1440 dunkel · Bild 5 · Punkt 1 · wie hell: Knopf in voller Breite im Board, Textlink mit kleinem Fokusring in der App · .nachtlauf/screens/abnahme/systemseiten/5-1440-dunkel.png
- 390 hell · Bild 5 · Punkt 1 · Kopf: Board zeigt nur Logo „Agrilo“, App hat zusätzlich den Knopf „Anmelden“ rechts im Kopf · .nachtlauf/screens/abnahme/systemseiten/5-390-hell.png
- 390 dunkel · Bild 5 · Punkt 1 · Kopf: zusätzlicher Knopf „Anmelden“ in der App, im Board nicht vorhanden · .nachtlauf/screens/abnahme/systemseiten/5-390-dunkel.png
- 1440 hell · Bild 5 · Punkt 1 · Lage der Karte: Board setzt die Karte linksbündig an die Inhaltsspalte (gleiche linke Kante wie der Fuß, etwa 520 px breit), App zentriert eine schmalere Karte (etwa 450 px) · .nachtlauf/screens/abnahme/systemseiten/5-1440-hell.png
- 1440 dunkel · Bild 5 · Punkt 1 · Karte zentriert und schmaler statt linksbündig an der Inhaltsspalte wie im Board · .nachtlauf/screens/abnahme/systemseiten/5-1440-dunkel.png
- 390 hell · Bild 5 · Punkt 1 · zusätzliches Warndreieck-Symbol über der Überschrift in der Karte, im Board nicht vorhanden · .nachtlauf/screens/abnahme/systemseiten/5-390-hell.png
- 390 dunkel · Bild 5 · Punkt 1 · zusätzliches Warndreieck-Symbol über der Überschrift · .nachtlauf/screens/abnahme/systemseiten/5-390-dunkel.png
- 1440 hell · Bild 5 · Punkt 1 · zusätzliches Warndreieck-Symbol über der Überschrift · .nachtlauf/screens/abnahme/systemseiten/5-1440-hell.png
- 1440 dunkel · Bild 5 · Punkt 1 · zusätzliches Warndreieck-Symbol über der Überschrift · .nachtlauf/screens/abnahme/systemseiten/5-1440-dunkel.png
- 390 hell · Bild 5 · Punkt 4 · Überschrift „Dieser Link gilt nicht mehr.“: Board in Warnfarbe (rostrot) und kleiner, einzeilig; App in Textschwarz, deutlich größer, zweizeilig · .nachtlauf/screens/abnahme/systemseiten/5-390-hell.png
- 390 dunkel · Bild 5 · Punkt 4 · Überschrift im Board in Warnfarbe (helles Orange), in der App hellweiß und größer, zweizeilig · .nachtlauf/screens/abnahme/systemseiten/5-390-dunkel.png
- 1440 hell · Bild 5 · Punkt 4 · Überschrift im Board rostrot, in der App schwarz und größer · .nachtlauf/screens/abnahme/systemseiten/5-1440-hell.png
- 1440 dunkel · Bild 5 · Punkt 4 · Überschrift im Board orange, in der App hellweiß und größer · .nachtlauf/screens/abnahme/systemseiten/5-1440-dunkel.png
- 1440 hell · Bild 5 · Punkt 1 · Fuß: App zeigt links zusätzlich das Logo „Agrilo“ und eine Trennlinie über die ganze Fensterbreite; Board hat kein Logo im Fuß, Linie nur über die Inhaltsspalte · .nachtlauf/screens/abnahme/systemseiten/5-1440-hell.png
- 1440 dunkel · Bild 5 · Punkt 1 · Fuß mit zusätzlichem Logo und Linie über volle Breite · .nachtlauf/screens/abnahme/systemseiten/5-1440-dunkel.png
- 390 hell · Bild 5 · Punkt 4 · Fußlinks im Board unterstrichen und in Linkfarbe, in der App ohne Unterstreichung in Grau; Fließtext der Karte in der App grau statt Textschwarz wie im Board · .nachtlauf/screens/abnahme/systemseiten/5-390-hell.png
- 390 dunkel · Bild 5 · Punkt 4 · Fußlinks ohne Unterstreichung, Kartentext grau statt hell wie im Board · .nachtlauf/screens/abnahme/systemseiten/5-390-dunkel.png
- 1440 hell · Bild 5 · Punkt 4 · Fußlinks im Board unterstrichen und grün, in der App grau ohne Unterstreichung; Kartentext grau statt Textschwarz · .nachtlauf/screens/abnahme/systemseiten/5-1440-hell.png
- 1440 dunkel · Bild 5 · Punkt 4 · Fußlinks im Board unterstrichen und grün, in der App grau ohne Unterstreichung · .nachtlauf/screens/abnahme/systemseiten/5-1440-dunkel.png
- 1440 hell · Bild 5 · Punkt 1 · Kopfinhalt in der App auf eine mittige Spalte begrenzt (Logo bei etwa 137 px, „Anmelden“ endet bei etwa 1290 px), im Board über die volle Breite (Logo bei etwa 41 px, „Anmelden“ bis etwa 1400 px); Kopf in der App niedriger · .nachtlauf/screens/abnahme/systemseiten/5-1440-hell.png
- 1440 dunkel · Bild 5 · Punkt 1 · Darstellungsknopf im Kopf zeigt in der App die Sonne, im Board den Mond; Kopfinhalt wie hell auf mittige Spalte begrenzt · .nachtlauf/screens/abnahme/systemseiten/5-1440-dunkel.png

Begründete Ausnahmen gesehen:
- Recht vor Board: Fußlink „Vertrag widerrufen“ steht in der App zusätzlich (390 und 1440, hell und dunkel), im Board fehlt er.
- Fußlinks (390) sichtbar kleiner als 44 px; erlaubt (Trefferfläche über ::before), laut Messung keine Ziele unter 44 px.

Nicht prüfbar:
- Bild 1 (390/1440): braucht den signierten Link ‚Neue Anmelde-Adresse bestätigen‘ aus einer Mail
- Bild 2 (390/1440): braucht gültigen Link aus Mail (/konto/email-bestaetigen)
- Bild 3 (390/1440): ‚Das war ich nicht‘ braucht den signierten Link aus der Mail ‚Neue Anmeldung‘
- Bild 4 (390/1440): braucht gültigen Link und die Aktion ‚Alle Geräte abmelden‘ danach

### widerruf

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 3 | 4 | 2 |
| 390 dunkel | 3 | 4 | 2 |
| 1440 hell | 3 | 4 | 2 |
| 1440 dunkel | 3 | 4 | 2 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- alle · Bild 2 · Punkt 1/2 · Board: ein Textfeld „Welche Artikel?“ (Inhalt „Die ganze Bestellung“); App: Auswahl mit zwei Optionen unter „Wovon möchtest du zurücktreten?“ („Die ganze Bestellung“ / „Einzelne Artikel“) – anderes Bedienelement, andere Überschrift · .nachtlauf/screens/abnahme/widerruf/2-390-hell.png
- alle · Bild 2 · Punkt 1 · Zusätzliches Feld „Nachricht an den Hof (freiwillig)“, das das Board nicht zeigt · .nachtlauf/screens/abnahme/widerruf/2-1440-hell.png
- alle · Bild 2 · Punkt 2 · Zusätzlicher Hinweis unter der E-Mail „An diese Adresse schicken wir die Eingangsbestätigung.“ (Board: kein Hinweis) · .nachtlauf/screens/abnahme/widerruf/2-390-dunkel.png
- alle · Bild 2 · Punkt 3 · Feldbeschriftungen („Dein Name“, „Deine E-Mail-Adresse“, „Bestellnummer“) in der App kleiner und grau statt kräftig dunkel wie im Board; Felder flächig ohne sichtbaren Rand (Board: heller Grund mit deutlichem Rand) · .nachtlauf/screens/abnahme/widerruf/2-1440-dunkel.png
- 1440 hell/dunkel · Bild 2 · Punkt 1 · Feld „Bestellnummer“ nur halb so breit wie die anderen Felder; im Board volle Breite · .nachtlauf/screens/abnahme/widerruf/2-1440-hell.png
- alle · Bild 4 · Punkt 1 · App behält Seitenkopf „Rücktrittsrecht“ samt Einleitung über der Erfolgskarte; im Board beginnt die Seite direkt mit der Karte · .nachtlauf/screens/abnahme/widerruf/4-1440-hell.png
- alle · Bild 4 · Punkt 2 · Liste der nächsten Schritte mit anderem Wortlaut: Board „Hof Müller bekommt deinen Rücktritt sofort.“ / „Der Hof prüft ihn und meldet sich bei dir.“ / „Ist die Rückgabe bestätigt, kommt das Geld auf demselben Weg zurück.“; App „Der Hof, bei dem du bestellt hast, ist dein Vertragspartner. Wir leiten deinen Rücktritt an ihn weiter.“ / „Hast du noch nicht abgeholt, wird die Bestellung storniert; …“ / „Hast du die Ware schon abgeholt, bring sie bitte innerhalb von 14 Tagen zum Hof zurück. …“ · .nachtlauf/screens/abnahme/widerruf/4-390-hell.png
- alle · Bild 4 · Punkt 1 · Zusätzliche Zeilen „Bestellung“, „Was“, „Name“, „Eingangsbestätigung an“ in der Erfolgskarte; Board zeigt nach der Liste direkt „Drucken oder speichern“ · .nachtlauf/screens/abnahme/widerruf/4-1440-dunkel.png
- 390 hell/1440 hell · Bild 4 · Punkt 4 · Erfolgskarte grau-grün statt hellem Mintgrün mit grüner Schrift wie im Board; graue Beschriftungen („Bestellung“ usw.) auf dieser Fläche sichtbar kontrastschwach · .nachtlauf/screens/abnahme/widerruf/4-1440-hell.png
- 390 dunkel/1440 dunkel · Bild 4 · Punkt 4 · Erfolgskarte neutral dunkel; im Board deutlich dunkelgrün getönt (Erfolgsfläche) · .nachtlauf/screens/abnahme/widerruf/4-390-dunkel.png
- alle · Bild 4 · Punkt 1/3 · Knopf „Drucken oder speichern“ mit zusätzlichem Drucker-Symbol und normaler statt fetter Schrift · .nachtlauf/screens/abnahme/widerruf/4-1440-hell.png
- alle · Bild 4 · Punkt 2 · Zeitangabe ohne Wochentag und mit „Uhr“ („am 5. November 2026, 21:44 Uhr.“), Board „am Mi, 3. März 2027, 19:40.“ · .nachtlauf/screens/abnahme/widerruf/4-390-dunkel.png
- alle · Bild 3/6 · Punkt 3 · Knopf „Zurück“ in normaler Schrift mit kaum sichtbarem Rand (im Dunkeln fast unsichtbar) und Pillenform; im Board fett mit kräftigem Rand und weniger runden Ecken · .nachtlauf/screens/abnahme/widerruf/6-390-dunkel.png
- alle · Bild 3/6 · Punkt 3 · Hauptknopf und „Zurück“ niedriger und in kleinerer Schrift als im Board · .nachtlauf/screens/abnahme/widerruf/3-1440-hell.png
- 1440 hell/dunkel · Bild 2/3/4/6 · Punkt 1 · Inhaltsspalte mittig (ab ca. 410 px) statt linksbündig im Seitenraster (ab ca. 220 px) wie im Board; Kopfzeile ebenfalls eingerückt (Logo bei ca. 137 px statt 41 px) · .nachtlauf/screens/abnahme/widerruf/3-1440-dunkel.png
- 390 hell/dunkel · Bild 2/3/4/6 · Punkt 1 · Zusätzlicher Knopf „Anmelden“ im Handy-Kopf; Board zeigt dort nur das Logo · .nachtlauf/screens/abnahme/widerruf/3-390-hell.png
- 1440 dunkel · Bild 2/3/4/6 · Punkt 1 · Darstellungs-Knopf im Kopf zeigt im Dunkeln eine Sonne; Board zeigt den Mond · .nachtlauf/screens/abnahme/widerruf/6-1440-dunkel.png
- alle · Bild 3/4/6 · Punkt 1 · Karten und Hinweis-Kasten mit deutlich größeren Eckenradien als im Board · .nachtlauf/screens/abnahme/widerruf/6-1440-hell.png
- 390 hell/dunkel · Bild 2/3/4/6 · Punkt 1 · Warenkorb-Symbol in der unteren Leiste ist ein Korb statt der Tasche aus dem Board; Beschriftungen der Leiste kleiner und grauer · .nachtlauf/screens/abnahme/widerruf/4-390-hell.png

Begründete Ausnahmen gesehen:
- Recht vor Board: Knopf „Vertrag widerrufen“ statt „Weiter zur Prüfung“ (Bild 2), „Widerruf bestätigen“ statt „Rücktritt bestätigen“ (Bild 3, 6, auch im Fehlertext „tipp bitte noch einmal auf „Widerruf bestätigen““).
- Recht vor Board: Belehrung „Teil A – Widerrufsbelehrung“ unter der Karte (Bild 3, 4, 6), wo das Board die Fußlinks zeigt.
- Beispieldaten (leere Felder in Bild 2, erfundene Bestellnummer ohne „bei Hof Müller“ und ohne Artikelliste, Namen, E-Mail, Datum) nicht als Abweichung gewertet.

Nicht prüfbar:
- Bild 1 (390/1440): ‚Schritt 1 mit signiertem Link‘ braucht einen signierten Rücktrittslink aus der Bestellmail
- Bild 5 (390/1440): ‚Nicht mehr möglich‘ erscheint nur über den signierten Link einer Bestellung mit abgelaufener Frist

### druck

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 3 | 3 | 0 |
| 390 dunkel | – (Druck nur hell) | 0 | 0 |
| 1440 hell | 3 | 2 | 0 |
| 1440 dunkel | – (Druck nur hell) | 0 | 0 |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell · Bild 1 · Punkt 2 · Fußsatz gekürzt: Board „Preise inkl. Plattformgebühr. Bestellnummer nur zum Abgleich – bitte zusätzlich den Namen prüfen.“, App nur „Bestellnummer nur zum Abgleich – bitte zusätzlich den Namen prüfen.“ · .nachtlauf/screens/abnahme/druck/1-390-hell.png
- 1440 hell · Bild 1 · Punkt 2 · derselbe Fußsatz ohne „Preise inkl. Plattformgebühr.“ · .nachtlauf/screens/abnahme/druck/1-1440-hell.png
- 390 hell · Bild 1, 2 · Punkt 4 · Knopf „Drucken“ im Board akzentfarben (orange) ohne Symbol, in der App dunkel gefüllt mit Drucker-Symbol – andere Farbwirkung · .nachtlauf/screens/abnahme/druck/1-390-hell.png, .nachtlauf/screens/abnahme/druck/2-390-hell.png
- 390 hell · Bild 3 · Punkt 4 · Leerzustand: Board zeigt „Drucken“ als umrandeten Zweitknopf (hell), App dunkel gefüllt mit Symbol wie im Normalzustand · .nachtlauf/screens/abnahme/druck/3-390-hell.png
- 390 hell · Bild 2 · Punkt 1/2 · Zeile Josef Wagner (online bezahlt): Board „Online bezahlt“ links und „€ 381,60“ rechts in einer Zeile; App setzt den Betrag in eine eigene Zeile darüber und ergänzt „inkl. € 18,00 Servicegebühr“ (im Board nicht vorhanden) · .nachtlauf/screens/abnahme/druck/2-390-hell.png
- 1440 hell · Bild 2 · Punkt 1/2 · dieselbe Abweichung bei Josef Wagner: Betrag über der Zahlungszeile plus zusätzlicher Satz „inkl. € 18,00 Servicegebühr“ · .nachtlauf/screens/abnahme/druck/2-1440-hell.png
- 1440 hell · Bild 1, 2 · Punkt 1 · App zeigt oben eine Leiste mit „Zurück“ und „Drucken“ über die ganze Breite; das A4-Board zeigt nur das Blatt ohne Leiste (falls die Leiste beim Drucken ausgeblendet wird, betrifft es nur die Bildschirmansicht) · .nachtlauf/screens/abnahme/druck/1-1440-hell.png, .nachtlauf/screens/abnahme/druck/2-1440-hell.png
- 390 hell · Bild 3 · Punkt 6 · Leerzustand zeigt zusätzlich die Fußzeile „Gedruckt am … · Agrilo“, die das Board im Leerzustand nicht zeigt · .nachtlauf/screens/abnahme/druck/3-390-hell.png
- 390 hell · Bild 3 · Punkt 6 · Leerzustand widersprüchlich: „Heute keine Bestellungen zur Abholung.“ und direkt darunter „Die nächste Abholung ist heute, Do 5. Nov, 23–23:30 Uhr.“ (Board: nächste Abholung an einem späteren Tag, Form „Sa, 6. März, 9–12 Uhr“); „heute,“ als Zusatzwort · .nachtlauf/screens/abnahme/druck/3-390-hell.png
- 390 hell · Bild 1 · Punkt 1 · E-Mail-Adresse der Kundin bricht mitten im Wort um („…@example.co / m“); Board einzeilig · .nachtlauf/screens/abnahme/druck/1-390-hell.png
- 390 hell · Bild 1 · Punkt 1 · zusätzliche kursive Kundennotiz („Komme mit dem Rad, bitte gut verpacken.“) zwischen Kopf und Tabelle, im Board nicht vorhanden (kann an den Beispieldaten liegen, Board zeigt keine Notiz) · .nachtlauf/screens/abnahme/druck/1-390-hell.png
- 1440 hell · Bild 1 · Punkt 1 · dieselbe zusätzliche Kundennotiz zwischen Kopf und Tabelle · .nachtlauf/screens/abnahme/druck/1-1440-hell.png
- 1440 hell · Bild 2 · Punkt 3 · Zahlungszeilen („Bar bei Abholung“, „Online bezahlt“) und Fußzeile „Gedruckt am …“ sichtbar kleiner als im Board (Board etwa gleich groß wie die Produktzeilen) · .nachtlauf/screens/abnahme/druck/2-1440-hell.png
- 1440 hell · Bild 1 · Punkt 3 · „Eingang: …“ und Fußsatz sichtbar kleiner als im Board; Spaltenköpfe „Produkt/Menge/Betrag“ dunkel statt gedämpft braun · .nachtlauf/screens/abnahme/druck/1-1440-hell.png
- 1440 hell · Bild 1, 2 · Punkt 1 · Blatt schmaler als im Board (Inhalt etwa 576 px statt etwa 650 px breit); Kästen der Packliste stärker gerundet · .nachtlauf/screens/abnahme/druck/2-1440-hell.png

Begründete Ausnahmen gesehen:
- Register vor Board: Abholzettel (Hofbereich) zeigt den Stand „Gepackt“; das Board zeigt dort „Zum Packen“ (Datenänderung: Bestellung Abholbereit) – Bild 1, 390 und 1440.

Nicht prüfbar:
- keine (alle 5 App-Bilder erreichbar; dunkle Fassungen gibt es für Druck nicht)

### mail-betrieb

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 6 | 0 |
| 390 dunkel | – | – | – |
| 1440 hell | 2 | 6 | 0 |
| 1440 dunkel | – | – | – |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390/1440 hell · Bild 1 · Punkt 1 · Knopf „In Höfe prüfen →“ fehlt ganz; stattdessen Satz „Freischalten im Admin-Bereich unter /admin.“ · .nachtlauf/screens/abnahme/mail-betrieb/1-390-hell.png, .nachtlauf/screens/abnahme/mail-betrieb/1-1440-hell.png
- 390/1440 hell · Bild 1 · Punkt 1/2 · Board: drei Zeilen Beschriftung links/Wert rechts „Hof“, „Angemeldet“, „Fehlt noch“; App: Einleitungssatz „Hof am Moos hat sich registriert und wartet auf die Freischaltung. Bis dahin ist die Hofseite öffentlich nicht erreichbar.“ plus grauer Kasten mit Großbuchstaben-Feldern „HOF-ID“, „ADRESSE DER HOFSEITE“, „INHABER“, „REGISTRIERT AM“; „Fehlt noch“ fehlt · .nachtlauf/screens/abnahme/mail-betrieb/1-390-hell.png, .nachtlauf/screens/abnahme/mail-betrieb/1-1440-hell.png
- 390/1440 hell · Bild 3 · Punkt 1 · Hinweis-Kasten (rötlich getönt) „Stripe hat die Erstattung seit 24 Stunden nicht bestätigt. Prüf sie in Stripe und schließ sie in Bestellungen ab.“ fehlt · .nachtlauf/screens/abnahme/mail-betrieb/3-390-hell.png, .nachtlauf/screens/abnahme/mail-betrieb/3-1440-hell.png
- 390/1440 hell · Bild 3 · Punkt 1 · Knopf „In Bestellungen öffnen →“ fehlt; stattdessen „Was zu tun ist: Überweisung zurückbuchen und Plattformgebühr erstatten“ und „Erstatten kann nur das Plattformkonto – der Hof hat dort keinen Zugang.“ · .nachtlauf/screens/abnahme/mail-betrieb/3-390-hell.png, .nachtlauf/screens/abnahme/mail-betrieb/3-1440-hell.png
- 390/1440 hell · Bild 3 · Punkt 1/2 · Board: zwei Zeilen „Bestellung“ (Nummer · Hof) und „Betrag“; App: Einleitungssatz „Der Hof hat die Bestellung storniert, …“ plus grauer Kasten mit sechs Feldern „BESTELLUNG“, „BESTELL-ID“, „HOF“, „ERSTATTUNG BEI STRIPE“, „AN DIE KUNDIN ERSTATTEN“, „DAVON VOM HOF (ÜBER DIE RÜCKBUCHUNG DER ÜBERWEISUNG)“ · .nachtlauf/screens/abnahme/mail-betrieb/3-390-hell.png, .nachtlauf/screens/abnahme/mail-betrieb/3-1440-hell.png
- 390/1440 hell · Bild 6 · Punkt 1 · Warn-Kasten (rötlich getönt) „Die Messung von heute, 05:02 liegt über der Warnstufe 80 %: 410 MB von 500 MB.“ fehlt; App zeigt nur Fließtext „410 MB von 500 MB. Bei 8 GB ist der inklusive Speicher voll – …“ (Zahlen in sich widersprüchlich: 500 MB gegen 8 GB) · .nachtlauf/screens/abnahme/mail-betrieb/6-390-hell.png, .nachtlauf/screens/abnahme/mail-betrieb/6-1440-hell.png
- 390/1440 hell · Bild 6 · Punkt 2 · Knopf Board „In Betrieb ansehen →“, App „Betrieb ansehen“ (ohne „In“ und ohne Pfeil) · .nachtlauf/screens/abnahme/mail-betrieb/6-390-hell.png, .nachtlauf/screens/abnahme/mail-betrieb/6-1440-hell.png
- 390/1440 hell · Bild 6 · Punkt 1/2 · Board-Satz „Größte Tabelle: Protokoll (120 MB). Prüf, ob alte Einträge archiviert werden können, oder erhöh den Tarif.“ fehlt; App hat stattdessen „Was hilft: Unter „Größte Tabellen“ auf der Seite Betrieb steht, was wächst.“, zusätzliche Dachzeile „Betrieb“ über der Überschrift und zusätzlichen Kleintext „Diese Mail kommt einmal je Stufe (80 %, 95 %, voll) … Betrieb der Plattform.“ · .nachtlauf/screens/abnahme/mail-betrieb/6-390-hell.png, .nachtlauf/screens/abnahme/mail-betrieb/6-1440-hell.png
- 390/1440 hell · Bild 4 · Punkt 1/2 · Board: drei Zeilen „Offen im Postfach“, „Neue Meldungen“, „Beantwortet in 7 Tagen“ mit Zahl rechts; App: grauer Kasten „DIE LETZTEN 7 TAGE“ mit sieben fetten Zeilen (Bestellungen, Umsatz der Höfe, Plattformgebühr, Neue Höfe, Offene Aufgaben, Fehlermeldungen der Woche, Kosten diesen Monat), dazu „Offen im Eingang: 1 Antwort · 1 Meldung · 0 Aufgaben“, „Eine neue Meldung seit der letzten Sichtung. Offen insgesamt: 2.“ und „Aufgeräumt: nichts älter als 90 Tage gelöscht.“; keine der drei Board-Zeilen vorhanden · .nachtlauf/screens/abnahme/mail-betrieb/4-390-hell.png, .nachtlauf/screens/abnahme/mail-betrieb/4-1440-hell.png
- 390/1440 hell · Bild 2 · Punkt 1/2 · Board: Zeilen „Von“ (Hof) und „Seite“ (Pfad · Gerät), darunter Meldung als Zitat in „…“; App: Einleitungssatz „Hof Müller hat einen Fehler gemeldet. Eingang: …“ plus grauer Kasten „MELDUNG“ (fett, ohne Anführungszeichen) und „KONTEXT“ (Pfad und Bildschirmgröße zweizeilig) · .nachtlauf/screens/abnahme/mail-betrieb/2-390-hell.png, .nachtlauf/screens/abnahme/mail-betrieb/2-1440-hell.png
- 390/1440 hell · Bild 2 · Punkt 2 · zusätzlicher Satz unter dem Knopf „Wünsche und Fragen kommen nicht per Mail — sie stehen gesammelt im Postfach und in der Wochen-Zusammenfassung.“, im Board nicht vorhanden · .nachtlauf/screens/abnahme/mail-betrieb/2-390-hell.png, .nachtlauf/screens/abnahme/mail-betrieb/2-1440-hell.png
- 390/1440 hell · Bild 2 · Punkt 2 · Überschrift Board „Neue Fehlermeldung 7K2Q“ (kurzer Code), App „Neue Fehlermeldung cmeldung“ – wirkt wie ein abgeschnittener interner Schlüssel statt des kurzen Meldungscodes (falls nur Beispieldaten: keine Abweichung) · .nachtlauf/screens/abnahme/mail-betrieb/2-390-hell.png
- 390/1440 hell · Bild 5 · Punkt 1/2 · Board: Bezugszeile „Hof am Bach · zu „Plattformgebühr ab 1. Februar: so steht sie in deiner Abrechnung““ (kleingeschrieben „zu“, Titel in Anführungszeichen) und Nachricht als normaler Zitattext in „…“; App: „Hof am Bach · Zu: Plattformgebühr ab 1. Februar“ und Nachricht fett, größer, ohne Anführungszeichen in grauem Kasten · .nachtlauf/screens/abnahme/mail-betrieb/5-390-hell.png, .nachtlauf/screens/abnahme/mail-betrieb/5-1440-hell.png
- 390/1440 hell · alle Bilder · Punkt 1 · Schrift von „Agrilo“ und Überschrift: Board zeigt die Marken-Serifenschrift, App eine Times-artige Ersatzschrift (sichtbar breiter und anders gezeichnet) · .nachtlauf/screens/abnahme/mail-betrieb/1-390-hell.png
- 390/1440 hell · Bild 1, 2, 3, 4 · Punkt 3 · Großbuchstaben-Feldbeschriftungen im grauen Kasten (z. B. „HOF-ID“, „MELDUNG“, „BESTELL-ID“, „DIE LETZTEN 7 TAGE“) sichtbar sehr klein, wirken unter 12 px · .nachtlauf/screens/abnahme/mail-betrieb/3-390-hell.png

Begründete Ausnahmen gesehen:
- keine (die Mail-Vorschau-Hinweise gelten: kein <title>/h1 der Vorschau-Datei, keine Netzbilder – nicht als Abweichung gewertet)

Nicht prüfbar:
- keine ganzen Bilder. Hinweis: Der Posteingang-Rahmen des Boards (Betreff, Von/An, Marke „Wichtig“/„Kann warten“, Vorschauzeile, Leiste „Antworten · Weiterleiten · Archivieren“) gehört zum Mail-Programm und ist in der Vorschau-Datei nicht abgebildet; Betreff und Vorschauzeile konnten daher nicht verglichen werden.

### mail-hof-bestellung

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 3 | 1 |
| 390 dunkel | – | – | – |
| 1440 hell | 2 | 3 | 1 |
| 1440 dunkel | – | – | – |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390/1440 hell · Bild 1 · Punkt 1 · Kasten „BESTELLNUMMER“ mit großer Nummer „HM-0303-2C91“ fehlt; die App zeigt stattdessen einen Kasten „ABHOLTERMIN“ (Datum und Uhrzeit groß) und die Nummer nur als Zeile „Bestellnummer: …“ unten · .nachtlauf/screens/abnahme/mail-hof-bestellung/1-390-hell.png, .../1-1440-hell.png
- 390/1440 hell · Bild 1 · Punkt 1 · Zeile „Abholung … Mi, 3. März 2027, 15:00–18:00 Uhr“ (Beschriftung links, Wert rechts) fehlt; ersetzt durch den Abholtermin-Kasten · .../1-390-hell.png, .../1-1440-hell.png
- 390/1440 hell · Bild 1 · Punkt 1 · „Bestellte Produkte“ im Board als Tabelle „2× Bergkäse (250 g) … € 13,16“ mit Preisen rechts und Trennlinie; App als Aufzählung „• Bergkäse · 2 × 250 g“ ohne Preise · .../1-390-hell.png, .../1-1440-hell.png
- 390/1440 hell · Bild 1 · Punkt 1/2 · Summenblock: Board „Warenpreis (dein Anteil)“ links / „€ 18,00“ fett rechts, darunter „Plattformgebühr … € 1,12“ und Satz „Die Plattformgebühr behält Stripe gleich ein. Die Kundin hat € 19,12 bezahlt.“; App alles linksbündig im Fließtext „Plattformgebühr: € 1,12 — von der Plattform einbehalten, dir wird der Warenpreis überwiesen. …“ · .../1-390-hell.png, .../1-1440-hell.png
- 390/1440 hell · Bild 1 · Punkt 1 · zusätzliche Zeilen „Zahlung: Online (bereits bezahlt)“, „Bestellnummer: …“, „Kunde: Maria Huber · +43 …“ (Telefonlink), die das Board nicht zeigt · .../1-390-hell.png, .../1-1440-hell.png
- 390/1440 hell · Bild 1 · Punkt 2 · Anrede: Board „Hallo Franz Müller, Maria Huber hat …“ in einem Absatz ohne Fettung; App Zeilenumbruch nach der Anrede und „Maria Huber“ fett · .../1-390-hell.png, .../1-1440-hell.png
- 390/1440 hell · Bild 3 · Punkt 1 · „Bar zu kassieren“ im Board als Summenzeile (links Text, rechts Betrag fett) unter der Abholung; App als orange getönter Hinweis-Kasten „Bar zu kassieren: € 19,12“ über dem Abholtermin (andere Reihenfolge, andere Farbwirkung) · .../3-390-hell.png, .../3-1440-hell.png
- 390/1440 hell · Bild 3 · Punkt 2 · Satz unter „Bar zu kassieren“: Board „Plattformgebühr darin € 1,68 – als Gründungshof bis 31. Jänner 2028 erlassen.“; App „davon Plattformgebühr € 1,12; Warenpreis € 18,00 bleibt dir.“ (Gründungshof-Erlass fehlt) · .../3-390-hell.png, .../3-1440-hell.png
- 390/1440 hell · Bild 3 · Punkt 1 · Kasten „BESTELLNUMMER HM-0303-7E15“ fehlt (nur Zeile „Bestellnummer: …“); Zeile „Abholung …“ ersetzt durch Abholtermin-Kasten · .../3-390-hell.png, .../3-1440-hell.png
- 390/1440 hell · Bild 3 · Punkt 1 · zusätzliche Blöcke „Bestellte Produkte“ (Aufzählung) und „Kunde: Eva Steiner · +43 …“, die das Board nicht zeigt · .../3-390-hell.png, .../3-1440-hell.png
- 390/1440 hell · Bild 3 · Punkt 2 · Einleitung: Board „Eva Steiner hat ihre Bestellung per E-Mail bestätigt. Du kannst packen.“ ohne Anrede; App „Hallo Franz Müller, Eva Steiner hat ihre Bestellung per E-Mail bestätigt und wird zum gewählten Termin abholen.“ („Du kannst packen.“ fehlt) · .../3-390-hell.png, .../3-1440-hell.png
- 390/1440 hell · Bild 4 · Punkt 1/4 · orange getönter Hinweis-Kasten „Bei schnell verderblicher Ware (Heumilch, Bergkäse) gilt das Rücktrittsrecht meist nicht. Prüf das und antworte der Kundin in der Bestellung.“ fehlt; App zeigt nur grauen Kleintext „Ausnahmen nach § 18 FAGG (etwa schnell verderbliche Ware) prüfst du im Einzelfall.“ (nicht in der Ausnahmenliste; Board-Titel „Anwältin prüft“) · .../4-390-hell.png, .../4-1440-hell.png
- 390/1440 hell · Bild 4 · Punkt 2 · Einleitung: Board „Maria Huber ist von ihrer Bestellung HM-0303-2C91 zurückgetreten: die ganze Bestellung.“; App „Zur Bestellung HM-0303-2C91 ist am 3. März 2027, 07:40 Uhr ein Rücktritt eingegangen. Bitte prüf die Rückgabe und erstatte – oder lehne mit Grund ab.“ plus eigene Zeile „Die ganze Bestellung“ (Kundinnenname fehlt) · .../4-390-hell.png, .../4-1440-hell.png
- 390/1440 hell · Bild 1, 3, 4 · Punkt 2 · Anbieterzeile im Fuß: Board „[Betreiber laut Impressum] · [Anschrift] · Impressum: agrilo.at/impressum“; App „Agrilo · agrilo.at/impressum“ (Betreiber und Anschrift fehlen; Board markiert die Zeile als Vorschlag, Recht prüft) · .../1-390-hell.png, .../3-390-hell.png, .../4-390-hell.png (und 1440)
- 390/1440 hell · Bild 1, 3, 4 · Punkt 1 · Überschrift („Neue bezahlte Bestellung“, „Bar-Bestellung bestätigt“, „Eine Kundin ist zurückgetreten“) und Marke „Agrilo“ in einer Times-artigen Ersatzschrift statt der Display-Serifenschrift des Boards · .../1-390-hell.png, .../3-390-hell.png, .../4-390-hell.png
- 390/1440 hell · Bild 1, 3 · Punkt 3 · Kicker „ABHOLTERMIN“ in 11 px (laut Messung unter 12 px); Element gibt es im Board nicht · .../1-390-hell.png, .../3-390-hell.png

Begründete Ausnahmen gesehen:
- Keine. Der Postfach-Rahmen des Boards (Posteingang, Betreff, Von/An, „Wichtig“, Vorschauzeile) ist Darstellung des Mailprogramms und wurde nicht als Abweichung gewertet; fehlendes <title>/h1 der Vorschau-Datei laut Mail-Hinweis ebenfalls nicht.

Nicht prüfbar:
- Bild 2 (390/1440): Die Mail-Vorschau (tests/mail-vorschau.test.ts) erzeugt diesen Fall nicht: online-Fall der Vorlage bestellung-bezahlt-hof vorhanden, Bar-Fall (Neue Bestellung, Bar bei Abholung) fehlt

### mail-hof-konto

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 3 | 5 | 0 |
| 390 dunkel | – | – | – |
| 1440 hell | 3 | 5 | 0 |
| 1440 dunkel | – | – | – |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell / 1440 hell · Bild 1 · Punkt 1 · Grüner Hinweis-Kasten „Du bist **Gründungshof Nr. 5**: Hofladen 12 Monate kostenlos, bis 11. März 2028." fehlt ganz (Board: „Zeile Gründungsplatz: Vorschlag") · .nachtlauf/screens/abnahme/mail-hof-konto/1-390-hell.png, .nachtlauf/screens/abnahme/mail-hof-konto/1-1440-hell.png
- 390 hell / 1440 hell · Bild 3 · Punkt 1 · Roter Warn-Kasten „Klappt es innerhalb von 14 Tagen nicht, pausieren wir „Bar bei Abholung" bei dir, bis die Gebühr bezahlt ist." fehlt; Inhalt steht stattdessen als Fließtext im Absatz · .nachtlauf/screens/abnahme/mail-hof-konto/3-390-hell.png, .nachtlauf/screens/abnahme/mail-hof-konto/3-1440-hell.png
- 390 hell / 1440 hell · Bild 3 · Punkt 2 · Überschrift Board „Lastschrift hat nicht geklappt", App „Lastschrift für April 2028 hat nicht geklappt" (das ist der Betreff, nicht die Überschrift) · .nachtlauf/screens/abnahme/mail-hof-konto/3-390-hell.png, .nachtlauf/screens/abnahme/mail-hof-konto/3-1440-hell.png
- 390 hell / 1440 hell · Bild 3 · Punkt 2 · Fließtext Board „Die Plattformgebühr aus deinen Barbestellungen im April 2028 (€ 7,42) konnten wir nicht einziehen. Stripe versucht es in den nächsten Tagen erneut.", App „Die Lastschrift für April 2028 hat nicht geklappt. Stripe versucht es erneut. Bitte sorg für Deckung … Bleibt der Betrag 14 Tage offen, nehmen wir bei dir keine Barbestellungen mehr an – laufende Bestellungen bleiben." (Betrag fehlt, „Bar bei Abholung" pausieren fehlt) · .nachtlauf/screens/abnahme/mail-hof-konto/3-390-hell.png, .nachtlauf/screens/abnahme/mail-hof-konto/3-1440-hell.png
- 390 hell / 1440 hell · Bild 5 · Punkt 1 · Antworttext steht in der App in einem grauen Kasten, fett und groß (ca. 18 px); Board zeigt ihn als normalen Fließtext ohne Kasten direkt unter „Zu: …" · .nachtlauf/screens/abnahme/mail-hof-konto/5-390-hell.png, .nachtlauf/screens/abnahme/mail-hof-konto/5-1440-hell.png
- 390 hell / 1440 hell · Bild 5 · Punkt 1/2 · Zusätzliche Zeile „Dein Agrilo-Team" am Kartenende, im Board nicht vorhanden · .nachtlauf/screens/abnahme/mail-hof-konto/5-390-hell.png, .nachtlauf/screens/abnahme/mail-hof-konto/5-1440-hell.png
- 390 hell / 1440 hell · Bild 4, 5 · Punkt 2 · Board „Antworten geht in der App, im Postfach.", App „Antworten geht in der App: Öffne die Nachricht in deinem Postfach und schreib dort zurück." · .nachtlauf/screens/abnahme/mail-hof-konto/4-390-hell.png, .nachtlauf/screens/abnahme/mail-hof-konto/5-390-hell.png (ebenso 4-1440-hell.png, 5-1440-hell.png)
- 390 hell / 1440 hell · Bild 5 · Punkt 2 · Zeile „Zu:" Board „Zu: Plattformgebühr ab 1. Februar: so steht sie in deiner Abrechnung", App gekürzt „Zu: Plattformgebühr ab 1. Februar" · .nachtlauf/screens/abnahme/mail-hof-konto/5-390-hell.png, .nachtlauf/screens/abnahme/mail-hof-konto/5-1440-hell.png
- 390 hell / 1440 hell · Bild 2 · Punkt 2/1 · Board zwei Absätze mit Anrede „Hallo Franz Müller, …" und Satz „Bis dahin ist sie für dich als Gründungshof erlassen."; App ein Absatz ohne Anrede und ohne diesen Satz, dafür zusätzlich „Bei Online-Zahlungen behält Stripe sie schon beim Bezahlen ein." · .nachtlauf/screens/abnahme/mail-hof-konto/2-390-hell.png, .nachtlauf/screens/abnahme/mail-hof-konto/2-1440-hell.png
- 390 hell / 1440 hell · Bild 2 · Punkt 2 · Board „Ohne Lastschrift gibt es ab dann bei dir kein „Bar bei Abholung".", App „Ohne Lastschrift bieten wir bei dir ab dem Einzug nur Online-Bezahlen an." · .nachtlauf/screens/abnahme/mail-hof-konto/2-390-hell.png, .nachtlauf/screens/abnahme/mail-hof-konto/2-1440-hell.png
- 390 hell / 1440 hell · Bild 1 · Punkt 2 · Fließtext Board „Hof am Moos ist ab sofort öffentlich erreichbar und kann Bestellungen entgegennehmen.", App „**Hof am Moos** ist ab sofort öffentlich erreichbar — Kundinnen können deine Hofseite besuchen und bestellen." (Hofname fett, Gedankenstrich) · .nachtlauf/screens/abnahme/mail-hof-konto/1-390-hell.png, .nachtlauf/screens/abnahme/mail-hof-konto/1-1440-hell.png
- 390 hell / 1440 hell · Bild 1 · Punkt 2 · Board „Nächster Schritt: Teile den Link zu deiner Hofseite mit deiner Kundschaft – zum Beispiel per WhatsApp oder als QR-Plakat.", App „Nächster Schritt: Teile den Link deiner Hofseite — per WhatsApp, am Marktstand oder als Aushang. Er lautet http://localhost:3000/hof-am-moos"; außerdem in der App grau und kleiner statt Fließtextfarbe · .nachtlauf/screens/abnahme/mail-hof-konto/1-390-hell.png, .nachtlauf/screens/abnahme/mail-hof-konto/1-1440-hell.png
- 390 hell / 1440 hell · Bild 1–5 · Punkt 2 · Anbieterzeile im Fuß: Board „[Betreiber laut Impressum] · [Anschrift] · Impressum: agrilo.at/impressum", App „Agrilo · agrilo.at/impressum" (Board markiert Fuß als „Vorschlag (V68/V79), Recht prüft"; keine der freigegebenen Ausnahmen, daher als Abweichung geführt) · .nachtlauf/screens/abnahme/mail-hof-konto/1-390-hell.png … 5-1440-hell.png
- 390 hell / 1440 hell · Bild 1–5 · Punkt 1 · Überschriften und Wortmarke „Agrilo" in der App in einer Systemserife (Times-artig, wirkt fetter und schmaler), Board in der weicheren Display-Serife; sichtbar andere Schriftwirkung · .nachtlauf/screens/abnahme/mail-hof-konto/1-390-hell.png … 5-1440-hell.png
- 390 hell / 1440 hell · Bild 4 · Punkt 1 · „Nachricht vom Agrilo-Team" im Board fett und dunkel, in der App normal und grau wie „Betriebsmitteilung"; Link „Ansehen" im Board fett, in der App normal · .nachtlauf/screens/abnahme/mail-hof-konto/4-390-hell.png, .nachtlauf/screens/abnahme/mail-hof-konto/4-1440-hell.png
- 390 hell / 1440 hell · Bild 4 · Punkt 1 · Gruß „Dein Agrilo-Team" im Board in Fließtextgröße und -farbe, in der App klein und grau · .nachtlauf/screens/abnahme/mail-hof-konto/4-390-hell.png, .nachtlauf/screens/abnahme/mail-hof-konto/4-1440-hell.png
- 390 hell / 1440 hell · Bild 1–5 · Punkt 1 · Abstand zwischen Text und Knopf in der App sichtbar größer (ca. 32 px statt ca. 16–20 px im Board) · .nachtlauf/screens/abnahme/mail-hof-konto/2-390-hell.png u. a.

Hinweis (nicht gewertet): Das Board zeigt jede Mail in einem nachgebauten Posteingang (Kopf „Posteingang", Von/An, Marke „Wichtig"/„Kann warten", Vorschauzeile). Die App-Bilder zeigen nur den Mail-Inhalt (Vorschau-Datei); dieser Rahmen wird nicht als fehlender Aufbau gewertet. Der Inhalt des Rundschreibens (Bild 4, kürzerer Text) gilt als Beispieldaten.

Begründete Ausnahmen gesehen:
- keine

Nicht prüfbar:
- keine (dunkle Fassungen entfallen bei Mails, siehe Mail-Hinweis)

### mail-kauf

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 6 | 0 |
| 390 dunkel | – | – | – |
| 1440 hell | 2 | 6 | 0 |
| 1440 dunkel | – | – | – |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390/1440 hell · Bild 4 · Punkt 1 · Link „Dieselbe Bestellung nochmal aufgeben“ ist da, das Board zeigt ihn ausdrücklich nicht (V70) · .nachtlauf/screens/abnahme/mail-kauf/4-390-hell.png, .nachtlauf/screens/abnahme/mail-kauf/4-1440-hell.png
- 390/1440 hell · Bild 2, 4, 5, 6 · Punkt 1 · große Bestellnummer-Karte („BESTELLNUMMER“ + Nummer groß) fehlt; die App zeigt nur eine Listenzeile „Bestellnummer … HM-…“ · .nachtlauf/screens/abnahme/mail-kauf/2-390-hell.png, .nachtlauf/screens/abnahme/mail-kauf/4-390-hell.png, .nachtlauf/screens/abnahme/mail-kauf/5-390-hell.png, .nachtlauf/screens/abnahme/mail-kauf/6-390-hell.png
- 390/1440 hell · Bild 3 · Punkt 1 · grüner Kasten „Bring bitte € … in bar mit.“ (Betrag fett) direkt unter „Bar bei Abholung“ fehlt; die App zeigt nur eine graue Kleintextzeile „Bring bitte € … in bar mit.“ zwischen AGB-Satz und Gebührensatz · .nachtlauf/screens/abnahme/mail-kauf/3-390-hell.png
- 390/1440 hell · Bild 6 · Punkt 1/4 · Kasten „Bring bitte € … in bar mit (statt € …).“: Board grün und unter „Neuer Betrag“, App orange (Warnton) und über der Liste, Text ganz fett, Satz „Die Plattformgebühr gilt nur für das, was du bekommst.“ im Kasten statt darunter · .nachtlauf/screens/abnahme/mail-kauf/6-390-hell.png
- 390/1440 hell · Bild 6 · Punkt 1 · Liste der restlichen Artikel mit Preisen und Trennlinie vor „Neuer Betrag“ fehlt; dafür zusätzliche Zeilen „Bestellnummer“ und „Abholung“; zusätzliche Trennlinie über „Fragen?“ · .nachtlauf/screens/abnahme/mail-kauf/6-390-hell.png
- 390/1440 hell · Bild 6 · Punkt 2 · Board „Hof Müller hat für dich gepackt, aber es fehlt leider: …“, App „Hallo Eva Steiner, bei deiner Bestellung HM-… bei Hof Müller fehlt leider: …“ (Anrede und Bestellnummer im Satz zusätzlich) · .nachtlauf/screens/abnahme/mail-kauf/6-390-hell.png
- 390/1440 hell · Bild 2 · Punkt 2/4 · Fristkasten: im Board Titel und Folgesatz „Danach geben wir die Ware wieder frei – ohne Kosten für dich.“ in Warnfarbe, normal groß; in der App Titel schwarz, Folgesatz grau und kleiner; Titel „Bitte bestätige bis heute, 09:40 Uhr.“ vs. „Bitte bestätige bis Mittwoch, 3. März, 09:40 Uhr.“ · .nachtlauf/screens/abnahme/mail-kauf/2-390-hell.png
- 390/1440 hell · Bild 2 · Punkt 2 · Einleitung mit zusätzlichem Satz „Du hast bei Hof Müller bestellt.“; zusätzlicher Satz „Falls du diese Bestellung nicht aufgegeben hast, ignoriere diese E-Mail einfach.“, im Board nicht vorhanden · .nachtlauf/screens/abnahme/mail-kauf/2-390-hell.png
- 390/1440 hell · Bild 4 · Punkt 1/2 · zusätzlicher Absatz unter der Überschrift („Deine Bestellung HM-… liegt bei Hof Müller für dich bereit – Mittwoch, …, Dorfstraße 12, …“), das Board hat keinen; Zeile „Wo“ fehlt · .nachtlauf/screens/abnahme/mail-kauf/4-390-hell.png
- 390/1440 hell · Bild 5 · Punkt 2 · Board „Hof Müller hat gemeldet: Deine Bestellung ist doch noch nicht abholbereit. Du bekommst eine neue Mail, sobald sie bereit liegt. Die Abholzeit bleibt.“, App „Deine Bestellung bei Hof Müller ist doch noch nicht abholbereit. Wir melden uns, sobald sie fertig ist – dein Abholtermin bleibt wie geplant.“; Reihenfolge: Bestellnummer vor Abholung statt Karte davor · .nachtlauf/screens/abnahme/mail-kauf/5-390-hell.png
- 390/1440 hell · Bild 1, 2, 3 · Punkt 1/2 · Gebührensatz: Board „Alle Preise inkl. Plattformgebühr (darin € …). Den Kaufvertrag schließt du mit Hof Müller.“ direkt unter der Summe (Bild 3: gar kein Gebührensatz); App „… Die Plattformgebühr ist Teil des Preises. Der Hof zahlt damit die Bestellplattform Agrilo.“ unter den Knöpfen bzw. nach dem AGB-Satz, „Den Kaufvertrag schließt du mit Hof Müller.“ fehlt (falls N39-Wortlaut: begründet, im Bild nicht erkennbar) · .nachtlauf/screens/abnahme/mail-kauf/1-390-hell.png, .nachtlauf/screens/abnahme/mail-kauf/3-390-hell.png
- 390 hell · Bild 1, 3 · Punkt 1 · Knöpfe „Bestellung ansehen“ und „Route planen“ stehen untereinander, im Board nebeneinander · .nachtlauf/screens/abnahme/mail-kauf/1-390-hell.png, .nachtlauf/screens/abnahme/mail-kauf/3-390-hell.png
- 390/1440 hell · Bild 1–5 · Punkt 2 · Beschriftung „Wo“ heißt in der App „Adresse“; Wert ohne Hofnamen und PLZ („Dorfstraße 12, Braunau am Inn“ statt „Hof Müller, Dorfstraße 12, 5280 Braunau am Inn“) · .nachtlauf/screens/abnahme/mail-kauf/1-390-hell.png
- 390/1440 hell · Bild 1, 2, 3 · Punkt 1/2 · Artikelzeilen „Bergkäse · 2 × 250 g“ statt „2× Bergkäse (250 g)“; Trennlinie zwischen Artikeln und Summenzeile fehlt · .nachtlauf/screens/abnahme/mail-kauf/1-390-hell.png
- 390 hell · Bild 1–6 · Punkt 1 · Abholzeit ausgeschrieben („Mittwoch, 3. März 2027, 15:00–18:00 Uhr“ statt „Mi, 3. März 2027, …“), dadurch bricht „Uhr“ allein in eine zweite Zeile · .nachtlauf/screens/abnahme/mail-kauf/1-390-hell.png
- 390/1440 hell · Bild 1, 3, 5, 6 · Punkt 2 · Hof-Telefon: Board „Fragen? Ruf direkt beim Hof an: +43 …“ mit fett schwarzer Nummer; App Nummer als grüner unterstrichener Link, in Bild 5 und 6 nur „Fragen? +43 …“ (Wortlaut „Ruf direkt beim Hof an:“ fehlt) · .nachtlauf/screens/abnahme/mail-kauf/5-390-hell.png, .nachtlauf/screens/abnahme/mail-kauf/6-390-hell.png
- 390/1440 hell · Bild 4 · Punkt 1 · „Du schaffst es nicht? Gib dem Hof kurz Bescheid:“ und „Anrufen (…)“: Board normal groß, Link fett grün; App klein und grau, Link dünn · .nachtlauf/screens/abnahme/mail-kauf/4-390-hell.png
- 390/1440 hell · Bild 1–6 · Punkt 1 · Logo „Agrilo“, Überschriften und große Bestellnummer in einer sichtbar anderen Serifenschrift (schmale Times-artige Ersatzschrift statt der runden Board-Serife) · .nachtlauf/screens/abnahme/mail-kauf/1-1440-hell.png

Begründete Ausnahmen gesehen:
- Recht vor Board (Bild 1–3): vollständige Widerrufsbelehrung „Teil A – Widerrufsbelehrung“, „Teil B – Muster-Widerrufsformular“, Hinweis zur Rückgabe am Hof und Link „Vertrag widerrufen“ statt des gestrichelten Board-Kastens „Belehrung über das Rücktrittsrecht“ mit Link „Rücktrittsrecht“.
- Recht vor Board (Bild 4–6): Link „Vertrag widerrufen“ statt „Rücktrittsrecht“.
- Recht vor Board (Bild 1–3): Abschnitt „Gesetzliche Gewährleistung“ mit Gewährleistungs-Grafik (lädt in der Abnahme nicht, nur Alt-Text – laut Hinweis keine Abweichung).
- Rechtstext (Bild 1–3): AGB-Satz in anderer Fassung („Es gelten die AGB von Agrilo. Du findest sie auch als Datei im Anhang dieser E-Mail und kannst sie jederzeit nachlesen, speichern und ausdrucken.“ statt „Es gelten die AGB von Agrilo (Fassung 1.0). Du findest sie im Anhang und unter agrilo.at/agb.“).
- Recht vor Board (alle): zusätzliche Fußzeile „Agrilo · agrilo.at/impressum“.
- Fehlendes <title>/h1 der Vorschau-Datei (axe document-title): laut Mail-Hinweis keine Abweichung.

Nicht prüfbar:
- keins (alle 6 Bilder je Fassung erreichbar). Die Kopfdaten des Boards (Betreff, Von, An, Antwort an den Hof, Anhang, Marke „Wichtig“/„Sofort“, Vorschauzeile) bildet die Mail-Vorschau nicht ab; sie sind nicht bewertet.

### mail-neuigkeiten

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 1 | 3 | 1 |
| 390 dunkel | – | – | – |
| 1440 hell | 1 | 3 | 1 |
| 1440 dunkel | – | – | – |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell · Bild 4 · Punkt 1/6 · Zustand kaputt: ungestaltetes Roh-HTML in Standard-Serifenschrift ohne Karte, ohne Wortmarke „Agrilo“, ohne Überschrift „Danke für deinen Wunsch“, ohne Fuß; nur zwei Absätze sichtbar · .nachtlauf/screens/abnahme/mail-neuigkeiten/4-390-hell.png
- 1440 hell · Bild 4 · Punkt 1/6 · wie 390: ungestaltetes Roh-HTML, Karte, Wortmarke, Überschrift und Fuß fehlen · .nachtlauf/screens/abnahme/mail-neuigkeiten/4-1440-hell.png
- 390/1440 hell · Bild 4 · Punkt 2 · Board-Text „Du hast dir Abholzeiten am Sonntag gewünscht. Wir haben das mit den Höfen besprochen: Ab April … Ob dein Hof mitmacht, siehst du auf seiner Seite.“, „Mehrere Kundinnen haben sich das gewünscht – darum diese eine Antwort an alle.“ und „Versandt vom Agrilo-Team.“ fehlen; App zeigt nur „Ab April können Höfe auch Sonntage als Abholzeit anbieten.“ und „Agrilo-Team“ · .nachtlauf/screens/abnahme/mail-neuigkeiten/4-390-hell.png
- 390 hell · Bild 1 · Punkt 2 · Fließtext anders: Board „Hallo, du möchtest Neuigkeiten von Hof Müller per E-Mail bekommen? Tipp auf den Knopf, dann ist es erledigt.“, App „Hallo,⏎du möchtest … bekommen. Öffne dazu den Link und tippe auf der Seite auf „Anmeldung bestätigen“. Erst dann schicken wir dir Neuigkeiten.“ · .nachtlauf/screens/abnahme/mail-neuigkeiten/1-390-hell.png
- 390 hell · Bild 1 · Punkt 2 · Hinweis unter dem Knopf: Board „Der Link gilt 7 Tage. Ohne Bestätigung schicken wir dir nichts.“ (ein Absatz, normal), App „Der Link gilt **7 Tage**.“ plus zusätzlicher Absatz „Wenn du dich nicht angemeldet hast, ignorier diese Mail. Dann bekommst du nichts von uns.“ · .nachtlauf/screens/abnahme/mail-neuigkeiten/1-390-hell.png
- 1440 hell · Bild 1 · Punkt 2 · gleiche Textabweichungen wie 390 (Fließtext und Hinweis unter dem Knopf) · .nachtlauf/screens/abnahme/mail-neuigkeiten/1-1440-hell.png
- 390/1440 hell · Bild 2 · Punkt 1 · Knopf „Zu Hof Müller“ mittig gesetzt, im Board linksbündig unter dem Text; dazu deutlich größerer Abstand über und unter dem Knopf · .nachtlauf/screens/abnahme/mail-neuigkeiten/2-390-hell.png
- 390/1440 hell · Bild 2 · Punkt 1/3 · Abmelde-Zeile „Du bekommst diese E-Mail, weil … Abmelden“ zentriert und sichtbar kleiner (wirkt ca. 11 px) statt linksbündig; „Abmelden“ ohne Unterstreichung, also nicht als Link erkennbar (Board: unterstrichen) · .nachtlauf/screens/abnahme/mail-neuigkeiten/2-1440-hell.png
- 390/1440 hell · Bild 2 · Punkt 2 · Fuß: Board „Im Auftrag von Hof Müller, Dorfstraße 12, 5280 Braunau am Inn · versandt von Agrilo“, App „Im Auftrag von Hof Müller · versandt von Agrilo“ – Anschrift des Hofs fehlt · .nachtlauf/screens/abnahme/mail-neuigkeiten/2-390-hell.png
- 390/1440 hell · Bild 1, 2 · Punkt 2 · Anbieterzeile: Board „[Betreiber laut Impressum] · [Anschrift] · Impressum: agrilo.at/impressum“, App „Agrilo · agrilo.at/impressum“ – Anschrift-Teil und Wort „Impressum:“ fehlen (Fuß laut Bildtitel Vorschlag, Recht prüft) · .nachtlauf/screens/abnahme/mail-neuigkeiten/1-390-hell.png
- 390/1440 hell · Bild 2 · Punkt 1 · Reihenfolge leicht anders: im Board steht „Neuer Beitrag von Hof Müller“ direkt unter der Marke über dem Foto; in der App ohne Foto direkt über der Überschrift (Foto fehlt aus dem Netz, nicht gewertet) · .nachtlauf/screens/abnahme/mail-neuigkeiten/2-390-hell.png
- 390/1440 hell · Bild 1, 2 · Punkt 1 · Überschrift und Wortmarke „Agrilo“ in einer Ersatz-Serifenschrift (Times-artig, fett) statt der weicheren Anzeige-Serifenschrift des Boards; in 390 Bild 1 Überschrift kleiner (einzeilig statt zweizeilig) · .nachtlauf/screens/abnahme/mail-neuigkeiten/1-390-hell.png

Begründete Ausnahmen gesehen:
- keine (Foto in Bild 2 fehlt aus dem Netz und fehlendes <title>/h1 der Vorschau-Datei laut Mail-Hinweis keine Abweichung)

Nicht prüfbar:
- Bild 3 (390/1440): Die Mail-Vorschau (tests/mail-vorschau.test.ts) erzeugt diesen Fall nicht: nur der Beitrag ohne Foto-Fall mit Titel Frischer Bergkäse vorhanden, Fall Beitrag ohne Foto (Hoffest) fehlt
- Bild 1, 2, 4 (390/1440): Posteingangs-Rahmen des Boards (Betreff, Von, An, Marke „Wichtig“/„Kann warten“, Vorschauzeile) ist in der Vorschau-Datei nicht abgebildet und wurde nicht bewertet

### mail-sicherheit

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 6 | 0 |
| 390 dunkel | – | – | – |
| 1440 hell | 2 | 6 | 0 |
| 1440 dunkel | – | – | – |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390/1440 hell · Bild 3 · Punkt 1 · Knopf „Passwort zurücksetzen“ (Board, Zweitknopf unter dem Text) fehlt ganz; dafür ein zusätzlicher grauer Absatz „Über „Passwort vergessen“ kannst du dein Passwort jederzeit zurücksetzen … Wir fragen dich nie per E-Mail nach deinem Passwort.“ · .nachtlauf/screens/abnahme/mail-sicherheit/3-390-hell.png, .nachtlauf/screens/abnahme/mail-sicherheit/3-1440-hell.png
- 390/1440 hell · Bild 6 · Punkt 1 · zusätzlicher Zweitknopf „Passwort zurücksetzen“ neben/unter „Anmelden“; Board zeigt nur „Anmelden“ · .nachtlauf/screens/abnahme/mail-sicherheit/6-390-hell.png, .nachtlauf/screens/abnahme/mail-sicherheit/6-1440-hell.png
- 390/1440 hell · Bild 1 · Punkt 1 · Board zeigt zwei Zeilen „Wann … / Gerät …“ (Beschriftung links, Wert rechts); App zeigt stattdessen einen getönten Kasten „Windows · Edge / ein Gerät, das wir bei dir noch nicht kannten“, die Zeit steht fett im Fließtext („am 2.3. um 21:14“) · .nachtlauf/screens/abnahme/mail-sicherheit/1-390-hell.png, .nachtlauf/screens/abnahme/mail-sicherheit/1-1440-hell.png
- 390/1440 hell · Bild 1 und 5 · Punkt 1/4 · Knopf „Das war ich nicht“: Board heller Umriss-Knopf (Zweitknopf), App gefüllter Knopf in Rostrot (andere Farbwirkung, wirkt als Hauptknopf) · .nachtlauf/screens/abnahme/mail-sicherheit/1-390-hell.png, .nachtlauf/screens/abnahme/mail-sicherheit/5-390-hell.png
- 390/1440 hell · Bild 1, 4, 5 · Punkt 1 · zusätzlicher grauer Hinweisabsatz unter dem Knopf („Der Knopf öffnet eine Seite bei Agrilo – erst dort meldest du alle Geräte ab …“ bzw. „Der Link gilt 24 Stunden und einmal. Warst du das nicht? …“), im Board nicht (Bild 1, 5) bzw. kürzer (Bild 4) · .nachtlauf/screens/abnahme/mail-sicherheit/1-390-hell.png, .nachtlauf/screens/abnahme/mail-sicherheit/4-390-hell.png, .nachtlauf/screens/abnahme/mail-sicherheit/5-390-hell.png
- 390/1440 hell · Bild 5 · Punkt 1 · zusätzlicher Absatz „Hast du das beim Team angefragt? Dann musst du nichts tun.“ zwischen Text und Knopf; Board hat keinen · .nachtlauf/screens/abnahme/mail-sicherheit/5-390-hell.png
- 390/1440 hell · Bild 1 · Punkt 2 · Überschrift Board „Neue Anmeldung“, App „Neue Anmeldung bei deinem Hof-Konto“ · .nachtlauf/screens/abnahme/mail-sicherheit/1-390-hell.png
- 390/1440 hell · Bild 4 · Punkt 2 · Überschrift Board „Neue Anmelde-Adresse bestätigen“, App „Bestätige deine neue Anmelde-Adresse“ · .nachtlauf/screens/abnahme/mail-sicherheit/4-390-hell.png
- 390/1440 hell · Bild 4 · Punkt 2 · Text Board „… hat auf deinen Wunsch eine neue Anmelde-Adresse eingetragen. Bitte bestätige sie:“, App „… die Anmelde-Adresse deines Kontos auf diese Adresse umgestellt. Erst wenn du bestätigst, gilt sie.“; Hinweis Board „Der Link gilt 7 Tage. Bis dahin meldest du dich mit der alten Adresse an.“, App „Der Link gilt 24 Stunden und einmal. …“ · .nachtlauf/screens/abnahme/mail-sicherheit/4-1440-hell.png
- 390/1440 hell · Bild 2 · Punkt 2 · Text Board „Für deine Adresse wurde mehrmals ein falscher Code eingegeben. Zum Schutz nehmen wir für diese Adresse bis heute, 09:15 Uhr keinen Code mehr an.“, App „Hallo, für deine E-Mail-Adresse wurde zu oft ein falscher Code eingegeben. Deshalb nehmen wir …“; Nachsatz Board „… ohne Code kommt niemand in dein Konto.“, App „Ohne den Code aus deiner E-Mail kommt niemand weiter. Gib Codes nie an andere weiter – wir fragen dich nie danach.“ · .nachtlauf/screens/abnahme/mail-sicherheit/2-390-hell.png
- 390/1440 hell · Bild 3 · Punkt 2 · Text Board „Für dein Hof-Konto wurde mehrmals ein falsches Passwort eingegeben. Deshalb ist …“, App „Hallo, bei deinem Konto wurde zu oft ein falsches Passwort eingegeben …“ · .nachtlauf/screens/abnahme/mail-sicherheit/3-390-hell.png
- 390/1440 hell · Bild 5 · Punkt 2 · Text Board „Ab jetzt meldest du dich mit <neue Adresse> an. Alle Geräte sind abgemeldet.“, App „Hallo Hof Müller, am 3.3. um 07:40 wurde die Anmelde-Adresse deines Kontos geändert. Alle Geräte sind abgemeldet.“ (neue Adresse wird nicht genannt) · .nachtlauf/screens/abnahme/mail-sicherheit/5-390-hell.png
- 390/1440 hell · Bild 6 · Punkt 2 · Text Board „Gerade wollte sich jemand mit dieser Adresse neu registrieren. Warst du das? Dann melde dich einfach an.“, App „Hallo, jemand wollte sich mit deiner E-Mail-Adresse bei Agrilo registrieren. Zu dieser Adresse gibt es aber schon ein Konto.“ + eigener Absatz „Warst du das? Dann melde dich an. Hast du dein Passwort vergessen, setze es zurück.“; Schluss Board „Warst du das nicht? Dann musst du nichts tun.“, App „Warst du es nicht, kannst du diese E-Mail ignorieren. An deinem Konto hat sich nichts geändert.“ · .nachtlauf/screens/abnahme/mail-sicherheit/6-390-hell.png
- 390/1440 hell · Bild 1–6 · Punkt 2 · Anrede: Board Anrede im selben Satz („Hallo Franz Müller, am …“) bzw. ohne Anrede (Bild 2, 3, 5, 6); App immer eigene Zeile „Hallo …,“ / „Hallo,“ · .nachtlauf/screens/abnahme/mail-sicherheit/2-390-hell.png
- 390/1440 hell · Bild 1–6 · Punkt 1 · Schrift der Überschrift und der Marke „Agrilo“: Board weiche Serifenschrift (wie im Design-System), App sichtbar andere, schmalere Times-artige Serifenschrift (Ersatzschrift) · .nachtlauf/screens/abnahme/mail-sicherheit/1-390-hell.png

Begründete Ausnahmen gesehen:
- Recht vor Board (Fuß und Anbieterzeile, im Board selbst als „Vorschlag (V68/V79), Recht prüft“ markiert): Board „[Betreiber laut Impressum] · [Anschrift] · Impressum: agrilo.at/impressum“, App „Agrilo · agrilo.at/impressum“ (ohne Anschrift und ohne Wort „Impressum:“) – nicht gewertet, bleibt bei der Rechtsprüfung.
- Posteingangs-Rahmen des Boards (Posteingang, Betreff, Von/An, „Sofort“, Vorschauzeile) gehört zur Darstellung des Mailprogramms, nicht zur Mail; Betreff und Vorschauzeile sind im App-Bild nicht sichtbar und daher nicht bewertet.
- Fehlendes <title>/h1 der Vorschau-Datei (axe document-title) laut Mail-Hinweis keine Abweichung.

Nicht prüfbar:
- keine (alle 6 Bilder je Fassung erreichbar; dunkle Fassungen entfallen bei Mails)

### mail-storno

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 2 | 6 | 0 |
| 390 dunkel | – | – | – |
| 1440 hell | 2 | 6 | 0 |
| 1440 dunkel | – | – | – |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390/1440 hell · Bild 1–6 · Punkt 1 · Der Kasten „BESTELLNUMMER“ mit der großen Nummer in Serifenschrift fehlt in allen sechs Mails; die App nennt die Nummer nur fett im Fließtext (Bild 5: als Tabellenzeile „Bestellnummer“) · .nachtlauf/screens/abnahme/mail-storno/1-390-hell.png
- 390/1440 hell · Bild 3 · Punkt 2 · Board ausdrücklich „ohne ‚bestell einfach neu‘“, App hat den zusätzlichen Satz „Wenn du die Sachen noch möchtest, bestell einfach neu.“ · .nachtlauf/screens/abnahme/mail-storno/3-390-hell.png
- 390/1440 hell · Bild 4 · Punkt 2 · Board ausdrücklich „ohne ‚bestell einfach neu‘“, App hat den zusätzlichen Absatz „Die Bestellung bleibt storniert, für dich wird nichts zurückgelegt. Wenn du die Sachen noch möchtest, bestell einfach neu.“ · .nachtlauf/screens/abnahme/mail-storno/4-390-hell.png
- 390/1440 hell · Bild 4 und 6 · Punkt 1/4 · Erstattungskasten im Board grün getönt mit Rand, „Zurück an dich“ links und Betrag rechts in einer Zeile; App neutral grauer Kasten ohne Rand, „ZURÜCK AN DICH“ als kleine Versalien (11 px), Betrag darunter · .nachtlauf/screens/abnahme/mail-storno/4-390-hell.png
- 390/1440 hell · Bild 4 und 6 · Punkt 3 · „ZURÜCK AN DICH“ in 11 px, unter 12 px · .nachtlauf/screens/abnahme/mail-storno/6-390-hell.png
- 390/1440 hell · Bild 6 · Punkt 2 · Unterzeile Board „auf demselben Weg, wie du bezahlt hast“, App „Das Geld ist in 5–10 Werktagen wieder auf deinem Konto.“ · .nachtlauf/screens/abnahme/mail-storno/6-390-hell.png
- 390/1440 hell · Bild 4 · Punkt 2 · Unterzeile Board „erscheint in 5–10 Werktagen auf deinem Konto“, App „Das Geld ist in 5–10 Werktagen wieder auf deinem Konto.“ · .nachtlauf/screens/abnahme/mail-storno/4-390-hell.png
- 390/1440 hell · Bild 1 und 2 · Punkt 2 · Überschrift Board „Deine Bestellung wurde storniert“, App „Bestellung storniert“ · .nachtlauf/screens/abnahme/mail-storno/1-390-hell.png
- 390/1440 hell · Bild 1 und 2 · Punkt 2 · Schlusszeile Board „Fragen? Ruf direkt beim Hof an: +43 …“ (Telefonnummer fett), App „Bei Fragen wende dich direkt an Hof Müller.“ mit Trennlinie darüber · .nachtlauf/screens/abnahme/mail-storno/2-390-hell.png
- 390/1440 hell · Bild 2 · Punkt 2 · Bar-Satz Board „Du hättest bar bezahlt – es ist nichts zu erstatten.“, App „Da du vor Ort bezahlst, entstehen dir keine Kosten.“ · .nachtlauf/screens/abnahme/mail-storno/2-390-hell.png
- 390/1440 hell · Bild 1 · Punkt 1/2 · Erstattungskasten Board ein Absatz in normaler Schrift, nur der Betrag fett; App fette Kopfzeile „Wir haben dir € … zurückerstattet.“ und zweite Zeile grau abgesetzt · .nachtlauf/screens/abnahme/mail-storno/1-390-hell.png
- 390/1440 hell · Bild 3 · Punkt 2 · Fließtext Board ohne Anrede: „Du hast deine Bestellung bei Hof Müller nicht bis Mi, 3. März, 09:40 Uhr bestätigt. Deshalb haben wir die Ware wieder freigegeben – dir entstehen keine Kosten.“; App mit „Hallo …,“ und „… ist verfallen, weil sie nicht bestätigt wurde. Wir haben die Ware wieder freigegeben …“ – die Frist mit Datum und Uhrzeit fehlt · .nachtlauf/screens/abnahme/mail-storno/3-390-hell.png
- 390/1440 hell · Bild 3 · Punkt 1 · Board hat keine Fragen-Zeile, App fügt „Bei Fragen wende dich direkt an Hof Müller.“ mit Trennlinie hinzu · .nachtlauf/screens/abnahme/mail-storno/3-390-hell.png
- 390/1440 hell · Bild 4 · Punkt 2 · Fließtext Board „Deine Zahlung für deine Bestellung bei … ist erst angekommen, als die Bestellung schon abgelaufen war. Wir haben dir das Geld sofort zurückgeschickt.“, App „Hallo …, deine Zahlung für die Bestellung … ist angekommen – aber erst, nachdem die Bestellung schon storniert war. Deshalb haben wir …“ · .nachtlauf/screens/abnahme/mail-storno/4-390-hell.png
- 390/1440 hell · Bild 5 · Punkt 2 · Board nur „Diese E-Mail ist deine Eingangsbestätigung.“, App setzt „Wir haben deinen Rücktritt am Mittwoch, 3. März 2027, 19:40 Uhr erhalten.“ davor · .nachtlauf/screens/abnahme/mail-storno/5-390-hell.png
- 390/1440 hell · Bild 5 · Punkt 1/2 · Board-Zeile „Umfang – die ganze Bestellung“ in der Tabelle; App eigener Abschnitt „Dein Rücktritt gilt für:“ / „Die ganze Bestellung“ mit Trennlinien · .nachtlauf/screens/abnahme/mail-storno/5-390-hell.png
- 390/1440 hell · Bild 5 · Punkt 2 · „So geht es weiter“: Board zwei Sätze in normaler Schrift („… und meldet sich. Ist die Rückgabe bestätigt, kommt das Geld auf demselben Weg zurück.“), App nur der erste Satz, klein und grau · .nachtlauf/screens/abnahme/mail-storno/5-390-hell.png
- 390/1440 hell · Bild 5 · Punkt 1 · Hinweis „Bei schnell verderblicher Ware gilt das Rücktrittsrecht meist nicht – der Hof prüft das.“ fehlt in der App · .nachtlauf/screens/abnahme/mail-storno/5-390-hell.png
- 390 hell · Bild 5 · Punkt 2 · Datum Board „Mi, 3. März 2027, 19:40“, App „Mittwoch, 3. März 2027, 19:40 Uhr“, bricht in 390 auf zwei Zeilen um · .nachtlauf/screens/abnahme/mail-storno/5-390-hell.png
- 390/1440 hell · Bild 6 · Punkt 2 · Fließtext Board „Hof Müller hat die Rückgabe deiner Bestellung bestätigt.“, App „… die Rückgabe zur Bestellung HM-… bestätigt.“ · .nachtlauf/screens/abnahme/mail-storno/6-390-hell.png
- 390/1440 hell · Bild 1–4 · Punkt 2 · App beginnt mit „Hallo …,“ und Zeilenumbruch, Board schreibt die Anrede im selben Absatz weiter (Bild 3 und 4 im Board ganz ohne Anrede) · .nachtlauf/screens/abnahme/mail-storno/1-390-hell.png
- 390/1440 hell · Bild 1–6 · Punkt 1 · Überschriften im Board in der weichen Marken-Serifenschrift, App in einer schmaleren Ersatz-Serifenschrift (Times-artig); „Agrilo“-Wortmarke ebenso · .nachtlauf/screens/abnahme/mail-storno/1-1440-hell.png

Begründete Ausnahmen gesehen:
- Recht vor Board (Impressum): Bild 1–4 und 6 zeigen unter „Versandt von Agrilo im Auftrag eines Hofes.“ zusätzlich „Agrilo · agrilo.at/impressum“; Bild 5 zeigt statt der Board-Platzhalter „[Betreiber laut Impressum] · [Anschrift] · Impressum: agrilo.at/impressum“ die Zeile „Agrilo · agrilo.at/impressum“ (Board: Fuß und Anbieterzeile nur Vorschlag, Recht prüft).

Nicht prüfbar:
- keine Bilder fehlen. Hinweis: Der Posteingangs-Kopf des Boards (Betreff, Von, An, Antwort an den Hof, Marke „Wichtig“/„Sofort“, Vorschauzeile) ist in der Vorschau-Datei nicht abgebildet und darum hier nicht bewertet.

### mail-team

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 3 | 5 | 0 |
| 390 dunkel | – | – | – |
| 1440 hell | 3 | 5 | 0 |
| 1440 dunkel | – | – | – |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390 hell + 1440 hell · Bild 3 · Punkt 1 · Knopf „Admin-Zugang absichern“ fehlt in der App ganz (Board: grüner Knopf zwischen Rechte-Liste und Schlusssatz) · .nachtlauf/screens/abnahme/mail-team/3-390-hell.png, .nachtlauf/screens/abnahme/mail-team/3-1440-hell.png
- 390 hell + 1440 hell · Bild 3 · Punkt 1 · „Deine Rechte jetzt:“ ist im Board eine fette Zwischenüberschrift mit Aufzählungspunkten auf Kartengrund; in der App kleine graue Beschriftung in einem getönten Kasten, Rechte ohne Aufzählungspunkte · .nachtlauf/screens/abnahme/mail-team/3-390-hell.png, .nachtlauf/screens/abnahme/mail-team/3-1440-hell.png
- 390 hell + 1440 hell · Bild 3 · Punkt 2 · Einleitung: Board „Clara Wimmer hat dich ins Admin-Team von Agrilo aufgenommen.“, App „du wurdest ins Admin-Team von Agrilo eingeladen. Richte in den nächsten 24 Stunden deinen Passkey ein – melde dich dafür an und öffne den Admin-Bereich.“ · .nachtlauf/screens/abnahme/mail-team/3-390-hell.png, .nachtlauf/screens/abnahme/mail-team/3-1440-hell.png
- 390 hell + 1440 hell · Bild 3 · Punkt 2 · Schlusssatz: Board „Kennst du diese Änderung nicht? Melde dich bei der Projektleitung.“, App „… Antworte nicht auf diese Mail, sondern sag es sofort einer Inhaberin oder einem Inhaber.“ · .nachtlauf/screens/abnahme/mail-team/3-390-hell.png, .nachtlauf/screens/abnahme/mail-team/3-1440-hell.png
- 390 hell + 1440 hell · Bild 5 · Punkt 1 · zusätzlicher Textlink „Im Eingang öffnen“ (Board hat keinen Link); graue Zeile „Gesendet am Mi, 3. März 2027, 08:50 aus Einstellungen › Benachrichtigungen.“ fehlt · .nachtlauf/screens/abnahme/mail-team/5-390-hell.png, .nachtlauf/screens/abnahme/mail-team/5-1440-hell.png
- 390 hell + 1440 hell · Bild 5 · Punkt 2 · Überschrift Board „Testmail“, App „Testmail aus dem Postfach“; zweiter Satz Board „Wenn du diese Mail liest, stimmt die Zustellung.“, App „Diese Adresse steht auf der Liste unter Einstellungen › Benachrichtigungen.“ · .nachtlauf/screens/abnahme/mail-team/5-390-hell.png, .nachtlauf/screens/abnahme/mail-team/5-1440-hell.png
- 390 hell + 1440 hell · Bild 2 · Punkt 1 · zusätzlicher Gerätekasten „Laptop · Chrome / 3.3. um 07:40“ (Board nennt das Gerät nur im Satz) und zusätzlicher Absatz „Diese E-Mail enthält keinen Link zum Anmelden. Agrilo fragt dich nie per Mail nach einem Passkey oder Ersatzcode.“ · .nachtlauf/screens/abnahme/mail-team/2-390-hell.png, .nachtlauf/screens/abnahme/mail-team/2-1440-hell.png
- 390 hell + 1440 hell · Bild 2 · Punkt 2 · Überschrift Board „Neuer Passkey“, App „Neuer Passkey bei deinem Admin-Konto“; Satz Board „Bei deinem Admin-Konto wurde der Passkey „Laptop · Chrome“ hinzugefügt (Fr, 23. Oktober 2026, 21:20).“, App „Hallo, am 3.3. um 07:40 wurde bei deinem Admin-Konto ein neuer Passkey eingerichtet:“ (zusätzliche Anrede, Datumsformat kurz statt Wochentag/Monat/Jahr) · .nachtlauf/screens/abnahme/mail-team/2-390-hell.png, .nachtlauf/screens/abnahme/mail-team/2-1440-hell.png
- 390 hell + 1440 hell · Bild 1 · Punkt 1 · zusätzliche Überschrift „Dein Code für die Einrichtung“ in der Mail (Board: nach „Agrilo“ direkt die Anrede) und zwei zusätzliche Absätze „Du wolltest keinen Passkey einrichten? Dann melde dich bei der Projektleitung.“ und „Diese E-Mail enthält keinen Link zum Anmelden. …“ · .nachtlauf/screens/abnahme/mail-team/1-390-hell.png, .nachtlauf/screens/abnahme/mail-team/1-1440-hell.png
- 390 hell + 1440 hell · Bild 1 · Punkt 2 · Gültigkeit: Board „Der Code gilt 15 Minuten und nur einmal.“, App „Der Code gilt 10 Minuten und nur in der Sitzung, in der du ihn angefordert hast.“; Anrede Board „Hallo Jonas Pichler, gib diesen Code …“, App „Hallo,“ ohne Namen mit Zeilenumbruch · .nachtlauf/screens/abnahme/mail-team/1-390-hell.png, .nachtlauf/screens/abnahme/mail-team/1-1440-hell.png
- 390 hell + 1440 hell · Bild 1 · Punkt 4 · Code-Kasten: Board neutraler Flächenton ohne Rand, Ziffern in der Überschriften-Serifenschrift gruppiert „482 917“; App grünlich getönt mit grünem Rand, Ziffern in Festbreitenschrift ungruppiert „4 8 2 9 1 7“ · .nachtlauf/screens/abnahme/mail-team/1-390-hell.png, .nachtlauf/screens/abnahme/mail-team/1-1440-hell.png
- 390 hell + 1440 hell · Bild 4 · Punkt 2 · Text Board „Clara Wimmer hat dich als Empfänger für Betriebs-Mails eingetragen. Bitte bestätige deine Adresse:“, App „Jemand aus dem Team von Agrilo hat diese Adresse für die Betriebs-Mails eingetragen: neue Höfe, Fehlermeldungen, offene Erstattungen. Öffne den Link und tippe auf der Seite auf „Adresse bestätigen“. Erst dann schicken wir dir etwas.“ · .nachtlauf/screens/abnahme/mail-team/4-390-hell.png, .nachtlauf/screens/abnahme/mail-team/4-1440-hell.png
- 390 hell + 1440 hell · Bild 4 · Punkt 1 · zusätzlicher Absatz „Wenn du damit nichts zu tun hast, ignorier diese Mail. Dann bekommst du nichts von uns.“ unter „Der Link gilt 48 Stunden.“ · .nachtlauf/screens/abnahme/mail-team/4-390-hell.png, .nachtlauf/screens/abnahme/mail-team/4-1440-hell.png
- 390 hell + 1440 hell · Bild 1–4 · Punkt 2 · Anbieterzeile im Fuß: Board „[Betreiber laut Impressum] · [Anschrift] · Impressum: agrilo.at/impressum“, App „Agrilo · agrilo.at/impressum“ (Board markiert die Zeile als Vorschlag V68/V79, Recht prüft – kein Ausnahmefall aus der Liste) · .nachtlauf/screens/abnahme/mail-team/1-390-hell.png, .nachtlauf/screens/abnahme/mail-team/1-1440-hell.png
- 390 hell + 1440 hell · Bild 1–5 · Punkt 1 · Schrift von „Agrilo“ und Überschrift: Board zeigt die Marken-Serifenschrift, App eine Ersatz-Serifenschrift (Times-artig, fetter, breiter) · .nachtlauf/screens/abnahme/mail-team/2-390-hell.png, .nachtlauf/screens/abnahme/mail-team/2-1440-hell.png
- 390 hell + 1440 hell · Bild 1 · Punkt 2 · Anführungszeichen „Admin-Zugang absichern" mit geradem Schlusszeichen statt “ · .nachtlauf/screens/abnahme/mail-team/1-390-hell.png, .nachtlauf/screens/abnahme/mail-team/1-1440-hell.png

Begründete Ausnahmen gesehen:
- keine aus der Liste (Mail-Hinweis beachtet: fehlendes <title>/h1 der Vorschau-Datei nicht als Abweichung gewertet).

Nicht prüfbar:
- keins, alle 10 Bilder erreichbar. Hinweis: Der Posteingangs-Rahmen des Boards (Betreff mit „· Agrilo“, Von/An, Marke „Sofort“/„Wichtig“, Vorschauzeile) stellt das Mail-Programm dar und ist im App-Bild der Vorschau-Datei nicht sichtbar; Betreff und Vorschauzeile wurden daher nicht bewertet.

### mail-zugang

| Fassung | Sterne | Bilder geprüft | nicht prüfbar |
|---|---|---|---|
| 390 hell | 3 | 4 | 0 |
| 390 dunkel | – | – | – |
| 1440 hell | 3 | 4 | 0 |
| 1440 dunkel | – | – | – |

Mängel (je Zeile: Fassung · Bild · Maßstab-Punkt · was weicht ab · App-Bild-Pfad):
- 390/1440 hell · Bild 4 · Punkt 1+2 · zwei zusätzliche Absätze, die das Board nicht hat: „Bis dahin kannst du deinen Hof schon einrichten. Fotos hochladen und die Freischaltung gehen, sobald die Adresse bestätigt ist.“ und „Du hast dich nicht bei Agrilo registriert? Dann kannst du diese E-Mail einfach ignorieren.“; Board endet nach dem Knopf mit „Der Link gilt 24 Stunden.“ · .nachtlauf/screens/abnahme/mail-zugang/4-390-hell.png, .../4-1440-hell.png
- 390/1440 hell · Bild 4 · Punkt 2 · Einleitung: Board „Hallo, schön, dass du deinen Hof bei Agrilo einrichtest. Bitte bestätige noch deine E-Mail-Adresse:“, App „Hallo,⏎schön, dass du deinen Hof bei Agrilo einrichtest. Bitte bestätige noch kurz, dass diese E-Mail-Adresse dir gehört. Öffne dazu den Link und tippe auf der Seite auf „E-Mail bestätigen“.“; Fristsatz Board „Der Link gilt 24 Stunden.“, App „Der Link gilt **24 Stunden**. Danach kannst du dir nach dem Anmelden einen neuen schicken lassen.“ · .nachtlauf/screens/abnahme/mail-zugang/4-390-hell.png, .../4-1440-hell.png
- 390/1440 hell · Bild 1 · Punkt 1 · zusätzliche Überschrift „Dein Anmeldecode“ im Mailkörper; das Board hat unter „Agrilo“ keine Überschrift, sondern direkt den Begrüßungssatz · .nachtlauf/screens/abnahme/mail-zugang/1-390-hell.png, .../1-1440-hell.png
- 390/1440 hell · Bild 2 · Punkt 1 · zusätzliche Überschrift „Dein Code für deine Bestellungen“ im Mailkörper; Board ohne Überschrift im Körper · .nachtlauf/screens/abnahme/mail-zugang/2-390-hell.png, .../2-1440-hell.png
- 390/1440 hell · Bild 2 · Punkt 2 · Hinweissatz: Board „Du hast keinen Code angefordert? Dann ignorier diese Mail einfach.“, App „Du wolltest deine Bestellungen nicht ansehen? Dann kannst du diese E-Mail einfach ignorieren. Gib den Code nie an andere weiter – wir fragen dich nie danach.“ (anderer Satz plus zusätzlicher Satz) · .nachtlauf/screens/abnahme/mail-zugang/2-390-hell.png, .../2-1440-hell.png
- 390/1440 hell · Bild 1 · Punkt 2 · Hinweissatz: Board „Dann ignorier diese Mail einfach. Gib den Code nie weiter – wir fragen dich nie danach.“, App „Dann kannst du diese E-Mail einfach ignorieren. Gib den Code nie an andere weiter – wir fragen dich nie danach.“ · .nachtlauf/screens/abnahme/mail-zugang/1-390-hell.png, .../1-1440-hell.png
- 390/1440 hell · Bild 3 · Punkt 2 · Einleitung: Board „Hallo Franz Müller, du möchtest ein neues Passwort für dein Hof-Konto. Tipp auf den Knopf unten:“, App „Hallo,⏎du möchtest das Passwort für dein Agrilo-Konto zurücksetzen. Tipp auf den Knopf unten und wähle ein neues Passwort.“ (ohne Namen, „Agrilo-Konto“ statt „Hof-Konto“) · .nachtlauf/screens/abnahme/mail-zugang/3-390-hell.png, .../3-1440-hell.png
- 390/1440 hell · Bild 3 · Punkt 2 · Fristsatz: Board „Dieser Link ist 1 Stunde gültig und funktioniert nur einmal.“, App „… gültig und kann nur einmal verwendet werden.“; Hinweis: Board „Du warst das nicht? Dann ignorier diese Mail – dein Passwort bleibt, wie es ist.“, App „Falls du das nicht angefordert hast, ignoriere diese E-Mail. Dein Passwort bleibt unverändert.“ · .nachtlauf/screens/abnahme/mail-zugang/3-390-hell.png, .../3-1440-hell.png
- 390/1440 hell · Bild 3 · Punkt 1 · Knopf „Neues Passwort wählen“ mittig gesetzt mit großem Abstand oben und unten; im Board linksbündig unter dem Text (wie in Bild 4) · .nachtlauf/screens/abnahme/mail-zugang/3-390-hell.png, .../3-1440-hell.png
- 390/1440 hell · Bild 1–4 · Punkt 2 · Anbieterzeile im Fuß: Board „[Betreiber laut Impressum] · [Anschrift] · Impressum: agrilo.at/impressum“, App „Agrilo · agrilo.at/impressum“ (Betreiber- und Anschrift-Feld fehlen, „Impressum:“ fehlt; laut Bildtitel Vorschlag V68/V79, Recht prüft) · .nachtlauf/screens/abnahme/mail-zugang/1-390-hell.png (gleich in 2–4, 390 und 1440)
- 390/1440 hell · Bild 1–4 · Punkt 2 · Begrüßung in zwei Zeilen („Hallo,“ und Umbruch); im Board ein durchlaufender Satz „Hallo, gib diesen Code …“ / „Hallo, schön, dass …“ · .nachtlauf/screens/abnahme/mail-zugang/1-390-hell.png (gleich in 2–4)
- 390/1440 hell · Bild 1+2 · Punkt 1 · Code-Feld: App zeigt den Code ungegliedert in Festbreitenschrift („615204“, „730254“) in grün getöntem Kasten mit Rahmen; Board zeigt ihn in der Serifen-Anzeigeschrift, in Dreiergruppen („615 204“) auf neutraler Fläche ohne Rahmen · .nachtlauf/screens/abnahme/mail-zugang/1-390-hell.png, .../2-390-hell.png
- 390/1440 hell · Bild 1–3 · Punkt 2 · Frist fett hervorgehoben („**10 Minuten**“, „**1 Stunde**“, in Bild 4 „**24 Stunden**“); im Board normaler Schnitt · .nachtlauf/screens/abnahme/mail-zugang/1-390-hell.png (gleich in 2–4)
- 390/1440 hell · Bild 1–4 · Punkt 1 · Schriftwirkung: Marke „Agrilo“ und Überschriften erscheinen in einer Times-ähnlichen Ersatzschrift, im Board in der schmaleren Serifen-Anzeigeschrift; Überschriften in Bild 3/4 sichtbar kleiner als im Board · .nachtlauf/screens/abnahme/mail-zugang/3-390-hell.png, .../4-390-hell.png
- 1440 hell · Bild 1–4 · Punkt 1 · Karte füllt die 600-px-Breite fast randlos (12 px Rand); im Board steht die Karte mit sichtbar mehr Rand auf der Fläche · .nachtlauf/screens/abnahme/mail-zugang/1-1440-hell.png

Begründete Ausnahmen gesehen:
- keine (Kontrast, Schriftgröße und Knopfgröße im Bild unauffällig; der Inline-Link „agrilo.at/impressum“ im Fuß ist ein Textlink und darf kleiner als 44 px sein)

Nicht prüfbar:
- keines (alle Bilder erreichbar). Hinweis: Betreff, Absender und Vorschauzeile zeigt das Board im Posteingangs-Rahmen; die App-Bilder zeigen nur den Mailkörper, diese Zeilen sind im Bild nicht zu sehen und daher nicht bewertet. Dunkle Fassungen entfallen (Mails nur hell).

