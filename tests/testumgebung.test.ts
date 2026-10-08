/**
 * Die Regeln der Testumgebung (Register Z3, Nachtlauf Nr. 43) — rein, ohne
 * Mock (src/lib/testumgebung.ts).
 *
 * Beweist:
 *  - Marke im Admin: „Stripe Live" bzw. „Stripe Test" nur aus dem Modus,
 *    grün nur, wo die Modus-Wache einen Live-Schlüssel starten lässt
 *    (Produktions-Deployment bei Vercel), ohne Schlüssel keine Marke, nie ein
 *    Stück des Schlüssels.
 *  - „Zur echten Seite" steht nur im Banner der Vorschau.
 *  - Post außerhalb der Produktion nur an TEST_EMPFAENGER und @example.com;
 *    die Produktion ist nie gesperrt.
 */
import { describe, expect, it } from 'vitest'
import { PRODUKTION_ADRESSE, bestimmeUmgebung, type UmgebungsArt } from '@/lib/umgebung'
import {
  STRIPE_MARKE_TEXT,
  ZUR_ECHTEN_SEITE,
  bannerLink,
  darfMailEmpfangen,
  leseTestEmpfaenger,
  stripeMarke,
} from '@/lib/testumgebung'

describe('stripeMarke — Marke im Admin-Kopf', () => {
  // Das Produktions-Deployment bei Vercel: nur dort startet ein Live-Schlüssel (Modus-Wache, Nr. 42).
  const VERCEL_PRODUKTION = { art: 'produktion', vercelProduktion: true } as const

  it('Produktions-Deployment mit Live-Schlüssel: „Stripe Live" in Grün', () => {
    expect(stripeMarke({ ...VERCEL_PRODUKTION, stripe: 'live' })).toEqual({ text: 'Stripe Live', ton: 'fertig' })
  })

  it('Produktion mit Test-Schlüssel (Testbetrieb): „Stripe Test" in Orange', () => {
    expect(stripeMarke({ ...VERCEL_PRODUKTION, stripe: 'test' })).toEqual({ text: 'Stripe Test', ton: 'offen' })
  })

  it('Testumgebung und lokal: „Stripe Test" in Orange — dort fließt nie echtes Geld', () => {
    expect(stripeMarke({ art: 'preview', vercelProduktion: false, stripe: 'test' })).toEqual({ text: 'Stripe Test', ton: 'offen' })
    expect(stripeMarke({ art: 'lokal', vercelProduktion: false, stripe: 'test' })).toEqual({ text: 'Stripe Test', ton: 'offen' })
  })

  it('Live-Schlüssel, den die Modus-Wache sperrt: „Stripe Live", aber nie grün', () => {
    expect(stripeMarke({ art: 'preview', vercelProduktion: false, stripe: 'live' })).toEqual({ text: 'Stripe Live', ton: 'offen' })
    expect(stripeMarke({ art: 'lokal', vercelProduktion: false, stripe: 'live' })).toEqual({ text: 'Stripe Live', ton: 'offen' })
    // Lokaler Produktions-Build, Test, CI: „produktion", aber ohne VERCEL_ENV=production — Stripe startet nicht.
    expect(stripeMarke({ art: 'produktion', vercelProduktion: false, stripe: 'live' })).toEqual({ text: 'Stripe Live', ton: 'offen' })
  })

  it('ohne erkennbaren Schlüssel keine Marke — §12 kennt nur Live und Test', () => {
    for (const art of ['produktion', 'preview', 'lokal'] as const) {
      expect(stripeMarke({ art, vercelProduktion: art === 'produktion', stripe: 'fehlt' }), art).toBeNull()
    }
  })

  it('die Texte stehen wörtlich wie in freigabe.md §12', () => {
    expect(STRIPE_MARKE_TEXT).toEqual({ live: 'Stripe Live', test: 'Stripe Test' })
  })

  it('kommt aus bestimmeUmgebung und trägt nie ein Stück des Schlüssels — auch bei eingeschränkten Schlüsseln', () => {
    const werte = { NODE_ENV: 'production', VERCEL_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://farmerzone.example' }
    const live = stripeMarke(bestimmeUmgebung({ ...werte, STRIPE_SECRET_KEY: 'sk_live_sehr-geheim' }))
    const eingeschraenkt = stripeMarke(bestimmeUmgebung({ ...werte, STRIPE_SECRET_KEY: 'rk_live_sehr-geheim' }))
    expect(live).toEqual({ text: 'Stripe Live', ton: 'fertig' })
    expect(eingeschraenkt).toEqual({ text: 'Stripe Live', ton: 'fertig' })
    expect(JSON.stringify([live, eingeschraenkt])).not.toMatch(/sk_|rk_|geheim/)
  })
})

describe('bannerLink — „Zur echten Seite"', () => {
  it('steht im Banner der Vorschau und führt auf die echte Seite', () => {
    expect(bannerLink({ art: 'preview' })).toEqual({ text: 'Zur echten Seite', href: PRODUKTION_ADRESSE })
    expect(ZUR_ECHTEN_SEITE.href).toBe(PRODUKTION_ADRESSE)
  })

  it('fehlt lokal und in der Produktion (dort gibt es gar kein Banner)', () => {
    expect(bannerLink({ art: 'lokal' })).toBeNull()
    expect(bannerLink({ art: 'produktion' })).toBeNull()
  })

  it('die echte Seite ist eine https-Adresse ohne Pfad', () => {
    expect(PRODUKTION_ADRESSE).toMatch(/^https:\/\/[a-z0-9.-]+$/)
  })
})

describe('leseTestEmpfaenger — die Liste aus TEST_EMPFAENGER', () => {
  it('trennt an Komma, Semikolon und Leerzeichen und schreibt klein', () => {
    expect([...leseTestEmpfaenger('tester@example.org, Zweite@Example.NET ;dritte@example.org  vierte@example.org')]).toEqual([
      'tester@example.org',
      'zweite@example.net',
      'dritte@example.org',
      'vierte@example.org',
    ])
  })

  it('lässt weg, was keine schlichte Adresse ist — an sie geht dann keine Mail', () => {
    expect([...leseTestEmpfaenger('kein-at, x@, @example.org, Name <z@example.org>, gut@example.org, a@b')]).toEqual([
      'gut@example.org',
    ])
  })

  it('ist ohne Variable leer', () => {
    expect(leseTestEmpfaenger(undefined).size).toBe(0)
    expect(leseTestEmpfaenger('').size).toBe(0)
    expect(leseTestEmpfaenger(' , ; ').size).toBe(0)
  })
})

describe('darfMailEmpfangen — Post außerhalb der Produktion', () => {
  const LISTE = leseTestEmpfaenger('tester@example.org, zweite@example.net')
  const NICHT_PRODUKTION: readonly UmgebungsArt[] = ['preview', 'lokal']

  it('Produktion: jede Adresse — eine echte Bestellbestätigung hängt an keiner Liste', () => {
    expect(darfMailEmpfangen('kundin@example.org', 'produktion', new Set())).toBe(true)
    expect(darfMailEmpfangen('Kundin@Beispiel.example', 'produktion', LISTE)).toBe(true)
  })

  it('außerhalb: Adressen aus TEST_EMPFAENGER, ohne Rücksicht auf Groß-/Kleinschreibung und Ränder', () => {
    for (const art of NICHT_PRODUKTION) {
      expect(darfMailEmpfangen('tester@example.org', art, LISTE), art).toBe(true)
      expect(darfMailEmpfangen('  ZWEITE@example.NET ', art, LISTE), art).toBe(true)
    }
  })

  it('außerhalb: jede Adresse der Domain example.com, auch ohne Liste', () => {
    for (const art of NICHT_PRODUKTION) {
      expect(darfMailEmpfangen('bauer-01@example.com', art, new Set()), art).toBe(true)
      expect(darfMailEmpfangen('Admin@EXAMPLE.com', art, new Set()), art).toBe(true)
    }
  })

  it('außerhalb: alles andere nicht', () => {
    for (const art of NICHT_PRODUKTION) {
      expect(darfMailEmpfangen('kundin@example.org', art, LISTE), art).toBe(false)
      expect(darfMailEmpfangen('tester@example.org', art, new Set()), art).toBe(false)
    }
  })

  it('außerhalb: nur genau example.com — keine Unterdomain, keine angehängte Domain', () => {
    // Die Unterdomain fängt auch ein naives endsWith('example.com') — ohne fremde .com-Domain im Test.
    for (const adresse of ['x@sub.example.com', 'x@example.com.example.org', 'x@example.comx']) {
      expect(darfMailEmpfangen(adresse, 'preview', new Set()), adresse).toBe(false)
    }
  })

  it('außerhalb: nie mehrere Adressen oder ein Name in einem Feld — sonst ginge die fremde mit', () => {
    for (const adresse of [
      'kundin@example.org, test@example.com',
      'kundin@example.org;test@example.com',
      'Kundin <kundin@example.org> test@example.com',
      '"x@example.com" kundin@example.org',
      '',
      '   ',
    ]) {
      expect(darfMailEmpfangen(adresse, 'preview', LISTE), adresse).toBe(false)
    }
  })
})
