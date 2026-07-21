'use client'

// Verkauf 2: EINE zeitlich sortierte Liste aus beiden Quellen — abgeholte
// Bestellungen (Klick → Bestell-Details) und Direktverkäufe (Bearbeiten/
// Löschen bleibt). Karten-Stil der Bestellungen, nichts Neues erfunden.
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Pencil, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { deleteManualSale } from '@/server/actions/manual-sales'
import type { ManualSaleData } from '@/server/queries/manual-sales'
import type { SalesFeedEntry } from '@/lib/sales-summary'
import { CHANNEL_LABELS, CHANNEL_ICONS } from '@/schemas/manual-sale'

type Props = {
  feed: SalesFeedEntry<ManualSaleData>[]
  onEdit: (sale: ManualSaleData) => void
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' })
}

function formatEuro(amount: number) {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(amount)
}

function Pill({ text, tone }: { text: string; tone: 'online' | 'bar' }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
      style={
        tone === 'online'
          ? { background: '#E8F0E2', color: '#2D5F3F' }
          : { background: '#F0EDE5', color: '#5C6052' }
      }
    >
      {text}
    </span>
  )
}

export function SalesFeedList({ feed, onEdit }: Props) {
  const [deleteTarget, setDeleteTarget] = useState<ManualSaleData | null>(null)
  const [isDeleting, startTransition] = useTransition()

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      try {
        await deleteManualSale(deleteTarget.id)
        toast.success('Verkauf gelöscht')
        setDeleteTarget(null)
      } catch {
        toast.error('Fehler beim Löschen')
      }
    })
  }

  if (feed.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-border">
        <div className="text-4xl mb-3">🧾</div>
        <p className="font-medium text-foreground mb-1">Noch keine Verkäufe</p>
        <p className="text-sm text-muted-foreground">
          Abgeholte Bestellungen und eingetragene Direktverkäufe erscheinen hier.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-border px-4 divide-y divide-border/60">
        {feed.map((entry) =>
          entry.kind === 'order' ? (
            <Link
              key={`order-${entry.order.id}`}
              href={`/orders/${entry.order.id}`}
              className="flex items-center gap-3 py-3 hover:bg-muted/30 transition-colors -mx-4 px-4"
            >
              <div className="shrink-0 w-10 text-center">
                <div className="text-base leading-none">🧺</div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {formatDate(entry.when)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {entry.order.customerName}
                  <span className="text-muted-foreground/60 font-normal"> · {entry.order.orderNumber}</span>
                </p>
                <p className="text-xs text-muted-foreground truncate">{entry.order.itemsLabel}</p>
                <div className="mt-1">
                  <Pill
                    text={entry.order.stripePaymentIntentId ? 'Online' : 'Bar · Abholung'}
                    tone={entry.order.stripePaymentIntentId ? 'online' : 'bar'}
                  />
                </div>
              </div>
              <div className="shrink-0 w-20 text-right text-sm font-semibold tabular-nums text-foreground">
                {formatEuro(entry.order.totalAmount)}
              </div>
              {/* Spacer in Breite der Aktions-Spalte der Direktverkaufszeilen,
                  damit die Betragsspalte über beide Zeilenarten fluchtet */}
              <div className="shrink-0 w-[68px]" aria-hidden="true" />
            </Link>
          ) : (
            <div key={`sale-${entry.sale.id}`} className="flex items-center gap-3 py-3">
              <div className="shrink-0 w-10 text-center">
                <div className="text-base leading-none">{CHANNEL_ICONS[entry.sale.channel] ?? '·'}</div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {formatDate(entry.when)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{entry.sale.productName}</p>
                <p className="text-xs text-muted-foreground truncate">Direktverkauf</p>
                <div className="mt-1">
                  <Pill text={CHANNEL_LABELS[entry.sale.channel] ?? entry.sale.channel} tone="bar" />
                </div>
              </div>
              <div className="shrink-0 w-20 text-right text-sm font-semibold tabular-nums text-foreground">
                {formatEuro(entry.sale.totalAmount)}
              </div>
              <div className="shrink-0 flex gap-1">
                <button
                  onClick={() => onEdit(entry.sale)}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/60 hover:text-foreground transition-colors"
                  title="Bearbeiten"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteTarget(entry.sale)}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-50 text-muted-foreground/40 hover:text-red-400 transition-colors"
                  title="Löschen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        )}
      </div>

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Verkauf löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{deleteTarget?.productName}</span> vom{' '}
            {deleteTarget && formatDate(deleteTarget.saleDate)} wird dauerhaft gelöscht.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Löschen…' : 'Löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
