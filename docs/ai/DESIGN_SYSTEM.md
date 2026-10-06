# Design-System

Verbindliche UI-Regeln für Kundenseite und Hofbereich. Visuelle Referenz: `docs/mockups/` (Zuordnung im dortigen README). Einführungsplan und Reihenfolge: `docs/umsetzungsprompt.md`.

## Farbtokens

Alle Farben kommen aus CSS-Custom-Properties auf `:root`, umgeschaltet über `data-theme` am `<html>`. Komponenten referenzieren ausschließlich Tokens — nie Hexwerte (Lint-Regel). Referenz-Ansicht: `docs/mockups/system-farbtokens.html`. Im Code heißen die Tokens dieser Tabelle `--fz-<name>` (`src/app/globals.css`): Das Präfix trennt sie von den shadcn-Variablen gleichen Namens (`--border`, `--primary`, `--accent`), die der Bestand mit anderer Bedeutung nutzt. Sie stehen als oklch mit dem Hexwert der Tabelle als Kommentar (CODING_STANDARDS §7); `tests/design-tokens.test.ts` gleicht Tabelle und CSS ab — wer hier einen Wert ändert, ändert ihn dort mit.

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
  Theme-fest heißt nicht Tailwind-`black`/`white`: Im neuen Design (`data-design="neu"`) sind `primary-foreground` (fast schwarz) und `accent-foreground` (Crème) in beiden Themes gleich — dunkler Schleier `from-primary-foreground/25`, helle Punkte auf Fotos `bg-accent-foreground/50`. Im Bestand haben beide andere Werte (`accent-foreground` ist dort dunkel) — das Muster gilt nur im neuen Design.
- Theme-Default beim Erstbesuch aus `prefers-color-scheme`; die Wahl wird auf dem Gerät gespeichert (localStorage `theme`, siehe „Technische Regeln") — nicht am Nutzerprofil: Die Hofseite sieht für Besucher so aus, wie deren Gerät eingestellt ist, und eine Spalte dafür gibt es nicht (ARCHITECTURE §4). Schalter: „Mehr"-Menü (mobil) bzw. Sidebar (Desktop).

## Typografie und Form

- Fraunces (600) für H1–H3 und Kennzahlen; Instrument Sans für allen anderen UI-Text. Utilities: `font-heading` (Fraunces) und `font-sans` (im neuen Design Instrument Sans, im Bestand noch Geist).
- Karten: Radius 14–16 px, `--surface` mit `--border`. Buttons: Pills (Radius 999).
- Pills nur für Buttons in Inhaltsbreite; Buttons über volle Containerbreite nutzen Radius 12–14 px.

## Technische Regeln (seit Schritt 1 des Umsetzungsprompts)

- **Schriften self-gehostet.** Fraunces und Instrument Sans kommen über `next/font/google` in `src/app/layout.tsx`: beim Build geladen, vom eigenen Ursprung ausgeliefert, als CSS-Variablen `--font-fraunces` und `--font-instrument-sans`. Kein `<link>` zu Google Fonts, kein anderes CDN im Produkt — die CDN-Links in `docs/mockups/` sind nur Referenz. `tests/theme-schalter.test.ts` sucht danach.
- **Theme ohne Flash.** `next-themes` setzt `data-theme="light|dark"` am `<html>` per Inline-Skript im `<head>`, bevor React hydriert; `defaultTheme="system"` heißt Erstbesuch nach `prefers-color-scheme`, danach gilt die gemerkte Wahl aus dem localStorage (`theme`). Die `dark:`-Utilities laufen über `@custom-variant dark` auf `[data-theme="dark"]` — eine Klasse `dark` gibt es nicht mehr. Der Modus hat genau eine Quelle: `useTheme()` aus `next-themes` (Schalter `src/components/shared/theme-umschalter.tsx`, Karte „Darstellung", Diagramme über `resolvedTheme`).
- **Tokens shadcn-kompatibel, Route für Route.** Die shadcn-Variablen (`--background`, `--card`, `--popover`, `--foreground`, `--muted-foreground`, `--border`, `--input`, `--primary`, `--primary-foreground`, `--accent`, `--accent-foreground`, `--sidebar-*`) zeigen auf die `--fz-`-Tokens, sobald ein Element im Dokument `data-design="neu"` trägt (`:root:is([data-design="neu"], :has([data-design="neu"]))` in `globals.css`). Die Shell einer umgestellten Route setzt den Marker; damit folgen auch Portale (Dialog, Sheet, Toast), die außerhalb der Shell in `<body>` hängen. Ohne Marker bleibt der Bestand unverändert — so wandert das Redesign Route für Route, nie als Big Bang. Komponenten schreiben weiter `bg-background`, `bg-card`, `bg-primary`, `text-muted-foreground`; nur die Zuordnung steht in `globals.css`. Grüner **Text** und der Fokusring (`--brand-text`, `--ring`, `--sidebar-ring`) nehmen `--fz-status-fertig` (am Tag dasselbe Grün wie `--accent`, nachts helles Salbei), weil das Knopf-Grün auf dunklem Grund nur 3:1 erreicht; oranger Text nimmt aus demselben Grund `text-status-offen`, nie `text-primary`. `--radius` steht im Geltungsbereich auf 16 px. Werte, die diese Tabelle nicht nennt (`--muted`, `--secondary`, `--accent-hover`), sind dort als abgeleitet markiert. Zustandsfarben: `text-status-offen`, `text-status-fertig`.
- **Lint.** ESLint (`no-restricted-syntax`, `eslint.config.mjs`) weist Hex-, `rgb()`-, `hsl()`- und `oklch()`-Literale in allem unter `src/` ab. Ausgenommen sind nur `src/emails/**` (Mailprogramme kennen keine CSS-Variablen) — dort stehen Farbwerte nur in `MAIL_FARBE` (`src/emails/_layout.tsx`, „E-Mails") und die Liste `FARBLITERAL_BESTAND` mit den heutigen Fundstellen — sie darf nur schrumpfen: Wer eine gelistete Datei umbaut, nimmt sie heraus. Eine einzelne Ausnahme in einer geprüften Datei (Overlay auf einem Foto) nur so: `// eslint-disable-next-line no-restricted-syntax -- <warum kein Token passt>`.

## Farbrollen

- **Grün (`--accent`)** = Kundenaktionen (kaufen, bestellen) und Zustand „erledigt/gepackt".
- **Orange (`--primary`)** = Hofbereich (erstellen, „+ Neu") und Zustand „offen/zum Packen".
- Rollen nie vertauschen; am Farbton erkennt man die Welt.

## Komponenten

- Basiskomponenten liegen an genau **einem** Ort (`src/components/ui`); Kundenseite und Hofbereich importieren nur von dort. Kein Duplizieren in Feature-Ordner.
- Bestand: Button (accent, primary, outline, ghost), Card, StatusBadge (offen/fertig/neutral), Input mit Label, Select, Stepper, Toggle, Tabs, Filter-Chips, BottomNav mit Mittelbutton-Slot, Sidebar, ListRow, Table, ProgressBar, EmptyState, Skeleton, Toast.
- **Bausteine des neuen Designs (Gate 2, `src/components/ui`)** — Vorschau `/intern/bausteine` (nur Admin), Render-Test `tests/bausteine.test.ts`:

  | Datei | Baustein | Regel |
  |---|---|---|
  | `chip.tsx` | `Chip`, `FilterChip`, `FilterChipReihe` | Filter ist ein Link (`href`), der gewählte trägt `aria-current="page"`; sichtbar 36 px, Trefferfläche 44 px über `::before`. Wendet die Seite Filter selbst im Browser an, gibt sie `onNavigate` mit (schreibt per `history.replaceState`, ruft `preventDefault()`; ohne Prefetch) — Mittelklick und neuer Tab folgen weiter dem Link |
  | `stepper.tsx` | `Stepper` | Base UI NumberField; `max` setzt der Aufrufer, verbindlich prüft der Server |
  | `segment.tsx` | `Segment` | Base UI ToggleGroup als `role="toolbar"`, genau eine Wahl, nicht abwählbar; für Seitenzustand — Filter in der URL sind FilterChips |
  | `list-row.tsx` | `ListGruppe`, `ListRow` | mit `href` Link mit Pfeil, sonst Anzeige; ≥ 50 px; Titel `truncate` mit `title` |
  | `progress-bar.tsx` | `ProgressBar` | Anteil aus `wert`/`max`, Text über `formatZahl`, `aria-valuetext` gleich |
  | `empty-state.tsx` | `EmptyState` | Symbol (Strich 1,5), Titel, Satz, Aktion als Kind — immer ein Ausweg |
  | `status-badge.tsx` | `StatusBadge` | `offen`/`fertig`/`neutral`; Schrift `text-status-*`, Fläche Markenfarbe 14–18 % |
  | `groessenkachel.tsx` | `GroessenWahl`, `Groessenkachel` | Base UI RadioGroup; Preise kommen formatiert, `zustand` (`knapp`/`ausverkauft`) entscheidet der Aufrufer |
  | `hinweiskarte.tsx` | `Hinweiskarte` | `ton="gruen"` (Kunde, Gutes) / `"orange"` (Hof, Offenes); Fläche 12 %, Rand 45 %, Text normale Textfarbe |
  | `bottom-nav.tsx` | `BottomNav`, `BottomNavLink`, `BottomNavMitte`, `mittelknopfKlassen`, `bottomNavEintragKlassen` | ordnet nichts selbst — Reihenfolge aus der Navigations-Quelle; Mittelknopf 54 px, grün/orange; Safe-Area unten |
  | `sidebar-gruppe.tsx` | `SidebarGruppe`, `SidebarEintrag` | Überschrift leise in Großbuchstaben; aktiv in umgekehrter Textfarbe; ≥ 44 px |
  | `zaehler.tsx` | `Zaehler` | Orange = wartet auf dich, Grün = Korb; ab 100 „99+", genaue Zahl und Bedeutung als `sr-only` |
  | `sheet.tsx` | `SheetBlatt` (neue Variante) | Blatt von unten mit Griff, ohne Kreuz; „Abbrechen" als `SheetClose`-Textknopf; Kinder schrumpfen nie, das Blatt scrollt |
  | `fokus.ts` | `FOKUS_RAHMEN`, `FOKUS_RAHMEN_INNEN` | der sichtbare Fokus aller neuen Bausteine und Shells (s. u.) |

- **Sichtbarer Fokus im neuen Design:** `FOKUS_RAHMEN` aus `src/components/ui/fokus.ts`. Wer einen eigenen Fokusrahmen schreibt, setzt neben `focus-visible:outline-2` immer `focus-visible:outline-solid` — Tailwind 4 behält nach `outline-none` sonst die Rahmenart „none", der Fokus ist unsichtbar. `tests/fokus-sichtbar.test.ts` prüft Bausteine, Shells und `/intern`.
- **Neue Bausteine nutzen die shadcn-Namen** (`bg-accent`, `bg-primary`, `text-muted-foreground`). Ihre Farben stimmen nur im Geltungsbereich `data-design="neu"` — außerhalb ist `accent` noch das alte Orange. Deshalb erst einsetzen, wenn die Route in eine Shell umgezogen ist.
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
- **Wartet nur ein Teil der Seite, wartet nur dieser Teil.** Eine Suspense-Grenze mit Skelett in der Form des Teils statt einer `loading.tsx` — vor allem, wo die Datei ins Wurzelsegment müsste (Startseite: Hofkarten hinter `HofKartenSkelett`, Kopf und Suche stehen sofort).
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

Umgesetzt in `src/components/shells/` (KundeShell, KundeFokusShell, HofShell, AdminShell); Einträge aus `src/lib/kunden-navigation.ts`, `hofNavigation` in `src/lib/bauern-navigation.ts` und `src/lib/admin-navigation.ts` (ARCHITECTURE §4). Abweichend von der Liste unten gilt bis auf Weiteres **E8 (kein Kundenkonto)**: Kunde Handy nur Entdecken · [Warenkorb] · Bestellungen; Kunde Web angemeldet ohne „Meine Höfe"/„Merken", „Profil" ist die bestehende Seite „Mein Konto" (`/account/profile`). „Meine Bestellungen" steht im Web-Kopf erst, wenn es eine Seite mit den eigenen Bestellungen gibt; bis dahin führt „Bestellungen" am Handy abgemeldet zur Anmeldung, angemeldet zu „Mein Konto" — ein Handy-Ziel ist immer eines, das die Kopfzeile derselben Sitzung auch anbietet (`bestellungenPunkt`).

- **Kunde Web, abgemeldet:** Logo · Höfe entdecken · So funktioniert's · Für Höfe · [Anmelden]. **Angemeldet:** Logo · Suche · Höfe entdecken · Meine Bestellungen · Warenkorb (mit Anzahl) · Profil. Öffentliche Seiten zeigen die Variante passend zur Sitzung, nie eine dritte.
- **Kunde Handy, Unterleiste:** Entdecken · Meine Höfe · [Warenkorb] · Bestellungen · Konto. Die Suche sitzt oben in „Entdecken", nicht als eigener Reiter.
- **Hof Web, Seitenleiste (Reihenfolge fest):** Hofkarte · [+ Neu ▾] · Heute · Bestellungen · Produkte · Mein Hof · *Verkauf und Kunden:* Kunden · Verkäufe · Auswertung · Region · *unten:* Einstellungen · Hilfe und Rückmeldung · Admin (nur für Admins, Zahl = alles, was zu entscheiden ist) · Konto.
- **Hof Handy, Unterleiste:** Heute · Bestellungen · [+ Neu] · Produkte · Mehr. „Mehr" enthält Mein Hof, Kunden, Verkäufe, Auswertung, Region, Einstellungen, Hilfe und Rückmeldung, Admin, Darstellung, Abmelden.
- **Neu-Menü (Web Dropdown, Handy Blatt):** „Was legst du an?" mit Lebensmittel · Futtermittel · Brennmaterial, darunter Beitrag und Verkauf eintragen. Die Wahl bestimmt das Formular.
- **Admin:** eigene Kopfzeile mit Reitern Höfe · Briefkasten · Finanzen (mit Zählern) und „← Zu meinem Hof". Keine Hof-Seitenleiste im Admin.
- **Fokus-Seiten ohne Unterleiste:** Produktdetail, Checkout, Zahlung, Bestätigung, Bar-Bestätigung. Dort gibt es genau eine feste Leiste unten (Aktion), nie zwei übereinander. Eine Fokus-Seite mit Kopfzeile (Produktdetail, seit Nr. 13 die Bestätigung) nimmt `KundeShell`/`KundeShellMitSitzung` mit `unterleiste={false}` — der Warenkorb steht dann auch am Handy im Kopf; `KundeFokusShell` ist die Form ohne Navigation (seit Nr. 12 die Kasse).

### Links und Filter

- Alles, was navigiert, ist ein echter Link (`<a href>`): Hofkarten, Kategorie-Chips, Filter, Navigation, Produktkacheln. Filter stehen in der URL (siehe Konzept Bereiche §6.2), damit Teilen, Zurück und Mittelklick funktionieren.
- Ein Knopf ist nur, was etwas auslöst (In den Korb, Speichern, Teilen).

### Entdecken (/hoefe)

- **Eine Kategorie-Reihe:** „Alle", die Hofladen-Kategorien mit Angebot, am Ende **Futtermittel** und **Brennmaterial** — beide immer sichtbar (E2). Der Futtermittel-Chip setzt `bereich=futter` und blendet die Mengen-Facette ein; Brennmaterial ist `kat=BRENNHOLZ`. Was ein Chip zeigt und wohin er führt, entscheidet `src/lib/hoefe-entdecken.ts`.
- **Menge heißt „Kleinmengen | Ballen & mehr"** (Grenze 25 kg je Gebinde, `KLEINGEBINDE_BIS_KG`), darunter der Satz, was das heißt (`MENGEN_HINWEIS`). Nie „Klein | Groß".
- **Aktive Filter** stehen als eigene Zeile mit je einem Entfernen-Link und „Alle zurücksetzen"; die Ansicht (Liste/Karte) ist kein Filter und bleibt. Ein Filter, der nur im Seitenzustand lebt (der Umkreis), steht dort auch — als Knopf statt Link —, und jedes „Zurücksetzen" hebt ihn mit auf.
- **Produkte statt Höfe** bei einer Suche und im Futter (Angebote je Gebinde); sonst Hofkarten. Pausierte Höfe bleiben sichtbar, ausgegraut über Fläche, gestrichelten Rand und entsättigtes Bild — nie über `opacity` auf Text (Kontrast).
- **Handy:** Filter im Blatt (`SheetBlatt`); Chips wirken sofort, die Hauptaktion „N … anzeigen" schließt nur, „Abbrechen" stellt den Stand vom Öffnen wieder her. Die Karte öffnet sich über eine Vorschau-Fläche, Leaflet lädt erst dann.
- **Standort:** ein Einstiegshinweis als grüne Hinweiskarte (Postleitzahl oder Standort, „Nichts wird gespeichert"); nie eine geschätzte Region aus der IP-Adresse.

### Kaufstrecke

- **Mini-Warenkorb am Desktop:** Sobald etwas im Korb liegt, steht er oben in der rechten Spalte der Hofseite („Dein Korb · 2 Artikel · € … zzgl. Servicegebühr · Zur Kasse"), sticky. In der Hof-Vorschau des Editors nie.
- **Servicegebühr** steht überall als eigene Zeile und vor dem Warenkorb als Hinweis („Preise zzgl. … % Servicegebühr, mind. € 0,50 – einmal pro Bestellung"). Nie in den Produktpreis eingerechnet anzeigen.
- **Verkaufsgrößen** (Futter, Brennmaterial, alles mit Gebinden): Kacheln mit Größe, Menge, Preis, Grundpreis (€/kg, €/rm) und Vorrat. Knapp = orangener Hinweis „nur noch N", ausverkauft = ausgegraut. In Listen heißt der Knopf „Größe wählen ›", nicht „In den Korb".
- **Leerzustand mit Ausweg:** Nie nur „nichts gefunden". Immer eine nächste Handlung: Umkreis erweitern, Filter lockern, „Benachrichtige mich" (nur mit Einwilligung).

### Hofseite (/[farmSlug], seit Nr. 10)

- **Eine Seite, Abschnitte je Kategorie (E1).** Kein Umschalter Hofladen | Futtermittel mehr: Hofladen-Kategorien in der Reihenfolge des Hofs, Sonstiges zuletzt, dann EIN Abschnitt Futtermittel und EIN Abschnitt Brennmaterial (`kategorieAbschnitte`, `src/lib/bereiche-anzeige.ts`). Chips darüber sind Sprungmarken (echte Links `#kategorie-…`, Zahl dahinter), markiert nach `naechsterAktiverReiter`. `?bereich=futter` öffnet den Reiter Produkte und springt einmal zum Futter-Abschnitt.
- **Reiter Übersicht · Produkte · Beiträge** als Links mit `?reiter=` (Übersicht ohne Parameter); „Beiträge" nur, wenn die Seite einen Beitrag zeigt. Geschrieben per `history.replaceState(null, …)` — nie mit `window.history.state`, sonst gleicht Next `useSearchParams` nicht ab.
- **Rechte Spalte = EINE Komponente** (`HofseiteSeitenspalte`): Mini-Warenkorb (ab 1024 px, klebend), Nächste Abholung, Abholzeiten, Zahlung & Kontakt mit Gebührenhinweis, Anfahrt. Ab 1024 px rechts, darunter in der Übersicht VOR dem Inhalt, in den anderen Reitern ausgeblendet. Zahlung nur „Online bezahlen" (mit fertigem Stripe-Konto) und „Bar bei Abholung" (E5) — nie „Karte bei Abholung". Gebührensatz aus der Hofeinstellung (`servicegebuehrSatz`), Wortlaute aus `gebuehrHinweis`.
- **Produktkarte:** am Handy Zeile (Bild 64 px, Name, Preis, runder Plus-Knopf), ab 768 px Kachel; im Korb Menge mit `Stepper`. Knapp = orangene `StatusBadge` „Nur noch …", ausverkauft = neutrale Marke, Bild entsättigt, statt Knopf „Ausverkauft". Kein „Merken" (E8/S11). Der Zustand kommt aus `kartenZustand`. Bild und Name sind ein Link auf die Produktseite (`produktLink`, seit Nr. 11) — ein Blatt mit Produktdetails gibt es nicht mehr.
- **Korb am Handy:** grüne Leiste über der Unterleiste („N Artikel · € … + Gebühr · Zum Warenkorb") bis 1024 px; darüber der Mini-Warenkorb. Der Warenkorb der Shell öffnet auf der eigenen Hofseite den Korb (`oeffnetKorbHier`).
- **Bildansicht:** `useBildansicht` + `BildansichtEbene` (`src/components/hofseite/bildansicht.tsx`) — Schleier `primary-foreground/90`, Knöpfe `accent-foreground`, Ebene 70 (über der Unterleiste).

### Produktseite (/[farmSlug]/produkt/[id], seit Nr. 11)

- **Die eine Darstellung der Produktdetails.** Hofseiten-Karten, „Gleich mit abholen" und (künftig) Suchtreffer verlinken hierher; Links baut nur `produktLink`/`produktPfad` (`src/lib/produktdetail.ts`), aus der Vorschau des Hofs bleiben sie in der Vorschau.
- **Aufbau:** Web — Kopfzeile, „‹ Alle Produkte" (Reiter Produkte der Hofseite), Bild 300 × 300 neben Kicker (Kategorie · Hof), Name, Marken, Schild, Beschreibung; darunter die Kaufkarte, die Kennzeichnung (`<details>`, zugeklappt) und „Gleich mit abholen"; ab 1024 px rechts `HofseiteSeitenspalte` (dieselbe Komponente wie auf der Hofseite, mit Mini-Warenkorb). Handy — keine Unterleiste, Bild über die volle Breite mit rundem Zurück-Knopf, Menge und „In den Korb · € …" als EINE feste Leiste unten (dasselbe Element, ab 768 px in der Kaufkarte).
- **Größenkacheln** (`GroessenWahl`/`Groessenkachel`) nur bei einer Produktfamilie mit mindestens zwei sichtbaren Größen; der Name auf der Kachel ist der Produktname ohne den Anfang, den alle Größen teilen. Die Wahl steht als `?groesse=` in der Adresse (per `replaceState(null, …)`, reload-fest), Pfeiltasten über die Radio-Gruppe.
- **Menge:** `Stepper` von 1 bis Bestand minus Korb (`mengeNochMoeglich`); der Betrag am Knopf in Cent (`kaufBetragCents`). Ablehnung durch `/api/reserve` steht inline als orangene Hinweiskarte an der Kaufkarte, kein Toast.
- **Schild** „Futtermittelbetrieb · LFBIS <Nummer>" nur bei Futter, Betriebsstatus Primärproduktion und Nummer (`futterSchild`, E9); andere Status bekommen (noch) kein Schild. Siegel als Marke mit normaler Schrift und grünem Symbol — die grüne `StatusBadge` erreicht auf dem hellen Seitengrund nur 4,37 : 1.
- **Brennmaterial:** Holzart, Scheitlänge, Trocknung (Restfeuchte), bei Hackschnitzeln Wassergehalt/Körnung immer sichtbar als kleine Kacheln (`brennmaterialZeilen`); Marke „Nur Abholung am Hof".

### Kasse (/[farmSlug]/checkout, seit Nr. 12)

- **Fokus-Shell ohne Navigation** (`KundeFokusShell`, Titel „Bestellen" bzw. „Bezahlen", rechts der Hofname). „Zurück" entscheidet `kassenZurueck` (`src/lib/kasse.ts`): Link zum Hof nur, solange keine Bestellung steht; danach ein Knopf zwischen Angaben und Zahlung (die Shell nimmt dafür additiv `zurueck: { onClick, label }`).
- **Aufbau** (`KassenRaster`, `src/components/checkout/kasse-teile.tsx`): ab 1024 px links Korb, darunter Abholung und Deine Daten nebeneinander (ab 768 px), Bezahlen, Neuigkeiten; rechts die klebende Übersicht. Am Handy alles in einer Spalte, die Übersicht direkt unter dem Korb (CSS `order`), im Quelltext aber ZULETZT — die Tastatur erreicht den Hauptknopf nach den Angaben.
- **Übersicht:** Reservierungsfrist („Deine Ware ist bis 14:32 Uhr für dich reserviert (noch 12 Minuten)."), Warenpreis, Servicegebühr als eigene Zeile mit Satz („Servicegebühr · 5 %, mind. € 0,50", `gebuehrBezeichnung`), `SERVICEGEBUEHR_HINWEIS`, Gesamt, Hauptknopf. Beträge nur aus `kassenBetraege` (Cent, Rechenweg des Servers). Die Restzeit wird nicht vorgelesen; erst das Ablaufen (`role="alert"`, orange Hinweiskarte mit „Verfügbarkeit neu prüfen").
- **Hauptknopf** grün, volle Breite: online „Weiter zur Zahlung · € …", bar „Zahlungspflichtig bestellen · € …" (der Knopf ist dort der verbindliche Abschluss), im Zahlungsschritt „Jetzt bezahlen · € …", nach Ablehnung „Erneut bezahlen · € …". Am Handy die EINE feste Leiste (`AktionsLeiste`, `data-feste-leiste`), ab 768 px dasselbe Element in der Übersicht. Seiten mit `data-feste-leiste` bekommen am Handy `scroll-padding` (globals.css), damit ein fokussiertes Feld nie unter Kopf oder Leiste liegt.
- **Zahlarten (E5):** nur „Online bezahlen" und „Bar bei Abholung" (`kassenZahlarten`), echte Radioknöpfe als Zeilen. Welche Online-Wege es gibt (Karte, EPS, Apple/Google Pay), zeigt Stripes Zahlungsfeld (`PaymentElement`, Layout `accordion` mit Radios) — die Kasse verspricht keinen bestimmten Weg.
- **Abholung:** Kacheln mit „Heute"/„Morgen"/Wochentag und Uhrzeit (`abholKacheln`, dieselbe Regel wie der Server), volle Fenster gestrichelt mit „ausgebucht". Darunter „Bestellschluss für heute: HH:MM Uhr".
- **Kein Satz zu einem Konto (E8).** Unter der E-Mail steht `KONTAKT_HINWEIS` (Bestätigung mit Link zur Bestellung).
- **Stripes Zahlungsfeld** sitzt auf `bg-accent-foreground` (Crème, in beiden Themes hell) mit `theme: 'stripe'`; der Zahlungsvorgang selbst bleibt unverändert.
- **Fehler:** am Feld orange (`FeldFehler`, `text-status-offen` — es gibt keinen Fehler-Token, Bericht Nr. 08), Fehler der Anfrage als orange Hinweiskarte an der Übersicht, „Zahlung abgelehnt" als orange Hinweiskarte im Bezahlen-Block (`ZahlungAbgelehnt`, „Es wurde nichts abgebucht …" nur bei `zahlungsFehlerArt` = abgelehnt). Kein Toast.

### Bestätigung (/[farmSlug]/confirm/[orderId], seit Nr. 13)

- **Fokus-Seite mit Kopf:** `KundeShellMitSitzung` mit `unterleiste={false}` — mit und ohne Signatur. Kein Rückweg durch den Verlauf (davor stehen Stripe und die Bank); die Wege hinaus sind Links („Bestellung ansehen" signiert, „Weiter einkaufen"/„Zum Hof").
- **Was erscheint, entscheidet `src/lib/bestaetigung.ts`:** Kopf (`bestaetigungsKopf`: Zeichen grün/orange/neutral, h1, Satz), Blöcke (`bestaetigungsBloecke`), Status-Schritte (`bestellSchritte`: Bestellt → Bezahlt bzw. Bestätigt → Gepackt → Abgeholt; der erste offene trägt `aria-current="step"`; storniert/nicht abgeholt: keine Schritte). Zustand nur aus der Datenbank (`bestaetigungsZustand`).
- **Bestellnummer statt Abholcode:** groß in der Abholkarte (am Handy gestrichelter Kasten unter der Abholung, ab 768 px links), nur Anzeige — sie steht in keinem Link. Daneben Abholzeit (`abholZeitText`), Hofadresse, „Route planen" (`buildMapsUrl`) und „In den Kalender" (`kalenderPfad`, signiert) — der Kalenderlink erst, wenn die Bestellung steht (bezahlt bzw. bar bestätigt, `bestaetigungsBloecke().kalender`); bei „Zahlung wird geprüft" Abholkarte ohne Kalender.
- **Bar offen:** orange Hinweiskarte „Bestätigen bis …" mit der Frist aus `fristVon`, Satz mit der Adresse, an die der Link ging; keine Abholkarte, kein Teilen.
- **„Erzähl's weiter":** Outline-Knopf „Hof teilen" (`HofTeilenKarte`) nur, wenn die Bestellung steht; er bekommt nur Name und Slug und teilt die öffentliche Hofseite (`teileHof`) — nie die signierte Adresse, ohne Zählung.
- **Positionen:** Zeilenbeträge aus dem Snapshot (`alsCents(totalPrice)`), Servicegebühr als eigene Zeile, Gesamtzeile mit Zahlart und -stand aus `zahlungsAnzeige` („Online · Bezahlt", „Bar bei Abholung · Noch offen") — nie pauschal „bezahlt".

### E-Mails (seit Nr. 13)

- **Hell, eine Palette:** `MAIL_FARBE` in `src/emails/_layout.tsx` ist die einzige Stelle mit Farbwerten unter `src/emails/`. Sie enthält nur helle Werte aus der Tabelle „Farbtokens" (als Hex) und die Hinweiskarten-Tönungen (`--accent`/`--primary` mit 12 % Fläche bzw. 45 % Rand auf `--surface` vorgerechnet) — keine Zwischentöne aus Mockups; Fließtext nimmt `text`, Rahmen-Knöpfe `rand`. Der Test gleicht die Palette mit dieser Tabelle ab. Vorlagen nehmen die gemeinsamen Stile und Bausteine (`BetragsZeile`, `BestellnummerKasten`, `Knopf`, `KnopfReihe`, `Trenner`); `tests/mail-vorlagen.test.ts` prüft Farben und `toFixed`.
- **Beträge** über `formatEuro`; Zeilenbeträge rechnet `src/lib/email.ts` über Decimal/Cent, nie die Vorlage. Zeilen mit Datum oder Adresse dürfen umbrechen (`umbrechen`), Beträge nicht — bei 390 px sonst zu breit.
- **Links zu Bestellungen** nur über `bestell-link.ts` (signiert); keine Magic Links (E7).
- **Vertragsmails ohne Werbung (S11):** Alle Mails zu einer Bestellung (Bestätigung, „Bitte bestätige", Abholbereit, Doch nicht abholbereit, Storniert, Verfallen, Zahlung zu spät) tragen keine Werbung und keinen Aufruf zur nächsten Bestellung. **Offene Ausnahme, Entscheidung beim Menschen:** Die Abholbereit-Mail (`pickup-reminder.tsx`) enthält noch den leisen Link „Dieselbe Bestellung nochmal aufgeben" (Reorder-Token) — bis entschieden ist, ob er bleibt (dann als dokumentierte Ausnahme) oder entfällt. Keine weitere Mail bekommt einen solchen Link.
- **Tage in Mails immer fest:** Wochentag, Datum, Uhrzeit in Wiener Zeit (`zeitpunktFuerMail`, `formatPickupDate`) — nie „heute"/„morgen", denn eine Mail wird später gelesen als verschickt. Relative Helfer (`tagInWorten`, `abholZeitText`) nur auf Seiten, die beim Lesen rechnen; `tests/mail-vorlagen.test.ts` prüft beides.
- **Bestätigung folgt der Zahlart:** online „Online bezahlt", bar „Bar bei Abholung" + „Bring bitte € … in bar mit.", alte Karte-Bestellungen „Karte bei Abholung".
- Keine Webfonts laden; Schriftstapel mit Fraunces/Instrument Sans zuerst, dann Systemschriften.

### Anmelden

- **Eine Seite für beide Wege:** `/account/login` (Kunde, Code) und `/login` (Hof, Passwort) rendern `AnmeldenSeite` (`src/components/anmelden/`). Im Browser zwei Karten nebeneinander („Ich kaufe ein" grün, „Ich habe einen Hof" orange), am Handy nur die Karte der Route und darüber ein Umschalter aus zwei echten Links (`aria-current`). Kein Konto-Angebot für Kundinnen (E8).
- **Code-Feld:** sechs Kästchen über EINEM unsichtbaren, beschrifteten Eingabefeld (`autocomplete="one-time-code"`, `inputmode="numeric"`, 16 px) — so setzt das Telefon den Code aus der Mail ein, Einfügen und Löschen funktionieren, und der Screenreader sagt ein Feld an. Fokus: Rahmen um alle Kästchen (`outline-solid`) und das nächste Kästchen hervorgehoben. Nie `maxLength`, Eingaben gehen durch `normalisiereCode`. Während geprüft wird: Feld `readOnly` + `aria-busy`, nie `disabled` (der Fokus bliebe sonst nach einem Fehler im Nichts); nach einem Fehler Fokus zurück ins Feld; „Einen Moment …" steht zusätzlich in einer ständig vorhandenen `role="status"`-Region. Die Kästchen teilen sich die Breite (`min-w-0 flex-1`, höchstens 46 px, 54 px hoch) — bei 320 px passen sechs feste Kästchen nicht.
- **„Code erneut senden"** wartet sichtbar („Code erneut senden (45 s)"), so lange wie die IP-Grenze; ein falscher Code leert das Feld, der Fehler steht inline darunter.

### Futtermittel und Brennmaterial

- Unter jedem Futter: grünes Schild „Registrierter Futtermittelbetrieb · LFBIS <Nummer>" bzw. die jeweilige Nummer. Fehlt die nötige Registrierung für eine Größe, erscheint diese Größe beim Kunden nicht; im Formular trägt sie ein Schloss mit Begründung.
- Werbung für Brennmaterial (das Band der Startseite) nur in der Saison Oktober bis März, Wiener Monat: `istBrennmaterialSaison` (`src/lib/brennmaterial-saison.ts`). Die Kategorie selbst (Chip, `/hoefe?kat=BRENNHOLZ`) bleibt das ganze Jahr auffindbar.
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
