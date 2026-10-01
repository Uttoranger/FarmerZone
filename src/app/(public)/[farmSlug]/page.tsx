import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getActiveStatusPost } from '@/server/queries/status-posts'
import { ladeHofseiteGeteilt } from '@/server/hofseite-vorschau'
import { verifyReorderToken } from '@/lib/reorder-token'
import { prisma } from '@/lib/prisma'
import { hofVorschaubild } from '@/lib/vorschaubild'
import type { Suchparameter } from '@/lib/ansichts-modus'
import { FarmPageView } from '@/components/farm/farm-page-view'

export const dynamic = 'force-dynamic'

/*
 * DIE Hofseite — es gibt sie genau einmal. Kundinnen sehen sie hier, und die
 * Vorschau im Bauern-Bereich ist dieselbe Route mit ?vorschau=1, nie ein
 * Nachbau (ARCHITECTURE §4). Was die Vorschau anders macht, entscheidet
 * `ansichtsModus` im Lader; diese Seite liest nur das Ergebnis (`ansicht`),
 * nie den Parameter selbst (tests/hofseite-einmal.test.ts).
 */

type Props = {
  params: Promise<{ farmSlug: string }>
  searchParams: Promise<Suchparameter>
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { farmSlug } = await params
  const { farm, ansicht } = await ladeHofseiteGeteilt(farmSlug, await searchParams)
  const robots = ansicht.noindex ? { robots: { index: false, follow: false } } : {}
  if (!farm) return { title: 'Hof nicht gefunden', ...robots }

  const desc = (farm.aboutText ?? farm.description).slice(0, 155)

  return {
    title: `${farm.name} — Frische Produkte direkt vom Hof`,
    description: desc,
    ...robots,
    openGraph: {
      title: farm.name,
      description: desc,
      type: 'website',
      // Das Titelbild, ohne Titelbild das der Startseite — ein geteilter
      // Hof-Link soll nie ohne Bild ankommen (src/lib/vorschaubild.ts).
      images: [hofVorschaubild(farm)],
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
  const suche = await searchParams
  const { farm, ansicht } = await ladeHofseiteGeteilt(farmSlug, suche)

  if (!farm) notFound()

  const activeStatus = await getActiveStatusPost(farm.id)
  // Wo Kaufen nicht wirkt (Vorschau), gibt es keinen Korb — also auch nichts,
  // was ein Nachbestell-Link hineinlegen dürfte (korbErlaubt, src/lib/hofseite-vorschau.ts).
  const reorder = typeof suche.reorder === 'string' ? suche.reorder : undefined
  const reorderItems = reorder && ansicht.kaufen ? await loadReorderItems(reorder, farm.id) : []

  return (
    <FarmPageView
      farm={farm}
      activeStatus={activeStatus}
      reorderItems={reorderItems}
      ownerMode={false}
      ansicht={ansicht}
    />
  )
}
