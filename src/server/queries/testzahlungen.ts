import { prisma } from '@/lib/prisma'
import { STRIPE_LIVE_AB } from '@/lib/umgebung-server'
import { testzahlungWhere, testzahlungenHinweis } from '@/lib/testzahlung'

/**
 * Die leise Zeile „Testzahlungen vor dem … sind nicht mitgezählt." auf den
 * Seiten eines Hofs (Auswertung, Verkäufe; Register Z4, Nr. 55) — nur, wenn
 * der Stichtag gesetzt ist UND Bestellungen betrifft, die die Seite sonst
 * gezählt hätte: Testzahlungen dieses Hofs, nicht storniert, abgeholt oder
 * angelegt ab `seit` (dem frühesten Zeitpunkt, den die Seite zeigt). So
 * verschwindet die Zeile von selbst, sobald die Testzeit aus allen gezeigten
 * Zeiträumen gefallen ist. Eine Zeile reicht als Antwort (findFirst).
 */
export async function testzahlungenHinweisFuerHof(
  farmId: string,
  seit: Date,
  stripeLiveAb: Date | null = STRIPE_LIVE_AB
): Promise<string | null> {
  if (stripeLiveAb === null) return null
  const betroffen = await prisma.order.findFirst({
    where: {
      farmId,
      ...testzahlungWhere(stripeLiveAb),
      status: { not: 'CANCELLED' },
      OR: [{ pickedUpAt: { gte: seit } }, { createdAt: { gte: seit } }],
    },
    select: { id: true },
  })
  return betroffen ? testzahlungenHinweis(stripeLiveAb) : null
}
