/**
 * Tests für das Teilen-Bild als JPEG (Register T7, Nr. 76).
 *
 * Beweist, über die echte Route (Satori und resvg zeichnen wirklich; nur
 * Datenbank, Fotos und Sentry sind Attrappen):
 *  - Die Route liefert ein JPEG — Content-Type image/jpeg, der Körper beginnt
 *    mit FF D8 FF und endet mit FF D9 — in den Maßen des Formats, nie das PNG
 *    von Satori.
 *  - Der Zwischenspeicher bleibt, wie er war.
 *  - Scheitert die Umwandlung, kommt derselbe 503-Pfad wie bei einem Fehler im
 *    Zeichnen: ohne Zwischenspeicher, Sentry nur mit der Kennung des Hofs,
 *    nie ein 200 mit kaputtem Körper.
 *  - Dateiname und Typ des Teilen-Bilds stehen an EINER Stelle
 *    (`TEILEN_BILD_TYP`): Route, Teilen-Fenster und Open-Graph-Angabe lesen sie.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { Decimal } from '@prisma/client/runtime/index-browser'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findFirst: vi.fn() },
    product: { findMany: vi.fn(async () => []) },
    statusPost: { findUnique: vi.fn(async () => null) },
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
// Fotos holt der Lader (eigene Tests); die Schriften liest er echt vom Dateisystem — ohne Netz.
vi.mock('@/lib/teilen-bild-quellen', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/teilen-bild-quellen')>()),
  ladeTeilenBildBilder: vi.fn(async () => ({ produkte: {}, held: null, ersatz: false })),
}))
// next/og zeichnet echt; die Hülle erlaubt einem Test, den Körper zu ersetzen.
vi.mock('next/og', async (importOriginal) => {
  const echt = await importOriginal<typeof import('next/og')>()
  return {
    ImageResponse: vi.fn(function (this: unknown, ...argumente: ConstructorParameters<typeof echt.ImageResponse>) {
      return new echt.ImageResponse(...argumente)
    }),
  }
})

import { prisma } from '@/lib/prisma'
import * as Sentry from '@sentry/nextjs'
import { ImageResponse } from 'next/og'
import { TEILEN_BILD_MASSE, teilenBildDateiName } from '@/lib/teilen-bild'
import { GET as bildRoute } from '@/app/(public)/[farmSlug]/opengraph-image/route'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

const HOF_ROH = {
  id: 'farm-1',
  name: 'Hof Test',
  slug: 'hof-test',
  city: 'Teststadt',
  isPaused: false,
  betriebsnummer: null,
  betriebsstatus: null,
  products: [
    { id: 'eier', name: 'Freilandeier', price: new Decimal('4.50'), isAvailable: true, stock: 3, familieId: null, category: 'EIER', verpackung: null },
  ],
  // Ohne Abholfenster hängt der Inhalt nicht an der Uhr.
  pickupSlots: [],
}

const aufruf = (suche = '') =>
  bildRoute(new NextRequest(`http://localhost/hof-test/opengraph-image${suche}`), { params: Promise.resolve({ farmSlug: 'hof-test' }) })

// Echtes Zeichnen: kalt dauert das Sekunden (Satori, resvg, Schriften, sharp), unter Last länger als die
// 5 s der Vorgabe. Einmal je Datei vorwärmen, mit eigenem Zeitlimit (TESTING_GUIDELINES §4) — die Tests
// selbst laufen dann im Standard-Limit.
beforeAll(async () => {
  vi.mocked(prisma.farm.findFirst).mockResolvedValue(HOF_ROH as never)
  await aufruf('?format=quadrat')
  await aufruf('?format=story')
  await import('sharp')
}, 30_000)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.farm.findFirst).mockResolvedValue(HOF_ROH as never)
})

describe('GET /[farmSlug]/opengraph-image — JPEG statt PNG (Register T7)', () => {
  it.each([['quadrat'], ['story']] as const)('Format %s: ein JPEG in den Maßen des Formats', async (format) => {
    const res = await aufruf(`?format=${format}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')

    const bytes = new Uint8Array(await res.arrayBuffer())
    // Beginn (SOI + erster Marker) und Ende (EOI) eines JPEG — ein PNG begänne mit 89 50 4E 47.
    expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff])
    expect([...bytes.subarray(-2)]).toEqual([0xff, 0xd9])

    const { default: sharp } = await import('sharp')
    const meta = await sharp(bytes).metadata()
    expect({ format: meta.format, width: meta.width, height: meta.height }).toEqual({ format: 'jpeg', ...TEILEN_BILD_MASSE[format] })
  })

  it('ohne Prüfsumme nur der kurze Zwischenspeicher, neben dem neuen Typ', async () => {
    const res = await aufruf()
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    expect(res.headers.get('cache-control')).toBe('public, max-age=60, s-maxage=60')
  })

  it('kann die Umwandlung das Bild nicht lesen, kommt 503 ohne Zwischenspeicher — kein 200 mit kaputtem Körper', async () => {
    // Was Satori nicht als Bild geliefert hat, kann sharp nicht umwandeln.
    vi.mocked(ImageResponse).mockImplementationOnce(function () {
      return new Response('kein Bild', { headers: { 'content-type': 'image/png' } })
    })
    const res = await aufruf()
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('content-type')).not.toBe('image/jpeg')
    const [, kontext] = vi.mocked(Sentry.captureException).mock.calls[0]
    expect(kontext).toEqual({ tags: { bereich: 'teilen-bild', farmId: 'farm-1', slug: 'hof-test' } })
  })
})

describe('Dateiname des Teilen-Bilds', () => {
  it('endet auf .jpg: Story als Status, 1:1 als Beitrag', () => {
    expect(teilenBildDateiName('hof-test', 'story')).toBe('hof-test-status.jpg')
    expect(teilenBildDateiName('hof-test', 'quadrat')).toBe('hof-test-beitrag.jpg')
  })
})

describe('Typ des Teilen-Bilds: EINE Quelle', () => {
  const ORTE = [
    'src/app/(public)/[farmSlug]/opengraph-image/route.tsx',
    'src/components/teilen/teilen-fenster.tsx',
    'src/lib/vorschaubild.ts',
  ]
  // Ein Bildtyp als Zeichenkette — in Anführungszeichen, damit ein Wort im Kommentar nicht zählt.
  const BILDTYP_ALS_TEXT = /['"`]image\/(png|jpeg)['"`]/

  it.each(ORTE)('%s liest den Typ aus TEILEN_BILD_TYP und schreibt keinen eigenen', (pfad) => {
    const text = quelle(pfad)
    expect(text).toContain('TEILEN_BILD_TYP')
    expect(text).not.toMatch(BILDTYP_ALS_TEXT)
  })

  it('Gegenprobe: die Suche schlägt an, wo ein Bildtyp als Text steht (Manifest)', () => {
    expect(quelle('src/app/manifest.ts')).toMatch(BILDTYP_ALS_TEXT)
  })
})
