/**
 * Region (Register N23) — was beide Reiter („Preise vergleichen", „Futter
 * kaufen") gemeinsam brauchen, rein und ohne Datenbank prüfbar
 * (tests/region.test.ts): die Zahl je Stufe des Umkreises, der Hinweis auf
 * Höfe ohne Standort und der Zustand ohne eigenen Standort samt der eigenen
 * Hofkarte, wie die Kundschaft sie in der Liste auf /hoefe sieht.
 */
import { mitAnzahl } from '@/lib/format'
import { berechneHofAuswahl, waehleVorschauImBereich, type AbholFenster, type VorschauProdukt } from '@/lib/hofuebersicht'
import { hofPasst, type AngebotsZeile } from '@/lib/bereiche-anzeige'
import { UMFELD_KM, type UmfeldKm } from '@/lib/umfeld'
import type { AnzeigeBereich, ProductCategoryValue } from '@/lib/taxonomie'
import { LEERER_HOEFE_FILTER } from '@/schemas/hoefe-filter'

/**
 * Wie viele Höfe (bzw. Angebote) jede Stufe des Umkreises zählen würde — aus
 * den Entfernungen, die der Server einmal für den größten Umkreis lädt
 * (Konzept Umfeld §4, N23). Die Grenze schließt ein (≤), genau wie
 * `waehleHoefeImUmkreis`: Ein Hof in genau 25 km zählt bei 25 km.
 */
export function zaehleJeStufe(entfernungenKm: readonly number[]): Record<UmfeldKm, number> {
  const zahlen = { 10: 0, 25: 0, 50: 0 } satisfies Record<UmfeldKm, number>
  for (const stufe of UMFELD_KM) {
    zahlen[stufe] = entfernungenKm.filter((km) => km <= stufe).length
  }
  return zahlen
}

/**
 * Der Hinweis auf Höfe ohne Standort — EINE Quelle für beide Reiter (vorher
 * je ein eigener Satz in umfeld.ts und futter-kaufen.ts). Lang über Liste und
 * Karte, `kurz` für die Karte am Handy.
 */
export function ohneStandortHinweis(anzahl: number, { kurz = false }: { kurz?: boolean } = {}): string {
  const hoefe = mitAnzahl(anzahl, 'Hof', 'Höfe')
  if (kurz) return `${hoefe} ohne Standort ${anzahl === 1 ? 'fehlt' : 'fehlen'} hier.`
  return anzahl === 1
    ? `${hoefe} hat noch keinen Standort auf der Karte und fehlt hier.`
    : `${hoefe} haben noch keinen Standort auf der Karte und fehlen hier.`
}

/** Der Anker der Standortkarte im Hofprofil — Ziel und `id` aus einer Quelle. */
export const STANDORT_ANKER = 'standort'

/** Wohin „Standort auf der Karte setzen" führt: direkt zur Karte im Hofprofil (Board v2 §4). */
export const STANDORT_SETZEN_HREF = `/settings/profile#${STANDORT_ANKER}`

/** Die Texte des Zustands ohne eigenen Standort (Board v2 §4, Handy 5) — für beide Reiter gleich. */
export const OHNE_STANDORT_TEXT = {
  titel: 'Wo liegt dein Hof?',
  satz: 'Ohne Standort gibt es keinen Umkreis – und deine Kundschaft findet dich nicht auf der Karte.',
  knopf: 'Standort auf der Karte setzen',
  ueberschriftListe: 'So steht dein Hof gerade in der Liste der Kundschaft',
  nichtInDerListe: 'Dein Hof steht gerade nicht in der Liste der Kundschaft.',
} as const

/** Was die eigene Hofkarte vom Eintrag der Hofliste braucht (HofUebersichtEintrag, ohne Server-Typ). */
export type ListenEintrag = {
  name: string
  kategorien: ProductCategoryValue[]
  suchNamen: string[]
  angebot: readonly AngebotsZeile[]
  latitude: number | null
  longitude: number | null
  isPaused: boolean
  abholfenster: AbholFenster[]
  produkte: VorschauProdukt[]
  produkteJeBereich: Record<AnzeigeBereich, number>
}

/**
 * Die eigene Hofkarte, wie sie in der Liste auf /hoefe steht: im Hofladen,
 * wo die Kundschaft zuerst sucht, sonst — bei einem reinen Futterhof — im
 * Futter (hofPasst, dieselbe Regel wie die Liste). Kategorien, Entfernung
 * (ohne Standort der Kundin: keine) und Schaufenster rechnet DIESELBE
 * Funktion wie /hoefe (berechneHofAuswahl, waehleVorschauImBereich, drei Zeilen).
 */
export function eigeneListenkarte<E extends ListenEintrag>(
  eintrag: E,
  jetzt: Date
): {
  hof: ReturnType<typeof berechneHofAuswahl<E>>['gefiltert'][number]
  bereich: AnzeigeBereich
  schaufenster: { produkte: VorschauProdukt[]; weitere: number }
} | null {
  const bereich: AnzeigeBereich = hofPasst(eintrag, LEERER_HOEFE_FILTER) ? 'LEBENSMITTEL' : 'FUTTERMITTEL'
  const auswahl = berechneHofAuswahl([eintrag], { ...LEERER_HOEFE_FILTER, bereich, bezugspunkt: null, umkreis: null, jetzt })
  const hof = auswahl.gefiltert[0]
  if (!hof) return null
  return { hof, bereich, schaufenster: waehleVorschauImBereich(hof, bereich, auswahl.vorschauKategorien, 3, auswahl.suchbegriffe) }
}
