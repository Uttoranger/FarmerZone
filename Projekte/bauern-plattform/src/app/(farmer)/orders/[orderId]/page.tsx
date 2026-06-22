import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getOrderDetail } from '@/server/queries/orders'
import { OrderActions } from '@/components/orders/order-actions'
import { statusLabel, statusColor, paymentLabel } from '@/components/orders/order-status'
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

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/orders"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Bestellungen
        </Link>
        <Link
          href={`/orders/${orderId}/print`}
          target="_blank"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <Printer className="h-4 w-4" />
          Drucken
        </Link>
      </div>

      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-medium text-slate-800">{order.orderNumber}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{createdAt}</p>
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
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Kunde
            </h2>
            <p className="font-medium text-slate-800">{order.customerName}</p>
            <p className="text-sm text-slate-600">{order.customerEmail}</p>
            <a
              href={`tel:${order.customerPhone}`}
              className="text-sm text-green-700 hover:underline"
            >
              {order.customerPhone}
            </a>
            {order.customerNote && (
              <p className="text-sm text-slate-500 mt-2 bg-slate-50 rounded-lg p-2 italic">
                {order.customerNote}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 px-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Abholung
            </h2>
            <p className="font-medium text-slate-800">{pickupDate}</p>
            <p className="text-sm text-slate-600">
              {order.pickupTimeStart} – {order.pickupTimeEnd} Uhr
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 px-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Produkte
            </h2>
            <div className="flex flex-col gap-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-slate-700">
                    {item.quantity}× {item.productName}
                  </span>
                  <span className="text-slate-800 font-medium">
                    € {Number(item.totalPrice).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-base font-semibold border-t border-slate-100 pt-2 mt-1">
                <span>Gesamt</span>
                <span>€ {Number(order.totalAmount).toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 px-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Zahlung
            </h2>
            <p className="text-sm font-medium text-slate-700">
              {paymentLabel(order.paymentMethod)}
            </p>
            {order.paidAt && (
              <p className="text-xs text-slate-400 mt-1">
                Bezahlt am {order.paidAt.toLocaleDateString('de-AT')}
              </p>
            )}
          </CardContent>
        </Card>

        {order.cancelReason && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4 px-4">
              <h2 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-2">
                Stornierungsgrund
              </h2>
              <p className="text-sm text-red-700">{order.cancelReason}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="mt-6">
        <OrderActions
          orderId={order.id}
          status={order.status}
          paymentMethod={order.paymentMethod}
        />
      </div>
    </div>
  )
}
