/**
 * Ladeansicht von „Hof einrichten" (Nr. 15): Die Seite wartet auf Sitzung und
 * Hofdaten. Gezeigt wird nur die Form des Inhalts — ob danach die HofShell
 * (mit Hof) oder die Fokus-Shell (ohne Hof) kommt, weiß das Skelett noch
 * nicht. Liegt im Segment onboarding, damit es nicht für /login oder
 * /register gilt (DESIGN_SYSTEM, „Ladeansicht einer Route").
 */
import { RUNDUNG } from '@/components/ui/rundung'
import { cn } from '@/lib/utils'

export default function EinrichtenLaden(): React.JSX.Element {
  return (
    <div data-design="neu" className="min-h-dvh bg-background">
      {/* Dieselbe Spalte wie die Seite (896 px Inhalt, Nr. 275) und Karten mit 16 px Rundung (G8). */}
      <div className="w-full max-w-[976px] animate-pulse px-4 pt-3 pb-12 md:px-10 md:pt-5" aria-busy="true">
        <div className="mb-2 h-7 w-56 rounded-lg bg-border" />
        <div className="mb-5 h-4 w-44 rounded bg-muted" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-3">
            <div className={cn('h-[92px] border border-border bg-card', RUNDUNG.blatt)} />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={cn('flex items-center gap-3 border border-border bg-card px-3.5 py-3', RUNDUNG.blatt)}>
                <div className="size-[26px] shrink-0 rounded-full bg-muted" />
                <div className="flex-1">
                  <div className="mb-2 h-4 w-48 rounded bg-border" />
                  <div className="h-3 w-2/3 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2.5">
            <div className={cn('h-44 border border-border bg-card', RUNDUNG.blatt)} />
            <div className={cn('h-36 border border-border bg-card', RUNDUNG.blatt)} />
          </div>
        </div>
      </div>
    </div>
  )
}
