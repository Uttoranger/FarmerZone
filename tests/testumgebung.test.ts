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
 *  - Post frei nur im Produktions-Deployment bei Vercel (fail-closed wie die
 *    Modus-Wache); sonst nur an TEST_EMPFAENGER und @example.com — auch im
 *    lokalen Produktions-Build. Gemeldet wird nur die Sperre „trotz Produktion".
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRODUKTION_ADRESSE, bannerZeilen, bestimmeUmgebung } from '@/lib/umgebung'
import {
  STRIPE_MARKE_TEXT,
  ZUR_ECHTEN_SEITE,
  bannerLink,
  darfMailEmpfangen,
  leseTestEmpfaenger,
  sperrtTrotzProduktion,
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

  it('„Stripe Test" hat EINE Quelle: Marke im Admin und Banner sagen dasselbe', () => {
    const banner = bannerZeilen(bestimmeUmgebung({ VERCEL_ENV: 'preview', STRIPE_SECRET_KEY: 'sk_test_x' }))
    expect(banner.kurz).toContain(STRIPE_MARKE_TEXT.test)
    // Im Quelltext unter src/ steht das Wort nur einmal als Zeichenkette (Kommentare zählen nicht).
    const ohneKommentare = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    const dateien: string[] = []
    const sammle = (ordner: string): void => {
      for (const name of readdirSync(ordner)) {
        const pfad = join(ordner, name)
        if (statSync(pfad).isDirectory()) sammle(pfad)
        else if (/\.tsx?$/.test(name)) dateien.push(pfad)
      }
    }
    sammle(join(process.cwd(), 'src'))
    const funde = dateien.filter((pfad) => /['"`]Stripe Test['"`]/.test(ohneKommentare(readFileSync(pfad, 'utf8'))))
    // Gegenprobe: Die Suche findet die eine Quelle.
    expect(funde.map((pfad) => relative(process.cwd(), pfad).split('\\').join('/'))).toEqual(['src/lib/umgebung.ts'])
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

describe('darfMailEmpfangen — Post nur im Produktions-Deployment frei (fail-closed)', () => {
  const LISTE = leseTestEmpfaenger('tester@example.org, zweite@example.net')
  // Dieselbe Lage wie bei der Modus-Wache (Nr. 42): frei nur mit VERCEL_ENV=production.
  const ECHTE_PRODUKTION = { art: 'produktion', vercelProduktion: true } as const
  // Gebaut wie die Produktion, aber ohne VERCEL_ENV: lokaler Build, CI, Skripte — oder eine Produktion ohne Systemvariablen.
  const PRODUKTION_OHNE_VERCEL = { art: 'produktion', vercelProduktion: false } as const
  const NICHT_FREI = [
    { art: 'preview', vercelProduktion: false },
    { art: 'lokal', vercelProduktion: false },
    PRODUKTION_OHNE_VERCEL,
  ] as const
  const name = (u: { art: string; vercelProduktion: boolean }): string => `${u.art}${u.vercelProduktion ? '+vercel' : ''}`

  it('Produktions-Deployment bei Vercel: jede Adresse — eine echte Bestellbestätigung hängt an keiner Liste', () => {
    expect(darfMailEmpfangen('kundin@example.org', ECHTE_PRODUKTION, new Set())).toBe(true)
    expect(darfMailEmpfangen('Kundin@Beispiel.example', ECHTE_PRODUKTION, LISTE)).toBe(true)
  })

  it('wie die Produktion gebaut, aber ohne VERCEL_ENV=production: gesperrt wie außerhalb', () => {
    expect(darfMailEmpfangen('kundin@example.org', PRODUKTION_OHNE_VERCEL, new Set())).toBe(false)
    expect(darfMailEmpfangen('bauer-01@example.com', PRODUKTION_OHNE_VERCEL, new Set())).toBe(true)
    expect(darfMailEmpfangen('tester@example.org', PRODUKTION_OHNE_VERCEL, LISTE)).toBe(true)
  })

  it('außerhalb: Adressen aus TEST_EMPFAENGER, ohne Rücksicht auf Groß-/Kleinschreibung und Ränder', () => {
    for (const u of NICHT_FREI) {
      expect(darfMailEmpfangen('tester@example.org', u, LISTE), name(u)).toBe(true)
      expect(darfMailEmpfangen('  ZWEITE@example.NET ', u, LISTE), name(u)).toBe(true)
    }
  })

  it('außerhalb: jede Adresse der Domain example.com, auch ohne Liste', () => {
    for (const u of NICHT_FREI) {
      expect(darfMailEmpfangen('bauer-01@example.com', u, new Set()), name(u)).toBe(true)
      expect(darfMailEmpfangen('Admin@EXAMPLE.com', u, new Set()), name(u)).toBe(true)
    }
  })

  it('außerhalb: alles andere nicht', () => {
    for (const u of NICHT_FREI) {
      expect(darfMailEmpfangen('kundin@example.org', u, LISTE), name(u)).toBe(false)
      expect(darfMailEmpfangen('tester@example.org', u, new Set()), name(u)).toBe(false)
    }
  })

  it('außerhalb: nur genau example.com — keine Unterdomain, keine angehängte Domain', () => {
    // Die Unterdomain fängt auch ein naives endsWith('example.com') — ohne fremde .com-Domain im Test.
    for (const adresse of ['x@sub.example.com', 'x@example.com.example.org', 'x@example.comx']) {
      expect(darfMailEmpfangen(adresse, NICHT_FREI[0], new Set()), adresse).toBe(false)
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
      expect(darfMailEmpfangen(adresse, NICHT_FREI[0], LISTE), adresse).toBe(false)
    }
  })
})

describe('sperrtTrotzProduktion — wann die Sperre gemeldet wird (Sicherheitsnetz)', () => {
  it('nur, wenn die App sich für die Produktion hält und VERCEL_ENV=production fehlt', () => {
    expect(sperrtTrotzProduktion({ art: 'produktion', vercelProduktion: false })).toBe(true)
  })

  it('nie im Produktions-Deployment, in der Vorschau oder lokal — dort ist die Sperre gewollt bzw. aus', () => {
    expect(sperrtTrotzProduktion({ art: 'produktion', vercelProduktion: true })).toBe(false)
    expect(sperrtTrotzProduktion({ art: 'preview', vercelProduktion: false })).toBe(false)
    expect(sperrtTrotzProduktion({ art: 'lokal', vercelProduktion: false })).toBe(false)
  })

  it('kommt aus bestimmeUmgebung: lokaler Produktions-Build ja, Produktion bei Vercel nein', () => {
    expect(sperrtTrotzProduktion(bestimmeUmgebung({ NODE_ENV: 'production' }))).toBe(true)
    expect(sperrtTrotzProduktion(bestimmeUmgebung({ NODE_ENV: 'production', VERCEL_ENV: 'production' }))).toBe(false)
  })
})
