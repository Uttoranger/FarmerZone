import { prisma } from '@/lib/prisma'
import { abholWhere, naechstesAbholfenster, wienerTag, type NaechstesFenster } from '@/lib/heute'

/**
 * Das nächste Abholfenster laut Abholzeiten samt der Zahl seiner Bestellungen —
 * für die leeren Zustände von „Heute abholen" (Bestellungen) und der Packliste
 * auf Papier (Boards s1-bestellungen, s2-druck). Gezählt über abholWhere,
 * dieselbe Bedingung wie die Packliste; ohne aktive Abholzeit null.
 */
export async function naechstesFensterMitZahl(farmId: string, jetzt: Date): Promise<{ fenster: NaechstesFenster; anzahl: number } | null> {
  const slots = await prisma.pickupSlot.findMany({
    where: { farmId, isActive: true },
    select: { dayOfWeek: true, startTime: true, endTime: true },
  })
  const fenster = naechstesAbholfenster(slots, jetzt)
  if (!fenster) return null
  const anzahl = await prisma.order.count({ where: abholWhere(farmId, wienerTag(fenster.tag)) })
  return { fenster, anzahl }
}
