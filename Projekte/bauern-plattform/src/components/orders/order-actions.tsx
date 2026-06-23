'use client'

import { useTransition, useState } from 'react'
import { toast } from 'sonner'
import {
  markAsReady,
  markAsPickedUp,
  markAsPickedUpAndPaid,
  cancelOrder,
  revertOrderStatus,
} from '@/server/actions/orders'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

export function OrderActions({
  orderId,
  status,
  paymentMethod,
}: {
  orderId: string
  status: string
  paymentMethod: string
}) {
  const [isPending, startTransition] = useTransition()
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  const isOnline = paymentMethod === 'ONLINE'

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
      const result = await fn(orderId)
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
              const r = await revertOrderStatus(orderId, previousStatus)
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
    const result = await cancelOrder(orderId)
    setIsCancelling(false)
    setCancelDialogOpen(false)
    if (result.error) toast.error(result.error)
    else toast.success('Bestellung zurückgenommen')
  }

  if (!canMarkReady && !canMarkPickedUp && !canMarkPickedUpAndPaid && !canCancel) {
    return null
  }

  return (
    <>
      <div
        className={`flex flex-wrap gap-2 ${isPending ? 'opacity-60 pointer-events-none' : ''}`}
      >
        {canMarkReady && (
          <Button
            className="min-h-[52px] px-5"
            onClick={() => handleWithUndo(markAsReady, 'Als bereit markiert', status)}
            disabled={isPending}
          >
            Bereit zur Abholung
          </Button>
        )}
        {canMarkPickedUp && (
          <Button
            className="min-h-[52px] px-5"
            onClick={() => handleWithUndo(markAsPickedUp, 'Als abgeholt markiert', status)}
            disabled={isPending}
          >
            Abgeholt
          </Button>
        )}
        {canMarkPickedUpAndPaid && (
          <Button
            className="min-h-[52px] px-5"
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
            variant="destructive"
            className="min-h-[52px] px-5"
            onClick={() => setCancelDialogOpen(true)}
            disabled={isPending}
          >
            Zurücknehmen
          </Button>
        )}
      </div>

      <Dialog open={cancelDialogOpen} onOpenChange={(o) => !o && setCancelDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Bestellung zurücknehmen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Die Bestellung wird storniert und der Kunde erhält eine Benachrichtigung.
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
