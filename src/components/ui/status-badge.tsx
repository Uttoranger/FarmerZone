import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type StatusTon = 'offen' | 'fertig' | 'neutral'

/**
 * StatusBadge: ein Zustand als Marke — offen/zum Packen (Orange), fertig/
 * gepackt/bezahlt (Grün), neutral (pausiert, Entwurf). Die Schrift nimmt die
 * Zustandsfarbe des Themes (text-status-*), nie die Knopffarbe: Orange und
 * Grün der Knöpfe erreichen als Text auf hellem Grund keine 4,5:1.
 *
 * Welchen Zustand eine Bestellung hat, entscheidet nicht die Marke, sondern
 * der Aufrufer (z. B. bestellStatusAnzeige) — hier nur die Gestalt.
 */
export function StatusBadge({
  status,
  children,
  className,
}: {
  status: StatusTon
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <span
      data-slot="status-badge"
      data-status={status}
      className={cn(
        'inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap',
        status === 'offen' && 'border-primary/45 bg-primary/14 text-status-offen',
        status === 'fertig' && 'border-accent/50 bg-accent/18 text-status-fertig',
        status === 'neutral' && 'border-border bg-muted text-foreground',
        className
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
    </span>
  )
}
