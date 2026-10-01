/**
 * Ladeansicht der Bestellverfolgung („Wo ist meine Bestellung?"). Maße aus
 * src/app/(public)/[farmSlug]/bestellung/[orderId]/page.tsx: Spalte max.
 * 512 px, px-4 py-10, darin Statuskarte, Abholangabe und Positionen.
 *
 * Diese Seite erreicht man über einen signierten Link aus der E-Mail, oft am
 * Handy und oft unterwegs — also genau dort, wo das Warten am längsten
 * dauert und ein leerer Bildschirm wie ein toter Link aussieht.
 */
export default function BestellungLaden() {
  return (
    <div
      className="min-h-screen animate-pulse bg-background"
      aria-busy="true"
      aria-label="Bestellung wird geladen"
    >
      <div className="h-14 border-b border-border bg-card md:h-16" />
      <div className="hidden md:block" aria-hidden="true">
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <div className="h-5 w-24 rounded bg-app-chip" />
        </div>
      </div>

      <main className="mx-auto max-w-lg px-4 py-10">
        <div className="h-7 w-48 rounded-lg bg-border" />
        <div className="mt-2 h-4 w-56 rounded bg-app-chip" />

        {/* Statuskarte */}
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="size-10 shrink-0 rounded-full bg-muted" />
            <div className="min-w-0 flex-1">
              <div className="h-5 w-32 rounded bg-app-trough" />
              <div className="mt-1.5 h-4 w-44 rounded bg-app-chip" />
            </div>
          </div>
          <div className="mt-4 h-2 w-full rounded-full bg-app-trough" />
        </div>

        {/* Abholung */}
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <div className="h-4 w-28 rounded bg-app-trough" />
          <div className="mt-3 h-6 w-44 rounded bg-app-trough" />
          <div className="mt-2 h-4 w-36 rounded bg-app-chip" />
        </div>

        {/* Positionen */}
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <div className="h-4 w-24 rounded bg-app-trough" />
          <div className="mt-3 space-y-2.5">
            <div className="flex justify-between">
              <div className="h-4 w-36 rounded bg-app-chip" />
              <div className="h-4 w-14 rounded bg-app-chip" />
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-28 rounded bg-app-chip" />
              <div className="h-4 w-14 rounded bg-app-chip" />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
