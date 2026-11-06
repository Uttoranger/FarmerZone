/**
 * Wo und wie die AGB eingebunden werden (Register O4, geändert 13.10.2026):
 * die kurzen Sätze mit Link in Registrierung, Kasse und Bestellbestätigung,
 * der Link in den Fußzeilen und der Satz zur Reihenfolge auf /hoefe, dazu die
 * Wörter der Seite /agb um den Vertragstext herum. Der Text der AGB selbst
 * steht in src/lib/rechtstexte/agb.ts.
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
import { agbFassungPfad, type AgbKennung } from '@/lib/rechtstexte/agb-fassung'

/** Die Seite der geltenden AGB (src/app/(public)/agb/page.tsx); je Fassung /agb/<Kennung> (N45). */
export const AGB_PFAD = '/agb'

/** So heißt der Link in Fußzeilen, Sätzen und der Mail. */
export const AGB_LINK_TEXT = 'AGB'

/**
 * Die Wörter der Seite /agb um den Vertragstext herum: Knopf und Überschrift des
 * Inhaltsverzeichnisses. Sie stehen hier und nicht bei den AGB, weil agb.ts als
 * wörtlicher Rechtstext von der Wortliste ausgenommen ist — Bedienwörter gehören
 * unter die Wache.
 */
export const AGB_SEITE_TEXT = {
  drucken: 'Drucken/Speichern',
  inhalt: 'Inhalt',
  // N45: /agb vor dem Stichtag (0.9) — oben der Hinweis auf 1.0.
  abStichtag: (tag: string) => `Ab ${tag} gilt Fassung 1.0.`,
  fassung10Lesen: 'Fassung 1.0 lesen',
  // N45: /agb ab dem Stichtag (1.0) — am Ende der Link auf 0.9.
  frueher: (vortag: string) => `Frühere Fassung 0.9 (für Bestellungen bis ${vortag})`,
  // /agb/<Fassung>: kein Satz, der von der Uhr abhängt.
  welcheGilt: ['Welche Fassung gerade gilt, steht auf ', link(AGB_PFAD, AGB_PFAD), '.'] satisfies SatzMitLinks,
  // Fehlerseite von /agb (agb/error.tsx): nie eine Fassung ohne geprüften Stichtag.
  fehlerTitel: 'Die AGB lassen sich gerade nicht laden.',
  fehlerText: 'Du kannst jede Fassung auch direkt lesen.',
  fassung: (kennung: AgbKennung) => `Fassung ${kennung}`,
} as const

const KONDITIONEN_PFAD = '/konditionen'

/** Registrierung eines Hofs: beide Links öffnen in einem neuen Tab, damit das Formular bleibt. */
export const REGISTRIERUNG_AGB_SATZ: SatzMitLinks = [
  'Mit der Registrierung stimmst du den ',
  link(AGB_LINK_TEXT, AGB_PFAD),
  ' und den ',
  link('Konditionen für Höfe', KONDITIONEN_PFAD),
  ' zu.',
]

/**
 * Kasse, unter dem Kaufknopf, im Modell „bisher“ (AGB 0.9, 12.5): AGB,
 * Vertragspartner (§ 4a Abs. 2 FAGG) und die Zustimmung zur sofortigen
 * Ausführung. Unverändert seit Nr. 215 (N45).
 */
export const KASSE_AGB_SATZ: SatzMitLinks = [
  'Es gelten die ',
  link(AGB_LINK_TEXT, AGB_PFAD),
  ` von ${MARKE}. Dein Vertragspartner ist der Hof. Mit dem Bestellen stimmst du zu, dass ${MARKE} die Vermittlung sofort ausführt.`,
]

/** Kasse im Hofpreis-Modell (AGB 1.0, N45): ohne die Zustimmung zur sofortigen Vermittlung. */
export const KASSE_AGB_SATZ_HOFPREIS: SatzMitLinks = ['Es gelten die ', link(AGB_LINK_TEXT, AGB_PFAD), ` von ${MARKE}. Dein Vertragspartner ist der Hof.`]

/**
 * Der Satz unter dem Kaufknopf je Modell, der AGB-Link auf `agbPfad`: in der
 * Kasse /agb, bei einer bestehenden Bestellung (Fortsetzung, „Erneut
 * bezahlen“) /agb/<Fassung ihres Snapshots>. Nur das Ziel des Links ändert
 * sich, nie ein Wort.
 */
export function kasseAgbSatz({ hofpreis, agbPfad }: { hofpreis: boolean; agbPfad: string }): SatzMitLinks {
  return (hofpreis ? KASSE_AGB_SATZ_HOFPREIS : KASSE_AGB_SATZ).map((stueck) => (typeof stueck === 'string' ? stueck : { ...stueck, ziel: agbPfad }))
}

/**
 * Bestellbestätigung per Mail: Die AGB gehören zum Vertragstext (§ 11 ECG), der
 * Link führt zur Seite. Seit Nr. 207 hängen sie der Mail auch als Datei an
 * (src/lib/rechtstexte/agb-datei.ts) — der Satz nennt den Anhang. Seit N45 je
 * Fassung der Bestellung: Link /agb/<Fassung> und Anhang zeigen dieselbe.
 */
export function MAIL_AGB_ZEILE(fassung: AgbKennung): SatzMitLinks {
  return [
    'Es gelten die ',
    link(AGB_LINK_TEXT, agbFassungPfad(fassung)),
    ` von ${MARKE}. Du findest sie auch als Datei im Anhang dieser E-Mail und kannst sie jederzeit nachlesen, speichern und ausdrucken.`,
  ]
}

/** Unter der Liste der Höfe (§ 4a Abs. 1 Z 1 FAGG): nach welchen Hauptparametern gereiht wird. */
export const REIHENFOLGE_HINWEIS =
  'Reihenfolge: nach Entfernung zum gewählten Ort, sonst nach Freischaltung. Keine bezahlte Platzierung.'
