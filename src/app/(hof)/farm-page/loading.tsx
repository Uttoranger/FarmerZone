/*
 * Ladeansicht von „Mein Hof" (Nachtlauf Nr. 16). Die HofShell steht durch
 * das Layout, gewartet wird nur auf den Inhalt. Gleiche Maße wie die
 * fertige Seite: Kopf (unter lg Karte mit Streifen, ab lg Zeile 80 px),
 * Reiter 48 px, darunter unter lg die Checkliste, ab lg Liste links und
 * Vorschau rechts (320 px, ab xl 360 px). Nur, was sicher kommt — die
 * Balken (Freigabe, stillgelegt) stehen im Layout, die Zeilen der Checkliste
 * hängen von den Daten ab und fehlen hier.
 *
 * Farbstaffelung im neuen Design: bg-border für Überschriften, bg-muted für
 * Zweitzeilen und Flächen (die Bestandspalette --app-* gilt hier nicht).
 */
export default function MeinHofLaden(): React.JSX.Element {
  return (
    <div className="animate-pulse" aria-busy="true">
      <div className="mx-auto max-w-3xl px-4 pt-5 md:px-8 md:pt-7 lg:max-w-none">
        {/* Kopf: unter lg Karte mit Streifen */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card lg:hidden">
          <div className="h-24 bg-muted md:h-28" />
          <div className="flex gap-3 px-4 pb-4">
            <div className="-mt-7 size-14 shrink-0 rounded-full bg-border ring-4 ring-card" />
            <div className="flex-1 pt-3">
              <div className="h-5 w-40 rounded bg-border" />
              <div className="mt-2 h-3.5 w-48 rounded bg-muted" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 px-4 pb-4">
            <div className="h-11 rounded-full bg-muted" />
            <div className="h-11 rounded-full bg-muted" />
          </div>
        </div>
        {/* Kopf: ab lg Zeile */}
        <div className="hidden h-20 items-center gap-4 rounded-2xl border border-border bg-card px-5 lg:flex">
          <div className="size-12 rounded-full bg-border" />
          <div className="flex-1">
            <div className="h-5 w-48 rounded bg-border" />
            <div className="mt-2 h-3.5 w-56 rounded bg-muted" />
          </div>
          <div className="h-11 w-28 rounded-full bg-muted" />
          <div className="h-11 w-36 rounded-full bg-muted" />
        </div>
        {/* Reiter */}
        <div className="mt-4 mb-6 flex h-12 items-center gap-7 border-b border-border">
          <div className="h-4 w-16 rounded bg-border" />
          <div className="h-4 w-24 rounded bg-muted" />
        </div>
      </div>

      {/* Unter lg: Checkliste */}
      <div className="mx-auto max-w-3xl px-4 pb-5 md:px-8 lg:hidden">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="h-5 w-44 rounded bg-border" />
          <div className="mt-3 h-1.5 w-full rounded-full bg-muted" />
          <div className="mt-3 h-3.5 w-3/4 rounded bg-muted" />
        </div>
      </div>

      {/* Ab lg: Liste und Vorschau */}
      <div className="hidden gap-6 px-8 pb-12 lg:flex xl:gap-8">
        <div className="min-w-0 flex-1 space-y-6">
          <div className="h-[116px] rounded-2xl border border-border bg-card p-5">
            <div className="h-5 w-72 rounded bg-border" />
            <div className="mt-4 h-2 w-full rounded-full bg-muted" />
            <div className="mt-4 h-3.5 w-56 rounded bg-muted" />
          </div>
          {[5, 4].map((zeilen, gruppe) => (
            <div key={gruppe}>
              <div className="h-3 w-28 rounded bg-muted" />
              <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-card">
                {Array.from({ length: zeilen }, (_, i) => (
                  <div key={i} className="flex min-h-14 items-center gap-3 border-t border-border px-4 py-3 first:border-t-0">
                    <div className="size-9 rounded-[10px] bg-muted" />
                    <div className="flex-1">
                      <div className="h-3.5 w-32 rounded bg-border" />
                      <div className="mt-1.5 h-3 w-48 rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="w-[320px] shrink-0 xl:w-[360px]">
          <div className="flex h-11 items-center justify-between">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="h-11 w-36 rounded-full bg-muted" />
          </div>
          <div className="mx-auto mt-2 h-[680px] w-[320px] rounded-[2.4rem] bg-muted" />
        </div>
      </div>
    </div>
  )
}
