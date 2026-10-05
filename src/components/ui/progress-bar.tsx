'use client'

import { Progress } from '@base-ui/react/progress'
import { cn } from '@/lib/utils'
import { formatZahl } from '@/lib/format'

/**
 * ProgressBar: Fortschritt als Balken, z. B. „Deine Hofseite · 64 %".
 * Base UI Progress kündigt Wert und Beschriftung als Fortschrittsanzeige an.
 * Grün heißt „erledigt wächst", Orange „noch offen" (Farbrollen).
 *
 * Die Prozentzahl rechnet der Baustein aus Wert und Maximum („3 von 8" →
 * „38 %") und schreibt sie über formatZahl — Base UIs eigene Formatierung
 * nähme den Wert als Prozent, auch wenn das Maximum nicht 100 ist.
 */
export function ProgressBar({
  beschriftung,
  wert,
  max = 100,
  ton = 'gruen',
  zeigeWert = true,
  className,
}: {
  /** Sichtbare Beschriftung über dem Balken. */
  beschriftung: string
  wert: number
  max?: number
  ton?: 'gruen' | 'orange'
  zeigeWert?: boolean
  className?: string
}): React.JSX.Element {
  const prozent = `${formatZahl(max > 0 ? Math.round((wert / max) * 100) : 0)} %`
  return (
    <Progress.Root
      value={wert}
      max={max}
      aria-valuetext={prozent}
      data-slot="progress-bar"
      className={cn('grid gap-1.5', className)}
    >
      <div className="flex items-baseline gap-2">
        <Progress.Label className="text-[13.5px] font-semibold text-foreground">{beschriftung}</Progress.Label>
        {zeigeWert && (
          <Progress.Value
            className={cn('text-[12.5px] font-semibold tabular-nums', ton === 'gruen' ? 'text-status-fertig' : 'text-status-offen')}
          >
            {() => prozent}
          </Progress.Value>
        )}
      </div>
      <Progress.Track className="h-1.5 overflow-hidden rounded-full bg-muted">
        <Progress.Indicator
          className={cn('h-full rounded-full transition-[width] duration-500', ton === 'gruen' ? 'bg-accent' : 'bg-primary')}
        />
      </Progress.Track>
    </Progress.Root>
  )
}
