import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getOrderDetail } from '@/server/queries/orders'
import { OrderActions } from '@/components/orders/order-actions'
import { statusLabel, statusColor, paymentLabel } from '@/components/orders/order-status'
import { BetragMitGebuehr } from '@/components/orders/servicegebuehr-anzeige'
import { formatPosition } from '@/lib/format'
import { bestellSummen } from '@/lib/servicegebuehr'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Printer } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  const order = await getOrderDetail(farm.id, orderId)
  if (!order) notFound()

  const pickupDate = order.pickupDate.toLocaleDateString('de-AT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const createdAt = order.createdAt.toLocaleDateString('de-AT') +
    ' um ' +
    order.createdAt.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }) +
    ' Uhr'
  const summen = bestellSummen(order)

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/orders"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Bestellungen
        </Link>
        <Link
          href={`/orders/${orderId}/print`}
          target="_blank"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <Printer className="h-4 w-4" />
          Drucken
        </Link>
      </div>

      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-medium text-foreground">{order.orderNumber}</h1>
          <p className="text-xs text-muted-foreground/70 mt-0.5">{createdAt}</p>
        </div>
        <span
          className={`shrink-0 inline-block rounded-full px-3 py-1 text-sm font-medium ${statusColor(order.status)}`}
        >
          {statusLabel(order.status)}
        </span>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardContent className="py-4 px-4">
            <h2 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide mb-3">
              Kunde
            </h2>
            <p className="font-medium text-foreground">{order.customerName}</p>
            <p className="text-sm text-muted-foreground">{order.customerEmail}</p>
            <a
              href={`tel:${order.customerPhone}`}
              className="text-sm text-green-700 dark:text-green-300 hover:underline"
            >
              {order.customerPhone}
            </a>
            {order.customerNote && (
              <p className="text-sm text-muted-foreground mt-2 bg-muted rounded-lg p-2 italic">
                {order.customerNote}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 px-4">
            <h2 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide mb-3">
              Abholung
            </h2>
            <p className="font-medium text-foreground">{pickupDate}</p>
            <p className="text-sm text-muted-foreground">
              {order.pickupTimeStart} – {order.pickupTimeEnd} Uhr
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 px-4">
            <h2 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide mb-3">
              Produkte
            </h2>
            <div className="flex flex-col gap-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-foreground">
                    {formatPosition({ name: item.productName, quantity: item.quantity, unit: item.product?.unit ?? null, unitSize: item.product?.unitSize ?? null })}
                  </span>
                  <span className="text-foreground font-medium">
                    € {Number(item.totalPrice).toFixed(2)}
                  </span>
                </div>
              ))}
              {/* Servicegebühr als eigene Zeile zwischen Zwischensumme und
                  Gesamt — dieselbe Aufteilung wie im Checkout der Kundin */}
              {summen.gebuehrCents > 0 ? (
                <>
                  <div className="flex justify-between text-sm border-t border-border pt-2 mt-1">
                    <span className="text-muted-foreground">Zwischensumme (Warenpreis)</span>
                    <span className="text-foreground">€ {(summen.warenpreisCents / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Servicegebühr</span>
                    <span className="text-foreground">€ {(summen.gebuehrCents / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold">
                    <span>Gesamt (zahlt der Kunde)</span>
                    <span>€ {(summen.gesamtCents / 100).toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-base font-semibold border-t border-border pt-2 mt-1">
                  <span>Gesamt</span>
                  <span>€ {Number(order.totalAmount).toFixed(2)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 px-4">
            <h2 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide mb-3">
              Zahlung
            </h2>
            <p className="text-sm font-medium text-foreground">
              {paymentLabel(order.paymentMethod)}
            </p>
            {/* „Bar zu kassieren" bzw. Warenpreis + Gebühr-Nebenzeile, samt
                Vermerk bei ausstehender Erstattung */}
            <BetragMitGebuehr order={order} className="mt-2" />
            {order.paidAt && (
              <p className="text-xs text-muted-foreground/70 mt-1">
                Bezahlt am {order.paidAt.toLocaleDateString('de-AT')}
              </p>
            )}
          </CardContent>
        </Card>

        {order.cancelReason && (
          <Card className="border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40">
            <CardContent className="py-4 px-4">
              <h2 className="text-xs font-semibold text-red-400 dark:text-red-400 uppercase tracking-wide mb-2">
                Stornierungsgrund
              </h2>
              <p className="text-sm text-red-700 dark:text-red-300">{order.cancelReason}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="mt-6">
        <OrderActions
          orderId={order.id}
          status={order.status}
          paymentMethod={order.paymentMethod}
          serviceFeeCents={order.serviceFeeCents}
        />
      </div>
    </div>
  )
}
