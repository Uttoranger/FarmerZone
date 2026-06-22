'use client'

import { useState, useMemo } from 'react'
import type { FarmerOrder } from '@/server/queries/orders'
import { OrderCard } from './order-card'
import { ACTIVE_STATUSES, DONE_STATUSES } from './order-status'

type Filter = 'active' | 'today' | 'all' | 'done'

function formatGroupDate(date: Date): string {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const d = new Date(date)
  if (d.toDateString() === today.toDateString()) return 'Heute'
  if (d.toDateString() === tomorrow.toDateString()) return 'Morgen'
  return d.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function OrdersClient({ orders }: { orders: FarmerOrder[] }) {
  const [filter, setFilter] = useState<Filter>('active')

  const todayStr = new Date().toDateString()
  const activeSet = ACTIVE_STATUSES as readonly string[]
  const doneSet = DONE_STATUSES as readonly string[]

  const filtered = useMemo(() => {
    switch (filter) {
      case 'today':
        return orders.filter((o) => new Date(o.pickupDate).toDateString() === todayStr)
      case 'active':
        return orders.filter((o) => activeSet.includes(o.status))
      case 'done':
        return orders.filter((o) => doneSet.includes(o.status))
      default:
        return orders
    }
  }, [orders, filter, todayStr, activeSet, doneSet])

  // Group by pickup date string → preserve order
  const grouped = useMemo(() => {
    const map = new Map<string, FarmerOrder[]>()
    for (const order of filtered) {
      const key = new Date(order.pickupDate).toDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(order)
    }
    return Array.from(map.values())
  }, [filtered])

  const counts = {
    active: orders.filter((o) => activeSet.includes(o.status)).length,
    today: orders.filter((o) => new Date(o.pickupDate).toDateString() === todayStr).length,
    done: orders.filter((o) => doneSet.includes(o.status)).length,
    all: orders.length,
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: 'active', label: `Offen (${counts.active})` },
    { key: 'today', label: `Heute (${counts.today})` },
    { key: 'all', label: `Alle (${counts.all})` },
    { key: 'done', label: `Erledigt (${counts.done})` },
  ]

  return (
    <div>
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-green-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-12">Keine Bestellungen</p>
      ) : (
        grouped.map((group) => (
          <div key={group[0].pickupDate.toISOString()} className="mb-6">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              {formatGroupDate(group[0].pickupDate)}
              <span className="ml-2 text-slate-400 normal-case font-normal tracking-normal">
                {group[0].pickupTimeStart}–{group[group.length - 1].pickupTimeEnd} Uhr
              </span>
            </h2>
            <div className="flex flex-col gap-3">
              {group.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
