import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getAnalyticsData, getYtdRevenue, type PeriodKey } from '@/server/queries/analytics'
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard'
import { PageHeader } from '@/components/farmer/page-header'

const VALID_PERIODS: PeriodKey[] = ['week', 'month', 'quarter', 'year']
const LIMIT_40K = 40_000

function formatEuro(n: number) {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

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

  const [data, ytdRevenue] = await Promise.all([
    getAnalyticsData(farm.id, period),
    getYtdRevenue(farm.id),
  ])

  const pct = Math.min(100, (ytdRevenue / LIMIT_40K) * 100)
  const remaining = Math.max(0, LIMIT_40K - ytdRevenue)
  const year = new Date().getFullYear()

  let barColor = 'bg-primary/80'
  let textColor = 'text-primary'
  let bgColor = 'bg-primary/8 border-green-200'
  let statusLabel = 'Im grünen Bereich'
  if (pct >= 95) {
    barColor = 'bg-red-500'
    textColor = 'text-red-700'
    bgColor = 'bg-red-50 border-red-200'
    statusLabel = 'Grenze fast erreicht!'
  } else if (pct >= 75) {
    barColor = 'bg-amber-500'
    textColor = 'text-amber-700'
    bgColor = 'bg-amber-50 border-amber-200'
    statusLabel = 'Achtung: Grenze nähert sich'
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <PageHeader title="Auswertung" subtitle="Umsatz und Verkaufskanäle im Überblick" />

      {/* 40k Direktvermarktungs-Grenze */}
      <div className={`rounded-2xl border p-5 mb-6 ${bgColor}`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${textColor}`}>
              40.000 € Direktvermarktungs-Grenze {year}
            </p>
            <p className="text-2xl font-bold text-foreground">
              {formatEuro(ytdRevenue)}
              <span className="text-sm font-normal text-muted-foreground ml-1.5">
                von {formatEuro(LIMIT_40K)}
              </span>
            </p>
          </div>
          <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${
            pct >= 95 ? 'bg-red-100 text-red-800'
            : pct >= 75 ? 'bg-amber-100 text-amber-800'
            : 'bg-green-100 text-green-800'
          }`}>
            {pct.toFixed(0)} %
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2.5 rounded-full bg-black/10 overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className={`font-medium ${textColor}`}>{statusLabel}</span>
          {remaining > 0 && (
            <span className="text-muted-foreground">
              Noch {formatEuro(remaining)} Spielraum
            </span>
          )}
        </div>

        {pct >= 75 && (
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed border-t border-black/10 pt-3">
            {pct >= 95
              ? 'Du hast die Steuerfreigrenze für Direktvermarktung fast erreicht. Bitte konsultiere deinen Steuerberater.'
              : 'Du nähert dich der 40.000 € Grenze für steuerfreie Direktvermarktung. Sprich ggf. mit deinem Steuerberater.'}
          </p>
        )}
      </div>

      <AnalyticsDashboard data={data} currentPeriod={period} />
    </div>
  )
}

