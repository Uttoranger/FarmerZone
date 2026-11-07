import { describe, it, expect, vi, beforeEach } from 'vitest'

/*
 * Der Geldsatz unter dem Betrag einer Bestellung (Nr. 249, Liste Lauf 32 „bestellung“): nur Anzeige über
 * geldsaetzeFuer (Nr. 248) aus dem Snapshot der Bestellung — hier nur, dass der Lader die richtigen Werte
 * durchreicht, nur den eigenen Hof liest und bei einem Fehler still null gibt.
 */

const m = vi.hoisted(() => ({
  order: null as Record<string, unknown> | null,
  farm: null as Record<string, unknown> | null,
  gruendungBis: null as Date | null,
  wirft: false,
  orderWhere: null as unknown,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findFirst: vi.fn(async (args: { where: unknown }) => {
        m.orderWhere = args.where
        if (m.wirft) throw new Error('weg')
        return m.order
      }),
    },
    farm: { findUnique: vi.fn(async () => m.farm) },
  },
}))
vi.mock('@/server/queries/plattform-einstellung', () => ({ ladeHofpreisEinstellung: async () => ({ hofpreisModellAb: new Date('2027-02-01T00:00:00Z') }) }))
vi.mock('@/server/queries/admin', () => ({ ladeGruendungBis: async () => m.gruendungBis }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import { ladeBestellGeldsatz } from '@/server/queries/orders'

const JETZT = new Date('2027-03-03T10:00:00Z')

beforeEach(() => {
  m.order = null
  m.farm = { id: 'farm-1', einzugAb: null, plattformgebuehrProzent: null }
  m.gruendungBis = new Date('2028-01-31T00:00:00Z')
  m.wirft = false
})

describe('ladeBestellGeldsatz', () => {
  it('bar, Gebühr erlassen (Gründungshof): „Du bekommst die vollen € … – bis <Gründungsende> …“', async () => {
    m.order = { totalAmount: '17.31', serviceFeeCents: 0, serviceFeeRefundedAt: null, paymentMethod: 'ONSITE_CASH', gebuehrModell: 'hofpreis', gebuehrEinzug: 'erlassen' }
    const satz = await ladeBestellGeldsatz('farm-1', 'order-1', JETZT)
    expect(satz).toMatch(/^Du bekommst die vollen €\u00a017,31 – bis 31\.\u00a0Jänner 2028 zahlst du auf Barverkäufe keine Plattformgebühr\.$/)
    // Nur der eigene Hof: die Bestellung nach ID UND farmId.
    expect(m.orderWhere).toEqual({ id: 'order-1', farmId: 'farm-1' })
  })

  it('online: der Satz des Modells mit „online einbehalten“', async () => {
    m.order = { totalAmount: '18.00', serviceFeeCents: 112, serviceFeeRefundedAt: null, paymentMethod: 'ONLINE', gebuehrModell: 'hofpreis', gebuehrEinzug: 'stripe' }
    expect(await ladeBestellGeldsatz('farm-1', 'order-1', JETZT)).toBe('Du bekommst €\u00a018,00 · die Kundin zahlt €\u00a019,12 – die Gebühr ist online einbehalten.')
  })

  it('Modell „bisher“, fremde Bestellung und Ladefehler: kein Satz (die Seite zeigt ihren eigenen)', async () => {
    m.order = { totalAmount: '10.00', serviceFeeCents: 50, serviceFeeRefundedAt: null, paymentMethod: 'ONLINE', gebuehrModell: null, gebuehrEinzug: null }
    expect(await ladeBestellGeldsatz('farm-1', 'order-1', JETZT)).toBeNull()
    m.order = null
    expect(await ladeBestellGeldsatz('farm-1', 'fremd', JETZT)).toBeNull()
    m.wirft = true
    expect(await ladeBestellGeldsatz('farm-1', 'order-1', JETZT)).toBeNull()
  })
})
