/**
 * Ladeansicht der Hofseite (neues Design seit Nr. 10) — Platzhalter in der
 * Form des fertigen Inhalts (DESIGN_SYSTEM, „Zustände": Skeleton in
 * Kartenform, kein Spinner). Maße von der KundeShell und
 * src/components/hofseite/hofseite-kunde.tsx abgenommen: Kopfzeile 56/64 px,
 * Rückweg-Zeile 44 px, Titelbild 220 px (ab md 300 px), Aktionen 44 px,
 * Reiterleiste 48 px, Inhalt max. 1200 px; ab 1024 px rechts die Spalte
 * (340/360 px). Gezeigt wird die Übersicht — der häufigste Einstieg.
 *
 * Die Seite steht in der KundeShell und damit im Geltungsbereich
 * data-design="neu" — diese Ansicht kommt vor der Shell und setzt den Marker
 * deshalb selbst, sonst blitzten beim Umschalten die alten Farben auf.
 *
 * BEWUSST OHNE Pausen-Hinweis, Fotos und Mini-Warenkorb: Ob es sie gibt,
 * entscheiden die Daten; Platz, in den nichts einrückt, ließe die Seite
 * springen.
 */
export default function HofseiteLaden() {
  return (
    <div data-design="neu" className="min-h-dvh animate-pulse bg-background" aria-busy="true" aria-label="Hofseite wird geladen">
      <div className="h-14 border-b border-border bg-background md:h-16" />

      <div className="mx-auto max-w-[1200px] px-4 pt-1 md:px-6 md:pt-3">
        <div className="flex h-11 items-center">
          <div className="h-4 w-24 rounded bg-app-chip" />
        </div>
      </div>

      {/* Titelbild */}
      <div className="h-[220px] w-full bg-muted md:h-[300px]" />

      {/* Name und Aktionen: am Handy die Knöpfe unter dem Bild, ab md Hofzeichen, Name und Knöpfe in einer Reihe */}
      <div className="mx-auto max-w-[1200px] px-4 md:flex md:items-end md:gap-6 md:px-6">
        <div className="hidden md:-mt-11 md:flex md:flex-1 md:items-end md:gap-6">
          <div className="size-24 shrink-0 rounded-full border-[3px] border-background bg-border" />
          <div className="pb-1">
            <div className="h-9 w-72 rounded-lg bg-border" />
            <div className="mt-2 h-4 w-56 rounded bg-app-chip" />
          </div>
        </div>
        <div className="flex gap-2 pt-3.5 md:gap-2.5 md:pt-0 md:pb-1.5">
          <div className="h-11 flex-1 rounded-full border border-border md:w-28 md:flex-none" />
          <div className="h-11 flex-1 rounded-full border border-border md:w-28 md:flex-none" />
          <div className="hidden h-11 w-28 rounded-full border border-border md:block" />
          <div className="h-11 flex-1 rounded-full bg-muted md:w-40 md:flex-none" />
        </div>
      </div>

      {/* Reiterleiste */}
      <div className="mt-5 border-b border-border md:mt-7">
        <div className="mx-auto flex h-12 max-w-[1200px] items-center gap-7 px-4 md:px-6">
          <div className="h-4 w-20 rounded bg-border" />
          <div className="h-4 w-24 rounded bg-app-chip" />
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-28 md:px-6 md:pt-7 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Rechte Spalte (am Handy vor dem Inhalt): Nächste Abholung, Zahlung & Kontakt */}
        <div className="mb-[26px] flex flex-col gap-[18px] lg:col-start-2 lg:row-start-1 lg:mb-0">
          <div className="rounded-2xl border border-border bg-card p-[18px]">
            <div className="h-4 w-36 rounded bg-app-trough" />
            <div className="mt-3 flex gap-2">
              <div className="h-[62px] flex-1 rounded-xl bg-muted" />
              <div className="h-[62px] flex-1 rounded-xl bg-muted" />
              <div className="h-[62px] flex-1 rounded-xl bg-muted" />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-[18px]">
            <div className="h-4 w-40 rounded bg-app-trough" />
            <div className="mt-3 h-4 w-44 rounded bg-app-chip" />
            <div className="mt-2.5 h-4 w-36 rounded bg-app-chip" />
            <div className="mt-2.5 h-4 w-32 rounded bg-app-chip" />
          </div>
        </div>

        {/* Inhalt der Übersicht: Über uns, Produkte */}
        <div className="flex flex-col gap-[26px] lg:col-start-1 lg:row-start-1">
          <div className="rounded-2xl border border-border bg-card p-[22px]">
            <div className="h-5 w-28 rounded bg-border" />
            <div className="mt-3 h-4 w-full rounded bg-app-chip" />
            <div className="mt-2 h-4 w-5/6 rounded bg-app-chip" />
          </div>
          <div className="h-5 w-32 rounded bg-border" />
          <div className="grid gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 md:flex-col md:items-stretch md:gap-0 md:p-0">
                <div className="size-16 shrink-0 rounded-xl bg-muted md:h-[140px] md:w-full md:rounded-none md:rounded-t-2xl" />
                <div className="min-w-0 flex-1 md:p-3.5">
                  <div className="h-4 w-3/4 rounded bg-app-trough" />
                  <div className="mt-2 h-4 w-1/3 rounded bg-app-chip" />
                </div>
                <div className="size-11 shrink-0 rounded-full bg-muted md:mx-3.5 md:mb-3.5 md:h-9 md:w-28 md:self-end" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
