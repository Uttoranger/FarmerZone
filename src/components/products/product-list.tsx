'use client'

import { useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Leaf,
  Thermometer,
  Snowflake,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { updateStock, setzeKategorie } from '@/server/actions/products'
import { deleteProduct } from '@/server/actions/products'
import type { ProductData } from '@/server/queries/products'
import type { KategorieVorschlag } from '@/lib/taxonomie'
import { formatGrundpreis, formatKategorie } from '@/lib/format'
import { produktHinweise } from './produkt-hinweise'
import { GrundpreisZeile } from '@/components/shared/grundpreis-zeile'
import { ProductDialog } from './product-dialog'
import { StockDialog } from './stock-dialog'
import { PageHeader } from '@/components/farmer/page-header'

type Props = {
  products: ProductData[]
  initialEditId?: string
  /** Betriebsnummer aus den Hof-Einstellungen — Anzeige in der Futter-Kennzeichnung. */
  hofBetriebsnummer: string | null
}

function getStatus(p: ProductData, stock: number) {
  if (!p.isAvailable) return 'pausiert'
  if (stock <= 0) return 'ausverkauft'
  return 'aktiv'
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  aktiv: { label: 'Aktiv', className: 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-200 border-green-200 dark:border-green-900/60' },
  ausverkauft: { label: 'Ausverkauft', className: 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-200 border-red-200 dark:border-red-900/60' },
  pausiert: { label: 'Pausiert', className: 'bg-muted text-muted-foreground border-border' },
}

export function ProductList({ products: initialProducts, initialEditId, hofBetriebsnummer }: Props) {
  // Optimistic stock state
  const [stocks, setStocks] = useState<Record<string, number>>(
    Object.fromEntries(initialProducts.map((p) => [p.id, p.stock]))
  )
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  // Dialog state
  const [editDialog, setEditDialog] = useState<{ open: boolean; product: ProductData | null }>({
    open: false,
    product: null,
  })

  // Auto-open edit dialog from ?edit= URL param
  useEffect(() => {
    if (!initialEditId) return
    const product = initialProducts.find((p) => p.id === initialEditId)
    if (product) setEditDialog({ open: true, product })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [stockDialogProduct, setStockDialogProduct] = useState<ProductData | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<ProductData | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Use latest product data but keep optimistic stock
  const products = initialProducts.map((p) => ({
    ...p,
    stock: stocks[p.id] ?? p.stock,
  }))

  function handleOptimisticUpdate(productId: string, newStock: number) {
    setStocks((prev) => ({ ...prev, [productId]: newStock }))
  }

  function handleQuickStock(product: ProductData, delta: number) {
    const current = stocks[product.id] ?? product.stock
    const newStock = Math.max(0, current + delta)
    setStocks((prev) => ({ ...prev, [product.id]: newStock }))
    setPendingIds((prev) => new Set(prev).add(product.id))

    startTransition(async () => {
      try {
        await updateStock(product.id, delta)
        toast.success(`+${delta} — Bestand: ${newStock}`)
      } catch {
        setStocks((prev) => ({ ...prev, [product.id]: current }))
        toast.error('Fehler beim Speichern')
      } finally {
        setPendingIds((prev) => {
          const s = new Set(prev)
          s.delete(product.id)
          return s
        })
      }
    })
  }

  /** Chip „… übernehmen": setzt nur die Kategorie, nie das ganze Produkt (setzeKategorie). */
  const [uebernimmt, setUebernimmt] = useState<string | null>(null)
  async function kategorieUebernehmen(product: ProductData, vorschlag: KategorieVorschlag) {
    setUebernimmt(product.id)
    try {
      const ergebnis = await setzeKategorie({ productId: product.id, ...vorschlag })
      if ('error' in ergebnis) toast.error(ergebnis.error)
      else toast.success(`${product.name}: ${formatKategorie(vorschlag.category, vorschlag.subcategory)}`)
    } catch {
      toast.error('Wir konnten die Kategorie nicht speichern. Bitte versuch es noch einmal.')
    } finally {
      setUebernimmt(null)
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    setIsDeleting(true)
    try {
      await deleteProduct(deleteConfirm.id)
      toast.success('Produkt gelöscht')
      setDeleteConfirm(null)
    } catch {
      toast.error('Fehler beim Löschen')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      {/* Header */}
      <PageHeader
        title="Produkte"
        subtitle={products.length === 0
          ? 'Noch keine Produkte'
          : `${products.filter((p) => p.isAvailable).length} aktiv · ${products.length} gesamt`}
        action={
          <Button
            onClick={() => setEditDialog({ open: true, product: null })}
            className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent-hover"
          >
            <Plus className="w-4 h-4" />
            Neu
          </Button>
        }
      />

      {/* Empty state */}
      {products.length === 0 && (
        <div className="text-center py-16">
          <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="font-medium text-foreground mb-1">Noch keine Produkte</p>
          <p className="text-sm text-muted-foreground/60 mb-6">Leg dein erstes Produkt an, um loszulegen.</p>
          <Button
            onClick={() => setEditDialog({ open: true, product: null })}
            className="bg-accent text-accent-foreground hover:bg-accent-hover"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Erstes Produkt anlegen
          </Button>
        </div>
      )}

      {/* Product cards */}
      <div className="space-y-3">
        {products.map((product) => {
          const status = getStatus(product, product.stock)
          const badge = STATUS_BADGE[status]
          const isPending = pendingIds.has(product.id)
          const hinweise = produktHinweise(product)

          return (
            <Card key={product.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex gap-0">
                  {/* Image */}
                  <div
                    className="shrink-0 w-20 h-20 md:w-24 md:h-24 bg-muted flex items-center justify-center"
                    style={product.categoryImageUrl && !product.imageUrl ? { background: 'var(--app-chip)' } : undefined}
                  >
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : product.categoryImageUrl ? (
                      // Kategorie-Fallback: object-contain auf Sand, wie echte Bilder im Grid
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.categoryImageUrl}
                        alt={product.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Package className="w-7 h-7 text-muted-foreground/50" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 px-3 py-2.5 min-w-0">
                    {/* Name + badges */}
                    <div className="flex items-start gap-1.5 flex-wrap">
                      <span className="font-medium text-foreground text-sm leading-tight">
                        {product.name}
                      </span>
                      <Badge className={`text-[10px] px-1.5 py-0 border ${badge.className}`}>
                        {badge.label}
                      </Badge>
                      {product.isOrganic && (
                        <Leaf className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
                      )}
                      {product.requiresCool && (
                        <Thermometer className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      )}
                      {product.requiresFreezer && (
                        <Snowflake className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      )}
                      {/* Dezenter Hinweis, kein Fehler: Bestandsprodukte haben
                          noch keine Unterkategorie (Sprint Taxonomie 1). */}
                      {hinweise.some((h) => h.art === 'unterkategorie-ergaenzen') && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-dashed text-muted-foreground"
                        >
                          Unterkategorie ergänzen
                        </Badge>
                      )}
                    </div>

                    {/* Hinweise mit Handlung, keine Fehler: Produkte ohne Kategorie
                        stehen öffentlich unter Sonstiges; Futtermittel mit alter
                        Gebindegröße rechnen den Kilopreis falsch (Rückfrage F1). */}
                    {hinweise.some((h) => h.art !== 'unterkategorie-ergaenzen') && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {hinweise.map((h) => {
                          const klasse =
                            'inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed px-2.5 text-xs font-medium transition-colors disabled:opacity-50'
                          if (h.art === 'kategorie-uebernehmen') {
                            return (
                              <button
                                key={h.art}
                                type="button"
                                disabled={uebernimmt === product.id}
                                onClick={() => kategorieUebernehmen(product, h.vorschlag)}
                                className={`${klasse} border-primary/60 bg-primary/5 text-foreground hover:bg-primary/10`}
                              >
                                <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-text" aria-hidden />
                                {formatKategorie(h.vorschlag.category, h.vorschlag.subcategory)} übernehmen
                              </button>
                            )
                          }
                          if (h.art === 'unterkategorie-ergaenzen') return null
                          return (
                            <button
                              key={h.art}
                              type="button"
                              onClick={() => setEditDialog({ open: true, product })}
                              className={`${klasse} border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40`}
                            >
                              {h.art === 'kategorie-ergaenzen' ? 'Kategorie ergänzen' : 'Einheit prüfen'}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Price */}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatGrundpreis(product.price, product.unit, product.unitSize)}
                    </p>
                    <GrundpreisZeile
                      price={product.price}
                      unit={product.unit}
                      unitSize={product.unitSize}
                      className="text-[11px]"
                    />

                    {/* Stock + quick buttons */}
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`text-xs font-medium min-w-[60px] ${
                          isPending ? 'text-muted-foreground/60' : 'text-foreground'
                        }`}
                      >
                        Bestand: {product.stock}
                      </span>
                      <div className="flex gap-1">
                        {[5, 10, 20].map((delta) => (
                          <button
                            key={delta}
                            onClick={() => handleQuickStock(product, delta)}
                            disabled={isPending}
                            className="h-10 min-w-[48px] px-2 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted hover:border-border/80 disabled:opacity-40 transition-colors"
                          >
                            +{delta}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Action column */}
                  <div className="shrink-0 flex flex-col border-l border-border/50">
                    <button
                      onClick={() => setEditDialog({ open: true, product })}
                      title="Bearbeiten"
                      className="flex-1 flex items-center justify-center w-10 hover:bg-muted/30 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground/60" />
                    </button>
                    <div className="w-full h-px bg-muted" />
                    <button
                      onClick={() => setStockDialogProduct(product)}
                      title="Bestand anpassen"
                      className="flex-1 flex items-center justify-center w-10 hover:bg-muted/30 transition-colors"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground/60" />
                    </button>
                    <div className="w-full h-px bg-muted" />
                    <button
                      onClick={() => setDeleteConfirm(product)}
                      title="Löschen"
                      className="flex-1 flex items-center justify-center w-10 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-red-400" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Product create/edit dialog */}
      <ProductDialog
        open={editDialog.open}
        product={editDialog.product}
        onClose={() => setEditDialog({ open: false, product: null })}
        hofBetriebsnummer={hofBetriebsnummer}
      />

      {/* Stock adjustment dialog */}
      <StockDialog
        product={stockDialogProduct}
        currentStock={
          stockDialogProduct
            ? (stocks[stockDialogProduct.id] ?? stockDialogProduct.stock)
            : 0
        }
        onClose={() => setStockDialogProduct(null)}
        onOptimisticUpdate={handleOptimisticUpdate}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Produkt löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">{deleteConfirm?.name}</span> wird dauerhaft gelöscht.
            Vergangene Bestellungen bleiben erhalten.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)} disabled={isDeleting}>
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

