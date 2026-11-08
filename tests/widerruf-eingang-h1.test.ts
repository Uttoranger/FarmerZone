/**
 * /widerruf nach dem Absenden mit genau einer h1 (Nr. 266, Lauf 33).
 *
 * Ursache: Nach dem Absenden blendet die Seite ihren Kopf mit der h1 „Rücktrittsrecht“ aus (Liste Lauf 32, Board
 * w3-widerruf Bild 4); die Überschrift der Eingangsbestätigung war ein h2 — die Seite stand ohne h1 da.
 *
 * Beweist auf Seitenebene (die Seite echt, das Formular echt mit einem kleinen Prüfstand für useState —
 * TESTING_GUIDELINES §1, Umgebung node):
 *  - Nach dem Absenden ist die Überschrift der Bestätigung (WIDERRUF_TEXT.eingangTitel) die einzige h1, die im
 *    Barrierebaum steht; sie bleibt das Fokus-Ziel (id, tabindex="-1").
 *  - Die h1 der Seite ist dann `display:none` (Tailwind `hidden` unter der Gruppen-Variante, deren Bedingung im
 *    gerenderten HTML erfüllt ist) — nicht nur unsichtbar (kein `invisible`, `opacity-0`, `sr-only`).
 *  - Gegenprobe vor dem Absenden: genau eine h1, die der Seite; nichts ausgeblendet.
 * Der Wortlaut kommt unverändert aus src/lib/widerruf.ts.
 */
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const stand = vi.hoisted(() => {
  const s = {
    zellen: [] as unknown[],
    zeiger: 0,
    laeufe: [] as Promise<unknown>[],
    /** Ein neuer Render beginnt: Die Aufrufstellen zählen wieder von vorn. */
    neuerRender: () => {
      s.zeiger = 0
    },
  }
  return s
})

vi.mock('react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react')>()
  return {
    ...echt,
    useState: (start: unknown) => {
      const i = stand.zeiger++
      if (!(i in stand.zellen)) stand.zellen[i] = typeof start === 'function' ? (start as () => unknown)() : start
      const setze = (wert: unknown) => {
        stand.zellen[i] = typeof wert === 'function' ? (wert as (v: unknown) => unknown)(stand.zellen[i]) : wert
      }
      return [stand.zellen[i], setze]
    },
    useRef: () => ({ current: null }),
    useTransition: () => [false, (lauf: () => unknown) => stand.laeufe.push(Promise.resolve(lauf()))],
  }
})
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/server/actions/widerruf', () => ({ reicheWiderrufMitLinkEin: vi.fn(), reicheWiderrufOhneLinkEin: vi.fn() }))
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({
  KundeShellMitSitzung: ({ children }: { children?: ReactNode }) => createElement('main', null, children),
}))

import { reicheWiderrufOhneLinkEin } from '@/server/actions/widerruf'
import { WiderrufFormular } from '@/app/(public)/widerruf/widerruf-formular'
import WiderrufPage from '@/app/(public)/widerruf/page'
import { WIDERRUF_TEXT } from '@/lib/widerruf'

const ereignis = { preventDefault: () => {} } as unknown as React.FormEvent

/** Das erste Element im Baum, auf das `passt` zutrifft — ohne zu rendern. */
function finde(knoten: unknown, passt: (e: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(knoten)) {
    for (const kind of knoten) {
      const fund = finde(kind, passt)
      if (fund) return fund
    }
    return null
  }
  if (!isValidElement<Record<string, unknown>>(knoten)) return null
  if (passt(knoten)) return knoten
  return finde(knoten.props.children, passt)
}

function textVon(knoten: unknown): string {
  if (typeof knoten === 'string' || typeof knoten === 'number') return String(knoten)
  if (Array.isArray(knoten)) return knoten.map(textVon).join('')
  return isValidElement<{ children?: unknown }>(knoten) ? textVon(knoten.props.children) : ''
}

async function seite(): Promise<string> {
  stand.neuerRender()
  return renderToStaticMarkup(await WiderrufPage({ searchParams: Promise.resolve({}) }))
}

/** Die Bestätigung im gerenderten HTML (React schreibt das leere Attribut als `=""`). */
const EINGANG = /<section data-widerruf-eingegangen[ =>]/

/** Die Klassen, die ein Element aus dem Barrierebaum nehmen müssten, aber es nur unsichtbar machen. */
const NUR_UNSICHTBAR = /(^|\s|:)(invisible|opacity-0|sr-only)(\s|$)/

/**
 * Die h1, die im Barrierebaum stehen: ohne die h1 in einem Element, das per Gruppen-Variante `display:none` wird,
 * sobald die Gruppe ein `[data-widerruf-eingegangen]` enthält — und nur, wenn das gerenderte HTML die Bedingung erfüllt.
 */
function h1ImBarrierebaum(html: string): string[] {
  const eingegangen = EINGANG.test(html) && /class="[^"]*\bgroup\/widerruf\b/.test(html)
  const kopf = /<div class="([^"]*)"><h1[^>]*>[^<]*<\/h1>/.exec(html)
  const kopfAus = eingegangen && (kopf?.[1] ?? '').split(/\s+/).includes('group-has-[[data-widerruf-eingegangen]]/widerruf:hidden')
  const alle = [...html.matchAll(/<h1([^>]*)>([^<]*)<\/h1>/g)]
  return alle.filter((h) => !(kopfAus && kopf && html.indexOf(h[0]) === kopf.index + kopf[0].indexOf('<h1'))).map((h) => h[2] ?? '')
}

beforeEach(() => {
  stand.zellen = []
  stand.laeufe = []
  vi.clearAllMocks()
  vi.stubGlobal('requestAnimationFrame', (rueckruf: () => void) => rueckruf())
})

describe('/widerruf: genau eine h1', () => {
  it('Gegenprobe vor dem Absenden: die h1 der Seite, nichts ausgeblendet', async () => {
    const html = await seite()
    expect(h1ImBarrierebaum(html)).toEqual([WIDERRUF_TEXT.titel])
    expect(html).not.toMatch(EINGANG)
  })

  it('nach dem Absenden: die Überschrift der Bestätigung ist die einzige h1 im Barrierebaum und bleibt Fokus-Ziel', async () => {
    vi.mocked(reicheWiderrufOhneLinkEin).mockResolvedValue({ ok: true, eingegangenAm: '2027-03-03T18:40:00.000Z' })

    // Schritt 1: „Vertrag widerrufen“ (das Formular schickt ab).
    stand.neuerRender()
    const eingabe = WiderrufFormular({ bestellung: null }) as ReactElement<{ onSubmit: (e: React.FormEvent) => void }>
    eingabe.props.onSubmit(ereignis)

    // Schritt 2: „Widerruf bestätigen“.
    stand.neuerRender()
    const pruefung = WiderrufFormular({ bestellung: null })
    const knopf = finde(pruefung, (e) => e.type === 'button' && textVon(e.props.children).includes(WIDERRUF_TEXT.knopfBestaetigen))
    expect(knopf).not.toBeNull()
    ;(knopf!.props.onClick as () => void)()
    await Promise.all(stand.laeufe.splice(0))
    expect(reicheWiderrufOhneLinkEin).toHaveBeenCalledTimes(1)

    const html = await seite()
    expect(html).toMatch(EINGANG)
    expect(h1ImBarrierebaum(html)).toEqual([WIDERRUF_TEXT.eingangTitel])
    // Fokus-Ziel nach dem Absenden: dieselbe Überschrift.
    expect(html).toMatch(new RegExp(`<h1 id="widerruf-kopf" tabindex="-1"[^>]*>${WIDERRUF_TEXT.eingangTitel}</h1>`))
  })

  it('die h1 der Seite wird nach dem Absenden display:none, nicht nur unsichtbar', async () => {
    const html = await seite()
    const kopf = /<div class="([^"]*)"><h1[^>]*>([^<]*)<\/h1>/.exec(html)
    expect(kopf?.[2]).toBe(WIDERRUF_TEXT.titel)
    const klassen = kopf?.[1] ?? ''
    // Tailwind `hidden` = display:none — nimmt das Element mit allen Kindern aus dem Barrierebaum.
    expect(klassen.split(/\s+/)).toContain('group-has-[[data-widerruf-eingegangen]]/widerruf:hidden')
    expect(klassen).not.toMatch(NUR_UNSICHTBAR)
    expect(html).toMatch(/<div class="group\/widerruf /)
  })
})
