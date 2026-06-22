'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Phone } from 'lucide-react'
import type { FarmerOrder } from '@/server/queries/orders'
import {
  markAsReady,
  markAsPickedUp,
  markAsPickedUpAndPaid,
  cancelOrder,
} from '@/server/actions/orders'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { statusLabel, statusColor, paymentLabel } from './order-status'

export function OrderCard({ order }: { order: FarmerOrder }) {
  const [isPending, startTransition] = useTransition()

  const isOnline = order.paymentMethod === 'ONLINE'
  const status = order.status

  const canMarkReady = ['PAID', 'CONFIRMED', 'IN_PREPARATION'].includes(status)
  const canMarkPickedUp = status === 'READY' && isOnline
  const canMarkPickedUpAndPaid = status === 'READY' && !isOnline
  const canCancel = !['CANCELLED', 'PICKED_UP', 'NOT_PICKED_UP'].includes(status)

  function handleAction(fn: (id: string) => Promise<{ error?: string }>) {
    startTransition(async () => {
      const result = await fn(order.id)
      if (result.error) alert(result.error)
    })
  }

  return (
    <Card className={isPending ? 'opacity-60 pointer-events-none' : ''}>
      <CardContent className="py-4 px-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <Link
              href={`/orders/${order.id}`}
              className="text-xs text-slate-400 hover:text-slate-600 font-mono"
            >
              {order.orderNumber}
            </Link>
            <div className="font-medium text-slate-800">{order.customerName}</div>
            <a
              href={`tel:${order.customerPhone}`}
              className="text-sm text-slate-500 flex items-center gap-1 hover:text-green-700 w-fit"
            >
              <Phone className="h-3 w-3" />
              {order.customerPhone}
            </a>
          </div>
          <div className="text-right shrink-0">
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(status)}`}
            >
              {statusLabel(status)}
            </span>
            <div className="text-xs text-slate-400 mt-1">{paymentLabel(order.paymentMethod)}</div>
          </div>
        </div>

        <div className="text-sm text-slate-600 mb-1">
          {order.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}
        </div>
        <div className="text-sm font-semibold text-slate-800 mb-3">
          € {Number(order.totalAmount).toFixed(2)}
        </div>

        <div className="flex flex-wrap gap-2">
          {canMarkReady && (
            <Button size="sm" onClick={() => handleAction(markAsReady)} disabled={isPending}>
              Bereit zur Abholung
            </Button>
          )}
          {canMarkPickedUp && (
            <Button size="sm" onClick={() => handleAction(markAsPickedUp)} disabled={isPending}>
              Abgeholt
            </Button>
          )}
          {canMarkPickedUpAndPaid && (
            <Button
              size="sm"
              onClick={() => handleAction(markAsPickedUpAndPaid)}
              disabled={isPending}
            >
              Abgeholt & bezahlt
            </Button>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleAction((id) => cancelOrder(id))}
              disabled={isPending}
            >
              Stornieren
            </Button>
          )}
          <Link href={`/orders/${order.id}`}>
            <Button size="sm" variant="outline">
              Details
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
