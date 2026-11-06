'use client'

import type { ReactNode } from 'react'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Radio } from '@base-ui/react/radio'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'

/**
 * GroessenWahl + Groessenkachel (G5, Lauf 32, Nr. 248; Boards s1-/w1-produkt Bild 1, Futterkarte der Region):
 * Verkaufsgrößen als Zeilen untereinander — links der Radio-Kreis, daneben der Name („Sack, 25 kg“), darunter
 * Grundpreis und Vorrat („€ 0,51 / kg · noch 14“) bzw. „gerade nicht da“, rechts der Preis. Auch eine leere Größe
 * zeigt ihren Preis (die Kundin sieht, was sie kostet, wenn sie wieder da ist). Genau eine Größe ist gewählt; Base
 * UI RadioGroup bringt Pfeiltasten und die Ansage „Auswahl, 2 von 4" mit.
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
      className={cn('grid grid-cols-1 gap-2', className)}
    >
      {children}
    </RadioGroup>
  )
}

/** Was eine leere Größe statt des Vorrats sagt (Board s1-/w1-produkt Bild 1). */
export const GROESSE_NICHT_DA = 'gerade nicht da'

/** „Sack, 25 kg“ — der Name, dahinter der Hinweis (Menge je Gebinde), wenn es einen gibt. */
export function groessenName(name: string, hinweis?: string): string {
  return hinweis ? `${name}, ${hinweis}` : name
}

/** Die Zeile unter dem Namen: Grundpreis und Vorrat mit „ · “; bei einer leeren Größe „gerade nicht da“ statt des Vorrats. */
export function groessenUnterzeile(grundpreis: string | undefined, vorrat: string | undefined, zustand: 'normal' | 'knapp' | 'ausverkauft'): string {
  return [grundpreis, zustand === 'ausverkauft' ? GROESSE_NICHT_DA : vorrat].filter(Boolean).join(' · ')
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
  /** „Sack", „5 kg-Sack", „Rundballen". */
  name: string
  /** „25 kg", „für Kleintiere", „ca. 250 kg" — steht nach einem Komma hinter dem Namen. */
  hinweis?: string
  /** Fertig formatiert: „€ 12,72". */
  preis: string
  /** Fertig formatiert: „€ 0,51 / kg". */
  grundpreis?: string
  /** „noch 14", „nur noch 8" — bei `ausverkauft` steht „gerade nicht da“ statt dieses Texts. */
  vorrat?: string
  zustand?: 'normal' | 'knapp' | 'ausverkauft'
  className?: string
}): React.JSX.Element {
  const titel = groessenName(name, hinweis)
  const unterzeile = groessenUnterzeile(grundpreis, vorrat, zustand)
  return (
    <Radio.Root
      value={wert}
      disabled={zustand === 'ausverkauft'}
      data-slot="groessenkachel"
      data-zustand={zustand}
      className={cn(
        // Die Kachel ist ein role="radio"-Span — die Hand setzt sie selbst (DESIGN_SYSTEM, „Zeiger").
        'group/groesse flex min-h-[64px] cursor-pointer items-center gap-3 border border-border bg-card px-3.5 py-3 text-left text-foreground transition-colors duration-[250ms] hover:bg-muted',
        RUNDUNG.karte,
        'data-[checked]:border-accent data-[checked]:bg-accent/10 data-[checked]:shadow-[inset_0_0_0_0.5px] data-[checked]:shadow-accent',
        'data-[disabled]:cursor-not-allowed data-[disabled]:hover:bg-card',
        FOKUS_RAHMEN,
        className
      )}
    >
      {/* Der Kreis zeigt die Wahl; angesagt wird sie über role="radio" der Kachel selbst. */}
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-border group-data-[checked]/groesse:border-accent group-data-[disabled]/groesse:opacity-50"
      >
        <Radio.Indicator className="size-2.5 rounded-full bg-accent" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold text-pretty">{titel}</span>
        {unterzeile && (
          <span className={cn('text-[13px] tabular-nums', zustand === 'knapp' ? 'font-semibold text-status-offen' : 'text-muted-foreground')}>
            {unterzeile}
          </span>
        )}
      </span>
      {/* Der Preis bricht nie in sich um; auch eine leere Größe zeigt ihn — gedämpft, nicht durchgestrichen. */}
      <span className={cn('shrink-0 text-[15px] font-bold whitespace-nowrap tabular-nums', zustand === 'ausverkauft' && 'text-muted-foreground')}>{preis}</span>
    </Radio.Root>
  )
}
