/**
 * Tests für das Umfeld (src/lib/umfeld.ts, docs/konzepte/umfeld.md) — rein,
 * ohne Datenbank.
 *
 * Geprüft wird, was der Hof liest: welche Höfe im Umkreis zählen (Box als
 * Vorfilter, exakte Entfernung als Urteil), wie Produkte zu Zeilen werden, in
 * welcher Einheit ihr Grundpreis steht, und dass Spanne, Mitte und „Deins" aus
 * EINEM Wert je Hof und Gebindeklasse kommen.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  UMFELD_HOEFE_DECKEL,
  UMFELD_KM,
  NICHT_VERGLEICHBAR_TEXT,
  baueUmfeldKarte,
  gezaehlteHoefe,
  baueUmfeld,
  baueUmfeldZeilen,
  bewerteProdukt,
  median,
  standardBereich,
  umkreisBox,
  waehleHoefeImUmkreis,
  type UmfeldEingabe,
  type UmfeldHof,
  type UmfeldProdukt,
} from '@/lib/umfeld'
import { ERDRADIUS_KM, UMKREIS_STUFEN, entfernungKm } from '@/lib/hofuebersicht'
import { EIGENER_PIN, hofIllustrationen, pinDarstellung } from '@/lib/hoefe-anzeige'
import { hofseitenLink } from '@/lib/bereiche-anzeige'
import { preisAnzeigeVon } from '@/lib/taxonomie'
import { leseUmfeldAnsicht, leseUmfeldFilter, umfeldLink } from '@/schemas/umfeld-filter'
import { bereichAusParameter } from '@/schemas/hoefe-filter'

// ─── Hilfen ─────────────────────────────────────────────────────────────────

const BRAUNAU = { lat: 48.2563, lon: 13.0434 }

/** Der Punkt, den man nach `km` in Richtung `peilung` (Grad, Nord = 0) erreicht. */
function punktIn(start: { lat: number; lon: number }, km: number, peilung: number) {
  const bogen = (g: number) => (g * Math.PI) / 180
  const grad = (b: number) => (b * 180) / Math.PI
  const r = km / ERDRADIUS_KM
  const phi1 = bogen(start.lat)
  const theta = bogen(peilung)
  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(r) + Math.cos(phi1) * Math.sin(r) * Math.cos(theta))
  const lambda2 =
    bogen(start.lon) +
    Math.atan2(Math.sin(theta) * Math.sin(r) * Math.cos(phi1), Math.cos(r) - Math.sin(phi1) * Math.sin(phi2))
  return { lat: grad(phi2), lon: grad(lambda2) }
}

let produktNummer = 0
/** Ein Produkt mit Preis in Euro (`price`) — die Query liefert ganze Cent aus dem Decimal. */
function produkt(teil: Partial<UmfeldProdukt> & { price?: number }): UmfeldProdukt {
  const { price = 10, ...rest } = teil
  produktNummer += 1
  return {
    id: `prod-${produktNummer}`,
    name: 'Produkt',
    category: null,
    subcategory: null,
    preisCents: Math.round(price * 100),
    unit: 'KG',
    unitSize: null,
    nettoMenge: null,
    nettoEinheit: null,
    imageUrl: null,
    bildAusschnitt: null,
    kaufbar: true,
    ...rest,
  }
}

/** Wiesenheu-Ballen: Preis je Ballen, Gewicht aus der Kennzeichnung. */
const heu = (preis: number, kg: number, name = 'Heu') =>
  produkt({ name, category: 'HEU_STROH', subcategory: 'WIESENHEU', price: preis, unit: 'BALLEN', nettoMenge: kg, nettoEinheit: 'KG' })

// Nur für eindeutige Slugs innerhalb eines Tests — vor jedem Test auf null.
let hofNummer = 0
beforeEach(() => {
  hofNummer = 0
  produktNummer = 0
})
function hof(entfernungKm: number, produkte: UmfeldProdukt[], teil: Partial<UmfeldHof> = {}): UmfeldHof {
  hofNummer += 1
  return {
    slug: `hof-${hofNummer}`,
    name: `Hof ${hofNummer}`,
    postalCode: '1234',
    city: 'Testort',
    lat: 48.25,
    lon: 13.05,
    entfernungKm,
    fotos: [],
    kategorien: [],
    produkte,
    ...teil,
  }
}

const FUTTER: UmfeldEingabe = { bereich: 'FUTTERMITTEL', km: 25, eigeneProdukte: [], hoefe: [], eigenerSlug: 'hof-mueller' }
const HOFLADEN: UmfeldEingabe = { ...FUTTER, bereich: 'LEBENSMITTEL' }

// ─── Umkreis ────────────────────────────────────────────────────────────────

describe('umkreisBox — der Vorfilter für die WHERE-Klausel', () => {
  it('enthält jeden Punkt des Kreises, in jede Richtung', () => {
    for (const km of [10, 25, 50]) {
      const box = umkreisBox(BRAUNAU, km)
      for (let peilung = 0; peilung < 360; peilung += 1) {
        const p = punktIn(BRAUNAU, km, peilung)
        expect(p.lat, `${km} km, ${peilung}°`).toBeGreaterThanOrEqual(box.breiteVon)
        expect(p.lat).toBeLessThanOrEqual(box.breiteBis)
        expect(p.lon).toBeGreaterThanOrEqual(box.laengeVon)
        expect(p.lon).toBeLessThanOrEqual(box.laengeBis)
      }
    }
  })

  it('ist kaum größer als nötig — höchstens zwei Prozent Polster', () => {
    const box = umkreisBox(BRAUNAU, 25)
    const nord = punktIn(BRAUNAU, 25, 0)
    const ost = Math.max(...Array.from({ length: 180 }, (_, i) => punktIn(BRAUNAU, 25, i).lon))
    expect(box.breiteBis - BRAUNAU.lat).toBeLessThanOrEqual((nord.lat - BRAUNAU.lat) * 1.02)
    expect(box.laengeBis - BRAUNAU.lon).toBeLessThanOrEqual((ost - BRAUNAU.lon) * 1.02)
  })

  it('wird in der Länge breiter, je weiter nördlich der Hof liegt', () => {
    const sued = umkreisBox({ lat: 46.5, lon: 14 }, 25)
    const nord = umkreisBox({ lat: 60, lon: 14 }, 25)
    expect(nord.laengeBis - 14).toBeGreaterThan(sued.laengeBis - 14)
    expect(nord.breiteBis - 60).toBeCloseTo(sued.breiteBis - 46.5, 10)
  })

  it('umfasst am Pol jede Länge', () => {
    expect(umkreisBox({ lat: 89.99, lon: 0 }, 50)).toMatchObject({ laengeVon: -180, laengeBis: 180 })
  })
})

describe('waehleHoefeImUmkreis — die exakte Entfernung entscheidet', () => {
  const standort = (id: string, p: { lat: number; lon: number } | null) => ({
    id,
    latitude: p?.lat ?? null,
    longitude: p?.lon ?? null,
  })

  it('nimmt, was knapp innerhalb liegt, und lässt, was knapp außerhalb liegt', () => {
    const { nah } = waehleHoefeImUmkreis(
      BRAUNAU,
      [standort('drin', punktIn(BRAUNAU, 24.99, 90)), standort('draussen', punktIn(BRAUNAU, 25.01, 90))],
      25,
      'eigen'
    )
    expect(nah.map((h) => h.id)).toEqual(['drin'])
  })

  it('schneidet die Ecke der Box ab — dort ist es weiter als der Umkreis', () => {
    const box = umkreisBox(BRAUNAU, 25)
    const ecke = { lat: box.breiteBis * 0.999 + BRAUNAU.lat * 0.001, lon: box.laengeBis * 0.999 + BRAUNAU.lon * 0.001 }
    expect(entfernungKm(BRAUNAU, ecke)).toBeGreaterThan(25)
    expect(waehleHoefeImUmkreis(BRAUNAU, [standort('ecke', ecke)], 25, 'eigen').nah).toEqual([])
  })

  it('sortiert nach Entfernung und trägt sie mit', () => {
    const { nah } = waehleHoefeImUmkreis(
      BRAUNAU,
      [standort('weit', punktIn(BRAUNAU, 20, 0)), standort('nah', punktIn(BRAUNAU, 2, 180))],
      25,
      'eigen'
    )
    expect(nah.map((h) => h.id)).toEqual(['nah', 'weit'])
    expect(nah[0].entfernungKm).toBeCloseTo(2, 6)
  })

  it('zählt Höfe ohne brauchbare Koordinaten, statt sie zu platzieren', () => {
    const { nah, ohneStandort } = waehleHoefeImUmkreis(
      BRAUNAU,
      [standort('leer', null), { id: 'nan', latitude: Number.NaN, longitude: 13 }, { id: 'halb', latitude: 48, longitude: null }],
      50,
      'eigen'
    )
    expect(nah).toEqual([])
    expect(ohneStandort.map((h) => h.id)).toEqual(['leer', 'nan', 'halb'])
  })

  it('lässt den eigenen Hof weg, auch wenn er übergeben wird', () => {
    const { nah } = waehleHoefeImUmkreis(BRAUNAU, [standort('eigen', BRAUNAU), standort('nachbar', punktIn(BRAUNAU, 1, 0))], 10, 'eigen')
    expect(nah.map((h) => h.id)).toEqual(['nachbar'])
  })

  it('behält über dem Deckel die nächsten und meldet das', () => {
    const viele = Array.from({ length: UMFELD_HOEFE_DECKEL + 1 }, (_, i) =>
      standort(`h${i}`, punktIn(BRAUNAU, 1 + i * 0.1, 45))
    )
    const { nah, abgeschnitten } = waehleHoefeImUmkreis(BRAUNAU, [...viele].reverse(), 50, 'eigen')
    expect(nah).toHaveLength(UMFELD_HOEFE_DECKEL)
    expect(abgeschnitten).toBe(true)
    expect(nah[0].id).toBe('h0')
    expect(nah.map((h) => h.id)).not.toContain(`h${UMFELD_HOEFE_DECKEL}`)
    expect(waehleHoefeImUmkreis(BRAUNAU, viele.slice(0, UMFELD_HOEFE_DECKEL), 50, 'eigen').abgeschnitten).toBe(false)
  })
})

// ─── Grundpreis und Einheit ─────────────────────────────────────────────────

describe('bewerteProdukt — Grundpreis in der Einheit der Zeile', () => {
  it('Heu & Stroh je Tonne, mit Gebindeklasse', () => {
    expect(bewerteProdukt(heu(45, 300), 'FUTTERMITTEL', preisAnzeigeVon('HEU_STROH', 'WIESENHEU'))).toEqual({
      wert: 150,
      klasse: 'GROSS',
      grund: null,
    })
  })

  it('Getreide je Doppelzentner; der 25-kg-Sack ist Kleingebinde', () => {
    const hafer = produkt({ category: 'GETREIDE_KOERNER', subcategory: 'HAFER', price: 12, unit: 'KG', nettoMenge: 25, nettoEinheit: 'KG' })
    const wertung = bewerteProdukt(hafer, 'FUTTERMITTEL', preisAnzeigeVon('GETREIDE_KOERNER', 'HAFER'))
    expect(wertung.wert).toBeCloseTo(48)
    expect(wertung.klasse).toBe('KLEIN')
  })

  it('Hofladen je Kilo bzw. Liter in ganzen Cent, ohne Gebindeklasse', () => {
    const kaese = produkt({ category: 'MILCH', subcategory: 'KAESE', price: 18, unit: 'KG', unitSize: 1 })
    const milch = produkt({ category: 'MILCH', subcategory: 'TRINKMILCH', price: 1.4, unit: 'LITER', unitSize: 1 })
    const honig = produkt({ category: 'HONIG', subcategory: 'BLUETENHONIG', price: 8, unit: 'G', unitSize: 500 })
    expect(bewerteProdukt(kaese, 'LEBENSMITTEL', preisAnzeigeVon('MILCH', 'KAESE'))).toEqual({ wert: 1800, klasse: null, grund: null })
    expect(bewerteProdukt(milch, 'LEBENSMITTEL', preisAnzeigeVon('MILCH', 'TRINKMILCH'))).toEqual({ wert: 140, klasse: null, grund: null })
    expect(bewerteProdukt(honig, 'LEBENSMITTEL', preisAnzeigeVon('HONIG', 'BLUETENHONIG'))).toEqual({ wert: 1600, klasse: null, grund: null })
  })

  it('Liter in einer Kilo-Zeile sind nicht vergleichbar — kein Liter-gleich-Kilo', () => {
    const fluessig = produkt({ category: 'ERGAENZUNGSFUTTER', price: 30, unit: 'KG', nettoMenge: 20, nettoEinheit: 'LITER' })
    expect(bewerteProdukt(fluessig, 'FUTTERMITTEL', preisAnzeigeVon('ERGAENZUNGSFUTTER', null))).toMatchObject({ wert: null, grund: NICHT_VERGLEICHBAR_TEXT.LITER_KILO })
    const honigImGlasLiter = produkt({ category: 'HONIG', price: 8, unit: 'LITER', unitSize: 0.5 })
    expect(bewerteProdukt(honigImGlasLiter, 'LEBENSMITTEL', preisAnzeigeVon('HONIG', null))).toMatchObject({ wert: null, grund: NICHT_VERGLEICHBAR_TEXT.LITER_KILO })
  })

  it('im Futter zählt nur die Kennzeichnung — ohne Nettomenge kein Preis und keine Klasse', () => {
    const ohne = produkt({ category: 'GETREIDE_KOERNER', subcategory: 'MAIS', price: 0.3, unit: 'KG' })
    expect(bewerteProdukt(ohne, 'FUTTERMITTEL', preisAnzeigeVon('GETREIDE_KOERNER', 'MAIS'))).toMatchObject({ wert: null, klasse: null })
  })

  it('Stück, Paket und Raummeter sind nicht vergleichbar — mit Grund', () => {
    const anzeige = preisAnzeigeVon('BROT', null)
    expect(bewerteProdukt(produkt({ category: 'BROT', unit: 'STUECK' }), 'LEBENSMITTEL', anzeige)).toMatchObject({ wert: null, grund: NICHT_VERGLEICHBAR_TEXT.STUECK })
    expect(bewerteProdukt(produkt({ category: 'EIER', unit: 'PAKET', unitSize: 10 }), 'LEBENSMITTEL', anzeige)).toMatchObject({ wert: null, grund: NICHT_VERGLEICHBAR_TEXT.PAKET })
    expect(bewerteProdukt(produkt({ category: 'BRENNHOLZ', unit: 'M3', unitSize: 1 }), 'LEBENSMITTEL', anzeige)).toMatchObject({ wert: null, grund: 'Preis je m³, nicht vergleichbar' })
  })
})

describe('median', () => {
  it('ungerade: der mittlere Wert, unabhängig von der Reihenfolge', () => {
    expect(median([180, 120, 150])).toBe(150)
  })
  it('gerade: die Mitte der beiden mittleren', () => {
    expect(median([120, 140, 160, 900])).toBe(150)
  })
  it('ein Wert ist sein eigener Median, keiner ergibt null', () => {
    expect(median([42])).toBe(42)
    expect(median([])).toBeNull()
  })
})

// ─── Zeilen ─────────────────────────────────────────────────────────────────

describe('baueUmfeldZeilen — Gruppierung', () => {
  it('eine Zeile je Unterkategorie, ohne L2 je Kategorie, nur im gewählten Bereich', () => {
    const zeilen = baueUmfeldZeilen({
      ...FUTTER,
      hoefe: [
        hof(3, [heu(8, 20), produkt({ category: 'MISCHFUTTER', price: 15, nettoMenge: 25, nettoEinheit: 'KG' })]),
        hof(5, [produkt({ category: 'EIER', subcategory: 'EIER_FREILAND', unit: 'PAKET', unitSize: 10 })]),
      ],
    })
    expect(zeilen.map((z) => z.titel).sort()).toEqual(['Mischfutter', 'Wiesenheu'])
  })

  it('Produkte ohne Kategorie landen im Hofladen unter Sonstiges', () => {
    const zeilen = baueUmfeldZeilen({ ...HOFLADEN, hoefe: [hof(2, [produkt({ name: 'Kerzen', unit: 'STUECK' })])] })
    expect(zeilen.map((z) => z.titel)).toEqual(['Sonstiges'])
  })

  it('zählt Höfe, nicht Produkte', () => {
    const zeilen = baueUmfeldZeilen({ ...FUTTER, hoefe: [hof(1, [heu(8, 20), heu(9, 20), heu(45, 300)]), hof(2, [heu(7, 20)])] })
    expect(zeilen[0].anzahlHoefe).toBe(2)
    expect(zeilen[0].anzahlText).toBe('2 Höfe')
  })
})

describe('baueUmfeldZeilen — Spanne, Mitte, ein Wert je Hof', () => {
  it('Spanne von billig bis teuer, Mitte als Median, in der Einheit der Zeile', () => {
    // Kleinballen 20 kg: 8 € → 400 €/t, 7 € → 350 €/t, 9 € → 450 €/t
    const [zeile] = baueUmfeldZeilen({ ...FUTTER, hoefe: [hof(1, [heu(8, 20)]), hof(2, [heu(7, 20)]), hof(3, [heu(9, 20)])] })
    expect(zeile.preise).toMatchObject([
      { klasse: null, spanne: '€ 350 – 450 / t', mitte: 'Mitte € 400', zusatz: null, anzahlHoefe: 3, deins: null, lage: null, streifen: { werte: [350, 400, 450], mitte: 400 } },
    ])
  })

  it('je Hof zählt sein günstigster Wert der Klasse — drei Heusorten zählen nicht dreifach', () => {
    const [zeile] = baueUmfeldZeilen({
      ...FUTTER,
      hoefe: [hof(1, [heu(9, 20), heu(7, 20), heu(8, 20)]), hof(2, [heu(10, 20)])],
    })
    // Werte: Hof 1 → 350, Hof 2 → 500. Median der zwei: 425.
    expect(zeile.preise[0]).toMatchObject({ spanne: '€ 350 – 500 / t', mitte: 'Mitte € 425', anzahlHoefe: 2 })
  })

  it('ein einzelner Hof zeigt einen Wert statt einer Spanne und keine Mitte', () => {
    const [zeile] = baueUmfeldZeilen({ ...FUTTER, hoefe: [hof(1, [heu(45, 300)])] })
    expect(zeile.preise).toEqual([
      { klasse: null, spanne: '€ 150 / t', mitte: null, zusatz: 'nur 1 Angebot im Umkreis', anzahlHoefe: 1, deins: null, lage: null, streifen: null },
    ])
    expect(zeile.anzahlText).toBe('1 Hof')
  })

  it('ohne echte Spanne keine Mitte — gleiche Beträge stünden sonst doppelt da', () => {
    const [zeile] = baueUmfeldZeilen({ ...FUTTER, hoefe: [hof(1, [heu(8, 20)]), hof(2, [heu(8.001, 20)])] })
    expect(zeile.preise[0]).toMatchObject({ spanne: '€ 400 / t', mitte: null, anzahlHoefe: 2, streifen: null })
  })

  it('im Hofladen mit Cent: € je Kilo', () => {
    const erdaepfel = (preis: number) => produkt({ category: 'GEMUESE', subcategory: 'ERDAEPFEL', price: preis, unit: 'KG', unitSize: 10 })
    const [zeile] = baueUmfeldZeilen({ ...HOFLADEN, hoefe: [hof(1, [erdaepfel(12)]), hof(2, [erdaepfel(15)])] })
    expect(zeile.preise[0]).toMatchObject({ spanne: '€ 1,20 – 1,50 / kg', mitte: 'Mitte € 1,35' })
  })
})

describe('baueUmfeldZeilen — Gebindeklassen', () => {
  it('zeigt Klein- und Großgebinde getrennt, wenn beide vorkommen', () => {
    const [zeile] = baueUmfeldZeilen({
      ...FUTTER,
      hoefe: [hof(1, [heu(8, 20), heu(45, 300)]), hof(2, [heu(42, 300)])],
    })
    expect(zeile.preise).toMatchObject([
      { klasse: 'Kleingebinde bis 25 kg', spanne: '€ 400 / t', mitte: null, anzahlHoefe: 1, deins: null, streifen: null },
      { klasse: 'Großgebinde über 25 kg', spanne: '€ 140 – 150 / t', mitte: 'Mitte € 145', anzahlHoefe: 2, deins: null, streifen: { werte: [140, 150] } },
    ])
  })

  it('bei nur einer Klasse eine Spanne ohne Klassenlabel', () => {
    const [zeile] = baueUmfeldZeilen({ ...FUTTER, hoefe: [hof(1, [heu(45, 300)]), hof(2, [heu(42, 300)])] })
    expect(zeile.preise).toHaveLength(1)
    expect(zeile.preise[0].klasse).toBeNull()
  })

  it('der 25-kg-Sack und der 20-kg-Ballen stehen in derselben Klasse', () => {
    const [zeile] = baueUmfeldZeilen({ ...FUTTER, hoefe: [hof(1, [heu(5, 25)]), hof(2, [heu(4, 20)])] })
    expect(zeile.preise).toHaveLength(1)
  })

  it('im Hofladen gibt es keine Klassen, auch bei sehr unterschiedlichen Gebinden', () => {
    const erdaepfel = (preis: number, kg: number) =>
      produkt({ category: 'GEMUESE', subcategory: 'ERDAEPFEL', price: preis, unit: 'KG', unitSize: kg })
    const [zeile] = baueUmfeldZeilen({ ...HOFLADEN, hoefe: [hof(1, [erdaepfel(3, 2)]), hof(2, [erdaepfel(30, 50)])] })
    expect(zeile.preise).toHaveLength(1)
    expect(zeile.preise[0].klasse).toBeNull()
  })
})

describe('baueUmfeldZeilen — „Deins"', () => {
  it('steht in derselben Einheit neben der Spanne', () => {
    const [zeile] = baueUmfeldZeilen({ ...FUTTER, eigeneProdukte: [heu(7.5, 20)], hoefe: [hof(1, [heu(8, 20)])] })
    expect(zeile.preise[0].deins).toBe('Deins € 375 / t')
    expect(zeile.eigenesProdukt).toBe(true)
  })

  it('mehrere eigene Produkte in einer Klasse ergeben eine Spanne', () => {
    const [zeile] = baueUmfeldZeilen({ ...FUTTER, eigeneProdukte: [heu(7, 20), heu(9, 20)], hoefe: [hof(1, [heu(8, 20)])] })
    expect(zeile.preise[0].deins).toBe('Deins € 350 – 450 / t')
  })

  it('gehört in seine Klasse — auch wenn nur du dort anbietest', () => {
    const [zeile] = baueUmfeldZeilen({ ...FUTTER, eigeneProdukte: [heu(45, 300)], hoefe: [hof(1, [heu(8, 20)])] })
    expect(zeile.preise).toMatchObject([
      { klasse: 'Kleingebinde bis 25 kg', spanne: '€ 400 / t', mitte: null, anzahlHoefe: 1, deins: null },
      { klasse: 'Großgebinde über 25 kg', spanne: null, mitte: null, zusatz: null, anzahlHoefe: 0, deins: 'Deins € 150 / t', lage: null, streifen: null },
    ])
  })

  it('ein eigenes Produkt ohne Grundpreis markiert die Zeile, ohne Preis', () => {
    const brot = (name: string) => produkt({ name, category: 'BROT', unit: 'STUECK' })
    const [zeile] = baueUmfeldZeilen({ ...HOFLADEN, eigeneProdukte: [brot('Laib')], hoefe: [hof(1, [brot('Bauernbrot')])] })
    expect(zeile.eigenesProdukt).toBe(true)
    expect(zeile.preise).toEqual([])
  })

  it('eigene Produkte bilden keine Zeile, wenn kein Nachbar dort anbietet', () => {
    expect(baueUmfeldZeilen({ ...FUTTER, eigeneProdukte: [heu(8, 20)], hoefe: [] })).toEqual([])
  })
})

describe('baueUmfeldZeilen — nicht vergleichbar', () => {
  it('nennt die gemeinsame Einheit, wenn alle je Stück verkaufen', () => {
    const [zeile] = baueUmfeldZeilen({
      ...HOFLADEN,
      hoefe: [hof(1, [produkt({ category: 'BROT', unit: 'STUECK' })]), hof(2, [produkt({ category: 'BROT', unit: 'STUECK' })])],
    })
    expect(zeile.preise).toEqual([])
    expect(zeile.hinweis).toBe('Preis je Stück, nicht vergleichbar – ohne Gewicht je Stück.')
    expect(zeile.anzahlText).toBe('2 Höfe')
  })

  it('Brennholz je Raummeter ist in diesem Sprint nicht vergleichbar', () => {
    const [zeile] = baueUmfeldZeilen({ ...HOFLADEN, hoefe: [hof(1, [produkt({ category: 'BRENNHOLZ', unit: 'M3', unitSize: 1 })])] })
    expect(zeile.hinweis).toBe('Preis je m³, nicht vergleichbar')
  })

  it('bei gemischten Einheiten ohne Grundpreis schlicht „nicht vergleichbar"', () => {
    const [zeile] = baueUmfeldZeilen({
      ...HOFLADEN,
      hoefe: [hof(1, [produkt({ category: 'BROT', unit: 'STUECK' })]), hof(2, [produkt({ category: 'BROT', unit: 'PAKET' })])],
    })
    expect(zeile.hinweis).toBe('Preise nicht vergleichbar')
  })

  it('zeigt keinen Hinweis, sobald ein Hof vergleichbar ist', () => {
    const [zeile] = baueUmfeldZeilen({
      ...FUTTER,
      hoefe: [hof(1, [heu(8, 20)]), hof(2, [produkt({ category: 'HEU_STROH', subcategory: 'WIESENHEU', unit: 'BALLEN' })])],
    })
    expect(zeile.hinweis).toBeNull()
    expect(zeile.anzahlHoefe).toBe(2)
    expect(zeile.preise[0].anzahlHoefe).toBe(1)
  })
})

describe('baueUmfeldZeilen — Sortierung', () => {
  it('eigene Zeilen zuerst, dann nach Anzahl Höfe, dann Taxonomie', () => {
    const stroh = (preis: number) => produkt({ category: 'HEU_STROH', subcategory: 'STROH', price: preis, unit: 'BALLEN', nettoMenge: 250, nettoEinheit: 'KG' })
    const luzerne = produkt({ category: 'HEU_STROH', subcategory: 'LUZERNE', price: 9, unit: 'BALLEN', nettoMenge: 20, nettoEinheit: 'KG' })
    const silage = produkt({ category: 'HEU_STROH', subcategory: 'SILAGE', price: 50, unit: 'BALLEN', nettoMenge: 600, nettoEinheit: 'KG' })
    const zeilen = baueUmfeldZeilen({
      ...FUTTER,
      eigeneProdukte: [silage],
      hoefe: [hof(1, [stroh(30), luzerne]), hof(2, [stroh(28)]), hof(3, [silage]), hof(4, [heu(8, 20)])],
    })
    // Silage (deins) · Stroh (2 Höfe) · dann Wiesenheu vor Luzerne (Taxonomie)
    expect(zeilen.map((z) => z.titel)).toEqual(['Silage', 'Stroh', 'Wiesenheu', 'Luzerne'])
  })
})

describe('baueUmfeldZeilen — aufgeklappte Zeile', () => {
  it('Höfe nach Entfernung, mit Kopf, Hofseiten-Link und genau dem Produkt, das in dieser Zeile zählt', () => {
    const [zeile] = baueUmfeldZeilen({
      ...FUTTER,
      hoefe: [
        hof(2.34, [heu(9, 20, 'Heu teuer'), heu(7, 20, 'Heu billig')], { slug: 'nah', name: 'Nahhof', city: 'Nahdorf', kategorien: ['HEU_STROH'], fotos: ['/foto.jpg'] }),
        hof(14.1, [heu(8, 20)], { slug: 'weit', name: 'Weithof', city: 'Weitdorf', kategorien: ['HEU_STROH'] }),
      ],
    })
    expect(zeile.hoefe).toMatchObject([
      { slug: 'nah', name: 'Nahhof', postalCode: '1234', city: 'Nahdorf', entfernungKm: 2.34, foto: '/foto.jpg', link: '/nah?bereich=futter' },
      { slug: 'weit', name: 'Weithof', city: 'Weitdorf', entfernungKm: 14.1, foto: null, illustration: hofIllustrationen(['HEU_STROH'])[0], link: '/weit?bereich=futter' },
    ])
    // Je Hof zählt sein günstigstes Angebot — und nur das steht als Produktzeile da (Preis je Gebinde wie auf /hoefe).
    expect(zeile.hoefe[0].produkte).toMatchObject([{ name: 'Heu billig', price: 7, unit: 'BALLEN', verfuegbar: true }])
    expect(zeile.hoefe[1].produkte.map((p) => p.name)).toEqual(['Heu'])
  })

  it('zählt ein Hof in beiden Klassen, stehen beide Produkte da — in der Reihenfolge der Hofseite', () => {
    const [zeile] = baueUmfeldZeilen({ ...FUTTER, hoefe: [hof(1, [heu(45, 300, 'Rundballen'), heu(8, 20, 'Kleinballen')])] })
    expect(zeile.hoefe[0].produkte.map((p) => p.name)).toEqual(['Rundballen', 'Kleinballen'])
  })

  it('ohne vergleichbares Produkt steht das erste der Zeile da', () => {
    const [zeile] = baueUmfeldZeilen({
      ...HOFLADEN,
      hoefe: [hof(1, [produkt({ name: 'Bauernbrot', category: 'BROT', unit: 'STUECK' }), produkt({ name: 'Weckerl', category: 'BROT', unit: 'STUECK' })])],
    })
    expect(zeile.hoefe[0].produkte.map((p) => p.name)).toEqual(['Bauernbrot'])
    expect(zeile.hoefe[0].link).toBe(`/${zeile.hoefe[0].slug}`)
  })
})

describe('standardBereich', () => {
  const futter = produkt({ category: 'HEU_STROH' })
  const eier = produkt({ category: 'EIER' })
  it('der Bereich mit den meisten eigenen Produkten', () => {
    expect(standardBereich([futter, futter, eier])).toBe('FUTTERMITTEL')
    expect(standardBereich([futter, eier, eier])).toBe('LEBENSMITTEL')
  })
  it('bei Gleichstand und ohne Produkte der Hofladen', () => {
    expect(standardBereich([futter, eier])).toBe('LEBENSMITTEL')
    expect(standardBereich([])).toBe('LEBENSMITTEL')
  })
})

describe('baueUmfeld — Hinweise und Leere', () => {
  it('nennt die Höfe ohne Standort, die im Bereich etwas anbieten', () => {
    const ansicht = baueUmfeld({
      ...FUTTER,
      hoefe: [hof(1, [heu(8, 20)])],
      ohneStandort: [{ produkte: [heu(8, 20)] }, { produkte: [produkt({ category: 'EIER' })] }],
      abgeschnittenAbKm: null,
    })
    expect(ansicht.hinweise).toEqual(['1 Hof hat noch keinen Standort auf der Karte und fehlt hier.'])
  })

  it('meldet den Deckel — aber nur, wenn der gewählte Umkreis über den letzten geladenen Hof reicht', () => {
    const satz = 'Mehr als 200 Höfe im Umkreis — berücksichtigt sind die 200 nächsten.'
    const mit = (km: 10 | 25 | 50, abgeschnittenAbKm: number | null) =>
      baueUmfeld({ ...FUTTER, km, hoefe: [hof(1, [heu(8, 20)])], ohneStandort: [], abgeschnittenAbKm }).hinweise
    expect(mit(25, 18)).toEqual([satz])
    expect(mit(25, 25)).toEqual([satz])
    expect(mit(10, 18)).toEqual([])
    expect(mit(50, null)).toEqual([])
  })

  it('zählt je Stufe die Höfe, die die Liste dort zählen würde — im gewählten Bereich, ohne den eigenen Hof', () => {
    const eier = produkt({ category: 'EIER', unit: 'PAKET', unitSize: 10 })
    const hoefe = [
      hof(4, [heu(8, 20)]),
      hof(10, [heu(8, 20)]),
      hof(10.01, [heu(8, 20), eier]),
      hof(30, [eier]),
      hof(49, [heu(8, 20)]),
      hof(2, [heu(8, 20)], { slug: FUTTER.eigenerSlug }),
    ]
    // Die Grenze schließt ein (10 km zählt bei 10 km) — und die Zahl hängt nie am gewählten Umkreis.
    for (const km of UMFELD_KM) {
      expect(baueUmfeld({ ...FUTTER, km, hoefe, ohneStandort: [], abgeschnittenAbKm: null }).zahlen).toEqual({ 10: 2, 25: 3, 50: 4 })
      expect(baueUmfeld({ ...HOFLADEN, km, hoefe, ohneStandort: [], abgeschnittenAbKm: null }).zahlen).toEqual({ 10: 0, 25: 1, 50: 2 })
    }
    // Liste und Zahl zählen dieselben Höfe.
    expect(baueUmfeld({ ...FUTTER, km: 10, hoefe, ohneStandort: [], abgeschnittenAbKm: null }).zeilen[0].anzahlHoefe).toBe(2)
  })

  it('sagt bei leerem Umkreis, was fehlt, und schlägt 50 km vor', () => {
    expect(baueUmfeld({ ...FUTTER, ohneStandort: [], abgeschnittenAbKm: null })).toEqual({
      zeilen: [],
      zahlen: { 10: 0, 25: 0, 50: 0 },
      hinweise: [],
      leer: 'Im Umkreis von 25 km bietet gerade niemand Futtermittel an.',
      weiterUmkreis: 50,
    })
    expect(baueUmfeld({ ...HOFLADEN, km: 10, ohneStandort: [], abgeschnittenAbKm: null }).leer).toBe(
      'Im Umkreis von 10 km bietet gerade niemand etwas aus dem Hofladen an.'
    )
  })

  it('schlägt bei 50 km keinen größeren Umkreis vor', () => {
    expect(baueUmfeld({ ...FUTTER, km: 50, ohneStandort: [], abgeschnittenAbKm: null }).weiterUmkreis).toBeNull()
  })
})

describe('leseUmfeldFilter — Umkreis, Bereich und Ansicht aus der URL', () => {
  it('liest gültige Werte', () => {
    expect(leseUmfeldFilter({ km: '10', bereich: 'futter', ansicht: 'karte' })).toEqual({
      km: 10,
      bereich: 'FUTTERMITTEL',
      ansicht: 'karte',
    })
    expect(leseUmfeldFilter({ km: '50', bereich: 'hofladen' })).toEqual({ km: 50, bereich: 'LEBENSMITTEL', ansicht: 'liste' })
  })

  it('fällt bei Fehlendem und Unsinn still auf 25 km, „kein Bereich gewählt" und die Liste zurück', () => {
    expect(leseUmfeldFilter({})).toEqual({ km: 25, bereich: null, ansicht: 'liste' })
    expect(leseUmfeldFilter({ km: '30', bereich: 'lebensmittel', ansicht: 'globus' })).toEqual({
      km: 25,
      bereich: null,
      ansicht: 'liste',
    })
    expect(leseUmfeldFilter({ km: 'abc', bereich: 'FUTTER' })).toMatchObject({ km: 25, bereich: null })
    expect(leseUmfeldFilter({ km: '-25' })).toMatchObject({ km: 25 })
    expect(leseUmfeldAnsicht(null)).toBe('liste')
    expect(leseUmfeldAnsicht('KARTE')).toBe('liste')
  })

  it('nimmt bei doppelten Parametern den ersten', () => {
    expect(leseUmfeldFilter({ km: ['10', '50'], bereich: ['futter', 'hofladen'], ansicht: ['karte', 'liste'] })).toEqual({
      km: 10,
      bereich: 'FUTTERMITTEL',
      ansicht: 'karte',
    })
  })

  it('der Link trägt Umkreis und Bereich immer, die Ansicht nur als Karte — und das Lesen ergibt sie zurück', () => {
    const link = umfeldLink({ km: 50, bereich: 'FUTTERMITTEL', ansicht: 'karte' })
    expect(link).toBe('/region?km=50&bereich=futter&ansicht=karte')
    const params = new URLSearchParams(link.split('?')[1])
    expect(
      leseUmfeldFilter({ km: params.get('km'), bereich: params.get('bereich'), ansicht: params.get('ansicht') })
    ).toEqual({ km: 50, bereich: 'FUTTERMITTEL', ansicht: 'karte' })
    expect(umfeldLink({ km: 25, bereich: 'LEBENSMITTEL' })).toBe('/region?km=25&bereich=hofladen')
    expect(umfeldLink({ km: 25, bereich: 'LEBENSMITTEL', ansicht: 'liste' })).toBe('/region?km=25&bereich=hofladen')
  })

  it('die Umkreis-Stufen sind die des Reglers auf /hoefe ohne „egal"', () => {
    expect([...UMFELD_KM, null]).toEqual(UMKREIS_STUFEN)
  })
})

// ─── Karte ──────────────────────────────────────────────────────────────────

describe('baueUmfeldKarte — Pins genau für die Höfe, die die Liste zählt', () => {
  const eier = (preis = 3.6) => produkt({ category: 'EIER', subcategory: 'EIER_FREILAND', price: preis, unit: 'PAKET', unitSize: 10 })

  it('zeigt im Futter nur Höfe mit Futter, im Hofladen nur Höfe mit Hofladen — wie die Zeilen', () => {
    const hoefe = [hof(1, [heu(8, 20)]), hof(2, [eier()]), hof(3, [heu(45, 300), eier()])]
    for (const bereich of ['FUTTERMITTEL', 'LEBENSMITTEL'] as const) {
      const eingabe = { ...FUTTER, bereich, hoefe }
      const inZeilen = new Set(baueUmfeldZeilen(eingabe).flatMap((z) => z.hoefe.map((h) => h.slug)))
      const pins = baueUmfeldKarte({ ...eingabe, eigenerStandort: BRAUNAU }).pins
      expect(new Set(pins.map((p) => p.slug)), bereich).toEqual(inZeilen)
      expect(pins.map((p) => p.slug)).toEqual(gezaehlteHoefe(eingabe).map((h) => h.slug))
    }
  })

  it('der eigene Hof ist nie ein fremder Pin — auch wenn er in den Daten steht', () => {
    const eingabe = {
      ...FUTTER,
      hoefe: [hof(0, [heu(7, 20)], { slug: 'hof-mueller', name: 'Hof Müller' }), hof(2, [heu(8, 20)])],
    }
    const karte = baueUmfeldKarte({ ...eingabe, eigenerStandort: BRAUNAU })
    expect(karte.pins.map((p) => p.slug)).not.toContain('hof-mueller')
    // … und in der Liste auch nicht.
    expect(baueUmfeldZeilen(eingabe)[0].hoefe.map((h) => h.slug)).not.toContain('hof-mueller')
  })

  it('der eigene Hof ist das Zentrum, der gewählte Umkreis sein Radius', () => {
    const karte = baueUmfeldKarte({ ...FUTTER, km: 10, hoefe: [hof(2, [heu(8, 20)])], eigenerStandort: BRAUNAU })
    expect(karte.zentrum).toEqual({ ...BRAUNAU, radiusKm: 10 })
  })

  it('Pins nach Entfernung nummeriert, mit Namen, Entfernung und dem Bereich für „Zum Hof"', () => {
    const karte = baueUmfeldKarte({
      ...FUTTER,
      hoefe: [hof(14.1, [heu(8, 20)], { slug: 'weit', name: 'Weithof' }), hof(2.34, [heu(9, 20)], { slug: 'nah', name: 'Nahhof' })],
      eigenerStandort: BRAUNAU,
    })
    expect(karte.pins.map((p) => [p.slug, p.name, p.nummer, p.entfernungKm])).toEqual([
      ['nah', 'Nahhof', 1, 2.34],
      ['weit', 'Weithof', 2, 14.1],
    ])
    expect(karte.bereich).toBe('FUTTERMITTEL')
  })

  it('die Karte am Pin: die ersten zwei kaufbaren Produkte des Bereichs in der Reihenfolge der Hofseite', () => {
    const eier = produkt({ name: 'Eier', category: 'EIER', unit: 'PAKET', unitSize: 10 })
    const produkte = [
      heu(9, 20, 'Heu teuer'),
      eier,
      { ...heu(3, 20, 'Heu derzeit aus'), kaufbar: false },
      heu(4, 20, 'Heu billig'),
      heu(6, 20, 'Heu dritt'),
    ]
    const [pin] = baueUmfeldKarte({ ...FUTTER, hoefe: [hof(1, produkte, { postalCode: '1234', city: 'Testort' })], eigenerStandort: BRAUNAU }).pins
    expect(pin.produkte.map((p) => p.name)).toEqual(['Heu teuer', 'Heu billig'])
    expect(pin.produkte.every((p) => p.verfuegbar)).toBe(true)
    expect(pin).toMatchObject({ postalCode: '1234', city: 'Testort', fotos: [], kategorien: [] })
    // Im Hofladen dieselbe Regel — dort steht das Eier-Paket.
    const [hofladen] = baueUmfeldKarte({ ...HOFLADEN, hoefe: [hof(1, produkte)], eigenerStandort: BRAUNAU }).pins
    expect(hofladen.produkte.map((p) => p.name)).toEqual(['Eier'])
  })

  it('ohne Höfe keine Pins — das Zentrum bleibt', () => {
    const karte = baueUmfeldKarte({ ...FUTTER, eigenerStandort: { lat: 48, lon: 13 } })
    expect(karte.pins).toEqual([])
    expect(karte.zentrum.radiusKm).toBe(25)
  })
})

describe('Links auf fremde Hofseiten — im Futter direkt beim Futter', () => {
  const eier = produkt({ category: 'EIER', subcategory: 'EIER_FREILAND', price: 3.6, unit: 'PAKET', unitSize: 10 })
  // Ein Hof mit beidem — derselbe Hof, nur der gewählte Bereich entscheidet.
  const hoefe = [hof(3, [heu(8, 20), eier], { slug: 'gemischt' })]
  const links = (bereich: UmfeldEingabe['bereich']) => {
    const eingabe = { ...FUTTER, bereich, hoefe }
    return {
      liste: baueUmfeldZeilen(eingabe).flatMap((z) => z.hoefe.map((h) => h.link)),
      // „Zum Hof" baut die HofKurzkarte aus Slug und Bereich der Karte — dieselbe Funktion wie die Liste.
      pins: (({ pins, bereich: b }) => pins.map((p) => hofseitenLink(p.slug, b)))(baueUmfeldKarte({ ...eingabe, eigenerStandort: BRAUNAU })),
    }
  }

  // Was die Hofseite aus dem Link liest (product-grid.tsx) — so hängt der Test
  // an der Wirkung „öffnet beim Futter", nicht nur an der Zeichenkette.
  const hofseiteOeffnet = (link: string) =>
    bereichAusParameter(new URLSearchParams(link.split('?')[1] ?? '').get('bereich'))

  it('aus einer Futter-Zeile und vom Pin trägt der Link bereich=futter', () => {
    const { liste, pins } = links('FUTTERMITTEL')
    expect(liste.length).toBeGreaterThan(0)
    expect(pins.length).toBeGreaterThan(0)
    for (const link of [...liste, ...pins]) {
      expect(link, link).toContain('bereich=futter')
      expect(link.startsWith('/gemischt?'), link).toBe(true)
      expect(hofseiteOeffnet(link), link).toBe('FUTTERMITTEL')
    }
  })

  it('aus einer Hofladen-Zeile und vom Pin ohne Parameter', () => {
    const { liste, pins } = links('LEBENSMITTEL')
    expect(liste.length).toBeGreaterThan(0)
    expect(pins.length).toBeGreaterThan(0)
    for (const link of [...liste, ...pins]) {
      expect(link).not.toContain('bereich=futter')
      expect(link).toBe('/gemischt')
      expect(hofseiteOeffnet(link), link).toBe('LEBENSMITTEL')
    }
  })
})

describe('Der eigene Pin — deutlich anders als jeder fremde', () => {
  it('andere Farbe, andere Form, „Du" statt einer Nummer', () => {
    for (const zustand of ['normal', 'hervorgehoben', 'ausgewaehlt'] as const) {
      expect(EIGENER_PIN.hintergrund).not.toBe(pinDarstellung(zustand).hintergrund)
    }
    // Fremde Pins sind Scheiben (border-radius 9999px), der eigene ein Quadrat.
    expect(EIGENER_PIN.eckenRadius).toBeLessThan(EIGENER_PIN.groesse / 2)
    expect(EIGENER_PIN.beschriftung).toBe('Du')
  })
})
