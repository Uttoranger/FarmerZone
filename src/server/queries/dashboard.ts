import { prisma } from '@/lib/prisma'
import { ANSTOSS_NACH_TAGEN, type DeinBeitrag } from '@/lib/heute'
import { AKTIVER_BEITRAG, NEUESTER_BEITRAG_ZUERST } from '@/server/queries/status-posts'
import { leseAusschnitt } from '@/schemas/bild-ausschnitt'
import { gesendeteBeitragsMails } from '@/server/mail-arten/beitrag'

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
 * Der laufende Beitrag des eigenen Hofs (Register E12, Ergänzung Nr. 129):
 * der neueste nach AKTIVER_BEITRAG — ein Beitrag nur per Mail zählt nicht,
 * denn Heute sagt „steht oben auf deiner Hofseite“ und Mein Hof nennt ihn als
 * erste Zeile „Aktuell vom Hof“. EINE Regel für beide (Runde 2): Mein Hof ruft
 * nur diese Abfrage, Heute über ladeDeinenBeitrag. Die farmId kommt aus der
 * Sitzung, nie aus der Anfrage.
 */
export async function ladeLaufendenBeitrag(farmId: string, jetzt: Date): Promise<DeinBeitrag | null> {
  const aktiv = await prisma.statusPost.findFirst({
    where: { AND: [{ farmId }, AKTIVER_BEITRAG(jetzt)] },
    orderBy: NEUESTER_BEITRAG_ZUERST,
    select: { id: true, title: true, anlass: true, photoUrl: true, fotoAusschnitt: true, publishedAt: true, expiresAt: true, createdAt: true, emailRecipientCount: true, whatsappGetippt: true },
  })
  if (!aktiv) return null
  // „n per E-Mail" aus der Warteschlange — eine Quelle (Nr. 159).
  const gesendet = await gesendeteBeitragsMails([aktiv])
  return {
    id: aktiv.id,
    titel: aktiv.title,
    anlass: aktiv.anlass,
    foto: aktiv.photoUrl,
    fotoAusschnitt: leseAusschnitt(aktiv.fotoAusschnitt),
    // Sicher: AKTIVER_BEITRAG verlangt `publishedAt: { lte: jetzt }` und schließt Entwürfe (null) aus.
    veroeffentlicht: aktiv.publishedAt!.toISOString(),
    endet: aktiv.expiresAt?.toISOString() ?? null,
    emailAnzahl: gesendet.get(aktiv.id) ?? aktiv.emailRecipientCount,
    whatsappAnzahl: aktiv.whatsappGetippt.length,
  }
}

/**
 * „Dein Beitrag“ in Heute (Register E12, Ergänzung Nr. 129): der laufende
 * Beitrag (ladeLaufendenBeitrag), dazu für den Anstoß (beitragBlock in
 * src/lib/heute.ts), ob in den letzten 14 Tagen einer veröffentlicht wurde —
 * auch einer nur per Mail, ein Entwurf nie — und ob der Hof Produkte im Shop
 * hat. Die farmId kommt aus der Sitzung, nie aus der Anfrage.
 */
export async function ladeDeinenBeitrag(
  farmId: string,
  jetzt: Date
): Promise<{ aktiv: DeinBeitrag | null; beitragInFrist: boolean; produkteImShop: boolean }> {
  const frist = new Date(jetzt.getTime() - ANSTOSS_NACH_TAGEN * 24 * 60 * 60_000)
  const [aktiv, inFrist, imShop] = await Promise.all([
    ladeLaufendenBeitrag(farmId, jetzt),
    prisma.statusPost.findFirst({ where: { farmId, publishedAt: { gte: frist, lte: jetzt } }, select: { id: true } }),
    prisma.product.findFirst({ where: { farmId, isAvailable: true }, select: { id: true } }),
  ])
  return { aktiv, beitragInFrist: inFrist !== null, produkteImShop: imShop !== null }
}
