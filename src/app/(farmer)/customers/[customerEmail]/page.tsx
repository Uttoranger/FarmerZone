import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { Bell, Phone, Mail, MessageCircle } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getCustomerDetail } from '@/server/queries/customers'
import type { CustomerStatus } from '@/server/queries/customers'
import { statusLabel, statusColor } from '@/components/orders/order-status'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function formatEuro(n: number) {
  return `€ ${n.toFixed(2).replace('.', ',')}`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function avatarClass(isStammkunde: boolean, isLangeNichtGesehen: boolean): string {
  if (isStammkunde) return 'bg-green-100 text-green-800'
  if (isLangeNichtGesehen) return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-600'
}

function customerBadgeClass(status: CustomerStatus): string {
  switch (status) {
    case 'Stammkunde': return 'bg-green-100 text-green-800'
    case 'Diesen Monat aktiv': return 'bg-blue-100 text-blue-800'
    case 'Lange nicht gesehen': return 'bg-amber-100 text-amber-800'
    case 'Neu': return 'bg-purple-100 text-purple-800'
    default: return 'bg-slate-100 text-slate-600'
  }
}

function toWaPhone(phone: string): string {
  const digits = phone.replace(/[\s\-().]/g, '')
  if (digits.startsWith('+')) return digits.slice(1)
  if (digits.startsWith('0')) return '43' + digits.slice(1)
  return digits
}

interface Props {
  params: Promise<{ customerEmail: string }>
}

export default async function CustomerDetailPage({ params }: Props) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  const { customerEmail } = await params
  const decodedEmail = decodeURIComponent(customerEmail)

  const customer = await getCustomerDetail(farm.id, decodedEmail)
  if (!customer) notFound()

  const firstOrderFormatted = new Date(customer.firstOrderDate).toLocaleDateString('de-AT', {
    month: 'long',
    year: 'numeric',
  })

  const waPhone = customer.customerPhone ? toWaPhone(customer.customerPhone) : ''
  const hasPhone = !!customer.customerPhone

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      {/* Back */}
      <Link
        href="/customers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
      >
        ← Zurück zu Kunden
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div
          className={cn(
            'size-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0',
            avatarClass(customer.isStammkunde, customer.isLangeNichtGesehen)
          )}
        >
          {initials(customer.customerName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {customer.isSubscribed && (
              <Bell className="size-4 text-primary shrink-0" />
            )}
            <h1 className="font-heading text-xl font-semibold text-foreground">
              {customer.customerName}
            </h1>
            {customer.status && (
              <span
                className={cn(
                  'text-xs rounded-full px-2.5 py-0.5 font-medium shrink-0',
                  customerBadgeClass(customer.status)
                )}
              >
                {customer.status}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kunde seit {firstOrderFormatted}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <a
          href={hasPhone ? `tel:${customer.customerPhone}` : undefined}
          aria-disabled={!hasPhone}
          className={cn(
            'flex flex-col items-center gap-1.5 py-3.5 rounded-xl text-sm font-semibold transition-colors',
            hasPhone
              ? 'bg-primary text-primary-foreground hover:opacity-90'
              : 'bg-muted text-muted-foreground pointer-events-none opacity-40'
          )}
        >
          <Phone className="size-5" />
          Anrufen
        </a>
        <a
          href={hasPhone ? `https://wa.me/${waPhone}` : undefined}
          target={hasPhone ? '_blank' : undefined}
          rel="noopener noreferrer"
          aria-disabled={!hasPhone}
          className={cn(
            'flex flex-col items-center gap-1.5 py-3.5 rounded-xl text-sm font-semibold border border-border transition-colors',
            hasPhone
              ? 'bg-card text-foreground hover:bg-muted'
              : 'bg-muted text-muted-foreground pointer-events-none opacity-40'
          )}
        >
          <MessageCircle className="size-5" />
          WhatsApp
        </a>
        <a
          href={`mailto:${customer.customerEmail}`}
          className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl text-sm font-semibold border border-border bg-card text-foreground hover:bg-muted transition-colors"
        >
          <Mail className="size-5" />
          E-Mail
        </a>
      </div>

      {/* Contact info */}
      <div className="bg-card rounded-xl border border-border p-4 mb-4 space-y-2.5">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kontakt</h2>
        {hasPhone && (
          <a
            href={`tel:${customer.customerPhone}`}
            className="flex items-center gap-2 text-sm text-primary hover:underline underline-offset-2"
          >
            <Phone className="size-4 shrink-0" />
            {customer.customerPhone}
          </a>
        )}
        <a
          href={`mailto:${customer.customerEmail}`}
          className="flex items-center gap-2 text-sm text-primary hover:underline underline-offset-2"
        >
          <Mail className="size-4 shrink-0" />
          {customer.customerEmail}
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <div className="text-2xl font-bold text-foreground">{customer.orderCount}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Bestellungen</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <div className="text-base font-bold text-foreground leading-tight">
            {formatEuro(customer.totalSpent)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Gesamtumsatz</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <div className="text-2xl font-bold text-foreground">
            {customer.daysSinceLastOrder}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Tage her</div>
        </div>
      </div>

      {/* Top products */}
      {customer.topProducts.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4 mb-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Lieblingsprodukte
          </h2>
          <div className="space-y-2.5">
            {customer.topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <div className="size-6 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                  {i + 1}
                </div>
                <span className="flex-1 text-sm text-foreground">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.count}× bestellt</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subscriptions */}
      {customer.subscription && customer.isSubscribed && (
        <div className="bg-card rounded-xl border border-border p-4 mb-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Bell className="size-3.5" />
            Abonnements
          </h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span>📧</span>
              <span className="text-foreground">E-Mail-Updates:</span>
              <span
                className={
                  customer.subscription.optInEmail
                    ? 'text-green-700 font-medium'
                    : 'text-muted-foreground'
                }
              >
                {customer.subscription.optInEmail ? 'aktiv' : 'inaktiv'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span>💬</span>
              <span className="text-foreground">WhatsApp-Updates:</span>
              <span
                className={
                  customer.subscription.optInWhatsApp
                    ? 'text-green-700 font-medium'
                    : 'text-muted-foreground'
                }
              >
                {customer.subscription.optInWhatsApp ? 'aktiv' : 'inaktiv'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Recent orders */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Letzte Bestellungen
        </h2>
        {customer.recentOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Bestellungen gefunden.</p>
        ) : (
          <div className="space-y-2.5">
            {customer.recentOrders.slice(0, 5).map((order) => {
              const daysAgo = Math.floor(
                (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24)
              )
              const itemsSummary = order.items
                .slice(0, 3)
                .map((i) => `${i.quantity}× ${i.productName}`)
                .join(', ')
              const moreItems = order.items.length - 3

              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="block p-3 rounded-lg bg-muted/40 hover:bg-muted transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">
                          {order.orderNumber}
                        </span>
                        <span
                          className={cn(
                            'text-xs rounded-full px-2 py-0.5 font-medium',
                            statusColor(order.status)
                          )}
                        >
                          {statusLabel(order.status)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {daysAgo === 0
                          ? 'heute'
                          : daysAgo === 1
                          ? 'gestern'
                          : `vor ${daysAgo} Tagen`}
                        {itemsSummary && ` · ${itemsSummary}`}
                        {moreItems > 0 && ` +${moreItems}`}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-foreground shrink-0">
                      {formatEuro(order.totalAmount)}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
        {customer.recentOrders.length > 5 && (
          <p className="text-xs text-muted-foreground text-center mt-3 pt-2 border-t border-border">
            + {customer.recentOrders.length - 5} weitere Bestellungen unter{' '}
            <Link href="/orders" className="underline underline-offset-2 hover:text-foreground">
              Bestellungen
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
