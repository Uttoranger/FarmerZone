import { prisma } from '@/lib/prisma'
import { istKaufbar } from '@/lib/bereiche-anzeige'
import { baueFotostreifen } from '@/lib/hofuebersicht'
import { alsCents } from '@/lib/order-totals'
import { UMFELD_GROESSTER_KM, umkreisBox, waehleHoefeImUmkreis, type UmfeldHof, type UmfeldProdukt } from '@/lib/umfeld'
import { PRODUCT_CATEGORY_VALUES, type NettoEinheitValue, type ProductCategoryValue, type ProductSubcategoryValue } from '@/lib/taxonomie'
import { leseAusschnitt } from '@/schemas/bild-ausschnitt'
import { IN_LISTEN_SICHTBAR } from './farm'
import { PRODUCT_ORDER_BY } from './products'

/**
 * Umfeld — was andere Höfe in der Nähe anbieten (docs/konzepte/umfeld.md).
 *
 * Die EINE Ausnahme von „jede Abfrage im Bauern-Bereich ist auf den eigenen
 * Hof begrenzt" (ARCHITECTURE.md §5): Sie liest fremde Höfe, aber nur, was
 * auch auf /hoefe steht, und mit derselben Sichtbarkeitsregel —
 * IN_LISTEN_SICHTBAR unverändert (kein Testhof, Register N21), dazu strenger `isPaused: false` (ein
 * pausierter Hof verkauft gerade nicht). Keine zweite Sichtbarkeitslogik.
 *
 * Was den Server NICHT verlässt: die Hof-ID, Adresse, Telefon, E-Mail,
 * Bestand, Bestellungen, Umsatz. Bestand und Reservierung werden hier nur
 * gelesen, um `istKaufbar` zu fragen — das Ergebnis trägt nur das Ja/Nein.
 * Mit gehen, was die Hofseite ohnehin öffentlich zeigt: PLZ, Ort, Fotos,
 * Kategorien, die Produkt-ID (steht in der Adresse der Produktseite), Bild
 * und Reihenfolge der Produkte und die Koordinaten der Höfe — die Karte des
 * Umfelds setzt ihre Pins, und auf /hoefe stehen dieselben Punkte.
 *
 * Drei Abfragen, kein N+1:
 *   1. der eigene Hof (Standort, eigene Produkte) — die farmId kommt aus der
 *      Sitzung, nie aus dem Client,
 *   2. fremde Höfe in der Bounding-Box von 50 km (Vorfilter) plus die ohne
 *      Standort, danach die exakte Entfernung und der Deckel in src/lib/umfeld.ts,
 *   3. die Produkte genau dieser Höfe, in der Reihenfolge der Hofseite.
 */

/** Nur, was das Umfeld braucht — und nichts, was die Hofseite nicht auch zeigt. */
const PRODUKT_SELECT = {
  // Die Produkt-ID steht öffentlich in der Adresse der Produktseite (N23); die Hof-ID verlässt die Query nie.
  id: true,
  name: true,
  category: true,
  subcategory: true,
  price: true,
  unit: true,
  unitSize: true,
  imageUrl: true,
  bildAusschnitt: true,
  futter: { select: { nettoMenge: true, nettoEinheit: true } },
} as const

type Zahl = { toNumber(): number; toString(): string }

type ProduktRoh = {
  id: string
  name: string
  category: ProductCategoryValue | null
  subcategory: ProductSubcategoryValue | null
  price: Zahl
  unit: string
  unitSize: Zahl | null
  imageUrl: string | null
  bildAusschnitt: unknown
  stock: number
  reservedStock: number
  futter: { nettoMenge: Zahl; nettoEinheit: NettoEinheitValue } | null
}

/**
 * Decimal → Cent an der Servergrenze (alsCents, CODING_STANDARDS §2): Mit
 * genau diesen ganzen Zahlen rechnen Spanne, Mitte und Lage. Mengen bleiben
 * Zahlen mit höchstens drei Nachkommastellen (Decimal(10,3)). Aus Bestand und
 * Reservierung wird nur `kaufbar` — sie selbst gehen nicht mit.
 */
function zuUmfeldProdukt(p: ProduktRoh): UmfeldProdukt {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    subcategory: p.subcategory,
    preisCents: alsCents(p.price),
    unit: p.unit,
    unitSize: p.unitSize === null ? null : p.unitSize.toNumber(),
    nettoMenge: p.futter ? p.futter.nettoMenge.toNumber() : null,
    nettoEinheit: p.futter ? p.futter.nettoEinheit : null,
    imageUrl: p.imageUrl,
    bildAusschnitt: leseAusschnitt(p.bildAusschnitt),
    kaufbar: istKaufbar({ isAvailable: true, stock: p.stock, reservedStock: p.reservedStock }),
  }
}

export type UmfeldDaten =
  | { eigenerStandort: false }
  | {
      eigenerStandort: true
      /** Dein Standort — Mittelpunkt des Umkreises und der Karte. */
      standort: { lat: number; lon: number }
      /** Dein Slug — damit dein Hof nie als fremder Pin erscheint. */
      eigenerSlug: string
      /** Deine Produkte mit „Im Shop", auch bei Vorrat 0, in der Reihenfolge der Hofseite. */
      eigeneProdukte: UmfeldProdukt[]
      /** Fremde Höfe bis 50 km mit mindestens einem kaufbaren Produkt, nach Entfernung — auf den gewählten Umkreis filtert src/lib/umfeld.ts. */
      hoefe: UmfeldHof[]
      /** Sichtbare Höfe ohne Standort, nur ihre kaufbaren Produkte — sie werden gezählt, nie gezeigt. */
      ohneStandort: Array<{ produkte: UmfeldProdukt[] }>
      /** Entfernung des letzten Hofs unter dem Deckel; null, wenn keiner wegfiel. */
      abgeschnittenAbKm: number | null
    }

/**
 * null, wenn es den Hof nicht gibt. Lädt immer den größten Umkreis (50 km):
 * Die Zahl je Stufe (KmWahl, N23) braucht alle Stufen auf einmal, und der
 * Wechsel des Umkreises rechnet dann nur noch in der reinen Funktion.
 */
export async function getUmfeld(farmId: string): Promise<UmfeldDaten | null> {
  const eigen = await prisma.farm.findUnique({
    where: { id: farmId },
    select: {
      slug: true,
      latitude: true,
      longitude: true,
      products: {
        where: { isAvailable: true },
        orderBy: PRODUCT_ORDER_BY,
        select: { stock: true, reservedStock: true, ...PRODUKT_SELECT },
      },
    },
  })
  if (!eigen) return null
  if (!Number.isFinite(eigen.latitude) || !Number.isFinite(eigen.longitude)) return { eigenerStandort: false }

  const punkt = { lat: eigen.latitude as number, lon: eigen.longitude as number }
  const box = umkreisBox(punkt, UMFELD_GROESSTER_KM)
  const kandidaten = await prisma.farm.findMany({
    where: {
      ...IN_LISTEN_SICHTBAR,
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
    select: {
      id: true,
      slug: true,
      name: true,
      postalCode: true,
      city: true,
      latitude: true,
      longitude: true,
      // Fotostreifen wie auf /hoefe (UEBERSICHT_HOF_SELECT): Titelbild, die ersten vier der Galerie.
      bannerUrl: true,
      bannerType: true,
      farmPhotos: { orderBy: { sortOrder: 'asc' }, take: 4, select: { url: true } },
    },
  })

  const { nah, ohneStandort, abgeschnitten } = waehleHoefeImUmkreis(punkt, kandidaten, UMFELD_GROESSTER_KM, farmId)
  const ids = [...nah, ...ohneStandort].map((h) => h.id)
  const produkte =
    ids.length === 0
      ? []
      : await prisma.product.findMany({
          where: { farmId: { in: ids }, isAvailable: true },
          // Dieselbe Reihenfolge wie die Hofseite — die Karte am Pin zeigt die ersten zwei.
          orderBy: PRODUCT_ORDER_BY,
          select: { farmId: true, stock: true, reservedStock: true, ...PRODUKT_SELECT },
        })

  const jeHof = new Map<string, UmfeldProdukt[]>()
  const produktFotos = new Map<string, string[]>()
  for (const p of produkte) {
    // Der Fotostreifen nimmt Produktfotos aller sichtbaren Produkte, wie /hoefe (baueHofUebersicht).
    if (p.imageUrl) produktFotos.set(p.farmId, [...(produktFotos.get(p.farmId) ?? []), p.imageUrl].slice(0, 3))
    const produkt = zuUmfeldProdukt(p)
    // Verfügbar heißt kaufbar — dieselbe Regel wie /hoefe.
    if (!produkt.kaufbar) continue
    jeHof.set(p.farmId, [...(jeHof.get(p.farmId) ?? []), produkt])
  }

  return {
    eigenerStandort: true,
    standort: punkt,
    eigenerSlug: eigen.slug,
    eigeneProdukte: eigen.products.map(zuUmfeldProdukt),
    hoefe: nah
      .map((h): UmfeldHof => {
        const angebot = jeHof.get(h.id) ?? []
        const vorhanden = new Set(angebot.flatMap((p) => (p.category ? [p.category] : [])))
        return {
          slug: h.slug,
          name: h.name,
          postalCode: h.postalCode,
          city: h.city,
          // Im Umkreis heißt: brauchbare Koordinaten (waehleHoefeImUmkreis).
          lat: h.latitude as number,
          lon: h.longitude as number,
          entfernungKm: h.entfernungKm,
          fotos: baueFotostreifen({
            bannerUrl: h.bannerUrl,
            bannerType: h.bannerType,
            galerie: h.farmPhotos.map((f) => f.url),
            produktFotos: produktFotos.get(h.id) ?? [],
          }),
          // Dieselbe Regel wie fasseAngebotZusammen: Kategorien des kaufbaren Angebots in Taxonomie-Reihenfolge.
          kategorien: PRODUCT_CATEGORY_VALUES.filter((k) => vorhanden.has(k)),
          produkte: angebot,
        }
      })
      .filter((h) => h.produkte.length > 0),
    ohneStandort: ohneStandort
      .map((h) => ({ produkte: jeHof.get(h.id) ?? [] }))
      .filter((h) => h.produkte.length > 0),
    abgeschnittenAbKm: abgeschnitten ? (nah[nah.length - 1]?.entfernungKm ?? null) : null,
  }
}
