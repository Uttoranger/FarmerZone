import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { getAppearanceData } from '@/server/queries/appearance'
import { AppearanceClient } from './appearance-client'

export const metadata: Metadata = { title: 'Mein Auftritt — FarmerZone' }
export const dynamic = 'force-dynamic'

export default async function AppearancePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const data = await getAppearanceData(session.user.id)
  if (!data) redirect('/login')

  return (
    <div className="px-4 py-6">
      <AppearanceClient
        initialData={{
          tagline: data.tagline ?? '',
          foundedYear: data.foundedYear ? String(data.foundedYear) : '',
          aboutText: data.aboutText ?? '',
          bannerValue: data.bannerValue ?? 'tannengruen',
          sectionsConfig: data.sectionsConfig,
          farmValues: data.farmValues.map((v) => ({
            icon: v.icon,
            title: v.title,
            subtitle: v.subtitle ?? '',
          })),
          farmSlug: data.slug,
        }}
      />
    </div>
  )
}
