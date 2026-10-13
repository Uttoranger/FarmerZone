import { Marke } from '@/components/ui/marke'
import type { MarkeArt } from '@/lib/marke-art'
import type { SchildFarbe } from '@/lib/mein-hof'

/**
 * Das Schild im Bauern-Bereich: ein Wort auf Bedeutungsfarbe. EINE Komponente
 * für den Abholchip auf Heute, den Hofzustand im Kopf von Mein Hof und die
 * Chips der Produktzeile — vorher standen dieselben Klassen dreimal im Code
 * und drifteten schon beim zweiten Mal (anderer Rand, andere Schriftgröße).
 */

/**
 * Die Farbe des Schilds als Bedeutung der Marke (Register G5): Grün läuft,
 * Bernstein verlangt etwas, Grau ist ruhig, Rot ist schiefgegangen.
 */
const SCHILD_ART: Record<SchildFarbe, MarkeArt> = {
  gruen: 'laeuft',
  bernstein: 'tun',
  grau: 'erledigt',
  rot: 'abgebrochen',
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
    <Marke art={SCHILD_ART[farbe]} className={className}>
      {children}
    </Marke>
  )
}
