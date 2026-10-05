/**
 * Ladeansicht der Produktseite (Nr. 11) — Platzhalter in der Form des
 * fertigen Inhalts (DESIGN_SYSTEM, „Zustände": Skeleton in Kartenform, kein
 * Spinner). Maße von der KundeShell und
 * src/components/produktdetail/produktdetail-kunde.tsx abgenommen:
 * Kopfzeile 56/64 px; am Handy das Bild 200 px über die volle Breite, ab
 * 768 px die Rückweg-Zeile (44 px) und das Bild 300 × 300 neben Name und
 * Text; darunter die Kaufkarte; ab 1024 px rechts die Spalte (340/360 px).
 *
 * Eigene Datei in diesem Segment: Sonst griffe die Ladeansicht der Hofseite
 * (Titelbild, Reiter) — eine andere Form, die beim Umschalten springt.
 * Die Seite steht im Geltungsbereich data-design="neu"; diese Ansicht kommt
 * vor der Shell und setzt den Marker selbst.
 *
 * BEWUSST OHNE Größenkacheln, Pausen-Hinweis und „Gleich mit abholen": Ob es
 * sie gibt, entscheiden die Daten.
 */
export default function ProduktdetailLaden() {
  return (
    <div data-design="neu" className="min-h-dvh animate-pulse bg-background" aria-busy="true" aria-label="Produkt wird geladen">
      <div className="h-14 border-b border-border bg-background md:h-16" />

      <div className="mx-auto hidden max-w-[1200px] px-6 pt-3 md:block">
        <div className="flex h-11 items-center">
          <div className="h-4 w-28 rounded bg-app-chip" />
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-4 pb-28 md:px-6 md:pt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-[22px] lg:col-start-1 lg:row-start-1">
          <div className="flex flex-col md:flex-row md:items-start md:gap-[26px]">
            <div className="-mx-4 h-[200px] shrink-0 bg-muted md:mx-0 md:size-[300px] md:rounded-[18px]" />
            <div className="flex flex-1 flex-col gap-3 pt-4 md:pt-0">
              <div className="h-3 w-40 rounded bg-app-chip" />
              <div className="h-8 w-3/4 rounded-lg bg-border" />
              <div className="h-5 w-48 rounded-full bg-app-trough" />
              <div className="h-4 w-full rounded bg-app-chip" />
              <div className="h-4 w-5/6 rounded bg-app-chip" />
            </div>
          </div>

          {/* Kaufkarte: Preis, darunter Menge und Knopf (am Handy fest unten) */}
          <div className="rounded-2xl border border-border bg-card p-4 md:px-5 md:py-[18px]">
            <div className="h-6 w-36 rounded bg-border" />
            <div className="mt-2 h-4 w-24 rounded bg-app-trough" />
            <div className="mt-4 hidden items-center gap-3.5 md:flex">
              <div className="h-11 w-32 rounded-full bg-muted" />
              <div className="h-[46px] w-52 rounded-full bg-muted" />
            </div>
          </div>

          <div className="h-12 rounded-2xl border border-border bg-card" />
        </div>

        <div className="hidden flex-col gap-[18px] lg:col-start-2 lg:row-start-1 lg:flex">
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
          </div>
        </div>
      </div>

      {/* Die feste Leiste am Handy */}
      <div className="fixed inset-x-0 bottom-0 flex items-center gap-2.5 border-t border-border bg-card px-4 pt-3 pb-4 md:hidden">
        <div className="h-11 w-32 rounded-full bg-muted" />
        <div className="h-[46px] flex-1 rounded-full bg-muted" />
      </div>
    </div>
  )
}
