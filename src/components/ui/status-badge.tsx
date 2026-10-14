import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Marke } from '@/components/ui/marke'
import type { MarkeArt } from '@/lib/marke-art'

export type StatusTon = 'offen' | 'fertig' | 'neutral'

/** Der Ton als Bedeutung (Register G5): offen wartet auf jemanden, fertig läuft, neutral ist ruhig oder vorbei. */
const ART_ZUM_TON: Record<StatusTon, MarkeArt> = {
  offen: 'tun',
  fertig: 'laeuft',
  neutral: 'erledigt',
}

/**
 * StatusBadge: ein Zustand als Marke — offen/zum Packen, fertig/gepackt/
 * bezahlt, neutral (pausiert, Entwurf). Seit Nr. 79 zeichnet sie über den
 * Baustein `Marke`: Schrift und Fläche kommen aus den Bedeutungs-Tokens, und
 * ein Symbol steht mit dem Wort in einer Zeile. So tragen alle Aufrufer die
 * Farben von G5, ohne dass sich ihre Töne ändern.
 *
 * Welchen Zustand etwas hat, entscheidet nicht die Marke, sondern der
 * Aufrufer (z. B. ADMIN_STATUS_TON); Bestellungen tragen ihre Art direkt
 * (`bestellMarke`, `bestellStatusAnzeige` → `Marke`) — hier nur die Gestalt.
 */
export function StatusBadge({
  status,
  symbol,
  children,
  className,
}: {
  status: StatusTon
  symbol?: LucideIcon
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <Marke data-slot="status-badge" data-status={status} art={ART_ZUM_TON[status]} symbol={symbol} className={className}>
      {children}
    </Marke>
  )
}
