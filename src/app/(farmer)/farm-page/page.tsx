import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getOwnerFarm } from '@/server/queries/farm'
import { getActiveStatusPost, getPastStatusCount } from '@/server/queries/status-posts'
import { FarmPageClient } from '@/components/farmer/farm-page-client'

export const dynamic = 'force-dynamic'

export default async function FarmPageOwnerRoute() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getOwnerFarm(session.user.id)
  if (!farm) redirect('/onboarding')

  const [activeStatus, pastStatusCount] = await Promise.all([
    getActiveStatusPost(farm.id),
    getPastStatusCount(farm.id),
  ])

  return <FarmPageClient farm={farm} activeStatus={activeStatus} pastStatusCount={pastStatusCount} />
}
