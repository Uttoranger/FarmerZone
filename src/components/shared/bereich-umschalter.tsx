'use client'

import { Carrot, Wheat } from 'lucide-react'
import { ANZEIGE_BEREICHE, ANZEIGE_BEREICH_VALUES, type AnzeigeBereich } from '@/lib/taxonomie'
import { cn } from '@/lib/utils'

const ICON: Record<AnzeigeBereich, typeof Carrot> = {
  LEBENSMITTEL: Carrot,
  FUTTERMITTEL: Wheat,
}

/**
 * „Hofladen | Futtermittel" — EIN Umschalter für /hoefe und die Hofseite
 * (Konzept 6.0): volle Breite, zwei gleich breite Hälften, mindestens 44 px
 * hoch, direkt über dem Inhalt, nicht klebend. Die aktive Hälfte ist gefüllt.
 * Vorbild: ein Laden, zwei Welten (Crate & Barrel | Crate & Kids).
 *
 * Er zeigt nur an und meldet die Wahl; wo sie gespeichert wird (URL),
 * entscheidet der Aufrufer. Die Namen kommen aus taxonomie.ts.
 */
export function BereichUmschalter({
  aktiv,
  onWechsel,
  className,
}: {
  aktiv: AnzeigeBereich
  onWechsel: (bereich: AnzeigeBereich) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label="Bereich wählen"
      className={cn('grid w-full grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1', className)}
    >
      {ANZEIGE_BEREICH_VALUES.map((bereich) => {
        const gewaehlt = bereich === aktiv
        const Icon = ICON[bereich]
        return (
          <button
            key={bereich}
            type="button"
            aria-pressed={gewaehlt}
            onClick={() => onWechsel(bereich)}
            className={cn(
              'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              gewaehlt
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {ANZEIGE_BEREICHE[bereich].titel}
          </button>
        )
      })}
    </div>
  )
}
