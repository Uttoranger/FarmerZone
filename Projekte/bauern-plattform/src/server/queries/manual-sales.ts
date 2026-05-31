import { prisma } from '@/lib/prisma'

export type ManualSaleData = {
  id: string
  productId: string | null
  productName: string
  quantity: number
  unit: string | null
  totalAmount: number
  channel: string
  saleDate: Date
  note: string | null
}

export async function getRecentManualSales(farmId: string, limit = 20): Promise<ManualSaleData[]> {
  const sales = await prisma.manualSale.findMany({
    where: { farmId },
    orderBy: { saleDate: 'desc' },
    take: limit,
  })

  return sales.map((s) => ({
    id: s.id,
    productId: s.productId,
    productName: s.productName,
    quantity: Number(s.quantity),
    unit: s.unit,
    totalAmount: Number(s.totalAmount),
    channel: s.channel,
    saleDate: s.saleDate,
    note: s.note,
  }))
}
