/**
 * Unterleiste der HofShell: das Wort „Neu" unter dem Plus (freigabe.md §12
 * Nr. 45) — gerendert wie auf dem Server.
 *
 * Beweist:
 *  - Das Wort steht IM Knopf des Plus, unter dem Symbol: Ein Tipp auf das Wort
 *    öffnet dasselbe Blatt wie ein Tipp auf den Kreis.
 *  - Die Trefferfläche wird nicht kleiner: Der Kreis bleibt 54 px, das Wort
 *    kommt dazu; der Knopf behält seinen Namen „Neu erstellen" (das sichtbare
 *    Wort steht am Anfang des Namens).
 *  - Das Wort kommt aus der Navigations-Quelle (HOF_NEU_KNOPF), dieselbe wie
 *    der Neu-Knopf der Seitenleiste.
 *  - Gegenprobe: Die Kunden-Unterleiste (Warenkorb) bleibt ohne Wort.
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ComponentType, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/lib/auth-client', () => ({ signOut: vi.fn() }))

import { HofShell } from '@/components/shells/hof-shell'
import { KundeShell } from '@/components/shells/kunde-shell'
import { HOF_NEU_KNOPF } from '@/lib/bauern-navigation'

function el<P extends { children?: ReactNode }>(typ: ComponentType<P>, props: Omit<P, 'children'>): ReactElement {
  return createElement(typ as unknown as ComponentType<Omit<P, 'children'>>, props, createElement('p', null, 'Inhalt'))
}

const hof = renderToStaticMarkup(
  el(HofShell, { hofName: 'Hof Beispiel', hofSlug: 'hof-beispiel', personName: 'Max Mustermann', isAdmin: false, zahlen: { bestellungen: 3, admin: 0 } })
)

/** Der Teil des HTML vom ersten `start` bis zum nächsten `ende`. */
function abschnitt(html: string, start: string, ende: string): string {
  const von = html.indexOf(start)
  expect(von, start).toBeGreaterThanOrEqual(0)
  return html.slice(von, html.indexOf(ende, von) + ende.length)
}

const leiste = abschnitt(hof, '<nav aria-label="Hauptnavigation" data-slot="bottom-nav"', '</nav>')
const knopf = abschnitt(leiste, '<button', '</button>')

describe('Unterleiste Hof: „Neu" unter dem Plus', () => {
  it('das Wort kommt aus der Navigations-Quelle', () => {
    expect(HOF_NEU_KNOPF).toBe('Neu')
  })

  it('steht im Knopf des Plus, nach dem Symbol — Wort und Kreis öffnen dasselbe Blatt', () => {
    expect(knopf).toContain('aria-label="Neu erstellen"')
    const symbol = knopf.indexOf('<svg')
    const wort = knopf.indexOf(`>${HOF_NEU_KNOPF}<`)
    expect(symbol).toBeGreaterThan(-1)
    expect(wort).toBeGreaterThan(symbol)
    // Sichtbarer Text steht am Anfang des Namens (WCAG „Label in Name").
    expect('Neu erstellen'.startsWith(HOF_NEU_KNOPF)).toBe(true)
  })

  it('die Trefferfläche wird nicht kleiner: der Kreis bleibt 54 px, das Wort kommt darunter dazu', () => {
    expect(knopf).toMatch(/<button[^>]*class="[^"]*flex-col[^"]*"/)
    expect(knopf).toMatch(/<span[^>]*class="[^"]*size-\[54px\][^"]*"/)
    expect(knopf).not.toMatch(/<button[^>]*class="[^"]*\bsize-(?:\d|\[)/)
  })

  it('der Neu-Knopf der Seitenleiste nennt dasselbe Wort', () => {
    const seitenleiste = abschnitt(hof, '<aside', '</aside>')
    expect(seitenleiste).toContain(`>${HOF_NEU_KNOPF}<`)
  })

  it('Gegenprobe: die Kunden-Unterleiste bleibt beim Warenkorb ohne Wort', () => {
    const kunde = renderToStaticMarkup(el(KundeShell, { angemeldet: false }))
    const kundenLeiste = abschnitt(kunde, 'data-slot="bottom-nav"', '</nav>')
    expect(kundenLeiste).not.toContain(`>${HOF_NEU_KNOPF}<`)
  })
})
