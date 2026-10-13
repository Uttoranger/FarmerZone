/**
 * Die Platzhalter der Kasse — zweimal gebraucht, einmal gebaut.
 *
 * Die Kasse wartet zweimal: erst auf die HOFDATEN vom Server (Abholzeiten,
 * Zahlungswege, Servicegebühr) — dafür greift `loading.tsx` —, dann im
 * Browser auf den Warenkorb aus dem localStorage, denn der ist kein
 * Serverzustand (`!isHydrated` in checkout-form.tsx). Beide Wartezeiten
 * zeigen dasselbe Bild in der Form der fertigen Kasse (seit Nr. 82, Register
 * N10: Korb, Abholung, Deine Daten — ab 768 px zweispaltig —, Bezahlen mit
 * zwei Zahlarten nebeneinander; danach Übersicht, Angaben zum Hof und Knopf,
 * ab 1024 px rechts), also springt zwischen ihnen nichts.
 *
 * Nur, was im wartenden Fall sicher da ist: zwei ruhige Korbzeilen (wie viele
 * Positionen im Korb liegen, weiß der Server nicht), keine Hinweise, kein
 * Betriebs-Abschnitt. Am Handy kein Platzhalter für die feste Leiste — sie
 * erscheint mit dem Korb.
 */
export function KasseSkelett() {
  return (
    <div
      className="mx-auto grid max-w-[1200px] animate-pulse gap-4 px-4 pt-4 pb-44 md:px-6 md:pt-7 md:pb-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-7"
      aria-busy="true"
      aria-label="Kasse wird geladen"
    >
      {/* Korb */}
      <div className="rounded-2xl border border-border bg-card px-4 py-4 md:px-[18px] lg:col-start-1 lg:row-start-1">
        <div className="h-5 w-52 rounded bg-border" />
        <div className="mt-3 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <div className="size-[52px] shrink-0 rounded-xl bg-muted" />
              <div className="h-4 flex-1 rounded bg-app-trough" />
              <div className="h-4 w-16 rounded bg-app-trough" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-2">
        {/* Abholung: Titel, Adresse (ab 768 px rechts daneben), Termine in einer Zeile */}
        <div className="rounded-2xl border border-border bg-card px-4 py-4 md:px-[18px]">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
            <div className="h-5 w-36 rounded bg-border" />
            <div className="h-3.5 w-44 rounded bg-app-chip" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
            {[0, 1].map((i) => (
              <div key={i} className="h-[58px] rounded-[14px] bg-app-chip sm:w-40" />
            ))}
          </div>
        </div>
        {/* Deine Daten: E-Mail · Name / Telefon · Notiz */}
        <div className="rounded-2xl border border-border bg-card px-4 py-4 md:px-[18px]">
          <div className="h-5 w-28 rounded bg-border" />
          <div className="mt-3 grid gap-3.5 md:grid-cols-2 md:gap-x-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <div className="h-3.5 w-20 rounded bg-app-trough" />
                <div className="mt-1.5 h-[46px] w-full rounded-[11px] bg-app-chip" />
              </div>
            ))}
          </div>
        </div>
        {/* Bezahlen: zwei Zahlarten, ab 768 px nebeneinander */}
        <div className="rounded-2xl border border-border bg-card px-4 py-4 md:px-[18px]">
          <div className="h-5 w-24 rounded bg-border" />
          <div className="mt-3 grid gap-2.5 md:grid-cols-2">
            <div className="h-[72px] w-full rounded-[14px] bg-app-chip" />
            <div className="h-[72px] w-full rounded-[14px] bg-app-chip" />
          </div>
        </div>
      </div>

      {/* Übersicht, Angaben zum Hof, Knopf (KassenAbschluss) — am Handy zuletzt */}
      <div className="flex flex-col gap-3.5 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
        <div className="rounded-2xl border border-border bg-card px-4 py-4 md:px-[18px]">
          <div className="h-5 w-28 rounded bg-border" />
          <div className="mt-3 h-11 w-full rounded-[11px] bg-app-chip" />
          <div className="mt-3 space-y-2.5">
            <div className="h-4 w-full rounded bg-app-trough" />
            <div className="h-4 w-full rounded bg-app-trough" />
            <div className="h-5 w-full rounded bg-app-trough" />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 pt-1 pb-3.5 md:px-[18px]">
          <div className="flex min-h-11 items-center">
            <div className="h-4 w-64 max-w-full rounded bg-border" />
          </div>
          <div className="space-y-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-4 w-full rounded bg-app-trough" />
            ))}
          </div>
          <div className="mt-2.5 h-3.5 w-3/4 rounded bg-app-chip" />
        </div>
        <div className="hidden h-[50px] w-full rounded-full bg-muted md:block" />
      </div>
    </div>
  )
}
