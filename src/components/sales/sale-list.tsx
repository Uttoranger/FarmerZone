'use client'

import { useState, useTransition } from 'react'
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
import { CHANNEL_LABELS, CHANNEL_ICONS } from '@/schemas/manual-sale'

type Props = {
  sales: ManualSaleData[]
  onEdit: (sale: ManualSaleData) => void
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' })
}

function formatEuro(amount: number) {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(amount)
}

export function SaleList({ sales, onEdit }: Props) {
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

  if (sales.length === 0) {
    return (
      <p className="text-center text-slate-400 text-sm py-8">
        Noch keine Verkäufe eingetragen.
      </p>
    )
  }

  return (
    <>
      <div className="divide-y divide-slate-100">
        {sales.map((sale) => (
          <div key={sale.id} className="flex items-center gap-3 py-2.5">
            {/* Channel icon + date */}
            <div className="shrink-0 w-10 text-center">
              <div className="text-base leading-none">{CHANNEL_ICONS[sale.channel] ?? '·'}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{formatDate(sale.saleDate)}</div>
            </div>

            {/* Product name + channel */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{sale.productName}</p>
              <p className="text-xs text-slate-400">{CHANNEL_LABELS[sale.channel] ?? sale.channel}</p>
            </div>

            {/* Amount */}
            <div className="shrink-0 text-sm font-medium text-slate-700">
              {formatEuro(sale.totalAmount)}
            </div>

            {/* Actions */}
            <div className="shrink-0 flex gap-1">
              <button
                onClick={() => onEdit(sale)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                title="Bearbeiten"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDeleteTarget(sale)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors"
                title="Löschen"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Verkauf löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            <span className="font-medium">{deleteTarget?.productName}</span> vom{' '}
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
