'use client'

import { NumberField } from '@base-ui/react/number-field'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/**
 * Stepper: Menge mit − und +. Base UI NumberField bringt die Tastatur mit
 * (Pfeil hoch/runter im Feld, Bild-Tasten für große Schritte), sperrt an
 * `min`/`max` und kündigt den Wert als Zahlenfeld an. Die Knöpfe sind 44 px
 * groß, der sichtbare Kreis 32 px wie im Mockup.
 *
 * Der Stepper kennt keinen Bestand: Wie viel höchstens geht, entscheidet der
 * Aufrufer (`max`) — verbindlich prüft ohnehin der Server.
 */
export function Stepper({
  beschriftung,
  wert,
  standardWert,
  onWertChange,
  min = 0,
  max,
  disabled,
  className,
}: {
  /** Wofür die Zahl steht, für Screenreader: „Menge Freilandeier". */
  beschriftung: string
  wert?: number
  standardWert?: number
  onWertChange?: (wert: number) => void
  min?: number
  max?: number
  disabled?: boolean
  className?: string
}): React.JSX.Element {
  const knopf = cn(
    'group/knopf flex size-11 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40',
    FOKUS_RAHMEN
  )
  const kreis =
    'flex size-8 items-center justify-center rounded-full border border-border text-foreground transition-colors duration-[250ms] group-hover/knopf:bg-muted'
  return (
    <NumberField.Root
      value={wert}
      defaultValue={standardWert}
      onValueChange={(neu) => onWertChange?.(neu ?? min)}
      min={min}
      max={max}
      disabled={disabled}
      data-slot="stepper"
      className={cn('inline-flex', className)}
    >
      <NumberField.Group className="flex items-center">
        <NumberField.Decrement aria-label={`${beschriftung}: eins weniger`} className={knopf}>
          <span className={kreis}>
            <Minus className="size-4" strokeWidth={1.7} aria-hidden="true" />
          </span>
        </NumberField.Decrement>
        <NumberField.Input
          aria-label={beschriftung}
          className={cn('h-11 w-10 rounded-lg bg-transparent text-center text-[15px] font-semibold tabular-nums', FOKUS_RAHMEN)}
        />
        <NumberField.Increment aria-label={`${beschriftung}: eins mehr`} className={knopf}>
          <span className={kreis}>
            <Plus className="size-4" strokeWidth={1.7} aria-hidden="true" />
          </span>
        </NumberField.Increment>
      </NumberField.Group>
    </NumberField.Root>
  )
}
