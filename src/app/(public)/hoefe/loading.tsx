/**
 * Ladeansicht von Entdecken (/hoefe, neues Design seit Nr. 09). Maße von
 * src/components/hoefe/hoefe-client.tsx und der KundeShell abgenommen:
 * Kopfzeile 56/64 px, Inhalt max. 1200 px, Überschrift und Unterzeile,
 * das eine Suchfeld „Ort oder Produkt" (48/44 px) mit „Standort nutzen"
 * (seit Nr. 46 darunter bzw. ab 640 px daneben), dann die Hofkarten in der schmalen
 * Gestalt — so rendert der Server die Liste; der Splitscreen mit Karte
 * entsteht erst nach der Hydration (useIstBreit liefert serverseitig false).
 * Am Handy steht unten die Unterleiste der Shell.
 *
 * Die Seite steht in der KundeShell und damit im Geltungsbereich
 * data-design="neu" — diese Ansicht nicht: Sie kommt vor der Shell. Deshalb
 * setzt sie den Marker selbst, sonst blitzten beim Umschalten die alten
 * Farben auf.
 *
 * BEWUSST OHNE Filter-Chips: Wie viele es gibt, entscheiden die Daten;
 * Platz zu reservieren, in den nichts einrückt, lässt die Liste springen.
 *
 * Farbstaffelung wie src/app/(farmer)/loading.tsx: --border für
 * Überschriften, --app-trough für Zweitzeilen, --app-chip für leise Zeilen,
 * --muted für Flächen.
 */
export default function HoefeLaden() {
  return (
    <div data-design="neu" className="min-h-dvh animate-pulse bg-background" aria-busy="true" aria-label="Höfe werden geladen">
      <div className="h-14 border-b border-border bg-background md:h-16" />

      <main className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 pt-5 pb-28 md:px-6 md:pt-7">
        {/* Überschrift und Unterzeile */}
        <div>
          <div className="h-8 w-64 rounded-lg bg-border md:h-9 md:w-80" />
          <div className="mt-2 h-4 w-72 max-w-full rounded bg-app-chip" />
        </div>

        {/* Suchfeld „Ort oder Produkt" und „Standort nutzen" (Nr. 46) */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="h-12 w-full rounded-full border border-border bg-card sm:flex-1 md:h-11" />
          <div className="flex items-center gap-3">
            <div className="h-11 w-[164px] rounded-full bg-muted" />
            <div className="h-3.5 w-36 rounded bg-app-chip" />
          </div>
        </div>

        {/* Karten-Vorschau (nur schmal) und Ergebniszahl */}
        <div className="h-[120px] rounded-2xl border border-border bg-muted lg:hidden" />
        <div className="h-4 w-16 rounded bg-app-chip" />

        {/* Hofkarten — eine Spalte, wie der Server sie rendert. */}
        <ul className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-start gap-3.5">
                <div className="size-11 shrink-0 rounded-full bg-muted" />
                <div className="min-w-0 flex-1">
                  <div className="h-5 w-40 rounded bg-app-trough" />
                  <div className="mt-2 h-3.5 w-28 rounded bg-app-chip" />
                  <div className="mt-2 flex gap-1.5">
                    <div className="h-5 w-14 rounded-full bg-app-chip" />
                    <div className="h-5 w-16 rounded-full bg-app-chip" />
                  </div>
                  <div className="mt-2 h-3.5 w-48 max-w-full rounded bg-app-chip" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </main>

      {/* Die Unterleiste der Shell am Handy — sonst schöbe sie sich nach dem Laden ins Bild. */}
      <div className="fixed inset-x-0 bottom-0 h-[72px] border-t border-border bg-card md:hidden" />
    </div>
  )
}
