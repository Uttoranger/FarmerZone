/**
 * Stripe-Testbetrieb und Modus-Wache (Register Z2, Nachtlauf Nr. 42) — die
 * reinen Regeln in src/lib/stripe-modus.ts, ohne Mock.
 *
 * Beweist:
 *  - Die Wache ist fail-closed (Entscheidung des Dirigenten, Runde 1): Ein
 *    Live-Schlüssel (`sk_live_`, `rk_live_`) startet den Client NUR im
 *    Produktions-Deployment bei Vercel (`VERCEL_ENV=production`). Vorschau,
 *    lokal (`next dev` und `next start`), Vitest/CI und Unbekanntes sperren.
 *    Test-Schlüssel sind überall erlaubt.
 *  - Testbetrieb heißt: Produktion UND Test-Schlüssel. Weder die Vorschau noch
 *    lokal (dort zeigt das Umgebungsbanner „Stripe Test") noch die Produktion
 *    mit Live-Schlüssel zeigen die Hinweise.
 *  - Der Modus kommt aus bestimmeUmgebung (nur das Präfix) — die Regeln und
 *    Sätze tragen nie einen Schlüssel.
 *  - Die drei Sätze stehen wörtlich wie in freigabe.md §12.
 */
import { describe, expect, it } from 'vitest'
import { bestimmeUmgebung, type StripeArt, type UmgebungsArt } from '@/lib/umgebung'
import { MODUS_SPERRE, TESTBETRIEB_TEXT, istModusSperre, istTestbetrieb, stripeGesperrtMeldung, stripeStartGesperrt } from '@/lib/stripe-modus'

const ARTEN: UmgebungsArt[] = ['produktion', 'preview', 'lokal']
const STRIPE: StripeArt[] = ['test', 'live', 'fehlt']

describe('stripeStartGesperrt — ein Live-Schlüssel nur im Produktions-Deployment bei Vercel', () => {
  it('lässt das Produktions-Deployment mit Live-Schlüssel starten', () => {
    expect(stripeStartGesperrt({ art: 'produktion', stripe: 'live', vercelProduktion: true })).toBe(false)
  })

  it('sperrt Vorschau und lokal mit Live-Schlüssel', () => {
    expect(stripeStartGesperrt({ art: 'preview', stripe: 'live', vercelProduktion: false })).toBe(true)
    expect(stripeStartGesperrt({ art: 'lokal', stripe: 'live', vercelProduktion: false })).toBe(true)
  })

  it('sperrt „produktion" ohne Vercel-Produktion: lokaler Produktions-Build, Vitest/CI, Unbekanntes', () => {
    expect(stripeStartGesperrt({ art: 'produktion', stripe: 'live', vercelProduktion: false })).toBe(true)
  })

  it('sperrt auch lokal mit gezogener Produktions-Umgebung (VERCEL_ENV=production unter next dev)', () => {
    expect(stripeStartGesperrt({ art: 'lokal', stripe: 'live', vercelProduktion: true })).toBe(true)
  })

  it('Test-Schlüssel und fehlende Schlüssel sperren nie', () => {
    for (const art of ARTEN) {
      for (const vercelProduktion of [true, false]) {
        expect(stripeStartGesperrt({ art, stripe: 'test', vercelProduktion })).toBe(false)
        expect(stripeStartGesperrt({ art, stripe: 'fehlt', vercelProduktion })).toBe(false)
      }
    }
  })

  it('in der ganzen Matrix startet ein Live-Schlüssel nur in einem Fall', () => {
    const erlaubt = ARTEN.flatMap((art) =>
      [true, false]
        .filter((vercelProduktion) => !stripeStartGesperrt({ art, stripe: 'live', vercelProduktion }))
        .map((vercelProduktion) => `${art}+live+${vercelProduktion ? 'vercel' : 'ohne-vercel'}`)
    )
    expect(erlaubt).toEqual(['produktion+live+vercel'])
  })

  it.each([
    ['Vercel-Produktion, sk_live_', { NODE_ENV: 'production', VERCEL_ENV: 'production', STRIPE_SECRET_KEY: 'sk_live_erfunden' }, false],
    ['Vercel-Produktion, rk_live_', { NODE_ENV: 'production', VERCEL_ENV: 'production', STRIPE_SECRET_KEY: 'rk_live_erfunden' }, false],
    ['Vorschau, sk_live_', { NODE_ENV: 'production', VERCEL_ENV: 'preview', STRIPE_SECRET_KEY: 'sk_live_erfunden' }, true],
    ['Vorschau, rk_live_', { NODE_ENV: 'production', VERCEL_ENV: 'preview', STRIPE_SECRET_KEY: 'rk_live_erfunden' }, true],
    ['lokal next dev, sk_live_', { NODE_ENV: 'development', STRIPE_SECRET_KEY: 'sk_live_erfunden' }, true],
    ['lokal next dev mit gezogenem VERCEL_ENV=production', { NODE_ENV: 'development', VERCEL_ENV: 'production', STRIPE_SECRET_KEY: 'sk_live_erfunden' }, true],
    ['lokal next start, sk_live_', { NODE_ENV: 'production', STRIPE_SECRET_KEY: 'sk_live_erfunden' }, true],
    ['Vitest/CI/test:integration, sk_live_', { NODE_ENV: 'test', STRIPE_SECRET_KEY: 'sk_live_erfunden' }, true],
    ['vercel dev, rk_live_', { VERCEL_ENV: 'development', STRIPE_SECRET_KEY: 'rk_live_erfunden' }, true],
    ['ganz unbekannt, sk_live_', { STRIPE_SECRET_KEY: 'sk_live_erfunden' }, true],
    ['Vorschau, sk_test_', { NODE_ENV: 'production', VERCEL_ENV: 'preview', STRIPE_SECRET_KEY: 'sk_test_erfunden' }, false],
    ['lokal next dev, rk_test_', { NODE_ENV: 'development', STRIPE_SECRET_KEY: 'rk_test_erfunden' }, false],
    ['lokal next start, sk_test_', { NODE_ENV: 'production', STRIPE_SECRET_KEY: 'sk_test_erfunden' }, false],
    ['Vitest/CI, rk_test_', { NODE_ENV: 'test', STRIPE_SECRET_KEY: 'rk_test_erfunden' }, false],
    ['Vercel-Produktion, sk_test_', { NODE_ENV: 'production', VERCEL_ENV: 'production', STRIPE_SECRET_KEY: 'sk_test_erfunden' }, false],
  ] as const)('über bestimmeUmgebung: %s → gesperrt %s', (_fall, werte, gesperrt) => {
    expect(stripeStartGesperrt(bestimmeUmgebung(werte))).toBe(gesperrt)
  })
})

describe('Grenzen der Wache — die Wache vertraut VERCEL_ENV (dokumentiert, Runde 2)', () => {
  it('next start mit gezogenem VERCEL_ENV=production startet mit Live-Schlüssel — von der Vercel-Produktion nicht zu unterscheiden', () => {
    // Etwa nach `vercel env pull --environment=production`. Steht in stripe-live.md und README.
    expect(stripeStartGesperrt(bestimmeUmgebung({ NODE_ENV: 'production', VERCEL_ENV: 'production', STRIPE_SECRET_KEY: 'sk_live_erfunden' }))).toBe(false)
  })

  it('die echte Produktion ohne freigegebene Systemvariablen (VERCEL_ENV fehlt) ist gesperrt', () => {
    // Deshalb der Haken vor Schritt 8 in stripe-live.md: „Automatically expose System Environment Variables".
    const ohneSystemvariablen = { NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://farmerzone.example', STRIPE_SECRET_KEY: 'sk_live_erfunden' }
    expect(stripeStartGesperrt(bestimmeUmgebung(ohneSystemvariablen))).toBe(true)
  })
})

describe('stripeGesperrtMeldung — klar, deutsch, ohne Schlüssel', () => {
  it('sagt je Umgebung, was los ist und was zu tun ist', () => {
    expect(stripeGesperrtMeldung('preview')).toMatch(/^Stripe startet nicht: .*Vorschau.*Live-Schlüssel.*Test-Schlüssel/)
    expect(stripeGesperrtMeldung('lokal')).toMatch(/^Stripe startet nicht: .*[Ll]okal.*Live-Schlüssel.*Test-Schlüssel/)
    // „produktion" ohne Vercel-Produktion: lokaler Produktions-Build, Test, CI.
    expect(stripeGesperrtMeldung('produktion')).toMatch(/^Stripe startet nicht: .*Live-Schlüssel.*VERCEL_ENV=production.*Test-Schlüssel/)
  })

  it('nennt für „produktion" beide Auswege — auch die Systemvariablen bei Vercel (Runde 2)', () => {
    // Fehlt VERCEL_ENV in der echten Produktion, wäre „Test-Schlüssel eintragen" der falsche Rat.
    expect(stripeGesperrtMeldung('produktion')).toContain('Automatically expose System Environment Variables')
  })

  it('trägt keinen Schlüssel und kein Präfix eines Schlüssels', () => {
    for (const art of ARTEN) {
      expect(stripeGesperrtMeldung(art)).not.toMatch(/sk_|rk_|pk_|whsec_/)
    }
  })
})

describe('istModusSperre — die Sperre am Namen erkennen, ohne das SDK-Modul', () => {
  it('erkennt einen Fehler mit dem Namen der Sperre', () => {
    expect(MODUS_SPERRE).toBe('StripeModusGesperrt')
    expect(istModusSperre(Object.assign(new Error('Stripe startet nicht: …'), { name: MODUS_SPERRE }))).toBe(true)
  })

  it('Gegenprobe: andere Fehler und Nicht-Fehler sind keine Sperre', () => {
    expect(istModusSperre(new Error('Stripe startet nicht: …'))).toBe(false)
    expect(istModusSperre({ name: MODUS_SPERRE, message: 'nur die Form' })).toBe(false)
    expect(istModusSperre(null)).toBe(false)
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

  it('folgt bestimmeUmgebung: die Produktion lädt sk_test_/rk_test_ → Testbetrieb, sk_live_/rk_live_ → keiner', () => {
    const basis = { NODE_ENV: 'production', VERCEL_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://farmerzone.example' }
    expect(istTestbetrieb(bestimmeUmgebung({ ...basis, STRIPE_SECRET_KEY: 'sk_test_erfunden' }))).toBe(true)
    expect(istTestbetrieb(bestimmeUmgebung({ ...basis, STRIPE_SECRET_KEY: 'rk_test_erfunden' }))).toBe(true)
    expect(istTestbetrieb(bestimmeUmgebung({ ...basis, STRIPE_SECRET_KEY: 'sk_live_erfunden' }))).toBe(false)
    expect(istTestbetrieb(bestimmeUmgebung({ ...basis, STRIPE_SECRET_KEY: 'rk_live_erfunden' }))).toBe(false)
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
