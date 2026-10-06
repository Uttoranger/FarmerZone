import type Stripe from 'stripe'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { zuruecknahmeNachGescheiterterErstattung } from '@/lib/storno'
import { StripeStandUnklar, erstattungZaehlt, ladeStripeStand, ordneZu, type Anlass } from '@/server/teilerstattung'

/**
 * Eine Erstattung ist NACH dem Buchen gescheitert (Webhook `refund.failed` /
 * `charge.refund.updated`, Nr. 19c).
 *
 * Warum es das braucht: Stripe meldet eine Erstattung oft erst `pending`; die
 * Datenbank zählt sie dann schon in `erstattetCents` (eine zweite wäre
 * doppelt, src/server/teilerstattung.ts). Scheitert sie Tage später, stünde
 * die Bestellung sonst weiter als „erstattet" da, und die Kundin hätte ihr
 * Geld nicht.
 *
 * Geändert wird nur, was NACHWEISLICH zu einer unserer Buchungen gehört: Die
 * Erstattung trägt unsere Merkmale (`metadata` orderId/anlass/positionId, über
 * `ordneZu`), und diese Bestellung gehört zu genau der Zahlung der
 * Erstattung. Alles andere (Vollstorno ohne Merkmale, von Hand im Dashboard,
 * fremde Bestellung) ändert nichts und wird nur gemeldet.
 *
 * Genau einmal je Erstattung — ohne eigene Spalte: Ziel ist Stripes Summe der
 * zählenden, zugeordneten Erstattungen (`ladeStripeStand`, die gescheiterte
 * zählt dort nicht mehr). Die Datenbank wird nur bedingt darauf gesetzt, wenn
 * sie genau um die gescheiterte darüber liegt
 * (`zuruecknahmeNachGescheiterterErstattung`); eine zweite Zustellung oder das
 * zweite Ereignis derselben Erstattung findet sie schon zurückgenommen.
 *
 * Statusübergänge bedingt: `erstattetCents` nur auf den gelesenen Wert;
 * `paymentStatus` REFUNDED → PAID nur aus REFUNDED (eine stornierte, bezahlte
 * Bestellung mit offenem Geld — wie nach einem gescheiterten Storno). Trifft
 * die Bedingung nicht, wirft die Funktion: 500, Stripe stellt erneut zu und
 * die Rechnung beginnt vom neuen Stand.
 */
export type GescheitertAusgang =
  /** Die Erstattung ist nicht gescheitert — nichts zu tun. */
  | { art: 'nicht_gescheitert' }
  /** Nicht nachweislich unsere Buchung: nichts geändert, melden. */
  | { art: 'fremd'; bestellung: Bestellbezug | null }
  /** Unsere Buchung, aber das Bild passt nicht: nichts geändert, melden. */
  | { art: 'unklar'; bestellung: Bestellbezug; grund: string }
  /** Schon zurückgenommen (oder nie gezählt): nichts mehr zu ändern — gemeldet wird trotzdem einmal. */
  | { art: 'schon_erledigt'; bestellung: Bestellbezug }
  | {
      art: 'zurueckgenommen'
      bestellung: Bestellbezug
      anlass: Anlass
      vorherCents: number
      nachherCents: number
      /** War die Bestellung als erstattet vermerkt (REFUNDED) und ist jetzt wieder offen (PAID)? */
      zahlungWiederOffen: boolean
    }

/** Was eine Meldung zum Wiederfinden braucht — keine Daten der Kundin. */
export type Bestellbezug = { id: string; orderNumber: string; hofName: string }

const BESTELLBEZUG = {
  id: true,
  orderNumber: true,
  erstattetCents: true,
  farm: { select: { name: true } },
} satisfies Prisma.OrderSelect

function zahlungVon(refund: Stripe.Refund): string | null {
  const pi = refund.payment_intent
  if (!pi) return null
  return typeof pi === 'string' ? pi : pi.id
}

export async function nimmGescheiterteErstattungZurueck(refund: Stripe.Refund): Promise<GescheitertAusgang> {
  if (erstattungZaehlt(refund.status)) return { art: 'nicht_gescheitert' }

  const paymentIntentId = zahlungVon(refund)
  const orderId = refund.metadata?.orderId
  const buchung = orderId ? ordneZu(orderId, refund.metadata, refund.amount) : null
  const bestellung =
    buchung && orderId && paymentIntentId
      ? await prisma.order.findFirst({ where: { id: orderId, stripePaymentIntentId: paymentIntentId }, select: BESTELLBEZUG })
      : null

  if (!buchung || !bestellung || !paymentIntentId) {
    // Zum Wiederfinden die Bestellung der ZAHLUNG nennen — nur lesen, nichts ändern.
    const zurZahlung = paymentIntentId
      ? await prisma.order.findUnique({ where: { stripePaymentIntentId: paymentIntentId }, select: BESTELLBEZUG })
      : null
    return { art: 'fremd', bestellung: zurZahlung ? bezug(zurZahlung) : null }
  }

  let erstattetCentsStripe: number
  try {
    // Die Erstattung des Ereignisses zählt ausdrücklich NICHT mit: Das
    // Ereignis sagt verbindlich „gescheitert", die Liste kann sie noch als
    // `pending` führen — dann sähe es aus wie „schon zurückgenommen", und die
    // Zurücknahme fiele still aus.
    const stand = await ladeStripeStand(paymentIntentId, bestellung.id, { gescheitert: refund.id })
    erstattetCentsStripe = stand.erstattungen.reduce((summe, b) => summe + b.betrag, 0)
  } catch (err) {
    if (err instanceof StripeStandUnklar) return { art: 'unklar', bestellung: bezug(bestellung), grund: `stripe_${err.grund}` }
    throw err
  }

  const entscheidung = zuruecknahmeNachGescheiterterErstattung({
    erstattetCentsDatenbank: bestellung.erstattetCents,
    erstattetCentsStripe,
    gescheitertCents: refund.amount,
  })
  if (entscheidung.art === 'schon_erledigt') return { art: 'schon_erledigt', bestellung: bezug(bestellung) }
  if (entscheidung.art === 'unklar') return { art: 'unklar', bestellung: bezug(bestellung), grund: 'betrag_passt_nicht' }

  const zahlungWiederOffen = await prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: bestellung.id, erstattetCents: bestellung.erstattetCents },
      data: { erstattetCents: entscheidung.erstattetCentsNeu },
    })
    // Eine gleichzeitige Zustellung (oder ein Storno) war schneller: nichts
    // schreiben, Stripe stellt erneut zu und rechnet vom neuen Stand.
    if (count !== 1) throw new Error('Erstattung gescheitert: Bestellung hat sich inzwischen geändert')
    const offen = await tx.order.updateMany({
      where: { id: bestellung.id, paymentStatus: 'REFUNDED' },
      data: { paymentStatus: 'PAID' },
    })
    return offen.count === 1
  })

  return {
    art: 'zurueckgenommen',
    bestellung: bezug(bestellung),
    anlass: buchung.anlass,
    vorherCents: bestellung.erstattetCents,
    nachherCents: entscheidung.erstattetCentsNeu,
    zahlungWiederOffen,
  }
}

function bezug(o: { id: string; orderNumber: string; farm: { name: string } }): Bestellbezug {
  return { id: o.id, orderNumber: o.orderNumber, hofName: o.farm.name }
}
