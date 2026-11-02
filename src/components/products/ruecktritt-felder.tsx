'use client'

import { useState } from 'react'
import type { Control } from 'react-hook-form'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { FREIWILLIG } from '@/lib/profil-meldungen'
import { RUECKTRITT_TEXT, ruecksendekostenAlsEingabe, ruecksendekostenAusEingabe } from '@/lib/ruecktritt-angaben'
import type { ProductFormData } from '@/schemas/product'
import { cn } from '@/lib/utils'

/**
 * Die zwei Angaben zum Rücktritt im Produktformular (Nr. 214, N39-Ergänzung):
 * „Verdirbt schnell – kein Rücktritt möglich“ und die geschätzten
 * Rücksendekosten in Euro. Texte aus src/lib/ruecktritt-angaben.ts; die
 * Vorbelegung des Hakens setzt der Dialog beim Anlegen (kategorieSetzen).
 *
 * Haken und Euro-Feld sind eigene Bausteine (`KeinRuecktrittHaken`,
 * `EuroCentFeld`), weil das Familien-Formular (Futter, Brennmaterial; Nr. 218)
 * ohne react-hook-form arbeitet — es setzt dieselben zwei Teile in seinen
 * Rahmen `Feld` (`RuecktrittAbschnitt` in familien-teile.tsx), kein zweiter Text.
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
            <KeinRuecktrittHaken name={field.name} checked={field.value} onChange={field.onChange} />
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
 * Der Haken „Verdirbt schnell – kein Rücktritt möglich“ samt Erklärung. Die
 * ganze Zeile ist der Klickbereich (mindestens 44 px).
 */
export function KeinRuecktrittHaken({
  name,
  checked,
  onChange,
  className,
}: {
  name?: string
  checked: boolean
  onChange: (haken: boolean) => void
  /** Rahmen des umgebenden Formulars (im Familien-Formular mit Linie wie dessen andere Haken). */
  className?: string
}): React.JSX.Element {
  return (
    <label className={cn('flex min-h-11 cursor-pointer items-start gap-3 rounded-lg p-2.5 hover:bg-muted/30', className)}>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded accent-primary"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm text-foreground">{RUECKTRITT_TEXT.keinRuecktritt}</span>
        <span className="text-xs text-muted-foreground">{RUECKTRITT_TEXT.keinRuecktrittErklaerung}</span>
      </span>
    </label>
  )
}

/**
 * Euro tippen, Cent speichern: Der Wert im Formular sind ganze Cent über die
 * Ziffern (ruecksendekostenAusEingabe), nie eine Fließkommazahl × 100
 * (CODING_STANDARDS §2). Wie im DezimalFeld bleibt der Rohtext während des
 * Tippens stehen, solange er zum Wert passt; leer ist null, nie undefined
 * (CODING_STANDARDS §8). Kennung und aria-Angaben des Rahmens (FormControl
 * bzw. `Feld`) gehen an das Eingabefeld, damit Beschriftung und Fehlersatz
 * dazu gehören (WCAG 3.3.1).
 */
export function EuroCentFeld({
  id,
  name,
  value,
  onChange,
  onBlur,
  'aria-invalid': ungueltig,
  'aria-describedby': beschreibung,
}: {
  id?: string
  name: string
  value: number | null
  onChange: (cents: number | null) => void
  onBlur?: () => void
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}): React.JSX.Element {
  const [entwurf, setEntwurf] = useState<{ text: string; wert: number | null } | null>(null)
  const angezeigt = entwurf !== null && Object.is(entwurf.wert, value) ? entwurf.text : ruecksendekostenAlsEingabe(value)
  return (
    <div className="relative max-w-[12rem]">
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
        €
      </span>
      <Input
        id={id}
        aria-invalid={ungueltig}
        aria-describedby={beschreibung}
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
          onBlur?.()
        }}
        className="pl-8"
      />
    </div>
  )
}
