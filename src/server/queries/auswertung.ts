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
import { eimerDerPeriode, summeCent, umsatzBestellungWhere, zaehlt, type Periodenfenster, type Umsatzfenster } from '@/lib/umsatz'
import { abholWhere, abholtage, hofWartetAufFreigabe } from '@/lib/heute'
import { wienKalendertag } from '@/lib/kalender'
import type { GebuehrHofStand } from '@/lib/auswertung'
import { ladeGruendungBis } from './admin'
import { centAusDecimal, umsatzBuchungen } from './umsatz'

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

/** Was die Auswertung vom eigenen Hof braucht (Nr. 273). */
export type AuswertungHof = {
  /** Für den Erklärsatz der Gebühren-Karte je Stand. */
  gebuehrStand: GebuehrHofStand
  /** Noch nicht freigegeben (`hofWartetAufFreigabe`, wie Heute): die Links-Karte sagt, ab wann Teilen geht. */
  wartetAufFreigabe: boolean
}

/**
 * Der Hof für die Auswertung (Nr. 273): Satz (`plattformgebuehrProzent`, null = Vorgabe), eigener
 * Einzugsbeginn und — nur ohne ihn — das wirksame Gründungsende, wie getProdukteSeite und die Bestellung
 * (`ladeGruendungBis`); dazu, ob der Hof noch auf die Freigabe wartet. Nur gelesen, nur der Hof der Sitzung;
 * null, wenn es ihn nicht gibt.
 */
export async function getAuswertungHof(farmId: string): Promise<AuswertungHof | null> {
  const hof = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { plattformgebuehrProzent: true, einzugAb: true, approvedAt: true, archivedAt: true },
  })
  if (!hof) return null
  const gruendungBis = hof.einzugAb ? null : await ladeGruendungBis({ id: farmId })
  return {
    gebuehrStand: { hof: { plattformgebuehrProzent: hof.plattformgebuehrProzent, einzugAb: hof.einzugAb }, gruendungBis },
    wartetAufFreigabe: hofWartetAufFreigabe(hof),
  }
}

/** Was die Umsatzkarte zusätzlich zur Auswertung zeigt (Nr. 273): Vergleichsbetrag und Stoff für den Fußsatz. */
export type UmsatzZusatz = {
  /** Die Vorperiode bis zum selben Zeitpunkt, in Cent — der Betrag in Klammern hinter dem Prozentsatz. */
  vergleichCent: number
  /** Woche: die Tage (Kürzel der Balken), an denen ein selbst eingetragener Verkauf im Balken steckt; sonst leer. */
  selbstEingetrageneTage: string[]
  /** Laufende Woche: wie viele Bestellungen heute abgeholt werden (dieselbe Bedingung wie Heute); sonst null. */
  heuteAbholen: number | null
}

/**
 * Der Zusatz der Umsatzkarte (Liste Lauf 32 auswertung „Vergleichszeile ohne Betrag; Fußsatz fehlt“, Nr. 273).
 * Der Vergleichsbetrag nimmt dieselben Buchungen und dieselbe Summe wie `auswerten` für den Prozentsatz
 * (`umsatzBuchungen`, `summeCent` über `pf.vergleich`); die selbst eingetragenen Tage dieselben Balken
 * (`eimerDerPeriode`) wie das Diagramm; „heute abholen“ dieselbe Bedingung wie Heute (`abholWhere`).
 * Nur Anzeige, nur gelesen, nur der Hof der Sitzung.
 */
export async function getUmsatzZusatz(
  farmId: string,
  pf: Periodenfenster,
  jetzt: Date,
  stripeLiveAb: Date | null = STRIPE_LIVE_AB
): Promise<UmsatzZusatz> {
  const woche = pf.periode === 'woche'
  const [vorher, diese, heuteAbholen] = await Promise.all([
    umsatzBuchungen(farmId, pf.vergleich, stripeLiveAb),
    woche ? umsatzBuchungen(farmId, pf.aktuell, stripeLiveAb) : Promise.resolve([]),
    woche && pf.laufend ? prisma.order.count({ where: abholWhere(farmId, abholtage(jetzt).heute) }) : Promise.resolve(null),
  ])
  const verkaufsTage = new Set(diese.filter((b) => b.quelle === 'verkauf' && zaehlt(b, pf.aktuell)).map((b) => wienKalendertag(b.zeitpunkt)))
  return {
    vergleichCent: summeCent(vorher, pf.vergleich),
    selbstEingetrageneTage: eimerDerPeriode(pf.periode, pf.startTag)
      .filter((e) => [...verkaufsTage].some((tag) => tag >= e.vonTag && tag <= e.bisTag))
      .map((e) => e.label),
    heuteAbholen,
  }
}
