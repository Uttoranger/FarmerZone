/**
 * Der Aufbau einer Fassung der AGB (Register O4, N45): Typen, Blockbauer und
 * Sprungmarken — gemeinsam für die eingefrorene Fassung 0.9 (agb-0-9.ts) und
 * Fassung 1.0 (agb.ts). Hier steht kein Wort Rechtstext; deshalb braucht die
 * Datei keine Ausnahme in den Wachen.
 */
import type { AgbKennung } from '@/lib/rechtstexte/agb-fassung'
import type { AgbKontext, AgbStueck } from '@/lib/rechtstexte/stuecke'

/** Ein Block im Text eines Punkts oder Anhangs. */
export type AgbBlock =
  /** Ein Absatz, meist mit Nummer wie „5.3"; ohne Nummer die Fortsetzung eines Punkts oder ein Punkt ohne Unterpunkte. */
  | { art: 'absatz'; nummer: string | null; stuecke: readonly AgbStueck[] }
  | { art: 'liste'; eintraege: readonly (readonly AgbStueck[])[] }
  | { art: 'tabelle'; kopf: readonly [string, string]; zeilen: readonly (readonly [string, string])[] }
  /** Zeilen, die untereinander stehen bleiben (das Muster-Formular im Anhang von 0.9). */
  | { art: 'zeilen'; zeilen: readonly (readonly AgbStueck[])[] }
  /** Ein Hinweis neben dem gesetzlichen Muster („kein Teil des Musters“); `kursiv` wie im Text. */
  | { art: 'hinweis'; kursiv: boolean; stuecke: readonly AgbStueck[] }
  /** Die Rücktrittsbelehrung (Anhang I Teil A FAGG) — gezeichnet aus BELEHRUNG in src/lib/widerruf.ts, nie abgetippt. */
  | { art: 'belehrung' }
  /** Das Muster-Widerrufsformular (Anhang I Teil B FAGG) — ebenso aus BELEHRUNG. */
  | { art: 'formular' }

export type AgbPunkt = { nummer: number; titel: string; bloecke: readonly AgbBlock[] }
export type AgbTeil = { id: 'a' | 'b' | 'c' | 'd'; titel: string; punkte: readonly AgbPunkt[] }
export type AgbKurzErklaert = { titel: string; zusatz: string; punkte: readonly (readonly AgbStueck[])[] }
export type AgbAnhang = { anker: string; titel: string; bloecke: readonly AgbBlock[] }

/** Eine Fassung als Daten. Der Stand-Vermerk hängt bei 1.0 vom Stichtag ab, darum eine Funktion. */
export type AgbFassungDaten = {
  kennung: AgbKennung
  titel: string
  vermerk: (kontext: AgbKontext) => string
  kurzErklaert: AgbKurzErklaert
  teile: readonly AgbTeil[]
  anhaenge: readonly AgbAnhang[]
}

export function absatz(nummer: string | null, ...stuecke: AgbStueck[]): AgbBlock {
  return { art: 'absatz', nummer, stuecke }
}

export function aufzaehlung(...eintraege: AgbStueck[][]): AgbBlock {
  return { art: 'liste', eintraege }
}

export function tabelle(kopf: readonly [string, string], zeilen: readonly (readonly [string, string])[]): AgbBlock {
  return { art: 'tabelle', kopf, zeilen }
}

export function zeilenblock(...zeilen: AgbStueck[][]): AgbBlock {
  return { art: 'zeilen', zeilen }
}

export function hinweis(kursiv: boolean, ...stuecke: AgbStueck[]): AgbBlock {
  return { art: 'hinweis', kursiv, stuecke }
}

/** Die Sprungmarke eines Punkts („punkt-12"); das Inhaltsverzeichnis und die Überschrift nehmen dieselbe. */
export function agbAnker(nummer: number): string {
  return `punkt-${nummer}`
}

/** Die Sprungmarke eines Teils („teil-a"). */
export function agbTeilAnker(id: AgbTeil['id']): string {
  return `teil-${id}`
}

/** Alle Punkte einer Fassung, über die Teile hinweg. */
export function agbPunktZahl(fassung: Pick<AgbFassungDaten, 'teile'>): number {
  return fassung.teile.reduce((summe, teil) => summe + teil.punkte.length, 0)
}
