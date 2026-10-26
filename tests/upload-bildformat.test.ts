/**
 * SVG und fremde Formate erreichen sharp nie (Sicherheitsupdate 20.10.2026).
 *
 * Drei Schichten:
 *  a) Der Upload-Token erlaubt nur JPEG, PNG, WebP, HEIC/HEIF und
 *     application/octet-stream (so schickt der Browser alles, was die ersten
 *     Bytes nicht als JPEG, PNG oder WebP ausweisen) — an beiden Stellen
 *     dieselbe Konstante.
 *  b) Vor JEDEM sharp() in der Verarbeitungs-Route prüft formatFuerSharp die
 *     Bytes (bildFormat aus foto-wege.ts, dazu die Suche nach AV1). Alles
 *     andere antwortet 415 „Format nicht lesbar" (`art: 'format'`), ohne dass
 *     sharp die Bytes sieht (Attrappe zählt 0) — auch ein AVIF unter
 *     HEIC-Marke und ein gzip-Kopf, der vorne nach ftyp aussieht. Dass es
 *     keinen dritten Weg zu sharp gibt, hält tests/sharp-wache.test.ts fest.
 *  c) Beim Laden des Moduls sperrt die Route alle Lader von libvips und gibt nur
 *     die vier erlaubten frei (Aufrufe an der Attrappe; echte Wirkung in
 *     tests/sharp-lader-sperre.test.ts).
 *  Dazu die Pixelgrenze: sharp bekommt limitInputPixels, und ein größeres Foto
 *  wird mit eigenem Code abgewiesen, ohne etwas abzulegen. sharp meldet die
 *  Grenze als Fehler schon beim Lesen des Kopfs — die Attrappe wirft wie das
 *  echte Modul, statt große Maße zurückzugeben.
 *
 * Gegenprobe (von Hand, 20.10.2026): Ohne die Byte-Prüfung vor sharp() werden
 * die Fälle mit fremden Formaten rot — die Attrappe zählt dann einen Aufruf.
 * HEIC besteht hier nur die Byte-Prüfung: Das vorgebaute sharp dekodiert HEIC
 * nicht, ein echtes HEIC-Original endet an sharp mit 415.
 */
import { adminSitzung } from './admin-sitzung'
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
  const sharp = Object.assign(
    vi.fn(() => kette),
    { block: vi.fn(), unblock: vi.fn() }
  )
  return { kette, sharp, pfad: { wert: 'originals/farm-1/product/foto.jpg' }, token: { optionen: null as unknown } }
})

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
// Seit Nr. 188 prüft der Startseiten-Weg über die echte Admin-Wache (Passkey der Sitzung, Recht „Startseite“) — Sitzung aus tests/admin-sitzung.ts.
vi.mock('@/lib/prisma', async () => ({
  prisma: { farm: { findUnique: vi.fn() }, user: { findUnique: vi.fn() }, session: { deleteMany: vi.fn() }, ...(await import('./admin-sitzung')).passkeyAttrappen() },
}))
vi.mock('@vercel/blob', () => ({ put: vi.fn(async (pfad: string) => ({ url: `https://speicher.public.blob.vercel-storage.com/${pfad}` })), del: vi.fn() }))
vi.mock('sharp', () => ({ default: s.sharp }))
vi.mock('@vercel/blob/client', () => ({
  handleUpload: vi.fn(async ({ onBeforeGenerateToken }: { onBeforeGenerateToken: (p: string) => Promise<unknown> }) => {
    s.token.optionen = await onBeforeGenerateToken(s.pfad.wert)
    return { type: 'blob.generate-client-token', clientToken: 'vercel_blob_client_token' }
  }),
}))

import { NextRequest } from 'next/server'
import { del, put } from '@vercel/blob'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BILD_PIXEL_GRENZE, PIXEL_GRENZE_FEHLER, SHARP_LADER_ERLAUBT } from '@/lib/bild-format'
import { BILD_ZU_GROSS_TEXT, ERLAUBTE_UPLOAD_TYPEN } from '@/lib/upload-pfade'
import { POST as tokenPOST } from '@/app/api/upload/token/route'
import { POST as verarbeitenPOST } from '@/app/api/upload/verarbeiten/route'

/** Die Sperre lief beim Laden des Moduls — vor clearAllMocks festhalten. */
const sperrAufrufe = { block: [...s.sharp.block.mock.calls], unblock: [...s.sharp.unblock.mock.calls] }

const ORIGINAL = 'https://speicher.public.blob.vercel-storage.com/originals/farm-1/product/foto-abc.jpg'
const STARTSEITE = 'https://speicher.public.blob.vercel-storage.com/startseite/originale/foto-abc.jpg'

function bytes(...teile: (number[] | string)[]): Buffer {
  const liste: number[] = []
  for (const teil of teile) {
    if (typeof teil === 'string') for (const z of teil) liste.push(z.charCodeAt(0))
    else liste.push(...teil)
  }
  return Buffer.from(liste)
}

const KOEPFE = {
  jpeg: bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0x10], 'JFIF', [0]),
  png: bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d], 'IHDR'),
  webp: bytes('RIFF', [0x24, 0, 0, 0], 'WEBP', 'VP8 '),
  heic: bytes([0, 0, 0, 0x18], 'ftyp', 'heic', [0, 0, 0, 0], 'mif1', 'heic'),
} as const

const FREMD = {
  svg: bytes('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>'),
  avif: bytes([0, 0, 0, 0x18], 'ftyp', 'avif', [0, 0, 0, 0], 'mif1', 'miaf'),
  gif: bytes('GIF89a', [1, 0, 1, 0, 0, 0, 0]),
  'avif unter heic-marke': bytes([0, 0, 0, 0x18], 'ftyp', 'heic', [0, 0, 0, 0], 'mif1', 'miaf', [0, 0, 0, 0x10], 'av1C', [0x81, 0, 0, 0]),
  'gzip mit ftyp-kopf': bytes([0x1f, 0x8b, 0x08, 0x08], 'ftyp', 'heic', [0, 0, 0, 0], 'mif1'),
} as const

/** Der Blob-Speicher liefert das Original — mit dem Typ, unter dem es hochgeladen wurde. */
function liefere(inhalt: Buffer, typ?: string): void {
  const kopf = typ ? { 'content-type': typ } : undefined
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(inhalt), { headers: kopf })))
}

function anfrage(daten: object): NextRequest {
  return new NextRequest('http://localhost/api/upload/verarbeiten', { method: 'POST', body: JSON.stringify(daten) })
}

function tokenAnfrage(): NextRequest {
  return new NextRequest('http://localhost/api/upload/token', {
    method: 'POST',
    body: JSON.stringify({ type: 'blob.generate-client-token', payload: { pathname: s.pfad.wert } }),
  })
}

function alsHof(): void {
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'hof-1', role: 'FARMER' } } as never)
  vi.mocked(prisma.farm.findUnique).mockResolvedValue({ id: 'farm-1' } as never)
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: false, createdAt: new Date('2020-01-01'), emailVerified: true } as never)
}

function alsAdminOhneHof(): void {
  vi.mocked(auth.api.getSession).mockResolvedValue(adminSitzung('admin-1', { role: 'CUSTOMER' }) as never)
  vi.mocked(prisma.farm.findUnique).mockResolvedValue(null as never)
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: true, adminInhaber: true, createdAt: new Date('2020-01-01'), emailVerified: true } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  // clearAllMocks lässt Einmal-Antworten stehen; ein nicht verbrauchtes
  // mockRejectedValueOnce träfe sonst den nächsten Test.
  s.kette.toBuffer.mockReset()
  s.kette.toBuffer.mockResolvedValue(Buffer.from('webp'))
  s.kette.metadata.mockReset()
  s.kette.metadata.mockResolvedValue({ width: 4000, height: 3000 })
  s.pfad.wert = 'originals/farm-1/product/foto.jpg'
  s.token.optionen = null
})

describe('a) Upload-Token: nur erlaubte Typen', () => {
  it('die Liste ist genau JPEG, PNG, WebP, HEIC, HEIF und octet-stream — kein Platzhalter, kein SVG', () => {
    expect([...ERLAUBTE_UPLOAD_TYPEN]).toEqual(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/octet-stream'])
    expect(ERLAUBTE_UPLOAD_TYPEN.some((typ) => typ.includes('*') || typ.includes('svg'))).toBe(false)
  })

  it('der Hof bekommt seinen Token mit genau dieser Liste', async () => {
    alsHof()
    await tokenPOST(tokenAnfrage())
    expect((s.token.optionen as { allowedContentTypes: unknown }).allowedContentTypes).toEqual(ERLAUBTE_UPLOAD_TYPEN)
  })

  it('der Admin bekommt für die Startseite dieselbe Liste', async () => {
    alsAdminOhneHof()
    s.pfad.wert = 'startseite/originale/foto.jpg'
    await tokenPOST(tokenAnfrage())
    expect((s.token.optionen as { allowedContentTypes: unknown }).allowedContentTypes).toEqual(ERLAUBTE_UPLOAD_TYPEN)
  })
})

describe('b) Byte-Prüfung vor sharp — Hof-Fotos', () => {
  beforeEach(alsHof)

  for (const [name, inhalt] of Object.entries(FREMD)) {
    it(`${name}: 415 „Format nicht lesbar", sharp sieht die Bytes nie, nichts wird abgelegt`, async () => {
      liefere(inhalt)
      const antwort = await verarbeitenPOST(anfrage({ url: ORIGINAL, zweck: 'product' }))
      expect(antwort.status).toBe(415)
      expect(await antwort.json()).toEqual({ error: 'Format nicht lesbar', art: 'format' })
      expect(s.sharp).toHaveBeenCalledTimes(0)
      expect(put).not.toHaveBeenCalled()
      // Das Original fällt trotzdem weg — es hat seinen Zweck erfüllt.
      expect(del).toHaveBeenCalledWith(ORIGINAL, expect.anything())
    })
  }

  it('eine Datei mit JPEG-Endung und SVG-Inhalt: 415, sharp nie gerufen', async () => {
    // Endung und gemeldeter Typ behaupten JPEG — der Token lässt image/jpeg
    // zu, und der Speicher liefert es so aus. Es zählen nur die Bytes.
    liefere(FREMD.svg, 'image/jpeg')
    const antwort = await verarbeitenPOST(anfrage({ url: ORIGINAL, zweck: 'gallery' }))
    expect(ORIGINAL.endsWith('.jpg')).toBe(true)
    expect(antwort.status).toBe(415)
    expect(s.sharp).toHaveBeenCalledTimes(0)
  })

  for (const [name, inhalt] of Object.entries(KOEPFE)) {
    it(`${name}: besteht die Byte-Prüfung, sharp mit Pixelgrenze`, async () => {
      liefere(inhalt)
      const antwort = await verarbeitenPOST(anfrage({ url: ORIGINAL, zweck: 'product' }))
      expect(antwort.status).toBe(200)
      expect(s.sharp).toHaveBeenCalledTimes(1)
      expect(s.sharp).toHaveBeenCalledWith(expect.any(Buffer), { limitInputPixels: BILD_PIXEL_GRENZE })
      expect(put).toHaveBeenCalledTimes(1)
    })
  }

  it('zu viele Pixel: abgewiesen mit eigenem Code, nichts abgelegt', async () => {
    liefere(KOEPFE.jpeg)
    // So meldet das echte sharp die Pixelgrenze — schon beim Lesen des Kopfs
    // (metadata) wie beim Dekodieren (toBuffer); der Text ist in
    // tests/sharp-lader-sperre.test.ts am echten Modul festgehalten.
    s.kette.metadata.mockRejectedValue(new Error(PIXEL_GRENZE_FEHLER))
    s.kette.toBuffer.mockRejectedValueOnce(new Error(PIXEL_GRENZE_FEHLER))
    const antwort = await verarbeitenPOST(anfrage({ url: ORIGINAL, zweck: 'product' }))
    expect(antwort.status).toBe(422)
    expect(await antwort.json()).toMatchObject({ code: 'BILD_ZU_GROSS', art: 'format' })
    expect(put).not.toHaveBeenCalled()
    expect(del).toHaveBeenCalledWith(ORIGINAL, expect.anything())
  })

  it('Gegenprobe: ein anderer Fehler von sharp bleibt „Format nicht lesbar"', async () => {
    liefere(KOEPFE.jpeg)
    s.kette.metadata.mockRejectedValue(new Error('Input buffer contains unsupported image format'))
    s.kette.toBuffer.mockRejectedValueOnce(new Error('Input buffer contains unsupported image format'))
    const antwort = await verarbeitenPOST(anfrage({ url: ORIGINAL, zweck: 'product' }))
    expect(antwort.status).toBe(415)
    expect(await antwort.json()).toEqual({ error: 'Format nicht lesbar', art: 'format' })
  })
})

describe('b) Byte-Prüfung vor sharp — Startseiten-Bilder (Admin)', () => {
  beforeEach(alsAdminOhneHof)

  it('SVG: 415, sharp nie gerufen', async () => {
    liefere(FREMD.svg)
    const antwort = await verarbeitenPOST(anfrage({ url: STARTSEITE, zweck: 'startseite' }))
    expect(antwort.status).toBe(415)
    expect(await antwort.json()).toEqual({ error: 'Format nicht lesbar', art: 'format' })
    expect(s.sharp).toHaveBeenCalledTimes(0)
    expect(put).not.toHaveBeenCalled()
  })

  it('JPEG: läuft durch, sharp mit Pixelgrenze', async () => {
    liefere(KOEPFE.jpeg)
    const antwort = await verarbeitenPOST(anfrage({ url: STARTSEITE, zweck: 'startseite' }))
    expect(antwort.status).toBe(200)
    expect(s.sharp).toHaveBeenCalledWith(expect.any(Buffer), { limitInputPixels: BILD_PIXEL_GRENZE })
  })

  it('zu viele Pixel: 422 BILD_ZU_GROSS', async () => {
    liefere(KOEPFE.png)
    s.kette.metadata.mockRejectedValue(new Error(PIXEL_GRENZE_FEHLER))
    const antwort = await verarbeitenPOST(anfrage({ url: STARTSEITE, zweck: 'startseite' }))
    expect(antwort.status).toBe(422)
    expect((await antwort.json()).code).toBe('BILD_ZU_GROSS')
    expect(put).not.toHaveBeenCalled()
  })
})

describe('c) Lader beim Laden des Moduls gesperrt', () => {
  it('erst alle Lader sperren, dann genau die vier erlaubten freigeben', () => {
    expect(sperrAufrufe.block).toEqual([[{ operation: ['VipsForeignLoad'] }]])
    expect(sperrAufrufe.unblock).toEqual([[{ operation: [...SHARP_LADER_ERLAUBT] }]])
    expect([...SHARP_LADER_ERLAUBT]).toEqual(['VipsForeignLoadJpeg', 'VipsForeignLoadPng', 'VipsForeignLoadWebp', 'VipsForeignLoadHeif'])
  })
})

describe('Satz für zu große Fotos', () => {
  it('steht in einer Konstante', () => {
    expect(BILD_ZU_GROSS_TEXT).toBe('Das Foto ist zu groß – nimm es bitte in normaler Auflösung auf.')
  })
})
