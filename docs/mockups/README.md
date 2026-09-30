# Mockups

18 eigenständige HTML-Dateien: direkt im Browser öffnen (Doppelklick genügt, Schriften laden von Google Fonts) oder von Claude Code als exakte Referenz lesen – alle Farben, Abstände, Radien und Typografiewerte stehen als Inline-Styles im Markup. Geteilte Bausteine (Sidebar, Handy-Vorschau im Editor) sind hier zur Ansicht eingebettet; im Code sind sie **eine** Komponente, siehe `../umsetzungsprompt.md`.

Farbwerte sind auf das dunkle Standard-Theme aufgelöst (Grün `#2e6b45`, Orange `#e07a4a`); die Theme-Paare stehen in `design-tokens.html` und in der Token-Tabelle des Umsetzungsprompts.

| Datei | Screen | Welt | Viewport | Theme |
| --- | --- | --- | --- | --- |
| kunde-entdecken-mobil.html | Entdecken/Start: Suche, Karte, Höfe in der Nähe | Kunde | 390×844 | Dunkel |
| kunde-hofseite-mobil.html | Hofseite (Übersicht) mit Bottom-Nav | Kunde | 390×844 | Dunkel |
| kunde-hofseite-mobil-hell.html | Hofseite (Übersicht) | Kunde | 390×844 | Hell |
| kunde-hofseite-desktop.html | Hofseite im Browser: Top-Nav, zweispaltig, Produkte | Kunde | 1440×1500 | Dunkel |
| kunde-produkte-mobil.html | Produkte-Tab: Chips, Stepper, Ausverkauft-Zustand, Warenkorb-Leiste | Kunde | 390×844 | Dunkel |
| kunde-warenkorb-checkout-mobil.html | Warenkorb & Checkout (ein Screen): Artikel, Zeitfenster, Zahlung | Kunde | 390×844 | Dunkel |
| kunde-bestaetigung-mobil.html | Bestellbestätigung mit Abholcode | Kunde | 390×844 | Dunkel |
| hof-mein-hof-editor-desktop.html | „Mein Hof"-Editor mit Checkliste und Handy-Live-Vorschau | Bauer | 1440×1150 | Dunkel |
| hof-sidebar-komponente.html | Seitennavigation (geteilte Komponente) | Bauer | 264×960 | Dunkel |
| hof-heute-desktop.html | Heute-Dashboard: KPIs, Packliste, Wochenumsatz | Bauer | 1440×960 | Dunkel |
| hof-bestellungen-desktop.html | Bestellübersicht: Filter, Tabelle, Pagination | Bauer | 1440×960 | Dunkel |
| hof-heute-mobil.html | Heute-Dashboard mit Bottom-Nav und Packliste | Bauer | 390×844 | Dunkel |
| hof-heute-mobil-hell.html | Heute-Dashboard | Bauer | 390×844 | Hell |
| hof-bestellungen-mobil.html | Bestellungen, gruppiert nach Abholfenster | Bauer | 390×844 | Dunkel |
| hof-mehr-mobil.html | „Mehr"-Menü: restliche Navigation + Account, Theme-Schalter | Bauer | 390×844 | Dunkel |
| hof-produkt-neu-mobil.html | Neues Produkt: Foto, Felder, Verfügbarkeit, Lagerstand | Bauer | 390×844 | Dunkel |
| hof-bestelldetail-mobil.html | Bestelldetail: Artikel-Checkliste, Kundin, Status-CTA | Bauer | 390×844 | Dunkel |
| design-tokens.html | Farbtoken-Sheet: Dunkel- und Hell-Paare nebeneinander | System | 900×640 | beide |

Flow-Reihenfolge der Kaufstrecke: entdecken → hofseite → produkte → warenkorb-checkout → bestaetigung. Enthaltene Beispieldaten (Höfe, Produkte, Preise, Namen) sind Platzhalter.
