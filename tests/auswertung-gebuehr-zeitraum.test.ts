/**
 * Gebühr für den gewählten Zeitraum der Auswertung (Nr. 251, Liste Lauf 32
 * auswertung „Woche zeigt die Gebühr des Monats“): reine Anzeige-Abfrage
 * `getServicegebuehrenZeitraum`. Sie liest dieselbe Regel wie die
 * Monatskarte und die Abrechnung (`servicegebuehrenImMonat` →
 * `topfVonBestellung`, gespeicherte `serviceFeeCents`) und ändert sie nicht:
 * Für den ganzen Monat liefert sie dieselbe Zahl wie `getServicegebuehrenMonat`,
 * über eine Monatsgrenze zählt jede Bestellung genau einmal.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: { order: { findMany: vi.fn() } } }))
vi.mock('@/lib/umgebung-server', () => ({ STRIPE_LIVE_AB: null }))

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getServicegebuehrenMonat, getServicegebuehrenZeitraum } from '@/server/queries/auswertung'

const findMany = vi.mocked(prisma.order.findMany)

type Zeile = {
  createdAt: Date
  status: string
  paymentMethod: string
  paymentStatus: string
  serviceFeeCents: number
  serviceFeeRefundedAt: Date | null
  platformFeeAmount: Prisma.Decimal
}

function bestellung(abweichend: Partial<Zeile> = {}): Zeile {
  return {
    createdAt: new Date('2026-10-15T10:00:00Z'),
    status: 'PICKED_UP',
    paymentMethod: 'ONLINE',
    paymentStatus: 'PAID',
    serviceFeeCents: 100,
    serviceFeeRefundedAt: null,
    platformFeeAmount: new Prisma.Decimal('0'),
    ...abweichend,
  }
}

const OKTOBER = [
  bestellung({ serviceFeeCents: 53 }),
  bestellung({ serviceFeeCents: 61, createdAt: new Date('2026-10-02T08:00:00Z') }),
  // Storniert und erstattet zählt nicht — dieselbe Regel wie die Abrechnung.
  bestellung({ status: 'CANCELLED', serviceFeeCents: 70 }),
  bestellung({ serviceFeeRefundedAt: new Date('2026-10-16T08:00:00Z'), serviceFeeCents: 80 }),
]

beforeEach(() => findMany.mockReset())

describe('getServicegebuehrenZeitraum — Gebühr des gewählten Zeitraums, nur Anzeige', () => {
  it('fragt nur die eigenen Bestellungen, die im Fenster eingegangen sind', async () => {
    findMany.mockResolvedValue([] as never)
    const von = new Date('2026-10-05T00:00:00Z')
    const bis = new Date('2026-10-11T21:59:59Z')
    await getServicegebuehrenZeitraum('hof-1', { von, bis }, null)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { farmId: 'hof-1', createdAt: { gte: von, lte: bis } } }))
  })

  it('ganzer Monat: dieselbe Zahl wie die Monatskarte (getServicegebuehrenMonat)', async () => {
    findMany.mockResolvedValue(OKTOBER as never)
    const zeitraum = await getServicegebuehrenZeitraum(
      'hof-1',
      { von: new Date('2026-09-30T22:00:00Z'), bis: new Date('2026-10-31T22:59:59Z') },
      null
    )
    const monat = await getServicegebuehrenMonat('hof-1', new Date('2026-10-20T10:00:00Z'), null)
    expect(monat).toMatchObject(zeitraum)
    expect(zeitraum).toEqual({ onlineCents: 114, onlineAnzahl: 2, vorOrtCents: 0, vorOrtAnzahl: 0, summeCents: 114 })
  })

  it('Woche über die Monatsgrenze: jede Bestellung zählt genau einmal, vor Ort abgeholt als „vor Ort“', async () => {
    findMany.mockResolvedValue([
      bestellung({ serviceFeeCents: 40, createdAt: new Date('2026-10-30T10:00:00Z') }),
      bestellung({ serviceFeeCents: 45, createdAt: new Date('2026-11-02T10:00:00Z') }),
      bestellung({
        serviceFeeCents: 30,
        createdAt: new Date('2027-03-02T10:00:00Z'),
        paymentMethod: 'ONSITE_CASH',
        paymentStatus: 'PENDING',
      }),
    ] as never)
    const summe = await getServicegebuehrenZeitraum('hof-1', { von: new Date('2026-10-25T23:00:00Z'), bis: new Date('2027-03-08T22:59:59Z') }, null)
    expect(summe.onlineCents).toBe(85)
    expect(summe.onlineAnzahl).toBe(2)
    expect(summe.summeCents).toBe(summe.onlineCents + summe.vorOrtCents)
  })

  it('ohne Bestellung: alles null', async () => {
    findMany.mockResolvedValue([] as never)
    expect(await getServicegebuehrenZeitraum('hof-1', { von: new Date(), bis: new Date() }, null)).toEqual({
      onlineCents: 0,
      onlineAnzahl: 0,
      vorOrtCents: 0,
      vorOrtAnzahl: 0,
      summeCents: 0,
    })
  })
})
