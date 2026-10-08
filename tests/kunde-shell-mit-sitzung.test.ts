/**
 * KundeShellMitSitzung (src/components/shells/kunde-shell-mit-sitzung.tsx):
 * Die Hülle liest die Sitzung im Browser und reicht sie an die KundeShell
 * weiter — damit eine Seite wie die Startseite statisch bleiben kann und
 * nicht auf die Sitzung warten muss.
 *
 * Beweist:
 *  - Ohne Sitzung und während die Sitzung noch lädt zeigt der Kopf „Anmelden"
 *    (→ /login) — dasselbe HTML, das der Server ausliefert.
 *  - Eine Kundensitzung (Rolle CUSTOMER) zeigt „Mein Konto".
 *  - Eine Hof-Sitzung (Rolle FARMER, auch ein Betreiber mit eigenem Hof) zeigt
 *    „Mein Hof" (→ /dashboard) statt „Anmelden" (Nr. 41, Register N1).
 *  - Gegenprobe zu allem in derselben Datei.
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))

type Sitzung = { data: { user: Record<string, unknown> } | null; isPending: boolean }
const sitzung: { aktuell: Sitzung } = { aktuell: { data: null, isPending: false } }
vi.mock('@/lib/auth-client', () => ({ useSession: () => sitzung.aktuell }))

import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'

function kopf(stand: Sitzung): string {
  sitzung.aktuell = stand
  const html = renderToStaticMarkup(createElement(KundeShellMitSitzung, null, createElement('p', null, 'Inhalt')))
  return html.slice(html.indexOf('<header'), html.indexOf('</header>'))
}

describe('KundeShellMitSitzung', () => {
  it('ohne Sitzung: „Anmelden" auf /login, kein „Mein Konto", kein „Mein Hof"', () => {
    const text = kopf({ data: null, isPending: false })
    expect(text).toMatch(/<a [^>]*href="\/login"[^>]*>Anmelden<\/a>/)
    expect(text).not.toContain('Mein Konto')
    expect(text).not.toContain('Mein Hof')
  })

  it('solange die Sitzung lädt: abgemeldet — wie das statische HTML vom Server', () => {
    const text = kopf({ data: null, isPending: true })
    expect(text).toContain('>Anmelden<')
  })

  it('Kundensitzung (Rolle CUSTOMER): „Mein Konto", kein „Anmelden", kein „Mein Hof"', () => {
    const text = kopf({ data: { user: { id: 'k1', role: 'CUSTOMER' } }, isPending: false })
    expect(text).toContain('aria-label="Mein Konto"')
    expect(text).not.toContain('>Anmelden<')
    expect(text).not.toContain('Mein Hof')
  })

  it('Hof-Sitzung (Rolle FARMER): „Mein Hof" auf /dashboard statt „Anmelden" — ohne „Mein Konto" der Kunden', () => {
    const text = kopf({ data: { user: { id: 'h1', role: 'FARMER' } }, isPending: false })
    expect(text).toMatch(/<a [^>]*href="\/dashboard"[^>]*>Mein Hof<\/a>/)
    expect(text).not.toContain('>Anmelden<')
    expect(text).not.toContain('Mein Konto')
  })

  it('Sitzung ohne Rolle oder mit einer Rolle ohne eigene Kundenseite: wie abgemeldet', () => {
    expect(kopf({ data: { user: { id: 'h2' } }, isPending: false })).toContain('>Anmelden<')
    expect(kopf({ data: { user: { id: 'a1', role: 'ADMIN' } }, isPending: false })).toContain('>Anmelden<')
  })
})
