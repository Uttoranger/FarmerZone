/**
 * Postfach ruhig durchklicken (Register N14, Ergänzung; Nachtlauf Nr. 105;
 * Mockup admin-postfach-ruhig) — gerendert ohne DOM (TESTING_GUIDELINES §1).
 *
 * Beweist:
 *  - Auf allen vier Reitern folgen auf den Kopf (EIN Satz) sofort die
 *    Unterreiter, dann der Inhalt — nichts dazwischen, was die Reiter
 *    verschieben könnte. Die Kennzahlen bekommt nur der Eingang (unter den
 *    Reitern), Rundschreiben und Zustellung laden sie gar nicht erst.
 *  - `Unterreiter` setzt `scroll={false}` (abschaltbar), `FilterChip` reicht
 *    `scroll` nur weiter, wenn es jemand angibt (Standard wie bisher).
 *  - Der Ladepunkt steht nur im ladenden Link, `aria-hidden`.
 * Die Reiter selbst sind ersetzte Teilkomponenten (Merkmal `data-reiter`) —
 * geprüft wird die Seite, nicht ihr Inhalt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ComponentProps, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const link = vi.hoisted(() => ({ pending: false }))
vi.mock('next/link', () => ({
  // `scroll` ist eine Angabe für Next — hier als Merkmal sichtbar gemacht.
  default: ({ href, children, scroll, ...rest }: { href: string; children?: ReactNode; scroll?: boolean } & Record<string, unknown>) =>
    createElement(
      'a',
      { href, 'data-scroll': scroll === undefined ? 'standard' : String(scroll), ...Object.fromEntries(Object.entries(rest).filter(([k]) => k !== 'onNavigate' && k !== 'prefetch')) },
      children
    ),
  useLinkStatus: () => ({ pending: link.pending }),
}))
vi.mock('next/navigation', () => ({ permanentRedirect: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/server/admin-wache', () => ({ verlangeAdminSeite: vi.fn(async () => undefined) }))
vi.mock('@/server/queries/postfach', () => ({
  zaehleOffenImEingang: vi.fn(async () => ({ antworten: 1, meldungen: 0, hoefe: 1, erstattungen: 0 })),
  ladeErstattungAufgaben: vi.fn(async () => []),
  zaehleRundschreibenImMonat: vi.fn(async () => 1),
}))
vi.mock('@/app/admin/postfach/eingang-reiter', () => ({
  ladeEingangReiter: vi.fn(async () => ({})),
  EingangReiter: ({ kennzahlen }: { kennzahlen: unknown[] | null }) => createElement('div', { 'data-reiter': 'eingang', 'data-kennzahlen': kennzahlen ? kennzahlen.length : 'keine' }),
}))
vi.mock('@/app/admin/postfach/meldungen-reiter', () => ({
  ladeMeldungenReiter: vi.fn(async () => ({})),
  MeldungenReiter: () => createElement('div', { 'data-reiter': 'meldungen' }),
}))
vi.mock('@/app/admin/postfach/rundschreiben-reiter', () => ({
  ladeRundschreibenReiter: vi.fn(async () => ({})),
  RundschreibenReiter: () => createElement('div', { 'data-reiter': 'rundschreiben' }),
}))
vi.mock('@/app/admin/postfach/zustellung-reiter', () => ({
  ladeZustellungDaten: vi.fn(async () => ({})),
  ZustellungReiter: () => createElement('div', { 'data-reiter': 'zustellung' }),
}))

import AdminPostfachPage from '@/app/admin/postfach/page'
import { ladeErstattungAufgaben } from '@/server/queries/postfach'
import { ADMIN_POSTFACH_TEXT, ADMIN_POSTFACH_REITER_IDS, EINGANG_TEXT } from '@/lib/postfach'
import { Unterreiter } from '@/components/admin/unterreiter'
import { FilterChip } from '@/components/ui/chip'
import type { UnterreiterDaten } from '@/lib/admin-seiten'

async function rendereSeite(reiter: string): Promise<string> {
  return renderToStaticMarkup(await AdminPostfachPage({ searchParams: Promise.resolve({ reiter }) }))
}

const NAV = `<nav aria-label="${EINGANG_TEXT.unterreiterBeschriftung}"`

beforeEach(() => {
  vi.clearAllMocks()
  link.pending = false
})

describe('Postfach: Kopf und Reiter stehen auf allen vier Reitern gleich', () => {
  it.each(ADMIN_POSTFACH_REITER_IDS)('Reiter %s: Kopf mit dem einen Satz, sofort die Unterreiter, dann der Inhalt', async (reiter) => {
    const html = await rendereSeite(reiter)

    expect(html).toContain(ADMIN_POSTFACH_TEXT.satz)
    // Zwischen dem Ende des Kopfs (Hauptaktion rechts) und den Unterreitern stehen nur schließende Tags.
    expect(html).toMatch(new RegExp(`${EINGANG_TEXT.hauptaktion}</a>(?:</div>|</header>)*${NAV}`))
    // Direkt nach den Unterreitern der Inhalt — und darin zuerst der Reiter.
    expect(html).toMatch(new RegExp(`</nav><div data-slot="lade-inhalt"><div data-reiter="${reiter}"`))
    expect(html.match(/<h1/g)).toHaveLength(1)
  })

  it('die Kennzahlen gehören zum Eingang — Rundschreiben und Zustellung laden sie nicht', async () => {
    expect(await rendereSeite('eingang')).toContain('data-kennzahlen="3"')
    expect(ladeErstattungAufgaben).toHaveBeenCalledTimes(1)

    vi.clearAllMocks()
    for (const reiter of ['meldungen', 'rundschreiben', 'zustellung']) {
      const html = await rendereSeite(reiter)
      expect(html).not.toContain(EINGANG_TEXT.kennzahlenBeschriftung)
      // Die Zahl am Unterreiter „Eingang" steht trotzdem da.
      expect(html).toMatch(/Eingang<span[^>]*>2<\/span>/)
    }
    expect(ladeErstattungAufgaben).not.toHaveBeenCalled()
  })

  it('ohne laufenden Wechsel trägt nichts aria-busy und kein Ladepunkt steht da', async () => {
    const html = await rendereSeite('eingang')
    expect(html).not.toContain('aria-busy')
    expect(html).not.toContain('data-slot="lade-punkt"')
  })
})

/** Ein Chip mit dem Text als Kind (nicht als Prop). */
function chip(props: Omit<ComponentProps<typeof FilterChip>, 'children'>, text = 'Alle'): string {
  return renderToStaticMarkup(createElement(FilterChip, props as ComponentProps<typeof FilterChip>, text))
}

const EINTRAEGE: UnterreiterDaten[] = [
  { id: 'eins', label: 'Eins', href: '/a' },
  { id: 'zwei', label: 'Zwei', href: '/a?reiter=zwei' },
]

describe('Kein Sprung nach oben', () => {
  it('Unterreiter setzt scroll={false} an jedem Link — abschaltbar', () => {
    const still = renderToStaticMarkup(createElement(Unterreiter, { beschriftung: 'Bereiche', eintraege: EINTRAEGE, aktiv: 'eins' }))
    expect(still.match(/data-scroll="false"/g)).toHaveLength(2)
    expect(still).not.toMatch(/data-scroll="(true|standard)"/)

    const mitSprung = renderToStaticMarkup(createElement(Unterreiter, { beschriftung: 'Bereiche', eintraege: EINTRAEGE, aktiv: 'eins', scroll: true }))
    expect(mitSprung.match(/data-scroll="true"/g)).toHaveLength(2)
  })

  it('FilterChip bleibt beim Standard von Next, solange niemand scroll angibt', () => {
    expect(chip({ href: '/x' })).toContain('data-scroll="standard"')
    expect(chip({ href: '/x', scroll: false })).toContain('data-scroll="false"')
  })
})

describe('Ladepunkt', () => {
  it('steht im ladenden Link, ohne Platz zu nehmen und für Screenreader verborgen — nur wo die Seite ihn will', () => {
    link.pending = true
    const mit = chip({ href: '/x', ladePunkt: true }, 'Antwort')
    expect(mit).toMatch(/<span aria-hidden="true" data-slot="lade-punkt" class="[^"]*\babsolute\b/)
    // Gegenprobe: ohne ladePunkt (alle übrigen Seiten) nie, auch wenn der Link lädt.
    expect(chip({ href: '/x' }, 'Antwort')).not.toContain('lade-punkt')
    link.pending = false
    expect(chip({ href: '/x', ladePunkt: true }, 'Antwort')).not.toContain('lade-punkt')
  })
})
