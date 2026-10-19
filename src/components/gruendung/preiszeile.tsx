import { Star } from 'lucide-react'
import { GRUENDUNG_TEXT, type GruendungSeiten } from '@/lib/gruendungshof'
import { cn } from '@/lib/utils'
import { SatzTeile } from '@/components/gruendung/satz-teile'

/**
 * Baustein (2) der Gründungshöfe (Register K2-Ergänzung, Nr. 93): die
 * Angebotszeile im Abschnitt Preise von /fuer-hoefe, direkt über den
 * Tarifkarten (Mockups web-/mobil-k2-fuer-hoefe-gruendung). Ohne den Link
 * „Was Gründungshöfe bekommen" des Mockups: Keine Seite beschreibt das
 * Angebot (/konditionen nennt seit Nr. 15 nur die Tarife) — Bericht 93.
 */
export function GruendungPreiszeile({ gruendung, className }: { gruendung: GruendungSeiten | null; className?: string }): React.JSX.Element | null {
  if (!gruendung?.zeigen) return null
  return (
    <div className={cn('flex items-center gap-3.5 rounded-[14px] border border-primary/45 bg-primary/10 px-4 py-3.5 md:px-[18px]', className)}>
      <span aria-hidden="true" className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-primary/18 text-status-offen">
        <Star className="size-[18px]" strokeWidth={1.9} />
      </span>
      <p className="min-w-0 flex-1 text-[13.5px] leading-[1.45] text-muted-foreground md:text-[14px]">
        <SatzTeile teile={GRUENDUNG_TEXT.preiszeile(gruendung)} />
      </p>
    </div>
  )
}
