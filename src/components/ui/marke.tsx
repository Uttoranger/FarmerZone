import type { ComponentProps } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { MarkeArt } from '@/lib/marke-art'
import { cn } from '@/lib/utils'

/**
 * Schrift, Fläche und Rand je Art — nur aus den Bedeutungs-Tokens (Register
 * G5, `--fz-zustand-*` in globals.css). Die Schrift steht auf der eigenen
 * Fläche, deshalb hält der Kontrast auf Karte wie auf Seitengrund.
 */
const ART_KLASSEN: Record<MarkeArt, string> = {
  tun: 'border-zustand-tun/40 bg-zustand-tun-grund text-zustand-tun',
  laeuft: 'border-zustand-laeuft/40 bg-zustand-laeuft-grund text-zustand-laeuft',
  erledigt: 'border-zustand-erledigt/40 bg-zustand-erledigt-grund text-zustand-erledigt',
  abgebrochen: 'border-zustand-abgebrochen/40 bg-zustand-abgebrochen-grund text-zustand-abgebrochen',
}

/**
 * Die Marke: ein Zustand als kurzes Wort auf seiner Bedeutungsfarbe (Register
 * G5) — tun (die Kundin oder der Hof muss etwas tun), läuft, erledigt,
 * abgebrochen. EINE Gestalt für alle Zustandsmarken; welche Art ein Zustand
 * hat, entscheidet die Fachregel (`MarkeArt`), nie die Marke.
 *
 * Symbol und Wort stehen in EINER Zeile (Regelvorschlag 68): Das Symbol ist
 * Geschwister des Worts in der Flex-Zeile, nicht in einem Block darüber. Der
 * innere Span kürzt mit Auslassung, statt bei 375 px aus der Karte zu laufen
 * (min-w-0, weil ein Flex-Kind sonst nicht unter seine Textbreite schrumpft).
 *
 * Weitere Attribute gehen an den äußeren Span — vor `data-art`, damit
 * StatusBadge sein `data-slot` und `data-status` an derselben Stelle behält.
 */
export function Marke({
  art,
  symbol: Symbol,
  className,
  children,
  ...rest
}: ComponentProps<'span'> & {
  art: MarkeArt
  /** lucide-Symbol vor dem Wort, für Screenreader verborgen — das Wort trägt die Bedeutung. */
  symbol?: LucideIcon
}): React.JSX.Element {
  return (
    <span
      data-slot="marke"
      {...rest}
      data-art={art}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap',
        ART_KLASSEN[art],
        className
      )}
    >
      {Symbol && <Symbol aria-hidden="true" className="size-3.5 shrink-0" />}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  )
}
