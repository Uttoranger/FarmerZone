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
