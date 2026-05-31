'use client'

import { useState } from 'react'
import { ShoppingCart, Leaf, Thermometer, Snowflake, Package } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
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
    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
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
      className={`bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm flex flex-col ${
        !canBuy ? 'opacity-60' : ''
      }`}
    >
      {/* Image */}
      <div className="aspect-square bg-slate-100 relative overflow-hidden flex items-center justify-center">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <Package className="w-10 h-10 text-slate-300" />
        )}
        {/* Badges top-left */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.isOrganic && (
            <span className="bg-green-700 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
              Bio
            </span>
          )}
        </div>
        {/* Storage icons top-right */}
        <div className="absolute top-2 right-2 flex gap-1">
          {product.requiresCool && <Thermometer className="w-4 h-4 text-blue-500 drop-shadow" />}
          {product.requiresFreezer && <Snowflake className="w-4 h-4 text-sky-400 drop-shadow" />}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col flex-1">
        <p className="font-medium text-slate-800 text-sm leading-tight">{product.name}</p>
        <p className="text-xs text-slate-500 mt-0.5 font-medium">
          {formatPrice(product.price, product.unit, product.unitSize)}
        </p>

        {/* Season */}
        {product.seasonStart && product.seasonEnd && (
          <div className="mt-1.5">
            <SeasonBadge start={product.seasonStart} end={product.seasonEnd} />
          </div>
        )}

        {/* Allergens summary */}
        {product.allergens.length > 0 && (
          <p className="text-[10px] text-slate-400 mt-1.5 leading-tight">
            Enthält: {product.allergens.join(', ')}
          </p>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* CTA */}
        <div className="mt-3">
          {canBuy ? (
            <button
              onClick={() => onAddToCart(product)}
              disabled={isAdding}
              className="w-full h-10 bg-green-700 hover:bg-green-800 active:scale-[0.98] disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-1.5"
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
            <div className="w-full h-10 bg-slate-100 rounded-xl flex items-center justify-center text-xs text-slate-500 px-2 text-center">
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
      <div className="px-4 pb-3 max-w-4xl mx-auto">
        <h2 className="text-lg font-semibold text-slate-800">Unsere Produkte</h2>
        {products.length === 0 && (
          <p className="text-sm text-slate-400 mt-2">Aktuell sind keine Produkte verfügbar.</p>
        )}
      </div>

      {/* Product grid */}
      <div className="px-4 pb-28 max-w-4xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
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

      {/* Sticky cart button — shown after hydration when cart has items */}
      {isHydrated && count > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 right-4 z-40 flex items-center gap-2.5 bg-green-700 hover:bg-green-800 active:scale-95 text-white rounded-full px-4 py-3 shadow-xl transition-all"
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="font-medium text-sm">
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
