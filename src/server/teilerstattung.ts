import type Stripe from 'stripe'

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
 * IM ZWEIFEL NICHT BUCHEN: Ist das Bild unvollständig (mehr als eine Seite
 * Buchungen) oder gibt es Buchungen, die keiner Position zuzuordnen sind
 * (von Hand im Dashboard, altes Format, fremder Anlass), wirft
 * `ladeStripeStand` `StripeStandUnklar` — der Aufrufer bucht nichts, meldet es
 * an Sentry und bittet den Hof, sich zu melden. Lieber eine Rückfrage als Geld
 * doppelt.
 *
 * ZEITGRENZE: Die Aufrufe laufen in der Zeilensperre der Bestellung
 * (src/server/artikel-fehlt.ts). Ohne Optionen wiederholt das SDK jeden Aufruf
 * zweimal (stripe 22: maxNetworkRetries 2) mit langer Zeitgrenze — die
 * Transaktion liefe ab, während Stripe noch bucht. Deshalb je Aufruf
 * `STRIPE_OPTIONEN` (keine Wiederholung, kurze Zeitgrenze) und höchstens
 * `STRIPE_AUFRUFE_HOECHSTENS` Aufrufe je Meldung; die Summe liegt sicher unter
 * der Transaktionsgrenze (tests/teilerstattung.test.ts). Gelesen wird je Liste
 * genau EINE Seite (100 Einträge) — mehr zählt als „unklar", nie als Anlass,
 * weitere Aufrufe in die Sperre zu legen.
 */

/** Je Aufruf: keine stillen Wiederholungen des SDK, Zeitgrenze 4 s. */
export const STRIPE_OPTIONEN = { maxNetworkRetries: 0, timeout: 4_000 } as const

/** Eine Seite je Liste — eine Bestellung mit mehr Buchungen ist ein Fall für die Hand. */
export const SEITE = 100

/** Höchstens so viele Positionen trägt eine Meldung nach (eine verlorene Antwort ist selten). */
export const NACHTRAGEN_HOECHSTENS = 3

/**
 * Höchstzahl der Stripe-Aufrufe einer Meldung: drei zum Lesen (Zahlung,
 * Erstattungen, Rückbuchungen — je eine Seite), je eine Erstattung und
 * Rückbuchung für die gemeldete Position und je eine Rückbuchung für
 * nachgetragene Positionen.
 */
export const STRIPE_AUFRUFE_HOECHSTENS = 3 + 2 + NACHTRAGEN_HOECHSTENS

export type Anlass = 'teilstorno' | 'reststorno'

export type Buchung = { anlass: Anlass; positionId: string | null; betrag: number }

/** Was Stripe zu dieser Bestellung schon gebucht hat. */
export type StripeStand = {
  ueberweisung: string
  /** Was die Kundin laut Stripe bezahlt hat (`latest_charge.amount`); null = Stripe nennt keinen Betrag. */
  bezahltCents: number | null
  erstattungen: Buchung[]
  rueckbuchungen: Buchung[]
}

export type UnklarGrund =
  | 'mehr_als_eine_seite'
  | 'ohne_zuordnung'
  | 'nachtrag_unklar'
  | 'zu_viele_nachtraege'
  | 'erstattung_gescheitert'
  | 'bezahlt_abweichend'
  | 'ohne_ueberweisung'

/** Das Bild bei Stripe ist nicht eindeutig — nichts buchen, von Hand prüfen. */
export class StripeStandUnklar extends Error {
  constructor(
    readonly grund: UnklarGrund,
    readonly extra: Record<string, string | number> = {}
  ) {
    super(`Stripe-Stand unklar: ${grund}`)
    this.name = 'StripeStandUnklar'
  }
}

/** Zählt diese Erstattung als Geld, das geflossen ist oder gerade fließt? Gescheitert und abgebrochen nie. */
export function erstattungZaehlt(status: string | null): boolean {
  return status !== 'failed' && status !== 'canceled'
}

/*
 * Das Stripe-SDK erst im Aufruf (Nachtlauf Nr. 31, ARCHITECTURE §4): Dieses
 * Modul hängt an den Bestell-Actions, die /orders einbindet — ein statischer
 * Import legte das SDK in jeden Kaltstart der Seite.
 */
async function stripeSdk(): Promise<Stripe> {
  return (await import('@/lib/stripe')).stripe
}

function merkmal(orderId: string, anlass: Anlass, positionId: string | null, art: 'kunde' | 'hof'): Stripe.MetadataParam {
  return { orderId, anlass, art, ...(positionId ? { positionId } : {}) }
}

/**
 * Eine Buchung dieser Bestellung zuordnen — oder null (= unklar). Teilstorno
 * braucht eine Position; das Format vor Nachbesserung 1 (`grund:
 * 'artikel_fehlt'`) trug keine und ist deshalb nicht zuzuordnen; sein
 * Rest-Storno (`grund: 'storno_nach_teilerstattung'`) schon.
 */
export function ordneZu(orderId: string, metadata: Stripe.Metadata | null | undefined, betrag: number): Buchung | null {
  if (!metadata || metadata.orderId !== orderId) return null
  const anlass = metadata.anlass ?? (metadata.grund === 'storno_nach_teilerstattung' ? 'reststorno' : undefined)
  if (anlass === 'reststorno') return { anlass, positionId: null, betrag }
  if (anlass === 'teilstorno' && metadata.positionId) return { anlass, positionId: metadata.positionId, betrag }
  return null
}

/**
 * Überweisung, vorhandene Erstattungen und Rückbuchungen — drei Aufrufe, bevor
 * irgendetwas gebucht wird. Wirft `StripeStandUnklar`, wenn eine Liste mehr
 * als eine Seite hat oder eine Buchung keiner Position zuzuordnen ist.
 */
export async function ladeStripeStand(
  paymentIntentId: string,
  orderId: string,
  optionen: {
    /**
     * Diese Erstattung zählt nie mit, egal welchen Status die Liste zeigt —
     * für den Webhook, dessen Ereignis sie verbindlich als gescheitert meldet,
     * während `refunds.list` sie womöglich noch als `pending` führt.
     */
    gescheitert?: string
  } = {}
): Promise<StripeStand> {
  const stripe = await stripeSdk()
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] }, STRIPE_OPTIONEN)
  const zahlung = intent.latest_charge && typeof intent.latest_charge !== 'string' ? (intent.latest_charge as Stripe.Charge) : null
  const transfer = zahlung?.transfer ?? null
  const ueberweisung = typeof transfer === 'string' ? transfer : transfer?.id
  // Ohne Überweisung ist es keine Zahlung, wie der Checkout sie anlegt — nicht
  // raten, nichts buchen, melden (statt eines Fehlers, den der Webhook mit 500
  // beantwortete und Stripe drei Tage lang stumm erneut zustellte).
  if (!ueberweisung) throw new StripeStandUnklar('ohne_ueberweisung', { orderId })
  // Der bezahlte Betrag für den Rest-Storno — aus Stripe, nie aus der
  // Datenbank (restNachTeilerstattung). Fehlt er, ist er unbekannt, nicht 0.
  const bezahltCents = typeof zahlung?.amount === 'number' ? zahlung.amount : null

  const [erstattungen, rueckbuchungen] = await Promise.all([
    stripe.refunds.list({ payment_intent: paymentIntentId, limit: SEITE }, STRIPE_OPTIONEN),
    stripe.transfers.listReversals(ueberweisung, { limit: SEITE }, STRIPE_OPTIONEN),
  ])
  if (erstattungen.has_more || rueckbuchungen.has_more) throw new StripeStandUnklar('mehr_als_eine_seite', { orderId })

  const stand: StripeStand = { ueberweisung, bezahltCents, erstattungen: [], rueckbuchungen: [] }
  for (const r of erstattungen.data) {
    // Gescheiterte oder abgebrochene Erstattungen haben kein Geld bewegt.
    if (!erstattungZaehlt(r.status) || (optionen.gescheitert !== undefined && r.id === optionen.gescheitert)) continue
    const buchung = ordneZu(orderId, r.metadata, r.amount)
    if (!buchung) throw new StripeStandUnklar('ohne_zuordnung', { orderId, art: 'erstattung', betragCents: r.amount })
    stand.erstattungen.push(buchung)
  }
  for (const r of rueckbuchungen.data) {
    const buchung = ordneZu(orderId, r.metadata, r.amount)
    if (!buchung) throw new StripeStandUnklar('ohne_zuordnung', { orderId, art: 'rueckbuchung', betragCents: r.amount })
    stand.rueckbuchungen.push(buchung)
  }
  return stand
}

function vorhanden(liste: Buchung[], anlass: Anlass, positionId: string | null): Buchung | undefined {
  return liste.find((b) => b.anlass === anlass && b.positionId === positionId)
}

/**
 * Die Erstattung an die Kundin — oder die schon vorhandene. `nachgetragen`
 * heißt: Stripe hatte sie schon (verlorene Antwort, früherer Versuch), es
 * wurde nichts neu gebucht. Liefert Stripe eine gescheiterte Erstattung
 * zurück (auch über denselben Schlüssel), zählt sie nicht: Die Funktion wirft,
 * der Aufrufer schreibt nichts.
 */
export async function erstatteKundin(
  stand: StripeStand,
  e: { paymentIntentId: string; orderId: string; anlass: Anlass; positionId: string | null; betragCents: number; schluessel: string }
): Promise<{ erstattetCents: number; nachgetragen: boolean }> {
  const alt = vorhanden(stand.erstattungen, e.anlass, e.positionId)
  if (alt) return { erstattetCents: alt.betrag, nachgetragen: true }
  const stripe = await stripeSdk()
  const erstattung = await stripe.refunds.create(
    {
      payment_intent: e.paymentIntentId,
      amount: e.betragCents,
      metadata: merkmal(e.orderId, e.anlass, e.positionId, 'kunde'),
    },
    { ...STRIPE_OPTIONEN, idempotencyKey: e.schluessel }
  )
  if (!erstattungZaehlt(erstattung.status)) {
    throw new StripeStandUnklar('erstattung_gescheitert', { orderId: e.orderId, status: erstattung.status ?? 'unbekannt' })
  }
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
    const stripe = await stripeSdk()
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

/** Summe der Teilstorno-Buchungen (alle Positionen) — Grundlage des Rest-Stornos. */
export function teilstornoSumme(liste: Buchung[]): number {
  return liste.filter((b) => b.anlass === 'teilstorno').reduce((s, b) => s + b.betrag, 0)
}

/**
 * Hat Stripe zu dieser Zahlung schon Erstattungen? Ein Aufruf, eine Seite —
 * für den Storno, der sonst die Vollerstattung mit reverse_transfer nähme,
 * die nur stimmt, wenn noch nichts erstattet ist. `unklar` wie oben.
 */
export async function hatErstattungen(paymentIntentId: string): Promise<boolean> {
  const stripe = await stripeSdk()
  const liste = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: SEITE }, STRIPE_OPTIONEN)
  if (liste.has_more) return true
  return liste.data.some((r) => erstattungZaehlt(r.status))
}
