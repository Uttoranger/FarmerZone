'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  GEBUEHR_ERSTATTUNG_OFFEN_HINWEIS,
  barZuKassierenCents,
  bestellSummen,
  gebuehrEntfallen,
  gebuehrErstattungOffen,
} from '@/lib/servicegebuehr'

/** Aus diesen Status darf der Hof „nicht abgeholt" setzen (actions/orders.ts). */
export const NICHT_ABGEHOLT_STATUS: readonly string[] = ['PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY']

// Schreibweise wie der übrige Bauern-Bereich („€ 20.98")
function euro(cents: number): string {
  return `€ ${(cents / 100).toFixed(2)}`
}

type BetragOrder = {
  status: string
  paymentMethod: string
  totalAmount: number | string | { toString(): string }
  serviceFeeCents: number
  serviceFeeRefundedAt: Date | string | null
}

/**
 * Der Betrag einer Bestellung aus Sicht des Hofes (Sprint servicegebuehr, C-3):
 *   Vor Ort → „Bar zu kassieren: Warenpreis + Gebühr", Gebühr als Nebenzeile
 *             (abgeholt: „Bar kassiert"; entfallen: durchgestrichen)
 *   Online  → Warenpreis (das, was dem Hof zufließt), Gebühr als Nebenzeile
 *             „online einbehalten" bzw. „erstattet"
 * Dazu der Vermerk, wenn eine Stripe-Erstattung der Gebühr noch aussteht.
 */
export function BetragMitGebuehr({ order, className }: { order: BetragOrder; className?: string }) {
  const summen = bestellSummen(order)
  const kassieren = barZuKassierenCents(order)
  const entfallen = gebuehrEntfallen(order)
  const beendet = order.status === 'CANCELLED' || order.status === 'NOT_PICKED_UP'

  return (
    <div className={className}>
      {kassieren !== null ? (
        <>
          <div className="text-sm font-semibold text-foreground">
            {beendet
              ? `Warenpreis ${euro(summen.warenpreisCents)}`
              : order.status === 'PICKED_UP'
                ? `Bar kassiert: ${euro(kassieren)}`
                : `Bar zu kassieren: ${euro(kassieren)}`}
          </div>
          {summen.gebuehrCents > 0 && (
            <div className="text-xs text-muted-foreground">
              {beendet ? (
                <>
                  Servicegebühr <s>{euro(summen.gebuehrCents)}</s> entfällt
                </>
              ) : (
                <>
                  davon Servicegebühr {euro(summen.gebuehrCents)} · Warenpreis{' '}
                  {euro(summen.warenpreisCents)}
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="text-sm font-semibold text-foreground">{euro(summen.warenpreisCents)}</div>
          {summen.gebuehrCents > 0 && (
            <div className="text-xs text-muted-foreground">
              {entfallen ? (
                <>
                  Servicegebühr <s>{euro(summen.gebuehrCents)}</s> erstattet
                </>
              ) : (
                <>+ Servicegebühr {euro(summen.gebuehrCents)}, online einbehalten</>
              )}
            </div>
          )}
        </>
      )}
      {gebuehrErstattungOffen(order) && (
        <p className="mt-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          {GEBUEHR_ERSTATTUNG_OFFEN_HINWEIS}
        </p>
      )}
    </div>
  )
}

/**
 * Die Rückfrage vor „Nicht abgeholt" — sagt, was mit Warenpreis und Gebühr
 * passiert, und dass es keinen Rückweg gibt.
 */
export function NichtAbgeholtDialog({
  open,
  onClose,
  onConfirm,
  customerName,
  paymentMethod,
  serviceFeeCents,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  customerName?: string
  paymentMethod: string
  serviceFeeCents: number
}) {
  const online = paymentMethod === 'ONLINE'
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nicht abgeholt?</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            {customerName ? (
              <>
                <span className="font-medium text-foreground">{customerName}</span> hat die Bestellung
                nicht abgeholt.
              </>
            ) : (
              'Die Bestellung wurde nicht abgeholt.'
            )}{' '}
            Der Kunde bekommt keine E-Mail.
          </p>
          {serviceFeeCents > 0 ? (
            <p>
              Die Servicegebühr von {euro(serviceFeeCents)} entfällt:{' '}
              {online
                ? 'sie wird dem Kunden über Stripe erstattet. Der Warenpreis bleibt wie bisher bei dir.'
                : 'sie wird nicht abgerechnet. Am Warenpreis ändert sich nichts.'}
            </p>
          ) : (
            <p>Am Warenpreis ändert sich nichts.</p>
          )}
          <p className="rounded-lg border border-border bg-muted p-3 text-foreground">
            Nicht rückgängig zu machen.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="h-11" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="destructive" className="h-11" onClick={onConfirm}>
            Nicht abgeholt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
