// Betragsberechnung des Checkouts — extrahiert aus /api/checkout, damit die
// Rundungslogik unit-testbar ist. Die Formeln sind 1:1 identisch zum
// bisherigen Inline-Code; Beträge sind Euro-Werte, Stripe bekommt Cents.
//
// Decimal aus dem Browser-Einstieg der Prisma-Runtime: Diese Datei läuft auch
// im Checkout-Formular, und dort darf kein Datenbank-Client mitgeladen werden.
import { Decimal } from '@prisma/client/runtime/index-browser'

export type LineItem = { unitPrice: number; quantity: number }

export function calcTotalAmount(items: LineItem[]): number {
  return items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
}

// Plattformgebühr in Euro, auf ganze Cents gerundet
// (totalAmount × Prozent ergibt direkt Cents, daher / 100 am Ende)
export function calcPlatformFeeAmount(totalAmount: number, feePercent: number): number {
  return Math.round(totalAmount * feePercent) / 100
}

// Euro → Cents für Stripe (rundet Float-Artefakte wie 3.3000000000000003 weg)
export function eurosToCents(amount: number): number {
  return Math.round(amount * 100)
}

/** Eine Bestellposition für die Summe je Steuersatz — Werte wie aus Prisma (Decimal) oder als Text. */
export type PositionMitSatz = {
  vatRate: DecimalEingabe
  totalPrice: DecimalEingabe
}

export type SummeJeSatz = { vatRate: Decimal; summe: Decimal }

type DecimalEingabe = Decimal | string | number | { toString(): string }

/**
 * Bruttosumme je MwSt-Satz, aufsteigend nach Satz (Sprint Bereiche 1).
 *
 * Gerechnet wird mit Decimal, nie mit number: Die Summe landet später auf der
 * Rechnung des Hofs, und 0,1 + 0,2 darf dort nicht 0,30000000000000004 sein.
 * Die Sätze kommen aus dem Snapshot OrderItem.vatRate, nie aus dem Produkt.
 * Vorbereitung für den Steuer-Sprint — heute ruft sie noch niemand auf.
 */
export function summenJeSatz(positionen: readonly PositionMitSatz[]): SummeJeSatz[] {
  const jeSatz = new Map<string, SummeJeSatz>()
  for (const p of positionen) {
    const satz = new Decimal(p.vatRate.toString())
    // Schlüssel über die normierte Form: 10 und 10.00 sind derselbe Satz.
    const schluessel = satz.toFixed(2)
    const bisher = jeSatz.get(schluessel)
    const betrag = new Decimal(p.totalPrice.toString())
    jeSatz.set(schluessel, {
      vatRate: satz,
      summe: bisher ? bisher.summe.plus(betrag) : betrag,
    })
  }
  return [...jeSatz.values()].sort((a, b) => a.vatRate.comparedTo(b.vatRate))
}
