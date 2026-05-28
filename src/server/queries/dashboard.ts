import { prisma } from '@/lib/prisma'
import { startOfWeek, endOfWeek } from 'date-fns'

export async function getDashboardStats(farmId: string) {
  const heute = new Date()
  const wochenStart = startOfWeek(heute, { weekStartsOn: 1 })
  const wochenEnde = endOfWeek(heute, { weekStartsOn: 1 })

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
  ] = await Promise.all([
    // Offene Bestellungen (noch nicht abgeholt oder storniert)
    prisma.order.count({
      where: {
        farmId,
        status: { notIn: ['PICKED_UP', 'CANCELLED', 'NOT_PICKED_UP'] },
      },
    }),

    // Bestellungen für heute (als Warnung)
    prisma.order.findMany({
      where: {
        farmId,
        pickupDate: { gte: tagStart, lte: tagEnde },
        status: { notIn: ['PICKED_UP', 'CANCELLED', 'NOT_PICKED_UP'] },
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

    // Aktive Produkte
    prisma.product.count({
      where: { farmId, isAvailable: true },
    }),

    // Plattform-Umsatz diese Woche (abgeholte Bestellungen)
    prisma.order.aggregate({
      where: {
        farmId,
        status: 'PICKED_UP',
        pickedUpAt: { gte: wochenStart, lte: wochenEnde },
      },
      _sum: { totalAmount: true },
    }),

    // Manuelle Verkäufe diese Woche
    prisma.manualSale.aggregate({
      where: {
        farmId,
        saleDate: { gte: wochenStart, lte: wochenEnde },
      },
      _sum: { totalAmount: true },
    }),
  ])

  const umsatzWoche =
    Number(plattformUmsatzWoche._sum.totalAmount ?? 0) +
    Number(manuelleVerkaufeWoche._sum.totalAmount ?? 0)

  return {
    offeneBestellungen,
    heutigeBestellungen,
    aktivProdukte,
    umsatzWoche,
  }
}

export async function getFarmForUser(userId: string) {
  return prisma.farm.findUnique({
    where: { ownerId: userId },
    select: { id: true, name: true, slug: true },
  })
}
