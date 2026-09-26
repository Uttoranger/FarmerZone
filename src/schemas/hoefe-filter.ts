import { z } from 'zod'
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
 * Die URL ist eine Systemgrenze: Jeder kann einen Link bauen. Deshalb läuft
 * jeder Wert einzeln durch Zod — und was nicht passt, wird VERWORFEN, nie ein
 * Fehler: Ein alter oder verstümmelter Link zeigt die Übersicht mit dem, was
 * sich retten lässt, statt einer Fehlerseite.
 *
 * NICHT in der URL: Bezugspunkt und Umkreis. Der Standort verlässt den Browser
 * nie (src/lib/hofuebersicht.ts, Abschnitt Umkreis) — ein geteilter Link oder
 * ein Server-Log trüge ihn sonst weiter.
 * Ausnahme: um=<hof-slug>&km= — Bezugspunkt ist der öffentliche Standort eines
 * freigegebenen Hofs (Link „Auf der Karte zeigen" aus dem Umfeld). Der
 * Standort des Besuchers kommt nie in die URL. Aufgelöst wird der Slug im
 * Browser gegen die ohnehin geladene Hofliste; unbekannt oder ohne Standort
 * wird er dort still verworfen.
 *
 * Voreinstellungen stehen nicht in der URL: Die nackte /hoefe ist Hofladen,
 * Liste, ohne Filter.
 */

export const GEBINDE_VALUES = ['KLEIN', 'GROSS'] as const
export type GebindeWahl = (typeof GEBINDE_VALUES)[number]

/** Die Umkreis-Stufen, die zu um= passen — dieselben wie UMKREIS_STUFEN in
 *  src/lib/hofuebersicht.ts ohne „egal" (ein Test hält beide zusammen). */
export const UM_KM_VALUES = [10, 25, 50] as const
export type UmKm = (typeof UM_KM_VALUES)[number]

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
  ansicht: 'liste' | 'karte'
  /** Slug des Hofs, dessen öffentlicher Standort der Bezugspunkt ist; null = keiner. */
  um: string | null
  /** Umkreis um diesen Hof; nur zusammen mit um, null = egal. */
  km: UmKm | null
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
  ansicht: 'liste',
  um: null,
  km: null,
}

/** Obergrenzen gegen aufgeblähte Links — die Oberfläche erreicht sie nie. */
export const SUCHTEXT_MAX = 100
export const SUCHMARKEN_MAX = 10

const kategorieSchema = z.enum(PRODUCT_CATEGORY_VALUES)
const sorteSchema = z.enum(PRODUCT_SUBCATEGORY_VALUES)
const siegelSchema = z.enum(PRODUCT_LABEL_VALUES)
const tierSchema = z.enum(TIERART_VALUES)
const suchSchema = z.string().trim().min(1).max(SUCHTEXT_MAX)
// Einzelwerte: Was nicht passt, fällt per .catch auf die Voreinstellung.
const bereichSchema = z.enum(['futter']).nullable().catch(null)
const gebindeSchema = z.enum(['klein', 'gross']).nullable().catch(null)
const sortSchema = z.enum(['grundpreis']).nullable().catch(null)
const ansichtSchema = z.enum(['liste', 'karte']).catch('liste')
// Wie generateSlug (src/lib/slug.ts) Slugs baut: Kleinbuchstaben, Ziffern,
// einzelne Bindestriche. Alles andere kann kein Hof sein.
const slugSchema = z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const kmSchema = z.coerce.number().pipe(z.literal([...UM_KM_VALUES]))

/** Die Namen der Parameter — eine Stelle, damit Lesen und Schreiben nicht auseinanderlaufen. */
const P = {
  bereich: 'bereich',
  kategorien: 'kat',
  sorten: 'sorte',
  siegel: 'siegel',
  tiere: 'tiere',
  gebinde: 'gebinde',
  sortierung: 'sort',
  suchtext: 'q',
  suchMarken: 'such',
  ansicht: 'ansicht',
  um: 'um',
  km: 'km',
} as const

/** Was URLSearchParams und Nexts ReadonlyURLSearchParams beide können. */
export type SuchParameter = {
  get(name: string): string | null
  getAll(name: string): string[]
}

/** URL-Wert des Bereichs: `bereich=futter`; alles andere ist Hofladen. */
export function bereichAusParameter(wert: string | null | undefined): AnzeigeBereich {
  return bereichSchema.parse(wert ?? null) === 'futter' ? 'FUTTERMITTEL' : 'LEBENSMITTEL'
}

export function bereichParameter(bereich: AnzeigeBereich): string | null {
  return bereich === 'FUTTERMITTEL' ? 'futter' : null
}

/** Kommaliste → gültige, entdoppelte Werte in Eingabereihenfolge. */
function liste<T>(roh: string | null, schema: z.ZodType<T>): T[] {
  if (!roh) return []
  const werte: T[] = []
  for (const teil of roh.split(',')) {
    const ergebnis = schema.safeParse(teil.trim())
    if (ergebnis.success && !werte.includes(ergebnis.data)) werte.push(ergebnis.data)
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
  const kategorien = liste(params.get(P.kategorien), kategorieSchema).filter((k) => imBereich.includes(k))
  const sorten = liste(params.get(P.sorten), sorteSchema).filter(
    (s) => !istAltlastUnterkategorie(s) && kategorien.some((k) => gehoertZu(k, s))
  )
  const futter = bereich === 'FUTTERMITTEL'
  const gebinde = gebindeSchema.parse(params.get(P.gebinde))
  const suchtext = suchSchema.safeParse(params.get(P.suchtext) ?? '')
  const um = slugSchema.safeParse(params.get(P.um))
  const km = kmSchema.safeParse(params.get(P.km))
  const suchMarken: string[] = []
  for (const roh of params.getAll(P.suchMarken)) {
    const marke = suchSchema.safeParse(roh)
    if (marke.success && !suchMarken.includes(marke.data) && suchMarken.length < SUCHMARKEN_MAX) {
      suchMarken.push(marke.data)
    }
  }

  return {
    bereich,
    kategorien,
    sorten,
    siegel: liste(params.get(P.siegel), siegelSchema),
    tiere: futter ? liste(params.get(P.tiere), tierSchema) : [],
    gebinde: !futter || gebinde === null ? null : gebinde === 'klein' ? 'KLEIN' : 'GROSS',
    sortierung: futter && sortSchema.parse(params.get(P.sortierung)) === 'grundpreis' ? 'GRUNDPREIS' : null,
    // Der getippte Text bleibt, wie er ist (auch mit Leerzeichen am Ende —
    // sonst spränge der Cursor beim Tippen); nur zu lang wird verworfen.
    suchtext: suchtext.success ? (params.get(P.suchtext) ?? '') : '',
    suchMarken,
    ansicht: ansichtSchema.parse(params.get(P.ansicht)),
    um: um.success ? um.data : null,
    // Ein Umkreis ohne Bezugspunkt hätte keinen Mittelpunkt — verworfen.
    km: um.success && km.success ? km.data : null,
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
  if (filter.suchtext.trim() !== '') params.set(P.suchtext, filter.suchtext)
  for (const marke of filter.suchMarken) params.append(P.suchMarken, marke)
  if (filter.ansicht === 'karte') params.set(P.ansicht, 'karte')
  if (filter.um) {
    params.set(P.um, filter.um)
    if (filter.km) params.set(P.km, String(filter.km))
  }
  return params.toString()
}

/**
 * Bereichswechsel: Was nur im alten Bereich Sinn hatte (Kategorien, Sorten,
 * Tiere, Gebinde, Sortierung), fällt weg. Siegel, Suche, Ansicht und der
 * Bezugspunkt aus um= bleiben — „Bio" gilt in beiden Bereichen, der Hof steht
 * in beiden am selben Ort.
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
