import { cn } from '@/lib/utils'

/*
 * Ladeansicht der Bestellungen (Nachtlauf Nr. 19) — dieselben Maße wie die
 * fertige Seite: Kopf (h1 + Zeile, Druck-Knopf), Filter-Chips, ab 1024 px
 * Liste links und Bestellung rechts. Am Handy je nach Route die Liste oder
 * die Bestellung. Nur, was sicher kommt; Farbstaffelung wie die anderen
 * Hof-Routen im neuen Design (bg-border Überschriften, bg-muted Flächen).
 */
export function BestellungenLaden({ modus }: { modus: 'liste' | 'detail' }): React.JSX.Element {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10" aria-busy="true">
      <div className={cn('flex flex-col gap-4 md:gap-[18px]', modus === 'detail' && 'hidden lg:flex')}>
        <div className="flex items-end gap-3">
          <div>
            <div className="h-8 w-40 rounded-lg bg-border" />
            <div className="mt-2 h-4 w-32 rounded bg-muted" />
          </div>
          <div className="ml-auto size-11 rounded-full bg-muted md:w-44" />
        </div>
        {/* Die drei Filter (seit Nr. 45): Heute abholen · N, Noch offen · N, Erledigt — Breiten von der fertigen Seite. */}
        <div className="flex gap-2 overflow-hidden">
          {[138, 119, 84].map((breite, i) => (
            <div key={i} className="h-9 shrink-0 rounded-full bg-muted" style={{ width: `${breite}px` }} />
          ))}
        </div>
      </div>
      <div className="mt-4 lg:mt-5 lg:flex lg:items-start lg:gap-5 xl:gap-6">
        <div className={cn('flex flex-col gap-2.5 lg:w-[320px] lg:shrink-0 xl:w-[420px] 2xl:w-[520px]', modus === 'detail' && 'hidden lg:flex')}>
          <div className="mb-0.5 h-3 w-48 rounded bg-border" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex h-[64px] items-center gap-3 rounded-[13px] border border-border bg-card px-3.5">
              <div className="flex-1">
                <div className="h-4 w-36 rounded bg-border" />
                <div className="mt-1.5 h-3 w-28 rounded bg-muted" />
              </div>
              <div className="h-4 w-14 rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className={cn('min-w-0 flex-1', modus === 'liste' && 'hidden lg:block')}>
          <div className="mb-3 flex h-11 items-center gap-2 lg:hidden">
            <div className="size-11 rounded-full bg-muted" />
            <div className="h-5 w-40 rounded bg-border" />
          </div>
          <div className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-4 md:px-[18px]">
            <div className="h-7 w-44 rounded-lg bg-border" />
            <div className="h-[92px] rounded-xl bg-muted" />
            <div className="h-3 w-20 rounded bg-border" />
            {[0, 1].map((i) => (
              <div key={i} className="h-12 border-t border-border" />
            ))}
            <div className="h-11 w-48 rounded-full bg-muted" />
          </div>
        </div>
      </div>
    </div>
  )
}
