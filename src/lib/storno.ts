/**
 * Was ein Storno an Geld bewegt — EINE Rechnung für den Storno-Dialog (was der
 * Hof vorher sieht) und für cancelOrder (was danach zurückkommt).
 *
 * Die Online-Zahlung ist eine Destination Charge mit application_fee_amount
 * (src/app/api/checkout/route.ts): Der Hof bekommt den vollen Betrag
 * überwiesen und gibt Provision + Servicegebühr als application_fee an die
 * Plattform ab. Bei der Vollerstattung holt reverse_transfer die ganze
 * Überweisung zurück, refund_application_fee gibt dem Hof die ganze Gebühr
 * zurück (cancelOrder). Damit:
 *
 *   erstattetCents  = Warenpreis + Servicegebühr — alles, was die Kundin zahlte.
 *   vomHofCents     = Warenpreis − Provision — genau das, was der Hof für die
 *                     Bestellung bekam. Im Pilot ist die Provision 0.
 *   gebuehrCents    = Provision + Servicegebühr — die application_fee der Zahlung.
 *
 * Bar, oder online nie bezahlt: Es gibt nichts zu erstatten → null.
 */
import { Decimal } from '@prisma/client/runtime/index-browser'
import { decimalZuCents, type DecimalEingabe } from '@/lib/order-totals'
import { formatEuro } from '@/lib/format'
import { centsAlsEuro } from '@/lib/servicegebuehr'

export type StornoBetraege = {
  /** Was die Kundin zurückbekommt: Warenpreis + Servicegebühr. */
  erstattetCents: number
  /** Was von der nächsten Auszahlung des Hofs abgezogen wird: Warenpreis − Provision. */
  vomHofCents: number
  /** Die Servicegebühr — sie erstattet FarmerZone. */
  servicegebuehrCents: number
  /** Die Provision (im Pilot 0) — der Hof hat sie nie bekommen, er gibt sie nicht zurück. */
  provisionCents: number
}

/** Ob eine Bestellung online bezahlt ist — genau dann erstattet ein Storno über Stripe. */
export function onlineBezahlt(order: { stripePaymentIntentId?: string | null; paymentStatus: string }): boolean {
  return Boolean(order.stripePaymentIntentId) && order.paymentStatus === 'PAID'
}

export function stornoBetraege(order: {
  stripePaymentIntentId?: string | null
  paymentStatus: string
  /** Order.totalAmount — der Warenpreis. */
  warenpreis: DecimalEingabe
  /** Order.platformFeeAmount — die Provision. */
  provision: DecimalEingabe
  serviceFeeCents: number
}): StornoBetraege | null {
  if (!onlineBezahlt(order)) return null
  const warenpreisCents = decimalZuCents(new Decimal(order.warenpreis.toString()))
  const provisionCents = decimalZuCents(new Decimal(order.provision.toString()))
  const servicegebuehrCents = Math.max(0, order.serviceFeeCents)
  return {
    erstattetCents: warenpreisCents + servicegebuehrCents,
    vomHofCents: warenpreisCents - provisionCents,
    servicegebuehrCents,
    provisionCents,
  }
}

/** Die application_fee der Zahlung — nur wenn sie > 0 ist, gibt es eine zu erstatten (wie im Checkout). */
export function plattformgebuehrCents(betraege: StornoBetraege): number {
  return betraege.provisionCents + betraege.servicegebuehrCents
}

/**
 * Die Sätze über das Geld im Storno-Dialog. Online bezahlt: wer was
 * zurückbekommt und was vom Hof abgezogen wird; bar: dass nichts erstattet
 * wird. Online, aber nie bezahlt: kein Satz — es gibt kein Geld zu bewegen.
 */
export function stornoGeldSaetze(eingabe: {
  kundenName: string
  paymentMethod: string
  betraege: StornoBetraege | null
}): string[] {
  const { kundenName, paymentMethod, betraege } = eingabe
  if (!betraege) {
    return paymentMethod === 'ONLINE' ? [] : ['Bei Barzahlung wird nichts erstattet – die Bestellung entfällt.']
  }
  const mitGebuehr = betraege.servicegebuehrCents > 0
  const zurueck = `${kundenName} bekommt zurück: ${formatEuro(centsAlsEuro(betraege.erstattetCents))} (${
    mitGebuehr ? 'Warenpreis + Servicegebühr' : 'Warenpreis'
  })`
  const abgezogen =
    `Von deiner nächsten Auszahlung abgezogen: ${formatEuro(centsAlsEuro(betraege.vomHofCents))} – ` +
    (betraege.provisionCents > 0 ? 'der Warenpreis ohne die Provision.' : 'genau der Warenpreis.') +
    (mitGebuehr ? ' Die Servicegebühr erstattet FarmerZone.' : '')
  return [zurueck, abgezogen]
}
