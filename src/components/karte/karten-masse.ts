/*
 * Maße der Karten, die Karte und Platzhalter teilen (Nachtlauf Nr. 52).
 * Eigene Datei ohne Leaflet: Ein Import aus standort-karte.tsx holte die
 * Kartenbibliothek statisch ins Formular — dann gäbe es nichts mehr
 * nachzuladen und keinen Platzhalter.
 */

/**
 * Die Bedienteile beider Leaflet-Karten nach den Boards (w1-/s1-hoefe, Lauf 31; Nr. 234), als
 * Klassen am Rahmen um die Karte — Leaflet baut seine Knöpfe selbst, darum greifen sie über
 * Nachfahren-Varianten und schlagen Leaflets eigene Regeln (`!`):
 * - Zoom „+"/„−": zwei eigene Knöpfe 44 × 44 px (WCAG 2.5.8) mit 8 px Luft, Fläche `card`, Rand
 *   `border`, Schrift `foreground` — sie folgen dem Thema; gesperrt (größte/kleinste Stufe) leise.
 * - Quellenangabe: der Link „OpenStreetMap" bekommt über `::before` 44 px Trefferfläche (wie
 *   chip.tsx), sichtbar bleibt er so klein, wie OSM ihn verlangt.
 * - Im Dunkeln gedämpft (Freigabe Lauf 31, Maßstab Punkt 4: keine hellen Flecken): Kacheln
 *   dunkler und entsättigt, Pins etwas dunkler, der leere Grund `muted` statt Leaflets Hellgrau.
 * EINE Quelle: die Hofübersicht (hoefe-karte.tsx), die Standortkarte im Hof-Profil (über
 * STANDORT_KARTE_RAHMEN) und die Futterkarte der Region (futter-karte-ansicht.tsx). Nr. 238 hatte
 * dafür parallel `KARTEN_STEUERUNG` gebaut; beim Zusammenführen im Zwischenstand aufgegangen.
 */
export const LEAFLET_BEDIENTEILE = [
  '[&_.leaflet-container]:bg-muted!',
  '[&_.leaflet-control-zoom]:flex! [&_.leaflet-control-zoom]:flex-col [&_.leaflet-control-zoom]:gap-2 [&_.leaflet-control-zoom]:border-0! [&_.leaflet-control-zoom]:shadow-none!',
  '[&_.leaflet-control-zoom_a]:flex! [&_.leaflet-control-zoom_a]:size-11! [&_.leaflet-control-zoom_a]:items-center [&_.leaflet-control-zoom_a]:justify-center [&_.leaflet-control-zoom_a]:rounded-xl! [&_.leaflet-control-zoom_a]:border! [&_.leaflet-control-zoom_a]:border-border! [&_.leaflet-control-zoom_a]:bg-card! [&_.leaflet-control-zoom_a]:text-xl! [&_.leaflet-control-zoom_a]:leading-none! [&_.leaflet-control-zoom_a]:text-foreground! [&_.leaflet-control-zoom_a]:shadow-sm',
  '[&_.leaflet-control-zoom_a:hover]:bg-muted! [&_.leaflet-control-zoom_a.leaflet-disabled]:text-muted-foreground! [&_.leaflet-control-zoom_a:focus-visible]:outline-2 [&_.leaflet-control-zoom_a:focus-visible]:outline-offset-2 [&_.leaflet-control-zoom_a:focus-visible]:outline-ring [&_.leaflet-control-zoom_a:focus-visible]:outline-solid',
  "[&_.leaflet-control-attribution_a]:relative [&_.leaflet-control-attribution_a]:before:absolute [&_.leaflet-control-attribution_a]:before:-inset-x-1 [&_.leaflet-control-attribution_a]:before:-inset-y-[15px] [&_.leaflet-control-attribution_a]:before:content-['']",
  // Quellenhinweis auf der Kartenfläche in der Textfarbe (Kontrast in beiden Themes, kein heller Fleck; aus Nr. 238).
  // Mit 8 px Luft zum Rand und eigener Rundung: In der gerundeten Ecke der Karte wurde „Mitwirkende“ sonst
  // abgeschnitten (Abnahme Lauf 32, hoefe 8; Nr. 271).
  '[&_.leaflet-control-attribution]:bg-card/90! [&_.leaflet-control-attribution]:text-foreground! [&_.leaflet-control-attribution_a]:text-foreground!',
  '[&_.leaflet-control-attribution]:m-2! [&_.leaflet-control-attribution]:rounded-md!',
  'dark:[&_.leaflet-tile-pane]:brightness-[0.62] dark:[&_.leaflet-tile-pane]:saturate-[0.7] dark:[&_.leaflet-marker-pane]:brightness-[0.88]',
].join(' ')

/**
 * Die Standortkarte im Hof-Profil: mindestens 260 px hoch laut Vorgabe — 280
 * gibt dem Daumen Spielraum, ohne „Profil speichern" unnötig weit nach unten
 * zu drücken. Karte (standort-karte.tsx) und Platzhalter (profile-form.tsx)
 * nehmen dieselbe Klasse, damit beim Nachladen nichts springt. Darin auch die
 * Bedienteile (LEAFLET_BEDIENTEILE) — dem Platzhalter schaden sie nicht.
 */
export const STANDORT_KARTE_RAHMEN = `h-[280px] rounded-xl ${LEAFLET_BEDIENTEILE}`
