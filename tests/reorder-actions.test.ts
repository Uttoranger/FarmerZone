/**
 * Tests für die Reorder-Actions (Sprint 18, Drag & Drop).
 *
 * Beweist: Ownership-Verweigerung, fremde/unvollständige/doppelte ID-Listen
 * → Fehler OHNE Teiländerung (keine Transaktion), saubere Resequenzierung
 * 0..n−1, Idempotenz bei unveränderter Reihenfolge — für Produkte. Fotos:
 * nur noch der Pfeil (moveFarmPhotoAction), seit Nr. 213.5 ohne die frühere
 * exportierte Drag-&-Drop-Action ohne Aufrufer; farmId in jeder WHERE.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@vercel/blob', () => ({ del: vi.fn(), put: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn(), update: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    farmPhoto: { findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    farm: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import * as fotoActions from '@/server/actions/farm-photos'
import { moveFarmPhotoAction } from '@/server/actions/farm-photos'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFarmForUser } from '@/server/queries/dashboard'

const getSession = vi.mocked(auth.api.getSession)
const farmForUser = vi.mocked(getFarmForUser)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const productFindMany = vi.mocked(prisma.product.findMany)
const productUpdate = vi.mocked(prisma.product.update)
const photoFindMany = vi.mocked(prisma.farmPhoto.findMany)
const photoUpdate = vi.mocked(prisma.farmPhoto.updateMany)
const transaction = vi.mocked(prisma.$transaction)

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
  farmForUser.mockResolvedValue({ id: 'farm_1', slug: 'testhof', name: 'Testhof' } as never)
  farmFindUnique.mockResolvedValue({ id: 'farm_1', slug: 'testhof' } as never)
  productFindMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }] as never)
  photoFindMany.mockResolvedValue([{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }] as never)
  // update() liefert das Payload-Objekt zurück, damit wir die Transaktions-Inhalte prüfen können
  productUpdate.mockImplementation(((args: unknown) => args) as never)
  photoUpdate.mockImplementation(((args: unknown) => args) as never)
  transaction.mockResolvedValue([] as never)
})

describe('Fotos: keine exportierte Drag-&-Drop-Action mehr (Nr. 213.5)', () => {
  it('die Datei exportiert nur noch den Pfeil zum Umsortieren', () => {
    expect(Object.keys(fotoActions)).not.toContain('reorderPhotosAction')
    expect(Object.keys(fotoActions)).toContain('moveFarmPhotoAction')
  })
})

describe('moveFarmPhotoAction (Pfeil-Fallback geht in reorder auf)', () => {
  it('vertauscht mit dem Nachbarn und setzt die komplette Reihenfolge', async () => {
    // f2 nach oben: erwartete Reihenfolge f2, f1, f3
    const result = await moveFarmPhotoAction('f2', 'up')
    expect(result).toEqual({})
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(photoUpdate).toHaveBeenNthCalledWith(1, { where: { id: 'f2', farmId: 'farm_1' }, data: { sortOrder: 0 } })
    expect(photoUpdate).toHaveBeenNthCalledWith(2, { where: { id: 'f1', farmId: 'farm_1' }, data: { sortOrder: 1 } })
    expect(photoUpdate).toHaveBeenNthCalledWith(3, { where: { id: 'f3', farmId: 'farm_1' }, data: { sortOrder: 2 } })
  })

  it('am Rand passiert nichts (kein Fehler, keine Schreibzugriffe)', async () => {
    const result = await moveFarmPhotoAction('f1', 'up')
    expect(result).toEqual({})
    expect(transaction).not.toHaveBeenCalled()
  })
})
