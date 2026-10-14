import Image from 'next/image'
import { cn } from '@/lib/utils'
import { MARKE_RUNDUNG_PROZENT, markeBildUrl, type MarkeFassung } from '@/lib/marke-bild'

/**
 * Die Bildmarke (Register M1, Ergänzung 14.10.2026): EINE Marke in zwei
 * Fassungen derselben Form — `voll` ab 48 px, `klein` darunter (Kopfzeile 32,
 * Favicon). Ein `<img>` auf die SVG-Datei unter public/marke/, über next/image
 * ohne Optimierung (das SVG bleibt, wie es ist) und ohne Alternativtext: Das
 * Wort daneben (Wortmarke) oder der Zusammenhang trägt den Namen.
 *
 * Die Farben stehen im SVG und folgen dem Modus nicht — ein Logo, das je nach
 * Einstellung anders aussieht, ist kein Logo mehr (CODING_STANDARDS §7 „Was
 * dem Modus NICHT folgt"). Die Kachel gehört zur Marke; ihre Rundung kommt
 * per CSS in Prozent der Kante (22 wie die App-Icons aus `pnpm marke`), nie
 * aus dem SVG. Nirgends sonst wird die Marke gezeichnet.
 */
export function Bildmarke({
  groesse,
  fassung,
  rundung = MARKE_RUNDUNG_PROZENT,
  priority = false,
  className,
}: {
  /** Kante in px; die Anzeige darf über `className` skalieren (das Plakat misst in cqw). */
  groesse: number
  fassung: MarkeFassung
  /** Rundung der Kachel in Prozent der Kante. */
  rundung?: number
  /** Nur in der Kopfzeile: Die Marke steht im ersten Blick und wird vorab geladen. */
  priority?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <Image
      src={markeBildUrl(fassung)}
      width={groesse}
      height={groesse}
      unoptimized
      priority={priority}
      alt=""
      aria-hidden="true"
      className={cn('shrink-0', className)}
      style={{ borderRadius: `${rundung}%` }}
    />
  )
}
