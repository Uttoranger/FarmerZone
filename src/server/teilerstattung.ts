import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'

/**
 * Erstattungen mit FESTEN Beträgen bei einer Destination Charge
 * (src/app/api/checkout/route.ts: transfer_data.destination +
 * application_fee_amount) — für „Artikel fehlt" (E14) und den Storno danach.
 *
 * Warum zwei Aufrufe statt `reverse_transfer: true`: Stripe kehrt die
 * Überweisung bei einer Erstattung ANTEILIG um (Erstattung / Zahlung ×
 * Überweisung). Bei „Artikel fehlt" bekommt die Kundin Artikelpreis +
 * Gebührendifferenz zurück, vom Hof soll aber GENAU der Artikelpreis kommen
 * (freigabe.md 1a). Deshalb:
 *   1. Erstattung über den Betrag an die Kundin, OHNE reverse_transfer und ohne
 *      refund_application_fee — sie geht vom Plattformsaldo ab, wo die
 *      einbehaltene Gebühr liegt.
 *   2. Rückbuchung (Transfer Reversal) mit festem Betrag vom Hof an die Plattform.
 *
 * Reihenfolge: erst die Überweisung nachschlagen (scheitert das, hat sich noch
 * nichts bewegt), dann die Erstattung (scheitert sie, wirft die Funktion —
 * der Aufrufer schreibt nichts), zuletzt die Rückbuchung. Scheitert NUR die
 * Rückbuchung, ist die Kundin trotzdem bedient; die Funktion meldet
 * `rueckbuchungOffen`, der Aufrufer meldet das an Sentry (der Betreiber holt
 * den Betrag von Hand zurück) — eine Erstattung zurückzunehmen ginge nicht.
 *
 * Beide Aufrufe tragen feste Idempotenz-Schlüssel: Ein zweiter Aufruf mit
 * denselben Werten liefert dieselbe Erstattung bzw. Rückbuchung, keine zweite.
 */

/** Kurz genug, damit die Sperre der Bestellung (src/server/artikel-fehlt.ts) nicht lange hält. */
const STRIPE_TIMEOUT_MS = 8_000

export type FesteErstattung = {
  /** Was Stripe als erstattet bestätigt hat, in Cent. */
  erstattetCents: number
  /** Die Rückbuchung vom Hof ist gescheitert — Geld der Kundin ist trotzdem zurück. */
  rueckbuchungOffen: boolean
}

/** Die Überweisung an den Hof, die zur Zahlung gehört (Destination Charge). */
async function ueberweisungDerZahlung(paymentIntentId: string): Promise<string> {
  const intent = await stripe.paymentIntents.retrieve(
    paymentIntentId,
    { expand: ['latest_charge'] },
    { timeout: STRIPE_TIMEOUT_MS }
  )
  const zahlung = intent.latest_charge
  const ueberweisung =
    zahlung && typeof zahlung !== 'string' ? (zahlung as Stripe.Charge).transfer : null
  const id = typeof ueberweisung === 'string' ? ueberweisung : ueberweisung?.id
  if (!id) throw new Error('Zahlung ohne Überweisung an den Hof')
  return id
}

export async function erstatteMitFestemBetrag(eingabe: {
  paymentIntentId: string
  orderId: string
  /** An die Kundin, in Cent (> 0). */
  erstattungCents: number
  /** Vom Hof zurück, in Cent (≥ 0; 0 = keine Rückbuchung). */
  vomHofCents: number
  /** Idempotenz-Schlüssel der Erstattung, z. B. `teilstorno-<orderId>-<itemId>`. */
  schluessel: string
  /** Idempotenz-Schlüssel der Rückbuchung, z. B. `teilstorno-hof-<orderId>-<itemId>`. */
  schluesselHof: string
  grund: 'artikel_fehlt' | 'storno_nach_teilerstattung'
  onRueckbuchungFehler: (err: unknown) => void
}): Promise<FesteErstattung> {
  const ueberweisung = await ueberweisungDerZahlung(eingabe.paymentIntentId)

  const erstattung = await stripe.refunds.create(
    {
      payment_intent: eingabe.paymentIntentId,
      amount: eingabe.erstattungCents,
      metadata: { orderId: eingabe.orderId, grund: eingabe.grund },
    },
    { idempotencyKey: eingabe.schluessel, timeout: STRIPE_TIMEOUT_MS }
  )

  let rueckbuchungOffen = false
  if (eingabe.vomHofCents > 0) {
    try {
      await stripe.transfers.createReversal(
        ueberweisung,
        { amount: eingabe.vomHofCents, metadata: { orderId: eingabe.orderId, grund: eingabe.grund } },
        { idempotencyKey: eingabe.schluesselHof, timeout: STRIPE_TIMEOUT_MS }
      )
    } catch (err) {
      eingabe.onRueckbuchungFehler(err)
      rueckbuchungOffen = true
    }
  }

  return { erstattetCents: erstattung.amount, rueckbuchungOffen }
}
