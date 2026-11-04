/**
 * „Abmelden" im Admin-Bereich (Register N20, Nr. 126; Nacharbeit zu Nr. 115)
 * und die Tippflächen der Reiter.
 *
 * Die AdminShell hatte keinen Knopf dafür: Wer den Bereich verlässt, sollte
 * die Sitzung beenden können, ohne über den Hofbereich zu gehen — und ein
 * Betreiber ohne Hof hatte gar keinen Weg.
 *
 * Beweist:
 *  - Die Plakette öffnet in jeder Breite ein Menü (seit Nr. 220, Boards
 *    s3-/w3-admin-shell Bild 4) mit „Angemeldet als …“, „Abmelden" und mit Hof
 *    „Konto und Sicherheit" — mit und ohne eigenen Hof; der Auslöser ist 44 px.
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
import { AdminKontoMenue } from '@/components/shells/admin-konto'
import { DropdownMenuItem, DropdownMenuLinkItem } from '@/components/ui/dropdown-menu'
import { ABMELDEN_FEHLGESCHLAGEN } from '@/lib/abmelden'
import { ADMIN_ABMELDEN, ADMIN_MEHR_TEXT } from '@/lib/admin-navigation'
import { ADMIN_PFAD } from '@/lib/admin-anmeldung'
import { findeElement } from './element-suche'

const INHALT = createElement('p', null, 'Inhalt der Seite')

function shell(hatHof: boolean): string {
  const typ = AdminShell as unknown as ComponentType<Record<string, unknown>>
  return renderToStaticMarkup(createElement(typ, { personName: 'Max Mustermann', hatHof }, INHALT))
}

/** Das Menü der Plakette als Baum (es liegt im Portal und steht im Server-HTML nur offen). */
function menue(hatHof: boolean, ersatz?: () => void) {
  return AdminKontoMenue({ anzeige: 'Max Mustermann', hatHof, ersatz })
}

/** Der Text eines Elements im Baum, flach. */
function text(knoten: unknown): string {
  if (typeof knoten === 'string' || typeof knoten === 'number') return String(knoten)
  if (Array.isArray(knoten)) return knoten.map(text).join('')
  if (knoten && typeof knoten === 'object' && 'props' in knoten) return text((knoten as { props: { children?: unknown } }).props.children)
  return ''
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
  it('ist da — mit und ohne eigenen Hof, als Eintrag im Menü der Plakette (Einträge 44 px im Baustein)', () => {
    for (const hatHof of [true, false]) {
      expect(text(findeElement(menue(hatHof), DropdownMenuItem))).toContain(ADMIN_ABMELDEN.label)
    }
  })

  it('die Plakette öffnet in jeder Breite das Menü: Auslöser mit den Initialen, 44 px, nie ausgeblendet (Nr. 220)', () => {
    for (const hatHof of [true, false]) {
      const html = shell(hatHof)
      const ausloeser = html.match(/<button\b[^>]*aria-label="MM – Konto-Menü[^"]*"[^>]*>/g) ?? []
      expect(ausloeser, 'genau ein Auslöser').toHaveLength(1)
      expect(ausloeser[0]).toMatch(/\bsize-11\b/)
      expect(ausloeser[0]).not.toMatch(/\b(?:md|lg|max-md):hidden\b|\bhidden\b/)
      // Kein zweiter Knopf „Abmelden“ neben der Plakette mehr (vorher ab 768 px).
      expect(html).not.toMatch(/<button\b[^>]*title="Abmelden"/)
    }
  })

  it('oben im Menü steht, wer angemeldet ist', () => {
    const baum = text(menue(false))
    expect(baum).toContain(ADMIN_MEHR_TEXT.angemeldetAls)
    expect(baum).toContain('Max Mustermann')
  })

  it('führt nach dem Abmelden auf /login/admin', () => {
    expect(ADMIN_ABMELDEN.ziel).toBe('/login/admin')
    expect(ADMIN_ABMELDEN.ziel).toBe(ADMIN_PFAD.anmelden)
  })
})

describe('der Weg hinter „Abmelden" — derselbe wie in der HofShell', () => {
  it('Menü der Plakette: signOut, dann /login/admin und neu laden', async () => {
    await klick(findeElement(menue(true), DropdownMenuItem))()

    expect(signOut).toHaveBeenCalledTimes(1)
    expect(router.push).toHaveBeenCalledWith('/login/admin')
    expect(router.refresh).toHaveBeenCalledTimes(1)
    expect(toastFehler).not.toHaveBeenCalled()
  })

  it('Menü der Plakette: „Konto und Sicherheit" nur mit eigenem Hof', () => {
    expect(findeElement(AdminKontoMenue({ anzeige: 'Max Mustermann', hatHof: true }), DropdownMenuLinkItem)).not.toBeNull()
    expect(findeElement(AdminKontoMenue({ anzeige: 'Max Mustermann', hatHof: false }), DropdownMenuLinkItem)).toBeNull()
  })

  it('scheitert das Abmelden, steht der Satz der HofShell da und es geht nirgends hin', async () => {
    signOut.mockResolvedValue({ error: { message: 'x' } })

    await klick(findeElement(menue(false), DropdownMenuItem))()

    expect(toastFehler).toHaveBeenCalledWith(ABMELDEN_FEHLGESCHLAGEN)
    expect(router.push).not.toHaveBeenCalled()
  })

  it('in der Vorschau unter /intern gilt der Ersatz und das echte Abmelden läuft nie', async () => {
    const ersatz = vi.fn()

    await klick(findeElement(menue(false, ersatz), DropdownMenuItem))()

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
