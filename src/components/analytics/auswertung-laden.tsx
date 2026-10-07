/*
 * Ladeansichten der Auswertung (/analytics, /analytics/umfeld) — Nachtlauf
 * Nr. 31. Die Seiten stehen noch im Bestandslayout (FarmerNav); gewartet wird
 * nur auf den Inhalt. Gleiche Maße wie die fertigen Seiten: Seitenkopf
 * (PageHeader, 27 px), die Reiter (44 px mit Linie), darunter je Reiter die
 * Bedienung und zwei bzw. drei Karten. Nur, was sicher kommt — Hinweise und
 * der leere Zustand hängen von den Daten ab.
 *
 * Farbstaffelung des Bestands wie src/app/(farmer)/loading.tsx: bg-border
 * für Überschriften, bg-app-trough für Zweitzeilen und Wannen, bg-app-chip
 * für leise Zeilen.
 */

function Kopf(): React.JSX.Element {
  return (
    <>
      <div className="mb-6">
        <div className="h-9 w-44 rounded-lg bg-border" />
        <div className="mt-1 h-4 w-64 rounded bg-app-trough" />
      </div>
      <div className="mb-6 flex border-b border-border">
        {[0, 1].map((i) => (
          <div key={i} className="flex min-h-11 items-center px-4">
            <div className="h-4 w-20 rounded bg-app-trough" />
          </div>
        ))}
      </div>
    </>
  )
}

export function AuswertungLaden({ reiter }: { reiter: 'umsatz' | 'umfeld' }): React.JSX.Element {
  return (
    <div className="mx-auto max-w-2xl animate-pulse px-4 py-6" aria-busy="true">
      <Kopf />
      {reiter === 'umsatz' ? (
        <div className="space-y-5">
          {/* Woche · Monat · Jahr */}
          <div className="h-[46px] rounded-[10px] bg-app-trough" />
          {/* ‹ Zeitraum › */}
          <div className="flex items-center justify-between gap-2">
            <div className="size-11 rounded-full bg-app-chip" />
            <div className="h-6 w-40 rounded bg-border" />
            <div className="size-11 rounded-full bg-app-chip" />
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="h-10 w-40 rounded-lg bg-border" />
            <div className="mt-2 h-4 w-48 rounded bg-app-trough" />
            <div className="mt-6 h-32 rounded-xl bg-app-chip" />
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 h-4 w-36 rounded bg-border" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="mb-3 last:mb-0">
                <div className="mb-1.5 h-3.5 w-full rounded bg-app-chip" />
                <div className="h-2 rounded-full bg-app-trough" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Bereich und Umkreis */}
          <div className="mb-4 space-y-3">
            <div className="h-[52px] rounded-xl bg-app-trough" />
            <div className="h-[54px] rounded-xl border border-border bg-card" />
          </div>
          {/* Liste | Karte */}
          <div className="mb-3 flex justify-end">
            <div className="h-11 w-44 rounded-xl bg-app-trough" />
          </div>
          <div className="mb-3 h-3 w-56 rounded bg-app-chip" />
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card px-4 py-3">
                <div className="flex justify-between gap-3">
                  <div className="h-4 w-36 rounded bg-border" />
                  <div className="h-4 w-12 rounded bg-app-trough" />
                </div>
                <div className="mt-2 h-3.5 w-2/3 rounded bg-app-chip" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
