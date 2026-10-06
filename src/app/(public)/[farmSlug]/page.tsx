import { notFound, unstable_rethrow } from 'next/navigation'
import type { Metadata } from 'next'
import * as Sentry from '@sentry/nextjs'
import { getActiveStatusPost, type ActiveStatusPost } from '@/server/queries/status-posts'
import { ladeHofseiteGeteilt } from '@/server/hofseite-vorschau'
import { verifyReorderToken } from '@/lib/reorder-token'
import { prisma } from '@/lib/prisma'
import { hofVorschaubild } from '@/lib/vorschaubild'
import type { Suchparameter } from '@/lib/ansichts-modus'
import { nachbestellToken } from '@/schemas/nachbestellung'
import { FarmPageView } from '@/components/farm/farm-page-view'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { StartseiteFuss } from '@/components/startseite/startseite-abschnitte'

export const dynamic = 'force-dynamic'

/*
 * Seit Nachtlauf Nr. 10 im neuen Design in der KundeShell (Gate 4; Mockups
 * web-k2-hofseite, web-k2-alle-produkte-nach-kategorie, mobil-k2-*). Die
 * Sitzung für die Kopfzeile liest KundeShellMitSitzung im Browser — die Seite
 * liest sie für Kundinnen nicht auf dem Server (ansichtsModus fragt sie nur
 * mit ?vorschau=1). Dynamisch war sie schon vorher: Suchparameter (Bereich,
 * Reiter, Nachbestell-Link, Vorschau) und der Bestand mit der Fristfreigabe
 * beim Lesen.
 *
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

/**
 * Der aktuelle Beitrag des Hofs. Scheitert das Laden, fehlt nur der Reiter
 * „Beiträge" — die Seite mit Produkten und Korb bleibt (Fehler inline statt
 * der 500 für alles); der Fehler geht nach Sentry.
 */
async function ladeBeitrag(farmId: string): Promise<ActiveStatusPost | null> {
  try {
    return await getActiveStatusPost(farmId)
  } catch (err) {
    unstable_rethrow(err)
    Sentry.captureException(err, { tags: { bereich: 'hofseite-beitrag' } })
    return null
  }
}

export default async function FarmPage({ params, searchParams }: Props) {
  const { farmSlug } = await params
  const suche = await searchParams
  const { farm, ansicht } = await ladeHofseiteGeteilt(farmSlug, suche)

  if (!farm) notFound()

  const activeStatus = await ladeBeitrag(farm.id)
  // Wo Kaufen nicht wirkt (Vorschau), gibt es keinen Korb — also auch nichts,
  // was ein Nachbestell-Link hineinlegen dürfte (korbErlaubt, src/lib/hofseite-vorschau.ts).
  const reorder = nachbestellToken(suche.reorder)
  const reorderItems = reorder && ansicht.kaufen ? await loadReorderItems(reorder, farm.id) : []
  // Einmal hier, auf dem Server: Gebührensatz und „vor 2 Tagen" rechnen in
  // Server und Browser vom selben Zeitpunkt (sonst Hydration-Abweichung).
  const jetzt = new Date()

  return (
    <KundeShellMitSitzung>
      <FarmPageView
        farm={farm}
        activeStatus={activeStatus}
        reorderItems={reorderItems}
        ownerMode={false}
        ansicht={ansicht}
        jetzt={jetzt.toISOString()}
      />
      {/* Der Fuß der Startseite — ein Server-Teil, deshalb hier statt in der Client-Komponente. */}
      <StartseiteFuss jahr={jetzt.getFullYear()} />
    </KundeShellMitSitzung>
  )
}
