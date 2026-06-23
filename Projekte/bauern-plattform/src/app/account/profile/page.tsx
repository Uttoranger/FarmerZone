import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ProfileClient } from './profile-client'

export const dynamic = 'force-dynamic'

export default async function AccountProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/account/login')

  const customerEmail = session.user.email.toLowerCase()

  const subscriptions = await prisma.customerFarmSubscription.findMany({
    where: { customerEmail },
    include: { farm: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <ProfileClient
      user={{
        id: session.user.id,
        name: session.user.name ?? '',
        email: session.user.email,
      }}
      subscriptions={subscriptions.map((s) => ({
        farmId: s.farmId,
        farmName: s.farm.name,
        farmSlug: s.farm.slug,
        optInEmail: s.optInEmail,
        optInWhatsApp: s.optInWhatsApp,
        customerPhone: s.customerPhone ?? null,
      }))}
    />
  )
}
