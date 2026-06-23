'use client'

import { useTransition, useState } from 'react'
import Link from 'next/link'
import { Phone } from 'lucide-react'
import { toast } from 'sonner'
import type { FarmerOrder } from '@/server/queries/orders'
import {
  markAsReady,
  markAsPickedUp,
  markAsPickedUpAndPaid,
  cancelOrder,
  revertOrderStatus,
} from '@/server/actions/orders'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { statusLabel, statusColor, paymentLabel } from './order-status'

export function OrderCard({ order }: { order: FarmerOrder }) {
  const [isPending, startTransition] = useTransition()
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  const isOnline = order.paymentMethod === 'ONLINE'
  const status = order.status

  const canMarkReady = ['PAID', 'CONFIRMED', 'IN_PREPARATION'].includes(status)
  const canMarkPickedUp = status === 'READY' && isOnline
  const canMarkPickedUpAndPaid = status === 'READY' && !isOnline
  const canCancel = !['CANCELLED', 'PICKED_UP', 'NOT_PICKED_UP'].includes(status)

  function handleWithUndo(
    fn: (id: string) => Promise<{ error?: string }>,
    label: string,
    previousStatus: string,
  ) {
    startTransition(async () => {
      const result = await fn(order.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(label, {
        duration: 6000,
        action: {
          label: 'Rückgängig',
          onClick: () => {
            startTransition(async () => {
              const r = await revertOrderStatus(order.id, previousStatus)
              if (r.error) toast.error(r.error)
              else toast.success('Status zurückgesetzt')
            })
          },
        },
      })
    })
  }

  async function handleCancel() {
    setIsCancelling(true)
    const result = await cancelOrder(order.id)
    setIsCancelling(false)
    setCancelDialogOpen(false)
    if (result.error) toast.error(result.error)
    else toast.success('Bestellung zurückgenommen')
  }

  return (
    <>
      <Card className={isPending ? 'opacity-60 pointer-events-none' : ''}>
        <CardContent className="py-4 px-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <Link
                href={`/orders/${order.id}`}
                className="text-xs text-muted-foreground hover:text-foreground font-mono"
              >
                {order.orderNumber}
              </Link>
              <div className="font-medium text-foreground">{order.customerName}</div>
              <a
                href={`tel:${order.customerPhone}`}
                className="text-sm text-muted-foreground flex items-center gap-1 hover:text-primary w-fit"
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
              <div className="text-xs text-muted-foreground mt-1">{paymentLabel(order.paymentMethod)}</div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground mb-1">
            {order.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}
          </div>
          <div className="text-sm font-semibold text-foreground mb-3">
            € {Number(order.totalAmount).toFixed(2)}
          </div>

          <div className="flex flex-wrap gap-2">
            {canMarkReady && (
              <Button
                size="sm"
                className="h-10 px-4"
                onClick={() => handleWithUndo(markAsReady, 'Als bereit markiert', status)}
                disabled={isPending}
              >
                Bereit zur Abholung
              </Button>
            )}
            {canMarkPickedUp && (
              <Button
                size="sm"
                className="h-10 px-4"
                onClick={() => handleWithUndo(markAsPickedUp, 'Als abgeholt markiert', status)}
                disabled={isPending}
              >
                Abgeholt
              </Button>
            )}
            {canMarkPickedUpAndPaid && (
              <Button
                size="sm"
                className="h-10 px-4"
                onClick={() =>
                  handleWithUndo(markAsPickedUpAndPaid, 'Als abgeholt & bezahlt markiert', status)
                }
                disabled={isPending}
              >
                Abgeholt & bezahlt
              </Button>
            )}
            {canCancel && (
              <Button
                size="sm"
                variant="destructive"
                className="h-10 px-4"
                onClick={() => setCancelDialogOpen(true)}
                disabled={isPending}
              >
                Zurücknehmen
              </Button>
            )}
            <Link href={`/orders/${order.id}`}>
              <Button size="sm" variant="outline" className="h-10 px-4">
                Details
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Cancel confirm dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={(o) => !o && setCancelDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Bestellung zurücknehmen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Die Bestellung von{' '}
            <span className="font-medium text-foreground">{order.customerName}</span> wird
            storniert. Der Kunde erhält eine Benachrichtigung.
            {isOnline && (
              <span className="block mt-1 text-destructive font-medium">
                Online-Zahlung wird automatisch rückerstattet.
              </span>
            )}
          </p>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCancelDialogOpen(false)}
              disabled={isCancelling}
            >
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={isCancelling}>
              {isCancelling ? 'Storniere…' : 'Zurücknehmen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
