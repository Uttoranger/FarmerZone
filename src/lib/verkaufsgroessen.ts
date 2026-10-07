/**
 * Verkaufsgrößen als Produktfamilie (Register E3, Gate 6, Nachtlauf Nr. 20).
 *
 * Jede Größe ist ein eigenes Produkt mit eigenem Preis, eigenem Vorrat und —
 * bei Futter — eigener Kennzeichnung; was dieselbe `familieId` trägt, zeigt
 * die Produktseite als Größenkacheln. Hier stehen die Vorlagen der beiden
 * Formulare, der Name je Größe und die Hilfen für Brennmaterial — rein und
 * ohne Datenbank (tests/verkaufsgroessen.test.ts).
 */
import { formatGrundpreisNetto, parseDezimal } from '@/lib/format'
import { PRODUKTNAME_MAX } from '@/lib/eingabegrenzen'
import { tagVersetzt, wienKalendertag } from '@/lib/kalender'
import type { VerpackungValue } from '@/lib/futter-registrierung'
import type { TrocknungValue } from '@/lib/taxonomie'

// ─── Futter ────────────────────────────────────────────────────────────────

/** Einheiten, in denen Futter-Größen gezählt werden — der Vorrat zählt Gebinde. */
export const FUTTER_GROESSEN_EINHEITEN = ['STUECK', 'BALLEN', 'BIGBAG'] as const

export type FutterGroessenEinheit = (typeof FUTTER_GROESSEN_EINHEITEN)[number]

export type FutterVorlage = {
  id: string
  bezeichnung: string
  unit: FutterGroessenEinheit
  /** Inhalt eines Gebindes in kg — Vorbelegung, der Hof ändert ihn. */
  nettoMenge: number
  verpackung: VerpackungValue
}

/**
 * Die Größen-Vorlagen des Mockups web-h2-neues-futter: Sackerl und Sack sind
 * abgepacktes Heimtierfutter mit Etikett, Ballen und Big Bag lose Ernte (E10).
 * Gewichte sind Vorschläge; Ballen wiegen „ca.".
 */
export const FUTTER_VORLAGEN = [
  { id: 'sackerl-1kg', bezeichnung: '1 kg-Sackerl', unit: 'STUECK', nettoMenge: 1, verpackung: 'ABGEPACKT_ETIKETT' },
  { id: 'sack-5kg', bezeichnung: '5 kg-Sack', unit: 'STUECK', nettoMenge: 5, verpackung: 'ABGEPACKT_ETIKETT' },
  { id: 'kleinballen', bezeichnung: 'Kleinballen', unit: 'BALLEN', nettoMenge: 15, verpackung: 'LOSE_BALLEN' },
  { id: 'rundballen', bezeichnung: 'Rundballen', unit: 'BALLEN', nettoMenge: 250, verpackung: 'LOSE_BALLEN' },
  { id: 'bigbag', bezeichnung: 'Big Bag', unit: 'BIGBAG', nettoMenge: 500, verpackung: 'LOSE_BALLEN' },
] as const satisfies readonly FutterVorlage[]

/** Welche Vorlagen beim Öffnen schon gewählt sind (Mockup: alle außer Big Bag). */
export const FUTTER_VORLAGEN_START: readonly string[] = ['sackerl-1kg', 'sack-5kg', 'kleinballen', 'rundballen']

/** Ballen und Big Bags wiegen ungefähr — die Anzeige schreibt „ca.". */
export function gewichtUngefaehr(unit: string): boolean {
  return unit === 'BALLEN' || unit === 'BIGBAG'
}

/** Die Verpackung einer eigenen Größe in Worten — die Wahl im Formular. */
export const VERPACKUNG_LABEL: Record<VerpackungValue, string> = {
  LOSE_BALLEN: 'lose oder in Ballen',
  ABGEPACKT_ETIKETT: 'abgepackt mit eigenem Etikett',
}

/** Höchstens so viele Größen je Familie — mehr passt in keine Kachelreihe. */
export const GROESSEN_MAX = 6

/** Länge der Bezeichnung einer Größe („5 kg-Sack", „Sack ca. 15 kg"). */
export const GROESSE_BEZEICHNUNG_MAX = 40

/**
 * Der Produktname einer Größe: Name der Familie und Bezeichnung der Größe —
 * „Bergwiesen-Heu 5 kg-Sack". Die Produktseite schneidet den gemeinsamen
 * Anfang wieder ab (groessenKacheln) und zeigt „5 kg-Sack" auf der Kachel;
 * Warenkorb, Bestellung und Mail tragen den vollen Namen.
 */
export function groessenProduktname(name: string, bezeichnung: string): string {
  return `${name.trim()} ${bezeichnung.trim()}`
}

/** Passt der Name jeder Größe in die Grenze des Produktnamens? */
export function namePasstFuerGroessen(name: string, bezeichnungen: readonly string[]): boolean {
  return bezeichnungen.every((b) => groessenProduktname(name, b).length <= PRODUKTNAME_MAX)
}

/**
 * „€ 0,18 / kg" aus getipptem Preis und Gewicht — die Spalte „€ / kg" im
 * Formular. Nur Anzeige (CODING_STANDARDS, Ausnahme Grundpreis), über dieselbe
 * Rundungsstelle wie Hof- und Produktseite. null, solange etwas fehlt.
 */
export function grundpreisVorschau(preis: string | number | null, gewichtKg: string | number | null): string | null {
  const p = typeof preis === 'number' ? preis : parseDezimal(preis ?? '')
  const m = typeof gewichtKg === 'number' ? gewichtKg : parseDezimal(gewichtKg ?? '')
  if (p == null || m == null) return null
  return formatGrundpreisNetto(p, m, 'KG')
}

// ─── Brennmaterial ──────────────────────────────────────────────────────────

/** Einheiten der Brennmaterial-Größen: Stück (Sack, Gitterbox), Raummeter, Schüttraummeter. */
export const BRENN_GROESSEN_EINHEITEN = ['STUECK', 'RAUMMETER', 'SCHUETTRAUMMETER'] as const

export type BrennGroessenEinheit = (typeof BRENN_GROESSEN_EINHEITEN)[number]

export type BrennVorlage = { id: string; bezeichnung: string; unit: BrennGroessenEinheit }

/** Die Größen des Mockups web-h2-neues-brennmaterial. */
export const BRENN_VORLAGEN = [
  { id: 'sack', bezeichnung: 'Sack ca. 15 kg', unit: 'STUECK' },
  { id: 'srm', bezeichnung: 'Schüttraummeter', unit: 'SCHUETTRAUMMETER' },
  { id: 'rm', bezeichnung: 'Raummeter', unit: 'RAUMMETER' },
  { id: 'gitterbox', bezeichnung: 'Gitterbox', unit: 'STUECK' },
  { id: 'anzuendholz-sack', bezeichnung: 'Anzündholz-Sack', unit: 'STUECK' },
] as const satisfies readonly BrennVorlage[]

export type BrennArt = 'BRENNHOLZ_SCHEIT' | 'ANZUENDHOLZ' | 'HACKSCHNITZEL'

/**
 * Welche Vorlagen je Art beim Öffnen gewählt sind. Hackschnitzel werden je
 * Schüttraummeter verkauft (Mockup), Raummeter gibt es für sie nicht.
 */
export const BRENN_VORLAGEN_START: Record<BrennArt, readonly string[]> = {
  BRENNHOLZ_SCHEIT: ['sack', 'srm', 'rm'],
  ANZUENDHOLZ: ['anzuendholz-sack'],
  HACKSCHNITZEL: ['srm'],
}

/** Darf diese Art in dieser Einheit verkauft werden? Hackschnitzel nie in Raummetern (gestapelt geht nicht). */
export function einheitPasstZurArt(art: BrennArt, unit: BrennGroessenEinheit): boolean {
  return !(art === 'HACKSCHNITZEL' && unit === 'RAUMMETER')
}

/** Die Spalte „Menge" der Größen-Tabelle (Mockup: „1 srm lose", „1 rm gestapelt"). */
export function brennMengeText(unit: BrennGroessenEinheit): string {
  switch (unit) {
    case 'RAUMMETER':
      return '1 rm gestapelt'
    case 'SCHUETTRAUMMETER':
      return '1 srm lose'
    case 'STUECK':
      return 'je Stück'
  }
}

/** Erklärbox rm/srm/fm, wörtlich aus den Mockups (H2 und K2). */
export const RAUMMASS_ERKLAERUNG = [
  { kurz: 'Raummeter (rm)', text: '1 m³ ordentlich gestapelt, mit Luft dazwischen' },
  { kurz: 'Schüttraummeter (srm)', text: '1 m³ lose geschüttet · 1 rm ≈ 1,4 srm' },
  { kurz: 'Festmeter (fm)', text: '1 m³ reines Holz ohne Luft · 1 rm ≈ 0,7 fm' },
] as const

/** Erklärt die Seite Raummaße? Sobald eine Größe in rm oder srm verkauft wird (DESIGN_SYSTEM). */
export function raummassErklaeren(units: readonly string[]): boolean {
  return units.some((u) => u === 'RAUMMETER' || u === 'SCHUETTRAUMMETER')
}

/** Holzarten als Vorschläge (Mockup) — die Spalte ist Freitext, andere Arten gehen auch. */
export const HOLZARTEN = ['Buche', 'Eiche', 'Fichte', 'Birke', 'gemischt'] as const

/** Scheitlängen in cm (Mockup: 25 cm, 33 cm, 50 cm, 1 m). */
export const SCHEITLAENGEN_CM = [25, 33, 50, 100] as const

/** Wassergehalt W20 bis W35 und Körnung P16, P31, P45 bei Hackschnitzeln (Mockup). */
export const WASSERGEHALT_KLASSEN = [20, 25, 30, 35] as const
export const KOERNUNG_KLASSEN = [16, 31, 45] as const

/**
 * Die Restfeuchte, die zu einem Trocknungsgrad gehört (Mockup: ofenfertig
 * unter 20 %, lufttrocken 20–25 %). Frisches Holz hat keine Höchstgrenze.
 */
export const RESTFEUCHTE_JE_TROCKNUNG: Record<TrocknungValue, number | null> = {
  OFENFERTIG: 20,
  LUFTTROCKEN: 25,
  FRISCH: null,
}

/** Wie der Trocknungsgrad im Formular heißt (Mockup), mit der Restfeuchte. */
export const TROCKNUNG_WAHL: Record<TrocknungValue, string> = {
  OFENFERTIG: 'ofenfertig · unter 20 % Restfeuchte',
  LUFTTROCKEN: 'lufttrocken · 20–25 %',
  FRISCH: 'frisch · zum selbst Trocknen',
}

/** „Gelagert seit" als Wahl in ganzen Jahren — mehr als zehn sagt nichts mehr. */
export const GELAGERT_JAHRE_MAX = 10

/**
 * Aus „gelagert seit N Jahren" das Kalenderdatum für BrennmaterialAngaben.
 * gelagertSeit: der Wiener Tag heute vor N Jahren. Gespeichert wird das Datum,
 * nicht die Zahl — sonst stimmte „seit 2 Jahren" nächstes Jahr nicht mehr. Der
 * 29. Februar wird in Nicht-Schaltjahren zum 28.
 */
export function gelagertSeitAus(jahre: number, jetzt: Date): string {
  const heute = wienKalendertag(jetzt)
  const [jahr, monat, tag] = heute.split('-')
  const zieljahr = Number(jahr) - jahre
  const schaltjahr = (zieljahr % 4 === 0 && zieljahr % 100 !== 0) || zieljahr % 400 === 0
  if (monat === '02' && tag === '29' && !schaltjahr) return `${zieljahr}-02-28`
  // tagVersetzt um 0 Tage normalisiert die Schreibweise (zweistellig).
  return tagVersetzt(`${zieljahr}-${monat}-${tag}`, 0)
}

// ─── Formular ──────────────────────────────────────────────────────────────

/**
 * Die erste Meldung je Feld aus einer Zod-Prüfung — Schlüssel wie der Pfad
 * („groessen.0.price"). Das Formular prüft mit demselben Schema wie der Server
 * und zeigt die Meldungen am Feld.
 */
export function fehlerJeFeld(issues: readonly { path: readonly PropertyKey[]; message: string }[]): Record<string, string> {
  const fehler: Record<string, string> = {}
  for (const issue of issues) {
    const schluessel = issue.path.map(String).join('.')
    if (!(schluessel in fehler)) fehler[schluessel] = issue.message
  }
  return fehler
}

/** Der Satz nach dem Speichern: wie viele Größen online sind und wie viele warten. */
export function gespeichertText(name: string, online: number, wartend: number): string {
  const groessen = (n: number) => (n === 1 ? '1 Größe' : `${n} Größen`)
  const warten = wartend === 1 ? '1 Größe wartet' : `${wartend} Größen warten`
  if (wartend === 0) return `${name.trim()}: ${groessen(online)} online.`
  if (online === 0) return `${name.trim()}: als Entwurf gespeichert – ${warten} auf deine Registrierung.`
  return `${name.trim()}: ${groessen(online)} online, ${warten} auf deine Registrierung.`
}
