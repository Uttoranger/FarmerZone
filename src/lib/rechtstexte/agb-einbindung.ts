/**
 * Wo und wie die AGB eingebunden werden (Register O4, geändert 13.10.2026):
 * die kurzen Sätze mit Link in Registrierung, Kasse und Bestellbestätigung,
 * der Link in den Fußzeilen und der Satz zur Reihenfolge auf /hoefe. Der Text
 * der AGB selbst steht in src/lib/rechtstexte/agb.ts.
 *
 * Einbezogen werden die AGB bei Höfen und Kundschaft mit einem Satz und einem
 * Link, nie mit einem Haken. Die Kundin stimmt in der Kasse zu, dass die
 * Vermittlung sofort ausgeführt wird (§ 18 Abs. 1 Z 1 FAGG) — der Satz steht
 * unter dem Kaufknopf, weil die Zustimmung dort mit dem Tippen fällt.
 *
 * Bewusst ohne den AGB-Text: Registrierung und Kasse laden diese Datei im
 * Browser.
 */
import { MARKE } from '@/lib/marke'
import { link, type SatzMitLinks } from '@/lib/rechtstexte/stuecke'

/** Die Seite der AGB (src/app/(public)/agb/page.tsx). */
export const AGB_PFAD = '/agb'

/** So heißt der Link in Fußzeilen, Sätzen und der Mail. */
export const AGB_LINK_TEXT = 'AGB'

const KONDITIONEN_PFAD = '/konditionen'

/** Registrierung eines Hofs: beide Links öffnen in einem neuen Tab, damit das Formular bleibt. */
export const REGISTRIERUNG_AGB_SATZ: SatzMitLinks = [
  'Mit der Registrierung stimmst du den ',
  link(AGB_LINK_TEXT, AGB_PFAD),
  ' und den ',
  link('Konditionen für Höfe', KONDITIONEN_PFAD),
  ' zu.',
]

/** Kasse, unter dem Kaufknopf: AGB, Vertragspartner (§ 4a Abs. 2 FAGG) und die Zustimmung zur sofortigen Ausführung. */
export const KASSE_AGB_SATZ: SatzMitLinks = [
  'Es gelten die ',
  link(AGB_LINK_TEXT, AGB_PFAD),
  ` von ${MARKE}. Dein Vertragspartner ist der Hof. Mit dem Bestellen stimmst du zu, dass ${MARKE} die Vermittlung sofort ausführt.`,
]

/** Bestellbestätigung per Mail: Die AGB gehören zum Vertragstext (§ 11 ECG), der Link führt zur Seite. */
export const MAIL_AGB_ZEILE: SatzMitLinks = [
  'Es gelten die ',
  link(AGB_LINK_TEXT, AGB_PFAD),
  ` von ${MARKE}. Du kannst sie jederzeit nachlesen, speichern und ausdrucken.`,
]

/** Unter der Liste der Höfe (§ 4a Abs. 1 Z 1 FAGG): nach welchen Hauptparametern gereiht wird. */
export const REIHENFOLGE_HINWEIS =
  'Reihenfolge: nach Entfernung zum gewählten Ort, sonst nach Freischaltung. Keine bezahlte Platzierung.'
