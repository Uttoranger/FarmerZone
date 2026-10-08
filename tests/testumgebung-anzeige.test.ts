/**
 * Testumgebung in der Oberfläche (Register Z3, Nachtlauf Nr. 43) — gerendert
 * mit renderToStaticMarkup.
 *
 * Beweist:
 *  - AdminShell: Marke „Stripe Live"/„Stripe Test" und der Link „Zur
 *    Testumgebung" — nur mit Marke bzw. Adresse; ohne beides keine Leiste.
 *  - Umgebungsbanner: „Zur echten Seite" nur in der Vorschau; lokal steht das
 *    Banner ohne Link, in der Produktion gibt es keines.
 *  - Verdrahtung: Marke und Adresse entstehen in umgebung-server.ts aus
 *    bestimmeUmgebung und gehen als Props an die Shell; die Shell liest nichts selbst.
 *
 * Jede Prüfung hat ihre Gegenprobe aus derselben Komponente.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ComponentType, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bestimmeUmgebung, PRODUKTION_ADRESSE, type Umgebung } from '@/lib/umgebung'

const zustand = vi.hoisted(() => ({ umgebung: null as Umgebung | null }))

vi.mock('next/navigation', () => ({ usePathname: () => '/admin' }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/lib/umgebung-server', () => ({
  get UMGEBUNG() {
    return zustand.umgebung
  },
  get ZEIGE_UMGEBUNGSBANNER() {
    return zustand.umgebung?.art !== 'produktion'
  },
  meldeUmgebungsWarnungen: () => undefined,
}))

import { AdminShell, type AdminShellProps } from '@/components/shells/admin-shell'
import { UmgebungsBanner, UmgebungsBannerLink } from '@/components/shared/umgebungs-banner'
import { ADMIN_TESTUMGEBUNG } from '@/lib/admin-navigation'
import { STRIPE_MARKE_TEXT, ZUR_ECHTEN_SEITE } from '@/lib/testumgebung'

const WURZEL = process.cwd()
const quelle = (datei: string): string => readFileSync(join(WURZEL, datei), 'utf8')
const ohneKommentare = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const TESTUMGEBUNG = 'https://test.farmerzone.example'

afterEach(() => {
  zustand.umgebung = null
  vi.unstubAllEnvs()
})

// ─── AdminShell ──────────────────────────────────────────────────────────────

describe('AdminShell: Marke und Link zur Testumgebung', () => {
  const shell = (props: Partial<AdminShellProps>) =>
    renderToStaticMarkup(
      createElement(
        AdminShell as unknown as ComponentType<Omit<AdminShellProps, 'children'>>,
        { personName: 'Max Mustermann', ...props },
        createElement('p', null, 'Inhalt der Seite')
      )
    )

  it('zeigt „Stripe Test" als orange Marke', () => {
    const html = shell({ stripeMarke: { text: STRIPE_MARKE_TEXT.test, ton: 'offen' } })
    expect(html).toMatch(/data-status="offen"[^>]*><span[^>]*>Stripe Test<\/span>/)
  })

  it('zeigt „Stripe Live" als grüne Marke', () => {
    const html = shell({ stripeMarke: { text: STRIPE_MARKE_TEXT.live, ton: 'fertig' } })
    expect(html).toMatch(/data-status="fertig"[^>]*><span[^>]*>Stripe Live<\/span>/)
  })

  it('verlinkt „Zur Testumgebung" auf die Adresse aus der Variable', () => {
    const html = shell({ stripeMarke: { text: STRIPE_MARKE_TEXT.test, ton: 'offen' }, testumgebungUrl: TESTUMGEBUNG })
    const link = html.slice(html.indexOf(`<a href="${TESTUMGEBUNG}"`))
    expect(link.slice(0, link.indexOf('</a>'))).toContain(ADMIN_TESTUMGEBUNG.label)
    expect(html).toContain('lucide-flask-conical')
  })

  it('Gegenprobe: ohne Variable kein Link — die Marke bleibt', () => {
    const html = shell({ stripeMarke: { text: STRIPE_MARKE_TEXT.test, ton: 'offen' }, testumgebungUrl: null })
    expect(html).not.toContain(ADMIN_TESTUMGEBUNG.label)
    expect(html).not.toContain('lucide-flask-conical')
    expect(html).toContain('Stripe Test')
  })

  it('Gegenprobe: ohne Marke und ohne Adresse weder Marke noch Link — die Shell ist da', () => {
    const html = shell({})
    expect(html).not.toContain('Stripe Test')
    expect(html).not.toContain('Stripe Live')
    expect(html).not.toContain(ADMIN_TESTUMGEBUNG.label)
    expect(html).toContain('Inhalt der Seite')
    expect(html).toContain('Admin-Bereiche')
  })

  it('der Link bleibt im selben Tab — wie jeder Weg der Shell', () => {
    const html = shell({ testumgebungUrl: TESTUMGEBUNG })
    const start = html.indexOf(`<a href="${TESTUMGEBUNG}"`)
    expect(start).toBeGreaterThan(-1)
    expect(html.slice(start, html.indexOf('>', start))).not.toContain('target=')
  })
})

// ─── Umgebungsbanner ─────────────────────────────────────────────────────────

describe('Umgebungsbanner: „Zur echten Seite"', () => {
  /** Balken und Link, wie das Root-Layout sie rendert (der Link am Ende von <body>). */
  const banner = (umgebung: Umgebung): { balken: string; link: string } => {
    zustand.umgebung = umgebung
    const balken = UmgebungsBanner()
    const link = UmgebungsBannerLink()
    return {
      balken: balken ? renderToStaticMarkup(balken) : '',
      link: link ? renderToStaticMarkup(link) : '',
    }
  }
  const VORSCHAU = bestimmeUmgebung({
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_REF: 'staging',
    VERCEL_BRANCH_URL: 'farmer-zone-git-staging-team.vercel.app',
    NEXT_PUBLIC_APP_URL: TESTUMGEBUNG,
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/farmerzone',
    STRIPE_SECRET_KEY: 'sk_test_x',
  })

  it('steht in der Vorschau beim Balken und führt auf die echte Seite', () => {
    const { balken, link } = banner(VORSCHAU)
    expect(balken).toContain('Stripe Test')
    expect(link).toContain(`<a href="${PRODUKTION_ADRESSE}"`)
    expect(link).toContain(ZUR_ECHTEN_SEITE.text)
  })

  it('Gegenprobe: lokal steht der Balken ohne Link', () => {
    const { balken, link } = banner(bestimmeUmgebung({ NODE_ENV: 'development', STRIPE_SECRET_KEY: 'sk_test_x' }))
    expect(balken).toContain('TESTUMGEBUNG')
    expect(balken).not.toContain('<a ')
    expect(link).toBe('')
  })

  it('Gegenprobe: in der Produktion gibt es weder Balken noch Link', () => {
    expect(banner(bestimmeUmgebung({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://farmerzone.example' }))).toEqual({
      balken: '',
      link: '',
    })
  })

  // Der Balken hat feste Farben (Absperrband) — der Fokusring der Tokens wäre
  // auf Bernstein kaum zu sehen. Deshalb Rahmen in der Schriftfarbe, mit Rahmenart
  // (tests/fokus-sichtbar.test.ts: ohne outline-solid bliebe er unsichtbar).
  it('der Link zeigt den Fokus sichtbar in der Schriftfarbe des Balkens und bleibt im selben Tab', () => {
    const { link } = banner(VORSCHAU)
    expect(link).toContain('focus-visible:outline-solid')
    expect(link).toContain('focus-visible:outline-current')
    expect(link).not.toContain('target=')
  })

  // DESIGN_SYSTEM.md, Ausnahme „Absperrband": feste Farben an EINER Stelle, Balken und Link nehmen sie von dort.
  it('die Farben des Absperrbands stehen genau einmal im Banner — Balken und Link teilen sie', () => {
    const banner = ohneKommentare(quelle('src/components/shared/umgebungs-banner.tsx'))
    for (const farbe of ['bg-amber-400', 'text-stone-900', 'bg-red-700', 'text-white']) {
      expect(banner.split(farbe).length - 1, farbe).toBe(1)
    }
    expect(banner).toMatch(/ABSPERRBAND/)
  })

  it('Gegenprobe: der Link trägt die Schriftfarbe des Bands, der Balken Fläche und Schrift', () => {
    const { balken, link } = banner(VORSCHAU)
    expect(balken).toContain('bg-amber-400')
    expect(balken).toContain('text-stone-900')
    expect(link).toContain('text-stone-900')
    expect(link).not.toContain('bg-amber-400')
  })

  it('das Root-Layout setzt den Link hinter die Seite — „Zum Inhalt springen" bleibt der erste Link', () => {
    const layout = ohneKommentare(quelle('src/app/layout.tsx'))
    const balken = layout.indexOf('<UmgebungsBanner />')
    const seite = layout.indexOf('{children}')
    const link = layout.indexOf('<UmgebungsBannerLink />')
    expect(balken).toBeGreaterThan(-1)
    expect(seite).toBeGreaterThan(balken)
    expect(link).toBeGreaterThan(seite)
  })
})

// ─── Verdrahtung ─────────────────────────────────────────────────────────────

describe('Marke und Adresse entstehen auf dem Server', () => {
  async function serverWerte(werte: Record<string, string | undefined>, nodeEnv = 'production') {
    vi.resetModules()
    vi.doUnmock('@/lib/umgebung-server')
    vi.doMock('@/lib/env', () => ({ env: werte }))
    vi.stubEnv('NODE_ENV', nodeEnv)
    const { STRIPE_MARKE, TESTUMGEBUNG_URL } = await import('@/lib/umgebung-server')
    return { STRIPE_MARKE, TESTUMGEBUNG_URL }
  }

  it('Produktion mit Live-Schlüssel und Variable: „Stripe Live" und der Link', async () => {
    const w = await serverWerte({
      VERCEL_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'https://farmerzone.example',
      STRIPE_SECRET_KEY: 'sk_live_erfunden',
      NEXT_PUBLIC_TESTUMGEBUNG_URL: TESTUMGEBUNG,
    })
    expect(w.STRIPE_MARKE).toEqual({ text: 'Stripe Live', ton: 'fertig' })
    expect(w.TESTUMGEBUNG_URL).toBe(TESTUMGEBUNG)
  })

  it('Produktion im Testbetrieb ohne Variable: „Stripe Test", kein Link', async () => {
    const w = await serverWerte({ VERCEL_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://farmerzone.example', STRIPE_SECRET_KEY: 'sk_test_erfunden' })
    expect(w.STRIPE_MARKE).toEqual({ text: 'Stripe Test', ton: 'offen' })
    expect(w.TESTUMGEBUNG_URL).toBeNull()
  })

  it('das Admin-Layout reicht beides als Prop an die Shell, die Shell liest nichts selbst', () => {
    const layout = quelle('src/app/admin/layout.tsx')
    expect(layout).toContain('stripeMarke={STRIPE_MARKE}')
    expect(layout).toContain('testumgebungUrl={TESTUMGEBUNG_URL}')
    expect(quelle('src/lib/umgebung-server.ts')).toContain('stripeMarke(UMGEBUNG)')
    expect(quelle('src/lib/umgebung-server.ts')).toContain('NEXT_PUBLIC_TESTUMGEBUNG_URL: env.NEXT_PUBLIC_TESTUMGEBUNG_URL')
    // Ohne Kommentare: Die dürfen erzählen, woher ein Wert kommt.
    const shellQuelle = ohneKommentare(quelle('src/components/shells/admin-shell.tsx'))
    expect(shellQuelle).not.toMatch(/umgebung-server|process\.env|NEXT_PUBLIC_TESTUMGEBUNG_URL/)
    // Gegenprobe: Die Suche schlägt an, wo die Variable tatsächlich gelesen wird.
    expect(quelle('src/lib/umgebung-server.ts')).toMatch(/NEXT_PUBLIC_TESTUMGEBUNG_URL/)
  })
})
