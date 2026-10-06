/*
 * Ladeansicht von „Produkte" (Nachtlauf Nr. 18). Die HofShell steht durch das
 * Layout, gewartet wird nur auf den Inhalt. Gleiche Maße wie die fertige
 * Seite: Kopf (h1 + Zahl), Filter-Chips und Suche, darunter ab 1024 px die
 * Tabelle mit Kopfzeile und vier Zeilen, sonst vier Karten-Zeilen. Nur, was
 * sicher kommt — Hinweise und der leere Zustand hängen von den Daten ab.
 *
 * Farbstaffelung im neuen Design: bg-border für Überschriften, bg-muted für
 * Zweitzeilen und Flächen.
 */
export default function ProdukteLaden(): React.JSX.Element {
  return (
    <div className="mx-auto w-full max-w-6xl animate-pulse px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10" aria-busy="true">
      <div className="flex flex-col gap-4 md:gap-[18px]">
        <div className="flex items-end gap-3">
          <div>
            <div className="h-8 w-32 rounded-lg bg-border" />
            <div className="mt-2 h-4 w-44 rounded bg-muted" />
          </div>
          <div className="ml-auto hidden h-11 w-44 rounded-full bg-muted md:block" />
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex gap-2 md:flex-1">
            {[16, 28, 28, 24].map((breite, i) => (
              <div key={i} className="h-9 rounded-full bg-muted" style={{ width: `${breite * 4}px` }} />
            ))}
          </div>
          <div className="h-11 w-full rounded-full bg-muted md:h-9 md:w-[260px]" />
        </div>

        <div className="hidden overflow-hidden rounded-2xl border border-border bg-card lg:block">
          <div className="h-9 border-b border-border" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex h-[68px] items-center gap-4 border-t border-border px-3.5 first:border-t-0">
              <div className="size-11 rounded-xl bg-muted" />
              <div className="h-4 w-48 rounded bg-border" />
              <div className="ml-auto h-4 w-16 rounded bg-muted" />
              <div className="h-8 w-32 rounded-full bg-muted" />
              <div className="h-5 w-20 rounded-full bg-muted" />
              <div className="h-6 w-10 rounded-full bg-muted" />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2.5 lg:hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex h-[78px] items-center gap-2.5 rounded-[13px] border border-border bg-card p-2.5">
              <div className="size-[46px] rounded-xl bg-muted" />
              <div className="flex-1">
                <div className="h-4 w-32 rounded bg-border" />
                <div className="mt-1.5 h-3 w-24 rounded bg-muted" />
              </div>
              <div className="h-8 w-28 rounded-full bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
