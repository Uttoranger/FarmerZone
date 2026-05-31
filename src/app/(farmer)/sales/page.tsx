import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getRecentManualSales } from '@/server/queries/manual-sales'
import { getProductsForFarm } from '@/server/queries/products'
import { SalesClient } from '@/components/sales/sales-client'

export default async function SalesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  const [recentSales, products] = await Promise.all([
    getRecentManualSales(farm.id, 20),
    getProductsForFarm(farm.id),
  ])

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <SalesClient recentSales={recentSales} products={products} />
    </div>
  )
}
