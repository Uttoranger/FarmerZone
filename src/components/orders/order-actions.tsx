'use client'

import { useTransition, useState } from 'react'
import { toast } from 'sonner'
import {
  markAsReady,
  markAsPickedUp,
  markAsPickedUpAndPaid,
  markAsNotPickedUp,
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
import { NichtAbgeholtDialog, NICHT_ABGEHOLT_STATUS } from './servicegebuehr-anzeige'

export function OrderActions({
  orderId,
  status,
  paymentMethod,
  serviceFeeCents = 0,
}: {
  orderId: string
  status: string
  paymentMethod: string
  /** Servicegebühr-Snapshot in Cent — für den Wortlaut des Nicht-abgeholt-Dialogs. */
  serviceFeeCents?: number
}) {
  const [isPending, startTransition] = useTransition()
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [notPickedUpDialogOpen, setNotPickedUpDialogOpen] = useState(false)

  const isOnline = paymentMethod === 'ONLINE'

  const canMarkReady = ['PAID', 'CONFIRMED', 'IN_PREPARATION'].includes(status)
  const canMarkPickedUp = status === 'READY' && isOnline
  const canMarkPickedUpAndPaid = status === 'READY' && !isOnline
  const canCancel = !['CANCELLED', 'PICKED_UP', 'NOT_PICKED_UP'].includes(status)
  const canMarkNotPickedUp = NICHT_ABGEHOLT_STATUS.includes(status)

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

  // Kein Rückweg (eine Stripe-Erstattung lässt sich nicht zurücknehmen) —
  // deshalb der Dialog davor statt eines Rückgängig-Knopfs danach.
  function handleNotPickedUp() {
    setNotPickedUpDialogOpen(false)
    startTransition(async () => {
      const result = await markAsNotPickedUp(orderId)
      if (result.error) toast.error(result.error)
      else if (result.gebuehrErstattungOffen) {
        toast.warning('Als nicht abgeholt markiert — die Servicegebühr-Erstattung ist fehlgeschlagen, bitte Betreiber informieren.', { duration: 8000 })
      } else toast.success('Als nicht abgeholt markiert')
    })
  }

  if (!canMarkReady && !canMarkPickedUp && !canMarkPickedUpAndPaid && !canCancel && !canMarkNotPickedUp) {
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
        {canMarkNotPickedUp && (
          <Button
            variant="outline"
            className="min-h-[52px] px-5 text-destructive hover:text-destructive"
            onClick={() => setNotPickedUpDialogOpen(true)}
            disabled={isPending}
          >
            Nicht abgeholt
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

      <NichtAbgeholtDialog
        open={notPickedUpDialogOpen}
        onClose={() => setNotPickedUpDialogOpen(false)}
        onConfirm={handleNotPickedUp}
        paymentMethod={paymentMethod}
        serviceFeeCents={serviceFeeCents}
      />
    </>
  )
}
