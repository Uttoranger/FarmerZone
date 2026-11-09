import { Marke } from '@/components/ui/marke'
import type { StatusTon } from '@/components/ui/status-badge'
import type { MarkeArt } from '@/lib/marke-art'

/** Derselbe Ton wie StatusBadge (Register G5): offen wartet, fertig läuft, neutral ist ruhig. */
const ART_ZUM_TON: Record<StatusTon, MarkeArt> = { offen: 'tun', fertig: 'laeuft', neutral: 'erledigt' }

/**
 * Die Marke einer Kundin („Stammkunde“, „Neu“ …) als Schild ohne Rand — 22 px, 12 px fett, wie im Board
 * s2-/w2-kunden (Liste Lauf 32 kunden: „Marke mit Rand → ohne Rand“, Nr. 273). Farben aus denselben
 * Bedeutungs-Tokens wie StatusBadge; welcher Ton gilt, entscheidet `kundenMarke` (src/lib/hof-kunden.ts).
 */
export function KundenMarke({ ton, children }: { ton: StatusTon; children: React.ReactNode }): React.JSX.Element {
  return (
    <Marke art={ART_ZUM_TON[ton]} form="schild">
      {children}
    </Marke>
  )
}
