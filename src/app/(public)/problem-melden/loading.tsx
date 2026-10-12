/**
 * Ladeansicht von „Problem melden" (seit Nr. 54). Die Seite wartet wirklich
 * auf den Server — sie prüft die Sitzung, um einen eingeloggten Hof zu
 * erkennen. Maße aus src/app/(public)/problem-melden/page.tsx: Kopf der
 * KundeShell (56 px, ab md 64 px), Spalte max. 560 px (px-4, oben 32 px, ab
 * md 60 px), darin die Karte mit Titel, Satz, den Arten, dem Textfeld und dem
 * Knopf. Die Ansicht kommt vor der Shell und setzt den Marker selbst.
 */
export default function ProblemMeldenLaden() {
  return (
    <div data-design="neu" className="min-h-dvh animate-pulse bg-background" aria-busy="true" aria-label="Seite wird geladen">
      <div className="h-14 border-b border-border bg-background md:h-16" />

      <main className="mx-auto w-full max-w-[560px] px-4 pt-8 pb-12 md:pt-[60px]">
        <div className="flex flex-col gap-3.5 rounded-[22px] border border-border bg-card p-5 md:p-6">
          <div className="h-7 w-44 rounded-lg bg-border" />
          <div className="h-4 w-64 max-w-full rounded bg-app-trough" />
          <div className="h-3 w-28 rounded bg-app-chip" />
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="h-12 rounded-[12px] bg-muted" />
            <div className="h-12 rounded-[12px] bg-muted" />
            <div className="h-12 rounded-[12px] bg-muted" />
          </div>
          <div className="h-3 w-32 rounded bg-app-chip" />
          <div className="h-24 rounded-[11px] bg-muted" />
          <div className="h-11 rounded-[11px] bg-muted sm:w-56" />
          <div className="h-12 rounded-[14px] bg-muted md:ml-auto md:h-11 md:w-32 md:rounded-full" />
        </div>
      </main>
    </div>
  )
}
