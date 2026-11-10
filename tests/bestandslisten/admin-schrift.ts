/*
 * Bestandsliste der Admin-Schrift-Wache (tests/admin-schrift-wache.test.ts, Nr. 281,
 * Regelvorschlag 10 aus Morgenbericht 32 B, freigegeben 7.11.2026): Dateien unter src/app/admin und
 * src/components/admin, die heute noch eine Schriftgröße unter 12 px schreiben, je mit der Zahl der
 * Stellen und einem Grund.
 *
 * Die Liste darf nur schrumpfen: Mehr Stellen als hier oder eine neue Datei machen die Wache rot,
 * eine Datei ohne Treffer ebenso (dann raus aus der Liste). Startbestand zu Beginn von Nr. 281:
 * 8 Dateien (betrieb-teile 3, finanzen-diagramm 2, jahr-monate 4, faden-spalte 1, meldungen-teile 4,
 * startseite-block-formular 1, startseite-vorschau 1, startseite-zeitplan 1). Eine SVG-Achse bleibt
 * nur mit Grund.
 */
export type AdminSchriftAusnahme = { stellen: number; grund: string }

export const ADMIN_SCHRIFT_BESTAND: Readonly<Record<string, AdminSchriftAusnahme>> = {
  'src/app/admin/betrieb/betrieb-teile.tsx': {
    stellen: 3,
    grund: 'SVG-Achse des Verlaufs (Prozent, Warnschwelle, Tage): Das Bild skaliert über viewBox 840 mit der Kartenbreite, die Schrift also mit. Echte 12 px gibt es erst mit gemessener Breite wie in jahr-monate.tsx – ein Umbau des Diagramms, nicht Teil von Nr. 281',
  },
  'src/app/admin/finanzen/jahr-monate.tsx': {
    stellen: 1,
    grund: 'SVG-Achse der Jahresansicht am Handy: zwölf Monatskürzel in Spalten von rund 22 px; mit 12 px liefen die Kürzel ineinander. Monatsnamen ab 40 px Spaltenbreite stehen in 12 px',
  },
}
