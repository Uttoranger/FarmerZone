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
import { describe, expect, it, vi } from 'vitest'
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
  it('Korb-Blatt: 56 px, kein rohes img', () => {
    const t = lies('src/components/farm/cart-sheet.tsx')
    expect(t).toMatch(/import Image from 'next\/image'/)
    expect(t).not.toMatch(/<img\b/)
    expect(t).toMatch(/<Image [^>]*sizes="56px"/)
  })

  it('Produktliste: kleine Rahmen, kein rohes img', () => {
    const t = lies('src/components/produkte/produkte-ansicht.tsx')
    expect(t).toMatch(/import Image from 'next\/image'/)
    expect(t).not.toMatch(/<img\b/)
    expect(t.match(/<Image [^>]*sizes=\{PRODUKT_BILD_SIZES\}/g)).toHaveLength(2)
    expect(t).toMatch(/PRODUKT_BILD_SIZES = '48px'/)
  })
})

describe('Hofseite: Unabhängiges läuft gleichzeitig', () => {
  it('Seite: Beiträge und Nachbestell-Artikel über Promise.all', () => {
    const t = lies('src/app/(public)/[farmSlug]/page.tsx')
    expect(t).toMatch(/Promise\.all\(\[\s*ladeBeitraege\(/)
  })

  it('Metadaten: Hof und Teilen-Vorschau über Promise.all', () => {
    const t = lies('src/app/(public)/[farmSlug]/page.tsx')
    expect(t).toMatch(/Promise\.all\(\[\s*ladeHofseiteGeteilt\(/)
  })
})

describe('ladeHofseite: volle Tage und Abzeichen-Blatt gleichzeitig', () => {
  it('beide Abfragen sind gestartet, bevor eine antwortet', async () => {
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
    const { ladeHofseite } = await import('@/server/hofseite-vorschau')
    const ergebnis = ladeHofseite('hof-a', {})
    await vi.waitFor(() => expect(gestartet.sort()).toEqual(['blatt', 'tage']))
    ende()
    expect((await ergebnis).farm?.id).toBe('f1')
    vi.doUnmock('@/server/abholfenster')
    vi.doUnmock('@/server/queries/plattform-einstellung')
    vi.resetModules()
  })
})
