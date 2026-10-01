/**
 * Vollstorno einer Online-Bestellung: Wer gibt welches Geld zurück?
 * (cancelOrder, src/server/actions/orders.ts)
 *
 * Der Fehler: cancelOrder rief stripe.refunds.create({ payment_intent }) ohne
 * reverse_transfer. Die Zahlung ist eine Destination Charge auf dem
 * Plattformkonto (src/app/api/checkout/route.ts) — Stripe zahlt die
 * Erstattung dann ganz aus dem Plattformsaldo, und der Hof behält das Geld,
 * das ihm überwiesen wurde. FarmerZone trug den Warenpreis.
 *
 * Geldfluss der Zahlung (Stripe: „if no amount is set, the full amount is
 * transferred"; die Gebühr geht als application_fee vom Hof an die Plattform):
 *   Kundin zahlt     Warenpreis + Servicegebühr
 *   an den Hof       Warenpreis + Servicegebühr   (Überweisung, voller Betrag)
 *   vom Hof zurück   Servicegebühr (+ Provision)  (application_fee)
 * Vollerstattung: reverse_transfer holt die GANZE Überweisung zurück („reversed
 * proportionally to the amount being refunded"), refund_application_fee gibt
 * die GANZE Gebühr an den Hof zurück. Nur beides zusammen ergibt: Der Hof gibt
 * genau seinen Warenpreis zurück, die Servicegebühr erstattet FarmerZone.
 *
 * Beweist, Stripe gemockt — mit der Idempotenz echter Schlüssel:
 *  - Vollerstattung mit reverse_transfer und refund_application_fee, Schlüssel
 *    storno-<Bestell-ID>; ohne erhobene Gebühr ohne refund_application_fee
 *    (wie der Checkout application_fee_amount nur bei Gebühr > 0 setzt).
 *  - Rückgabe: erstattetCents (gesamt) und vomHofCents (Warenpreis).
 *  - Ein zweiter Aufruf mit demselben Schlüssel legt keine zweite Erstattung an.
 *  - Scheitert die Erstattung: storniert, Sentry, erstattungOffen, Meldung wie bisher.
 *  - Bar: keine Erstattung.
 *  - Dialog und cancelOrder rechnen mit derselben Funktion (stornoBetraege),
 *    und der Dialog sagt in Worten, was die Zahlen bedeuten (stornoGeldSaetze).
 *  - Ladungstyp-Wache: Der Checkout legt die Zahlung genau so an, wie der
 *    Storno sie zurückholt — ändert sich dort etwas, schlägt dieser Test an.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/stripe', () => ({ stripe: { refunds: { create: vi.fn() } } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn() }))
vi.mock('@/lib/email', () => ({
  sendOrderReady: vi.fn(),
  sendOrderCancelled: vi.fn(),
  sendOrderNotReady: vi.fn(),
}))
vi.mock('@/lib/prisma', () => {
  const order = { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() }
  const product = { update: vi.fn() }
  return {
    prisma: {
      farm: { findUnique: vi.fn() },
      order,
      product,
      $transaction: vi.fn(async (rueckruf: (tx: unknown) => Promise<unknown>) => rueckruf({ order, product })),
    },
  }
})

import { cancelOrder } from '@/server/actions/orders'
import { plattformgebuehrCents, stornoBetraege, stornoGeldSaetze } from '@/lib/storno'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import * as Sentry from '@sentry/nextjs'

const refundCreate = vi.mocked(stripe.refunds.create)
const sentryMeldung = vi.mocked(Sentry.captureException)

/** 24,00 € Warenpreis, 1,50 € Servicegebühr, keine Provision (Pilot). */
const WARENPREIS_CENTS = 2400
const GEBUEHR_CENTS = 150

function bestellung(abweichend: Record<string, unknown> = {}) {
  return {
    id: 'order_1',
    orderNumber: 'TH-1',
    customerName: 'Anna Muster',
    customerEmail: 'anna@example.com',
    customerPhone: '+43 660 0000000',
    totalAmount: { toString: () => '24.00' },
    platformFeeAmount: { toString: () => '0.00' },
    serviceFeeCents: GEBUEHR_CENTS,
    serviceFeeRefundedAt: null,
    pickupDate: new Date('2026-10-02T12:00:00Z'),
    pickupTimeStart: '14:00',
    pickupTimeEnd: '16:00',
    paymentMethod: 'ONLINE',
    paymentStatus: 'PAID',
    stripePaymentIntentId: 'pi_1' as string | null,
    status: 'PAID',
    items: [{ id: 'i1', productId: 'p_eier', productName: 'Eier', quantity: 2, unitPrice: { toString: () => '12.00' }, totalPrice: { toString: () => '24.00' }, product: null }],
    ...abweichend,
  }
}

/**
 * Eine Bestellung als Datenbank: updateMany prüft den Status und setzt ihn in
 * einem Zug (wie UPDATE … WHERE), update schreibt, was es bekommt.
 */
function datenbankMit(satz: ReturnType<typeof bestellung>) {
  vi.mocked(prisma.order.findFirst).mockImplementation((async () => ({ ...satz })) as never)
  vi.mocked(prisma.order.updateMany).mockImplementation((async (arg: {
    where: { status?: { notIn?: string[] } }
    data: Record<string, unknown>
  }) => {
    if (arg.where.status?.notIn?.includes(satz.status)) return { count: 0 }
    satz.status = String(arg.data.status)
    return { count: 1 }
  }) as never)
  vi.mocked(prisma.order.update).mockImplementation((async (arg: { data: Record<string, unknown> }) => {
    Object.assign(satz, arg.data)
    return satz
  }) as never)
  return satz
}

/**
 * Stripe, wie es Idempotenz-Schlüssel behandelt: Derselbe Schlüssel liefert
 * dieselbe Erstattung zurück, statt eine zweite anzulegen. Ohne Schlüssel
 * entsteht jedes Mal eine neue. Erstattet wird der volle Zahlungsbetrag.
 */
function stripeMitIdempotenz(betragCents: number) {
  const erstattungen: Array<{ id: string; amount: number }> = []
  const nachSchluessel = new Map<string, { id: string; amount: number }>()
  refundCreate.mockImplementation((async (_parameter: unknown, optionen?: { idempotencyKey?: string }) => {
    const schluessel = optionen?.idempotencyKey
    const bekannt = schluessel ? nachSchluessel.get(schluessel) : undefined
    if (bekannt) return bekannt
    const erstattung = { id: `re_${erstattungen.length + 1}`, amount: betragCents }
    erstattungen.push(erstattung)
    if (schluessel) nachSchluessel.set(schluessel, erstattung)
    return erstattung
  }) as never)
  return erstattungen
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user_1' } } as never)
  vi.mocked(prisma.farm.findUnique).mockResolvedValue({
    id: 'farm_1', name: 'Hof Test', slug: 'hof-test', email: 'hof@example.com', ownerName: 'Max Mustermann',
    address: 'Weg 1', postalCode: '1010', city: 'Musterdorf', phone: '+43 660 0000000',
  } as never)
  vi.mocked(prisma.product.update).mockResolvedValue({} as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Vollstorno online — der Hof gibt genau seinen Warenpreis zurück', () => {
  it('erstattet mit reverse_transfer und refund_application_fee, unter dem Schlüssel storno-<ID>', async () => {
    datenbankMit(bestellung())
    stripeMitIdempotenz(WARENPREIS_CENTS + GEBUEHR_CENTS)

    await cancelOrder('order_1')

    expect(refundCreate).toHaveBeenCalledTimes(1)
    expect(refundCreate).toHaveBeenCalledWith(
      { payment_intent: 'pi_1', reverse_transfer: true, refund_application_fee: true },
      { idempotencyKey: 'storno-order_1' }
    )
  })

  it('ohne erhobene Gebühr gibt es keine Plattformgebühr zu erstatten — reverse_transfer allein', async () => {
    datenbankMit(bestellung({ serviceFeeCents: 0 }))
    stripeMitIdempotenz(WARENPREIS_CENTS)

    await cancelOrder('order_1')

    expect(refundCreate).toHaveBeenCalledWith(
      { payment_intent: 'pi_1', reverse_transfer: true },
      { idempotencyKey: 'storno-order_1' }
    )
  })

  it('gibt die Beträge des Storno-Dialogs zurück: erstattet gesamt, vom Hof der Warenpreis', async () => {
    datenbankMit(bestellung())
    stripeMitIdempotenz(WARENPREIS_CENTS + GEBUEHR_CENTS)

    const ergebnis = await cancelOrder('order_1')

    expect(ergebnis).toEqual({ erstattetCents: 2550, vomHofCents: 2400 })
  })

  it('ein zweiter Aufruf mit demselben Schlüssel legt keine zweite Erstattung an', async () => {
    // Der Weg zu einem zweiten Aufruf (Altlast, DEVELOPMENT.md „Offen"): Der
    // REFUNDED-Vermerk scheitert, paymentStatus bleibt PAID, und ein blind
    // schreibender Statuswechsel öffnet die Bestellung wieder — ein zweiter
    // Storno erreicht Stripe ein zweites Mal.
    const satz = datenbankMit(bestellung())
    const erstattungen = stripeMitIdempotenz(WARENPREIS_CENTS + GEBUEHR_CENTS)
    vi.mocked(prisma.order.update).mockRejectedValueOnce(new Error('connection reset'))

    const erste = await cancelOrder('order_1')
    satz.status = 'READY'
    const zweite = await cancelOrder('order_1')

    expect(refundCreate).toHaveBeenCalledTimes(2)
    const schluessel = refundCreate.mock.calls.map((aufruf) => (aufruf[1] as { idempotencyKey?: string } | undefined)?.idempotencyKey)
    expect(schluessel).toEqual(['storno-order_1', 'storno-order_1'])
    expect(erstattungen).toHaveLength(1)
    expect(erste).toEqual({ erstattetCents: 2550, vomHofCents: 2400 })
    expect(zweite).toEqual({ erstattetCents: 2550, vomHofCents: 2400 })
  })

  it('scheitert die Erstattung (Hof-Saldo reicht nicht): storniert, Sentry, erstattungOffen — Meldung wie bisher', async () => {
    const satz = datenbankMit(bestellung())
    refundCreate.mockRejectedValue(Object.assign(new Error('Insufficient funds in the destination account'), { code: 'balance_insufficient' }))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const ergebnis = await cancelOrder('order_1')

    expect(ergebnis).toEqual({
      error: 'Rückerstattung fehlgeschlagen. Bitte manuell über das Stripe Dashboard erstatten.',
      erstattungOffen: true,
    })
    expect(satz.status).toBe('CANCELLED')
    expect(satz.paymentStatus).toBe('PAID')
    expect(sentryMeldung).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tags: { aktion: 'cancelOrder', grund: 'erstattung_offen' } })
    )
  })
})

describe('Storno bar', () => {
  it('erstattet nichts — die Bestellung entfällt', async () => {
    datenbankMit(bestellung({ paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', stripePaymentIntentId: null, status: 'CONFIRMED' }))

    const ergebnis = await cancelOrder('order_1')

    expect(refundCreate).not.toHaveBeenCalled()
    expect(ergebnis).toEqual({ erstattetCents: 0, vomHofCents: 0 })
  })
})

describe('stornoBetraege — eine Rechnung für Dialog und cancelOrder', () => {
  const ONLINE = { stripePaymentIntentId: 'pi_1', paymentStatus: 'PAID', warenpreis: '24.00', provision: '0.00', serviceFeeCents: 150 }

  it('online bezahlt: die Kundin bekommt Warenpreis + Servicegebühr, vom Hof geht genau der Warenpreis', () => {
    const betraege = stornoBetraege(ONLINE)
    expect(betraege).toEqual({ erstattetCents: 2550, vomHofCents: 2400, servicegebuehrCents: 150, provisionCents: 0 })
    if (!betraege) throw new Error('Beträge fehlen')
    expect(plattformgebuehrCents(betraege)).toBe(150)
  })

  it('mit Provision: vom Hof der Warenpreis ohne die Provision — er hat sie nie bekommen', () => {
    const betraege = stornoBetraege({ ...ONLINE, provision: '1.20' })
    expect(betraege).toEqual({ erstattetCents: 2550, vomHofCents: 2280, servicegebuehrCents: 150, provisionCents: 120 })
    if (!betraege) throw new Error('Beträge fehlen')
    expect(plattformgebuehrCents(betraege)).toBe(270)
  })

  it('rechnet in Decimal — 19,99 € werden 1999 Cent, nicht 1998', () => {
    expect(stornoBetraege({ ...ONLINE, warenpreis: '19.99', serviceFeeCents: 0 })?.vomHofCents).toBe(1999)
  })

  it('bar oder online nie bezahlt: nichts zu erstatten', () => {
    expect(stornoBetraege({ ...ONLINE, stripePaymentIntentId: null, paymentStatus: 'PENDING' })).toBeNull()
    expect(stornoBetraege({ ...ONLINE, paymentStatus: 'PENDING' })).toBeNull()
  })
})

describe('stornoGeldSaetze — was der Hof im Storno-Dialog liest', () => {
  const MIT_GEBUEHR = { erstattetCents: 2550, vomHofCents: 2400, servicegebuehrCents: 150, provisionCents: 0 }

  it('online bezahlt: wer was zurückbekommt und was von der Auszahlung abgezogen wird', () => {
    expect(stornoGeldSaetze({ kundenName: 'Anna Muster', paymentMethod: 'ONLINE', betraege: MIT_GEBUEHR })).toEqual([
      'Anna Muster bekommt zurück: € 25,50 (Warenpreis + Servicegebühr)',
      'Von deiner nächsten Auszahlung abgezogen: € 24,00 – genau der Warenpreis. Die Servicegebühr erstattet FarmerZone.',
    ])
  })

  it('ohne Servicegebühr kein Wort über sie', () => {
    const ohne = { ...MIT_GEBUEHR, erstattetCents: 2400, servicegebuehrCents: 0 }
    expect(stornoGeldSaetze({ kundenName: 'Anna Muster', paymentMethod: 'ONLINE', betraege: ohne })).toEqual([
      'Anna Muster bekommt zurück: € 24,00 (Warenpreis)',
      'Von deiner nächsten Auszahlung abgezogen: € 24,00 – genau der Warenpreis.',
    ])
  })

  it('mit Provision stimmt der Satz zur Zahl', () => {
    const mitProvision = { ...MIT_GEBUEHR, vomHofCents: 2280, provisionCents: 120 }
    expect(stornoGeldSaetze({ kundenName: 'Anna Muster', paymentMethod: 'ONLINE', betraege: mitProvision })[1]).toBe(
      'Von deiner nächsten Auszahlung abgezogen: € 22,80 – der Warenpreis ohne die Provision. Die Servicegebühr erstattet FarmerZone.'
    )
  })

  it('bar: nichts erstattet — online nie bezahlt: kein Satz über Geld', () => {
    expect(stornoGeldSaetze({ kundenName: 'Anna Muster', paymentMethod: 'ONSITE_CASH', betraege: null })).toEqual([
      'Bei Barzahlung wird nichts erstattet – die Bestellung entfällt.',
    ])
    expect(stornoGeldSaetze({ kundenName: 'Anna Muster', paymentMethod: 'ONLINE', betraege: null })).toEqual([])
  })
})

describe('Ladungstyp-Wache: der Checkout legt die Zahlung so an, wie der Storno sie zurückholt', () => {
  const checkout = readFileSync(join(process.cwd(), 'src/app/api/checkout/route.ts'), 'utf8')

  it('Destination Charge ohne transfer_data.amount und ohne on_behalf_of — der volle Betrag geht an den Hof', () => {
    expect(checkout).toContain('transfer_data: { destination: farm.stripeAccountId! }')
    expect(checkout).not.toMatch(/transfer_data:\s*\{[^}]*\bamount\b/)
    expect(checkout).not.toMatch(/on_behalf_of\s*:/)
  })

  it('application_fee = Provision + Servicegebühr, nur bei > 0 — dieselbe Summe, die der Storno zurückgibt', () => {
    expect(checkout).toContain('const feeAmountCents = decimalZuCents(platformFeeAmount) + servicegebuehr.gebuehrCents')
    expect(checkout).toMatch(/if \(feeAmountCents > 0\) \{\s*intentParams\.application_fee_amount = feeAmountCents/)
  })
})
