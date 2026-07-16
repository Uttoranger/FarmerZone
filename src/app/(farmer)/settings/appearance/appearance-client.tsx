'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Check, ChevronUp, ChevronDown, Trash2, Loader2, ExternalLink, Plus, Upload,
  Camera, X, GripVertical,
} from 'lucide-react'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ReorderContext } from '@/components/shared/reorder-context'
import { toast } from 'sonner'
import { saveAppearanceAction, updateFarmLogoAction, updateFarmBannerAction } from '@/server/actions/appearance'
import {
  addFarmPhotoAction,
  updateFarmPhotoCaptionAction,
  deleteFarmPhotoAction,
  moveFarmPhotoAction,
} from '@/server/actions/farm-photos'
import { useImageUpload } from '@/components/shared/image-upload'
import { cn } from '@/lib/utils'
import type { SectionConfig, FarmPhotoData } from '@/server/queries/appearance'

// ── Design constants ──────────────────────────────────────────────────────────

const BANNER_PRESETS = [
  {
    key: 'tannengruen',
    label: 'Tannengrün',
    gradient: 'linear-gradient(135deg, #1F4732 0%, #3D7B58 60%, #E8F0E8 100%)',
  },
  {
    key: 'wiese',
    label: 'Frühlingswiese',
    gradient: 'linear-gradient(135deg, #2D6A4F 0%, #52B788 50%, #D8F3DC 100%)',
  },
  {
    key: 'erde',
    label: 'Ackererde',
    gradient: 'linear-gradient(135deg, #6B4226 0%, #A0663E 55%, #F5E6D8 100%)',
  },
  {
    key: 'herbst',
    label: 'Herbst',
    gradient: 'linear-gradient(135deg, #7B4F00 0%, #D4900A 55%, #FFF3CC 100%)',
  },
]

const VALUE_CATALOG = [
  { icon: '🐄', title: 'Tierwohl' },
  { icon: '🌿', title: 'Bio-zertifiziert' },
  { icon: '🌸', title: 'Saisonal' },
  { icon: '📍', title: 'Regional' },
  { icon: '👐', title: 'Handarbeit' },
  { icon: '🏡', title: 'Familienbetrieb' },
]

const SECTION_LABELS: Record<string, string> = {
  status:   'Aktuelle Updates',
  about:    'Über uns',
  values:   'Unsere Werte',
  gallery:  'Galerie',
  products: 'Produkte (immer sichtbar)',
}

// ── Types ─────────────────────────────────────────────────────────────────────

type FarmValueInput = { icon: string; title: string; subtitle: string }

interface Props {
  initialData: {
    farmId: string
    tagline: string
    foundedYear: string
    aboutText: string
    logoUrl: string | null
    bannerType: 'GRADIENT' | 'PHOTO'
    bannerUrl: string | null
    bannerValue: string
    sectionsConfig: SectionConfig[]
    farmValues: FarmValueInput[]
    farmPhotos: FarmPhotoData[]
    farmSlug: string
  }
}

// ── Logo upload sub-component ─────────────────────────────────────────────────

function LogoUpload({
  logoUrl,
  onUploaded,
}: {
  logoUrl: string | null
  onUploaded: (url: string | null) => void
}) {
  const [, startTransition] = useTransition()

  const { isUploading, openFilePicker, fileInput } = useImageUpload({
    variant: 'logo',
    oldUrl: logoUrl ?? undefined,
    onUploaded: (url) => {
      startTransition(async () => {
        const result = await updateFarmLogoAction(url)
        if (result.error) {
          toast.error(result.error)
        } else {
          onUploaded(url)
          toast.success('Logo gespeichert')
        }
      })
    },
  })

  async function handleRemove() {
    startTransition(async () => {
      const result = await updateFarmLogoAction(null)
      if (result.error) {
        toast.error(result.error)
      } else {
        onUploaded(null)
        toast.success('Logo entfernt')
      }
    })
  }

  return (
    <div className="flex items-center gap-4">
      {fileInput}
      {/* Round preview */}
      <div
        className="relative shrink-0 overflow-hidden bg-muted flex items-center justify-center"
        style={{ width: 72, height: 72, borderRadius: '50%', border: '2px dashed #C9C2B2' }}
      >
        {logoUrl ? (
          <>
            <Image
              src={logoUrl}
              alt="Logo"
              fill
              sizes="72px"
              className="object-cover"
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
              aria-label="Logo entfernen"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        ) : (
          <Camera className="w-6 h-6 text-muted-foreground/50" />
        )}
      </div>
      <div>
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isUploading}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted/40 transition-colors disabled:opacity-60"
        >
          {isUploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          {logoUrl ? 'Logo ersetzen' : 'Logo hochladen'}
        </button>
        <p className="text-xs text-muted-foreground mt-1">Rundes Logo · max. 800 px · WebP</p>
      </div>
    </div>
  )
}

// ── Banner PHOTO upload sub-component ─────────────────────────────────────────

function BannerPhotoUpload({
  bannerUrl,
  onUploaded,
}: {
  bannerUrl: string | null
  onUploaded: (url: string | null) => void
}) {
  const [, startTransition] = useTransition()

  const { isUploading, openFilePicker, fileInput } = useImageUpload({
    variant: 'banner',
    oldUrl: bannerUrl ?? undefined,
    onUploaded: (url) => {
      startTransition(async () => {
        const result = await updateFarmBannerAction('PHOTO', url)
        if (result.error) {
          toast.error(result.error)
        } else {
          onUploaded(url)
          toast.success('Titelbild gespeichert')
        }
      })
    },
  })

  async function handleRemove() {
    startTransition(async () => {
      const result = await updateFarmBannerAction('GRADIENT', null)
      if (result.error) {
        toast.error(result.error)
      } else {
        onUploaded(null)
        toast.success('Titelbild entfernt')
      }
    })
  }

  return (
    <div className="mt-4">
      {fileInput}
      {bannerUrl ? (
        <div className="relative h-24 rounded-xl overflow-hidden">
          <Image src={bannerUrl} alt="Titelbild" fill sizes="600px" className="object-cover" />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            aria-label="Titelbild entfernen"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isUploading}
          className="w-full h-24 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 hover:bg-muted/30 transition-colors disabled:opacity-60"
        >
          {isUploading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <Upload className="size-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Foto hochladen</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}

// ── Gallery photo item ────────────────────────────────────────────────────────

function GalleryPhotoItem({
  photo,
  index,
  total,
  onDeleted,
  onCaptionChange,
  onMove,
}: {
  photo: FarmPhotoData
  index: number
  total: number
  onDeleted: (id: string) => void
  onCaptionChange: (id: string, caption: string) => void
  onMove: (id: string, dir: 'up' | 'down') => void
}) {
  const [caption, setCaption] = useState(photo.caption ?? '')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSavingCaption, setIsSavingCaption] = useState(false)

  async function handleCaptionBlur() {
    if (caption === (photo.caption ?? '')) return
    setIsSavingCaption(true)
    const result = await updateFarmPhotoCaptionAction(photo.id, caption)
    setIsSavingCaption(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      onCaptionChange(photo.id, caption)
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    const result = await deleteFarmPhotoAction(photo.id)
    if (result.error) {
      toast.error(result.error)
      setIsDeleting(false)
    } else {
      onDeleted(photo.id)
    }
  }

  return (
    <div className="flex items-start gap-3 bg-muted/30 rounded-xl p-3">
      <div className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted">
        <Image src={photo.url} alt={caption || 'Foto'} fill sizes="64px" className="object-cover" />
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, 100))}
          onBlur={handleCaptionBlur}
          placeholder="Bildunterschrift (optional)"
          className="w-full h-8 px-2 rounded-lg border border-border bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        {isSavingCaption && (
          <span className="text-[10px] text-muted-foreground">Speichern…</span>
        )}
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <button
          onClick={() => onMove(photo.id, 'up')}
          disabled={index === 0}
          className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center disabled:opacity-30"
        >
          <ChevronUp className="size-3.5" />
        </button>
        <button
          onClick={() => onMove(photo.id, 'down')}
          disabled={index === total - 1}
          className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center disabled:opacity-30"
        >
          <ChevronDown className="size-3.5" />
        </button>
      </div>
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="w-6 h-6 rounded-md hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive shrink-0 disabled:opacity-40"
      >
        {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      </button>
    </div>
  )
}

// ── Gallery section ───────────────────────────────────────────────────────────

const GALLERY_LIMIT = 8

function GallerySection({ initialPhotos }: { initialPhotos: FarmPhotoData[] }) {
  const [photos, setPhotos] = useState<FarmPhotoData[]>(initialPhotos)
  const [, startTransition] = useTransition()

  const canUpload = photos.length < GALLERY_LIMIT

  const { isUploading, openFilePicker, fileInput } = useImageUpload({
    variant: 'gallery',
    onUploaded: (url) => {
      startTransition(async () => {
        const result = await addFarmPhotoAction({ url })
        if (result.error) {
          toast.error(result.error)
        } else if (result.photo) {
          setPhotos((prev) => [...prev, result.photo!])
          toast.success('Foto hinzugefügt')
        }
      })
    },
  })

  function handleDeleted(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id).map((p, i) => ({ ...p, sortOrder: i })))
  }

  function handleCaptionChange(id: string, caption: string) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, caption: caption || null } : p)))
  }

  async function handleMove(id: string, dir: 'up' | 'down') {
    const result = await moveFarmPhotoAction(id, dir)
    if (result.error) {
      toast.error(result.error)
      return
    }
    setPhotos((prev) => {
      const next = [...prev]
      const idx = next.findIndex((p) => p.id === id)
      if (idx === -1) return next
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= next.length) return next
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next.map((p, i) => ({ ...p, sortOrder: i }))
    })
  }

  return (
    <section className="bg-card rounded-2xl shadow-[0_2px_8px_oklch(0.18_0.03_150_/_0.05)] p-6" id="gallery">
      {fileInput}
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-foreground">Galerie</h2>
        <span className="text-xs text-muted-foreground">{photos.length}/{GALLERY_LIMIT}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Bis zu {GALLERY_LIMIT} Fotos vom Hof — erscheinen auf deiner öffentlichen Seite
      </p>

      {photos.length > 0 && (
        <div className="space-y-2 mb-4">
          {photos.map((photo, i) => (
            <GalleryPhotoItem
              key={photo.id}
              photo={photo}
              index={i}
              total={photos.length}
              onDeleted={handleDeleted}
              onCaptionChange={handleCaptionChange}
              onMove={handleMove}
            />
          ))}
        </div>
      )}

      {canUpload && (
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isUploading}
          className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors disabled:opacity-60"
        >
          {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {isUploading ? 'Wird hochgeladen…' : 'Foto hinzufügen'}
        </button>
      )}

      {!canUpload && (
        <p className="text-xs text-center text-muted-foreground py-2">
          Maximum ({GALLERY_LIMIT} Fotos) erreicht
        </p>
      )}
    </section>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────


// Sprint 18: sortierbare Zeile der Bereiche-Liste (Grip + DnD; Pfeile als Fallback)
function SortableSectionRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      className="flex items-center gap-2"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 30 : undefined,
        boxShadow: isDragging ? '0 10px 24px rgba(45,95,63,0.22)' : undefined,
        borderRadius: 12,
      }}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label="Bereich verschieben"
        className="shrink-0 flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:bg-muted cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

export function AppearanceClient({ initialData }: Props) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialData.logoUrl)
  const [bannerType, setBannerType] = useState<'GRADIENT' | 'PHOTO'>(initialData.bannerType)
  const [bannerUrl, setBannerUrl] = useState<string | null>(initialData.bannerUrl)
  const [bannerValue, setBannerValue] = useState(initialData.bannerValue || 'tannengruen')
  const [tagline, setTagline] = useState(initialData.tagline)
  const [foundedYear, setFoundedYear] = useState(initialData.foundedYear)
  const [aboutText, setAboutText] = useState(initialData.aboutText)
  const [sectionsConfig, setSectionsConfig] = useState<SectionConfig[]>(initialData.sectionsConfig)
  const [farmValues, setFarmValues] = useState<FarmValueInput[]>(initialData.farmValues)
  const [saving, setSaving] = useState(false)

  const currentPreset = BANNER_PRESETS.find((p) => p.key === bannerValue) ?? BANNER_PRESETS[0]

  // ── Values helpers ──────────────────────────────────────────────────────────

  function toggleCatalogValue(item: { icon: string; title: string }) {
    const exists = farmValues.some((v) => v.icon === item.icon && v.title === item.title)
    if (exists) {
      setFarmValues((prev) => prev.filter((v) => !(v.icon === item.icon && v.title === item.title)))
    } else {
      if (farmValues.length >= 4) {
        toast.error('Maximal 4 Werte möglich.')
        return
      }
      setFarmValues((prev) => [...prev, { icon: item.icon, title: item.title, subtitle: '' }])
    }
  }

  function moveValue(i: number, dir: -1 | 1) {
    setFarmValues((prev) => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return next
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  function updateSubtitle(i: number, subtitle: string) {
    setFarmValues((prev) => prev.map((v, idx) => (idx === i ? { ...v, subtitle } : v)))
  }

  function removeValue(i: number) {
    setFarmValues((prev) => prev.filter((_, idx) => idx !== i))
  }

  // ── Section config helpers ──────────────────────────────────────────────────

  function moveSectionByOffset(key: string, dir: -1 | 1) {
    setSectionsConfig((prev) => {
      const sorted = prev.slice().sort((a, b) => a.order - b.order)
      const idx = sorted.findIndex((sec) => sec.key === key)
      const j = idx + dir
      if (idx < 0 || j < 0 || j >= sorted.length) return prev
      ;[sorted[idx], sorted[j]] = [sorted[j], sorted[idx]]
      return sorted.map((sec, i) => ({ ...sec, order: i }))
    })
  }

  function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSectionsConfig((prev) => {
      const sorted = prev.slice().sort((a, b) => a.order - b.order)
      const keys = sorted.map((sec) => sec.key)
      const next = arrayMove(sorted, keys.indexOf(String(active.id)), keys.indexOf(String(over.id)))
      return next.map((sec, i) => ({ ...sec, order: i }))
    })
  }

  function toggleSection(key: string) {
    if (key === 'products') return
    setSectionsConfig((prev) =>
      prev.map((s) => (s.key === key ? { ...s, visible: !s.visible } : s)),
    )
  }

  // ── Banner type switch ──────────────────────────────────────────────────────

  function switchToGradient() {
    setBannerType('GRADIENT')
  }

  function switchToPhoto() {
    setBannerType('PHOTO')
  }

  function handleBannerPhotoUploaded(url: string | null) {
    setBannerUrl(url)
    if (url === null) {
      setBannerType('GRADIENT')
    } else {
      setBannerType('PHOTO')
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    const result = await saveAppearanceAction({
      tagline: tagline || null,
      foundedYear: foundedYear ? parseInt(foundedYear, 10) : null,
      aboutText: aboutText || null,
      bannerType,
      bannerValue,
      bannerUrl: bannerType === 'PHOTO' ? bannerUrl : null,
      logoUrl,
      sectionsConfig,
      farmValues: farmValues.map((v, i) => ({
        icon: v.icon,
        title: v.title,
        subtitle: v.subtitle || null,
        sortOrder: i,
      })),
    })
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Auftritt gespeichert!')
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Mein Auftritt</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestalte deine öffentliche Hof-Seite
          </p>
        </div>
        <Link
          href={`/${initialData.farmSlug}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ExternalLink className="size-3.5" />
          Vorschau
        </Link>
      </div>

      {/* ── Logo section ───────────────────────────────────────────────────── */}
      <section className="bg-card rounded-2xl shadow-[0_2px_8px_oklch(0.18_0.03_150_/_0.05)] p-6">
        <h2 className="font-semibold text-foreground mb-1">Logo</h2>
        <p className="text-xs text-muted-foreground mb-4">Rundes Hof-Logo — erscheint auf deiner Seite</p>
        <LogoUpload logoUrl={logoUrl} onUploaded={setLogoUrl} />
      </section>

      {/* ── Banner section ─────────────────────────────────────────────────── */}
      <section className="bg-card rounded-2xl shadow-[0_2px_8px_oklch(0.18_0.03_150_/_0.05)] p-6">
        <h2 className="font-semibold text-foreground mb-1">Titelbild</h2>
        <p className="text-xs text-muted-foreground mb-4">Header-Bereich auf deiner Hof-Seite</p>

        {/* Type toggle */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={switchToGradient}
            className={cn(
              'flex-1 h-9 rounded-lg border-2 text-sm font-medium transition-all',
              bannerType === 'GRADIENT'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:border-border/80',
            )}
          >
            Farbverlauf
          </button>
          <button
            type="button"
            onClick={switchToPhoto}
            className={cn(
              'flex-1 h-9 rounded-lg border-2 text-sm font-medium transition-all',
              bannerType === 'PHOTO'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:border-border/80',
            )}
          >
            Foto
          </button>
        </div>

        {bannerType === 'GRADIENT' ? (
          <>
            {/* Preview */}
            <div className="h-20 rounded-xl mb-4" style={{ background: currentPreset.gradient }} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {BANNER_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => setBannerValue(preset.key)}
                  className={cn(
                    'group relative h-12 rounded-xl overflow-hidden ring-2 transition-all',
                    bannerValue === preset.key ? 'ring-primary' : 'ring-transparent hover:ring-border',
                  )}
                >
                  <div className="absolute inset-0" style={{ background: preset.gradient }} />
                  <div className="absolute inset-0 flex items-end justify-start p-1.5">
                    <span className="text-[10px] font-semibold text-white drop-shadow leading-none">
                      {preset.label}
                    </span>
                  </div>
                  {bannerValue === preset.key && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </>
        ) : (
          <BannerPhotoUpload
            bannerUrl={bannerUrl}
            onUploaded={handleBannerPhotoUploaded}
          />
        )}
      </section>

      {/* ── Tagline + Founded year ─────────────────────────────────────────── */}
      <section className="bg-card rounded-2xl shadow-[0_2px_8px_oklch(0.18_0.03_150_/_0.05)] p-6 space-y-4">
        <h2 className="font-semibold text-foreground mb-1">Hofprofil</h2>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-foreground">Tagline</label>
            <span className="text-xs text-muted-foreground">{tagline.length}/60</span>
          </div>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value.slice(0, 60))}
            placeholder="z.B. Frische Produkte direkt vom Feld"
            className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Kurze Beschreibung unter dem Hofnamen
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Gründungsjahr <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <input
            type="number"
            value={foundedYear}
            onChange={(e) => setFoundedYear(e.target.value)}
            placeholder="z.B. 1987"
            min={1800}
            max={2030}
            className="w-32 h-11 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-xs text-muted-foreground mt-1">Wird als „seit {foundedYear || '…'}" angezeigt</p>
        </div>
      </section>

      {/* ── About text ─────────────────────────────────────────────────────── */}
      <section className="bg-card rounded-2xl shadow-[0_2px_8px_oklch(0.18_0.03_150_/_0.05)] p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-foreground">Über uns</h2>
          <span className="text-xs text-muted-foreground">{aboutText.length}/1000</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Erzähle deinen Kunden etwas über deinen Hof
        </p>
        <textarea
          value={aboutText}
          onChange={(e) => setAboutText(e.target.value.slice(0, 1000))}
          placeholder="Unser Hof liegt idyllisch am Rand des Dorfes…"
          rows={5}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </section>

      {/* ── Values ─────────────────────────────────────────────────────────── */}
      <section className="bg-card rounded-2xl shadow-[0_2px_8px_oklch(0.18_0.03_150_/_0.05)] p-6">
        <h2 className="font-semibold text-foreground mb-1">Unsere Werte</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Wähle bis zu 4 Werte — sie erscheinen als Kacheln auf deiner Seite
        </p>

        {/* Catalog */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {VALUE_CATALOG.map((item) => {
            const selected = farmValues.some(
              (v) => v.icon === item.icon && v.title === item.title,
            )
            return (
              <button
                key={item.title}
                onClick={() => toggleCatalogValue(item)}
                className={cn(
                  'flex items-center gap-2 p-2.5 rounded-xl border-2 text-sm transition-all text-left',
                  selected
                    ? 'bg-[#E8F0E8] border-primary text-primary'
                    : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/40',
                )}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="text-xs font-medium flex-1">{item.title}</span>
                {selected && <Check className="size-3.5 shrink-0" />}
              </button>
            )
          })}
        </div>

        {/* Selected values with subtitle editing */}
        {farmValues.length > 0 && (
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Ausgewählt ({farmValues.length}/4)
            </p>
            {farmValues.map((v, i) => (
              <div
                key={`${v.icon}-${i}`}
                className="flex items-start gap-2 bg-muted/40 rounded-xl p-3"
              >
                <span className="text-xl leading-none mt-0.5">{v.icon}</span>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="text-sm font-semibold text-foreground">{v.title}</div>
                  <input
                    type="text"
                    value={v.subtitle}
                    onChange={(e) => updateSubtitle(i, e.target.value.slice(0, 100))}
                    placeholder="Kurze Beschreibung (optional)"
                    className="w-full h-8 px-2 rounded-lg border border-border bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => moveValue(i, -1)}
                    disabled={i === 0}
                    className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center disabled:opacity-30"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    onClick={() => moveValue(i, 1)}
                    disabled={i === farmValues.length - 1}
                    className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center disabled:opacity-30"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </div>
                <button
                  onClick={() => removeValue(i)}
                  className="w-6 h-6 rounded-md hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Sections config ────────────────────────────────────────────────── */}
      <section className="bg-card rounded-2xl shadow-[0_2px_8px_oklch(0.18_0.03_150_/_0.05)] p-6">
        <h2 className="font-semibold text-foreground mb-1">Bereiche</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Wähle, welche Bereiche auf deiner öffentlichen Seite sichtbar sind
        </p>
        <ReorderContext
          enabled
          items={sectionsConfig.slice().sort((a, b) => a.order - b.order).map((sec) => sec.key)}
          onDragEnd={handleSectionDragEnd}
        >
        <div className="space-y-2">
          {sectionsConfig
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((section, idx, sorted) => {
              const isProducts = section.key === 'products'
              return (
                <SortableSectionRow key={section.key} id={section.key}>
                  <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    disabled={isProducts}
                    className={cn(
                      'flex-1 flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all',
                      section.visible && !isProducts
                        ? 'border-primary bg-primary/5'
                        : isProducts
                          ? 'border-border bg-muted/30 cursor-not-allowed'
                          : 'border-border hover:border-border/80',
                    )}
                  >
                    <div
                      className={cn(
                        'size-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                        section.visible ? 'bg-primary border-primary' : 'border-border',
                      )}
                    >
                      {section.visible && <Check className="size-3 text-primary-foreground" />}
                    </div>
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isProducts ? 'text-muted-foreground' : 'text-foreground',
                      )}
                    >
                      {SECTION_LABELS[section.key] ?? section.key}
                    </span>
                  </button>
                  {/* Pfeil-Fallback (Barrierefreiheit / ohne Drag) */}
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveSectionByOffset(section.key, -1)}
                      disabled={idx === 0}
                      aria-label="Bereich nach oben"
                      className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center disabled:opacity-30"
                    >
                      <ChevronUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSectionByOffset(section.key, 1)}
                      disabled={idx === sorted.length - 1}
                      aria-label="Bereich nach unten"
                      className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center disabled:opacity-30"
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                  </div>
                  </div>
                </SortableSectionRow>
              )
            })}
        </div>
        </ReorderContext>
      </section>

      {/* ── Gallery ─────────────────────────────────────────────────────────── */}
      <GallerySection initialPhotos={initialData.farmPhotos} />

      {/* ── Save button ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 pb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-12 px-8 rounded-xl bg-accent text-accent-foreground font-semibold hover:bg-accent-hover transition-colors disabled:opacity-60 flex items-center gap-2"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {saving ? 'Wird gespeichert…' : 'Speichern & veröffentlichen'}
        </button>
        <Link
          href={`/${initialData.farmSlug}`}
          target="_blank"
          className="text-sm text-primary hover:underline underline-offset-2 flex items-center gap-1"
        >
          <ExternalLink className="size-3.5" />
          Seite ansehen
        </Link>
      </div>
    </div>
  )
}
