/**
 * /sitemap.xml und die Canonicals der festen Seiten (Nr. 117).
 *
 * Beweist:
 *  - Die Sitemap fragt nur Höfe, die auch indexiert werden: öffentlich
 *    und kein Testhof (IN_LISTEN_SICHTBAR, Register N21), mindestens ein Produkt
 *    im Shop — ein nur aus der Gründung ausgenommener Hof steht drin (Nr. 119) —
 *    und von ihnen nur die Produkte im Shop.
 *  - Volle Adressen aus der Basis von metadataBase; lastModified je Hof (das
 *    jüngste Datum von Hof und Produkten) und je Produkt.
 *  - Keine private Seite (Abgleich mit PRIVATE_BEREICHE aus src/lib/robots.ts,
 *    derselben Liste wie robots.txt), keine Token-Seite, keine Adresse mit Parametern.
 *  - Scheitert die Abfrage, bleiben die festen Seiten (gemeldet), kein Wurf.
 *  - Canonical auf Startseite, /fuer-hoefe, /konditionen und den Rechtstexten;
 *    /hoefe teilt sich wie die Startseite; lang="de-AT".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const db = vi.hoisted(() => ({ hoefe: [] as unknown[], fehler: null as Error | null, argumente: [] as unknown[] }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: {
      findMany: async (argument: unknown) => {
        db.argumente.push(argument)
        if (db.fehler) throw db.fehler
        return db.hoefe
      },
    },
  },
}))
// Die Sitemap braucht den Lader nicht; seo.ts bindet ihn für die Hofseite ein.
vi.mock('@/server/hofseite-vorschau', () => ({ ladeHofseiteGeteilt: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('next/navigation', () => ({ unstable_rethrow: () => {} }))
// Die Adresse der App je Fall (wie tests/robots.test.ts): Die Sitemap liest sie beim Aufruf.
const umgebung = vi.hoisted(() => ({ appUrl: 'https://hof.example' as string | null }))
vi.mock('@/lib/umgebung-server', async (original) => {
  const echt = await original<typeof import('@/lib/umgebung-server')>()
  return { ...echt, UMGEBUNG: Object.assign(umgebung, { ...echt.UMGEBUNG, appUrl: umgebung.appUrl }) }
})

import sitemap, { revalidate } from '@/app/sitemap'
import * as Sentry from '@sentry/nextjs'
import { PRIVATE_BEREICHE } from '@/lib/robots'
import { IN_LISTEN_SICHTBAR } from '@/server/queries/farm'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')
const FESTE = ['/', '/hoefe', '/fuer-hoefe', '/konditionen', '/agb', '/datenschutz', '/impressum']
const tag = (t: number) => new Date(Date.UTC(2026, 9, t))

beforeEach(() => {
  vi.clearAllMocks()
  db.fehler = null
  db.argumente = []
  db.hoefe = [
    { slug: 'hof-test', updatedAt: tag(1), products: [{ id: 'p_1', updatedAt: tag(5) }, { id: 'p_2', updatedAt: tag(3) }] },
    { slug: 'sonnhof', updatedAt: tag(9), products: [{ id: 'p_3', updatedAt: tag(2) }] },
  ]
})

/** Der Pfad einer Sitemap-Adresse. */
const pfad = (url: string) => new URL(url).pathname

describe('Sitemap', () => {
  it('stündlich neu gebaut', () => {
    expect(revalidate).toBe(3600)
  })

  it('fragt nur Höfe, die indexiert werden — öffentlich, kein Testhof, mit Produkt im Shop — und deren Produkte im Shop', async () => {
    await sitemap()
    expect(db.argumente).toEqual([
      expect.objectContaining({
        // EXAKT: kein gruendungAusgenommen mehr — ein ausgenommener echter Hof steht in der Sitemap (Register N21).
        where: { ...IN_LISTEN_SICHTBAR, products: { some: { isAvailable: true } } },
        select: expect.objectContaining({ products: expect.objectContaining({ where: { isAvailable: true } }) }),
      }),
    ])
  })

  it('die festen Seiten, jede Hofseite und ihre Produktseiten — volle Adressen aus der Basis von metadataBase', async () => {
    const urls = (await sitemap()).map((e) => e.url)
    expect(urls).toEqual([
      ...FESTE.map((p) => `https://hof.example${p}`),
      'https://hof.example/hof-test',
      'https://hof.example/hof-test/produkt/p_1',
      'https://hof.example/hof-test/produkt/p_2',
      'https://hof.example/sonnhof',
      'https://hof.example/sonnhof/produkt/p_3',
    ])
  })

  it('lastModified: der Hof mit dem jüngsten Datum von Hof und Produkten, jedes Produkt mit seinem', async () => {
    const eintraege = await sitemap()
    const datum = (url: string) => eintraege.find((e) => e.url === url)?.lastModified
    expect(datum('https://hof.example/hof-test')).toEqual(tag(5))
    expect(datum('https://hof.example/sonnhof')).toEqual(tag(9))
    expect(datum('https://hof.example/hof-test/produkt/p_2')).toEqual(tag(3))
  })

  it('keine private Seite (Liste aus robots.ts), keine Token-Seite, keine Adresse mit Parametern', async () => {
    const urls = (await sitemap()).map((e) => e.url)
    for (const url of urls) {
      const p = pfad(url)
      for (const bereich of PRIVATE_BEREICHE) {
        expect(p === bereich || p.startsWith(`${bereich}/`), `${url} liegt in ${bereich}`).toBe(false)
      }
      expect(url, url).not.toContain('?')
      expect(p, url).not.toMatch(/\/(?:checkout|confirm|bestellung|bestaetigen|opengraph-image)(?:\/|$)/)
    }
    // Gegenprobe: Die Prüfung schlägt an einer privaten Adresse an.
    expect(PRIVATE_BEREICHE.some((b) => '/teilen/abc'.startsWith(`${b}/`))).toBe(true)
  })

  it('scheitert die Abfrage, bleiben die festen Seiten — gemeldet, kein Wurf (Bau ohne Datenbank)', async () => {
    db.fehler = new Error('keine Verbindung')
    const urls = (await sitemap()).map((e) => e.url)
    expect(urls).toEqual(FESTE.map((p) => `https://hof.example${p}`))
    expect(Sentry.captureException).toHaveBeenCalledWith(db.fehler, { tags: { bereich: 'sitemap' } })
  })

  it('ohne bekannte Basis eine leere Liste — eine relative Adresse wäre ungültig (wie robots.ts ohne „Sitemap:")', async () => {
    umgebung.appUrl = null
    try {
      expect(await sitemap()).toEqual([])
      expect(db.argumente).toEqual([])
    } finally {
      umgebung.appUrl = 'https://hof.example'
    }
    // Gegenprobe: Mit Basis stehen die Seiten wieder da, jede als volle Adresse.
    const urls = (await sitemap()).map((e) => e.url)
    expect(urls.length).toBeGreaterThan(FESTE.length)
    for (const url of urls) expect(url, url).toMatch(/^https:\/\/hof\.example\//)
  })
})

describe('„im Shop“ hat EINE Quelle (Sammel-PR 117/116)', () => {
  it('seo.ts nutzt IM_SHOP_WHERE aus den Einstellungen statt einer eigenen Bedingung', () => {
    const seo = quelle('src/server/queries/seo.ts')
    expect(seo).toMatch(/import \{[^}]*\bIM_SHOP_WHERE\b[^}]*\} from '\.\/einstellungen'/)
    expect(seo).not.toMatch(/isAvailable:\s*true/)
    // Gegenprobe: Die Quelle selbst trägt die Bedingung.
    expect(quelle('src/server/queries/einstellungen.ts')).toMatch(/export const IM_SHOP_WHERE = \{ isAvailable: true \}/)
  })
})

describe('Canonical und Sprache der festen Seiten', () => {
  const SEITEN: Record<string, string> = {
    'src/app/page.tsx': '/',
    'src/app/(public)/fuer-hoefe/page.tsx': '/fuer-hoefe',
    'src/app/(public)/konditionen/page.tsx': '/konditionen',
    'src/app/(public)/agb/page.tsx': '/agb',
    'src/app/(public)/datenschutz/page.tsx': '/datenschutz',
    'src/app/(public)/impressum/page.tsx': '/impressum',
    'src/app/(public)/hoefe/page.tsx': '/hoefe',
  }
  const canonical = (text: string) => /alternates:\s*\{\s*canonical:\s*'([^']*)'\s*\}/.exec(text)?.[1]

  it('jede feste öffentliche Seite nennt sich selbst als Canonical, ohne Parameter', () => {
    for (const [datei, erwartet] of Object.entries(SEITEN)) expect(canonical(quelle(datei)), datei).toBe(erwartet)
    // Gegenprobe: Die Suche findet nichts, wo nichts steht.
    expect(canonical("export const metadata = { title: 'x' }")).toBeUndefined()
  })

  it('/hoefe teilt sich wie die Startseite — Titel, Beschreibung, dasselbe Bild, de_AT', async () => {
    const { metadata } = await import('@/app/(public)/hoefe/page')
    const og = metadata.openGraph as { title?: string; description?: string; locale?: string; images?: unknown[] }
    expect(og.title).toBe(metadata.title)
    expect(og.description).toBe(metadata.description)
    expect(og.locale).toBe('de_AT')
    expect(JSON.stringify(og.images)).toContain('/og/startseite.jpg')
  })

  it('Startseite und /fuer-hoefe nennen de_AT im eigenen openGraph — es ersetzt das des Layouts ganz', async () => {
    const seiten = { '/': await import('@/app/page'), '/fuer-hoefe': await import('@/app/(public)/fuer-hoefe/page') }
    for (const [pfad, { metadata }] of Object.entries(seiten)) {
      expect((metadata.openGraph as { locale?: string } | undefined)?.locale, pfad).toBe('de_AT')
    }
  })

  it('das Root-Layout spricht de-AT — im <html> und in Open Graph', () => {
    const layout = quelle('src/app/layout.tsx')
    expect(layout).toMatch(/lang="de-AT"/)
    expect(layout).toMatch(/openGraph:\s*\{\s*locale:\s*OG_LOCALE\s*\}/)
    expect(quelle('src/lib/json-ld.ts')).toMatch(/export const OG_LOCALE = 'de_AT'/)
  })
})
