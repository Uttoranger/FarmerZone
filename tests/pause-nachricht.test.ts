/**
 * Tests für die Pausen-Nachricht eines Hofs (Meldung aus dem Briefkasten:
 * Nachricht erscheint nicht in der Kundenansicht).
 *
 * Beweist:
 *   - setPause speichert die Nachricht unabhängig vom Pausenstatus: Sie lässt
 *     sich vorschreiben, solange der Shop läuft, und geht beim Beenden der
 *     Pause nicht verloren. Leerer Text wird null.
 *   - pausenBanner entscheidet, was der Banner zeigt: Kundinnen den Text (eigene
 *     Nachricht oder Rückfall), der Hof im Bearbeiten-Modus nur den Hinweis mit
 *     Weg zurück, der Hof in der Kundenansicht (Vorschau) den Hinweis UND genau
 *     den Text, den Kundinnen sehen.
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
import { pausenBanner, SHOP_PAUSED_FALLBACK } from '@/lib/shop-pause'
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

describe('pausenBanner — was der Banner zeigt', () => {
  it('Kundinnen sehen die Nachricht des Hofs', () => {
    expect(pausenBanner({ ownerMode: false, vorschau: false, pauseMessage: 'Urlaub bis Montag' })).toEqual({
      hofHinweis: false,
      kundenText: 'Urlaub bis Montag',
    })
  })

  it('ohne Nachricht sehen Kundinnen den Rückfall-Text', () => {
    expect(pausenBanner({ ownerMode: false, vorschau: false, pauseMessage: '  ' }).kundenText).toBe(
      SHOP_PAUSED_FALLBACK
    )
  })

  it('der Hof sieht im Bearbeiten-Modus nur den Hinweis mit Weg zurück', () => {
    expect(pausenBanner({ ownerMode: true, vorschau: false, pauseMessage: 'Urlaub bis Montag' })).toEqual({
      hofHinweis: true,
      kundenText: null,
    })
  })

  it('der Hof sieht in der Kundenansicht zusätzlich genau den Text der Kundinnen', () => {
    expect(pausenBanner({ ownerMode: true, vorschau: true, pauseMessage: 'Urlaub bis Montag' })).toEqual({
      hofHinweis: true,
      kundenText: 'Urlaub bis Montag',
    })
    expect(pausenBanner({ ownerMode: true, vorschau: true, pauseMessage: null }).kundenText).toBe(
      SHOP_PAUSED_FALLBACK
    )
  })
})
