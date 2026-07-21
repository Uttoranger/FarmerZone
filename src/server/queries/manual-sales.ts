import { prisma } from '@/lib/prisma'
import { startOfWeek, endOfWeek } from 'date-fns'
import {
  sumOnlinePaid,
  sumBarKassiert,
  sumWeekTotal,
  mergeSalesFeed,
  type SalesFeedOrder,
  type SalesFeedEntry,
} from '@/lib/sales-summary'
import { getYtdRevenue } from './analytics'
import { formatOrderLine } from '@/lib/order-line'

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

// Verkauf 2: Wochen-Summen (Online/Bar), Gesamt (YTD) und die vereinte
// "Letzte Verkäufe"-Liste — Unterscheidung rein über stripePaymentIntentId,
// KEIN Schema-Change. Zeitraum der Karten: laufende Woche (Mo–So), dieselbe
// Wochen-Definition wie das Dashboard.
export type SalesOverview = {
  weekTotal: number
  weekOnline: number
  weekBar: number
  ytdTotal: number
  feed: SalesFeedEntry<ManualSaleData>[]
}

const PICKED_ORDER_SELECT = {
  id: true,
  orderNumber: true,
  customerName: true,
  status: true,
  totalAmount: true,
  stripePaymentIntentId: true,
  pickedUpAt: true,
  items: { select: { quantity: true, productName: true, product: { select: { unit: true, unitSize: true } } } },
} as const

type PickedOrderRow = {
  id: string
  orderNumber: string
  customerName: string
  status: string
  totalAmount: { toString(): string }
  stripePaymentIntentId: string | null
  pickedUpAt: Date | null
  items: { quantity: number; productName: string; product: { unit: string; unitSize: { toString(): string } | null } | null }[]
}

function toFeedOrder(o: PickedOrderRow): SalesFeedOrder {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    status: o.status,
    totalAmount: Number(o.totalAmount),
    stripePaymentIntentId: o.stripePaymentIntentId,
    pickedUpAt: o.pickedUpAt,
    itemsLabel: o.items.map((i) => formatOrderLine(i, i.product)).join(', '),
  }
}

export async function getSalesOverview(farmId: string): Promise<SalesOverview> {
  const now = new Date()
  const wochenStart = startOfWeek(now, { weekStartsOn: 1 })
  const wochenEnde = endOfWeek(now, { weekStartsOn: 1 })

  const [weekOrders, weekSales, recentOrders, recentSales, ytdTotal] = await Promise.all([
    prisma.order.findMany({
      where: { farmId, status: 'PICKED_UP', pickedUpAt: { gte: wochenStart, lte: wochenEnde } },
      select: PICKED_ORDER_SELECT,
    }),
    prisma.manualSale.findMany({
      where: { farmId, saleDate: { gte: wochenStart, lte: wochenEnde } },
      select: { id: true, totalAmount: true, saleDate: true },
    }),
    prisma.order.findMany({
      where: { farmId, status: 'PICKED_UP' },
      orderBy: { pickedUpAt: 'desc' },
      take: 10,
      select: PICKED_ORDER_SELECT,
    }),
    getRecentManualSales(farmId, 10),
    getYtdRevenue(farmId),
  ])

  const weekFeedOrders = weekOrders.map(toFeedOrder)
  const weekFeedSales = weekSales.map((s) => ({ id: s.id, totalAmount: Number(s.totalAmount), saleDate: s.saleDate }))

  return {
    weekTotal: sumWeekTotal(weekFeedOrders, weekFeedSales),
    weekOnline: sumOnlinePaid(weekFeedOrders),
    weekBar: sumBarKassiert(weekFeedOrders, weekFeedSales),
    ytdTotal,
    feed: mergeSalesFeed(recentOrders.map(toFeedOrder), recentSales, 10),
  }
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
