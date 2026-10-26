import { SUCHTEXT_PARAMETER } from '@/lib/suchtext-parameter'
import {
  ANZEIGE_BEREICHE,
  PRODUCT_CATEGORY_VALUES,
  PRODUCT_LABEL_VALUES,
  PRODUCT_SUBCATEGORY_VALUES,
  TIERART_VALUES,
  gehoertZu,
  istAltlastUnterkategorie,
  type AnzeigeBereich,
  type ProductCategoryValue,
  type ProductLabelValue,
  type ProductSubcategoryValue,
  type TierartValue,
} from '@/lib/taxonomie'

/**
 * Der Filterzustand von /hoefe in der URL (Sprint Bereiche 2, Konzept 6.2).
 *
 * Die URL ist eine Systemgrenze: Jeder kann einen Link bauen. Deshalb wird
 * jeder Wert einzeln geprüft — und was nicht passt, wird VERWORFEN, nie ein
 * Fehler: Ein alter oder verstümmelter Link zeigt die Übersicht mit dem, was
 * sich retten lässt, statt einer Fehlerseite.
 *
 * NICHT in der URL: Bezugspunkt und Umkreis. Der Standort verlässt den Browser
 * nie (src/lib/hofuebersicht.ts, Abschnitt Umkreis) — ein geteilter Link oder
 * ein Server-Log trüge ihn sonst weiter.
 *
 * Voreinstellungen stehen nicht in der URL: Die nackte /hoefe ist Hofladen,
 * Liste, ohne Filter.
 *
 * ABGESENDET ODER GETIPPT: Der Suchtext `q` kommt auf zwei Wegen in die
 * Adresse. Von außen schicken ihn die GET-Formulare der Startseite, der
 * Kopfzeile und der 404 — dort hat die Kundin abgesendet, und /hoefe löst ihn
 * beim Ankommen als Ort auf (Nr. 84). Von innen schreibt ihn die Seite selbst,
 * bei jedem Tippen und in jedem Filter-Link (schreibeHoefeFilter) — das ist
 * kein Absenden, und nach einem Neuladen oder „Zurück" darf dieser Text nicht
 * an die Ortssuche gehen („Die Suche startet erst, wenn du sie absendest").
 * Darum trägt jede Adresse, die die Seite selbst schreibt, die Kennung `t=1`
 * beim Suchtext; ohne sie kam er von außen (abgesendeterSuchtext). Die
 * Formulare brauchen von der Kennung nichts zu wissen.
 *
 * OHNE ZOD (Nr. 196): /hoefe, Startseite, Hofseite und Kasse lesen diese Datei
 * im Browser (tests/leistung-196.test.ts). Jede Prüfung ist eine kleine reine
 * Funktion mit derselben Wirkung wie das frühere Zod-Schema (Liste der Werte,
 * Ränder weg, Länge).
 */

export const GEBINDE_VALUES = ['KLEIN', 'GROSS'] as const
export type GebindeWahl = (typeof GEBINDE_VALUES)[number]

/** Der Filter „Abholung" (Register N22): heute, morgen oder am Wochenende; null = alle Tage. */
export const ABHOLUNG_VALUES = ['heute', 'morgen', 'wochenende'] as const
export type AbholungWahl = (typeof ABHOLUNG_VALUES)[number]

export type HoefeFilter = {
  bereich: AnzeigeBereich
  kategorien: ProductCategoryValue[]
  sorten: ProductSubcategoryValue[]
  siegel: ProductLabelValue[]
  /** Nur im Bereich Futtermittel. */
  tiere: TierartValue[]
  /** Nur im Bereich Futtermittel; null = beide. */
  gebinde: GebindeWahl | null
  /** Nur im Bereich Futtermittel; null = Reihenfolge der Liste (Entfernung oder Freischaltung). */
  sortierung: 'GRUNDPREIS' | null
  suchtext: string
  suchMarken: string[]
  /** Wann die Kundin abholen will (Register N22) — gerechnet im Browser aus den Abholzeiten; null = alle Tage. */
  abholung: AbholungWahl | null
  ansicht: 'liste' | 'karte'
}

export const LEERER_HOEFE_FILTER: HoefeFilter = {
  bereich: 'LEBENSMITTEL',
  kategorien: [],
  sorten: [],
  siegel: [],
  tiere: [],
  gebinde: null,
  sortierung: null,
  suchtext: '',
  suchMarken: [],
  abholung: null,
  ansicht: 'liste',
}

/** Obergrenzen gegen aufgeblähte Links — die Oberfläche erreicht sie nie. */
export const SUCHTEXT_MAX = 100
export const SUCHMARKEN_MAX = 10

/** Der Wert, wenn er in der Liste steht, sonst null. */
function ausListe<T extends string>(werte: readonly T[], roh: unknown): T | null {
  return werte.find((wert) => wert === roh) ?? null
}

/** Ein Suchtext ohne Ränder, 1 bis SUCHTEXT_MAX Zeichen — sonst null. */
function suchwort(roh: string): string | null {
  const wert = roh.trim()
  return wert.length >= 1 && wert.length <= SUCHTEXT_MAX ? wert : null
}

/**
 * Der Name des Suchparameters, auch für Seiten, die nur AUF die Suche zeigen
 * (die 404 schickt ihr Suchfeld als GET-Formular auf /hoefe). Gelesen wird er
 * unten über P.suchtext — es ist derselbe Wert, nur einmal geschrieben.
 */
export { SUCHTEXT_PARAMETER }

/** Die Namen der Parameter — eine Stelle, damit Lesen und Schreiben nicht auseinanderlaufen. */
const P = {
  bereich: 'bereich',
  kategorien: 'kat',
  sorten: 'sorte',
  siegel: 'siegel',
  tiere: 'tiere',
  gebinde: 'gebinde',
  sortierung: 'sort',
  suchtext: SUCHTEXT_PARAMETER,
  /** Die Kennung der Seite beim Suchtext: getippt oder schon aufgelöst, nicht von außen abgesendet. */
  eigenerSuchtext: 't',
  suchMarken: 'such',
  abholung: 'abholung',
  ansicht: 'ansicht',
} as const

/** Was URLSearchParams und Nexts ReadonlyURLSearchParams beide können. */
export type SuchParameter = {
  get(name: string): string | null
  getAll(name: string): string[]
}

/** URL-Wert des Bereichs: `bereich=futter`; alles andere ist Hofladen. */
export function bereichAusParameter(wert: string | null | undefined): AnzeigeBereich {
  return wert === 'futter' ? 'FUTTERMITTEL' : 'LEBENSMITTEL'
}

export function bereichParameter(bereich: AnzeigeBereich): string | null {
  return bereich === 'FUTTERMITTEL' ? 'futter' : null
}

/** Kommaliste → gültige, entdoppelte Werte in Eingabereihenfolge. */
function liste<T extends string>(roh: string | null, erlaubt: readonly T[]): T[] {
  if (!roh) return []
  const werte: T[] = []
  for (const teil of roh.split(',')) {
    const wert = ausListe(erlaubt, teil.trim())
    if (wert !== null && !werte.includes(wert)) werte.push(wert)
  }
  return werte
}

/**
 * Liest den Filter aus der URL. Verworfen wird auch, was fachlich nicht
 * zusammenpasst: eine Kategorie aus dem anderen Bereich, eine Sorte ohne ihre
 * gewählte Kategorie, Tiere, Gebinde und Kilopreis-Sortierung im Hofladen.
 */
export function leseHoefeFilter(params: SuchParameter): HoefeFilter {
  const bereich = bereichAusParameter(params.get(P.bereich))
  const imBereich = ANZEIGE_BEREICHE[bereich].kategorien as readonly ProductCategoryValue[]
  const kategorien = liste(params.get(P.kategorien), PRODUCT_CATEGORY_VALUES).filter((k) => imBereich.includes(k))
  const sorten = liste(params.get(P.sorten), PRODUCT_SUBCATEGORY_VALUES).filter(
    (s) => !istAltlastUnterkategorie(s) && kategorien.some((k) => gehoertZu(k, s))
  )
  const futter = bereich === 'FUTTERMITTEL'
  const gebinde = ausListe(['klein', 'gross'] as const, params.get(P.gebinde))
  const suchtextGueltig = suchwort(params.get(P.suchtext) ?? '') !== null
  const suchMarken: string[] = []
  for (const roh of params.getAll(P.suchMarken)) {
    const marke = suchwort(roh)
    if (marke !== null && !suchMarken.includes(marke) && suchMarken.length < SUCHMARKEN_MAX) {
      suchMarken.push(marke)
    }
  }

  return {
    bereich,
    kategorien,
    sorten,
    siegel: liste(params.get(P.siegel), PRODUCT_LABEL_VALUES),
    tiere: futter ? liste(params.get(P.tiere), TIERART_VALUES) : [],
    gebinde: !futter || gebinde === null ? null : gebinde === 'klein' ? 'KLEIN' : 'GROSS',
    sortierung: futter && params.get(P.sortierung) === 'grundpreis' ? 'GRUNDPREIS' : null,
    // Der getippte Text bleibt, wie er ist (auch mit Leerzeichen am Ende —
    // sonst spränge der Cursor beim Tippen); nur zu lang wird verworfen.
    suchtext: suchtextGueltig ? (params.get(P.suchtext) ?? '') : '',
    suchMarken,
    abholung: ausListe(ABHOLUNG_VALUES, params.get(P.abholung)),
    ansicht: params.get(P.ansicht) === 'karte' ? 'karte' : 'liste',
  }
}

/** Der Filter als Query-String ohne „?"; Voreinstellungen fehlen, leer = nackte /hoefe. */
export function schreibeHoefeFilter(filter: HoefeFilter): string {
  const params = new URLSearchParams()
  const bereich = bereichParameter(filter.bereich)
  if (bereich) params.set(P.bereich, bereich)
  if (filter.kategorien.length > 0) params.set(P.kategorien, filter.kategorien.join(','))
  if (filter.sorten.length > 0) params.set(P.sorten, filter.sorten.join(','))
  if (filter.siegel.length > 0) params.set(P.siegel, filter.siegel.join(','))
  if (filter.tiere.length > 0) params.set(P.tiere, filter.tiere.join(','))
  if (filter.gebinde) params.set(P.gebinde, filter.gebinde === 'KLEIN' ? 'klein' : 'gross')
  if (filter.sortierung === 'GRUNDPREIS') params.set(P.sortierung, 'grundpreis')
  if (filter.suchtext.trim() !== '') {
    params.set(P.suchtext, filter.suchtext)
    params.set(P.eigenerSuchtext, '1')
  }
  for (const marke of filter.suchMarken) params.append(P.suchMarken, marke)
  if (filter.abholung) params.set(P.abholung, filter.abholung)
  if (filter.ansicht === 'karte') params.set(P.ansicht, 'karte')
  return params.toString()
}

/**
 * Der Suchtext, mit dem die Kundin ABGESENDET ankam — oder '' bei einer Adresse,
 * die die Seite selbst geschrieben hat (Kennung `t`, siehe oben). Nur dieser Text
 * wird beim Ankommen an die Ortssuche gegeben; was die Kundin getippt hat, bleibt
 * auch nach Neuladen und „Zurück" im Browser.
 */
export function abgesendeterSuchtext(params: SuchParameter): string {
  return params.get(P.eigenerSuchtext) === null ? leseHoefeFilter(params).suchtext : ''
}

/**
 * Bereichswechsel: Was nur im alten Bereich Sinn hatte (Kategorien, Sorten,
 * Tiere, Gebinde, Sortierung), fällt weg. Siegel, Suche, Abholung und Ansicht
 * bleiben — „Bio" und „heute" gelten in beiden Bereichen.
 */
export function wechsleBereich(filter: HoefeFilter, bereich: AnzeigeBereich): HoefeFilter {
  if (filter.bereich === bereich) return filter
  return {
    ...filter,
    bereich,
    kategorien: [],
    sorten: [],
    tiere: [],
    gebinde: null,
    sortierung: null,
  }
}
