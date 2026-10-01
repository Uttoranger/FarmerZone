/**
 * Die Freigabe im Lesepfad darf den eigentlichen Request nie scheitern lassen
 * (src/server/verwaiste-bestellungen.ts, „…OhneRisiko" und Geschwister).
 *
 * Fällt die Datenbank weg, lösen die Wrapper trotzdem auf und melden den
 * Fehler an Sentry — mit Hof-ID, nie mit Kundendaten.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/stripe', () => ({ stripe: { paymentIntents: { retrieve: vi.fn(), cancel: vi.fn() } } }))
vi.mock('@/lib/email', () => ({ sendBestellungVerfallen: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    farm: { findUnique: vi.fn() },
  },
}))

import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import {
  gibVerwaisteFreiFuerProdukte,
  gibVerwaisteFreiFuerSlug,
  gibVerwaisteFreiOhneRisiko,
} from '@/server/verwaiste-bestellungen'

const kaputt = new Error('Datenbank nicht erreichbar')

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('Freigabe im Lesepfad — nie ein Fehler nach außen', () => {
  it('gibVerwaisteFreiOhneRisiko: Datenbank wirft → löst auf, meldet mit Hof-ID', async () => {
    vi.mocked(prisma.order.findMany).mockRejectedValue(kaputt)

    await expect(gibVerwaisteFreiOhneRisiko('farm_1')).resolves.toBeUndefined()

    expect(Sentry.captureException).toHaveBeenCalledWith(kaputt, {
      tags: { aufgabe: 'verwaiste-bestellungen' },
      extra: { farmId: 'farm_1' },
    })
  })

  it('gibVerwaisteFreiFuerProdukte: Produktabfrage wirft → löst auf, meldet', async () => {
    vi.mocked(prisma.product.findMany).mockRejectedValue(kaputt)

    await expect(gibVerwaisteFreiFuerProdukte(['prod_1'])).resolves.toBeUndefined()

    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })

  it('gibVerwaisteFreiFuerProdukte: Freigabe wirft → löst auf', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([{ farmId: 'farm_1' }] as never)
    vi.mocked(prisma.order.findMany).mockRejectedValue(kaputt)

    await expect(gibVerwaisteFreiFuerProdukte(['prod_1'])).resolves.toBeUndefined()

    expect(Sentry.captureException).toHaveBeenCalledWith(kaputt, expect.objectContaining({ extra: { farmId: 'farm_1' } }))
  })

  it('gibVerwaisteFreiFuerSlug: Hofabfrage wirft → löst auf, meldet', async () => {
    vi.mocked(prisma.farm.findUnique).mockRejectedValue(kaputt)

    await expect(gibVerwaisteFreiFuerSlug('hof-test')).resolves.toBeUndefined()

    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })

  it('ohne Produkte fragt sie gar nicht erst', async () => {
    await gibVerwaisteFreiFuerProdukte([])

    expect(prisma.product.findMany).not.toHaveBeenCalled()
  })
})
