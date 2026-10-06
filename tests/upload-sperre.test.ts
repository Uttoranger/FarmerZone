/**
 * Foto-Uploads bis zur E-Mail-Bestätigung gesperrt (S3, Nachtlauf Nr. 17b) —
 * die beiden Upload-Routen mit gemockter Datenbank und Sitzung.
 *
 * Beweist:
 *  - Ein neues Hof-Konto (ab dem Stichtag) ohne bestätigte Adresse bekommt
 *    weder die Hof-Kennung noch einen Upload-Token, und die Verarbeitung
 *    lehnt ab, bevor sie etwas lädt.
 *  - Entschieden wird nach dem frischen Stand in der Datenbank — auch wenn
 *    die Sitzung „bestätigt" behauptet.
 *  - Gegenproben: bestätigtes neues Konto und unbestätigtes ALTES Konto
 *    (vor dem Stichtag) laden wie bisher hoch.
 *  - Galerie, Produktbilder, Titelbild und /teilen nehmen alle diesen Weg —
 *    es gibt keinen zweiten Token-Ausgeber (Quelltext-Suche mit Gegenprobe).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: { farm: { findUnique: vi.fn() }, user: { findUnique: vi.fn() } },
}))
vi.mock('@vercel/blob', () => ({ put: vi.fn(), del: vi.fn() }))
vi.mock('sharp', () => ({ default: vi.fn() }))
vi.mock('@vercel/blob/client', () => ({
  handleUpload: vi.fn(async ({ onBeforeGenerateToken }: { onBeforeGenerateToken: (p: string) => Promise<unknown> }) => {
    await onBeforeGenerateToken('originals/farm-1/product/foto.jpg')
    return { type: 'blob.generate-client-token', clientToken: 'vercel_blob_client_token' }
  }),
}))

import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EMAIL_BESTAETIGUNG_STICHTAG, UPLOAD_GESPERRT_TEXT } from '@/lib/email-bestaetigung'
import { GET as kennungGET, POST as tokenPOST } from '@/app/api/upload/token/route'
import { POST as verarbeitenPOST } from '@/app/api/upload/verarbeiten/route'

const NEU = new Date(EMAIL_BESTAETIGUNG_STICHTAG.getTime() + 60_000)
const ALT = new Date(EMAIL_BESTAETIGUNG_STICHTAG.getTime() - 60_000)

function nutzer(stand: { createdAt: Date; emailVerified: boolean }): void {
  vi.mocked(prisma.user.findUnique).mockResolvedValue(stand as never)
}

function tokenAnfrage(): NextRequest {
  return new NextRequest('http://localhost/api/upload/token', {
    method: 'POST',
    body: JSON.stringify({ type: 'blob.generate-client-token', payload: { pathname: 'originals/farm-1/product/foto.jpg' } }),
  })
}

function verarbeitenAnfrage(): NextRequest {
  return new NextRequest('http://localhost/api/upload/verarbeiten', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://x.public.blob.vercel-storage.com/originals/farm-1/product/foto.jpg', zweck: 'product' }),
  })
}

const fetchSpion = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchSpion)
  // Die Sitzung behauptet bestätigt — entscheiden darf nur die Datenbank.
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user-1', role: 'FARMER', emailVerified: true } } as never)
  vi.mocked(prisma.farm.findUnique).mockResolvedValue({ id: 'farm-1' } as never)
})

describe('neues Konto ohne bestätigte Adresse', () => {
  beforeEach(() => nutzer({ createdAt: NEU, emailVerified: false }))

  it('bekommt keine Hof-Kennung — mit Satz und Code für den Browser', async () => {
    const antwort = await kennungGET()
    expect(antwort.status).toBe(403)
    const daten = await antwort.json()
    expect(daten).toEqual({ error: UPLOAD_GESPERRT_TEXT, code: 'EMAIL_UNBESTAETIGT' })
  })

  it('bekommt keinen Upload-Token', async () => {
    const antwort = await tokenPOST(tokenAnfrage())
    expect(antwort.ok).toBe(false)
    const daten = await antwort.json()
    expect(daten.clientToken).toBeUndefined()
    expect(daten.code).toBe('EMAIL_UNBESTAETIGT')
  })

  it('die Verarbeitung lehnt ab, bevor sie etwas lädt', async () => {
    const antwort = await verarbeitenPOST(verarbeitenAnfrage())
    expect(antwort.status).toBe(403)
    expect((await antwort.json()).code).toBe('EMAIL_UNBESTAETIGT')
    expect(fetchSpion).not.toHaveBeenCalled()
  })

  it('liest den Stand frisch aus der Datenbank, nach der Konto-ID der Sitzung', async () => {
    await kennungGET()
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'user-1' } }))
  })
})

describe('Gegenproben: wer weiter hochladen darf', () => {
  it('neues Konto mit bestätigter Adresse', async () => {
    nutzer({ createdAt: NEU, emailVerified: true })
    expect(await (await kennungGET()).json()).toEqual({ farmId: 'farm-1' })
    expect((await (await tokenPOST(tokenAnfrage())).json()).clientToken).toBe('vercel_blob_client_token')
  })

  it('altes Konto ohne Bestätigung (vor dem Stichtag — bestehende Höfe unberührt)', async () => {
    nutzer({ createdAt: ALT, emailVerified: false })
    expect(await (await kennungGET()).json()).toEqual({ farmId: 'farm-1' })
    expect((await (await tokenPOST(tokenAnfrage())).json()).clientToken).toBe('vercel_blob_client_token')
  })
})

describe('ein Weg für alle Fotos', () => {
  function dateien(ordner: string): string[] {
    return readdirSync(ordner).flatMap((name) => {
      const pfad = join(ordner, name)
      return statSync(pfad).isDirectory() ? dateien(pfad) : /\.(ts|tsx)$/.test(name) ? [pfad] : []
    })
  }

  it('nur die Token-Route gibt Upload-Token aus (handleUpload), nur die Verarbeitung legt Bilder ab (put)', () => {
    const wurzel = join(process.cwd(), 'src')
    const handleUpload = dateien(wurzel).filter((d) => /\bhandleUpload\s*\(/.test(readFileSync(d, 'utf8')))
    const ablegen = dateien(wurzel).filter((d) =>
      /import\s*\{[^}]*\bput\b[^}]*\}\s*from\s*'@vercel\/blob'/.test(readFileSync(d, 'utf8'))
    )
    // Gegenprobe: Die Suche findet die bekannten Stellen.
    expect(handleUpload.map((d) => d.slice(wurzel.length))).toEqual(['/app/api/upload/token/route.ts'])
    expect(ablegen.map((d) => d.slice(wurzel.length))).toEqual(['/app/api/upload/verarbeiten/route.ts'])
  })
})
