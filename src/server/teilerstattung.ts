import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'

/**
 * Erstattungen mit FESTEN Beträgen bei einer Destination Charge
 * (src/app/api/checkout/route.ts: transfer_data.destination +
 * application_fee_amount) — für „Artikel fehlt" (E14) und den Storno danach.
 *
 * Warum zwei Buchungen statt `reverse_transfer: true`: Stripe kehrt die
 * Überweisung bei einer Erstattung ANTEILIG um (Erstattung / Zahlung ×
 * Überweisung). Bei „Artikel fehlt" bekommt die Kundin Artikelpreis +
 * Gebührendifferenz zurück, vom Hof soll aber GENAU der Artikelpreis kommen
 * (freigabe.md 1a). Deshalb:
 *   1. Erstattung über den Betrag an die Kundin, OHNE reverse_transfer und ohne
 *      refund_application_fee — sie geht vom Plattformsaldo ab, wo die
 *      einbehaltene Gebühr liegt.
 *   2. Rückbuchung (Transfer Reversal) mit festem Betrag vom Hof an die Plattform.
 *
 * NIE ZWEIMAL — auch nicht nach 24 Stunden oder mit anderem Betrag: Jede
 * Buchung trägt in `metadata` die Bestellung, den Anlass und die Position.
 * Bevor gebucht wird, liest `ladeStripeStand` die vorhandenen Erstattungen der
 * Zahlung und Rückbuchungen der Überweisung; gibt es für dieselbe Bestellung,
 * denselben Anlass und dieselbe Position schon eine, wird NICHT neu gebucht,
 * sondern ihr Betrag übernommen (der Aufrufer trägt ihn in der Datenbank
 * nach). Der Idempotenz-Schlüssel bleibt als zweite Sicherung für den Fall,
 * dass zwei Anfragen zugleich buchen.
 *
 * ZEITGRENZE: Die Aufrufe laufen in der Zeilensperre der Bestellung
 * (src/server/artikel-fehlt.ts). Ohne Optionen wiederholt das SDK jeden Aufruf
 * zweimal (stripe 22: maxNetworkRetries 2) mit langer Zeitgrenze — die
 * Transaktion liefe ab, während Stripe noch bucht. Deshalb je Aufruf
 * `STRIPE_OPTIONEN` (keine Wiederholung, kurze Zeitgrenze) und höchstens
 * `STRIPE_AUFRUFE_HOECHSTENS` Aufrufe je Meldung; die Summe liegt sicher unter
 * der Transaktionsgrenze (tests/teilerstattung.test.ts). Wiederholt wird über
 * den Knopf — und dann findet `ladeStripeStand` eine schon erfolgte Buchung.
 */

/** Je Aufruf: keine stillen Wiederholungen des SDK, Zeitgrenze 4 s. */
export const STRIPE_OPTIONEN = { maxNetworkRetries: 0, timeout: 4_000 } as const

/** Höchstens so viele Positionen trägt eine Meldung nach (eine verlorene Antwort ist selten). */
export const NACHTRAGEN_HOECHSTENS = 3

/**
 * Höchstzahl der Stripe-Aufrufe einer Meldung: drei zum Lesen (Zahlung,
 * Erstattungen, Rückbuchungen), je eine Erstattung und Rückbuchung für die
 * gemeldete Position und je eine Rückbuchung für nachgetragene Positionen.
 */
export const STRIPE_AUFRUFE_HOECHSTENS = 3 + 2 + NACHTRAGEN_HOECHSTENS

export type Anlass = 'teilstorno' | 'reststorno'

type Buchung = { anlass: Anlass; positionId: string | null; betrag: number }

/** Was Stripe zu dieser Bestellung schon gebucht hat. */
export type StripeStand = {
  ueberweisung: string
  erstattungen: Buchung[]
  rueckbuchungen: Buchung[]
}

function merkmal(orderId: string, anlass: Anlass, positionId: string | null, art: 'kunde' | 'hof'): Stripe.MetadataParam {
  return { orderId, anlass, art, ...(positionId ? { positionId } : {}) }
}

function alsBuchung(orderId: string, metadata: Stripe.Metadata | null, betrag: number): Buchung | null {
  if (!metadata || metadata.orderId !== orderId) return null
  const anlass = metadata.anlass
  if (anlass !== 'teilstorno' && anlass !== 'reststorno') return null
  return { anlass, positionId: metadata.positionId ?? null, betrag }
}

/** Überweisung, vorhandene Erstattungen und Rückbuchungen — drei Aufrufe, bevor irgendetwas gebucht wird. */
export async function ladeStripeStand(paymentIntentId: string, orderId: string): Promise<StripeStand> {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] }, STRIPE_OPTIONEN)
  const zahlung = intent.latest_charge
  const transfer = zahlung && typeof zahlung !== 'string' ? (zahlung as Stripe.Charge).transfer : null
  const ueberweisung = typeof transfer === 'string' ? transfer : transfer?.id
  if (!ueberweisung) throw new Error('Zahlung ohne Überweisung an den Hof')

  const [erstattungen, rueckbuchungen] = await Promise.all([
    stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 }, STRIPE_OPTIONEN),
    stripe.transfers.listReversals(ueberweisung, { limit: 100 }, STRIPE_OPTIONEN),
  ])
  return {
    ueberweisung,
    erstattungen: erstattungen.data
      // Gescheiterte oder abgebrochene Erstattungen haben kein Geld bewegt.
      .filter((r) => r.status !== 'failed' && r.status !== 'canceled')
      .flatMap((r) => alsBuchung(orderId, r.metadata, r.amount) ?? []),
    rueckbuchungen: rueckbuchungen.data.flatMap((r) => alsBuchung(orderId, r.metadata, r.amount) ?? []),
  }
}

function vorhanden(liste: Buchung[], anlass: Anlass, positionId: string | null): Buchung | undefined {
  return liste.find((b) => b.anlass === anlass && b.positionId === positionId)
}

/**
 * Die Erstattung an die Kundin — oder die schon vorhandene. `nachgetragen`
 * heißt: Stripe hatte sie schon (verlorene Antwort, früherer Versuch), es
 * wurde nichts neu gebucht.
 */
export async function erstatteKundin(
  stand: StripeStand,
  e: { paymentIntentId: string; orderId: string; anlass: Anlass; positionId: string | null; betragCents: number; schluessel: string }
): Promise<{ erstattetCents: number; nachgetragen: boolean }> {
  const alt = vorhanden(stand.erstattungen, e.anlass, e.positionId)
  if (alt) return { erstattetCents: alt.betrag, nachgetragen: true }
  const erstattung = await stripe.refunds.create(
    {
      payment_intent: e.paymentIntentId,
      amount: e.betragCents,
      metadata: merkmal(e.orderId, e.anlass, e.positionId, 'kunde'),
    },
    { ...STRIPE_OPTIONEN, idempotencyKey: e.schluessel }
  )
  stand.erstattungen.push({ anlass: e.anlass, positionId: e.positionId, betrag: erstattung.amount })
  return { erstattetCents: erstattung.amount, nachgetragen: false }
}

/**
 * Die Rückbuchung vom Hof — sofern es sie nicht schon gibt. Scheitert sie,
 * ist die Kundin trotzdem bedient; zurück kommt `true` (offen), und der
 * Aufrufer meldet es an Sentry (der Betreiber bucht von Hand zurück).
 */
export async function bucheVomHofZurueck(
  stand: StripeStand,
  r: {
    orderId: string
    anlass: Anlass
    positionId: string | null
    betragCents: number
    schluessel: string
    onFehler: (err: unknown) => void
  }
): Promise<boolean> {
  if (r.betragCents <= 0 || vorhanden(stand.rueckbuchungen, r.anlass, r.positionId)) return false
  try {
    const rueck = await stripe.transfers.createReversal(
      stand.ueberweisung,
      { amount: r.betragCents, metadata: merkmal(r.orderId, r.anlass, r.positionId, 'hof') },
      { ...STRIPE_OPTIONEN, idempotencyKey: r.schluessel }
    )
    stand.rueckbuchungen.push({ anlass: r.anlass, positionId: r.positionId, betrag: rueck.amount })
    return false
  } catch (err) {
    r.onFehler(err)
    return true
  }
}

export type FesteErstattung = {
  /** Was Stripe als erstattet bestätigt hat (neu oder schon vorhanden), in Cent. */
  erstattetCents: number
  /** Die Rückbuchung vom Hof ist gescheitert — Geld der Kundin ist trotzdem zurück. */
  rueckbuchungOffen: boolean
}

/**
 * Für den Rest-Storno nach einer Teilerstattung: Stand lesen, Kundin
 * erstatten (oder die vorhandene Rest-Erstattung übernehmen), vom Hof zurück.
 * Scheitert die Erstattung, wirft die Funktion — der Aufrufer meldet „offen".
 */
export async function erstatteMitFestemBetrag(eingabe: {
  paymentIntentId: string
  orderId: string
  erstattungCents: number
  vomHofCents: number
  schluessel: string
  schluesselHof: string
  onRueckbuchungFehler: (err: unknown) => void
}): Promise<FesteErstattung> {
  const stand = await ladeStripeStand(eingabe.paymentIntentId, eingabe.orderId)
  const kundin = await erstatteKundin(stand, {
    paymentIntentId: eingabe.paymentIntentId,
    orderId: eingabe.orderId,
    anlass: 'reststorno',
    positionId: null,
    betragCents: eingabe.erstattungCents,
    schluessel: eingabe.schluessel,
  })
  const rueckbuchungOffen = await bucheVomHofZurueck(stand, {
    orderId: eingabe.orderId,
    anlass: 'reststorno',
    positionId: null,
    betragCents: eingabe.vomHofCents,
    schluessel: eingabe.schluesselHof,
    onFehler: eingabe.onRueckbuchungFehler,
  })
  return { erstattetCents: kundin.erstattetCents, rueckbuchungOffen }
}
