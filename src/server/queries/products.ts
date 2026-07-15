import { prisma } from '@/lib/prisma'
import { categoryImagePath } from '@/lib/product-image'
import type { Prisma, ProductCategory } from '@prisma/client'

// Einheitliche Produkt-Reihenfolge (Sprint 17K): manuelle sortOrder,
// createdAt als stabile Sekundärsortierung; ausgeblendete Produkte
// bleiben hinter den sichtbaren (relevant für den Edit-Modus der Hof-Seite).
export const PRODUCT_ORDER_BY: Prisma.ProductOrderByWithRelationInput[] = [
  { isAvailable: 'desc' },
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
]

export type ProductData = {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  category: ProductCategory | null
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
  })

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    category: p.category,
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
    isOrganic: p.isOrganic,
    requiresCool: p.requiresCool,
    requiresFreezer: p.requiresFreezer,
    seasonStart: p.seasonStart,
    seasonEnd: p.seasonEnd,
    unavailableReason: p.unavailableReason,
  }))
}
