import { prisma } from '@/lib/prisma'
import { fasseTeilenWirkungZusammen, type TeilenWirkung, type TeilenZeitraum } from '@/lib/teilen-wirkung'

/**
 * Die Teilen-Wirkung eines Hofs in einem Zeitraum (Gate 7 Aufgabe 4) — die
 * Abfrage, die die Auswertungs-Karte „Über deine geteilten Links" (Nr. 22c)
 * und die Teilen-Zeile auf Heute brauchen. Liest NUR die Zähler je Kanal und
 * Tag dieses Hofs (`farmId` in der Bedingung), nie eine Bestellung, nie eine
 * Person (S8). Die Zusammenfassung rechnet `fasseTeilenWirkungZusammen`.
 *
 * `von` und `bis` sind Wiener Kalendertage, beide eingeschlossen — genau die
 * Tage, auf die `teilenTag` zählt.
 */
export async function getTeilenWirkung(farmId: string, zeitraum: TeilenZeitraum): Promise<TeilenWirkung> {
  const zeilen = await prisma.teilenAufruf.groupBy({
    by: ['kanal'],
    where: {
      farmId,
      tag: { gte: new Date(`${zeitraum.von}T00:00:00.000Z`), lte: new Date(`${zeitraum.bis}T00:00:00.000Z`) },
    },
    _sum: { besuche: true, bestellungen: true },
  })
  return fasseTeilenWirkungZusammen(
    zeilen.map((z) => ({ kanal: z.kanal, besuche: z._sum.besuche ?? 0, bestellungen: z._sum.bestellungen ?? 0 }))
  )
}
