import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Die kleine Marke im Haus-Stil: ein kurzes Wort auf farbiger, runder Fläche
 * (Referenz-19-Farbwelt, wie die Status-Marken im Bauern-Bereich und die
 * Entfernungs-Marke der Hofübersicht). EIN Element für beide Seiten der
 * Bestellung: der Status auf der Kundinnen-Bestellseite und der Abholtermin
 * auf den Hofkarten tragen dieselbe Gestalt — so wirkt zusammengehörig, was
 * zusammengehört.
 *
 * Der innere Span kürzt mit Auslassung, statt bei 375 px aus der Karte zu
 * laufen (min-w-0, weil ein Flex-Kind sonst nicht unter seine Textbreite
 * schrumpft).
 */
export function Marke({
  farbe,
  className,
  children,
}: {
  /** Tailwind-Klassen für Fläche und Text, z. B. aus bestellStatusAnzeige. */
  farbe: string
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-xs font-medium',
        farbe,
        className
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
    </span>
  )
}
