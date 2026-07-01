import { prisma } from '@/lib/prisma'

export type CustomerStatus =
  | 'Stammkunde'
  | 'Diesen Monat aktiv'
  | 'Lange nicht gesehen'
  | 'Neu'
  | null

export interface CustomerSummary {
  customerEmail: string
  customerName: string
  customerPhone: string
  orderCount: number
  totalSpent: number
  firstOrderDate: string
  lastOrderDate: string
  daysSinceLastOrder: number
  lastOrderLabel: string
  lastOrderShort: string
  isSubscribed: boolean
  topProducts: { name: string; count: number }[]
  status: CustomerStatus
  isStammkunde: boolean
  isDiesenMonatAktiv: boolean
  isLangeNichtGesehen: boolean
  isNeu: boolean
}

export interface CustomerOrderSummary {
  id: string
  orderNumber: string
  createdAt: string
  pickupDate: string
  totalAmount: number
  status: string
  items: { productName: string; quantity: number }[]
}

export interface CustomerDetail extends CustomerSummary {
  recentOrders: CustomerOrderSummary[]
  subscription: { optInEmail: boolean; optInWhatsApp: boolean } | null
}

function computeStatus(
  orderCount: number,
  daysSinceLastOrder: number,
  firstOrderDaysAgo: number
): CustomerStatus {
  if (orderCount >= 3) return 'Stammkunde'
  if (orderCount === 1 && firstOrderDaysAgo < 14) return 'Neu'
  if (orderCount >= 2 && daysSinceLastOrder > 60) return 'Lange nicht gesehen'
  if (daysSinceLastOrder <= 30) return 'Diesen Monat aktiv'
  return null
}

export async function getCustomersForFarm(farmId: string): Promise<CustomerSummary[]> {
  const [orders, subscriptions] = await Promise.all([
    prisma.order.findMany({
      where: { farmId },
      select: {
        customerEmail: true,
        customerName: true,
        customerPhone: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        items: { select: { productName: true, quantity: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.customerFarmSubscription.findMany({
      where: { farmId },
      select: { customerEmail: true, optInEmail: true, optInWhatsApp: true },
    }),
  ])

  const subscriptionMap = new Map(
    subscriptions.map((s) => [s.customerEmail.toLowerCase(), s])
  )

  const customerMap = new Map<string, typeof orders>()
  for (const order of orders) {
    const key = order.customerEmail.toLowerCase()
    if (!customerMap.has(key)) customerMap.set(key, [])
    customerMap.get(key)!.push(order)
  }

  const now = new Date()
  const result: CustomerSummary[] = []

  for (const [emailKey, customerOrders] of customerMap) {
    const sorted = [...customerOrders].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    )
    const firstOrder = sorted[0]
    const lastOrder = sorted[sorted.length - 1]

    const totalSpent = customerOrders
      .filter((o) => o.status !== 'CANCELLED' && o.status !== 'NOT_PICKED_UP')
      .reduce((sum, o) => sum + Number(o.totalAmount), 0)

    const productCounts = new Map<string, number>()
    for (const order of customerOrders) {
      if (order.status === 'CANCELLED') continue
      for (const item of order.items) {
        productCounts.set(
          item.productName,
          (productCounts.get(item.productName) ?? 0) + item.quantity
        )
      }
    }
    const topProducts = [...productCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }))

    const daysSinceLastOrder = Math.floor(
      (now.getTime() - lastOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    )
    const firstOrderDaysAgo = Math.floor(
      (now.getTime() - firstOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    )

    const lastOrderLabel =
      daysSinceLastOrder === 0
        ? 'heute bestellt'
        : daysSinceLastOrder === 1
        ? 'gestern bestellt'
        : `zuletzt vor ${daysSinceLastOrder} Tagen`

    const lastOrderShort =
      daysSinceLastOrder === 0
        ? 'heute'
        : daysSinceLastOrder === 1
        ? 'gestern'
        : `vor ${daysSinceLastOrder} Tagen`

    const sub = subscriptionMap.get(emailKey)
    const isSubscribed = !!(sub?.optInEmail || sub?.optInWhatsApp)
    const orderCount = customerOrders.length
    const status = computeStatus(orderCount, daysSinceLastOrder, firstOrderDaysAgo)

    result.push({
      customerEmail: lastOrder.customerEmail,
      customerName: lastOrder.customerName,
      customerPhone: lastOrder.customerPhone,
      orderCount,
      totalSpent,
      firstOrderDate: firstOrder.createdAt.toISOString(),
      lastOrderDate: lastOrder.createdAt.toISOString(),
      daysSinceLastOrder,
      lastOrderLabel,
      lastOrderShort,
      isSubscribed,
      topProducts,
      status,
      isStammkunde: orderCount >= 3,
      isDiesenMonatAktiv: daysSinceLastOrder <= 30,
      isLangeNichtGesehen: orderCount >= 2 && daysSinceLastOrder > 60,
      isNeu: orderCount === 1 && firstOrderDaysAgo < 14,
    })
  }

  result.sort((a, b) => b.orderCount - a.orderCount)
  return result
}

export async function getCustomerDetail(
  farmId: string,
  customerEmail: string
): Promise<CustomerDetail | null> {
  const [orders, subscription] = await Promise.all([
    prisma.order.findMany({
      where: {
        farmId,
        customerEmail: { equals: customerEmail, mode: 'insensitive' },
      },
      select: {
        id: true,
        orderNumber: true,
        customerEmail: true,
        customerName: true,
        customerPhone: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        pickupDate: true,
        items: { select: { productName: true, quantity: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.customerFarmSubscription.findFirst({
      where: {
        farmId,
        customerEmail: { equals: customerEmail, mode: 'insensitive' },
      },
      select: { optInEmail: true, optInWhatsApp: true },
    }),
  ])

  if (orders.length === 0) return null

  const sorted = [...orders].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  )
  const firstOrder = sorted[0]
  const lastOrder = sorted[sorted.length - 1]

  const totalSpent = orders
    .filter((o) => o.status !== 'CANCELLED' && o.status !== 'NOT_PICKED_UP')
    .reduce((sum, o) => sum + Number(o.totalAmount), 0)

  const productCounts = new Map<string, number>()
  for (const order of orders) {
    if (order.status === 'CANCELLED') continue
    for (const item of order.items) {
      productCounts.set(
        item.productName,
        (productCounts.get(item.productName) ?? 0) + item.quantity
      )
    }
  }
  const topProducts = [...productCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }))

  const now = new Date()
  const daysSinceLastOrder = Math.floor(
    (now.getTime() - lastOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  )
  const firstOrderDaysAgo = Math.floor(
    (now.getTime() - firstOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  )

  const lastOrderLabel =
    daysSinceLastOrder === 0
      ? 'heute bestellt'
      : daysSinceLastOrder === 1
      ? 'gestern bestellt'
      : `zuletzt vor ${daysSinceLastOrder} Tagen`

  const lastOrderShort =
    daysSinceLastOrder === 0
      ? 'heute'
      : daysSinceLastOrder === 1
      ? 'gestern'
      : `vor ${daysSinceLastOrder} Tagen`

  const isSubscribed = !!(subscription?.optInEmail || subscription?.optInWhatsApp)
  const orderCount = orders.length
  const status = computeStatus(orderCount, daysSinceLastOrder, firstOrderDaysAgo)

  return {
    customerEmail: lastOrder.customerEmail,
    customerName: lastOrder.customerName,
    customerPhone: lastOrder.customerPhone,
    orderCount,
    totalSpent,
    firstOrderDate: firstOrder.createdAt.toISOString(),
    lastOrderDate: lastOrder.createdAt.toISOString(),
    daysSinceLastOrder,
    lastOrderLabel,
    lastOrderShort,
    isSubscribed,
    topProducts,
    status,
    isStammkunde: orderCount >= 3,
    isDiesenMonatAktiv: daysSinceLastOrder <= 30,
    isLangeNichtGesehen: orderCount >= 2 && daysSinceLastOrder > 60,
    isNeu: orderCount === 1 && firstOrderDaysAgo < 14,
    recentOrders: orders.slice(0, 10).map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      createdAt: o.createdAt.toISOString(),
      pickupDate: o.pickupDate.toISOString(),
      totalAmount: Number(o.totalAmount),
      status: o.status,
      items: o.items,
    })),
    subscription: subscription ?? null,
  }
}
