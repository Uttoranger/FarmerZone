/*
 * Rahmen und Ladeansichten von „Hilfe und Rückmeldung" (/fehler-melden) und
 * „Meine Meldungen" (/meldungen) in der HofShell (Nachtlauf Nr. 22e). Gleiche
 * Maße wie die fertigen Seiten; nur, was sicher kommt (die Karten der Liste
 * hängen von den Daten ab und stehen als drei ruhige Platzhalter da).
 * Farbstaffelung im neuen Design: bg-border für Überschriften, bg-muted für
 * Zweitzeilen und Flächen.
 */

/** Meldung abgeben: Formular (640 px) links, ab lg die Seitenspalte rechts. */
export const MELDEN_RAHMEN = 'mx-auto w-full max-w-[1040px] px-4 pt-5 pb-12 md:px-8 md:pt-7'

/** Meine Meldungen: eine Spalte bis 900 px (Mockup web-h6-meine-meldungen). */
export const MELDUNGEN_RAHMEN = 'mx-auto w-full max-w-[900px] px-4 pt-5 pb-12 md:px-8 md:pt-7'

export function MeldungAbgebenLaden(): React.JSX.Element {
  return (
    <div className={MELDEN_RAHMEN}>
      <div className="animate-pulse lg:flex lg:items-start lg:gap-8" aria-busy="true">
        <div className="flex min-w-0 flex-col gap-3.5 lg:w-[640px] lg:shrink-0">
          <div className="h-11 w-40 rounded-full bg-muted md:hidden" />
          <div className="h-8 w-64 rounded-lg bg-border" />
          <div className="h-4 w-full max-w-md rounded bg-muted" />
          <div className="mt-1 h-3 w-28 rounded bg-muted" />
          <div className="grid gap-2 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[52px] rounded-[14px] bg-muted" />
            ))}
          </div>
          <div className="h-3.5 w-32 rounded bg-muted" />
          <div className="h-[110px] rounded-xl bg-muted" />
          <div className="h-12 rounded-xl bg-muted" />
          <div className="hidden h-40 rounded-2xl border border-border bg-card md:block" />
          <div className="flex justify-end gap-2.5">
            <div className="h-11 w-full rounded-[14px] bg-muted md:w-32 md:rounded-full" />
          </div>
        </div>
        <div className="hidden min-w-0 flex-1 flex-col gap-3 lg:flex">
          <div className="h-44 rounded-2xl border border-border bg-card" />
          <div className="h-36 rounded-2xl border border-border bg-card" />
        </div>
      </div>
    </div>
  )
}

export function MeineMeldungenLaden(): React.JSX.Element {
  return (
    <div className={MELDUNGEN_RAHMEN}>
      <div className="flex animate-pulse flex-col gap-3.5" aria-busy="true">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="h-8 w-56 rounded-lg bg-border" />
          <div className="h-11 w-full rounded-[14px] bg-muted sm:w-44 sm:rounded-full" />
        </div>
        <div className="h-4 w-full max-w-md rounded bg-muted" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="h-5 w-14 rounded-full bg-muted" />
              <div className="h-4 flex-1 rounded bg-border" />
              <div className="h-5 w-20 rounded-full bg-muted" />
            </div>
            <div className="mt-2 h-3 w-24 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
