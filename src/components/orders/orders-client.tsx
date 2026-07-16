'use client'

import { useState, useMemo } from 'react'
import type { FarmerOrder } from '@/server/queries/orders'
import { OrderCard } from './order-card'
import { ACTIVE_STATUSES, DONE_STATUSES } from './order-status'
import { groupOrdersByPickupDay } from '@/lib/order-groups'
import { SegmentControl } from '@/components/farmer/segment-control'

type Filter = 'active' | 'today' | 'all' | 'done'

export function OrdersClient({
  orders,
  farmSlug,
  farmName,
}: {
  orders: FarmerOrder[]
  farmSlug: string
  farmName: string
}) {
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

  const grouped = useMemo(() => groupOrdersByPickupDay(filtered), [filtered])

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
      <div className="mb-5 overflow-x-auto pb-1">
        <SegmentControl options={tabs} value={filter} onChange={setFilter} className="w-fit" />
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
          <div key={group.key} className="mb-6">
            <h2
              className="text-[13px] font-bold uppercase mb-2.5"
              style={{ color: '#8B6B4F', letterSpacing: '0.05em' }}
            >
              Abholung {group.label}
              <span className="ml-2 normal-case font-normal tracking-normal" style={{ color: '#9AA08F' }}>
                {group.orders[0].pickupTimeStart}–{group.orders[group.orders.length - 1].pickupTimeEnd} Uhr
              </span>
            </h2>
            <div className="flex flex-col gap-3">
              {group.orders.map((order) => (
                <OrderCard key={order.id} order={order} farmName={farmName} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
