/**
 * Ladeansicht von „E-Mail bestätigen" (Nr. 17b): Die Seite wartet auf Sitzung
 * und Stand aus der Datenbank. Form der Karte in der Fokus-Shell (Kopfleiste
 * 56 px, ab md 64 px); liegt im Segment verify, damit sie für keine andere
 * Seite unter (auth) gilt (DESIGN_SYSTEM, „Ladeansicht einer Route").
 */
export default function VerifyLaden(): React.JSX.Element {
  return (
    <div data-design="neu" className="min-h-dvh bg-background">
      <div className="h-14 border-b border-border bg-card md:h-16" />
      <div className="mx-auto w-full max-w-[520px] animate-pulse px-4 pt-6 pb-12 md:pt-10" aria-busy="true">
        <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="size-6 shrink-0 rounded-full bg-muted" />
            <div className="flex-1">
              <div className="mb-3 h-6 w-56 rounded-lg bg-border" />
              <div className="mb-2 h-4 w-full rounded bg-app-trough" />
              <div className="h-4 w-2/3 rounded bg-app-trough" />
            </div>
          </div>
          <div className="mt-5 h-12 rounded-full bg-muted" />
        </div>
      </div>
    </div>
  )
}
