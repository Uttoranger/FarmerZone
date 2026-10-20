/** Ladeansicht von /login/admin (Register N20, Nr. 115) — in der Form der Karte. */
export default function Laden(): React.JSX.Element {
  return (
    <div data-design="neu" className="flex min-h-dvh flex-col bg-background">
      <div className="min-h-14 border-b border-border bg-card md:min-h-16" />
      <main className="flex flex-1 justify-center px-4 py-10 md:justify-start md:px-14 md:py-16">
        <div aria-busy="true" aria-label="Wird geladen" className="h-[340px] w-full max-w-[470px] animate-pulse rounded-[18px] border border-border bg-card" />
      </main>
    </div>
  )
}
