import { prisma } from '@/lib/prisma'

const ORDER_INCLUDE = {
  items: {
    select: {
      id: true,
      productId: true,
      productName: true,
      quantity: true,
      unitPrice: true,
      totalPrice: true,
    },
  },
} as const

type RawOrder = Awaited<ReturnType<typeof fetchOrders>>[number]

function serialize(order: RawOrder) {
  return {
    ...order,
    totalAmount: Number(order.totalAmount),
    platformFeeAmount: Number(order.platformFeeAmount),
    items: order.items.map((i) => ({
      ...i,
      unitPrice: Number(i.unitPrice),
      totalPrice: Number(i.totalPrice),
    })),
  }
}

async function fetchOrders(farmId: string) {
  return prisma.order.findMany({
    where: { farmId },
    include: ORDER_INCLUDE,
    orderBy: [{ pickupDate: 'asc' }, { pickupTimeStart: 'asc' }],
  })
}

async function fetchOrder(farmId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, farmId },
    include: ORDER_INCLUDE,
  })
}

export type FarmerOrder = ReturnType<typeof serialize>
export type FarmerOrderDetail = FarmerOrder

export async function getOrdersForFarm(farmId: string) {
  const rows = await fetchOrders(farmId)
  return rows.map(serialize)
}

export async function getOrderDetail(farmId: string, orderId: string) {
  const row = await fetchOrder(farmId, orderId)
  return row ? serialize(row) : null
}
