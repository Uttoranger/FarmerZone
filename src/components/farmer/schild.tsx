import { Marke } from '@/components/ui/marke'
import type { SchildFarbe } from '@/lib/mein-hof'

/**
 * Das Schild im Bauern-Bereich: ein Wort auf Bedeutungsfarbe. EINE Komponente
 * für den Abholchip auf Heute, den Hofzustand im Kopf von Mein Hof und die
 * Chips der Produktzeile — vorher standen dieselben Klassen dreimal im Code
 * und drifteten schon beim zweiten Mal (anderer Rand, andere Schriftgröße).
 */

/** Bedeutungsfarben, in beiden Modi lesbar (CODING_STANDARDS §7). */
const SCHILD_FARBE: Record<SchildFarbe, string> = {
  gruen: 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-200',
  bernstein: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
  grau: 'bg-app-chip text-app-chip-ink',
  // Für „schiefgegangen" gibt es das Token — kein hartes Rot daneben.
  rot: 'bg-destructive/10 text-destructive',
}

export function Schild({
  farbe,
  className,
  children,
}: {
  farbe: SchildFarbe
  className?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Marke farbe={SCHILD_FARBE[farbe]} className={className}>
      {children}
    </Marke>
  )
}
