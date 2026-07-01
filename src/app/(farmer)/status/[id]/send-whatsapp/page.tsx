import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getStatusPostForWhatsApp } from '@/server/queries/status-posts'
import { WhatsAppTapClient } from './whatsapp-tap-client'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function SendWhatsAppPage({ params }: Props) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  const { id } = await params
  const data = await getStatusPostForWhatsApp(farm.id, id)
  if (!data) notFound()

  return (
    <div className="px-4 py-6 max-w-xl mx-auto">
      <Link
        href="/status"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
      >
        ← Zurück zu Status
      </Link>
      <WhatsAppTapClient
        postId={data.id}
        title={data.title}
        body={data.body}
        farmName={data.farm.name}
        farmSlug={data.farm.slug}
        subscribers={data.subscribers}
        initialSentCount={data.whatsappSentCount}
      />
    </div>
  )
}
