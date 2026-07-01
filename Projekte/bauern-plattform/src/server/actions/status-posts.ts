'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFarmForUser } from '@/server/queries/dashboard'
import { generateUnsubscribeToken } from '@/lib/unsubscribe'
import type { StatusPostAnlass } from '@prisma/client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

async function getAuthorizedFarm() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Nicht eingeloggt')
  const farm = await getFarmForUser(session.user.id)
  if (!farm) throw new Error('Kein Hof gefunden')
  return farm
}

async function requireOwnership(farmId: string, postId: string) {
  const post = await prisma.statusPost.findFirst({ where: { id: postId, farmId } })
  if (!post) throw new Error('Post nicht gefunden')
  return post
}

export async function publishStatusPost(data: {
  title: string
  body: string
  anlass: string
  photoUrl?: string
  linkedProductIds?: string[]
  showOnFarmPage: boolean
  sendEmail: boolean
  sendWhatsApp: boolean
}): Promise<{ postId?: string; emailCount?: number; whatsAppCount?: number; error?: string }> {
  try {
    const farm = await getAuthorizedFarm()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    // Email subscribers — with frequency protection (farm-level: 1 email per 7 days)
    let emailSubscribers: { customerEmail: string; customerPhone: string | null }[] = []
    if (data.sendEmail) {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const recentSend = await prisma.statusPost.findFirst({
        where: { farmId: farm.id, sentViaEmail: true, publishedAt: { gte: sevenDaysAgo } },
      })
      if (!recentSend) {
        emailSubscribers = await prisma.customerFarmSubscription.findMany({
          where: { farmId: farm.id, optInEmail: true },
          select: { customerEmail: true, customerPhone: true },
        })
      }
    }

    // WhatsApp subscribers
    const whatsAppSubscribers = data.sendWhatsApp
      ? await prisma.customerFarmSubscription.findMany({
          where: { farmId: farm.id, optInWhatsApp: true, customerPhone: { not: null } },
          select: { customerEmail: true, customerPhone: true },
        })
      : []

    const post = await prisma.statusPost.create({
      data: {
        farmId: farm.id,
        title: data.title,
        body: data.body,
        anlass: data.anlass as StatusPostAnlass,
        photoUrl: data.photoUrl ?? null,
        linkedProductIds: data.linkedProductIds ?? [],
        showOnFarmPage: data.showOnFarmPage,
        publishedAt: now,
        expiresAt,
        sentViaEmail: data.sendEmail && emailSubscribers.length > 0,
        sentViaWhatsApp: data.sendWhatsApp && whatsAppSubscribers.length > 0,
        emailRecipientCount: emailSubscribers.length,
        whatsappRecipientCount: whatsAppSubscribers.length,
      },
    })

    // Send emails asynchronously (fire + don't block)
    if (emailSubscribers.length > 0) {
      const farmFull = await prisma.farm.findUnique({
        where: { id: farm.id },
        select: { name: true, slug: true },
      })

      // Get customer names for personalisation
      const nameRows = await prisma.order.findMany({
        where: { farmId: farm.id, customerEmail: { in: emailSubscribers.map((s) => s.customerEmail) } },
        select: { customerEmail: true, customerName: true },
        distinct: ['customerEmail'],
        orderBy: { createdAt: 'desc' },
      })
      const nameMap = new Map(nameRows.map((r) => [r.customerEmail.toLowerCase(), r.customerName.split(' ')[0]]))

      if (farmFull) {
        const { sendStatusUpdateEmail } = await import('@/lib/email')
        for (const sub of emailSubscribers) {
          const firstName = nameMap.get(sub.customerEmail.toLowerCase()) ?? ''
          const personalBody = data.body.replace(/\{Vorname\}/gi, firstName)
          const unsubToken = generateUnsubscribeToken(sub.customerEmail, farm.id)
          await sendStatusUpdateEmail({
            to: sub.customerEmail,
            farmName: farmFull.name,
            farmSlug: farmFull.slug,
            title: data.title,
            body: personalBody,
            anlass: data.anlass,
            photoUrl: data.photoUrl,
            unsubscribeUrl: `${APP_URL}/account/unsubscribe?token=${unsubToken}`,
          })
        }
      }
    }

    revalidatePath('/status')
    // Revalidate public farm page (ISR bust)
    const farmSlug = await prisma.farm.findUnique({ where: { id: farm.id }, select: { slug: true } })
    if (farmSlug) revalidatePath(`/${farmSlug.slug}`)

    return { postId: post.id, emailCount: emailSubscribers.length, whatsAppCount: whatsAppSubscribers.length }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unbekannter Fehler' }
  }
}

export async function markWhatsAppSent(postId: string, count: number): Promise<{ error?: string }> {
  try {
    const farm = await getAuthorizedFarm()
    await requireOwnership(farm.id, postId)
    await prisma.statusPost.update({ where: { id: postId }, data: { whatsappSentCount: count } })
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unbekannter Fehler' }
  }
}

export async function expireStatusPost(postId: string): Promise<{ error?: string }> {
  try {
    const farm = await getAuthorizedFarm()
    await requireOwnership(farm.id, postId)
    await prisma.statusPost.update({ where: { id: postId }, data: { expiresAt: new Date() } })
    revalidatePath('/status')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unbekannter Fehler' }
  }
}

export async function deleteStatusPost(postId: string): Promise<{ error?: string }> {
  try {
    const farm = await getAuthorizedFarm()
    await requireOwnership(farm.id, postId)
    await prisma.statusPost.delete({ where: { id: postId } })
    revalidatePath('/status')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unbekannter Fehler' }
  }
}
