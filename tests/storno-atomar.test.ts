/**
 * Stornierung: Rückbuchung atomar und gegen Doppelausführung gesperrt
 * (src/server/actions/orders.ts) — am echten Code, Prisma/Stripe/Mail/Sentry
 * gemockt.
 *
 * Der Fehler: cancelOrder prüfte den Status nur LESEND (findFirst) und buchte
 * dann je Position außerhalb jeder Transaktion zurück; der Statuswechsel kam
 * erst am Ende. Zwei parallele Aufrufe (Doppeltipp) passierten beide die
 * Leseprüfung und erhöhten den Bestand doppelt. Dazu kamen Wege, eine
 * stornierte Bestellung wieder zu „öffnen" (Undo ohne Statusfilter) — danach
 * ließ sich ein zweites Mal stornieren und zurückbuchen.
 *
 * Die Fakes bilden die Datenbank-Semantik für EINE Bestellung nach: echter
 * Status, updateMany prüft und setzt in einem Zug (in JS unteilbar — wie ein
 * einzelnes UPDATE … WHERE in PostgreSQL). Der Wettlauf wird deterministisch
 * erzwungen: beide Aufrufe lesen, BEVOR einer schreibt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/stripe', () => ({ stripe: { refunds: { create: vi.fn() } } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
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
      // Standard: der Rückruf bekommt dieselben Fakes. Der Test, der die
      // Transaktion selbst beweist, ersetzt das durch EIGENE tx-Fakes.
      $transaction: vi.fn(async (arg: unknown) => {
        if (typeof arg === 'function') {
          return (arg as (tx: unknown) => Promise<unknown>)({ order, product })
        }
        return Promise.all(arg as Array<Promise<unknown>>)
      }),
    },
  }
})

import {
  cancelOrder,
  revertOrderStatus,
  revertReady,
  revertPickedUp,
} from '@/server/actions/orders'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { sendOrderCancelled } from '@/lib/email'
import * as Sentry from '@sentry/nextjs'

const getSession = vi.mocked(auth.api.getSession)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const orderFindFirst = vi.mocked(prisma.order.findFirst)
const orderUpdate = vi.mocked(prisma.order.update)
const orderUpdateMany = vi.mocked(prisma.order.updateMany)
const productUpdate = vi.mocked(prisma.product.update)
const transaktion = vi.mocked(prisma.$transaction)
const refundCreate = vi.mocked(stripe.refunds.create)
const mailStorno = vi.mocked(sendOrderCancelled)
const sentryMeldung = vi.mocked(Sentry.captureException)

/** Bar-Bestellung mit zwei Positionen — ohne PaymentIntent, damit sich die
 *  Bestandsfälle nicht mit Stripe vermischen. */
function barBestellung() {
  return {
    id: 'order_1',
    orderNumber: 'TH-1',
    customerName: 'Anna Muster',
    customerEmail: 'anna@example.com',
    customerPhone: '+43 660 0000000',
    totalAmount: { toString: () => '20.00' },
    serviceFeeCents: 0,
    serviceFeeRefundedAt: null,
    pickupDate: new Date('2026-09-25T12:00:00Z'),
    pickupTimeStart: '14:00',
    pickupTimeEnd: '16:00',
    paymentMethod: 'ONSITE_CASH',
    paymentStatus: 'PENDING',
    stripePaymentIntentId: null as string | null,
    /** Bestellstatus des Fakes — die Tests setzen ihn je Szenario. */
    status: 'CONFIRMED' as string,
    items: [
      { id: 'i1', productId: 'p_eier', productName: 'Eier', quantity: 2, unitPrice: { toString: () => '5.00' }, totalPrice: { toString: () => '10.00' }, product: null },
      { id: 'i2', productId: 'p_milch', productName: 'Milch', quantity: 3, unitPrice: { toString: () => '1.40' }, totalPrice: { toString: () => '4.20' }, product: null },
    ],
  }
}

type StatusFilter = string | { in?: string[]; notIn?: string[] } | undefined

/** Wie PostgreSQL einen Statusfilter auswertet: fehlt er, passt jeder Satz. */
function passt(filter: StatusFilter, status: string): boolean {
  if (filter === undefined) return true
  if (typeof filter === 'string') return filter === status
  if (filter.in && !filter.in.includes(status)) return false
  if (filter.notIn && filter.notIn.includes(status)) return false
  return true
}

/**
 * Nachgebaute Datenbank für EINE Bestellung. findFirst und updateMany werten
 * den Statusfilter aus; update schreibt blind (wie das echte update ohne
 * Statusbedingung). updateMany prüft und setzt in einem Zug.
 */
function datenbankMit(bestellung: ReturnType<typeof barBestellung>) {
  const satz = { ...bestellung }

  orderFindFirst.mockImplementation((async (arg: { where: { status?: StatusFilter } }) =>
    passt(arg?.where?.status, satz.status) ? satz : null) as never)

  orderUpdate.mockImplementation((async (arg: { data: Record<string, unknown> }) => {
    if (typeof arg?.data?.status === 'string') satz.status = arg.data.status
    return satz
  }) as never)

  orderUpdateMany.mockImplementation((async (arg: {
    where: { status?: StatusFilter }
    data: Record<string, unknown>
  }) => {
    if (!passt(arg?.where?.status, satz.status)) return { count: 0 }
    if (typeof arg?.data?.status === 'string') satz.status = arg.data.status
    return { count: 1 }
  }) as never)

  return satz
}

/** Wie oft der Bestand hochgebucht wurde — über ALLE Wege (tx und direkt). */
function rueckbuchungen(): number {
  return productUpdate.mock.calls.length
}

beforeEach(() => {
  vi.clearAllMocks()
  // clearAllMocks setzt nur Aufrufe zurück, keine Implementierungen. Ein Test,
  // der die Transaktion mit eigenen tx-Fakes belegt, liefe sonst in die
  // Folgetests weiter — mit dem Bestellsatz des Vortests. Deshalb hier jedes
  // Mal zurück auf die Durchreichung an die globalen Fakes.
  transaktion.mockImplementation((async (arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => Promise<unknown>)({ order: prisma.order, product: prisma.product })
      : Promise.all(arg as Array<Promise<unknown>>)) as never)
  getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
  farmFindUnique.mockResolvedValue({
    id: 'farm_1', name: 'Hof Test', slug: 'hof-test', email: 'hof@example.com', ownerName: 'Max Mustermann',
    address: 'Weg 1', postalCode: '1010', city: 'Musterdorf', phone: '+43 660 0000000',
  } as never)
  productUpdate.mockResolvedValue({} as never)
  refundCreate.mockResolvedValue({ id: 're_1', amount: 2000 } as never)
  mailStorno.mockResolvedValue(undefined as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Doppelausführung ────────────────────────────────────────────────────────

describe('cancelOrder — Doppelausführung', () => {
  it('zwei GLEICHZEITIGE Stornierungen buchen den Bestand genau einmal zurück', async () => {
    const satz = datenbankMit(barBestellung())

    // Wettlauf deterministisch: beide Aufrufe LESEN, bevor einer schreibt —
    // exakt die Doppeltipp-Situation, in der beide die Leseprüfung passieren.
    const echtesLesen = orderFindFirst.getMockImplementation()
    if (!echtesLesen) throw new Error('datenbankMit hat findFirst nicht belegt')
    let leseAnfragen = 0
    let beideDa: () => void = () => {}
    const beideGelesen = new Promise<void>((entsperren) => { beideDa = entsperren })
    orderFindFirst.mockImplementation((async (arg: never) => {
      leseAnfragen += 1
      if (leseAnfragen >= 2) beideDa()
      await beideGelesen
      return echtesLesen(arg)
    }) as never)

    const [erste, zweite] = await Promise.all([
      cancelOrder('order_1', 'Hof verhindert'),
      cancelOrder('order_1', 'Hof verhindert'),
    ])

    const fehler = [erste, zweite].filter((r) => r.error)
    expect(fehler).toHaveLength(1)
    expect(fehler[0]?.error).toBe('Diese Bestellung ist schon storniert oder abgeholt.')
    expect(rueckbuchungen()).toBe(2) // zwei Positionen, einmal
    expect(satz.status).toBe('CANCELLED')
  })

  it('zweiter Aufruf NACH erfolgreicher Stornierung: Fehler, kein weiteres increment', async () => {
    datenbankMit(barBestellung())

    expect(await cancelOrder('order_1')).toEqual({})
    expect(rueckbuchungen()).toBe(2)

    const zweite = await cancelOrder('order_1')

    expect(zweite.error).toBe('Diese Bestellung ist schon storniert oder abgeholt.')
    expect(rueckbuchungen()).toBe(2)
    expect(refundCreate).not.toHaveBeenCalled()
  })

  it('Statuswechsel und Rückbuchung laufen durch DIESELBE Transaktion — nicht an ihr vorbei', async () => {
    const satz = datenbankMit(barBestellung())
    // Eigene tx-Fakes: Nur was über `tx` läuft, liegt in der Transaktion.
    // Eine Rückbuchung über das globale prisma fiele hier auf.
    const ablauf: string[] = []
    const txProduktUpdate = vi.fn(async () => { ablauf.push('buchung'); return {} })
    const txUpdateMany = vi.fn(async (arg: { where: { status?: StatusFilter }; data: Record<string, unknown> }) => {
      ablauf.push('sperre')
      if (!passt(arg.where.status, satz.status)) return { count: 0 }
      satz.status = String(arg.data.status)
      return { count: 1 }
    })
    transaktion.mockImplementation((async (arg: unknown) => {
      ablauf.push('start')
      const ergebnis = await (arg as (tx: unknown) => Promise<unknown>)({
        order: { updateMany: txUpdateMany },
        product: { update: txProduktUpdate },
      })
      ablauf.push('ende')
      return ergebnis
    }) as never)

    await cancelOrder('order_1')

    expect(ablauf).toEqual(['start', 'sperre', 'buchung', 'buchung', 'ende'])
    expect(productUpdate).not.toHaveBeenCalled()
    expect(orderUpdateMany).not.toHaveBeenCalled()
  })

  it('NOT_PICKED_UP ist gesperrt: kein Storno, keine Rückbuchung, kein Stripe', async () => {
    // Bei „nicht abgeholt" bleibt der Warenpreis beim Hof (markAsNotPickedUp).
    // Die Oberfläche bietet dort kein Storno an — der Server darf es auch nicht.
    const satz = datenbankMit({
      ...barBestellung(),
      status: 'NOT_PICKED_UP',
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      stripePaymentIntentId: 'pi_1',
    })

    const result = await cancelOrder('order_1')

    expect(result.error).toBe('Diese Bestellung ist schon storniert oder abgeholt.')
    expect(satz.status).toBe('NOT_PICKED_UP')
    expect(rueckbuchungen()).toBe(0)
    expect(refundCreate).not.toHaveBeenCalled()
  })
})

// ─── Erstattung nach der Sperre ──────────────────────────────────────────────

describe('cancelOrder — Erstattung erst nach der Sperre', () => {
  function onlineBezahlt() {
    return datenbankMit({
      ...barBestellung(),
      status: 'PAID',
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      stripePaymentIntentId: 'pi_1',
    })
  }

  it('Stripe erst NACH dem gesperrten Statuswechsel, volle Erstattung, danach REFUNDED und Mail', async () => {
    onlineBezahlt()

    const result = await cancelOrder('order_1')

    expect(result).toEqual({})
    // Voll erstattet: nur der Intent, kein Betrag, kein zweiter Parameter.
    expect(refundCreate).toHaveBeenCalledWith({ payment_intent: 'pi_1' })
    expect(orderUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(
      refundCreate.mock.invocationCallOrder[0]
    )
    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { paymentStatus: 'REFUNDED' } })
    )
    expect(mailStorno).toHaveBeenCalledWith(expect.objectContaining({ orderNumber: 'TH-1' }), 20)
  })

  it('scheitert die Erstattung: Storno bleibt, Ware bleibt zurückgebucht, KEINE Mail, Meldung an Sentry', async () => {
    const satz = onlineBezahlt()
    refundCreate.mockRejectedValue(new Error('insufficient_funds'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await cancelOrder('order_1')

    expect(result.error).toBe(
      'Rückerstattung fehlgeschlagen. Bitte manuell über das Stripe Dashboard erstatten.'
    )
    expect(satz.status).toBe('CANCELLED')
    expect(rueckbuchungen()).toBe(2)
    // Kein falscher REFUNDED-Vermerk (paymentStatus bleibt PAID).
    expect(orderUpdate).not.toHaveBeenCalled()
    // Die Storno-Vorlage liest „keine Erstattung" als Vor-Ort-Zahlung und
    // schriebe „Da du vor Ort bezahlst, entstehen dir keine Kosten" — an eine
    // Kundin, die online bezahlt hat und noch nichts zurückbekam.
    expect(mailStorno).not.toHaveBeenCalled()
    // Offenes Geld darf nicht nur im Log stehen.
    expect(sentryMeldung).toHaveBeenCalledTimes(1)
    const [, kontext] = sentryMeldung.mock.calls[0] as [unknown, { extra?: Record<string, unknown> }]
    expect(kontext.extra).toEqual(expect.objectContaining({ orderId: 'order_1' }))
    // Keine Kundendaten an Sentry (CLAUDE.md, Sicherheit).
    expect(JSON.stringify(kontext)).not.toContain('anna@example.com')
  })

  it('der Mailversand hängt nicht im Antwortpfad — eine nie endende Mail blockiert die Stornierung nicht', async () => {
    datenbankMit({ ...barBestellung(), status: 'READY' })
    mailStorno.mockImplementation((() => new Promise<void>(() => {})) as never)

    const ergebnis = await Promise.race([
      cancelOrder('order_1'),
      new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 1500)),
    ])

    expect(ergebnis).toEqual({})
    expect(mailStorno).toHaveBeenCalledTimes(1)
  })
})

// ─── Undo darf eine Stornierung nie aufheben ─────────────────────────────────

describe('Undo-Aktionen — eine stornierte Bestellung bleibt storniert', () => {
  it('revertOrderStatus auf eine stornierte Bestellung: abgelehnt, Status bleibt CANCELLED', async () => {
    // Weg im UI: „Bereit" → Storno → im noch sichtbaren Toast „Rückgängig".
    const satz = datenbankMit({ ...barBestellung(), status: 'CANCELLED' })

    const result = await revertOrderStatus('order_1', 'CONFIRMED')

    expect(result.error).toBeTruthy()
    expect(satz.status).toBe('CANCELLED')
  })

  it('Storno → Undo → Storno bucht den Bestand genau EINMAL zurück', async () => {
    const satz = datenbankMit({ ...barBestellung(), status: 'READY' })

    await cancelOrder('order_1')
    await revertOrderStatus('order_1', 'CONFIRMED')
    await cancelOrder('order_1')

    expect(satz.status).toBe('CANCELLED')
    expect(rueckbuchungen()).toBe(2)
  })

  it('revertOrderStatus aus READY bzw. PICKED_UP funktioniert weiter', async () => {
    const satz = datenbankMit({ ...barBestellung(), status: 'READY' })
    expect(await revertOrderStatus('order_1', 'CONFIRMED')).toEqual({})
    expect(satz.status).toBe('CONFIRMED')

    satz.status = 'PICKED_UP'
    expect(await revertOrderStatus('order_1', 'READY')).toEqual({})
    expect(satz.status).toBe('READY')
  })

  it.each([
    ['revertReady', 'READY', () => revertReady('order_1', false)],
    ['revertPickedUp', 'PICKED_UP', () => revertPickedUp('order_1')],
  ] as const)(
    '%s: wird zwischen Lesen und Schreiben storniert, bleibt die Bestellung storniert',
    async (_name, ausgang, rueckweg) => {
      const satz = datenbankMit({ ...barBestellung(), status: ausgang })
      // Der Storno „gewinnt" genau zwischen der Leseprüfung des Rückwegs und
      // seinem Schreiben — die Leseprüfung allein hielte das nicht auf.
      const echtesLesen = orderFindFirst.getMockImplementation()
      if (!echtesLesen) throw new Error('datenbankMit hat findFirst nicht belegt')
      orderFindFirst.mockImplementationOnce((async (arg: never) => {
        const gelesen = await echtesLesen(arg)
        satz.status = 'CANCELLED'
        return gelesen
      }) as never)

      const result = await rueckweg()

      expect(result.error).toBeTruthy()
      expect(satz.status).toBe('CANCELLED')
    }
  )
})
