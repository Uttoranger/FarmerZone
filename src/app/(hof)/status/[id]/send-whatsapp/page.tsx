import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UnterseitenKopf } from '@/components/hofbereich/unterseiten-kopf'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getStatusPostForWhatsApp } from '@/server/queries/status-posts'
import { WhatsAppTapClient } from './whatsapp-tap-client'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `WhatsApp versenden — ${MARKE}` }

export const dynamic = 'force-dynamic'

/*
 * WhatsApp an Abonnentinnen (je Person ein Tipp) in der HofShell (Nachtlauf
 * Nr. 22e; seit Nr. 66 ehrlich und fortsetzbar, Register W1): Hof der
 * Sitzung, fremde ID → 404; die Empfängerinnen live, dazu, wer schon
 * geöffnet bekam — gespeichert je Person über setzeWhatsAppGetippt. Zurück
 * führt in den Reiter „Beiträge" (UnterseitenKopf, seit Nr. 44 am Handy fest
 * oben).
 * Das Teilen über das Telefon (Mockup mobil-h4-teilen-ueber-das-telefon)
 * kommt mit Gate 7 (Nr. 21).
 */

interface Props {
  params: Promise<{ id: string }>
}

export default async function SendWhatsAppPage({ params }: Props) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  const { id } = await params
  // Ob der Beitrag auf der Hofseite steht, bestimmt den Link in der Nachricht (Register T5). Besitz in der WHERE-Klausel wie bei der Liste.
  const [data, aufHofseite] = await Promise.all([
    getStatusPostForWhatsApp(farm.id, id),
    prisma.statusPost.findFirst({ where: { id, farmId: farm.id }, select: { showOnFarmPage: true } }),
  ])
  if (!data || !aufHofseite) notFound()

  return (
    <div className="mx-auto max-w-xl px-4 pt-5 pb-12 md:px-8 md:pt-7">
      <UnterseitenKopf />
      <WhatsAppTapClient
        postId={data.id}
        title={data.title}
        body={data.body}
        farmSlug={data.farm.slug}
        showOnFarmPage={aufHofseite.showOnFarmPage}
        abonnentinnen={data.abonnentinnen}
        getippt={data.getippt}
      />
    </div>
  )
}
