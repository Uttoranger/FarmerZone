'use client'

import { useEffect, useState, useTransition } from 'react'
import Image from 'next/image'
import { Camera, ChevronDown, ChevronUp, Loader2, MoveVertical, Plus, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { updateBannerFocusAction, updateFarmBannerAction, updateFarmLogoAction } from '@/server/actions/appearance'
import {
  addFarmPhotoAction,
  deleteFarmPhotoAction,
  moveFarmPhotoAction,
  updateFarmPhotoCaptionAction,
} from '@/server/actions/farm-photos'
import type { FarmPhotoData } from '@/server/queries/appearance'
import { stufenText, useImageUpload } from '@/components/shared/image-upload'
import { CoverEditButton, CoverFocusAdjust, TITELBILD_KNOPF_STIL } from '@/components/farm/farm-page-view'
import { titelbildFoto, titelbildVerlauf } from '@/lib/mein-hof'
import { titelbildHinweis } from '@/lib/titelbild'
import { useBildmasse } from '@/components/hofseite/titelbild'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/*
 * Die Bild-Bausteine von Mein Hof — Titelbild, Logo und Fotos (Nachtlauf
 * Nr. 50, Register N4): ab lg in der Zeile des Editors, unter lg im Blatt von
 * unten, dieselben Bausteine. Logo und Fotos kommen aus dem früheren „Mein
 * Auftritt" (/settings/appearance, seit Nr. 50 eine Umleitung), das Titelbild
 * aus dem Editor. Der Upload ist unverändert: useImageUpload
 * (components/shared/image-upload.tsx) mit HEIC-Sperre und WebP, gespeichert
 * über die eigenen Aktionen jedes Bildes — nie über saveAppearanceAction.
 *
 * Jeder Baustein speichert sofort. `meldeErfolg` ersetzt den eigenen Toast
 * (unter lg „Gespeichert · Ansehen"), `onGespeichert` lädt danach Vorschau
 * bzw. Seite neu, `onHochladen` meldet, solange ein Foto hochlädt — dann
 * bleiben Blatt und Zeile offen: Hinge das Datei-Feld zwischen Auswahl und
 * fertigem Upload aus, verlöre Android die Datei (CODING_STANDARDS §8).
 *
 * Keine Karte mit eigenem Schatten: Fläche und Rand gibt das Blatt bzw. die
 * Zeile (DESIGN_SYSTEM, Karten).
 */

/** Knöpfe nur mit Symbol (Pfeile, Löschen): 44 px Trefferfläche, das Symbol bleibt klein (DESIGN_SYSTEM, Nr. 35). */
const SYMBOL_KNOPF = 'size-11 shrink-0 rounded-md flex items-center justify-center'

/** Höchstens so viele Fotos stehen in der Galerie der Hofseite. */
export const GALERIE_MAX = 8

/**
 * Meldet dem Aufrufer, ob gerade ein Foto hochlädt. Der Aufrufer reicht einen
 * stabilen Setter herein. Hängt der Baustein selbst aus, meldet er „fertig" —
 * sonst bliebe das Blatt für immer offen.
 */
function useHochladenMelden(laeuft: boolean, melden: ((laeuft: boolean) => void) | undefined): void {
  useEffect(() => {
    if (!melden) return
    melden(laeuft)
    return () => {
      if (laeuft) melden(false)
    }
  }, [laeuft, melden])
}

type BildBausteinProps = {
  /** Nach jedem erfolgreichen Speichern — lädt Vorschau bzw. Seite neu. */
  onGespeichert?: () => void
  /** Ersetzt den eigenen Erfolgs-Toast (unter lg: „Gespeichert · Ansehen"). */
  meldeErfolg?: () => void
  /** Meldet, solange ein Foto hochlädt oder gespeichert wird. */
  onHochladen?: (laeuft: boolean) => void
}

// ── Titelbild ────────────────────────────────────────────────────────────────

/** Was der Baustein „Titelbild" vom Hof braucht — ohne Date, ohne Decimal. */
export type TitelbildHof = {
  bannerType: string
  bannerUrl: string | null
  bannerValue: string | null
  bannerFocusY: number
}

/**
 * Titelbild: Abbild mit den vorhandenen Knöpfen der Hofseite — Foto ersetzen,
 * Ausschnitt ziehen, Foto entfernen (dann zeigt die Hofseite wieder den
 * Verlauf des Hofs). Entfernen ist dieselbe Aktion wie früher in „Mein
 * Auftritt" (updateFarmBannerAction mit GRADIENT), keine neue Logik.
 */
export function TitelbildBaustein({
  hof,
  onGespeichert,
  meldeErfolg,
  onHochladen,
}: BildBausteinProps & { hof: TitelbildHof }): React.JSX.Element {
  const [focusDraft, setFocusDraft] = useState<number | null>(null)
  const [pending, start] = useTransition()
  const [entferntGerade, startEntfernen] = useTransition()
  const foto = titelbildFoto(hof)
  const focus = focusDraft ?? hof.bannerFocusY
  // Die Maße liest der Browser aus der Vorschau, sobald sie geladen ist (Register N6, Nr. 72) — der Satz darunter gilt nur für Hochformat.
  const { masse, beimLaden } = useBildmasse(foto)
  const hochformatHinweis = titelbildHinweis(masse)

  function entfernen() {
    startEntfernen(async () => {
      const res = await updateFarmBannerAction('GRADIENT', null)
      if (res.error) {
        toast.error(res.error)
        return
      }
      if (meldeErfolg) meldeErfolg()
      else toast.success('Titelbild entfernt')
      onGespeichert?.()
    })
  }

  function speichern() {
    const wert = focusDraft
    if (wert === null) return
    start(async () => {
      const res = await updateBannerFocusAction(wert)
      if (res.error) {
        toast.error(res.error)
      } else {
        if (meldeErfolg) meldeErfolg()
        else toast.success('Bildausschnitt gespeichert')
        onGespeichert?.()
      }
      setFocusDraft(null)
    })
  }

  return (
    <div>
      <div className="relative aspect-[5/2] overflow-hidden rounded-xl bg-muted">
        {foto ? (
          <Image src={foto} alt="" fill sizes="640px" className="object-cover" style={{ objectPosition: `50% ${focus}%` }} onLoad={beimLaden} />
        ) : (
          // Der Verlauf ist ein Wert des Hofs (Titelbild-Einstellung), kein Farbliteral im Code.
          <div className="absolute inset-0" style={{ background: titelbildVerlauf(hof.bannerValue) }} />
        )}
        {focusDraft !== null ? (
          <CoverFocusAdjust
            focusY={focus}
            onChange={setFocusDraft}
            onSave={speichern}
            onCancel={() => setFocusDraft(null)}
            saving={pending}
            gross
          />
        ) : (
          <>
            {foto && (
              <button
                type="button"
                onClick={entfernen}
                disabled={entferntGerade}
                aria-label="Titelbild entfernen"
                className={cn('group absolute top-0.5 left-0.5 flex size-11 items-center justify-center rounded-full disabled:opacity-60', FOKUS_RAHMEN_INNEN)}
              >
                {/* Sichtbar der 28-px-Kreis wie früher in „Mein Auftritt", getroffen wird der 44-px-Knopf (Nr. 35).
                    Theme-fest dunkel auf dem Foto über Tokens (DESIGN_SYSTEM, Bild-Overlays). */}
                <span className="flex size-7 items-center justify-center rounded-full bg-primary-foreground/60 text-accent-foreground transition-colors group-hover:bg-primary-foreground/80">
                  <X className="size-3.5" aria-hidden="true" />
                </span>
              </button>
            )}
            <div className="absolute top-2 right-2 flex flex-wrap items-center justify-end gap-2">
              {foto && (
                <button
                  type="button"
                  onClick={() => setFocusDraft(hof.bannerFocusY)}
                  className="flex min-h-11 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition-opacity hover:opacity-90"
                  style={TITELBILD_KNOPF_STIL}
                >
                  <MoveVertical className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
                  Ausschnitt anpassen
                </button>
              )}
              <CoverEditButton
                currentBannerUrl={hof.bannerUrl}
                onGespeichert={onGespeichert}
                meldeErfolg={meldeErfolg}
                onHochladen={onHochladen}
                gross
              />
            </div>
          </>
        )}
      </div>
      {hochformatHinweis && <p className="mt-2 text-xs text-muted-foreground">{hochformatHinweis}</p>}
      <p className="mt-2 text-xs text-muted-foreground">
        Querformat wirkt am besten. Der Ausschnitt gilt für das hohe Titelbild auf der Hofseite.
      </p>
    </div>
  )
}

// ── Logo ─────────────────────────────────────────────────────────────────────

export function LogoUpload({
  logoUrl,
  onUploaded,
  onHochladen,
  meldeErfolg,
}: {
  logoUrl: string | null
  onUploaded: (url: string | null) => void
  /** Meldet, solange ein Foto hochlädt oder gespeichert wird. */
  onHochladen?: (laeuft: boolean) => void
  /** Ersetzt den eigenen Erfolgs-Toast (unter lg: „Gespeichert · Ansehen"). */
  meldeErfolg?: () => void
}): React.JSX.Element {
  const [speichert, startTransition] = useTransition()

  const { isUploading, progress, openFilePicker, fileInput } = useImageUpload({
    variant: 'logo',
    oldUrl: logoUrl ?? undefined,
    onUploaded: (url) => {
      startTransition(async () => {
        const result = await updateFarmLogoAction(url)
        if (result.error) {
          toast.error(result.error)
        } else {
          onUploaded(url)
          if (meldeErfolg) meldeErfolg()
          else toast.success('Logo gespeichert')
        }
      })
    },
  })
  useHochladenMelden(isUploading || speichert, onHochladen)

  async function handleRemove() {
    startTransition(async () => {
      const result = await updateFarmLogoAction(null)
      if (result.error) {
        toast.error(result.error)
      } else {
        onUploaded(null)
        if (meldeErfolg) meldeErfolg()
        else toast.success('Logo entfernt')
      }
    })
  }

  return (
    <div className="flex items-center gap-4">
      {fileInput}
      {/* Runde Vorschau — der Entfernen-Knopf liegt außerhalb des runden
          Rahmens: overflow-hidden schnitte seine 44-px-Trefferfläche ab (Nr. 35). */}
      <div className="relative shrink-0">
        <div className="relative flex size-[72px] items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-muted">
          {logoUrl ? (
            <Image src={logoUrl} alt="Logo" fill sizes="72px" className="object-cover" />
          ) : (
            <Camera className="size-6 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
          )}
        </div>
        {logoUrl && (
          <button
            type="button"
            onClick={handleRemove}
            className={cn('absolute -top-3 -right-3 size-11 rounded-full flex items-center justify-center', FOKUS_RAHMEN)}
            aria-label="Logo entfernen"
          >
            {/* Sichtbar bleibt der kleine Kreis, die Trefferfläche ist der ganze Knopf.
                Theme-fest dunkel auf dem Foto über Tokens (DESIGN_SYSTEM, Bild-Overlays). */}
            <span className="size-5 rounded-full bg-primary-foreground/60 text-accent-foreground flex items-center justify-center">
              <X className="w-3 h-3" aria-hidden="true" />
            </span>
          </button>
        )}
      </div>
      <div>
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isUploading}
          className={cn(
            'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60',
            FOKUS_RAHMEN
          )}
        >
          {isUploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Upload className="size-3.5" aria-hidden="true" />}
          {/* Die Stufe statt eines stummen Spinners: Seit dem Zeitwächter-Umbau
              nennt jeder Hänger seinen Ort. */}
          {isUploading && progress ? stufenText(progress) : logoUrl ? 'Logo ersetzen' : 'Logo hochladen'}
        </button>
        <p className="mt-1 text-xs text-muted-foreground">Rund und quadratisch wirkt am besten · sonst zeigen wir den Anfangsbuchstaben.</p>
      </div>
    </div>
  )
}

// ── Fotos ────────────────────────────────────────────────────────────────────

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
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        <Image src={photo.url} alt={caption || 'Foto'} fill sizes="64px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, 100))}
          onBlur={handleCaptionBlur}
          placeholder="Bildunterschrift (freiwillig)"
          aria-label={`Bildunterschrift zu Foto ${index + 1}`}
          className="h-11 w-full rounded-lg border border-input bg-card px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
        {isSavingCaption && <span className="text-xs text-muted-foreground">Speichert…</span>}
      </div>
      {/* 44-px-Ziele (Nr. 35); die Pfeile übereinander, damit das Feld daneben Platz behält. */}
      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          onClick={() => onMove(photo.id, 'up')}
          disabled={index === 0}
          aria-label={`Foto ${index + 1} nach oben`}
          className={cn(SYMBOL_KNOPF, FOKUS_RAHMEN, 'hover:bg-muted disabled:opacity-30')}
        >
          <ChevronUp className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onMove(photo.id, 'down')}
          disabled={index === total - 1}
          aria-label={`Foto ${index + 1} nach unten`}
          className={cn(SYMBOL_KNOPF, FOKUS_RAHMEN, 'hover:bg-muted disabled:opacity-30')}
        >
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        aria-label={`Foto ${index + 1} löschen`}
        className={cn(SYMBOL_KNOPF, FOKUS_RAHMEN, 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40')}
      >
        {isDeleting ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
      </button>
    </div>
  )
}

/**
 * Die Galerie der Hofseite: bis zu acht Fotos, mit Unterschrift, Reihenfolge
 * und Löschen. Mehrfachauswahl nur hier — Foto für Foto wäre mühsam; Logo
 * und Titelbild bleiben Einzelauswahl.
 */
export function GallerySection({
  initialPhotos,
  onGespeichert,
  meldeErfolg,
  onHochladen,
}: BildBausteinProps & { initialPhotos: FarmPhotoData[] }): React.JSX.Element {
  const [photos, setPhotos] = useState<FarmPhotoData[]>(initialPhotos)
  const canUpload = photos.length < GALERIE_MAX

  function erfolg(sonst: string | null) {
    if (meldeErfolg) meldeErfolg()
    else if (sonst) toast.success(sonst)
    onGespeichert?.()
  }

  const { isUploading, progress, openFilePicker, fileInput } = useImageUpload({
    variant: 'gallery',
    multiple: true,
    maxFiles: GALERIE_MAX - photos.length,
    onUploaded: async (url, { batch }) => {
      const result = await addFarmPhotoAction({ url })
      // In einer Serie zählt der Fehler ins Sammelergebnis — deshalb werfen
      // statt einzeln melden.
      if (result.error) throw new Error(result.error)
      const neu = result.photo
      if (neu) {
        setPhotos((prev) => [...prev, neu])
        // Eine Serie meldet ihr Ergebnis am Ende selbst (useImageUpload, serieGespeichert).
        if (batch) onGespeichert?.()
        else erfolg('Foto hinzugefügt')
      }
    },
    // Hat jedes Foto der Serie geklappt: „Gespeichert · Ansehen" wie nach einem einzelnen (unter lg).
    serieGespeichert: meldeErfolg,
  })
  // onUploaded wird im Upload abgewartet — isUploading deckt das Speichern mit ab.
  useHochladenMelden(isUploading, onHochladen)

  function handleDeleted(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id).map((p, i) => ({ ...p, sortOrder: i })))
    erfolg(null)
  }

  function handleCaptionChange(id: string, caption: string) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, caption: caption || null } : p)))
    erfolg(null)
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
    erfolg(null)
  }

  return (
    <div>
      {fileInput}
      <p className="mb-3 flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
        <span>Bis zu {GALERIE_MAX} Fotos vom Hof — sie stehen auf deiner Hofseite.</span>
        <span className="shrink-0 tabular-nums">
          {photos.length}/{GALERIE_MAX}
        </span>
      </p>

      {photos.length > 0 && (
        <div className="mb-3 space-y-2">
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

      {canUpload ? (
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isUploading}
          className={cn(
            'flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60',
            FOKUS_RAHMEN
          )}
        >
          {isUploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          {/* Der Prozentsatz ist für Mobilfunk gedacht: Das ORIGINAL geht über
              die Leitung (6–8 MB). Ohne bewegte Zahl sieht das nach Absturz aus. */}
          {progress
            ? progress.total > 1
              ? `Foto ${progress.current} von ${progress.total} — ${stufenText(progress)}`
              : stufenText(progress)
            : isUploading
              ? 'Wird hochgeladen…'
              : 'Fotos hinzufügen'}
        </button>
      ) : (
        <p className="py-2 text-center text-xs text-muted-foreground">Mehr als {GALERIE_MAX} Fotos gehen nicht — lösche erst eins.</p>
      )}
    </div>
  )
}
