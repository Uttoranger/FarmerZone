import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getOpenOrdersCount } from '@/server/queries/orders'
import { getFarmBannerState } from '@/server/queries/farm'
import { FarmerNav } from '@/components/farmer/farmer-nav'
import { ServiceWorkerAnmeldung } from '@/components/shared/service-worker-anmeldung'
import { SentryNutzer } from '@/components/farmer/sentry-nutzer'
import { ShopLinkBanner } from '@/components/farmer/shop-link-banner'
import { ArchivedFarmBanner } from '@/components/farmer/archived-farm-banner'
import { PendingApprovalBanner } from '@/components/farmer/pending-approval-banner'
import { alsLand } from '@/lib/laender'

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
  // Ein Zugriff für beide Balken (stillgelegt / wartet auf Freigabe)
  const bannerState = await getFarmBannerState(session.user.id)
  const isArchived = bannerState?.archivedAt != null
  const isPending = bannerState != null && bannerState.approvedAt == null

  return (
    <div className="min-h-screen bg-background">
      {/* Teilen-Service-Worker: hier angemeldet, weil jeder Bauer über das
          Layout kommt — die Installation als App (und damit das Teilen-Ziel)
          setzt genau diesen Worker voraus. */}
      <ServiceWorkerAnmeldung />
      {/* Sentry-Nutzerkennung: ausschließlich die Farm-ID (nie E-Mail, nie
          Name) — hier gesetzt, weil jeder Bauer über dieses Layout kommt. */}
      <SentryNutzer farmId={farm.id} />
      <div className="flex min-h-screen">
        <FarmerNav
          farmName={farm.name}
          userName={session.user.name ?? ''}
          ordersBadge={openOrdersCount > 0 ? openOrdersCount : undefined}
          farmLogoUrl={farm.logoUrl}
          // Derselbe Zustand, der den Freigabe-Balken auslöst — die Karte zeigt
          // ihn nur zusätzlich als ruhigen Punkt an der Hof-Identität an.
          farmPending={isPending}
        />

        {/* min-w-0: als Flex-Item darf main nicht mit breitem Inhalt über den
            Viewport wachsen — sonst greift kein overflow-x-auto der Kinder */}
        <main className="flex-1 min-w-0 pb-24 md:pb-0 md:ml-56 print:ml-0 print:pb-0">
          {/* Reihenfolge wie bei der Server-Prüfung: stillgelegt sticht
              „wartet auf Freigabe", beide ersetzen den Shop-Link-Banner —
              einen Shop-Link zu teilen, der ins Leere führt, wäre irreführend. */}
          {isArchived ? (
            <ArchivedFarmBanner />
          ) : isPending ? (
            <PendingApprovalBanner
              farmId={bannerState.id}
              farmName={bannerState.name}
              land={alsLand(bannerState.country)}
            />
          ) : (
            <ShopLinkBanner farmSlug={farm.slug} />
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
