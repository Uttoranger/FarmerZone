'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { del } from '@vercel/blob'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const GALLERY_LIMIT = 8
const BLOB_HOST = /\.public\.blob\.vercel-storage\.com\//

async function getSessionFarm(userId: string) {
  return prisma.farm.findUnique({ where: { ownerId: userId }, select: { id: true, slug: true } })
}

function revalidate(slug: string) {
  revalidatePath(`/${slug}`)
  revalidatePath('/farm-page')
  revalidatePath('/settings/appearance')
}

export async function addFarmPhotoAction(input: {
  url: string
  caption?: string
}): Promise<{ photo?: { id: string; url: string; caption: string | null; sortOrder: number }; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet' }

  const farm = await getSessionFarm(session.user.id)
  if (!farm) return { error: 'Kein Hof gefunden' }

  const count = await prisma.farmPhoto.count({ where: { farmId: farm.id } })
  if (count >= GALLERY_LIMIT) return { error: `Maximal ${GALLERY_LIMIT} Fotos erlaubt` }

  const photo = await prisma.farmPhoto.create({
    data: {
      farmId: farm.id,
      url: input.url,
      caption: input.caption ?? null,
      sortOrder: count,
    },
    select: { id: true, url: true, caption: true, sortOrder: true },
  })

  revalidate(farm.slug)
  return { photo }
}

export async function updateFarmPhotoCaptionAction(
  id: string,
  caption: string,
): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet' }

  const farm = await getSessionFarm(session.user.id)
  if (!farm) return { error: 'Kein Hof gefunden' }

  const photo = await prisma.farmPhoto.findUnique({ where: { id }, select: { farmId: true } })
  if (!photo || photo.farmId !== farm.id) return { error: 'Kein Zugriff' }

  await prisma.farmPhoto.update({ where: { id }, data: { caption: caption.trim() || null } })

  revalidate(farm.slug)
  return {}
}

export async function deleteFarmPhotoAction(id: string): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet' }

  const farm = await getSessionFarm(session.user.id)
  if (!farm) return { error: 'Kein Hof gefunden' }

  const photo = await prisma.farmPhoto.findUnique({
    where: { id },
    select: { farmId: true, url: true },
  })
  if (!photo || photo.farmId !== farm.id) return { error: 'Kein Zugriff' }

  await prisma.farmPhoto.delete({ where: { id } })

  // Best-effort Blob cleanup
  if (BLOB_HOST.test(photo.url)) {
    try {
      await del(photo.url, { token: process.env.BLOB_READ_WRITE_TOKEN })
    } catch {
      // ignore
    }
  }

  // Re-sequence sortOrder
  const remaining = await prisma.farmPhoto.findMany({
    where: { farmId: farm.id },
    orderBy: { sortOrder: 'asc' },
    select: { id: true },
  })
  await Promise.all(
    remaining.map((p, i) => prisma.farmPhoto.update({ where: { id: p.id }, data: { sortOrder: i } })),
  )

  revalidate(farm.slug)
  return {}
}

export async function moveFarmPhotoAction(
  id: string,
  direction: 'up' | 'down',
): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet' }

  const farm = await getSessionFarm(session.user.id)
  if (!farm) return { error: 'Kein Hof gefunden' }

  const photos = await prisma.farmPhoto.findMany({
    where: { farmId: farm.id },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sortOrder: true },
  })

  const idx = photos.findIndex((p) => p.id === id)
  if (idx === -1) return { error: 'Foto nicht gefunden' }

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= photos.length) return {}

  const a = photos[idx]
  const b = photos[swapIdx]

  await prisma.$transaction([
    prisma.farmPhoto.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.farmPhoto.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ])

  revalidate(farm.slug)
  return {}
}
