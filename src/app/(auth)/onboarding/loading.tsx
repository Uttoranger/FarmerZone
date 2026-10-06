/**
 * Ladeansicht von „Hof einrichten" (Nr. 15): Die Seite wartet auf Sitzung und
 * Hofdaten. Gezeigt wird nur die Form des Inhalts — ob danach die HofShell
 * (mit Hof) oder die Fokus-Shell (ohne Hof) kommt, weiß das Skelett noch
 * nicht. Liegt im Segment onboarding, damit es nicht für /login oder
 * /register gilt (DESIGN_SYSTEM, „Ladeansicht einer Route").
 */
export default function EinrichtenLaden(): React.JSX.Element {
  return (
    <div data-design="neu" className="min-h-dvh bg-background">
      <div className="mx-auto max-w-[1180px] animate-pulse px-4 pt-5 pb-12 md:px-8 md:pt-8" aria-busy="true">
        <div className="mb-2 h-7 w-56 rounded-lg bg-border" />
        <div className="mb-5 h-4 w-44 rounded bg-muted" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-7">
          <div className="flex flex-col gap-3">
            <div className="h-[92px] rounded-2xl border border-border bg-card" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                <div className="size-7 shrink-0 rounded-full bg-muted" />
                <div className="flex-1">
                  <div className="mb-2 h-4 w-48 rounded bg-border" />
                  <div className="h-3 w-2/3 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-4">
            <div className="h-44 rounded-2xl border border-border bg-card" />
            <div className="h-36 rounded-2xl border border-border bg-card" />
          </div>
        </div>
      </div>
    </div>
  )
}
