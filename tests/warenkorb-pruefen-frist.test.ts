/**
 * POST /api/warenkorb/pruefen nennt die Frist der Halte, die es gerade
 * erneuert hat (Nachtlauf Nr. 12: Reservierungsfrist in der Kasse sichtbar).
 *
 * Beweist: Die Antwort trägt `reserviertBis` = genau der Zeitpunkt, den
 * erneuereHalte in die Halte schreibt (jetzt + 15 Minuten, neueFrist). Bleibt
 * nichts im Korb, gibt es keine Frist (null). Prisma gemockt, Regeln echt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn(() => null) }))
vi.mock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteFreiFuerProdukte: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn() },
    stockReservation: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
}))

import { POST } from '@/app/api/warenkorb/pruefen/route'
import { prisma } from '@/lib/prisma'
import { neueFrist } from '@/lib/reservierung'

const JETZT = new Date('2026-10-05T08:00:00.000Z')
let bestand = 10

function anfrage(): NextRequest {
  return new NextRequest('http://localhost/api/warenkorb/pruefen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: 'sid_1', items: [{ productId: 'eier', quantity: 2 }] }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
  bestand = 10
  vi.mocked(prisma.product.findMany).mockImplementation((() =>
    Promise.resolve([{ id: 'eier', stock: bestand, isAvailable: true }])) as never)
  vi.mocked(prisma.stockReservation.findMany).mockImplementation(((a: unknown) => {
    const sitzung = (a as { where?: { sessionId?: unknown } })?.where?.sessionId
    if (sitzung && typeof sitzung === 'object') return Promise.resolve([])
    return Promise.resolve([{ productId: 'eier', quantity: 2, expiresAt: new Date(JETZT.getTime() + 60_000) }])
  }) as never)
  vi.mocked(prisma.stockReservation.upsert).mockResolvedValue({} as never)
  vi.mocked(prisma.stockReservation.deleteMany).mockResolvedValue({ count: 0 } as never)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('/api/warenkorb/pruefen — Frist der erneuerten Halte', () => {
  it('nennt die Frist, die in die Halte geschrieben wird', async () => {
    const res = await POST(anfrage())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.reserviertBis).toBe(neueFrist(JETZT).toISOString())
    const geschrieben = vi.mocked(prisma.stockReservation.upsert).mock.calls[0][0] as { update: { expiresAt: Date } }
    expect(geschrieben.update.expiresAt.toISOString()).toBe(body.reserviertBis)
  })

  it('bleibt nichts im Korb, gibt es keine Frist', async () => {
    bestand = 0
    const res = await POST(anfrage())

    expect((await res.json()).reserviertBis).toBeNull()
    expect(prisma.stockReservation.upsert).not.toHaveBeenCalled()
  })
})
