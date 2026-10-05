'use client'

import { ANMELDECODE_LAENGE, normalisiereCode } from '@/lib/anmeldecode'
import { cn } from '@/lib/utils'

/**
 * Das Feld für den 6-stelligen Code: sechs Kästchen wie im Mockup, darunter
 * EIN echtes Eingabefeld über die ganze Fläche (unsichtbar, aber fokussierbar
 * und beschriftet). Ein Feld statt sechs, weil
 *  - das Telefon den Code aus der Mail nur in ein Feld mit
 *    autocomplete="one-time-code" einsetzt,
 *  - Einfügen („481 234" aus der Mail) und Löschen dann einfach funktionieren,
 *  - der Screenreader genau ein Feld „Code" ansagt.
 * Was eingetippt wird, geht durch normalisiereCode — nur Ziffern, höchstens
 * sechs; nie `maxLength`, das schnitte Eingefügtes stumm ab.
 * Den Fokus zeigt das Kästchen, in das die nächste Ziffer kommt, und ein
 * Rahmen um alle (outline-solid, CODING_STANDARDS/DESIGN_SYSTEM „Fokus").
 */
export function CodeFeld({
  id,
  wert,
  onWert,
  ungueltig,
  beschreibtVon,
  gesperrt,
}: {
  id: string
  wert: string
  onWert: (code: string) => void
  ungueltig: boolean
  beschreibtVon?: string
  gesperrt?: boolean
}): React.JSX.Element {
  const naechstes = Math.min(wert.length, ANMELDECODE_LAENGE - 1)

  return (
    <div className="relative flex justify-between gap-1.5 rounded-[13px] outline-none has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-4 has-[input:focus-visible]:outline-solid has-[input:focus-visible]:outline-ring lg:w-fit lg:justify-start lg:gap-2">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        value={wert}
        onChange={(e) => onWert(normalisiereCode(e.target.value))}
        aria-invalid={ungueltig || undefined}
        aria-describedby={beschreibtVon}
        disabled={gesperrt}
        // Unsichtbar, nicht versteckt: Es muss Fokus, Tastatur und das
        // automatische Einsetzen bekommen. 16 px, sonst zoomt iOS beim Antippen.
        className="peer absolute inset-0 z-10 h-full w-full cursor-text text-base opacity-0"
      />
      {Array.from({ length: ANMELDECODE_LAENGE }, (_, i) => {
        const ziffer = wert[i] ?? ''
        return (
          <span
            key={i}
            data-kaestchen=""
            aria-hidden="true"
            className={cn(
              'flex h-[54px] w-[46px] items-center justify-center rounded-[11px] border bg-background font-heading text-[22px] font-semibold text-foreground lg:h-[52px] lg:w-11',
              ziffer ? 'border-accent' : 'border-border',
              ungueltig && 'border-destructive',
              i === naechstes && 'peer-focus:border-2 peer-focus:border-ring'
            )}
          >
            {ziffer}
          </span>
        )
      })}
    </div>
  )
}
