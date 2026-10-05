import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * EmptyState: der Leerzustand nach docs/ai/DESIGN_SYSTEM.md — Symbol, ein
 * Satz, eine nächste Handlung („Noch keine Produkte — Lege dein erstes an").
 * Nie nur „nichts gefunden": Die Aktion ist der Ausweg (Umkreis erweitern,
 * Filter lockern, anlegen) und kommt als Kind herein, meist ein Link.
 *
 * Großes Symbol mit Strichstärke 1,5 (Regel für Leerzustände).
 */
export function EmptyState({
  symbol: Symbol,
  titel,
  satz,
  aktion,
  className,
}: {
  symbol: LucideIcon
  titel: string
  satz?: string
  aktion?: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center',
        className
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-muted">
        <Symbol className="size-7 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <p className="font-heading text-lg font-semibold text-foreground">{titel}</p>
      {satz && <p className="max-w-sm text-sm text-muted-foreground">{satz}</p>}
      {aktion && <div className="mt-1 flex flex-wrap justify-center gap-2">{aktion}</div>}
    </div>
  )
}
