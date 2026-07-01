import { prisma } from '@/lib/prisma'
import type { StatusPostAnlass } from '@prisma/client'

export type StatusPostSummary = {
  id: string
  title: string
  body: string
  anlass: StatusPostAnlass
  photoUrl: string | null
  linkedProductIds: string[]
  publishedAt: string | null
  expiresAt: string | null
  showOnFarmPage: boolean
  sentViaEmail: boolean
  sentViaWhatsApp: boolean
  emailRecipientCount: number
  whatsappRecipientCount: number
  whatsappSentCount: number
  createdAt: string
  isActive: boolean
  isDraft: boolean
}

export type ActiveStatusPost = {
  id: string
  title: string
  body: string
  anlass: StatusPostAnlass
  photoUrl: string | null
  linkedProductIds: string[]
  publishedAt: string
}

export async function getStatusPostsForFarm(farmId: string): Promise<StatusPostSummary[]> {
  const posts = await prisma.statusPost.findMany({
    where: { farmId },
    orderBy: { createdAt: 'desc' },
  })
  const now = new Date()
  return posts.map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    anlass: p.anlass,
    photoUrl: p.photoUrl,
    linkedProductIds: p.linkedProductIds,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    expiresAt: p.expiresAt?.toISOString() ?? null,
    showOnFarmPage: p.showOnFarmPage,
    sentViaEmail: p.sentViaEmail,
    sentViaWhatsApp: p.sentViaWhatsApp,
    emailRecipientCount: p.emailRecipientCount,
    whatsappRecipientCount: p.whatsappRecipientCount,
    whatsappSentCount: p.whatsappSentCount,
    createdAt: p.createdAt.toISOString(),
    isActive: !!p.publishedAt && (!p.expiresAt || p.expiresAt > now),
    isDraft: !p.publishedAt,
  }))
}

export async function getActiveStatusPost(farmId: string): Promise<ActiveStatusPost | null> {
  const now = new Date()
  const post = await prisma.statusPost.findFirst({
    where: {
      farmId,
      publishedAt: { lte: now },
      showOnFarmPage: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { publishedAt: 'desc' },
  })
  if (!post) return null
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    anlass: post.anlass,
    photoUrl: post.photoUrl,
    linkedProductIds: post.linkedProductIds,
    publishedAt: post.publishedAt!.toISOString(),
  }
}

export async function getStatusPostForWhatsApp(farmId: string, postId: string) {
  const post = await prisma.statusPost.findFirst({
    where: { id: postId, farmId },
    select: {
      id: true,
      title: true,
      body: true,
      whatsappSentCount: true,
      whatsappRecipientCount: true,
      farm: { select: { name: true, slug: true } },
    },
  })
  if (!post) return null

  const subscribers = await prisma.customerFarmSubscription.findMany({
    where: { farmId, optInWhatsApp: true, customerPhone: { not: null } },
    select: { customerEmail: true, customerPhone: true },
  })

  const nameMap = await prisma.order
    .findMany({
      where: { farmId, customerEmail: { in: subscribers.map((s) => s.customerEmail) } },
      select: { customerEmail: true, customerName: true },
      orderBy: { createdAt: 'desc' },
      distinct: ['customerEmail'],
    })
    .then((rows) => new Map(rows.map((r) => [r.customerEmail.toLowerCase(), r.customerName])))

  return {
    ...post,
    subscribers: subscribers.map((s) => ({
      email: s.customerEmail,
      phone: s.customerPhone!,
      name: nameMap.get(s.customerEmail.toLowerCase()) ?? s.customerEmail,
    })),
  }
}
