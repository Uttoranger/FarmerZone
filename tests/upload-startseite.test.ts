/**
 * Upload-Zweck 'startseite' (Register N16, Nr. 96) — die beiden Upload-Routen
 * mit gemockter Datenbank, Sitzung, Blob-Speicher und sharp.
 *
 * Beweist:
 *  - Nur für diesen Zweck zählt die Admin-Sitzung statt der Hof-Sitzung: Ein
 *    Hof bekommt für den Startseiten-Ordner keinen Token und keine
 *    Verarbeitung; ein Admin ohne Hof bekommt nur diesen Zweck (ein Hof-Pfad
 *    fällt durch).
 *  - Die Kennung für einen Admin ohne Hof führt zu keinem Hof-Pfad; der Pfad
 *    des Zwecks hängt nie an einem Hof (auch nicht an dem eines Admins).
 *  - Verarbeitet wird nur ein Original aus dem Startseiten-Ordner, quadratisch
 *    (1:1, lange Kante höchstens 1600), nie unter 320 px; ein altes Bild wird
 *    nicht gelöscht.
 *  - Die übrigen Zwecke laufen unverändert (Gegenprobe: Hof mit Produktbild).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const s = vi.hoisted(() => {
  const kette = {
    metadata: vi.fn(),
    rotate: vi.fn(),
    resize: vi.fn(),
    webp: vi.fn(),
    toBuffer: vi.fn(async () => Buffer.from('webp')),
  }
  kette.rotate.mockReturnValue(kette)
  kette.resize.mockReturnValue(kette)
  kette.webp.mockReturnValue(kette)
  return { kette, pfad: { wert: 'startseite/originale/foto.jpg' } }
})

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({ prisma: { farm: { findUnique: vi.fn() }, user: { findUnique: vi.fn() } } }))
vi.mock('@vercel/blob', () => ({ put: vi.fn(async (pfad: string) => ({ url: `https://speicher.public.blob.vercel-storage.com/${pfad}` })), del: vi.fn() }))
// block/unblock: Die Route sperrt beim Laden die fremden Lader (Sicherheitsupdate 20.10.2026).
vi.mock('sharp', () => ({ default: Object.assign(vi.fn(() => s.kette), { block: vi.fn(), unblock: vi.fn() }) }))
vi.mock('@vercel/blob/client', () => ({
  handleUpload: vi.fn(async ({ onBeforeGenerateToken }: { onBeforeGenerateToken: (p: string) => Promise<unknown> }) => {
    await onBeforeGenerateToken(s.pfad.wert)
    return { type: 'blob.generate-client-token', clientToken: 'vercel_blob_client_token' }
  }),
}))

import { NextRequest } from 'next/server'
import { del, put } from '@vercel/blob'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { STARTSEITE_UPLOAD_KENNUNG, originalPfad } from '@/lib/upload-pfade'
import { GET as kennungGET, POST as tokenPOST } from '@/app/api/upload/token/route'
import { POST as verarbeitenPOST } from '@/app/api/upload/verarbeiten/route'

const ORIGINAL = 'https://speicher.public.blob.vercel-storage.com/startseite/originale/foto-abc.jpg'

function tokenAnfrage(): NextRequest {
  return new NextRequest('http://localhost/api/upload/token', {
    method: 'POST',
    body: JSON.stringify({ type: 'blob.generate-client-token', payload: { pathname: s.pfad.wert } }),
  })
}

function verarbeitenAnfrage(daten: object): NextRequest {
  return new NextRequest('http://localhost/api/upload/verarbeiten', { method: 'POST', body: JSON.stringify(daten) })
}

function alsAdminOhneHof(): void {
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'admin-1', role: 'CUSTOMER' } } as never)
  vi.mocked(prisma.farm.findUnique).mockResolvedValue(null as never)
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: true, createdAt: new Date('2020-01-01'), emailVerified: true } as never)
}

function alsHof(): void {
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'hof-1', role: 'FARMER' } } as never)
  vi.mocked(prisma.farm.findUnique).mockResolvedValue({ id: 'farm-1' } as never)
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: false, createdAt: new Date('2020-01-01'), emailVerified: true } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  // Ein JPEG-Kopf: Seit dem Sicherheitsupdate (20.10.2026) prüft die Route die ersten Bytes vor sharp.
  vi.stubGlobal('fetch', vi.fn(async () => new Response(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))))
  s.kette.metadata.mockResolvedValue({ width: 2400, height: 1800 })
  s.pfad.wert = 'startseite/originale/foto.jpg'
})

describe('der Pfad des Zwecks', () => {
  it('hängt an keinem Hof — auch nicht an dem eines Admins mit Hof', () => {
    expect(originalPfad('farm-1', 'startseite', 'Ostern Bild.jpg')).toBe('startseite/originale/Ostern_Bild.jpg')
    expect(originalPfad(STARTSEITE_UPLOAD_KENNUNG, 'startseite', 'a.jpg')).toBe('startseite/originale/a.jpg')
    // Gegenprobe: ein Hof-Zweck bleibt im Ordner des Hofs.
    expect(originalPfad('farm-1', 'product', 'a.jpg')).toBe('originals/farm-1/product/a.jpg')
  })
})

describe('ein Hof', () => {
  beforeEach(alsHof)

  it('bekommt für den Startseiten-Ordner keinen Token', async () => {
    const antwort = await tokenPOST(tokenAnfrage())
    expect(antwort.status).toBe(400)
    expect((await antwort.json()).clientToken).toBeUndefined()
  })

  it('bekommt kein Startseiten-Bild verarbeitet — und es wird nichts geladen', async () => {
    const antwort = await verarbeitenPOST(verarbeitenAnfrage({ url: ORIGINAL, zweck: 'startseite' }))
    expect(antwort.status).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  it('Gegenprobe: lädt sein Produktbild wie bisher', async () => {
    s.pfad.wert = 'originals/farm-1/product/foto.jpg'
    expect((await kennungGET()).status).toBe(200)
    expect((await (await tokenPOST(tokenAnfrage())).json()).clientToken).toBe('vercel_blob_client_token')
  })
})

describe('ein Admin ohne Hof', () => {
  beforeEach(alsAdminOhneHof)

  it('bekommt eine Kennung ohne Hof', async () => {
    const antwort = await kennungGET()
    expect(antwort.status).toBe(200)
    expect(await antwort.json()).toEqual({ farmId: STARTSEITE_UPLOAD_KENNUNG })
  })

  it('bekommt einen Token nur für den Startseiten-Ordner', async () => {
    expect((await (await tokenPOST(tokenAnfrage())).json()).clientToken).toBe('vercel_blob_client_token')
    s.pfad.wert = `originals/${STARTSEITE_UPLOAD_KENNUNG}/product/foto.jpg`
    const hofPfad = await tokenPOST(tokenAnfrage())
    expect(hofPfad.status).toBe(400)
  })

  it('bekommt kein Produktbild verarbeitet', async () => {
    const antwort = await verarbeitenPOST(
      verarbeitenAnfrage({ url: 'https://speicher.public.blob.vercel-storage.com/originals/farm-1/product/a.jpg', zweck: 'product' })
    )
    expect(antwort.status).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('verarbeitet nur Originale aus dem Startseiten-Ordner', async () => {
    const antwort = await verarbeitenPOST(
      verarbeitenAnfrage({ url: 'https://speicher.public.blob.vercel-storage.com/originals/farm-1/product/a.jpg', zweck: 'startseite' })
    )
    expect(antwort.status).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('schneidet quadratisch zu, lange Kante höchstens 1600, und legt es im Startseiten-Ordner ab', async () => {
    const antwort = await verarbeitenPOST(verarbeitenAnfrage({ url: ORIGINAL, zweck: 'startseite', altUrl: 'https://speicher.public.blob.vercel-storage.com/startseite/bilder/alt.webp' }))
    expect(antwort.status).toBe(200)
    expect(s.kette.resize).toHaveBeenCalledWith({ width: 1600, height: 1600, fit: 'cover' })
    expect(vi.mocked(put).mock.calls[0]?.[0]).toMatch(/^startseite\/bilder\/\d+\.webp$/)
    // Nur das Original fällt weg — das alte Bild kann noch an einem gespeicherten Block hängen.
    expect(vi.mocked(del).mock.calls.map((c) => c[0])).toEqual([ORIGINAL])
  })

  it('behält kleinere Bilder in ihrer Größe, quadratisch auf die kürzere Kante', async () => {
    s.kette.metadata.mockResolvedValue({ width: 500, height: 900 })
    await verarbeitenPOST(verarbeitenAnfrage({ url: ORIGINAL, zweck: 'startseite' }))
    expect(s.kette.resize).toHaveBeenCalledWith({ width: 500, height: 500, fit: 'cover' })
  })

  it('weist Bilder unter 320 px ab, ohne etwas abzulegen', async () => {
    s.kette.metadata.mockResolvedValue({ width: 1200, height: 319 })
    const antwort = await verarbeitenPOST(verarbeitenAnfrage({ url: ORIGINAL, zweck: 'startseite' }))
    expect(antwort.status).toBe(422)
    expect((await antwort.json()).code).toBe('BILD_ZU_KLEIN')
    expect(put).not.toHaveBeenCalled()
    expect(del).toHaveBeenCalledWith(ORIGINAL, expect.anything())
  })
})

describe('niemand angemeldet', () => {
  it('bekommt weder Kennung noch Token noch Verarbeitung', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never)
    expect((await kennungGET()).status).toBe(403)
    expect((await tokenPOST(tokenAnfrage())).status).toBe(400)
    expect((await verarbeitenPOST(verarbeitenAnfrage({ url: ORIGINAL, zweck: 'startseite' }))).status).toBe(401)
  })
})
