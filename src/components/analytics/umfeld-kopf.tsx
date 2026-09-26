'use client'

import { useRouter } from 'next/navigation'
import { BereichUmschalter } from '@/components/shared/bereich-umschalter'
import { SegmentControl } from '@/components/farmer/segment-control'
import type { AnzeigeBereich } from '@/lib/taxonomie'
import { UM_KM_VALUES, type UmKm } from '@/schemas/hoefe-filter'
import { umfeldLink } from '@/schemas/umfeld-filter'

const STUFEN = UM_KM_VALUES.map((km) => ({ key: String(km), label: `${km} km` }))

/**
 * Kopf des Umfelds: Bereich und Umkreis. Beide stehen in der URL
 * (`?km=25&bereich=futter`) — gewechselt wird per Navigation, der Server
 * rechnet neu. `push`, nicht `replace`: Zurück soll zur vorigen Wahl führen.
 */
export function UmfeldKopf({ bereich, km }: { bereich: AnzeigeBereich; km: UmKm }) {
  const router = useRouter()
  return (
    <div className="mb-4 space-y-3">
      <BereichUmschalter aktiv={bereich} onWechsel={(neu) => router.push(umfeldLink({ km, bereich: neu }))} />
      <div role="group" aria-label="Umkreis">
        <SegmentControl
          options={STUFEN}
          value={String(km)}
          onChange={(wert) => {
            const neu = UM_KM_VALUES.find((stufe) => String(stufe) === wert)
            if (neu) router.push(umfeldLink({ km: neu, bereich }))
          }}
        />
      </div>
    </div>
  )
}
