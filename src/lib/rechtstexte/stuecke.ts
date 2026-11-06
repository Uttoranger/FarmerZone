/**
 * Textstücke für Rechtstexte und die Sätze, die auf sie verweisen (Register O4):
 * Klartext, Fett, Kursiv, Link, Mail-Adresse und die Platzhalter der AGB
 * (Betreiber, E-Mail, seit N45 der Tag des Inkrafttretens von Fassung 1.0). Ein Satz mit Link ist eine Liste solcher Stücke, nie ein
 * Markdown-Text, der erst im Browser zerlegt wird.
 *
 * Bewusst ohne den AGB-Text selbst (src/lib/rechtstexte/agb.ts): Registrierung
 * und Kasse binden nur die kurzen Sätze ein und sollen nicht die ganzen AGB in
 * ihr Browserpaket ziehen.
 */
import { KONTAKT_EMAIL } from '@/lib/support'
import { formatDatumLang } from '@/lib/format'
import { PRODUKTION_HOST } from '@/lib/umgebung'

/**
 * Eine Stelle im Text, die beim Zeichnen gefüllt wird: „Betreiber" und
 * „E-Mail" aus dem Impressum, „Inkrafttreten" aus dem Stichtag
 * „Hofpreis-Modell ab“ (N45).
 */
export type AgbPlatzhalter = { art: 'platzhalter'; was: 'betreiber' | 'email' | 'inkrafttreten' }

/**
 * Was die Platzhalter beim Zeichnen brauchen: der Stichtag, ab dem Fassung 1.0
 * gilt. null heißt „nicht geladen“ — dann steht der Ersatzwert da (nur die
 * Mail-Datei darf das, A005 Schritt 3; die Seiten zeigen bei einem Ladefehler
 * die Fehlerseite).
 */
export type AgbKontext = { inkrafttreten: Date | null }

/** Für Sätze ohne Platzhalter des Stichtags (Registrierung, Kasse, Fassung 0.9). */
export const OHNE_STICHTAG: AgbKontext = { inkrafttreten: null }

/**
 * Ersatz für den Tag, wenn der Stichtag nicht zu laden war — ohne Artikel:
 * Im Satz steht schon „vor dem“ bzw. „ab dem“, so entsteht nie „dem dem“.
 */
export const INKRAFTTRETEN_ERSATZ = `Stichtag auf ${PRODUKTION_HOST}/konditionen`

/** Der Tag des Inkrafttretens als Text: der Wiener Kalendertag ausgeschrieben (formatDatumLang) oder der Ersatzwert. */
export function inkrafttretenText(kontext: AgbKontext): string {
  return kontext.inkrafttreten ? formatDatumLang(kontext.inkrafttreten) : INKRAFTTRETEN_ERSATZ
}

export type AgbStueck =
  | string
  | { art: 'fett'; stuecke: readonly (string | AgbPlatzhalter)[] }
  | { art: 'kursiv'; text: string }
  | { art: 'link'; text: string; ziel: string }
  | { art: 'mail'; adresse: string }
  | AgbPlatzhalter

export type AgbLink = Extract<AgbStueck, { art: 'link' }>

/** Ein Satz aus Klartext und Links — mehr brauchen die Sätze in Registrierung, Kasse und Mail nicht. */
export type SatzMitLinks = readonly (string | AgbLink)[]

export function fett(...stuecke: (string | AgbPlatzhalter)[]): AgbStueck {
  return { art: 'fett', stuecke }
}

export function kursiv(text: string): AgbStueck {
  return { art: 'kursiv', text }
}

export function link(text: string, ziel: string): AgbLink {
  return { art: 'link', text, ziel }
}

export function mail(adresse: string): AgbStueck {
  return { art: 'mail', adresse }
}

export const BETREIBER: AgbPlatzhalter = { art: 'platzhalter', was: 'betreiber' }
export const E_MAIL: AgbPlatzhalter = { art: 'platzhalter', was: 'email' }
export const INKRAFTTRETEN: AgbPlatzhalter = { art: 'platzhalter', was: 'inkrafttreten' }

const IMPRESSUM_PFAD = '/impressum'

/**
 * Was für die Platzhalter steht. Die E-Mail-Adresse ist dieselbe Konstante wie
 * im Impressum (KONTAKT_EMAIL). Name und Anschrift des Betreibers stehen dort
 * als Text in der Seite, nicht als Konstante — sie noch einmal in den AGB
 * auszuschreiben hieße, eine Privatadresse ein zweites Mal im Quelltext zu
 * führen (Hinweis 9 der anwaltlichen Prüfung). Bis das Impressum die Angaben
 * aus einer Quelle liest, verweist der Satz darauf.
 */
export function PLATZHALTER_ANGABE(kontext: AgbKontext): Record<AgbPlatzhalter['was'], readonly AgbStueck[]> {
  return {
    betreiber: ['dem Betreiber laut ', link('Impressum', IMPRESSUM_PFAD), ' (E-Mail: ', mail(KONTAKT_EMAIL), ')'],
    email: [mail(KONTAKT_EMAIL)],
    inkrafttreten: [inkrafttretenText(kontext)],
  }
}
