/**
 * Die Platzhalter der Kasse — zweimal gebraucht, einmal gebaut.
 *
 * Die Kasse wartet zweimal: erst auf die HOFDATEN vom Server (Abholzeiten,
 * Zahlungswege, Servicegebühr) — dafür greift `loading.tsx` —, dann im
 * Browser auf den Warenkorb aus dem localStorage, denn der ist kein
 * Serverzustand (`!isHydrated` in checkout-form.tsx). An der zweiten Stelle
 * stand bis hierher ein drehender Kreis; DESIGN_SYSTEM.md verlangt einen
 * Platzhalter in Kartenform. Beide Wartezeiten zeigen jetzt dasselbe Bild,
 * also springt zwischen ihnen nichts.
 *
 * Die Korbzeilen stehen bewusst als zwei ruhige Zeilen und nicht in der
 * echten Länge: Wie viele Positionen im Korb liegen, weiß der Server nicht.
 */
export function KasseSkelett() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse px-4 py-6" aria-busy="true" aria-label="Kasse wird geladen">
      <div className="h-7 w-44 rounded-lg bg-border" />

      {/* Warenkorb */}
      <div className="mt-5 rounded-xl border border-border bg-card p-4">
        <div className="h-4 w-28 rounded bg-app-trough" />
        <div className="mt-3 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-12 shrink-0 rounded-lg bg-app-chip" />
              <div className="h-4 flex-1 rounded bg-app-chip" />
              <div className="h-4 w-16 rounded bg-app-chip" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <div className="h-4 w-20 rounded bg-app-trough" />
          <div className="h-5 w-24 rounded bg-app-trough" />
        </div>
      </div>

      {/* Abholzeit */}
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <div className="h-4 w-32 rounded bg-app-trough" />
        <div className="mt-3 flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 flex-1 rounded-lg bg-app-chip" />
          ))}
        </div>
      </div>

      {/* Kontakt */}
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <div className="h-4 w-24 rounded bg-app-trough" />
        <div className="mt-3 space-y-3">
          <div className="h-11 w-full rounded-lg bg-app-chip" />
          <div className="h-11 w-full rounded-lg bg-app-chip" />
        </div>
      </div>

      {/* Zahlungswahl */}
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <div className="h-4 w-28 rounded bg-app-trough" />
        <div className="mt-3 space-y-2">
          <div className="h-12 w-full rounded-lg bg-app-chip" />
          <div className="h-12 w-full rounded-lg bg-app-chip" />
        </div>
      </div>

      <div className="mt-6 h-12 w-full rounded-xl bg-muted" />
    </div>
  )
}
