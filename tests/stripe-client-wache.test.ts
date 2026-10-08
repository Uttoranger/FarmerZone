/**
 * Die Modus-Wache am Stripe-Server-Client (Register Z2, Nachtlauf Nr. 42):
 * src/lib/stripe.ts erzeugt den Client erst beim ersten Gebrauch — und in
 * Vorschau oder lokal mit Live-Schlüssel gar nicht.
 *
 * Beweist:
 *  - Der bloße Import erzeugt keinen Client und wirft nie — Bar-Bestellungen
 *    und Seiten ohne Stripe laufen weiter, auch wenn die Wache sperrt.
 *  - Vorschau + Live und lokal + Live: Der Client startet nicht (der
 *    Konstruktor läuft nie), der Gebrauch wirft eine deutsche Meldung.
 *  - Sentry erfährt es einmal je Instanz, nur mit Umgebung und „live" — nie
 *    mit dem Schlüssel oder einem Teil davon.
 *  - Produktion + Live und Vorschau/lokal + Test starten, genau einmal.
 *  - Die Frage nach `then` (ein async-Rückgabewert wird darauf geprüft,
 *    teilerstattung.ts gibt den Client so zurück) erzeugt keinen Client und
 *    löst die Wache nicht aus.
 *  - Unter src/ baut nur src/lib/stripe.ts einen Stripe-Client — sonst gäbe
 *    es einen Weg an der Wache vorbei.
 *
 * Das Stripe-Paket ist gemockt: Es entsteht kein echter Client, kein Netz.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StripeArt, UmgebungsArt } from '@/lib/umgebung'

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
const TEST_SCHLUESSEL = 'sk_test_ERFUNDEN-nur-fuer-tests-geheim'

/** Je Fall ein frisches Modul: Client und „schon gemeldet" leben auf Modulebene. */
async function ladeStripe(art: UmgebungsArt, stripe: StripeArt, schluessel: string) {
  vi.resetModules()
  vi.doMock('@/lib/env', () => ({ env: { STRIPE_SECRET_KEY: schluessel } }))
  vi.doMock('@/lib/umgebung-server', () => ({ UMGEBUNG: { art, stripe } }))
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
    const { sentry } = await ladeStripe('preview', 'live', LIVE_SCHLUESSEL)
    expect(zustand.konstruiert).toEqual([])
    expect(sentry.captureMessage).not.toHaveBeenCalled()
  })
})

describe('Vorschau und lokal mit Live-Schlüssel: der Client startet nicht', () => {
  it('Vorschau + Live: der Gebrauch wirft eine deutsche Meldung, der Konstruktor läuft nie', async () => {
    const { stripe, StripeModusGesperrt } = await ladeStripe('preview', 'live', LIVE_SCHLUESSEL)

    expect(() => stripe.paymentIntents).toThrow(StripeModusGesperrt)
    expect(() => stripe.paymentIntents).toThrow(/^Stripe startet nicht: Die Vorschau läuft mit einem Live-Schlüssel/)
    expect(zustand.konstruiert).toEqual([])
  })

  it('lokal + Live: ebenso gesperrt, mit der Meldung für lokal', async () => {
    const { stripe, stripeClient } = await ladeStripe('lokal', 'live', LIVE_SCHLUESSEL)

    expect(() => stripeClient()).toThrow(/^Stripe startet nicht: Lokal ist ein Live-Schlüssel eingetragen/)
    expect(() => stripe.accounts).toThrow(/Stripe startet nicht/)
    expect(zustand.konstruiert).toEqual([])
  })

  it('Sentry erfährt es einmal je Instanz — nur Umgebung und „live", nie der Schlüssel', async () => {
    const { stripe, sentry } = await ladeStripe('preview', 'live', LIVE_SCHLUESSEL)

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

  it('die geworfene Meldung trägt den Schlüssel nicht', async () => {
    const { stripeClient } = await ladeStripe('lokal', 'live', LIVE_SCHLUESSEL)
    let meldung = ''
    try {
      stripeClient()
    } catch (err) {
      meldung = err instanceof Error ? `${err.name} ${err.message} ${err.stack ?? ''}` : String(err)
    }
    expect(meldung).toContain('Stripe startet nicht')
    expect(meldung).not.toContain('ERFUNDEN')
    expect(meldung).not.toContain('sk_live')
  })
})

describe('erlaubte Kombinationen starten — genau einmal', () => {
  it('Produktion + Live: der Client entsteht mit dem Schlüssel, kein Alarm', async () => {
    const { stripe, sentry } = await ladeStripe('produktion', 'live', LIVE_SCHLUESSEL)

    expect(stripe.paymentIntents).toBeDefined()
    expect(stripe.accounts).toBeDefined()

    expect(zustand.konstruiert).toEqual([LIVE_SCHLUESSEL])
    expect(sentry.captureMessage).not.toHaveBeenCalled()
  })

  it.each([
    ['preview', 'test'],
    ['lokal', 'test'],
    ['produktion', 'test'],
  ] as const)('%s + %s startet', async (art, stripeArt) => {
    const { stripeClient } = await ladeStripe(art, stripeArt, TEST_SCHLUESSEL)

    const erster = stripeClient()
    expect(stripeClient()).toBe(erster)
    expect(zustand.konstruiert).toEqual([TEST_SCHLUESSEL])
  })
})

describe('`then` ist keine Frage an Stripe', () => {
  it('ein async-Rückgabewert erzeugt keinen Client und löst die Wache nicht aus', async () => {
    const { stripe, sentry } = await ladeStripe('preview', 'live', LIVE_SCHLUESSEL)

    expect((stripe as unknown as { then?: unknown }).then).toBeUndefined()
    const zurueck = await (async () => stripe)()

    expect(zurueck).toBe(stripe)
    expect(zustand.konstruiert).toEqual([])
    expect(sentry.captureMessage).not.toHaveBeenCalled()
  })
})

describe('kein Weg an der Wache vorbei', () => {
  const WURZEL = process.cwd()
  function alleDateien(ordner: string): string[] {
    return readdirSync(join(WURZEL, ordner)).flatMap((name) => {
      const pfad = join(ordner, name)
      return statSync(join(WURZEL, pfad)).isDirectory() ? alleDateien(pfad) : /\.tsx?$/.test(name) ? [pfad] : []
    })
  }
  const BAUT_CLIENT = /new Stripe\(/

  it('unter src/ baut nur src/lib/stripe.ts einen Stripe-Client', () => {
    const fundstellen = alleDateien('src')
      .filter((datei) => BAUT_CLIENT.test(readFileSync(join(WURZEL, datei), 'utf8')))
      .map((datei) => relative(WURZEL, join(WURZEL, datei)))
    expect(fundstellen).toEqual([join('src', 'lib', 'stripe.ts')])
  })
})
