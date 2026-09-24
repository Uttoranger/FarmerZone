// Betragsberechnung des Checkouts — extrahiert aus /api/checkout, damit die
// Rundungslogik unit-testbar ist. Beträge sind Euro als Decimal, Stripe
// bekommt ganze Cent (decimalZuCents).
//
// Decimal aus dem Browser-Einstieg der Prisma-Runtime: Diese Datei läuft auch
// im Checkout-Formular, und dort darf kein Datenbank-Client mitgeladen werden.
import { Decimal } from '@prisma/client/runtime/index-browser'

/** Ein Geldbetrag, wie er ankommt: Prisma-Decimal, Text oder Zahl aus JSON. */
export type DecimalEingabe = Decimal | string | number | { toString(): string }

// Geld wird hier mit Decimal gerechnet, nie mit number (CODING_STANDARDS §2):
// Die Beträge landen in der Bestellung und bei Stripe, und 3 × 1,10 muss
// 3,30 ergeben, nicht 3,3000000000000003.

export type LineItem = { unitPrice: DecimalEingabe; quantity: number }

/** Zeilensumme einer Position: Einzelpreis × Menge, exakt. */
export function calcLineTotal(unitPrice: DecimalEingabe, quantity: number): Decimal {
  return new Decimal(unitPrice.toString()).times(quantity)
}

/** Warenpreis der Bestellung: Summe aller Zeilensummen, exakt. */
export function calcTotalAmount(items: readonly LineItem[]): Decimal {
  return items.reduce((s, i) => s.plus(calcLineTotal(i.unitPrice, i.quantity)), new Decimal(0))
}

/** Plattformgebühr in Euro, kaufmännisch auf ganze Cent gerundet (0,165 → 0,17). */
export function calcPlatformFeeAmount(totalAmount: Decimal, feePercent: DecimalEingabe): Decimal {
  return totalAmount
    .times(new Decimal(feePercent.toString()))
    .div(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
}

/** Euro als Decimal → ganze Cent für Stripe und die Servicegebühr. */
export function decimalZuCents(betrag: Decimal): number {
  return betrag.times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
}

// Euro → Cents für die ANZEIGE im Browser (Warenkorb-Summe, Gebühren-Vorschau).
// Rundet Float-Artefakte weg; abgerechnet wird damit nicht — das tut der Server
// mit decimalZuCents.
export function eurosToCents(amount: number): number {
  return Math.round(amount * 100)
}

/** Eine Position, deren Preis nicht mehr zur Datenbank passt — mit dem gültigen Preis. */
export type PreisAbweichung = { productId: string; name: string; price: number }

/**
 * Welche Positionen einen anderen Preis tragen als die Datenbank? Verglichen
 * wird auf den Cent, damit ein Float-Rest (4.99 vs. 4.990000001) nicht als
 * Änderung zählt. Der Warenkorb ist nie die Wahrheit über den Preis — weicht
 * er ab, hat der Hof ihn geändert oder jemand hat den Request gebaut. Beides
 * darf nie zu einer Bestellung zu einem Preis führen, den die DB nicht kennt.
 */
export function preisAbweichungen(
  positionen: ReadonlyArray<{ productId: string; name: string; unitPrice: number }>,
  dbPreise: ReadonlyMap<string, DecimalEingabe>
): PreisAbweichung[] {
  const abweichend: PreisAbweichung[] = []
  for (const p of positionen) {
    const eintrag = dbPreise.get(p.productId)
    if (eintrag === undefined) continue
    const gueltig = aufCent(eintrag)
    if (!aufCent(p.unitPrice).equals(gueltig)) {
      // number nur für die JSON-Antwort an den Browser, nicht zum Rechnen.
      abweichend.push({ productId: p.productId, name: p.name, price: gueltig.toNumber() })
    }
  }
  return abweichend
}

function aufCent(betrag: DecimalEingabe): Decimal {
  return new Decimal(betrag.toString()).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
}

/** Eine Bestellposition für die Summe je Steuersatz — Werte wie aus Prisma (Decimal) oder als Text. */
export type PositionMitSatz = {
  vatRate: DecimalEingabe
  totalPrice: DecimalEingabe
}

export type SummeJeSatz = { vatRate: Decimal; summe: Decimal }


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
