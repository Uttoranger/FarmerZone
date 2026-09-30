# Design-System

Verbindliche UI-Regeln für Kundenseite und Hofbereich. Visuelle Referenz: `docs/mockups/` (Zuordnung im dortigen README). Einführungsplan und Reihenfolge: `docs/umsetzungsprompt.md`.

## Farbtokens

Alle Farben kommen aus CSS-Custom-Properties auf `:root`, umgeschaltet über `data-theme` am `<html>`. Komponenten referenzieren ausschließlich Tokens — nie Hexwerte (Lint-Regel). Referenz-Ansicht: `docs/mockups/design-tokens.html`.

| Token | Dunkel (Standard) | Hell |
|---|---|---|
| --bg | #0B100C | #F4F1E7 |
| --surface | #131B14 | #FBF9F2 |
| --border | #223125 | #E2DDC9 |
| --text | #F1EEE3 | #1C241D |
| --text-muted | #9AA899 | #5D6A5C |
| --accent (Grün) | #2E6B45 | #2E6B45 |
| --on-accent | #F6F4EA | #F6F4EA |
| --primary (Orange) | #E07A4A | #E07A4A |
| --on-primary | #231208 | #231208 |
| --status-offen | #E59A6F | #9C4D20 |
| --status-fertig | #9FD0AF | #2E6B45 |

- Buttons behalten ihre Markenfarben in beiden Themes.
- Status-Textfarben sind pro Theme definiert; nie die Variante des anderen Themes verwenden — sonst fällt der Kontrast auf Creme unter 4,5:1.
- Bild-Overlays (Titelbilder, Cover) bleiben immer dunkel hinterlegt und sind theme-unabhängig.
- Theme-Default beim Erstbesuch aus `prefers-color-scheme`; die Wahl wird am Nutzerprofil gespeichert. Schalter: „Mehr"-Menü (mobil) bzw. Sidebar (Desktop).

## Typografie und Form

- Fraunces (600) für H1–H3 und Kennzahlen; Instrument Sans für allen anderen UI-Text.
- Karten: Radius 14–16 px, `--surface` mit `--border`. Buttons: Pills (Radius 999).

## Farbrollen

- **Grün (`--accent`)** = Kundenaktionen (kaufen, bestellen) und Zustand „erledigt/gepackt".
- **Orange (`--primary`)** = Hofbereich (erstellen, „+ Neu") und Zustand „offen/zum Packen".
- Rollen nie vertauschen; am Farbton erkennt man die Welt.

## Komponenten

- Basiskomponenten liegen an genau **einem** Ort (`src/components/ui`); Kundenseite und Hofbereich importieren nur von dort. Kein Duplizieren in Feature-Ordner.
- Bestand: Button (accent, primary, outline, ghost), Card, StatusBadge (offen/fertig/neutral), Input mit Label, Select, Stepper, Toggle, Tabs, Filter-Chips, BottomNav mit Mittelbutton-Slot, Sidebar, ListRow, Table, ProgressBar, EmptyState, Skeleton, Toast.
- Neue oder geänderte Komponente: zuerst auf der Preview-Seite in beiden Themes und beiden Breakpoints abnehmen, dann in Screens verwenden.
- Während Feature-Arbeit sind Änderungen an bestehenden Komponenten nur **additiv** (neue Variante, kein geändertes Verhalten).
- Preis-, Zeit- und Datumsformatierung kommt aus gemeinsamen Formatierern neben den Komponenten; nie pro Screen duplizieren.

## Navigation (AppShells)

- Zwei Shells, je Welt eine; Seiten hängen nur Inhalt ein, Navigation wird nie pro Seite dupliziert.
- Unter 768 px: Bottom-Navigation mit erhobenem Mittelbutton (Kunde: Warenkorb, grün; Bauer: „+ Neu", orange). Ab 768 px: Top-Navigation (Kunde) bzw. Sidebar (Bauer). Safe-Areas (Notch, Home-Indicator) beachten.
- Die Hofseiten-Vorschau im „Mein Hof"-Editor rendert dieselbe Hofseiten-Komponente wie die Kundenansicht in einem skalierten Frame — nie eine zweite Implementierung.

## Zustände

Jeder Screen liefert vier Zustände:

- **Gefüllt** — nach Mockup.
- **Leer** — Icon + ein Satz + primäre Aktion („Noch keine Produkte — Lege dein erstes an").
- **Laden** — Skeleton in Kartenform, kein Spinner.
- **Fehler** — inline am Feld bzw. an der Karte, kein Modal.

## Qualität

- Kontrast ≥ 4,5:1 in beiden Themes; Touch-Ziele ≥ 44 px; genau **ein** primärer Call-to-Action pro Screen, alles Weitere outline oder ghost.
- Jeder UI-PR verlinkt das zugehörige Mockup aus `docs/mockups/` namentlich und wird dagegen abgenommen.
