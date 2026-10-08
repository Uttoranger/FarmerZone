/**
 * Testbetrieb und „Online-Zahlung neu einrichten" in der Oberfläche
 * (Register Z2, Nachtlauf Nr. 42) — gerendert mit renderToStaticMarkup.
 *
 * Beweist:
 *  - Kasse: Der Satz steht an „Online bezahlen", nur im Testbetrieb; „Bar bei
 *    Abholung" bleibt wählbar.
 *  - AdminShell: die orange Karte über jeder Admin-Seite, nur im Testbetrieb.
 *  - Einstellungen → Zahlung: der Satz in der Karte „Online-Zahlung
 *    (Stripe)", nur im Testbetrieb; mit `?stripe=neu` und gespeichertem,
 *    nicht bereitem Konto „Online-Zahlung neu einrichten" (Karte, Marke, Knopf).
 *  - Verdrahtung: TESTBETRIEB entsteht aus bestimmeUmgebung (Produktion mit
 *    sk_test_ ja; Live, Vorschau, lokal nein); die drei Server-Stellen reichen
 *    nur den Wahrheitswert weiter, keine Client-Komponente liest die Umgebung.
 *
 * Jede Prüfung hat ihre Gegenprobe aus derselben Komponente: Das Merkmal
 * fehlt ohne Testbetrieb, und die Seite selbst ist in beiden Fällen da.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ComponentType, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const zustand = vi.hoisted(() => ({ testbetrieb: false }))

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn(async () => ({ user: { id: 'user_1' } })) } } }))
vi.mock('@/lib/prisma', () => ({ prisma: { farm: { findUnique: vi.fn() } } }))
vi.mock('@/lib/umgebung-server', () => ({
  get TESTBETRIEB() {
    return zustand.testbetrieb
  },
}))
vi.mock('@/server/actions/stripe-connect', () => ({
  createConnectAccount: vi.fn(),
  createOnboardingLink: vi.fn(),
  checkConnectStatus: vi.fn(),
  schalteOnlineZahlungEin: vi.fn(),
}))

import type { UseFormRegisterReturn } from 'react-hook-form'
import { prisma } from '@/lib/prisma'
import { ZahlartWahl } from '@/components/checkout/kasse-teile'
import { AdminShell, type AdminShellProps } from '@/components/shells/admin-shell'
import PaymentsPage from '@/app/(hof)/settings/payments/page'
import { kassenZahlarten } from '@/lib/kasse'
import { TESTBETRIEB_TEXT } from '@/lib/stripe-modus'
import { NEU_EINRICHTEN_MARKE, NEU_EINRICHTEN_SATZ, NEU_EINRICHTEN_TITEL } from '@/lib/stripe-konto'

const WURZEL = process.cwd()
const quelle = (datei: string): string => readFileSync(join(WURZEL, datei), 'utf8')
const ohneKommentare = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
/** Ein Import der Server-Umgebung oder ein direkter Griff in die Variablen. */
const LIEST_UMGEBUNG = /from '@\/lib\/umgebung-server'|STRIPE_SECRET_KEY|process\.env/
/** renderToStaticMarkup schreibt Anführungszeichen als Entität — so steht der Satz im HTML. */
const imHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

const HOF = { acceptsOnline: true, stripeAccountReady: true, acceptsOnsite: true }
const FELD = {
  name: 'paymentMethod',
  onChange: async () => undefined,
  onBlur: async () => undefined,
  ref: () => undefined,
} as unknown as UseFormRegisterReturn<'paymentMethod'>

beforeEach(() => {
  zustand.testbetrieb = false
  vi.mocked(prisma.farm.findUnique).mockResolvedValue({
    stripeAccountId: 'acct_erfunden',
    stripeAccountReady: true,
    acceptsOnline: true,
  } as never)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ─── Kasse ───────────────────────────────────────────────────────────────────

describe('Kasse: Satz an „Online bezahlen"', () => {
  const zahlart = (testbetrieb: boolean) =>
    renderToStaticMarkup(createElement(ZahlartWahl, { zahlarten: kassenZahlarten(HOF, false, { testbetrieb }), feld: FELD }))

  it('im Testbetrieb steht der Satz an der Zahlart — Bar bleibt wählbar', () => {
    const html = zahlart(true)
    expect(html).toContain(TESTBETRIEB_TEXT.kasse)
    expect(html).toContain('Bar bei Abholung')
    expect(html.match(/type="radio"/g)).toHaveLength(2)
  })

  it('der Satz steht im Label von „Online bezahlen", nicht bei Bar', () => {
    const zeilen = zahlart(true).split('<label').slice(1)
    const online = zeilen.find((z) => z.includes('>Online bezahlen</span>'))
    const bar = zeilen.find((z) => z.includes('>Bar bei Abholung</span>'))
    expect(online).toContain(TESTBETRIEB_TEXT.kasse)
    expect(bar).toBeDefined()
    expect(bar).not.toContain(TESTBETRIEB_TEXT.kasse)
  })

  it('Gegenprobe: ohne Testbetrieb kein Satz — die Zahlarten stehen trotzdem da', () => {
    const html = zahlart(false)
    expect(html).not.toContain(TESTBETRIEB_TEXT.kasse)
    expect(html).toContain('Online bezahlen')
  })
})

// ─── AdminShell ──────────────────────────────────────────────────────────────

describe('AdminShell: orange Karte im Testbetrieb', () => {
  const shell = (testbetrieb: boolean) =>
    renderToStaticMarkup(
      // Der Inhalt als drittes Argument — ohne dass TypeScript `children` in den Props verlangt (wie tests/shells.test.ts).
      createElement(
        AdminShell as unknown as ComponentType<Omit<AdminShellProps, 'children'>>,
        { personName: 'Max Mustermann', testbetrieb },
        createElement('p', null, 'Inhalt der Seite')
      )
    )

  it('im Testbetrieb steht die Karte über dem Inhalt', () => {
    const html = shell(true)
    expect(html).toContain(TESTBETRIEB_TEXT.admin)
    expect(html).toContain('data-ton="orange"')
    expect(html.indexOf(TESTBETRIEB_TEXT.admin)).toBeLessThan(html.indexOf('Inhalt der Seite'))
  })

  it('Gegenprobe: ohne Testbetrieb (Live-Schlüssel) keine Karte, die Shell ist da', () => {
    const html = shell(false)
    expect(html).not.toContain(TESTBETRIEB_TEXT.admin)
    expect(html).toContain('Inhalt der Seite')
    expect(html).toContain('Admin-Bereiche')
  })
})

// ─── Einstellungen → Zahlung ─────────────────────────────────────────────────

async function zahlungsSeite(stripe?: string): Promise<string> {
  const seite = await PaymentsPage({ searchParams: Promise.resolve(stripe ? { stripe } : {}) })
  return seite ? renderToStaticMarkup(seite) : ''
}

describe('Einstellungen → Zahlung: Satz zum Testbetrieb', () => {
  it('im Testbetrieb steht der Satz in der Karte „Online-Zahlung (Stripe)"', async () => {
    zustand.testbetrieb = true
    const html = await zahlungsSeite()
    expect(html).toContain(TESTBETRIEB_TEXT.zahlung)
    const karte = html.slice(html.indexOf('Online-Zahlung (Stripe)'), html.indexOf('Bar bei Abholung'))
    expect(karte).toContain(TESTBETRIEB_TEXT.zahlung)
  })

  it('Gegenprobe: ohne Testbetrieb kein Satz — die Seite ist da', async () => {
    const html = await zahlungsSeite()
    expect(html).not.toContain(TESTBETRIEB_TEXT.zahlung)
    expect(html).toContain('Online-Zahlung (Stripe)')
  })
})

describe('Einstellungen → Zahlung: „Online-Zahlung neu einrichten"', () => {
  beforeEach(() => {
    vi.mocked(prisma.farm.findUnique).mockResolvedValue({
      stripeAccountId: 'acct_erfunden',
      stripeAccountReady: false,
      acceptsOnline: true,
    } as never)
  })

  it('mit ?stripe=neu: Karte, Marke und der orange Knopf zum Neu-Einrichten', async () => {
    const html = await zahlungsSeite('neu')
    expect(html).toContain(NEU_EINRICHTEN_TITEL)
    expect(html).toContain(imHtml(NEU_EINRICHTEN_SATZ))
    expect(html).toContain(NEU_EINRICHTEN_MARKE)
    // Titel der Karte und Knopf — zweimal derselbe Wortlaut aus einer Quelle.
    expect(html.split(NEU_EINRICHTEN_TITEL)).toHaveLength(3)
    expect(html).not.toContain('Einrichtung fortsetzen')
    expect(html).not.toContain('Status prüfen')
  })

  it('Gegenprobe: ohne den Parameter bleibt es beim Fortsetzen', async () => {
    const html = await zahlungsSeite()
    expect(html).not.toContain(NEU_EINRICHTEN_TITEL)
    expect(html).toContain('Einrichtung fortsetzen')
  })

  it('Gegenprobe: ein bereites Konto zeigt mit ?stripe=neu nichts davon', async () => {
    vi.mocked(prisma.farm.findUnique).mockResolvedValue({
      stripeAccountId: 'acct_erfunden',
      stripeAccountReady: true,
      acceptsOnline: true,
    } as never)
    const html = await zahlungsSeite('neu')
    expect(html).not.toContain(NEU_EINRICHTEN_TITEL)
    expect(html).toContain('Verbunden und aktiv')
  })
})

// ─── Verdrahtung ─────────────────────────────────────────────────────────────

describe('TESTBETRIEB entsteht aus bestimmeUmgebung', () => {
  async function testbetriebBei(werte: { NODE_ENV: string; VERCEL_ENV?: string; STRIPE_SECRET_KEY: string }): Promise<boolean> {
    vi.resetModules()
    vi.doUnmock('@/lib/umgebung-server')
    vi.doMock('@/lib/env', () => ({
      env: { VERCEL_ENV: werte.VERCEL_ENV, STRIPE_SECRET_KEY: werte.STRIPE_SECRET_KEY, NEXT_PUBLIC_APP_URL: 'https://farmerzone.example' },
    }))
    vi.stubEnv('NODE_ENV', werte.NODE_ENV)
    const { TESTBETRIEB } = await import('@/lib/umgebung-server')
    return TESTBETRIEB
  }

  it('Produktion mit sk_test_: Testbetrieb', async () => {
    expect(await testbetriebBei({ NODE_ENV: 'production', VERCEL_ENV: 'production', STRIPE_SECRET_KEY: 'sk_test_erfunden' })).toBe(true)
  })

  it('Produktion mit sk_live_: kein Testbetrieb — die Hinweise verschwinden von selbst', async () => {
    expect(await testbetriebBei({ NODE_ENV: 'production', VERCEL_ENV: 'production', STRIPE_SECRET_KEY: 'sk_live_erfunden' })).toBe(false)
  })

  it('Vorschau und lokal mit sk_test_: kein Testbetrieb (dort spricht das Umgebungsbanner)', async () => {
    expect(await testbetriebBei({ NODE_ENV: 'production', VERCEL_ENV: 'preview', STRIPE_SECRET_KEY: 'sk_test_erfunden' })).toBe(false)
    expect(await testbetriebBei({ NODE_ENV: 'development', STRIPE_SECRET_KEY: 'sk_test_erfunden' })).toBe(false)
  })
})

describe('nur der Wahrheitswert geht an die Oberfläche', () => {
  it('Kasse, Admin-Layout und Zahlungs-Seite lesen TESTBETRIEB auf dem Server', () => {
    expect(quelle('src/app/(public)/[farmSlug]/checkout/page.tsx')).toContain('testbetrieb={TESTBETRIEB}')
    expect(quelle('src/app/admin/layout.tsx')).toContain('testbetrieb={TESTBETRIEB}')
    expect(quelle('src/app/(hof)/settings/payments/page.tsx')).toMatch(/\{TESTBETRIEB && \(/)
    expect(quelle('src/lib/umgebung-server.ts')).toContain('istTestbetrieb(UMGEBUNG)')
  })

  it('keine Client-Komponente liest die Umgebung selbst (sonst landeten Werte im Browser)', () => {
    const client = [
      'src/components/checkout/checkout-form.tsx',
      'src/components/checkout/kasse-teile.tsx',
      'src/components/shells/admin-shell.tsx',
      'src/app/(hof)/settings/payments/payments-actions.tsx',
    ]
    for (const datei of client) {
      expect(ohneKommentare(quelle(datei)), datei).not.toMatch(LIEST_UMGEBUNG)
    }
    // Gegenprobe: Die Suche schlägt an, wo die Umgebung tatsächlich gelesen wird.
    expect(ohneKommentare(quelle('src/app/admin/layout.tsx'))).toMatch(LIEST_UMGEBUNG)
  })
})
