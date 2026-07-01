'use client'

import { useState, useMemo } from 'react'
import { Bell, Phone, ChevronUp, ChevronDown } from 'lucide-react'
import type { CustomerSummary, CustomerStatus } from '@/server/queries/customers'
import { cn } from '@/lib/utils'

type ColSort = 'name' | 'orders' | 'spent' | 'last'
type SortDir = 'asc' | 'desc'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function avatarClass(c: CustomerSummary): string {
  if (c.isStammkunde) return 'bg-green-100 text-green-800'
  if (c.isLangeNichtGesehen) return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-600'
}

function statusBadgeClass(status: CustomerStatus): string {
  switch (status) {
    case 'Stammkunde': return 'bg-green-100 text-green-800'
    case 'Diesen Monat aktiv': return 'bg-blue-100 text-blue-800'
    case 'Lange nicht gesehen': return 'bg-amber-100 text-amber-800'
    case 'Neu': return 'bg-purple-100 text-purple-800'
    default: return ''
  }
}

function formatEuro(n: number): string {
  return `€ ${n.toFixed(2).replace('.', ',')}`
}

function SortIcon({ col, activeCol, dir }: { col: ColSort; activeCol: ColSort; dir: SortDir }) {
  if (col !== activeCol) return <ChevronDown className="size-3 text-muted-foreground/40 ml-0.5 inline" />
  return dir === 'asc'
    ? <ChevronUp className="size-3 text-primary ml-0.5 inline" />
    : <ChevronDown className="size-3 text-primary ml-0.5 inline" />
}

export function CustomersTable({ customers }: { customers: CustomerSummary[] }) {
  const [sortCol, setSortCol] = useState<ColSort>('orders')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(col: ColSort) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'name' ? 'asc' : 'desc')
    }
  }

  const sorted = useMemo(() => {
    return [...customers].sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'name': cmp = a.customerName.localeCompare(b.customerName, 'de'); break
        case 'orders': cmp = a.orderCount - b.orderCount; break
        case 'spent': cmp = a.totalSpent - b.totalSpent; break
        case 'last':
          cmp = new Date(a.lastOrderDate).getTime() - new Date(b.lastOrderDate).getTime()
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [customers, sortCol, sortDir])

  if (customers.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        Keine Kunden gefunden
      </div>
    )
  }

  const th = (label: string, col?: ColSort) =>
    col ? (
      <th
        className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground whitespace-nowrap"
        onClick={() => toggleSort(col)}
      >
        {label}
        <SortIcon col={col} activeCol={sortCol} dir={sortDir} />
      </th>
    ) : (
      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
        {label}
      </th>
    )

  return (
    <div className="overflow-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-secondary z-10">
          <tr className="border-b border-border">
            <th className="w-10 px-3 py-2.5" />
            {th('Name', 'name')}
            {th('Status')}
            {th('Bestellungen', 'orders')}
            {th('Umsatz', 'spent')}
            {th('Letzte Bestellung', 'last')}
            {th('Häufig bestellt')}
            {th('Kontakt')}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((c) => (
            <tr
              key={c.customerEmail}
              className="hover:bg-muted/40 transition-colors cursor-pointer"
              onClick={() => {
                window.location.href = `/customers/${encodeURIComponent(c.customerEmail)}`
              }}
            >
              {/* Avatar */}
              <td className="px-3 py-2.5">
                <div
                  className={cn(
                    'size-8 rounded-full flex items-center justify-center text-xs font-bold',
                    avatarClass(c)
                  )}
                >
                  {initials(c.customerName)}
                </div>
              </td>

              {/* Name + bell */}
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  {c.isSubscribed && <Bell className="size-3 text-primary shrink-0" />}
                  <span className="font-medium text-foreground whitespace-nowrap">
                    {c.customerName}
                  </span>
                </div>
              </td>

              {/* Status badge */}
              <td className="px-3 py-2.5">
                {c.status && (
                  <span
                    className={cn(
                      'text-xs rounded-full px-2 py-0.5 font-medium whitespace-nowrap',
                      statusBadgeClass(c.status)
                    )}
                  >
                    {c.status}
                  </span>
                )}
              </td>

              {/* Order count */}
              <td className="px-3 py-2.5 text-foreground tabular-nums">
                {c.orderCount}
              </td>

              {/* Total spent */}
              <td className="px-3 py-2.5 font-semibold text-foreground tabular-nums whitespace-nowrap">
                {formatEuro(c.totalSpent)}
              </td>

              {/* Last order */}
              <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                {c.lastOrderShort}
              </td>

              {/* Top product */}
              <td className="px-3 py-2.5 text-muted-foreground max-w-[140px]">
                <span className="truncate block">
                  {c.topProducts[0]?.name ?? '—'}
                </span>
              </td>

              {/* Phone action */}
              <td className="px-3 py-2.5">
                {c.customerPhone ? (
                  <a
                    href={`tel:${c.customerPhone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="size-7 flex items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                    title={c.customerPhone}
                  >
                    <Phone className="size-3.5" />
                  </a>
                ) : (
                  <span className="text-muted-foreground/30 text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
