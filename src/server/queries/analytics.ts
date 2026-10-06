import { prisma } from '@/lib/prisma'
import { sumCountedRevenue, type CountablePosition } from '@/lib/revenue-limit'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import {
  OHNE_PRODUKT,
  auswerten,
  einsichtSatz,
  topProdukte,
  umsatzBestellungWhere,
  umsatzfenster,
  umsatzVerkaufWhere,
  vergleichssatz,
  vergleichLabel,
  zeitraumName,
  type Balken,
  type KanalAnteil,
  type Periode,
  type ProduktPosten,
  type TopProdukt,
  type Umsatzfenster,
  type Vergleichssatz,
} from '@/lib/umsatz'
import { centAusDecimal, umsatzBuchungen } from './umsatz'

/** Alles für den Reiter „Umsatz" — nur Zahlen in Cent und fertige Sätze, nichts, was nicht serialisierbar ist. */
export type UmsatzAuswertung = {
  periode: Periode
  zurueck: number
  laufend: boolean
  zeitraum: string
  /** Legende der blassen Balken. */
  vergleichLabel: string
  summeCent: number
  vergleich: Vergleichssatz
  balken: Balken[]
  kanaele: KanalAnteil[]
  einsicht: string | null
  topProdukte: TopProdukt[]
}

export async function getUmsatzAuswertung(
  farmId: string,
  periode: Periode,
  zurueck: number,
  jetzt: Date = new Date()
): Promise<UmsatzAuswertung> {
  const pf = umsatzfenster(periode, jetzt, zurueck)
  // Ein Zug von der Vorperiode bis heute: Summe, fairer Vergleich und Balken
  // entstehen daraus im Speicher, mit derselben Regel wie die Abfrage.
  const [buchungen, top] = await Promise.all([
    umsatzBuchungen(farmId, { von: pf.vergleichGanz.von, bis: pf.aktuell.bis }),
    getTopProdukte(farmId, pf.aktuell),
  ])
  const auswertung = auswerten(buchungen, pf)

  return {
    periode,
    zurueck,
    laufend: pf.laufend,
    zeitraum: zeitraumName(pf),
    vergleichLabel: vergleichLabel(pf),
    summeCent: auswertung.summeCent,
    vergleich: vergleichssatz(pf, auswertung.summeCent, auswertung.vergleichCent),
    balken: auswertung.balken,
    kanaele: auswertung.kanaele,
    einsicht: einsichtSatz(periode, auswertung),
    topProdukte: top,
  }
}

/**
 * Die meistverkauften Produkte eines Fensters nach Betrag, mit Menge in der
 * Grundeinheit: Eine Bestellposition „3 × 2 kg" zählt 6 kg, ein manueller
 * Verkauf wird in der Einheit des Produkts eingetragen. Verkäufe ohne
 * Produktangabe fehlen hier — sie sind kein Produkt.
 */
export async function getTopProdukte(farmId: string, fenster: Umsatzfenster, anzahl = 3): Promise<TopProdukt[]> {
  const [positionen, verkaeufe] = await Promise.all([
    prisma.orderItem.findMany({
      // Fehlende Artikel (E14) wurden nicht verkauft — sie zählen nicht.
      where: { order: umsatzBestellungWhere(farmId, fenster), fehltSeit: null },
      select: {
        productId: true,
        productName: true,
        quantity: true,
        totalPrice: true,
        product: { select: { unit: true, unitSize: true } },
      },
    }),
    prisma.manualSale.findMany({
      where: { ...umsatzVerkaufWhere(farmId, fenster), NOT: { productId: null, productName: OHNE_PRODUKT } },
      select: {
        productId: true,
        productName: true,
        quantity: true,
        unit: true,
        totalAmount: true,
        product: { select: { name: true, unit: true } },
      },
    }),
  ])

  const posten: ProduktPosten[] = [
    ...positionen.map((p) => ({
      schluessel: p.productId,
      name: p.productName,
      cent: centAusDecimal(p.totalPrice),
      // Menge ist Anzeige, kein Geld — als Zahl zulässig.
      menge: p.quantity * (p.product.unitSize ? Number(p.product.unitSize.toString()) : 1),
      einheit: p.product.unit,
    })),
    ...verkaeufe.map((s) => ({
      schluessel: s.productId ?? `frei:${s.productName.trim().toLowerCase()}`,
      name: s.product?.name ?? s.productName,
      cent: centAusDecimal(s.totalAmount),
      menge: Number(s.quantity.toString()),
      einheit: s.unit ?? s.product?.unit ?? null,
    })),
  ]
  return topProdukte(posten, anzahl)
}

// Grenzwert-Summe (55k-Karte): Positionen, deren Produkt als Urproduktion
// markiert ist (countsTowardLimit=false), zählen nicht; Positionen/Verkäufe
// OHNE Produktbezug zählen weiter (konservativ). Das Jahr ist das Wiener
// Kalenderjahr, gezählt nach der Umsatzregel (src/lib/umsatz.ts).
export async function getYtdRevenue(farmId: string, jetzt: Date = new Date()): Promise<number> {
  const jahr = umsatzfenster('jahr', jetzt).aktuell

  const [orders, manualSales] = await Promise.all([
    prisma.order.findMany({
      where: umsatzBestellungWhere(farmId, jahr),
      select: {
        items: {
          // Fehlende Artikel (E14) wurden nicht verkauft — sie zählen nicht.
          where: { fehltSeit: null },
          select: {
            totalPrice: true,
            product: { select: { countsTowardLimit: true } },
          },
        },
      },
    }),
    prisma.manualSale.findMany({
      where: umsatzVerkaufWhere(farmId, jahr),
      select: {
        totalAmount: true,
        product: { select: { countsTowardLimit: true } },
      },
    }),
  ])

  // In Cent summiert, erst am Ende in Euro — sonst summieren sich Rundungsfehler.
  const positions: CountablePosition[] = [
    ...orders.flatMap((o) =>
      o.items.map((i) => ({
        amount: centAusDecimal(i.totalPrice),
        countsTowardLimit: i.product?.countsTowardLimit ?? null,
      }))
    ),
    ...manualSales.map((m) => ({
      amount: centAusDecimal(m.totalAmount),
      countsTowardLimit: m.product?.countsTowardLimit ?? null,
    })),
  ]

  return centsAlsEuro(sumCountedRevenue(positions))
}
