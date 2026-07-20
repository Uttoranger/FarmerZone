/**
 * Tests für den Vorlage-Loader (nachlese-6): getStatusTemplate lädt einen
 * Alt-Status farm-gescoped als Wizard-Vorbefüllung. Eigene ID → Daten;
 * fremde/ungültige ID → null (Wizard startet leer); ohne Param → null,
 * ohne dass Prisma überhaupt gefragt wird.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    statusPost: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    customerFarmSubscription: { findMany: vi.fn(), count: vi.fn() },
  },
}))

import { getStatusTemplate, getPastStatusCount } from '@/server/queries/status-posts'
import { prisma } from '@/lib/prisma'

const findFirst = vi.mocked(prisma.statusPost.findFirst)
const count = vi.mocked(prisma.statusPost.count)

const VORLAGE = {
  anlass: 'PROMOTION',
  title: 'Kartoffel-Aktion',
  body: 'Diese Woche 5 kg zum Sonderpreis!',
  photoUrl: 'https://blob.example/kartoffeln.webp',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getStatusTemplate', () => {
  it('eigene ID → liefert Anlass/Titel/Text/Foto-URL', async () => {
    findFirst.mockResolvedValue(VORLAGE as never)
    const result = await getStatusTemplate('farm_1', 'status_1')
    expect(result).toEqual(VORLAGE)
    // Ownership: Query ist zwingend auf die eigene Farm gescoped
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'status_1', farmId: 'farm_1' } })
    )
  })

  it('fremde oder ungültige ID → null (Wizard startet leer, kein Fehler)', async () => {
    // farm-gescopede Query findet fremde Status schlicht nicht
    findFirst.mockResolvedValue(null)
    await expect(getStatusTemplate('farm_1', 'status_von_fremder_farm')).resolves.toBeNull()
    await expect(getStatusTemplate('farm_1', 'gibt_es_nicht')).resolves.toBeNull()
  })

  it('ohne Param → null, ohne DB-Zugriff', async () => {
    await expect(getStatusTemplate('farm_1', undefined)).resolves.toBeNull()
    await expect(getStatusTemplate('farm_1', null)).resolves.toBeNull()
    await expect(getStatusTemplate('farm_1', '')).resolves.toBeNull()
    expect(findFirst).not.toHaveBeenCalled()
  })
})

describe('getPastStatusCount', () => {
  it('zählt nur veröffentlichte UND abgelaufene Status der eigenen Farm', async () => {
    count.mockResolvedValue(3 as never)
    await expect(getPastStatusCount('farm_1')).resolves.toBe(3)
    const arg = count.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    expect(arg.where.farmId).toBe('farm_1')
    expect(arg.where.publishedAt).toEqual({ not: null })
    expect(arg.where.expiresAt).toHaveProperty('lte')
  })
})
