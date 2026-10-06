# Mockups

Eigenständige HTML-Dateien, direkt im Browser zu öffnen. Alle Farben, Abstände, Radien und Texte stehen als Inline-Styles im Markup und dürfen exakt ausgelesen werden. Geteilte Bausteine (Seitenleiste, eingebettete Seiten in Vorschauen und Dialogen) sind zur Ansicht eingebettet; im Code sind sie **eine** Komponente.

Farben sind auf das dunkle Standard-Theme aufgelöst. Die verbindlichen Token-Paare stehen in `../ai/DESIGN_SYSTEM.md`. Beispieldaten (Höfe, Namen, Preise, Nummern) sind Platzhalter.

**Dateinamen:** `web-` oder `mobil-`, dann der Schritt im Ablauf (`k0`–`k4` Kunde, `h0`–`h6` Hof), dann der Bildschirm. `admin-`, `fehler-` und `system-` sind Querschnitt.

**Spalte Arbeit:** *Umbau* = bestehende Route ins neue Design und um die gezeigten Funktionen erweitern · *neu* = Route oder Funktion gibt es noch nicht · *Zustand* = Variante einer Route (leer, Fehler, Hinweis) · *zurückgestellt* = wird vorerst nicht gebaut, Grund im Entscheidungsregister `../entscheidungen.md`.


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

## WEB · Kunde – K2 Hof und Produkte ansehen

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `web-k2-hofseite.html` | K2 · Hofseite | `/[farmSlug]` | Umbau | 1440×1500 |
| `web-k2-alle-produkte-nach-kategorie.html` | K2 · Alle Produkte nach Kategorie | `/[farmSlug] Reiter Produkte` | Umbau | 1440×2420 |
| `web-k2-futter-groesse-waehlen.html` | K2 · Futter: Größe wählen | `/[farmSlug]/produkt/[id] (neu)` | neu | 1440×1500 |
| `web-k2-brennmaterial-brennholz.html` | K2 · Brennmaterial: Brennholz | `/[farmSlug]/produkt/[id] (neu)` | neu | 1440×1560 |

## WEB · Kunde – K3 Kaufen

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `web-k3-warenkorb-bezahlen.html` | K3 · Warenkorb & Bezahlen | `/[farmSlug]/checkout` | Umbau | 1440×1180 |
| `web-k3-zahlung-abgelehnt.html` | K3 · Zahlung abgelehnt | `/[farmSlug]/checkout (Fehler)` | Zustand | 1440×1180 |
| `web-k3-bestaetigung-online-mit-erzaehl-s-weiter.html` | K3 · Bestätigung (online) mit „Erzähl's weiter" | `/[farmSlug]/confirm/[orderId]?sig=` | Umbau | 1440×1200 |
| `web-k3-bar-wartet-auf-bestaetigung.html` | K3 · Bar: wartet auf Bestätigung | `/[farmSlug]/confirm/[orderId] (bar, offen)` | Zustand | 1440×900 |
| `web-k3-bar-bestellung-bestaetigen-link-aus-mail.html` | K3 · Bar: Bestellung bestätigen (Link aus Mail) | `/[farmSlug]/bestaetigen/[token] (neu, H3)` | neu | 1440×820 |
| `web-k3-e-mails-web-mobil.html` | K3 · E-Mails (Web + Mobil) | `src/emails/*` | Umbau | 680×1320 |

## WEB · Kunde – K4 Nach dem Kauf

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `web-k4-meine-bestellungen-konto.html` | K4 · Meine Bestellungen & Konto | `/account/profile` | nur Umbau bestehender `/account`-Seiten (E8) | 1440×1060 |

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
| `web-h1-einstellungen-konditionen.html` | H1 · Einstellungen › Konditionen | `/settings/konditionen (neu)` | neu | 1440×1080 |
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
| `web-h3-bestellungen-packen-uebergeben.html` | H3 · Bestellungen: packen & übergeben | `/orders + /orders/[orderId]` | Umbau | 1440×960 |
| `web-h3-artikel-fehlt.html` | H3 · Artikel fehlt | `/orders/[orderId] (Dialog, neu)` | neu | 1440×960 |
| `web-h3-stornieren-erstatten.html` | H3 · Stornieren & erstatten | `/orders/[orderId] (Dialog)` | Umbau | 1440×960 |

## WEB · Hof – H4 Teilen und Kunden gewinnen

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `web-h4-teilen-fenster-mit-bild.html` | H4 · Teilen-Fenster mit Bild | `/status/new bzw. Dialog` | neu | 1440×960 |
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

## MOBIL · Kunde – K0 Ankommen

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-k0-startseite.html` | K0 · Startseite | `/` | Umbau | 390×2420 |
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

## MOBIL · Kunde – K3 Kaufen

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-k3-warenkorb-bezahlen.html` | K3 · Warenkorb & Bezahlen | `/[farmSlug]/checkout` | Umbau | 390×844 |
| `mobil-k3-zahlung-abgelehnt.html` | K3 · Zahlung abgelehnt | `/[farmSlug]/checkout (Fehler)` | Zustand | 390×844 |
| `mobil-k3-bestaetigung.html` | K3 · Bestätigung | `/[farmSlug]/confirm/[orderId]?sig=` | Umbau | 390×844 |
| `mobil-k3-bar-bestaetigen.html` | K3 · Bar bestätigen | `/[farmSlug]/bestaetigen/[token] (neu, H3)` | neu | 390×844 |

## MOBIL · Kunde – K4 Danach

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-k4-meine-bestellungen.html` | K4 · Meine Bestellungen | `/account/profile` | nur Umbau bestehender `/account`-Seiten (E8) | 390×844 |
| `mobil-k4-meine-hoefe.html` | K4 · Meine Höfe | `/account/hoefe` | zurückgestellt (E8) | 390×844 |

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

## MOBIL · Hof – H2 Angebot

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-h2-produkte.html` | H2 · Produkte | `/products` | Umbau | 390×844 |
| `mobil-h2-neu-was-legst-du-an.html` | H2 · Neu: Was legst du an? | `Neu-Menü` | neu | 390×844 |
| `mobil-h2-neues-produkt.html` | H2 · Neues Produkt | `/products (Formular Lebensmittel)` | Umbau | 390×844 |
| `mobil-h2-neues-futter-meldung-fehlt.html` | H2 · Neues Futter (Meldung fehlt) | `/products (Formular Futter)` | Umbau | 390×1320 |
| `mobil-h2-neues-brennmaterial.html` | H2 · Neues Brennmaterial | `/products (Formular Brennmaterial)` | Umbau | 390×844 |
| `mobil-h2-gespeichert-teilen.html` | H2 · Gespeichert – teilen? | `/products (Hinweis)` | neu | 390×844 |

## MOBIL · Hof – H3 Tagesgeschäft

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-h3-heute-mit-teilen-karte.html` | H3 · Heute mit Teilen-Karte | `/dashboard` | Umbau | 390×844 |
| `mobil-h3-heute-online-zahlung-pausiert.html` | H3 · Heute: Online-Zahlung pausiert | `/dashboard (Stripe pausiert)` | Zustand | 390×844 |
| `mobil-h3-bestellungen.html` | H3 · Bestellungen | `/orders` | Umbau | 390×844 |
| `mobil-h3-bestelldetail.html` | H3 · Bestelldetail | `/orders/[orderId]` | Umbau | 390×844 |
| `mobil-h3-stornieren.html` | H3 · Stornieren | `/orders/[orderId] (Blatt)` | Umbau | 390×844 |

## MOBIL · Hof – H4 Teilen

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-h4-teilen-ueber-das-telefon.html` | H4 · Teilen über das Telefon | `/status/[id]/send-whatsapp → Web Share` | Umbau | 390×844 |

## MOBIL · Hof – H5 Mehr

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-h5-mehr-auswertung-region-mein-hof.html` | H5 · Mehr: Auswertung, Region, Mein Hof | `Hof-Unterleiste „Mehr"` | Umbau | 390×844 |
| `mobil-h5-einstellungen.html` | H5 · Einstellungen | `/settings` | Umbau | 390×1000 |

## MOBIL · Hof – H6 Hilfe

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `mobil-h6-meldung-abgeben.html` | H6 · Meldung abgeben | `/fehler-melden` | Umbau | 390×844 |
| `mobil-h6-meine-meldungen.html` | H6 · Meine Meldungen | `/meldungen` | Umbau | 390×844 |

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

## ADMIN · Betreiber (Höfe, Briefkasten, Finanzen)

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `admin-hoefe-und-freischaltung.html` | Admin · Höfe und Freischaltung | `/admin` | Umbau | 1440×980 |
| `admin-briefkasten.html` | Admin · Briefkasten | `/admin/meldungen` | Umbau | 1440×860 |
| `admin-meldung-entscheiden.html` | Admin · Meldung entscheiden | `/admin/meldungen/[id]` | Umbau | 1440×1040 |
| `admin-finanzen.html` | Admin · Finanzen | `/admin/finanzen` | Umbau | 1440×900 |
| `admin-mobil-unterwegs-freischalten.html` | Admin mobil · unterwegs freischalten | `/admin (Handy)` | Umbau | 390×844 |
