/**
 * Ein Abmelde-Hook für beide Shells (Nr. 132, Nacharbeit 126): `useAbmelden` aus
 * components/shells/admin-konto.tsx; jede Shell gibt nur ihr Ziel mit, `fuehreAbmeldenAus`
 * (src/lib/abmelden.ts) bleibt die eine Regel.
 *
 * Beweist:
 *  - Die HofShell ruft den gemeinsamen Hook mit ihrem Ziel von heute (/login); ihr Abmelden führt
 *    über signOut dorthin und lädt neu.
 *  - Derselbe Hook mit dem Ziel der Admins führt auf /login/admin.
 *  - Kein zweiter Weg: In HofShell und AdminShell steht weder signOut noch fuehreAbmeldenAus, in
 *    admin-konto.tsx genau ein Aufruf. Gegenprobe: Die Zählung schlägt bei einem zweiten an.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ComponentType, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
const signOut = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard', useRouter: () => router }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/lib/auth-client', () => ({ signOut: () => signOut() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
// Der echte Hook, nur umhüllt: So ist festzuhalten, wer ihn mit welchem Ziel ruft.
vi.mock('@/components/shells/admin-konto', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@/components/shells/admin-konto')>()
  return { ...echt, useAbmelden: vi.fn(echt.useAbmelden) }
})

import { HofShell } from '@/components/shells/hof-shell'
import { useAbmelden } from '@/components/shells/admin-konto'
import { ADMIN_ABMELDEN } from '@/lib/admin-navigation'

beforeEach(() => {
  vi.clearAllMocks()
  signOut.mockResolvedValue({ data: { success: true } })
})

/** Rendert die echte HofShell und gibt zurück, was ihr der Hook als „Abmelden" lieferte. */
function abmeldenDerHofShell(): () => Promise<void> {
  const typ = HofShell as unknown as ComponentType<Record<string, unknown>>
  renderToStaticMarkup(createElement(typ, { hofName: 'Testhof A', hofSlug: 'testhof-a', personName: 'Max Mustermann', isAdmin: false }, 'Inhalt'))
  expect(vi.mocked(useAbmelden)).toHaveBeenCalled()
  return vi.mocked(useAbmelden).mock.results[0].value as () => Promise<void>
}

describe('useAbmelden — ein Hook, jede Shell mit ihrem Ziel', () => {
  it('die HofShell ruft ihn mit ihrem Ziel von heute: /login', async () => {
    const abmelden = abmeldenDerHofShell()

    expect(vi.mocked(useAbmelden).mock.calls.every(([ziel]) => ziel === '/login')).toBe(true)
    await abmelden()
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(router.push).toHaveBeenCalledWith('/login')
    expect(router.refresh).toHaveBeenCalledTimes(1)
  })

  it('mit dem Ziel der Admins führt derselbe Hook auf /login/admin', async () => {
    let abmelden: (() => Promise<void>) | null = null
    function Pruefling(): null {
      abmelden = useAbmelden(ADMIN_ABMELDEN.ziel)
      return null
    }
    renderToStaticMarkup(createElement(Pruefling))

    await (abmelden as unknown as () => Promise<void>)()
    expect(router.push).toHaveBeenCalledWith('/login/admin')
  })
})

describe('kein zweiter Weg zum Abmelden in den Shells', () => {
  const quelle = (datei: string) => readFileSync(join(process.cwd(), 'src/components/shells', datei), 'utf8')
  const aufrufe = (text: string, name: string) => text.split(`${name}(`).length - 1

  it('HofShell und AdminShell rufen weder signOut noch fuehreAbmeldenAus, admin-konto.tsx genau einmal', () => {
    for (const datei of ['hof-shell.tsx', 'admin-shell.tsx']) {
      expect(aufrufe(quelle(datei), 'fuehreAbmeldenAus'), datei).toBe(0)
      expect(aufrufe(quelle(datei), 'signOut'), datei).toBe(0)
    }
    expect(aufrufe(quelle('admin-konto.tsx'), 'fuehreAbmeldenAus')).toBe(1)
    expect(quelle('hof-shell.tsx')).toMatch(/import \{[^}]*\buseAbmelden\b[^}]*\} from '@\/components\/shells\/admin-konto'/)
  })

  it('Gegenprobe: ein zweiter Aufruf wird gezählt', () => {
    expect(aufrufe('await fuehreAbmeldenAus({ … })\nawait signOut()', 'fuehreAbmeldenAus')).toBe(1)
    expect(aufrufe('await signOut()', 'signOut')).toBe(1)
  })
})
