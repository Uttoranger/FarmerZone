import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getCustomersForFarm } from '@/server/queries/customers'
import { CustomersClient } from './customers-client'
import { PageHeader } from '@/components/farmer/page-header'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  const customers = await getCustomersForFarm(farm.id)

  return (
    <div className="px-4 py-6 max-w-2xl md:max-w-6xl mx-auto">
      <PageHeader
        title="Meine Kunden"
        subtitle="Alle, die bisher bei dir bestellt haben"
        badge={
          <span className="text-sm text-muted-foreground bg-muted rounded-full px-2.5 py-0.5">
            {customers.length} {customers.length === 1 ? 'Person' : 'Personen'}
          </span>
        }
      />
      <CustomersClient customers={customers} />
    </div>
  )
}
