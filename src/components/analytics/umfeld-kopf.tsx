'use client'

import { useRouter } from 'next/navigation'
import { BereichUmschalter } from '@/components/shared/bereich-umschalter'
import type { AnzeigeBereich } from '@/lib/taxonomie'
import { cn } from '@/lib/utils'
import { UM_KM_VALUES, type UmKm } from '@/schemas/hoefe-filter'
import { umfeldLink } from '@/schemas/umfeld-filter'

/**
 * Kopf des Umfelds: Bereich und Umkreis. Beide stehen in der URL
 * (`?km=25&bereich=futter`) — gewechselt wird per Navigation, der Server
 * rechnet neu. `push`, nicht `replace`: Zurück soll zur vorigen Wahl führen.
 *
 * Der Umkreis-Wähler ist bewusst NICHT die SegmentControl der Zeitraum-Wahl:
 * Die ist 38 px hoch und sagt einem Screenreader nicht, welche Stufe gewählt
 * ist. Hier: 44 px, aria-pressed — wie der Bereich-Umschalter darüber, nur
 * leiser, damit die beiden nicht wie eine Wahl aussehen.
 */
export function UmfeldKopf({ bereich, km }: { bereich: AnzeigeBereich; km: UmKm }) {
  const router = useRouter()
  return (
    <div className="mb-4 space-y-3">
      <BereichUmschalter aktiv={bereich} onWechsel={(neu) => router.push(umfeldLink({ km, bereich: neu }))} />
      <div role="group" aria-label="Umkreis" className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1">
        {UM_KM_VALUES.map((stufe) => {
          const gewaehlt = stufe === km
          return (
            <button
              key={stufe}
              type="button"
              aria-pressed={gewaehlt}
              onClick={() => router.push(umfeldLink({ km: stufe, bereich }))}
              className={cn(
                'inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                gewaehlt ? 'bg-primary/10 text-brand-text' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
            >
              {stufe} km
            </button>
          )
        })}
      </div>
    </div>
  )
}
