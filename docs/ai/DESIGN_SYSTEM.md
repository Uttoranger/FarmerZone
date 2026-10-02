# Design-System

Verbindliche UI-Regeln für Kundenseite und Hofbereich. Visuelle Referenz: `docs/mockups/` (Zuordnung im dortigen README). Einführungsplan und Reihenfolge: `docs/umsetzungsprompt.md`.

## Farbtokens

Alle Farben kommen aus CSS-Custom-Properties auf `:root`, umgeschaltet über `data-theme` am `<html>`. Komponenten referenzieren ausschließlich Tokens — nie Hexwerte (Lint-Regel). Referenz-Ansicht: `docs/mockups/design-tokens.html`. Im Code heißen die Tokens dieser Tabelle `--fz-<name>` (`src/app/globals.css`): Das Präfix trennt sie von den shadcn-Variablen gleichen Namens (`--border`, `--primary`, `--accent`), die der Bestand mit anderer Bedeutung nutzt. Sie stehen als oklch mit dem Hexwert der Tabelle als Kommentar (CODING_STANDARDS §7); `tests/design-tokens.test.ts` gleicht Tabelle und CSS ab — wer hier einen Wert ändert, ändert ihn dort mit.

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
- Theme-Default beim Erstbesuch aus `prefers-color-scheme`; die Wahl wird auf dem Gerät gespeichert (localStorage `theme`, siehe „Technische Regeln") — nicht am Nutzerprofil: Die Hofseite sieht für Besucher so aus, wie deren Gerät eingestellt ist, und eine Spalte dafür gibt es nicht (ARCHITECTURE §4). Schalter: „Mehr"-Menü (mobil) bzw. Sidebar (Desktop).

## Typografie und Form

- Fraunces (600) für H1–H3 und Kennzahlen; Instrument Sans für allen anderen UI-Text. Utilities: `font-heading` (Fraunces) und `font-sans` (im neuen Design Instrument Sans, im Bestand noch Geist).
- Karten: Radius 14–16 px, `--surface` mit `--border`. Buttons: Pills (Radius 999).
- Pills nur für Buttons in Inhaltsbreite; Buttons über volle Containerbreite nutzen Radius 12–14 px.

## Technische Regeln (seit Schritt 1 des Umsetzungsprompts)

- **Schriften self-gehostet.** Fraunces und Instrument Sans kommen über `next/font/google` in `src/app/layout.tsx`: beim Build geladen, vom eigenen Ursprung ausgeliefert, als CSS-Variablen `--font-fraunces` und `--font-instrument-sans`. Kein `<link>` zu Google Fonts, kein anderes CDN im Produkt — die CDN-Links in `docs/mockups/` sind nur Referenz. `tests/theme-schalter.test.ts` sucht danach.
- **Theme ohne Flash.** `next-themes` setzt `data-theme="light|dark"` am `<html>` per Inline-Skript im `<head>`, bevor React hydriert; `defaultTheme="system"` heißt Erstbesuch nach `prefers-color-scheme`, danach gilt die gemerkte Wahl aus dem localStorage (`theme`). Die `dark:`-Utilities laufen über `@custom-variant dark` auf `[data-theme="dark"]` — eine Klasse `dark` gibt es nicht mehr. Der Modus hat genau eine Quelle: `useTheme()` aus `next-themes` (Schalter `src/components/shared/theme-umschalter.tsx`, Karte „Darstellung", Diagramme über `resolvedTheme`).
- **Tokens shadcn-kompatibel, Route für Route.** Die shadcn-Variablen (`--background`, `--card`, `--popover`, `--foreground`, `--muted-foreground`, `--border`, `--input`, `--primary`, `--primary-foreground`, `--accent`, `--accent-foreground`, `--sidebar-*`) zeigen auf die `--fz-`-Tokens, sobald ein Element im Dokument `data-design="neu"` trägt (`:root:is([data-design="neu"], :has([data-design="neu"]))` in `globals.css`). Die Shell einer umgestellten Route setzt den Marker; damit folgen auch Portale (Dialog, Sheet, Toast), die außerhalb der Shell in `<body>` hängen. Ohne Marker bleibt der Bestand unverändert — so wandert das Redesign Route für Route, nie als Big Bang. Komponenten schreiben weiter `bg-background`, `bg-card`, `bg-primary`, `text-muted-foreground`; nur die Zuordnung steht in `globals.css`. Grüner **Text** und der Fokusring (`--brand-text`, `--ring`, `--sidebar-ring`) nehmen `--fz-status-fertig` (am Tag dasselbe Grün wie `--accent`, nachts helles Salbei), weil das Knopf-Grün auf dunklem Grund nur 3:1 erreicht; oranger Text nimmt aus demselben Grund `text-status-offen`, nie `text-primary`. `--radius` steht im Geltungsbereich auf 16 px. Werte, die diese Tabelle nicht nennt (`--muted`, `--secondary`, `--accent-hover`), sind dort als abgeleitet markiert. Zustandsfarben: `text-status-offen`, `text-status-fertig`.
- **Lint.** ESLint (`no-restricted-syntax`, `eslint.config.mjs`) weist Hex-, `rgb()`-, `hsl()`- und `oklch()`-Literale in allem unter `src/` ab. Ausgenommen sind nur `src/emails/**` (Mailprogramme kennen keine CSS-Variablen) und die Liste `FARBLITERAL_BESTAND` mit den heutigen Fundstellen — sie darf nur schrumpfen: Wer eine gelistete Datei umbaut, nimmt sie heraus. Eine einzelne Ausnahme in einer geprüften Datei (Overlay auf einem Foto) nur so: `// eslint-disable-next-line no-restricted-syntax -- <warum kein Token passt>`.

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

## Symbole, Zeiger, Texte

- **Keine Emojis als Bedeutungsträger in der Oberfläche – Icons aus lucide-react.** Strichstärke 1.7 (große Symbole in Leerzuständen 1.5), Farbe aus einem Token. Steht Text daneben, trägt das Symbol `aria-hidden="true"` und der Text die Bedeutung; ein Knopf nur mit Symbol bekommt ein `aria-label`.
- Ausgehende Vorlagen — E-Mails, WhatsApp-Nachricht, Story-Grafik — tragen ebenfalls keine Emojis; dort steht Text. Fremdtext (Produktnamen, Beiträge der Höfe) bleibt, wie der Hof ihn geschrieben hat. `tests/keine-emojis.test.ts` prüft jede Zeichenkette und jeden JSX-Text unter `src/`; ausgenommen sind ©, ®, ™ und Server-Logs (`console.*`).
- Ein Symbol, das für eine Sache steht, wird an genau einer Stelle zugeordnet, nicht je Liste neu: Verkaufswege `KANAL_SYMBOL` (`src/components/sales/kanal-symbol.tsx`), Werte der Hofseite `WERT_SYMBOL` über den Katalog in `src/lib/hof-werte.ts`. Einen Wert erkennt der Editor am Titel (`istGewaehlt`, `katalogEintrag`), nie an der Spalte `FarmValue.icon` — sie wird nirgends angezeigt.
- **Was man anklicken kann, zeigt die Hand.** `Button` trägt `cursor-pointer` in der Grundklasse; rohe `<button>`, `[role="button"]` und `label[for]` bekommen sie aus `@layer base` in `src/app/globals.css`, gesperrte nicht. Selbst setzen nur dort, wo diese Regel nicht greift: Label um eine Checkbox ohne `for`, `<summary>`, Zeilen und Kacheln mit `onClick`, `role="option"`, der Switch (`<span role="switch">`). Ein doppeltes `cursor-pointer` an Knopf oder `label[for]` weist `tests/knopf-zeiger.test.ts` ab.
- **Texte der Basiskomponenten sind deutsch**, auch der Screenreader-Text („Schließen", nie „Close"). Eine übernommene shadcn-Vorlage wird im selben Zug übersetzt; Standardtexte einer Bibliothek werden über ihre Optionen gesetzt (sonner: `containerAriaLabel`, `closeButtonAriaLabel`). `tests/schliessen-text.test.ts` prüft beides.

## Navigation (AppShells)

- Zwei Shells, je Welt eine; Seiten hängen nur Inhalt ein, Navigation wird nie pro Seite dupliziert.
- Unter 768 px: Bottom-Navigation mit erhobenem Mittelbutton (Kunde: Warenkorb, grün; Bauer: „+ Neu", orange). Ab 768 px: Top-Navigation (Kunde) bzw. Sidebar (Bauer). Safe-Areas (Notch, Home-Indicator) beachten.
- Die Hofseiten-Vorschau im „Mein Hof"-Editor rendert dieselbe Hofseiten-Komponente wie die Kundenansicht in einem skalierten Frame — nie eine zweite Implementierung (technisch: ARCHITECTURE §4, „Die Hofseite gibt es genau einmal").

Vorschau im Hofbereich: Der Umschalter bedeutet Gerät (Handy/Web, inline — die Bearbeitung bleibt sichtbar), Vergrößern bedeutet Größe (Overlay). Die Vorschau rendert immer die echte Kundenseite inklusive Navigation, im selben `data-design`-Zustand wie die Live-Route.

## Zustände

Jeder Screen liefert vier Zustände:

- **Gefüllt** — nach Mockup.
- **Leer** — Icon + ein Satz + primäre Aktion („Noch keine Produkte — Lege dein erstes an").
- **Laden** — Skeleton in Kartenform, kein Spinner.
- **Fehler** — inline am Feld bzw. an der Karte, kein Modal.

### Ladeansicht einer Route (`loading.tsx`)

- **Nur wo auf den Server gewartet wird.** Eine synchrone Seite ohne Datenabruf bekommt keine — das Skeleton wäre ein Blitzen ohne Anlass.
- **Reichweite prüfen, bevor die Datei entsteht.** Next.js nimmt die nächstgelegene `loading.tsx` nach oben; eine im Wurzelsegment gilt auch für `/login`, `/admin` und `/account`. Eine Ladeansicht gehört deshalb in das Segment, dessen Form sie zeigt, nie höher.
- **Die Kopfleiste gehört ins Skeleton.** Kundenseiten rendern sie selbst (es gibt kein `(public)/layout.tsx`), also fehlt sie während des Ladens, wenn das Skeleton sie nicht mitbringt: 56 px, ab `md` 64 px, `border-b border-border bg-card`.
- **Gleiche Maße wie der fertige Inhalt**, von der echten Seite abgenommen — sonst springt sie beim Umschalten.
- **Nur zeigen, was im wartenden Fall sicher da ist.** Bedingte Teile (Filter-Chips, Fotostreifen, Hinweisbänder) weglassen: Reservierter Platz, in den nichts einrückt, lässt den Inhalt nach oben springen. Maßstab ist der Fall, in dem wirklich gewartet wird — ein Zweig, der ohne Datenbankzugriff sofort antwortet (etwa die Bestellverfolgung mit ungültiger Signatur), zeigt das Skeleton kaum und entscheidet seine Form nicht.
- **Die serverseitige Gestalt zeigen**, nicht die hydrierte. Wo ein Client-Teil erst nach der Hydration umbricht (`/hoefe`: Splitscreen ab `lg`), zeigt das Skeleton die schmale Form — sonst springt es zweimal.
- **Farbstaffelung** wie in `src/app/(farmer)/loading.tsx`: `bg-border` für Überschriften, `bg-app-trough` für Zweitzeilen, `bg-app-chip` für leise Zeilen, `bg-muted` für Flächen. Ein `animate-pulse` auf dem Rahmen, `aria-busy="true"` dazu.

### Ganzseitige Fehlerseiten (404, 500)

- Texte und Knopfbeschriftungen kommen aus `src/lib/fehlerseite.ts` — die 500 gibt es zweimal (`error.tsx` und `global-error.tsx`), und zwei Wortlaute laufen auseinander.
- **Kein Emoji als Illustration**, in keinem Zustand.
- Die 500 zeigt die **Fehlernummer** (`error.digest`) und sonst nichts Technisches: keine Fehlermeldung, kein Stapel, kein Dateiname.
- Die 500 trägt **keine Kopfleiste**: War sie selbst die Ursache, risse sie die Fehlerseite mit. Der Weg nach Hause steht als Knopf, als gewöhnlicher Link (Vollaufbau) statt `<Link>`.
- `global-error.tsx` bringt `<html>`, `<body>` und den Import des Stylesheets selbst mit und meldet nach Sentry — sie ist die einzige Grenze, die ein Fehler im Root-Layout erreicht.

## Qualität

- Kontrast ≥ 4,5:1 in beiden Themes; Touch-Ziele ≥ 44 px; genau **ein** primärer Call-to-Action pro Screen, alles Weitere outline oder ghost.
- Namen (Hof, Person, Produkt) in Karten, Zeilen und Leisten halten jede Länge bis zur Obergrenze aus (`src/lib/eingabegrenzen.ts`, 80 bzw. 100 Zeichen): höchstens zwei Zeilen (`line-clamp-2 break-words`) oder eine (`truncate`), der volle Text im `title`. Liegt ein gestreckter Link über der Karte, trägt er den `title` — er fängt den Zeiger. Im Teilen-Bild (Satori) `display: 'block'` + `lineClamp` + `wordBreak: 'break-word'`.
- Jeder UI-PR verlinkt das zugehörige Mockup aus `docs/mockups/` namentlich und wird dagegen abgenommen.

## Ergänzungen aus den Mockups (Stand Oktober 2026)

Diese Regeln stammen aus der Mockup-Runde (`docs/mockups/`, Index im dortigen README) und gelten für jede Route, die in den Geltungsbereich `data-design="neu"` umzieht.

### Shells und Navigation – feste Einträge

- **Kunde Web, abgemeldet:** Logo · Höfe entdecken · So funktioniert's · Für Höfe · [Anmelden]. **Angemeldet:** Logo · Suche · Höfe entdecken · Meine Bestellungen · Warenkorb (mit Anzahl) · Profil. Öffentliche Seiten zeigen die Variante passend zur Sitzung, nie eine dritte.
- **Kunde Handy, Unterleiste:** Entdecken · Meine Höfe · [Warenkorb] · Bestellungen · Konto. Die Suche sitzt oben in „Entdecken", nicht als eigener Reiter.
- **Hof Web, Seitenleiste (Reihenfolge fest):** Hofkarte · [+ Neu ▾] · Heute · Bestellungen · Produkte · Mein Hof · *Verkauf und Kunden:* Kunden · Verkäufe · Auswertung · Region · *unten:* Einstellungen · Hilfe und Rückmeldung · Admin (nur für Admins, Zahl = alles, was zu entscheiden ist) · Konto.
- **Hof Handy, Unterleiste:** Heute · Bestellungen · [+ Neu] · Produkte · Mehr. „Mehr" enthält Mein Hof, Kunden, Verkäufe, Auswertung, Region, Einstellungen, Hilfe und Rückmeldung, Admin, Darstellung, Abmelden.
- **Neu-Menü (Web Dropdown, Handy Blatt):** „Was legst du an?" mit Lebensmittel · Futtermittel · Brennmaterial, darunter Beitrag und Verkauf eintragen. Die Wahl bestimmt das Formular.
- **Admin:** eigene Kopfzeile mit Reitern Höfe · Briefkasten · Finanzen (mit Zählern) und „← Zu meinem Hof". Keine Hof-Seitenleiste im Admin.
- **Fokus-Seiten ohne Unterleiste:** Produktdetail, Checkout, Zahlung, Bestätigung, Bar-Bestätigung. Dort gibt es genau eine feste Leiste unten (Aktion), nie zwei übereinander.

### Links und Filter

- Alles, was navigiert, ist ein echter Link (`<a href>`): Hofkarten, Kategorie-Chips, Filter, Navigation, Produktkacheln. Filter stehen in der URL (siehe Konzept Bereiche §6.2), damit Teilen, Zurück und Mittelklick funktionieren.
- Ein Knopf ist nur, was etwas auslöst (In den Korb, Speichern, Teilen).

### Kaufstrecke

- **Mini-Warenkorb am Desktop:** Sobald etwas im Korb liegt, steht er oben in der rechten Spalte der Hofseite („Dein Korb · 2 Artikel · € … zzgl. Servicegebühr · Zur Kasse"), sticky. In der Hof-Vorschau des Editors nie.
- **Servicegebühr** steht überall als eigene Zeile und vor dem Warenkorb als Hinweis („Preise zzgl. … % Servicegebühr, mind. € 0,50 – einmal pro Bestellung"). Nie in den Produktpreis eingerechnet anzeigen.
- **Verkaufsgrößen** (Futter, Brennmaterial, alles mit Gebinden): Kacheln mit Größe, Menge, Preis, Grundpreis (€/kg, €/rm) und Vorrat. Knapp = orangener Hinweis „nur noch N", ausverkauft = ausgegraut. In Listen heißt der Knopf „Größe wählen ›", nicht „In den Korb".
- **Leerzustand mit Ausweg:** Nie nur „nichts gefunden". Immer eine nächste Handlung: Umkreis erweitern, Filter lockern, „Benachrichtige mich" (nur mit Einwilligung).

### Futtermittel und Brennmaterial

- Unter jedem Futter: grünes Schild „Registrierter Futtermittelbetrieb · LFBIS <Nummer>" bzw. die jeweilige Nummer. Fehlt die nötige Registrierung für eine Größe, erscheint diese Größe beim Kunden nicht; im Formular trägt sie ein Schloss mit Begründung.
- Brennmaterial nennt Holzart, Scheitlänge und Trocknung (Restfeuchte) immer sichtbar; Hackschnitzel Wassergehalt (W) und Körnung (P). Raummeter, Schüttraummeter und Festmeter werden beim ersten Vorkommen auf der Seite erklärt.

### Teilen

- **Teilen-Karte auf Heute:** groß an Tagen ohne Abholung, schmale orangene Zeile an Abholtagen – die Packliste hat Vorrang.
- **Teilen-Momente** (Hof freigeschaltet, Ware wieder da, Produkt gespeichert): höchstens einmal je Anlass, immer „Nicht jetzt", in den Einstellungen abschaltbar.
- Das Teilen-Bild ist dasselbe wie das Vorschaubild (Open Graph) der Hofseite. Teilen des Hofs = Orange (Hof-Aktion); Kunden teilen über einen Outline-Knopf.

### Dialoge und Blätter

- Web: zentrierter Dialog (480–820 px) über abgedunkeltem Hintergrund, Titel links, Schließen rechts, Aktionen rechts unten (zerstörende Aktion in Orange-Outline, nie Grün).
- Handy: Blatt von unten mit Griff, Hauptaktion volle Breite unten, „Abbrechen" als Textknopf darunter.

### Lesbarkeit

- Kleinster Hinweistext auf Karten mindestens `--fz-text-muted` (#9AA899 dunkel / #5D6A5C hell). Dunklere Grautöne (in alten Mockups #62705F, 3,35 : 1) sind verboten.
- E-Mails sind die einzige Ausnahme vom Dunkel-Standard: hell (Creme), weil Mailprogramme dunkle Mails unzuverlässig darstellen.
