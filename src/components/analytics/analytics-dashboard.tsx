'use client'

import { useRouter } from 'next/navigation'
import { SegmentControl } from '@/components/farmer/segment-control'
import { TrendingUp, TrendingDown, Minus, Lightbulb, Package } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import type { AnalyticsData, PeriodKey } from '@/server/queries/analytics'

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'week', label: 'Woche' },
  { key: 'month', label: 'Monat' },
  { key: 'quarter', label: 'Quartal' },
  { key: 'year', label: 'Jahr' },
]

const CHANNEL_COLORS: Record<string, string> = {
  PLATFORM: '#2563eb',
  HOFLADEN: '#16a34a',
  WHATSAPP: '#25d366',
  MARKT: '#d97706',
  BUSINESS: '#7c3aed',
  OTHER: '#64748b',
}

function formatEuro(amount: number) {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(amount)
}

type Props = {
  data: AnalyticsData
  currentPeriod: PeriodKey
}

export function AnalyticsDashboard({ data, currentPeriod }: Props) {
  const router = useRouter()

  function setPeriod(p: PeriodKey) {
    router.push(`/analytics?period=${p}`)
  }

  const { totalRevenue, changePercent, channelRevenue, topProducts, insight } = data

  const maxProductAmount = topProducts[0]?.totalAmount ?? 1

  return (
    <div className="space-y-6">

      {/* Period selector */}
      <SegmentControl options={PERIODS} value={currentPeriod} onChange={setPeriod} />

      {/* Total revenue card */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Gesamtumsatz</p>
          <div className="flex items-end gap-3 flex-wrap">
            <span className="font-heading text-4xl font-bold text-foreground tabular-nums">
              {formatEuro(totalRevenue)}
            </span>
            {changePercent !== null && (
              <div
                className={`flex items-center gap-1 text-sm font-medium mb-1 ${
                  changePercent > 0
                    ? 'text-green-600'
                    : changePercent < 0
                    ? 'text-red-500'
                    : 'text-muted-foreground/70'
                }`}
              >
                {changePercent > 2 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : changePercent < -2 ? (
                  <TrendingDown className="w-4 h-4" />
                ) : (
                  <Minus className="w-4 h-4" />
                )}
                {changePercent > 0 ? '+' : ''}
                {changePercent.toFixed(1)} %
                <span className="text-muted-foreground/70 font-normal">vs. Vorperiode</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Channel bar chart */}
      {channelRevenue.length > 0 ? (
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">
              Umsatz nach Kanal
            </p>
            <ResponsiveContainer width="100%" height={Math.max(160, channelRevenue.length * 44)}>
              <BarChart
                data={channelRevenue}
                layout="vertical"
                margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tickFormatter={(v) => `€${v}`}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={90}
                  tick={{ fontSize: 12, fill: '#475569' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v) => [formatEuro(Number(v ?? 0)), 'Umsatz']}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  cursor={{ fill: '#f1f5f9' }}
                />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={32}>
                  {channelRevenue.map((entry) => (
                    <Cell
                      key={entry.channel}
                      fill={CHANNEL_COLORS[entry.channel] ?? '#64748b'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground/70">
            <p className="text-sm">Noch keine Verkäufe in diesem Zeitraum</p>
          </CardContent>
        </Card>
      )}

      {/* Top products */}
      {topProducts.length > 0 && (
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-4">
              Top-Produkte
            </p>
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground/70 w-4 text-right shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 truncate pr-2">
                        {p.productName}
                      </span>
                      <span className="text-sm font-semibold text-foreground shrink-0 tabular-nums">
                        {formatEuro(p.totalAmount)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#F0EDE5] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#7BAE85] rounded-full transition-all"
                        style={{
                          width: `${Math.round((p.totalAmount / maxProductAmount) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insight box */}
      {insight && (
        <div className="flex gap-3 p-4 bg-[#F2ECDC] rounded-xl border border-amber-100">
          <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-[#6E5F45]">{insight}</p>
        </div>
      )}

      {/* Empty state */}
      {totalRevenue === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📊</div>
          <p className="font-medium text-slate-700 mb-1">Noch keine Verkaufsdaten</p>
          <p className="text-sm text-muted-foreground/70 max-w-xs mx-auto leading-relaxed">
            Sobald Bestellungen abgewickelt oder Direktverkäufe eingetragen werden,
            erscheinen hier deine Auswertungen.
          </p>
        </div>
      )}
    </div>
  )
}
