import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPublicFarm } from '@/server/queries/farm'
import { getActiveStatusPost } from '@/server/queries/status-posts'
import { verifyReorderToken } from '@/lib/reorder-token'
import { prisma } from '@/lib/prisma'
import { FarmPageView } from '@/components/farm/farm-page-view'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ farmSlug: string }>; searchParams: Promise<{ reorder?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { farmSlug } = await params
  const farm = await getPublicFarm(farmSlug)
  if (!farm) return { title: 'Hof nicht gefunden' }

  const desc = (farm.aboutText ?? farm.description).slice(0, 155)

  return {
    title: `${farm.name} — Frische Produkte direkt vom Hof`,
    description: desc,
    openGraph: {
      title: farm.name,
      description: desc,
      type: 'website',
      ...(farm.bannerUrl ? { images: [{ url: farm.bannerUrl }] } : {}),
    },
  }
}

type ReorderItem = { productId: string; productName: string; quantity: number }

async function loadReorderItems(token: string, farmId: string): Promise<ReorderItem[]> {
  const parsed = verifyReorderToken(token)
  if (!parsed || parsed.farmId !== farmId) return []

  const order = await prisma.order.findFirst({
    where: { id: parsed.orderId, farmId },
    select: {
      items: {
        select: { productId: true, productName: true, quantity: true },
      },
    },
  })

  return order?.items ?? []
}

export default async function FarmPage({ params, searchParams }: Props) {
  const { farmSlug } = await params
  const { reorder } = await searchParams
  const farm = await getPublicFarm(farmSlug)

  if (!farm) notFound()

  const activeStatus = await getActiveStatusPost(farm.id)
  const reorderItems = reorder ? await loadReorderItems(reorder, farm.id) : []

  return (
    <FarmPageView
      farm={farm}
      activeStatus={activeStatus}
      reorderItems={reorderItems}
      ownerMode={false}
    />
  )
}
