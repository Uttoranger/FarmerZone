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
  sendOrderNotReady: vi.fn(),
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
import { sendOrderReady, sendOrderCancelled, sendOrderNotReady } from '@/lib/email'

const getSession = vi.mocked(auth.api.getSession)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const orderFindFirst = vi.mocked(prisma.order.findFirst)
const orderUpdate = vi.mocked(prisma.order.update)

const EMAIL_ORDER = {
  id: 'order_1',
  orderNumber: 'TH-1907-TEST',
  customerName: 'Anna Testerin',
  customerEmail: 'kundin@test.local',
  customerPhone: '+43 660 1234567',
  totalAmount: { toString: () => '7.00' },
  pickupDate: new Date('2026-07-21T12:00:00Z'),
  pickupTimeStart: '09:00',
  pickupTimeEnd: '12:00',
  paymentMethod: 'ONSITE_CASH',
  paymentStatus: 'PENDING',
  stripePaymentIntentId: null,
  items: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
  farmFindUnique.mockResolvedValue({ id: 'farm_1', name: 'Testhof', slug: 'testhof', email: 'hof@test.local', ownerName: 'Franz', address: 'Weg 1', postalCode: '5270', city: 'Mauerkirchen', phone: '' } as never)
  orderUpdate.mockResolvedValue({} as never)
})

describe('revertReady', () => {
  it('nur aus READY: Query ist auf Status READY + eigene Farm gescoped', async () => {
    orderFindFirst.mockResolvedValue({ ...EMAIL_ORDER, paymentStatus: 'PENDING' } as never)
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
    orderFindFirst.mockResolvedValue({ ...EMAIL_ORDER, paymentStatus: 'PAID' } as never)
    const result = await revertReady('order_1')
    expect(result).toEqual({})
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { status: 'PAID' },
    })
  })

  it('Herleitung: paymentStatus nicht PAID → zurück auf CONFIRMED', async () => {
    orderFindFirst.mockResolvedValue({ ...EMAIL_ORDER, paymentStatus: 'PENDING' } as never)
    await revertReady('order_1')
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { status: 'CONFIRMED' },
    })
  })

  it('Haken AN (Standard) → sendOrderNotReady genau einmal, sonst keine Mail', async () => {
    orderFindFirst.mockResolvedValue({ ...EMAIL_ORDER, paymentStatus: 'PAID' } as never)
    await revertReady('order_1')
    expect(sendOrderNotReady).toHaveBeenCalledTimes(1)
    expect(sendOrderNotReady).toHaveBeenCalledWith(
      expect.objectContaining({ customerEmail: 'kundin@test.local', orderNumber: 'TH-1907-TEST' })
    )
    expect(sendOrderReady).not.toHaveBeenCalled()
    expect(sendOrderCancelled).not.toHaveBeenCalled()
  })

  it('Haken AUS → Mail-Mock bleibt still', async () => {
    orderFindFirst.mockResolvedValue({ ...EMAIL_ORDER, paymentStatus: 'PENDING' } as never)
    const result = await revertReady('order_1', false)
    expect(result).toEqual({})
    expect(sendOrderNotReady).not.toHaveBeenCalled()
    expect(sendOrderReady).not.toHaveBeenCalled()
    expect(sendOrderCancelled).not.toHaveBeenCalled()
  })

  it('abgelehnter Rückschritt verschickt auch mit Haken keine Mail', async () => {
    orderFindFirst.mockResolvedValue(null)
    await revertReady('order_confirmed', true)
    expect(sendOrderNotReady).not.toHaveBeenCalled()
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

  it('bleibt mailfrei — auch die neue Update-Mail wird NIE verschickt', async () => {
    orderFindFirst.mockResolvedValue({ id: 'order_1' } as never)
    await revertPickedUp('order_1')
    expect(sendOrderReady).not.toHaveBeenCalled()
    expect(sendOrderCancelled).not.toHaveBeenCalled()
    expect(sendOrderNotReady).not.toHaveBeenCalled()
  })
})
