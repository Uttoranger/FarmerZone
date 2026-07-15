/**
 * Tests für die Produkt-Reihenfolge (Sprint 17K, Vorbereitung Sortier-UI).
 *
 * Beweist: Beide Query-Pfade ordnen nach sortOrder → createdAt, mit
 * isAvailable als erstem Kriterium (ausgeblendete bleiben im Edit-Modus
 * hinter den sichtbaren).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn() },
    farm: { findUnique: vi.fn() },
  },
}))

import { getProductsForFarm, PRODUCT_ORDER_BY } from '@/server/queries/products'
import { getPublicFarm } from '@/server/queries/farm'
import { prisma } from '@/lib/prisma'

const productFindMany = vi.mocked(prisma.product.findMany)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)

beforeEach(() => {
  vi.clearAllMocks()
  productFindMany.mockResolvedValue([])
  farmFindUnique.mockResolvedValue(null)
})

describe('PRODUCT_ORDER_BY', () => {
  it('ist [isAvailable desc, sortOrder asc, createdAt asc]', () => {
    expect(PRODUCT_ORDER_BY).toEqual([
      { isAvailable: 'desc' },
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ])
  })
})

describe('Query-Pfade nutzen die Reihenfolge', () => {
  it('getProductsForFarm (Owner-Produktliste)', async () => {
    await getProductsForFarm('farm_1')
    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: PRODUCT_ORDER_BY })
    )
  })

  it('getPublicFarm (öffentliche Hof-Seite) übergibt sie im products-Include', async () => {
    await getPublicFarm('testhof')
    const arg = farmFindUnique.mock.calls[0]?.[0] as {
      select: { products: { orderBy: unknown } }
    }
    expect(arg.select.products.orderBy).toEqual(PRODUCT_ORDER_BY)
  })
})
