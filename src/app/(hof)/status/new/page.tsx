import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getStatusTemplate } from '@/server/queries/status-posts'
import { prisma } from '@/lib/prisma'
import { WERBEMAIL_EMPFAENGER } from '@/server/abo-anmeldung'
import { BEITRAEGE_HREF } from '@/lib/bauern-navigation'
import { ZurueckLink } from '@/components/hofbereich/zurueck-link'
import { StatusNewClient } from './status-new-client'

export const metadata: Metadata = { title: 'Neuer Beitrag — FarmerZone' }

export const dynamic = 'force-dynamic'

/*
 * „Neuer Beitrag" (Wizard Inhalt → Empfänger → Versand) in der HofShell
 * (Nachtlauf Nr. 22e): dieselbe Action publishStatusPost und derselbe Ablauf
 * wie bisher, nur in die Routengruppe (hof) gezogen und auf Tokens gestellt.
 * Das Teilen-Fenster (Mockup web-h4-teilen-fenster-mit-bild) steht seit
 * Nr. 21 auf Heute; dieser Ablauf bleibt der Weg für Beiträge mit Foto und
 * Versand an Abonnentinnen. Zurück führt in den Reiter „Beiträge" von Mein Hof.
 */

export default async function StatusNewPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  // Vorlage-Muster: ?from={id} lädt einen Alt-Status als Vorbefüllung —
  // serverseitig und farm-gescoped (Ownership); fremde/ungültige ID → null
  const { from } = await searchParams
  const template = await getStatusTemplate(farm.id, from)

  const [products, emailCount, whatsAppCount, recentEmail] = await Promise.all([
    prisma.product.findMany({
      where: { farmId: farm.id, isAvailable: true },
      select: { id: true, name: true, price: true },
      orderBy: { name: 'asc' },
    }),
    // Dieselben Empfänger wie beim Versand: Bestand und bestätigte Anmeldungen (S11).
    prisma.customerFarmSubscription.count({ where: { farmId: farm.id, ...WERBEMAIL_EMPFAENGER } }),
    prisma.customerFarmSubscription.count({ where: { farmId: farm.id, optInWhatsApp: true } }),
    prisma.statusPost.findFirst({
      where: {
        farmId: farm.id,
        sentViaEmail: true,
        publishedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { publishedAt: true },
    }),
  ])

  return (
    <div className="mx-auto max-w-2xl px-4 pt-5 pb-12 md:px-8 md:pt-7">
      <ZurueckLink href={BEITRAEGE_HREF}>Beiträge</ZurueckLink>
      <StatusNewClient
        products={products.map((p) => ({ id: p.id, name: p.name, price: Number(p.price) }))}
        emailCount={emailCount}
        whatsAppCount={whatsAppCount}
        recentEmailSentAt={recentEmail?.publishedAt?.toISOString() ?? null}
        farmSlug={farm.id}
        prefill={template}
      />
    </div>
  )
}
