'use client'

import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { KmWahl } from '@/components/region/km-wahl'
import { ANZEIGE_BEREICHE, ANZEIGE_BEREICH_VALUES, type AnzeigeBereich } from '@/lib/taxonomie'
import { UMFELD_KM, type UmfeldKm } from '@/lib/umfeld'
import { umfeldLink, type UmfeldAnsichtWahl } from '@/schemas/umfeld-filter'

/**
 * Kopf von „Preise vergleichen" (intern: Umfeld): Bereich und Umkreis. Beide
 * stehen in der URL (`/region?km=25&bereich=futter`) — gewechselt wird per
 * Navigation, der Server rechnet neu; Zurück führt zur vorigen Wahl.
 *
 * Seit Nr. 251 sind Bereich und Umkreis Chip-Gruppen (G11, Liste Lauf 32 region:
 * „Hofladen / Futtermittel als Segment, orange“) — echte Links mit aria-current,
 * der Umkreis dieselbe `KmWahl` wie in „Futter kaufen".
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
  return (
    <div className="flex flex-col gap-3">
      <FilterChipReihe beschriftung="Bereich wählen">
        {ANZEIGE_BEREICH_VALUES.map((b) => (
          <FilterChip key={b} href={umfeldLink({ km, bereich: b, ansicht })} aktiv={b === bereich} ladePunkt>
            {ANZEIGE_BEREICHE[b].titel}
          </FilterChip>
        ))}
      </FilterChipReihe>
      <KmWahl stufen={UMFELD_KM.map((stufe) => ({ km: stufe, href: umfeldLink({ km: stufe, bereich, ansicht }), aktiv: stufe === km }))} />
    </div>
  )
}
