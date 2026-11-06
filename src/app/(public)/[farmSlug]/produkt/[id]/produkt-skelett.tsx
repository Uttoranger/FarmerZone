/**
 * Skelett der Produktseite (Nr. 11, Aufbau seit Nr. 235 nach den Boards
 * w1-/s1-produkt) — Platzhalter in der Form des fertigen Inhalts (DESIGN_SYSTEM,
 * „Zustände": Skeleton in Kartenform, kein Spinner). Maße von der KundeShell und
 * src/components/produktdetail/produktdetail-kunde.tsx abgenommen: Kopfzeile
 * 56/64 px, die Rückweg-Zeile (44 px), am Handy das Bild 390 : 200 gerundet, ab
 * 768 px 300 × 300 neben Name und Text; darunter Preis und die Leiste mit Menge und
 * Knopf (am Handy fest unten); ab 1024 px rechts die Spalte (360 px, Abstand 64 px).
 *
 * Seit Nr. 117 keine `loading.tsx` mehr, sondern die Suspense-Grenze IN der
 * Seite, NACH der Prüfung von Hof und Produkt — so antwortet ein unbekanntes
 * Produkt mit 404 statt hinter dem Skelett mit 200 (wie die Hofseite).
 * Die Seite steht im Geltungsbereich data-design="neu"; das Skelett steht
 * vor der Shell und setzt den Marker selbst.
 *
 * BEWUSST OHNE Größen, Pausen-Hinweis, Kennzeichnung und „Gleich mit abholen": Ob es
 * sie gibt, entscheiden die Daten.
 */
export function ProduktSkelett(): React.JSX.Element {
  return (
    <div data-design="neu" className="min-h-dvh animate-pulse bg-background" aria-busy="true" aria-label="Produkt wird geladen">
      <div className="h-14 border-b border-border bg-background md:h-16" />

      <div className="mx-auto max-w-[1152px] px-4 pt-2 pb-28 md:px-6 md:pt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-x-16">
        <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-1">
          <div className="flex h-11 items-center">
            <div className="h-4 w-44 rounded bg-app-chip" />
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-6">
            <div className="aspect-[390/200] w-full shrink-0 rounded-2xl border border-border bg-muted md:aspect-auto md:size-[300px]" />
            <div className="flex flex-1 flex-col gap-3">
              <div className="h-8 w-3/4 rounded-lg bg-border" />
              <div className="h-5 w-48 rounded-full bg-app-trough" />
              <div className="h-4 w-full rounded bg-app-chip" />
              <div className="h-4 w-5/6 rounded bg-app-chip" />
            </div>
          </div>
          <div className="h-5 w-36 rounded bg-border" />
          <div className="h-4 w-56 rounded bg-app-trough" />
          <div className="mt-4 hidden items-center gap-3 border-t border-border pt-4 md:flex">
            <div className="h-[50px] flex-1 rounded-[14px] bg-muted" />
            <div className="h-11 w-32 rounded-full border border-border" />
          </div>
        </div>

        <div className="hidden flex-col gap-3 lg:col-start-2 lg:row-start-1 lg:flex">
          {[0, 1].map((karte) => (
            <div key={karte} className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-3.5 py-3">
              <div className="h-3.5 w-32 rounded bg-app-trough" />
              <div className="h-4 w-48 rounded bg-app-chip" />
              <div className="h-4 w-40 rounded bg-app-chip" />
            </div>
          ))}
        </div>
      </div>

      {/* Die feste Leiste am Handy */}
      <div className="fixed inset-x-0 bottom-0 flex items-center gap-3 border-t border-border bg-card px-4 pt-3 pb-4 md:hidden">
        <div className="h-11 w-32 rounded-full border border-border" />
        <div className="h-[50px] flex-1 rounded-[14px] bg-muted" />
      </div>
    </div>
  )
}
