# FarmerZone — Gesamt-Spezifikation für Claude Code

Regionale Verkaufsplattform für Bauern in Österreich. Next.js, mobile-first.
Dieses Dokument bündelt ALLE Seiten: Bauer-Admin (6 Seiten) + Kundenansichten + Checkout.

## Referenz-Dateien (im Browser öffnen, Werte aus Inline-Styles übernehmen — nie schätzen)
- `19 Admin Unterseiten.dc.html` — Admin komplett: Sidebar klickbar, alle 6 Seiten (Übersicht, Bestellungen, Kunden, Meine Hof-Seite, Verkauf, Auswertung); auf „Meine Hof-Seite" zusätzlich Umschalter Bearbeiten/Kundenansicht
- `18 Hof-Seite Status Galerie.dc.html` — Hof-Seite groß: Status-Composer, Feed, Fotogalerie, Tab-Leiste (Detail-Spezifikation in `README-status-galerie.md`)
- `17 Hof-Profil Kundenansicht.dc.html` — Hof-Profil, wie KUNDEN es sehen (Web, Etsy-Navigation)
- `16 Hofladen Komplett.dc.html` — Kunden-Flow mobil (M1–M5) + Web (D1 Marktplatz, D2 Checkout)
- `README.md` (v3.1) — Basis: Sidebar, Top-Leiste, Cover, Siegel, Produktkarten, Icon-Zuordnung, Bild-Verwaltung
- `support.js` / `image-slot.js` sind Prototyp-Laufzeit — NICHT portieren.

## Design-Tokens
- Farben: Primary `#2D5F3F` (dunkel `#24523A`, hell `#7BAE85`), Accent (CTAs, sparsam) `#E8854A`, Flächen `#F5F3EE`, Karten `#fff`, Sand `#F2ECDC`/`#F0EDE5`, Erdton-Text `#8B6247`/`#6E5F45`, Text `#2D3027`, Sekundär `#5C6052`, Tertiär `#9AA08F`, Linien `#ECE8DF`/`#F0EDE5`, Bio-Grün-Fläche `#E8F0E2`, Holzkante `linear-gradient(90deg,#B08054,#8B6247 35%,#A87C52 70%,#8F6A48)` (6px)
- Typo: Inter (Body), Fraunces (Headlines & große Zahlen). Radien: 12–14px Karten, 8px Buttons, 20px Pillen. Schatten: `0 2px 10px rgba(45,95,63,0.06)`
- Icons: Lucide, strokeWidth 1.7 — keine Emojis (Emojis in den Prototypen sind Platzhalter)
- Sprache: Deutsch, freundlich, ohne Software-Begriffe („Fertig melden", nicht „Status ändern")
- Status-Pillen: Neu = `#E8854A` auf `#FBEEE3` · In Arbeit/Bezahlt = `#2D5F3F` auf `#E8F0E2` · Erledigt/neutral = `#9AA08F` auf `#F0EDE5`

## Admin-Bereich (Bauer)

### Layout
Sidebar 232px, `#24523A`, fix links. Kopf: „HOF" (11px `#8FC49B`) + Hofname (Fraunces 19px weiß) + Inhabername. Navigation: Übersicht, Bestellungen (Badge orange = offene), Kunden, Meine Hof-Seite, Verkauf, Auswertung; unten abgetrennt Einstellungen, Abmelden. Aktiver Punkt = helle Pille `#F5F3EE`, Text `#24523A`; inaktiv `#CFE4D6`. Inhalt auf `#F5F3EE`, padding 28px 36px.
Seitentitel: Fraunces 27px/600. Zeitraum-/Filterwahl: Segment-Control (`#F0EDE5`-Wanne, aktives Segment `#24523A` weiß).

### 1. Übersicht (Dashboard)
- Begrüßung („Guten Morgen, {Vorname}") über dem Titel; rechts oben oranger CTA „+ Produkt anlegen"
- 4 Kennzahl-Karten: Neue Bestellungen / Umsatz Woche / Aktive Produkte / Hof-Follower. Wert Fraunces 28px; Delta-Zeile grün (`▲ …`) oder orange (Warnung)
- Karte „Heute zu erledigen" mit Holzkante: Bestellzeilen (Initialen-Avatar rund `#E8F0E2`, Name, Produkte+Abholtag, Status-Pille, Summe rechts grün); Kopf-Link „Alle Bestellungen →"
- Darunter 2 Hinweis-Karten mit Aktion: Lager-Warnung („nur noch 3 verfügbar" → „Lager auffüllen") und Status-Erinnerung („Letzter Status vor 6 Tagen" → „Status schreiben")

### 2. Bestellungen
- Segmente: Offen (n) / Fertig / Alle
- Gruppiert nach Abholtag: Zwischenüberschrift „ABHOLUNG MITTWOCH, 15. JULI" (13px/700 `#8B6B4F`, letter-spacing)
- Tabelle: KUNDE (Avatar, Name, Zeitfenster) · PRODUKTE (bei Gewichtsware Hinweis „(wiegen!)") · SUMME (Gewichtsware „ca.") · STATUS · AKTION
- Aktions-Progression pro Bestellung: **Packen** (grün gefüllt) → **Fertig melden** (Ghost grün) → **Bezahlt ✓** (Ghost neutral; kassiert bei Abholung)
- Fußbanner Sand: „{Betrag} offen — wird bei Abholung kassiert. Nach Übergabe auf ‚Bezahlt ✓' tippen …"

### 3. Kunden
- Suchfeld rechts oben. 3 Kennzahlen: Folgen deinem Hof / Stammkunden (3+ Bestellungen) / Neue Kunden im Monat
- Kundenliste: Avatar, Name + Badge „★ Stammkunde" (Sand `#F2ECDC`/`#6E5F45`), Ort + „folgt seit …", letzte Bestellung, Gesamtumsatz (grün), Button „✉ Nachricht"

### 4. Meine Hof-Seite
Titelzeile: Titel + URL `farmerzone.at/{slug}` + Kopieren/Teilen (Ghost) + Segment-Umschalter **✎ Bearbeiten / 👁 Kundenansicht** (einziger Seiten-State `mode`).
Inhalt = die Hof-Seite selbst (Details + beide Modi verbindlich in `README-status-galerie.md` und `README.md`):
- Cover mit Siegel, Name + Badge-Pillen; edit: „📷 Titelbild ändern", ✎ an Badges
- Tab-Leiste direkt unter dem Cover: Übersicht · Produkte · Fotos · Bewertungen (aktiv = 700 `#2D5F3F` + 3px Unterstrich, inaktiv 600 `#9AA08F`)
- Tab-Leiste direkt unter dem Cover (beide Modi): Übersicht · Produkte · Fotos · Bewertungen — weiße Leiste, border-bottom `#ECE8DF`; aktiv = 700 `#2D5F3F` + 3px Unterstrich, inaktiv 600 `#9AA08F`
- Status-Composer (nur edit): Avatar + „Was gibt's Neues am Hof, {Vorname}?", Chips Foto / Frisches Produkt / Produkt verlinken, grüner „Veröffentlichen"
- Status-Feed (beide Modi): Badge, Zeit, Titel Fraunces, Text, ❤/💬, „Produkt ansehen →"; edit: ✎/🗑
- Fotogalerie: Aufmacher 2×2 + Raster; edit: „+ Fotos hinzufügen" + gestrichelte Kachel; preview: „+8 Fotos"-Overlay, „Alle ansehen →"
- Produkte: edit → Kachel „Produkt anlegen" + je Karte „✎ Bearbeiten"/„📦 Lager", Bestandszeile am Bildrand („Nur noch 3 verfügbar" orange / „75 verfügbar" sand / „Ausgeblendet – nur du siehst es" hell, Karte gedimmt 0.55), Zähler „2 sichtbar / 1 ausgeblendet"; preview → oranger „🧺 In den Korb", versteckte Produkte unsichtbar, Zähler „2 Produkte"

### 5. Verkauf
- Segmente: Monat aktuell / Vormonat / Jahr
- 3 Karten: **Nächste Auszahlung** (dunkelgrüner Verlauf, weiß, Betrag Fraunces 28px, „am 31. Juli auf AT12 …") · Online bezahlt (n Bestellungen, abzügl. Gebühren) · Bar am Hof kassiert (offener Betrag orange)
- Liste „Letzte Zahlungen": Icon-Kachel (💳 online `#E8F0E2` / 💶 bar `#F2ECDC`), „{Name} · #{Nr}", Datum+Zahlart, Status-Pille (Bezahlt/Offen/Ausgezahlt), Betrag rechts

### 6. Auswertung
- Segmente Woche/Monat/Jahr
- Umsatz-Balkendiagramm (Wochentage): **Abholtage orange `#E8854A`, übrige `#7BAE85`**; Summe rechts oben Fraunces; Erklärzeile („Orange = Abholtage …") — Sprache einfach halten
- Karte „Meistverkauft": Rang-Kachel, Name, Fortschrittsbalken `#7BAE85` auf `#F0EDE5`, Stückzahl
- 3 Kennzahlen: Seitenbesuche / Besuch → Bestellung / Ø Korbwert (Delta grün)

## Kundenansichten (Käufer)

### Web-Navigation (Etsy-Muster, Referenz 17 + 16/D1)
Header 68px weiß: Logo (Fraunces 22px grün) · „Kategorien" · große Suche (2px Rand `#2D3027`, radius 24px, orange runde Such-Taste) · Region-Pille „📍 {Region}" · Merken (Herz) · Korb mit orangem Zähler · Avatar. Darunter Kategorie-Zeile; auf Profilseiten Breadcrumb „Marktplatz › Höfe in {Ort} › {Hof}".

### Mobile Navigation (Shipt-Muster, Referenz 16/M1)
Bottom-Tabs: Start · Suchen · Bestellungen · Profil. Outline-Icons 21px + Label 11px; aktiv gefüllt `#2D5F3F`, inaktiv `#9AA08F`. Hit-Targets ≥44px.

### Hof-Profil (Kundensicht, Referenz 17)
Grünes Cover mit Siegel + Name + Badge-Pillen weiß; Aktionsleiste (4,9 ★ · Abholtage · Zahlungsinfo | „Teilen" Ghost + „Hof folgen" grün); links Status-Karte mit Holzkante, „Nächste Abholung" (2 Tag-Karten), Über den Hof + Kontakt; rechts Produktraster 3-spaltig mit orangem Korb-Button; Fußzeile Wiegen/Zahlung.

### Produktdetail Gewichtsware (Referenz 16/M3, Instacart-Anatomie)
„≈ 500 g pro Packung · 30,00 € / kg" → Preis „**ca. 15,00 €** (geschätzt)" (Zusatz `#8B6247`) → Sand-Hinweis „⚖️ Endpreis nach dem Wiegen am Hof — kann leicht abweichen." Mengen-Stepper 42px-Tasten. Fixe Leiste unten: „Geschätzt {Summe}" + oranger „In den Korb".

### Checkout „Abholung & Reservierung" (Referenz 16/M4 + D2, Panera-Muster)
- Zeitwahl zweispaltig: links TAG (Label + „n Fenster frei"/„ausgebucht"), rechts ZEITFENSTER (2er-Raster am Desktop); gewählt = grün 700 + 2px Unterstrich, ausgebucht = `#B4B09F` + gedimmt, nicht wählbar; Tagwechsel setzt Slot zurück
- Bezahlung: 2 Karten — **„Bei Abholung am Hof"** (vorgewählt, 2px Rand grün, Häkchen-Kreis; „Bar oder Karte — du reservierst nur.") · „Jetzt online zahlen" („Endbetrag folgt nach Wiegen")
- Summary (Desktop rechts, 360px): Positionen mit „ca."-Kennzeichnung, „Gesamt (geschätzt)" grün, Sand-Wiegehinweis, oranger CTA „Jetzt reservieren", darunter „Kostenlos stornierbar bis 24 h vor Abholung"
- CTA mobil: „Reservieren · {Tag} · {Slot}" (live aus der Auswahl)

### Bestätigung (Referenz 16/M5)
Grüner Häkchen-Kreis 88px, „Reserviert!", Terminzeile fett; dunkelgrüne Karte mit **Abholnummer #{n}** + Zahlart; Positionsliste mit „(gesch.)"; Sand-Hinweis „Endbetrag steht nach dem Wiegen fest — du zahlst erst am Hof"; CTAs „Bestellung ansehen" (orange) / „Weiter stöbern" (Text).

## Datenmodell (Kern)
- `Produkt { name, preis, einheit, gewichtsware: bool, kgPreis?, ca-Gewicht?, bio: bool, bestand, ausgeblendet: bool }`
- `Bestellung { nr, kunde, positionen[], abholTag, zeitfenster, status: 'neu'|'packen'|'fertig'|'abgeholt', zahlung: 'am_hof'|'online', bezahlt: bool, summeGeschätzt, summeFinal? }`
- `Status { titel, text, bild?, badge, produktRef?, erstelltAm, reaktionen, kommentare }` · `Foto { url, unterschrift?, reihenfolge }`
- `Kunde { name, ort, folgtSeit, bestellungen, umsatz, stammkunde: bool }`

## Claude-Code-Prompt (kopierfertig)
```
Setze FarmerZone nach der Design-Referenz in design_handoff_hof_seite/ um.

1. Lies README-gesamt.md vollständig (Seitenliste, Tokens, Datenmodell),
   dann README.md (v3.1, Basis-Bausteine) und README-status-galerie.md
   (Composer/Galerie im Detail).
2. Öffne die Referenz-HTMLs im Browser:
   - „19 Admin Unterseiten.dc.html" — Sidebar durchklicken, alle 6
     Admin-Seiten; auf „Meine Hof-Seite" beide Modi umschalten
   - „17 Hof-Profil Kundenansicht.dc.html" — Kundensicht Web
   - „16 Hofladen Komplett.dc.html" — Kunden-Flow mobil M1–M5 + Web D1/D2
   Maße, Farben, Radien, Abstände aus den Inline-Styles übernehmen —
   nichts schätzen, nichts dazuerfinden.
3. Die HTMLs sind Referenz, kein Produktionscode: mit unseren
   Next.js-Patterns nachbauen. support.js/image-slot.js NICHT portieren.
4. States: Admin-Navigation = Routing; „Meine Hof-Seite" hat genau
   einen Seiten-State mode = 'edit' | 'preview' (Regeln in den READMEs).
   Checkout: Tag-/Slot-Wahl wie beschrieben (Tagwechsel setzt Slot
   zurück, ausgebuchte nicht wählbar), CTA-Label live aus der Auswahl.
5. Bestell-Progression: Packen → Fertig melden → Bezahlt ✓;
   Gewichtsware überall mit „ca. … (geschätzt)" + Wiegehinweis.
6. Icons: Lucide strokeWidth 1.7 (Zuordnung README v3.1). Alle Emojis
   der Prototypen durch Lucide-Icons ersetzen. Deutsch, keine
   Software-Begriffe.
7. Mobile: Bottom-Tabs (Start/Suchen/Bestellungen/Profil),
   Hit-Targets ≥ 44px.

Gleiche am Ende jede Seite (6 Admin-Seiten, Hof-Profil Kundensicht,
Marktplatz, Produktdetail, Checkout, Bestätigung — je Web und mobil,
„Meine Hof-Seite" in beiden Modi) einzeln gegen die Referenz ab und
liste Abweichungen auf.
```
