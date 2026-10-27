/**
 * Befund aus Nr. 69, behoben in Nr. 67: Die Bildadresse in den Metadaten der
 * Hofseite (`?v=`, ladeTeilenVorschau) trägt dieselbe Prüfsumme wie die
 * Bild-Route — auch bei Höfen mit eigenem Produktfoto. Vorher rechnete die
 * Seite ohne Fotos und die Route mit: Das Open-Graph-Bild dieser Höfe lag
 * deshalb nur 60 s im CDN statt eines Tages.
 *
 * Geprüft wird über die echte Route (Kopf `cache-control`), nicht über eine
 * nachgebaute Rechnung — weicht eine Seite ab, wird der Test rot.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { Decimal } from '@prisma/client/runtime/index-browser'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn() },
    product: { findMany: vi.fn(async () => []) },
    statusPost: { findUnique: vi.fn(async () => null) },
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
// Fotos und Schriften lädt der Lader (eigene Tests); hier zählt nur der Zwischenspeicher.
vi.mock('@/lib/teilen-bild-quellen', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/teilen-bild-quellen')>()),
  ladeTeilenBildBilder: vi.fn(async () => ({ produkte: {}, held: null, ersatz: false })),
  ladeTeilenBildSchriften: vi.fn(async () => []),
}))
vi.mock('next/og', () => ({
  ImageResponse: vi.fn(function (this: unknown, _el: unknown, optionen: { headers?: Record<string, string> }) {
    // Ein echtes PNG (ein Bildpunkt): Die Route wandelt es in JPEG um (Register T7); Text als Körper wäre ein 503.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQI12P4/fMTAAXZAudwTgkGAAAAAElFTkSuQmCC', 'base64')
    return new Response(png, { headers: { 'content-type': 'image/png', ...optionen.headers } })
  }),
}))

// Seit Nr. 196 liest das Teilen-Bild die Zeile der Hofseite (getPublicFarmMitTeilen); die Hilfe füllt den Rest.
import { hofseitenZeile } from './hofseiten-zeile'
import { prisma } from '@/lib/prisma'
import { teilenBildVersion } from '@/lib/teilen-bild'
import { teilenVorschauAus } from '@/server/queries/teilen-bild'
import { getPublicFarmMitTeilen } from '@/server/queries/farm'

/** Der Weg der Metadaten der Hofseite (Nr. 196): der Hof des Laders (getPublicFarmMitTeilen), daraus teilenVorschauAus. */
async function ladeTeilenVorschau(slug: string, jetzt: Date) {
  const hof = await getPublicFarmMitTeilen({ slug })
  return hof ? teilenVorschauAus(hof, jetzt) : null
}
import { GET as bildRoute } from '@/app/(public)/[farmSlug]/opengraph-image/route'

const SPEICHER = 'https://testspeicher.public.blob.vercel-storage.com/farms/farm-1/product'
const JETZT = new Date('2026-10-07T08:00:00Z')
const LANG = 's-maxage=86400'
const KURZ = 'public, max-age=60, s-maxage=60'

/** Ein öffentlicher Hof mit einem Produkt; `imageUrl` ist sein Foto (oder keins). */
function stelleHof(imageUrl: string | null) {
  vi.mocked(prisma.farm.findUnique).mockResolvedValue(hofseitenZeile({
    id: 'farm-1',
    name: 'Hof Test',
    slug: 'hof-test',
    city: 'Teststadt',
    isPaused: false,
    betriebsnummer: null,
    betriebsstatus: null,
    products: [
      { id: 'eier', name: 'Freilandeier', price: new Decimal('4.50'), isAvailable: true, stock: 3, familieId: null, category: 'EIER', verpackung: null, imageUrl },
    ],
    // Ohne Abholfenster hängt der Inhalt nicht an der Uhr — Route (Systemuhr) und Seite (JETZT) rechnen gleich.
    pickupSlots: [],
  }) as never)
  // Die Route liest die Produktfotos selbst (ladeBildQuelle in route.tsx).
  vi.mocked(prisma.product.findMany).mockResolvedValue((imageUrl ? [{ id: 'eier', imageUrl }] : []) as never)
}

async function vorschau() {
  const geladen = await ladeTeilenVorschau('hof-test', JETZT)
  if (!geladen) throw new Error('erwartet einen öffentlichen Hof')
  return geladen
}

const bildMitVersion = (v: string) =>
  bildRoute(new NextRequest(`http://localhost/hof-test/opengraph-image?v=${v}`), { params: Promise.resolve({ farmSlug: 'hof-test' }) })

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_testspeicher_geheim')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Prüfsumme der Metadaten = Prüfsumme der Bild-Route (Befund aus Nr. 69)', () => {
  it('Hof mit eigenem Foto: die Version der Seite passt — das Bild bleibt lange im Zwischenspeicher', async () => {
    stelleHof(`${SPEICHER}/1.webp`)
    const { daten, version } = await vorschau()
    expect((await bildMitVersion(version)).headers.get('cache-control')).toContain(LANG)
    // Gegenprobe: die alte Rechnung ohne Fotos passt nicht und bekäme nur den kurzen Zwischenspeicher.
    const ohneFotos = teilenBildVersion(daten)
    expect(ohneFotos).not.toBe(version)
    expect((await bildMitVersion(ohneFotos)).headers.get('cache-control')).toBe(KURZ)
  })

  it('ein neues Foto ergibt eine neue Version; ein Foto von fremdem Speicher zählt wie keins (wie in der Route)', async () => {
    stelleHof(`${SPEICHER}/1.webp`)
    const erste = (await vorschau()).version
    stelleHof(`${SPEICHER}/2.webp`)
    const neue = (await vorschau()).version
    expect(neue).not.toBe(erste)
    expect((await bildMitVersion(neue)).headers.get('cache-control')).toContain(LANG)

    stelleHof('https://fremd.public.blob.vercel-storage.com/farms/farm-1/product/1.webp')
    const fremd = (await vorschau()).version
    stelleHof(null)
    expect(fremd).toBe((await vorschau()).version)
    expect((await bildMitVersion(fremd)).headers.get('cache-control')).toContain(LANG)
  })
})
