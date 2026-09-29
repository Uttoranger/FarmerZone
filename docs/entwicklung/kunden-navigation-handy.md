# Hauptnavigation am Handy für alle Kundenseiten

Stand: 2026-09-29 · Branch `feature/kunden-navigation-handy` · Behebt Meldung: cmue2rrcc000004l293sa8nn2

## Befund

#134 gab den Kundenseiten im Browser eine vollständige Kopfzeile (Wortmarke → /,
Höfe entdecken, Für Höfe, Login, Warenkorb). Am Handy gab es nur Zurück und den
Seitentitel, auf der Hofseite runde Knöpfe über dem Titelbild — kein Weg zur
Startseite, kein Menü. Kundenseiten haben keine Leiste unten, also muss die
obere Leiste alle Wege tragen.

## Was jetzt gilt (nur unter md; der Browser ist unverändert)

- **Eine klebende Leiste, 56 px**, auf jeder Kundenseite außer der Startseite
  (die behält `LandingNav`), auf der Hofseite **über** dem Titelbild und von
  Anfang an — nicht mehr erst eingeblendet, wenn das Bild aus dem Blick ist.
- **Links:** Zurück, dann das F-Icon (App-Symbol `public/icons/icon-192.png`)
  mit „FarmerZone" als Link zur Startseite.
- **Zurück nur, wo es woanders hinführt als das F-Icon** (`kopfForm().zurueck`
  = Rückweg ≠ `/`). Betrifft heute genau die Hofübersicht: Ihr Rückweg ist die
  Startseite, zwei Knöpfe mit demselben Ziel stünden nebeneinander.
- **Rechts:** Warenkorb (Regel aus #134: Hofübersicht und Infoseiten, nur mit
  nicht-leerem Korb) und der Menü-Knopf. Am Handy kein Platzhalter für den
  Korb — die Mitte ist frei, nichts springt, wenn er erscheint.
- **Menü als Blatt von rechts** (`Sheet`, Base UI Dialog): Escape, Tipp daneben
  und der Schließen-Knopf schließen; Fokus bleibt im Blatt und kehrt zum
  Menü-Knopf zurück. Einträge in `src/lib/kunden-menue.ts` (`MENUE_PUNKTE`,
  `menuePunkte`) mit Tests: Startseite, Hofladen entdecken, Heu & Futter finden,
  Für Höfe, Hofbetreiber-Login, Problem melden. Die aktuelle Seite trägt
  `aria-current="page"`; ermittelt beim Öffnen aus `window.location`, weil
  `useSearchParams` auf den statischen Rechtsseiten eine Suspense-Grenze
  verlangen würde.
- **Hofseite:** Über dem Titelbild bleibt nur „Teilen" (`TitelbildTeilen`).
  Scrollt die Überschrift mit dem Hofnamen unter die Leiste, steht der Name in
  der Mitte; das Wort „FarmerZone" tritt zurück, das F-Icon bleibt als Weg nach
  Hause.
- **Seitentitel entfallen in der Leiste** (außer dem Hofnamen): Neben Zurück,
  Wortmarke, Warenkorb und Menü bleibt bei 375 px kein Platz, und jede Seite
  trägt ihren Titel als Überschrift. Die Prop `titel` ist entfernt.
- Die Kundenansicht im Bauernbereich (`ownerMode`) bleibt ohne Leiste.

## Offen

- Browserprüfung mit agent-browser nicht möglich (auf dieser Maschine nicht
  installiert) — Checkliste im PR. Per HTTP geprüft: Hofübersicht (beide
  Bereiche), Hofseite, Checkout, Rechtsseiten und Problem melden liefern 200
  mit Leiste, Menü-Knopf und F-Icon.
