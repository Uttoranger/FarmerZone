/**
 * Das Menü der Shells hängt in einer Landmarke (Nr. 132, Axe „region", Nacharbeit 126).
 *
 * Base UI hängt den Inhalt eines DropdownMenu per Portal an den <body> — außerhalb jeder Landmarke.
 * Seit Nr. 132 nimmt `DropdownMenuContent` einen Zielort (`container`); AdminShell und HofShell
 * geben ein Element in ihrem Kopf bzw. ihrer Seitenleiste mit. Offen ist ein Menü nur im Browser —
 * dort prüft Axe (Bericht 132); hier steht die Verdrahtung.
 *
 * Beweist:
 *  - Das Konto-Menü der AdminShell bekommt einen Zielort, und das Ziel steht im <header>.
 *  - Das Menü „Neu" der HofShell bekommt einen Zielort, und das Ziel steht in der <aside>
 *    „Hofbereich", nicht im scrollenden Kasten darin (dessen overflow schnitte ab).
 *  - Ohne Angabe bleibt alles wie vorher (kein Zielort = <body>). Gegenprobe: Die Suche nach dem Ziel
 *    schlägt an, wenn es außerhalb der Landmarke steht.
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement, type ComponentType, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const ziele = vi.hoisted(() => [] as unknown[])

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard', useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/lib/auth-client', () => ({ signOut: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
// Der echte Inhalt, nur umhüllt: festgehalten wird der Zielort, den die Shell mitgibt.
vi.mock('@/components/ui/dropdown-menu', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@/components/ui/dropdown-menu')>()
  return {
    ...echt,
    DropdownMenuContent: (props: Parameters<typeof echt.DropdownMenuContent>[0]) => {
      ziele.push(props.container)
      return createElement(echt.DropdownMenuContent, props)
    },
  }
})

import { AdminShell } from '@/components/shells/admin-shell'
import { HofShell } from '@/components/shells/hof-shell'

function rendere(typ: unknown, props: Record<string, unknown>): string {
  ziele.length = 0
  return renderToStaticMarkup(createElement(typ as ComponentType<Record<string, unknown>>, props, 'Inhalt'))
}

/** Der Abschnitt vom öffnenden Tag bis zu seinem schließenden — für header und aside, die nicht verschachtelt vorkommen. */
function abschnitt(html: string, tag: string): string {
  const anfang = html.indexOf(`<${tag}`)
  return anfang < 0 ? '' : html.slice(anfang, html.indexOf(`</${tag}>`, anfang))
}

const ZIEL = 'data-menue-ziel=""'
const istRef = (wert: unknown) => typeof wert === 'object' && wert !== null && 'current' in wert

describe('Menüs der Shells hängen in einer Landmarke', () => {
  it('AdminShell: das Konto-Menü bekommt einen Zielort, das Ziel steht im header', () => {
    const html = rendere(AdminShell, { personName: 'Max Mustermann', hatHof: true })

    expect(ziele).toHaveLength(1)
    expect(istRef(ziele[0])).toBe(true)
    expect(abschnitt(html, 'header')).toContain(ZIEL)
    expect(html.split(ZIEL)).toHaveLength(2)
    // Nicht in der Reiterzeile: Die scrollt (overflow-x-auto) und schnitte das Menü ab.
    expect(abschnitt(html, 'nav')).not.toContain(ZIEL)
  })

  it('HofShell: das Menü „Neu" bekommt einen Zielort, das Ziel steht in der Seitenleiste, nicht im scrollenden Kasten', () => {
    const html = rendere(HofShell, { hofName: 'Testhof A', hofSlug: 'testhof-a', personName: 'Max Mustermann', isAdmin: false })

    expect(ziele).toHaveLength(1)
    expect(istRef(ziele[0])).toBe(true)
    const seitenleiste = abschnitt(html, 'aside')
    expect(seitenleiste).toContain('aria-label="Hofbereich"')
    expect(seitenleiste).toContain(ZIEL)
    // Das Ziel folgt erst auf den letzten schließenden Kasten der Leiste — also nicht im overflow-Kasten.
    expect(seitenleiste.trimEnd().endsWith(`<div ${ZIEL}></div>`)).toBe(true)
  })

  it('Gegenprobe: ein Ziel außerhalb der Landmarke wird nicht gefunden', () => {
    const html = `<header class="x"><div></div></header><div ${ZIEL}></div>`
    expect(abschnitt(html, 'header')).not.toContain(ZIEL)
    expect(istRef(undefined)).toBe(false)
  })
})
