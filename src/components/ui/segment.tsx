'use client'

import { useState } from 'react'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import { Toggle } from '@base-ui/react/toggle'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

export type SegmentOption = { wert: string; label: string }

/**
 * Segment: ein Umschalter mit genau einer Wahl („Handy | Web", „10 km |
 * 25 km | 50 km"). Für einen Zustand auf der Seite — ein Filter, der in die
 * Adresse gehört, ist ein FilterChip (Link).
 *
 * Base UI ToggleGroup: Pfeiltasten wandern, Enter/Leertaste wählt, jede Wahl
 * ist als „gedrückt" angekündigt. Eine Wahl lässt sich nicht abwählen —
 * ein Umschalter ohne Stellung gäbe es im Mockup nicht; deshalb hält der
 * Baustein seinen Wert selbst, auch ohne `wert` von außen.
 */
export function Segment({
  beschriftung,
  optionen,
  wert,
  standardWert,
  onWertChange,
  className,
}: {
  /** Wofür umgeschaltet wird, für Screenreader: „Vorschau-Gerät". */
  beschriftung: string
  optionen: readonly SegmentOption[]
  wert?: string
  standardWert?: string
  onWertChange?: (wert: string) => void
  className?: string
}): React.JSX.Element {
  const [eigener, setEigener] = useState(standardWert ?? optionen[0]?.wert ?? '')
  const aktuell = wert ?? eigener

  return (
    <ToggleGroup
      // Base UI setzt aria-orientation, das an role="group" nicht erlaubt ist
      // (Axe aria-allowed-attr); eine Werkzeugleiste aus Umschaltknöpfen ist
      // das passende ARIA-Muster und kennt die Ausrichtung.
      role="toolbar"
      aria-label={beschriftung}
      value={[aktuell]}
      onValueChange={(neu) => {
        const gewaehlt = neu.find((w) => w !== aktuell) ?? neu[0]
        // Leere Auswahl heißt „dieselbe Wahl noch einmal getippt" — bleibt stehen.
        if (!gewaehlt || gewaehlt === aktuell) return
        setEigener(gewaehlt)
        onWertChange?.(gewaehlt)
      }}
      data-slot="segment"
      className={cn('inline-flex max-w-full gap-[3px] rounded-full border border-border bg-background p-[3px]', className)}
    >
      {optionen.map((option) => (
        <Toggle
          key={option.wert}
          value={option.wert}
          className={cn(
            "relative h-8 rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap text-muted-foreground transition-colors duration-[250ms] before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] hover:text-foreground data-[pressed]:bg-border data-[pressed]:font-semibold data-[pressed]:text-foreground",
            FOKUS_RAHMEN
          )}
        >
          {option.label}
        </Toggle>
      ))}
    </ToggleGroup>
  )
}
