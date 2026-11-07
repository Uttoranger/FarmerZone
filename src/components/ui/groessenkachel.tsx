'use client'

import type { ReactNode } from 'react'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Radio } from '@base-ui/react/radio'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'

/**
 * GroessenWahl + Groessenkachel: Verkaufsgrößen als Kacheln (Futter,
 * Brennmaterial, alles mit Gebinden) — Größe, Hinweis, Preis, Grundpreis,
 * Vorrat (docs/ai/DESIGN_SYSTEM.md, „Kaufstrecke"). Genau eine Größe ist
 * gewählt; Base UI RadioGroup bringt Pfeiltasten und die Ansage „Auswahl,
 * 2 von 4" mit.
 *
 * Zwei Formen: `kachel` (Vorgabe, der Stand vor Lauf 32 — zwei Spalten) und
 * `zeile` (G5, Lauf 32, Nr. 248; Boards s1-/w1-produkt Bild 1, Futterkarte der
 * Region): Zeilen untereinander, links der Radio-Kreis, daneben „Sack, 25 kg“,
 * darunter „€ 0,51 / kg · noch 14“ bzw. „gerade nicht da“, rechts der Preis.
 * Die Seiten-Nummern stellen ihre Route einzeln auf `zeile` um — die Vorgabe
 * bleibt, damit nichts auf einmal umspringt. `form` an GroessenWahl und an
 * jeder Kachel gleich setzen.
 *
 * Die Kachel rechnet und entscheidet nichts: Preise kommen fertig formatiert
 * (format.ts), und ob eine Größe knapp oder ausverkauft ist, sagt der
 * Aufrufer über `zustand` — die Regel dafür gehört in src/lib/.
 */
export type GroessenForm = 'kachel' | 'zeile'

export function GroessenWahl({
  beschriftung,
  wert,
  standardWert,
  onWertChange,
  children,
  className,
  form = 'kachel',
}: {
  /** Name der Auswahl für Screenreader: „Größe wählen". */
  beschriftung: string
  wert?: string
  standardWert?: string
  onWertChange?: (wert: string) => void
  children: ReactNode
  className?: string
  /** `zeile` (G5): eine Spalte statt zwei. */
  form?: GroessenForm
}): React.JSX.Element {
  return (
    <RadioGroup
      aria-label={beschriftung}
      value={wert}
      defaultValue={standardWert}
      onValueChange={(neu) => onWertChange?.(String(neu))}
      data-slot="groessen-wahl"
      className={cn(form === 'zeile' ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-2 gap-2', className)}
    >
      {children}
    </RadioGroup>
  )
}

/** Was eine leere Größe in der Zeile (G5) statt des Vorrats sagt (Board s1-/w1-produkt Bild 1). */
export const GROESSE_NICHT_DA = 'gerade nicht da'

/** „Sack, 25 kg“ — der Name, dahinter der Hinweis (Menge je Gebinde), wenn es einen gibt (G5). */
export function groessenName(name: string, hinweis?: string): string {
  return hinweis ? `${name}, ${hinweis}` : name
}

/** Die Zeile unter dem Namen (G5): Grundpreis und Vorrat mit „ · “; bei einer leeren Größe „gerade nicht da“ statt des Vorrats. */
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
  form = 'kachel',
}: {
  wert: string
  /** „5 kg-Sack", „Rundballen". In der Zeile: „Sack" mit Hinweis „25 kg". */
  name: string
  /** „für Kleintiere", „ca. 250 kg". In der Zeile nach einem Komma hinter dem Namen. */
  hinweis?: string
  /** Fertig formatiert: „€ 8,00". */
  preis: string
  /** Fertig formatiert: „€ 1,60/kg". */
  grundpreis?: string
  /** „noch 10", „nur noch 8", „ausverkauft". In der Zeile steht bei `ausverkauft` „gerade nicht da“ statt dieses Texts. */
  vorrat?: string
  zustand?: 'normal' | 'knapp' | 'ausverkauft'
  className?: string
  /** `kachel` (Vorgabe, Stand vor Lauf 32) oder `zeile` (G5). */
  form?: GroessenForm
}): React.JSX.Element {
  if (form === 'zeile') {
    return (
      <GroessenZeile
        wert={wert}
        titel={groessenName(name, hinweis)}
        unterzeile={groessenUnterzeile(grundpreis, vorrat, zustand)}
        preis={preis}
        zustand={zustand}
        className={className}
      />
    )
  }
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
      {hinweis && <span className="truncate text-[12px] text-muted-foreground">{hinweis}</span>}
      {/* Preis und Grundpreis brechen nie in sich um; wird es eng, rutscht der Grundpreis in die nächste Zeile. */}
      <span className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2">
        <span className={cn('font-semibold whitespace-nowrap tabular-nums', zustand === 'ausverkauft' && 'line-through decoration-1')}>
          {preis}
        </span>
        {grundpreis && <span className="text-[12px] whitespace-nowrap text-status-fertig tabular-nums">{grundpreis}</span>}
      </span>
      {vorrat && (
        <span className={cn('text-[12px]', zustand === 'knapp' ? 'font-semibold text-status-offen' : 'text-muted-foreground')}>
          {vorrat}
        </span>
      )}
    </Radio.Root>
  )
}

/** Die Zeile (G5). Auch eine leere Größe zeigt ihren Preis — die Kundin sieht, was sie kostet, wenn sie wieder da ist. */
function GroessenZeile({
  wert,
  titel,
  unterzeile,
  preis,
  zustand,
  className,
}: {
  wert: string
  titel: string
  unterzeile: string
  preis: string
  zustand: 'normal' | 'knapp' | 'ausverkauft'
  className?: string
}): React.JSX.Element {
  return (
    <Radio.Root
      value={wert}
      disabled={zustand === 'ausverkauft'}
      data-slot="groessenkachel"
      data-form="zeile"
      data-zustand={zustand}
      className={cn(
        // Die Zeile ist ein role="radio"-Span — die Hand setzt sie selbst (DESIGN_SYSTEM, „Zeiger").
        'group/groesse flex min-h-[64px] cursor-pointer items-center gap-3 border border-border bg-card px-3.5 py-3 text-left text-foreground transition-colors duration-[250ms] hover:bg-muted',
        RUNDUNG.karte,
        'data-[checked]:border-accent data-[checked]:bg-accent/10 data-[checked]:shadow-[inset_0_0_0_0.5px] data-[checked]:shadow-accent',
        'data-[disabled]:cursor-not-allowed data-[disabled]:hover:bg-card',
        FOKUS_RAHMEN,
        className
      )}
    >
      {/* Der Kreis zeigt die Wahl (Rand eines Bedienelements: border-input, ≥ 3:1); angesagt wird sie über role="radio" der Zeile. */}
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-input group-data-[checked]/groesse:border-accent group-data-[disabled]/groesse:opacity-50"
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
      {/* Der Preis bricht nie in sich um; bei einer leeren Größe gedämpft, nicht durchgestrichen. */}
      <span className={cn('shrink-0 text-[15px] font-bold whitespace-nowrap tabular-nums', zustand === 'ausverkauft' && 'text-muted-foreground')}>{preis}</span>
    </Radio.Root>
  )
}
