/**
 * „Rückgängig" nach „Abgeholt und kassiert" bzw. „Gepackt" in der echten
 * Datenbank (Nr. 19b): Zahlstatus und Zahlzeitpunkt bleiben stimmig —
 * `paymentStatus` PAID genau dann, wenn `paidAt` gesetzt ist.
 *
 * Die Aussage hängt an Postgres: `markAsPickedUpAndPaid` schreibt Abholung
 * und Zahlung in EINEM Statement mit demselben Zeitpunkt, und der Rückweg
 * erkennt daran (nach dem Weg durch die Datenbank, Millisekunden-genau), dass
 * das Kassieren zu diesem Schritt gehörte. Better Auth ist echt (Sitzung aus
 * der Datenbank), Mail gemockt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/stripe', () => ({ stripe: { refunds: { create: vi.fn() } } }))
vi.mock('@/lib/email', () => ({
  sendOrderReady: vi.fn(),
  sendOrderCancelled: vi.fn(),
  sendOrderNotReady: vi.fn(),
}))

import { headers } from 'next/headers'
import { markAsPickedUp, markAsPickedUpAndPaid, markAsReady, revertOrderStatus, revertPickedUp } from '@/server/actions/orders'
import { prisma } from '@/lib/prisma'
import { erstelleHofMitAnmeldung, intKennung, raeumeAuf } from './setup/basis'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  await raeumeAuf()
})

/** Eine Bestellung ohne Positionen — der Rückweg bucht keinen Bestand. */
async function bestellung(daten: {
  status: 'READY' | 'PAID'
  paymentMethod: 'ONSITE_CASH' | 'ONLINE'
  paymentStatus: 'PENDING' | 'PAID'
  paidAt: Date | null
}) {
  const { farm, cookie } = await erstelleHofMitAnmeldung()
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
  return prisma.order.create({
    data: {
      orderNumber: intKennung('bestellung').toUpperCase(),
      farmId: farm.id,
      customerEmail: `${intKennung('kundin')}@example.com`,
      customerName: 'Erika Mustermann',
      customerPhone: '+43 660 0000000',
      totalAmount: 12.5,
      pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      serviceFeeCents: 0,
      ...daten,
    },
  })
}

/** Stimmig heißt: bezahlt genau dann, wenn ein Zahlzeitpunkt dasteht. */
function stimmig(b: { paymentStatus: string; paidAt: Date | null }): boolean {
  return (b.paymentStatus === 'PAID') === (b.paidAt !== null)
}

describe('revertOrderStatus — Zahlung in der echten Datenbank', () => {
  it('bar: „Abgeholt und kassiert" → Rückgängig ergibt wieder „gepackt, offen zu kassieren"', async () => {
    const b = await bestellung({ status: 'READY', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', paidAt: null })

    expect(await markAsPickedUpAndPaid(b.id)).toEqual({})
    expect(await revertOrderStatus(b.id, 'READY')).toEqual({})

    const danach = await prisma.order.findUniqueOrThrow({ where: { id: b.id } })
    expect(danach).toMatchObject({ status: 'READY', paymentStatus: 'PENDING', paidAt: null, pickedUpAt: null })
    expect(stimmig(danach)).toBe(true)
  })

  it('online: „Gepackt" → Rückgängig lässt Zahlung und Zahlzeitpunkt stehen', async () => {
    const bezahltAm = new Date(Date.now() - 60 * 60 * 1000)
    const b = await bestellung({ status: 'PAID', paymentMethod: 'ONLINE', paymentStatus: 'PAID', paidAt: bezahltAm })

    expect(await markAsReady(b.id)).toEqual({})
    expect(await revertOrderStatus(b.id, 'PAID')).toEqual({})

    const danach = await prisma.order.findUniqueOrThrow({ where: { id: b.id } })
    expect(danach.status).toBe('PAID')
    expect(danach.paymentStatus).toBe('PAID')
    expect(danach.paidAt?.getTime()).toBe(bezahltAm.getTime())
    expect(stimmig(danach)).toBe(true)
  })
})

describe('revertPickedUp (Dialog „Abholung rückgängig", Nr. 32) — Zahlung in der echten Datenbank', () => {
  it('bar: „Abgeholt und kassiert" → Abholung rückgängig ergibt wieder „gepackt, offen zu kassieren"', async () => {
    const b = await bestellung({ status: 'READY', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', paidAt: null })

    expect(await markAsPickedUpAndPaid(b.id)).toEqual({})
    expect(await revertPickedUp(b.id)).toEqual({})

    const danach = await prisma.order.findUniqueOrThrow({ where: { id: b.id } })
    expect(danach).toMatchObject({ status: 'READY', paymentStatus: 'PENDING', paidAt: null, pickedUpAt: null })
    expect(stimmig(danach)).toBe(true)
  })

  it('online: „Abgeholt" → Abholung rückgängig lässt Zahlung und Zahlzeitpunkt stehen', async () => {
    const bezahltAm = new Date(Date.now() - 60 * 60 * 1000)
    const b = await bestellung({ status: 'READY', paymentMethod: 'ONLINE', paymentStatus: 'PAID', paidAt: bezahltAm })

    expect(await markAsPickedUp(b.id)).toEqual({})
    expect(await revertPickedUp(b.id)).toEqual({})

    const danach = await prisma.order.findUniqueOrThrow({ where: { id: b.id } })
    expect(danach.status).toBe('READY')
    expect(danach.pickedUpAt).toBeNull()
    expect(danach.paymentStatus).toBe('PAID')
    expect(danach.paidAt?.getTime()).toBe(bezahltAm.getTime())
    expect(stimmig(danach)).toBe(true)
  })
})
