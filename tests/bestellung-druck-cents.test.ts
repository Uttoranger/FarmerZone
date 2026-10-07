/**
 * `getOrderDetail` (src/server/queries/orders.ts, Druckansicht) gibt Geld als
 * ganze Cent weiter, gewandelt über Decimal (`alsCents`) — nicht mehr als
 * `Number(decimal)` (Nr. 19b, Morgenbericht Lauf 4 §7; CODING_STANDARDS §2).
 *
 * Aussage: Die Beträge kommen centgenau an, auch bei Werten, die als
 * Fließkommazahl nicht exakt darstellbar sind (19,99 · 0,29 · 1,10), und
 * keine Geldspalte wird mehr als Fließkommazahl ausgeliefert.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from '@prisma/client/runtime/index-browser'

vi.mock('@/lib/prisma', () => ({ prisma: { order: { findFirst: vi.fn(), findMany: vi.fn() } } }))

import { getOrderDetail } from '@/server/queries/orders'
import { bestellSummen } from '@/lib/servicegebuehr'
import { prisma } from '@/lib/prisma'

const findFirst = vi.mocked(prisma.order.findFirst)

function bestellung() {
  return {
    id: 'order_1',
    orderNumber: 'HT-1',
    status: 'CONFIRMED',
    paymentMethod: 'ONSITE_CASH',
    paymentStatus: 'PENDING',
    stripePaymentIntentId: null,
    totalAmount: new Decimal('21.09'),
    platformFeeAmount: new Decimal('0.29'),
    serviceFeeCents: 0,
    serviceFeePercentApplied: null,
    items: [
      { id: 'i1', productId: 'p1', productName: 'Eier', quantity: 1, unitPrice: new Decimal('19.99'), totalPrice: new Decimal('19.99'), fehltSeit: null, product: null },
      { id: 'i2', productId: 'p2', productName: 'Milch', quantity: 1, unitPrice: new Decimal('1.10'), totalPrice: new Decimal('1.10'), fehltSeit: null, product: { unit: 'LITER', unitSize: new Decimal('1') } },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  findFirst.mockResolvedValue(bestellung() as never)
})

describe('getOrderDetail — Geld als ganze Cent', () => {
  it('liefert Warenpreis, Provision und Positionen centgenau', async () => {
    const order = await getOrderDetail('farm_1', 'order_1')

    expect(order?.totalAmountCents).toBe(2109)
    expect(order?.platformFeeAmountCents).toBe(29)
    expect(order?.items.map((i) => [i.unitPriceCents, i.totalPriceCents])).toEqual([[1999, 1999], [110, 110]])
  })

  it('keine Geldspalte geht als Fließkommazahl hinaus', async () => {
    const order = await getOrderDetail('farm_1', 'order_1')

    expect(typeof order?.totalAmount).not.toBe('number')
    expect(order).not.toHaveProperty('platformFeeAmount')
    for (const item of order?.items ?? []) {
      expect(item).not.toHaveProperty('unitPrice')
      expect(item).not.toHaveProperty('totalPrice')
    }
  })

  it('Gegenprobe: die Summen der Druckansicht stimmen weiter (bestellSummen)', async () => {
    const order = await getOrderDetail('farm_1', 'order_1')
    expect(order && bestellSummen(order)).toEqual({ warenpreisCents: 2109, gebuehrCents: 0, gesamtCents: 2109 })
  })
})
