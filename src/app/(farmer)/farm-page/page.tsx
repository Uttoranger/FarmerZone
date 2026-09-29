import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getMeinHofKopf, getOwnerFarm } from '@/server/queries/farm'
import { getActiveStatusPost, getPastStatusCount } from '@/server/queries/status-posts'
import { FarmPageClient } from '@/components/farmer/farm-page-client'
import { MeinHofKopf } from '@/components/farmer/mein-hof-kopf'
import { zaehleProdukte } from '@/server/queries/mein-hof-zahl'

export const dynamic = 'force-dynamic'

export default async function FarmPageOwnerRoute() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getOwnerFarm(session.user.id)
  if (!farm) redirect('/onboarding')

  const [activeStatus, pastStatusCount, kopf, produktZahl] = await Promise.all([
    getActiveStatusPost(farm.id),
    getPastStatusCount(farm.id),
    getMeinHofKopf(session.user.id),
    zaehleProdukte(farm.id),
  ])

  return (
    <>
      {/* Der Kopf von „Mein Hof" über der unveränderten Hofseiten-Bearbeitung. */}
      <div className="px-4 pt-6 max-w-2xl mx-auto">
        <MeinHofKopf hof={kopf} aktiv="hofseite" produktZahl={produktZahl} />
      </div>
      <FarmPageClient farm={farm} activeStatus={activeStatus} pastStatusCount={pastStatusCount} />
    </>
  )
}
