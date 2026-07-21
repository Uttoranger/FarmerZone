/**
 * Tests für den Ein-Schritt-Rückweg (bestellungen-undo):
 * revertReady (READY → PAID/CONFIRMED, Herleitung über paymentStatus) und
 * revertPickedUp (PICKED_UP → READY, pickedUpAt geleert, Geld unangetastet).
 * Beide Pfade verschicken KEINE Mail.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/stripe', () => ({ stripe: {} }))
vi.mock('@/lib/email', () => ({
  sendOrderReady: vi.fn(),
  sendOrderCancelled: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn() },
    order: { findFirst: vi.fn(), update: vi.fn() },
  },
}))

import { revertReady, revertPickedUp } from '@/server/actions/orders'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendOrderReady, sendOrderCancelled } from '@/lib/email'

const getSession = vi.mocked(auth.api.getSession)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const orderFindFirst = vi.mocked(prisma.order.findFirst)
const orderUpdate = vi.mocked(prisma.order.update)

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
  farmFindUnique.mockResolvedValue({ id: 'farm_1' } as never)
  orderUpdate.mockResolvedValue({} as never)
})

describe('revertReady', () => {
  it('nur aus READY: Query ist auf Status READY + eigene Farm gescoped', async () => {
    orderFindFirst.mockResolvedValue({ id: 'order_1', paymentStatus: 'PENDING' } as never)
    await revertReady('order_1')
    expect(orderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order_1', farmId: 'farm_1', status: 'READY' },
      })
    )
  })

  it('falscher Ausgangsstatus → abgelehnt, kein Update', async () => {
    orderFindFirst.mockResolvedValue(null)
    const result = await revertReady('order_confirmed')
    expect(result.error).toBe('Bestellung nicht gefunden')
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it('Ownership: ohne Session keine Änderung', async () => {
    getSession.mockResolvedValue(null as never)
    const result = await revertReady('order_1')
    expect(result.error).toBe('Nicht angemeldet')
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it('Herleitung: paymentStatus PAID → zurück auf PAID', async () => {
    orderFindFirst.mockResolvedValue({ id: 'order_1', paymentStatus: 'PAID' } as never)
    const result = await revertReady('order_1')
    expect(result).toEqual({})
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { status: 'PAID' },
    })
  })

  it('Herleitung: paymentStatus nicht PAID → zurück auf CONFIRMED', async () => {
    orderFindFirst.mockResolvedValue({ id: 'order_1', paymentStatus: 'PENDING' } as never)
    await revertReady('order_1')
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { status: 'CONFIRMED' },
    })
  })

  it('verschickt KEINE Mail', async () => {
    orderFindFirst.mockResolvedValue({ id: 'order_1', paymentStatus: 'PAID' } as never)
    await revertReady('order_1')
    expect(sendOrderReady).not.toHaveBeenCalled()
    expect(sendOrderCancelled).not.toHaveBeenCalled()
  })
})

describe('revertPickedUp', () => {
  it('nur aus PICKED_UP: Query ist auf Status PICKED_UP + eigene Farm gescoped', async () => {
    orderFindFirst.mockResolvedValue({ id: 'order_1' } as never)
    await revertPickedUp('order_1')
    expect(orderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order_1', farmId: 'farm_1', status: 'PICKED_UP' },
      })
    )
  })

  it('falscher Ausgangsstatus → abgelehnt, kein Update', async () => {
    orderFindFirst.mockResolvedValue(null)
    const result = await revertPickedUp('order_ready')
    expect(result.error).toBe('Bestellung nicht gefunden')
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it('Ownership: ohne Session keine Änderung', async () => {
    getSession.mockResolvedValue(null as never)
    const result = await revertPickedUp('order_1')
    expect(result.error).toBe('Nicht angemeldet')
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it('setzt READY und leert pickedUpAt — paymentStatus/paidAt bleiben unangetastet', async () => {
    orderFindFirst.mockResolvedValue({ id: 'order_1' } as never)
    const result = await revertPickedUp('order_1')
    expect(result).toEqual({})
    const updateArg = orderUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(updateArg.data).toEqual({ status: 'READY', pickedUpAt: null })
    // Geld-Wahrheit: kein paymentStatus, kein paidAt im Update
    expect(updateArg.data).not.toHaveProperty('paymentStatus')
    expect(updateArg.data).not.toHaveProperty('paidAt')
  })

  it('verschickt KEINE Mail', async () => {
    orderFindFirst.mockResolvedValue({ id: 'order_1' } as never)
    await revertPickedUp('order_1')
    expect(sendOrderReady).not.toHaveBeenCalled()
    expect(sendOrderCancelled).not.toHaveBeenCalled()
  })
})
