import { prisma } from '@/lib/prisma'

export async function getFarmForUser(userId: string) {
  return prisma.farm.findUnique({
    where: { ownerId: userId },
    // `logoUrl` für die Hof-Identitätskarte in der Navigation. Bewusst nur das
    // select erweitert statt eine zweite Abfrage danebenzustellen: das Layout
    // ruft diese Funktion ohnehin bei jedem Seitenaufruf.
    // `approvedAt` fehlt hier absichtlich — es kommt aus getFarmBannerState,
    // das im Layout für die Balken bereits geladen wird.
    select: { id: true, name: true, slug: true, logoUrl: true, logoAusschnitt: true },
  })
}
