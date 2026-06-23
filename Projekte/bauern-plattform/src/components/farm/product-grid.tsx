'use client'

import { useState } from 'react'
import { ShoppingCart, Leaf, Thermometer, Snowflake, Package } from 'lucide-react'
import { toast } from 'sonner'
import { useCart } from '@/lib/use-cart'
import { UNIT_LABELS } from '@/schemas/product'
import type { PublicProduct } from '@/server/queries/farm'
import { CartSheet } from './cart-sheet'

type Props = {
  products: PublicProduct[]
  farmId: string
  farmSlug: string
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
}: {
  product: PublicProduct
  onAddToCart: (product: PublicProduct) => void
  isAddingId: string | null
}) {
  const canBuy = product.isAvailable && product.stock > 0
  const isAdding = isAddingId === product.id

  return (
    <div
      className={`bg-card rounded-2xl overflow-hidden ring-1 ring-border/60 flex flex-col transition-[transform,box-shadow] duration-[250ms] ease-out ${
        canBuy ? 'hover:-translate-y-1 hover:shadow-[0_8px_20px_oklch(0.18_0.03_150_/_0.08)]' : 'opacity-60'
      }`}
      style={{ boxShadow: '0 2px 8px oklch(0.18 0.03 150 / 0.05)' }}
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
        <div className="absolute top-2.5 right-2.5 flex gap-1">
          {product.requiresCool && <Thermometer className="w-4 h-4 text-blue-500 drop-shadow" />}
          {product.requiresFreezer && <Snowflake className="w-4 h-4 text-sky-400 drop-shadow" />}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <p className="font-semibold text-foreground text-sm leading-snug">{product.name}</p>
        <p className="font-heading text-base font-semibold text-primary mt-1">
          {formatPrice(product.price, product.unit, product.unitSize)}
        </p>

        {/* Season */}
        {product.seasonStart && product.seasonEnd && (
          <div className="mt-2">
            <SeasonBadge start={product.seasonStart} end={product.seasonEnd} />
          </div>
        )}

        {/* Allergens */}
        {product.allergens.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-2 leading-tight">
            Enthält: {product.allergens.join(', ')}
          </p>
        )}

        <div className="flex-1" />

        {/* CTA */}
        <div className="mt-4">
          {canBuy ? (
            <button
              onClick={() => onAddToCart(product)}
              disabled={isAdding}
              className="w-full h-10 bg-primary hover:opacity-90 active:scale-[0.98] disabled:opacity-60 text-primary-foreground text-sm font-semibold rounded-xl transition-all duration-[250ms] flex items-center justify-center gap-1.5"
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

export function ProductGrid({ products, farmId, farmSlug }: Props) {
  const [cartOpen, setCartOpen] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)

  const { items, count, total, isHydrated, addItem, updateQuantity, removeItem } = useCart(farmId)

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
      {/* Section heading */}
      <div className="px-4 pb-4 max-w-4xl mx-auto">
        <h2 className="font-heading text-2xl font-semibold text-foreground">Unsere Produkte</h2>
        {products.length === 0 && (
          <p className="text-sm text-muted-foreground mt-2">Aktuell sind keine Produkte verfügbar.</p>
        )}
      </div>

      {/* Product grid */}
      <div className="px-4 pb-32 max-w-4xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onAddToCart={handleAddToCart}
              isAddingId={addingId}
            />
          ))}
        </div>
      </div>

      {/* Sticky cart button */}
      {isHydrated && count > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 inset-x-4 sm:inset-x-auto sm:right-6 sm:left-auto z-40 flex items-center justify-center gap-2.5 bg-primary hover:opacity-95 active:scale-[0.98] text-primary-foreground rounded-full px-6 py-3.5 transition-all duration-[250ms]"
          style={{ boxShadow: '0 8px 24px oklch(0.38 0.089 150 / 0.35)' }}
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
