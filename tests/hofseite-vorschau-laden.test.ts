/**
 * Tests für den Lader der Hofseite (src/server/hofseite-vorschau.ts).
 *
 * Beweist, mit nachgebildeter Sitzung und nachgebildeten Abfragen: Ein Hof,
 * den der Betreiber noch nicht freigegeben hat, ist über getPublicFarm
 * unsichtbar (null) und nur über getOwnerFarm zu haben. Der Lader fragt
 * ansichtsModus (src/lib/ansichts-modus.ts) und wählt
 *  - für den angemeldeten Besitzer mit ?vorschau=1 getOwnerFarm → Hof, Vorschau;
 *  - für Abgemeldete und fremde Nutzer getPublicFarm → null, Kundin (noindex);
 *  - ohne den Parameter (oder mit anderem Wert) immer getPublicFarm — ohne
 *    die Sitzung überhaupt zu lesen.
 * An die Seite geht die Ansicht ohne die Nutzer-ID.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
// Die Freigabe verwaister Bestellungen hat eigene Tests; hier zählt nur, welche Abfrage lädt.
vi.mock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteFreiFuerSlug: vi.fn() }))
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

const VORSCHAU = { art: 'vorschau', noindex: true, kaufen: false }
const KUNDIN = { art: 'kundin', noindex: false, kaufen: true }
const KUNDIN_OHNE_INDEX = { ...KUNDIN, noindex: true }

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(null as never)
  besitzer.mockImplementation(async (slug) => (slug === HOF.slug ? HOF.ownerId : null))
  publicFarm.mockResolvedValue(null)
  ownerFarm.mockImplementation(async (ownerId) => (ownerId === HOF.ownerId ? (HOF as never) : null))
})

describe('nicht freigegebener Hof', () => {
  it('abgemeldet mit ?vorschau=1: nicht gefunden, keine Vorschau', async () => {
    expect(await ladeHofseite('hof-neu', { vorschau: '1' })).toEqual({ farm: null, ansicht: KUNDIN_OHNE_INDEX })
    expect(ownerFarm).not.toHaveBeenCalled()
    expect(publicFarm).toHaveBeenCalledWith('hof-neu')
    // Ohne Anmeldung interessiert der Besitzer nicht — keine zweite Abfrage.
    expect(besitzer).not.toHaveBeenCalled()
  })

  it('ein fremder Bauer mit ?vorschau=1: nicht gefunden, keine Vorschau', async () => {
    getSession.mockResolvedValue({ user: { id: 'user_anderer' } } as never)
    expect(await ladeHofseite('hof-neu', { vorschau: '1' })).toEqual({ farm: null, ansicht: KUNDIN_OHNE_INDEX })
    expect(ownerFarm).not.toHaveBeenCalled()
  })

  it('der Besitzer mit ?vorschau=1 sieht seinen Hof — als Vorschau', async () => {
    getSession.mockResolvedValue({ user: { id: HOF.ownerId } } as never)
    expect(await ladeHofseite('hof-neu', { vorschau: '1' })).toEqual({ farm: HOF, ansicht: VORSCHAU })
    expect(ownerFarm).toHaveBeenCalledWith(HOF.ownerId)
    expect(publicFarm).not.toHaveBeenCalled()
  })

  it('der Besitzer ohne Parameter sieht ihn nicht — und die Sitzung wird gar nicht gelesen', async () => {
    getSession.mockResolvedValue({ user: { id: HOF.ownerId } } as never)
    expect(await ladeHofseite('hof-neu', {})).toEqual({ farm: null, ansicht: KUNDIN })
    for (const wert of ['0', '']) {
      expect(await ladeHofseite('hof-neu', { vorschau: wert }), wert).toEqual({ farm: null, ansicht: KUNDIN_OHNE_INDEX })
    }
    expect(getSession).not.toHaveBeenCalled()
    expect(besitzer).not.toHaveBeenCalled()
    expect(ownerFarm).not.toHaveBeenCalled()
  })

  it('der Besitzer mit dem Slug eines fremden Hofs: wie öffentlich', async () => {
    getSession.mockResolvedValue({ user: { id: HOF.ownerId } } as never)
    besitzer.mockResolvedValue('user_anderer')
    expect(await ladeHofseite('hof-fremd', { vorschau: '1' })).toEqual({ farm: null, ansicht: KUNDIN_OHNE_INDEX })
    expect(ownerFarm).not.toHaveBeenCalled()
    expect(publicFarm).toHaveBeenCalledWith('hof-fremd')
  })
})

describe('freigegebener Hof', () => {
  it('ohne Parameter kommt er über die Sichtbarkeitsregel, keine Vorschau', async () => {
    publicFarm.mockResolvedValue(HOF as never)
    expect(await ladeHofseite('hof-neu', {})).toEqual({ farm: HOF, ansicht: KUNDIN })
    expect(getSession).not.toHaveBeenCalled()
  })

  it('die Ansicht für die Seite trägt keine Nutzer-ID — die braucht nur der Lader', async () => {
    getSession.mockResolvedValue({ user: { id: HOF.ownerId } } as never)
    const { ansicht } = await ladeHofseite('hof-neu', { vorschau: '1' })
    expect(JSON.stringify(ansicht)).not.toContain(HOF.ownerId)
  })
})
