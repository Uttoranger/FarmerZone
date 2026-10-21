'use client'

import { BereichUmschalter } from '@/components/shared/bereich-umschalter'
import { KmWahl } from '@/components/region/km-wahl'
import type { AnzeigeBereich } from '@/lib/taxonomie'
import { UMFELD_KM, UMFELD_TEXT, type UmfeldKm } from '@/lib/umfeld'
import { cn } from '@/lib/utils'
import { umfeldLink, type UmfeldAnsichtWahl } from '@/schemas/umfeld-filter'

/**
 * Kopf von „Preise vergleichen" (intern: Umfeld): Bereich und Umkreis. Beide
 * stehen in der URL (`/region?km=25&bereich=futter`) — gewechselt wird per
 * Navigation, der Server rechnet neu; Zurück führt zur vorigen Wahl.
 *
 * Der Umkreis ist die Wanne `KmWahl` mit der Zahl der Höfe je Stufe (N23,
 * `zahlenJeStufe` in src/lib/umfeld.ts). Der Bereich-Umschalter bleibt, wie
 * er ist; weil er per router.push wechselt (kein Link, also kein
 * `LadePunkt`), zeigt der Kopf den Ladepunkt selbst an der gewählten Hälfte,
 * solange die neue Seite lädt (`bereichLaedt`, Muster wie km-wahl.tsx).
 */
export function UmfeldKopf({
  bereich,
  km,
  ansicht,
  zahlen,
  bereichLaedt,
  onBereich,
}: {
  bereich: AnzeigeBereich
  km: UmfeldKm
  /** Bleibt beim Wechsel von Bereich und Umkreis erhalten. */
  ansicht: UmfeldAnsichtWahl
  /** Je Stufe die Zahl der Höfe, die die Liste dort zählen würde. */
  zahlen: Record<UmfeldKm, number>
  /** Der Bereich, zu dem gerade gewechselt wird; null, wenn nichts lädt. */
  bereichLaedt: AnzeigeBereich | null
  /** Wechselt den Bereich (Navigation in einer Transition — der Aufrufer kennt so den Ladezustand). */
  onBereich: (link: string, bereich: AnzeigeBereich) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <BereichUmschalter aktiv={bereich} onWechsel={(neu) => onBereich(umfeldLink({ km, bereich: neu, ansicht }), neu)} />
        {bereichLaedt && (
          <span
            aria-hidden="true"
            data-slot="lade-punkt"
            className={cn(
              'pointer-events-none absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-muted-foreground motion-safe:animate-pulse',
              // In der gewählten Hälfte rechts neben dem Wort — die Hälften sind gleich breit.
              bereichLaedt === 'LEBENSMITTEL' ? 'right-[calc(50%+12px)]' : 'right-4'
            )}
          />
        )}
      </div>
      <KmWahl
        stufen={UMFELD_KM.map((stufe) => ({ km: stufe, href: umfeldLink({ km: stufe, bereich, ansicht }), aktiv: stufe === km }))}
        zahlen={zahlen}
        zahlLabel={UMFELD_TEXT.zahlLabel}
      />
    </div>
  )
}
