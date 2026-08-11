import { prisma } from '@/lib/prisma'
import {
  LOW_STOCK_THRESHOLD,
  buildLowStockHint,
  statusReminder,
  countUniqueCustomers,
} from '@/lib/dashboard-hints'
import { ersteSchritte } from '@/lib/erste-schritte'
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
    hofStammdaten,
    produkteGesamt,
    aktiveAbholzeiten,
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

    // ── Einstiegs-Checkliste ────────────────────────────────────────────
    // Bewusst HIER im bestehenden Promise.all und nicht in einer eigenen
    // Query-Kette: die drei Abfragen laufen damit neben den übrigen elf statt
    // hinter ihnen, die Übersicht wird also nicht langsamer.
    prisma.farm.findUnique({
      where: { id: farmId },
      select: {
        description: true,
        logoUrl: true,
        bannerType: true,
        bannerUrl: true,
        stripeAccountReady: true,
        approvedAt: true,
      },
    }),
    // ALLE Produkte, nicht nur die verfügbaren: Wer ein Produkt angelegt und
    // wieder ausgeblendet hat, hat den Schritt trotzdem hinter sich.
    // (aktivProdukte weiter oben zählt bewusst nur isAvailable — das ist die
    // Kennzahl, nicht die Checkliste.)
    prisma.product.count({ where: { farmId } }),
    // Nur AKTIVE Abholzeiten: eine abgeschaltete Zeit nützt keinem Kunden,
    // der Schritt gilt damit zu Recht als offen.
    prisma.pickupSlot.count({ where: { farmId, isActive: true } }),
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
    ersteSchritte: ersteSchritte({
      // `description` ist eine Pflichtspalte (prisma/schema.prisma:165), im
      // Onboarding aber ein optionales Feld — ein Hof ohne Beschreibung trägt
      // einen leeren String, kein null. Ein `!== null` ginge hier immer durch.
      hatBeschreibung: (hofStammdaten?.description ?? '').trim().length > 0,
      hatLogo: (hofStammdaten?.logoUrl ?? '').trim().length > 0,
      // Dieselbe Bedingung, mit der die Hofseite entscheidet, ob sie ein Foto
      // oder einen Farbverlauf zeigt (farm-page-view.tsx:665–668). Ein Verlauf
      // ist die Voreinstellung und kein hochgeladenes Titelbild — der Schritt
      // heißt „hochladen" und wäre sonst für jeden Hof von Anfang an erledigt.
      hatTitelbild: hofStammdaten?.bannerType === 'PHOTO' && !!hofStammdaten?.bannerUrl,
      produkte: produkteGesamt,
      aktiveAbholzeiten,
      zahlungBereit: hofStammdaten?.stripeAccountReady === true,
    }),
    /** Für den ruhigen Zusatzsatz auf der Checklisten-Karte. */
    wartetAufFreigabe: hofStammdaten?.approvedAt == null,
  }
}

export async function getFarmForUser(userId: string) {
  return prisma.farm.findUnique({
    where: { ownerId: userId },
    // `logoUrl` für die Hof-Identitätskarte in der Navigation. Bewusst nur das
    // select erweitert statt eine zweite Abfrage danebenzustellen: das Layout
    // ruft diese Funktion ohnehin bei jedem Seitenaufruf.
    // `approvedAt` fehlt hier absichtlich — es kommt aus getFarmBannerState,
    // das im Layout für die Balken bereits geladen wird.
    select: { id: true, name: true, slug: true, logoUrl: true },
  })
}
