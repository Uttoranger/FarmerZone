/**
 * Was ein Storno an Geld bewegt — EINE Rechnung für den Storno-Dialog (was der
 * Hof vorher sieht) und für cancelOrder (was danach zurückkommt). Rein, in
 * ganzen Cent; Decimal → Cent wandelt die Servergrenze (`alsCents`).
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
 *
 * Bar, Karte vor Ort, oder online nie bezahlt: nichts zu erstatten → null.
 */
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
  /** Order.totalAmount in Cent — der Warenpreis. */
  warenpreisCents: number
  /** Order.platformFeeAmount in Cent — die Provision. */
  provisionCents: number
  serviceFeeCents: number
}): StornoBetraege | null {
  if (!onlineBezahlt(order)) return null
  const servicegebuehrCents = Math.max(0, order.serviceFeeCents)
  return {
    erstattetCents: order.warenpreisCents + servicegebuehrCents,
    vomHofCents: order.warenpreisCents - order.provisionCents,
    servicegebuehrCents,
    provisionCents: order.provisionCents,
  }
}

/** Die application_fee der Zahlung: Provision + Servicegebühr — nur wenn sie > 0 ist, gibt es eine zu erstatten (wie im Checkout). */
export function plattformgebuehrCents(betraege: StornoBetraege): number {
  return betraege.provisionCents + betraege.servicegebuehrCents
}

/** Wenn nichts erstattet wird: je Zahlungsart vor Ort ein Satz. */
const NICHTS_ZU_ERSTATTEN: Record<string, string> = {
  ONSITE_CASH: 'Bei Barzahlung wird nichts erstattet – die Bestellung entfällt.',
  ONSITE_CARD: 'Bei Kartenzahlung vor Ort wird nichts erstattet – die Bestellung entfällt.',
}

/**
 * Die Sätze über das Geld im Storno-Dialog. Online bezahlt: wer was
 * zurückbekommt und was vom Hof abgezogen wird; vor Ort: dass nichts
 * erstattet wird. Online, aber nie bezahlt: kein Satz — es gibt kein Geld zu bewegen.
 */
export function stornoGeldSaetze(eingabe: {
  kundenName: string
  paymentMethod: string
  betraege: StornoBetraege | null
}): string[] {
  const { kundenName, paymentMethod, betraege } = eingabe
  if (!betraege) {
    const satz = NICHTS_ZU_ERSTATTEN[paymentMethod]
    return satz ? [satz] : []
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

/**
 * Wurde vor dem Storno schon ein Teil erstattet bzw. ein Artikel als fehlend
 * gebucht („Artikel fehlt", E14)? Dann darf der Storno NICHT die
 * Vollerstattung mit reverse_transfer + refund_application_fee nehmen: Stripe
 * kehrte die Überweisung und die Gebühr anteilig zum Restbetrag um, und der
 * Hof gäbe nicht mehr genau seinen Warenpreis zurück. Stattdessen holt der
 * Storno den Rest mit festen Beträgen: Erstattung = aktueller Warenpreis +
 * aktuelle Gebühr (aus dem Plattformsaldo), Rückbuchung vom Hof = aktueller
 * Warenpreis − Provision. Teilstorno + Reststorno ergeben für Kundin, Hof und
 * Plattform genau dasselbe wie ein Vollstorno am Anfang.
 */
export function nachTeilerstattung(order: { erstattetCents: number; fehlendePositionen: number }): boolean {
  return order.erstattetCents > 0 || order.fehlendePositionen > 0
}

/** Was ein Storno nach Teilerstattung noch bewegt — mit festen Beträgen. */
export type RestStorno = { erstattungCents: number; vomHofCents: number }

/**
 * Der Rest eines Stornos nach „Artikel fehlt" — aus dem, was Stripe WIRKLICH
 * gebucht hat, nicht aus dem Stand der Datenbank: So stimmt er auch, wenn eine
 * Teilerstattung dort fehlt (verlorene Antwort) oder eine Rückbuchung vom Hof
 * gescheitert ist (sie wird hier nachgeholt).
 *
 *   Kundin  = bezahlt laut Stripe − alle Teilerstattungen
 *   vom Hof = Warenpreis der Bestellung − Provision − alle Teil-Rückbuchungen
 *
 * BEZAHLT kommt aus Stripe (`latest_charge.amount`), nicht aus der Datenbank.
 * Die Datenbank kennt bezahlt nur rechnerisch (aktueller Warenpreis +
 * aktuelle Gebühr + `erstattetCents`); nach einem Nachtrag mit abweichendem
 * Betrag oder einer zurückgenommenen Erstattung stimmt das nicht mehr, und
 * die Kundin bekäme still zu wenig oder zu viel. Weichen beide ab — oder
 * nennt Stripe keinen Betrag —, gibt es keinen Rest: null heißt NICHTS BUCHEN
 * (der Aufrufer meldet es, der Betreiber erstattet von Hand).
 *
 * Nie über Stripes Rest: `teilErstattetCents` ist die Summe ALLER zählenden
 * Teilerstattungen, die Stripe kennt — eine Erstattung ohne Zuordnung lässt
 * `ladeStripeStand` gar nicht erst durch (StripeStandUnklar).
 */
export function restNachTeilerstattung(e: {
  /** latest_charge.amount — null, wenn Stripe keinen Betrag nennt. */
  bezahltStripeCents: number | null
  /** Aktueller Warenpreis + aktuelle Gebühr + erstattetCents der Datenbank. */
  bezahltDatenbankCents: number
  /** Summe der Positions-Snapshots (auch der fehlenden). */
  warenOriginalCents: number
  provisionCents: number
  teilErstattetCents: number
  teilZurueckgebuchtCents: number
}): RestStorno | null {
  if (e.bezahltStripeCents === null || e.bezahltStripeCents !== e.bezahltDatenbankCents) return null
  return {
    erstattungCents: Math.max(0, e.bezahltStripeCents - e.teilErstattetCents),
    vomHofCents: Math.max(0, e.warenOriginalCents - e.provisionCents - e.teilZurueckgebuchtCents),
  }
}

export type Zuruecknahme =
  | { art: 'zuruecknehmen'; erstattetCentsNeu: number }
  | { art: 'schon_erledigt' }
  | { art: 'unklar' }

/**
 * Eine Erstattung ist NACH dem Buchen gescheitert (Webhook `refund.failed` /
 * `charge.refund.updated`): Was wird aus `erstattetCents`?
 *
 * Nicht „um den Betrag senken" — das senkte bei jeder Zustellung erneut (zwei
 * Ereignisse je Erstattung, Wiederholungen). Stattdessen gilt Stripes Summe
 * der zählenden, zugeordneten Erstattungen (die gescheiterte zählt dort nicht
 * mehr) als Ziel, und die Datenbank darf nur genau um die gescheiterte davon
 * abweichen:
 *   - Datenbank = Stripe + gescheitert → auf Stripes Summe zurück.
 *   - Datenbank = Stripe → schon zurückgenommen (oder nie gezählt): nichts.
 *   - alles andere → unklar, nichts ändern, melden.
 * So ist die Zurücknahme je Erstattung idempotent, ohne Spalte dafür.
 */
export function zuruecknahmeNachGescheiterterErstattung(e: {
  erstattetCentsDatenbank: number
  erstattetCentsStripe: number
  gescheitertCents: number
}): Zuruecknahme {
  if (e.gescheitertCents <= 0) return { art: 'unklar' }
  if (e.erstattetCentsDatenbank === e.erstattetCentsStripe) return { art: 'schon_erledigt' }
  if (e.erstattetCentsDatenbank === e.erstattetCentsStripe + e.gescheitertCents) {
    return { art: 'zuruecknehmen', erstattetCentsNeu: e.erstattetCentsStripe }
  }
  return { art: 'unklar' }
}
