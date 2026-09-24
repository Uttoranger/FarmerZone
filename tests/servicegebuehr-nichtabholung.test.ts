/**
 * Tests für „Nicht abgeholt" und den Storno-Vermerk (src/server/actions/orders.ts,
 * Sprint servicegebuehr Teil D) — am echten Code, Prisma/Stripe/Mail gemockt.
 *
 * Beweist: bar → Status NOT_PICKED_UP, Gebühr als entfallen vermerkt, kein
 * Stripe; online → Teilerstattung in Höhe der Gebühr (nur amount + Intent,
 * OHNE reverse_transfer, OHNE refund_application_fee, mit Idempotenz-Schlüssel),
 * danach der Vermerk; Erstattungsfehler blockiert den Statuswechsel NICHT
 * (Status gesetzt, Vermerk bleibt leer, Rückgabe meldet „offen"); ohne Gebühr
 * oder bereits entfallen passiert nichts Zweites; falscher Status/keine Session
 * → nichts. Storno vermerkt die Gebühr ebenfalls als entfallen.
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
      // Storno läuft seit fix/storno-atomar durch eine interaktive
      // Transaktion — der Rückruf bekommt dieselben Fakes.
      $transaction: vi.fn(async (arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (tx: unknown) => Promise<unknown>)({ order, product })
          : Promise.all(arg as Array<Promise<unknown>>)
      ),
    },
  }
})

import { markAsNotPickedUp, cancelOrder } from '@/server/actions/orders'
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

const BAR = {
  id: 'order_bar',
  paymentMethod: 'ONSITE_CASH',
  paymentStatus: 'PENDING',
  stripePaymentIntentId: null,
  serviceFeeCents: 98,
  serviceFeeRefundedAt: null,
}
const ONLINE = {
  id: 'order_online',
  paymentMethod: 'ONLINE',
  paymentStatus: 'PAID',
  stripePaymentIntentId: 'pi_1',
  serviceFeeCents: 98,
  serviceFeeRefundedAt: null,
}

function updateDaten(): Array<Record<string, unknown>> {
  return orderUpdate.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data)
}

/** Der Storno-Schreiber ist seit fix/storno-atomar das gesperrte updateMany. */
function stornoDaten(): Array<Record<string, unknown>> {
  return orderUpdateMany.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data)
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
  farmFindUnique.mockResolvedValue({
    id: 'farm_1', name: 'Testhof', slug: 'testhof', email: 'hof@test.local', ownerName: 'Franz',
    address: 'Weg 1', postalCode: '5270', city: 'Mauerkirchen', phone: '',
  } as never)
  orderUpdate.mockResolvedValue({} as never)
  orderUpdateMany.mockResolvedValue({ count: 1 } as never)
  productUpdate.mockResolvedValue({} as never)
  refundCreate.mockResolvedValue({ id: 're_1', amount: 98 } as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('markAsNotPickedUp — Zugriff und Status', () => {
  it('ohne Session: nichts passiert', async () => {
    getSession.mockResolvedValue(null as never)
    const result = await markAsNotPickedUp('order_bar')
    expect(result.error).toBe('Nicht angemeldet')
    expect(orderUpdate).not.toHaveBeenCalled()
    expect(refundCreate).not.toHaveBeenCalled()
  })

  it('nur aus laufenden Status (PAID, CONFIRMED, IN_PREPARATION, READY) und nur eigene Bestellungen', async () => {
    orderFindFirst.mockResolvedValue(BAR as never)
    await markAsNotPickedUp('order_bar')
    expect(orderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'order_bar',
          farmId: 'farm_1',
          status: { in: ['PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY'] },
        },
      })
    )
  })

  it('falscher Status (z. B. bereits abgeholt): abgelehnt, kein Update, kein Stripe', async () => {
    orderFindFirst.mockResolvedValue(null)
    const result = await markAsNotPickedUp('order_x')
    expect(result.error).toBe('Bestellung nicht gefunden')
    expect(orderUpdate).not.toHaveBeenCalled()
    expect(refundCreate).not.toHaveBeenCalled()
  })
})

describe('markAsNotPickedUp — bar', () => {
  it('setzt NOT_PICKED_UP und vermerkt die Gebühr als entfallen — ohne Stripe, ohne Mail', async () => {
    orderFindFirst.mockResolvedValue(BAR as never)

    const result = await markAsNotPickedUp('order_bar')

    expect(result).toEqual({})
    const daten = updateDaten()
    expect(daten[0]).toEqual({ status: 'NOT_PICKED_UP' })
    expect(daten[1]).toEqual({ serviceFeeRefundedAt: expect.any(Date) })
    expect(refundCreate).not.toHaveBeenCalled()
    expect(sendOrderCancelled).not.toHaveBeenCalled()
  })

  it('WARENPREIS unangetastet: kein paymentStatus, kein Bestand, kein paidAt im Update', async () => {
    orderFindFirst.mockResolvedValue(BAR as never)
    await markAsNotPickedUp('order_bar')
    for (const d of updateDaten()) {
      expect(d).not.toHaveProperty('paymentStatus')
      expect(d).not.toHaveProperty('paidAt')
      expect(d).not.toHaveProperty('totalAmount')
    }
    expect(productUpdate).not.toHaveBeenCalled()
  })
})

describe('markAsNotPickedUp — online', () => {
  it('erstattet genau die Gebühr über Stripe und vermerkt sie danach', async () => {
    orderFindFirst.mockResolvedValue(ONLINE as never)

    const result = await markAsNotPickedUp('order_online')

    expect(result).toEqual({})
    expect(refundCreate).toHaveBeenCalledTimes(1)
    const [params, options] = refundCreate.mock.calls[0] as [Record<string, unknown>, Record<string, unknown>]
    expect(params).toEqual(
      expect.objectContaining({ payment_intent: 'pi_1', amount: 98 })
    )
    // Destination charge: die Erstattung kommt vom Plattform-Saldo. Nichts darf
    // den Transfer an den Hof anfassen oder die Application Fee an den Hof
    // zurückgeben — der Hof behält exakt 100 % Warenpreis.
    expect(params).not.toHaveProperty('reverse_transfer')
    expect(params).not.toHaveProperty('refund_application_fee')
    expect(options).toEqual(expect.objectContaining({ idempotencyKey: expect.stringContaining('order_online') }))

    const daten = updateDaten()
    expect(daten[0]).toEqual({ status: 'NOT_PICKED_UP' })
    expect(daten[1]).toEqual({ serviceFeeRefundedAt: expect.any(Date) })
  })

  it('Erstattung schlägt fehl → Status trotzdem gesetzt, Vermerk bleibt leer, Rückgabe meldet „offen", Fehler im Log', async () => {
    orderFindFirst.mockResolvedValue(ONLINE as never)
    refundCreate.mockRejectedValue(new Error('insufficient_funds'))
    const fehlerLog = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await markAsNotPickedUp('order_online')

    expect(result).toEqual({ gebuehrErstattungOffen: true })
    expect(updateDaten()).toEqual([{ status: 'NOT_PICKED_UP' }])
    expect(fehlerLog).toHaveBeenCalledTimes(1)
    expect(String(fehlerLog.mock.calls[0]?.[0])).toContain('order_online')
  })

  it('Erstattung erst NACH dem Statuswechsel — der Status hängt nie an Stripe', async () => {
    orderFindFirst.mockResolvedValue(ONLINE as never)
    const reihenfolge: string[] = []
    orderUpdate.mockImplementation(((arg: { data: Record<string, unknown> }) => {
      reihenfolge.push('status' in arg.data ? 'status' : 'vermerk')
      return Promise.resolve({})
    }) as never)
    refundCreate.mockImplementation((() => {
      reihenfolge.push('stripe')
      return Promise.resolve({ id: 're_1' })
    }) as never)

    await markAsNotPickedUp('order_online')

    expect(reihenfolge).toEqual(['status', 'stripe', 'vermerk'])
  })

  it('ohne Gebühr: kein Stripe, kein zweiter Vermerk', async () => {
    orderFindFirst.mockResolvedValue({ ...ONLINE, serviceFeeCents: 0 } as never)
    await markAsNotPickedUp('order_online')
    expect(refundCreate).not.toHaveBeenCalled()
    expect(updateDaten()).toEqual([{ status: 'NOT_PICKED_UP' }])
  })

  it('bereits entfallene Gebühr wird nicht ein zweites Mal erstattet', async () => {
    orderFindFirst.mockResolvedValue({ ...ONLINE, serviceFeeRefundedAt: new Date() } as never)
    await markAsNotPickedUp('order_online')
    expect(refundCreate).not.toHaveBeenCalled()
    expect(updateDaten()).toEqual([{ status: 'NOT_PICKED_UP' }])
  })
})

describe('cancelOrder — Gebühren-Vermerk bei Storno', () => {
  const STORNO_BAR = {
    id: 'order_bar',
    orderNumber: 'TH-1',
    customerName: 'Anna',
    customerEmail: 'anna@test.local',
    customerPhone: '+43',
    totalAmount: { toString: () => '20.00' },
    serviceFeeCents: 98,
    serviceFeeRefundedAt: null,
    pickupDate: new Date('2026-09-25T12:00:00Z'),
    pickupTimeStart: '14:00',
    pickupTimeEnd: '16:00',
    paymentMethod: 'ONSITE_CASH',
    paymentStatus: 'PENDING',
    stripePaymentIntentId: null,
    items: [],
  }

  it('bar storniert: Gebühr als entfallen vermerkt (nie kassiert), kein Stripe', async () => {
    orderFindFirst.mockResolvedValue(STORNO_BAR as never)
    const result = await cancelOrder('order_bar')
    expect(result).toEqual({})
    expect(refundCreate).not.toHaveBeenCalled()
    expect(stornoDaten().at(-1)).toEqual(
      expect.objectContaining({ status: 'CANCELLED', serviceFeeRefundedAt: expect.any(Date) })
    )
  })

  it('ohne Gebühr bleibt der Vermerk weg', async () => {
    orderFindFirst.mockResolvedValue({ ...STORNO_BAR, serviceFeeCents: 0 } as never)
    await cancelOrder('order_bar')
    expect(stornoDaten().at(-1)).not.toHaveProperty('serviceFeeRefundedAt')
  })

  it('online bezahlt: volle Erstattung wie bisher (unverändert), dazu der Vermerk', async () => {
    orderFindFirst.mockResolvedValue({
      ...STORNO_BAR,
      id: 'order_online',
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      stripePaymentIntentId: 'pi_1',
    } as never)
    refundCreate.mockResolvedValue({ id: 're_full', amount: 2098 } as never)

    await cancelOrder('order_online')

    // Unverändert voll: Erstattung nur über den Intent, OHNE amount (der ganze
    // Zahlungsbetrag). Neu ist nur der Idempotenz-Schlüssel.
    const [params, options] = refundCreate.mock.calls[0] as [Record<string, unknown>, Record<string, unknown>]
    expect(params).toEqual({ payment_intent: 'pi_1' })
    expect(options).toEqual(expect.objectContaining({ idempotencyKey: expect.stringContaining('order_online') }))
    expect(stornoDaten().at(-1)).toEqual(
      expect.objectContaining({ status: 'CANCELLED', serviceFeeRefundedAt: expect.any(Date) })
    )
    expect(sendOrderCancelled).toHaveBeenCalledWith(expect.objectContaining({ serviceFeeCents: 98 }), 20.98)
  })
})
