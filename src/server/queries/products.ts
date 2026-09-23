import { prisma } from '@/lib/prisma'
import { categoryImagePath } from '@/lib/product-image'
import type {
  Abgabe,
  Futtermittelart,
  NettoEinheit,
  Prisma,
  ProductCategory,
  ProductLabel,
  ProductSubcategory,
  Tierart,
} from '@prisma/client'

// Einheitliche Produkt-Reihenfolge (Sprint 17K): manuelle sortOrder,
// createdAt als stabile Sekundärsortierung; ausgeblendete Produkte
// bleiben hinter den sichtbaren (relevant für den Edit-Modus der Hof-Seite).
export const PRODUCT_ORDER_BY: Prisma.ProductOrderByWithRelationInput[] = [
  { isAvailable: 'desc' },
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
]

/**
 * Die Futter-Kennzeichnung, serialisiert für den Client (Datum als ISO-String,
 * Decimal als Zahl — Mengen und Prozentwerte, kein Geld).
 * registrierungsnummer ist Altlast (Rückfrage F6): nur noch als Rückfall für
 * die Anzeige, wenn der Hof keine eigene Betriebsnummer hat.
 */
export type FutterData = {
  futtermittelart: Futtermittelart
  zielTierarten: Tierart[]
  zusammensetzung: string
  analytischeBestandteile: string
  nettoMenge: number
  nettoEinheit: NettoEinheit
  rohprotein: number | null
  rohfaser: number | null
  rohfett: number | null
  rohasche: number | null
  zusatzstoffe: string | null
  registrierungsnummer: string | null
  gebrauchshinweis: string | null
  bestaetigtAm: string
}

/** Decimal → Zahl, null bleibt null. */
function alsZahlOderNull(d: Prisma.Decimal | null): number | null {
  return d === null ? null : Number(d)
}

export type ProductData = {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  category: ProductCategory | null
  subcategory: ProductSubcategory | null
  labels: ProductLabel[]
  futter: FutterData | null
  abgabe: Abgabe
  categoryImageUrl: string | null
  countsTowardLimit: boolean
  price: number
  vatRate: number
  unit: string
  unitSize: number | null
  stock: number
  reservedStock: number
  isAvailable: boolean
  allergens: string[]
  /** Abgeleitet aus labels (BIO) — die Spalte isOrganic ist Altlast. */
  isOrganic: boolean
  requiresCool: boolean
  requiresFreezer: boolean
  seasonStart: number | null
  seasonEnd: number | null
  unavailableReason: string | null
}

export async function getProductsForFarm(farmId: string): Promise<ProductData[]> {
  const products = await prisma.product.findMany({
    where: { farmId },
    orderBy: PRODUCT_ORDER_BY,
    include: { futter: true },
  })

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    category: p.category,
    subcategory: p.subcategory,
    labels: p.labels,
    futter: p.futter
      ? {
          futtermittelart: p.futter.futtermittelart,
          zielTierarten: p.futter.zielTierarten,
          zusammensetzung: p.futter.zusammensetzung,
          analytischeBestandteile: p.futter.analytischeBestandteile,
          nettoMenge: Number(p.futter.nettoMenge),
          nettoEinheit: p.futter.nettoEinheit,
          rohprotein: alsZahlOderNull(p.futter.rohprotein),
          rohfaser: alsZahlOderNull(p.futter.rohfaser),
          rohfett: alsZahlOderNull(p.futter.rohfett),
          rohasche: alsZahlOderNull(p.futter.rohasche),
          zusatzstoffe: p.futter.zusatzstoffe,
          registrierungsnummer: p.futter.registrierungsnummer,
          gebrauchshinweis: p.futter.gebrauchshinweis,
          bestaetigtAm: p.futter.bestaetigtAm.toISOString(),
        }
      : null,
    abgabe: p.abgabe,
    categoryImageUrl: categoryImagePath(p.category),
    countsTowardLimit: p.countsTowardLimit,
    price: Number(p.price),
    vatRate: Number(p.vatRate),
    unit: p.unit,
    unitSize: p.unitSize ? Number(p.unitSize) : null,
    stock: p.stock,
    reservedStock: p.reservedStock,
    isAvailable: p.isAvailable,
    allergens: p.allergens,
    isOrganic: p.labels.includes('BIO'),
    requiresCool: p.requiresCool,
    requiresFreezer: p.requiresFreezer,
    seasonStart: p.seasonStart,
    seasonEnd: p.seasonEnd,
    unavailableReason: p.unavailableReason,
  }))
}

/**
 * Die Betriebsnummer des Hofs für die Anzeige in der Futter-Kennzeichnung
 * (Sprint Bereiche 1, Rückfrage F6). Eigene kleine Abfrage statt einer
 * Erweiterung von getFarmForUser — die läuft in jedem Layout-Aufruf mit.
 */
export async function getHofBetriebsnummer(farmId: string): Promise<string | null> {
  const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { betriebsnummer: true } })
  return farm?.betriebsnummer ?? null
}

/**
 * IDs der Produkte eines Hofs, die er nur an landwirtschaftliche Betriebe
 * abgibt (Sprint Bereiche 1). Für den Checkout: Liegt eines davon im Korb,
 * zeigt er den Abschnitt „Betrieb". Öffentliche Information — und nur
 * Komfort: Der Checkout-Handler prüft die Abgabe selbst noch einmal.
 */
export async function getNurBetriebeProduktIds(farmId: string): Promise<string[]> {
  const produkte = await prisma.product.findMany({
    where: { farmId, abgabe: 'NUR_BETRIEBE' },
    select: { id: true },
  })
  return produkte.map((p) => p.id)
}

/**
 * Vorbelegung des Checkout-Abschnitts „Betrieb" (Konzept 6.4): Ist der
 * Besteller selbst ein Hof, kauft er vermutlich als Betrieb — mit der
 * Betriebsnummer aus seinen Hof-Einstellungen (Rückfrage F6). Vorbelegung,
 * kein Zwang. null, wenn der Nutzer keinen Hof hat.
 */
export async function getBetriebsVorbelegung(
  userId: string
): Promise<{ kaeuferArt: 'BETRIEB'; betriebsnummer: string } | null> {
  const farm = await prisma.farm.findUnique({ where: { ownerId: userId }, select: { betriebsnummer: true } })
  if (!farm) return null
  return { kaeuferArt: 'BETRIEB', betriebsnummer: farm.betriebsnummer ?? '' }
}
