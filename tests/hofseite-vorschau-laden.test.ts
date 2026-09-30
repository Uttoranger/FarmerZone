/**
 * Tests für den Lader der Hofseite (src/server/hofseite-vorschau.ts).
 *
 * Beweist, mit nachgebildeter Sitzung und nachgebildeten Abfragen: Ein Hof,
 * den der Betreiber noch nicht freigegeben hat, ist über getPublicFarm
 * unsichtbar (null) und nur über getOwnerFarm zu haben. Der Lader wählt
 *  - für den angemeldeten Besitzer mit ?vorschau=1 getOwnerFarm → Hof, Vorschau;
 *  - für Abgemeldete und fremde Nutzer getPublicFarm → null, keine Vorschau;
 *  - ohne den Parameter (oder mit anderem Wert) immer getPublicFarm — ohne
 *    die Sitzung überhaupt zu lesen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/server/queries/farm', () => ({
  getHofBesitzer: vi.fn(),
  getOwnerFarm: vi.fn(),
  getPublicFarm: vi.fn(),
}))

import { ladeHofseite } from '@/server/hofseite-vorschau'
import { auth } from '@/lib/auth'
import { getHofBesitzer, getOwnerFarm, getPublicFarm } from '@/server/queries/farm'

const getSession = vi.mocked(auth.api.getSession)
const besitzer = vi.mocked(getHofBesitzer)
const ownerFarm = vi.mocked(getOwnerFarm)
const publicFarm = vi.mocked(getPublicFarm)

/** Ein Hof vor der Freigabe: die Sichtbarkeitsregel findet ihn nicht, der Besitzer schon. */
const HOF = { id: 'farm_1', slug: 'hof-neu', ownerId: 'user_hof', name: 'Hof Neu' }

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(null as never)
  besitzer.mockImplementation(async (slug) => (slug === HOF.slug ? HOF.ownerId : null))
  publicFarm.mockResolvedValue(null)
  ownerFarm.mockImplementation(async (ownerId) => (ownerId === HOF.ownerId ? (HOF as never) : null))
})

describe('nicht freigegebener Hof', () => {
  it('abgemeldet mit ?vorschau=1: nicht gefunden, keine Vorschau', async () => {
    expect(await ladeHofseite('hof-neu', '1')).toEqual({ farm: null, vorschau: false })
    expect(ownerFarm).not.toHaveBeenCalled()
    expect(publicFarm).toHaveBeenCalledWith('hof-neu')
    // Ohne Anmeldung interessiert der Besitzer nicht — keine zweite Abfrage.
    expect(besitzer).not.toHaveBeenCalled()
  })

  it('ein fremder Bauer mit ?vorschau=1: nicht gefunden, keine Vorschau', async () => {
    getSession.mockResolvedValue({ user: { id: 'user_anderer' } } as never)
    expect(await ladeHofseite('hof-neu', '1')).toEqual({ farm: null, vorschau: false })
    expect(ownerFarm).not.toHaveBeenCalled()
  })

  it('der Besitzer mit ?vorschau=1 sieht seinen Hof — als Vorschau', async () => {
    getSession.mockResolvedValue({ user: { id: HOF.ownerId } } as never)
    expect(await ladeHofseite('hof-neu', '1')).toEqual({ farm: HOF, vorschau: true })
    expect(ownerFarm).toHaveBeenCalledWith(HOF.ownerId)
    expect(publicFarm).not.toHaveBeenCalled()
  })

  it('der Besitzer ohne Parameter sieht ihn nicht — und die Sitzung wird gar nicht gelesen', async () => {
    getSession.mockResolvedValue({ user: { id: HOF.ownerId } } as never)
    for (const parameter of [undefined, '0', '']) {
      expect(await ladeHofseite('hof-neu', parameter), String(parameter)).toEqual({ farm: null, vorschau: false })
    }
    expect(getSession).not.toHaveBeenCalled()
    expect(besitzer).not.toHaveBeenCalled()
    expect(ownerFarm).not.toHaveBeenCalled()
  })

  it('der Besitzer mit dem Slug eines fremden Hofs: wie öffentlich', async () => {
    getSession.mockResolvedValue({ user: { id: HOF.ownerId } } as never)
    besitzer.mockResolvedValue('user_anderer')
    expect(await ladeHofseite('hof-fremd', '1')).toEqual({ farm: null, vorschau: false })
    expect(ownerFarm).not.toHaveBeenCalled()
    expect(publicFarm).toHaveBeenCalledWith('hof-fremd')
  })
})

describe('freigegebener Hof', () => {
  it('ohne Parameter kommt er über die Sichtbarkeitsregel, keine Vorschau', async () => {
    publicFarm.mockResolvedValue(HOF as never)
    expect(await ladeHofseite('hof-neu', undefined)).toEqual({ farm: HOF, vorschau: false })
    expect(getSession).not.toHaveBeenCalled()
  })
})
