'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ShoppingCart, Leaf, Thermometer, Snowflake, Package, X, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useCart } from '@/lib/use-cart'
import { UNIT_LABELS } from '@/schemas/product'
import type { PublicProduct } from '@/server/queries/farm'
import { CartSheet } from './cart-sheet'

type ReorderItem = { productId: string; productName: string; quantity: number }

type Props = {
  products: PublicProduct[]
  farmId: string
  farmSlug: string
  initialReorderItems?: ReorderItem[]
  ownerMode?: boolean
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

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
  return (
    <span className="text-[10px] text-[#B86A2E] bg-[#FDF0E8] border border-[#F4D9BE] rounded-full px-2 py-0.5">
      🌱 {s}–{e}
    </span>
  )
}

function ProductCard({
  product,
  onAddToCart,
  isAddingId,
  ownerMode = false,
}: {
  product: PublicProduct
  onAddToCart: (product: PublicProduct) => void
  isAddingId: string | null
  ownerMode?: boolean
}) {
  const canBuy = product.isAvailable && product.stock > 0
  const isAdding = isAddingId === product.id
  const isInactive = !product.isAvailable
  // In ownerMode, inactive products get special "owner-only" treatment
  const ownerInactive = ownerMode && isInactive

  return (
    <div
      className={`bg-card rounded-2xl overflow-hidden flex flex-col transition-[transform,box-shadow] duration-[250ms] ease-out ${
        ownerInactive
          ? 'ring-2 ring-dashed ring-border opacity-70'
          : canBuy
            ? 'ring-1 ring-border/60 hover:-translate-y-1 hover:shadow-[0_8px_20px_oklch(0.18_0.03_150_/_0.08)]'
            : 'ring-1 ring-border/60 opacity-60'
      }`}
      style={{ boxShadow: ownerInactive ? 'none' : '0 2px 8px oklch(0.18 0.03 150 / 0.05)' }}
    >
      {/* Image */}
      <div className="aspect-square relative overflow-hidden flex items-center justify-center">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #E8F0E8 0%, #F4EFE6 100%)' }}
          >
            <Package className="w-10 h-10 text-muted-foreground/40" />
          </div>
        )}
        {product.isOrganic && (
          <div className="absolute top-2.5 left-2.5">
            <span className="inline-flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full">
              <Leaf className="w-2.5 h-2.5" />
              Bio
            </span>
          </div>
        )}
        {/* Low-stock badge — ownerMode only */}
        {ownerMode && product.isAvailable && product.stock >= 1 && product.stock <= 3 && (
          <div className="absolute bottom-2 left-2">
            <span className="inline-flex items-center bg-accent text-accent-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full">
              Nur noch {product.stock}!
            </span>
          </div>
        )}
        {/* "Only you see this" badge — inactive in ownerMode */}
        {ownerInactive && (
          <div className="absolute inset-0 flex items-end justify-start p-2">
            <span className="inline-flex items-center bg-foreground/80 text-background text-[10px] font-semibold px-2 py-0.5 rounded-full">
              Nur du siehst es
            </span>
          </div>
        )}
        <div className="absolute top-2.5 right-2.5 flex gap-1">
          {product.requiresCool && <Thermometer className="w-4 h-4 text-blue-500 drop-shadow" />}
          {product.requiresFreezer && <Snowflake className="w-4 h-4 text-sky-400 drop-shadow" />}
          {/* Edit pencil — ownerMode only */}
          {ownerMode && (
            <Link
              href="/products"
              aria-label="Produkt bearbeiten"
              className="w-7 h-7 rounded-full bg-card/90 shadow-sm border border-border/40 flex items-center justify-center hover:bg-card transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Pencil className="w-3 h-3 text-foreground" />
            </Link>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <p className="font-semibold text-foreground text-sm leading-snug">{product.name}</p>
        <p className="font-heading text-base font-semibold text-primary mt-1">
          {formatPrice(product.price, product.unit, product.unitSize)}
        </p>

        {product.seasonStart && product.seasonEnd && (
          <div className="mt-2">
            <SeasonBadge start={product.seasonStart} end={product.seasonEnd} />
          </div>
        )}

        {product.allergens.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-2 leading-tight">
            Enthält: {product.allergens.join(', ')}
          </p>
        )}

        <div className="flex-1" />

        <div className="mt-4">
          {ownerInactive ? (
            // Inactive in ownerMode — no cart, static chip
            <div className="w-full h-10 bg-muted/60 border border-dashed border-border rounded-xl flex items-center justify-center text-xs text-muted-foreground">
              Ausgeblendet
            </div>
          ) : canBuy ? (
            <button
              onClick={() => onAddToCart(product)}
              disabled={isAdding}
              className="w-full h-10 bg-accent hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60 text-accent-foreground text-sm font-semibold rounded-xl transition-all duration-[250ms] flex items-center justify-center gap-1.5"
            >
              {isAdding ? (
                <span className="animate-pulse">…</span>
              ) : (
                <>
                  <ShoppingCart className="w-3.5 h-3.5" />
                  In den Warenkorb
                </>
              )}
            </button>
          ) : (
            <div className="w-full h-10 bg-muted rounded-xl flex items-center justify-center text-xs text-muted-foreground px-2 text-center">
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

export function ProductGrid({ products, farmId, farmSlug, initialReorderItems, ownerMode = false }: Props) {
  const [cartOpen, setCartOpen] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [showWelcomeBack, setShowWelcomeBack] = useState(false)

  const { items, count, total, isHydrated, addItem, updateQuantity, removeItem } = useCart(farmId)

  // Prefill cart from reorder token
  useEffect(() => {
    if (!isHydrated || !initialReorderItems || initialReorderItems.length === 0) return
    if (items.length > 0) return // don't overwrite existing cart

    async function prefill() {
      let prefilled = false
      for (const ri of initialReorderItems!) {
        const product = products.find(
          (p) => p.id === ri.productId && p.isAvailable && p.stock > 0
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
          ri.quantity
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
      1
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
      {showWelcomeBack && (
        <div className="px-4 pb-4 max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-3 bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3">
            <p className="text-sm text-foreground font-medium">
              Willkommen zurück! Dein letzter Einkauf wurde vorgeladen.
            </p>
            <button
              onClick={() => setShowWelcomeBack(false)}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Schließen"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Section heading */}
      <div className="px-4 pb-4 max-w-4xl mx-auto">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="font-heading text-2xl font-semibold text-foreground">Unsere Produkte</h2>
          {ownerMode && products.length > 0 && (() => {
            const visible = products.filter((p) => p.isAvailable).length
            const hidden = products.filter((p) => !p.isAvailable).length
            return (
              <span className="text-xs text-muted-foreground">
                {visible} sichtbar{hidden > 0 ? ` · ${hidden} ausgeblendet` : ''}
              </span>
            )
          })()}
        </div>
        {!ownerMode && products.length === 0 && (
          <p className="text-sm text-muted-foreground mt-2">Aktuell sind keine Produkte verfügbar.</p>
        )}
      </div>

      {/* Product grid */}
      <div className="px-4 pb-32 max-w-4xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* "Produkt anlegen" tile — ownerMode only, always first */}
          {ownerMode && (
            <Link
              href="/products"
              className="bg-card rounded-2xl overflow-hidden border-2 border-dashed border-border flex flex-col items-center justify-center aspect-square hover:border-primary/40 hover:bg-primary/5 transition-colors p-4 text-center"
            >
              <div className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center mb-3">
                <Plus className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Produkt anlegen</p>
              <p className="text-xs text-muted-foreground mt-1">Foto, Preis, Menge</p>
            </Link>
          )}
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onAddToCart={handleAddToCart}
              isAddingId={addingId}
              ownerMode={ownerMode}
            />
          ))}
        </div>
      </div>

      {/* Sticky cart button */}
      {isHydrated && count > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 inset-x-4 sm:inset-x-auto sm:right-6 sm:left-auto z-40 flex items-center justify-center gap-2.5 bg-accent hover:bg-accent-hover active:scale-[0.98] text-accent-foreground rounded-full px-6 py-3.5 transition-all duration-[250ms]"
          style={{ boxShadow: '0 8px 24px oklch(0.66 0.14 47 / 0.35)' }}
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="font-semibold text-sm">
            {count} {count === 1 ? 'Artikel' : 'Artikel'} · {formatEuro(total)}
          </span>
        </button>
      )}

      {/* Cart sheet */}
      <CartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        items={items}
        total={total}
        farmSlug={farmSlug}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
      />
    </>
  )
}
