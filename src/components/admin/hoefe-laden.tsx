import { cn } from '@/lib/utils'
import { HOEFE_LISTE_FILTER, HOEFE_LISTE_TEXT } from '@/lib/admin-hoefe-liste'
import { LEISE } from '@/components/hof-bestellungen/stil'
import { ADMIN_RAHMEN } from './admin-teile'
import { Seitenkopf } from './seitenkopf'

/**
 * Ladeansicht von Admin › Höfe (Board s3/w3-admin-hoefe, Bild 6; Lauf 30,
 * Nr. 229): Kopf mit Titel und Satz steht schon, Suche und Filter als
 * Platzhalter (die Zahlen kommen erst mit der Liste), darunter fünf Karten in
 * der Höhe einer Zeile und der eine Satz für Screenreader und Auge. Löst
 * `HoefeLaden` aus admin-laden.tsx für diese Route ab (dort noch die Form mit
 * fünf Kacheln aus Nr. 94, die Höfe seit Nr. 187 nicht mehr haben).
 */
export function HoefeListeLaden(): React.JSX.Element {
  return (
    <div className={cn(ADMIN_RAHMEN, 'flex flex-col gap-5')} aria-busy="true">
      <Seitenkopf titel={HOEFE_LISTE_TEXT.titel} satz={HOEFE_LISTE_TEXT.satz} rechts={<div className="h-11 w-full animate-pulse rounded-full bg-muted md:w-[288px]" />} />
      <div className="flex animate-pulse gap-2 overflow-hidden" aria-hidden="true">
        {HOEFE_LISTE_FILTER.map((f) => (
          <div key={f} className="h-9 w-24 shrink-0 rounded-full bg-muted" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} aria-hidden="true" className="h-[76px] animate-pulse rounded-2xl border border-border bg-card" />
        ))}
        <span role="status" className={cn('text-[14px]', LEISE)}>
          {HOEFE_LISTE_TEXT.laden}
        </span>
      </div>
    </div>
  )
}
