import { prisma } from '@/lib/prisma'
import { fristVon, tagInWorten, uhrzeitInWien } from '@/lib/fristen'
import { bestaetigungOffenSatz } from '@/lib/hof-bestellungen'
import type { HofBestellDetail } from '@/server/queries/orders'

/**
 * Bis wann die Kundin eine Bar-Bestellung bestätigen muss — der Satz für die
 * Bestellung im Hofbereich (V87: die Frist kommt immer aus fristVon, nie als
 * eigene Zahl). Nur bei „Bestätigung offen“; sonst null, ohne Abfrage. Die
 * Seite liest dafür die vier Felder der Frist nach ID UND Hof (eine fremde ID
 * findet nichts) — die Bestellung selbst bleibt die aus getHofBestellDetail.
 */
export async function barFristSatz(farmId: string, detail: HofBestellDetail, jetzt: Date): Promise<string | null> {
  if (detail.status !== 'PENDING_CONFIRMATION' || !detail.vorOrt) return null
  const frist = await prisma.order.findFirst({
    where: { id: detail.id, farmId },
    select: { paymentMethod: true, createdAt: true, pickupDate: true, pickupTimeStart: true },
  })
  if (!frist) return null
  const bis = fristVon(frist)
  return bestaetigungOffenSatz(detail.kunde.vorname, `${tagInWorten(bis, jetzt)}, ${uhrzeitInWien(bis)} Uhr`)
}
