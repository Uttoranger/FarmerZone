# Mockups

Eigenständige HTML-Dateien, direkt im Browser zu öffnen. Alle Farben, Abstände, Radien und Texte stehen als Inline-Styles im Markup und dürfen exakt ausgelesen werden. Geteilte Bausteine (Seitenleiste, eingebettete Seiten in Vorschauen und Dialogen) sind zur Ansicht eingebettet; im Code sind sie **eine** Komponente.

Stand 23.10.2026 (aufgeräumt nach Lauf 22): Die Kernabschnitte zeigen den gebauten Stand; die Gründungshöfe, die Bilder, Entdecken v2, Region v2/v3, Beiträge v2, Mein Hof v3, Betrieb und die Anmeldung stehen jetzt in ihren Abschnitten. Abgelöste Mockups stehen unten unter ARCHIV (nicht mehr bauen), offene Vorschläge und Ideen darüber. Seit 15.10.2026 zeigen alle Mockups die Marke Agrilo (Bildmarke klein + Wort, Register M1, Nr. 92), die Hof-Seitenleiste mit Postfach und Tarif-Zeile (Nr. 61, 86/87), die Handy-Leiste Heute · Bestellungen · Neu · Mein Hof · Mehr (N3), das Mehr-Blatt mit Postfach und Produkten, die Startseite mit Regionskarte (Nr. 59) und die Hofseite ohne Telefonnummer vor dem Kauf (Nr. 60). Die Kasse (Nr. 82) und das Hof-Postfach (Nr. 86/87) stehen jetzt in den Kernzeilen K3 und H6.

Farben sind auf das dunkle Standard-Theme aufgelöst. Die verbindlichen Token-Paare stehen in `../ai/DESIGN_SYSTEM.md`. Beispieldaten (Höfe, Namen, Preise, Nummern) sind Platzhalter.

**Dateinamen:** `web-` oder `mobil-`, dann der Schritt im Ablauf (`k0`–`k4` Kunde, `h0`–`h6` Hof), dann der Bildschirm. `admin-`, `fehler-` und `system-` sind Querschnitt.

**Spalte Arbeit:** *Umbau* = bestehende Route ins neue Design und um die gezeigten Funktionen erweitern · *neu* = Route oder Funktion gibt es noch nicht · *Zustand* = Variante einer Route (leer, Fehler, Hinweis) · *zurückgestellt* = wird vorerst nicht gebaut, Grund im Entscheidungsregister `../entscheidungen.md`. · *Konzept* = Schaubild, kein Bildschirm · *Dokumentation* = zeigt den gebauten Stand

## WEB · Kunde – K0 Ankommen (vor dem Anmelden)

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `web-k0-startseite.html` | K0 · Startseite | `/` | Umbau | 1440×3360 |
| `web-k0-anmelden-kunde-code-hof-passwort.html` | K0 · Anmelden (Kunde Code, Hof Passwort) | `/account/login, /login` | Umbau | 1440×860 |
| `web-k2-startseite-gruendung.html` | Startseite am Computer · Für-Höfe-Band mit dem Gründungssatz | `/` (Für-Höfe-Band) | Zustand | 1440×3390 |

## WEB · Kunde – K1 Finden

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `web-k1-entdecken-einstieg.html` | K1 · Entdecken – Einstieg · Hofkarte, Abholzeile, Filter Abholung und Seitenfuß: siehe `system-k1-entdecken-v2.html` | `/hoefe` | Umbau | 1440×1180 |
| `web-k1-filter-futtermittel.html` | K1 · Filter Futtermittel | `/hoefe?bereich=futter` | Umbau | 1440×1100 |
| `web-k1-suche-filter.html` | K1 · Suche + Filter | `/hoefe?q=…` | Umbau | 1440×1000 |
| `web-k1-leerzustand.html` | K1 · Leerzustand | `/hoefe (leer)` | Zustand | 1440×1000 |
| `system-k1-ortssuche-zustaende.html` | K1 · Ortssuche nach dem Fix: PLZ+Ort in einem, mehrere Orte zur Wahl, Standort nur ungefähr (Hinweis + GPS-Nachfrage) | `/hoefe` | Fix (Ortssuche) | 1000×560 |
| `system-k1-entdecken-v2.html` | Vorschlag 19.10. · Entdecken v2: Hofkarte in drei Varianten (A Produktzeilen mit Preis empfohlen, B Bildkacheln, C wie heute), Abholzeile in sechs Lagen, am Handy Liste, Liste weiter unten (Hof ohne Kartenpunkt, Bildfläche ohne Foto, „Noch nicht bestellbar“, Seitenfuß), Filter-Blatt mit „Wann holst du ab?“, Karte mit Namen am Pin, Leerzustand „Heute holt hier kein Hof mehr ab“; am Computer Splitscreen mit Pin-Vorschau, Pin-Zustände, Seitenfuß, Kennzahlen; Regeln | `/hoefe` (Liste, Karte, Filter-Blatt), KundeShell (Seitenfuß) | Umbau (freigegeben 19.10.2026, Nr. 120) | 2640×3560 |

## WEB · Kunde – K2 Hof und Produkte ansehen

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `web-k2-hofseite.html` | K2 · Hofseite | `/[farmSlug]` | Umbau | 1440×1500 |
| `web-k2-alle-produkte-nach-kategorie.html` | K2 · Alle Produkte nach Kategorie | `/[farmSlug] Reiter Produkte` | Umbau | 1440×2420 |
| `web-k2-futter-groesse-waehlen.html` | K2 · Futter: Größe wählen | `/[farmSlug]/produkt/[id] (neu)` | neu | 1440×1500 |
| `web-k2-brennmaterial-brennholz.html` | K2 · Brennmaterial: Brennholz | `/[farmSlug]/produkt/[id] (neu)` | neu | 1440×1560 |
| `system-k2-titelbild-computer.html` | K2 · Titelbild der Hofseite am Computer: Querformat füllt mit Fokuspunkt, Quadrat und Hochformat stehen ganz mit weichem Rand; Höhe 300/360/420 px nach Breite, ab 1 920 px nicht weiter aufgezogen | `/[farmSlug]` | Fix (Nr. 89); Wahl füllen/ganz je Hof ab Nr. 97 | 1440×1500 |

## WEB · Kunde – K3 Kaufen

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `web-k3-kasse-glatt.html` | K3 · Kasse geglättet: vier flache Karten (Korb → Abholung → Deine Daten → Bezahlen), Online bleibt vorbelegt, Erklärung je Option, Gebühr „entfällt“ bei Bar | `/[farmSlug]/checkout` | Umbau (Kasse glätten) | 1440×1000 |
| `system-k3-kasse-bezahlen-bar.html` | Komponente – Zustand „Bar gewählt“: Gebühr „entfällt“, Knopf „Zahlungspflichtig bestellen“, kein Stripe-Satz | `/[farmSlug]/checkout` | Umbau (Kasse glätten) | 1000×420 |
| `web-k3-zahlung-abgelehnt.html` | K3 · Zahlung abgelehnt | `/[farmSlug]/checkout (Fehler)` | Zustand | 1440×1180 |
| `web-k3-bestaetigung-online-mit-erzaehl-s-weiter.html` | K3 · Bestätigung (online) mit „Erzähl's weiter" | `/[farmSlug]/confirm/[orderId]?sig=` | Umbau | 1440×1200 |
| `web-k3-bar-wartet-auf-bestaetigung.html` | K3 · Bar: wartet auf Bestätigung | `/[farmSlug]/confirm/[orderId] (bar, offen)` | Zustand | 1440×900 |
| `web-k3-bar-bestellung-bestaetigen-link-aus-mail.html` | K3 · Bar: Bestellung bestätigen (Link aus Mail) | `/[farmSlug]/bestaetigen/[token] (neu, H3)` | neu | 1440×820 |
| `web-k3-e-mails-web-mobil.html` | K3 · E-Mails (Web + Mobil) | `src/emails/*` | Umbau | 680×1320 |

## WEB · Kunde – K4 Nach dem Kauf

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `web-k4-meine-bestellungen-konto.html` | K4 · Meine Bestellungen & Konto | `/account/profile` | nur Umbau bestehender `/account`-Seiten (E8) | 1440×1060 |
| `web-k4-bestellung-hof-erreichen.html` | K4 · Bestellung ansehen: Hof erreichen | `/[farmSlug]/bestellung/[orderId], /[farmSlug]/confirm/[orderId]` | Umbau (Nr. 60) | 1440×640 |

## WEB · Hof – H0 Kennenlernen (vor dem Registrieren)

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `web-h0-fuer-hoefe.html` | H0 · Für Höfe | `/fuer-hoefe (neu)` | neu | 1440×3080 |
| `web-h0-hof-registrieren.html` | H0 · Hof registrieren | `/register` | Umbau | 1440×1000 |
| `web-k2-fuer-hoefe-gruendung.html` | /fuer-hoefe am Computer · Pill, Knopf „Gründungshof werden", Fußnote; Angebotszeile über den Preisen; Hofladen 0 € bis 31.12.2027 | `/fuer-hoefe` | Zustand | 1440×3170 |
| `web-k2-registrieren-gruendung.html` | Hof registrieren am Computer · Satz über dem Formular mit voraussichtlicher Nummer | `/register` | Zustand | 1440×1070 |

## WEB · Hof – H1 Starten und Hof einrichten

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `web-h1-einrichten.html` | H1 · Einrichten | `/onboarding` | Umbau | 1440×1020 |
| `web-h1-mein-hof-vorschau-handy.html` | H1 · Mein Hof – Vorschau Handy | `/farm-page` | Umbau | 1440×1150 |
| `web-h1-mein-hof-vorschau-web.html` | H1 · Mein Hof – Vorschau Web | `/farm-page` | Umbau | 1440×1150 |
| `web-h1-vorschau-vergroessert.html` | H1 · Vorschau vergrößert | `/farm-page (Overlay)` | Zustand | 1440×1080 |
| `web-h1-einstellungen-uebersicht.html` | H1 · Einstellungen (Übersicht) | `/settings` | Umbau | 1440×900 |
| `web-h1-einstellungen-konditionen-v2.html` | H1 · Einstellungen › Konditionen, Fassung 2 | `/settings/konditionen` | Umbau (Nr. 61), ersetzt die erste Fassung | 1440×1210 |
| `web-h1-freigeschaltet-jetzt-teilen.html` | H1 · Freigeschaltet – jetzt teilen | `/dashboard (einmalig)` | neu | 1440×960 |
| `web-h1-titelbild-ausschnitt.html` | H1 · Mein Hof – Titelbild: Ausschnitt ziehen (Fokus waagrecht/senkrecht), Zoom, „Ausschnitt füllen“ oder „Ganz zeigen“, sechs Filter; rechts die Vorschau mit dem Foto über die ganze Breite | `/farm-page` (Baustein Titelbild, ab lg in der Zeile) | neu (Nr. 97, N13/N17) | 1440×1150 |

## WEB · Hof – H2 Angebot pflegen

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `web-h2-produkte.html` | H2 · Produkte | `/products` | Umbau | 1440×900 |
| `web-h2-neu-was-legst-du-an.html` | H2 · Neu: Was legst du an? | `Neu-Menü → /products` | neu | 1440×900 |
| `web-h2-neues-futter.html` | H2 · Neues Futter | `/products (Formular Futter)` | Umbau | 1440×1100 |
| `web-h2-neues-brennmaterial.html` | H2 · Neues Brennmaterial | `/products (Formular Brennmaterial)` | Umbau | 1440×1140 |
| `web-h2-ware-wieder-da-teilen.html` | H2 · Ware wieder da – teilen? | `/products (Hinweis)` | neu | 1440×900 |

## WEB · Hof – H3 Tagesgeschäft

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `web-h3-heute-mit-teilen-karte.html` | H3 · Heute mit Teilen-Karte | `/dashboard` | Umbau | 1440×960 |
| `web-h3-heute-online-zahlung-pausiert.html` | H3 · Heute: Online-Zahlung pausiert | `/dashboard (Stripe pausiert)` | Zustand | 1440×960 |
| `web-h3-heute-post-karte.html` | H3 · Heute: ungelesene Nachricht als Karte ganz oben in der Hauptspalte, Zähler in der Seitenleiste | `/dashboard` | Dokumentation | 1440×1180 |
| `web-h3-bestellungen-packen-uebergeben.html` | H3 · Bestellungen: packen & übergeben | `/orders + /orders/[orderId]` | Umbau | 1440×960 |
| `web-h3-artikel-fehlt.html` | H3 · Artikel fehlt | `/orders/[orderId] (Dialog, neu)` | neu | 1440×960 |
| `web-h3-stornieren-erstatten.html` | H3 · Stornieren & erstatten | `/orders/[orderId] (Dialog)` | Umbau | 1440×960 |

## WEB · Hof – H4 Teilen und Kunden gewinnen

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `web-h4-teilen-fenster-mit-bild.html` | H4 · Teilen-Fenster mit Bild | `/status/new bzw. Dialog` | neu · Beitrag-Modus: siehe -beitrag-teilen (Nr. 67) | 1440×960 |
| `web-h4-beitrag-teilen.html` | H4 · Beitrag teilen – ein Fenster für Hof und Beitrag | `/status/new (nach dem Veröffentlichen), Mein Hof › Beiträge` | Umbau (Nr. 67) | 1180×820 |
| `web-h4-qr-plakat-zum-drucken.html` | H4 · QR-Plakat zum Drucken | `/status/plakat (neu, Druck)` | neu | 794×1123 |

## WEB · Hof – H5 Auswerten und Markt

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `web-h5-auswertung-abrechnung-teilen-wirkung.html` | H5 · Auswertung, Abrechnung, Teilen-Wirkung | `/analytics` | Umbau | 1440×1260 |
| `system-h5-region-v2.html` | Vorschlag 19.10. · Region v2, passend zu Entdecken v2: Matrix der neun gemeinsamen Bausteine (Hofkopf, Abholzeile, Produktzeile, Bild ohne Foto, Karte, Karte am Pin, Hinweis ohne Standort, Auswahl Abholung, Leerzustand) mit dem, was eigen bleibt; Preise vergleichen am Computer (Liste mit aufgeklappter Zeile, Karte mit „Du“, Umkreis und Vorschau am Pin, vorher/nachher); Futter kaufen am Computer (Reihe „Abholung“, Liste \| Karte, Futterkarte mit Bild und Abholzeile, vorher/nachher, Leerzustand); am Handy Preise Liste und Karte, Futter Liste und Karte, ohne eigenen Standort; Regeln · „Preise vergleichen“: abgelöst durch `system-h5-region-preisband.html` (Vorschlag 23.10., Nr. 124 noch offen) | `/region`, `/region?reiter=futter` | Umbau (freigegeben 20.10.2026, Nr. 122–124; Abweichungen in freigabe.md §23; bestätigt 21.10.2026 (Register F10)) | 2640×4720 |
| `system-h5-region-eigene-teile.html` | Vorschlag 19.10. · Region v3, die eigenen Teile: Bewertung 0–100 heute und neu (gewichtet 65 → 90) mit Vorbildern von Mobbin; Spanne-Zeile als Streifen (Punkte ohne Namen, Mitte, „Deins“ mit Lage in Worten, Eier je Stück) in allen Lagen; Futterkarte mit Größenwahl (Gebinde- und Kilopreis, „günstigster Kilopreis“, ein Knopf), Schild „laut Hof“ ohne Haken, Abholhinweise als Kennzeichen; Umkreis mit Zahl je Stufe, „So rechnen wir“, „Selbst verkaufen“ nur ohne eigenes Futter; Regeln · „Preise vergleichen“: abgelöst durch `system-h5-region-preisband.html` (Vorschlag 23.10., Nr. 124 noch offen) | `/region`, `/region?reiter=futter` | Umbau (freigegeben 20.10.2026, Nr. 122–124; Abweichungen in freigabe.md §23; bestätigt 21.10.2026 (Register F10)) | 2640×4480 |
| `system-h5-region-preisband.html` | Vorschlag 23.10. · Preise vergleichen v2, bewertet 69 → 94 mit Vorbildern von Mobbin: Vergleich erst ab 5 anderen Höfen je Sorte und Gebindeklasse; je Sorte eine große Zahl „€ 1,45 – 1,62 / L“ und der Satz „verlangt mindestens die Hälfte der Höfe“ (Bereich der Hälfte, keine Mitte, kein kleinster und größter Wert, kein Lage-Wort); Band ohne Spur und ohne Zahlen, „Deins € …“ am Punkt, gepunktet bei außerhalb, mehrere eigene Produkte als Marke; oben „Vergleich für 2 von 9 Sorten.“ mit einem Link auf 50 km, Sorten ohne Vergleich gesammelt unter „Noch zu wenige Höfe“; Futter je Gebindeklasse ein Eintrag; zugeklappt, von Hand aufklappbar; Kundschaft auf /hoefe als kompakte Karte ohne Band; Pilot, Laden, Fehler, hell; Regeln, Technik, Entscheidungen | `/region` (Reiter Preise), `/hoefe` (Karte über den Ergebnissen) | Vorschlag (Nr. 124, PR #329; drei Punkte zur Bestätigung) | 2640×4400 |

## WEB · Hof – H6 Hilfe und Rückmeldung

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `web-h6-meldung-abgeben.html` | H6 · Meldung abgeben | `/fehler-melden` | Umbau | 1440×960 |
| `web-h6-meine-meldungen.html` | H6 · Meine Meldungen | `/meldungen` | Umbau | 1440×860 |
| `web-h6-postfach.html` | H6 · Postfach: Nachrichten vom Team, ungelesen markiert, Antworten je Faden | `/postfach` | Dokumentation | 1440×960 |
| `web-h6-unterhaltung.html` | H6 · Unterhaltung: Nachricht vom Team, eigene Antwort, Antwort des Teams, Antwortfeld (oder Hinweis, wenn keine Antwort möglich) | `/postfach/[id]` | Zustand (Nr. 95: Hinweis statt Antwortfeld) | 1440×960 |
| `web-h6-postfach-emails.html` | H6 · E-Mails aus dem Postfach: Betriebsmitteilung und Antwort des Teams – und wann keine Mail kommt | – | Dokumentation | 680×860 |

## MOBIL · Kunde – K0 Ankommen

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-k0-startseite.html` | K0 · Startseite | `/` | Umbau | 390×2500 |
| `mobil-k0-anmelden-mit-code.html` | K0 · Anmelden mit Code | `/account/login` | Umbau | 390×844 |
| `mobil-k2-startseite-gruendung.html` | Startseite am Handy · Für-Höfe-Karte mit dem Gründungssatz | `/` (Handy) | Zustand | 390×2544 |
| `mobil-k0-startseite-saisonblock.html` | K0 · Startseite am Handy mit Saisonblock (Vorlage Saisonkarte mit Bild) zwischen Kopf und „Höfe in deiner Nähe“ | `/` (Handy) | Zustand | 390×900 |

## MOBIL · Kunde – K1 Finden

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-k1-ueber-einen-geteilten-link.html` | K1 · Über einen geteilten Link | `Vorschaubild /[farmSlug] (OG)` | neu | 390×844 |
| `mobil-k1-entdecken.html` | K1 · Entdecken · Hofkarte, Abholzeile, Filter Abholung und Seitenfuß: siehe `system-k1-entdecken-v2.html` | `/hoefe` | Umbau | 390×844 |
| `mobil-k1-filter.html` | K1 · Filter · Hofkarte, Abholzeile, Filter Abholung und Seitenfuß: siehe `system-k1-entdecken-v2.html` | `/hoefe (Filter-Blatt)` | Umbau | 390×844 |

## MOBIL · Kunde – K2 Ansehen

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-k2-hofseite.html` | K2 · Hofseite | `/[farmSlug]` | Umbau | 390×844 |
| `mobil-k2-produkte.html` | K2 · Produkte | `/[farmSlug] Reiter Produkte` | Umbau | 390×844 |
| `mobil-k2-futter-groesse-waehlen.html` | K2 · Futter: Größe wählen | `/[farmSlug]/produkt/[id] (neu)` | neu | 390×844 |
| `mobil-k2-brennmaterial-brennholz.html` | K2 · Brennmaterial: Brennholz | `/[farmSlug]/produkt/[id] (neu)` | neu | 390×844 |
| `system-k2-beitraege-v2.html` | Vorschlag 20.10. · K2 Beiträge v2, bewertet 35 → 92 mit Vorbildern von Mobbin: „Aktuell vom Hof“ oben in der Übersicht statt Reiter „Beiträge“ (Handy: Übersicht, „Weiterlesen“, geteilter Link mit `?beitrag=`; Computer), „Dazu im Hofladen“ mit den verknüpften Produkten, Marke „Neu · vor …“ an der Hofkarte auf /hoefe, Baustein „Neu bei den Höfen“ für die Startseite, „Dein Beitrag“ in Heute und Anstoß ohne Beitrag, „Aktuell vom Hof“ in Mein Hof › Hofseite; Regeln, Daten, Register-Vorschlag (F8, N5, N22, N16) | `/[farmSlug]`, `/hoefe`, `/`, `/dashboard`, `/farm-page` | Umbau (freigegeben 20.10.2026, Nr. 128–129; Abweichungen in freigabe.md §23; bestätigt 21.10.2026 (Register F10)) | 2640×4900 |
| `mobil-k2-hofseite-fotos-mosaik.html` | Hofseite am Handy › Übersicht: Fotos als Mosaik (1 groß + 2 klein, „+5 · alle 8 Fotos“) statt Streifen | `/<slug>` (Handy) | Umbau (Nr. 107) – ersetzt den Fotostreifen in `mobil-k2-hofseite.html` | 390×844 |
| `mobil-k2-hofseite-bildansicht.html` | Bildansicht am Handy: Vollbild, „3 / 8“, wischen, Leiste zum Springen, Schließen | `/<slug>` (Bildansicht) | Umbau (Nr. 107) | 390×844 |

## MOBIL · Kunde – K3 Kaufen

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-k3-kasse-glatt.html` | K3 · Kasse geglättet am Handy, feste Leiste mit Kaufknopf | `/[farmSlug]/checkout` | Umbau (Kasse glätten) | 390×1820 |
| `mobil-k3-zahlung-abgelehnt.html` | K3 · Zahlung abgelehnt | `/[farmSlug]/checkout (Fehler)` | Zustand | 390×844 |
| `mobil-k3-bestaetigung.html` | K3 · Bestätigung | `/[farmSlug]/confirm/[orderId]?sig=` | Umbau | 390×844 |
| `mobil-k3-bar-bestaetigen.html` | K3 · Bar bestätigen | `/[farmSlug]/bestaetigen/[token] (neu, H3)` | neu | 390×844 |

## MOBIL · Kunde – K4 Danach

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-k4-meine-bestellungen.html` | K4 · Meine Bestellungen | `/account/profile` | nur Umbau bestehender `/account`-Seiten (E8) | 390×844 |
| `mobil-k4-bestellung-hof-erreichen.html` | K4 · Bestellung ansehen: Hof erreichen | `/[farmSlug]/bestellung/[orderId], /[farmSlug]/confirm/[orderId]` | Umbau (Nr. 60) | 390×844 |

## MOBIL · Hof – H0 Kennenlernen

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-h0-fuer-hoefe.html` | H0 · Für Höfe | `/fuer-hoefe (neu)` | neu | 390×1660 |
| `mobil-h0-registrieren.html` | H0 · Registrieren | `/register` | Umbau | 390×844 |
| `mobil-k2-fuer-hoefe-gruendung.html` | /fuer-hoefe am Handy · Pill, Knopf, Fußnote; Angebotszeile vor der Preiskarte | `/fuer-hoefe (Handy)` | Zustand | 390×1830 |
| `mobil-k2-registrieren-gruendung.html` | Hof registrieren am Handy · Satz über dem Formular | `/register (Handy)` | Zustand | 390×844 |

## MOBIL · Hof – H1 Starten

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-h1-einrichten.html` | H1 · Einrichten | `/onboarding` | Umbau | 390×980 |
| `mobil-h1-einstellungen-konditionen-v2.html` | H1 · Einstellungen › Konditionen, Fassung 2 | `/settings/konditionen` | Umbau (Nr. 61) | 390×1800 |
| `mobil-h1-titelbild-ausschnitt.html` | H1 · Titelbild am Handy: Blatt mit Rahmen „Computer“, Zoom, Vorschau „So sieht es im Browser aus“ (Hofseite am Computer verkleinert) und „So sieht es am Handy aus“, Wahl füllen/ganz, Filter, Speichern | `/farm-page` (Blatt unter lg) | neu (Nr. 97) | 390×1280 |

## MOBIL · Hof – H2 Angebot

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `system-h1-mein-hof-v3.html` | Vorschlag 21.10. · H1/H2 Mein Hof am Handy v3, bewertet (Menüführung 66 → 94, Übersicht 48 → 92) mit Vorbildern von Mobbin: ein Kopf mit Titelbild-Streifen, Teilen, Kundenansicht und Zustandszeile (Nimmt Bestellungen an · Pausiert · Noch nicht bestellbar · Noch nicht freigegeben) für alle drei Reiter; Produkte mit „Braucht dich“ zuerst, Vorrat mit Einheit als Knopf und Blatt zum Ändern, Abzeichen nur bei Ausnahmen; Pausieren im Kopf mit Bestätigung; Hofseite mit „Hofseite vollständig“ bzw. „Noch n Punkte offen“ und Gruppen nach dem Ort auf der Seite; Bausteine, Regeln, Technik, Register-Vorschlag (N3, N4, E12, N8) | `/products`, `/farm-page` (unter 1024 px) | Umbau (freigegeben 22.10.2026, Nr. 143–144) | 2640×3990 |
| `mobil-h2-neu-was-legst-du-an.html` | H2 · Neu: Was legst du an? | `Neu-Menü` | neu | 390×844 |
| `mobil-h2-neues-produkt.html` | H2 · Neues Produkt | `/products (Formular Lebensmittel)` | Umbau | 390×844 |
| `mobil-h2-neues-produkt-grenze-hoftor.html` | H2 · Neues Produkt: Grenze im Hoftor (ab 1.2.2027) | `/products (Formular)` | Zustand (Gate 8, O8) | 390×844 |
| `mobil-h2-neues-futter-meldung-fehlt.html` | H2 · Neues Futter (Meldung fehlt) | `/products (Formular Futter)` | Umbau | 390×1320 |
| `mobil-h2-neues-brennmaterial.html` | H2 · Neues Brennmaterial | `/products (Formular Brennmaterial)` | Umbau | 390×844 |
| `mobil-h2-gespeichert-teilen.html` | H2 · Gespeichert – teilen? | `/products (Hinweis)` | neu | 390×844 |
| `mobil-h2-produktfoto-ausschnitt.html` | H2 · Produktfoto am Handy: derselbe Bild-Baustein, Vorschau in der Liste (Handy quadratisch, Computer breit) und auf der Produktseite, Filter | Produkt anlegen/bearbeiten (Blatt) | neu (Nr. 98) | 390×1240 |

## MOBIL · Hof – H3 Tagesgeschäft

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-h3-heute-mit-teilen-karte.html` | H3 · Heute mit Teilen-Karte | `/dashboard` | Umbau | 390×844 |
| `mobil-h3-heute-online-zahlung-pausiert.html` | H3 · Heute: Online-Zahlung pausiert | `/dashboard (Stripe pausiert)` | Zustand | 390×844 |
| `mobil-h3-heute-post-karte.html` | H3 · Heute: ungelesene Nachricht vom Team direkt lesbar – Titel, Text, Link, „Antworten“, „Gelesen“; ganz oben in der Hauptspalte, nur bei Ungelesenem | `/dashboard` | Umbau | 390×470 |
| `mobil-h3-bestellungen.html` | H3 · Bestellungen | `/orders` | Umbau | 390×844 |
| `mobil-h3-bestelldetail.html` | H3 · Bestelldetail | `/orders/[orderId]` | Umbau | 390×844 |
| `mobil-h3-stornieren.html` | H3 · Stornieren | `/orders/[orderId] (Blatt)` | Umbau | 390×844 |

## MOBIL · Hof – H4 Teilen

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-h4-teilen-ueber-das-telefon.html` | H4 · Teilen über das Telefon | `/status/[id]/send-whatsapp → Web Share` | Umbau · Beitrag-Modus: siehe -beitrag-teilen (Nr. 67) | 390×844 |
| `mobil-h4-beitrag-teilen.html` | H4 · Beitrag teilen – Blatt nach dem Veröffentlichen | `/status/new (Blatt), Mein Hof › Beiträge` | Umbau (Nr. 67) | 390×1300 |
| `mobil-h4-beitraege-teilen-je-beitrag.html` | H4 · Mein Hof › Beiträge: Teilen je Beitrag, WhatsApp-Stand ehrlich | `/mein-hof (Reiter Beiträge)` | Umbau (Nr. 66, 67) | 390×844 |

## MOBIL · Hof – H5 Mehr

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-h5-mehr-tarif-startphase.html` | H5 · Mehr: Tarif-Zeile Startphase | `Hof-Unterleiste „Mehr"` | Umbau (Nr. 61) | 390×844 |
| `mobil-h5-mehr-tarif-hoftor.html` | H5 · Mehr: Tarif-Zeile Hoftor (ab 1.2.2027) | `Hof-Unterleiste „Mehr"` | Zustand (Nr. 61, ruht bis Gate 8) | 390×844 |
| `mobil-h5-mehr-tarif-gruendungshof.html` | H5 · Mehr: Tarif-Zeile Gründungshof | `Hof-Unterleiste „Mehr"` | Zustand (Nr. 61, 62) | 390×844 |
| `mobil-h5-einstellungen.html` | H5 · Einstellungen | `/settings` | Umbau | 390×1000 |

## MOBIL · Hof – H6 Hilfe

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-h6-meldung-abgeben.html` | H6 · Meldung abgeben | `/fehler-melden` | Umbau | 390×844 |
| `mobil-h6-meine-meldungen.html` | H6 · Meine Meldungen | `/meldungen` | Umbau | 390×844 |
| `mobil-h6-postfach.html` | H6 · Postfach (Handy): Nachrichten vom Agrilo-Team, je Nachricht ein Faden, Filter Alle/Ungelesen, Marke Wichtig, „Du hast geantwortet“ | `/postfach` (neu, Hauptpunkt nach Bestellungen) | Neu | 390×844 |
| `mobil-h6-unterhaltung.html` | H6 · Nachricht vom Team mit Antworten: Team-Blase mit Wichtig und Link-Knopf, Antwort des Hofs, Antwort des Teams, Eingabefeld „Antwort an das Team“ | `/postfach/[id]` (neu) | Neu | 390×844 |

## QUERSCHNITT · Fehlerseiten (Web und Handy)

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `fehler-404-seite-nicht-gefunden.html` | 404 · Seite nicht gefunden | `not-found.tsx` | Zustand | 1440×820 |
| `fehler-500-etwas-ist-schiefgelaufen.html` | 500 · Etwas ist schiefgelaufen | `error.tsx` | Zustand | 1440×820 |
| `fehler-500-problem-melden-kunde.html` | 500 → Problem melden (Kunde) | `/problem-melden (Dialog)` | Umbau | 1440×820 |
| `fehler-404-mobil.html` | 404 mobil | `not-found.tsx` | Zustand | 390×844 |
| `fehler-500-mobil.html` | 500 mobil | `error.tsx` | Zustand | 390×844 |

## SYSTEM · Bausteine und heller Modus

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `system-farbtokens.html` | Farbtokens | `globals.css` | Zustand | 900×980 |
| `system-komponente-seitenleiste-hof.html` | Komponente – Seitenleiste Hof | `src/lib/bauern-navigation.ts + Shell` | Umbau | 264×960 |
| `system-hofseite-hell.html` | Hofseite hell | `/[farmSlug] hell` | Zustand | 390×844 |
| `system-heute-hell.html` | Heute hell | `/dashboard hell` | Zustand | 390×844 |
| `system-komponente-tarif-zeile-startphase.html` | Komponente – Tarif-Zeile in der Seitenleiste: Startphase | `HofShell (Seitenleiste)` | neu (Nr. 61) | 264×960 |
| `system-komponente-tarif-zeile-hoftor.html` | Komponente – Tarif-Zeile: Hoftor (ab 1.2.2027) | `HofShell (Seitenleiste)` | Zustand (Nr. 61, ruht bis Gate 8) | 264×960 |
| `system-komponente-tarif-zeile-gruendungshof.html` | Komponente – Tarif-Zeile: Gründungshof | `HofShell (Seitenleiste)` | Zustand (Nr. 61, 62) | 264×960 |
| `system-teilen-bild-varianten.html` | Komponente – Teilen-Bild 1:1: A Marktkarte (gilt), B Foto-Held (mit Foto), C Hoftafel (verworfen) | `/[farmSlug]/opengraph-image` | Umbau (Nr. 69) | 1720×720 |
| `system-teilen-bild-story-und-beitrag.html` | Komponente – Teilen-Bild Status 9:16 (QR nur hier) und Beitrag-Modus | `/[farmSlug]/opengraph-image?format=story, Beitrag-Bild (Nr. 67)` | Umbau (Nr. 69) | 1720×860 |
| `system-m1-marke-agrilo-entscheidung.html` | M1 · Marke – Entscheidung: EINE Bildmarke (A mit Blatt, Baum, Stadel, Furchen auf grüner Kachel) in zwei Fassungen (voll ab 48 px, klein darunter), Größenprobe 16/24/32/48/64, Apple 180, maskierbar 80 %, Teilen-Bild der Startseite, Regeln für Skript und Kopfzeile — **gilt** | Kopfzeile, Favicon und App-Icons, Teilen-Bild, Status-Bild, QR-Plakat | Umbau (Nr. 92) | 1440×760 |
| `system-h1-titelbild-filter.html` | SYSTEM · Bild-Filter: sechs Vorgaben nur als CSS (Natürlich, Klar, Warm, Kräftig, Sanft, Schwarzweiß), Enum-Namen und CSS-Zeichenketten – Quelle für `BILD_FILTER` in lib/bild-ausschnitt.ts | – | neu (Nr. 97) | 1440×640 |
| `system-h1-bild-baustein.html` | SYSTEM · Ein Bild-Baustein für alle Fotos: Rahmen je Zweck (Titelbild, Logo ohne Filter, Produktfoto, Galerie, Beitragsfoto), ein Wert, ein Stil; nicht bei „Problem melden“ | – | neu (Nr. 97/98) | 1440×1060 |
| `system-k2-hofseite-fotos-varianten.html` | Fotos der Hofseite am Handy: Mosaik (Empfehlung), Karussell mit Zähler, Streifen ohne Balken – mit Regeln für 1, 2 und ab 3 Fotos | – | Entscheidung (Nr. 107) | 1240×740 |
| `system-h1-kundenansicht-handy.html` | Kundenansicht am Handy: heute zwei Leisten, Vorschlag Vollbild-Blatt mit Band „Kundenansicht · Fertig“ und nur der Leiste der Kundschaft | `/farm-page` (Handy, Kundenansicht) | Umbau (Nr. 107, N4 ergänzt) | 960×1090 |
| `system-h1-angemeldete-geraete.html` | Lauf 17 · Angemeldete Geräte: Konto und Sicherheit am Handy und am Computer mit „Angemeldete Geräte“ (einzeln oder „Alle anderen abmelden“), Blatt zum Bestätigen, Mail „Neue Anmeldung bei deinem Hof-Konto“, Seite „Das warst nicht du?“ mit Knopf und Seite danach, Code-Anmeldung „Zu viele falsche Codes“; Regeln | `/settings/account`, Mail, `/sicherheit/nicht-ich` (neu), `/account/login` | neu (Nr. 112, 114) | 2400×2140 |
| `system-k2-gruendung-abzeichen.html` | Aktion 100 · Abzeichen „Gründungshof“: drei Wege verglichen (A Etikett empfohlen), Lagen des Etiketts (dunkel, hell, auf Foto, Fokus), Hofseite am Handy mit Etikett und Erklär-Blatt, Höfe-Liste am Handy und am Computer, Hofseite am Computer mit Sprechblase, Heute-Karte und Schalter „Abzeichen zeigen“ für den Hof, Teilen-Bild mit Etikett; Regeln | `/<slug>`, `/hoefe`, `/settings/konditionen`, Teilen-Bild der Hofseite | neu (Nr. 116, K2 ergänzt) | 2500×3060 |
| `system-k2-gruendung-bausteine.html` | Gründungshöfe · Bausteine: Satz (dunkel/hell), Pill/Knopf/Fußnote, Preiszeile + Hofladen-Preis, Registrieren-Satz, einmaliger Hinweis, Zustände (letzter Platz, alle vergeben, Datum vorbei), Regeln · Baustein 5 (Heute-Karte) entfällt (19.10.2026) | Bausteine (`components/gruendung/*`) | neu | 1760×860 |

## ADMIN · Betreiber

Ein Seitenmuster für alle Admin-Seiten: Seitenkopf (Titel + ein Satz + rechts die Hauptaktion oder der Monat) · Kennzahlen-Zeile · Unterreiter (zweite Ebene als Pillen) · Inhalt · Regel-Zeile in leiser Schrift. Reiter in der Kopfzeile: Höfe · Postfach · Startseite · Finanzen · Betrieb (neu, Nr. 103; Punkt bei offener Warnung) · Einstellungen. Die älteren Admin-Mockups zeigen noch fünf Reiter; maßgeblich für Reiter und Betriebsleiste ist `admin-betrieb.html`. Unter den Reitern die Betriebsleiste mit „Stripe Test" (Register Z2) – ohne Link „Zur Testumgebung", weil es keine gibt (Z3, Korrektur 15.10.). Betriebsleiste: rechts ein Hinweis bei offener Warnung („Bilder-Speicher bei 82 % – ansehen“, Link auf `/admin/betrieb`), sonst nichts. Einstellungen sind Gruppen (Gründungshöfe · Plattform), jede mit eigenem Speichern und Protokollzeile; der Stripe-Modus steht in Admin › Betrieb.

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `admin-hoefe-und-freischaltung.html` | Admin · Höfe: Seitenkopf, Kennzahlen, Unterreiter Warten · Alle · Gründungshöfe, Warteliste zeigt „bekäme Gründungsplatz Nr. 8", Tabelle mit Spalte Gründungshof (Nr., bis, „abweichend") | `/admin` | Umbau | 1440×900 |
| `admin-postfach.html` | Admin · Postfach › Eingang (Filter Offen): Antwort · Meldung · Aufgabe in einer Liste links, rechts die geöffnete Aufgabe (Hof wartet: Prüfliste, Freischalten/Ablehnen); Reiter Eingang · Rundschreiben · Zustellung (N12 geändert: Reiter Eingang · Rundschreiben · Zustellung) | `/admin/postfach` | Umbau; Reihenfolge Kopf · Reiter · Kennzahlen seit Nr. 105 (`admin-postfach-ruhig.html`) | 1440×900 |
| `admin-postfach-zustellung.html` | Admin · Postfach › Zustellung: Empfängerliste (support@ fest, weitere mit Double-Opt-in) und Regel je Art (sofort · nur im Eingang · Wochenbericht); ersetzt „Einstellungen › Benachrichtigungen“; Art ‚Betrieb‘ fest an (Nr. 103) | `/admin/postfach/zustellung` (neu) | neu | 1440×1000 |
| `admin-postfach-unterhaltungen.html` | Admin · Postfach › Unterhaltungen: Eingang mit Filter Antwort links (480 px), rechts der Faden (Rundschreiben des Teams, Antwort des Hofs) mit Antwortfeld und Hinweis zur E-Mail-Grenze | `/admin/postfach?art=antwort` | Umbau | 1440×1000 |
| `admin-postfach-meldungen.html` | Admin · Postfach › Meldungen: Eingang mit Filter Meldung links, rechts Meldung (Text, Bildschirmfoto, automatisch Mitgeschicktes) und Entscheiden (Status, Bündel, Sprint, Antwort an den Hof) | `/admin/postfach?art=meldung` | Umbau | 1440×1080 |
| `admin-rundschreiben.html` | Admin · Postfach › Rundschreiben: Gesendet mit Lesequote und Antworten links; rechts neues Rundschreiben mit Empfänger (alle · ausgewählte · Filter), Art, Titel, Text, Link, Haken „Antwort möglich“ (neu) und „auch per E-Mail“, Vorschau „So sieht es der Hof“ | `/admin/postfach/rundschreiben` | Umbau (ersetzt die Fassung aus Lauf 13) | 1440×1200 |
| `system-postfach-prozess.html` | Schaubild: Quellen (Hof, Kundschaft, System) → Eingang (drei Arten mit eigenem Weg) → Zustellung (Regeln, Empfänger, Wochenbericht); Ausgang Rundschreiben → Hof-Postfach → Antwort zurück in den Eingang; Hof-Seite spiegelbildlich | Konzept (`docs/konzepte/`) | Konzept | 1760×1250 |
| `admin-finanzen.html` | Admin · Finanzen: Monat im Seitenkopf, Kennzahlen (Grundgebühren 0 € in der Gründungsphase), Unterreiter Monat · Kosten · Auszahlungen · Entfallene Gebühren, Verlauf, Kosten | `/admin/finanzen` | Umbau | 1440×900 |
| `admin-einstellungen.html` | Admin · Einstellungen › Gründungshöfe: Gruppen links (Gründungshöfe · Plattform; Betrieb seit Nr. 103 als eigener Reiter, admin-betrieb), rechts Plätze/Vergeben/Frei, Plätze gesamt, Kostenlos bis (Standard), Schalter „Auf den Seiten zeigen", Vorschau des Satzes und der Pill, Protokoll | `/admin/einstellungen` (neu) | neu | 1440×1010 |
| `admin-mobil-unterwegs-freischalten.html` | Admin am Handy · Höfe: Reiter unter dem Kopf, Kennzahlen, Warteliste mit Gründungsplatz | `/admin (Handy)` | Umbau | 390×844 |
| `admin-mobil-einstellungen.html` | Admin am Handy · Einstellungen: Gruppen als Liste (ohne Benachrichtigungen – die sind Postfach › Zustellung), Gründungshöfe aufgeklappt | `/admin/einstellungen (Handy)` | neu | 390×844 |
| `admin-startseite-entwurf.html` | Admin · Startseite: Statusleiste Entwurf/Live/Geplant, Abschnittsliste mit Änderungsmarken, automatisch im Entwurf gespeichert, Vorschau „So sieht’s die Kundin“ mit Entwurf · Live und Stand am | `/admin/startseite` | Umbau (Nr. 99, N16 geändert) · ab 1024 px Formular links bei offenem Block (Nr. 155, N16) | 1440×1100 |
| `admin-startseite-veroeffentlichen.html` | Admin · Startseite: Dialog „Entwurf veröffentlichen“ – Änderungen, Jetzt oder Datum + Uhrzeit (Wiener Zeit), Hinweis auf Block-Zeitraum | `/admin/startseite` (Dialog) | neu (Nr. 99) | 1440×1000 |
| `admin-startseite-zeitplan.html` | Admin · Startseite: Zeitplan (geplant, live) und Verlauf der Fassungen, Zurückziehen, Als Entwurf übernehmen | `/admin/startseite` (Zeitplan, Verlauf) | neu (Nr. 99) | 1440×700 |
| `mobil-admin-startseite-entwurf.html` | Admin am Handy · Startseite: Statuskarte, kompakte Liste, feste Leiste Vorschau · Veröffentlichen | `/admin/startseite` | neu (Nr. 99) | 390×1000 |
| `admin-finanzen-jahr.html` | Admin · Finanzen: Umschalter Monat · Jahr, Jahreskennzahlen, zwölf Monatsbalken, Monat für Monat, Kosten im Jahr, CSV, Vorjahresvergleich (ab 2027) | `/admin/finanzen?zeitraum=jahr` | neu (Nr. 100, N15 ergänzt; Regel-Zeile und Zahlen 16.10. an den Code angepasst – jährliche Posten auf zwölf Monate umgelegt) | 1440×1680 |
| `admin-postfach-meldungen-ablauf.html` | Admin · Postfach › Meldungen: Stand-Band (braucht dich · in Arbeit · erledigt · gesammelt · abgelegt), Spalten Neu · KI-Vorschlag · Geplant · Erledigt, Gesammelt/Abgelegt zugeklappt, Rückgängig, was die KI tut | `/admin/postfach?reiter=meldungen` | neu (Nr. 101, N14 ergänzt) | 1440×1590 |
| `admin-postfach-wuensche.html` | Admin · Postfach › Meldungen: Wünsche gebündelt – Stimmen mit Duplikaten, Woraus mit Trennen/Dazunehmen, Stand für alle, So sieht es der Hof, Bescheid-Wahl | `/admin/postfach?reiter=meldungen&ansicht=wuensche` | neu (Nr. 101) | 1440×1440 |
| `admin-postfach-zusammenfassen.html` | Admin · Postfach › Meldungen: Dialog Zusammenfassen – Hauptmeldung bleibt, Duplikat hängt sich an, Was passiert | `/admin/postfach?reiter=meldungen` (Dialog) | neu (Nr. 101) | 1440×1060 |
| `mobil-admin-postfach-meldungen.html` | Admin am Handy · Postfach › Meldungen: Stand-Band, Chips statt gestapelter Spalten, KI-Vorschlag mit Rückgängig | `/admin/postfach?reiter=meldungen` | neu (Nr. 101) | 390×1300 |
| `admin-betrieb.html` | Admin · Betrieb: Warnkarte, Kacheln Bilder · Datenbank · E-Mails heute · Bild-Vorgänge (Wert, Grenze, Balken mit Strich bei 80 %, Trend, was bei 100 % passiert), Verlauf 90 Tage, Tarife und Grenzen, Abläufe mit Herzschlag, Nur im Dashboard, Größte Tabellen, Bilder ohne Verwendung (nur Liste) | `/admin/betrieb` (neu) | neu (Nr. 103; Bilder ohne Verwendung und Aufräumen Nr. 104) | 1440×1812 |
| `mobil-admin-betrieb.html` | Admin am Handy · Betrieb: Warnkarte, Kacheln untereinander, Abläufe, Bilder ohne Verwendung, Verlauf/Tarife/Tabellen/Dashboard aufklappbar | `/admin/betrieb` (Handy) | neu (Nr. 103/104) | 390×2000 |
| `email-betrieb-warnung.html` | Betreiber · Warn-Mails: Grenze erreicht (80 %, 95 %, voll, Entwarnung) und Ablauf überfällig – und wann keine Mail kommt | Mail an die Empfänger aus Postfach › Zustellung | neu (Nr. 103) | 680×930 |
| `admin-postfach-ruhig.html` | Admin · Postfach: Kopf und Reiter auf allen vier Reitern an derselben Stelle, ein Satz für alle, Kennzahlen unter den Reitern nur im Eingang; Regeln: kein Ladebild beim Wechsel, kein Sprung nach oben, Platz für den Rollbalken | `/admin/postfach` (alle Reiter) | Umbau (Nr. 105) – ändert die Reihenfolge in `admin-postfach.html` | 1440×900 |
| `admin-hoefe-gruendung-ausnehmen.html` | Admin · Höfe › Alle: Spalte Gründungshof (Nr. · bis · „ausgenommen“), Menü ⋯ mit „Nicht als Gründungshof zählen …“, Bestätigung mit Folgen | `/admin?reiter=alle` | Umbau (Nr. 109, K2 ergänzt; Haken „Testhof oder Zustimmung“ bei Platz) | 1440×1180 |
| `mobil-admin-hoefe-gruendung-ausnehmen.html` | Admin am Handy · Höfe: dieselbe Bestätigung als Blatt | `/admin` (Handy) | Umbau (Nr. 109) | 390×844 |
| `system-admin-anmeldung-passkey.html` | Admin · Anmelden nur mit Passkey: Seite `/login/admin` mit Knopf „Mit Passkey anmelden“ (den QR-Code fürs Handy zeigt der Browser, nicht Agrilo), Bestätigung am Handy, frische Bestätigung bei heiklen Aktionen, Pflichtseite beim ersten Mal (nur mit Passwort und frischem E-Mail-Code, 24 Stunden nach Vergabe des Rechts), Ersatzcodes, Einstellungen › Anmeldung; Schritt 7 gehört zu Lauf 18 | `/login/admin` (neu), `/admin` (Pflichtseite), `/admin/einstellungen/anmeldung` (neu) | neu (Nr. 115) | 2380×2560 |

Hinweis Nr. 101: „später“-Marken in den Postfach-Mockups zeigen das Zielbild (Folgeauftrag mit Feld für KI-Vorschläge) und werden in Nr. 101 nicht gebaut.

## Hinweise

Gründungshöfe (Register K2, Nr. 93 und 116): Kein Banner, sondern Bausteine: ein Satz im Lesefluss (Startseite), Pill + umbenannter Knopf + Fußnote im Kopf von /fuer-hoefe, Angebotszeile direkt über den Tarifkarten (Hofladen 0 € bis 31.12.2027, dann 19 €), ein ehrlicher Satz über dem Registrierformular („voraussichtlich Nr. 8"), einmaliger wegklickbarer Hinweis auf Heute nach der Freischaltung (Baustein 5 (Heute-Karte) entfällt (19.10.2026)) – keine Dauerkarte, keine seitenweite Leiste, kein Countdown. Sind alle Plätze vergeben oder ist das Datum vorbei, verschwindet alles. Zahlen aus `src/lib/gruendungshof.ts` bzw. den Admin-Einstellungen. Seit Lauf 17 (Nr. 116) gilt die Aktion „100 Gründungshöfe“: 100 Plätze, Hofladen 24 Monate ohne Grundgebühr ab dem späteren von Tarifstart und Freischaltung, Stichtag „Aktion bis“, Zähler erst ab 10 vergebenen Plätzen. Die Bausteine behalten ihre Form; die Zahlen und Sätze kommen aus `GRUENDUNG_TEXT` (Wortlaut in freigabe.md §21). Das Abzeichen zeigt `system-k2-gruendung-abzeichen.html`.

Wortliste (gilt für alle Oberflächen, Admin und Hof): **Postfach** = der eine Ort, an dem alles ankommt; **Nachricht** = ein Eintrag; **Rundschreiben** = eine Nachricht vom Team an viele Höfe; **Unterhaltung** = der Faden aus Nachricht und Antworten; **Meldung** = Fehler, Wunsch oder Frage an das Team. Nicht mehr: Briefkasten, Post, Chat, Mitteilung, Benachrichtigung. Verbindlich steht die Wortliste in `../ai/DESIGN_SYSTEM.md`.

Geparkt bleiben Unterhaltungen zwischen Höfen (K3/T8) und Anzeige im Umkreis; „Startseite gestalten“ ist mit Lauf 14 freigegeben (Register N16, Nr. 96).

## IDEEN (nicht entschieden, nicht bauen)

Sammelbestellung: Aufträge 102a/102b sind vorbereitet und am 23.10.2026 zurückgestellt. Geparkt und nur auf dem Canvas: Anmeldung der Höfe ohne Passwort (SMS-Anbieter und Vertrag zur Auftragsverarbeitung offen).

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `idee-web-k2-sammelbestellung.html` | Kunde · Sammelbestellung: Produktseite mit Balken, Frist, Karte hinterlegen, „Alles oder nichts“ | – | Idee, zurückgestellt 23.10.2026 | 1440×1040 |
| `idee-mobil-k2-sammelbestellung.html` | Kunde am Handy · Sammelbestellung mit den Zuständen | – | Idee, zurückgestellt 23.10.2026 | 390×2010 |
| `idee-mobil-k3-sammelbestellung-mitmachen.html` | Kunde am Handy · Mitmachen: Karte hinterlegen, heute € 0, Zustimmung als Satz, EPS per Link | – | Idee, zurückgestellt 23.10.2026 | 390×1000 |
| `idee-email-sammelbestellung.html` | E-Mails · dabei, geschafft, Zahlung fehlgeschlagen, nicht erreicht (nichts abgebucht), Hof macht trotzdem | – | Idee, zurückgestellt 23.10.2026 | 1780×760 |
| `idee-mobil-h2-sammelbestellung-anlegen.html` | Hof · Neue Sammelbestellung | – | Idee, zurückgestellt 23.10.2026 | 390×1360 |
| `idee-mobil-h3-sammelbestellung-entscheiden.html` | Hof · Frist vorbei: trotzdem, verlängern, absagen | – | Idee, zurückgestellt 23.10.2026 | 390×960 |
| `idee-system-sammelbestellung.html` | System · Ablauf mit Abbuchung bei Durchführung, vier Geldwege, Vorbilder | – | Idee, zurückgestellt 23.10.2026 | 1760×860 |

## ARCHIV (abgelöst – nicht mehr bauen)

Nur zum Nachschlagen. Maßgeblich ist das Mockup in der Spalte Arbeit. Auf dem Canvas liegen diese Boards auf der Seite „Archiv“.

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `web-h5-region-preise.html` | H5 · Region – Preise | `/region (neu, aus /analytics/umfeld)` | abgelöst durch `system-h5-region-v2.html` und `system-h5-region-eigene-teile.html` (Nr. 122/123) | 1440×1020 |
| `web-h5-region-futter-kaufen.html` | H5 · Region – Futter kaufen | `/region?reiter=futter (neu)` | abgelöst durch `system-h5-region-v2.html` und `system-h5-region-eigene-teile.html` (Nr. 122/123) | 1440×1020 |
| `mobil-k2-hofseite-beitraege-alle-aktiven.html` | K2 · Hofseite › Beiträge: alle aktiven, neuester zuerst | `/[farmSlug]?reiter=beitraege` | abgelöst durch `system-k2-beitraege-v2.html` (Nr. 128, Reiter „Beiträge“ entfällt) | 390×844 |
| `mobil-h1-mein-hof.html` | H1 · Mein Hof | `/farm-page` | abgelöst durch `system-h1-mein-hof-v3.html` (Nr. 143) | 390×844 |
| `mobil-h2-produkte.html` | H2 · Produkte | `/products` | abgelöst durch `system-h1-mein-hof-v3.html` (Nr. 144) | 390×844 |
| `admin-startseite-gestalten.html` | Lauf 14 · Admin › Startseite: Abschnittsliste (Kopf, Höfe, Fuß fest; ziehen = Reihenfolge, Auge = aus/ein), Einfügepunkte „Block einfügen“, Block bearbeiten (Vorlage, Überzeile, Titel, Text, Bild, Link, Live ab/bis Wiener Zeit), Vorlagen-Bibliothek (Saisonkarte mit Bild, Hinweisband, Höfe-Auswahl, Kategorie-Hinweis) – Konzept in der Lauf-13-Vormerkung (StartseiteAbschnitt + StartseiteBlock, Migration + Seed) | `/admin/startseite` (neu) | abgelöst durch `admin-startseite-entwurf.html` (Nr. 99) | 1440×1100 |
| `admin-startseite-vorschau.html` | Lauf 14 · Admin › Startseite, Umschalter „So sieht’s die Kundin“: Handy/Web, „Stand am“ (Heute · +1 Woche · nächster Block), echte Startseite mit den Blöcken des Tages plus Block in Bearbeitung, signierter Vorschau-Link (1 h) | `/admin/startseite?ansicht=vorschau` (neu) | abgelöst durch `admin-startseite-entwurf.html` (Nr. 99) | 1440×1040 |
