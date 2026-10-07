'use client'

import { useState, useEffect, useMemo, useOptimistic, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ShoppingCart, ShoppingBasket, Leaf, Thermometer, Snowflake, Package, X, Plus, EyeOff, Camera, Loader2, GripVertical, ChevronRight, Sprout } from 'lucide-react'
import { toast } from 'sonner'
import { useCart } from '@/lib/use-cart'
import { WARENKORB_ANKER } from '@/lib/warenkorb-speicher'
import { MONTH_SHORT, seasonLabel } from '@/schemas/product'
import { formatEuro, formatGrundpreis, formatGrundpreisNetto, mitAnzahl } from '@/lib/format'
import { GrundpreisZeile } from '@/components/shared/grundpreis-zeile'
import { SHOP_PAUSED_BUTTON_LABEL } from '@/lib/shop-pause'
import { VORSCHAU_KAUF_HINWEIS, korbErlaubt } from '@/lib/hofseite-vorschau'
import { produktZustand, streifenText, type ProduktZustand } from '@/lib/produkt-sichtbarkeit'
import { ImShopSchalter } from '@/components/products/im-shop-schalter'
import { kartenZustand, kategorieAbschnitte, zeigeKaufknopf } from '@/lib/bereiche-anzeige'
import { mengeAbgelehntText, oeffnetKorbHier, uebersichtProdukte } from '@/lib/hofseite-kunde'
import { bereichAusParameter } from '@/schemas/hoefe-filter'
import type { AnzeigeBereich } from '@/lib/taxonomie'
import type { PublicProduct } from '@/server/queries/farm'
import { updateProductImageAction, reorderProductsAction } from '@/server/actions/products'
import { ReorderContext } from '@/components/shared/reorder-context'
import { stufenText, useImageUpload } from '@/components/shared/image-upload'
import { CartSheet } from './cart-sheet'
import { futterVerantwortungImKorb } from '@/lib/futter-registrierung'
import { produktPfad } from '@/lib/produktdetail'
import { ProduktKarte } from '@/components/hofseite/produkt-karte'
import { ProduktAbschnitte } from '@/components/hofseite/produkt-abschnitte'
import { EmptyState } from '@/components/ui/empty-state'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

type ReorderItem = { productId: string; productName: string; quantity: number }

type Props = {
  products: PublicProduct[]
  farmId: string
  farmSlug: string
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
  /**
   * Ob Kaufen wirkt — entschieden von `ansichtsModus` (src/lib/ansichts-modus.ts).
   * In der Vorschau des Hofs (?vorschau=1) nicht: kein Korb, keine
   * Reservierung, nur der Hinweis. Ohne Angabe wirkt es.
   */
  kaufen?: boolean
  /**
   * Kundenansicht (Nr. 10): welcher Teil der Produkte im offenen Reiter steht
   * — die Auswahl der Übersicht, alle Abschnitte im Reiter Produkte oder
   * keiner (Beiträge). Das Raster bleibt in jedem Reiter eingehängt: Korb
   * und Nachbestell-Link leben hier und überstehen den Wechsel.
   */
  teil?: 'auswahl' | 'alle' | 'keins'
  /** „Preise zzgl. 5 % Servicegebühr … einmal pro Bestellung" über den Abschnitten — null ohne Gebühr. */
  gebuehrHinweis?: string | null
  /** „+ Gebühr" an der Korb-Leiste und im Korb — null ohne Gebühr. */
  gebuehrKorb?: string | null
  /** Abschnitt, zu dem der Reiter Produkte beim Öffnen springt (?bereich=futter). */
  springeZu?: string | null
  onGesprungen?: () => void
  /**
   * Wohin Bild und Name einer Produktkarte führen (Nr. 11: die Produktseite;
   * in der Vorschau des Hofs die Vorschau davon). Ohne Angabe die Produktseite.
   */
  produktLink?: (id: string) => string
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
 * FARBEN AUS TOKENS (CODING_STANDARDS §7). Vorher standen hier vier harte
 * Hex-Werte ohne dunkle Entsprechung — im dunklen Modus saß dunkelgraue Schrift
 * auf beigem Grund. „Nicht im Shop" nimmt den ruhigen Chip-Ton, „Ausverkauft"
 * und „knapp" die Handlungsfarbe, weil sie den Hof etwas tun lassen wollen.
 */
function StockStrip({ zustand }: { zustand: ProduktZustand }) {
  const warnung = zustand.art === 'ausverkauft' || zustand.art === 'knapp'
  return (
    <div
      className="absolute left-0 right-0 bottom-0 h-7 flex items-center justify-center gap-1.5 text-[11px] font-bold"
      style={
        warnung
          ? { background: 'var(--accent)', color: 'var(--accent-foreground)' }
          : { background: 'var(--app-chip)', color: 'var(--app-chip-ink)' }
      }
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
            // Nur die Kategorie-Illustration wird im Dunkeln gedämpft, sonst
            // leuchtet ihr Crème-Grund als Fläche; Fotos bleiben, wie sie sind
            // (CODING_STANDARDS §7, Altlast aus ARCHITECTURE §6 beim Anfassen
            // nachgezogen — Werte wie in components/produkte/produkte-ansicht.tsx).
            className={cn(
              'object-contain',
              !product.imageUrl && 'dark:brightness-[0.85] dark:saturate-[0.9]'
            )}
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
        {/* Höchstens zwei Zeilen: Ein langer Name schöbe sonst Preis und
            Kaufknopf aus der Flucht der Nachbarkarten. Voller Name im title. */}
        <p
          className="line-clamp-2 font-semibold text-sm leading-snug break-words"
          style={{ color: 'var(--app-ink)' }}
          title={product.name}
        >
          {product.name}
        </p>
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
              <p className="px-1 pb-1.5 text-[11px] leading-snug" style={{ color: 'var(--app-ink-faint)' }}>
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
 * Der gewünschte Bereich aus der URL (?bereich=futter) — null, wenn keiner
 * gewählt ist. Welcher dann wirklich angezeigt wird, entscheidet
 * teileHofseite; die Kopfzeile der Hofseite fragt dieselbe Stelle, damit ihr
 * Rückweg in den angezeigten Bereich führt (farm-page-view.tsx).
 */
export function useBereichWunsch(): AnzeigeBereich | null {
  const wert = useSearchParams().get('bereich')
  return wert === null ? null : bereichAusParameter(wert)
}

export function ProductGrid({
  products,
  farmId,
  farmSlug,
  initialReorderItems,
  ownerMode = false,
  mode = 'preview',
  isPaused = false,
  onVorschau,
  kaufen = true,
  teil = 'alle',
  gebuehrHinweis = null,
  gebuehrKorb = null,
  springeZu = null,
  onGesprungen,
  produktLink = (id) => produktPfad(farmSlug, id),
}: Props) {
  const isEditMode = ownerMode && mode !== 'preview'
  // EINE Regel für jeden Weg in den Korb (Kaufknopf, Nachbestell-Link,
  // #warenkorb-Anker, Korb-Knopf, Sheet) — src/lib/hofseite-vorschau.ts.
  const mitKorb = korbErlaubt({ isEditMode, kaufen })

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

  const { items, count, total, isHydrated, addItem, updateQuantity, removeItem } = useCart(farmId, farmSlug)

  // Das Warenkorb-Symbol der Kopfzeile führt mit #warenkorb hierher: den
  // Korb gleich öffnen. Der Anker ist ein einmaliger Auftrag — weg damit,
  // sonst öffnete Neuladen oder Zurück den Korb wieder. Geöffnet wird nach
  // dem ersten Bild: Das Sheet gleitet sichtbar herein, statt beim Laden
  // schon offen dazustehen.
  useEffect(() => {
    if (!mitKorb || !isHydrated) return
    if (window.location.hash !== `#${WARENKORB_ANKER}`) return
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    if (count > 0) requestAnimationFrame(() => setCartOpen(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated])

  // Den Korb aus dem Nachbestell-Link füllen — nur, wo es einen Korb gibt.
  useEffect(() => {
    if (!mitKorb) return
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
    // Vorschau des Hofs: kein Korb, keine Reservierung — nur der Hinweis,
    // und zwar VOR dem ersten Griff in den Korb.
    if (!mitKorb) {
      toast.info(VORSCHAU_KAUF_HINWEIS)
      return
    }
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

  // Der Warenkorb der Shell (Kopf, Mittelknopf am Handy) zeigt auf
  // /{hof}#warenkorb. Steht man schon auf dieser Hofseite, lädt der Link
  // nichts neu und der Anker allein öffnete nichts — dann öffnet die Seite
  // den Korb selbst (oeffnetKorbHier). Abgefangen in der Einfangphase, vor
  // Nexts Link; Mittelklick und neuer Tab bleiben dem Link.
  useEffect(() => {
    if (!mitKorb) return
    function beiKlick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const link = e.target instanceof Element ? e.target.closest('a[href]') : null
      const href = link?.getAttribute('href')
      if (!href || !oeffnetKorbHier(href, window.location.href)) return
      e.preventDefault()
      setCartOpen(true)
    }
    document.addEventListener('click', beiKlick, true)
    return () => document.removeEventListener('click', beiKlick, true)
  }, [mitKorb])

  /** Menge eines Produkts im Korb — in der Vorschau gibt es keinen Korb, also nie eine. */
  function imKorb(produktId: string): number {
    if (!mitKorb) return 0
    return items.find((i) => i.productId === produktId)?.quantity ?? 0
  }

  function mengeAendern(produkt: PublicProduct, menge: number) {
    if (!mitKorb) {
      toast.info(VORSCHAU_KAUF_HINWEIS)
      return
    }
    // Lehnt die Reservierung ab (jemand war schneller), sagt die Karte es —
    // die Menge bleibt dann, wie sie war.
    void updateQuantity(produkt.id, menge).then((ergebnis) => {
      if (!ergebnis.ok) toast.error(mengeAbgelehntText(ergebnis.error))
    })
  }

  function karte(p: PublicProduct) {
    return (
      <ProduktKarte
        produkt={p}
        zustand={kartenZustand(p, isPaused)}
        imKorb={imKorb(p.id)}
        wirdHinzugefuegt={addingId === p.id}
        href={produktLink(p.id)}
        onInDenKorb={handleAddToCart}
        onMenge={mengeAendern}
      />
    )
  }

  const korbLeiste = mitKorb && isHydrated && count > 0

  return (
    <>
      {/* Willkommen-zurück-Hinweis — nur, wo es einen Korb gibt (der Nachbestell-Effekt setzt ihn ohnehin nur dann). */}
      {mitKorb && showWelcomeBack && (
        <div className="relative mb-4 rounded-2xl border border-accent/45 bg-accent/12 py-2 pr-12 pl-4 text-[13.5px] font-medium text-foreground">
          <p className="flex min-h-9 items-center">Willkommen zurück! Dein letzter Einkauf liegt wieder im Korb.</p>
          <button
            type="button"
            onClick={() => setShowWelcomeBack(false)}
            className={cn('absolute top-1 right-1 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground', FOKUS_RAHMEN)}
            aria-label="Schließen"
          >
            <X className="size-4" strokeWidth={1.7} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Kundenansicht (und Vorschau des Hofs): Abschnitte je Kategorie (E1)
          bzw. die Auswahl der Übersicht. Der Bearbeitungsmodus bleibt EINE
          flache, ziehbare Liste — ihre Reihenfolge bestimmt auch die der
          Abschnitte. */}
      {!isEditMode ? (
        teil === 'keins' ? null : products.length === 0 ? (
          // Leer, mit Ausweg (DESIGN_SYSTEM, „Zustände").
          <EmptyState
            symbol={Sprout}
            titel="Gerade keine Produkte"
            satz="Dieser Hof hat im Moment nichts im Angebot. Schau bald wieder vorbei – oder such dir einen anderen Hof in der Nähe."
            aktion={
              <Link
                href="/hoefe"
                className={cn('inline-flex min-h-11 items-center rounded-full border border-border px-4 text-[14px] font-semibold text-foreground hover:bg-muted', FOKUS_RAHMEN)}
              >
                Andere Höfe entdecken
              </Link>
            }
          />
        ) : teil === 'auswahl' ? (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {uebersichtProdukte(displayProducts, isPaused).map((p) => (
              <li key={p.id}>{karte(p)}</li>
            ))}
          </ul>
        ) : (
          <ProduktAbschnitte
            abschnitte={kategorieAbschnitte(displayProducts)}
            gebuehrHinweis={gebuehrHinweis}
            springeZu={springeZu}
            onGesprungen={onGesprungen}
            renderKarte={karte}
          />
        )
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
            Kunden sehen deine Produkte nach Kategorien geordnet.{' '}
            <span className="font-semibold whitespace-nowrap" style={{ color: 'var(--brand-text)' }}>
              Ansehen →
            </span>
          </span>
        </button>
      ) : (
        <p className="mb-4 text-sm" style={{ color: 'var(--app-ink-soft)' }}>
          Kunden sehen deine Produkte nach Kategorien geordnet.
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

      {/* Die Korb-Leiste — nicht im Bearbeitungsmodus, nicht in der Vorschau.
          Am Handy über der Unterleiste der Shell (68 px + Home-Balken), bis
          1024 px unten rechts; ab 1024 px trägt der Mini-Warenkorb der
          rechten Spalte den Korb (hofseite-seitenspalte.tsx). */}
      {mitKorb && isHydrated && count > 0 && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className={cn(
            'fixed inset-x-4 bottom-[calc(68px+env(safe-area-inset-bottom,0px)+1.75rem)] z-40 flex min-h-12 items-center gap-2.5 rounded-2xl bg-accent px-4 py-3 text-accent-foreground shadow-lg transition-transform duration-[250ms] active:scale-[0.98] md:inset-x-auto md:right-6 md:bottom-6 md:rounded-full md:px-5 lg:hidden',
            FOKUS_RAHMEN
          )}
        >
          <ShoppingBasket className="size-5 shrink-0" strokeWidth={1.7} aria-hidden="true" />
          <span className="min-w-0 truncate text-[13px] font-semibold">
            {mitAnzahl(count, 'Artikel', 'Artikel')} · {formatEuro(total)}
            {gebuehrKorb && <span className="font-normal"> + Gebühr</span>}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-0.5 text-[13px] font-semibold">
            Zum Warenkorb
            <ChevronRight className="size-4" strokeWidth={1.7} aria-hidden="true" />
          </span>
        </button>
      )}
      {/* Platz unter dem Inhalt, damit die Leiste das letzte Produkt nicht verdeckt. */}
      {korbLeiste && <div aria-hidden="true" className="h-24 lg:hidden" />}

      {/* Cart sheet — in der Vorschau des Hofs gibt es keinen Korb. */}
      {mitKorb && (
        <CartSheet
          open={cartOpen}
          onOpenChange={setCartOpen}
          items={items}
          total={total}
          farmSlug={farmSlug}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeItem}
          gebuehrKorb={gebuehrKorb}
          futterHinweis={futterVerantwortungImKorb(items, products)}
        />
      )}
    </>
  )
}
