/**
 * Tests für die Titelbild-Fokuspunkt-Action (updateBannerFocusAction).
 *
 * Beweist: Werte werden hart auf 0–100 geclampt (−5→0, 150→100), ohne
 * Session/eigenen Hof wird verweigert (nichts geschrieben), und ein
 * gültiger Wert wird für den richtigen Hof persistiert.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn(), update: vi.fn() },
    farmValue: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { updateBannerFocusAction } from '@/server/actions/appearance'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const getSession = vi.mocked(auth.api.getSession)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const farmUpdate = vi.mocked(prisma.farm.update)

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
  farmFindUnique.mockResolvedValue({ id: 'farm_1', slug: 'testhof' } as never)
  farmUpdate.mockResolvedValue({} as never)
})

describe('Clamping', () => {
  it('clampt −5 auf 0', async () => {
    await updateBannerFocusAction(-5)
    expect(farmUpdate).toHaveBeenCalledWith({
      where: { id: 'farm_1' },
      data: { bannerFocusY: 0 },
    })
  })

  it('clampt 150 auf 100', async () => {
    await updateBannerFocusAction(150)
    expect(farmUpdate).toHaveBeenCalledWith({
      where: { id: 'farm_1' },
      data: { bannerFocusY: 100 },
    })
  })

  it('rundet krumme Werte auf ganze Zahlen', async () => {
    await updateBannerFocusAction(37.6)
    expect(farmUpdate).toHaveBeenCalledWith({
      where: { id: 'farm_1' },
      data: { bannerFocusY: 38 },
    })
  })

  it('behandelt NaN als 0 statt zu crashen', async () => {
    await updateBannerFocusAction(Number.NaN)
    expect(farmUpdate).toHaveBeenCalledWith({
      where: { id: 'farm_1' },
      data: { bannerFocusY: 0 },
    })
  })
})

describe('Ownership', () => {
  it('verweigert ohne Session und schreibt nichts', async () => {
    getSession.mockResolvedValue(null as never)

    const result = await updateBannerFocusAction(50)

    expect(result.error).toBeDefined()
    expect(farmUpdate).not.toHaveBeenCalled()
  })

  it('verweigert, wenn dem Nutzer kein Hof gehört (Ownership über ownerId)', async () => {
    farmFindUnique.mockResolvedValue(null)

    const result = await updateBannerFocusAction(50)

    expect(result.error).toBeDefined()
    expect(farmFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'user_1' } })
    )
    expect(farmUpdate).not.toHaveBeenCalled()
  })
})

describe('Persistenz', () => {
  it('speichert einen gültigen Wert für den eigenen Hof und meldet Erfolg', async () => {
    const result = await updateBannerFocusAction(40)

    expect(result).toEqual({})
    expect(farmUpdate).toHaveBeenCalledTimes(1)
    expect(farmUpdate).toHaveBeenCalledWith({
      where: { id: 'farm_1' },
      data: { bannerFocusY: 40 },
    })
  })
})
