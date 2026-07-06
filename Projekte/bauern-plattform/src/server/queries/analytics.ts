import { prisma } from '@/lib/prisma'
import { CHANNEL_LABELS } from '@/schemas/manual-sale'

export type PeriodKey = 'week' | 'month' | 'quarter' | 'year'

export type ChannelRevenue = {
  channel: string
  label: string
  amount: number
}

export type TopProduct = {
  productName: string
  totalAmount: number
  totalQuantity: number
}

export type AnalyticsData = {
  totalRevenue: number
  previousRevenue: number
  changePercent: number | null
  channelRevenue: ChannelRevenue[]
  topProducts: TopProduct[]
  insight: string | null
}

type DateRange = { from: Date; to: Date }

function getDateRanges(period: PeriodKey): { current: DateRange; previous: DateRange } {
  const now = new Date()
  // Set current time to end of today
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  if (period === 'week') {
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1 // 0=Mon
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek)
    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)
    const prevWeekEnd = new Date(weekStart)
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 1)
    prevWeekEnd.setHours(23, 59, 59, 999)
    return {
      current: { from: weekStart, to: todayEnd },
      previous: { from: prevWeekStart, to: prevWeekEnd },
    }
  }

  if (period === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    return {
      current: { from: monthStart, to: todayEnd },
      previous: { from: prevMonthStart, to: prevMonthEnd },
    }
  }

  if (period === 'quarter') {
    const qStartMonth = Math.floor(now.getMonth() / 3) * 3
    const quarterStart = new Date(now.getFullYear(), qStartMonth, 1)
    const prevQuarterStart = new Date(now.getFullYear(), qStartMonth - 3, 1)
    const prevQuarterEnd = new Date(now.getFullYear(), qStartMonth, 0, 23, 59, 59, 999)
    return {
      current: { from: quarterStart, to: todayEnd },
      previous: { from: prevQuarterStart, to: prevQuarterEnd },
    }
  }

  // year
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const prevYearStart = new Date(now.getFullYear() - 1, 0, 1)
  const prevYearEnd = new Date(now.getFullYear(), 0, 0, 23, 59, 59, 999)
  return {
    current: { from: yearStart, to: todayEnd },
    previous: { from: prevYearStart, to: prevYearEnd },
  }
}

async function fetchRevenueData(farmId: string, range: DateRange) {
  const [orders, manualSales] = await Promise.all([
    prisma.order.findMany({
      where: {
        farmId,
        status: 'PICKED_UP',
        pickedUpAt: { gte: range.from, lte: range.to },
      },
      select: {
        totalAmount: true,
        items: {
          select: {
            productId: true,
            productName: true,
            totalPrice: true,
            quantity: true,
          },
        },
      },
    }),
    prisma.manualSale.findMany({
      where: { farmId, saleDate: { gte: range.from, lte: range.to } },
      select: {
        channel: true,
        totalAmount: true,
        productId: true,
        productName: true,
        quantity: true,
      },
    }),
  ])

  return { orders, manualSales }
}

function aggregateRevenue(orders: Awaited<ReturnType<typeof fetchRevenueData>>['orders'], manualSales: Awaited<ReturnType<typeof fetchRevenueData>>['manualSales']) {
  const platformRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0)
  const channelMap: Record<string, number> = {}

  if (platformRevenue > 0) channelMap['PLATFORM'] = platformRevenue

  for (const s of manualSales) {
    channelMap[s.channel] = (channelMap[s.channel] ?? 0) + Number(s.totalAmount)
  }

  const totalRevenue = Object.values(channelMap).reduce((s, v) => s + v, 0)

  const channelRevenue: ChannelRevenue[] = Object.entries(channelMap)
    .map(([channel, amount]) => ({
      channel,
      label: CHANNEL_LABELS[channel] ?? channel,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount)

  // Top products
  const productMap: Record<string, { productName: string; totalAmount: number; totalQuantity: number }> = {}

  for (const order of orders) {
    for (const item of order.items) {
      const key = item.productId
      const prev = productMap[key] ?? { productName: item.productName, totalAmount: 0, totalQuantity: 0 }
      productMap[key] = {
        productName: item.productName,
        totalAmount: prev.totalAmount + Number(item.totalPrice),
        totalQuantity: prev.totalQuantity + item.quantity,
      }
    }
  }

  for (const s of manualSales) {
    const key = s.productId ?? `__${s.productName}`
    const prev = productMap[key] ?? { productName: s.productName, totalAmount: 0, totalQuantity: 0 }
    productMap[key] = {
      productName: s.productName,
      totalAmount: prev.totalAmount + Number(s.totalAmount),
      totalQuantity: prev.totalQuantity + Number(s.quantity),
    }
  }

  const topProducts: TopProduct[] = Object.values(productMap)
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5)

  return { totalRevenue, channelRevenue, topProducts }
}

function generateInsight(
  totalRevenue: number,
  channelRevenue: ChannelRevenue[],
  topProducts: TopProduct[]
): string | null {
  if (totalRevenue === 0) return null

  const platform = channelRevenue.find((c) => c.channel === 'PLATFORM')
  const sorted = [...channelRevenue].sort((a, b) => b.amount - a.amount)
  const topChannel = sorted[0]

  if (topChannel && topChannel.channel !== 'PLATFORM') {
    const pct = Math.round((topChannel.amount / totalRevenue) * 100)
    if (pct >= 50) {
      return `${pct} % deines Umsatzes läuft über ${topChannel.label} — stark! Wäre ein Online-Shop ein sinnvoller nächster Schritt?`
    }
  }

  if (!platform && totalRevenue > 0) {
    return `Alle Verkäufe laufen direkt ab Hof. Ein Online-Shop könnte deinen Radius erweitern.`
  }

  if (topProducts.length > 0) {
    const best = topProducts[0]
    const pct = Math.round((best.totalAmount / totalRevenue) * 100)
    if (pct >= 40) {
      return `„${best.productName}" macht ${pct} % deines Umsatzes aus — ein echter Bestseller.`
    }
  }

  return null
}

export async function getYtdRevenue(farmId: string): Promise<number> {
  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1)

  const [orders, manualSales] = await Promise.all([
    prisma.order.findMany({
      where: { farmId, status: 'PICKED_UP', pickedUpAt: { gte: yearStart } },
      select: { totalAmount: true },
    }),
    prisma.manualSale.findMany({
      where: { farmId, saleDate: { gte: yearStart } },
      select: { totalAmount: true },
    }),
  ])

  const orderRevenue = orders.reduce((s, o) => s + Number(o.totalAmount), 0)
  const manualRevenue = manualSales.reduce((s, m) => s + Number(m.totalAmount), 0)
  return orderRevenue + manualRevenue
}

export async function getAnalyticsData(farmId: string, period: PeriodKey): Promise<AnalyticsData> {
  const { current, previous } = getDateRanges(period)

  const [currentData, previousData] = await Promise.all([
    fetchRevenueData(farmId, current),
    fetchRevenueData(farmId, previous),
  ])

  const { totalRevenue, channelRevenue, topProducts } = aggregateRevenue(
    currentData.orders,
    currentData.manualSales
  )

  const { totalRevenue: previousRevenue } = aggregateRevenue(
    previousData.orders,
    previousData.manualSales
  )

  const changePercent =
    previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : null

  const insight = generateInsight(totalRevenue, channelRevenue, topProducts)

  return { totalRevenue, previousRevenue, changePercent, channelRevenue, topProducts, insight }
}
