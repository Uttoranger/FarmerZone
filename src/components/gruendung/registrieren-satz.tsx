import { Star } from 'lucide-react'
import { GRUENDUNG_TEXT, type GruendungSeiten } from '@/lib/gruendungshof'
import { cn } from '@/lib/utils'
import { SatzTeile } from '@/components/gruendung/satz-teile'

/**
 * Baustein (3) der Gründungshöfe (Register K2-Ergänzung, Nr. 93): ein Satz
 * über dem Formular auf /register — ehrlich mit „voraussichtlich", der Platz
 * steht erst mit der Freischaltung fest (Mockups web-/mobil-k2-registrieren-
 * gruendung). Nichts, wenn die Bausteine nicht gezeigt werden oder die
 * Nummer hinter dem letzten Platz läge (`voraussichtlicherPlatz` null).
 */
export function RegistrierenSatz({ gruendung, className }: { gruendung: GruendungSeiten | null; className?: string }): React.JSX.Element | null {
  if (!gruendung?.zeigen || gruendung.voraussichtlicherPlatz === null) return null
  return (
    <p
      className={cn(
        'flex items-start gap-[9px] rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-[13px] leading-[1.45] text-muted-foreground md:text-[13.5px]',
        className
      )}
    >
      <Star className="mt-px size-4 shrink-0 text-status-offen" strokeWidth={1.9} aria-hidden="true" />
      <span className="min-w-0">
        <SatzTeile teile={GRUENDUNG_TEXT.registrieren(gruendung.voraussichtlicherPlatz, gruendung.bisTag)} />
      </span>
    </p>
  )
}
