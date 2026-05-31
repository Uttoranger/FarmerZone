'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ManualSaleData } from '@/server/queries/manual-sales'
import type { ProductData } from '@/server/queries/products'
import { CHANNEL_ICONS, CHANNEL_LABELS } from '@/schemas/manual-sale'
import { SaleDialog } from './sale-dialog'
import { SaleList } from './sale-list'

type Props = {
  recentSales: ManualSaleData[]
  products: ProductData[]
}

function formatEuro(amount: number) {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(amount)
}

export function SalesClient({ recentSales, products }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSale, setEditingSale] = useState<ManualSaleData | null>(null)
  const [prefillSale, setPrefillSale] = useState<ManualSaleData | null>(null)

  function openNewSale() {
    setEditingSale(null)
    setPrefillSale(null)
    setDialogOpen(true)
  }

  function openFromQuick(sale: ManualSaleData) {
    setEditingSale(null)
    setPrefillSale(sale)
    setDialogOpen(true)
  }

  function openEdit(sale: ManualSaleData) {
    setEditingSale(sale)
    setPrefillSale(null)
    setDialogOpen(true)
  }

  function handleClose() {
    setDialogOpen(false)
    setEditingSale(null)
    setPrefillSale(null)
  }

  // Last 4 distinct sales for quick-repeat buttons
  const quickSales = recentSales.slice(0, 4)

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-slate-800">Verkauf eintragen</h1>
          <p className="text-sm text-slate-500 mt-0.5">Direktverkäufe schnell erfassen</p>
        </div>
        <Button onClick={openNewSale} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Neu
        </Button>
      </div>

      {/* Quick-repeat buttons */}
      {quickSales.length > 0 && (
        <section className="mb-8">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
            Wiederholen
          </p>
          <div className="grid grid-cols-2 gap-2">
            {quickSales.map((sale) => (
              <button
                key={sale.id}
                onClick={() => openFromQuick(sale)}
                className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-green-300 hover:bg-green-50 active:scale-[0.98] transition-all text-left"
              >
                <span className="text-2xl shrink-0 mt-0.5">
                  {CHANNEL_ICONS[sale.channel] ?? '·'}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-slate-800 truncate leading-tight">
                    {sale.productName}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {CHANNEL_LABELS[sale.channel]} · {formatEuro(sale.totalAmount)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Recent sales list */}
      <section>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
          Letzte Verkäufe
        </p>
        <SaleList sales={recentSales} onEdit={openEdit} />
      </section>

      {/* Dialog */}
      <SaleDialog
        open={dialogOpen}
        editingSale={editingSale}
        prefillSale={prefillSale}
        products={products}
        onClose={handleClose}
      />
    </>
  )
}
