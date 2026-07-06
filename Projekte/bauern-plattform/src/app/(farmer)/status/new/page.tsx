import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { prisma } from '@/lib/prisma'
import { StatusNewClient } from './status-new-client'

export const dynamic = 'force-dynamic'

export default async function StatusNewPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  const [products, emailCount, whatsAppCount, recentEmail] = await Promise.all([
    prisma.product.findMany({
      where: { farmId: farm.id, isAvailable: true },
      select: { id: true, name: true, price: true },
      orderBy: { name: 'asc' },
    }),
    prisma.customerFarmSubscription.count({ where: { farmId: farm.id, optInEmail: true } }),
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
    <div className="px-4 py-6">
      <StatusNewClient
        products={products.map((p) => ({ id: p.id, name: p.name, price: Number(p.price) }))}
        emailCount={emailCount}
        whatsAppCount={whatsAppCount}
        recentEmailSentAt={recentEmail?.publishedAt?.toISOString() ?? null}
        farmSlug={farm.id}
      />
    </div>
  )
}
