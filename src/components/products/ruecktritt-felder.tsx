'use client'

import { useState } from 'react'
import type { Control } from 'react-hook-form'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { FREIWILLIG } from '@/lib/profil-meldungen'
import { RUECKTRITT_TEXT, ruecksendekostenAlsEingabe, ruecksendekostenAusEingabe } from '@/lib/ruecktritt-angaben'
import type { ProductFormData } from '@/schemas/product'

/**
 * Die zwei Angaben zum Rücktritt im Produktformular (Nr. 214, N39-Ergänzung):
 * „Verdirbt schnell – kein Rücktritt möglich“ und die geschätzten
 * Rücksendekosten in Euro. Texte aus src/lib/ruecktritt-angaben.ts; die
 * Vorbelegung des Hakens setzt der Dialog beim Anlegen (kategorieSetzen).
 */
export function RuecktrittFelder({ control }: { control: Control<ProductFormData> }): React.JSX.Element {
  return (
    <div className="space-y-2" data-abschnitt="ruecktritt">
      <p className="text-sm font-medium text-foreground">{RUECKTRITT_TEXT.abschnitt}</p>
      <FormField
        control={control}
        name="keinRuecktritt"
        render={({ field }) => (
          <div data-feld="keinRuecktritt">
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg p-2.5 hover:bg-muted/30">
              <input
                type="checkbox"
                name={field.name}
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded accent-primary"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm text-foreground">{RUECKTRITT_TEXT.keinRuecktritt}</span>
                <span className="text-xs text-muted-foreground">{RUECKTRITT_TEXT.keinRuecktrittErklaerung}</span>
              </span>
            </label>
          </div>
        )}
      />
      <FormField
        control={control}
        name="ruecksendekostenCents"
        render={({ field }) => (
          <FormItem data-feld="ruecksendekostenCents" tabIndex={-1} className="outline-none">
            <FormLabel className="leading-snug">
              {RUECKTRITT_TEXT.ruecksendekosten} {FREIWILLIG}
            </FormLabel>
            <FormControl>
              <EuroCentFeld name={field.name} value={field.value} onBlur={field.onBlur} onChange={field.onChange} />
            </FormControl>
            <FormDescription className="text-xs">{RUECKTRITT_TEXT.ruecksendekostenErklaerung}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

/**
 * Euro tippen, Cent speichern: Der Wert im Formular sind ganze Cent über die
 * Ziffern (ruecksendekostenAusEingabe), nie eine Fließkommazahl × 100
 * (CODING_STANDARDS §2). Wie im DezimalFeld bleibt der Rohtext während des
 * Tippens stehen, solange er zum Wert passt; leer ist null, nie undefined
 * (CODING_STANDARDS §8).
 */
function EuroCentFeld({
  name,
  value,
  onChange,
  onBlur,
}: {
  name: string
  value: number | null
  onChange: (cents: number | null) => void
  onBlur: () => void
}): React.JSX.Element {
  const [entwurf, setEntwurf] = useState<{ text: string; wert: number | null } | null>(null)
  const angezeigt = entwurf !== null && Object.is(entwurf.wert, value) ? entwurf.text : ruecksendekostenAlsEingabe(value)
  return (
    <div className="relative max-w-[12rem]">
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
        €
      </span>
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        name={name}
        value={angezeigt}
        placeholder="leer lassen"
        onChange={(e) => {
          const text = e.target.value
          const wert = ruecksendekostenAusEingabe(text)
          setEntwurf({ text, wert })
          onChange(wert)
        }}
        onBlur={() => {
          // Gültiges wird deutsch geschrieben („25,50“); Unlesbares bleibt stehen, damit der Satz am Feld passt.
          if (entwurf !== null && entwurf.wert !== null && Number.isFinite(entwurf.wert)) setEntwurf(null)
          onBlur()
        }}
        className="pl-8"
      />
    </div>
  )
}
