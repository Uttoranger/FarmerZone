'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN_INNEN } from './fokus'
import { Input } from './input'

type Props = Omit<React.ComponentProps<'input'>, 'type'> & {
  /**
   * Eigene Feldform statt der Grundform von Input (z. B. `FELD` der Anmeldung
   * oder der Registrierung). Dann zeichnet ein schlichtes `<input>` — sonst
   * lägen der Ring von Input und der Rahmen der Feldform übereinander.
   */
  feld?: string
}

/**
 * Passwortfeld mit Auge-Knopf — die EINE Umsetzung für alle Formulare
 * (Nr. 173; vorher je eine Kopie in Registrierung und neuem Passwort).
 *
 * Der Knopf ist 44 × 44 px (WCAG 2.5.8), per Tastatur erreichbar (kein
 * tabIndex -1: Wer nicht zeigen kann, will das Passwort ebenso prüfen),
 * meldet mit `aria-pressed`, ob das Passwort sichtbar ist, und heißt
 * „Passwort anzeigen"/„Passwort verbergen". Der Fokusrahmen liegt innen,
 * damit er nicht über den Feldrand hinausragt.
 */
export function PasswordInput({ className, feld, ...props }: Props): React.JSX.Element {
  const [sichtbar, setSichtbar] = useState(false)
  const typ = sichtbar ? 'text' : 'password'
  return (
    <div className="relative">
      {feld ? (
        <input {...props} type={typ} className={cn(feld, className, 'pr-12')} />
      ) : (
        <Input {...props} type={typ} className={cn(className, 'pr-12')} />
      )}
      <button
        type="button"
        onClick={() => setSichtbar((s) => !s)}
        aria-label={sichtbar ? 'Passwort verbergen' : 'Passwort anzeigen'}
        aria-pressed={sichtbar}
        className={cn(
          'absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:text-foreground',
          FOKUS_RAHMEN_INNEN
        )}
      >
        {sichtbar ? (
          <EyeOff className="size-[18px]" strokeWidth={1.7} aria-hidden="true" />
        ) : (
          <Eye className="size-[18px]" strokeWidth={1.7} aria-hidden="true" />
        )}
      </button>
    </div>
  )
}
