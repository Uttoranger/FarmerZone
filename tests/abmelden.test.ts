/**
 * „Abmelden" in der HofShell (src/lib/abmelden.ts, components/shells/hof-shell.tsx)
 * und in ihrer Vorschau unter /intern.
 *
 * Beweist:
 *  - Geklappt → weiter zur Anmeldung, kein Fehlersatz.
 *  - Better Auth antwortet mit `{ error }` oder wirft (kein Netz) → deutscher
 *    Satz ohne Fachbegriff, KEIN Weiterleiten — der Bauer ist noch angemeldet.
 *  - Mit Ersatz (Vorschau) wird das echte Abmelden nie aufgerufen.
 *  - Die Vorschau der HofShell gibt diesen Ersatz mit: Er zeigt den Hinweis
 *    und meldet den Admin nicht ab (Gegenprobe: die Kunden-Vorschau hat keinen).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ABMELDEN_FEHLGESCHLAGEN, ABMELDEN_IN_VORSCHAU, fuehreAbmeldenAus } from '@/lib/abmelden'

const signOut = vi.fn()
const toast = vi.fn()
const hofShellProps: Array<{ onAbmelden?: () => void }> = []

vi.mock('@/lib/auth-client', () => ({ signOut: () => signOut() }))
vi.mock('sonner', () => ({ toast: Object.assign((satz: string) => toast(satz), { error: (satz: string) => toast(satz) }) }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/intern/bausteine/shell/hof',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
// Die echte HofShell kann ohne Browser nicht geklickt werden — hier zählt nur, was die Vorschau ihr übergibt.
vi.mock('@/components/shells/hof-shell', () => ({
  HofShell: (props: { onAbmelden?: () => void; children?: ReactNode }) => {
    hofShellProps.push(props)
    return createElement('div', { 'data-hof-shell': '' }, props.children)
  },
}))

function schritte(abmelden: () => Promise<unknown>, ersatz?: () => void) {
  return { abmelden: vi.fn(abmelden), beiFehler: vi.fn(), danach: vi.fn(), ersatz }
}

beforeEach(() => {
  vi.clearAllMocks()
  hofShellProps.length = 0
})

describe('fuehreAbmeldenAus', () => {
  it('geklappt: weiter zur Anmeldung, kein Fehlersatz', async () => {
    const s = schritte(async () => ({ data: { success: true }, error: null }))
    await fuehreAbmeldenAus(s)
    expect(s.danach).toHaveBeenCalledOnce()
    expect(s.beiFehler).not.toHaveBeenCalled()
  })

  it('Better Auth antwortet mit einem Fehler: Satz zeigen, nicht weiterleiten', async () => {
    const s = schritte(async () => ({ data: null, error: { status: 500, message: 'Internal Server Error' } }))
    await fuehreAbmeldenAus(s)
    expect(s.beiFehler).toHaveBeenCalledWith(ABMELDEN_FEHLGESCHLAGEN)
    expect(s.danach).not.toHaveBeenCalled()
  })

  it('kein Netz (Wurf): Satz zeigen, nicht weiterleiten, nichts fliegt nach oben', async () => {
    const s = schritte(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(fuehreAbmeldenAus(s)).resolves.toBeUndefined()
    expect(s.beiFehler).toHaveBeenCalledWith(ABMELDEN_FEHLGESCHLAGEN)
    expect(s.danach).not.toHaveBeenCalled()
  })

  it('der Satz ist deutsch, geduzt und ohne Fachbegriff', () => {
    expect(ABMELDEN_FEHLGESCHLAGEN).toBe('Abmelden hat nicht geklappt. Versuch es bitte noch einmal.')
    expect(ABMELDEN_FEHLGESCHLAGEN).not.toMatch(/session|fehler \d|error|token/i)
  })

  it('mit Ersatz (Vorschau) wird nie wirklich abgemeldet und nie weitergeleitet', async () => {
    const ersatz = vi.fn()
    const s = schritte(async () => ({ error: null }), ersatz)
    await fuehreAbmeldenAus(s)
    expect(ersatz).toHaveBeenCalledOnce()
    expect(s.abmelden).not.toHaveBeenCalled()
    expect(s.danach).not.toHaveBeenCalled()
    expect(s.beiFehler).not.toHaveBeenCalled()
  })
})

describe('Shell-Vorschau unter /intern', () => {
  it('die HofShell bekommt einen Ersatz: Hinweis statt Abmelden', async () => {
    const { ShellVorschau } = await import('@/app/intern/bausteine/shell/[variante]/shell-vorschau')
    renderToStaticMarkup(createElement(ShellVorschau, { variante: 'hof' }))
    const onAbmelden = hofShellProps.at(-1)?.onAbmelden
    expect(onAbmelden).toBeTypeOf('function')

    onAbmelden?.()

    expect(toast).toHaveBeenCalledWith(ABMELDEN_IN_VORSCHAU)
    expect(signOut).not.toHaveBeenCalled()
  }, 30_000)

  it('Gegenprobe: die Kunden-Vorschau rendert keine HofShell', async () => {
    const { ShellVorschau } = await import('@/app/intern/bausteine/shell/[variante]/shell-vorschau')
    const html = renderToStaticMarkup(createElement(ShellVorschau, { variante: 'kunde' }))
    expect(html).not.toContain('data-hof-shell')
    expect(hofShellProps).toHaveLength(0)
  }, 30_000)
})
