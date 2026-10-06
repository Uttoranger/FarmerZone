/**
 * ladeEinrichtenHof (src/server/queries/einrichten.ts, Nr. 15 Nachbesserung 1):
 * Gibt es den Hof, fehlen aber seine Daten, darf die Abfrage nicht „kein Hof"
 * melden — /onboarding zeigte sonst wieder „Hof anlegen", createFarm gäbe den
 * bestehenden Hof zurück, und Mein Hof schickte bei fehlenden Einstellungen
 * erneut nach /onboarding: eine Schleife. Stattdessen geht es nach /dashboard.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((ziel: string) => {
    throw new Error(`REDIRECT:${ziel}`)
  }),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { farm: { findUnique: vi.fn() }, product: { count: vi.fn() } },
}))
vi.mock('@/server/queries/farm', () => ({ getOwnerFarm: vi.fn(), getFarmSettings: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { getFarmSettings, getOwnerFarm } from '@/server/queries/farm'
import { ladeEinrichtenHof } from '@/server/queries/einrichten'

const HOF = { id: 'hof-1', slug: 'hof-test', approvedAt: null, tarif: null }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.product.count).mockResolvedValue(0)
})

describe('ladeEinrichtenHof', () => {
  it('ohne Hof: null — Einrichten zeigt „Hof anlegen"', async () => {
    vi.mocked(prisma.farm.findUnique).mockResolvedValue(null)
    await expect(ladeEinrichtenHof('user-1')).resolves.toBeNull()
  })

  it('Hof da, Profil fehlt: weiter nach /dashboard statt „Hof anlegen"', async () => {
    vi.mocked(prisma.farm.findUnique).mockResolvedValue(HOF as never)
    vi.mocked(getOwnerFarm).mockResolvedValue(null)
    vi.mocked(getFarmSettings).mockResolvedValue({} as never)
    await expect(ladeEinrichtenHof('user-1')).rejects.toThrow('REDIRECT:/dashboard')
  })

  it('Hof da, Einstellungen fehlen: weiter nach /dashboard statt „Hof anlegen"', async () => {
    vi.mocked(prisma.farm.findUnique).mockResolvedValue(HOF as never)
    vi.mocked(getOwnerFarm).mockResolvedValue({} as never)
    vi.mocked(getFarmSettings).mockResolvedValue(null)
    await expect(ladeEinrichtenHof('user-1')).rejects.toThrow('REDIRECT:/dashboard')
  })

  it('fragt nur den eigenen Hof ab (ownerId)', async () => {
    vi.mocked(prisma.farm.findUnique).mockResolvedValue(null)
    await ladeEinrichtenHof('user-1')
    expect(vi.mocked(prisma.farm.findUnique).mock.calls[0]?.[0]).toMatchObject({ where: { ownerId: 'user-1' } })
  })
})
