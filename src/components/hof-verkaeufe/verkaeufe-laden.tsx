import { cn } from '@/lib/utils'

/*
 * Ladeansicht der Verkäufe (Nachtlauf Nr. 22b) — dieselben Maße wie die
 * fertige Seite: Kopf mit Knopf, drei Kennzahlen, Überschrift und Liste.
 * Nur, was sicher kommt (Stripe-Link und Wiederholen hängen von den Daten
 * ab). Farbstaffelung wie die anderen Hof-Routen im neuen Design: bg-border
 * für Überschriften, bg-muted für Zweitzeilen und Flächen.
 */
export const VERKAEUFE_RAHMEN = 'mx-auto w-full max-w-4xl px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10'

export function VerkaeufeLaden(): React.JSX.Element {
  return (
    <div className={cn(VERKAEUFE_RAHMEN, 'animate-pulse')} aria-busy="true">
      <div className="flex flex-col gap-4 md:gap-[18px]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="h-8 w-32 rounded-lg bg-border" />
            <div className="mt-2 h-4 w-56 rounded bg-muted" />
          </div>
          <div className="h-11 w-44 rounded-full bg-muted" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-[132px] rounded-2xl border border-border bg-card md:h-[148px]" />
          <div className="h-[118px] rounded-2xl border border-border bg-card md:h-[148px]" />
          <div className="h-[118px] rounded-2xl border border-border bg-card md:h-[148px]" />
        </div>
        <div className="h-3 w-28 rounded bg-border" />
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex h-[84px] items-center gap-3 border-t border-border px-3.5 first:border-t-0 md:px-[18px]">
              <div className="hidden size-10 rounded-full bg-muted sm:block" />
              <div className="flex-1">
                <div className="h-4 w-40 rounded bg-border" />
                <div className="mt-1.5 h-3 w-52 rounded bg-muted" />
                <div className="mt-2 h-4 w-20 rounded-full bg-muted" />
              </div>
              <div className="h-4 w-16 rounded bg-muted" />
              <div className="w-[88px]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
