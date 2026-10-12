'use client'

import { toast } from 'sonner'
import { CircleCheck } from 'lucide-react'
import { MEIN_HOF_ANSICHT_TEXT, UMSCHALTER_AB_PX, gespeichertHinweisId, type GespeichertAbschnitt } from '@/lib/mein-hof-ansicht'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/*
 * „Gespeichert · Ansehen" (Nachtlauf Nr. 49, Register N4): nach dem Speichern
 * auf den Reitern Hofseite und Beiträge. „Ansehen" schaltet auf „So sieht’s
 * die Kundin" und springt zum Abschnitt (die Markierung der Vorschau,
 * MARKIERUNG_TYP). Ein Toast wie jede Erfolgsmeldung im Hofbereich, mit einer
 * Handlung wie „Rückgängig" — gezeichnet als eigene Karte (toast.custom), damit
 * Fokusrahmen, 44-px-Fläche und Farben aus dem Design-System kommen.
 * Produkte hat dafür seinen Teilen-Moment (Nr. 30), keinen zweiten Hinweis.
 */

/** So lange steht der Hinweis — länger als „Rückgängig" (6 s): Er lädt zu einem Blick ein. */
const DAUER_MS = 8000

export function GespeichertAnsehenKarte({
  beschreibung,
  onAnsehen,
}: {
  /** Ein Satz unter „Gespeichert" (beim Beitrag: wohin er ging); sonst nichts. */
  beschreibung?: string
  onAnsehen: () => void
}): React.JSX.Element {
  return (
    <div
      data-slot="gespeichert-ansehen"
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-popover py-2 pr-2 pl-4 text-popover-foreground shadow-lg dark:shadow-none"
    >
      <CircleCheck className="size-[18px] shrink-0 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">
          {MEIN_HOF_ANSICHT_TEXT.gespeichert}
          <span aria-hidden="true" className="font-normal text-muted-foreground">
            {' ·'}
          </span>
        </p>
        {beschreibung && <p className="mt-0.5 text-[12.5px] leading-snug break-words text-muted-foreground">{beschreibung}</p>}
      </div>
      <button
        type="button"
        onClick={onAnsehen}
        className={cn(
          'inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-[14px] font-semibold text-brand-text transition-colors duration-[250ms] hover:bg-muted',
          FOKUS_RAHMEN
        )}
      >
        {MEIN_HOF_ANSICHT_TEXT.ansehen}
      </button>
    </div>
  )
}

/**
 * Zeigt „Gespeichert · Ansehen" — nur unter lg, wo es den Umschalter gibt.
 * Ab lg steht die Vorschau neben der Liste (Hofseite) bzw. gibt es keine
 * Kundenansicht (Beiträge): Dort bleibt der bisherige Toast mit
 * `beschreibung` bzw. „Gespeichert". Je `abschnitt` gibt es den Hinweis nur
 * einmal (gespeichertHinweisId): Ein neues Speichern ersetzt den offenen.
 * Nur im Handler aufrufen, nie beim Rendern.
 */
export function meldeGespeichertAnsehen({
  beschreibung,
  onAnsehen,
  abschnitt = null,
}: {
  beschreibung?: string
  onAnsehen: () => void
  /** Wo gespeichert wurde — dieselbe Stelle ersetzt ihren Hinweis, statt einen zweiten zu stapeln. */
  abschnitt?: GespeichertAbschnitt | null
}): void {
  const id = gespeichertHinweisId(abschnitt)
  if (window.matchMedia(`(min-width: ${UMSCHALTER_AB_PX.lg}px)`).matches) {
    toast.success(beschreibung ?? MEIN_HOF_ANSICHT_TEXT.gespeichert, { id })
    return
  }
  toast.custom(
    (toastId) => (
      <GespeichertAnsehenKarte
        beschreibung={beschreibung}
        onAnsehen={() => {
          toast.dismiss(toastId)
          onAnsehen()
        }}
      />
    ),
    { id, duration: DAUER_MS }
  )
}
