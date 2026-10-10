/*
 * Ladeansichten der Druckansichten (Nachtlauf Nr. 31): /orders/[orderId]/print
 * (Abholzettel) und /orders/today/print (Packliste des Tages). Beide stehen im
 * Bestandslayout (farmer) und warten auf die Datenbank. Gleiche Maße wie die
 * fertigen Seiten, aber nur aus Tokens — die Druckseiten selbst sind Papier
 * (fest hell), ihr Platzhalter folgt dem Theme wie jede andere Ladeansicht.
 * Farbstaffelung des Bestands wie src/app/(farmer)/loading.tsx.
 */

/** Abholzettel: Knopf „Drucken", Kopf mit Hof, drei Abschnitte, Positionen. */
export function BestellDruckLaden(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-md animate-pulse p-8" aria-busy="true">
      <div className="mb-6 flex gap-4">
        <div className="h-8 w-24 rounded-lg bg-app-trough" />
        <div className="h-4 w-14 self-center rounded bg-app-chip" />
      </div>
      <div className="mb-5 border-b-2 border-border pb-4">
        <div className="h-6 w-48 rounded bg-border" />
        <div className="mt-2 h-4 w-56 rounded bg-app-trough" />
        <div className="mt-1 h-4 w-32 rounded bg-app-trough" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="mb-5">
          <div className="mb-2 h-3 w-20 rounded bg-app-chip" />
          <div className="h-5 w-40 rounded bg-border" />
          <div className="mt-1.5 h-4 w-32 rounded bg-app-trough" />
        </div>
      ))}
      <div className="border-t-2 border-border pt-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex justify-between gap-3 border-b border-border py-2">
            <div className="h-4 w-40 rounded bg-app-trough" />
            <div className="h-4 w-14 rounded bg-app-trough" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Packliste des Tages: Leiste mit Zurück und Drucken, Kopf, Summen je Produkt, Bestellungen. */
export function PacklisteDruckLaden(): React.JSX.Element {
  return (
    <div className="min-h-screen animate-pulse bg-card" aria-busy="true">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <div className="h-4 w-36 rounded bg-app-chip" />
        <div className="h-8 w-24 rounded-lg bg-app-trough" />
      </div>
      <div className="mx-auto max-w-2xl px-8 py-6">
        <div className="mb-8 border-b border-border pb-4">
          <div className="mb-2 h-3 w-28 rounded bg-app-chip" />
          <div className="h-8 w-36 rounded-lg bg-border" />
          <div className="mt-1.5 h-4 w-44 rounded bg-app-trough" />
        </div>
        <div className="mb-3 h-3 w-24 rounded bg-app-chip" />
        <div className="mb-10 overflow-hidden rounded-lg border border-border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
              <div className="h-4 w-40 rounded bg-app-trough" />
              <div className="h-6 w-10 rounded bg-border" />
            </div>
          ))}
        </div>
        <div className="mb-3 h-3 w-24 rounded bg-app-chip" />
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-lg border border-border px-4 py-3">
              <div className="h-5 w-44 rounded bg-border" />
              <div className="mt-2 h-4 w-3/4 rounded bg-app-trough" />
              <div className="mt-1 h-4 w-1/2 rounded bg-app-trough" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
