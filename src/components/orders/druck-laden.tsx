/*
 * Ladeansichten der Druckansichten (Nachtlauf Nr. 31): /orders/[orderId]/print
 * (Abholzettel) und /orders/today/print (Packliste des Tages). Beide stehen in
 * der Gruppe (druck) und warten auf die Datenbank. Gleiche Maße wie die
 * fertigen Seiten und wie sie auf dem Papier des Layouts (fest hell): Die
 * Platzhalter nehmen deshalb dieselben Tokens wie die Seiten, die in beiden
 * Themes gleich sind (primary-foreground in Abstufungen) — ein Platzhalter
 * aus Theme-Tokens läge im dunklen Modus dunkel auf Crème.
 */

/** Abholzettel: Knopf „Drucken", Kopf mit Hof, drei Abschnitte, Positionen. */
export function BestellDruckLaden(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-md animate-pulse p-8" aria-busy="true">
      <div className="mb-6 flex gap-4">
        <div className="h-8 w-24 rounded-lg bg-primary-foreground/10" />
        <div className="h-4 w-14 self-center rounded bg-primary-foreground/5" />
      </div>
      <div className="mb-5 border-b-2 border-primary-foreground/20 pb-4">
        <div className="h-6 w-48 rounded bg-primary-foreground/15" />
        <div className="mt-2 h-4 w-56 rounded bg-primary-foreground/10" />
        <div className="mt-1 h-4 w-32 rounded bg-primary-foreground/10" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="mb-5">
          <div className="mb-2 h-3 w-20 rounded bg-primary-foreground/5" />
          <div className="h-5 w-40 rounded bg-primary-foreground/15" />
          <div className="mt-1.5 h-4 w-32 rounded bg-primary-foreground/10" />
        </div>
      ))}
      <div className="border-t-2 border-primary-foreground/20 pt-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex justify-between gap-3 border-b border-primary-foreground/20 py-2">
            <div className="h-4 w-40 rounded bg-primary-foreground/10" />
            <div className="h-4 w-14 rounded bg-primary-foreground/10" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Packliste des Tages: Leiste mit Zurück und Drucken, Kopf, Summen je Produkt, Bestellungen. */
export function PacklisteDruckLaden(): React.JSX.Element {
  return (
    <div className="min-h-screen animate-pulse" aria-busy="true">
      <div className="flex items-center gap-3 border-b border-primary-foreground/20 px-6 py-4">
        <div className="h-4 w-36 rounded bg-primary-foreground/5" />
        <div className="h-8 w-24 rounded-lg bg-primary-foreground/10" />
      </div>
      <div className="mx-auto max-w-2xl px-8 py-6">
        <div className="mb-8 border-b border-primary-foreground/20 pb-4">
          <div className="mb-2 h-3 w-28 rounded bg-primary-foreground/5" />
          <div className="h-8 w-36 rounded-lg bg-primary-foreground/15" />
          <div className="mt-1.5 h-4 w-44 rounded bg-primary-foreground/10" />
        </div>
        <div className="mb-3 h-3 w-24 rounded bg-primary-foreground/5" />
        <div className="mb-10 overflow-hidden rounded-lg border border-primary-foreground/20">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between gap-3 border-b border-primary-foreground/20 px-4 py-3 last:border-b-0">
              <div className="h-4 w-40 rounded bg-primary-foreground/10" />
              <div className="h-6 w-10 rounded bg-primary-foreground/15" />
            </div>
          ))}
        </div>
        <div className="mb-3 h-3 w-24 rounded bg-primary-foreground/5" />
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-lg border border-primary-foreground/20 px-4 py-3">
              <div className="h-5 w-44 rounded bg-primary-foreground/15" />
              <div className="mt-2 h-4 w-3/4 rounded bg-primary-foreground/10" />
              <div className="mt-1 h-4 w-1/2 rounded bg-primary-foreground/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
