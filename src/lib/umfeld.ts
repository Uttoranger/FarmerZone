/**
 * Umfeld — was andere Höfe in der Nähe anbieten (docs/konzepte/umfeld.md),
 * auf /region der Reiter „Preise vergleichen".
 *
 * Rein, ohne Datenbank und ohne Browser prüfbar (tests/umfeld.test.ts,
 * tests/preis-streifen.test.ts, tests/umfeld-leitplanken.test.ts). Die Query
 * (src/server/queries/umfeld.ts) beschafft die öffentlichen Daten bis 50 km,
 * hier wird entschieden:
 *   - welcher Ausschnitt der Karte als Vorfilter dient (Bounding-Box) und
 *     welche Höfe wirklich im Umkreis liegen (exakte Entfernung),
 *   - wie viele Höfe jede Stufe des Umkreises zählen würde (N23),
 *   - wie Produkte zu Zeilen werden (je Unterkategorie, ohne sie je
 *     Kategorie), was ihr vergleichbarer Grundpreis ist und in welcher
 *     Einheit er gezeigt wird,
 *   - Spanne, Mitte, „Deins", Streifen und Lage — über EINEN Wert je Hof und
 *     Gebindeklasse, seinen günstigsten: „wo liegt das günstigste Angebot
 *     jedes Nachbarn",
 *   - welche Pins die Karte zeigt: genau die Höfe, die die Liste zählt, mit
 *     den ersten zwei kaufbaren Produkten in der Reihenfolge der Hofseite.
 *
 * Was hier bewusst NICHT entschieden wird: die Sichtbarkeit fremder Höfe. Die
 * steht in der WHERE-Klausel der Query (IN_LISTEN_SICHTBAR plus nicht
 * pausiert) — dieselbe Regel wie /hoefe, keine zweite.
 *
 * Leitplanken (N23, als Prüfung in tests/umfeld-leitplanken.test.ts): kein
 * Text empfiehlt oder wertet einen Preis, keine Preise an den Pins, keine
 * Sortierung nach Preis, keine Namen an den Punkten des Streifens.
 */
import { hofseitenLink } from '@/lib/bereiche-anzeige'
import { centsAlsEuro, einheitLabel, formatEuro, formatPreisSpanne, formatZahl, mitAnzahl } from '@/lib/format'
import { ERDRADIUS_KM, entfernungKm, waehleVorschauImBereich, type VorschauProdukt } from '@/lib/hofuebersicht'
import { hofIllustrationen } from '@/lib/hoefe-anzeige'
import { MARKE } from '@/lib/marke'
import { ohneStandortHinweis, zaehleJeStufe } from '@/lib/region'
import type { BildAusschnitt } from '@/schemas/bild-ausschnitt'
import {
  ANZEIGE_BEREICHE,
  KATEGORIE_LABEL,
  KLEINGEBINDE_BIS_KG,
  TAXONOMIE,
  UNTERKATEGORIE_LABEL,
  anzeigeBereichVon,
  istGrossgebinde,
  preisAnzeigeVon,
  type AnzeigeBereich,
  type NettoEinheitValue,
  type PreisAnzeige,
  type ProductCategoryValue,
  type ProductSubcategoryValue,
} from '@/lib/taxonomie'

// ─── Umkreis ────────────────────────────────────────────────────────────────

/** Die Stufen des Umfelds — dieselben wie der Umkreis-Regler auf /hoefe ohne „egal" (Test). */
export const UMFELD_KM = [10, 25, 50] as const
export type UmfeldKm = (typeof UMFELD_KM)[number]

/** So weit lädt die Query immer — die Zahl je Stufe braucht alle Stufen auf einmal (N23). */
export const UMFELD_GROESSTER_KM: UmfeldKm = UMFELD_KM[UMFELD_KM.length - 1]

/** Mehr Höfe zeigt das Umfeld nicht — die nächsten gewinnen, mit Hinweis. */
export const UMFELD_HOEFE_DECKEL = 200

/** Ab so vielen Höfen klappt eine Zeile die übrigen hinter „n weitere Höfe". */
export const UMFELD_HOEFE_SICHTBAR = 3

/** So viele Produkte zeigt die Karte am Pin (Board v2 „Karte am Pin"). */
const PIN_PRODUKTE = 2

/**
 * Ein Prozent Polster: Die Box ist nur der Vorfilter in der WHERE-Klausel
 * (einen Index auf latitude/longitude gibt es noch nicht — bei ein paar Dutzend
 * Höfen braucht es ihn nicht).
 * Schneidet sie wegen einer Rundung einen Hof am Rand ab, fehlt er still —
 * zu groß kostet nichts, die exakte Entfernung sortiert ihn danach aus.
 */
const BOX_POLSTER = 1.01

export type UmkreisBox = { breiteVon: number; breiteBis: number; laengeVon: number; laengeBis: number }

const zuGrad = (bogen: number) => (bogen * 180) / Math.PI

/**
 * Der Breiten- und Längengrad-Ausschnitt, der den Kreis mit Radius `km` um
 * `punkt` sicher enthält — für die WHERE-Klausel, nie das Endergebnis.
 *
 * Breite: Nach Norden und Süden ist der Kreis genau `km / Erdradius` weit.
 * Länge: Die weiteste Ausdehnung liegt nicht auf der Breite des Mittelpunkts,
 * sondern etwas polwärts; asin(sin r / cos φ) trifft sie genau, das einfache
 * r / cos φ wäre knapp zu schmal. Nahe am Pol umfasst der Kreis jede Länge.
 * Die Datumsgrenze kommt in einem österreichischen Umkreis nicht vor.
 */
export function umkreisBox(punkt: { lat: number; lon: number }, km: number): UmkreisBox {
  const winkel = km / ERDRADIUS_KM
  const dBreite = zuGrad(winkel) * BOX_POLSTER
  const anteil = Math.sin(winkel) / Math.cos((punkt.lat * Math.PI) / 180)
  const dLaenge = anteil >= 1 ? 180 : zuGrad(Math.asin(anteil)) * BOX_POLSTER
  return {
    breiteVon: punkt.lat - dBreite,
    breiteBis: punkt.lat + dBreite,
    laengeVon: punkt.lon - dLaenge,
    laengeBis: punkt.lon + dLaenge,
  }
}

/**
 * Welche Höfe wirklich im Umkreis liegen — nach der Box der zweite Schritt.
 *
 *   - Exakte Entfernung (dieselbe Rechnung wie /hoefe), Grenze einschließlich.
 *   - Höfe ohne brauchbare Koordinaten stehen nicht im Umkreis — sie werden
 *     gezählt (ohneStandortHinweis in src/lib/region.ts), nie platziert. Anders als
 *     auf /hoefe: Dort bleiben sie in der Liste, hier gäbe es keine Entfernung.
 *   - Der eigene Hof ist nie dabei, auch wenn er übergeben wird.
 *   - Nach Entfernung sortiert; über dem Deckel bleiben die nächsten.
 */
export function waehleHoefeImUmkreis<H extends { id: string; latitude: number | null; longitude: number | null }>(
  punkt: { lat: number; lon: number },
  hoefe: readonly H[],
  km: number,
  eigeneId: string,
  deckel: number = UMFELD_HOEFE_DECKEL
): { nah: Array<H & { entfernungKm: number }>; ohneStandort: H[]; abgeschnitten: boolean } {
  const nah: Array<H & { entfernungKm: number }> = []
  const ohneStandort: H[] = []
  for (const hof of hoefe) {
    if (hof.id === eigeneId) continue
    if (!Number.isFinite(hof.latitude) || !Number.isFinite(hof.longitude)) {
      ohneStandort.push(hof)
      continue
    }
    const entfernung = entfernungKm(punkt, { lat: hof.latitude as number, lon: hof.longitude as number })
    if (entfernung <= km) nah.push({ ...hof, entfernungKm: entfernung })
  }
  nah.sort((a, b) => a.entfernungKm - b.entfernungKm)
  return { nah: nah.slice(0, deckel), ohneStandort, abgeschnitten: nah.length > deckel }
}

// ─── Produkte und Grundpreis ────────────────────────────────────────────────

/**
 * Ein Produkt, so schmal, wie das Umfeld es braucht — nur, was auch die
 * Hofseite zeigt. Die Produkt-ID steht dort öffentlich in der Adresse der
 * Produktseite; Bestand und Reservierung verlassen die Query nie (nur
 * `kaufbar` als Ja/Nein). Die Reihenfolge der Liste ist die der Hofseite.
 */
export type UmfeldProdukt = {
  id: string
  name: string
  category: ProductCategoryValue | null
  subcategory: ProductSubcategoryValue | null
  /** Preis je Gebinde in ganzen Cent, aus dem Decimal an der Servergrenze — nur Anzeige und Vergleich, nie Abrechnung. */
  preisCents: number
  unit: string
  unitSize: number | null
  /** Aus der Futter-Kennzeichnung; null ohne. */
  nettoMenge: number | null
  nettoEinheit: NettoEinheitValue | null
  imageUrl: string | null
  /** Ausschnitt des Produktfotos (Register N17), schon geprüft; null = wie heute. */
  bildAusschnitt: BildAusschnitt | null
  /** Vorrat abzüglich Reservierung über null (istKaufbar) — fremde Produkte liefert die Query nur kaufbar. */
  kaufbar: boolean
}

/**
 * Ein fremder Hof bis 50 km. Keine Kontaktdaten — nur, was die Hofübersicht
 * auch zeigt: Name, PLZ und Ort, Fotos, Kategorien und der Punkt auf der
 * Karte (als Pin steht er dort ebenfalls).
 */
export type UmfeldHof = {
  slug: string
  name: string
  postalCode: string
  city: string
  lat: number
  lon: number
  entfernungKm: number
  /** Der Fotostreifen wie auf /hoefe (baueFotostreifen); Region zeigt das erste Foto klein im Kopf. */
  fotos: string[]
  /** Die Kategorien der kaufbaren Produkte in Taxonomie-Reihenfolge — für die Illustration ohne Foto. */
  kategorien: ProductCategoryValue[]
  /** Nur kaufbare Produkte, in der Reihenfolge der Hofseite. */
  produkte: UmfeldProdukt[]
}

export type Gebindeklasse = 'KLEIN' | 'GROSS'

const KLASSEN_LABEL: Record<Gebindeklasse, string> = {
  KLEIN: `Kleingebinde bis ${formatZahl(KLEINGEBINDE_BIS_KG)} kg`,
  GROSS: `Großgebinde über ${formatZahl(KLEINGEBINDE_BIS_KG)} kg`,
}

/** Kilo bzw. Liter je Einheit des Produkts — dieselbe Umrechnung wie grundpreisJeKg in format.ts. */
const VERGLEICHS_BASIS: Record<string, { basis: NettoEinheitValue; jeBasis: number }> = {
  KG: { basis: 'KG', jeBasis: 1 },
  G: { basis: 'KG', jeBasis: 1000 },
  LITER: { basis: 'LITER', jeBasis: 1 },
  ML: { basis: 'LITER', jeBasis: 1000 },
}

/**
 * Warum ein Produkt nicht vergleichbar ist — EINE Tabelle für alle Zeilen
 * (Freigabe Nr. 124 Punkt 3). Andere Einheiten (Raummeter, Ballen ohne
 * Kennzeichnung …) nennen ihre Einheit, verschiedene Gründe in einer Zeile
 * ergeben „Preise nicht vergleichbar".
 */
export const NICHT_VERGLEICHBAR_TEXT = {
  STUECK: 'Preis je Stück, nicht vergleichbar – ohne Gewicht je Stück.',
  PAKET: 'Preis je Paket, nicht vergleichbar – ohne Gewicht je Paket.',
  LITER_KILO: 'nicht vergleichbar – Liter und Kilo vergleichen wir nicht.',
  GEMISCHT: 'Preise nicht vergleichbar',
} as const

function einheitGrund(unit: string): string {
  if (unit === 'STUECK') return NICHT_VERGLEICHBAR_TEXT.STUECK
  if (unit === 'PAKET') return NICHT_VERGLEICHBAR_TEXT.PAKET
  if (unit in VERGLEICHS_BASIS) return NICHT_VERGLEICHBAR_TEXT.GEMISCHT
  return `Preis je ${einheitLabel(unit)}, nicht vergleichbar`
}

/** Eine Menge mit höchstens drei Nachkommastellen (Decimal(10,3)) als ganze Tausendstel — wie grundpreisCents in format.ts. */
function tausendstel(menge: number): number | null {
  const ganz = Math.round(menge * 1000)
  return Number.isFinite(ganz) && ganz > 0 ? ganz : null
}

/**
 * Der Grundpreis in der kleinsten gezeigten Einheit — ganze Cent, bei € / t
 * und € / dt ganze Euro —, kaufmännisch gerundet, exakt in ganzen Zahlen
 * (BigInt: Cent × Tonne × Gramm sprengten sonst die sicheren Ganzzahlen).
 * Gezeigt, verglichen und in die Lage gerechnet wird NUR diese Zahl — so
 * sieht der Hof genau die Werte, mit denen gerechnet wird.
 */
function inAnzeigeEinheiten(preisCents: number, mengeTausendstel: number, jeBasis: number, anzeige: PreisAnzeige): number | null {
  if (!Number.isInteger(preisCents) || preisCents <= 0) return null
  // Wert = Preis € · faktor · jeBasis / Menge; in Cent ·100, in Tausendstel ·1000 im Zähler.
  const zaehler = BigInt(preisCents) * BigInt(anzeige.faktor) * BigInt(jeBasis) * BigInt(anzeige.stellen === 2 ? 1000 : 10)
  const nenner = BigInt(mengeTausendstel)
  const zwei = BigInt(2)
  return Number((zwei * zaehler + nenner) / (zwei * nenner))
}

/**
 * Der Grundpreis eines Produkts in der Anzeigeeinheit seiner Zeile (€/t,
 * €/dt, €/kg, €/L) als ganze Zahl der kleinsten gezeigten Einheit, seine
 * Gebindeklasse und — ohne Wert — der Grund.
 *
 *   - Im Bereich Futtermittel zählt nur die Kennzeichnung: ohne Nettomenge
 *     kein Kilopreis und keine Klasse (auf /hoefe genauso).
 *   - Passt die Einheit nicht zur Zeile — ein Liter-Produkt in einer
 *     €/dt-Zeile —, ist es nicht vergleichbar. Kein Liter-gleich-Kilo in
 *     Preisvergleichen.
 *   - Klassen gibt es nur im Futter; im Hofladen fehlt die Nettomenge.
 *   - Stück und Paket bleiben nicht vergleichbar, auch bei Eiern: `unitSize`
 *     zählt bei Paket die Pakete, nicht die Stück (Freigabe Nr. 124 Punkt 3,
 *     gestoppt — Bericht 124).
 */
export function bewerteProdukt(
  p: UmfeldProdukt,
  bereich: AnzeigeBereich,
  anzeige: PreisAnzeige
): { wert: number | null; klasse: Gebindeklasse | null; grund: string | null } {
  if (bereich === 'FUTTERMITTEL') {
    const { nettoMenge, nettoEinheit } = p
    if (nettoMenge == null || nettoEinheit == null) return { wert: null, klasse: null, grund: einheitGrund(p.unit) }
    const klasse: Gebindeklasse = istGrossgebinde(nettoMenge, nettoEinheit) ? 'GROSS' : 'KLEIN'
    if (nettoEinheit !== anzeige.basis) return { wert: null, klasse, grund: NICHT_VERGLEICHBAR_TEXT.LITER_KILO }
    const menge = tausendstel(nettoMenge)
    const wert = menge === null ? null : inAnzeigeEinheiten(p.preisCents, menge, 1, anzeige)
    return { wert, klasse, grund: wert === null ? NICHT_VERGLEICHBAR_TEXT.GEMISCHT : null }
  }
  const basis = VERGLEICHS_BASIS[p.unit]
  if (!basis) return { wert: null, klasse: null, grund: einheitGrund(p.unit) }
  if (basis.basis !== anzeige.basis) return { wert: null, klasse: null, grund: NICHT_VERGLEICHBAR_TEXT.LITER_KILO }
  const menge = tausendstel(p.unitSize ?? 1)
  const wert = menge === null ? null : inAnzeigeEinheiten(p.preisCents, menge, basis.jeBasis, anzeige)
  return { wert, klasse: null, grund: wert === null ? NICHT_VERGLEICHBAR_TEXT.GEMISCHT : null }
}

/**
 * Die Mitte (Median) in ganzen Zahlen: bei gerader Anzahl die Mitte der
 * beiden mittleren Werte, kaufmännisch gerundet — die Zahl, die als „Mitte"
 * dasteht und mit der die Lage rechnet. Leer → null.
 */
export function median(werte: readonly number[]): number | null {
  if (werte.length === 0) return null
  const sortiert = [...werte].sort((a, b) => a - b)
  const mitte = Math.floor(sortiert.length / 2)
  return sortiert.length % 2 === 1 ? sortiert[mitte] : Math.floor((sortiert[mitte - 1] + sortiert[mitte] + 1) / 2)
}

// ─── Lage ───────────────────────────────────────────────────────────────────

export type PreisLage = 'UNTER_SPANNE' | 'UNTER_MITTE' | 'NAHE_MITTE' | 'UEBER_MITTE' | 'UEBER_SPANNE'

/** Die Lage in Worten — einordnen, nicht werten (Konzept Umfeld §1, N23). */
export const PREIS_LAGE_TEXT: Record<PreisLage, string> = {
  UNTER_SPANNE: 'unter der Spanne',
  UNTER_MITTE: 'unter der Mitte',
  NAHE_MITTE: 'nahe der Mitte',
  UEBER_MITTE: 'über der Mitte',
  UEBER_SPANNE: 'über der Spanne',
}

/**
 * Wo „Deins" liegt — alles ganze Zahlen der kleinsten gezeigten Einheit, nie
 * Gleitkomma. Die Reihenfolge der Prüfung ist Teil der Regel: erst die
 * Spanne, dann „nahe" (|Deins − Mitte| · 100 ≤ 3 · Mitte, genau 3 % ist nahe),
 * sonst unter bzw. über der Mitte.
 */
export function preisLage(deins: number, spanne: { kleinst: number; hoechst: number; mitte: number }): PreisLage {
  if (deins < spanne.kleinst) return 'UNTER_SPANNE'
  if (deins > spanne.hoechst) return 'UEBER_SPANNE'
  if (Math.abs(deins - spanne.mitte) * 100 <= 3 * spanne.mitte) return 'NAHE_MITTE'
  return deins < spanne.mitte ? 'UNTER_MITTE' : 'UEBER_MITTE'
}

// ─── Zeilen ─────────────────────────────────────────────────────────────────

/**
 * Der Streifen einer Spanne (Board v3 §2) — erst ab zwei Höfen mit
 * verschiedenen Werten. Alle Zahlen in der kleinsten gezeigten Einheit; die
 * Werte tragen weder Namen noch Kennungen.
 */
export type PreisStreifenDaten = {
  /** Je Hof sein Wert, aufsteigend. */
  werte: number[]
  kleinst: number
  hoechst: number
  mitte: number
  /** Dein Wert als grüner Punkt; null ohne eigenes oder bei mehreren eigenen Produkten. */
  deins: number | null
  /** „€ 1,47" — unter dem linken Ende. */
  kleinstText: string
  /** „€ 1,66" — unter dem rechten Ende. */
  hoechstText: string
  /** Der ganze Satz für Screenreader: „3 Höfe von € 1,47 bis € 1,66 / L, Mitte € 1,58; deiner € 1,50, unter der Mitte". */
  satz: string
}

/** Eine Spanne der Zeile — eine je Gebindeklasse, im Hofladen genau eine. */
export type UmfeldPreis = {
  /** „Kleingebinde bis 25 kg"/„Großgebinde über 25 kg" nur, wenn die Zeile beide zeigt. */
  klasse: string | null
  /** „€ 120 – 180 / t" bzw. „€ 150 / t" bei einem Wert; null, wenn nur du hier anbietest. */
  spanne: string | null
  /** „Mitte € 150" — nur mit Streifen. */
  mitte: string | null
  /** „nur 1 Angebot im Umkreis" bei einem Hof. */
  zusatz: string | null
  /** Wie viele Höfe diese Spanne tragen. */
  anzahlHoefe: number
  /** „Deins € 1,50 / L · unter der Mitte" bzw. ohne Lage „Deins € 1,50 / L"; null ohne eigenes vergleichbares Produkt. */
  deins: string | null
  /** Nur mit Streifen und genau einem eigenen Wert. */
  lage: PreisLage | null
  streifen: PreisStreifenDaten | null
}

/** Ein Hof in der aufgeklappten Zeile: Kopf wie auf /hoefe und das Produkt, das in dieser Zeile zählt. */
export type UmfeldHofEintrag = {
  slug: string
  name: string
  postalCode: string
  city: string
  entfernungKm: number
  /** Das erste Foto; ohne Foto die Illustration der Kategorie (Bild 40 im Kopf). */
  foto: string | null
  illustration: string
  link: string
  /** Je Gebindeklasse das Produkt mit dem Wert dieses Hofs, in der Reihenfolge der Hofseite; ohne vergleichbares das erste der Zeile. */
  produkte: VorschauProdukt[]
}

export type UmfeldZeile = {
  /** Stabil, für React-Schlüssel und Aufklappen: „L1/L2", ohne L2 die L1. */
  schluessel: string
  titel: string
  anzahlHoefe: number
  /** „5 Höfe" */
  anzahlText: string
  /** Hast du selbst ein Produkt in dieser Zeile (auch ein nicht vergleichbares)? */
  eigenesProdukt: boolean
  preise: UmfeldPreis[]
  /** Der Grund aus NICHT_VERGLEICHBAR_TEXT — wenn kein fremdes Produkt vergleichbar ist. */
  hinweis: string | null
  /** Nach Entfernung; die ersten UMFELD_HOEFE_SICHTBAR stehen gleich da. */
  hoefe: UmfeldHofEintrag[]
}

type ZeilenSchluessel = { l1: ProductCategoryValue; l2: ProductSubcategoryValue | null }

/** Die Zeile eines Produkts: seine L2, ohne L2 seine L1, ohne Kategorie „Sonstiges". */
function zeileVon(p: { category: ProductCategoryValue | null; subcategory: ProductSubcategoryValue | null }): ZeilenSchluessel {
  return { l1: p.category ?? 'SONSTIGES', l2: p.subcategory }
}

/** L1 und L2 zusammen — eine L2 gehört zwar zu genau einer L1, aber Altdaten halten sich nicht immer daran. */
function schluesselText(z: ZeilenSchluessel): string {
  return z.l2 ? `${z.l1}/${z.l2}` : z.l1
}

/** Taxonomie-Reihenfolge als letzte Sortierstufe — stabil zwischen zwei Aufrufen. */
function taxonomieRang(z: ZeilenSchluessel, bereich: AnzeigeBereich): number {
  const kategorien = ANZEIGE_BEREICHE[bereich].kategorien as readonly ProductCategoryValue[]
  const l1 = kategorien.indexOf(z.l1)
  const sorten = TAXONOMIE[z.l1] as readonly ProductSubcategoryValue[]
  const l2 = z.l2 ? sorten.indexOf(z.l2) : -1
  return (l1 === -1 ? kategorien.length : l1) * 100 + l2 + 1
}

/** Ganze Zahl der kleinsten Einheit → Euro-Zahl für die Formatierer. */
function alsEuro(wert: number, anzeige: PreisAnzeige): number {
  return anzeige.stellen === 2 ? centsAlsEuro(wert) : wert
}

function betragText(wert: number, anzeige: PreisAnzeige): string {
  return formatEuro(alsEuro(wert, anzeige), anzeige.stellen)
}

function spanneText(von: number, bis: number, anzeige: PreisAnzeige): string {
  return formatPreisSpanne(alsEuro(von, anzeige), alsEuro(bis, anzeige), anzeige.label, anzeige.stellen)
}

/** Ein Umfeld-Produkt als Produktzeile von /hoefe (HoefeProduktzeilen). */
function alsVorschau(p: UmfeldProdukt): VorschauProdukt {
  return {
    id: p.id,
    name: p.name,
    price: centsAlsEuro(p.preisCents),
    unit: p.unit,
    unitSize: p.unitSize,
    imageUrl: p.imageUrl,
    bildAusschnitt: p.bildAusschnitt,
    category: p.category,
    subcategory: p.subcategory,
    verfuegbar: p.kaufbar,
  }
}

/** „nur 1 Angebot im Umkreis" — bei einem Hof gibt es keinen Streifen (ein Punkt allein wäre kein Vergleich). */
export const NUR_EIN_ANGEBOT = 'nur 1 Angebot im Umkreis'

const KLASSEN_REIHENFOLGE: Array<Gebindeklasse | null> = ['KLEIN', 'GROSS', null]

function bauePreis(werteUnsortiert: readonly number[], deine: readonly number[], anzeige: PreisAnzeige): Omit<UmfeldPreis, 'klasse'> {
  const werte = [...werteUnsortiert].sort((a, b) => a - b)
  const kleinst = werte[0]
  const hoechst = werte[werte.length - 1]
  // Der Streifen erst ab zwei Höfen mit verschiedenen Werten: Zeigen alle
  // denselben Betrag, wiederholte „Mitte € 1,20" nur die Zahl davor.
  const mitte = werte.length >= 2 && kleinst !== hoechst ? median(werte) : null
  const einDeins = deine.length === 1 ? deine[0] : null
  const lage = mitte !== null && einDeins !== null ? preisLage(einDeins, { kleinst, hoechst, mitte }) : null
  const deinsText =
    deine.length === 0 ? null : spanneText(Math.min(...deine), Math.max(...deine), anzeige)
  const streifen: PreisStreifenDaten | null =
    mitte === null
      ? null
      : {
          werte,
          kleinst,
          hoechst,
          mitte,
          deins: einDeins,
          kleinstText: betragText(kleinst, anzeige),
          hoechstText: betragText(hoechst, anzeige),
          satz:
            `${mitAnzahl(werte.length, 'Hof', 'Höfe')} von ${betragText(kleinst, anzeige)} bis ${betragText(hoechst, anzeige)} / ${anzeige.label}, ` +
            `Mitte ${betragText(mitte, anzeige)}` +
            (einDeins !== null && lage !== null ? `; deiner ${betragText(einDeins, anzeige)}, ${PREIS_LAGE_TEXT[lage]}` : ''),
        }
  return {
    spanne: werte.length > 0 ? spanneText(kleinst, hoechst, anzeige) : null,
    mitte: mitte === null ? null : `Mitte ${betragText(mitte, anzeige)}`,
    zusatz: werte.length === 1 ? NUR_EIN_ANGEBOT : null,
    anzahlHoefe: werte.length,
    deins: deinsText === null ? null : lage === null ? `Deins ${deinsText}` : `Deins ${deinsText} · ${PREIS_LAGE_TEXT[lage]}`,
    lage,
    streifen,
  }
}

function baueZeile(schluessel: ZeilenSchluessel, eingabe: UmfeldEingabe): UmfeldZeile {
  const { bereich } = eingabe
  const anzeige = preisAnzeigeVon(schluessel.l1, schluessel.l2)
  const gehoertHierher = (p: UmfeldProdukt) =>
    anzeigeBereichVon(p.category) === bereich && schluesselText(zeileVon(p)) === schluesselText(schluessel)

  const werteJeKlasse = new Map<Gebindeklasse | null, number[]>()
  const hoefe: UmfeldHofEintrag[] = []
  const gruende = new Set<string>()
  for (const hof of eingabe.hoefe) {
    const produkte = hof.produkte.filter(gehoertHierher)
    if (produkte.length === 0) continue
    // Je Hof und Klasse EIN Wert: sein günstigster; bei Gleichstand das vordere Produkt der Hofseite.
    const zaehlt = new Map<Gebindeklasse | null, { produkt: UmfeldProdukt; wert: number }>()
    for (const produkt of produkte) {
      const { wert, klasse, grund } = bewerteProdukt(produkt, bereich, anzeige)
      if (wert === null) {
        if (grund) gruende.add(grund)
        continue
      }
      const bisher = zaehlt.get(klasse)
      if (bisher === undefined || wert < bisher.wert) zaehlt.set(klasse, { produkt, wert })
    }
    for (const [klasse, { wert }] of zaehlt) werteJeKlasse.set(klasse, [...(werteJeKlasse.get(klasse) ?? []), wert])
    const zaehlende = new Set([...zaehlt.values()].map((z) => z.produkt))
    // Gezeigt in der Reihenfolge der Hofseite, nie nach Preis (N23).
    const gezeigt = zaehlende.size > 0 ? produkte.filter((p) => zaehlende.has(p)) : produkte.slice(0, 1)
    hoefe.push({
      slug: hof.slug,
      name: hof.name,
      postalCode: hof.postalCode,
      city: hof.city,
      entfernungKm: hof.entfernungKm,
      foto: hof.fotos[0] ?? null,
      illustration: hofIllustrationen(hof.kategorien)[0],
      link: hofseitenLink(hof.slug, bereich),
      produkte: gezeigt.map(alsVorschau),
    })
  }

  const eigene = eingabe.eigeneProdukte.filter(gehoertHierher)
  const deineJeKlasse = new Map<Gebindeklasse | null, number[]>()
  for (const p of eigene) {
    const b = bewerteProdukt(p, bereich, anzeige)
    if (b.wert !== null) deineJeKlasse.set(b.klasse, [...(deineJeKlasse.get(b.klasse) ?? []), b.wert])
  }

  const klassen = KLASSEN_REIHENFOLGE.filter((k) => werteJeKlasse.has(k) || deineJeKlasse.has(k))
  const preise: UmfeldPreis[] = klassen.map((klasse) => ({
    klasse: klassen.length >= 2 && klasse !== null ? KLASSEN_LABEL[klasse] : null,
    ...bauePreis(werteJeKlasse.get(klasse) ?? [], deineJeKlasse.get(klasse) ?? [], anzeige),
  }))

  const [einziger] = [...gruende]
  return {
    schluessel: schluesselText(schluessel),
    titel: schluessel.l2 ? UNTERKATEGORIE_LABEL[schluessel.l2] : KATEGORIE_LABEL[schluessel.l1],
    anzahlHoefe: hoefe.length,
    anzahlText: mitAnzahl(hoefe.length, 'Hof', 'Höfe'),
    eigenesProdukt: eigene.length > 0,
    preise,
    hinweis: werteJeKlasse.size > 0 ? null : gruende.size === 1 && einziger ? einziger : NICHT_VERGLEICHBAR_TEXT.GEMISCHT,
    hoefe,
  }
}

export type UmfeldEingabe = {
  bereich: AnzeigeBereich
  /** Der gewählte Umkreis — die Query liefert Höfe bis 50 km, gezählt wird bis hierher. */
  km: UmfeldKm
  /** Deine Produkte mit „Im Shop" — auch bei Vorrat 0, dein Preis gilt ja. */
  eigeneProdukte: readonly UmfeldProdukt[]
  /** Fremde Höfe bis 50 km, nach Entfernung, nur kaufbare Produkte. */
  hoefe: readonly UmfeldHof[]
  /** Dein Slug — dein Hof ist nie ein fremder Hof, auch nicht auf der Karte. */
  eigenerSlug: string
}

/**
 * Die Zeilen des Umfelds: je Unterkategorie (ohne L2 je Kategorie) eine, nur
 * im gewählten Bereich und nur, wo mindestens ein fremder Hof anbietet.
 * Zeilen mit eigenem Produkt zuerst, dann nach Anzahl Höfe, dann in
 * Taxonomie-Reihenfolge — nie nach Preis (N23).
 */
export function baueUmfeldZeilen(eingabe: UmfeldEingabe): UmfeldZeile[] {
  // Dieselbe Menge wie die Pins der Karte — eine Regel, zwei Ansichten.
  const fremde = { ...eingabe, hoefe: gezaehlteHoefe(eingabe) }
  const schluessel = new Map<string, ZeilenSchluessel>()
  for (const hof of fremde.hoefe) {
    for (const p of hof.produkte) {
      if (anzeigeBereichVon(p.category) !== eingabe.bereich) continue
      const z = zeileVon(p)
      schluessel.set(schluesselText(z), z)
    }
  }
  return [...schluessel.values()]
    .map((z) => ({ zeile: baueZeile(z, fremde), rang: taxonomieRang(z, eingabe.bereich) }))
    .sort(
      (a, b) =>
        Number(b.zeile.eigenesProdukt) - Number(a.zeile.eigenesProdukt) ||
        b.zeile.anzahlHoefe - a.zeile.anzahlHoefe ||
        a.rang - b.rang
    )
    .map(({ zeile }) => zeile)
}

/**
 * Die Höfe, die das Umfeld zählt: fremd (nie der eigene, auch wenn er
 * übergeben wird), im gewählten Umkreis und mit mindestens einem Produkt im
 * gewählten Bereich. Die Query liefert ohnehin nur sichtbare, nicht
 * pausierte Höfe mit kaufbarem Angebot. Liste, Karte und die Zahl je Stufe
 * fragen alle hier — sonst zählte eine Ansicht andere Höfe als die andere.
 */
export function gezaehlteHoefe(eingabe: Pick<UmfeldEingabe, 'bereich' | 'km' | 'hoefe' | 'eigenerSlug'>): UmfeldHof[] {
  return eingabe.hoefe.filter(
    (h) =>
      h.slug !== eingabe.eigenerSlug &&
      h.entfernungKm <= eingabe.km &&
      h.produkte.some((p) => anzeigeBereichVon(p.category) === eingabe.bereich)
  )
}

/** Wie viele Höfe die Liste bei jeder Stufe des Umkreises zählen würde (KmWahl mit Zahl, N23). */
export function zahlenJeStufe(eingabe: Pick<UmfeldEingabe, 'bereich' | 'hoefe' | 'eigenerSlug'>): Record<UmfeldKm, number> {
  return zaehleJeStufe(gezaehlteHoefe({ ...eingabe, km: UMFELD_GROESSTER_KM }).map((h) => h.entfernungKm))
}

// ─── Karte ──────────────────────────────────────────────────────────────────

/**
 * Ein Pin der Umfeld-Karte — ein Hof, den die Liste gerade zählt, mit dem,
 * was die Karte am Pin zeigt (HofKurzkarte „region"). Kein Preistext: Die
 * Produktzeilen formatieren ihren Preis erst in der Ansicht, an den Pins
 * selbst steht nur der Name (N23).
 */
export type UmfeldPin = {
  slug: string
  name: string
  /** 1 = der nächste; nach Entfernung wie die Höfe in den Zeilen. */
  nummer: number
  lat: number
  lon: number
  postalCode: string
  city: string
  entfernungKm: number
  fotos: string[]
  kategorien: ProductCategoryValue[]
  /** Die ersten zwei kaufbaren Produkte des Bereichs in der Reihenfolge der Hofseite. */
  produkte: VorschauProdukt[]
}

export type UmfeldKarte = {
  /** Dein Hof: Mittelpunkt, eigener Pin, der Umkreis als Kreis. */
  zentrum: { lat: number; lon: number; radiusKm: UmfeldKm }
  /** Für „Zum Hof" — der Link trägt den Bereich (hofseitenLink in der HofKurzkarte). */
  bereich: AnzeigeBereich
  pins: UmfeldPin[]
}

/**
 * Pins und Mittelpunkt der Karte — die Pins sind genau die gezählten Höfe.
 * Die Karte am Pin wählt ihre Produkte wie die Pin-Vorschau auf /hoefe
 * (waehleVorschauImBereich, ohne Filter und Suche): nur kaufbare, die ersten
 * zwei in der Reihenfolge der Hofseite.
 */
export function baueUmfeldKarte(eingabe: UmfeldEingabe & { eigenerStandort: { lat: number; lon: number } }): UmfeldKarte {
  return {
    zentrum: { ...eingabe.eigenerStandort, radiusKm: eingabe.km },
    bereich: eingabe.bereich,
    pins: gezaehlteHoefe(eingabe)
      .slice()
      .sort((a, b) => a.entfernungKm - b.entfernungKm)
      .map((hof, i) => {
        const kaufbar = hof.produkte.filter((p) => p.kaufbar).map(alsVorschau)
        const jeBereich = {
          LEBENSMITTEL: kaufbar.filter((p) => anzeigeBereichVon(p.category) === 'LEBENSMITTEL').length,
          FUTTERMITTEL: kaufbar.filter((p) => anzeigeBereichVon(p.category) === 'FUTTERMITTEL').length,
        }
        return {
          slug: hof.slug,
          name: hof.name,
          nummer: i + 1,
          lat: hof.lat,
          lon: hof.lon,
          postalCode: hof.postalCode,
          city: hof.city,
          entfernungKm: hof.entfernungKm,
          fotos: hof.fotos,
          kategorien: hof.kategorien,
          produkte: waehleVorschauImBereich({ produkte: kaufbar, produkteJeBereich: jeBereich }, eingabe.bereich, [], PIN_PRODUKTE, []).produkte,
        }
      }),
  }
}

// ─── Kopf, Hinweise, Leere ──────────────────────────────────────────────────

/**
 * Die Texte von „Preise vergleichen" an EINER Stelle (Board v3 §4). „So
 * rechnen wir" steht wie im Board — außer „oder Stück": Eier je Stück ist
 * zurückgestellt bis zum Pilot (Register N23, Änderung 21.10.2026), der Satz
 * sagte sonst etwas, das nicht stimmt.
 */
export const UMFELD_TEXT = {
  hinweis: 'Höfe in deinem Umkreis, die gerade verkaufen.',
  soRechnenWirTitel: 'So rechnen wir',
  soRechnenWir: [
    'Luftlinie ab deinem Hof, im Umkreis, den du oben wählst.',
    'Nur Höfe, die gerade verkaufen. Pausierte Höfe und Höfe ohne Standort zählen nicht.',
    'Je Hof zählt sein günstigstes Angebot einer Sorte – ein Hof mit drei Heusorten zählt einmal.',
    'Verglichen wird der Preis je Kilo oder Liter. Die Mitte ist der mittlere Wert, nicht der Durchschnitt.',
    `Alles steht auch auf den Hofseiten. ${MARKE} empfiehlt keine Preise.`,
  ],
  zahlLabel: 'Umkreis, Zahl der Höfe je Stufe',
  kaufen: 'Kaufen geht über die Hofseite.',
} as const

/** Der Bereich mit den meisten eigenen Produkten; bei Gleichstand der Hofladen. */
export function standardBereich(eigene: readonly { category: ProductCategoryValue | null }[]): AnzeigeBereich {
  const futter = eigene.filter((p) => anzeigeBereichVon(p.category) === 'FUTTERMITTEL').length
  return futter > eigene.length - futter ? 'FUTTERMITTEL' : 'LEBENSMITTEL'
}

/** Wie viele Höfe im Bereich etwas anbieten — für die Zeile „ohne Standort". */
export function hoefeMitAngebotIm(
  hoefe: readonly { produkte: readonly { category: ProductCategoryValue | null }[] }[],
  bereich: AnzeigeBereich
): number {
  return hoefe.filter((h) => h.produkte.some((p) => anzeigeBereichVon(p.category) === bereich)).length
}

export type UmfeldAnsicht = {
  zeilen: UmfeldZeile[]
  /** Je Stufe die Zahl der Höfe, die die Liste dort zählen würde. */
  zahlen: Record<UmfeldKm, number>
  /** Ruhige Zeilen über der Liste: ohne Standort, abgeschnitten. */
  hinweise: string[]
  /** Satz statt eines leeren Rasters; null, wenn es Zeilen gibt. */
  leer: string | null
  /** Vorschlag bei leerem Ergebnis: dieser Umkreis; null, wenn schon der größte gewählt ist. */
  weiterUmkreis: UmfeldKm | null
}

/** Alles, was der Reiter zeigt — die Komponente rendert nur noch. */
export function baueUmfeld(
  eingabe: UmfeldEingabe & {
    /** Sichtbare Höfe ohne Standort, mit ihren kaufbaren Produkten. */
    ohneStandort: readonly { produkte: readonly { category: ProductCategoryValue | null }[] }[]
    /** Ab dieser Entfernung fehlen Höfe wegen des Deckels; null, wenn keiner fehlt. */
    abgeschnittenAbKm: number | null
  }
): UmfeldAnsicht {
  const zeilen = baueUmfeldZeilen(eingabe)
  const hinweise: string[] = []
  const ohneStandort = hoefeMitAngebotIm(eingabe.ohneStandort, eingabe.bereich)
  if (ohneStandort > 0) hinweise.push(ohneStandortHinweis(ohneStandort))
  // Innerhalb dieser Entfernung ist jeder Hof geladen — erst ein Umkreis,
  // der darüber reicht, kann Höfe verlieren.
  if (eingabe.abgeschnittenAbKm !== null && eingabe.abgeschnittenAbKm <= eingabe.km) {
    // Gedeckelt wird über alle sichtbaren Höfe im Umkreis, bevor feststeht, wer
    // gerade etwas Kaufbares hat — der Satz sagt deshalb „berücksichtigt".
    hinweise.push(`Mehr als ${UMFELD_HOEFE_DECKEL} Höfe im Umkreis — berücksichtigt sind die ${UMFELD_HOEFE_DECKEL} nächsten.`)
  }
  const was = eingabe.bereich === 'FUTTERMITTEL' ? 'Futtermittel' : 'etwas aus dem Hofladen'
  return {
    zeilen,
    zahlen: zahlenJeStufe(eingabe),
    hinweise,
    leer: zeilen.length === 0 ? `Im Umkreis von ${eingabe.km} km bietet gerade niemand ${was} an.` : null,
    weiterUmkreis: zeilen.length === 0 && eingabe.km !== UMFELD_GROESSTER_KM ? UMFELD_GROESSTER_KM : null,
  }
}
