/**
 * Der Statusbereich neben „Jetzt messen" (Admin › Betrieb, Nr. 103; Nacharbeit 126 in Nr. 132).
 *
 * Beweist:
 *  - Der Bereich mit role="status" steht schon leer im HTML — nur so sagt ein Screenreader den Satz
 *    an, der später hineinkommt.
 *  - Leer ist er nur unsichtbar (`empty:sr-only`), nicht ausgeblendet: `empty:hidden` (display:none)
 *    nähme ihn aus dem Zugänglichkeitsbaum. Gegenprobe: Mit `empty:hidden` wäre der Test rot
 *    (geprüft am Stand vor Nr. 132).
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@sentry/nextjs', () => ({ addBreadcrumb: vi.fn(), captureException: vi.fn() }))
vi.mock('@/server/actions/betrieb', () => ({ messeJetztAction: vi.fn() }))

import { JetztMessen } from '@/app/admin/betrieb/jetzt-messen'

const TEXTE = { knopf: 'Jetzt messen', misst: 'Misst …', fehler: 'Das hat nicht geklappt.' }

describe('JetztMessen: der Statusbereich', () => {
  it('steht leer im HTML und ist dann nur unsichtbar, nicht ausgeblendet', () => {
    const html = renderToStaticMarkup(createElement(JetztMessen, { texte: TEXTE }))

    expect(html).toMatch(/<p[^>]*role="status"[^>]*><\/p>/)
    const status = html.match(/<p[^>]*role="status"[^>]*>/)?.[0] ?? ''
    expect(status).toContain('empty:sr-only')
    expect(status).not.toMatch(/\bempty:hidden\b/)
    // Gegenprobe, dass die Komponente gerendert hat: der Knopf mit seinem Wort.
    expect(html).toContain(TEXTE.knopf)
  })
})
