/**
 * „Rückgängig" im Hinweis nach „Gepackt" bzw. „Abgeholt" (revertOrderStatus)
 * hält Zahlstatus und Zahlzeitpunkt stimmig (Nr. 19b, Morgenbericht Lauf 4 §7).
 *
 * Vorher setzte der Rückweg `paidAt` IMMER auf null und ließ `paymentStatus`
 * stehen: Eine online bezahlte Bestellung stand danach „bezahlt" ohne
 * Zeitpunkt, eine bar kassierte „bezahlt", obwohl „kassiert" gerade
 * zurückgenommen war.
 *
 * Regel (rein, `zahlungNachRueckweg` in src/lib/hof-bestellungen.ts):
 *  - online: Das Geld liegt bei Stripe — ein Rückweg ändert nie die Zahlung.
 *  - bar, zurück aus „Abgeholt und kassiert": Das Kassieren gehört zu genau
 *    diesem Schritt (beide Zeitpunkte aus demselben Schreiben) und geht mit
 *    zurück — PENDING und paidAt null.
 *  - sonst bleibt die Zahlung, wie sie ist.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/stripe', () => ({ stripe: { refunds: { create: vi.fn(), list: vi.fn() } } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/email', () => ({
  sendOrderReady: vi.fn(),
  sendOrderCancelled: vi.fn(),
  sendOrderNotReady: vi.fn(),
  sendErstattungOffen: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn() },
    order: { findFirst: vi.fn(), updateMany: vi.fn() },
  },
}))

import { revertOrderStatus } from '@/server/actions/orders'
import { zahlungNachRueckweg } from '@/lib/hof-bestellungen'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const findFirst = vi.mocked(prisma.order.findFirst)
const updateMany = vi.mocked(prisma.order.updateMany)

const KASSIERT = new Date('2026-10-06T14:10:00.000Z')
const ONLINE_BEZAHLT = new Date('2026-10-05T09:00:00.000Z')

type Satz = {
  status: string
  paymentMethod: 'ONLINE' | 'ONSITE_CASH' | 'ONSITE_CARD'
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
  paidAt: Date | null
  pickedUpAt: Date | null
}

/**
 * Ein Bestellsatz im Speicher: findFirst und updateMany werten die
 * WHERE-Klausel aus (Status, Zahlstatus, Zahlzeitpunkt), wie Postgres es täte.
 */
function datenbankMit(satz: Satz): Satz {
  const gleicheZeit = (a: unknown, b: Date | null) => ((a as Date | null)?.getTime() ?? null) === (b?.getTime() ?? null)
  const passt = (where: Record<string, unknown>) =>
    (where.status === undefined || where.status === satz.status) &&
    (where.paymentStatus === undefined || where.paymentStatus === satz.paymentStatus) &&
    (!('paidAt' in where) || gleicheZeit(where.paidAt, satz.paidAt))
  findFirst.mockImplementation((async (arg: { where: Record<string, unknown> }) => (passt(arg.where) ? { ...satz } : null)) as never)
  updateMany.mockImplementation((async (arg: { where: Record<string, unknown>; data: Partial<Satz> }) => {
    if (!passt(arg.where)) return { count: 0 }
    Object.assign(satz, arg.data)
    return { count: 1 }
  }) as never)
  return satz
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user_1' } } as never)
  vi.mocked(prisma.farm.findUnique).mockResolvedValue({ id: 'farm_1', slug: 'hof-test' } as never)
})

describe('zahlungNachRueckweg — die reine Regel', () => {
  it('bar, zurück aus „Abgeholt und kassiert": Zahlung geht mit zurück', () => {
    expect(
      zahlungNachRueckweg({ paymentMethod: 'ONSITE_CASH', paymentStatus: 'PAID', paidAt: KASSIERT, pickedUpAt: KASSIERT }, 'PICKED_UP')
    ).toEqual({ paymentStatus: 'PENDING', paidAt: null })
  })

  it('online bleibt bezahlt — in jede Richtung', () => {
    const online = { paymentMethod: 'ONLINE' as const, paymentStatus: 'PAID' as const, paidAt: ONLINE_BEZAHLT, pickedUpAt: ONLINE_BEZAHLT }
    expect(zahlungNachRueckweg(online, 'PICKED_UP')).toBeNull()
    expect(zahlungNachRueckweg(online, 'READY')).toBeNull()
  })

  it('bar, schon vor dem Abholen bezahlt (anderer Zeitpunkt): Zahlung bleibt', () => {
    expect(
      zahlungNachRueckweg({ paymentMethod: 'ONSITE_CASH', paymentStatus: 'PAID', paidAt: ONLINE_BEZAHLT, pickedUpAt: KASSIERT }, 'PICKED_UP')
    ).toBeNull()
  })

  it('zurück aus „Gepackt" fasst die Zahlung nie an', () => {
    expect(
      zahlungNachRueckweg({ paymentMethod: 'ONSITE_CASH', paymentStatus: 'PAID', paidAt: KASSIERT, pickedUpAt: KASSIERT }, 'READY')
    ).toBeNull()
  })

  it('unbezahlt bleibt unbezahlt', () => {
    expect(
      zahlungNachRueckweg({ paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', paidAt: null, pickedUpAt: KASSIERT }, 'PICKED_UP')
    ).toBeNull()
  })
})

describe('revertOrderStatus — Zahlstatus und Zahlzeitpunkt bleiben stimmig', () => {
  it('bar „Abgeholt und kassiert" → Rückgängig: wieder gepackt UND unbezahlt', async () => {
    const satz = datenbankMit({ status: 'PICKED_UP', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PAID', paidAt: KASSIERT, pickedUpAt: KASSIERT })

    expect(await revertOrderStatus('order_1', 'READY')).toEqual({})

    expect(satz).toMatchObject({ status: 'READY', paymentStatus: 'PENDING', paidAt: null, pickedUpAt: null })
  })

  it('online bezahlt, „Abgeholt" → Rückgängig: bleibt bezahlt, mit Zeitpunkt', async () => {
    const satz = datenbankMit({ status: 'PICKED_UP', paymentMethod: 'ONLINE', paymentStatus: 'PAID', paidAt: ONLINE_BEZAHLT, pickedUpAt: KASSIERT })

    expect(await revertOrderStatus('order_1', 'READY')).toEqual({})

    expect(satz).toMatchObject({ status: 'READY', paymentStatus: 'PAID', paidAt: ONLINE_BEZAHLT })
  })

  it('online bezahlt, „Gepackt" → Rückgängig: zurück auf PAID, Zeitpunkt bleibt', async () => {
    const satz = datenbankMit({ status: 'READY', paymentMethod: 'ONLINE', paymentStatus: 'PAID', paidAt: ONLINE_BEZAHLT, pickedUpAt: null })

    expect(await revertOrderStatus('order_1', 'PAID')).toEqual({})

    expect(satz).toMatchObject({ status: 'PAID', paymentStatus: 'PAID', paidAt: ONLINE_BEZAHLT })
  })

  it('ändert sich die Zahlung zwischen Lesen und Schreiben, wird nichts geschrieben', async () => {
    const satz = datenbankMit({ status: 'PICKED_UP', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PAID', paidAt: KASSIERT, pickedUpAt: KASSIERT })
    const echtesLesen = findFirst.getMockImplementation()
    findFirst.mockImplementationOnce((async (arg: never) => {
      const gelesen = await echtesLesen!(arg)
      // Ein zweiter Tab erstattet genau jetzt — die Bedingung muss das fangen.
      satz.paymentStatus = 'REFUNDED'
      return gelesen
    }) as never)

    const ergebnis = await revertOrderStatus('order_1', 'READY')

    expect(ergebnis.error).toBeTruthy()
    expect(satz).toMatchObject({ status: 'PICKED_UP', paymentStatus: 'REFUNDED', paidAt: KASSIERT })
  })

  it('Gegenprobe: eine stornierte Bestellung holt der Rückweg nicht zurück', async () => {
    const satz = datenbankMit({ status: 'CANCELLED', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', paidAt: null, pickedUpAt: null })
    expect((await revertOrderStatus('order_1', 'CONFIRMED')).error).toBeTruthy()
    expect(satz.status).toBe('CANCELLED')
  })
})
