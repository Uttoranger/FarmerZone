# Mockups

Eigenständige HTML-Dateien, direkt im Browser zu öffnen. Alle Farben, Abstände, Radien und Texte stehen als Inline-Styles im Markup und dürfen exakt ausgelesen werden. Geteilte Bausteine (Seitenleiste, eingebettete Seiten in Vorschauen und Dialogen) sind zur Ansicht eingebettet; im Code sind sie **eine** Komponente.

Stand 15.10.2026: Alle Mockups zeigen die Marke Agrilo (Bildmarke klein + Wort, Register M1, Nr. 92), die Hof-Seitenleiste mit Postfach und Tarif-Zeile (Nr. 61, 86/87), die Handy-Leiste Heute · Bestellungen · Neu · Mein Hof · Mehr (N3), das Mehr-Blatt mit Postfach und Produkten, die Startseite mit Regionskarte (Nr. 59) und die Hofseite ohne Telefonnummer vor dem Kauf (Nr. 60). Die Kasse (Nr. 82) und das Hof-Postfach (Nr. 86/87) stehen jetzt in den Kernzeilen K3 und H6.

Farben sind auf das dunkle Standard-Theme aufgelöst. Die verbindlichen Token-Paare stehen in `../ai/DESIGN_SYSTEM.md`. Beispieldaten (Höfe, Namen, Preise, Nummern) sind Platzhalter.

**Dateinamen:** `web-` oder `mobil-`, dann der Schritt im Ablauf (`k0`–`k4` Kunde, `h0`–`h6` Hof), dann der Bildschirm. `admin-`, `fehler-` und `system-` sind Querschnitt.

**Spalte Arbeit:** *Umbau* = bestehende Route ins neue Design und um die gezeigten Funktionen erweitern · *neu* = Route oder Funktion gibt es noch nicht · *Zustand* = Variante einer Route (leer, Fehler, Hinweis) · *zurückgestellt* = wird vorerst nicht gebaut, Grund im Entscheidungsregister `../entscheidungen.md`. · *Konzept* = Schaubild, kein Bildschirm · *Dokumentation* = zeigt den gebauten Stand

## WEB · Kunde – K0 Ankommen (vor dem Anmelden)

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `web-k0-startseite.html` | K0 · Startseite | `/` | Umbau | 1440×3360 |
| `web-k0-anmelden-kunde-code-hof-passwort.html` | K0 · Anmelden (Kunde Code, Hof Passwort) | `/account/login, /login` | Umbau | 1440×860 |

## WEB · Kunde – K1 Finden

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `web-k1-entdecken-einstieg.html` | K1 · Entdecken – Einstieg | `/hoefe` | Umbau | 1440×1180 |
| `web-k1-filter-futtermittel.html` | K1 · Filter Futtermittel | `/hoefe?bereich=futter` | Umbau | 1440×1100 |
| `web-k1-suche-filter.html` | K1 · Suche + Filter | `/hoefe?q=…` | Umbau | 1440×1000 |
| `web-k1-leerzustand.html` | K1 · Leerzustand | `/hoefe (leer)` | Zustand | 1440×1000 |
| `system-k1-ortssuche-zustaende.html` | K1 · Ortssuche nach dem Fix: PLZ+Ort in einem, mehrere Orte zur Wahl, Standort nur ungefähr (Hinweis + GPS-Nachfrage) | `/hoefe` | Fix (Ortssuche) | 1000×560 |

## WEB · Kunde – K2 Hof und Produkte ansehen

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `web-k2-hofseite.html` | K2 · Hofseite | `/[farmSlug]` | Umbau | 1440×1500 |
| `web-k2-alle-produkte-nach-kategorie.html` | K2 · Alle Produkte nach Kategorie | `/[farmSlug] Reiter Produkte` | Umbau | 1440×2420 |
| `web-k2-futter-groesse-waehlen.html` | K2 · Futter: Größe wählen | `/[farmSlug]/produkt/[id] (neu)` | neu | 1440×1500 |
| `web-k2-brennmaterial-brennholz.html` | K2 · Brennmaterial: Brennholz | `/[farmSlug]/produkt/[id] (neu)` | neu | 1440×1560 |
| `system-k2-titelbild-computer.html` | K2 · Titelbild der Hofseite am Computer: Querformat füllt mit Fokuspunkt, Quadrat und Hochformat stehen ganz mit weichem Rand; Höhe 300/360/420 px nach Breite, ab 1 920 px nicht weiter aufgezogen | `/[farmSlug]` | Fix (Nr. 89) | 1440×1500 |

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
| `web-h5-region-preise.html` | H5 · Region – Preise | `/region (neu, aus /analytics/umfeld)` | Umbau | 1440×1020 |
| `web-h5-region-futter-kaufen.html` | H5 · Region – Futter kaufen | `/region?reiter=futter (neu)` | neu | 1440×1020 |

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

## MOBIL · Kunde – K1 Finden

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-k1-ueber-einen-geteilten-link.html` | K1 · Über einen geteilten Link | `Vorschaubild /[farmSlug] (OG)` | neu | 390×844 |
| `mobil-k1-entdecken.html` | K1 · Entdecken | `/hoefe` | Umbau | 390×844 |
| `mobil-k1-filter.html` | K1 · Filter | `/hoefe (Filter-Blatt)` | Umbau | 390×844 |

## MOBIL · Kunde – K2 Ansehen

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-k2-hofseite.html` | K2 · Hofseite | `/[farmSlug]` | Umbau | 390×844 |
| `mobil-k2-produkte.html` | K2 · Produkte | `/[farmSlug] Reiter Produkte` | Umbau | 390×844 |
| `mobil-k2-futter-groesse-waehlen.html` | K2 · Futter: Größe wählen | `/[farmSlug]/produkt/[id] (neu)` | neu | 390×844 |
| `mobil-k2-brennmaterial-brennholz.html` | K2 · Brennmaterial: Brennholz | `/[farmSlug]/produkt/[id] (neu)` | neu | 390×844 |
| `mobil-k2-hofseite-beitraege-alle-aktiven.html` | K2 · Hofseite › Beiträge: alle aktiven, neuester zuerst | `/[farmSlug]?reiter=beitraege` | Umbau (Nr. 68) | 390×844 |

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

## MOBIL · Hof – H1 Starten

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-h1-einrichten.html` | H1 · Einrichten | `/onboarding` | Umbau | 390×980 |
| `mobil-h1-mein-hof.html` | H1 · Mein Hof | `/farm-page` | Umbau | 390×844 |
| `mobil-h1-einstellungen-konditionen-v2.html` | H1 · Einstellungen › Konditionen, Fassung 2 | `/settings/konditionen` | Umbau (Nr. 61) | 390×1800 |

## MOBIL · Hof – H2 Angebot

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-h2-produkte.html` | H2 · Produkte | `/products` | Umbau | 390×844 |
| `mobil-h2-neu-was-legst-du-an.html` | H2 · Neu: Was legst du an? | `Neu-Menü` | neu | 390×844 |
| `mobil-h2-neues-produkt.html` | H2 · Neues Produkt | `/products (Formular Lebensmittel)` | Umbau | 390×844 |
| `mobil-h2-neues-produkt-grenze-hoftor.html` | H2 · Neues Produkt: Grenze im Hoftor (ab 1.2.2027) | `/products (Formular)` | Zustand (Gate 8, O8) | 390×844 |
| `mobil-h2-neues-futter-meldung-fehlt.html` | H2 · Neues Futter (Meldung fehlt) | `/products (Formular Futter)` | Umbau | 390×1320 |
| `mobil-h2-neues-brennmaterial.html` | H2 · Neues Brennmaterial | `/products (Formular Brennmaterial)` | Umbau | 390×844 |
| `mobil-h2-gespeichert-teilen.html` | H2 · Gespeichert – teilen? | `/products (Hinweis)` | neu | 390×844 |

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
| `system-farbtokens.html` | Farbtokens | `globals.css` | Zustand | 900×640 |
| `system-komponente-seitenleiste-hof.html` | Komponente – Seitenleiste Hof | `src/lib/bauern-navigation.ts + Shell` | Umbau | 264×960 |
| `system-hofseite-hell.html` | Hofseite hell | `/[farmSlug] hell` | Zustand | 390×844 |
| `system-heute-hell.html` | Heute hell | `/dashboard hell` | Zustand | 390×844 |
| `system-komponente-tarif-zeile-startphase.html` | Komponente – Tarif-Zeile in der Seitenleiste: Startphase | `HofShell (Seitenleiste)` | neu (Nr. 61) | 264×960 |
| `system-komponente-tarif-zeile-hoftor.html` | Komponente – Tarif-Zeile: Hoftor (ab 1.2.2027) | `HofShell (Seitenleiste)` | Zustand (Nr. 61, ruht bis Gate 8) | 264×960 |
| `system-komponente-tarif-zeile-gruendungshof.html` | Komponente – Tarif-Zeile: Gründungshof | `HofShell (Seitenleiste)` | Zustand (Nr. 61, 62) | 264×960 |
| `system-teilen-bild-varianten.html` | Komponente – Teilen-Bild 1:1: A Marktkarte (gilt), B Foto-Held (mit Foto), C Hoftafel (verworfen) | `/[farmSlug]/opengraph-image` | Umbau (Nr. 69) | 1720×720 |
| `system-teilen-bild-story-und-beitrag.html` | Komponente – Teilen-Bild Status 9:16 (QR nur hier) und Beitrag-Modus | `/[farmSlug]/opengraph-image?format=story, Beitrag-Bild (Nr. 67)` | Umbau (Nr. 69) | 1720×860 |
| `system-m1-marke-agrilo-entscheidung.html` | M1 · Marke – Entscheidung: EINE Bildmarke (A mit Blatt, Baum, Stadel, Furchen auf grüner Kachel) in zwei Fassungen (voll ab 48 px, klein darunter), Größenprobe 16/24/32/48/64, Apple 180, maskierbar 80 %, Teilen-Bild der Startseite, Regeln für Skript und Kopfzeile — **gilt** | Kopfzeile, Favicon und App-Icons, Teilen-Bild, Status-Bild, QR-Plakat | Umbau (Nr. 92) | 1440×760 |

## ADMIN · Betreiber – Stand Lauf 14 (15.10.)

Ein Seitenmuster für alle Admin-Seiten: Seitenkopf (Titel + ein Satz + rechts die Hauptaktion oder der Monat) · Kennzahlen-Zeile · Unterreiter (zweite Ebene als Pillen) · Inhalt · Regel-Zeile in leiser Schrift. Reiter in der Kopfzeile: Höfe · Postfach · Startseite (neu, Nr. 96) · Finanzen · Einstellungen (neu, Nr. 93). Darunter die Betriebsleiste mit „Stripe Test" (Register Z2) – ohne Link „Zur Testumgebung", weil es keine gibt (Z3 korrigieren). Einstellungen sind Gruppen (Gründungshöfe · Benachrichtigungen · Betrieb · Plattform), jede mit eigenem Speichern und Protokollzeile.

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `admin-hoefe-und-freischaltung.html` | Admin · Höfe: Seitenkopf, Kennzahlen, Unterreiter Warten · Alle · Gründungshöfe, Warteliste zeigt „bekäme Gründungsplatz Nr. 8", Tabelle mit Spalte Gründungshof (Nr., bis, „abweichend") | `/admin` | Umbau | 1440×900 |
| `admin-postfach.html` | Admin · Postfach › Eingang (Filter Offen): Antwort · Meldung · Aufgabe in einer Liste links, rechts die geöffnete Aufgabe (Hof wartet: Prüfliste, Freischalten/Ablehnen); Reiter Eingang · Rundschreiben · Zustellung (N12 geändert: Reiter Eingang · Rundschreiben · Zustellung) | `/admin/postfach` | Umbau | 1440×900 |
| `admin-postfach-zustellung.html` | Admin · Postfach › Zustellung: Empfängerliste (support@ fest, weitere mit Double-Opt-in) und Regel je Art (sofort · nur im Eingang · Wochenbericht); ersetzt „Einstellungen › Benachrichtigungen“ | `/admin/postfach/zustellung` (neu) | neu | 1440×1000 |
| `admin-postfach-unterhaltungen.html` | Admin · Postfach › Unterhaltungen: Eingang mit Filter Antwort links (480 px), rechts der Faden (Rundschreiben des Teams, Antwort des Hofs) mit Antwortfeld und Hinweis zur E-Mail-Grenze | `/admin/postfach?art=antwort` | Umbau | 1440×1000 |
| `admin-postfach-meldungen.html` | Admin · Postfach › Meldungen: Eingang mit Filter Meldung links, rechts Meldung (Text, Bildschirmfoto, automatisch Mitgeschicktes) und Entscheiden (Status, Bündel, Sprint, Antwort an den Hof) | `/admin/postfach?art=meldung` | Umbau | 1440×1080 |
| `admin-rundschreiben.html` | Admin · Postfach › Rundschreiben: Gesendet mit Lesequote und Antworten links; rechts neues Rundschreiben mit Empfänger (alle · ausgewählte · Filter), Art, Titel, Text, Link, Haken „Antwort möglich“ (neu) und „auch per E-Mail“, Vorschau „So sieht es der Hof“ | `/admin/postfach/rundschreiben` | Umbau (ersetzt die Fassung aus Lauf 13) | 1440×1200 |
| `system-postfach-prozess.html` | Schaubild: Quellen (Hof, Kundschaft, System) → Eingang (drei Arten mit eigenem Weg) → Zustellung (Regeln, Empfänger, Wochenbericht); Ausgang Rundschreiben → Hof-Postfach → Antwort zurück in den Eingang; Hof-Seite spiegelbildlich | Konzept (`docs/konzepte/`) | Konzept | 1760×1250 |
| `admin-finanzen.html` | Admin · Finanzen: Monat im Seitenkopf, Kennzahlen (Grundgebühren 0 € in der Gründungsphase), Unterreiter Monat · Kosten · Auszahlungen · Entfallene Gebühren, Verlauf, Kosten | `/admin/finanzen` | Umbau | 1440×900 |
| `admin-einstellungen.html` | Admin · Einstellungen › Gründungshöfe: Gruppen links (Gründungshöfe · Betrieb · Plattform), rechts Plätze/Vergeben/Frei, Plätze gesamt, Kostenlos bis (Standard), Schalter „Auf den Seiten zeigen", Vorschau des Satzes und der Pill, Protokoll | `/admin/einstellungen` (neu) | neu | 1440×1010 |
| `admin-startseite-gestalten.html` | Lauf 14 · Admin › Startseite: Abschnittsliste (Kopf, Höfe, Fuß fest; ziehen = Reihenfolge, Auge = aus/ein), Einfügepunkte „Block einfügen“, Block bearbeiten (Vorlage, Überzeile, Titel, Text, Bild, Link, Live ab/bis Wiener Zeit), Vorlagen-Bibliothek (Saisonkarte mit Bild, Hinweisband, Höfe-Auswahl, Kategorie-Hinweis) – Konzept in der Lauf-13-Vormerkung (StartseiteAbschnitt + StartseiteBlock, Migration + Seed) | `/admin/startseite` (neu) | neu (geparkt seit Lauf 13) | 1440×1100 |
| `admin-startseite-vorschau.html` | Lauf 14 · Admin › Startseite, Umschalter „So sieht’s die Kundin“: Handy/Web, „Stand am“ (Heute · +1 Woche · nächster Block), echte Startseite mit den Blöcken des Tages plus Block in Bearbeitung, signierter Vorschau-Link (1 h) | `/admin/startseite?ansicht=vorschau` (neu) | neu (geparkt seit Lauf 13) | 1440×1040 |
| `mobil-k0-startseite-saisonblock.html` | Lauf 14 · Startseite am Handy mit Saisonblock (Vorlage Saisonkarte mit Bild) zwischen Kopf und „Höfe in deiner Nähe“ | `/` (Handy) | Zustand | 390×900 |
| `admin-mobil-unterwegs-freischalten.html` | Admin am Handy · Höfe: Reiter unter dem Kopf, Kennzahlen, Warteliste mit Gründungsplatz | `/admin (Handy)` | Umbau | 390×844 |
| `admin-mobil-einstellungen.html` | Admin am Handy · Einstellungen: Gruppen als Liste (ohne Benachrichtigungen – die sind Postfach › Zustellung), Gründungshöfe aufgeklappt | `/admin/einstellungen (Handy)` | neu | 390×844 |

## GRÜNDUNGSHÖFE · Vorschlag 15.10. (Register K2, nach Mobbin- und NN/g-Bewertung)

Kein Banner, sondern Bausteine: ein Satz im Lesefluss (Startseite), Pill + umbenannter Knopf + Fußnote im Kopf von /fuer-hoefe, Angebotszeile direkt über den Tarifkarten (Hofladen 0 € bis 31.12.2027, dann 19 €), ein ehrlicher Satz über dem Registrierformular („voraussichtlich Nr. 8"), einmaliger wegklickbarer Hinweis auf Heute nach der Freischaltung – keine Dauerkarte, keine seitenweite Leiste, kein Countdown. Sind alle Plätze vergeben oder ist das Datum vorbei, verschwindet alles. Zahlen aus `src/lib/gruendungshof.ts` bzw. den Admin-Einstellungen.

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `system-k2-gruendung-bausteine.html` | Gründungshöfe · Bausteine: Satz (dunkel/hell), Pill/Knopf/Fußnote, Preiszeile + Hofladen-Preis, Registrieren-Satz, einmaliger Hinweis, Zustände (letzter Platz, alle vergeben, Datum vorbei), Regeln | Bausteine (`components/gruendung/*`) | neu | 1760×860 |
| `web-k2-startseite-gruendung.html` | Startseite am Computer · Für-Höfe-Band mit dem Gründungssatz | `/` (Für-Höfe-Band) | Zustand | 1440×3390 |
| `mobil-k2-startseite-gruendung.html` | Startseite am Handy · Für-Höfe-Karte mit dem Gründungssatz | `/` (Handy) | Zustand | 390×2544 |
| `web-k2-fuer-hoefe-gruendung.html` | /fuer-hoefe am Computer · Pill, Knopf „Gründungshof werden", Fußnote; Angebotszeile über den Preisen; Hofladen 0 € bis 31.12.2027 | `/fuer-hoefe` | Zustand | 1440×3170 |
| `mobil-k2-fuer-hoefe-gruendung.html` | /fuer-hoefe am Handy · Pill, Knopf, Fußnote; Angebotszeile vor der Preiskarte | `/fuer-hoefe (Handy)` | Zustand | 390×1830 |
| `web-k2-registrieren-gruendung.html` | Hof registrieren am Computer · Satz über dem Formular mit voraussichtlicher Nummer | `/register` | Zustand | 1440×1070 |
| `mobil-k2-registrieren-gruendung.html` | Hof registrieren am Handy · Satz über dem Formular | `/register (Handy)` | Zustand | 390×844 |

## Hinweise

Wortliste (gilt für alle Oberflächen, Admin und Hof): **Postfach** = der eine Ort, an dem alles ankommt; **Nachricht** = ein Eintrag; **Rundschreiben** = eine Nachricht vom Team an viele Höfe; **Unterhaltung** = der Faden aus Nachricht und Antworten; **Meldung** = Fehler, Wunsch oder Frage an das Team. Nicht mehr: Briefkasten, Post, Chat, Mitteilung, Benachrichtigung. Verbindlich steht die Wortliste in `../ai/DESIGN_SYSTEM.md`.

Geparkt bleiben Unterhaltungen zwischen Höfen (K3/T8) und Anzeige im Umkreis; „Startseite gestalten“ ist mit Lauf 14 freigegeben (Register N16, Nr. 96).
