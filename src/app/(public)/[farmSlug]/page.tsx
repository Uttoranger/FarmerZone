import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getActiveStatusPost } from '@/server/queries/status-posts'
import { ladeHofseiteGeteilt } from '@/server/hofseite-vorschau'
import { verifyReorderToken } from '@/lib/reorder-token'
import { prisma } from '@/lib/prisma'
import { hofVorschaubild } from '@/lib/vorschaubild'
import { VORSCHAU_PARAMETER } from '@/lib/hofseite-vorschau'
import { FarmPageView } from '@/components/farm/farm-page-view'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ farmSlug: string }>
  searchParams: Promise<{ reorder?: string; [VORSCHAU_PARAMETER]?: string | string[] }>
}

/**
 * Der Parameter, wie Next ihn für die Header-Regel liest (next.config.ts,
 * `has: query`): steht er mehrfach in der Adresse, zählt der letzte Wert.
 * Seite und Header sollen dieselbe Adresse gleich verstehen.
 */
function vorschauParameter(wert: string | string[] | undefined): string | undefined {
  return Array.isArray(wert) ? wert.at(-1) : wert
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { farmSlug } = await params
  const vorschau = vorschauParameter((await searchParams)[VORSCHAU_PARAMETER])
  const { farm } = await ladeHofseiteGeteilt(farmSlug, vorschau)
  // Eine Adresse mit dem Parameter ist nie eine Seite für Suchmaschinen —
  // auch dann nicht, wenn jemand ohne Recht oder mit falschem Wert kommt und
  // die öffentliche Seite bekommt.
  const robots = vorschau !== undefined ? { robots: { index: false, follow: false } } : {}
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
  const { farm, vorschau: istVorschau } = await ladeHofseiteGeteilt(farmSlug, vorschauParameter(suche[VORSCHAU_PARAMETER]))

  if (!farm) notFound()

  const activeStatus = await getActiveStatusPost(farm.id)
  // In der Vorschau gibt es keinen Korb — also auch nichts, was ein
  // Nachbestell-Link hineinlegen dürfte (korbErlaubt, src/lib/hofseite-vorschau.ts).
  const reorderItems = suche.reorder && !istVorschau ? await loadReorderItems(suche.reorder, farm.id) : []

  return (
    <FarmPageView
      farm={farm}
      activeStatus={activeStatus}
      reorderItems={reorderItems}
      ownerMode={false}
      vorschau={istVorschau}
    />
  )
}
