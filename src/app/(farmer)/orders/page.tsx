import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getOrdersForFarm } from '@/server/queries/orders'
import { OrdersClient } from '@/components/orders/orders-client'

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  const orders = await getOrdersForFarm(farm.id)

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-medium text-slate-800 mb-5">Bestellungen</h1>
      <OrdersClient orders={orders} />
    </div>
  )
}
