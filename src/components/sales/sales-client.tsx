'use client'

import { useState, useTransition } from 'react'
import { Plus, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { createStripeDashboardLinkAction } from '@/server/actions/stripe-connect'
import { Button } from '@/components/ui/button'
import type { ManualSaleData } from '@/server/queries/manual-sales'
import type { ProductData } from '@/server/queries/products'
import { CHANNEL_ICONS, CHANNEL_LABELS } from '@/schemas/manual-sale'
import { SaleDialog } from './sale-dialog'
import { SaleList } from './sale-list'
import { PageHeader } from '@/components/farmer/page-header'

type Props = {
  recentSales: ManualSaleData[]
  products: ProductData[]
  stripeReady: boolean
}

// Dezenter Link zur Auszahlungs-Übersicht im Stripe-Express-Dashboard
function StripePayoutLink() {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await createStripeDashboardLinkAction()
          if (result.url) window.open(result.url, '_blank', 'noopener')
          else toast.error(result.error ?? 'Stripe-Übersicht gerade nicht erreichbar')
        })
      }
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-60"
      style={{ color: '#2D5F3F' }}
    >
      <ExternalLink className="size-3.5" strokeWidth={1.7} />
      {isPending ? 'Öffnet…' : 'Auszahlungen bei Stripe ansehen'}
    </button>
  )
}

function formatEuro(amount: number) {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(amount)
}

export function SalesClient({ recentSales, products, stripeReady }: Props) {
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
      <PageHeader
        title="Verkauf eintragen"
        subtitle="Direktverkäufe schnell erfassen"
        action={
          <Button onClick={openNewSale} className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent-hover">
            <Plus className="w-4 h-4" />
            Neu
          </Button>
        }
      />

      {stripeReady && (
        <div className="-mt-3 mb-5">
          <StripePayoutLink />
        </div>
      )}

      {/* Quick-repeat buttons */}
      {quickSales.length > 0 && (
        <section className="mb-8">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Wiederholen
          </p>
          <div className="grid grid-cols-2 gap-2">
            {quickSales.map((sale) => (
              <button
                key={sale.id}
                onClick={() => openFromQuick(sale)}
                className="flex items-start gap-3 p-3 rounded-xl border border-border hover:border-green-300 hover:bg-primary/8 active:scale-[0.98] transition-all text-left"
              >
                <span className="text-2xl shrink-0 mt-0.5">
                  {CHANNEL_ICONS[sale.channel] ?? '·'}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-foreground truncate leading-tight">
                    {sale.productName}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
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
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
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

