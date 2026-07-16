'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  MapPin, Phone, Mail, CreditCard, Banknote,
  Pencil, Eye, Leaf, CalendarDays, Tag, MessageCircle,
  Check, Camera, Plus, ChevronLeft, ChevronRight, X, MoveVertical,
} from 'lucide-react'
import { toast } from 'sonner'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { PublicFarm, PublicFarmPhoto } from '@/server/queries/farm'
import type { ActiveStatusPost } from '@/server/queries/status-posts'
import { updateFarmBannerAction, updateBannerFocusAction } from '@/server/actions/appearance'
import { addFarmPhotoAction, reorderPhotosAction } from '@/server/actions/farm-photos'
import { ReorderContext } from '@/components/shared/reorder-context'
import { useImageUpload } from '@/components/shared/image-upload'
import { ProductGrid } from './product-grid'
import { stripStatusVariables, renderStatusBodyWithChip } from '@/lib/status-body'

const BANNER_GRADIENTS: Record<string, string> = {
  tannengruen: 'linear-gradient(135deg, #1F4732 0%, #3D7B58 60%, #E8F0E8 100%)',
  wiese:       'linear-gradient(135deg, #2D6A4F 0%, #52B788 50%, #D8F3DC 100%)',
  erde:        'linear-gradient(135deg, #6B4226 0%, #A0663E 55%, #F5E6D8 100%)',
  herbst:      'linear-gradient(135deg, #7B4F00 0%, #D4900A 55%, #FFF3CC 100%)',
}

const ANLASS_META: Record<string, { label: string; icon: ReactNode }> = {
  FRESH_PRODUCT: { label: 'Frisches Produkt', icon: <Leaf className="size-3" strokeWidth={1.7} /> },
  NEW_SEASON:    { label: 'Neue Saison',       icon: <CalendarDays className="size-3" strokeWidth={1.7} /> },
  PROMOTION:     { label: 'Aktion',            icon: <Tag className="size-3" strokeWidth={1.7} /> },
  ANNOUNCEMENT:  { label: 'Mitteilung',        icon: <MessageCircle className="size-3" strokeWidth={1.7} /> },
}

function WoodCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white rounded-[14px] overflow-hidden ${className}`}
      style={{ boxShadow: '0 2px 10px rgba(45,95,63,0.06)' }}
    >
      <div style={{ height: 7, background: 'linear-gradient(90deg,#B08054,#8B6247 35%,#A87C52 70%,#8F6A48)' }} />
      {children}
    </div>
  )
}

function FarmSeal({ farmName, foundedYear }: { farmName: string; foundedYear: number }) {
  const upper = farmName.toUpperCase()
  if (upper.length > 18) return null
  const fontSize = upper.length <= 10 ? 9 : upper.length <= 15 ? 7.5 : 6.5
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r="42" fill="#F3EBDA" />
      <circle cx="44" cy="44" r="42" fill="none" stroke="#8B6B4F" strokeWidth="2.5" />
      <circle cx="44" cy="44" r="34" fill="none" stroke="#8B6B4F" strokeWidth="1" strokeDasharray="3 3" />
      <defs>
        <path id="sealArcFpv" d="M 16 44 a 28 28 0 0 1 56 0" fill="none" />
      </defs>
      <text fontSize={fontSize} fill="#7A5C3E" fontFamily="Inter, sans-serif" fontWeight="700" letterSpacing="2.5">
        <textPath href="#sealArcFpv" startOffset="50%" textAnchor="middle">{upper}</textPath>
      </text>
      <g fill="none" stroke="#7A5C3E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M44 58V42" />
        <path d="M44 50c-4-1-6.5-3.5-7-8 4.5.5 7 3 7 8z" />
        <path d="M44 50c4-1 6.5-3.5 7-8-4.5.5-7 3-7 8z" />
        <path d="M44 42c-3.5-1-5.5-3-6-7 4 .5 6 2.8 6 7z" />
        <path d="M44 42c3.5-1 5.5-3 6-7-4 .5-6 2.8-6 7z" />
      </g>
      <text x="44" y="70" fontSize="7.5" fill="#7A5C3E" fontFamily="Inter, sans-serif" fontWeight="700" letterSpacing="1.5" textAnchor="middle">
        SEIT {foundedYear}
      </text>
    </svg>
  )
}

// ── Gallery ───────────────────────────────────────────────────────────────────

const GALLERY_MAX_VISIBLE = 7

// Sortierbare Galerie-Kachel (nur Edit-Modus): ganze Kachel ziehbar (Airbnb-Muster)
function SortableGalleryTile({
  photo,
  isFirst,
  onClick,
  children,
}: {
  photo: PublicFarmPhoto
  isFirst: boolean
  onClick: () => void
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: photo.id })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="relative cursor-grab active:cursor-grabbing rounded-[10px] overflow-hidden"
      style={{
        gridColumn: isFirst ? 'span 2' : undefined,
        gridRow: isFirst ? 'span 2' : undefined,
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: 'manipulation',
        zIndex: isDragging ? 30 : undefined,
        boxShadow: isDragging ? '0 14px 32px rgba(45,95,63,0.30)' : undefined,
      }}
    >
      {children}
    </div>
  )
}

function GallerySection({
  farm,
  isEdit,
  onPhotoAdded,
}: {
  farm: PublicFarm
  isEdit: boolean
  onPhotoAdded: () => void
}) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()

  // Sprint 18: optimistische Foto-Reihenfolge (null = Server-Stand)
  const [photoOrder, setPhotoOrder] = useState<string[] | null>(null)
  useEffect(() => {
    setPhotoOrder(null)
  }, [farm.farmPhotos])

  const photos = useMemo(() => {
    if (!isEdit || !photoOrder) return farm.farmPhotos
    const byId = new Map(farm.farmPhotos.map((p) => [p.id, p]))
    const ordered = photoOrder.map((id) => byId.get(id)).filter(Boolean) as PublicFarmPhoto[]
    return ordered.length === farm.farmPhotos.length ? ordered : farm.farmPhotos
  }, [farm.farmPhotos, photoOrder, isEdit])

  function handlePhotoDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const current = photos.map((p) => p.id)
    const next = arrayMove(current, current.indexOf(String(active.id)), current.indexOf(String(over.id)))
    setPhotoOrder(next)
    startTransition(async () => {
      const result = await reorderPhotosAction(next)
      if (result.error) {
        toast.error(result.error)
        setPhotoOrder(null) // Revert auf Server-Stand
      }
    })
  }

  const canUpload = isEdit && photos.length < 8

  const { isUploading, openFilePicker, fileInput } = useImageUpload({
    variant: 'gallery',
    onUploaded: (url) => {
      startTransition(async () => {
        const result = await addFarmPhotoAction({ url })
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Foto hinzugefügt')
          router.refresh()
          onPhotoAdded()
        }
      })
    },
  })

  const visiblePhotos = photos.slice(0, GALLERY_MAX_VISIBLE)
  const hiddenCount = Math.max(0, photos.length - GALLERY_MAX_VISIBLE)

  function prev() {
    if (lightboxIdx === null || photos.length === 0) return
    setLightboxIdx((lightboxIdx - 1 + photos.length) % photos.length)
  }
  function next() {
    if (lightboxIdx === null || photos.length === 0) return
    setLightboxIdx((lightboxIdx + 1) % photos.length)
  }

  return (
    <>
      {fileInput}

      {/* Heading row */}
      <div className="flex items-baseline gap-3 mb-[14px]">
        <h2 className="font-heading font-semibold" style={{ fontFamily: 'Fraunces, serif', fontSize: 23, color: '#2D3027' }}>
          Fotos vom Hof
        </h2>
        <span className="text-[13px]" style={{ color: '#9AA08F' }}>
          {photos.length} {photos.length === 1 ? 'Foto' : 'Fotos'}
        </span>
        {isEdit && (
          <button
            type="button"
            onClick={openFilePicker}
            disabled={isUploading || !canUpload}
            className="ml-auto flex items-center gap-1.5 rounded-lg text-[13px] font-semibold disabled:opacity-60 hover:bg-gray-50 transition-colors"
            style={{
              border: '1px solid #D6E0CE',
              background: '#fff',
              borderRadius: 8,
              padding: '9px 15px',
              color: '#2D5F3F',
            }}
          >
            <Plus className="size-3.5" strokeWidth={1.9} />
            Fotos hinzufügen
          </button>
        )}
      </div>

      {/* Grid — im Edit-Modus sortierbar (Airbnb-Muster) */}
      <ReorderContext
        enabled={isEdit}
        items={visiblePhotos.map((p) => p.id)}
        onDragEnd={handlePhotoDragEnd}
      >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 [grid-auto-rows:150px]">
        {visiblePhotos.map((photo, i) => {
          const isFirst = i === 0
          const isLast = i === visiblePhotos.length - 1
          const showOverlay = isLast && hiddenCount > 0

          const tileContent = (
            <>
              <Image
                src={photo.url}
                alt={photo.caption ?? ''}
                fill
                sizes={isFirst ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 768px) 25vw, 50vw'}
                className="object-cover"
              />
              {/* Aufmacher-Badge auf dem ersten Foto (nur Edit-Modus) */}
              {isFirst && isEdit && (
                <span
                  className="absolute top-[10px] left-[10px] text-white pointer-events-none"
                  style={{
                    background: 'rgba(45,48,39,0.85)',
                    borderRadius: 14,
                    padding: '4px 11px',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  Aufmacher
                </span>
              )}
              {/* Caption pill on first photo */}
              {isFirst && photo.caption && (
                <div
                  className="absolute bottom-[10px] left-[10px] text-white"
                  style={{
                    background: 'rgba(45,48,39,0.75)',
                    borderRadius: 14,
                    padding: '4px 11px',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {photo.caption}
                </div>
              )}
              {/* "+N Fotos" overlay on last visible */}
              {showOverlay && (
                <div
                  className="absolute inset-0 flex items-center justify-center text-white"
                  style={{ background: 'rgba(45,48,39,0.55)', borderRadius: 10 }}
                >
                  <span style={{ fontSize: 15, fontWeight: 700 }}>+{hiddenCount} Fotos</span>
                </div>
              )}
            </>
          )

          return isEdit ? (
            <SortableGalleryTile
              key={photo.id}
              photo={photo}
              isFirst={isFirst}
              onClick={() => setLightboxIdx(i)}
            >
              {tileContent}
            </SortableGalleryTile>
          ) : (
            <div
              key={photo.id}
              className="relative cursor-pointer rounded-[10px] overflow-hidden"
              style={{
                gridColumn: isFirst ? 'span 2' : undefined,
                gridRow: isFirst ? 'span 2' : undefined,
              }}
              onClick={() => setLightboxIdx(i)}
            >
              {tileContent}
            </div>
          )
        })}

        {/* Dashed "add" tile in edit mode */}
        {isEdit && canUpload && (
          <button
            type="button"
            onClick={openFilePicker}
            disabled={isUploading}
            className="flex flex-col items-center justify-center rounded-[10px] gap-2 hover:bg-white/60 transition-colors disabled:opacity-60"
            style={{
              border: '2px dashed #C9C2B2',
              background: 'rgba(255,255,255,0.5)',
            }}
          >
            <span
              className="flex items-center justify-center rounded-full"
              style={{ width: 36, height: 36, background: '#E8F0E2', color: '#2D5F3F' }}
            >
              <Plus className="size-4" strokeWidth={1.9} />
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#2D5F3F' }}>
              {isUploading ? 'Lädt…' : 'Foto hinzufügen'}
            </span>
          </button>
        )}
      </div>
      </ReorderContext>

      {/* Lightbox */}
      {lightboxIdx !== null && photos.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.88)' }}
          onClick={() => setLightboxIdx(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
            onClick={() => setLightboxIdx(null)}
            aria-label="Schließen"
          >
            <X className="size-5" />
          </button>

          {photos.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
                onClick={(e) => { e.stopPropagation(); prev() }}
                aria-label="Zurück"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
                onClick={(e) => { e.stopPropagation(); next() }}
                aria-label="Weiter"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}

          <div
            className="relative max-w-3xl max-h-[80vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full" style={{ paddingBottom: '66%' }}>
              <Image
                src={photos[lightboxIdx].url}
                alt={photos[lightboxIdx].caption ?? ''}
                fill
                sizes="(min-width: 768px) 768px, 100vw"
                className="object-contain rounded-xl"
              />
            </div>
            {photos[lightboxIdx].caption && (
              <p className="text-center text-white/80 text-sm mt-3">
                {photos[lightboxIdx].caption}
              </p>
            )}
            <p className="text-center text-white/40 text-xs mt-1">
              {lightboxIdx + 1} / {photos.length}
            </p>
          </div>
        </div>
      )}
    </>
  )
}

// ── Cover upload hook ─────────────────────────────────────────────────────────

function CoverEditButton({ currentBannerUrl }: { currentBannerUrl: string | null }) {
  const [, startTransition] = useTransition()
  const router = useRouter()

  const { isUploading, openFilePicker, fileInput } = useImageUpload({
    variant: 'banner',
    oldUrl: currentBannerUrl ?? undefined,
    onUploaded: (url) => {
      startTransition(async () => {
        const result = await updateFarmBannerAction('PHOTO', url)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Titelbild aktualisiert')
          router.refresh()
        }
      })
    },
  })

  return (
    <>
      {fileInput}
      <button
        type="button"
        onClick={openFilePicker}
        disabled={isUploading}
        className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: 'rgba(255,255,255,0.94)', color: '#2D5F3F', boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}
      >
        <Camera className="size-3.5" strokeWidth={1.7} />
        {isUploading ? 'Lädt…' : 'Titelbild ersetzen'}
      </button>
    </>
  )
}

// ── Titelbild-Fokuspunkt: Anpass-Zustand (Drag mit Maus & Touch) ──────────────

function CoverFocusAdjust({
  focusY,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  focusY: number
  onChange: (v: number) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  const drag = useRef<{ startY: number; startFocus: number; height: number } | null>(null)

  return (
    <>
      {/* Drag-Fläche über dem ganzen Cover */}
      <div
        className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => {
          drag.current = {
            startY: e.clientY,
            startFocus: focusY,
            height: e.currentTarget.getBoundingClientRect().height,
          }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const s = drag.current
          if (!s) return
          const dy = e.clientY - s.startY
          onChange(Math.min(100, Math.max(0, Math.round(s.startFocus - (dy / s.height) * 100))))
        }}
        onPointerUp={() => { drag.current = null }}
        onPointerCancel={() => { drag.current = null }}
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            className="flex items-center gap-1.5 rounded-full text-xs font-semibold text-white px-3.5 py-2"
            style={{ background: 'rgba(45,48,39,0.85)' }}
          >
            <MoveVertical className="size-3.5" strokeWidth={1.7} />
            Bild ziehen, um den Ausschnitt zu wählen
          </span>
        </div>
      </div>
      {/* Speichern / Abbrechen */}
      <div className="absolute top-3.5 right-[22px] z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: 'rgba(255,255,255,0.94)', color: '#5C6052', boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: 'rgba(45,48,39,0.85)', boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}
        >
          <Check className="size-3.5" strokeWidth={1.7} />
          {saving ? 'Speichert…' : 'Speichern'}
        </button>
      </div>
    </>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

type ReorderItem = { productId: string; productName: string; quantity: number }

type Props = {
  farm: PublicFarm
  activeStatus: ActiveStatusPost | null
  reorderItems?: ReorderItem[]
  ownerMode?: boolean
  mode?: 'edit' | 'preview'
}

export function FarmPageView({ farm, activeStatus, reorderItems, ownerMode = false, mode = 'edit' }: Props) {
  const isEdit = ownerMode && mode !== 'preview'
  const [galleryKey, setGalleryKey] = useState(0)

  // Titelbild-Fokuspunkt: null = kein Anpass-Zustand, sonst Live-Entwurf (0–100)
  const [focusDraft, setFocusDraft] = useState<number | null>(null)
  const [savingFocus, startFocusTransition] = useTransition()
  const focusRouter = useRouter()
  const adjustingFocus = focusDraft !== null
  const effectiveFocusY = focusDraft ?? farm.bannerFocusY

  function saveFocus() {
    const value = focusDraft
    if (value === null) return
    startFocusTransition(async () => {
      const result = await updateBannerFocusAction(value)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Bildausschnitt gespeichert')
        focusRouter.refresh()
      }
      setFocusDraft(null)
    })
  }

  const sections = farm.sectionsConfig
  function isSectionVisible(key: string) {
    const s = sections.find((s) => s.key === key)
    return s ? s.visible : true
  }

  if (!ownerMode) {
    if (farm.isPaused) {
      return (
        <main
          className="min-h-screen flex items-center justify-center p-6"
          style={{ background: 'linear-gradient(160deg, #F4EFE6 0%, #E8F0E8 100%)' }}
        >
          <div
            className="text-center max-w-sm bg-white rounded-3xl p-10"
            style={{ boxShadow: '0 8px 24px rgba(45,95,63,0.08)' }}
          >
            <div className="text-5xl mb-5">🏡</div>
            <h1 className="font-heading text-xl font-semibold mb-3" style={{ color: '#2D3027' }}>{farm.name}</h1>
            <p className="leading-relaxed text-sm" style={{ color: '#5C6052' }}>
              {farm.pauseMessage ?? 'Der Hof ist gerade nicht erreichbar. Bitte versuche es etwas später noch einmal.'}
            </p>
            <a
              href={`tel:${farm.phone}`}
              className="mt-6 inline-flex items-center gap-1.5 text-sm hover:underline underline-offset-2"
              style={{ color: '#2D5F3F' }}
            >
              <Phone className="w-3.5 h-3.5" strokeWidth={1.7} />
              {farm.phone}
            </a>
          </div>
        </main>
      )
    }
    if (farm.products.length === 0 && farm.pickupSlots.length === 0) {
      return (
        <main
          className="min-h-screen flex items-center justify-center p-6"
          style={{ background: 'linear-gradient(160deg, #F4EFE6 0%, #E8F0E8 100%)' }}
        >
          <div
            className="text-center max-w-sm bg-white rounded-3xl p-10"
            style={{ boxShadow: '0 8px 24px rgba(45,95,63,0.08)' }}
          >
            <div className="text-5xl mb-5">🌱</div>
            <h1 className="font-heading text-xl font-semibold mb-3" style={{ color: '#2D3027' }}>{farm.name}</h1>
            <p className="leading-relaxed text-sm" style={{ color: '#5C6052' }}>
              Dieser Hof richtet gerade seinen Shop ein. Schau bald wieder vorbei!
            </p>
            <a
              href={`tel:${farm.phone}`}
              className="mt-6 inline-flex items-center gap-1.5 text-sm hover:underline underline-offset-2"
              style={{ color: '#2D5F3F' }}
            >
              <Phone className="w-3.5 h-3.5" strokeWidth={1.7} />
              {farm.phone}
            </a>
          </div>
        </main>
      )
    }
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: farm.name,
    description: farm.description,
    telephone: farm.phone,
    email: farm.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: farm.address,
      postalCode: farm.postalCode,
      addressLocality: farm.city,
      addressCountry: 'AT',
    },
  }

  const bannerBg =
    farm.bannerType === 'PHOTO' && farm.bannerUrl
      ? null
      : BANNER_GRADIENTS[farm.bannerValue ?? 'tannengruen'] ?? BANNER_GRADIENTS.tannengruen

  const productsForGrid = isEdit
    ? farm.products
    : farm.products.filter((p) => p.isAvailable)

  const publicCount = farm.products.filter((p) => p.isAvailable).length
  const hiddenCount = farm.products.filter((p) => !p.isAvailable).length
  const productCountLabel = ownerMode
    ? isEdit
      ? `${publicCount} sichtbar${hiddenCount > 0 ? ` · ${hiddenCount} ausgeblendet` : ''}`
      : `${publicCount} Produkte`
    : publicCount > 0
      ? `${publicCount} Produkte`
      : ''

  const showGallery =
    (isSectionVisible('gallery') || ownerMode) &&
    (farm.farmPhotos.length > 0 || isEdit)

  return (
    <div className="min-h-screen" style={{ background: '#F5F3EE' }}>
      {!ownerMode && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      {/* Mode banner */}
      {ownerMode && (
        <div className="max-w-[960px] mx-auto px-4 md:px-10 pt-6 pb-[22px]">
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-[13px]"
            style={{
              background: isEdit ? '#fff' : '#24523A',
              border: `1px solid ${isEdit ? '#ECE8DF' : '#24523A'}`,
            }}
          >
            <span
              className="flex items-center justify-center rounded-[10px] shrink-0"
              style={{
                width: 38,
                height: 38,
                background: isEdit ? '#F2E5D3' : 'rgba(255,255,255,0.14)',
                color: isEdit ? '#8B6B4F' : '#fff',
              }}
            >
              {isEdit
                ? <Pencil className="size-4" strokeWidth={1.7} />
                : <Eye className="size-[17px]" strokeWidth={1.7} />
              }
            </span>
            <div>
              <div className="text-sm font-semibold" style={{ color: isEdit ? '#2D3027' : '#fff' }}>
                {isEdit ? 'Du bearbeitest deine Hof-Seite' : 'So sehen Kunden deine Seite'}
              </div>
              <div className="text-[13px] mt-px" style={{ color: isEdit ? '#9AA08F' : '#C9E3CF' }}>
                {isEdit
                  ? 'Alles mit Stift-Symbol kannst du ändern – Kunden sehen es sofort.'
                  : 'Bearbeiten-Knöpfe und ausgeblendete Produkte sind unsichtbar.'
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cover 250px */}
      <div className="relative h-[250px]">
        {bannerBg === null ? (
          <Image
            src={farm.bannerUrl!}
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover"
            style={{ objectPosition: `50% ${effectiveFocusY}%` }}
          />
        ) : (
          <div className="absolute inset-0" style={{ background: bannerBg }} />
        )}
        {/* Gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(24,36,27,0.10) 0%, rgba(24,36,27,0) 40%, rgba(20,30,22,0.62) 100%)',
          }}
        />
        {/* Titelbild ändern + Fokus anpassen (edit only) */}
        {isEdit && adjustingFocus && (
          <CoverFocusAdjust
            focusY={effectiveFocusY}
            onChange={setFocusDraft}
            onSave={saveFocus}
            onCancel={() => setFocusDraft(null)}
            saving={savingFocus}
          />
        )}
        {isEdit && !adjustingFocus && (
          <div className="absolute top-3.5 right-[22px] flex items-center gap-2">
            {bannerBg === null && (
              <button
                type="button"
                onClick={() => setFocusDraft(farm.bannerFocusY)}
                className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: 'rgba(255,255,255,0.94)', color: '#2D5F3F', boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}
              >
                <MoveVertical className="size-3.5" strokeWidth={1.7} />
                Anpassen
              </button>
            )}
            <CoverEditButton currentBannerUrl={farm.bannerUrl} />
          </div>
        )}
        {/* Hof-Siegel */}
        {farm.foundedYear && (
          <div
            className="absolute top-1/2 right-16 hidden md:block pointer-events-none"
            style={{ transform: 'translateY(-46%) rotate(-6deg)', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.25))' }}
          >
            <FarmSeal farmName={farm.name} foundedYear={farm.foundedYear} />
          </div>
        )}
        {/* Name + values overlay */}
        <div className="absolute inset-x-0 bottom-0 pointer-events-none">
          <div className="max-w-[960px] mx-auto px-4 md:px-10 pb-5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1
                className="font-heading text-[34px] font-semibold text-white leading-tight"
                style={{ textShadow: '0 2px 14px rgba(0,0,0,0.45)' }}
              >
                {farm.name}
              </h1>
              {isSectionVisible('values') && farm.farmValues.slice(0, 4).map((v) => (
                <span
                  key={v.id}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ color: '#2D5F3F', background: '#E8F0E2' }}
                >
                  <Check className="size-3" strokeWidth={1.7} />
                  {v.title}
                </span>
              ))}
              {isEdit && !adjustingFocus && (
                <Link
                  href="/settings/appearance"
                  className="pointer-events-auto flex items-center justify-center rounded-full transition-opacity hover:opacity-90"
                  style={{
                    width: 34, height: 34,
                    background: 'rgba(255,255,255,0.92)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                    color: '#5C6052',
                  }}
                  aria-label="Hofname & Cover bearbeiten"
                >
                  <Pencil className="size-3.5" strokeWidth={1.7} />
                </Link>
              )}
            </div>
            <div
              className="flex items-center gap-1.5 mt-1.5 text-sm"
              style={{ color: '#F1EFE8', textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}
            >
              <MapPin className="size-3.5 shrink-0" strokeWidth={1.7} />
              <span>{farm.address}, {farm.postalCode} {farm.city}</span>
              {farm.tagline && <span className="ml-2 truncate">{farm.tagline}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Content column */}
      <div className="max-w-[960px] mx-auto px-4 md:px-10 pt-[26px] pb-12">

        {/* Zahlung & Kontakt */}
        <WoodCard>
          <div className="px-5 pt-[18px] pb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: '#2D3027' }}>
                <CreditCard className="size-4" strokeWidth={1.7} style={{ color: '#7A8071' }} />
                Zahlung & Kontakt
              </div>
              {isEdit && (
                <Link
                  href="/settings"
                  className="flex items-center justify-center rounded-full border transition-colors hover:bg-gray-50"
                  style={{ width: 32, height: 32, borderColor: '#E4E0D6', color: '#5C6052' }}
                  aria-label="Zahlung & Kontakt bearbeiten"
                >
                  <Pencil className="size-[13px]" strokeWidth={1.7} />
                </Link>
              )}
            </div>
            <div className="flex flex-wrap gap-2.5 mt-3.5">
              {farm.acceptsOnline && (
                <span
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-[13px] py-[7px] rounded-full"
                  style={{ color: '#6E5F45', background: '#F2ECDC' }}
                >
                  <CreditCard className="size-3.5" strokeWidth={1.7} />
                  Online (Karte)
                </span>
              )}
              {farm.acceptsOnsite && (
                <span
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-[13px] py-[7px] rounded-full"
                  style={{ color: '#6E5F45', background: '#F2ECDC' }}
                >
                  <Banknote className="size-3.5" strokeWidth={1.7} />
                  Vor Ort (Bar & Karte)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-4 text-sm" style={{ color: '#2D3027' }}>
              <Phone className="size-[15px] shrink-0" strokeWidth={1.7} style={{ color: '#7A8071' }} />
              {farm.phone}
            </div>
            <div className="flex items-center gap-2 mt-2 text-sm" style={{ color: '#2D3027' }}>
              <Mail className="size-[15px] shrink-0" strokeWidth={1.7} style={{ color: '#7A8071' }} />
              {farm.email}
            </div>
          </div>
        </WoodCard>

        {/* Status section */}
        {(isSectionVisible('status') || ownerMode) && (
          <div className="mt-[18px]">
            {activeStatus ? (
              <>
                {(() => {
                  const anlassMeta = ANLASS_META[activeStatus.anlass] ?? ANLASS_META.ANNOUNCEMENT
                  const hoursAgo = Math.floor(
                    (Date.now() - new Date(activeStatus.publishedAt).getTime()) / (1000 * 60 * 60),
                  )
                  const timeStr =
                    hoursAgo < 1
                      ? 'heute'
                      : hoursAgo < 24
                        ? `vor ${hoursAgo} Stunden`
                        : `vor ${Math.floor(hoursAgo / 24)} Tagen`
                  return (
                    <WoodCard>
                      <div className="px-5 pt-4 pb-[18px]">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span
                            className="inline-flex items-center gap-1 text-xs font-semibold px-[11px] py-[5px] rounded-full"
                            style={{ color: '#2D5F3F', background: '#E8F0E2' }}
                          >
                            {anlassMeta.icon}
                            {anlassMeta.label}
                          </span>
                          {isEdit && (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-semibold px-[11px] py-[5px] rounded-full"
                              style={{ color: '#2D5F3F', background: '#DCEDE1' }}
                            >
                              <Check className="size-3" strokeWidth={1.9} />
                              Aktiv
                            </span>
                          )}
                          <span className="text-[13px]" style={{ color: '#9AA08F' }}>
                            Aktuell · {timeStr}
                          </span>
                          {isEdit && (
                            <div className="ml-auto">
                              <Link
                                href="/status"
                                className="flex items-center justify-center rounded-full border transition-colors hover:bg-gray-50"
                                style={{ width: 32, height: 32, borderColor: '#E4E0D6', color: '#5C6052' }}
                                aria-label="Status bearbeiten"
                              >
                                <Pencil className="size-[13px]" strokeWidth={1.7} />
                              </Link>
                            </div>
                          )}
                        </div>
                        <h2 className="font-heading text-xl font-semibold mt-3" style={{ color: '#2D3027' }}>
                          {activeStatus.title}
                        </h2>
                        <p className="text-sm mt-1.5 leading-[1.55] whitespace-pre-wrap" style={{ color: '#5C6052' }}>
                          {isEdit
                            ? renderStatusBodyWithChip(activeStatus.body)
                            : stripStatusVariables(activeStatus.body)
                          }
                        </p>
                        {activeStatus.photoUrl && (
                          <div className="relative w-full aspect-[3/2] max-h-48 mt-3 rounded-xl overflow-hidden">
                            <Image
                              src={activeStatus.photoUrl}
                              alt={activeStatus.title}
                              fill
                              sizes="(min-width: 768px) 640px, 100vw"
                              className="object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </WoodCard>
                  )
                })()}
                {ownerMode && (
                  <>
                    <Link
                      href="/status/new"
                      className="w-full mt-3 flex items-center justify-center gap-2 rounded-[14px] py-3.5 text-sm font-semibold transition-colors hover:bg-white/70"
                      style={{ border: '2px dashed #C9C2B2', background: 'rgba(255,255,255,0.5)', color: '#2D5F3F' }}
                    >
                      <Plus className="size-[15px]" strokeWidth={1.9} />
                      Neuer Status
                    </Link>
                    <Link
                      href="/status"
                      className="block text-center text-xs mt-2 py-1 transition-colors hover:text-[#2D3027]"
                      style={{ color: '#9AA08F' }}
                    >
                      Frühere Status ansehen →
                    </Link>
                  </>
                )}
              </>
            ) : ownerMode ? (
              <div className="flex flex-col gap-2">
                <Link
                  href="/status/new"
                  className="w-full flex items-center justify-center gap-2 rounded-[14px] py-4 text-sm font-semibold transition-colors hover:bg-white/70"
                  style={{ border: '2px dashed #C9C2B2', background: 'rgba(255,255,255,0.5)', color: '#2D5F3F' }}
                >
                  <Plus className="size-[15px]" strokeWidth={1.9} />
                  Neuer Status
                </Link>
                <Link
                  href="/status"
                  className="block text-center text-xs py-1 transition-colors hover:text-[#2D3027]"
                  style={{ color: '#9AA08F' }}
                >
                  Frühere Status ansehen →
                </Link>
              </div>
            ) : null}
          </div>
        )}

        {/* Gallery section */}
        {showGallery && (
          <div className="mt-[26px]" key={`gallery-${galleryKey}`}>
            <GallerySection
              farm={farm}
              isEdit={isEdit}
              onPhotoAdded={() => setGalleryKey((k) => k + 1)}
            />
          </div>
        )}

        {/* Products heading */}
        <div className="flex items-baseline gap-3 mt-[34px] mb-[18px]">
          <h2 className="font-heading text-[26px] font-semibold" style={{ color: '#2D3027' }}>
            Unsere Produkte
          </h2>
          {productCountLabel && (
            <span className="text-sm" style={{ color: '#9AA08F' }}>
              {productCountLabel}
            </span>
          )}
        </div>

        <ProductGrid
          products={productsForGrid}
          farmId={farm.id}
          farmSlug={farm.slug}
          initialReorderItems={reorderItems && reorderItems.length > 0 ? reorderItems : undefined}
          ownerMode={ownerMode}
          mode={mode}
        />

        {/* Footer (public only) */}
        {!ownerMode && (
          <footer className="py-8 border-t mt-6" style={{ borderColor: '#ECE8DF' }}>
            <div className="flex flex-wrap items-center gap-5 text-xs" style={{ color: '#9AA08F' }}>
              <span>© {new Date().getFullYear()} {farm.name}</span>
              <Link href="/impressum" className="hover:text-[#2D3027] transition-colors">Impressum</Link>
              <Link href="/datenschutz" className="hover:text-[#2D3027] transition-colors">Datenschutz</Link>
              <Link href="/account/profile" className="hover:text-[#2D3027] transition-colors">Mein Konto</Link>
            </div>
          </footer>
        )}
      </div>
    </div>
  )
}
