/**
 * Tests für die Pausen-Nachricht eines Hofs (Meldung aus dem Briefkasten:
 * Nachricht erscheint nicht in der Kundenansicht).
 *
 * Beweist:
 *   - setPause speichert die Nachricht unabhängig vom Pausenstatus: Sie lässt
 *     sich vorschreiben, solange der Shop läuft, und geht beim Beenden der
 *     Pause nicht verloren. Leerer Text wird null.
 *   - kundenPausenText entscheidet, was Kundinnen sehen: die Nachricht des
 *     Hofs, sonst den Rückfall — Hofseite und Vorschau denselben Satz. (Der
 *     Hinweis für den Hof im Bearbeitungsmodus der Hofseite, pausenBanner, ist
 *     mit diesem Modus entfallen, Nr. 50 Runde 1.)
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

import { setPause } from '@/server/actions/farm'
import { kundenPausenText, SHOP_PAUSED_FALLBACK } from '@/lib/shop-pause'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const farmUpdate = vi.mocked(prisma.farm.update)
const gespeicherteNachricht = () =>
  (farmUpdate.mock.calls.at(-1)?.[0] as { data: { pauseMessage: unknown } }).data.pauseMessage

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user_1' } } as never)
  vi.mocked(prisma.farm.findUnique).mockResolvedValue({ id: 'farm_1', slug: 'hof-test' } as never)
  farmUpdate.mockResolvedValue({} as never)
})

describe('setPause — die Nachricht bleibt', () => {
  it('lässt sich vorschreiben, solange der Shop läuft', async () => {
    await setPause(false, 'Wir sind vom 1. bis 14. Juli im Urlaub.')
    expect(gespeicherteNachricht()).toBe('Wir sind vom 1. bis 14. Juli im Urlaub.')
  })

  it('geht beim Beenden der Pause nicht verloren — derselbe Schreibvorgang entpausiert und behält sie', async () => {
    await setPause(true, 'Wir sind vom 1. bis 14. Juli im Urlaub.')
    await setPause(false, 'Wir sind vom 1. bis 14. Juli im Urlaub.')
    expect(farmUpdate).toHaveBeenCalledTimes(2)
    expect(farmUpdate.mock.calls[1][0]).toMatchObject({
      where: { id: 'farm_1' },
      data: { isPaused: false, pauseMessage: 'Wir sind vom 1. bis 14. Juli im Urlaub.' },
    })
  })

  it('wird beim Pausieren gespeichert, Ränder abgeschnitten', async () => {
    await setPause(true, '  Urlaub bis Montag  ')
    expect(gespeicherteNachricht()).toBe('Urlaub bis Montag')
  })

  it('leerer Text wird null', async () => {
    await setPause(true, '   ')
    expect(gespeicherteNachricht()).toBeNull()
  })

  it('ohne Session wird nichts geschrieben', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never)
    expect(await setPause(true, 'Urlaub')).toEqual({ error: 'Nicht angemeldet' })
    expect(farmUpdate).not.toHaveBeenCalled()
  })
})

describe('kundenPausenText — was Kundinnen sehen', () => {
  it('Kundinnen sehen die Nachricht des Hofs, ohne Ränder', () => {
    expect(kundenPausenText('  Urlaub bis Montag ')).toBe('Urlaub bis Montag')
  })

  it('ohne Nachricht sehen Kundinnen den Rückfall-Text', () => {
    expect(kundenPausenText('  ')).toBe(SHOP_PAUSED_FALLBACK)
    expect(kundenPausenText(null)).toBe(SHOP_PAUSED_FALLBACK)
  })
})
