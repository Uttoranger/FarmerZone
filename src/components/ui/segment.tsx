'use client'

import { useState } from 'react'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import { Toggle } from '@base-ui/react/toggle'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

export type SegmentOption = { wert: string; label: string }

/**
 * Segment: ein Umschalter mit genau einer Wahl („Handy | Web"). Für einen
 * Zustand auf der Seite — ein Filter, der in die Adresse gehört, ist ein
 * FilterChip (Link). Für Zeitraum, Umkreis, Hofladen/Futtermittel und
 * Darstellung gilt seit Nr. 247 die ChipGruppe unten (G11); die Seiten ziehen
 * Route für Route um.
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

/** Eine Wahl der Chip-Gruppe; `zahl` steht mit „ · “ hinter dem Namen („10 km · 4“, Register N23: jede Stufe nennt die Zahl). */
export type ChipGruppeOption = SegmentOption & { zahl?: number }

/** Der Name einer Wahl, wie er im Chip steht: „10 km · 4“ — ohne Zahl nur der Name. */
export function chipGruppeText(option: ChipGruppeOption): string {
  return option.zahl === undefined ? option.label : `${option.label} · ${option.zahl}`
}

/**
 * Chip-Gruppe (G11, Liste Lauf 32; Boards s1-region, s2-konto-hof, w2-auswertung):
 * eine Reihe Pillen mit genau einer Wahl, statt des Segments für Zeitraum,
 * Umkreis, Hofladen/Futtermittel und Darstellung. Die gewählte Pille ist
 * gefüllt — hell dunkel, dunkel hell (`bg-foreground`) —, die anderen tragen den
 * Feldrand (≥ 3:1 in beiden Themes; vorher fehlte im Dunkeln der Umriss).
 * 44 px hoch, 14 px halbfett wie im Board.
 *
 * Wie im Board eine Gruppe aus Knöpfen mit `aria-pressed` (role="group"):
 * Tab geht von Pille zu Pille, Enter oder Leertaste wählt. Dieselbe Wahl noch
 * einmal tippen ändert nichts — eine Gruppe ohne Wahl gibt es nicht; wie das
 * Segment hält sie ihren Wert selbst, auch ohne `wert` von außen. Gehört die
 * Wahl in die Adresse (Zeitraum der Auswertung), sind es FilterChips
 * (ui/chip.tsx) in derselben Gestalt.
 */
export function ChipGruppe({
  beschriftung,
  optionen,
  wert,
  standardWert,
  onWertChange,
  className,
}: {
  /** Wofür gewählt wird, für Screenreader: „Umkreis". */
  beschriftung: string
  optionen: readonly ChipGruppeOption[]
  wert?: string
  standardWert?: string
  onWertChange?: (wert: string) => void
  className?: string
}): React.JSX.Element {
  const [eigener, setEigener] = useState(standardWert ?? optionen[0]?.wert ?? '')
  const aktuell = wert ?? eigener

  return (
    <div role="group" aria-label={beschriftung} data-slot="chip-gruppe" className={cn('flex flex-wrap gap-2', className)}>
      {optionen.map((option) => {
        const gewaehlt = option.wert === aktuell
        return (
          <button
            key={option.wert}
            type="button"
            aria-pressed={gewaehlt}
            onClick={() => {
              if (gewaehlt) return
              setEigener(option.wert)
              onWertChange?.(option.wert)
            }}
            className={cn(CHIP_GRUPPE_PILLE, gewaehlt ? CHIP_GRUPPE_GEWAEHLT : CHIP_GRUPPE_OFFEN)}
          >
            {chipGruppeText(option)}
          </button>
        )
      })}
    </div>
  )
}

/** Gestalt einer Pille der Chip-Gruppe — auch für Seiten, die die Wahl als Link bauen. */
export const CHIP_GRUPPE_PILLE = cn(
  'inline-flex min-h-11 shrink-0 items-center rounded-full border px-3.5 text-[14px] font-semibold whitespace-nowrap transition-colors duration-[250ms]',
  FOKUS_RAHMEN
)
export const CHIP_GRUPPE_GEWAEHLT = 'border-foreground bg-foreground text-background'
export const CHIP_GRUPPE_OFFEN = 'border-input bg-card text-foreground hover:bg-muted'
