/**
 * Der Hinweis aus der Akte im Faden des Postfachs (Nr. 193) ist Beiwerk:
 * Scheitert das Laden der Höfe, bleibt der Faden sichtbar, nur ohne Hinweis
 * (Warnung an Sentry, ohne Kennung). Gegenprobe: Mit Signal steht der Hinweis da.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/server/queries/postfach', () => ({ ladeEingang: vi.fn(async () => ({})), ladeFadenAdmin: vi.fn() }))
vi.mock('@/server/queries/admin', () => ({ getAdminFarms: vi.fn() }))
vi.mock('@/server/queries/meldung', () => ({ getDuplikateVon: vi.fn(), getMeldungDetail: vi.fn(), getWunschCluster: vi.fn(async () => []) }))
vi.mock('@/lib/admin-hoefe-liste', () => ({ hofSignale: vi.fn(() => [{ text: 'Wartet seit 3 Tagen' }]) }))
vi.mock('@/lib/postfach', async (original) => ({ ...(await original<typeof import('@/lib/postfach')>()), eingangEintraege: vi.fn(() => []) }))

import * as Sentry from '@sentry/nextjs'
import { ladeFadenAdmin } from '@/server/queries/postfach'
import { getAdminFarms } from '@/server/queries/admin'
import { ladeEingangReiter } from '@/app/admin/postfach/eingang-reiter'

const FADEN_ID = 'cmfaden00000000000000001'
const JETZT = new Date('2026-10-27T08:00:00Z')

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(ladeFadenAdmin).mockResolvedValue({ id: FADEN_ID, hof: { id: 'hof-1' } } as never)
})

describe('Postfach: Hinweis aus der Akte', () => {
  it('scheitert das Laden der Höfe, bleibt der Faden sichtbar — ohne Hinweis, mit Warnung', async () => {
    vi.mocked(getAdminFarms).mockRejectedValue(new Error('Verbindung weg'))
    const daten = await ladeEingangReiter('alle' as never, { art: 'antwort', id: FADEN_ID } as never, JETZT)
    expect(daten.detail).toMatchObject({ art: 'antwort', akte: null })
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.objectContaining({ message: 'Postfach: Hinweis aus der Akte nicht geladen' }), expect.objectContaining({ level: 'warning' }))
  })

  it('Gegenprobe: mit Signal steht der Hinweis mit dem Weg in die Akte da', async () => {
    vi.mocked(getAdminFarms).mockResolvedValue([{ id: 'hof-1' }] as never)
    const daten = await ladeEingangReiter('alle' as never, { art: 'antwort', id: FADEN_ID } as never, JETZT)
    expect(daten.detail).toMatchObject({ art: 'antwort', akte: { signale: ['Wartet seit 3 Tagen'], href: '/admin/hoefe/hof-1' } })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})
