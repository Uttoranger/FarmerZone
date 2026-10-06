/**
 * Tests für die Prüfung gespeicherter Bild-Adressen (Nr. 19b, Morgenbericht
 * Lauf 4 §7): Jede Aktion, die eine Bild-Adresse speichert, nimmt nur fertige
 * Bilder DIESES Hofes aus UNSEREM Blob-Speicher an (`farms/<hofId>/…` auf
 * `<speicher>.public.blob.vercel-storage.com`). Vorher übernahm etwa
 * `addFarmPhotoAction` jede Zeichenkette — ein Zählpixel von fremdem Server
 * oder das Bild eines anderen Hofes stand dann auf der Hofseite.
 *
 * Die Regel selbst ist rein (`istEigeneBildUrl`, `blobSpeicherAusSchluessel`
 * in src/lib/upload-pfade.ts) und wird ohne Mock geprüft; die Aktionen mit
 * gemocktem Prisma — die Aussage ist, dass eine fremde Adresse NIE
 * geschrieben wird und eine eigene durchgeht (Gegenprobe).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@vercel/blob', () => ({ put: vi.fn(), del: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn() }))
vi.mock('@/lib/prisma', () => {
  const tx = {
    product: { updateMany: vi.fn() },
    futterKennzeichnung: { upsert: vi.fn(), deleteMany: vi.fn() },
  }
  return {
    prisma: {
      farm: { findUnique: vi.fn(), update: vi.fn() },
      farmPhoto: { count: vi.fn(), create: vi.fn() },
      farmValue: { deleteMany: vi.fn(), createMany: vi.fn() },
      product: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
      statusPost: { create: vi.fn(), findFirst: vi.fn() },
      customerFarmSubscription: { findMany: vi.fn() },
      $transaction: vi.fn(async (arg: unknown) =>
        typeof arg === 'function' ? (arg as (t: typeof tx) => Promise<unknown>)(tx) : Promise.all(arg as unknown[])
      ),
      __tx: tx,
    },
  }
})

import { blobSpeicherAusSchluessel, istEigeneBildUrl } from '@/lib/upload-pfade'
import { addFarmPhotoAction } from '@/server/actions/farm-photos'
import { saveAppearanceAction, updateFarmBannerAction, updateFarmLogoAction } from '@/server/actions/appearance'
import { createProduct, updateProduct, updateProductImageAction } from '@/server/actions/products'
import { publishStatusPost } from '@/server/actions/status-posts'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFarmForUser } from '@/server/queries/dashboard'

type Tx = { product: { updateMany: ReturnType<typeof vi.fn> } }
const tx = (prisma as unknown as { __tx: Tx }).__tx

const HOF = 'farm_meiner'
const SPEICHER = 'abc123'
const SCHLUESSEL = `vercel_blob_rw_ABC123_geheimnisNurFuerTests`
const EIGEN = `https://${SPEICHER}.public.blob.vercel-storage.com/farms/${HOF}/gallery/1.webp`
const FREMDER_HOF = `https://${SPEICHER}.public.blob.vercel-storage.com/farms/farm_fremder/gallery/1.webp`
const FREMDER_SPEICHER = `https://boese99.public.blob.vercel-storage.com/farms/${HOF}/gallery/1.webp`
const FREMDER_SERVER = `https://beispiel.at/farms/${HOF}/zaehlpixel.gif`

const FREMDE = [
  ['fremder Server', FREMDER_SERVER],
  ['fremder Blob-Speicher mit unserem Pfad', FREMDER_SPEICHER],
  ['Bild eines anderen Hofes', FREMDER_HOF],
  ['kein URL', 'javascript:alert(1)'],
] as const

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', SCHLUESSEL)
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user_1' } } as never)
  vi.mocked(getFarmForUser).mockResolvedValue({ id: HOF, slug: 'mein-hof' } as never)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('blobSpeicherAusSchluessel — welcher Speicher ist unserer?', () => {
  it('liest die Kennung aus dem Schlüssel, klein geschrieben wie der Hostname', () => {
    expect(blobSpeicherAusSchluessel(SCHLUESSEL)).toBe(SPEICHER)
  })

  it('ohne oder mit unbrauchbarem Schlüssel gibt es keinen eigenen Speicher', () => {
    expect(blobSpeicherAusSchluessel(undefined)).toBeNull()
    expect(blobSpeicherAusSchluessel('')).toBeNull()
    expect(blobSpeicherAusSchluessel('vercel_blob_rw_')).toBeNull()
    expect(blobSpeicherAusSchluessel('sk_test_platzhalter')).toBeNull()
    expect(blobSpeicherAusSchluessel('vercel_blob_rw_ab.c_x')).toBeNull()
  })
})

describe('istEigeneBildUrl — nur fertige Bilder dieses Hofes aus unserem Speicher', () => {
  it('Gegenprobe: das fertige Bild des eigenen Hofes geht durch', () => {
    expect(istEigeneBildUrl(EIGEN, HOF, SPEICHER)).toBe(true)
    expect(istEigeneBildUrl(`https://ABC123.public.blob.vercel-storage.com/farms/${HOF}/logo/1.webp`, HOF, SPEICHER)).toBe(true)
  })

  it.each(FREMDE)('lehnt ab: %s', (_fall, url) => {
    expect(istEigeneBildUrl(url, HOF, SPEICHER)).toBe(false)
  })

  it('lehnt das unverarbeitete Original ab — gespeichert wird nur das fertige Bild', () => {
    expect(istEigeneBildUrl(`https://${SPEICHER}.public.blob.vercel-storage.com/originals/${HOF}/x.jpg`, HOF, SPEICHER)).toBe(false)
  })

  it('lehnt einen kodierten Ausbruch aus dem Hof-Ordner ab', () => {
    const url = `https://${SPEICHER}.public.blob.vercel-storage.com/farms/${HOF}%2F..%2Ffarm_fremder/gallery/1.webp`
    expect(istEigeneBildUrl(url, HOF, SPEICHER)).toBe(false)
  })

  it('lehnt Anmeldedaten, Abfrage und Anker ab — unser Upload erzeugt nichts davon', () => {
    expect(istEigeneBildUrl(`https://x:y@${SPEICHER}.public.blob.vercel-storage.com/farms/${HOF}/a.webp`, HOF, SPEICHER)).toBe(false)
    expect(istEigeneBildUrl(`${EIGEN}?v=1`, HOF, SPEICHER)).toBe(false)
    expect(istEigeneBildUrl(`${EIGEN}#x`, HOF, SPEICHER)).toBe(false)
  })

  it('ohne bekannten Speicher ist nichts erlaubt (fail-closed)', () => {
    expect(istEigeneBildUrl(EIGEN, HOF, null)).toBe(false)
  })
})

describe('addFarmPhotoAction (Galerie)', () => {
  beforeEach(() => {
    vi.mocked(prisma.farm.findUnique).mockResolvedValue({ id: HOF, slug: 'mein-hof' } as never)
    vi.mocked(prisma.farmPhoto.count).mockResolvedValue(0 as never)
    vi.mocked(prisma.farmPhoto.create).mockResolvedValue({ id: 'p1', url: EIGEN, caption: null, sortOrder: 0 } as never)
  })

  it.each(FREMDE)('speichert keine fremde Adresse: %s', async (_fall, url) => {
    const ergebnis = await addFarmPhotoAction({ url })
    expect(ergebnis.error).toBeTruthy()
    expect(prisma.farmPhoto.create).not.toHaveBeenCalled()
  })

  it('ohne Blob-Schlüssel wird nichts gespeichert', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '')
    expect((await addFarmPhotoAction({ url: EIGEN })).error).toBeTruthy()
    expect(prisma.farmPhoto.create).not.toHaveBeenCalled()
  })

  it('Gegenprobe: das eigene Bild wird gespeichert', async () => {
    const ergebnis = await addFarmPhotoAction({ url: EIGEN })
    expect(ergebnis.error).toBeUndefined()
    expect(prisma.farmPhoto.create).toHaveBeenCalledTimes(1)
  })
})

describe('updateFarmLogoAction und updateFarmBannerAction', () => {
  beforeEach(() => {
    vi.mocked(prisma.farm.findUnique).mockResolvedValue({ id: HOF, slug: 'mein-hof', logoUrl: null, bannerUrl: null } as never)
  })

  it.each(FREMDE)('Logo: keine fremde Adresse (%s)', async (_fall, url) => {
    expect((await updateFarmLogoAction(url)).error).toBeTruthy()
    expect(prisma.farm.update).not.toHaveBeenCalled()
  })

  it.each(FREMDE)('Titelbild: keine fremde Adresse (%s)', async (_fall, url) => {
    expect((await updateFarmBannerAction('PHOTO', url)).error).toBeTruthy()
    expect(prisma.farm.update).not.toHaveBeenCalled()
  })

  it('Gegenprobe: eigenes Bild und Entfernen (null) gehen durch', async () => {
    expect(await updateFarmLogoAction(EIGEN)).toEqual({})
    expect(await updateFarmLogoAction(null)).toEqual({})
    expect(await updateFarmBannerAction('PHOTO', EIGEN)).toEqual({})
    expect(await updateFarmBannerAction('GRADIENT', null)).toEqual({})
    expect(prisma.farm.update).toHaveBeenCalledTimes(4)
  })
})

describe('saveAppearanceAction (Hofseiten-Editor schickt Logo und Titelbild mit)', () => {
  const auftritt = (teil: Record<string, unknown>) => ({ sectionsConfig: [], farmValues: [], ...teil })

  it('speichert keine neue fremde Adresse', async () => {
    vi.mocked(prisma.farm.findUnique).mockResolvedValue({ id: HOF, slug: 'mein-hof', logoUrl: null, bannerUrl: null } as never)
    expect((await saveAppearanceAction(auftritt({ logoUrl: FREMDER_SERVER }))).error).toBeTruthy()
    expect((await saveAppearanceAction(auftritt({ bannerUrl: FREMDER_SPEICHER }))).error).toBeTruthy()
    expect(prisma.farm.update).not.toHaveBeenCalled()
  })

  it('ein schon gespeichertes Altbild bleibt beim Speichern anderer Felder stehen (kein Bestand gesperrt)', async () => {
    const alt = 'https://images.example.com/altes-logo.jpg'
    vi.mocked(prisma.farm.findUnique).mockResolvedValue({ id: HOF, slug: 'mein-hof', logoUrl: alt, bannerUrl: null } as never)
    expect(await saveAppearanceAction(auftritt({ logoUrl: alt, tagline: 'Neu' }))).toEqual({})
    expect(prisma.farm.update).toHaveBeenCalledTimes(1)
  })
})

describe('Produktbild: updateProductImageAction, createProduct, updateProduct', () => {
  const produkt = { name: 'Rindfleisch-Paket', price: 89, unit: 'KG' as const, category: 'FLEISCH', subcategory: 'RIND', labels: [] }

  it.each(FREMDE)('updateProductImageAction: keine fremde Adresse (%s)', async (_fall, url) => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue({ id: 'prod_1', imageUrl: null } as never)
    expect((await updateProductImageAction('prod_1', url)).error).toBeTruthy()
    expect(prisma.product.update).not.toHaveBeenCalled()
  })

  it('updateProductImageAction — Gegenprobe: eigenes Bild geht durch', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue({ id: 'prod_1', imageUrl: null } as never)
    expect(await updateProductImageAction('prod_1', EIGEN)).toEqual({})
    expect(prisma.product.update).toHaveBeenCalledTimes(1)
  })

  it('createProduct: fremde Adresse wird nicht angelegt, eigene schon', async () => {
    expect('error' in (await createProduct({ ...produkt, imageUrl: FREMDER_SERVER } as never))).toBe(true)
    expect(prisma.product.create).not.toHaveBeenCalled()

    expect(await createProduct({ ...produkt, imageUrl: EIGEN } as never)).toEqual({ ok: true })
    expect(prisma.product.create).toHaveBeenCalledTimes(1)
  })

  it('updateProduct: neue fremde Adresse abgelehnt, unverändertes Altbild bleibt speicherbar', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue({ imageUrl: null } as never)
    tx.product.updateMany.mockResolvedValue({ count: 1 })
    expect('error' in (await updateProduct('prod_1', { ...produkt, imageUrl: FREMDER_HOF } as never))).toBe(true)
    expect(tx.product.updateMany).not.toHaveBeenCalled()

    const alt = 'https://images.example.com/altes-produkt.jpg'
    vi.mocked(prisma.product.findFirst).mockResolvedValue({ imageUrl: alt } as never)
    expect(await updateProduct('prod_1', { ...produkt, imageUrl: alt } as never)).toEqual({ ok: true })
  })
})

describe('publishStatusPost (Beitragsfoto geht auch per Mail an Abonnentinnen)', () => {
  const beitrag = (photoUrl: string) => ({
    title: 'Neue Eier',
    body: 'Frisch gelegt.',
    anlass: 'FRESH_PRODUCT',
    photoUrl,
    showOnFarmPage: true,
    sendEmail: false,
    sendWhatsApp: false,
  })

  beforeEach(() => {
    vi.mocked(prisma.statusPost.create).mockResolvedValue({ id: 'post_1' } as never)
    vi.mocked(prisma.farm.findUnique).mockResolvedValue({ slug: 'mein-hof' } as never)
  })

  it.each(FREMDE)('keine fremde Adresse (%s)', async (_fall, url) => {
    expect((await publishStatusPost(beitrag(url))).error).toBeTruthy()
    expect(prisma.statusPost.create).not.toHaveBeenCalled()
  })

  it('Gegenprobe: eigenes Foto geht durch', async () => {
    expect((await publishStatusPost(beitrag(EIGEN))).postId).toBe('post_1')
  })
})
