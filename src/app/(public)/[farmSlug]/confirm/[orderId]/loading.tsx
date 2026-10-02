/**
 * Ladeansicht der Bestellbestätigung. Maße aus
 * src/app/(public)/[farmSlug]/confirm/[orderId]/page.tsx: Spalte max. 512 px,
 * px-4 py-10, darin die Bestätigungskarte mit Abholzeit, Positionen und Summe.
 *
 * Diese Wartezeit ist die heikelste der Kundenseiten: Wer gerade bezahlt hat,
 * schaut auf diese Seite und will wissen, ob es geklappt hat. Ein leerer
 * Bildschirm an dieser Stelle liest sich wie ein verlorener Auftrag — deshalb
 * steht die Karte von Anfang an da, nur noch ohne Inhalt.
 */
export default function BestaetigungLaden() {
  return (
    <div
      className="min-h-screen animate-pulse bg-background"
      aria-busy="true"
      aria-label="Bestellbestätigung wird geladen"
    >
      <div className="h-14 border-b border-border bg-card md:h-16" />
      <div className="hidden md:block" aria-hidden="true">
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <div className="h-5 w-24 rounded bg-app-chip" />
        </div>
      </div>

      <main className="mx-auto max-w-lg px-4 py-10">
        {/* Zeichen und Überschrift */}
        <div className="mx-auto size-12 rounded-full bg-muted" />
        <div className="mx-auto mt-4 h-7 w-56 rounded-lg bg-border" />
        <div className="mx-auto mt-2 h-4 w-64 rounded bg-app-chip" />

        {/* Abholzeit */}
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <div className="h-4 w-32 rounded bg-app-trough" />
          <div className="mt-3 h-6 w-48 rounded bg-app-trough" />
          <div className="mt-2 h-4 w-40 rounded bg-app-chip" />
        </div>

        {/* Positionen und Summe */}
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <div className="h-4 w-28 rounded bg-app-trough" />
          <div className="mt-3 space-y-2.5">
            <div className="flex justify-between">
              <div className="h-4 w-40 rounded bg-app-chip" />
              <div className="h-4 w-14 rounded bg-app-chip" />
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-32 rounded bg-app-chip" />
              <div className="h-4 w-14 rounded bg-app-chip" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
            <div className="h-4 w-20 rounded bg-app-trough" />
            <div className="h-5 w-24 rounded bg-app-trough" />
          </div>
        </div>

        <div className="mt-6 h-11 w-full rounded-lg bg-muted" />
      </main>
    </div>
  )
}
