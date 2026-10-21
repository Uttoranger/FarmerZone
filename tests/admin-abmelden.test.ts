/**
 * „Abmelden" im Admin-Bereich (Register N20, Nr. 126; Nacharbeit zu Nr. 115)
 * und die Tippflächen der Reiter.
 *
 * Die AdminShell hatte keinen Knopf dafür: Wer den Bereich verlässt, sollte
 * die Sitzung beenden können, ohne über den Hofbereich zu gehen — und ein
 * Betreiber ohne Hof hatte gar keinen Weg.
 *
 * Beweist:
 *  - Die Shell zeigt „Abmelden" (44 px hoch) — mit und ohne eigenen Hof;
 *    am Handy öffnet die Plakette ein Menü mit „Abmelden" (und mit Hof
 *    „Konto und Sicherheit"), am Computer steht der Knopf neben der Plakette.
 *  - Das Abmelden ist der Weg der HofShell (`fuehreAbmeldenAus`, kein zweites
 *    Abmelden): signOut, dann /login/admin und neu laden; bei einem Fehler
 *    der Satz der HofShell und KEIN Weiterleiten; in der Vorschau unter
 *    /intern gilt der Ersatz statt des echten Abmeldens.
 *  - Die Reiter haben eine Trefferfläche von mindestens 44 px (sichtbar 38 px).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ComponentType, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
const signOut = vi.hoisted(() => vi.fn())
const toastFehler = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({ usePathname: () => '/admin', useRouter: () => router }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/lib/auth-client', () => ({ signOut: () => signOut() }))
vi.mock('sonner', () => ({ toast: { error: (satz: string) => toastFehler(satz) } }))

import { AdminShell } from '@/components/shells/admin-shell'
import { AdminAbmeldenKnopf, AdminKontoMenue } from '@/components/shells/admin-konto'
import { DropdownMenuItem, DropdownMenuLinkItem } from '@/components/ui/dropdown-menu'
import { ABMELDEN_FEHLGESCHLAGEN } from '@/lib/abmelden'
import { ADMIN_ABMELDEN, ADMIN_KONTO } from '@/lib/admin-navigation'
import { ADMIN_PFAD } from '@/lib/admin-anmeldung'
import { findeElement } from './element-suche'

const INHALT = createElement('p', null, 'Inhalt der Seite')

function shell(hatHof: boolean): string {
  const typ = AdminShell as unknown as ComponentType<Record<string, unknown>>
  return renderToStaticMarkup(createElement(typ, { personName: 'Max Mustermann', hatHof }, INHALT))
}

/** Das öffnende Tag des ersten Knopfes, in dem „Abmelden" steht. */
function abmeldenKnopf(html: string): string {
  const knopf = html.match(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*?Abmelden/)?.[0]
  expect(knopf, 'Knopf „Abmelden"').toBeDefined()
  return knopf?.match(/^<button\b[^>]*>/)?.[0] ?? ''
}

/** Der Klick-Griff eines Elements. */
function klick(element: { props: Record<string, unknown> } | null): () => Promise<void> {
  expect(element, 'Element mit onClick').not.toBeNull()
  return element?.props.onClick as () => Promise<void>
}

beforeEach(() => {
  vi.clearAllMocks()
  signOut.mockResolvedValue({ data: { success: true } })
})

describe('Abmelden in der AdminShell', () => {
  it('ist da — mit und ohne eigenen Hof, als Knopf von 44 px Höhe', () => {
    for (const hatHof of [true, false]) {
      const knopf = abmeldenKnopf(shell(hatHof))
      expect(knopf).toContain('type="button"')
      expect(knopf).toMatch(/\bmin-h-11\b/)
    }
  })

  it('am Handy öffnet die Plakette ein Menü: Der Auslöser trägt die Initialen und ist 44 px groß', () => {
    const html = shell(true)
    const ausloeser = html.match(/<button\b[^>]*aria-label="MM – Konto-Menü[^"]*"[^>]*>/)?.[0]
    expect(ausloeser, 'Auslöser des Menüs').toBeDefined()
    expect(ausloeser).toMatch(/\bsize-11\b/)
    expect(ausloeser).toMatch(/\bmd:hidden\b/)
    // Gegenprobe: Der Weg zu „Konto und Sicherheit" bleibt am Computer ein Link.
    expect(html).toContain(`href="${ADMIN_KONTO.href}"`)
  })

  it('führt nach dem Abmelden auf /login/admin', () => {
    expect(ADMIN_ABMELDEN.ziel).toBe('/login/admin')
    expect(ADMIN_ABMELDEN.ziel).toBe(ADMIN_PFAD.anmelden)
  })
})

describe('der Weg hinter „Abmelden" — derselbe wie in der HofShell', () => {
  it('Knopf am Computer: signOut, dann /login/admin und neu laden', async () => {
    await klick(AdminAbmeldenKnopf({}) as unknown as { props: Record<string, unknown> })()

    expect(signOut).toHaveBeenCalledTimes(1)
    expect(router.push).toHaveBeenCalledWith('/login/admin')
    expect(router.refresh).toHaveBeenCalledTimes(1)
    expect(toastFehler).not.toHaveBeenCalled()
  })

  it('Menü am Handy: derselbe Weg', async () => {
    const menue = AdminKontoMenue({ anzeige: 'Max Mustermann', hatHof: true })

    await klick(findeElement(menue, DropdownMenuItem))()

    expect(signOut).toHaveBeenCalledTimes(1)
    expect(router.push).toHaveBeenCalledWith('/login/admin')
  })

  it('Menü am Handy: „Konto und Sicherheit" nur mit eigenem Hof', () => {
    expect(findeElement(AdminKontoMenue({ anzeige: 'Max Mustermann', hatHof: true }), DropdownMenuLinkItem)).not.toBeNull()
    expect(findeElement(AdminKontoMenue({ anzeige: 'Max Mustermann', hatHof: false }), DropdownMenuLinkItem)).toBeNull()
  })

  it('scheitert das Abmelden, steht der Satz der HofShell da und es geht nirgends hin', async () => {
    signOut.mockResolvedValue({ error: { message: 'x' } })

    await klick(AdminAbmeldenKnopf({}) as unknown as { props: Record<string, unknown> })()

    expect(toastFehler).toHaveBeenCalledWith(ABMELDEN_FEHLGESCHLAGEN)
    expect(router.push).not.toHaveBeenCalled()
  })

  it('in der Vorschau unter /intern gilt der Ersatz und das echte Abmelden läuft nie', async () => {
    const ersatz = vi.fn()

    await klick(AdminAbmeldenKnopf({ ersatz }) as unknown as { props: Record<string, unknown> })()

    expect(ersatz).toHaveBeenCalledTimes(1)
    expect(signOut).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })
})

describe('Reiter der AdminShell: Trefferfläche', () => {
  /**
   * Höhe in px aus `h-[38px]` plus beidseitig `before:-inset-y-[4px]`. Das Pseudo-Element misst vom
   * Innenrand: Ein Rahmen (`border`, 1 px je Seite) gehört nicht zur Fläche und fehlt in der Rechnung.
   */
  function trefferhoehe(tag: string): number {
    const hoehe = Number(tag.match(/\bh-\[(\d+)px\]/)?.[1])
    const rand = Number(tag.match(/\bbefore:-inset-y-\[(\d+)px\]/)?.[1] ?? 0)
    const rahmen = /\sborder\s/.test(tag) ? 2 : 0
    return hoehe - rahmen + 2 * rand
  }

  it('jeder Reiter — der aktive wie die übrigen — trifft auf mindestens 44 px, sichtbar bleiben 38 px', () => {
    const nav = shell(true).match(/<nav aria-label="Admin-Bereiche"[\s\S]*?<\/nav>/)?.[0] ?? ''
    const reiter = [...nav.matchAll(/<a [^>]*>/g)].map((t) => t[0])
    expect(reiter.length).toBeGreaterThan(0)
    expect(reiter.some((tag) => tag.includes('aria-current'))).toBe(true)
    for (const tag of reiter) {
      expect(tag).toMatch(/\bh-\[38px\]/)
      expect(trefferhoehe(tag)).toBeGreaterThanOrEqual(44)
      // Die Fläche hängt an einem Pseudo-Element des Links — der Link muss ihr Bezug sein.
      expect(tag).toMatch(/\brelative\b/)
    }
  })

  it('Gegenprobe: ein Reiter ohne die Fläche bliebe bei 38 px, einer mit Rahmen und 3 px bei 42 px', () => {
    expect(trefferhoehe('<a class="flex h-[38px] items-center">')).toBe(38)
    expect(trefferhoehe('<a class="relative h-[38px] border before:-inset-y-[3px]">')).toBe(42)
  })
})
