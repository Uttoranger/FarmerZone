/**
 * Tests für die Verkauf-2-Summen (src/lib/sales-summary.ts) mit gemischtem
 * Datensatz: Stripe-Order abgeholt → Online; Vor-Ort abgeholt → Bar;
 * Direktverkauf → Bar; NICHT abgeholte Bestellung zählt nirgends.
 * Plus: Merge-Sortierung der vereinten Letzte-Verkäufe-Liste.
 */
import { describe, it, expect } from 'vitest'
import {
  sumOnlinePaid,
  sumBarKassiert,
  sumWeekTotal,
  mergeSalesFeed,
  type SalesFeedOrder,
  type SummableSale,
} from '@/lib/sales-summary'

function order(over: Partial<SalesFeedOrder>): SalesFeedOrder {
  return {
    id: 'o1',
    orderNumber: 'TH-1',
    customerName: 'Anna',
    status: 'PICKED_UP',
    totalAmount: 10,
    stripePaymentIntentId: null,
    pickedUpAt: new Date('2026-07-20T10:00:00Z'),
    itemsLabel: '1× Eier',
    ...over,
  }
}

const STRIPE_ABGEHOLT = order({ id: 'stripe', totalAmount: 20, stripePaymentIntentId: 'pi_123' })
const VOROrt_ABGEHOLT = order({ id: 'bar', totalAmount: 7 })
const NICHT_ABGEHOLT = order({ id: 'offen', totalAmount: 99, status: 'READY', pickedUpAt: null, stripePaymentIntentId: 'pi_999' })
const DIREKTVERKAUF: SummableSale = { id: 'ms1', totalAmount: 5, saleDate: new Date('2026-07-20T12:00:00Z') }

const GEMISCHT = [STRIPE_ABGEHOLT, VOROrt_ABGEHOLT, NICHT_ABGEHOLT]

describe('Summen-Definitionen (gemischter Datensatz)', () => {
  it('Stripe-Order abgeholt zählt Online — und nur dort', () => {
    expect(sumOnlinePaid(GEMISCHT)).toBe(20)
    expect(sumBarKassiert(GEMISCHT, [])).toBe(7)
  })

  it('Vor-Ort abgeholt zählt Bar', () => {
    expect(sumBarKassiert([VOROrt_ABGEHOLT], [])).toBe(7)
    expect(sumOnlinePaid([VOROrt_ABGEHOLT])).toBe(0)
  })

  it('Direktverkauf zählt Bar', () => {
    expect(sumBarKassiert([], [DIREKTVERKAUF])).toBe(5)
    expect(sumOnlinePaid([])).toBe(0)
  })

  it('NICHT abgeholte Bestellung zählt nirgends — auch mit Stripe-Zahlung', () => {
    expect(sumOnlinePaid([NICHT_ABGEHOLT])).toBe(0)
    expect(sumBarKassiert([NICHT_ABGEHOLT], [])).toBe(0)
  })

  it('Anker-Zahl = Online + Bar, überschneidungsfrei', () => {
    expect(sumWeekTotal(GEMISCHT, [DIREKTVERKAUF])).toBe(20 + 7 + 5)
  })
})

describe('mergeSalesFeed (vereinte Letzte-Liste)', () => {
  it('sortiert beide Quellen gemeinsam absteigend nach Zeit', () => {
    const o1 = order({ id: 'a', pickedUpAt: new Date('2026-07-18T10:00:00Z') })
    const o2 = order({ id: 'b', pickedUpAt: new Date('2026-07-21T10:00:00Z') })
    const s1: SummableSale = { id: 's1', totalAmount: 3, saleDate: new Date('2026-07-20T10:00:00Z') }
    const s2: SummableSale = { id: 's2', totalAmount: 4, saleDate: new Date('2026-07-19T10:00:00Z') }

    const feed = mergeSalesFeed([o1, o2], [s1, s2])
    expect(feed.map((e) => (e.kind === 'order' ? e.order.id : e.sale.id))).toEqual([
      'b', 's1', 's2', 'a',
    ])
  })

  it('nimmt nur abgeholte Bestellungen in die Liste', () => {
    const feed = mergeSalesFeed([NICHT_ABGEHOLT, STRIPE_ABGEHOLT], [])
    expect(feed).toHaveLength(1)
    expect(feed[0].kind === 'order' && feed[0].order.id).toBe('stripe')
  })

  it('respektiert das Limit über beide Quellen hinweg', () => {
    const orders = Array.from({ length: 8 }, (_, i) =>
      order({ id: `o${i}`, pickedUpAt: new Date(Date.UTC(2026, 6, 1 + i)) })
    )
    const sales: SummableSale[] = Array.from({ length: 8 }, (_, i) => ({
      id: `s${i}`,
      totalAmount: 1,
      saleDate: new Date(Date.UTC(2026, 6, 1 + i, 12)),
    }))
    const feed = mergeSalesFeed(orders, sales, 10)
    expect(feed).toHaveLength(10)
    // die zeitlich neuesten zuerst
    expect(feed[0].when.getTime()).toBeGreaterThanOrEqual(feed[9].when.getTime())
  })
})
