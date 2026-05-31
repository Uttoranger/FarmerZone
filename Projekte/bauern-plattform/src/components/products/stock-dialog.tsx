'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { setStock, updateStock } from '@/server/actions/products'
import type { ProductData } from '@/server/queries/products'
import { UNIT_LABELS } from '@/schemas/product'

type Props = {
  product: ProductData | null
  currentStock: number
  onClose: () => void
  onOptimisticUpdate: (productId: string, newStock: number) => void
}

export function StockDialog({ product, currentStock, onClose, onOptimisticUpdate }: Props) {
  const [inputValue, setInputValue] = useState('')
  const [isPending, startTransition] = useTransition()

  const open = product !== null

  function handleOpenChange(open: boolean) {
    if (!open) {
      setInputValue('')
      onClose()
    }
  }

  function handleQuickAdjust(delta: number) {
    if (!product) return
    const newStock = Math.max(0, currentStock + delta)
    onOptimisticUpdate(product.id, newStock)

    startTransition(async () => {
      try {
        await updateStock(product.id, delta)
        toast.success(`Bestand: ${newStock} ${UNIT_LABELS[product.unit] ?? product.unit}`)
        onClose()
      } catch {
        onOptimisticUpdate(product.id, currentStock)
        toast.error('Fehler beim Speichern')
      }
    })
  }

  function handleSetStock() {
    if (!product) return
    const parsed = parseInt(inputValue, 10)
    if (isNaN(parsed) || parsed < 0) {
      toast.error('Bitte eine gültige Zahl eingeben')
      return
    }
    const newStock = Math.max(0, parsed)
    onOptimisticUpdate(product.id, newStock)

    startTransition(async () => {
      try {
        await setStock(product.id, newStock)
        toast.success(`Bestand: ${newStock} ${UNIT_LABELS[product.unit] ?? product.unit}`)
        setInputValue('')
        onClose()
      } catch {
        onOptimisticUpdate(product.id, currentStock)
        toast.error('Fehler beim Speichern')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Bestand anpassen</DialogTitle>
          {product && (
            <p className="text-sm text-slate-500 mt-1">{product.name}</p>
          )}
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Current stock display */}
          <div className="text-center py-3 bg-slate-50 rounded-lg">
            <div className="text-3xl font-semibold text-slate-800">{currentStock}</div>
            <div className="text-sm text-slate-500 mt-0.5">
              {product ? (UNIT_LABELS[product.unit] ?? product.unit) : ''}
            </div>
          </div>

          {/* Quick adjust buttons */}
          <div>
            <Label className="text-xs text-slate-500 uppercase tracking-wide mb-2 block">
              Schnell hinzufügen
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {[5, 10, 20].map((delta) => (
                <Button
                  key={delta}
                  variant="outline"
                  className="h-12 text-base font-medium"
                  onClick={() => handleQuickAdjust(delta)}
                  disabled={isPending}
                >
                  +{delta}
                </Button>
              ))}
            </div>
          </div>

          {/* Direct input */}
          <div>
            <Label className="text-xs text-slate-500 uppercase tracking-wide mb-2 block">
              Direkt setzen auf
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="z. B. 25"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSetStock()}
                className="h-11"
                disabled={isPending}
              />
              <Button
                onClick={handleSetStock}
                disabled={isPending || inputValue === ''}
                className="h-11 px-4 shrink-0"
              >
                Setzen
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
