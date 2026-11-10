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
 * Zwei Formen: `kreis` (Vorgabe, der Stand vor Lauf 32 — zwei Kreisknöpfe,
 * groß mit Unterstrich) und `pille` (G13, Lauf 32, Nr. 248; Boards
 * s1-produkte Bild 2, s1-/w1-produkt): eine gerahmte Pille „− n +“ mit der
 * Einheit neben der Zahl, die Knöpfe ohne eigenen Kreis, 44 px (groß 56 px)
 * breit und so hoch wie die Pille. Die Seiten-Nummern stellen ihre Route
 * einzeln auf `pille` um — die Vorgabe bleibt, damit nichts auf einmal umspringt.
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
  form = 'kreis',
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
  /** `kreis` (Vorgabe, Stand vor Lauf 32) oder `pille` (G13) — in der Pille steht die Einheit auch klein. */
  form?: 'kreis' | 'pille'
}): React.JSX.Element {
  if (form === 'pille') {
    return (
      <StepperPille
        beschriftung={beschriftung}
        wert={wert}
        standardWert={standardWert}
        onWertChange={onWertChange}
        onWertBestaetigt={onWertBestaetigt}
        min={min}
        max={max}
        disabled={disabled}
        laeuft={laeuft}
        className={className}
        eingabeClassName={eingabeClassName}
        inputMode={inputMode}
        gross={gross}
        einheit={einheit}
      />
    )
  }
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

/** Die Pille (G13): ein Rahmen um −, Zahl, Einheit und +. Rand `border-input` — Rand eines Bedienelements, ≥ 3:1 (DESIGN_SYSTEM, „Feldrand“). */
function StepperPille({
  beschriftung,
  wert,
  standardWert,
  onWertChange,
  onWertBestaetigt,
  min,
  max,
  disabled,
  laeuft,
  className,
  eingabeClassName,
  inputMode,
  gross,
  einheit,
}: {
  beschriftung: string
  wert?: number
  standardWert?: number
  onWertChange?: (wert: number) => void
  onWertBestaetigt?: (wert: number) => void
  min: number
  max?: number
  disabled?: boolean
  laeuft?: boolean
  className?: string
  eingabeClassName?: string
  inputMode?: 'numeric' | 'decimal'
  gross: boolean
  einheit?: string
}): React.JSX.Element {
  // Die Knöpfe liegen IN der Pille: kein eigener Kreis, der Rahmen gehört der Gruppe.
  const knopf = cn(
    'flex shrink-0 items-center justify-center self-stretch rounded-full text-foreground transition-colors duration-[250ms] hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
    gross ? 'w-14' : 'w-11',
    FOKUS_RAHMEN
  )
  const symbol = gross ? 'size-5' : 'size-4'
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
      data-form="pille"
      aria-busy={laeuft || undefined}
      className={cn('inline-flex', className)}
    >
      <NumberField.Group
        data-slot="stepper-pille"
        className={cn('flex items-center rounded-full border border-input bg-card', gross ? 'h-14 gap-1 px-1' : 'h-11')}
      >
        <NumberField.Decrement aria-label={`${beschriftung}: eins weniger`} className={knopf}>
          <Minus className={symbol} strokeWidth={1.7} aria-hidden="true" />
        </NumberField.Decrement>
        <span className="flex items-baseline justify-center gap-1">
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
          {einheit && <span className={cn('font-semibold text-muted-foreground', gross ? 'pr-1 text-lg' : 'pr-0.5 text-[13px]')}>{einheit}</span>}
        </span>
        <NumberField.Increment aria-label={`${beschriftung}: eins mehr`} className={knopf}>
          <Plus className={symbol} strokeWidth={1.7} aria-hidden="true" />
        </NumberField.Increment>
      </NumberField.Group>
    </NumberField.Root>
  )
}
