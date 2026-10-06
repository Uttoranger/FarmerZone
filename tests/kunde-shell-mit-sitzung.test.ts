/**
 * KundeShellMitSitzung (src/components/shells/kunde-shell-mit-sitzung.tsx):
 * Die Hülle liest die Sitzung im Browser und reicht „angemeldet" an die
 * unveränderte KundeShell weiter — damit eine Seite wie die Startseite
 * statisch bleiben kann und nicht auf die Sitzung warten muss.
 *
 * Beweist:
 *  - Ohne Sitzung, während die Sitzung noch lädt, und für einen angemeldeten
 *    Hof zeigt der Kopf „Anmelden" — dasselbe HTML, das der Server ausliefert.
 *  - Nur eine Kundensitzung (Rolle CUSTOMER) zeigt „Mein Konto".
 *  - Gegenprobe zu beidem in derselben Datei.
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
  it('ohne Sitzung: „Anmelden", kein „Mein Konto"', () => {
    const text = kopf({ data: null, isPending: false })
    expect(text).toContain('>Anmelden<')
    expect(text).not.toContain('Mein Konto')
  })

  it('solange die Sitzung lädt: abgemeldet — wie das statische HTML vom Server', () => {
    const text = kopf({ data: null, isPending: true })
    expect(text).toContain('>Anmelden<')
  })

  it('Kundensitzung (Rolle CUSTOMER): „Mein Konto", kein „Anmelden"', () => {
    const text = kopf({ data: { user: { id: 'k1', role: 'CUSTOMER' } }, isPending: false })
    expect(text).toContain('aria-label="Mein Konto"')
    expect(text).not.toContain('>Anmelden<')
  })

  it('ein angemeldeter Hof sieht die Kundenseite abgemeldet', () => {
    expect(kopf({ data: { user: { id: 'h1', role: 'FARMER' } }, isPending: false })).toContain('>Anmelden<')
    expect(kopf({ data: { user: { id: 'h2' } }, isPending: false })).toContain('>Anmelden<')
  })
})
