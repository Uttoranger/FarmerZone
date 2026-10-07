/**
 * Die Abfragen, die Nr. 22f für die Admin-Seiten ergänzt — Prisma gemockt.
 *
 *  - getAdminFarms liest Stripe, Pause, Betriebsnummer und SEPA mit, gibt die
 *    Stripe-Kennung aber nicht weiter.
 *  - zaehleWartendeHoefe zählt mit derselben Regel wie die Liste (approvedAt null).
 *  - zaehleMeldungenJeStatus zählt je Status, mit Art-Filter nur diese Art.
 *  - getMeldungNachbarn: vorige = nächst jüngere, nächste = nächst ältere.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findMany: vi.fn(), count: vi.fn() },
    meldung: { groupBy: vi.fn(), findFirst: vi.fn() },
    $queryRaw: vi.fn(),
  },
}))

import { getAdminFarms, zaehleWartendeHoefe } from '@/server/queries/admin'
import { getMeldungNachbarn, zaehleMeldungenJeStatus } from '@/server/queries/meldung'
import { prisma } from '@/lib/prisma'

const farmFindMany = vi.mocked(prisma.farm.findMany)
const farmCount = vi.mocked(prisma.farm.count)
const groupBy = vi.mocked(prisma.meldung.groupBy)
const findFirst = vi.mocked(prisma.meldung.findFirst)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never)
})

function dbZeile(ueber: Record<string, unknown> = {}) {
  return {
    id: 'farm_1',
    name: 'Hof Test',
    slug: 'hof-test',
    createdAt: new Date('2026-10-01T10:00:00Z'),
    approvedAt: null,
    archivedAt: null,
    country: 'AT',
    description: '',
    logoUrl: null,
    serviceFeePercent: { toString: () => '5.00' },
    serviceFeeMinCents: 50,
    serviceFeeActiveFrom: null,
    stripeAccountReady: false,
    isPaused: false,
    betriebsnummer: '  ',
    sepaMandatAm: null,
    owner: { email: 'max@example.com', emailVerified: true, createdAt: new Date('2026-01-01T00:00:00Z') },
    _count: { products: 0, farmPhotos: 0, pickupSlots: 0 },
    ...ueber,
  }
}

describe('getAdminFarms — Nr. 22f', () => {
  it('wählt Stripe, Pause, Betriebsnummer und SEPA aus — nie die Stripe-Kennung', async () => {
    farmFindMany.mockResolvedValue([dbZeile()] as never)
    await getAdminFarms()
    const select = (farmFindMany.mock.calls[0][0] as { select: Record<string, unknown> }).select
    expect(select).toMatchObject({ stripeAccountReady: true, isPaused: true, betriebsnummer: true, sepaMandatAm: true })
    expect(select.stripeAccountId).toBeUndefined()
  })

  it('macht daraus Wahrheitswerte und eine angezeigte Nummer', async () => {
    farmFindMany.mockResolvedValue([
      dbZeile(),
      dbZeile({ id: 'farm_2', stripeAccountReady: true, isPaused: true, betriebsnummer: ' 1234567 ', sepaMandatAm: new Date() }),
    ] as never)
    const [a, b] = await getAdminFarms()
    expect(a).toMatchObject({ stripeBereit: false, isPaused: false, betriebsnummer: null, sepaErteilt: false })
    expect(b).toMatchObject({ stripeBereit: true, isPaused: true, betriebsnummer: '1234567', sepaErteilt: true })
  })
})

describe('zaehleWartendeHoefe', () => {
  it('zählt Höfe ohne Freischaltung', async () => {
    farmCount.mockResolvedValue(2 as never)
    expect(await zaehleWartendeHoefe()).toBe(2)
    expect(farmCount).toHaveBeenCalledWith({ where: { approvedAt: null } })
  })
})

describe('zaehleMeldungenJeStatus', () => {
  it('liefert die Zahl je Status — ohne Art über alle', async () => {
    groupBy.mockResolvedValue([
      { status: 'NEU', _count: { _all: 2 } },
      { status: 'ERLEDIGT', _count: { _all: 5 } },
    ] as never)
    expect(await zaehleMeldungenJeStatus(null)).toEqual({ NEU: 2, ERLEDIGT: 5 })
    expect(groupBy.mock.calls[0][0]).toMatchObject({ by: ['status'], where: {} })
  })

  it('mit Art zählt sie nur diese Art', async () => {
    groupBy.mockResolvedValue([] as never)
    await zaehleMeldungenJeStatus('WUNSCH')
    expect(groupBy.mock.calls[0][0]).toMatchObject({ where: { art: 'WUNSCH' } })
  })
})

describe('getMeldungNachbarn', () => {
  it('vorige ist die nächst jüngere, nächste die nächst ältere', async () => {
    const zeit = new Date('2026-10-05T10:00:00Z')
    findFirst.mockImplementation(((arg: { where: { createdAt: { gt?: Date; lt?: Date } } }) =>
      Promise.resolve(arg.where.createdAt.gt ? { id: 'juenger' } : { id: 'aelter' })) as never)
    expect(await getMeldungNachbarn({ createdAt: zeit })).toEqual({ vorige: 'juenger', naechste: 'aelter' })
  })

  it('am Rand: null statt eines Links ins Leere', async () => {
    findFirst.mockResolvedValue(null as never)
    expect(await getMeldungNachbarn({ createdAt: new Date() })).toEqual({ vorige: null, naechste: null })
  })
})
