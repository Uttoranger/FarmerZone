'use client'

import { useState, useEffect, useMemo, useOptimistic, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ShoppingCart, Leaf, Thermometer, Snowflake, Package, X, Plus, EyeOff, Camera, Loader2, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { useCart } from '@/lib/use-cart'
import { MONTH_SHORT, seasonLabel } from '@/schemas/product'
import { formatEuro } from '@/lib/preis-format'
import { formatGrundpreis, formatGrundpreisNetto } from '@/lib/format'
import { GrundpreisZeile } from '@/components/shared/grundpreis-zeile'
import { BereichUmschalter } from '@/components/shared/bereich-umschalter'
import { SHOP_PAUSED_BUTTON_LABEL } from '@/lib/shop-pause'
import { produktZustand, streifenText, type ProduktZustand } from '@/lib/produkt-sichtbarkeit'
import { ImShopSchalter } from '@/components/products/im-shop-schalter'
import { teileHofseite, zeigeKaufknopf } from '@/lib/bereiche-anzeige'
import { bereichAusParameter, bereichParameter } from '@/schemas/hoefe-filter'
import type { AnzeigeBereich } from '@/lib/taxonomie'
import type { PublicProduct } from '@/server/queries/farm'
import { updateProductImageAction, reorderProductsAction } from '@/server/actions/products'
import { ReorderContext } from '@/components/shared/reorder-context'
import { stufenText, useImageUpload } from '@/components/shared/image-upload'
import { CartSheet } from './cart-sheet'
import { ProduktDetail, type HofFuerDetail } from './produkt-detail'

type ReorderItem = { productId: string; productName: string; quantity: number }

type Props = {
  products: PublicProduct[]
  farmId: string
  farmSlug: string
  /** Für das Produktdetail: der Hof als Verantwortlicher der Futter-Kennzeichnung. */
  hof: HofFuerDetail
  initialReorderItems?: ReorderItem[]
  ownerMode?: boolean
  mode?: 'edit' | 'preview'
  /** Shop pausiert: Kauf-Schaltflächen sind tot (Durchsetzung liegt am Server). */
  isPaused?: boolean
  /**
   * Wechselt in die Kundenansicht. Kommt von farm-page-client.tsx, wo `mode`
   * lebt — der Zustand floss bisher nur nach unten, für diesen Knopf braucht es
   * den Rückweg.
   */
  onVorschau?: () => void
}


// Produktpreise kommen aus src/lib/format.ts (formatGrundpreis + Grundpreis-
// Zeile), damit Hofübersicht, Warenkorb und Bauern-Bereich dieselbe Schreib-
// weise zeigen. Nur die Warenkorb-Summe nutzt noch formatEuro aus
// preis-format.ts (Altlast, Symbol hinten).

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
      className="inline-flex items-center gap-1 text-[10px] text-notice-icon bg-notice border border-notice-line rounded-full px-2 py-0.5"
    >
      <Leaf className="size-2.5" aria-hidden="true" />
      {s}–{e}
    </span>
  )
}

/**
 * Der Streifen über dem Produktbild — nur im Bearbeitungsmodus.
 *
 * WAS ER SAGT, entscheidet die reine Funktion in
 * src/lib/produkt-sichtbarkeit.ts; hier wird nur gezeichnet. Vorher lag dieselbe
 * Ableitung auch in der Produktliste, mit anderen Wörtern.
 *
 * FARBEN (CODING_STANDARDS §7). Vorher standen hier vier harte Hex-Werte ohne
 * dunkle Entsprechung — im dunklen Modus saß dunkelgraue Schrift auf beigem
 * Grund, und weiß auf #D97C46 kam bei 11 px auf 3,3:1.
 *
 * „Ausverkauft" und „knapp" sind BEDEUTUNGSFARBEN, nicht die Handlungsfarbe:
 * `accent` gehört dem Kaufknopf (§7: höchstens einmal je Seite), und der sitzt
 * auf derselben Karte — auf einem Raster stünde die CTA-Farbe sonst zwanzigmal.
 * Rot und Bernstein nach dem Beispiel aus §7, heller Wert plus `dark:`, und
 * dieselbe Familie wie die Marken in der Produktliste. Neutral bleibt der
 * Chip-Ton aus der Palette der Hofseite.
 */
const STREIFEN_FARBE: Record<ProduktZustand['art'], string> = {
  'nicht-im-shop': 'bg-[var(--app-chip)] text-[var(--app-chip-ink)]',
  ausverkauft: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100',
  knapp: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
  'im-shop': 'bg-[var(--app-chip)] text-[var(--app-chip-ink)]',
}

function StockStrip({ zustand }: { zustand: ProduktZustand }) {
  return (
    <div
      className={`absolute left-0 right-0 bottom-0 h-7 flex items-center justify-center gap-1.5 text-[11px] font-bold ${STREIFEN_FARBE[zustand.art]}`}
    >
      {zustand.art === 'nicht-im-shop' && <EyeOff className="size-3" strokeWidth={1.7} />}
      {streifenText(zustand)}
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

  const { isUploading, progress, openFilePicker, fileInput } = useImageUpload({
    variant: 'product',
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
    <div className="relative flex-shrink-0 group" style={{ height: 170, background: 'var(--app-chip)' }}>
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
            <Package className="w-10 h-10" style={{ color: 'var(--app-line-firm)' }} />
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

      {/* Streifen — immer volle Deckkraft, nur im Bearbeitungsmodus */}
      {isEditMode && <StockStrip zustand={produktZustand(product)} />}

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
            {isUploading
              ? progress
                ? stufenText(progress)
                : 'Lädt…'
              : (product.imageUrl ?? product.categoryImageUrl)
                ? 'Ersetzen'
                : 'Bild hinzufügen'}
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
          // Der Ziehgriff liegt auf dem Produktfoto, nicht auf der Karte:
          // weiße Marke mit dunkler Schrift, in beiden Modi gleich.
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
  onDetails,
  isAddingId,
  ownerMode = false,
  isEditMode = false,
  isPaused = false,
  setzeSichtbarkeit,
}: {
  product: PublicProduct
  onAddToCart: (product: PublicProduct) => void
  /** Öffnet das Produktdetail — nicht im Bearbeitungsmodus. */
  onDetails?: (product: PublicProduct) => void
  isAddingId: string | null
  ownerMode?: boolean
  isEditMode?: boolean
  isPaused?: boolean
  /** Vorgezogener Sichtbarkeitsstand im Eltern-Bauteil — nur im Bearbeitungsmodus. */
  setzeSichtbarkeit?: (imShop: boolean) => void
}) {
  const canBuy = zeigeKaufknopf(product, isPaused)
  const isAdding = isAddingId === product.id
  const zustand = produktZustand(product)
  const dim = isEditMode && !product.isAvailable ? 0.55 : 1
  // Futter: Kilopreis aus der Nettomenge (Bereiche 2) — Ballen und Big Bags
  // haben keine Gebindegröße und bekämen sonst gar keinen Grundpreis.
  const kilopreis = product.futter
    ? formatGrundpreisNetto(product.price, product.futter.nettoMenge, product.futter.nettoEinheit)
    : null

  const kopf = (
    <>
      <ProductImageArea product={product} dim={dim} isEditMode={isEditMode} />
      <div className="px-[15px] pt-[14px]" style={{ opacity: dim }}>
        <p className="font-semibold text-sm leading-snug" style={{ color: 'var(--app-ink)' }}>{product.name}</p>
        <p className="text-[17px] font-bold mt-[5px]" style={{ color: 'var(--app-ink)' }}>
          {formatGrundpreis(product.price, product.unit, product.unitSize)}
        </p>
        {kilopreis ? (
          <p className="mt-0.5 text-[12px]" style={{ color: 'var(--app-ink-soft)' }}>{kilopreis}</p>
        ) : (
          <GrundpreisZeile
            price={product.price}
            unit={product.unit}
            unitSize={product.unitSize}
            className="mt-0.5 text-[12px]"
            style={{ color: 'var(--app-ink-soft)' }}
          />
        )}
      </div>
    </>
  )

  return (
    <div
      className="bg-card rounded-[12px] overflow-hidden flex flex-col dark:ring-1 dark:ring-border"
      style={{ boxShadow: '0 2px 10px rgba(45,95,63,0.06)' }}
    >
      {/* Bild, Name und Preis öffnen das Produktdetail; der Kaufknopf
          darunter bleibt ein eigener Knopf. Im Bearbeitungsmodus liegt auf
          dem Bild der Foto-Knopf — dort gibt es kein Detail. */}
      {onDetails && !isEditMode ? (
        <button
          type="button"
          onClick={() => onDetails(product)}
          aria-label={`${product.name} — Details ansehen`}
          className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {kopf}
        </button>
      ) : (
        kopf
      )}

      {/* Body */}
      <div className="px-[15px] pb-[14px] flex flex-col flex-1">

        {/* Die Blässe sitzt NICHT mehr an der Hülle, sondern an den Teilen, die
            blass werden sollen: Deckkraft wirkt auf den ganzen Teilbaum, und der
            Schalter darunter muss voll deckend bleiben. Er ist das
            Bedienelement, das die Blässe erklärt — halb durchsichtig sähe er
            selbst abgeschaltet aus, und seine Schiene fiele unter den
            Mindestkontrast. */}
        <div className="flex flex-col flex-1" style={{ opacity: dim }}>

        {product.seasonStart && product.seasonEnd && (
          <div className="mt-2">
            <SeasonBadge start={product.seasonStart} end={product.seasonEnd} />
          </div>
        )}

        {product.allergens.length > 0 && (
          <p className="text-[10px] mt-2 leading-tight" style={{ color: 'var(--app-ink-faint)' }}>
            Enthält: {product.allergens.join(', ')}
          </p>
        )}

        <div className="flex-1" />
        </div>

        {/* Zwischen Preis und den Knöpfen — die ganze Zeile ist der Schalter. */}
        {isEditMode && setzeSichtbarkeit && (
          <div className="mt-3 border-t pt-1" style={{ borderColor: 'var(--border)' }}>
            <ImShopSchalter
              productId={product.id}
              name={product.name}
              imShop={product.isAvailable}
              setzeOptimistisch={setzeSichtbarkeit}
            />
            {/* Im Shop, aber nichts da: Der Schalter bleibt AN, und der Hof
                erfährt, was die Kundin stattdessen liest. */}
            {zustand.art === 'ausverkauft' && (
              // app-ink-soft, NICHT app-ink-faint: Letzteres kommt im hellen Modus
              // auf 2,7:1 gegen die Karte und reißt die 4,5:1 aus §7 — bei 11 px
              // erst recht.
              <p className="px-1 pb-1.5 text-[11px] leading-snug" style={{ color: 'var(--app-ink-soft)' }}>
                {'Bestand 0 — Kunden sehen \u201eAusverkauft\u201c'}
              </p>
            )}
          </div>
        )}

        {/* Footer — mode-aware */}
        <div className="mt-3 pt-2" style={{ opacity: dim }}>
          {isEditMode ? (
            <div className="flex gap-2">
              <Link
                href={`/products?edit=${product.id}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-[11px] rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-90"
                style={{ background: 'var(--app-button)', color: '#fff' }}
              >
                Bearbeiten
              </Link>
              <Link
                href="/products"
                className="flex-1 flex items-center justify-center gap-1.5 py-[11px] rounded-lg text-[13px] font-semibold border transition-colors hover:bg-muted"
                style={{ borderColor: 'var(--border)', color: 'var(--brand-text)', background: 'var(--card)' }}
              >
                Lager
              </Link>
            </div>
          ) : canBuy ? (
            <button
              onClick={() => onAddToCart(product)}
              disabled={isAdding}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60 hover:opacity-90 active:scale-[0.98]"
              style={{ background: 'var(--accent)', color: '#fff' }}
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
              style={{ background: 'color-mix(in srgb, var(--app-chip) 95%, transparent)', color: 'var(--app-chip-ink)' }}
            >
              {isPaused
                ? SHOP_PAUSED_BUTTON_LABEL
                : !product.isAvailable
                  ? product.unavailableReason || 'Nicht verfügbar'
                  : 'Ausverkauft'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Die Produkte der Kundenansicht: Umschalter „Hofladen | Futtermittel" (nur,
 * wenn der Hof in BEIDEN Bereichen anbietet), darunter Sektionen je Kategorie,
 * ab SPRUNGMARKEN_AB Produkten mit Sprungmarken. Was wohin gehört und in
 * welcher Reihenfolge, entscheidet teileHofseite (src/lib/bereiche-anzeige.ts);
 * Produkte des anderen Bereichs werden gar nicht erst gerendert.
 */
function HofseitenSektionen({
  products,
  bereichWunsch,
  onBereichWechsel,
  renderKarte,
}: {
  products: PublicProduct[]
  bereichWunsch: AnzeigeBereich | null
  onBereichWechsel: (bereich: AnzeigeBereich) => void
  renderKarte: (p: PublicProduct) => React.ReactNode
}) {
  const aufteilung = useMemo(() => teileHofseite(products, bereichWunsch), [products, bereichWunsch])
  if (aufteilung.aktiv === null) return null

  return (
    <>
      {aufteilung.umschalter && (
        <BereichUmschalter aktiv={aufteilung.aktiv} onWechsel={onBereichWechsel} className="mb-5" />
      )}

      {aufteilung.sprungmarken && (
        <nav aria-label="Zu einer Kategorie springen" className="-mx-1 mb-5 flex flex-wrap gap-2 px-1">
          {aufteilung.sektionen.map((s) => (
            <button
              key={s.anker}
              type="button"
              onClick={() => document.getElementById(s.anker)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="min-h-9 rounded-full border border-border bg-card px-3 text-[13px] font-medium text-app-ink transition-colors hover:bg-app-chip"
            >
              {s.titel}
              <span className="ml-1.5 tabular-nums text-app-ink-faint">{s.produkte.length}</span>
            </button>
          ))}
        </nav>
      )}

      <div className="space-y-8">
        {aufteilung.sektionen.map((s) => (
          <section key={s.anker} id={s.anker} aria-labelledby={`${s.anker}-titel`} className="scroll-mt-14">
            <h3 id={`${s.anker}-titel`} className="mb-3 font-heading text-lg font-semibold text-app-ink">
              {s.titel}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">{s.produkte.map((p) => renderKarte(p))}</div>
          </section>
        ))}
      </div>
    </>
  )
}

export function ProductGrid({
  products,
  farmId,
  farmSlug,
  hof,
  initialReorderItems,
  ownerMode = false,
  mode = 'preview',
  isPaused = false,
  onVorschau,
}: Props) {
  const isEditMode = ownerMode && mode !== 'preview'

  // Hofladen | Futtermittel (Bereiche 2): Die Wahl steht in der URL
  // (?bereich=futter), damit /hoefe direkt beim Futter landen kann und ein
  // Reload sie behält. Gewechselt wird per replaceState — die Seite wird
  // nicht neu geladen, andere Parameter (reorder-Token) bleiben stehen.
  const suchParameter = useSearchParams()
  const pfad = usePathname()
  const bereichWunsch: AnzeigeBereich | null =
    suchParameter.get('bereich') === null ? null : bereichAusParameter(suchParameter.get('bereich'))
  function bereichWechseln(neu: AnzeigeBereich) {
    const params = new URLSearchParams(suchParameter.toString())
    const wert = bereichParameter(neu)
    if (wert) params.set('bereich', wert)
    else params.delete('bereich')
    const query = params.toString()
    window.history.replaceState(null, '', query ? `${pfad}?${query}` : pfad)
  }
  const [detail, setDetail] = useState<PublicProduct | null>(null)
  const [detailOffen, setDetailOffen] = useState(false)
  function detailOeffnen(produkt: PublicProduct) {
    setDetail(produkt)
    setDetailOffen(true)
  }

  // Sprint 18: optimistische Sortier-Reihenfolge (null = Server-Stand)
  const [orderedIds, setOrderedIds] = useState<string[] | null>(null)
  const [, startReorderTransition] = useTransition()

  // Neuer Server-Stand (props) macht den optimistischen Zustand obsolet
  useEffect(() => {
    setOrderedIds(null)
  }, [products])

  // Sprint Sichtbarkeits-Schalter: der vorgezogene Sichtbarkeitsstand.
  //
  // Grundzustand ist ABSICHTLICH leer: Sobald die Transition durch ist, hat
  // revalidatePath neue Props geliefert, und die sind die Wahrheit. Der Eintrag
  // gilt nur solange die Aktion läuft — scheitert sie, fällt React von selbst
  // auf die Props zurück, ohne dass irgendwo ein Zurückschalten steht.
  const [vorgezogen, setzeVorgezogen] = useOptimistic<
    Record<string, boolean>,
    { id: string; imShop: boolean }
  >({}, (stand, aenderung) => ({ ...stand, [aenderung.id]: aenderung.imShop }))

  const sichtbareProdukte = useMemo(
    () =>
      products.map((p) => {
        const neu = vorgezogen[p.id]
        return neu === undefined ? p : { ...p, isAvailable: neu }
      }),
    [products, vorgezogen]
  )

  const displayProducts = useMemo(() => {
    if (!isEditMode || !orderedIds) return sichtbareProdukte
    const byId = new Map(sichtbareProdukte.map((p) => [p.id, p]))
    const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as PublicProduct[]
    return ordered.length === sichtbareProdukte.length ? ordered : sichtbareProdukte
  }, [sichtbareProdukte, orderedIds, isEditMode])

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
      // Aus dem Detail heraus: erst das Detail schließen, dann der Warenkorb —
      // zwei Sheets übereinander wären eines zu viel.
      setDetailOffen(false)
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
            style={{ background: 'color-mix(in srgb, var(--primary) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 16%, transparent)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--app-ink)' }}>
              Willkommen zurück! Dein letzter Einkauf wurde vorgeladen.
            </p>
            <button
              onClick={() => setShowWelcomeBack(false)}
              className="shrink-0 transition-colors"
              style={{ color: 'var(--app-ink-faint)' }}
              aria-label="Schließen"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Empty state (public) */}
      {!ownerMode && products.length === 0 && (
        <p className="text-sm pb-4" style={{ color: 'var(--app-ink-faint)' }}>
          Aktuell sind keine Produkte verfügbar.
        </p>
      )}

      {/* Kundenansicht (und Vorschau des Hofs): nach Bereich getrennt, darin
          nach Kategorie. Der Bearbeitungsmodus bleibt EINE flache, ziehbare
          Liste — die Reihenfolge dort bestimmt auch die der Sektionen. */}
      {!isEditMode ? (
        <HofseitenSektionen
          products={displayProducts}
          bereichWunsch={bereichWunsch}
          onBereichWechsel={bereichWechseln}
          renderKarte={(p) => (
            <ProductCard
              key={p.id}
              product={p}
              onAddToCart={handleAddToCart}
              onDetails={detailOeffnen}
              isAddingId={addingId}
              ownerMode={ownerMode}
              isEditMode={false}
              isPaused={isPaused}
            />
          )}
        />
      ) : (
      <>
      {/* Aus dem Hinweissatz ist ein Knopf geworden: Er beschreibt die
          Kundenansicht — dann soll er sie auch zeigen können, statt den Hof
          oben im Umschalter danach suchen zu lassen. Ohne Rückweg (öffentliche
          Hofseite) bleibt es ein Satz. */}
      {onVorschau ? (
        <button
          type="button"
          onClick={onVorschau}
          className="mb-4 flex min-h-11 w-full items-center gap-1.5 rounded-lg px-1 text-left text-sm transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={{ color: 'var(--app-ink-soft)' }}
        >
          <span>
            Kunden sehen deine Produkte getrennt nach Hofladen und Futter.{' '}
            <span className="font-semibold whitespace-nowrap" style={{ color: 'var(--brand-text)' }}>
              Ansehen →
            </span>
          </span>
        </button>
      ) : (
        <p className="mb-4 text-sm" style={{ color: 'var(--app-ink-soft)' }}>
          Kunden sehen deine Produkte getrennt nach Hofladen und Futter.
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
            className="flex flex-col items-center justify-center rounded-[12px] transition-colors hover:bg-card/70"
            style={{
              border: '2px dashed var(--app-line-firm)',
              background: 'color-mix(in srgb, var(--card) 50%, transparent)',
              minHeight: 330,
            }}
          >
            <span
              className="flex items-center justify-center rounded-full mb-3"
              style={{ width: 52, height: 52, background: 'var(--app-chip-green)', color: 'var(--brand-text)' }}
            >
              <Plus className="size-[22px]" strokeWidth={1.9} />
            </span>
            <span className="text-[15px] font-semibold" style={{ color: 'var(--brand-text)' }}>Produkt anlegen</span>
            <span className="text-[13px] mt-1" style={{ color: 'var(--app-ink-faint)' }}>Foto, Preis, Menge</span>
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
                isPaused={isPaused}
                setzeSichtbarkeit={(imShop) => setzeVorgezogen({ id: p.id, imShop })}
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
              isPaused={isPaused}
              setzeSichtbarkeit={(imShop) => setzeVorgezogen({ id: p.id, imShop })}
            />
          )
        )}
      </div>
      </ReorderContext>
      </>
      )}

      {/* EIN Produktdetail und EIN Warenkorb für beide Bereiche. */}
      {!isEditMode && (
        <ProduktDetail
          produkt={detail}
          hof={hof}
          offen={detailOffen}
          onOpenChange={setDetailOffen}
          onAddToCart={handleAddToCart}
          wirdHinzugefuegt={detail !== null && addingId === detail.id}
          isPaused={isPaused}
        />
      )}

      {/* Sticky cart button (not in edit mode) */}
      {!isEditMode && isHydrated && count > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 inset-x-4 sm:inset-x-auto sm:right-6 sm:left-auto z-40 flex items-center justify-center gap-2.5 rounded-full px-6 py-3.5 transition-all duration-[250ms] active:scale-[0.98]"
          style={{
            background: 'var(--accent)',
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
