# Mein Hof · Hofseite am Browser — ein Kopf, eine Liste, eine Vorschau

Stand 2026-09-29 · Branch `feature/hofseite-editor-browser`

Vorlage: Canvas „FarmerZone — Entwürfe", Artboard „Mein Hof · Hofseite neu —
Browser, dunkel". Gilt nur ab lg (1024 px); unter lg bleibt alles, wie es war.

## Befund

Auf „Mein Hof → Hofseite" stand der Hof im Browser dreimal übereinander: der
Kopf von Mein Hof mit Titelbild-Streifen (`mein-hof-kopf.tsx`), die
Werkzeugleiste des alten Editors mit „SHOP", Kopieren, Teilen, Bearbeiten,
Kundenansicht (`farm-page-client.tsx:40-112`) und darunter die ganze öffentliche
Hofseite mit Stiften samt Hinweis „Du bearbeitest deine Hof-Seite"
(`farm-page-view.tsx`, Modus-Banner). Dazu „Hofseite ansehen" in der
Seitenleiste (`farm-identity-card.tsx`).

## Was jetzt gilt (ab lg)

- **Kopf** (`mein-hof-kopf.tsx`): eine kompakte Zeile ohne Streifen — Hofbild
  oder Initialen, Name, Adresse mit Kopieren, Zustandsschild; rechts genau
  „Teilen" und „Kundenansicht ↗" (neuer Tab), beide nur, wenn die Hofseite
  öffentlich ist. Reiter mit Zahlen: „Produkte · n" wie bisher, „Beiträge · n"
  neu (nur ab lg). Unter lg rendert dieselbe Komponente die Karte wie bisher;
  die beiden Fassungen wechselt CSS (`lg:hidden` / `lg:flex`).
- **Seitenleiste:** „Hofseite ansehen" ist ab lg weg (`lg:hidden`).
- **Reiter Hofseite** (`src/app/(farmer)/farm-page/page.tsx`): unter lg die
  alte `FarmPageClient`, ab lg `HofseiteEditor`. Beide stehen im Dokument —
  der Server kennt die Fensterbreite nicht, und ein Wechsel im Browser
  flackerte beim Laden. Der Kopf steht einmal.
- **Liste** (`hofseite-editor.tsx`): Fortschritt „Deine Hofseite ist zu n von
  m fertig", Balken, Satz mit den fehlenden Teilen. Drei Gruppen mit elf
  Zeilen (Symbol, Titel, Wert in einer Zeile, Häkchen oder Chip, Pfeil); ein
  Klick klappt auf, nur eine offen zugleich. Was die Zeilen sagen, entscheidet
  `src/lib/hofseite-fortschritt.ts` (`hofseiteFortschritt`, rein, getestet).
- **Vorschau** (`hofseite-vorschau-rahmen.tsx`): die echte Hofseite im
  Vorschau-Modus in einem Handyrahmen — iframe 390 CSS-px breit, auf 304 px
  verkleinert, klebend rechts, darunter „In neuem Tab öffnen ↗". Jedes
  erfolgreiche Speichern zählt `stand` hoch, der in der Adresse steckt; der
  Rahmen lädt neu — per `location.replace`, nicht über ein neues `src`: Das
  legte im gemeinsamen Verlauf des Browsers je Speichern einen Eintrag an,
  und „Zurück" führte erst durch alle alten Stände.
- **Markierung:** Die geöffnete Zeile geht per `postMessage` an den Rahmen
  (nur an den eigenen Ursprung). Die Hofseite im Rahmen
  (`components/farm/vorschau-im-rahmen.tsx`) liest die Nachricht über Zod
  (`src/schemas/hofseite-vorschau.ts`), prüft den Ursprung, scrollt ihr eigenes
  Fenster zum Element mit passendem `data-abschnitt` (`ZIEL_ABSCHNITT`) — nicht
  per `scrollIntoView`, das zöge die Editor-Seite mit — und umrandet es zwei
  Sekunden in der Akzentfarbe. Sobald ihr Empfänger steht, meldet sie sich
  „bereit" (`leseBereit`), und der Rahmen schickt die Markierung noch einmal;
  das `load`-Ereignis des iframes käme womöglich vor der Hydration. Im Rahmen
  öffnet ein Klick auf einen Link zu einer anderen Seite einen neuen Tab: Die
  Zielseiten lassen sich nicht einbetten (`DENY`), im Handyrahmen stünde sonst
  ein Fehlerbild. Welcher Klick das ist, sagt `verlaesstRahmen` (rein,
  getestet): nicht Anker und Bereiche derselben Seite, nicht tel:/mailto:,
  nicht Links, die ohnehin einen neuen Tab öffnen. Der Horcher sitzt in der
  Capture-Phase und stoppt das Ereignis vor React.

## Je Abschnitt: welcher Weg

| Zeile | Weg | Speichert über |
|---|---|---|
| Titelbild | eingebettet: Abbild des Titelbilds mit `CoverEditButton` (Foto ersetzen) und `CoverFocusAdjust` (Ausschnitt ziehen) aus `farm-page-view.tsx` | `updateFarmBannerAction`, `updateBannerFocusAction` |
| Logo | eingebettet: `LogoUpload` aus `appearance-client.tsx` | `updateFarmLogoAction` |
| Name und Kurzbeschreibung | Formular in der Zeile | `updateProfile` (das übrige Profil geht unverändert mit) |
| Über uns | Formular in der Zeile | `saveAppearanceAction` (der übrige Auftritt geht unverändert mit) |
| Fotos | eingebettet: `GallerySection` aus `appearance-client.tsx` | `addFarmPhotoAction`, `updateFarmPhotoCaptionAction`, `deleteFarmPhotoAction`, `moveFarmPhotoAction` |
| Adresse und Standort | Formular (Straße, PLZ, Ort) in der Zeile; der Kartenpunkt als Link ins Hofprofil | `updateProfile` |
| Abholzeiten | eingebettet: `PickupSlotsClient` | `addPickupSlot`, `deletePickupSlot`, `togglePickupSlotActive` |
| Zahlungsarten | Text und Link zu `/settings/payments` (Stripe-Onboarding lässt sich nicht einbetten) | — |
| Kontakt | Formular (Telefon, E-Mail) in der Zeile | `updateProfile` |
| Bestellungen | eingebettet: `PauseClient` | `setPause` |
| Abschnitte der Hofseite | Schalter je Abschnitt in der Zeile, Produkte fest; Reihenfolge weiter unter Mein Auftritt | `saveAppearanceAction` |

Keine neue Server-Aktion. `GallerySection`, `PickupSlotsClient`,
`PauseClient` und `CoverEditButton` haben einen optionalen Rückruf
`onGespeichert`, damit die Vorschau nach jeder Änderung neu lädt;
`LogoUpload` meldet über sein vorhandenes `onUploaded`. Bei einer Serie von
Fotos lädt die Vorschau je Foto neu — der Upload-Baustein kennt kein Ende der
Serie (offen).

Die Formulare in den Zeilen prüfen mit den Schemas der Aktionen selbst
(`src/schemas/hofprofil.ts`, `src/schemas/auftritt.ts`, per `.pick()`) — dafür
sind die beiden Schemas aus den `'use server'`-Dateien dorthin gewandert.
`auftrittBasis` schickt Logo und Titelbild NICHT mit: Die lädt der Editor über
eigene Aktionen hoch, und bis `router.refresh()` zurück ist, wären die Props
veraltet; fehlende Felder rührt `saveAppearanceAction` nicht an.

## Vorschau-Modus der öffentlichen Hofseite

`/[farmSlug]?vorschau=1` (seit der Ergänzung vom 2026-10-01 entschieden von
`ansichtsModus` in `src/lib/ansichts-modus.ts`, siehe unten; davor
`vorschauZugriff` in `src/lib/hofseite-vorschau.ts`):

- Nur der angemeldete Besitzer genau dieses Hofs bekommt die Vorschau — und
  sieht seine Seite auch vor der Freigabe (`getOwnerFarm` statt
  `getPublicFarm`). Abgemeldet, fremder Nutzer, anderer Wert: wie ohne
  Parameter. Sitzung und Besitzer (`getHofBesitzer`) werden nur mit dem
  Parameter gelesen. Das entscheidet `ansichtsModus`, aufgerufen im Lader
  `ladeHofseite` (`src/server/hofseite-vorschau.ts` — eigene Datei, weil eine
  Seite nichts anderes exportieren darf; `tests/hofseite-vorschau-laden.test.ts`
  prüft die Wahl der Abfrage mit nachgebildeter Sitzung, auch für den nicht
  freigegebenen Hof).
  Steht der Parameter mehrfach in der Adresse, zählt der letzte Wert — wie bei
  Nexts Header-Regel.
- Immer `noindex`, sobald der Parameter dasteht — auch mit falschem Wert oder
  ohne Recht.
- Kaufen ist wirkungslos: `korbErlaubt` (`src/lib/hofseite-vorschau.ts`) ist
  die eine Regel für jeden Weg in den Korb — Kaufknopf („Vorschau — hier wird
  nichts bestellt", vor dem ersten Griff in den Korb), Nachbestell-Link (die
  Seite lädt ihn in der Vorschau gar nicht erst), `#warenkorb`-Anker,
  Korb-Knopf, Sheet. Die Kopfzeile zeigt auf der Hofseite ohnehin kein
  Korbsymbol (`kopfForm`).
- Einbetten: `next.config.ts` hält `X-Frame-Options: DENY` für alles. Nur die
  Hofseiten-Route MIT `?vorschau=1` bekommt `SAMEORIGIN` und
  `Content-Security-Policy: frame-ancestors 'self'` (`has: query`). Die Quelle
  schließt jede eigene Route auf oberster Ebene aus (`KEINE_HOFSEITE`);
  `tests/sicherheits-header.test.ts` gleicht die Liste mit den Ordnern unter
  `src/app` ab und prüft mit Nexts eigenem Pfadvergleich, dass andere Seiten,
  Unterseiten der Hofseite und die Hofseite ohne Parameter gesperrt bleiben.
  Am laufenden Server nachgemessen: nur `/hof-…?vorschau=1` trägt SAMEORIGIN.

## Geprüft (agent-browser, lokale Wegwerf-Datenbank aus dem Seed)

- 1280 px hell und 1440 px dunkel: Kopf, Liste, Vorschau; Zeilen öffnen, nur
  eine offen; Markierung wandert und verschwindet nach zwei Sekunden; Kontakt
  speichern → Toast, Zeile zu, Vorschau lädt mit `stand=1` und zeigt den
  neuen Wert. Kundenansicht öffnet im neuen Tab.
- 375 px vorher/nachher (`/farm-page`, `/products`, `/status`): Pixelvergleich
  ohne Unterschied.
- Vorschau am Handy (375 px): „In den Warenkorb" → Hinweis, kein Korb im
  Speicher, kein Korb-Knopf.
- Zugriff: nicht freigegebener Hof öffentlich 404, mit Parameter ohne
  Anmeldung 404, als fremder Bauer 404, als Besitzer 200 mit `noindex`.
- Nach der Prüfung durch den Prüfer noch einmal bei 1280 px: Markierung ohne
  Mitscrollen der Editor-Seite (`scrollY` bleibt 0, nur der Rahmen scrollt);
  Abholzeit pausieren und wieder aktivieren → Vorschau lädt neu (`stand`
  1, 2), die Bereit-Meldung kommt aus dem eigenen Rahmen an, die Markierung
  erscheint nach dem Neuladen wieder und verschwindet nach zwei Sekunden;
  „Über uns" speichern → Toast, Zeile zu, `stand` 3, Text in der Datenbank,
  Logo und Titelbild unberührt; Klick auf „Impressum" im Rahmen → `window.open`
  mit der Zieladresse, der Rahmen bleibt auf der Hofseite. In der Konsole nur
  die bekannte Hydrations-Warnung des sortierbaren Produktrasters
  (`DndDescribedBy`-Zähler, Altbestand). Nach der zweiten Prüfer-Runde: Das
  Neuladen per `location.replace` lässt `history.length` unverändert (das
  `src`-Attribut bleibt beim ersten Stand), die Markierung kommt danach
  wieder, der abgefangene Link-Klick öffnet den neuen Tab.

## Regeln, die nach `docs/ai/` gehören

- ARCHITECTURE §4: Der Vorschau-Modus und die Header-Regel (eingetragen).
- CODING_STANDARDS: nichts Neues.

## Offen

- Beide Fassungen stehen im Dokument: Unter lg wird auch der Editor gerendert
  (versteckt), ab lg auch die alte Hofseite (versteckt). Bilder darin lädt der
  Browser trotzdem. Ein Wechsel per JavaScript nach der Fensterbreite wäre
  leichter, flackerte aber beim Laden.
- „Über uns" wird auf der öffentlichen Hofseite heute nicht angezeigt; der
  Text zählt in die Beschreibung der Seite (Metadaten). Die Zeile im Editor
  pflegt ihn trotzdem — für den Tag, an dem der Abschnitt auf die Seite kommt.
- Die eingebetteten Bausteine tragen die Optik ihrer Einstellungsseiten
  (Karten mit Überschrift „Galerie", „Aktuelle Abholzeiten"). Ein eigener
  kompakter Anzug wäre ein zweiter Sprint.
- Reihenfolge der Abschnitte weiter nur unter Mein Auftritt (Drag).
- Die Tests am Quelltext (`tests/hofseite-editor.test.ts`, Teile von
  `tests/hofseite-vorschau.test.ts`) prüfen Schreibweisen, kein Verhalten; sie
  brechen bei einer Umformatierung. Das Verhalten sitzt in den reinen
  Funktionen und im Lader, die eigene Tests haben.
- Das Hofprofil (`components/settings/profile-form.tsx`) prüft weiter mit
  einer eigenen Abschrift des Schemas; es könnte `src/schemas/hofprofil.ts`
  nutzen — nicht Teil dieses Sprints.

---

## v2 (2026-09-30): Produkte in die Seitenleiste, Neu-Menü, Vorschau Handy/Web

Branch `feature/mein-hof-v2`. Vorlage: `docs/mockups/hof-mein-hof-v2-desktop.html`,
`hof-mein-hof-v2-web-vorschau.html`, `hof-vorschau-vergroessert-overlay.html`,
`hof-sidebar-komponente.html` (die frühere `hof-mein-hof-editor-desktop.html`
ist gelöscht, `docs/mockups/README.md` nennt die Zuordnung). Bestand-Look —
die Route trägt kein `data-design="neu"`. Was oben unter „Was jetzt gilt"
steht, gilt weiter, mit diesen Änderungen:

- **Navigation** (`src/lib/bauern-navigation.ts`): „Produkte" ist ein eigener
  Eintrag der Seitenleiste zwischen Bestellungen und Mein Hof (`/products`).
  Am Handy behält die Leiste ihre fünf Plätze; Produkte steht oben im
  Mehr-Blatt (`NUR_IM_MEHR`), und `/products` zählt für „Mehr" als aktiv.
  „Mein Hof" hat nur noch die Reiter Hofseite | Beiträge
  (`MEIN_HOF_REITER`), kompakt links, rechts ab md der Hinweis
  `MEIN_HOF_HINWEIS`. `/products` hat einen eigenen Kopf (H1 „Produkte",
  Zahl) statt des Mein-Hof-Kopfs; `zaehleProdukte` ist weg.
- **Neu-Knopf** (`farmer-nav.tsx`): Radius 13 px, linksbündig mit Plus,
  Chevron rechts (dreht bei offenem Menü), 1-px-Rand und innere Unterkante im
  Ton der Schrift als Tailwind-Klassen mit Token-Deckkraft
  (`border-accent-foreground/30`, `shadow-accent-foreground/20`), keine
  Inline-Farbe; Hover über `--accent-hover`.
  Öffnet ein Dropdown (`components/ui/dropdown-menu.tsx`, dünne Hülle um
  `@base-ui/react/menu` im shadcn-Stil, von Hand geschrieben — die Registry
  ist aus der Agenten-Umgebung nicht erreichbar) mit `NEU_BROWSER`: „Neues
  Produkt · Foto, Preis, Lagerstand" (`/products?neu=1`) und „Neuer Beitrag ·
  Neuigkeit auf deiner Hofseite" (`/status/new`). Enter öffnet, Esc schließt,
  der Fokus kehrt zum Knopf zurück. Das Plus-Blatt am Handy (`NEU`, drei
  Einträge) bleibt, wie es war.
- **Vorschau** (`hofseite-vorschau-rahmen.tsx`, `src/lib/hofseite-vorschau.ts`):
  Der Umschalter bedeutet Gerät. **Handy** = Telefonrahmen wie bisher, 390 px
  Seite auf 304 px. **Web** = die Spalte wächst auf `calc(100% − 400px − 2rem)`
  (Breiten-Transition 200 ms, `motion-reduce` ohne), die Bearbeitung rückt auf
  400 px zusammen; darin die Desktop-Kundenseite 1440 px breit in einem
  Browser-Rähmchen (drei Punkte, Adresse), scrollbar, Höhe 680 px. Maßstab =
  Panelbreite ÷ 1440, gemessen per ResizeObserver und gerechnet
  (`vorschauMassstab`, rein, getestet) — nie hart codiert. Beide Geräte teilen
  sich EIN iframe: Der Wechsel ändert nur seine Breite; nichts lädt neu, die
  Markierung bleibt. Unter 1280 px Fensterbreite (`VORSCHAU_WEB_MINDESTBREITE`,
  `useMindestbreite` per matchMedia, Server-Wert false) öffnet „Web" das
  Overlay statt inline zu wachsen. **Vergrößern** bedeutet Größe: Dialog mit
  Titel „Vorschau", Hofname, Umschalter mittig, „In neuem Tab öffnen", X;
  Handy in echter Größe (Maßstab aus Breite UND Höhe der Fläche), Web auf
  Overlay-Breite abzüglich Kopfleiste (36 px, `h-9`). Die Fläche wird über eine
  Callback-Ref gemessen: Der Dialog hängt in einem Portal, das erst nach dem
  ersten Effekt steht — mit einer Objekt-Ref blieb die Fläche 0 × 0 und das
  iframe kam nie. Beim Schließen geht der Fokus zurück auf das Element, das
  geöffnet hat — „Vergrößern" oder „Web" ohne Platz (`finalFocus`,
  `document.activeElement` beim Öffnen). Umschalter, Vergrößern, Neuer Tab
  und Schließen sind 44 px hoch (DESIGN_SYSTEM „Qualität"), auch wenn das
  Mockup 38 px zeichnet.
- **Zahlungsarten** (`src/lib/hofseite-fortschritt.ts`): Ohne Online-Zahlung
  bleibt die Zeile „fertig" (bar und Karte vor Ort genügen), zeigt aber statt
  des Hakens das Badge „Online fehlt" (bernstein) und den Wert „Vor Ort bar und
  mit Karte · Online-Zahlung noch nicht eingerichtet". Kein neuer Stripe-Weg;
  die Zeile führt weiter zu `/settings/payments`.
- **Kontrast:** Hinweise, Bildunterschriften und Gruppenüberschriften in
  Kopf, Editor und Vorschau nutzen `--app-ink-soft` statt `--app-ink-faint`
  (2,4 : 1 auf Creme, Axe `color-contrast`); Regel in
  `docs/ai/CODING_STANDARDS.md` §7 bei der Palette `--app-*`. Ab lg trägt
  `/farm-page` eine H1 nur für Screenreader („Hofseite bearbeiten",
  `sr-only`, Axe `page-has-heading-one`); unter lg hat die Hofseite selbst
  eine, `/status` bringt seine eigene mit. Der Hofname im Kopf bleibt Text.
- **Seitenleiste ohne Farbliterale:** `farmer-nav.tsx` ist aus
  `FARBLITERAL_BESTAND` gestrichen (DESIGN_SYSTEM „Lint": wer umbaut, nimmt
  heraus). Schatten und Ränder sind Tailwind-Klassen mit Token-Deckkraft
  (`shadow-black/25`, `border-white/10`, `ring-(--app-bar)`); nur die
  Sand-Plakette der Initialen trägt die begründete Einzelausnahme.
- **Tests** (`tests/hofseite-editor.test.ts`, `tests/bauern-navigation.test.ts`,
  `tests/hofseite-vorschau.test.ts`): am Quelltext nur Regeln — Konstanten,
  Ursprung der Nachrichten, Fokus-Rückgabe, Overlay-Weg —, keine Klassennamen.
  `VORSCHAU_BEARBEITUNG_BREITE` (400) und `vorschauMassstab` haben eigene
  Verhaltenstests.

### Geprüft (agent-browser, Seed-Datenbank, `bauer-a@example.com`)

- 1440 px hell und dunkel: Seitenleiste mit Produkte; Reiter kompakt mit
  Hinweis; Neu-Knopf Radius 13 px mit Unterkante; Enter öffnet das Menü mit
  beiden Einträgen (Links `/products?neu=1`, `/status/new`), Esc schließt,
  Fokus zurück auf „Neu"; Zahlungsarten mit „Online fehlt"; Web: Spalte 720 px,
  Bearbeitung 400 px, iframe 1440 px, `scale(0.5)` = 720 ÷ 1440, Adresse im
  Rähmchen; Vergrößern: Web `scale(0.9556)` = (1408 − 32) ÷ 1440, Rahmen endet
  über dem Fußtext; Handy im Overlay `scale(0.803)`, Rahmen 694 px in 694 px
  Fläche; Esc schließt, Fokus auf „Vergrößern".
- 1280 px: Web inline, `scale(0.3889)` = 560 ÷ 1440. 1279 px: „Web" öffnet das
  Overlay (Web), die Vorschau daneben bleibt Handy.
- 375 px: Reiter kompakt, Hinweis versteckt, Mehr-Blatt mit Produkte oben.
- Axe (axe-core 4.10, Skript im Scratchpad, ohne Dev-Overlay und ohne den
  Inhalt des iframes), 1440 hell und dunkel, Handy/Web/Overlay/Menü offen/
  Zeile offen, 375 mit Mehr-Blatt, `/products`, `/status`: keine Verstöße aus
  diesem Sprint. Übrig, alle Altbestand: die Initialen-Kreise (Hof und
  Nutzer, `#8b6b4f` auf `#F2E5D3`, 3,9 : 1 — Inline-Farben aus der
  Ausnahmeliste), das Wort „Mein Hof" über dem Hofnamen in der Seitenleiste
  (`rgba` 55 %, 3,2 : 1, `farm-identity-card.tsx`), und bei offenem Menü die
  Fokus-Wächter von Base UI (`aria-hidden` mit `tabindex="0"`,
  `aria-hidden-focus`) sowie das Popup außerhalb eines Landmarks (`region`) —
  beides Bibliotheksverhalten, das jedes Blatt und jeder Dialog im Bestand
  teilt. In der Konsole weiter nur die Hydrations-Warnung des sortierbaren
  Produktrasters (`DndDescribedBy`, Altbestand, unter lg gerendert).

---

## Ergänzung (2026-10-01): Die Hofseite gibt es genau einmal

Branch `feature/mein-hof-v2`, neu ab `main` nach #152.

- **`ansichtsModus`** (`src/lib/ansichts-modus.ts`) entscheidet alle
  Unterschiede der Vorschau zur Seite für Kundinnen: `art` (kundin/vorschau),
  `besitzerVorFreigabe` (der Besitzer sieht seinen Hof auch vor der Freigabe),
  `noindex` (sobald der Parameter dasteht, mit jedem Wert), `kaufen`
  (wirkungslos in der Vorschau). Sie nimmt die ganzen Suchparameter und zwei
  Quellen (angemeldeter Nutzer, Besitzer des Slugs), die sie nur fragt, wenn
  sie zählen — ohne `?vorschau=1` keine Sitzung, abgemeldet kein Besitzer. Der
  „letzte Wert zählt" wie in der Header-Regel. Aufgerufen nur im Lader
  `ladeHofseite` (`src/server/hofseite-vorschau.ts`); an die Seite geht
  `SeitenAnsicht` ohne Nutzer-ID. `vorschauGewuenscht` und `vorschauZugriff`
  sind entfallen; `korbErlaubt` fragt jetzt `kaufen` statt `vorschau`.
- **Die Seite** (`src/app/(public)/[farmSlug]/page.tsx`) reicht ihre
  Suchparameter unverändert an den Lader und liest nur `ansicht`: `noindex`
  für die Metadaten, `kaufen` für den Nachbestell-Link, die ganze Ansicht für
  `FarmPageView`. `ladeHofseiteGeteilt` schlüsselt den `cache` nach dem Text der
  Suchparameter, weil Metadaten und Seite nicht zwingend dasselbe Objekt
  bekommen.
- **`FarmPageView`** nimmt `ansicht` statt `vorschau` und gibt `kaufen` ans
  Produktraster; der Kopf-Kommentar nennt die zwei Stellen, die sie einbinden,
  was jede braucht und dass die Besitzer-Zweige mit dem Umzug der Handyansicht
  auf Liste und Vorschau entfallen.
- **Architektur-Tests** (`tests/hofseite-einmal.test.ts`): Lesestellen des
  Parameters in `src/` — Index, URLSearchParams, jede Eigenschaft `.vorschau`
  (bis auf `eingabe.vorschau` im Pausen-Banner), Zerlegen, `vorschau=` im Text,
  das Wort als Literal außerhalb von `art`, die Konstante außerhalb von
  `hofseite-vorschau.ts` und `ansichtsModus` (deshalb schreibt der Rahmen seine
  „Neuer Tab"-Links jetzt über `vorschauLink`); außerhalb von `src/` nur
  `next.config.ts`. Aufrufer von `ansichtsModus` (nur der Lader, kein
  Client-Modul, auch nicht relativ oder dynamisch eingebunden), Einbinder von
  `FarmPageView` (genau zwei — benannt, Namensraum, weitergereicht, dynamisch,
  `Hof.FarmPageView`), `ownerMode` auf der Hofseite (immer `false`). Dazu ein
  echter Render mit `react-dom/server`: Kundin und Vorschau ohne Stift,
  Werkzeugleiste, Bearbeitungs-Hinweis, „… bearbeiten"-Ziele, Titelbild-Knopf,
  Status-Pflege und Pausen-Hinweis für den Hof; Gegenproben je Quelle
  (FarmPageView im Bearbeitungsmodus für ihre Elemente, farm-page-client für
  die Werkzeugleiste). Der Korb (`CartSheet`, im Test durch ein Merkmal
  ersetzt) hängt nur bei Kundinnen — nicht in der Vorschau, nicht im
  Bearbeitungsmodus. Jede Suche hat eine Gegenprobe; sieben absichtliche
  Verstöße schlugen an (Seite liest den Parameter, dritte Einbindung benannt
  und als Namensraum, Stift für Kundinnen, `kaufen` geht verloren,
  `sp.vorschau` in einer Komponente, Client importiert `ansichtsModus`
  relativ).
- **Nachbestell-Link:** `?reorder=` geht jetzt durch Zod
  (`src/schemas/nachbestellung.ts`, `nachbestellToken`) und wird nur geladen,
  wo Kaufen wirkt.
- **Regeln:** ARCHITECTURE §4 „Die Hofseite gibt es genau einmal …";
  TESTING_GUIDELINES §1 (serverseitiges Rendern für Architektur-Aussagen) und
  §2 (Architektur-Regeln mit Gegenprobe); Prüfpunkt im Agenten `pruefer`.
