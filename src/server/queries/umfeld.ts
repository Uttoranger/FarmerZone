import { prisma } from '@/lib/prisma'
import { istKaufbar } from '@/lib/bereiche-anzeige'
import { umkreisBox, waehleHoefeImUmkreis, type UmfeldHof, type UmfeldKm, type UmfeldProdukt } from '@/lib/umfeld'
import type { NettoEinheitValue, ProductCategoryValue, ProductSubcategoryValue } from '@/lib/taxonomie'
import { OEFFENTLICH_SICHTBAR } from './farm'

/**
 * Umfeld — was andere Höfe in der Nähe anbieten (docs/konzepte/umfeld.md).
 *
 * Die EINE Ausnahme von „jede Abfrage im Bauern-Bereich ist auf den eigenen
 * Hof begrenzt" (ARCHITECTURE.md §5): Sie liest fremde Höfe, aber nur, was
 * auch auf /hoefe steht, und mit derselben Sichtbarkeitsregel —
 * OEFFENTLICH_SICHTBAR unverändert, dazu strenger `isPaused: false` (ein
 * pausierter Hof verkauft gerade nicht). Keine zweite Sichtbarkeitslogik.
 *
 * Was den Server NICHT verlässt: IDs, Koordinaten fremder Höfe, Adresse,
 * Telefon, E-Mail, Bestand. Bestand und Reservierung werden hier nur gelesen,
 * um `istKaufbar` zu fragen — das Ergebnis trägt sie nicht mehr.
 *
 * Drei Abfragen, kein N+1:
 *   1. der eigene Hof (Standort, eigene Produkte) — die farmId kommt aus der
 *      Sitzung, nie aus dem Client,
 *   2. fremde Höfe in der Bounding-Box (Vorfilter) plus die ohne Standort,
 *      danach die exakte Entfernung und der Deckel in src/lib/umfeld.ts,
 *   3. die Produkte genau dieser Höfe.
 */

/** Nur, was das Umfeld braucht — und nichts, was /hoefe nicht auch zeigt. */
const PRODUKT_SELECT = {
  name: true,
  category: true,
  subcategory: true,
  price: true,
  unit: true,
  unitSize: true,
  futter: { select: { nettoMenge: true, nettoEinheit: true } },
} as const

type Zahl = { toNumber(): number }

type ProduktRoh = {
  name: string
  category: ProductCategoryValue | null
  subcategory: ProductSubcategoryValue | null
  price: Zahl
  unit: string
  unitSize: Zahl | null
  futter: { nettoMenge: Zahl; nettoEinheit: NettoEinheitValue } | null
}

/** Decimal → Zahl an der Servergrenze: Der Grundpreis ist Anzeige, nie Abrechnung (wie /hoefe). */
function zuUmfeldProdukt(p: ProduktRoh): UmfeldProdukt {
  return {
    name: p.name,
    category: p.category,
    subcategory: p.subcategory,
    price: p.price.toNumber(),
    unit: p.unit,
    unitSize: p.unitSize === null ? null : p.unitSize.toNumber(),
    nettoMenge: p.futter ? p.futter.nettoMenge.toNumber() : null,
    nettoEinheit: p.futter ? p.futter.nettoEinheit : null,
  }
}

export type UmfeldDaten =
  | { eigenerStandort: false }
  | {
      eigenerStandort: true
      /** Dein Slug, wenn dein Hof auf /hoefe steht — sonst null (kein Kartenlink). */
      eigenerSlug: string | null
      /** Deine Produkte mit „Im Shop", auch bei Bestand 0. */
      eigeneProdukte: UmfeldProdukt[]
      /** Fremde Höfe im Umkreis mit mindestens einem kaufbaren Produkt, nach Entfernung. */
      hoefe: UmfeldHof[]
      /** Sichtbare Höfe ohne Standort, nur ihre kaufbaren Produkte — sie werden gezählt, nie gezeigt. */
      ohneStandort: Array<{ produkte: UmfeldProdukt[] }>
      abgeschnitten: boolean
    }

/** null, wenn es den Hof nicht gibt. */
export async function getUmfeld(farmId: string, km: UmfeldKm): Promise<UmfeldDaten | null> {
  const eigen = await prisma.farm.findUnique({
    where: { id: farmId },
    select: {
      slug: true,
      latitude: true,
      longitude: true,
      products: { where: { isAvailable: true }, select: PRODUKT_SELECT },
    },
  })
  if (!eigen) return null
  if (!Number.isFinite(eigen.latitude) || !Number.isFinite(eigen.longitude)) return { eigenerStandort: false }

  const punkt = { lat: eigen.latitude as number, lon: eigen.longitude as number }
  const box = umkreisBox(punkt, km)
  const [kandidaten, eigenOeffentlich] = await Promise.all([
    prisma.farm.findMany({
      where: {
        ...OEFFENTLICH_SICHTBAR,
        // Strenger als /hoefe: Ein pausierter Hof verkauft gerade nicht.
        isPaused: false,
        id: { not: farmId },
        OR: [
          // Die Box ist der Vorfilter — das Urteil fällt über die exakte
          // Entfernung in waehleHoefeImUmkreis.
          {
            latitude: { gte: box.breiteVon, lte: box.breiteBis },
            longitude: { gte: box.laengeVon, lte: box.laengeBis },
          },
          // Ohne Standort: nur, um sie zu zählen.
          { latitude: null },
          { longitude: null },
        ],
      },
      select: { id: true, slug: true, name: true, city: true, latitude: true, longitude: true },
    }),
    // Steht dein Hof auf /hoefe? Dieselbe Bedingung wie dort, keine eigene Fassung
    // — sonst führte „Auf der Karte zeigen" zu einer Karte ohne Bezugspunkt.
    prisma.farm.count({ where: { id: farmId, ...OEFFENTLICH_SICHTBAR } }),
  ])

  const { nah, ohneStandort, abgeschnitten } = waehleHoefeImUmkreis(punkt, kandidaten, km, farmId)
  const ids = [...nah, ...ohneStandort].map((h) => h.id)
  const produkte =
    ids.length === 0
      ? []
      : await prisma.product.findMany({
          where: { farmId: { in: ids }, isAvailable: true },
          select: { farmId: true, stock: true, reservedStock: true, ...PRODUKT_SELECT },
        })

  const jeHof = new Map<string, UmfeldProdukt[]>()
  for (const p of produkte) {
    // Verfügbar heißt kaufbar — dieselbe Regel wie /hoefe.
    if (!istKaufbar({ isAvailable: true, stock: p.stock, reservedStock: p.reservedStock })) continue
    jeHof.set(p.farmId, [...(jeHof.get(p.farmId) ?? []), zuUmfeldProdukt(p)])
  }

  return {
    eigenerStandort: true,
    eigenerSlug: eigenOeffentlich > 0 ? eigen.slug : null,
    eigeneProdukte: eigen.products.map(zuUmfeldProdukt),
    hoefe: nah
      .map((h) => ({ slug: h.slug, name: h.name, ort: h.city, entfernungKm: h.entfernungKm, produkte: jeHof.get(h.id) ?? [] }))
      .filter((h) => h.produkte.length > 0),
    ohneStandort: ohneStandort
      .map((h) => ({ produkte: jeHof.get(h.id) ?? [] }))
      .filter((h) => h.produkte.length > 0),
    abgeschnitten,
  }
}
