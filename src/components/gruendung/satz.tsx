import { Star } from 'lucide-react'
import { GRUENDUNG_TEXT, type GruendungSeiten } from '@/lib/gruendungshof'
import { cn } from '@/lib/utils'
import { SatzTeile } from '@/components/gruendung/satz-teile'

/**
 * Baustein (1) der Gründungshöfe (Register K2-Ergänzung, Nr. 93): ein Satz im
 * Lesefluss des Für-Höfe-Bands der Startseite, nach der Beschreibung — kein
 * Kasten, kein zweiter Knopf (Mockups web-/mobil-k2-startseite-gruendung).
 * Der Stern ist Schmuck (aria-hidden), der Satz trägt alles. Farben nur aus
 * Tokens: Das Band ist im Dunkeln dunkel und hell hell, der Satz folgt mit.
 * Ohne `zeigen` (Anzeige aus, alles vergeben, Datum vorbei) steht nichts da.
 */
export function GruendungSatz({ gruendung, className }: { gruendung: GruendungSeiten | null; className?: string }): React.JSX.Element | null {
  if (!gruendung?.zeigen) return null
  return (
    // Der ganze Satz in der Vordergrundfarbe, hervorgehoben nur durch Gewicht: Auf dem Verlauf des
    // Bands (primary/16 über dem Seitengrund) erreichte die leise Schrift hell nur 4,4:1 (Bericht 93).
    <p className={cn('flex items-start gap-2 text-[13px] leading-[1.45] text-foreground md:text-[14px]', className)}>
      <Star className="mt-[2px] size-[15px] shrink-0 text-status-offen" strokeWidth={1.9} aria-hidden="true" />
      <span className="min-w-0">
        <SatzTeile teile={GRUENDUNG_TEXT.satz(gruendung)} />
      </span>
    </p>
  )
}
