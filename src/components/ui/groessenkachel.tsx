'use client'

import type { ReactNode } from 'react'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Radio } from '@base-ui/react/radio'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/**
 * GroessenWahl + Groessenkachel: Verkaufsgrößen als Kacheln (Futter,
 * Brennmaterial, alles mit Gebinden) — Größe, Hinweis, Preis, Grundpreis,
 * Vorrat (docs/ai/DESIGN_SYSTEM.md, „Kaufstrecke"). Genau eine Größe ist
 * gewählt; Base UI RadioGroup bringt Pfeiltasten und die Ansage „Auswahl,
 * 2 von 4" mit.
 *
 * Die Kachel rechnet und entscheidet nichts: Preise kommen fertig formatiert
 * (format.ts), und ob eine Größe knapp oder ausverkauft ist, sagt der
 * Aufrufer über `zustand` — die Regel dafür gehört in src/lib/.
 */
export function GroessenWahl({
  beschriftung,
  wert,
  standardWert,
  onWertChange,
  children,
  className,
}: {
  /** Name der Auswahl für Screenreader: „Größe wählen". */
  beschriftung: string
  wert?: string
  standardWert?: string
  onWertChange?: (wert: string) => void
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <RadioGroup
      aria-label={beschriftung}
      value={wert}
      defaultValue={standardWert}
      onValueChange={(neu) => onWertChange?.(String(neu))}
      data-slot="groessen-wahl"
      className={cn('grid grid-cols-2 gap-2', className)}
    >
      {children}
    </RadioGroup>
  )
}

export function Groessenkachel({
  wert,
  name,
  hinweis,
  preis,
  grundpreis,
  vorrat,
  zustand = 'normal',
  className,
}: {
  wert: string
  /** „5 kg-Sack", „Rundballen". */
  name: string
  /** „für Kleintiere", „ca. 250 kg". */
  hinweis?: string
  /** Fertig formatiert: „€ 8,00". */
  preis: string
  /** Fertig formatiert: „€ 1,60/kg". */
  grundpreis?: string
  /** „noch 10", „nur noch 8", „ausverkauft". */
  vorrat?: string
  zustand?: 'normal' | 'knapp' | 'ausverkauft'
  className?: string
}): React.JSX.Element {
  return (
    <Radio.Root
      value={wert}
      disabled={zustand === 'ausverkauft'}
      data-slot="groessenkachel"
      data-zustand={zustand}
      className={cn(
        // Die Kachel ist ein role="radio"-Span — die Hand setzt sie selbst (DESIGN_SYSTEM, „Zeiger").
        'flex min-h-[88px] cursor-pointer flex-col gap-0.5 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-foreground transition-colors duration-[250ms] hover:bg-muted',
        'data-[checked]:border-accent data-[checked]:bg-accent/10 data-[checked]:shadow-[inset_0_0_0_0.5px] data-[checked]:shadow-accent',
        'data-[disabled]:cursor-not-allowed data-[disabled]:bg-muted data-[disabled]:hover:bg-muted',
        FOKUS_RAHMEN,
        className
      )}
    >
      <span className="truncate text-[13px] font-semibold" title={name}>
        {name}
      </span>
      {hinweis && <span className="truncate text-[11.5px] text-muted-foreground">{hinweis}</span>}
      {/* Preis und Grundpreis brechen nie in sich um; wird es eng, rutscht der Grundpreis in die nächste Zeile. */}
      <span className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2">
        <span className={cn('font-semibold whitespace-nowrap tabular-nums', zustand === 'ausverkauft' && 'line-through decoration-1')}>
          {preis}
        </span>
        {grundpreis && <span className="text-[11px] whitespace-nowrap text-status-fertig tabular-nums">{grundpreis}</span>}
      </span>
      {vorrat && (
        <span className={cn('text-[11px]', zustand === 'knapp' ? 'font-semibold text-status-offen' : 'text-muted-foreground')}>
          {vorrat}
        </span>
      )}
    </Radio.Root>
  )
}
