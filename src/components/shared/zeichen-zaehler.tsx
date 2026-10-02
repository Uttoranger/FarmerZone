'use client'

import { useWatch, type Control, type FieldPath, type FieldValues } from 'react-hook-form'
import { zeichenStand } from '@/lib/eingabegrenzen'
import { cn } from '@/lib/utils'

/**
 * Der Zeichenzähler unter einem Textfeld mit Obergrenze. Er erscheint ab
 * 80 % Füllung; über der Grenze sagt er „Bitte kürzen" — in Bernstein, als
 * Hinweis und nicht als Fehler. Ob der Wert so gespeichert werden darf,
 * entscheidet das Schema beim Speichern (src/lib/eingabegrenzen.ts): Ein
 * unveränderter Altwert darf es, ein neuer nicht.
 *
 * Kein `maxLength` am Feld: Der Browser schnitte Eingefügtes stumm ab, und
 * ein längerer Altwert ließe sich nicht mehr sehen, wie er gespeichert ist.
 */
export function ZeichenZaehler({
  laenge,
  max,
  leise = 'text-muted-foreground',
}: {
  laenge: number
  max: number
  /** Farbe unterhalb der Grenze — im Bauern-Bereich `text-app-ink-soft` (CODING_STANDARDS §7). */
  leise?: string
}): React.ReactElement | null {
  const stand = zeichenStand(laenge, max)
  if (!stand.sichtbar) return null
  return (
    <p
      className={cn(
        'mt-1 text-right text-xs tabular-nums',
        // Bedeutungsfarbe „Achtung": heller Wert mit dunkler Entsprechung (CODING_STANDARDS §7).
        // amber-800 statt -700: auf dem Crème-Seitengrund des neuen Designs
        // käme -700 bei text-xs nur auf ~4,4:1.
        stand.zuLang ? 'font-medium text-amber-800 dark:text-amber-300' : leise
      )}
    >
      {stand.text}
    </p>
  )
}

/**
 * Der Zähler für ein Feld aus react-hook-form. Liest den Wert mit useWatch
 * selbst — so zeichnet bei jedem Tastendruck nur der Zähler neu, nicht das
 * ganze Formular.
 */
export function FeldZaehler<T extends FieldValues>({
  control,
  name,
  max,
  leise,
}: {
  control: Control<T>
  name: FieldPath<T>
  max: number
  leise?: string
}): React.ReactElement | null {
  const wert: unknown = useWatch({ control, name })
  return <ZeichenZaehler laenge={typeof wert === 'string' ? wert.length : 0} max={max} leise={leise} />
}
