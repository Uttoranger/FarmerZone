/**
 * Tests für die Umfeld-Query (src/server/queries/umfeld.ts) mit gemocktem
 * Prisma. Geprüft wird, was die Query der Datenbank sagt und was sie
 * zurückgibt:
 *   - Sichtbarkeit: OEFFENTLICH_SICHTBAR unverändert, dazu isPaused: false,
 *     der eigene Hof ausgeschlossen (strenger als /hoefe, nie lockerer),
 *   - Umkreis: Box in der WHERE-Klausel, das Urteil über die exakte Entfernung,
 *   - Verfügbar heißt istKaufbar,
 *   - keine Kontaktdaten, keine Koordinaten, kein Bestand im Ergebnis.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from '@prisma/client/runtime/index-browser'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    product: { findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { getUmfeld } from '@/server/queries/umfeld'
import { OEFFENTLICH_SICHTBAR } from '@/server/queries/farm'
import { umkreisBox } from '@/lib/umfeld'
import { ERDRADIUS_KM } from '@/lib/hofuebersicht'

const EIGEN = { lat: 48.2563, lon: 13.0434 }

/** Ein Punkt `km` östlich des eigenen Hofs. */
function oestlich(km: number) {
  const dLon = ((km / ERDRADIUS_KM) * 180) / Math.PI / Math.cos((EIGEN.lat * Math.PI) / 180)
  return { latitude: EIGEN.lat, longitude: EIGEN.lon + dLon }
}

function produktZeile(teil: Record<string, unknown> = {}) {
  return {
    name: 'Heu Kleinballen',
    category: 'HEU_STROH',
    subcategory: 'WIESENHEU',
    price: new Decimal('8.00'),
    unit: 'BALLEN',
    unitSize: null,
    futter: { nettoMenge: new Decimal('20.000'), nettoEinheit: 'KG' },
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
    products: [produktZeile({ name: 'Mein Heu', price: new Decimal('7.50') })],
  } as never)
  farm.findMany.mockResolvedValue([] as never)
  farm.count.mockResolvedValue(1 as never)
  product.findMany.mockResolvedValue([] as never)
})

describe('getUmfeld — was die Query die Datenbank fragt', () => {
  it('liest den eigenen Hof nur über die farmId aus der Sitzung, mit seinen Produkten im Shop', async () => {
    await getUmfeld('hof-1', 25)
    const aufruf = farm.findUnique.mock.calls[0][0] as { where: unknown; select: { products: { where: unknown } } }
    expect(aufruf.where).toEqual({ id: 'hof-1' })
    expect(aufruf.select.products.where).toEqual({ isAvailable: true })
  })

  it('nimmt die Sichtbarkeit von /hoefe unverändert, dazu „nicht pausiert" und ohne den eigenen Hof', async () => {
    await getUmfeld('hof-1', 25)
    const { where } = farm.findMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(where).toMatchObject({ ...OEFFENTLICH_SICHTBAR, isPaused: false, id: { not: 'hof-1' } })
    // Kein Schlüssel von OEFFENTLICH_SICHTBAR darf fehlen oder gelockert sein.
    for (const [schluessel, wert] of Object.entries(OEFFENTLICH_SICHTBAR)) {
      expect(where[schluessel], schluessel).toEqual(wert)
    }
  })

  it('schränkt per Bounding-Box um den eigenen Standort ein — samt der Höfe ohne Standort zum Zählen', async () => {
    await getUmfeld('hof-1', 10)
    const { where } = farm.findMany.mock.calls[0][0] as { where: { OR: unknown[] } }
    const box = umkreisBox(EIGEN, 10)
    expect(where.OR).toEqual([
      {
        latitude: { gte: box.breiteVon, lte: box.breiteBis },
        longitude: { gte: box.laengeVon, lte: box.laengeBis },
      },
      { latitude: null },
      { longitude: null },
    ])
  })

  it('prüft, ob der eigene Hof auf /hoefe steht, mit derselben Bedingung', async () => {
    await getUmfeld('hof-1', 25)
    expect(farm.count).toHaveBeenCalledWith({ where: { id: 'hof-1', ...OEFFENTLICH_SICHTBAR } })
  })

  it('liest keine Kontaktdaten — weder beim Hof noch beim Produkt', async () => {
    farm.findMany.mockResolvedValue([{ id: 'h1', slug: 'nachbar', name: 'Nachbarhof', city: 'Dorf', ...oestlich(2) }] as never)
    await getUmfeld('hof-1', 25)
    const hofSelect = (farm.findMany.mock.calls[0][0] as { select: Record<string, unknown> }).select
    expect(Object.keys(hofSelect).sort()).toEqual(['city', 'id', 'latitude', 'longitude', 'name', 'slug'])
    const produktSelect = (product.findMany.mock.calls[0][0] as { select: Record<string, unknown> }).select
    // Bestand und Reservierung nur für istKaufbar — sie verlassen die Query nicht (Test unten).
    expect(Object.keys(produktSelect).sort()).toEqual(
      ['category', 'farmId', 'futter', 'name', 'price', 'reservedStock', 'stock', 'subcategory', 'unit', 'unitSize']
    )
    expect(produktSelect.futter).toEqual({ select: { nettoMenge: true, nettoEinheit: true } })
    for (const verboten of ['phone', 'email', 'address', 'ownerName', 'postalCode']) {
      expect(hofSelect).not.toHaveProperty(verboten)
    }
  })
})

describe('getUmfeld — was zurückkommt', () => {
  it('ohne eigenen Standort: kein Ergebnis, keine weitere Abfrage', async () => {
    farm.findUnique.mockResolvedValue({ slug: 'hof-eigen', latitude: null, longitude: 13, products: [] } as never)
    expect(await getUmfeld('hof-1', 25)).toEqual({ eigenerStandort: false })
    expect(farm.findMany).not.toHaveBeenCalled()
    expect(product.findMany).not.toHaveBeenCalled()
  })

  it('einen unbekannten Hof gibt es nicht', async () => {
    farm.findUnique.mockResolvedValue(null as never)
    expect(await getUmfeld('gibt-es-nicht', 25)).toBeNull()
  })

  it('die Box ist nicht das Urteil: ein Hof in der Ecke jenseits des Umkreises fehlt', async () => {
    const box = umkreisBox(EIGEN, 10)
    farm.findMany.mockResolvedValue([
      { id: 'ecke', slug: 'ecke', name: 'Eckhof', city: 'Ecke', latitude: box.breiteBis * 0.999 + EIGEN.lat * 0.001, longitude: box.laengeBis * 0.999 + EIGEN.lon * 0.001 },
      { id: 'nah', slug: 'nah', name: 'Nahhof', city: 'Nah', ...oestlich(9.9) },
    ] as never)
    product.findMany.mockResolvedValue([
      { farmId: 'ecke', stock: 5, reservedStock: 0, ...produktZeile() },
      { farmId: 'nah', stock: 5, reservedStock: 0, ...produktZeile() },
    ] as never)
    const daten = await getUmfeld('hof-1', 10)
    expect(daten?.eigenerStandort && daten.hoefe.map((h) => h.slug)).toEqual(['nah'])
    // Die Produkte werden nur für Höfe im Umkreis gelesen.
    expect(product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { farmId: { in: ['nah'] }, isAvailable: true } }))
  })

  it('verfügbar heißt kaufbar: ausverkaufte und voll reservierte Produkte zählen nicht', async () => {
    farm.findMany.mockResolvedValue([
      { id: 'a', slug: 'a', name: 'A', city: 'X', ...oestlich(1) },
      { id: 'b', slug: 'b', name: 'B', city: 'X', ...oestlich(2) },
    ] as never)
    product.findMany.mockResolvedValue([
      { farmId: 'a', stock: 0, reservedStock: 0, ...produktZeile({ name: 'Ausverkauft' }) },
      { farmId: 'a', stock: 3, reservedStock: 0, ...produktZeile({ name: 'Da' }) },
      { farmId: 'b', stock: 2, reservedStock: 2, ...produktZeile({ name: 'Reserviert' }) },
    ] as never)
    const daten = await getUmfeld('hof-1', 25)
    if (!daten?.eigenerStandort) throw new Error('Standort erwartet')
    // Hof B hat nichts Kaufbares und fehlt ganz.
    expect(daten.hoefe.map((h) => [h.slug, h.produkte.map((p) => p.name)])).toEqual([['a', ['Da']]])
  })

  it('trägt keine IDs, Koordinaten oder Bestände nach außen', async () => {
    farm.findMany.mockResolvedValue([{ id: 'h1', slug: 'nachbar', name: 'Nachbarhof', city: 'Dorf', ...oestlich(3) }] as never)
    product.findMany.mockResolvedValue([{ farmId: 'h1', stock: 7, reservedStock: 1, ...produktZeile() }] as never)
    const daten = await getUmfeld('hof-1', 25)
    const text = JSON.stringify(daten)
    for (const verboten of ['"id"', 'farmId', 'latitude', 'longitude', 'stock', 'reservedStock', 'h1']) {
      expect(text).not.toContain(verboten)
    }
    expect(daten).toMatchObject({
      eigenerStandort: true,
      hoefe: [{ slug: 'nachbar', name: 'Nachbarhof', ort: 'Dorf', produkte: [{ name: 'Heu Kleinballen', price: 8, nettoMenge: 20 }] }],
    })
  })

  it('zählt sichtbare Höfe ohne Standort nur mit kaufbarem Angebot', async () => {
    farm.findMany.mockResolvedValue([
      { id: 'o1', slug: 'o1', name: 'Ohne 1', city: 'X', latitude: null, longitude: null },
      { id: 'o2', slug: 'o2', name: 'Ohne 2', city: 'X', latitude: 48.1, longitude: null },
    ] as never)
    product.findMany.mockResolvedValue([
      { farmId: 'o1', stock: 1, reservedStock: 0, ...produktZeile() },
      { farmId: 'o2', stock: 0, reservedStock: 0, ...produktZeile() },
    ] as never)
    const daten = await getUmfeld('hof-1', 25)
    if (!daten?.eigenerStandort) throw new Error('Standort erwartet')
    expect(daten.ohneStandort).toHaveLength(1)
    expect(daten.hoefe).toEqual([])
  })

  it('gibt den eigenen Slug nur, wenn der Hof auf /hoefe steht', async () => {
    farm.count.mockResolvedValue(0 as never)
    expect(await getUmfeld('hof-1', 25)).toMatchObject({ eigenerSlug: null })
    farm.count.mockResolvedValue(1 as never)
    expect(await getUmfeld('hof-1', 25)).toMatchObject({ eigenerSlug: 'hof-eigen' })
  })

  it('wandelt die eigenen Produkte wie die fremden', async () => {
    const daten = await getUmfeld('hof-1', 25)
    expect(daten).toMatchObject({ eigeneProdukte: [{ name: 'Mein Heu', price: 7.5, nettoMenge: 20, nettoEinheit: 'KG' }] })
  })
})
