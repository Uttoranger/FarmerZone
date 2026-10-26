/**
 * Die Abholzeiten als Formular (Nr. 174): Enter speichert, Zahlenfeld mit
 * Zifferntastatur, 16 px, und – Register N29 – eine Aktion ohne Netz wirft
 * nie an die Fehlerseite: Die Eingabe bleibt, der Satz steht am Formular.
 *
 * Ohne DOM (TESTING_GUIDELINES §1): Die Seite wird mit renderToStaticMarkup
 * gerendert; ein dünner Umweg über die JSX-Laufzeit hält das `onSubmit` des
 * Formulars und die Knöpfe der Liste fest. Gesetzter React-Zustand ist nach dem
 * Rendern auf dem Server ein No-op – geprüft werden darum die Aufrufe an der
 * Grenze (Aktion, Neuladen, Toast) und dass nichts wirft.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const gefangen = vi.hoisted(() => ({
  submit: null as ((e: { preventDefault: () => void }) => void) | null,
  knoepfe: new Map<string, () => void>(),
  laeufe: [] as Promise<unknown>[],
}))
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof echt.jsxDEV = (type, props, ...rest) => {
    const p = props as Record<string, unknown>
    if (type === 'form' && typeof p.onSubmit === 'function') gefangen.submit = p.onSubmit as typeof gefangen.submit
    if (type === 'button' && typeof p['aria-label'] === 'string' && typeof p.onClick === 'function') gefangen.knoepfe.set(p['aria-label'], p.onClick as () => void)
    if (type === 'button' && typeof p['aria-pressed'] === 'boolean' && typeof p.onClick === 'function') gefangen.knoepfe.set('umschalten', p.onClick as () => void)
    return echt.jsxDEV(type, props, ...rest)
  }
  return { ...echt, jsxDEV }
})
vi.mock('react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react')>()
  const useTransition = (): [boolean, (rueckruf: () => unknown) => void] => [
    false,
    (rueckruf) => {
      gefangen.laeufe.push(Promise.resolve().then(rueckruf))
    },
  ]
  return { ...echt, useTransition }
})

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  addPickupSlot: vi.fn(),
  deletePickupSlot: vi.fn(),
  togglePickupSlotActive: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn(), replace: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error, info: vi.fn(), warning: vi.fn() } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/server/actions/farm', () => ({
  addPickupSlot: mocks.addPickupSlot,
  deletePickupSlot: mocks.deletePickupSlot,
  togglePickupSlotActive: mocks.togglePickupSlotActive,
}))
// abschnitt-speichern zieht weitere Server-Aktionen herein; hier zählt nur aktionOhneWurf.
vi.mock('@/server/actions/appearance', () => ({ saveAppearanceAction: vi.fn() }))

import { PickupSlotsClient } from '@/components/settings/pickup-slots-client'
import { NETZ_SATZ } from '@/lib/netz'

const SLOT = { id: 's1', dayOfWeek: 3, startTime: '10:00', endTime: '12:00', maxOrders: null, isActive: true }
const html = (slots = [SLOT]) => renderToStaticMarkup(createElement(PickupSlotsClient, { initialSlots: slots }))
const warte = () => Promise.all(gefangen.laeufe)

beforeEach(() => {
  vi.clearAllMocks()
  gefangen.submit = null
  gefangen.knoepfe.clear()
  gefangen.laeufe = []
})

describe('Formular „Abholzeit hinzufügen"', () => {
  it('ist ein <form>: der Knopf schickt ab, die Felder tragen Tastatur und 16 px', () => {
    const markup = html()
    expect(markup).toMatch(/<form[^>]*>[\s\S]*Abholzeit hinzufügen[\s\S]*<\/form>/)
    expect(markup).toMatch(/<button[^>]*type="submit"/)
    expect(markup).toMatch(/<input[^>]*id="maxOrders"[^>]*inputMode="numeric"/)
    expect(markup).toMatch(/<input[^>]*id="startTime"[^>]*enterKeyHint="next"/)
    expect(markup).toMatch(/<input[^>]*id="maxOrders"[^>]*enterKeyHint="done"/)
    const select = markup.match(/<select[^>]*>/)?.[0] ?? ''
    expect(select).toContain('text-base')
    expect(select).not.toMatch(/(^|\s)text-sm/)
  })

  it('Enter (Absenden) legt die Abholzeit an und lädt neu', async () => {
    mocks.addPickupSlot.mockResolvedValue({})
    html()
    gefangen.submit?.({ preventDefault: vi.fn() })
    await warte()

    expect(mocks.addPickupSlot).toHaveBeenCalledWith({ dayOfWeek: 1, startTime: '14:00', endTime: '16:00', maxOrders: null })
    expect(mocks.success).toHaveBeenCalledWith('Abholzeit hinzugefügt')
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })

  it('ohne Netz: kein Wurf, kein Toast, kein Neuladen – der Satz steht am Formular', async () => {
    mocks.addPickupSlot.mockRejectedValue(new TypeError('Failed to fetch'))
    html()
    gefangen.submit?.({ preventDefault: vi.fn() })
    await expect(warte()).resolves.toBeDefined()

    expect(mocks.addPickupSlot).toHaveBeenCalledOnce()
    expect(mocks.error).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('ein Satz der Aktion (Gegenprobe) kommt ebenfalls ohne Toast an', async () => {
    mocks.addPickupSlot.mockResolvedValue({ error: 'Diese Abholzeit überschneidet sich.' })
    html()
    gefangen.submit?.({ preventDefault: vi.fn() })
    await warte()

    expect(mocks.error).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})

describe('Löschen und Umschalten', () => {
  const loeschen = 'Abholzeit Mittwoch 10:00–12:00 löschen'

  it.each([
    ['löschen', () => mocks.deletePickupSlot, loeschen],
    ['umschalten', () => mocks.togglePickupSlotActive, 'umschalten'],
  ])('%s ohne Netz wirft nie und lädt nicht neu', async (_name, aktion, schluessel) => {
    aktion().mockRejectedValue(new TypeError('Failed to fetch'))
    html()
    gefangen.knoepfe.get(schluessel)?.()
    await expect(warte()).resolves.toBeDefined()

    expect(aktion()).toHaveBeenCalledOnce()
    expect(mocks.error).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('Gegenprobe: Umschalten mit Erfolg lädt neu', async () => {
    mocks.togglePickupSlotActive.mockResolvedValue({})
    html()
    gefangen.knoepfe.get('umschalten')?.()
    await warte()

    expect(mocks.togglePickupSlotActive).toHaveBeenCalledWith('s1', false)
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })

  it('der Netzsatz ist der Wortlaut aus Nr. 175', () => {
    expect(NETZ_SATZ).toMatch(/^Keine Verbindung/)
  })
})
