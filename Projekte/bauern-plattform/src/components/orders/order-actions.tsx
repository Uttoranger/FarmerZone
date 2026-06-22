'use client'

import { useTransition } from 'react'
import {
  markAsReady,
  markAsPickedUp,
  markAsPickedUpAndPaid,
  cancelOrder,
} from '@/server/actions/orders'
import { Button } from '@/components/ui/button'

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
  const isOnline = paymentMethod === 'ONLINE'

  const canMarkReady = ['PAID', 'CONFIRMED', 'IN_PREPARATION'].includes(status)
  const canMarkPickedUp = status === 'READY' && isOnline
  const canMarkPickedUpAndPaid = status === 'READY' && !isOnline
  const canCancel = !['CANCELLED', 'PICKED_UP', 'NOT_PICKED_UP'].includes(status)

  function handleAction(fn: (id: string) => Promise<{ error?: string }>) {
    startTransition(async () => {
      const result = await fn(orderId)
      if (result.error) alert(result.error)
    })
  }

  if (!canMarkReady && !canMarkPickedUp && !canMarkPickedUpAndPaid && !canCancel) {
    return null
  }

  return (
    <div className={`flex flex-wrap gap-2 ${isPending ? 'opacity-60 pointer-events-none' : ''}`}>
      {canMarkReady && (
        <Button onClick={() => handleAction(markAsReady)} disabled={isPending}>
          Bereit zur Abholung
        </Button>
      )}
      {canMarkPickedUp && (
        <Button onClick={() => handleAction(markAsPickedUp)} disabled={isPending}>
          Abgeholt
        </Button>
      )}
      {canMarkPickedUpAndPaid && (
        <Button onClick={() => handleAction(markAsPickedUpAndPaid)} disabled={isPending}>
          Abgeholt & bezahlt
        </Button>
      )}
      {canCancel && (
        <Button
          variant="destructive"
          onClick={() => handleAction((id) => cancelOrder(id))}
          disabled={isPending}
        >
          Bestellung stornieren
        </Button>
      )}
    </div>
  )
}
