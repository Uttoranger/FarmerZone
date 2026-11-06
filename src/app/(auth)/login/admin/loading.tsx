/** Ladeansicht von /login/admin (Register N20, Nr. 115) — seit Nr. 239 in der Form der schmalen Spalte ohne Karte. */
export default function Laden(): React.JSX.Element {
  return (
    <div data-design="neu" className="flex min-h-dvh flex-col bg-background">
      <div className="min-h-14 border-b border-border bg-card md:min-h-16" />
      <main className="flex flex-1 justify-center px-4 pt-6 pb-10 md:pt-8">
        <div aria-busy="true" aria-label="Wird geladen" className="flex w-full max-w-[528px] animate-pulse flex-col gap-4">
          <div className="h-8 w-56 rounded-lg bg-border" />
          <div className="h-10 w-full rounded bg-app-trough" />
          <div className="h-[50px] w-full rounded-[14px] bg-muted" />
        </div>
      </main>
    </div>
  )
}
