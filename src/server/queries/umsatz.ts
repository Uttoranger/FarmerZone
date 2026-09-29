import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decimalZuCents } from '@/lib/order-totals'
import {
  umsatzBestellungWhere,
  umsatzVerkaufWhere,
  type UmsatzBuchung,
  type Umsatzfenster,
} from '@/lib/umsatz'

/**
 * Die Abfragen zur EINEN Umsatzregel (src/lib/umsatz.ts). Heute, Verkauf und
 * Auswertung lesen den Umsatz nur hier — Decimal wird hier einmal in Cent
 * gewandelt (CODING_STANDARDS §2 Geld).
 */

export function centAusDecimal(betrag: Prisma.Decimal | null): number {
  return betrag ? decimalZuCents(betrag) : 0
}

/** Umsatz eines Fensters in Cent: abgeholte Bestellungen plus manuelle Verkäufe. */
export async function umsatzCent(farmId: string, fenster: Umsatzfenster): Promise<number> {
  const [bestellungen, verkaeufe] = await Promise.all([
    prisma.order.aggregate({ where: umsatzBestellungWhere(farmId, fenster), _sum: { totalAmount: true } }),
    prisma.manualSale.aggregate({ where: umsatzVerkaufWhere(farmId, fenster), _sum: { totalAmount: true } }),
  ])
  return centAusDecimal(bestellungen._sum.totalAmount) + centAusDecimal(verkaeufe._sum.totalAmount)
}

/** Alle Buchungen eines Fensters, einzeln — für Balken, Kanäle und den fairen Vergleich im Speicher. */
export async function umsatzBuchungen(farmId: string, fenster: Umsatzfenster): Promise<UmsatzBuchung[]> {
  const [bestellungen, verkaeufe] = await Promise.all([
    prisma.order.findMany({
      where: umsatzBestellungWhere(farmId, fenster),
      select: { pickedUpAt: true, totalAmount: true },
    }),
    prisma.manualSale.findMany({
      where: umsatzVerkaufWhere(farmId, fenster),
      select: { saleDate: true, totalAmount: true, channel: true },
    }),
  ])
  return [
    ...bestellungen.flatMap((o): UmsatzBuchung[] =>
      // Die Bedingung verlangt pickedUpAt im Fenster — null kommt nicht zurück.
      o.pickedUpAt ? [{ quelle: 'bestellung', zeitpunkt: o.pickedUpAt, cent: centAusDecimal(o.totalAmount) }] : []
    ),
    ...verkaeufe.map(
      (s): UmsatzBuchung => ({ quelle: 'verkauf', zeitpunkt: s.saleDate, cent: centAusDecimal(s.totalAmount), kanal: s.channel })
    ),
  ]
}
