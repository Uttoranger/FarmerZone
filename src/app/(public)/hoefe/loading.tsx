/**
 * Ladeansicht der Hofübersicht. Maße von src/app/(public)/hoefe/page.tsx und
 * src/components/hoefe/hoefe-client.tsx abgenommen: Kopfleiste 56/64 px,
 * Spalte max. 768 px (ab lg 1152), Kicker, Fraunges-Überschrift,
 * Bereichs-Umschalter, Suchfeld, Filter-Chips, dann die Hofkarten.
 *
 * Gezeigt werden vier Karten: So hoch ist die Liste beim Pilotbestand
 * ungefähr, und mehr Platzhalter als später Inhalt lassen die Seite beim
 * Umschalten zusammenfallen.
 *
 * Die Farbstaffelung folgt der vorhandenen Ladeansicht des Hofbereichs:
 * --border für Überschriften, --app-trough für Zweitzeilen, --app-chip für
 * leise Zeilen, --muted für Flächen.
 */
export default function HoefeLaden() {
  return (
    <div className="min-h-screen animate-pulse bg-background" aria-busy="true" aria-label="Höfe werden geladen">
      <div className="h-14 border-b border-border bg-card md:h-16" />

      <main className="mx-auto max-w-3xl px-4 pt-6 pb-16 sm:pt-10 lg:max-w-6xl">
        {/* Kicker und Überschrift */}
        <div className="mb-3 h-3 w-28 rounded bg-app-chip" />
        <div className="h-9 w-64 rounded-lg bg-border sm:h-10 sm:w-80" />

        {/* Bereichs-Umschalter: Hofladen | Futtermittel */}
        <div className="mt-5 grid w-full grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1">
          <div className="h-11 rounded-lg bg-muted" />
          <div className="h-11 rounded-lg bg-app-trough" />
        </div>

        {/* Suchfeld */}
        <div className="mt-3 h-11 w-full rounded-xl border border-border bg-card" />

        {/* BEWUSST OHNE Filter-Chips: Wie viele es gibt, entscheiden die Daten
            (Kategorien, Sorten, Siegel) — im Hofladen ohne Siegel keine. Platz
            zu reservieren, in den nichts einrückt, lässt die Liste nach OBEN
            springen, und das ist schlimmer als ein Chip, der dazukommt. */}

        {/* Hofkarten — eine Spalte, wie der Server sie rendert: Der
            Desktop-Splitscreen entsteht erst nach der Hydration
            (useIstBreit liefert serverseitig false). */}
        <ul className="mt-4 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="rounded-2xl border border-border bg-card">
              <div className="flex items-start gap-3 p-4">
                <div className="size-12 shrink-0 rounded-full bg-muted" />
                <div className="min-w-0 flex-1">
                  <div className="h-5 w-40 rounded bg-app-trough" />
                  <div className="mt-2 h-4 w-full max-w-xs rounded bg-app-chip" />
                  <div className="mt-2 flex gap-2">
                    <div className="h-5 w-16 rounded-full bg-app-chip" />
                    <div className="h-5 w-20 rounded-full bg-app-chip" />
                  </div>
                </div>
                <div className="h-9 w-20 shrink-0 rounded-lg bg-muted" />
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
