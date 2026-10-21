import { prisma } from '@/lib/prisma'
import { ANSTOSS_NACH_TAGEN, type DeinBeitrag } from '@/lib/heute'
import { AKTIVER_BEITRAG } from '@/server/queries/status-posts'

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

/**
 * „Dein Beitrag“ in Heute (Register E12, Ergänzung Nr. 129): der neueste
 * laufende Beitrag des eigenen Hofs nach AKTIVER_BEITRAG (ein Beitrag nur per
 * Mail zählt nicht — die Karte sagt „steht oben auf deiner Hofseite“), ob in
 * den letzten 14 Tagen einer veröffentlicht wurde und ob der Hof Produkte im
 * Shop hat (beides für den Anstoß, beitragBlock in src/lib/heute.ts). Die
 * farmId kommt aus der Sitzung, nie aus der Anfrage.
 */
export async function ladeDeinenBeitrag(
  farmId: string,
  jetzt: Date
): Promise<{ aktiv: DeinBeitrag | null; beitragInFrist: boolean; produkteImShop: boolean }> {
  const frist = new Date(jetzt.getTime() - ANSTOSS_NACH_TAGEN * 24 * 60 * 60_000)
  const [aktiv, inFrist, imShop] = await Promise.all([
    prisma.statusPost.findFirst({
      where: { AND: [{ farmId }, AKTIVER_BEITRAG(jetzt)] },
      orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
      select: { id: true, title: true, anlass: true, photoUrl: true, publishedAt: true, expiresAt: true, emailRecipientCount: true, whatsappGetippt: true },
    }),
    prisma.statusPost.findFirst({ where: { farmId, publishedAt: { gte: frist, lte: jetzt } }, select: { id: true } }),
    prisma.product.findFirst({ where: { farmId, isAvailable: true }, select: { id: true } }),
  ])
  return {
    aktiv: aktiv
      ? {
          id: aktiv.id,
          titel: aktiv.title,
          anlass: aktiv.anlass,
          foto: aktiv.photoUrl,
          // Sicher: AKTIVER_BEITRAG verlangt `publishedAt: { lte: jetzt }` und schließt Entwürfe (null) aus.
          veroeffentlicht: aktiv.publishedAt!.toISOString(),
          endet: aktiv.expiresAt?.toISOString() ?? null,
          emailAnzahl: aktiv.emailRecipientCount,
          whatsappAnzahl: aktiv.whatsappGetippt.length,
        }
      : null,
    beitragInFrist: inFrist !== null,
    produkteImShop: imShop !== null,
  }
}
