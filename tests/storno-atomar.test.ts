/**
 * Stornierung: Rückbuchung atomar und gegen Doppelausführung gesperrt
 * (src/server/actions/orders.ts, cancelOrder) — am echten Code, Prisma/
 * Stripe/Mail gemockt.
 *
 * Der Fehler: cancelOrder prüfte den Status nur LESEND (findFirst) und buchte
 * dann je Position außerhalb jeder Transaktion zurück; der Statuswechsel kam
 * erst am Ende. Zwei parallele Aufrufe (Doppeltipp) passierten beide die
 * Leseprüfung und erhöhten den Bestand doppelt. Richtig macht es der
 * Stripe-Webhook: Statuswechsel und Rückbuchung in EINER Transaktion, der
 * bedingte Statuswechsel ist die Sperre.
 *
 * Die Fakes hier bilden die Datenbank-Semantik nach: ein Bestellsatz mit
 * echtem Status, updateMany als Prüfen-und-Setzen in einem Zug (in JS
 * unteilbar — genau wie ein einzelnes UPDATE … WHERE in PostgreSQL).
 * Der Wettlauf selbst wird deterministisch erzwungen: beide Aufrufe lesen,
 * BEVOR einer schreibt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/stripe', () => ({ stripe: { refunds: { create: vi.fn() } } }))
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
      // Interaktive Transaktion: der Rückruf bekommt dieselben Fakes. Für die
      // Aussagen hier reicht das — entscheidend ist, dass Statuswechsel und
      // Rückbuchung durch EINEN Transaktionsrahmen laufen.
      $transaction: vi.fn(async (arg: unknown) => {
        if (typeof arg === 'function') {
          return (arg as (tx: unknown) => Promise<unknown>)({ order, product })
        }
        return Promise.all(arg as Array<Promise<unknown>>)
      }),
    },
  }
})

import { cancelOrder } from '@/server/actions/orders'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { sendOrderCancelled } from '@/lib/email'

const getSession = vi.mocked(auth.api.getSession)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const orderFindFirst = vi.mocked(prisma.order.findFirst)
const orderUpdate = vi.mocked(prisma.order.update)
const orderUpdateMany = vi.mocked(prisma.order.updateMany)
const productUpdate = vi.mocked(prisma.product.update)
const refundCreate = vi.mocked(stripe.refunds.create)
const mailStorno = vi.mocked(sendOrderCancelled)

/** Bar-Bestellung mit zwei Positionen — der Wettlauf dreht sich um Bestand,
 *  nicht um Stripe, deshalb ohne PaymentIntent. */
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
    /** Bestellstatus des Fakes — die Tests setzen ihn je Szenario um. */
    status: 'PAID' as string,
    items: [
      { id: 'i1', productId: 'p_eier', productName: 'Eier', quantity: 2, unitPrice: { toString: () => '5.00' }, totalPrice: { toString: () => '10.00' }, product: null },
      { id: 'i2', productId: 'p_milch', productName: 'Milch', quantity: 3, unitPrice: { toString: () => '1.40' }, totalPrice: { toString: () => '4.20' }, product: null },
    ],
  }
}

/**
 * Nachgebaute Datenbank für EINE Bestellung: findFirst achtet auf einen
 * Statusfilter, update/updateMany schreiben den Status wirklich. updateMany
 * prüft und setzt in einem Zug — wie ein einzelnes UPDATE … WHERE.
 */
function datenbankMit(bestellung: ReturnType<typeof barBestellung>) {
  const satz = { ...bestellung }

  orderFindFirst.mockImplementation((async (arg: {
    where: { status?: { in?: string[]; notIn?: string[] } }
  }) => {
    const filter = arg?.where?.status
    if (filter?.notIn?.includes(satz.status ?? '') === true) return null
    if (filter?.in && !filter.in.includes(satz.status ?? '')) return null
    return satz
  }) as never)

  orderUpdate.mockImplementation((async (arg: { data: Record<string, unknown> }) => {
    if (typeof arg?.data?.status === 'string') satz.status = arg.data.status
    return satz
  }) as never)

  orderUpdateMany.mockImplementation((async (arg: {
    where: { status?: { notIn?: string[] } }
    data: Record<string, unknown>
  }) => {
    const gesperrt = arg?.where?.status?.notIn?.includes(satz.status ?? '') === true
    if (gesperrt) return { count: 0 }
    if (typeof arg?.data?.status === 'string') satz.status = arg.data.status
    return { count: 1 }
  }) as never)

  return satz
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
  farmFindUnique.mockResolvedValue({
    id: 'farm_1', name: 'Hof Test', slug: 'hof-test', email: 'hof@example.com', ownerName: 'Max Mustermann',
    address: 'Weg 1', postalCode: '5270', city: 'Musterdorf', phone: '+43 660 0000000',
  } as never)
  productUpdate.mockResolvedValue({} as never)
  refundCreate.mockResolvedValue({ id: 're_1', amount: 2000 } as never)
  mailStorno.mockResolvedValue(undefined as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('cancelOrder — Doppelausführung', () => {
  it('zwei GLEICHZEITIGE Stornierungen buchen den Bestand genau einmal zurück', async () => {
    const satz = datenbankMit(barBestellung())
    satz.status = 'CONFIRMED'

    // Wettlauf deterministisch: beide Aufrufe LESEN, bevor einer schreibt —
    // exakt die Doppeltipp-Situation, in der beide die Leseprüfung passieren.
    let leseAnfragen = 0
    let beideDa: () => void = () => {}
    const beideGelesen = new Promise<void>((entsperren) => { beideDa = entsperren })
    const echtesLesen = orderFindFirst.getMockImplementation()!
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

    // Genau EIN Gewinner, genau EINE Rückbuchung je Position (2 Positionen).
    const fehler = [erste, zweite].filter((r) => r.error)
    expect(fehler).toHaveLength(1)
    expect(fehler[0]?.error).toBe('Diese Bestellung ist schon storniert oder abgeholt.')
    expect(productUpdate).toHaveBeenCalledTimes(2)
    expect(satz.status).toBe('CANCELLED')
  })

  it('zweiter Aufruf NACH erfolgreicher Stornierung: Fehler, kein weiteres increment', async () => {
    const satz = datenbankMit(barBestellung())
    satz.status = 'CONFIRMED'

    const erste = await cancelOrder('order_1')
    expect(erste).toEqual({})
    const buchungenDanach = productUpdate.mock.calls.length
    expect(buchungenDanach).toBe(2)

    const zweite = await cancelOrder('order_1')

    expect(zweite.error).toBeTruthy()
    expect(productUpdate).toHaveBeenCalledTimes(buchungenDanach)
    expect(refundCreate).not.toHaveBeenCalled()
  })

  it('Statuswechsel und Rückbuchung laufen in EINER Transaktion', async () => {
    const satz = datenbankMit(barBestellung())
    satz.status = 'PAID'
    const transaktion = vi.mocked(prisma.$transaction)
    const inTransaktion: string[] = []
    transaktion.mockImplementation((async (arg: unknown) => {
      inTransaktion.push('start')
      const ergebnis =
        typeof arg === 'function'
          ? await (arg as (tx: unknown) => Promise<unknown>)({ order: prisma.order, product: prisma.product })
          : await Promise.all(arg as Array<Promise<unknown>>)
      inTransaktion.push('ende')
      return ergebnis
    }) as never)

    await cancelOrder('order_1')

    // Beide Rückbuchungen fielen zwischen Start und Ende der Transaktion.
    expect(inTransaktion).toEqual(['start', 'ende'])
    expect(transaktion).toHaveBeenCalledTimes(1)
    expect(productUpdate).toHaveBeenCalledTimes(2)
    const reihenfolge = transaktion.mock.invocationCallOrder[0]
    for (const aufruf of productUpdate.mock.invocationCallOrder) {
      expect(aufruf).toBeGreaterThan(reihenfolge)
    }
  })
})

describe('cancelOrder — Erstattung erst nach der Sperre', () => {
  function onlineBezahlt() {
    const satz = datenbankMit({
      ...barBestellung(),
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      stripePaymentIntentId: 'pi_1',
    })
    satz.status = 'PAID'
    return satz
  }

  it('Stripe wird NACH dem gesperrten Statuswechsel gerufen, danach REFUNDED', async () => {
    onlineBezahlt()

    const result = await cancelOrder('order_1')

    expect(result).toEqual({})
    expect(refundCreate).toHaveBeenCalledTimes(1)
    // Erst die Sperre (updateMany), dann Stripe.
    expect(orderUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(
      refundCreate.mock.invocationCallOrder[0]
    )
    // Der REFUNDED-Vermerk kommt nach der Erstattung.
    const refundedVermerk = orderUpdate.mock.calls.find(
      (c) => (c[0] as { data: Record<string, unknown> }).data.paymentStatus === 'REFUNDED'
    )
    expect(refundedVermerk).toBeTruthy()
    expect(mailStorno).toHaveBeenCalledWith(expect.objectContaining({ orderNumber: 'TH-1' }), 20)
  })

  it('scheitert die Erstattung: Bestellung BLEIBT storniert, Ware bleibt zurückgebucht, Meldung an den Hof', async () => {
    const satz = onlineBezahlt()
    refundCreate.mockRejectedValue(new Error('insufficient_funds'))
    const fehlerLog = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await cancelOrder('order_1')

    expect(result.error).toBe(
      'Rückerstattung fehlgeschlagen. Bitte manuell über das Stripe Dashboard erstatten.'
    )
    expect(satz.status).toBe('CANCELLED')
    expect(productUpdate).toHaveBeenCalledTimes(2)
    // Kein falscher REFUNDED-Vermerk; das Enum kennt kein „Erstattung
    // ausstehend", also bleibt paymentStatus unangetastet (PAID).
    for (const c of orderUpdate.mock.calls) {
      expect((c[0] as { data: Record<string, unknown> }).data.paymentStatus).not.toBe('REFUNDED')
    }
    expect(fehlerLog).toHaveBeenCalled()
  })

  it('der Mailversand hängt nicht im Antwortpfad — eine langsame Mail blockiert die Stornierung nicht', async () => {
    const satz = datenbankMit(barBestellung())
    satz.status = 'READY'
    // Mail, die nie fertig wird: hinge sie im Antwortpfad, käme cancelOrder
    // nie zurück und der Wettlauf unten liefe in den Timeout.
    mailStorno.mockImplementation((() => new Promise<void>(() => {})) as never)

    const ergebnis = await Promise.race([
      cancelOrder('order_1'),
      new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 1500)),
    ])

    expect(ergebnis).toEqual({})
    expect(mailStorno).toHaveBeenCalledTimes(1)
  })
})
