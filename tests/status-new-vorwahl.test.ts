/**
 * „Neuer Beitrag“ wählt den Anlass aus `?anlass=` im Formular vor (Register
 * E12, Ergänzung Nr. 129) — der Assistent echt, serverseitig gerendert; die
 * Grenzen zum Server (Aktionen, Router) sind Attrappen. Der Anlass sticht den
 * der Vorlage, ohne ihn gilt wie bisher die Vorlage bzw. „Frisches Produkt“.
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {}, refresh() {}, replace() {}, back() {}, prefetch() {} }) }))
vi.mock('next/image', () => ({ default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }) }))
vi.mock('@/server/actions/status-posts', () => ({ publishStatusPost: vi.fn() }))
vi.mock('@/server/actions/bild-ausschnitt', () => ({ speichereBildAusschnittAction: vi.fn() }))
vi.mock('@/server/actions/teilen-fenster', () => ({ ladeTeilenFensterBeitragAction: vi.fn() }))

import { StatusNewClient } from '@/app/(hof)/status/new/status-new-client'

const assistent = (props: Partial<ComponentProps<typeof StatusNewClient>> = {}): string =>
  renderToStaticMarkup(
    createElement(StatusNewClient, { products: [], emailCount: 0, recentEmailSentAt: null, jetzt: '2026-10-20T10:00:00.000Z', farmSlug: 'farm-a', ...props })
  )

/** Das Wort des gewählten Anlasses (aria-pressed="true"). */
function gewaehlt(html: string): string | undefined {
  return html.match(/<button[^>]*aria-pressed="true"[^>]*>(?:(?!<\/button>)[\s\S])*?<span class="flex-1">([^<]+)<\/span>/)?.[1]
}

describe('Vorwahl des Anlasses', () => {
  it('mit `anlass` ist genau dieser Anlass gewählt', () => {
    expect(gewaehlt(assistent({ anlass: 'PROMOTION' }))).toBe('Aktion')
  })

  it('er sticht den Anlass der Vorlage', () => {
    const prefill = { anlass: 'ANNOUNCEMENT', title: 'Erfundener Titel', body: 'Erfundener Text.', photoUrl: null }
    expect(gewaehlt(assistent({ prefill, anlass: 'NEW_SEASON' }))).toBe('Neue Saison')
  })

  it('Gegenprobe: ohne `anlass` gilt die Vorlage, ohne beides „Frisches Produkt“', () => {
    const prefill = { anlass: 'ANNOUNCEMENT', title: 'Erfundener Titel', body: 'Erfundener Text.', photoUrl: null }
    expect(gewaehlt(assistent({ prefill }))).toBe('Mitteilung')
    expect(gewaehlt(assistent())).toBe('Frisches Produkt')
  })
})
