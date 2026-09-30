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

`/[farmSlug]?vorschau=1` (`src/lib/hofseite-vorschau.ts`, `vorschauZugriff`):

- Nur der angemeldete Besitzer genau dieses Hofs bekommt die Vorschau — und
  sieht seine Seite auch vor der Freigabe (`getOwnerFarm` statt
  `getPublicFarm`). Abgemeldet, fremder Nutzer, anderer Wert: wie ohne
  Parameter. Sitzung und Besitzer (`getHofBesitzer`) werden nur mit dem
  Parameter gelesen. Das entscheidet `ladeHofseite`
  (`src/server/hofseite-vorschau.ts` — eigene Datei, weil eine Seite nichts
  anderes exportieren darf; `tests/hofseite-vorschau-laden.test.ts` prüft die
  Wahl mit nachgebildeter Sitzung, auch für den nicht freigegebenen Hof).
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
