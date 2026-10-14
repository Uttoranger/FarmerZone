/**
 * Textstücke für Rechtstexte und die Sätze, die auf sie verweisen (Register O4):
 * Klartext, Fett, Kursiv, Link, Mail-Adresse und die zwei Platzhalter des
 * AGB-Entwurfs. Ein Satz mit Link ist eine Liste solcher Stücke, nie ein
 * Markdown-Text, der erst im Browser zerlegt wird.
 *
 * Bewusst ohne den AGB-Text selbst (src/lib/rechtstexte/agb.ts): Registrierung
 * und Kasse binden nur die kurzen Sätze ein und sollen nicht die ganzen AGB in
 * ihr Browserpaket ziehen.
 */
import { KONTAKT_EMAIL } from '@/lib/support'

/** Die Stelle im Entwurf, die das Impressum füllt — „Betreiber" oder „E-Mail". */
export type AgbPlatzhalter = { art: 'platzhalter'; was: 'betreiber' | 'email' }

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

const IMPRESSUM_PFAD = '/impressum'

/**
 * Was für die Platzhalter steht. Die E-Mail-Adresse ist dieselbe Konstante wie
 * im Impressum (KONTAKT_EMAIL). Name und Anschrift des Betreibers stehen dort
 * als Text in der Seite, nicht als Konstante — sie noch einmal in den AGB
 * auszuschreiben hieße, eine Privatadresse ein zweites Mal im Quelltext zu
 * führen (Hinweis 9 der anwaltlichen Prüfung). Bis das Impressum die Angaben
 * aus einer Quelle liest, verweist der Satz darauf.
 */
export const PLATZHALTER_ANGABE: Record<AgbPlatzhalter['was'], readonly AgbStueck[]> = {
  betreiber: ['dem Betreiber laut ', link('Impressum', IMPRESSUM_PFAD), ' (E-Mail: ', mail(KONTAKT_EMAIL), ')'],
  email: [mail(KONTAKT_EMAIL)],
}
