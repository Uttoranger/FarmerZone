'use client'

import { useRouter } from 'next/navigation'
import { BereichUmschalter } from '@/components/shared/bereich-umschalter'
import { KmWahl } from '@/components/region/km-wahl'
import type { AnzeigeBereich } from '@/lib/taxonomie'
import { UMFELD_KM, type UmfeldKm } from '@/lib/umfeld'
import { umfeldLink, type UmfeldAnsichtWahl } from '@/schemas/umfeld-filter'

/**
 * Kopf von „Preise vergleichen" (intern: Umfeld): Bereich und Umkreis. Beide
 * stehen in der URL (`/region?km=25&bereich=futter`) — gewechselt wird per
 * Navigation, der Server rechnet neu; Zurück führt zur vorigen Wahl.
 *
 * Seit Nr. 22c ist der Umkreis die Wanne aus den Region-Mockups (`KmWahl`,
 * echte Links mit aria-current), dieselbe wie in „Futter kaufen". Der
 * Bereich-Umschalter darüber bleibt, wie er war.
 */
export function UmfeldKopf({
  bereich,
  km,
  ansicht,
}: {
  bereich: AnzeigeBereich
  km: UmfeldKm
  /** Bleibt beim Wechsel von Bereich und Umkreis erhalten. */
  ansicht: UmfeldAnsichtWahl
}) {
  const router = useRouter()
  return (
    <div className="flex flex-col gap-3">
      <BereichUmschalter aktiv={bereich} onWechsel={(neu) => router.push(umfeldLink({ km, bereich: neu, ansicht }))} />
      <KmWahl stufen={UMFELD_KM.map((stufe) => ({ km: stufe, href: umfeldLink({ km: stufe, bereich, ansicht }), aktiv: stufe === km }))} />
    </div>
  )
}
