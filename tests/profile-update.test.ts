/**
 * Tests für updateProfile (Hof-Profil speichern).
 *
 * Beweist: Das Profil-Formular schreibt ausschließlich Stammdaten. Logo und
 * Titelbild gehören zu „Mein Auftritt" und dürfen vom Profil-Speichern nicht
 * mehr angefasst werden — früher setzte ein leeres URL-Feld sie auf null.
 *
 * Seit der eingebetteten Profilkarte gehört der Kartenpunkt zum Profil:
 * Gesetzte Koordinaten werden gerundet mitgespeichert (nur Österreich),
 * null lässt einen gespeicherten Punkt unangetastet.
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
  country: 'AT' as const,
  latitude: null,
  longitude: null,
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

describe('updateProfile — der Kartenpunkt', () => {
  it('speichert gesetzte Koordinaten gerundet mit dem Profil', async () => {
    const res = await updateProfile({ ...gueltig, latitude: 48.123456789, longitude: 13.4 })

    expect(res.error).toBeUndefined()
    expect(farmUpdate).toHaveBeenCalledWith({
      where: { id: 'farm_1' },
      data: expect.objectContaining({ latitude: 48.123457, longitude: 13.4 }),
    })
  })

  it('lehnt einen Punkt außerhalb Österreichs ab und schreibt GAR nichts', async () => {
    const res = await updateProfile({ ...gueltig, latitude: 41.9, longitude: 12.5 }) // Rom

    expect(res.error).toBe('Der Punkt liegt außerhalb Österreichs — bitte schieb die Karte auf deinen Hof.')
    expect(farmUpdate).not.toHaveBeenCalled()
  })

  it('lässt ohne Punkt (null) gespeicherte Koordinaten unangetastet', async () => {
    await updateProfile(gueltig)

    const data = farmUpdate.mock.calls[0]![0].data as Record<string, unknown>
    expect(Object.keys(data)).not.toContain('latitude')
    expect(Object.keys(data)).not.toContain('longitude')
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

describe('updateProfile — das Land des Hofes', () => {
  it('speichert das gewählte Land mit', async () => {
    await updateProfile({ ...gueltig, country: 'DE' })

    expect(farmUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ country: 'DE' }) })
    )
  })

  it('ein anderes Land als AT oder DE wird abgewiesen — nichts wird gespeichert', async () => {
    const res = await updateProfile({ ...gueltig, country: 'FR' } as never)

    expect(res.error).toBeTruthy()
    expect(farmUpdate).not.toHaveBeenCalled()
  })

  it('ein deutscher Punkt gilt beim deutschen Hof — und wird beim österreichischen abgelehnt', async () => {
    // Simbach am Inn: für einen DE-Hof plausibel …
    const de = await updateProfile({
      ...gueltig,
      country: 'DE',
      latitude: 48.27,
      longitude: 13.02,
    })
    expect(de.error).toBeUndefined()

    // … ein Punkt in Norddeutschland dagegen NICHT für einen AT-Hof.
    vi.clearAllMocks()
    getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
    farmFindUnique.mockResolvedValue({ id: 'farm_1', slug: 'testhof' } as never)
    const at = await updateProfile({
      ...gueltig,
      country: 'AT',
      latitude: 53.55,
      longitude: 9.99,
    })
    expect(at.error).toContain('außerhalb Österreichs')
    expect(farmUpdate).not.toHaveBeenCalled()
  })

  it('der Hinweis nennt das GEWÄHLTE Land — ein DE-Hof liest nicht „außerhalb Österreichs"', async () => {
    const res = await updateProfile({
      ...gueltig,
      country: 'DE',
      latitude: 41.9,
      longitude: 12.5, // Rom
    })

    expect(res.error).toContain('außerhalb Deutschlands')
    expect(res.error).toContain('schieb die Karte auf deinen Hof')
  })
})

describe('updateProfile — Land und Punkt dürfen nicht auseinanderlaufen', () => {
  it('ein Länderwechsel OHNE neuen Punkt prüft den GESPEICHERTEN Punkt mit', async () => {
    // Der Hof steht in Hamburg (als DE gespeichert) und stellt auf AT um,
    // ohne die Karte anzufassen. Ohne die Prüfung stünde danach ein Hof mit
    // country='AT' und einem Punkt, den die AT-Prüfung nie durchließe.
    farmFindUnique.mockResolvedValue({
      id: 'farm_1',
      slug: 'testhof',
      latitude: 53.55,
      longitude: 9.99,
    } as never)

    const res = await updateProfile({ ...gueltig, country: 'AT' })

    expect(res.error).toContain('außerhalb Österreichs')
    expect(farmUpdate).not.toHaveBeenCalled()
  })

  it('passt der gespeicherte Punkt zum neuen Land, wird gespeichert', async () => {
    // Simbach am Inn, Umstellung auf DE — der Punkt passt, also ist alles gut.
    farmFindUnique.mockResolvedValue({
      id: 'farm_1',
      slug: 'testhof',
      latitude: 48.27,
      longitude: 13.02,
    } as never)

    const res = await updateProfile({ ...gueltig, country: 'DE' })

    expect(res.error).toBeUndefined()
    expect(farmUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ country: 'DE' }) })
    )
  })

  it('ein Hof OHNE gespeicherten Punkt kann sein Land jederzeit umstellen', async () => {
    farmFindUnique.mockResolvedValue({
      id: 'farm_1',
      slug: 'testhof',
      latitude: null,
      longitude: null,
    } as never)

    expect((await updateProfile({ ...gueltig, country: 'DE' })).error).toBeUndefined()
  })

  it('die Fehlermeldung für ein unbekanntes Land ist deutsch', async () => {
    const res = await updateProfile({ ...gueltig, country: 'FR' } as never)
    expect(res.error).toBe('Bitte Österreich oder Deutschland wählen')
  })
})
