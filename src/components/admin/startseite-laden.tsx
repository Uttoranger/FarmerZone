import { cn } from '@/lib/utils'
import { ADMIN_RAHMEN } from './admin-teile'

/**
 * Ladeansicht von Admin › Startseite (Nr. 96, seit Nr. 99 mit Statusleiste) —
 * in der Form der Seite: Kopf mit Umschalter, die Statusleiste des Entwurfs,
 * links die Abschnittsliste (acht Zeilen), rechts die Vorschau. Die AdminShell
 * steht schon. Farbstaffelung wie admin-laden.tsx.
 */
export function StartseiteLaden(): React.JSX.Element {
  return (
    <div className={cn(ADMIN_RAHMEN, 'flex animate-pulse flex-col gap-4')} aria-busy="true">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div>
          <div className="h-8 w-40 rounded-lg bg-border md:h-9" />
          <div className="mt-2 h-3.5 w-80 max-w-full rounded bg-muted" />
        </div>
        <div className="h-11 w-72 max-w-full rounded-full bg-muted" />
      </div>
      <div className="h-[68px] rounded-2xl border border-border bg-card lg:h-[66px]" />
      <div className="flex flex-col gap-[22px] lg:flex-row lg:items-start">
        <div className="w-full shrink-0 overflow-hidden rounded-2xl border border-border bg-card lg:w-[480px]">
          <div className="h-12" />
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex h-[48px] items-center gap-3 border-t border-border px-4">
              <div className="h-4 w-2/5 rounded bg-border" />
              <div className="ml-auto h-5 w-12 rounded-full bg-muted" />
            </div>
          ))}
        </div>
        <div className="h-80 min-w-0 flex-1 rounded-2xl border border-border bg-card" />
      </div>
    </div>
  )
}
