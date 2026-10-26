/**
 * Leistung ohne Paket (Nachtlauf 25, Nr. 180). Beweist am Quelltext und am
 * Verhalten:
 *  - Zod liegt nicht im Bündel jeder Seite: Die Shells und der Rückweg-Merker
 *    importieren nichts aus src/schemas; die kleinen Prüfungen sind rein und
 *    verhalten sich wie die Schemas.
 *  - Stripe.js lädt erst, wenn die Zahlung online gewählt ist.
 *  - Die Bilder im Korb-Blatt und in der Produktliste laufen über next/image.
 *  - Die Hofseite holt Unabhängiges gleichzeitig.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { hinaufEintraegeAus } from '@/lib/kunden-kopf'
import { hinaufEintraegeSchema } from '@/schemas/rueckweg'
import { SUCHTEXT_PARAMETER } from '@/lib/suchtext-parameter'
import { SUCHTEXT_PARAMETER as AUS_SCHEMA } from '@/schemas/hoefe-filter'

const lies = (pfad: string): string => readFileSync(join(process.cwd(), pfad), 'utf8')

/** Importiert der Quelltext (außer `import type`) etwas aus src/schemas? */
const importiertSchemas = (text: string): boolean => /^\s*import\s+(?!type\b)[^;]*?from\s*['"]@\/schemas\//m.test(text)

describe('Zod bleibt aus dem Bündel jeder Seite', () => {
  const dateien = [
    ...readdirSync(join(process.cwd(), 'src/components/shells'))
      .filter((n) => n.endsWith('.tsx'))
      .map((n) => `src/components/shells/${n}`),
    'src/components/shared/rueckweg-merker.tsx',
  ]

  it('die Spürprobe findet einen Schema-Import und lässt einen Typ-Import durch (Gegenprobe)', () => {
    expect(importiertSchemas("import { SUCHTEXT_PARAMETER } from '@/schemas/hoefe-filter'")).toBe(true)
    expect(importiertSchemas("import type { X } from '@/schemas/hoefe-filter'")).toBe(false)
  })

  it.each(dateien)('%s importiert nichts aus src/schemas', (pfad) => {
    expect(importiertSchemas(lies(pfad))).toBe(false)
  })

  it('der Suchtext-Parameter hat eine Quelle ohne Zod, das Schema nimmt dieselbe', () => {
    expect(SUCHTEXT_PARAMETER).toBe('q')
    expect(AUS_SCHEMA).toBe(SUCHTEXT_PARAMETER)
    expect(lies('src/lib/suchtext-parameter.ts')).not.toMatch(/zod|@\/schemas/)
  })

  it('hinaufEintraegeAus prüft wie das Schema: Gültiges bleibt, alles andere ist leer', () => {
    const faelle: unknown[] = [
      ['a', 'b'],
      [],
      [''],
      ['x'.repeat(101)],
      ['x'.repeat(100)],
      Array.from({ length: 51 }, (_, i) => `k${i}`),
      Array.from({ length: 50 }, (_, i) => `k${i}`),
      [1, 'a'],
      'text',
      null,
      undefined,
      { 0: 'a' },
    ]
    for (const roh of faelle) expect(hinaufEintraegeAus(roh)).toEqual(hinaufEintraegeSchema.parse(roh))
    expect(hinaufEintraegeAus(['a'])).toEqual(['a'])
    expect(hinaufEintraegeAus([1, 'a'])).toEqual([])
  })
})

describe('Stripe.js lädt erst bei Online-Zahlung', () => {
  const zahlung = lies('src/components/checkout/stripe-payment.tsx')

  it('kein Aufruf auf Modulebene, der Aufruf steckt in der Komponente', () => {
    const amModul = /^(?:const|let)\s+\w+\s*=\s*getStripePromise\(\)/m
    // Gegenprobe: Das Muster findet den alten Stand.
    expect('const stripePromise = getStripePromise()\n').toMatch(amModul)
    expect(zahlung).not.toMatch(amModul)
    expect(zahlung).toMatch(/export function StripeZahlung[\s\S]*getStripePromise\(\)/)
  })

  it('das Paket kommt über den Eingang ohne eigenes Laden beim Import', () => {
    expect(lies('src/lib/stripe-client.ts')).toMatch(/from '@stripe\/stripe-js\/pure'/)
  })
})

describe('Bilder über next/image', () => {
  /** Rohes img oder ein `<Image>` ohne `sizes` — der alte Stand. */
  const altesBild = /<img\b|<Image (?![^>]*\bsizes=)[^>]*>/

  it('die Spürprobe erkennt den alten Stand (Gegenprobe)', () => {
    expect('<img src={x} alt="" className="size-14" />').toMatch(altesBild)
    expect('<Image src={x} alt="" fill />').toMatch(altesBild)
    expect('<Image src={x} alt="" fill sizes="56px" />').not.toMatch(altesBild)
  })

  it('Korb-Blatt: 56 px, kein rohes img', () => {
    const t = lies('src/components/farm/cart-sheet.tsx')
    expect(t).toMatch(/import Image from 'next\/image'/)
    expect(t).not.toMatch(altesBild)
    expect(t).toMatch(/<Image [^>]*sizes="56px"/)
  })

  it('Produktliste: kleine Rahmen (44 px), kein rohes img', () => {
    const t = lies('src/components/produkte/produkte-ansicht.tsx')
    expect(t).toMatch(/import Image from 'next\/image'/)
    expect(t).not.toMatch(altesBild)
    expect(t.match(/<Image [^>]*sizes=\{PRODUKT_BILD_SIZES\}/g)).toHaveLength(2)
    expect(t).toMatch(/PRODUKT_BILD_SIZES = '44px'/)
  })
})

describe('Hofseite: Unabhängiges läuft gleichzeitig', () => {
  const seite = lies('src/app/(public)/[farmSlug]/page.tsx')
  const nacheinander = /await ladeBeitraege\(|await ladeTeilenVorschauOhneRisiko\(/

  it('die Spürprobe erkennt das Nacheinander (Gegenprobe)', () => {
    expect('const b = await ladeBeitraege(farm.id, k)').toMatch(nacheinander)
    expect('const v = await ladeTeilenVorschauOhneRisiko(slug)').toMatch(nacheinander)
  })

  it('Seite: Beiträge und Nachbestell-Artikel über Promise.all, Beiträge vom Lader vorab gestartet', () => {
    expect(seite).toMatch(/Promise\.all\(\[\s*ladeBeitraege\(/)
    expect(seite).not.toMatch(nacheinander)
    expect(seite.match(/ladeHofseiteGeteilt\(farmSlug, suche, vorab\(suche\)\)/g)).toHaveLength(2)
  })

  it('Metadaten: Hof und Teilen-Vorschau über Promise.all', () => {
    expect(seite).toMatch(/Promise\.all\(\[\s*ladeHofseiteGeteilt\(/)
  })
})

describe('ladeHofseite: volle Tage, Abzeichen-Blatt und Beiträge gleichzeitig', () => {
  const MODULE = [
    'next/headers',
    '@/lib/auth',
    '@/lib/prisma',
    '@/server/verwaiste-bestellungen',
    '@/server/queries/farm',
    '@/server/abholfenster',
    '@/server/queries/plattform-einstellung',
    'react',
  ]
  afterEach(() => {
    for (const m of MODULE) vi.doUnmock(m)
    vi.resetModules()
  })

  /** Hof mit offenen Abfragen: `gestartet` füllt sich, bis `ende()` sie alle beantwortet. */
  async function lader(optionen: { memo?: boolean } = {}) {
    vi.resetModules()
    const gestartet: string[] = []
    let ende: () => void = () => {}
    const warten = new Promise<void>((r) => {
      ende = r
    })
    vi.doMock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
    vi.doMock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
    vi.doMock('@/lib/prisma', () => ({ prisma: {} }))
    vi.doMock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteFreiFuerSlug: vi.fn() }))
    vi.doMock('@/server/queries/farm', () => ({
      getHofBesitzer: vi.fn(),
      getOwnerFarm: vi.fn(),
      getPublicFarm: vi.fn(async () => ({ id: 'f1', slug: 'hof-a', pickupSlots: [], gruendungshof: true })),
    }))
    vi.doMock('@/server/abholfenster', () => ({
      alsAbholFenster: vi.fn(),
      ausgebuchteTage: vi.fn(async () => {
        gestartet.push('tage')
        await warten
        return new Map()
      }),
    }))
    vi.doMock('@/server/queries/plattform-einstellung', () => ({
      ladeAbzeichenBlatt: vi.fn(async () => {
        gestartet.push('blatt')
        await warten
        return null
      }),
    }))
    if (optionen.memo) {
      // Ohne Anfrage merkt sich React `cache` nichts; hier merkt es sich die Aufrufe wie auf dem Server.
      vi.doMock('react', async (original) => ({
        ...(await original<typeof import('react')>()),
        cache: <A extends unknown[], R>(fn: (...a: A) => R) => {
          const gemerkt = new Map<string, R>()
          return (...a: A): R => {
            const schluessel = JSON.stringify(a)
            if (!gemerkt.has(schluessel)) gemerkt.set(schluessel, fn(...a))
            return gemerkt.get(schluessel) as R
          }
        },
      }))
    }
    const modul = await import('@/server/hofseite-vorschau')
    return { modul, gestartet, ende }
  }

  it('Tage und Blatt sind gestartet, bevor eine antwortet', async () => {
    const { modul, gestartet, ende } = await lader()
    const ergebnis = modul.ladeHofseite('hof-a', {})
    await vi.waitFor(() => expect([...gestartet].sort()).toEqual(['blatt', 'tage']))
    ende()
    expect((await ergebnis).farm?.id).toBe('f1')
  })

  it('die Beiträge starten mit der Hof-ID, ohne auf die vollen Tage zu warten', async () => {
    const { modul, gestartet, ende } = await lader()
    const vorab = vi.fn(async (hofId: string) => {
      gestartet.push(`beitraege:${hofId}`)
      await new Promise((r) => setTimeout(r, 0))
    })
    const ergebnis = modul.ladeHofseite('hof-a', {}, vorab)
    // Die vollen Tage antworten noch nicht — und die Beiträge laufen schon.
    await vi.waitFor(() => expect([...gestartet].sort()).toEqual(['beitraege:f1', 'blatt', 'tage']))
    ende()
    expect((await ergebnis).farm?.id).toBe('f1')
    expect(vorab).toHaveBeenCalledTimes(1)
  })

  it('ohne Hof (404) starten die Beiträge nicht', async () => {
    const { modul } = await lader()
    const farm = await import('@/server/queries/farm')
    vi.mocked(farm.getPublicFarm).mockResolvedValueOnce(null)
    const vorab = vi.fn(async () => {})
    expect((await modul.ladeHofseite('hof-a', {}, vorab)).farm).toBeNull()
    expect(vorab).not.toHaveBeenCalled()
  })

  it('ladeHofseiteGeteilt: Metadaten und Seite geben dasselbe mit, geladen wird einmal, die Beiträge starten einmal', async () => {
    const { modul, ende } = await lader({ memo: true })
    ende()
    const farm = await import('@/server/queries/farm')
    const vorab = vi.fn(async () => {})
    const [a, b] = await Promise.all([modul.ladeHofseiteGeteilt('hof-a', {}, vorab), modul.ladeHofseiteGeteilt('hof-a', {}, vorab)])
    expect(a).toBe(b)
    expect(farm.getPublicFarm).toHaveBeenCalledTimes(1)
    expect(vorab).toHaveBeenCalledTimes(1)
    expect(vorab).toHaveBeenCalledWith('f1')
  })
})
