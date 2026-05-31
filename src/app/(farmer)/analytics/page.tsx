import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getAnalyticsData, type PeriodKey } from '@/server/queries/analytics'
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard'

const VALID_PERIODS: PeriodKey[] = ['week', 'month', 'quarter', 'year']

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  const params = await searchParams
  const period: PeriodKey = VALID_PERIODS.includes(params.period as PeriodKey)
    ? (params.period as PeriodKey)
    : 'week'

  const data = await getAnalyticsData(farm.id, period)

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-slate-800">Auswertung</h1>
        <p className="text-sm text-slate-500 mt-0.5">Umsatz und Verkaufskanäle im Überblick</p>
      </div>
      <AnalyticsDashboard data={data} currentPeriod={period} />
    </div>
  )
}
