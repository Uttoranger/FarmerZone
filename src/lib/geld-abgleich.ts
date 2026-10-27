/*
 * Der Geld-Abgleich mit Stripe (Register N37, Nr. 191) — die reine
 * Vergleichsfunktion. Kein Prisma, kein Stripe: Die Servergrenze
 * (src/server/geld-abgleich.ts) liest die Zahlungen bei Stripe und die
 * Bestellungen aus der Datenbank, wandelt Decimal einmal in ganze Cent und
 * gibt beides hierher. GELD IN GANZEN CENT (CODING_STANDARDS §2), nie Float.
 *
 * Was die Datenbank über eine Online-Zahlung weiß, steht in wenigen Feldern —
 * und je nach Weg, den die Bestellung genommen hat, auf andere Art:
 *
 *   bezahlt       Warenpreis + Servicegebühr + `erstattetCents`. Nach
 *                 „Artikel fehlt“ (E14) sind Warenpreis und Gebühr gesenkt und
 *                 `erstattetCents` um genau das gestiegen, was Stripe
 *                 zurückgab — die Summe bleibt, was die Kundin zahlte
 *                 (dieselbe Formel wie `bezahltDatenbankCents` beim Storno,
 *                 src/server/stornieren.ts). Nach einem Reststorno (erstattet
 *                 und `erstattetCents` > 0) steht dort ALLES Erstattete, also
 *                 genau der bezahlte Betrag.
 *   erstattet     REFUNDED: alles (Vollstorno lässt `erstattetCents` bei 0,
 *                 der Reststorno trägt die Summe ein). PAID: `erstattetCents`
 *                 und — wenn die Gebühr nach „nicht abgeholt“ entfallen ist —
 *                 die Servicegebühr, die als eigene Erstattung zurückging
 *                 (lasseServicegebuehrEntfallen, ohne `erstattetCents`).
 *   Gebühr        `application_fee_amount` des PaymentIntents — so, wie die
 *                 Kasse sie angelegt hat (Provision + Servicegebühr,
 *                 `intentParameter` in src/app/api/checkout/route.ts). Stripe
 *                 ändert sie nie; nach „Artikel fehlt“ ist die Gebühr der
 *                 Datenbank gesenkt, die ursprüngliche ist bezahlt − Waren
 *                 aller Positionen (auch der fehlenden).
 *
 * Unbezahlt (PENDING, FAILED) erwartet die Datenbank 0 € bezahlt und nichts
 * erstattet; die Gebühr wird dann nicht verglichen — der PaymentIntent trägt
 * sie schon vor der Zahlung.
 *
 * Gespeichert wird eine Abweichung als BetriebMessung (nur Kennung und Cent):
 * Art `geldAbweichung:<Bestellung>:<Feld>`, Wert = Datenbank − Stripe in
 * Cent, Tag = der Tag, an dem sie zuerst auffiel. Sie bleibt, bis beide
 * wieder übereinstimmen — der Ablauf prüft offene Abweichungen bei jedem Lauf
 * mit, auch wenn die Zahlung älter als 48 Stunden ist.
 */

/** Wie weit der Ablauf zurückliest (N37: die letzten 48 Stunden). */
export const GELD_ABGLEICH_FENSTER_MS = 48 * 60 * 60 * 1000

/** Vorsatz der Abweichungen in BetriebMessung — kein Messwert, darum nicht in BETRIEB_ARTEN. */
export const GELD_ABWEICHUNG_ART = 'geldAbweichung'

/** Die Stripe-Gebühren eines UTC-Tages in Cent (BetriebMessung, je Tag eine Zeile). */
export const STRIPE_GEBUEHR_ART = 'stripeGebuehrCents'

/**
 * Was abweichen kann:
 *   betrag      bezahlt (amount_received)
 *   gebuehr     application_fee_amount
 *   erstattung  erstattet (amount_refunded der Zahlung)
 *   zahlung     die Datenbank kennt eine Zahlung, Stripe nicht
 */
export const ABWEICHUNG_FELDER = ['betrag', 'gebuehr', 'erstattung', 'zahlung'] as const
export type AbweichungFeld = (typeof ABWEICHUNG_FELDER)[number]

export const ABWEICHUNG_FELD_TEXT: Record<AbweichungFeld, string> = {
  betrag: 'Betrag',
  gebuehr: 'Servicegebühr',
  erstattung: 'Erstattung',
  zahlung: 'Zahlung fehlt bei Stripe',
}

/** Eine Zahlung, wie Stripe sie kennt — in Cent. */
export type StripeZahlung = {
  paymentIntentId: string
  /** amount_received — 0, solange nicht bezahlt. */
  betragCents: number
  /** application_fee_amount (null → 0). */
  gebuehrCents: number
  /** amount_refunded der letzten Belastung. */
  erstattetCents: number
}

/** Eine Online-Bestellung, so weit der Abgleich sie braucht — nur Kennungen, Stände und Cent. */
export type BestellungFuerAbgleich = {
  id: string
  orderNumber: string
  paymentIntentId: string
  paymentStatus: string
  /** Order.totalAmount in Cent (der aktuelle Warenpreis). */
  warenCents: number
  /** Summe aller Positionen in Cent, auch der fehlenden (Snapshot `totalPrice`). */
  warenOriginalCents: number
  serviceFeeCents: number
  /** Order.platformFeeAmount in Cent — im Pilot 0. */
  provisionCents: number
  erstattetCents: number
  /** serviceFeeRefundedAt gesetzt (Gebühr entfallen). */
  gebuehrEntfallen: boolean
}

export type ErwartetLautDatenbank = { bezahlt: boolean; betragCents: number; gebuehrCents: number; erstattetCents: number }

/** Was Stripe laut Datenbank für diese Bestellung kennen müsste (Regel im Kopf der Datei). */
export function erwartetLautDatenbank(b: BestellungFuerAbgleich): ErwartetLautDatenbank {
  const bezahlt = b.paymentStatus === 'PAID' || b.paymentStatus === 'REFUNDED'
  if (!bezahlt) return { bezahlt, betragCents: 0, gebuehrCents: 0, erstattetCents: 0 }
  const reststorno = b.paymentStatus === 'REFUNDED' && b.erstattetCents > 0
  const betragCents = reststorno ? b.erstattetCents : b.warenCents + b.serviceFeeCents + b.erstattetCents
  const erstattetCents =
    b.paymentStatus === 'REFUNDED' ? betragCents : b.erstattetCents + (b.gebuehrEntfallen ? b.serviceFeeCents : 0)
  // Ohne fehlende Position ist der Warenpreis noch der ursprüngliche — dann gilt die gespeicherte Gebühr.
  const gebuehrCents =
    b.warenOriginalCents === b.warenCents ? b.provisionCents + b.serviceFeeCents : b.provisionCents + betragCents - b.warenOriginalCents
  return { bezahlt, betragCents, gebuehrCents, erstattetCents }
}

/** Eine Abweichung — Datenbank und Stripe in Cent, dazu Kennung und Nummer der Bestellung. */
export type Abweichung = {
  orderId: string
  orderNumber: string
  feld: AbweichungFeld
  datenbankCents: number
  stripeCents: number
}

/** Datenbank − Stripe in Cent: so steht sie in BetriebMessung. */
export function abweichungCents(a: Pick<Abweichung, 'datenbankCents' | 'stripeCents'>): number {
  return a.datenbankCents - a.stripeCents
}

/**
 * Vergleicht EINE Bestellung mit ihrer Zahlung bei Stripe. `stripe` null heißt:
 * Stripe kennt diesen PaymentIntent nicht — bezahlt laut Datenbank ist das
 * die Abweichung „zahlung“, sonst ist nichts zu vergleichen.
 */
export function vergleicheBestellung(b: BestellungFuerAbgleich, stripe: StripeZahlung | null): Abweichung[] {
  const erwartet = erwartetLautDatenbank(b)
  const abw = (feld: AbweichungFeld, datenbankCents: number, stripeCents: number): Abweichung[] =>
    datenbankCents === stripeCents ? [] : [{ orderId: b.id, orderNumber: b.orderNumber, feld, datenbankCents, stripeCents }]
  if (stripe === null) return erwartet.bezahlt ? abw('zahlung', erwartet.betragCents, 0) : []
  return [
    ...abw('betrag', erwartet.betragCents, stripe.betragCents),
    // Die Gebühr nur bei einer Zahlung: Unbezahlt trägt der PaymentIntent sie schon, die Datenbank erwartet nichts.
    ...(erwartet.bezahlt && stripe.betragCents > 0 ? abw('gebuehr', erwartet.gebuehrCents, stripe.gebuehrCents) : []),
    ...abw('erstattung', erwartet.erstattetCents, stripe.erstattetCents),
  ]
}

/**
 * Der ganze Abgleich: jede Bestellung gegen ihre Zahlung. Eine Bestellung,
 * deren PaymentIntent in `nichtBeiStripe` steht, hat bei Stripe keine Zahlung;
 * eine, die weder in `zahlungen` noch dort steht, wurde nicht gelesen (über
 * der Grenze des Nachladens) und bleibt außen vor — eine offene Abweichung
 * dazu bleibt stehen.
 */
export function gleicheAb(
  bestellungen: readonly BestellungFuerAbgleich[],
  zahlungen: ReadonlyMap<string, StripeZahlung>,
  nichtBeiStripe: ReadonlySet<string> = new Set()
): { verglichen: string[]; abweichungen: Abweichung[] } {
  const verglichen: string[] = []
  const abweichungen: Abweichung[] = []
  for (const b of bestellungen) {
    const zahlung = zahlungen.get(b.paymentIntentId) ?? null
    if (zahlung === null && !nichtBeiStripe.has(b.paymentIntentId)) continue
    verglichen.push(b.id)
    abweichungen.push(...vergleicheBestellung(b, zahlung))
  }
  return { verglichen, abweichungen }
}

/** `geldAbweichung:<Bestellung>:<Feld>` — die Art der Zeile in BetriebMessung. */
export function abweichungArt(orderId: string, feld: AbweichungFeld): string {
  return `${GELD_ABWEICHUNG_ART}:${orderId}:${feld}`
}

/** Die Art einer Zeile zurück in Bestellung und Feld — eine fremde Zeile ist null. */
export function leseAbweichungArt(art: string): { orderId: string; feld: AbweichungFeld } | null {
  const teile = art.split(':')
  if (teile.length !== 3 || teile[0] !== GELD_ABWEICHUNG_ART) return null
  const [, orderId, feld] = teile
  if (!orderId || !/^[\w-]{1,100}$/.test(orderId)) return null
  const bekannt = ABWEICHUNG_FELDER.find((f) => f === feld)
  return bekannt ? { orderId, feld: bekannt } : null
}

/** Eine Buchung im Saldo des Plattformkontos (Balance Transaction) — nur, was die Gebühren brauchen. */
export type SaldoBuchung = { created: number; fee: number; type: string; amount: number }

/**
 * Die Stripe-Gebühren je UTC-Tag in Cent: die `fee` jeder Buchung, dazu
 * Buchungen der Art `stripe_fee` (Gebühren, die Stripe gesondert abbucht,
 * etwa für Connect) mit ihrem Betrag — der ist negativ, die Gebühr positiv.
 * Tage ohne Gebühr stehen nicht in der Liste.
 */
export function stripeGebuehrenJeTag(buchungen: readonly SaldoBuchung[]): Map<string, number> {
  const jeTag = new Map<string, number>()
  for (const b of buchungen) {
    const cents = b.fee + (b.type === 'stripe_fee' ? -b.amount : 0)
    if (cents === 0) continue
    const tag = new Date(b.created * 1000).toISOString().slice(0, 10)
    jeTag.set(tag, (jeTag.get(tag) ?? 0) + cents)
  }
  return jeTag
}

/** Eine offene Abweichung aus BetriebMessung, für Heute und Geld. */
export type OffeneAbweichung = { orderId: string; orderNumber: string; feld: AbweichungFeld; differenzCents: number; seit: Date }
