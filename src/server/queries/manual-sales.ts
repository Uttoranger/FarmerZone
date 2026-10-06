import { prisma } from '@/lib/prisma'
import {
  sumOnlinePaid,
  sumBarKassiert,
  sumWeekTotal,
  mergeSalesFeed,
  type SalesFeedOrder,
  type SalesFeedEntry,
} from '@/lib/sales-summary'
import { getYtdRevenue } from './analytics'
import { formatPosition } from '@/lib/format'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { umsatzBestellungWhere, umsatzfenster, umsatzVerkaufWhere } from '@/lib/umsatz'
import { meistverkaufteProdukte } from '@/lib/verkauf-eintragen'
import { centAusDecimal } from './umsatz'

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
// KEIN Schema-Change. Zeitraum der Karten: laufende Woche nach der EINEN
// Umsatzregel (src/lib/umsatz.ts) — dieselbe Zahl wie auf Heute.
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
  // Fehlende Artikel (E14) wurden nicht übergeben.
  items: { where: { fehltSeit: null }, select: { quantity: true, productName: true, product: { select: { unit: true, unitSize: true } } } },
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
    itemsLabel: o.items.map((i) => formatPosition({ name: i.productName, quantity: i.quantity, unit: i.product?.unit ?? null, unitSize: i.product?.unitSize ?? null })).join(' · '),
  }
}

export async function getSalesOverview(farmId: string, jetzt: Date = new Date()): Promise<SalesOverview> {
  const woche = umsatzfenster('woche', jetzt).aktuell

  const [weekOrders, weekSales, recentOrders, recentSales, ytdTotal] = await Promise.all([
    prisma.order.findMany({
      where: umsatzBestellungWhere(farmId, woche),
      select: PICKED_ORDER_SELECT,
    }),
    prisma.manualSale.findMany({
      where: umsatzVerkaufWhere(farmId, woche),
      select: { id: true, totalAmount: true, saleDate: true },
    }),
    prisma.order.findMany({
      where: { farmId, status: 'PICKED_UP' },
      orderBy: { pickedUpAt: 'desc' },
      take: 10,
      select: PICKED_ORDER_SELECT,
    }),
    getRecentManualSales(farmId, 10),
    getYtdRevenue(farmId, jetzt),
  ])

  // Summen in Cent (CODING_STANDARDS §2 Geld), erst zur Anzeige in Euro. Achtung:
  // totalAmount trägt hier Cent, im Feed (toFeedOrder) Euro — die Summen-
  // Funktionen rechnen einheitenlos, die Umrechnung steht nur hier.
  const weekFeedOrders = weekOrders.map((o) => ({ ...toFeedOrder(o), totalAmount: centAusDecimal(o.totalAmount) }))
  const weekFeedSales = weekSales.map((s) => ({ id: s.id, totalAmount: centAusDecimal(s.totalAmount), saleDate: s.saleDate }))

  return {
    weekTotal: centsAlsEuro(sumWeekTotal(weekFeedOrders, weekFeedSales)),
    weekOnline: centsAlsEuro(sumOnlinePaid(weekFeedOrders)),
    weekBar: centsAlsEuro(sumBarKassiert(weekFeedOrders, weekFeedSales)),
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

/**
 * Die Produkte, die der Hof in den letzten 90 Tagen am häufigsten verkauft
 * hat — für die Schnellwahl „Was?" im Verkauf-Dialog. Gezählt werden
 * abgeholte Bestellpositionen und manuelle Verkäufe mit Produkt, nach
 * derselben Umsatzregel wie überall.
 */
export async function getMeistverkaufteProduktIds(farmId: string, jetzt: Date = new Date()): Promise<string[]> {
  const fenster = { von: new Date(jetzt.getTime() - 90 * 24 * 60 * 60 * 1000), bis: jetzt }
  const [positionen, verkaeufe] = await Promise.all([
    prisma.orderItem.findMany({
      // Fehlende Artikel (E14) wurden nicht verkauft.
      where: { order: umsatzBestellungWhere(farmId, fenster), fehltSeit: null },
      select: { productId: true, totalPrice: true },
    }),
    prisma.manualSale.findMany({
      where: { ...umsatzVerkaufWhere(farmId, fenster), productId: { not: null } },
      select: { productId: true, totalAmount: true },
    }),
  ])
  return meistverkaufteProdukte([
    ...positionen.map((p) => ({ productId: p.productId, cent: centAusDecimal(p.totalPrice) })),
    ...verkaeufe.flatMap((s) => (s.productId ? [{ productId: s.productId, cent: centAusDecimal(s.totalAmount) }] : [])),
  ])
}
