import { prisma } from '@/lib/prisma'

export type ProductData = {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
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
    orderBy: [{ isAvailable: 'desc' }, { name: 'asc' }],
  })

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
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
