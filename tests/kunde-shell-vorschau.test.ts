/**
 * Die Leiste der Kundschaft in der Vorschau im Rahmen (Register N4,
 * Ergänzung Nr. 107; src/components/shells/kunde-shell.tsx und
 * src/components/farm/vorschau-im-rahmen.tsx).
 *
 * Beweist:
 *  - Steht die Hofseite als Vorschau im Rahmen (VorschauImRahmen gibt es nur
 *    mit ansicht.art === 'vorschau'; dazu window.parent !== window), ist die
 *    Unterleiste der KundeShell `inert` und darüber liegt die Fläche, die den
 *    Tipp fängt — ohne Rahmen (neuer Tab) nicht.
 *  - Vom Server (und damit beim Hydrieren) kommt die Leiste immer unverändert.
 *  - Verlässt die Vorschau die Seite, wirkt die Leiste wieder.
 *  - Der Hinweis kommt aus einer Quelle.
 *
 * Ohne DOM: Der Effekt von VorschauImRahmen läuft von Hand mit gestelltem
 * window; useSyncExternalStore liest wie im Browser nach der Hydration.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const effekte = vi.hoisted(() => ({ liste: [] as Array<() => void | (() => void)>, browser: false }))
vi.mock('react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react')>()
  return {
    ...echt,
    // Effekte sammeln statt beim Rendern verpuffen — der Test lässt sie selbst laufen.
    useEffect: (wirkung: () => void | (() => void)) => {
      effekte.liste.push(wirkung)
    },
    // Im „Browser" die Momentaufnahme des Clients, sonst die des Servers — wie React beim Hydrieren.
    useSyncExternalStore: <T,>(abonniere: unknown, lies: () => T, server?: () => T): T => (effekte.browser || !server ? lies() : server()),
  }
})
vi.mock('next/navigation', () => ({ usePathname: () => '/hof-test' }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/lib/use-warenkorb-kopf', () => ({ useWarenkorbKopf: () => null }))

import { KundeShell } from '@/components/shells/kunde-shell'
import { VorschauImRahmen } from '@/components/farm/vorschau-im-rahmen'
import { VORSCHAU_LEISTE_HINWEIS } from '@/lib/hofseite-vorschau'

/** createElement mit dem Inhalt als weiterem Argument — ohne dass TypeScript `children` in den Props verlangt. */
const SHELL = KundeShell as unknown as (props: { sitzung: 'gast' }) => React.JSX.Element
const shell = () => renderToStaticMarkup(createElement(SHELL, { sitzung: 'gast' }, createElement('p', null, 'Hofseite')))

/** Das Element direkt um die Unterleiste. */
const umDieLeiste = (html: string) => {
  const stelle = html.indexOf('data-slot="bottom-nav"')
  return html.slice(html.lastIndexOf('<div', html.lastIndexOf('<nav', stelle)), stelle)
}

/** Lässt die Vorschau anlaufen: der Effekt von VorschauImRahmen mit gestelltem Fenster. */
function vorschau(imRahmen: boolean): () => void {
  const fenster: Record<string, unknown> = {
    location: { origin: 'https://hof.example', href: 'https://hof.example/hof-test' },
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  fenster.parent = imRahmen ? { postMessage: vi.fn() } : fenster
  vi.stubGlobal('window', fenster)
  vi.stubGlobal('document', { addEventListener: () => {}, removeEventListener: () => {}, querySelector: () => null })
  effekte.liste = []
  VorschauImRahmen()
  const aufraeumen = effekte.liste.map((wirkung) => wirkung())
  effekte.liste = []
  return () => {
    for (const weg of aufraeumen) if (typeof weg === 'function') weg()
  }
}

beforeEach(() => {
  effekte.browser = true
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('KundeShell in der Vorschau im Rahmen', () => {
  it('im Rahmen: die Unterleiste ist inert, darüber die Fläche für den Tipp', () => {
    const ende = vorschau(true)
    const html = shell()
    expect(umDieLeiste(html)).toMatch(/^<div inert="">/)
    expect(html).toContain('data-vorschau-sperre=""')
    ende()
  })

  it('ohne Rahmen (neuer Tab): die Leiste bleibt, wie sie ist', () => {
    const ende = vorschau(false)
    const html = shell()
    expect(umDieLeiste(html)).toMatch(/^<div>/)
    expect(html).not.toContain('inert')
    expect(html).not.toContain('data-vorschau-sperre')
    ende()
  })

  it('vom Server und beim Hydrieren unverändert — erst nach dem Mounten blass', () => {
    const ende = vorschau(true)
    effekte.browser = false
    expect(shell()).not.toContain('inert')
    ende()
  })

  it('verlässt die Vorschau die Seite, wirkt die Leiste wieder', () => {
    vorschau(true)()
    expect(shell()).not.toContain('inert')
  })

  it('der Hinweis kommt aus einer Quelle', () => {
    expect(VORSCHAU_LEISTE_HINWEIS).toBe('Vorschau – hier geht es nicht weiter')
    const text = readFileSync(join(process.cwd(), 'src/components/shells/kunde-shell.tsx'), 'utf8')
    expect(text).toContain('{VORSCHAU_LEISTE_HINWEIS}')
    expect(text).not.toContain('hier geht es nicht weiter')
  })
})
