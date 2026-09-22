'use client'

import { useState, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { formatZahl, parseDezimal } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Ein Zahlenfeld, das so tippt wie ein Mensch: Komma UND Punkt gelten als
 * Dezimaltrenner (parseDezimal), am Handy erscheint die Zifferntastatur
 * (inputMode="decimal"), und beim Verlassen wird der Wert deutsch geschrieben
 * („5,99"). `type="number"` konnte das nicht — es verwarf das Komma je nach
 * Browser still oder ließ „5,99" gar nicht erst zu.
 *
 * Der Rohtext bleibt während des Tippens erhalten (auch „5," oder „abc"),
 * der Wert dahinter geht bei jeder Änderung an das Formular. Kommt von außen
 * ein anderer Wert (Reset, „Nein, das ist der Preis je kg"), zeigt das Feld
 * ihn formatiert — ohne Effekt: Der Entwurf gilt nur, solange er zum Wert des
 * Formulars passt.
 *
 * Optionales Präfix („€") und Suffix („kg", „%") liegen IM Feld.
 */
type Props = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'prefix'> & {
  value: number | null | undefined
  onChange: (wert: number | null) => void
  praefix?: string
  suffix?: string
}

export function DezimalFeld({ value, onChange, praefix, suffix, className, onBlur, ...rest }: Props) {
  const [entwurf, setEntwurf] = useState<{ text: string; wert: number | null } | null>(null)
  // NaN (leeres Pflichtfeld im Formular) zählt wie null — sonst passte der
  // Entwurf „5," (Wert null) nie zum Formularwert, und der Text verschwände.
  const wert = value == null || !Number.isFinite(value) ? null : value
  const angezeigt =
    entwurf !== null && Object.is(entwurf.wert, wert) ? entwurf.text : wert === null ? '' : formatZahl(wert)

  return (
    <div className="relative">
      {praefix && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
        >
          {praefix}
        </span>
      )}
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={angezeigt}
        onChange={(e) => {
          const text = e.target.value
          const geparst = parseDezimal(text)
          setEntwurf({ text, wert: geparst })
          onChange(geparst)
        }}
        onBlur={(e) => {
          // Gültiges wird formatiert; Unlesbares bleibt stehen, damit der Hof
          // sieht, was er getippt hat, und die Fehlermeldung dazu passt.
          if (entwurf !== null && entwurf.wert !== null) setEntwurf(null)
          onBlur?.(e)
        }}
        className={cn(praefix && 'pl-8', suffix && 'pr-12', className)}
        {...rest}
      />
      {suffix && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
        >
          {suffix}
        </span>
      )}
    </div>
  )
}
