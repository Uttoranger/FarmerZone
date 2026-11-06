'use client'

import { NumberField } from '@base-ui/react/number-field'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/**
 * Stepper (G13, Lauf 32, Nr. 248): Menge als gerahmte Pille „− n +“, die
 * Einheit neben der Zahl (Vorrat-Blatt, Menge auf der Produktseite; Boards
 * s1-produkte Bild 2, s1-/w1-produkt). Base UI NumberField bringt die Tastatur
 * mit (Pfeil hoch/runter im Feld, Bild-Tasten für große Schritte), sperrt an
 * `min`/`max` und kündigt den Wert als Zahlenfeld an. Die Knöpfe sind 44 px
 * (groß 56 px) breit und so hoch wie die Pille — die Trefferfläche bleibt.
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
  /** Große Darstellung im Blatt (Vorrat ändern, Register N25): Pille 56 px hoch, große Zahl. */
  gross?: boolean
  /** Die Einheit neben der Zahl („kg", „Pakete") — in der Pille, leise. */
  einheit?: string
}): React.JSX.Element {
  // Die Knöpfe liegen IN der Pille: kein eigener Kreis mehr, der Rahmen gehört der Gruppe (G13).
  const knopf = cn(
    'flex shrink-0 items-center justify-center self-stretch rounded-full text-foreground transition-colors duration-[250ms] hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
    gross ? 'w-14' : 'w-11',
    FOKUS_RAHMEN
  )
  const symbol = gross ? 'size-5' : 'size-4'
  const eingabe = (
    <NumberField.Input
      aria-label={beschriftung}
      // Nur gesetzt überschreiben: ein undefined schlüge sonst die Wahl von Base UI aus.
      {...(inputMode && { inputMode })}
      className={cn(
        'min-w-0 rounded-md bg-transparent text-center tabular-nums',
        gross ? 'h-12 w-20 text-[32px] leading-none font-bold' : 'h-9 w-9 text-[15px] font-semibold',
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
      <NumberField.Group
        data-slot="stepper-pille"
        className={cn('flex items-center rounded-full border border-border bg-card', gross ? 'h-14 gap-1 px-1' : 'h-11')}
      >
        <NumberField.Decrement aria-label={`${beschriftung}: eins weniger`} className={knopf}>
          <Minus className={symbol} strokeWidth={1.7} aria-hidden="true" />
        </NumberField.Decrement>
        <span className="flex items-baseline justify-center gap-1">
          {eingabe}
          {einheit && <span className={cn('font-semibold text-muted-foreground', gross ? 'pr-1 text-lg' : 'pr-0.5 text-[13px]')}>{einheit}</span>}
        </span>
        <NumberField.Increment aria-label={`${beschriftung}: eins mehr`} className={knopf}>
          <Plus className={symbol} strokeWidth={1.7} aria-hidden="true" />
        </NumberField.Increment>
      </NumberField.Group>
    </NumberField.Root>
  )
}
