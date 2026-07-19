'use client'

import { useState, useEffect, useMemo, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ShoppingCart, Leaf, Thermometer, Snowflake, Package, X, Plus, EyeOff, Camera, Loader2, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { useCart } from '@/lib/use-cart'
import { UNIT_LABELS, MONTH_SHORT, seasonLabel } from '@/schemas/product'
import type { PublicProduct } from '@/server/queries/farm'
import { updateProductImageAction, reorderProductsAction } from '@/server/actions/products'
import { ReorderContext } from '@/components/shared/reorder-context'
import { useImageUpload } from '@/components/shared/image-upload'
import { CartSheet } from './cart-sheet'

type ReorderItem = { productId: string; productName: string; quantity: number }

type Props = {
  products: PublicProduct[]
  farmId: string
  farmSlug: string
  initialReorderItems?: ReorderItem[]
  ownerMode?: boolean
  mode?: 'edit' | 'preview'
}

const LOW_STOCK = 5


function formatEuro(n: number) {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(n)
}

function formatPrice(price: number, unit: string, unitSize: number | null) {
  const unitLabel = UNIT_LABELS[unit] ?? unit
  if (unitSize && unitSize !== 1) return `${formatEuro(price)} / ${unitSize} ${unitLabel}`
  return `${formatEuro(price)} / ${unitLabel}`
}

function SeasonBadge({ start, end }: { start: number; end: number }) {
  const s = MONTH_SHORT[start - 1]
  const e = MONTH_SHORT[end - 1]
  // title (Desktop-Hover) + aria-label (Screenreader) erklären das kompakte
  // "Okt–Mär" in Klartext — gleicher Wortlaut wie im Produkt-Dialog
  const label = seasonLabel(start, end)
  return (
    <span
      title={label}
      aria-label={label}
      className="inline-flex items-center gap-1 text-[10px] text-[#B86A2E] bg-[#FDF0E8] border border-[#F4D9BE] rounded-full px-2 py-0.5"
    >
      <Leaf className="size-2.5" aria-hidden="true" />
      {s}–{e}
    </span>
  )
}

type StripState =
  | { type: 'hidden' }
  | { type: 'soldout' }
  | { type: 'low'; count: number }
  | { type: 'normal'; count: number }

function getStripState(product: PublicProduct): StripState {
  if (!product.isAvailable) return { type: 'hidden' }
  if (product.stock === 0) return { type: 'soldout' }
  if (product.stock <= LOW_STOCK) return { type: 'low', count: product.stock }
  return { type: 'normal', count: product.stock }
}

function StockStrip({ product }: { product: PublicProduct }) {
  const strip = getStripState(product)

  let bg: string
  let color: string
  let content: React.ReactNode

  if (strip.type === 'hidden') {
    bg = 'rgba(216,210,194,0.97)'
    color = '#3F4237'
    content = (
      <>
        <EyeOff className="size-3" strokeWidth={1.7} />
        Ausgeblendet – nur du siehst es
      </>
    )
  } else if (strip.type === 'soldout') {
    bg = '#D97C46'
    color = '#fff'
    content = 'Ausverkauft'
  } else if (strip.type === 'low') {
    bg = '#D97C46'
    color = '#fff'
    content = `Nur noch ${strip.count} verfügbar`
  } else {
    bg = 'rgba(242,236,221,0.95)'
    color = '#6E5F45'
    content = `${strip.count} verfügbar`
  }

  return (
    <div
      className="absolute left-0 right-0 bottom-0 h-7 flex items-center justify-center gap-1.5 text-[11px] font-bold"
      style={{ background: bg, color }}
    >
      {content}
    </div>
  )
}

// ── Product image area with optional edit-mode upload overlay ─────────────────

function ProductImageArea({
  product,
  dim,
  isEditMode,
}: {
  product: PublicProduct
  dim: number
  isEditMode: boolean
}) {
  const [, startTransition] = useTransition()
  const router = useRouter()

  const { isUploading, openFilePicker, fileInput } = useImageUpload({
    variant: 'product',
    targetId: product.id,
    oldUrl: product.imageUrl ?? undefined,
    onUploaded: (url) => {
      startTransition(async () => {
        const result = await updateProductImageAction(product.id, url)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Produktbild aktualisiert')
          router.refresh()
        }
      })
    },
  })

  return (
    <div className="relative flex-shrink-0 group" style={{ height: 170, background: '#F4EFE3' }}>
      {fileInput}

      {/* Dimmed image wrapper — imageUrl ?? Kategoriebild ?? Sand-Platzhalter */}
      <div className="absolute inset-0" style={{ opacity: dim }}>
        {(product.imageUrl ?? product.categoryImageUrl) ? (
          <Image
            src={(product.imageUrl ?? product.categoryImageUrl)!}
            alt={product.name}
            fill
            sizes="(min-width: 768px) 33vw, 50vw"
            className="object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package className="w-10 h-10" style={{ color: '#C9C2B2' }} />
          </div>
        )}
        {/* Bio badge */}
        {product.isOrganic && (
          <div className="absolute top-2.5 left-2.5">
            <span className="inline-flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full">
              <Leaf className="w-2.5 h-2.5" />
              Bio
            </span>
          </div>
        )}
        {/* Storage icons */}
        {(product.requiresCool || product.requiresFreezer) && (
          <div className="absolute top-2.5 right-2.5 flex gap-1">
            {product.requiresCool && <Thermometer className="w-4 h-4 text-blue-500 drop-shadow" />}
            {product.requiresFreezer && <Snowflake className="w-4 h-4 text-sky-400 drop-shadow" />}
          </div>
        )}
      </div>

      {/* Stock strip — always full opacity, shown in edit mode */}
      {isEditMode && <StockStrip product={product} />}

      {/* Edit-mode hover overlay */}
      {isEditMode && (
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isUploading}
          aria-label={(product.imageUrl ?? product.categoryImageUrl) ? 'Bild ersetzen' : 'Bild hinzufügen'}
          className="absolute inset-0 flex items-end justify-center pb-9 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:cursor-wait"
          style={{ background: 'rgba(20,30,22,0.35)' }}
        >
          <span
            className="flex items-center gap-1.5 rounded-full text-xs font-semibold text-white px-3 py-1.5"
            style={{ background: 'rgba(45,48,39,0.80)' }}
          >
            {isUploading
              ? <Loader2 className="size-3 animate-spin" />
              : <Camera className="size-3" strokeWidth={1.7} />
            }
            {isUploading ? 'Lädt…' : (product.imageUrl ?? product.categoryImageUrl) ? 'Ersetzen' : 'Bild hinzufügen'}
          </span>
        </button>
      )}
    </div>
  )
}

// Sortable-Hülle (nur Edit-Modus): Grip-Handle oben links, Drag-Feedback per Schatten
function SortableProductCard({
  product,
  children,
}: {
  product: PublicProduct
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: product.id })

  return (
    <div
      ref={setNodeRef}
      className="relative"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 30 : undefined,
        boxShadow: isDragging ? '0 14px 32px rgba(45,95,63,0.28)' : undefined,
        scale: isDragging ? '1.02' : undefined,
        borderRadius: 12,
      }}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`${product.name} verschieben`}
        className="absolute top-2 left-2 z-20 flex items-center justify-center size-8 rounded-lg cursor-grab active:cursor-grabbing"
        style={{
          touchAction: 'none',
          background: 'rgba(255,255,255,0.94)',
          color: '#5C6052',
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        }}
      >
        <GripVertical className="size-4" strokeWidth={1.7} />
      </button>
      {children}
    </div>
  )
}

function ProductCard({
  product,
  onAddToCart,
  isAddingId,
  ownerMode = false,
  isEditMode = false,
}: {
  product: PublicProduct
  onAddToCart: (product: PublicProduct) => void
  isAddingId: string | null
  ownerMode?: boolean
  isEditMode?: boolean
}) {
  const canBuy = product.isAvailable && product.stock > 0
  const isAdding = isAddingId === product.id
  const dim = isEditMode && !product.isAvailable ? 0.55 : 1

  return (
    <div
      className="bg-white rounded-[12px] overflow-hidden flex flex-col"
      style={{ boxShadow: '0 2px 10px rgba(45,95,63,0.06)' }}
    >
      <ProductImageArea product={product} dim={dim} isEditMode={isEditMode} />

      {/* Body */}
      <div
        className="px-[15px] py-[14px] flex flex-col flex-1"
        style={{ opacity: dim }}
      >
        <p className="font-semibold text-sm leading-snug" style={{ color: '#2D3027' }}>{product.name}</p>
        <p className="text-[17px] font-bold mt-[5px]" style={{ color: '#2D3027' }}>
          {formatPrice(product.price, product.unit, product.unitSize)}
        </p>

        {product.seasonStart && product.seasonEnd && (
          <div className="mt-2">
            <SeasonBadge start={product.seasonStart} end={product.seasonEnd} />
          </div>
        )}

        {product.allergens.length > 0 && (
          <p className="text-[10px] mt-2 leading-tight" style={{ color: '#9AA08F' }}>
            Enthält: {product.allergens.join(', ')}
          </p>
        )}

        <div className="flex-1" />

        {/* Footer — mode-aware */}
        <div className="mt-3 pt-2">
          {isEditMode ? (
            <div className="flex gap-2">
              <Link
                href={`/products?edit=${product.id}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-[11px] rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-90"
                style={{ background: '#2D5F3F', color: '#fff' }}
              >
                Bearbeiten
              </Link>
              <Link
                href="/products"
                className="flex-1 flex items-center justify-center gap-1.5 py-[11px] rounded-lg text-[13px] font-semibold border transition-colors hover:bg-gray-50"
                style={{ borderColor: '#D6E0CE', color: '#2D5F3F', background: '#fff' }}
              >
                Lager
              </Link>
            </div>
          ) : canBuy ? (
            <button
              onClick={() => onAddToCart(product)}
              disabled={isAdding}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60 hover:opacity-90 active:scale-[0.98]"
              style={{ background: '#E8854A', color: '#fff' }}
            >
              {isAdding ? (
                <span className="animate-pulse">…</span>
              ) : (
                <>
                  <ShoppingCart className="size-[15px]" strokeWidth={1.7} />
                  In den Warenkorb
                </>
              )}
            </button>
          ) : (
            <div
              className="w-full h-10 flex items-center justify-center rounded-lg text-xs px-2 text-center"
              style={{ background: 'rgba(242,236,221,0.95)', color: '#6E5F45' }}
            >
              {!product.isAvailable
                ? product.unavailableReason || 'Nicht verfügbar'
                : 'Ausverkauft'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ProductGrid({
  products,
  farmId,
  farmSlug,
  initialReorderItems,
  ownerMode = false,
  mode = 'preview',
}: Props) {
  const isEditMode = ownerMode && mode !== 'preview'

  // Sprint 18: optimistische Sortier-Reihenfolge (null = Server-Stand)
  const [orderedIds, setOrderedIds] = useState<string[] | null>(null)
  const [, startReorderTransition] = useTransition()

  // Neuer Server-Stand (props) macht den optimistischen Zustand obsolet
  useEffect(() => {
    setOrderedIds(null)
  }, [products])

  const displayProducts = useMemo(() => {
    if (!isEditMode || !orderedIds) return products
    const byId = new Map(products.map((p) => [p.id, p]))
    const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as PublicProduct[]
    return ordered.length === products.length ? ordered : products
  }, [products, orderedIds, isEditMode])

  function handleReorderDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const current = displayProducts.map((p) => p.id)
    const next = arrayMove(current, current.indexOf(String(active.id)), current.indexOf(String(over.id)))
    setOrderedIds(next)
    startReorderTransition(async () => {
      const result = await reorderProductsAction(next)
      if (result.error) {
        toast.error(result.error)
        setOrderedIds(null) // Revert auf Server-Stand
      }
    })
  }

  const [cartOpen, setCartOpen] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [showWelcomeBack, setShowWelcomeBack] = useState(false)

  const { items, count, total, isHydrated, addItem, updateQuantity, removeItem } = useCart(farmId)

  // Prefill cart from reorder token (not in edit mode)
  useEffect(() => {
    if (isEditMode) return
    if (!isHydrated || !initialReorderItems || initialReorderItems.length === 0) return
    if (items.length > 0) return

    async function prefill() {
      let prefilled = false
      for (const ri of initialReorderItems!) {
        const product = products.find(
          (p) => p.id === ri.productId && p.isAvailable && p.stock > 0,
        )
        if (!product) continue
        const result = await addItem(
          {
            productId: product.id,
            name: product.name,
            price: product.price,
            unit: product.unit,
            unitSize: product.unitSize,
            imageUrl: product.imageUrl,
          },
          ri.quantity,
        )
        if (result.ok) prefilled = true
      }
      if (prefilled) {
        setShowWelcomeBack(true)
        setCartOpen(true)
      }
    }

    prefill()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated])

  async function handleAddToCart(product: PublicProduct) {
    setAddingId(product.id)
    const result = await addItem(
      {
        productId: product.id,
        name: product.name,
        price: product.price,
        unit: product.unit,
        unitSize: product.unitSize,
        imageUrl: product.imageUrl,
      },
      1,
    )
    setAddingId(null)

    if (result.ok) {
      toast.success(`${product.name} hinzugefügt`, { duration: 2000 })
      setCartOpen(true)
    } else {
      toast.error(result.error ?? 'Produkt nicht verfügbar')
    }
  }

  return (
    <>
      {/* Welcome-back banner */}
      {!isEditMode && showWelcomeBack && (
        <div className="pb-4">
          <div
            className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
            style={{ background: 'rgba(45,95,63,0.08)', border: '1px solid rgba(45,95,63,0.14)' }}
          >
            <p className="text-sm font-medium" style={{ color: '#2D3027' }}>
              Willkommen zurück! Dein letzter Einkauf wurde vorgeladen.
            </p>
            <button
              onClick={() => setShowWelcomeBack(false)}
              className="shrink-0 transition-colors"
              style={{ color: '#9AA08F' }}
              aria-label="Schließen"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Empty state (public) */}
      {!ownerMode && products.length === 0 && (
        <p className="text-sm pb-4" style={{ color: '#9AA08F' }}>
          Aktuell sind keine Produkte verfügbar.
        </p>
      )}

      {/* Grid — 3 cols, 20px gap; im Edit-Modus sortierbar */}
      <ReorderContext
        enabled={isEditMode}
        items={displayProducts.map((p) => p.id)}
        onDragEnd={handleReorderDragEnd}
      >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
        {/* "Produkt anlegen" tile — edit mode only */}
        {isEditMode && (
          <Link
            href="/products"
            className="flex flex-col items-center justify-center rounded-[12px] transition-colors hover:bg-white/70"
            style={{
              border: '2px dashed #C9C2B2',
              background: 'rgba(255,255,255,0.5)',
              minHeight: 330,
            }}
          >
            <span
              className="flex items-center justify-center rounded-full mb-3"
              style={{ width: 52, height: 52, background: '#E8F0E2', color: '#2D5F3F' }}
            >
              <Plus className="size-[22px]" strokeWidth={1.9} />
            </span>
            <span className="text-[15px] font-semibold" style={{ color: '#2D5F3F' }}>Produkt anlegen</span>
            <span className="text-[13px] mt-1" style={{ color: '#9AA08F' }}>Foto, Preis, Menge</span>
          </Link>
        )}

        {displayProducts.map((p) =>
          isEditMode ? (
            <SortableProductCard key={p.id} product={p}>
              <ProductCard
                product={p}
                onAddToCart={handleAddToCart}
                isAddingId={addingId}
                ownerMode={ownerMode}
                isEditMode={isEditMode}
              />
            </SortableProductCard>
          ) : (
            <ProductCard
              key={p.id}
              product={p}
              onAddToCart={handleAddToCart}
              isAddingId={addingId}
              ownerMode={ownerMode}
              isEditMode={isEditMode}
            />
          )
        )}
      </div>
      </ReorderContext>

      {/* Sticky cart button (not in edit mode) */}
      {!isEditMode && isHydrated && count > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 inset-x-4 sm:inset-x-auto sm:right-6 sm:left-auto z-40 flex items-center justify-center gap-2.5 rounded-full px-6 py-3.5 transition-all duration-[250ms] active:scale-[0.98]"
          style={{
            background: '#E8854A',
            color: '#fff',
            boxShadow: '0 8px 24px rgba(232,133,74,0.35)',
          }}
        >
          <ShoppingCart className="w-5 h-5" strokeWidth={1.7} />
          <span className="font-semibold text-sm">
            {count} {count === 1 ? 'Artikel' : 'Artikel'} · {formatEuro(total)}
          </span>
        </button>
      )}

      {/* Cart sheet */}
      {!isEditMode && (
        <CartSheet
          open={cartOpen}
          onOpenChange={setCartOpen}
          items={items}
          total={total}
          farmSlug={farmSlug}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeItem}
        />
      )}
    </>
  )
}
