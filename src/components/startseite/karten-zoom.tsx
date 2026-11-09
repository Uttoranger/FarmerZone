'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/**
 * Die Stufen der Lupe auf der Regionskarte der Startseite. Die Karte ist ein SVG vom Server, kein Kartendienst:
 * Gezoomt wird nur ihre Darstellung (CSS), nie ein neuer Ausschnitt geladen — keine Kachel, keine Adresse.
 */
export const KARTEN_ZOOM_STUFEN = [1, 1.5, 2.25] as const

/**
 * Zoom „+/−“ der Regionskarte (Board w1-/s1-startseite Bild 1; Liste Lauf 32 startseite, Abnahme Lauf 32
 * startseite 3). Die Karte selbst kommt als Kind vom Server (sie bleibt ein Server-SVG ohne Skript); nur diese
 * Hülle läuft im Browser. Die Knöpfe stehen neben dem Link der Karte, nie darin (kein Knopf im Link). An der
 * Grenze bleiben sie bedienbar und sagen es über `aria-disabled` — sie werden nie ausgeblendet.
 */
export function KartenZoom({ children }: { children: ReactNode }): React.JSX.Element {
  const [stufe, setStufe] = useState(0)
  const letzte = KARTEN_ZOOM_STUFEN.length - 1
  const knopf = cn(
    'flex size-11 items-center justify-center bg-accent-foreground text-[20px] leading-none font-semibold text-primary-foreground transition-colors duration-[250ms] hover:bg-primary-foreground/10 aria-disabled:opacity-50 dark:bg-card dark:text-foreground dark:hover:bg-muted',
    FOKUS_RAHMEN
  )
  return (
    <>
      <div
        data-slot="karten-zoom"
        className="absolute inset-0 origin-center transition-transform duration-[250ms] motion-reduce:transition-none"
        style={{ transform: `scale(${KARTEN_ZOOM_STUFEN[stufe]})` }}
      >
        {children}
      </div>
      {/* Oben rechts wie im Board und auf /hoefe; je Knopf 44 px Trefferfläche. */}
      <div className="absolute top-2 right-2 flex flex-col overflow-hidden rounded-[10px] border border-primary-foreground/25 shadow-sm dark:border-border">
        <button
          type="button"
          aria-label="Karte vergrößern"
          aria-disabled={stufe === letzte}
          onClick={() => setStufe((s) => Math.min(letzte, s + 1))}
          className={knopf}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Karte verkleinern"
          aria-disabled={stufe === 0}
          onClick={() => setStufe((s) => Math.max(0, s - 1))}
          className={cn(knopf, 'border-t border-primary-foreground/25 dark:border-border')}
        >
          −
        </button>
      </div>
    </>
  )
}
