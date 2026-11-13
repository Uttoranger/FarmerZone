'use client'

/*
 * Der Titelbild-Knopf von Mein Hof (Baustein „Titelbild“, components/mein-hof/bild-bausteine.tsx).
 * Bis Nr. 306 stand er in farm-page-view.tsx, der Hofseite: Jede Kundin lud ihn dort mit
 * Upload-Logik und Server-Action, obwohl ihn nur der Hof braucht. Eigene Datei, damit das
 * Paket der Hofseite ihn nicht mehr trägt (CI-Schritt „Kein Hof-Code im Paket der Hofseite“).
 * farm-page-view.tsx bindet diese Datei nie ein. Nicht unter components/mein-hof/: Dort
 * meldet tests/hof-aktionen-netz-wache.test.ts jeden Action-Aufruf ohne `try`, und der
 * Knopf ruft `updateFarmBannerAction` in `startTransition`.
 */

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import { updateFarmBannerAction } from '@/server/actions/appearance'
import { stufenText, useImageUpload } from '@/components/shared/image-upload'
import { TITELBILD_KNOPF_STIL } from '@/components/farm/farm-page-view'

/**
 * „Titelbild ersetzen" — im Baustein „Titelbild" von Mein Hof
 * (components/mein-hof/bild-bausteine.tsx: ab lg im Editor, unter lg seit
 * Nr. 50 im Blatt), der über `onGespeichert`
 * seine Vorschau neu lädt. `meldeErfolg` ersetzt den eigenen Toast — in Mein
 * Hof unter lg durch „Gespeichert · Ansehen" (Nr. 49). `onHochladen` meldet,
 * solange hochgeladen und gespeichert wird: Das Blatt bleibt dann offen,
 * sonst hinge das Datei-Feld mitten im Upload aus (CODING_STANDARDS §8).
 * `gross` macht den Knopf 44 px hoch (Touch-Ziel im Blatt, Nr. 50).
 */
export function CoverEditButton({
  onGespeichert,
  meldeErfolg,
  onHochladen,
  gross = false,
}: {
  onGespeichert?: () => void
  meldeErfolg?: () => void
  onHochladen?: (laeuft: boolean) => void
  gross?: boolean
}): React.JSX.Element {
  const [speichert, startTransition] = useTransition()
  const router = useRouter()

  const { isUploading, progress, openFilePicker, fileInput } = useImageUpload({
    variant: 'banner',
    onUploaded: (url) => {
      startTransition(async () => {
        const result = await updateFarmBannerAction('PHOTO', url)
        if (result.error) {
          toast.error(result.error)
        } else {
          if (meldeErfolg) meldeErfolg()
          else toast.success('Titelbild aktualisiert')
          router.refresh()
          onGespeichert?.()
        }
      })
    },
  })
  const laeuft = isUploading || speichert
  useEffect(() => {
    if (!onHochladen) return
    onHochladen(laeuft)
    return () => {
      if (laeuft) onHochladen(false)
    }
  }, [laeuft, onHochladen])

  return (
    <>
      {fileInput}
      <button
        type="button"
        onClick={openFilePicker}
        disabled={isUploading}
        className={`flex items-center gap-1.5 ${gross ? 'min-h-11' : 'h-9'} px-3.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60`}
        style={TITELBILD_KNOPF_STIL}
      >
        <Camera className="size-3.5" strokeWidth={1.7} />
        {isUploading ? (progress ? stufenText(progress) : 'Lädt…') : 'Titelbild ersetzen'}
      </button>
    </>
  )
}
