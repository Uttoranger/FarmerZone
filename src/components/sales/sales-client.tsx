'use client'

// Verkauf 2 (Referenz 19, Verkauf-Sektion): Anker-Zahl der Woche,
// Online/Bar-Summenkarten mit Definitions-Fußnoten, vereinte Verkaufsliste.
// BEWUSST NICHT: Zeitraum-Umschalter (Parkliste), Auszahlungs-Beträge
// (Sprint-19-Entscheidung: Link statt Zahl), Charts (→ Auswertung).
import { useState, useTransition } from 'react'
import { PlusCircle, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { createStripeDashboardLinkAction } from '@/server/actions/stripe-connect'
import type { ManualSaleData, SalesOverview } from '@/server/queries/manual-sales'
import type { ProductData } from '@/server/queries/products'
import { CHANNEL_ICONS, CHANNEL_LABELS } from '@/schemas/manual-sale'
import { SaleDialog } from './sale-dialog'
import { SalesFeedList } from './sales-feed-list'
import { PageHeader } from '@/components/farmer/page-header'

type Props = {
  overview: SalesOverview
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

export function SalesClient({ overview, products, stripeReady }: Props) {
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

  // Schnell-Wiederholen aus den letzten Direktverkäufen der Liste
  const quickSales = overview.feed
    .filter((e): e is Extract<typeof e, { kind: 'manual' }> => e.kind === 'manual')
    .map((e) => e.sale)
    .slice(0, 4)

  return (
    <>
      {/* Kopf wie die Nachbarseiten, rechts das "Produkt anlegen"-Muster */}
      <PageHeader
        title="Verkauf"
        subtitle="Was du diese Woche eingenommen hast"
        action={
          <button
            onClick={openNewSale}
            className="shrink-0 inline-flex items-center gap-1.5 h-11 px-5 rounded-lg bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent-hover transition-colors"
            style={{ boxShadow: '0 4px 14px rgba(232,133,74,0.3)' }}
          >
            <PlusCircle className="size-4" />
            Verkauf eintragen
          </button>
        }
      />

      {/* Anker-Karte: die eine große Zahl */}
      <div className="bg-white rounded-[14px] border border-border p-5 mb-4">
        <p className="text-[13px]" style={{ color: '#9AA08F' }}>
          Diese Woche
        </p>
        <p className="font-heading text-4xl md:text-[40px] font-bold mt-1.5 tabular-nums" style={{ color: '#2D3027' }}>
          {formatEuro(overview.weekTotal)}
        </p>
        <p className="text-xs mt-1.5" style={{ color: '#9AA08F' }}>
          Gesamt: {formatEuro(overview.ytdTotal)}
        </p>
      </div>

      {/* Online/Bar-Summenkarten mit Definitions-Fußnoten */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
        <div className="bg-white rounded-[14px] border border-border p-5">
          <p className="text-[13px]" style={{ color: '#9AA08F' }}>
            Online bezahlt
          </p>
          <p className="font-heading text-[26px] font-bold mt-1 tabular-nums" style={{ color: '#2D3027' }}>
            {formatEuro(overview.weekOnline)}
          </p>
          <p className="text-xs mt-1" style={{ color: '#9AA08F' }}>
            Über FarmerZone bezahlte, abgeholte Bestellungen.
          </p>
        </div>
        <div className="bg-white rounded-[14px] border border-border p-5">
          <p className="text-[13px]" style={{ color: '#9AA08F' }}>
            Bar kassiert
          </p>
          <p className="font-heading text-[26px] font-bold mt-1 tabular-nums" style={{ color: '#2D3027' }}>
            {formatEuro(overview.weekBar)}
          </p>
          <p className="text-xs mt-1" style={{ color: '#9AA08F' }}>
            Vor Ort kassierte Abholungen plus deine Direktverkäufe.
          </p>
        </div>
      </div>

      {stripeReady && (
        <div className="mb-6">
          <StripePayoutLink />
        </div>
      )}

      {/* Schnell wiederholen */}
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
                className="flex items-start gap-3 p-3 rounded-xl border border-border bg-white hover:border-green-300 hover:bg-primary/8 active:scale-[0.98] transition-all text-left"
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

      {/* Vereinte Verkaufsliste */}
      <section>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Letzte Verkäufe
        </p>
        <SalesFeedList feed={overview.feed} onEdit={openEdit} />
      </section>

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
