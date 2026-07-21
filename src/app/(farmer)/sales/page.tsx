import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getSalesOverview } from '@/server/queries/manual-sales'
import { getProductsForFarm } from '@/server/queries/products'
import { getStripeReadiness } from '@/server/queries/farm'
import { SalesClient } from '@/components/sales/sales-client'

export default async function SalesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  const [overview, products, stripeReady] = await Promise.all([
    getSalesOverview(farm.id),
    getProductsForFarm(farm.id),
    getStripeReadiness(session.user.id),
  ])

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <SalesClient overview={overview} products={products} stripeReady={stripeReady} />
    </div>
  )
}
