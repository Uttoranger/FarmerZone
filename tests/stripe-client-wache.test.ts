/**
 * Die Modus-Wache am Stripe-Server-Client (Register Z2, Nachtlauf Nr. 42):
 * src/lib/stripe.ts erzeugt den Client erst beim ersten Gebrauch — und mit
 * Live-Schlüssel nur im Produktions-Deployment bei Vercel.
 *
 * Beweist:
 *  - Der bloße Import erzeugt keinen Client und wirft nie — Bar-Bestellungen
 *    und Seiten ohne Stripe laufen weiter, auch wenn die Wache sperrt.
 *  - Fail-closed (Runde 1): Ein Live-Schlüssel (`sk_live_`, `rk_live_`)
 *    startet den Client nur bei `VERCEL_ENV=production`. Vorschau, lokal mit
 *    `next dev` (auch mit gezogenem `VERCEL_ENV=production`) und `next start`,
 *    Vitest/CI und Unbekanntes sperren: Der Konstruktor läuft nie, der
 *    Gebrauch wirft eine deutsche Meldung.
 *  - Sentry erfährt es einmal je Instanz, nur mit Umgebung und „live" — nie
 *    mit dem Schlüssel oder einem Teil davon.
 *  - Vercel-Produktion + Live und jede Lage + Test-Schlüssel starten, genau
 *    einmal.
 *  - Die Frage nach `then` (ein async-Rückgabewert wird darauf geprüft,
 *    teilerstattung.ts gibt den Client so zurück) erzeugt keinen Client und
 *    löst die Wache nicht aus.
 *  - Unter src/ holt nur src/lib/stripe.ts das Stripe-Paket als Wert und baut
 *    einen Client — auch nicht unter anderem Namen, per `require`/`import()`,
 *    per Weiterexport oder als Aufruf ohne `new`. Sonst gäbe es einen Weg an
 *    der Wache vorbei.
 *
 * Die Umgebung entsteht wie im Betrieb aus bestimmeUmgebung (src/lib/umgebung.ts),
 * nur ohne process.env. Das Stripe-Paket ist gemockt: Es entsteht kein echter
 * Client, kein Netz.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bestimmeUmgebung, type UmgebungsArt, type UmgebungsWerte } from '@/lib/umgebung'
import { istModusSperre } from '@/lib/stripe-modus'

const zustand = vi.hoisted(() => ({ konstruiert: [] as string[] }))

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('stripe', () => {
  class StripeAttrappe {
    static API_VERSION = '2099-01-01.platzhalter'
    paymentIntents = { create: vi.fn() }
    accounts = { retrieve: vi.fn() }
    constructor(schluessel: string) {
      zustand.konstruiert.push(schluessel)
    }
  }
  return { default: StripeAttrappe }
})

// Erfunden, aber mit echtem Präfix — so fiele ein Durchsickern im Test auf.
// Mit Bindestrichen, damit kein Scanner sie für echte Schlüssel hält.
const LIVE_SCHLUESSEL = 'sk_live_ERFUNDEN-nur-fuer-tests-geheim'
const LIVE_EINGESCHRAENKT = 'rk_live_ERFUNDEN-nur-fuer-tests-geheim'
const TEST_SCHLUESSEL = 'sk_test_ERFUNDEN-nur-fuer-tests-geheim'
const TEST_EINGESCHRAENKT = 'rk_test_ERFUNDEN-nur-fuer-tests-geheim'

/** Die Lagen, wie sie im Betrieb ankommen — ohne Schlüssel. */
const LAGE = {
  vercelProduktion: { NODE_ENV: 'production', VERCEL_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://farmerzone.example' },
  vorschau: { NODE_ENV: 'production', VERCEL_ENV: 'preview', VERCEL_BRANCH_URL: 'farmer-zone-git-test.vercel.app' },
  nextDev: { NODE_ENV: 'development' },
  nextDevMitGezogenerProduktion: { NODE_ENV: 'development', VERCEL_ENV: 'production' },
  nextStart: { NODE_ENV: 'production' },
  vitestCi: { NODE_ENV: 'test' },
  vercelDev: { VERCEL_ENV: 'development' },
  unbekannt: {},
} satisfies Record<string, UmgebungsWerte>

/** Je Fall ein frisches Modul: Client und „schon gemeldet" leben auf Modulebene. */
async function ladeStripe(lage: UmgebungsWerte, schluessel: string) {
  const UMGEBUNG = bestimmeUmgebung({ ...lage, STRIPE_SECRET_KEY: schluessel })
  vi.resetModules()
  vi.doMock('@/lib/env', () => ({ env: { STRIPE_SECRET_KEY: schluessel } }))
  vi.doMock('@/lib/umgebung-server', () => ({ UMGEBUNG }))
  const modul = await import('@/lib/stripe')
  const sentry = await import('@sentry/nextjs')
  return { ...modul, sentry }
}

let fehlerAusgabe: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  zustand.konstruiert = []
  vi.clearAllMocks()
  fehlerAusgabe = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  fehlerAusgabe.mockRestore()
})

describe('der bloße Import startet nichts', () => {
  it('erzeugt keinen Client und wirft nicht — auch nicht, wenn die Wache sperren würde', async () => {
    const { sentry } = await ladeStripe(LAGE.vorschau, LIVE_SCHLUESSEL)
    expect(zustand.konstruiert).toEqual([])
    expect(sentry.captureMessage).not.toHaveBeenCalled()
  })
})

describe('Live-Schlüssel außerhalb des Produktions-Deployments: der Client startet nicht', () => {
  it('Vorschau + Live: der Gebrauch wirft eine deutsche Meldung, der Konstruktor läuft nie', async () => {
    const { stripe, StripeModusGesperrt } = await ladeStripe(LAGE.vorschau, LIVE_SCHLUESSEL)

    expect(() => stripe.paymentIntents).toThrow(StripeModusGesperrt)
    expect(() => stripe.paymentIntents).toThrow(/^Stripe startet nicht: Die Vorschau läuft mit einem Live-Schlüssel/)
    expect(zustand.konstruiert).toEqual([])
  })

  it('lokal + Live: ebenso gesperrt, mit der Meldung für lokal', async () => {
    const { stripe, stripeClient } = await ladeStripe(LAGE.nextDev, LIVE_SCHLUESSEL)

    expect(() => stripeClient()).toThrow(/^Stripe startet nicht: Lokal ist ein Live-Schlüssel eingetragen/)
    expect(() => stripe.accounts).toThrow(/Stripe startet nicht/)
    expect(zustand.konstruiert).toEqual([])
  })

  it('lokaler Produktions-Build (next start) + Live: gesperrt, die Meldung nennt VERCEL_ENV=production', async () => {
    const { stripeClient, sentry } = await ladeStripe(LAGE.nextStart, LIVE_SCHLUESSEL)

    expect(() => stripeClient()).toThrow(/^Stripe startet nicht: .*VERCEL_ENV=production fehlt/)
    expect(zustand.konstruiert).toEqual([])
    expect(vi.mocked(sentry.captureMessage).mock.calls[0][1]).toMatchObject({
      tags: { aufgabe: 'stripe-modus', umgebung: 'produktion', stripe: 'live' },
    })
  })

  it.each([
    ['Vorschau, sk_live_', LAGE.vorschau, LIVE_SCHLUESSEL, 'preview'],
    ['Vorschau, rk_live_', LAGE.vorschau, LIVE_EINGESCHRAENKT, 'preview'],
    ['next dev, rk_live_', LAGE.nextDev, LIVE_EINGESCHRAENKT, 'lokal'],
    ['next dev mit gezogenem VERCEL_ENV=production', LAGE.nextDevMitGezogenerProduktion, LIVE_SCHLUESSEL, 'lokal'],
    ['next start, rk_live_', LAGE.nextStart, LIVE_EINGESCHRAENKT, 'produktion'],
    ['Vitest/CI/test:integration, sk_live_', LAGE.vitestCi, LIVE_SCHLUESSEL, 'produktion'],
    ['vercel dev, sk_live_', LAGE.vercelDev, LIVE_SCHLUESSEL, 'produktion'],
    ['ganz unbekannt, rk_live_', LAGE.unbekannt, LIVE_EINGESCHRAENKT, 'produktion'],
  ] as const)('%s: gesperrt, Meldung ohne Schlüssel', async (_fall, lage, schluessel, art: UmgebungsArt) => {
    const { stripeClient, StripeModusGesperrt, sentry } = await ladeStripe(lage, schluessel)

    let gefangen: unknown = null
    try {
      stripeClient()
    } catch (err) {
      gefangen = err
    }
    expect(gefangen).toBeInstanceOf(StripeModusGesperrt)
    // So erkennt der Webhook die Sperre, ohne die Klasse zu laden (keine „ungültige Signatur").
    expect(istModusSperre(gefangen)).toBe(true)
    expect(zustand.konstruiert).toEqual([])
    expect(vi.mocked(sentry.captureMessage).mock.calls[0][1]).toMatchObject({ tags: { umgebung: art, stripe: 'live' } })

    const fehler = gefangen as Error
    const allesGesagt = JSON.stringify([
      `${fehler.name} ${fehler.message} ${fehler.stack ?? ''}`,
      vi.mocked(sentry.captureMessage).mock.calls,
      fehlerAusgabe.mock.calls,
    ])
    expect(allesGesagt).toContain('Stripe startet nicht')
    expect(allesGesagt).not.toContain('ERFUNDEN')
    expect(allesGesagt).not.toContain('geheim')
    expect(allesGesagt).not.toMatch(/[sr]k_live/)
  })

  it('Sentry erfährt es einmal je Instanz — nur Umgebung und „live", nie der Schlüssel', async () => {
    const { stripe, sentry } = await ladeStripe(LAGE.vorschau, LIVE_SCHLUESSEL)

    expect(() => stripe.paymentIntents).toThrow()
    expect(() => stripe.accounts).toThrow()
    expect(() => stripe.paymentIntents).toThrow()

    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sentry.captureMessage).mock.calls[0][1]).toMatchObject({
      level: 'error',
      tags: { aufgabe: 'stripe-modus', umgebung: 'preview', stripe: 'live' },
    })
    const allesGemeldet = JSON.stringify([
      vi.mocked(sentry.captureMessage).mock.calls,
      vi.mocked(sentry.captureException).mock.calls,
      fehlerAusgabe.mock.calls,
    ])
    expect(allesGemeldet).not.toContain('ERFUNDEN')
    expect(allesGemeldet).not.toContain('geheim')
    expect(allesGemeldet).not.toContain('sk_live')
  })
})

describe('erlaubte Kombinationen starten — genau einmal', () => {
  it.each([
    ['sk_live_', LIVE_SCHLUESSEL],
    ['rk_live_', LIVE_EINGESCHRAENKT],
  ] as const)('Vercel-Produktion + %s: der Client entsteht mit dem Schlüssel, kein Alarm', async (_art, schluessel) => {
    const { stripe, sentry } = await ladeStripe(LAGE.vercelProduktion, schluessel)

    expect(stripe.paymentIntents).toBeDefined()
    expect(stripe.accounts).toBeDefined()

    expect(zustand.konstruiert).toEqual([schluessel])
    expect(sentry.captureMessage).not.toHaveBeenCalled()
  })

  it.each([
    ['Vercel-Produktion', LAGE.vercelProduktion, TEST_SCHLUESSEL],
    ['Vorschau', LAGE.vorschau, TEST_SCHLUESSEL],
    ['next dev', LAGE.nextDev, TEST_EINGESCHRAENKT],
    ['next start', LAGE.nextStart, TEST_SCHLUESSEL],
    ['Vitest/CI', LAGE.vitestCi, TEST_EINGESCHRAENKT],
    ['unbekannt', LAGE.unbekannt, TEST_SCHLUESSEL],
  ] as const)('%s + Test-Schlüssel startet', async (_fall, lage, schluessel) => {
    const { stripeClient, sentry } = await ladeStripe(lage, schluessel)

    const erster = stripeClient()
    expect(stripeClient()).toBe(erster)
    expect(zustand.konstruiert).toEqual([schluessel])
    expect(sentry.captureMessage).not.toHaveBeenCalled()
  })
})

describe('`then` ist keine Frage an Stripe', () => {
  it('ein async-Rückgabewert erzeugt keinen Client und löst die Wache nicht aus', async () => {
    const { stripe, sentry } = await ladeStripe(LAGE.vorschau, LIVE_SCHLUESSEL)

    expect((stripe as unknown as { then?: unknown }).then).toBeUndefined()
    const zurueck = await (async () => stripe)()

    expect(zurueck).toBe(stripe)
    expect(zustand.konstruiert).toEqual([])
    expect(sentry.captureMessage).not.toHaveBeenCalled()
  })
})

// ── Kein Weg an der Wache vorbei ──────────────────────────────────────────

/** Kommentare raus — ein Satz über `new Stripe(` in einem Kommentar baut nichts. */
function ohneKommentare(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/**
 * Holt der Quelltext das Paket `stripe` als Wert — unter welchem Namen auch
 * immer? `import type`/`export type` holen nur Typen und bauen nichts; jede
 * andere Form (Standard-, Namens-, Stern-Import, Weiterexport, `require`,
 * `import()`) zählt. Ein `import { type X }` zählt bewusst mit: `import type`
 * sagt es eindeutig.
 */
function holtStripePaket(text: string): boolean {
  const code = ohneKommentare(text)
  // Vom letzten `import`/`export` bis `from 'stripe'` — nie über eine andere
  // Anweisung hinweg und nie über eine Zeichenkette (`liste.push('stripe')`).
  const anweisungen = /^\s*(?:import|export)\b(?:(?!\b(?:import|export)\b)[^'"])*?\bfrom\s*['"]stripe['"]/gm
  for (const anweisung of code.matchAll(anweisungen)) {
    if (!/^\s*(?:import|export)\s+type\b/.test(anweisung[0])) return true
  }
  return /\b(?:require|import)\s*\(\s*['"]stripe['"]\s*\)/.test(code)
}

/** Ruft der Quelltext `Stripe(…)` auf — mit oder ohne `new`? Fließtext wie „Stripe (Zahlung)" zählt nicht. */
function rufStripeAuf(text: string): boolean {
  return /\bStripe\(/.test(ohneKommentare(text))
}

describe('die Spürhunde der Quelltext-Wache', () => {
  it.each([
    "import Stripe from 'stripe'",
    "import Bezahldienst from 'stripe'",
    'import { Stripe as S } from "stripe"',
    "import * as S from 'stripe'",
    "import S, { Stripe } from 'stripe'",
    "import 'server-only'\nimport Abkasser from 'stripe'",
    "import {\n  Stripe,\n} from 'stripe'",
    "const S = require('stripe')",
    "const { default: S } = await import('stripe')",
    "export { default } from 'stripe'",
    "export * from 'stripe'",
  ])('findet %j', (quelltext) => {
    expect(holtStripePaket(quelltext)).toBe(true)
  })

  it.each([
    "import type Stripe from 'stripe'",
    "import type { Stripe } from 'stripe'",
    "export type { Stripe } from 'stripe'",
    "import 'server-only'\nimport type Stripe from 'stripe'",
    "// import Stripe from 'stripe'",
    "/* const S = require('stripe') */",
    "import { stripe } from '@/lib/stripe'",
    "export type Block =\n  | 'stripe'\n  | 'teilen'",
    "export function aufbau() {\n  liste.push('stripe')\n}",
    "export function f() {}\nimport type Stripe from 'stripe'",
  ])('lässt %j durch', (quelltext) => {
    expect(holtStripePaket(quelltext)).toBe(false)
  })

  it('erkennt den Aufruf mit und ohne new, nicht aber Fließtext und Kommentare', () => {
    expect(rufStripeAuf('const s = new Stripe(schluessel)')).toBe(true)
    expect(rufStripeAuf('const s = Stripe(schluessel)')).toBe(true)
    expect(rufStripeAuf('<p>Stripe (Zahlungsabwicklung)</p>')).toBe(false)
    expect(rufStripeAuf('// new Stripe(schluessel)')).toBe(false)
    expect(rufStripeAuf('const link = await createStripeDashboardLinkAction()')).toBe(false)
  })
})

describe('kein Weg an der Wache vorbei', () => {
  const WURZEL = process.cwd()
  const WACHE = join('src', 'lib', 'stripe.ts')
  function alleDateien(ordner: string): string[] {
    return readdirSync(join(WURZEL, ordner)).flatMap((name) => {
      const pfad = join(ordner, name)
      return statSync(join(WURZEL, pfad)).isDirectory() ? alleDateien(pfad) : /\.[cm]?[jt]sx?$/.test(name) ? [pfad] : []
    })
  }
  const QUELLEN = alleDateien('src').map((pfad) => ({ pfad, text: readFileSync(join(WURZEL, pfad), 'utf8') }))

  it('unter src/ holt nur src/lib/stripe.ts das Stripe-Paket als Wert', () => {
    const fundstellen = QUELLEN.filter(({ text }) => holtStripePaket(text)).map(({ pfad }) => pfad)
    expect(fundstellen).toEqual([WACHE])
  })

  it('unter src/ ruft nur src/lib/stripe.ts Stripe(…) auf — dort genau einmal, hinter der Wache', () => {
    const fundstellen = QUELLEN.filter(({ text }) => rufStripeAuf(text)).map(({ pfad }) => pfad)
    expect(fundstellen).toEqual([WACHE])

    const quelleDerWache = QUELLEN.find(({ pfad }) => pfad === WACHE)
    expect(quelleDerWache, 'src/lib/stripe.ts fehlt unter den Quellen').toBeDefined()
    const wache = ohneKommentare(quelleDerWache?.text ?? '')
    expect(wache.match(/\bStripe\(/g)).toHaveLength(1)
    expect(wache.indexOf('stripeStartGesperrt(UMGEBUNG)')).toBeGreaterThan(-1)
    expect(wache.indexOf('stripeStartGesperrt(UMGEBUNG)')).toBeLessThan(wache.indexOf('new Stripe('))
  })
})
