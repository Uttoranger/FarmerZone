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

export function OrdersClient({ orders, farmSlug }: { orders: FarmerOrder[]; farmSlug: string }) {
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

  const shopUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/${farmSlug}`

  return (
    <div>
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
              filter === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📬</div>
          {filter === 'active' && orders.length === 0 ? (
            <>
              <p className="font-medium text-foreground mb-1">Noch keine Bestellungen</p>
              <p className="text-sm text-muted-foreground mb-6">
                Teile deinen Shop-Link, damit Kunden bestellen können.
              </p>
              <div className="inline-flex flex-col sm:flex-row gap-2 items-center">
                <button
                  onClick={() => {
                    navigator.clipboard
                      .writeText(shopUrl)
                      .then(() => alert('Shop-Link kopiert!'))
                      .catch(() => {})
                  }}
                  className="h-10 px-4 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent-hover transition-colors"
                >
                  Shop-Link kopieren
                </button>
              </div>
            </>
          ) : filter === 'active' ? (
            <>
              <p className="font-semibold text-foreground mb-1">Alle Bestellungen erledigt! 🎉</p>
              <p className="text-sm text-muted-foreground">Super, du hast alles abgearbeitet.</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Keine Bestellungen in dieser Ansicht</p>
          )}
        </div>
      ) : (
        grouped.map((group) => (
          <div key={group[0].pickupDate.toISOString()} className="mb-6">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {formatGroupDate(group[0].pickupDate)}
              <span className="ml-2 text-muted-foreground/60 normal-case font-normal tracking-normal">
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
