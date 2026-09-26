/**
 * Umfeld — was andere Höfe in der Nähe anbieten (docs/konzepte/umfeld.md).
 *
 * Rein, ohne Datenbank und ohne Browser prüfbar (tests/umfeld.test.ts). Die
 * Query (src/server/queries/umfeld.ts) beschafft die öffentlichen Daten, hier
 * wird entschieden:
 *   - welcher Ausschnitt der Karte als Vorfilter dient (Bounding-Box) und
 *     welche Höfe wirklich im Umkreis liegen (exakte Entfernung),
 *   - wie Produkte zu Zeilen werden (je Unterkategorie, ohne sie je
 *     Kategorie), was ihr vergleichbarer Grundpreis ist und in welcher
 *     Einheit er gezeigt wird,
 *   - Spanne, Mitte und „Deins" — über EINEN Wert je Hof und Gebindeklasse,
 *     seinen günstigsten: „wo liegt das günstigste Angebot jedes Nachbarn".
 *
 * Was hier bewusst NICHT entschieden wird: die Sichtbarkeit fremder Höfe. Die
 * steht in der WHERE-Klausel der Query (OEFFENTLICH_SICHTBAR plus nicht
 * pausiert) — dieselbe Regel wie /hoefe, keine zweite.
 */
import { hofseitenLink } from '@/lib/bereiche-anzeige'
import { einheitLabel, formatEuro, formatPreisSpanne, grundpreisJeKg, mitAnzahl } from '@/lib/format'
import { ERDRADIUS_KM, entfernungKm, formatiereEntfernung } from '@/lib/hofuebersicht'
import {
  ANZEIGE_BEREICHE,
  KATEGORIE_LABEL,
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
import { LEERER_HOEFE_FILTER, UM_KM_VALUES, schreibeHoefeFilter, type UmKm } from '@/schemas/hoefe-filter'

// ─── Umkreis ────────────────────────────────────────────────────────────────

/** Die Stufen des Umfelds — dieselben wie der Umkreis-Regler auf /hoefe. */
export const UMFELD_KM = UM_KM_VALUES
export type UmfeldKm = UmKm

/** Mehr Höfe zeigt das Umfeld nicht — die nächsten gewinnen, mit Hinweis. */
export const UMFELD_HOEFE_DECKEL = 200

/** Ab so vielen Höfen klappt eine Zeile die übrigen hinter „n weitere Höfe". */
export const UMFELD_HOEFE_SICHTBAR = 3

/**
 * Ein Prozent Polster: Die Box ist nur der Vorfilter, der den Index nutzt.
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
 *     gezählt („ohne Standort nicht berücksichtigt"), nie platziert. Anders als
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

/** Ein Produkt, so schmal, wie das Umfeld es braucht. Fremde Produkte sind schon kaufbar (Query). */
export type UmfeldProdukt = {
  name: string
  category: ProductCategoryValue | null
  subcategory: ProductSubcategoryValue | null
  /** Preis je Gebinde in Euro — nur Anzeige und Vergleich, nie Abrechnung. */
  price: number
  unit: string
  unitSize: number | null
  /** Aus der Futter-Kennzeichnung; null ohne. */
  nettoMenge: number | null
  nettoEinheit: NettoEinheitValue | null
}

/** Ein fremder Hof im Umkreis. Keine Kontaktdaten — nur, was die Hofübersicht auch zeigt. */
export type UmfeldHof = {
  slug: string
  name: string
  ort: string
  entfernungKm: number
  produkte: UmfeldProdukt[]
}

export type Gebindeklasse = 'KLEIN' | 'GROSS'

const KLASSEN_LABEL: Record<Gebindeklasse, string> = { KLEIN: 'Kleingebinde', GROSS: 'Großgebinde' }

/**
 * Der Grundpreis eines Produkts in der Anzeigeeinheit seiner Zeile (€/t,
 * €/dt, €/kg, €/L) und seine Gebindeklasse.
 *
 *   - Im Bereich Futtermittel zählt nur die Kennzeichnung: ohne Nettomenge
 *     kein Kilopreis und keine Klasse (auf /hoefe genauso).
 *   - Passt die Einheit nicht zur Zeile — ein Liter-Produkt in einer
 *     €/dt-Zeile —, ist es nicht vergleichbar. Kein Liter-gleich-Kilo in
 *     Preisvergleichen.
 *   - Klassen gibt es nur im Futter; im Hofladen fehlt die Nettomenge.
 */
export function bewerteProdukt(
  p: UmfeldProdukt,
  bereich: AnzeigeBereich,
  anzeige: PreisAnzeige
): { wert: number | null; klasse: Gebindeklasse | null } {
  if (bereich === 'FUTTERMITTEL') {
    const { nettoMenge, nettoEinheit } = p
    if (nettoMenge == null || nettoEinheit == null) return { wert: null, klasse: null }
    const grundpreis = grundpreisJeKg(p.price, p.unit, p.unitSize, nettoMenge, nettoEinheit)
    return {
      wert: grundpreis && grundpreis.einheit === anzeige.basis ? grundpreis.wert * anzeige.faktor : null,
      klasse: istGrossgebinde(nettoMenge, nettoEinheit) ? 'GROSS' : 'KLEIN',
    }
  }
  const grundpreis = grundpreisJeKg(p.price, p.unit, p.unitSize, null, null)
  return {
    wert: grundpreis && grundpreis.einheit === anzeige.basis ? grundpreis.wert * anzeige.faktor : null,
    klasse: null,
  }
}

/** Der Median — bei gerader Anzahl die Mitte der beiden mittleren Werte; leer → null. */
export function median(werte: readonly number[]): number | null {
  if (werte.length === 0) return null
  const sortiert = [...werte].sort((a, b) => a - b)
  const mitte = Math.floor(sortiert.length / 2)
  return sortiert.length % 2 === 1 ? sortiert[mitte] : (sortiert[mitte - 1] + sortiert[mitte]) / 2
}

// ─── Zeilen ─────────────────────────────────────────────────────────────────

/** Eine Spanne der Zeile — eine je Gebindeklasse, im Hofladen genau eine. */
export type UmfeldPreis = {
  /** „Kleingebinde"/„Großgebinde" nur, wenn die Zeile beide zeigt. */
  klasse: string | null
  /** „€ 120 – 180 / t" bzw. „€ 150 / t" bei einem Hof; null, wenn nur du hier anbietest. */
  spanne: string | null
  /** „Mitte € 150" — erst ab zwei Höfen. */
  mitte: string | null
  /** Wie viele Höfe diese Spanne tragen. */
  anzahlHoefe: number
  /** Dein Grundpreis in derselben Einheit; null ohne eigenes vergleichbares Produkt. */
  deins: string | null
}

export type UmfeldHofEintrag = {
  slug: string
  name: string
  ort: string
  entfernung: string
  link: string
  produkte: Array<{ name: string; preis: string }>
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
  /** „Preis je Stück, nicht vergleichbar" — wenn kein fremdes Produkt vergleichbar ist. */
  hinweis: string | null
  /** Nach Entfernung; die ersten UMFELD_HOEFE_SICHTBAR stehen gleich da. */
  hoefe: UmfeldHofEintrag[]
  /** null, wenn dein Hof nicht auf /hoefe steht — ein Link, der nichts bewirkt, fehlt lieber. */
  kartenLink: string | null
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

function preisText(wert: number, anzeige: PreisAnzeige): string {
  return formatPreisSpanne(wert, wert, anzeige.label, anzeige.stellen)
}

/** Einheiten, aus denen grundpreisJeKg einen Kilo- oder Literpreis rechnet. */
const KILO_LITER_EINHEITEN = new Set(['KG', 'G', 'LITER', 'ML'])

/**
 * Ohne vergleichbares Angebot: „Preis je Stück" (Paket, m³ …), wenn alle in
 * derselben solchen Einheit verkaufen — sonst schlicht nicht vergleichbar
 * (gemischte Einheiten, oder Kilo und Liter in der falschen Zeile).
 */
function nichtVergleichbarText(produkte: readonly UmfeldProdukt[]): string {
  const einheiten = new Set(produkte.map((p) => p.unit))
  const [einheit] = [...einheiten]
  if (einheiten.size === 1 && einheit && !KILO_LITER_EINHEITEN.has(einheit)) {
    return `Preis je ${einheitLabel(einheit)}, nicht vergleichbar`
  }
  return 'Preise nicht vergleichbar'
}

const KLASSEN_REIHENFOLGE: Array<Gebindeklasse | null> = ['KLEIN', 'GROSS', null]

function baueZeile(
  schluessel: ZeilenSchluessel,
  eingabe: UmfeldEingabe
): UmfeldZeile {
  const { bereich } = eingabe
  const anzeige = preisAnzeigeVon(schluessel.l1, schluessel.l2)
  const gehoertHierher = (p: UmfeldProdukt) =>
    anzeigeBereichVon(p.category) === bereich && schluesselText(zeileVon(p)) === schluesselText(schluessel)

  // Je Hof und Klasse EIN Wert: sein günstigster.
  const werteJeKlasse = new Map<Gebindeklasse | null, number[]>()
  const hoefe: UmfeldHofEintrag[] = []
  const fremdeProdukte: UmfeldProdukt[] = []
  for (const hof of eingabe.hoefe) {
    const produkte = hof.produkte.filter(gehoertHierher)
    if (produkte.length === 0) continue
    fremdeProdukte.push(...produkte)
    const bewertet = produkte
      .map((p) => ({ p, ...bewerteProdukt(p, bereich, anzeige) }))
      .sort((a, b) => (a.wert ?? Infinity) - (b.wert ?? Infinity))
    const guenstigster = new Map<Gebindeklasse | null, number>()
    for (const b of bewertet) {
      if (b.wert === null) continue
      const bisher = guenstigster.get(b.klasse)
      if (bisher === undefined || b.wert < bisher) guenstigster.set(b.klasse, b.wert)
    }
    for (const [klasse, wert] of guenstigster) werteJeKlasse.set(klasse, [...(werteJeKlasse.get(klasse) ?? []), wert])
    hoefe.push({
      slug: hof.slug,
      name: hof.name,
      ort: hof.ort,
      entfernung: formatiereEntfernung(hof.entfernungKm),
      link: hofseitenLink(hof.slug, bereich),
      produkte: bewertet.map((b) => ({
        name: b.p.name,
        preis: b.wert === null ? 'nicht vergleichbar' : preisText(b.wert, anzeige),
      })),
    })
  }

  const eigene = eingabe.eigeneProdukte.filter(gehoertHierher)
  const deineJeKlasse = new Map<Gebindeklasse | null, number[]>()
  for (const p of eigene) {
    const b = bewerteProdukt(p, bereich, anzeige)
    if (b.wert !== null) deineJeKlasse.set(b.klasse, [...(deineJeKlasse.get(b.klasse) ?? []), b.wert])
  }

  const klassen = KLASSEN_REIHENFOLGE.filter((k) => werteJeKlasse.has(k) || deineJeKlasse.has(k))
  const preise: UmfeldPreis[] = klassen.map((klasse) => {
    const werte = werteJeKlasse.get(klasse) ?? []
    const deine = deineJeKlasse.get(klasse) ?? []
    // Die Mitte nur, wenn es eine Spanne gibt: Zeigen alle Höfe denselben
    // Betrag, wiederholte „Mitte € 1,20" nur die Zahl davor.
    const echteSpanne =
      werte.length >= 2 &&
      formatEuro(Math.min(...werte), anzeige.stellen) !== formatEuro(Math.max(...werte), anzeige.stellen)
    const mitte = echteSpanne ? median(werte) : null
    return {
      klasse: klassen.length >= 2 && klasse !== null ? KLASSEN_LABEL[klasse] : null,
      spanne:
        werte.length > 0 ? formatPreisSpanne(Math.min(...werte), Math.max(...werte), anzeige.label, anzeige.stellen) : null,
      mitte: mitte === null ? null : `Mitte ${formatEuro(mitte, anzeige.stellen)}`,
      anzahlHoefe: werte.length,
      deins:
        deine.length > 0 ? formatPreisSpanne(Math.min(...deine), Math.max(...deine), anzeige.label, anzeige.stellen) : null,
    }
  })

  const kartenLink =
    eingabe.eigenerSlug === null
      ? null
      : `/hoefe?${schreibeHoefeFilter({
          ...LEERER_HOEFE_FILTER,
          bereich,
          // kat= immer mit: Ohne gewählte Kategorie verwirft /hoefe die Sorte.
          kategorien: [schluessel.l1],
          sorten: schluessel.l2 ? [schluessel.l2] : [],
          ansicht: 'karte',
          um: eingabe.eigenerSlug,
          km: eingabe.km,
        })}`

  return {
    schluessel: schluesselText(schluessel),
    titel: schluessel.l2 ? UNTERKATEGORIE_LABEL[schluessel.l2] : KATEGORIE_LABEL[schluessel.l1],
    anzahlHoefe: hoefe.length,
    anzahlText: mitAnzahl(hoefe.length, 'Hof', 'Höfe'),
    eigenesProdukt: eigene.length > 0,
    preise,
    hinweis: werteJeKlasse.size === 0 ? nichtVergleichbarText(fremdeProdukte) : null,
    hoefe,
    kartenLink,
  }
}

export type UmfeldEingabe = {
  bereich: AnzeigeBereich
  km: UmfeldKm
  /** Deine Produkte mit „Im Shop" — auch bei Bestand 0, dein Preis gilt ja. */
  eigeneProdukte: readonly UmfeldProdukt[]
  /** Fremde Höfe im Umkreis, nach Entfernung, nur kaufbare Produkte. */
  hoefe: readonly UmfeldHof[]
  /** Dein Slug, wenn dein Hof auf /hoefe steht — sonst null (kein Kartenlink). */
  eigenerSlug: string | null
}

/**
 * Die Zeilen des Umfelds: je Unterkategorie (ohne L2 je Kategorie) eine, nur
 * im gewählten Bereich und nur, wo mindestens ein fremder Hof anbietet.
 * Zeilen mit eigenem Produkt zuerst, dann nach Anzahl Höfe, dann in
 * Taxonomie-Reihenfolge.
 */
export function baueUmfeldZeilen(eingabe: UmfeldEingabe): UmfeldZeile[] {
  const schluessel = new Map<string, ZeilenSchluessel>()
  for (const hof of eingabe.hoefe) {
    for (const p of hof.produkte) {
      if (anzeigeBereichVon(p.category) !== eingabe.bereich) continue
      const z = zeileVon(p)
      schluessel.set(schluesselText(z), z)
    }
  }
  return [...schluessel.values()]
    .map((z) => ({ zeile: baueZeile(z, eingabe), rang: taxonomieRang(z, eingabe.bereich) }))
    .sort(
      (a, b) =>
        Number(b.zeile.eigenesProdukt) - Number(a.zeile.eigenesProdukt) ||
        b.zeile.anzahlHoefe - a.zeile.anzahlHoefe ||
        a.rang - b.rang
    )
    .map(({ zeile }) => zeile)
}

// ─── Kopf, Hinweise, Leere ──────────────────────────────────────────────────

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
    abgeschnitten: boolean
  }
): UmfeldAnsicht {
  const zeilen = baueUmfeldZeilen(eingabe)
  const hinweise: string[] = []
  const ohneStandort = hoefeMitAngebotIm(eingabe.ohneStandort, eingabe.bereich)
  if (ohneStandort > 0) hinweise.push(`${mitAnzahl(ohneStandort, 'Hof', 'Höfe')} ohne Standort nicht berücksichtigt.`)
  if (eingabe.abgeschnitten) {
    hinweise.push(`Mehr als ${UMFELD_HOEFE_DECKEL} Höfe im Umkreis — gezeigt werden die ${UMFELD_HOEFE_DECKEL} nächsten.`)
  }
  const was = eingabe.bereich === 'FUTTERMITTEL' ? 'Futtermittel' : 'etwas aus dem Hofladen'
  const groesster = UMFELD_KM[UMFELD_KM.length - 1]
  return {
    zeilen,
    hinweise,
    leer: zeilen.length === 0 ? `Im Umkreis von ${eingabe.km} km bietet gerade niemand ${was} an.` : null,
    weiterUmkreis: zeilen.length === 0 && eingabe.km !== groesster ? groesster : null,
  }
}
