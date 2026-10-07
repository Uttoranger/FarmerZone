/**
 * Statuswechsel der Bestellungen sind bedingt (S2, Nachtlauf Nr. 19;
 * ARCHITECTURE §6 Altlast „markAsReady, markAsPickedUp, markAsPickedUpAndPaid,
 * markAsNotPickedUp prüfen lesend und schreiben blind").
 *
 * Der Fehler vorher: Lesen, dann `update` ohne Statusbedingung. Ein Storno im
 * Fenster dazwischen wurde überschrieben — eine stornierte Bestellung stand
 * wieder als abholbereit oder abgeholt da, und „nicht abgeholt" erstattete die
 * Gebühr einer schon voll erstatteten Bestellung ein zweites Mal.
 *
 * Gemockt: Prisma, Stripe, Mail, Sentry, Request-Kontext. Die Datenbank ist
 * hier ein Fake, dessen updateMany den Status prüft und setzt (wie UPDATE …
 * WHERE); der Storno „dazwischen" ist ein Statuswechsel zwischen Lesen und
 * Schreiben.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/stripe', () => ({ stripe: { refunds: { create: vi.fn() } } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/email', () => ({
  sendOrderReady: vi.fn(),
  sendOrderCancelled: vi.fn(),
  sendOrderNotReady: vi.fn(),
  sendArtikelFehlt: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn() },
    order: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { markAsReady, markAsPickedUp, markAsPickedUpAndPaid, markAsNotPickedUp, meldeArtikelFehlt, cancelOrder } from '@/server/actions/orders'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { sendOrderReady } from '@/lib/email'

const satz = { status: 'CONFIRMED' }

function bestellung() {
  return {
    id: 'order_1',
    orderNumber: 'TH-1',
    customerName: 'Anna Muster',
    customerEmail: 'anna@example.com',
    customerPhone: '+43 660 0000000',
    totalAmount: { toString: () => '10.00' },
    platformFeeAmount: { toString: () => '0.00' },
    serviceFeeCents: 50,
    serviceFeeRefundedAt: null,
    pickupDate: new Date('2026-10-07T10:00:00Z'),
    pickupTimeStart: '15:00',
    pickupTimeEnd: '18:00',
    paymentMethod: 'ONLINE',
    paymentStatus: 'PAID',
    stripePaymentIntentId: 'pi_1',
    status: satz.status,
    items: [],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  satz.status = 'CONFIRMED'
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user_1' } } as never)
  vi.mocked(prisma.farm.findUnique).mockResolvedValue({
    id: 'farm_1', name: 'Hof Test', slug: 'hof-test', email: 'hof@example.com', ownerName: 'Max Mustermann',
    address: 'Weg 1', postalCode: '1010', city: 'Musterdorf', phone: '+43 660 0000000',
  } as never)
  // Lesen findet die Bestellung im Ausgangsstatus …
  vi.mocked(prisma.order.findFirst).mockImplementation((async () => bestellung()) as never)
  // … dann storniert jemand, BEVOR geschrieben wird.
  vi.mocked(prisma.order.updateMany).mockImplementation((async (arg: { where: { status?: unknown } }) => {
    const filter = arg.where.status
    const erlaubt =
      typeof filter === 'string' ? [filter] : (filter as { in?: string[] } | undefined)?.in ?? []
    return { count: erlaubt.includes(satz.status) ? 1 : 0 }
  }) as never)
})

function stornoDazwischen() {
  satz.status = 'CANCELLED'
}

describe('ein Storno zwischen Lesen und Schreiben gewinnt', () => {
  it('markAsReady schreibt nicht und schickt keine Abholbereit-Mail', async () => {
    stornoDazwischen()
    const ergebnis = await markAsReady('order_1')
    expect(ergebnis.error).toContain('inzwischen geändert')
    expect(prisma.order.update).not.toHaveBeenCalled()
    // Mails laden den Versand erst im Aufruf (Nr. 31): erst alle Importe abwarten, sonst wäre „nicht gesendet“ nur zu früh geprüft.
    await vi.dynamicImportSettled()
    expect(sendOrderReady).not.toHaveBeenCalled()
  })

  it('markAsPickedUp und markAsPickedUpAndPaid schreiben nur aus READY', async () => {
    satz.status = 'READY'
    expect(await markAsPickedUp('order_1')).toEqual({})
    stornoDazwischen()
    expect((await markAsPickedUp('order_1')).error).toContain('inzwischen geändert')
    expect((await markAsPickedUpAndPaid('order_1')).error).toContain('inzwischen geändert')
    expect(prisma.order.update).not.toHaveBeenCalled()
  })

  it('markAsNotPickedUp erstattet die Gebühr einer stornierten Bestellung nicht', async () => {
    stornoDazwischen()
    const ergebnis = await markAsNotPickedUp('order_1')
    expect(ergebnis.error).toContain('inzwischen geändert')
    expect(stripe.refunds.create).not.toHaveBeenCalled()
    expect(prisma.order.update).not.toHaveBeenCalled()
  })

  it('Gegenprobe: ohne Storno dazwischen geht markAsReady durch', async () => {
    expect(await markAsReady('order_1')).toEqual({})
    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: { in: ['PAID', 'CONFIRMED', 'IN_PREPARATION'] } }) })
    )
  })
})

describe('Eingaben werden geprüft, bevor etwas passiert', () => {
  it('meldeArtikelFehlt ohne gültige IDs: nichts gelesen, nichts geschrieben', async () => {
    expect(await meldeArtikelFehlt({ orderId: 'order_1' })).toEqual({ error: 'Ungültige Eingabe.' })
    expect(await meldeArtikelFehlt({ orderId: 'a b', itemId: 'x' })).toEqual({ error: 'Ungültige Eingabe.' })
    expect(await meldeArtikelFehlt('order_1')).toEqual({ error: 'Ungültige Eingabe.' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('cancelOrder mit zu langem Grund: Hinweis mit Ausweg, kein Storno', async () => {
    const ergebnis = await cancelOrder('order_1', 'x'.repeat(201))
    expect(ergebnis.error).toContain('höchstens 200 Zeichen')
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
