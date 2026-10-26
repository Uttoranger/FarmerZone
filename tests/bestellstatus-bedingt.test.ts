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
// Die Hilfen der Warteschlange bleiben echt (Nr. 168, tests/mail-attrappe.ts).
vi.mock('@/server/mail-warteschlange', async (o) => (await import('./mail-attrappe')).warteschlangeEcht(await o()))
vi.mock('@/schemas/mail-auftrag', async (o) => (await import('./mail-attrappe')).schemaEcht(await o()))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn() },
    order: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    mailAuftrag: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { markAsReady, markAsPickedUp, markAsPickedUpAndPaid, markAsNotPickedUp, meldeArtikelFehlt, cancelOrder } from '@/server/actions/orders'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import * as Sentry from '@sentry/nextjs'
import { stelleEinOhneRisiko, stelleMailEinInTransaktion } from '@/server/mail-warteschlange'
import { bezugSchemaFuer } from '@/schemas/mail-auftrag'
import { bezugWirft, ergebnis } from './mail-attrappe'

const stelleMailEin = vi.mocked(stelleMailEinInTransaktion)

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
  vi.mocked(bezugSchemaFuer).mockReset()
  vi.mocked(prisma.mailAuftrag.createMany).mockResolvedValue({ count: 1 })
  satz.status = 'CONFIRMED'
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user_1' } } as never)
  vi.mocked(prisma.farm.findUnique).mockResolvedValue({
    id: 'farm_1', name: 'Hof Test', slug: 'hof-test', email: 'hof@example.com', ownerName: 'Max Mustermann',
    address: 'Weg 1', postalCode: '1010', city: 'Musterdorf', phone: '+43 660 0000000',
  } as never)
  // Lesen findet die Bestellung im Ausgangsstatus …
  vi.mocked(prisma.order.findFirst).mockImplementation((async () => bestellung()) as never)
  // Statuswechsel und Mail-Auftrag laufen in einer Transaktion (Nr. 159) — hier durchgereicht.
  vi.mocked(prisma.$transaction).mockImplementation((async (rueckruf: (tx: unknown) => Promise<unknown>) => rueckruf(prisma)) as never)
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
    expect(stelleMailEin).not.toHaveBeenCalled()
  })

  it('ungültiger Bezug (Register N26, 25.10.2026): abholbereit gilt trotzdem, Sentry einmal, kein Auftrag', async () => {
    bezugWirft(bezugSchemaFuer)
    expect(await markAsReady('order_1')).toEqual({})
    expect(prisma.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'READY' } }))
    // Rein geprüft vor dem Schreiben: der ungültige fällt weg, EINE Meldung, nichts nachzuholen.
    expect(await ergebnis(stelleMailEin)).toBe('ungueltig')
    expect(stelleEinOhneRisiko).not.toHaveBeenCalled()
    expect(prisma.mailAuftrag.createMany).not.toHaveBeenCalled()
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { bereich: 'mail-warteschlange', art: 'abholbereit', grund: 'bezug_ungueltig' }, extra: { bestellungId: 'order_1' } })
    )
  })

  it('scheitert das Einstellen (Datenbank): abholbereit gilt, der Auftrag wird mit demselben Objekt nachgeholt', async () => {
    vi.mocked(prisma.mailAuftrag.createMany).mockRejectedValueOnce(new Error('DB weg'))
    expect(await markAsReady('order_1')).toEqual({})
    expect(await ergebnis(stelleMailEin)).toBe('nachholen')
    // Derselbe Zeitpunkt im Schlüssel: kein zweiter Auftrag, falls der erste doch stand.
    const inDerTransaktion = (stelleMailEin.mock.calls[0]![0] as unknown as Array<{ schluessel: string }>)[0]!.schluessel
    expect(vi.mocked(stelleEinOhneRisiko).mock.calls[0]![2]).toMatchObject({ schluessel: inDerTransaktion })
    expect(prisma.mailAuftrag.createMany).toHaveBeenCalledTimes(2)
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

  it('Gegenprobe: ohne Storno dazwischen geht markAsReady durch — mit einem Auftrag „abholbereit"', async () => {
    expect(await markAsReady('order_1')).toEqual({})
    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: { in: ['PAID', 'CONFIRMED', 'IN_PREPARATION'] } }) })
    )
    expect(stelleMailEin).toHaveBeenCalledWith(
      [expect.objectContaining({ art: 'abholbereit', vorrang: 1, bestellungId: 'order_1', farmId: 'farm_1', bezug: { orderId: 'order_1' } })],
      // In der Transaktion des Statuswechsels eingestellt.
      prisma
    )
    expect(await ergebnis(stelleMailEin)).toBe('eingestellt')
    expect(prisma.mailAuftrag.createMany).toHaveBeenCalledTimes(1)
    expect(stelleEinOhneRisiko).not.toHaveBeenCalled()
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
