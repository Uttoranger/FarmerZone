/**
 * „Nicht abgeholt“, online bezahlt, die Erstattung der Gebühr scheitert
 * (Nr. 288, M2): Bisher stand das nur im Log. Jetzt wird die Gebühr wie beim
 * Storno zur Aufgabe „Erstattung offen“ — Sentry mit Betrag und Anweisung,
 * `erstattungOffenSeit` bedingt (mit der farmId des Hofs in der Bedingung),
 * Mail an den Betreiber. Der Status bleibt gesetzt (CLAUDE.md §2: nie einen
 * gültigen Statuswechsel wegen eines Nachlaufs zurückrollen).
 *
 * Prisma, Stripe, Sentry und das Einstellen der Mail sind gestellt; die
 * Sätze aus src/lib/erstattung-offen.ts laufen echt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/stripe', () => ({ stripe: { refunds: { create: vi.fn() } } }))
const eingestellt = vi.hoisted(() => ({ liste: [] as Array<{ art: string; id: string | null; auftraege: unknown }> }))
vi.mock('@/server/mail-warteschlange', async (original) => ({
  ...(await original<typeof import('@/server/mail-warteschlange')>()),
  stelleEinOhneRisiko: vi.fn(async (art: string, id: string | null, auftraege: unknown) => {
    eingestellt.liste.push({ art, id, auftraege: typeof auftraege === 'function' ? await (auftraege as () => Promise<unknown>)() : auftraege })
  }),
}))
vi.mock('@/server/mail-arten/betreiber', async (original) => ({
  ...(await original<typeof import('@/server/mail-arten/betreiber')>()),
  betreiberKennungen: vi.fn(async () => ['support']),
}))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn() },
    order: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
}))

import * as Sentry from '@sentry/nextjs'
import { markAsNotPickedUp } from '@/server/actions/orders'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { stelleEinOhneRisiko } from '@/server/mail-warteschlange'
import { erstattungOffenInhalt } from '@/lib/erstattung-offen'

const orderFindFirst = vi.mocked(prisma.order.findFirst)
const orderUpdate = vi.mocked(prisma.order.update)
const orderUpdateMany = vi.mocked(prisma.order.updateMany)
const refundCreate = vi.mocked(stripe.refunds.create)
const melde = vi.mocked(Sentry.captureException)

const HOF = 'farm_1'
const ONLINE = {
  id: 'order_online',
  paymentMethod: 'ONLINE',
  paymentStatus: 'PAID',
  stripePaymentIntentId: 'pi_1',
  serviceFeeCents: 98,
  serviceFeeRefundedAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  eingestellt.liste = []
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user_1' } } as never)
  vi.mocked(prisma.farm.findUnique).mockResolvedValue({ id: HOF, name: 'Testhof', slug: 'testhof' } as never)
  orderFindFirst.mockResolvedValue(ONLINE as never)
  orderUpdate.mockResolvedValue({} as never)
  orderUpdateMany.mockReset().mockResolvedValue({ count: 1 } as never)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('markAsNotPickedUp — Erstattung der Gebühr scheitert', () => {
  it('Status bleibt gesetzt, erstattungOffenSeit bedingt mit der farmId des Hofs, serviceFeeRefundedAt bleibt leer', async () => {
    refundCreate.mockRejectedValue(new Error('Stripe nicht erreichbar'))

    const ergebnis = await markAsNotPickedUp('order_online')

    expect(ergebnis).toEqual({ gebuehrErstattungOffen: true })
    expect(orderUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'order_online', farmId: HOF, status: { in: ['PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY'] } },
      data: { status: 'NOT_PICKED_UP' },
    })
    expect(orderUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'order_online', farmId: HOF, erstattungOffenSeit: null },
      data: { erstattungOffenSeit: expect.any(Date) },
    })
    expect(orderUpdateMany).toHaveBeenCalledTimes(2)
    // Kein Vermerk „entfallen“: Die Gebühr ist ja noch nicht zurück.
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it('genau eine Sentry-Meldung mit Betrag und Anweisung, ohne Daten der Kundin', async () => {
    refundCreate.mockRejectedValue(new Error('Konto von erika@example.com gesperrt'))

    await markAsNotPickedUp('order_online')

    expect(melde).toHaveBeenCalledTimes(1)
    const [, kontext] = melde.mock.calls[0] as [unknown, { tags: Record<string, string>; extra: Record<string, unknown> }]
    expect(kontext.tags).toEqual({ aktion: 'markAsNotPickedUp', grund: 'gebuehr_erstattung_offen' })
    expect(kontext.extra).toEqual({
      orderId: 'order_online',
      gebuehrCents: 98,
      handerstattung: erstattungOffenInhalt('gebuehr_nicht_abgeholt', { kundinCents: 98 }).handanweisung,
    })
    // Das Log nennt nur die Art des Fehlers, nie seine Meldung.
    const log = vi.mocked(console.error).mock.calls.flat().map(String).join(' ')
    expect(log).not.toContain('example.com')
    expect(log).toContain('order_online')
  })

  it('stellt die Mail „Erstattung offen“ mit dem Fall der Gebühr ein — Schlüssel je Bestellung', async () => {
    refundCreate.mockRejectedValue(new Error('Stripe nicht erreichbar'))

    await markAsNotPickedUp('order_online')

    expect(vi.mocked(stelleEinOhneRisiko)).toHaveBeenCalledTimes(1)
    expect(eingestellt.liste).toHaveLength(1)
    expect(eingestellt.liste[0]).toMatchObject({ art: 'erstattung-offen', id: 'order_online' })
    expect(eingestellt.liste[0]?.auftraege).toEqual([
      {
        art: 'erstattung-offen',
        vorrang: expect.any(Number),
        schluessel: 'erstattung-offen:gebuehr-order_online:support',
        bezug: { fall: 'gebuehr_nicht_abgeholt', orderId: 'order_online', kundinCents: '98', empfaengerId: 'support' },
        bestellungId: 'order_online',
        farmId: HOF,
      },
    ])
  })

  it('scheitert der Vermerk, bleiben Status, Sentry und Mail — eine zweite Meldung nennt den Vermerk', async () => {
    refundCreate.mockRejectedValue(new Error('Stripe nicht erreichbar'))
    orderUpdateMany.mockResolvedValueOnce({ count: 1 } as never).mockRejectedValueOnce(new Error('DB weg'))

    const ergebnis = await markAsNotPickedUp('order_online')

    expect(ergebnis).toEqual({ gebuehrErstattungOffen: true })
    expect(melde.mock.calls.map((c) => (c[1] as { tags: { grund: string } }).tags.grund)).toEqual([
      'gebuehr_erstattung_offen',
      'gebuehr_erstattung_offen_vermerk',
    ])
    expect(eingestellt.liste).toHaveLength(1)
  })

  it('ein zweiter Aufruf ändert nichts: der Status ist nicht mehr laufend', async () => {
    refundCreate.mockRejectedValue(new Error('Stripe nicht erreichbar'))
    await markAsNotPickedUp('order_online')
    vi.clearAllMocks()
    eingestellt.liste = []
    orderFindFirst.mockResolvedValue(null)

    const zweiter = await markAsNotPickedUp('order_online')

    expect(zweiter).toEqual({ error: 'Bestellung nicht gefunden' })
    expect(orderUpdateMany).not.toHaveBeenCalled()
    expect(refundCreate).not.toHaveBeenCalled()
    expect(melde).not.toHaveBeenCalled()
    expect(eingestellt.liste).toEqual([])
  })

  it('Erstattung gelingt → wie bisher: Vermerk „entfallen“, kein offener Vermerk, keine Meldung, keine Mail', async () => {
    refundCreate.mockResolvedValue({ id: 're_1', amount: 98 } as never)

    const ergebnis = await markAsNotPickedUp('order_online')

    expect(ergebnis).toEqual({})
    expect(orderUpdate).toHaveBeenCalledWith({ where: { id: 'order_online' }, data: { serviceFeeRefundedAt: expect.any(Date) } })
    expect(orderUpdateMany).toHaveBeenCalledTimes(1)
    expect(melde).not.toHaveBeenCalled()
    expect(eingestellt.liste).toEqual([])
  })
})
