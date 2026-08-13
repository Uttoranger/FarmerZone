/**
 * Tests für die addFarmPhotoAction (serverseitiges Galerie-Limit).
 *
 * Diese Datei prüfte früher zusätzlich die Upload-Route /api/upload — Auth,
 * Ownership, Content-Type-Whitelist, 4-MB-Grenze, put()/del()-Aufrufe. Die
 * Route gibt es seit der Umstellung auf den serverseitigen Upload nicht mehr:
 * Der Browser lädt das Original direkt in den Blob-Speicher, und die
 * Verarbeitung läuft über /api/upload/verarbeiten. Was von den alten Prüfungen
 * weiterlebt, steht jetzt woanders:
 *
 *   Auth + Hof-Zugehörigkeit  → in beiden neuen Routen, dieselbe Prüfung
 *   Content-Type-Whitelist    → ERSETZT: Der Typ wird nicht mehr geglaubt,
 *                               sharp sieht in die Bytes (tests/upload-fehler)
 *   4-MB-Grenze               → entfällt, das Original geht am Limit vorbei
 *   del() nur bei eigener URL → tests/upload-url-guard.test.ts, jetzt strenger
 *                               (früher genügte der Host, heute muss der Pfad
 *                               zum Hof gehören)
 *
 * Das Galerie-Limit hat mit dem Upload-Weg nichts zu tun und bleibt hier.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn() },
    farmPhoto: { findUnique: vi.fn(), create: vi.fn(), count: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
  del: vi.fn(),
}))

import { addFarmPhotoAction } from '@/server/actions/farm-photos'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

const mockGetSession = vi.mocked(auth.api.getSession)
const mockFarmFindUnique = vi.mocked(prisma.farm.findUnique)
const mockFarmPhotoCount = vi.mocked(prisma.farmPhoto.count)
const mockFarmPhotoCreate = vi.mocked(prisma.farmPhoto.create)

const SESSION = { user: { id: 'user-1' } }

describe('addFarmPhotoAction — Galerie-Limit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(SESSION as never)
    mockFarmFindUnique.mockResolvedValue({ id: 'farm-1', slug: 'mein-hof' } as never)
    mockFarmPhotoCreate.mockResolvedValue({
      id: 'photo-9',
      url: 'https://x.public.blob.vercel-storage.com/p.webp',
      caption: null,
      sortOrder: 8,
    } as never)
  })

  it('erlaubt das 8. Foto (count = 7)', async () => {
    mockFarmPhotoCount.mockResolvedValue(7 as never)
    const result = await addFarmPhotoAction({ url: 'https://x.public.blob.vercel-storage.com/p.webp' })
    expect(result.error).toBeUndefined()
    expect(result.photo).toBeDefined()
  })

  it('lehnt das 9. Foto ab (count = 8)', async () => {
    mockFarmPhotoCount.mockResolvedValue(8 as never)
    const result = await addFarmPhotoAction({ url: 'https://x.public.blob.vercel-storage.com/p.webp' })
    expect(result.error).toMatch(/Maximal 8/)
    expect(mockFarmPhotoCreate).not.toHaveBeenCalled()
  })
})
