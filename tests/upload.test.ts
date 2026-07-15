/**
 * Tests für den Upload-Endpunkt (/api/upload) und die addFarmPhotoAction.
 *
 * Prüft: Auth, Ownership, Content-Type, Größenlimit, put()-Aufruf, del()-Aufruf,
 * und das serverseitige Galerie-Limit (max. 8 Fotos).
 *
 * Blob, Prisma und Better Auth sind gemockt — kein Netzwerk, keine DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
  del: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn() },
    product: { findUnique: vi.fn() },
    farmPhoto: { findUnique: vi.fn(), create: vi.fn(), count: vi.fn() },
    statusPost: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// ── Imports after mocks ────────────────────────────────────────────────────────

import { POST } from '@/app/api/upload/route'
import { addFarmPhotoAction } from '@/server/actions/farm-photos'
import { put, del } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

const mockPut = vi.mocked(put)
const mockDel = vi.mocked(del)
const mockGetSession = vi.mocked(auth.api.getSession)
const mockFarmFindUnique = vi.mocked(prisma.farm.findUnique)
const mockProductFindUnique = vi.mocked(prisma.product.findUnique)
const mockFarmPhotoCount = vi.mocked(prisma.farmPhoto.count)
const mockFarmPhotoCreate = vi.mocked(prisma.farmPhoto.create)

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFile(
  name = 'test.jpg',
  type = 'image/jpeg',
  sizeBytes = 1024,
): File {
  const content = new Uint8Array(sizeBytes).fill(65)
  return new File([content], name, { type })
}

function makeFormData(overrides: Record<string, string | File> = {}): FormData {
  const fd = new FormData()
  fd.append('file', makeFile())
  fd.append('target', 'product')
  for (const [k, v] of Object.entries(overrides)) {
    fd.set(k, v)
  }
  return fd
}

function makeRequest(formData: FormData): NextRequest {
  return new NextRequest('http://localhost/api/upload', {
    method: 'POST',
    body: formData,
  })
}

const SESSION = { user: { id: 'user-1' } }
const FARM = { id: 'farm-1' }

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token'
    mockGetSession.mockResolvedValue(SESSION as never)
    mockFarmFindUnique.mockResolvedValue(FARM as never)
    mockProductFindUnique.mockResolvedValue({ farmId: 'farm-1' } as never)
    mockPut.mockResolvedValue({ url: 'https://farm.public.blob.vercel-storage.com/img.webp' } as never)
    mockDel.mockResolvedValue(undefined as never)
  })

  it('401 wenn keine Session', async () => {
    mockGetSession.mockResolvedValue(null as never)
    const res = await POST(makeRequest(makeFormData()))
    expect(res.status).toBe(401)
  })

  it('403 wenn Produkt einem anderen Hof gehört', async () => {
    mockProductFindUnique.mockResolvedValue({ farmId: 'other-farm' } as never)
    const fd = makeFormData({ target: 'product', id: 'prod-1' })
    const res = await POST(makeRequest(fd))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/Zugriff/)
  })

  it('400 bei falschem Content-Type', async () => {
    const badFile = new File([new Uint8Array(100)], 'file.pdf', { type: 'application/pdf' })
    const fd = new FormData()
    fd.append('file', badFile)
    const res = await POST(makeRequest(fd))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Bilder/)
  })

  it('400 wenn Datei > 4 MB', async () => {
    const bigFile = makeFile('big.jpg', 'image/jpeg', 4 * 1024 * 1024 + 1)
    const fd = new FormData()
    fd.append('file', bigFile)
    const res = await POST(makeRequest(fd))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/groß/)
  })

  it('valid upload — put() aufgerufen, gibt { url } zurück', async () => {
    const fd = makeFormData({ target: 'product', id: 'prod-1' })
    const res = await POST(makeRequest(fd))
    expect(res.status).toBe(200)
    expect(mockPut).toHaveBeenCalledOnce()
    const body = await res.json()
    expect(body).toHaveProperty('url')
    expect(typeof body.url).toBe('string')
  })

  it('Ersetzen mit Blob-URL → del() aufgerufen', async () => {
    const oldUrl = 'https://old.public.blob.vercel-storage.com/prev.webp'
    const fd = makeFormData({ target: 'product', id: 'prod-1', oldUrl })
    const res = await POST(makeRequest(fd))
    expect(res.status).toBe(200)
    expect(mockDel).toHaveBeenCalledWith(oldUrl, expect.objectContaining({ token: expect.any(String) }))
  })

  it('fremde URL (nicht Vercel Blob) → del() NICHT aufgerufen', async () => {
    const foreignUrl = 'https://example.com/image.jpg'
    const fd = makeFormData({ target: 'product', id: 'prod-1', oldUrl: foreignUrl })
    const res = await POST(makeRequest(fd))
    expect(res.status).toBe(200)
    expect(mockDel).not.toHaveBeenCalled()
  })

  it('403 wenn kein Hof gefunden', async () => {
    mockFarmFindUnique.mockResolvedValue(null as never)
    const res = await POST(makeRequest(makeFormData()))
    expect(res.status).toBe(403)
  })
})

describe('addFarmPhotoAction — Galerie-Limit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(SESSION as never)
    mockFarmFindUnique.mockResolvedValue({ id: 'farm-1', slug: 'mein-hof' } as never)
    mockFarmPhotoCreate.mockResolvedValue({
      id: 'photo-9',
      url: 'https://x.public.blob.vercel-storage.com/p.webp',
      caption: null,
      sortOrder: 8,
    } as never)
  })

  it('erlaubt das 8. Foto (count = 7)', async () => {
    mockFarmPhotoCount.mockResolvedValue(7 as never)
    const result = await addFarmPhotoAction({ url: 'https://x.public.blob.vercel-storage.com/p.webp' })
    expect(result.error).toBeUndefined()
    expect(result.photo).toBeDefined()
  })

  it('lehnt das 9. Foto ab (count = 8)', async () => {
    mockFarmPhotoCount.mockResolvedValue(8 as never)
    const result = await addFarmPhotoAction({ url: 'https://x.public.blob.vercel-storage.com/p.webp' })
    expect(result.error).toMatch(/Maximal 8/)
    expect(mockFarmPhotoCreate).not.toHaveBeenCalled()
  })
})
