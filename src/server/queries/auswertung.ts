import { prisma } from '@/lib/prisma'
import {
  abholtageDesFensters,
  kennzahlen,
  servicegebuehrenImMonat,
  type Kennzahlen,
  type ServicegebuehrenMonat,
} from '@/lib/auswertung'
import { monatsgrenzenWien, monatsschluesselInWien } from '@/lib/servicegebuehr'
import { umsatzBestellungWhere, type Periodenfenster } from '@/lib/umsatz'
import { centAusDecimal } from './umsatz'

/**
 * Die Abfragen der Auswertung im neuen Design (Nachtlauf Nr. 22c). Jede fragt
 * mit `farmId` aus der Sitzung, nur lesend; Decimal wird hier einmal in Cent
 * gewandelt (CODING_STANDARDS §2), entschieden wird in src/lib/auswertung.ts.
 * Umsatz, Balken, Kanäle und Top-Produkte bleiben in ./analytics.ts.
 */

/** Kennzahlen des gewählten Zeitraums: abgeholte Bestellungen (Umsatzregel) und nicht abgeholte (Abholtag). */
export async function getKennzahlen(farmId: string, pf: Pick<Periodenfenster, 'aktuell'>): Promise<Kennzahlen> {
  const tage = abholtageDesFensters(pf)
  const [abgeholt, nichtAbgeholt] = await Promise.all([
    prisma.order.findMany({
      where: umsatzBestellungWhere(farmId, pf.aktuell),
      select: { paymentMethod: true, totalAmount: true },
    }),
    prisma.order.count({
      where: { farmId, status: 'NOT_PICKED_UP', pickupDate: { gte: tage.von, lte: tage.bis } },
    }),
  ])
  return kennzahlen(
    abgeholt.map((o) => ({ paymentMethod: o.paymentMethod, warenCents: centAusDecimal(o.totalAmount) })),
    nichtAbgeholt
  )
}

export type ServicegebuehrenDiesesMonats = ServicegebuehrenMonat & {
  /** „Oktober 2026" (Wien). */
  bezeichnung: string
}

/**
 * Die Servicegebühren des laufenden Wiener Monats — nur gelesen, aus den an
 * den Bestellungen gespeicherten Beträgen. Monat = Bestelleingang, wie die
 * Betreiber-Finanzen (`einnahmenImMonat`); welche Bestellung zählt, sagt
 * `servicegebuehrenImMonat`. Keine Neuberechnung, kein Stripe-Aufruf.
 */
export async function getServicegebuehrenMonat(farmId: string, jetzt: Date): Promise<ServicegebuehrenDiesesMonats> {
  const { von, bis, bezeichnung } = monatsgrenzenWien(jetzt)
  const bestellungen = await prisma.order.findMany({
    where: { farmId, createdAt: { gte: von, lt: bis } },
    select: {
      createdAt: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      serviceFeeCents: true,
      serviceFeeRefundedAt: true,
      platformFeeAmount: true,
    },
  })
  const summe = servicegebuehrenImMonat(
    bestellungen.map((b) => ({
      createdAt: b.createdAt,
      status: b.status,
      paymentMethod: b.paymentMethod,
      paymentStatus: b.paymentStatus,
      serviceFeeCents: b.serviceFeeCents,
      serviceFeeRefundedAt: b.serviceFeeRefundedAt,
      provisionCents: centAusDecimal(b.platformFeeAmount),
    })),
    monatsschluesselInWien(jetzt)
  )
  return { ...summe, bezeichnung }
}
