/**
 * Erstattungen mit festen Beträgen (src/server/teilerstattung.ts) — Zeitgrenze
 * und „nie zweimal" am echten Code, Stripe gemockt.
 *
 * Der Fehler (Nachbesserung Nr. 19): Ohne Request-Optionen wiederholt das
 * Stripe-SDK jeden Aufruf zweimal mit langer Zeitgrenze. In der Zeilensperre
 * von „Artikel fehlt" lief die Transaktion so ab, während Stripe noch buchte
 * — Geld erstattet, Datenbank weiß nichts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: { retrieve: vi.fn() },
    refunds: { create: vi.fn(), list: vi.fn() },
    transfers: { createReversal: vi.fn(), listReversals: vi.fn() },
  },
}))

import { stripe } from '@/lib/stripe'
import {
  STRIPE_AUFRUFE_HOECHSTENS,
  STRIPE_OPTIONEN,
  erstatteMitFestemBetrag,
} from '@/server/teilerstattung'
import { TRANSAKTION_MS } from '@/server/artikel-fehlt'

const EINGABE = {
  paymentIntentId: 'pi_1',
  orderId: 'order_1',
  erstattungCents: 500,
  vomHofCents: 450,
  schluessel: 'storno-order_1',
  schluesselHof: 'storno-hof-order_1',
  onRueckbuchungFehler: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue({ latest_charge: { transfer: 'tr_1' } } as never)
  vi.mocked(stripe.refunds.list).mockResolvedValue({ data: [] } as never)
  vi.mocked(stripe.transfers.listReversals).mockResolvedValue({ data: [] } as never)
  vi.mocked(stripe.refunds.create).mockResolvedValue({ amount: 500 } as never)
  vi.mocked(stripe.transfers.createReversal).mockResolvedValue({ amount: 450 } as never)
})

describe('Zeitgrenze in der Sperre', () => {
  it('Stripe-Aufrufe ohne SDK-Wiederholung, Summe der Zeitgrenzen sicher unter der Transaktion', () => {
    expect(STRIPE_OPTIONEN.maxNetworkRetries).toBe(0)
    expect(STRIPE_AUFRUFE_HOECHSTENS * STRIPE_OPTIONEN.timeout).toBeLessThanOrEqual(TRANSAKTION_MS - 10_000)
  })

  it('jeder Aufruf trägt die Optionen, Buchungen dazu ihren Schlüssel und ihre Merkmale', async () => {
    await erstatteMitFestemBetrag(EINGABE)

    expect(vi.mocked(stripe.paymentIntents.retrieve).mock.calls[0]![2]).toEqual(STRIPE_OPTIONEN)
    expect(vi.mocked(stripe.refunds.list).mock.calls[0]![1]).toEqual(STRIPE_OPTIONEN)
    expect(vi.mocked(stripe.transfers.listReversals).mock.calls[0]![2]).toEqual(STRIPE_OPTIONEN)
    const [werte, optionen] = vi.mocked(stripe.refunds.create).mock.calls[0]!
    expect(optionen).toEqual({ ...STRIPE_OPTIONEN, idempotencyKey: 'storno-order_1' })
    expect(werte).toMatchObject({ amount: 500, metadata: { orderId: 'order_1', anlass: 'reststorno', art: 'kunde' } })
    expect(werte).not.toHaveProperty('reverse_transfer')
    expect(vi.mocked(stripe.transfers.createReversal).mock.calls[0]![2]).toEqual({ ...STRIPE_OPTIONEN, idempotencyKey: 'storno-hof-order_1' })
  })
})

describe('nie zweimal', () => {
  it('eine schon gebuchte Erstattung und Rückbuchung (früherer Versuch) werden übernommen, nicht neu gebucht', async () => {
    vi.mocked(stripe.refunds.list).mockResolvedValue({
      data: [
        { amount: 480, status: 'succeeded', metadata: { orderId: 'order_1', anlass: 'reststorno', art: 'kunde' } },
        // Fremde Bestellung und gescheiterte Erstattung zählen nicht.
        { amount: 999, status: 'succeeded', metadata: { orderId: 'order_2', anlass: 'reststorno' } },
        { amount: 999, status: 'failed', metadata: { orderId: 'order_1', anlass: 'reststorno' } },
      ],
    } as never)
    vi.mocked(stripe.transfers.listReversals).mockResolvedValue({
      data: [{ amount: 450, metadata: { orderId: 'order_1', anlass: 'reststorno', art: 'hof' } }],
    } as never)

    const ergebnis = await erstatteMitFestemBetrag(EINGABE)

    expect(ergebnis).toEqual({ erstattetCents: 480, rueckbuchungOffen: false })
    expect(stripe.refunds.create).not.toHaveBeenCalled()
    expect(stripe.transfers.createReversal).not.toHaveBeenCalled()
  })

  it('Gegenprobe: eine Teilstorno-Erstattung ist keine Rest-Erstattung', async () => {
    vi.mocked(stripe.refunds.list).mockResolvedValue({
      data: [{ amount: 582, status: 'succeeded', metadata: { orderId: 'order_1', anlass: 'teilstorno', positionId: 'brot' } }],
    } as never)

    await erstatteMitFestemBetrag(EINGABE)

    expect(stripe.refunds.create).toHaveBeenCalledTimes(1)
  })
})
