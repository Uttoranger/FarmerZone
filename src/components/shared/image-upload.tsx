'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'

export type ImageUploadVariant = 'product' | 'banner' | 'logo' | 'gallery' | 'status'

const MAX_LONG_SIDE: Record<ImageUploadVariant, number> = {
  logo:    800,
  product: 2400,
  banner:  2400,
  gallery: 2400,
  status:  2400,
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
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Canvas toBlob fehlgeschlagen'))
          const outName = file.name.replace(/\.[^.]+$/, '.webp')
          resolve(new File([blob], outName, { type: 'image/webp' }))
        },
        'image/webp',
        quality,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Bild konnte nicht geladen werden'))
    }
    img.src = objectUrl
  })
}

interface UseImageUploadOptions {
  variant: ImageUploadVariant
  targetId?: string
  oldUrl?: string
  onUploaded: (url: string) => void
}

export function useImageUpload({ variant, targetId, oldUrl, onUploaded }: UseImageUploadOptions) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  async function handleFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Datei zu groß (max. 10 MB)')
      return
    }

    setIsUploading(true)
    try {
      const resized = await resizeToWebP(file, MAX_LONG_SIDE[variant])
      const fd = new FormData()
      fd.append('file', resized)
      fd.append('target', variant)
      if (targetId) fd.append('id', targetId)
      if (oldUrl) fd.append('oldUrl', oldUrl)

      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload fehlgeschlagen' }))
        toast.error(err.error ?? 'Upload fehlgeschlagen')
        return
      }
      const { url } = await res.json()
      onUploaded(url as string)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload fehlgeschlagen')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
  }

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={handleInputChange}
    />
  )

  return { isUploading, openFilePicker, fileInput }
}
