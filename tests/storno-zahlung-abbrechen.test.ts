/**
 * N8 (Nr. 288): Der Storno einer unbezahlten Online-Bestellung bricht den
 * Zahlungsvorgang bei Stripe ab — sonst kann die Kundin danach noch zahlen,
 * und der Webhook erstattet voll. Derselbe Baustein wie beim Fristablauf
 * (`brichZahlungAb`, src/server/verwaiste-bestellungen.ts). Er bewegt kein
 * Geld; was er nicht schafft, ändert nichts am Storno.
 *
 * Stripe und Prisma gestellt, `storniere` und `brichZahlungAb` echt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    refunds: { create: vi.fn(), list: vi.fn(async () => ({ data: [], has_more: false })) },
    paymentIntents: { retrieve: vi.fn(), cancel: vi.fn() },
  },
}))
vi.mock('@/server/queries/postfach', () => ({ ladeBetreiberEmpfaenger: vi.fn(async () => ['support@example.com']) }))
vi.mock('@/server/hofliste-erneuern', () => ({ erneuereHoflisteNachStorno: vi.fn() }))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn() }))
vi.mock('@/lib/prisma', () => {
  const order = { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() }
  const product = { update: vi.fn() }
  const mailAuftrag = { createMany: vi.fn(async () => ({ count: 1 })), updateMany: vi.fn(async () => ({ count: 1 })) }
  const tx: Record<string, unknown> = { order, product, mailAuftrag }
  tx.$transaction = (arbeit: (t: unknown) => Promise<unknown>) => arbeit(tx)
  return {
    prisma: {
      order,
      product,
      mailAuftrag,
      webhookEvent: { createMany: vi.fn(async () => ({ count: 1 })) },
      $transaction: vi.fn(async (rueckruf: (t: unknown) => Promise<unknown>) => rueckruf(tx)),
    },
  }
})

import * as Sentry from '@sentry/nextjs'
import { storniere } from '@/server/stornieren'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

const retrieve = vi.mocked(stripe.paymentIntents.retrieve)
const abbrechen = vi.mocked(stripe.paymentIntents.cancel)
const melde = vi.mocked(Sentry.captureException)

const HOF = { id: 'farm_1' }

/** Der Stand unter der Sperre (STORNO_STAND) — online, je nach Fall bezahlt oder nicht. */
function stand(abweichend: Record<string, unknown> = {}) {
  return {
    id: 'order_1',
    serviceFeeCents: 98,
    serviceFeeRefundedAt: null,
    totalAmount: { toString: () => '20.00' },
    platformFeeAmount: { toString: () => '0.00' },
    erstattetCents: 0,
    paymentStatus: 'PENDING',
    stripePaymentIntentId: 'pi_offen' as string | null,
    items: [{ productId: 'p_1', quantity: 1, totalPrice: { toString: () => '20.00' }, fehltSeit: null }],
    ...abweichend,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 } as never)
  vi.mocked(prisma.order.update).mockResolvedValue({} as never)
  vi.mocked(prisma.product.update).mockResolvedValue({} as never)
  retrieve.mockResolvedValue({ id: 'pi_offen', status: 'requires_payment_method' } as never)
  abbrechen.mockResolvedValue({ id: 'pi_offen', status: 'canceled' } as never)
})

function mitStand(s: ReturnType<typeof stand>): void {
  vi.mocked(prisma.order.findFirst).mockResolvedValue(s as never)
}

describe('Storno einer unbezahlten Online-Bestellung bricht die Zahlung ab', () => {
  it('ruft paymentIntents.cancel genau einmal mit dieser Kennung — der Storno steht', async () => {
    mitStand(stand())

    const ergebnis = await storniere(HOF, 'order_1')

    expect(abbrechen).toHaveBeenCalledTimes(1)
    expect(abbrechen.mock.calls[0]?.[0]).toBe('pi_offen')
    expect(ergebnis).toEqual({ erstattetCents: 0, vomHofCents: 0 })
    expect(melde).not.toHaveBeenCalled()
  })

  it('Stripe meldet „bezahlt“: kein Abbruch, der Storno bleibt (das Netz „zu spät bezahlt“ erstattet voll)', async () => {
    mitStand(stand())
    retrieve.mockResolvedValue({ id: 'pi_offen', status: 'succeeded' } as never)

    const ergebnis = await storniere(HOF, 'order_1')

    expect(abbrechen).not.toHaveBeenCalled()
    expect(ergebnis).toEqual({ erstattetCents: 0, vomHofCents: 0 })
    expect(melde).not.toHaveBeenCalled()
  })

  it('cancel wirft und der Stand bleibt unklar: der Storno bleibt, eine Sentry-Meldung', async () => {
    mitStand(stand())
    abbrechen.mockRejectedValue(new Error('Stripe nicht erreichbar'))
    // Nach dem Fehler liest brichZahlungAb nach — weiter abbrechbar, also wirft es.
    retrieve.mockResolvedValue({ id: 'pi_offen', status: 'requires_payment_method' } as never)

    const ergebnis = await storniere(HOF, 'order_1')

    expect(ergebnis).toEqual({ erstattetCents: 0, vomHofCents: 0 })
    expect(melde).toHaveBeenCalledTimes(1)
    expect(melde.mock.calls[0]?.[1]).toEqual({ tags: { aktion: 'cancelOrder', grund: 'intent_nicht_abgebrochen' }, extra: { orderId: 'order_1' } })
  })

  it('bar: kein Aufruf bei Stripe', async () => {
    mitStand(stand({ stripePaymentIntentId: null }))

    await storniere(HOF, 'order_1')

    expect(retrieve).not.toHaveBeenCalled()
    expect(abbrechen).not.toHaveBeenCalled()
  })

  it('online bezahlt: kein Abbruch — dort erstattet der Storno', async () => {
    mitStand(stand({ paymentStatus: 'PAID' }))
    vi.mocked(stripe.refunds.create).mockResolvedValue({ id: 're_1', amount: 2098, status: 'succeeded' } as never)

    await storniere(HOF, 'order_1')

    expect(abbrechen).not.toHaveBeenCalled()
    expect(retrieve).not.toHaveBeenCalled()
  })

  it('schon storniert (Sperre verloren): kein Abbruch', async () => {
    mitStand(stand())
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 0 } as never)

    await storniere(HOF, 'order_1')

    expect(abbrechen).not.toHaveBeenCalled()
  })
})
