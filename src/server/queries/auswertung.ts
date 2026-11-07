import { prisma } from '@/lib/prisma'
import { STRIPE_LIVE_AB } from '@/lib/umgebung-server'
import {
  abholtageDesFensters,
  kennzahlen,
  servicegebuehrenImMonat,
  type Kennzahlen,
  type ServicegebuehrenMonat,
} from '@/lib/auswertung'
import { monatsgrenzenWien, monatsschluesselInWien } from '@/lib/servicegebuehr'
import { umsatzBestellungWhere, type Periodenfenster, type Umsatzfenster } from '@/lib/umsatz'
import { centAusDecimal } from './umsatz'

/**
 * Die Abfragen der Auswertung im neuen Design (Nachtlauf Nr. 22c). Jede fragt
 * mit `farmId` aus der Sitzung, nur lesend; Decimal wird hier einmal in Cent
 * gewandelt (CODING_STANDARDS §2), entschieden wird in src/lib/auswertung.ts.
 * Umsatz, Balken, Kanäle und Top-Produkte bleiben in ./analytics.ts.
 */

/**
 * Kennzahlen des gewählten Zeitraums: abgeholte Bestellungen (Umsatzregel,
 * ohne Testzahlungen vor `stripeLiveAb`, Register Z4) und nicht abgeholte
 * (Abholtag).
 */
export async function getKennzahlen(
  farmId: string,
  pf: Pick<Periodenfenster, 'aktuell'>,
  stripeLiveAb: Date | null = STRIPE_LIVE_AB
): Promise<Kennzahlen> {
  const tage = abholtageDesFensters(pf)
  const [abgeholt, nichtAbgeholt] = await Promise.all([
    prisma.order.findMany({
      where: umsatzBestellungWhere(farmId, pf.aktuell, stripeLiveAb),
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
 * `servicegebuehrenImMonat` (Testzahlungen vor `stripeLiveAb` nie,
 * Register Z4). Keine Neuberechnung, kein Stripe-Aufruf.
 */
export async function getServicegebuehrenMonat(
  farmId: string,
  jetzt: Date,
  stripeLiveAb: Date | null = STRIPE_LIVE_AB
): Promise<ServicegebuehrenDiesesMonats> {
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
    monatsschluesselInWien(jetzt),
    stripeLiveAb
  )
  return { ...summe, bezeichnung }
}

/** Die Gebühren des gewählten Zeitraums — dieselben Felder wie die Monatskarte, ohne Monatsschlüssel. */
export type GebuehrenImZeitraum = Omit<ServicegebuehrenMonat, 'monat'>

/**
 * Die Gebühren des GEWÄHLTEN Zeitraums der Auswertung (Woche, Monat, Jahr;
 * Liste Lauf 32 auswertung „Woche zeigt die Gebühr des Monats“, Nr. 251) —
 * reine Anzeige-Abfrage, nur gelesen. Sie ändert keine Summe der
 * Monatsabrechnung und rechnet nichts neu: Gezählt wird mit derselben Regel
 * wie die Monatskarte und die Betreiber-Finanzen, `servicegebuehrenImMonat`
 * (Topf je Bestellung nach `topfVonBestellung`, gespeicherte
 * `serviceFeeCents`, Testzahlungen vor `stripeLiveAb` nie). Die Datenbank
 * liefert nur die Bestellungen, die im Fenster EINGEGANGEN sind (`createdAt`,
 * wie der Monat der Abrechnung); je Wiener Monat, den das Fenster berührt,
 * zählt die Regel ihren Teil, und die Teile werden addiert — jede Bestellung
 * liegt in genau einem Monat, also zählt keine doppelt. Für den ganzen Monat
 * ergibt das dieselbe Zahl wie `getServicegebuehrenMonat`.
 */
export async function getServicegebuehrenZeitraum(
  farmId: string,
  fenster: Umsatzfenster,
  stripeLiveAb: Date | null = STRIPE_LIVE_AB
): Promise<GebuehrenImZeitraum> {
  const bestellungen = await prisma.order.findMany({
    where: { farmId, createdAt: { gte: fenster.von, lte: fenster.bis } },
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
  const zeilen = bestellungen.map((b) => ({
    createdAt: b.createdAt,
    status: b.status,
    paymentMethod: b.paymentMethod,
    paymentStatus: b.paymentStatus,
    serviceFeeCents: b.serviceFeeCents,
    serviceFeeRefundedAt: b.serviceFeeRefundedAt,
    provisionCents: centAusDecimal(b.platformFeeAmount),
  }))
  const summe: GebuehrenImZeitraum = { onlineCents: 0, onlineAnzahl: 0, vorOrtCents: 0, vorOrtAnzahl: 0, summeCents: 0 }
  for (const monat of new Set(zeilen.map((z) => monatsschluesselInWien(z.createdAt)))) {
    const teil = servicegebuehrenImMonat(zeilen, monat, stripeLiveAb)
    summe.onlineCents += teil.onlineCents
    summe.onlineAnzahl += teil.onlineAnzahl
    summe.vorOrtCents += teil.vorOrtCents
    summe.vorOrtAnzahl += teil.vorOrtAnzahl
    summe.summeCents += teil.summeCents
  }
  return summe
}
