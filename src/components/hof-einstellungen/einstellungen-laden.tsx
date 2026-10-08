import { cn } from '@/lib/utils'
import { UnterseitenKopfLaden } from '@/components/hofbereich/hof-laden'

/*
 * Rahmen und Ladeansichten der Einstellungen (Nachtlauf Nr. 22d) — dieselben
 * Maße wie die fertigen Seiten, nur was sicher kommt. Farbstaffelung wie die
 * anderen Hof-Routen im neuen Design: bg-border für Überschriften, bg-muted
 * für Zweitzeilen und Flächen.
 */

/** Übersicht und Konditionen: bis 1000 px wie im Mockup, ab 1024 px zwei Spalten. */
export const EINSTELLUNGEN_RAHMEN = 'mx-auto w-full max-w-[1000px] px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10'

/** Unterseiten: eine Spalte mit Formularen, so breit wie bisher. */
export const UNTERSEITE_RAHMEN = 'mx-auto w-full max-w-2xl px-4 pt-5 pb-12 md:px-8 md:pt-8'

export function EinstellungenLaden(): React.JSX.Element {
  return (
    <div className={cn(EINSTELLUNGEN_RAHMEN, 'animate-pulse')} aria-busy="true">
      <div className="h-8 w-44 rounded-lg bg-border" />
      <div className="mt-2 h-4 w-64 rounded bg-muted" />
      <div className="mt-4 flex flex-col md:grid md:gap-3 lg:grid-cols-2">
        {/* So viele Zeilen wie Bereiche (einstellungenBereiche, seit Nr. 30 neun). */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="flex h-[66px] items-center gap-3 border-t border-border md:h-[78px] md:rounded-2xl md:border md:bg-card md:px-[18px]"
          >
            <div className="flex-1">
              <div className="h-4 w-40 rounded bg-border" />
              <div className="mt-2 h-3 w-56 max-w-full rounded bg-muted" />
            </div>
            <div className="size-4 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function EinstellungenUnterseiteLaden(): React.JSX.Element {
  return (
    <div className={cn(UNTERSEITE_RAHMEN, 'animate-pulse')} aria-busy="true">
      <UnterseitenKopfLaden />
      <div className="mb-5 md:mb-6">
        <div className="h-8 w-48 rounded-lg bg-border" />
        <div className="mt-2 h-4 w-72 max-w-full rounded bg-muted" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="h-40 rounded-2xl border border-border bg-card" />
        <div className="h-56 rounded-2xl border border-border bg-card" />
      </div>
    </div>
  )
}

export function KonditionenLaden(): React.JSX.Element {
  return (
    <div className={cn(EINSTELLUNGEN_RAHMEN, 'animate-pulse')} aria-busy="true">
      <UnterseitenKopfLaden />
      <div className="mb-5 md:mb-6">
        <div className="h-8 w-56 rounded-lg bg-border" />
        <div className="mt-2 h-4 w-80 max-w-full rounded bg-muted" />
      </div>
      <div className="h-16 rounded-2xl border border-border bg-card" />
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="h-52 rounded-2xl border border-border bg-card" />
        <div className="h-52 rounded-2xl border border-border bg-card" />
      </div>
      <div className="mt-4 h-72 rounded-2xl border border-border bg-card" />
    </div>
  )
}
