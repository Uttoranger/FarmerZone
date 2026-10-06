/*
 * Ladeansicht von „Heute" (Nachtlauf Nr. 17). Die HofShell steht durch das
 * Layout, gewartet wird nur auf den Inhalt. Gleiche Maße wie die fertige
 * Seite: Kopf (h1 + Datum), drei Kennzahlen, darunter die Packliste mit
 * Kopfzeile und drei Zeilen; ab 1280 px rechts die Seitenspalte (360 px),
 * darunter als Raster. Nur, was sicher kommt — Stripe-Hinweis, Teilen-Karte
 * und Erste Schritte hängen von den Daten ab und fehlen hier.
 *
 * Farbstaffelung im neuen Design: bg-border für Überschriften, bg-muted für
 * Zweitzeilen und Flächen.
 */
export default function HeuteLaden(): React.JSX.Element {
  return (
    <div className="mx-auto w-full max-w-6xl animate-pulse px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10" aria-busy="true">
      <div className="flex flex-col gap-4 md:gap-5">
        <div>
          <div className="h-8 w-28 rounded-lg bg-border md:h-9" />
          <div className="mt-2 h-4 w-52 rounded bg-muted" />
        </div>
        <div className="grid grid-cols-3 gap-2.5 md:gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[76px] rounded-2xl border border-border bg-card p-3 md:h-[92px] md:p-4">
              <div className="h-3 w-3/4 rounded bg-muted" />
              <div className="mt-3 h-6 w-1/2 rounded bg-border" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4 md:gap-5 xl:flex-row xl:items-start xl:gap-6">
          <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex h-[60px] items-center gap-3 border-b border-border px-4 md:px-[18px]">
              <div className="h-4 w-36 rounded bg-border" />
              <div className="ml-auto size-11 rounded-full bg-muted md:w-40" />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex min-h-14 items-center gap-3 border-t border-border px-4 py-3 first:border-t-0 md:px-[18px]">
                <div className="flex-1">
                  <div className="h-3.5 w-32 rounded bg-border" />
                  <div className="mt-1.5 h-3 w-48 rounded bg-muted" />
                </div>
                <div className="h-5 w-24 rounded-full bg-muted" />
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 md:gap-5 xl:w-[360px] xl:shrink-0 xl:grid-cols-1">
            {[0, 1].map((i) => (
              <div key={i} className="h-[132px] rounded-2xl border border-border bg-card p-[18px]">
                <div className="h-3 w-28 rounded bg-muted" />
                <div className="mt-3 h-7 w-44 rounded bg-border" />
                <div className="mt-3 h-3 w-32 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
