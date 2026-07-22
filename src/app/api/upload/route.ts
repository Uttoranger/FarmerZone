import { put, del } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'

const ALLOWED_TARGETS = ['product', 'banner', 'logo', 'gallery', 'status'] as const
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
type UploadTarget = typeof ALLOWED_TARGETS[number]

const VERCEL_BLOB_HOST = /\.public\.blob\.vercel-storage\.com\//

async function getFarmForUser(userId: string) {
  return prisma.farm.findUnique({ where: { ownerId: userId }, select: { id: true } })
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'Upload nicht konfiguriert', hint: 'BLOB_READ_WRITE_TOKEN fehlt in .env.local' },
      { status: 503 },
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'Keine Datei übergeben' }, { status: 400 })
  }

  // Server-side content-type check — exakte Whitelist, kein startsWith:
  // Browser können z. B. gespeicherte .heic nicht anzeigen
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Nur Bilder erlaubt (JPEG, PNG, WebP)' }, { status: 400 })
  }

  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: 'Bild zu groß (max. 4 MB)' }, { status: 400 })
  }

  const rawTarget = formData.get('target') as string | null
  const target: UploadTarget =
    rawTarget && ALLOWED_TARGETS.includes(rawTarget as UploadTarget)
      ? (rawTarget as UploadTarget)
      : 'status'

  const id = formData.get('id') as string | null
  const oldUrl = formData.get('oldUrl') as string | null

  const farm = await getFarmForUser(session.user.id)
  if (!farm) {
    return NextResponse.json({ error: 'Kein Hof gefunden' }, { status: 403 })
  }

  // Ownership checks per target
  if (target === 'product' && id) {
    const product = await prisma.product.findUnique({ where: { id }, select: { farmId: true } })
    if (!product || product.farmId !== farm.id) {
      return NextResponse.json({ error: 'Kein Zugriff auf dieses Produkt' }, { status: 403 })
    }
  }

  if (target === 'gallery' && id) {
    const photo = await prisma.farmPhoto.findUnique({ where: { id }, select: { farmId: true } })
    if (!photo || photo.farmId !== farm.id) {
      return NextResponse.json({ error: 'Kein Zugriff auf dieses Foto' }, { status: 403 })
    }
  }

  if (target === 'status' && id) {
    const post = await prisma.statusPost.findUnique({ where: { id }, select: { farmId: true } })
    if (!post || post.farmId !== farm.id) {
      return NextResponse.json({ error: 'Kein Zugriff auf diesen Status' }, { status: 403 })
    }
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const filename = `farms/${farm.id}/${target}/${Date.now()}.${ext}`

  const blob = await put(filename, file, {
    access: 'public',
    addRandomSuffix: true,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })

  // Best-effort cleanup of old Vercel Blob URL
  if (oldUrl && VERCEL_BLOB_HOST.test(oldUrl)) {
    try {
      await del(oldUrl, { token: process.env.BLOB_READ_WRITE_TOKEN })
    } catch {
      // ignore — best-effort only
    }
  }

  return NextResponse.json({ url: blob.url })
}
