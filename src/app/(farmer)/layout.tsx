import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getOpenOrdersCount } from '@/server/queries/orders'
import { FarmerNav } from '@/components/farmer/farmer-nav'
import { ShopLinkBanner } from '@/components/farmer/shop-link-banner'

export default async function FarmerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect('/login')
  }

  const role = (session.user as typeof session.user & { role: string }).role
  if (role !== 'FARMER') {
    redirect('/login')
  }

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/onboarding')

  const openOrdersCount = await getOpenOrdersCount(farm.id)

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <FarmerNav
          farmName={farm.name}
          userName={session.user.name ?? ''}
          ordersBadge={openOrdersCount > 0 ? openOrdersCount : undefined}
        />

        {/* min-w-0: als Flex-Item darf main nicht mit breitem Inhalt über den
            Viewport wachsen — sonst greift kein overflow-x-auto der Kinder */}
        <main className="flex-1 min-w-0 pb-24 md:pb-0 md:ml-56 print:ml-0 print:pb-0">
          <ShopLinkBanner farmSlug={farm.slug} />
          {children}
        </main>
      </div>
    </div>
  )
}
