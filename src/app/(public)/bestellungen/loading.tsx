/**
 * Ladeansicht von „Meine Bestellungen" (Nr. 14, seit Nr. 227 nach Board
 * s1-/w1-meine-bestellungen). Gewartet wird nur mit bewiesener Adresse (die
 * Liste kommt aus der Datenbank) — deshalb die Form der Liste: Kopfzeile
 * 56/64 px, eine Spalte 520 px, Überschrift, die Adress-Karte, eine Karte
 * „Aktuell" und die Gruppe „Früher".
 * Wie viele Bestellungen es gibt, weiß die Ansicht nicht: eine Karte, zwei
 * Zeilen. Die Seite steht im Geltungsbereich data-design="neu"; diese Ansicht
 * kommt vor der Shell und setzt den Marker selbst.
 */
export default function BestellungenLaden(): React.JSX.Element {
  return (
    <div data-design="neu" className="min-h-dvh animate-pulse bg-background" aria-busy="true" aria-label="Bestellungen werden geladen">
      <div className="h-14 border-b border-border bg-background md:h-16" />

      {/* Seit Nr. 227 (Board s1-/w1-meine-bestellungen): eine Spalte, oben die Karte mit der Adresse. */}
      <main className="mx-auto flex w-full max-w-[552px] flex-col gap-4 px-4 pt-6 pb-12 md:pt-8">
        <div className="h-8 w-64 rounded-lg bg-border md:h-9" />
        {/* Deine Adresse · Ansicht beenden */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5 md:px-[18px]">
          <div className="h-4 flex-1 rounded bg-app-chip" />
          <div className="h-11 w-36 rounded-xl bg-muted" />
        </div>
        {/* Aktuell */}
        <div className="h-3 w-20 rounded bg-app-chip" />
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 md:px-[18px]">
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-4 w-32 rounded bg-app-trough" />
            <div className="h-3 w-48 max-w-full rounded bg-app-chip" />
          </div>
          <div className="h-11 w-40 rounded-xl bg-muted" />
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
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
