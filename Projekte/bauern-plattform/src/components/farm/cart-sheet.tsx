'use client'

import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { UNIT_LABELS } from '@/schemas/product'
import type { CartItem } from '@/lib/use-cart'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CartItem[]
  total: number
  farmSlug: string
  onUpdateQuantity: (productId: string, qty: number) => void
  onRemoveItem: (productId: string) => void
}

function formatEuro(n: number) {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(n)
}

export function CartSheet({ open, onOpenChange, items, total, farmSlug, onUpdateQuantity, onRemoveItem }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/50">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Warenkorb
          </SheetTitle>
        </SheetHeader>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground/60">
              <ShoppingCart className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Dein Warenkorb ist leer.</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.productId} className="flex gap-3 items-center">
                {/* Image */}
                <div className="shrink-0 w-14 h-14 rounded-lg bg-muted overflow-hidden flex items-center justify-center">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingCart className="w-5 h-5 text-slate-300" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground/60">
                    {formatEuro(item.price)} / {UNIT_LABELS[item.unit] ?? item.unit}
                  </p>
                  {/* Quantity controls */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
                      className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted/30 text-muted-foreground transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-medium w-4 text-center tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                      className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted/30 text-muted-foreground transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Line total + remove */}
                <div className="shrink-0 flex flex-col items-end gap-2">
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {formatEuro(item.price * item.quantity)}
                  </span>
                  <button
                    onClick={() => onRemoveItem(item.productId)}
                    className="text-slate-300 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <SheetFooter className="px-5 py-4 border-t border-border/50 flex-col gap-3">
            <div className="flex justify-between text-base font-semibold text-foreground">
              <span>Gesamt</span>
              <span className="tabular-nums">{formatEuro(total)}</span>
            </div>
            <p className="text-xs text-muted-foreground/60 -mt-1">
              Reservierung gilt 15 Minuten.
            </p>
            <Link href={`/${farmSlug}/checkout`} className="w-full" onClick={() => onOpenChange(false)}>
              <Button className="w-full h-12 text-base">
                Zum Checkout →
              </Button>
            </Link>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}

