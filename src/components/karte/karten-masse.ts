/*
 * Maße der Karten, die Karte und Platzhalter teilen (Nachtlauf Nr. 52).
 * Eigene Datei ohne Leaflet: Ein Import aus standort-karte.tsx holte die
 * Kartenbibliothek statisch ins Formular — dann gäbe es nichts mehr
 * nachzuladen und keinen Platzhalter.
 */

/**
 * Die Standortkarte im Hof-Profil: mindestens 260 px hoch laut Vorgabe — 280
 * gibt dem Daumen Spielraum, ohne „Profil speichern" unnötig weit nach unten
 * zu drücken. Karte (standort-karte.tsx) und Platzhalter (profile-form.tsx)
 * nehmen dieselbe Klasse, damit beim Nachladen nichts springt.
 */
export const STANDORT_KARTE_RAHMEN = 'h-[280px] rounded-xl'

/**
 * Die Bedienteile von Leaflet im neuen Design (Lauf 31, Nr. 238; Boards
 * s2-/w2-hofdaten-zahlung, s1-/w1-region): Leaflet zeichnet „+“/„−“ mit 30 px
 * und weißem Grund — zu klein zum Tippen (WCAG 2.5.8) und im Dunkeln ein heller
 * Fleck. Die Klassen stehen am Rahmen um die Karte und greifen per
 * Nachfahren-Auswahl, mit `!`, weil leaflet.css nach Tailwind geladen werden kann:
 * Knöpfe 44 px auf der Kartenfläche (`bg-card`, Rand `border`), der Quellenhinweis
 * auf `bg-card` in der Textfarbe (Kontrast in beiden Themes). Die Kacheln selbst
 * folgen dem Modus nicht (CODING_STANDARDS §7).
 */
export const KARTEN_STEUERUNG = [
  '[&_.leaflet-bar]:overflow-hidden! [&_.leaflet-bar]:rounded-xl! [&_.leaflet-bar]:border-border! [&_.leaflet-bar]:shadow-none!',
  '[&_.leaflet-bar_a]:size-11! [&_.leaflet-bar_a]:border-border! [&_.leaflet-bar_a]:bg-card! [&_.leaflet-bar_a]:text-lg! [&_.leaflet-bar_a]:leading-[44px]! [&_.leaflet-bar_a]:text-foreground!',
  '[&_.leaflet-bar_a:hover]:bg-muted! [&_.leaflet-bar_a:focus-visible]:outline-2! [&_.leaflet-bar_a:focus-visible]:outline-solid! [&_.leaflet-bar_a:focus-visible]:outline-ring!',
  '[&_.leaflet-control-attribution]:bg-card/90! [&_.leaflet-control-attribution]:text-foreground! [&_.leaflet-control-attribution_a]:text-foreground!',
].join(' ')
