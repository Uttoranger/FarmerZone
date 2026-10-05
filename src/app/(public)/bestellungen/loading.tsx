/**
 * Ladeansicht von „Meine Bestellungen" (Nr. 14). Gewartet wird nur mit
 * bewiesener Adresse (die Liste kommt aus der Datenbank) — deshalb die Form
 * der Liste: Kopfzeile 56/64 px, Spalte 1200 px, Überschrift, eine Karte
 * „Aktuell", die Gruppe „Früher" und rechts (ab 1024 px) die Adress-Karte.
 * Wie viele Bestellungen es gibt, weiß die Ansicht nicht: eine Karte, zwei
 * Zeilen. Die Seite steht im Geltungsbereich data-design="neu"; diese Ansicht
 * kommt vor der Shell und setzt den Marker selbst.
 */
export default function BestellungenLaden(): React.JSX.Element {
  return (
    <div data-design="neu" className="min-h-dvh animate-pulse bg-background" aria-busy="true" aria-label="Bestellungen werden geladen">
      <div className="h-14 border-b border-border bg-background md:h-16" />

      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-7 px-4 pt-6 pb-12 md:px-6 md:pt-7 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="h-8 w-64 rounded-lg bg-border md:h-9" />
          <div className="h-3 w-20 rounded bg-app-chip" />
          {/* Aktuell */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4 md:px-[18px]">
            <div className="flex items-center gap-2.5">
              <div className="h-5 w-24 rounded-full bg-app-trough" />
              <div className="h-4 w-40 rounded bg-app-chip" />
            </div>
            <div className="h-5 w-52 rounded bg-app-trough" />
            <div className="h-4 w-64 max-w-full rounded bg-app-chip" />
            <div className="h-11 w-48 rounded-full bg-muted" />
          </div>
          {/* Früher */}
          <div className="h-3 w-16 rounded bg-app-chip" />
          <div className="flex flex-col rounded-2xl border border-border bg-card">
            {[0, 1].map((i) => (
              <div key={i} className="flex min-h-[50px] items-center gap-3 border-border px-3.5 py-2 [&+&]:border-t">
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="h-4 w-36 rounded bg-app-trough" />
                  <div className="h-3 w-48 rounded bg-app-chip" />
                </div>
                <div className="h-4 w-14 rounded bg-app-chip" />
              </div>
            ))}
          </div>
        </div>
        <div className="w-full shrink-0 lg:mt-[58px] lg:w-[360px]">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4 md:px-[18px]">
            <div className="h-5 w-32 rounded bg-border" />
            <div className="h-4 w-48 rounded bg-app-chip" />
            <div className="h-3 w-full rounded bg-app-chip" />
            <div className="h-11 w-28 rounded-full bg-muted" />
          </div>
        </div>
      </main>
    </div>
  )
}
