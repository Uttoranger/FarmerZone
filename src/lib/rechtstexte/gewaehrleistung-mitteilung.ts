/**
 * Die harmonisierte Mitteilung über das gesetzliche Gewährleistungsrecht
 * (§ 4 Abs. 1 Z 12 und Anhang II FAGG, Pflicht seit 27.9.2026; Nr. 211) —
 * EINE Quelle für Kasse und Bestätigungsmails: Pfade, Maße, Überschrift und
 * Alt-Text. Kasse und Mail zeichnen nur, keine schreibt einen Wert ein
 * zweites Mal.
 *
 * Quelle der Grafik: Europäische Kommission, „Practical guidelines and
 * high-resolution vector files – EU notice and label on product guarantees“,
 * https://commission.europa.eu/publications/practical-guidelines-and-high-resolution-vector-files-eu-notice-and-label-product-guarantees_en
 * (ZIP „SVG“, Fassung DE, Farbe), abgerufen am 1.11.2026 durch die
 * Projektleitung; Muster nach der Durchführungsverordnung (EU) 2025/1960.
 * Die Erläuterungen dazu verlangen: nicht verändern, online farbig. Darum
 * steht die Datei unverändert unter public/recht (aus „Legal
 * guarantee_notice DE.svg“ nur umbenannt) und läuft weder durch den
 * Bild-Baustein noch durch `next/image`, ohne Filter und ohne Umfärbung im
 * dunklen Modus (DESIGN_SYSTEM, „Amtliche Grafiken“).
 *
 * Die PNG für die Mails (Mailprogramme zeigen SVG meist nicht an) ist eine
 * reine Rasterung derselben SVG: 1240 px breit, weißer Grund, nichts
 * beschnitten, nichts umgefärbt — erzeugt einmalig mit
 * `pnpm exec tsx scripts/gewaehrleistung-png.ts` (sharp) und committet.
 * Liefert die Kommission später eine offizielle PNG, ersetzt sie diese Datei
 * (gleicher Pfad; tests/gewaehrleistung-dateien.test.ts prüft Maße und
 * Seitenverhältnis).
 *
 * Rein und ohne Abhängigkeiten: Die Kasse lädt diese Datei im Browser.
 */
export const GEWAEHRLEISTUNG_MITTEILUNG = {
  /** Die amtliche Grafik für die Kasse (Vektor, scharf in jeder Breite). */
  svgPfad: '/recht/gewaehrleistung-mitteilung-de.svg',
  /** Die Rasterung für die Mails; in der Mail mit absoluter Adresse. */
  pngPfad: '/recht/gewaehrleistung-mitteilung-de.png',
  /** Seitenmaß der SVG in Punkt (A4 hoch, viewBox 595,28 × 841,89) — für width/height am Bild. */
  breite: 595,
  hoehe: 842,
  /** Breite der PNG in Pixeln. */
  pngBreite: 1240,
  ueberschrift: 'Gesetzliche Gewährleistung',
  altText:
    'Harmonisierte Mitteilung über das gesetzliche Gewährleistungsrecht (Anhang II FAGG): Für Waren gilt eine gesetzliche Gewährleistung von mindestens zwei Jahren ab Übergabe.',
} as const
