import { prisma } from '@/lib/prisma'
import {
  LOW_STOCK_THRESHOLD,
  buildLowStockHint,
  statusReminder,
  countUniqueCustomers,
} from '@/lib/dashboard-hints'
import { startOfWeek, endOfWeek, subWeeks } from 'date-fns'

export async function getDashboardStats(farmId: string) {
  const heute = new Date()
  const wochenStart = startOfWeek(heute, { weekStartsOn: 1 })
  const wochenEnde = endOfWeek(heute, { weekStartsOn: 1 })
  const prevWochenStart = startOfWeek(subWeeks(heute, 1), { weekStartsOn: 1 })
  const prevWochenEnde = endOfWeek(subWeeks(heute, 1), { weekStartsOn: 1 })

  const tagStart = new Date(heute)
  tagStart.setHours(0, 0, 0, 0)
  const tagEnde = new Date(heute)
  tagEnde.setHours(23, 59, 59, 999)

  const [
    offeneBestellungen,
    heutigeBestellungen,
    aktivProdukte,
    plattformUmsatzWoche,
    manuelleVerkaufeWoche,
    plattformUmsatzPrevWoche,
    manuelleVerkaufePrevWoche,
    bestellungenWocheCount,
    kundenRows,
    lowStockProducts,
    lastStatus,
  ] = await Promise.all([
    prisma.order.count({
      where: {
        farmId,
        status: { notIn: ['PICKED_UP', 'CANCELLED', 'NOT_PICKED_UP'] },
      },
    }),

    prisma.order.findMany({
      where: {
        farmId,
        pickupDate: { gte: tagStart, lte: tagEnde },
        status: { notIn: ['CANCELLED', 'NOT_PICKED_UP'] },
      },
      select: {
        id: true,
        customerName: true,
        pickupTimeStart: true,
        pickupTimeEnd: true,
        totalAmount: true,
        paymentMethod: true,
        status: true,
        items: { select: { productName: true, quantity: true } },
      },
      orderBy: { pickupTimeStart: 'asc' },
    }),

    prisma.product.count({
      where: { farmId, isAvailable: true },
    }),

    prisma.order.aggregate({
      where: {
        farmId,
        status: 'PICKED_UP',
        pickedUpAt: { gte: wochenStart, lte: wochenEnde },
      },
      _sum: { totalAmount: true },
    }),

    prisma.manualSale.aggregate({
      where: {
        farmId,
        saleDate: { gte: wochenStart, lte: wochenEnde },
      },
      _sum: { totalAmount: true },
    }),

    prisma.order.aggregate({
      where: {
        farmId,
        status: 'PICKED_UP',
        pickedUpAt: { gte: prevWochenStart, lte: prevWochenEnde },
      },
      _sum: { totalAmount: true },
    }),

    prisma.manualSale.aggregate({
      where: {
        farmId,
        saleDate: { gte: prevWochenStart, lte: prevWochenEnde },
      },
      _sum: { totalAmount: true },
    }),

    prisma.order.count({
      where: {
        farmId,
        createdAt: { gte: wochenStart, lte: wochenEnde },
      },
    }),
    // Kunden gesamt = eindeutige Kunden-E-Mails über alle Bestellungen
    prisma.order.findMany({
      where: { farmId },
      distinct: ['customerEmail'],
      select: { customerEmail: true },
    }),
    // Lager-Warnung: verfügbare Produkte an/unter der Low-Stock-Schwelle
    prisma.product.findMany({
      where: { farmId, isAvailable: true, stock: { lte: LOW_STOCK_THRESHOLD } },
      select: { name: true, stock: true },
      orderBy: { stock: 'asc' },
    }),
    // Status-Erinnerung: letzter veröffentlichter Status
    prisma.statusPost.findFirst({
      where: { farmId, publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true },
    }),
  ])

  const umsatzWoche =
    Number(plattformUmsatzWoche._sum.totalAmount ?? 0) +
    Number(manuelleVerkaufeWoche._sum.totalAmount ?? 0)

  const umsatzPrevWoche =
    Number(plattformUmsatzPrevWoche._sum.totalAmount ?? 0) +
    Number(manuelleVerkaufePrevWoche._sum.totalAmount ?? 0)

  const umsatzChangePercent =
    umsatzPrevWoche > 0
      ? Math.round(((umsatzWoche - umsatzPrevWoche) / umsatzPrevWoche) * 100)
      : null

  return {
    offeneBestellungen,
    heutigeBestellungen,
    aktivProdukte,
    umsatzWoche,
    umsatzPrevWoche,
    umsatzChangePercent,
    bestellungenWocheCount,
    kundenGesamt: countUniqueCustomers(kundenRows),
    lowStockHint: buildLowStockHint(lowStockProducts),
    statusReminder: statusReminder(lastStatus?.publishedAt ?? null),
  }
}

export async function getFarmForUser(userId: string) {
  return prisma.farm.findUnique({
    where: { ownerId: userId },
    select: { id: true, name: true, slug: true },
  })
}
