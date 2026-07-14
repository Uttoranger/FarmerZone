/**
 * Tests für die Reservierungslogik (/api/reserve).
 *
 * Beweist: Nur aktive Reservierungen (expiresAt > now) anderer Sessions
 * blockieren Bestand — abgelaufene werden aufgeräumt und zählen nicht.
 * Reicht der freie Bestand nicht, wird mit 409 abgelehnt.
 *
 * Prisma ist gemockt — keine DB-Zugriffe.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    stockReservation: { deleteMany: vi.fn(), aggregate: vi.fn(), upsert: vi.fn() },
    product: { findUnique: vi.fn() },
  },
}))

import { POST } from '@/app/api/reserve/route'
import { prisma } from '@/lib/prisma'

const deleteMany = vi.mocked(prisma.stockReservation.deleteMany)
const aggregate = vi.mocked(prisma.stockReservation.aggregate)
const upsert = vi.mocked(prisma.stockReservation.upsert)
const productFindUnique = vi.mocked(prisma.product.findUnique)

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/reserve', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const validBody = { productId: 'prod_1', quantity: 6, sessionId: 'sess_a' }

beforeEach(() => {
  vi.clearAllMocks()
  deleteMany.mockResolvedValue({ count: 0 } as never)
  productFindUnique.mockResolvedValue({ stock: 10, isAvailable: true } as never)
  aggregate.mockResolvedValue({ _sum: { quantity: null } } as never)
  upsert.mockResolvedValue({} as never)
})

describe('Verfügbarkeitsberechnung', () => {
  it('reserviert, wenn Bestand minus aktive Fremd-Reservierungen reicht (10 − 4 ≥ 6)', async () => {
    aggregate.mockResolvedValue({ _sum: { quantity: 4 } } as never)

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(typeof json.expiresAt).toBe('string')
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId_sessionId: { productId: 'prod_1', sessionId: 'sess_a' } },
        create: expect.objectContaining({ quantity: 6 }),
        update: expect.objectContaining({ quantity: 6 }),
      })
    )
  })

  it('lehnt ab, wenn aktive Fremd-Reservierungen den Bestand aufbrauchen (10 − 4 < 7)', async () => {
    aggregate.mockResolvedValue({ _sum: { quantity: 4 } } as never)

    const res = await POST(makeRequest({ ...validBody, quantity: 7 }))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('Nur noch 6 verfügbar')
    expect(upsert).not.toHaveBeenCalled()
  })

  it('zählt nur Reservierungen mit expiresAt > now — abgelaufene blockieren nicht', async () => {
    // Keine aktiven Reservierungen (die abgelaufenen wurden gelöscht bzw. herausgefiltert)
    aggregate.mockResolvedValue({ _sum: { quantity: null } } as never)

    const res = await POST(makeRequest({ ...validBody, quantity: 10 }))

    expect(res.status).toBe(200)
    // Abgelaufene werden vorab aufgeräumt (expiresAt < now)…
    expect(deleteMany).toHaveBeenCalledWith({
      where: { productId: 'prod_1', expiresAt: { lt: expect.any(Date) } },
    })
    // …und die Verfügbarkeit zählt ausschließlich aktive Fremd-Reservierungen
    expect(aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessionId: { not: 'sess_a' },
          expiresAt: { gt: expect.any(Date) },
        }),
      })
    )
  })

  it('eigene Session blockiert sich nicht selbst (Upsert statt Addition)', async () => {
    aggregate.mockResolvedValue({ _sum: { quantity: 4 } } as never)

    await POST(makeRequest(validBody))

    // Die Aggregation schließt die eigene Session explizit aus
    expect(aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sessionId: { not: 'sess_a' } }),
      })
    )
  })

  it('negative Verfügbarkeit wird als 0 gemeldet', async () => {
    aggregate.mockResolvedValue({ _sum: { quantity: 15 } } as never)

    const res = await POST(makeRequest({ ...validBody, quantity: 1 }))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('Nur noch 0 verfügbar')
  })
})

describe('Randfälle', () => {
  it('lehnt nicht vorhandene Produkte mit 409 ab', async () => {
    productFindUnique.mockResolvedValue(null)

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(409)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('lehnt deaktivierte Produkte mit 409 ab', async () => {
    productFindUnique.mockResolvedValue({ stock: 10, isAvailable: false } as never)

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(409)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('lehnt ungültige Parameter mit 400 ab (quantity 0)', async () => {
    const res = await POST(makeRequest({ ...validBody, quantity: 0 }))

    expect(res.status).toBe(400)
    expect(productFindUnique).not.toHaveBeenCalled()
  })

  it('lehnt ungültiges JSON mit 400 ab', async () => {
    const req = new NextRequest('http://localhost/api/reserve', {
      method: 'POST',
      body: 'kein json',
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
  })
})
