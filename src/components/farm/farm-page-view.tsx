'use client'

/*
 * FarmPageView — DIE Hofseite. Es gibt sie genau einmal (ARCHITECTURE §4);
 * genau eine Stelle bindet sie ein, tests/hofseite-einmal.test.ts lässt eine
 * zweite fehlschlagen:
 *
 * src/app/(public)/[farmSlug]/page.tsx — Kundinnen und die Vorschau des
 * Hofs (?vorschau=1, dieselbe Route). Gerendert wird die Hofseite im neuen
 * Design (components/hofseite/hofseite-kunde.tsx, Nachtlauf Nr. 10) in der
 * KundeShell der Seite. Was die Vorschau anders macht, kommt fertig
 * entschieden als `ansicht` aus `ansichtsModus` (src/lib/ansichts-modus.ts):
 * `kaufen` (wirkungslos in der Vorschau) und `art` (der Empfänger für die
 * Markierung des Editors, VorschauImRahmen). Dazu `reorderItems` aus dem
 * Nachbestell-Link — nur, wo Kaufen wirkt. Kein Stift, keine Werkzeugleiste,
 * kein Bearbeitungs-Hinweis.
 *
 * Bis Nr. 49 gab es hier auch den Bearbeitungsmodus des Besitzers mit
 * Stiften (am Handy unter lg auf /farm-page). Seit Nr. 50 bearbeitet Mein Hof
 * mit der Liste der Abschnitte und dem Blatt von unten
 * (components/mein-hof/abschnitte-liste.tsx); der Bearbeitungsmodus ist seit
 * Nr. 50 Runde 1 entfernt. Geblieben ist der Titelbild-Knopf
 * (CoverEditButton), den Mein Hof weiter nutzt; den Ausschnitt wählt seit
 * Nr. 97 der Bild-Baustein (components/shared/bild-ausschnitt.tsx), das
 * frühere CoverFocusAdjust (nur senkrecht) ist entfallen.
 */

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import type { ActiveStatusPost } from '@/server/queries/status-posts'
import { updateFarmBannerAction } from '@/server/actions/appearance'
import { stufenText, useImageUpload } from '@/components/shared/image-upload'
import { HofseiteKunde, type HofseiteHof } from '@/components/hofseite/hofseite-kunde'
import type { SeitenAnsicht } from '@/lib/ansichts-modus'

// ── Titelbild: Knöpfe für Mein Hof ────────────────────────────────────────────

/**
 * Knöpfe, die auf dem Titelbildfoto liegen (Baustein „Titelbild" von Mein
 * Hof, components/mein-hof/bild-bausteine.tsx): in beiden Modi eine weiße
 * Marke mit dunkelgrüner Schrift — das Foto darunter folgt keinem Modus, die
 * Schrift deshalb auch nicht (`--foto-knopf-ink`, in beiden Modi gleich).
 */
export const TITELBILD_KNOPF_STIL = {
  background: 'rgba(255,255,255,0.94)',
  color: 'var(--foto-knopf-ink)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
} as const

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
  currentBannerUrl,
  onGespeichert,
  meldeErfolg,
  onHochladen,
  gross = false,
}: {
  currentBannerUrl: string | null
  onGespeichert?: () => void
  meldeErfolg?: () => void
  onHochladen?: (laeuft: boolean) => void
  gross?: boolean
}): React.JSX.Element {
  const [speichert, startTransition] = useTransition()
  const router = useRouter()

  const { isUploading, progress, openFilePicker, fileInput } = useImageUpload({
    variant: 'banner',
    oldUrl: currentBannerUrl ?? undefined,
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

// ── Die Hofseite ──────────────────────────────────────────────────────────────

type ReorderItem = { productId: string; productName: string; quantity: number }

type Props = {
  /** Der Hof ohne Telefon und E-Mail (Nr. 60) — page.tsx entfernt beide auf dem Server. */
  farm: HofseiteHof
  /** Die aktiven Beiträge, der neueste zuerst (Register F8). */
  beitraege: ActiveStatusPost[]
  reorderItems?: ReorderItem[]
  /**
   * Wer die öffentliche Seite sieht, entschieden von `ansichtsModus`
   * (src/lib/ansichts-modus.ts): In der Vorschau ist Kaufen wirkungslos, und
   * der Editor im Bauern-Bereich darf Abschnitte markieren (vorschau-im-rahmen.tsx).
   * Ohne Angabe: die Seite für Kundinnen.
   */
  ansicht?: Pick<SeitenAnsicht, 'art' | 'kaufen'>
  /**
   * Zeitpunkt der Anfrage (ISO), einmal auf dem Server bestimmt — page.tsx
   * setzt ihn immer.
   */
  jetzt?: string
}

const FUER_KUNDINNEN: Pick<SeitenAnsicht, 'art' | 'kaufen'> = { art: 'kundin', kaufen: true }

export function FarmPageView({ farm, beitraege, reorderItems, ansicht = FUER_KUNDINNEN, jetzt }: Props) {
  // Ohne Zeitpunkt vom Server (kein Aufrufer heute) die eigene Uhr — dann
  // kann „vor N Stunden" zwischen Server und Browser abweichen.
  return <HofseiteKunde farm={farm} beitraege={beitraege} reorderItems={reorderItems} ansicht={ansicht} jetzt={jetzt ?? new Date().toISOString()} />
}
