'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Bell, Phone, ChevronDown } from 'lucide-react'
import type { CustomerSummary, CustomerStatus } from '@/server/queries/customers'
import { CustomersTable } from '@/components/customers/customers-table'
import { cn } from '@/lib/utils'

type FilterType = 'all' | 'stammkunde' | 'aktiv' | 'lange' | 'neu'
type SortType = 'orders' | 'spent' | 'last' | 'alpha' | 'newest'

const SORT_LABELS: Record<SortType, string> = {
  orders: 'Häufigste Besteller',
  spent: 'Höchster Umsatz',
  last: 'Letzte Bestellung',
  alpha: 'Alphabetisch',
  newest: 'Neueste Kunden',
}

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

export function CustomersClient({ customers }: { customers: CustomerSummary[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<SortType>('orders')
  const [sortOpen, setSortOpen] = useState(false)

  const counts = useMemo(() => ({
    all: customers.length,
    stammkunde: customers.filter((c) => c.isStammkunde).length,
    aktiv: customers.filter((c) => c.isDiesenMonatAktiv).length,
    lange: customers.filter((c) => c.isLangeNichtGesehen).length,
    neu: customers.filter((c) => c.isNeu).length,
  }), [customers])

  // Search + pill filter only — no sort (table handles its own sort on desktop)
  const filtered = useMemo(() => {
    let list = customers
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.customerName.toLowerCase().includes(q) ||
          c.customerPhone.toLowerCase().includes(q) ||
          c.customerEmail.toLowerCase().includes(q)
      )
    }
    switch (filter) {
      case 'stammkunde': list = list.filter((c) => c.isStammkunde); break
      case 'aktiv': list = list.filter((c) => c.isDiesenMonatAktiv); break
      case 'lange': list = list.filter((c) => c.isLangeNichtGesehen); break
      case 'neu': list = list.filter((c) => c.isNeu); break
    }
    return list
  }, [customers, search, filter])

  // Sorted version — only used for mobile cards
  const sortedForCards = useMemo(() => {
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'orders': return b.orderCount - a.orderCount
        case 'spent': return b.totalSpent - a.totalSpent
        case 'last':
          return new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime()
        case 'alpha':
          return a.customerName.localeCompare(b.customerName, 'de')
        case 'newest':
          return new Date(b.firstOrderDate).getTime() - new Date(a.firstOrderDate).getTime()
        default: return 0
      }
    })
  }, [filtered, sort])

  const pills: { key: FilterType; label: string }[] = [
    { key: 'all', label: `Alle (${counts.all})` },
    { key: 'stammkunde', label: `Stammkunden (${counts.stammkunde})` },
    { key: 'aktiv', label: `Diesen Monat (${counts.aktiv})` },
    { key: 'lange', label: `Lange weg (${counts.lange})` },
    { key: 'neu', label: `Neu (${counts.neu})` },
  ]

  if (customers.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">👥</div>
        <p className="font-medium text-foreground mb-1">Noch keine Kunden</p>
        <p className="text-sm text-muted-foreground">
          Sobald jemand bestellt, taucht er hier auf.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Name, Telefon oder E-Mail suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-11 pl-9 pr-4 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {pills.map((pill) => (
          <button
            key={pill.key}
            onClick={() => setFilter(pill.key)}
            className={cn(
              'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors min-h-[40px]',
              filter === pill.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            )}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Count + sort row (sort dropdown hidden on desktop — table handles it) */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? 'Kunde' : 'Kunden'}
        </span>
        {/* Sort dropdown — mobile only */}
        <div className="relative md:hidden">
          <button
            onClick={() => setSortOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Sortiert nach:</span>
            <span className="font-medium text-foreground ml-0.5">{SORT_LABELS[sort]}</span>
            <ChevronDown className="size-3.5 ml-0.5" />
          </button>
          {sortOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[190px]">
                {(Object.entries(SORT_LABELS) as [SortType, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setSort(key); setSortOpen(false) }}
                    className={cn(
                      'w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors',
                      sort === key ? 'font-semibold text-primary' : 'text-foreground'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Desktop: sortable table */}
      <div className="hidden md:block">
        <CustomersTable customers={filtered} />
      </div>

      {/* Mobile: card list */}
      <div className="block md:hidden">
        {sortedForCards.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Keine Kunden in dieser Ansicht
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedForCards.map((customer) => (
              <div
                key={customer.customerEmail}
                role="link"
                tabIndex={0}
                onClick={() => router.push(`/customers/${encodeURIComponent(customer.customerEmail)}`)}
                onKeyDown={(e) => e.key === 'Enter' && router.push(`/customers/${encodeURIComponent(customer.customerEmail)}`)}
                className="block bg-card rounded-xl border border-border p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'size-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                      avatarClass(customer)
                    )}
                  >
                    {initials(customer.customerName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {customer.isSubscribed && (
                        <Bell className="size-3.5 text-primary shrink-0" />
                      )}
                      <span className="font-semibold text-sm text-foreground truncate">
                        {customer.customerName}
                      </span>
                      {customer.status && (
                        <span
                          className={cn(
                            'text-xs rounded-full px-2 py-0.5 font-medium shrink-0',
                            statusBadgeClass(customer.status)
                          )}
                        >
                          {customer.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {customer.orderCount}{' '}
                      {customer.orderCount === 1 ? 'Bestellung' : 'Bestellungen'}
                      {' · '}
                      {customer.lastOrderLabel}
                    </p>
                    {customer.topProducts.length > 0 && (
                      <p className="text-xs text-muted-foreground/70 mt-1 truncate">
                        Häufig:{' '}
                        {customer.topProducts
                          .slice(0, 2)
                          .map((p) => p.name)
                          .join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="font-bold text-sm text-foreground">
                      {formatEuro(customer.totalSpent)}
                    </span>
                    {customer.customerPhone && (
                      <a
                        href={`tel:${customer.customerPhone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="size-7 flex items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                        title="Anrufen"
                      >
                        <Phone className="size-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Insight box */}
      {counts.lange >= 3 && (
        <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm font-semibold text-amber-800 mb-1">Tipp</p>
          <p className="text-sm text-amber-700">
            {counts.lange} Kunden haben länger nicht bestellt. Eine kurze WhatsApp könnte
            sie zurückholen.
          </p>
          <button
            onClick={() => setFilter('lange')}
            className="mt-3 text-xs font-semibold text-amber-800 hover:underline underline-offset-2"
          >
            Diese Kunden ansehen →
          </button>
        </div>
      )}
    </div>
  )
}
