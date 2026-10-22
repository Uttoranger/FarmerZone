/**
 * Tests für die Umfeld-Query (src/server/queries/umfeld.ts) mit gemocktem
 * Prisma. Geprüft wird, was die Query der Datenbank sagt und was sie
 * zurückgibt:
 *   - Sichtbarkeit: IN_LISTEN_SICHTBAR unverändert (kein Testhof), dazu isPaused: false,
 *     der eigene Hof ausgeschlossen (strenger als /hoefe, nie lockerer),
 *   - Umkreis: Box in der WHERE-Klausel, das Urteil über die exakte Entfernung,
 *   - Verfügbar heißt istKaufbar (nur als Ja/Nein im Ergebnis),
 *   - immer 50 km (Zahl je Stufe, N23), Produkte in der Reihenfolge der Hofseite,
 *   - keine Hof-ID, keine Kontaktdaten, kein Bestand, keine Bestellungen, kein
 *     Umsatz im Ergebnis — die Produkt-ID darf mit (sie steht öffentlich in
 *     der Adresse der Produktseite).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from '@prisma/client/runtime/index-browser'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn(), findMany: vi.fn() },
    product: { findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { getUmfeld } from '@/server/queries/umfeld'
import { IN_LISTEN_SICHTBAR } from '@/server/queries/farm'
import { PRODUCT_ORDER_BY } from '@/server/queries/products'
import { UMFELD_HOEFE_DECKEL, umkreisBox } from '@/lib/umfeld'
import { ERDRADIUS_KM } from '@/lib/hofuebersicht'

const EIGEN = { lat: 48.2563, lon: 13.0434 }

/** Ein Punkt `km` östlich des eigenen Hofs. */
function oestlich(km: number) {
  const dLon = ((km / ERDRADIUS_KM) * 180) / Math.PI / Math.cos((EIGEN.lat * Math.PI) / 180)
  return { latitude: EIGEN.lat, longitude: EIGEN.lon + dLon }
}

function produktZeile(teil: Record<string, unknown> = {}) {
  return {
    id: 'produkt-heu',
    name: 'Heu Kleinballen',
    category: 'HEU_STROH',
    subcategory: 'WIESENHEU',
    price: new Decimal('8.00'),
    unit: 'BALLEN',
    unitSize: null,
    futter: { nettoMenge: new Decimal('20.000'), nettoEinheit: 'KG' },
    imageUrl: null,
    bildAusschnitt: null,
    ...teil,
  }
}

const farm = vi.mocked(prisma.farm)
const product = vi.mocked(prisma.product)

beforeEach(() => {
  vi.clearAllMocks()
  farm.findUnique.mockResolvedValue({
    slug: 'hof-eigen',
    latitude: EIGEN.lat,
    longitude: EIGEN.lon,
    products: [{ stock: 0, reservedStock: 0, ...produktZeile({ name: 'Mein Heu', price: new Decimal('7.50') }) }],
  } as never)
  farm.findMany.mockResolvedValue([] as never)
  product.findMany.mockResolvedValue([] as never)
})

describe('getUmfeld — was die Query die Datenbank fragt', () => {
  it('liest den eigenen Hof nur über die farmId aus der Sitzung, mit seinen Produkten im Shop in der Reihenfolge der Hofseite', async () => {
    await getUmfeld('hof-1')
    const aufruf = farm.findUnique.mock.calls[0][0] as { where: unknown; select: { products: { where: unknown; orderBy: unknown } } }
    expect(aufruf.where).toEqual({ id: 'hof-1' })
    expect(aufruf.select.products.where).toEqual({ isAvailable: true })
    expect(aufruf.select.products.orderBy).toBe(PRODUCT_ORDER_BY)
  })

  it('nimmt die Sichtbarkeit von /hoefe unverändert, dazu „nicht pausiert" und ohne den eigenen Hof', async () => {
    await getUmfeld('hof-1')
    const { where } = farm.findMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(where).toMatchObject({ ...IN_LISTEN_SICHTBAR, isPaused: false, id: { not: 'hof-1' } })
    // Kein Schlüssel von IN_LISTEN_SICHTBAR darf fehlen oder gelockert sein — auch nicht istTesthof (Register N21).
    expect(where.istTesthof).toBe(false)
    for (const [schluessel, wert] of Object.entries(IN_LISTEN_SICHTBAR)) {
      expect(where[schluessel], schluessel).toEqual(wert)
    }
  })

  it('schränkt per Bounding-Box von 50 km um den eigenen Standort ein — samt der Höfe ohne Standort zum Zählen', async () => {
    await getUmfeld('hof-1')
    const { where } = farm.findMany.mock.calls[0][0] as { where: { OR: unknown[] } }
    const box = umkreisBox(EIGEN, 50)
    expect(where.OR).toEqual([
      {
        latitude: { gte: box.breiteVon, lte: box.breiteBis },
        longitude: { gte: box.laengeVon, lte: box.laengeBis },
      },
      { latitude: null },
      { longitude: null },
    ])
  })

  it('liest keine Kontaktdaten — weder beim Hof noch beim Produkt; PLZ, Ort und Fotos wie auf /hoefe', async () => {
    farm.findMany.mockResolvedValue([{ id: 'h1', slug: 'nachbar', name: 'Nachbarhof', postalCode: '1234', city: 'Dorf', bannerUrl: null, bannerType: 'COLOR', farmPhotos: [], ...oestlich(2) }] as never)
    await getUmfeld('hof-1')
    const hofSelect = (farm.findMany.mock.calls[0][0] as { select: Record<string, unknown> }).select
    expect(Object.keys(hofSelect).sort()).toEqual(['bannerType', 'bannerUrl', 'city', 'farmPhotos', 'id', 'latitude', 'longitude', 'name', 'postalCode', 'slug'])
    expect(hofSelect.farmPhotos).toEqual({ orderBy: { sortOrder: 'asc' }, take: 4, select: { url: true } })
    const aufruf = product.findMany.mock.calls[0][0] as { select: Record<string, unknown>; orderBy: unknown }
    // Bestand und Reservierung nur für istKaufbar — sie verlassen die Query nicht (Test unten).
    expect(Object.keys(aufruf.select).sort()).toEqual(
      ['bildAusschnitt', 'category', 'farmId', 'futter', 'id', 'imageUrl', 'name', 'price', 'reservedStock', 'stock', 'subcategory', 'unit', 'unitSize']
    )
    expect(aufruf.select.futter).toEqual({ select: { nettoMenge: true, nettoEinheit: true } })
    // Dieselbe Sortierung wie die Hofseite, keine zweite.
    expect(aufruf.orderBy).toBe(PRODUCT_ORDER_BY)
    for (const verboten of ['phone', 'email', 'address', 'ownerName', 'orders', 'umsatz']) {
      expect(hofSelect).not.toHaveProperty(verboten)
      expect(aufruf.select).not.toHaveProperty(verboten)
    }
  })
})

/** Ein fremder Hof, wie die Abfrage ihn liest. */
function hofZeile(id: string, km: number | null, teil: Record<string, unknown> = {}) {
  const ort = km === null ? { latitude: null, longitude: null } : oestlich(km)
  return { id, slug: id, name: `Hof ${id}`, postalCode: '1234', city: 'Dorf', bannerUrl: null, bannerType: 'COLOR', farmPhotos: [], ...ort, ...teil }
}

describe('getUmfeld — was zurückkommt', () => {
  it('ohne eigenen Standort: kein Ergebnis, keine weitere Abfrage', async () => {
    farm.findUnique.mockResolvedValue({ slug: 'hof-eigen', latitude: null, longitude: 13, products: [] } as never)
    expect(await getUmfeld('hof-1')).toEqual({ eigenerStandort: false })
    expect(farm.findMany).not.toHaveBeenCalled()
    expect(product.findMany).not.toHaveBeenCalled()
  })

  it('einen unbekannten Hof gibt es nicht', async () => {
    farm.findUnique.mockResolvedValue(null as never)
    expect(await getUmfeld('gibt-es-nicht')).toBeNull()
  })

  it('die Box ist nicht das Urteil: ein Hof in der Ecke jenseits von 50 km fehlt', async () => {
    const box = umkreisBox(EIGEN, 50)
    farm.findMany.mockResolvedValue([
      hofZeile('ecke', 0, { latitude: box.breiteBis * 0.999 + EIGEN.lat * 0.001, longitude: box.laengeBis * 0.999 + EIGEN.lon * 0.001 }),
      hofZeile('nah', 49.9),
    ] as never)
    product.findMany.mockResolvedValue([
      { farmId: 'ecke', stock: 5, reservedStock: 0, ...produktZeile() },
      { farmId: 'nah', stock: 5, reservedStock: 0, ...produktZeile() },
    ] as never)
    const daten = await getUmfeld('hof-1')
    expect(daten?.eigenerStandort && daten.hoefe.map((h) => h.slug)).toEqual(['nah'])
    // Die Produkte werden nur für Höfe im Umkreis gelesen.
    expect(product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { farmId: { in: ['nah'] }, isAvailable: true } }))
  })

  it('lädt immer bis 50 km — jeder Hof trägt seine Entfernung, den Umkreis schneidet die reine Funktion', async () => {
    farm.findMany.mockResolvedValue([hofZeile('neun', 9), hofZeile('vierzig', 40)] as never)
    product.findMany.mockResolvedValue([
      { farmId: 'neun', stock: 1, reservedStock: 0, ...produktZeile() },
      { farmId: 'vierzig', stock: 1, reservedStock: 0, ...produktZeile() },
    ] as never)
    const daten = await getUmfeld('hof-1')
    if (!daten?.eigenerStandort) throw new Error('Standort erwartet')
    expect(daten.hoefe.map((h) => [h.slug, Math.round(h.entfernungKm)])).toEqual([['neun', 9], ['vierzig', 40]])
    expect(daten.abgeschnittenAbKm).toBeNull()
  })

  it('über dem Deckel: die Entfernung, ab der Höfe fehlen', async () => {
    const viele = Array.from({ length: UMFELD_HOEFE_DECKEL + 1 }, (_, i) => hofZeile(`h${i}`, 1 + i * 0.2))
    farm.findMany.mockResolvedValue(viele as never)
    product.findMany.mockResolvedValue(viele.map((h) => ({ farmId: h.id, stock: 1, reservedStock: 0, ...produktZeile() })) as never)
    const daten = await getUmfeld('hof-1')
    if (!daten?.eigenerStandort) throw new Error('Standort erwartet')
    expect(daten.hoefe).toHaveLength(UMFELD_HOEFE_DECKEL)
    expect(daten.abgeschnittenAbKm).toBeCloseTo(1 + (UMFELD_HOEFE_DECKEL - 1) * 0.2, 1)
  })

  it('verfügbar heißt kaufbar: ausverkaufte und voll reservierte Produkte zählen nicht', async () => {
    farm.findMany.mockResolvedValue([hofZeile('a', 1), hofZeile('b', 2)] as never)
    product.findMany.mockResolvedValue([
      { farmId: 'a', stock: 0, reservedStock: 0, ...produktZeile({ name: 'Ausverkauft' }) },
      { farmId: 'a', stock: 3, reservedStock: 0, ...produktZeile({ name: 'Da' }) },
      { farmId: 'b', stock: 2, reservedStock: 2, ...produktZeile({ name: 'Reserviert' }) },
    ] as never)
    const daten = await getUmfeld('hof-1')
    if (!daten?.eigenerStandort) throw new Error('Standort erwartet')
    // Hof B hat nichts Kaufbares und fehlt ganz.
    expect(daten.hoefe.map((h) => [h.slug, h.produkte.map((p) => p.name)])).toEqual([['a', ['Da']]])
    expect(daten.hoefe[0].produkte[0].kaufbar).toBe(true)
  })

  it('behält die Reihenfolge der Hofseite, wie die Datenbank sie liefert — nie nach Preis', async () => {
    farm.findMany.mockResolvedValue([hofZeile('a', 1)] as never)
    product.findMany.mockResolvedValue([
      { farmId: 'a', stock: 1, reservedStock: 0, ...produktZeile({ id: 'produkt-teuer', price: new Decimal('9.00') }) },
      { farmId: 'a', stock: 1, reservedStock: 0, ...produktZeile({ id: 'produkt-billig', price: new Decimal('3.00') }) },
    ] as never)
    const daten = await getUmfeld('hof-1')
    expect(daten?.eigenerStandort && daten.hoefe[0].produkte.map((p) => p.id)).toEqual(['produkt-teuer', 'produkt-billig'])
  })

  it('trägt keine Hof-ID, keinen Bestand, keine Bestellungen und keinen Umsatz nach außen — die Produkt-ID schon', async () => {
    const punkt = oestlich(3)
    farm.findMany.mockResolvedValue([hofZeile('hofkennung', 3, { slug: 'nachbar', name: 'Nachbarhof' })] as never)
    product.findMany.mockResolvedValue([{ farmId: 'hofkennung', stock: 7, reservedStock: 1, ...produktZeile() }] as never)
    const daten = await getUmfeld('hof-1')
    const text = JSON.stringify(daten)
    for (const verboten of ['hofkennung', 'farmId', 'latitude', 'longitude', 'stock', 'reservedStock', 'order', 'umsatz', 'phone', 'email']) {
      expect(text).not.toContain(verboten)
    }
    // Dieselben Punkte, die /hoefe als Pin zeigt — die Umfeld-Karte braucht sie; dazu, was die Hofseite zeigt.
    expect(daten).toMatchObject({
      eigenerStandort: true,
      standort: EIGEN,
      eigenerSlug: 'hof-eigen',
      hoefe: [
        {
          slug: 'nachbar',
          name: 'Nachbarhof',
          postalCode: '1234',
          city: 'Dorf',
          lat: punkt.latitude,
          lon: punkt.longitude,
          fotos: [],
          kategorien: ['HEU_STROH'],
          produkte: [{ id: 'produkt-heu', name: 'Heu Kleinballen', preisCents: 800, nettoMenge: 20, kaufbar: true }],
        },
      ],
    })
  })

  it('der Fotostreifen wie auf /hoefe: Titelbild, Galerie, dann Produktfotos', async () => {
    farm.findMany.mockResolvedValue([
      hofZeile('a', 1, { bannerUrl: '/titel.jpg', bannerType: 'PHOTO', farmPhotos: [{ url: '/galerie.jpg' }] }),
    ] as never)
    product.findMany.mockResolvedValue([{ farmId: 'a', stock: 1, reservedStock: 0, ...produktZeile({ imageUrl: '/produkt.jpg' }) }] as never)
    const daten = await getUmfeld('hof-1')
    expect(daten?.eigenerStandort && daten.hoefe[0].fotos).toEqual(['/titel.jpg', '/galerie.jpg', '/produkt.jpg'])
  })

  it('zählt sichtbare Höfe ohne Standort nur mit kaufbarem Angebot', async () => {
    farm.findMany.mockResolvedValue([hofZeile('o1', null), hofZeile('o2', null, { latitude: 48.1 })] as never)
    product.findMany.mockResolvedValue([
      { farmId: 'o1', stock: 1, reservedStock: 0, ...produktZeile() },
      { farmId: 'o2', stock: 0, reservedStock: 0, ...produktZeile() },
    ] as never)
    const daten = await getUmfeld('hof-1')
    if (!daten?.eigenerStandort) throw new Error('Standort erwartet')
    expect(daten.ohneStandort).toHaveLength(1)
    expect(daten.hoefe).toEqual([])
  })

  it('wandelt die eigenen Produkte wie die fremden — Cent aus dem Decimal', async () => {
    const daten = await getUmfeld('hof-1')
    expect(daten).toMatchObject({ eigeneProdukte: [{ name: 'Mein Heu', preisCents: 750, nettoMenge: 20, nettoEinheit: 'KG', kaufbar: false }] })
  })
})
