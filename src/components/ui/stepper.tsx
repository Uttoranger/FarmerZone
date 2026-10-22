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
  onWertBestaetigt,
  min = 0,
  max,
  disabled,
  laeuft,
  className,
  eingabeClassName,
  inputMode,
  gross = false,
  einheit,
}: {
  /** Wofür die Zahl steht, für Screenreader: „Menge Freilandeier". */
  beschriftung: string
  wert?: number
  standardWert?: number
  onWertChange?: (wert: number) => void
  /**
   * Der Wert ist fertig: nach dem Loslassen von − oder +, nach dem Tippen beim
   * Verlassen des Felds, bei Pfeiltasten sofort (Base UI `onValueCommitted`).
   * Für Werte, die erst dann zum Server gehen (Vorrat in der Produkttabelle) —
   * nicht bei jedem Tastendruck.
   */
  onWertBestaetigt?: (wert: number) => void
  min?: number
  max?: number
  disabled?: boolean
  /** Ein Speichern läuft: `aria-busy`, bedienbar bleibt der Stepper (kein Fokusverlust). */
  laeuft?: boolean
  className?: string
  /** Breite des Zahlenfelds, wenn mehr als zwei Stellen erwartet werden (Vorrat). */
  eingabeClassName?: string
  /**
   * Die Tastatur am Handy. Base UI wählt selbst und nimmt auf iOS `decimal`
   * (mit Komma) — für ganze Zahlen wie den Vorrat reicht der Aufrufer `numeric` durch.
   */
  inputMode?: 'numeric' | 'decimal'
  /** Große Darstellung im Blatt (Vorrat ändern, Register N25): Knöpfe 56 px, große Zahl. */
  gross?: boolean
  /** Die Einheit neben der Zahl, nur in der großen Darstellung („kg", „Pakete"). */
  einheit?: string
}): React.JSX.Element {
  const knopf = cn(
    'group/knopf flex shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40',
    gross ? 'size-14' : 'size-11',
    FOKUS_RAHMEN
  )
  const kreis = cn(
    'flex items-center justify-center rounded-full border border-border text-foreground transition-colors duration-[250ms] group-hover/knopf:bg-muted',
    gross ? 'size-14 bg-card' : 'size-8'
  )
  const symbol = gross ? 'size-5' : 'size-4'
  const eingabe = (
    <NumberField.Input
      aria-label={beschriftung}
      // Nur gesetzt überschreiben: ein undefined schlüge sonst die Wahl von Base UI aus.
      {...(inputMode && { inputMode })}
      className={cn(
        'rounded-lg bg-transparent tabular-nums',
        gross ? 'h-14 w-24 text-right text-[46px] leading-none font-bold' : 'h-11 w-10 text-center text-[15px] font-semibold',
        FOKUS_RAHMEN,
        eingabeClassName
      )}
    />
  )
  return (
    <NumberField.Root
      value={wert}
      defaultValue={standardWert}
      onValueChange={(neu) => onWertChange?.(neu ?? min)}
      onValueCommitted={onWertBestaetigt ? (neu) => onWertBestaetigt(neu ?? min) : undefined}
      min={min}
      max={max}
      disabled={disabled}
      data-slot="stepper"
      aria-busy={laeuft || undefined}
      className={cn('inline-flex', className)}
    >
      <NumberField.Group className={cn('flex items-center', gross && 'gap-4')}>
        <NumberField.Decrement aria-label={`${beschriftung}: eins weniger`} className={knopf}>
          <span className={kreis}>
            <Minus className={symbol} strokeWidth={1.7} aria-hidden="true" />
          </span>
        </NumberField.Decrement>
        {gross ? (
          <span className="flex items-baseline gap-1.5 border-b-2 border-status-fertig px-1.5 pb-0.5">
            {eingabe}
            {einheit && <span className="text-xl font-semibold text-muted-foreground">{einheit}</span>}
          </span>
        ) : (
          eingabe
        )}
        <NumberField.Increment aria-label={`${beschriftung}: eins mehr`} className={knopf}>
          <span className={kreis}>
            <Plus className={symbol} strokeWidth={1.7} aria-hidden="true" />
          </span>
        </NumberField.Increment>
      </NumberField.Group>
    </NumberField.Root>
  )
}
