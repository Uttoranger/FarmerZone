/**
 * Ladeansicht der Bar-Bestätigung. Maße aus
 * src/app/(public)/[farmSlug]/bestaetigen/[token]/page.tsx: Spalte max. 560 px,
 * Überschrift mit Frist, die Karte mit Positionen und Summe, darunter der
 * große Knopf und der Textknopf. Wer aus der Mail kommt, sieht sofort, dass
 * die Bestellung gleich erscheint — nicht eine leere Seite.
 */
export default function BarBestaetigenLaden() {
  return (
    <div
      data-design="neu"
      className="min-h-screen animate-pulse bg-background"
      aria-busy="true"
      aria-label="Bestellung wird geladen"
    >
      <div className="h-14 border-b border-border bg-card md:h-16" />

      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-4 pt-3.5 pb-8 md:gap-[18px] md:pt-[60px]">
        {/* Überschrift und Frist */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="h-7 w-72 max-w-full rounded-lg bg-border md:h-8" />
          <div className="h-4 w-80 max-w-full rounded bg-app-chip" />
        </div>

        {/* Positionen und Summe */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-[18px] py-4">
          <div className="flex justify-between">
            <div className="h-4 w-40 rounded bg-app-chip" />
            <div className="h-4 w-14 rounded bg-app-chip" />
          </div>
          <div className="flex justify-between">
            <div className="h-4 w-32 rounded bg-app-chip" />
            <div className="h-4 w-14 rounded bg-app-chip" />
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between">
            <div className="h-5 w-32 rounded bg-app-trough" />
            <div className="h-5 w-16 rounded bg-app-trough" />
          </div>
          <div className="h-3 w-64 max-w-full rounded bg-app-chip" />
        </div>

        <div className="h-[54px] w-full rounded-full bg-muted" />
        <div className="mx-auto h-9 w-56 rounded-full bg-muted" />
      </main>
    </div>
  )
}
