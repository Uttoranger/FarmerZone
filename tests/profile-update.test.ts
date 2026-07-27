/**
 * Tests für updateProfile (Hof-Profil speichern).
 *
 * Beweist: Das Profil-Formular schreibt ausschließlich Stammdaten. Logo und
 * Titelbild gehören zu „Mein Auftritt" und dürfen vom Profil-Speichern nicht
 * mehr angefasst werden — früher setzte ein leeres URL-Feld sie auf null.
 *
 * Prisma, Auth und next/* sind gemockt — keine DB-Zugriffe.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

import { updateProfile } from '@/server/actions/farm'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const getSession = vi.mocked(auth.api.getSession)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const farmUpdate = vi.mocked(prisma.farm.update)

const gueltig = {
  name: 'Hof Müller',
  ownerName: 'Klaus Müller',
  description: 'Wir bauen seit 1920 Gemüse an.',
  address: 'Dorfstraße 12',
  postalCode: '3400',
  city: 'Klosterneuburg',
  phone: '+43 664 123 4567',
  email: 'hof@beispiel.at',
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
  farmFindUnique.mockResolvedValue({ id: 'farm_1', slug: 'testhof' } as never)
  farmUpdate.mockResolvedValue({} as never)
})

describe('updateProfile — Stammdaten', () => {
  it('speichert die Stammdaten für den eigenen Hof', async () => {
    const res = await updateProfile(gueltig)

    expect(res.error).toBeUndefined()
    expect(farmUpdate).toHaveBeenCalledWith({
      where: { id: 'farm_1' },
      data: expect.objectContaining({ name: 'Hof Müller', city: 'Klosterneuburg' }),
    })
  })

  it('lehnt eine ungültige E-Mail ab und schreibt nichts', async () => {
    const res = await updateProfile({ ...gueltig, email: 'kein-mail' })

    expect(res.error).toBeTruthy()
    expect(farmUpdate).not.toHaveBeenCalled()
  })

  it('verweigert ohne Sitzung und schreibt nichts', async () => {
    getSession.mockResolvedValue(null as never)

    const res = await updateProfile(gueltig)

    expect(res.error).toBe('Nicht angemeldet')
    expect(farmUpdate).not.toHaveBeenCalled()
  })
})

describe('updateProfile — Bilder bleiben unberührt', () => {
  it('schreibt weder logoUrl noch bannerUrl', async () => {
    await updateProfile(gueltig)

    const data = farmUpdate.mock.calls[0]![0].data as Record<string, unknown>
    expect(Object.keys(data)).not.toContain('logoUrl')
    expect(Object.keys(data)).not.toContain('bannerUrl')
  })

  it('ignoriert untergeschobene Bild-URLs aus einem veralteten Client', async () => {
    await updateProfile({
      ...gueltig,
      logoUrl: 'https://boes.example/logo.png',
      bannerUrl: '',
    } as never)

    const data = farmUpdate.mock.calls[0]![0].data as Record<string, unknown>
    expect(data.logoUrl).toBeUndefined()
    expect(data.bannerUrl).toBeUndefined()
  })
})
