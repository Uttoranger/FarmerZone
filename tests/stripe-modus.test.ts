/**
 * Stripe-Testbetrieb und Modus-Wache (Register Z2, Nachtlauf Nr. 42) — die
 * reinen Regeln in src/lib/stripe-modus.ts, ohne Mock.
 *
 * Beweist:
 *  - Die Wache sperrt den Stripe-Client genau dann, wenn eine Vorschau oder
 *    die lokale Umgebung mit Live-Schlüssel läuft — nie in der Produktion,
 *    nie mit Test-Schlüssel.
 *  - Testbetrieb heißt: Produktion UND Test-Schlüssel. Weder die Vorschau noch
 *    lokal (dort zeigt das Umgebungsbanner „Stripe Test") noch die Produktion
 *    mit Live-Schlüssel zeigen die Hinweise.
 *  - Der Modus kommt aus bestimmeUmgebung (nur das Präfix) — die Regeln und
 *    Sätze tragen nie einen Schlüssel.
 *  - Die drei Sätze stehen wörtlich wie in freigabe.md §12.
 */
import { describe, expect, it } from 'vitest'
import { bestimmeUmgebung, type StripeArt, type UmgebungsArt } from '@/lib/umgebung'
import { TESTBETRIEB_TEXT, istTestbetrieb, stripeGesperrtMeldung, stripeStartGesperrt } from '@/lib/stripe-modus'

const ARTEN: UmgebungsArt[] = ['produktion', 'preview', 'lokal']
const STRIPE: StripeArt[] = ['test', 'live', 'fehlt']

describe('stripeStartGesperrt — Vorschau und lokal nie mit Live-Schlüssel', () => {
  it('sperrt die Vorschau mit Live-Schlüssel', () => {
    expect(stripeStartGesperrt({ art: 'preview', stripe: 'live' })).toBe(true)
  })

  it('sperrt lokal mit Live-Schlüssel', () => {
    expect(stripeStartGesperrt({ art: 'lokal', stripe: 'live' })).toBe(true)
  })

  it('lässt die Produktion mit Live-Schlüssel starten', () => {
    expect(stripeStartGesperrt({ art: 'produktion', stripe: 'live' })).toBe(false)
  })

  it('lässt Vorschau und lokal mit Test-Schlüssel starten', () => {
    expect(stripeStartGesperrt({ art: 'preview', stripe: 'test' })).toBe(false)
    expect(stripeStartGesperrt({ art: 'lokal', stripe: 'test' })).toBe(false)
  })

  it('sperrt in der ganzen Matrix nur die zwei Live-Fälle außerhalb der Produktion', () => {
    const gesperrt = ARTEN.flatMap((art) =>
      STRIPE.filter((stripe) => stripeStartGesperrt({ art, stripe })).map((stripe) => `${art}+${stripe}`)
    )
    expect(gesperrt).toEqual(['preview+live', 'lokal+live'])
  })

  it('nimmt den Modus aus bestimmeUmgebung: eine Vorschau mit sk_live_ ist gesperrt', () => {
    const vorschau = bestimmeUmgebung({ NODE_ENV: 'production', VERCEL_ENV: 'preview', STRIPE_SECRET_KEY: 'sk_live_erfunden' })
    const lokal = bestimmeUmgebung({ NODE_ENV: 'development', STRIPE_SECRET_KEY: 'sk_live_erfunden' })
    const produktion = bestimmeUmgebung({ NODE_ENV: 'production', VERCEL_ENV: 'production', STRIPE_SECRET_KEY: 'sk_live_erfunden' })
    expect(stripeStartGesperrt(vorschau)).toBe(true)
    expect(stripeStartGesperrt(lokal)).toBe(true)
    expect(stripeStartGesperrt(produktion)).toBe(false)
  })
})

describe('stripeGesperrtMeldung — klar, deutsch, ohne Schlüssel', () => {
  it('sagt je Umgebung, was los ist und was zu tun ist', () => {
    expect(stripeGesperrtMeldung('preview')).toMatch(/^Stripe startet nicht: .*Vorschau.*Live-Schlüssel.*Test-Schlüssel/)
    expect(stripeGesperrtMeldung('lokal')).toMatch(/^Stripe startet nicht: .*[Ll]okal.*Live-Schlüssel.*Test-Schlüssel/)
  })

  it('trägt keinen Schlüssel und kein Präfix eines Schlüssels', () => {
    for (const art of ['preview', 'lokal'] as const) {
      expect(stripeGesperrtMeldung(art)).not.toMatch(/sk_|rk_|pk_|whsec_/)
    }
  })
})

describe('istTestbetrieb — nur die Produktion mit Test-Schlüssel', () => {
  it('Produktion mit Test-Schlüssel ist Testbetrieb', () => {
    expect(istTestbetrieb({ art: 'produktion', stripe: 'test' })).toBe(true)
  })

  it('mit Live-Schlüssel verschwindet der Testbetrieb von selbst', () => {
    expect(istTestbetrieb({ art: 'produktion', stripe: 'live' })).toBe(false)
  })

  it('Vorschau und lokal sind nie Testbetrieb — dort spricht das Umgebungsbanner', () => {
    expect(istTestbetrieb({ art: 'preview', stripe: 'test' })).toBe(false)
    expect(istTestbetrieb({ art: 'lokal', stripe: 'test' })).toBe(false)
  })

  it('ohne lesbaren Schlüssel kein Testbetrieb-Hinweis', () => {
    expect(istTestbetrieb({ art: 'produktion', stripe: 'fehlt' })).toBe(false)
  })

  it('genau ein Fall der Matrix', () => {
    const faelle = ARTEN.flatMap((art) => STRIPE.filter((stripe) => istTestbetrieb({ art, stripe })).map((s) => `${art}+${s}`))
    expect(faelle).toEqual(['produktion+test'])
  })

  it('folgt bestimmeUmgebung: die Produktion lädt sk_test_ → Testbetrieb, sk_live_ → keiner', () => {
    const basis = { NODE_ENV: 'production', VERCEL_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://farmerzone.example' }
    expect(istTestbetrieb(bestimmeUmgebung({ ...basis, STRIPE_SECRET_KEY: 'sk_test_erfunden' }))).toBe(true)
    expect(istTestbetrieb(bestimmeUmgebung({ ...basis, STRIPE_SECRET_KEY: 'sk_live_erfunden' }))).toBe(false)
  })
})

describe('TESTBETRIEB_TEXT — die drei Sätze aus EINER Quelle', () => {
  it('stehen wörtlich wie in freigabe.md §12', () => {
    expect(TESTBETRIEB_TEXT.kasse).toBe('Testbetrieb: Echte Karten werden noch abgelehnt. Bitte wähle Bar bei Abholung.')
    expect(TESTBETRIEB_TEXT.admin).toBe(
      'Stripe läuft im Testmodus – Online-Zahlungen sind Testzahlungen, es fließt kein echtes Geld.'
    )
    expect(TESTBETRIEB_TEXT.zahlung).toBe('Online-Zahlung läuft noch im Testbetrieb.')
  })
})
