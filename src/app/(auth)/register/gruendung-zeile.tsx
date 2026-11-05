import { Star } from 'lucide-react'
import { GRUENDUNG_TEXT, type GruendungSeiten } from '@/lib/gruendungshof'
import { cn } from '@/lib/utils'
import { SatzTeile } from '@/components/gruendung/satz-teile'

/**
 * Der Satz der Gründungsaktion über dem Formular auf /register (Lauf 30,
 * Boards s2/w2-registrieren): der allgemeine Satz aus GRUENDUNG_TEXT.preiszeile,
 * OHNE Platznummer. Den Platz vergibt das Team erst bei der Freischaltung
 * (V65) — vorher stand hier „Du wärst voraussichtlich Gründungshof Nr. …“.
 * Kein Willkommens-Versprechen (V45/V53; Willkommenszeit offen, NICHT-Liste).
 * Gestalt wie der bisherige Satz (`RegistrierenSatz`): leiser Kasten mit Stern.
 */
export function GruendungZeile({ gruendung, className }: { gruendung: GruendungSeiten | null; className?: string }): React.JSX.Element | null {
  if (!gruendung?.zeigen) return null
  return (
    <p
      className={cn(
        'flex items-start gap-[9px] rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-[13px] leading-[1.45] text-muted-foreground md:text-[13.5px]',
        className
      )}
    >
      <Star className="mt-px size-4 shrink-0 text-status-offen" strokeWidth={1.9} aria-hidden="true" />
      <span className="min-w-0">
        <SatzTeile teile={GRUENDUNG_TEXT.preiszeile(gruendung)} />
      </span>
    </p>
  )
}
