'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { summarizeUploadBatch, type BatchSkip } from '@/lib/upload-batch'

export type ImageUploadVariant = 'product' | 'banner' | 'logo' | 'gallery' | 'status'

const MAX_LONG_SIDE: Record<ImageUploadVariant, number> = {
  logo:    800,
  product: 2400,
  banner:  2400,
  gallery: 2400,
  status:  2400,
}

/**
 * EIN Wortlaut für „dein Browser kann dieses Format nicht" — die Auswahl-Probe,
 * der späte Resize-Fehler und der Produkt-Dialog melden dasselbe.
 */
export const IMAGE_FORMAT_ERROR =
  'Dieses Bildformat unterstützt dein Browser nicht (z. B. HEIC) — bitte JPEG oder PNG wählen'

/** Kurzform desselben Grundes für die Sammelmeldung einer Serie. */
const FORMAT_KURZ = 'Format nicht unterstützt'

/**
 * Probiert VOR Vorschau und Upload, ob der Browser die Datei überhaupt
 * dekodieren kann. Chrome/Android scheitert hier an HEIC, Safari nicht —
 * genau das ist gewollt, denn Safari kann HEIC anschließend zu JPEG umwandeln.
 *
 * createImageBitmap ist der direkte Weg; die Verkleinerung auf 16px hält den
 * Speicherbedarf klein, denn ein 48-MP-Foto würde sonst unnötig groß im
 * Speicher landen. Ältere Browser ohne createImageBitmap fallen auf das
 * bewährte <img>-Laden zurück.
 */
export async function canDecodeImage(file: File): Promise<boolean> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { resizeWidth: 16, resizeQuality: 'low' })
      bitmap.close?.()
      return true
    } catch {
      return false
    }
  }

  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(true)
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(false)
    }
    img.src = objectUrl
  })
}

export async function resizeToWebP(file: File, maxLongSide: number, quality = 0.82): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const { naturalWidth: w, naturalHeight: h } = img
      const scale = Math.min(1, maxLongSide / Math.max(w, h))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas nicht verfügbar'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      const finish = (blob: Blob) => {
        // Typ und Endung ehrlich aus dem tatsächlichen Encode-Ergebnis ableiten
        const ext = blob.type === 'image/webp' ? '.webp' : '.jpg'
        const outName = file.name.replace(/\.[^.]+$/, '') + ext
        resolve(new File([blob], outName, { type: blob.type }))
      }

      canvas.toBlob(
        (blob) => {
          if (blob && blob.type === 'image/webp') return finish(blob)
          // Safari kann kein WebP und fällt spezifikationsgemäß still auf PNG
          // zurück — dann denselben Canvas als JPEG kodieren
          canvas.toBlob(
            (jpegBlob) => {
              if (!jpegBlob || jpegBlob.type !== 'image/jpeg') {
                return reject(new Error('Bild konnte nicht umgewandelt werden — bitte ein JPEG- oder PNG-Foto wählen'))
              }
              finish(jpegBlob)
            },
            'image/jpeg',
            0.85,
          )
        },
        'image/webp',
        quality,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      // Zweites Netz hinter der Auswahl-Probe — gleicher Wortlaut
      reject(new Error(IMAGE_FORMAT_ERROR))
    }
    img.src = objectUrl
  })
}

/** Ergebnis eines einzelnen Durchlaufs: volle Meldung für Einzelauswahl,
 *  Kurzgrund für die Sammelmeldung einer Serie. */
type UploadResult = { ok: true } | { ok: false; message: string; short: string }

interface UseImageUploadOptions {
  variant: ImageUploadVariant
  targetId?: string
  oldUrl?: string
  /** Mehrfachauswahl — bewusst standardmäßig AUS. Nur die Galerie schaltet sie
   *  ein; Logo, Cover, Status und Produktbild sind Einzelbild-Felder. */
  multiple?: boolean
  /** Höchstzahl der Dateien einer Serie (z. B. freie Galerie-Plätze).
   *  Überzählige werden vor Beginn abgelehnt statt vom Server abgewiesen. */
  maxFiles?: number
  /** Wird nach jedem erfolgreichen Upload aufgerufen. Darf ein Promise
   *  zurückgeben — bei einer Serie wird darauf gewartet, und ein Werfen zählt
   *  das Foto als übersprungen. `meta.batch` sagt, ob gerade eine Serie läuft
   *  (dann keine Einzelmeldung zeigen, es gibt eine Sammelmeldung). */
  onUploaded: (url: string, meta: { batch: boolean }) => void | Promise<void>
}

export function useImageUpload({
  variant,
  targetId,
  oldUrl,
  multiple = false,
  maxFiles,
  onUploaded,
}: UseImageUploadOptions) {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  function resetInput() {
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function uploadOne(file: File, batch: boolean): Promise<UploadResult> {
    if (file.size > 25 * 1024 * 1024) {
      return { ok: false, message: 'Datei zu groß (max. 25 MB)', short: 'zu groß (max. 25 MB)' }
    }

    // Format-Probe VOR allem anderen: so kommt die Absage sofort und nicht
    // erst nach Verkleinern und Hochladen
    if (!(await canDecodeImage(file))) {
      return { ok: false, message: IMAGE_FORMAT_ERROR, short: FORMAT_KURZ }
    }

    try {
      const resized = await resizeToWebP(file, MAX_LONG_SIDE[variant])
      if (resized.size > 3.5 * 1024 * 1024) {
        return {
          ok: false,
          message: 'Bild konnte nicht ausreichend verkleinert werden — bitte kleineres Foto wählen',
          short: 'zu groß nach dem Verkleinern',
        }
      }

      const fd = new FormData()
      fd.append('file', resized)
      fd.append('target', variant)
      if (targetId) fd.append('id', targetId)
      if (oldUrl) fd.append('oldUrl', oldUrl)

      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload fehlgeschlagen' }))
        const text = (err.error as string) ?? 'Upload fehlgeschlagen'
        return { ok: false, message: text, short: text }
      }

      const { url } = await res.json()
      await onUploaded(url as string, { batch })
      return { ok: true }
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Upload fehlgeschlagen'
      return { ok: false, message: text, short: text }
    }
  }

  async function handleSingle(file: File) {
    setIsUploading(true)
    try {
      const result = await uploadOne(file, false)
      if (!result.ok) toast.error(result.message)
    } finally {
      setIsUploading(false)
      resetInput()
    }
  }

  async function handleSeries(files: File[]) {
    const skipped: BatchSkip[] = []
    let liste = files

    // Überzählige vorab aussortieren, statt sie am Server abprallen zu lassen
    if (typeof maxFiles === 'number' && liste.length > maxFiles) {
      if (maxFiles <= 0) {
        toast.error('Kein Platz mehr — bitte zuerst Fotos entfernen.')
        resetInput()
        return
      }
      for (const f of liste.slice(maxFiles)) {
        skipped.push({ name: f.name, reason: 'kein Platz mehr' })
      }
      liste = liste.slice(0, maxFiles)
    }

    setIsUploading(true)
    let uploaded = 0
    try {
      // Sequenziell: schont das Rate-Limit, und ein Fehler bricht die Serie nicht ab
      for (let i = 0; i < liste.length; i++) {
        setProgress({ current: i + 1, total: liste.length })
        const result = await uploadOne(liste[i], true)
        if (result.ok) uploaded++
        else skipped.push({ name: liste[i].name, reason: result.short })
      }
    } finally {
      setProgress(null)
      setIsUploading(false)
      resetInput()
    }

    const text = summarizeUploadBatch(uploaded, skipped)
    if (uploaded === 0) toast.error(text)
    else if (skipped.length > 0) toast.warning(text)
    else toast.success(text)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    // Einzelauswahl behält ihren bisherigen Weg samt Einzelmeldungen
    if (!multiple || files.length === 1) void handleSingle(files[0])
    else void handleSeries(files)
  }

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      multiple={multiple}
      className="hidden"
      onChange={handleInputChange}
    />
  )

  return { isUploading, progress, openFilePicker, fileInput }
}
