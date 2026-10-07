/**
 * Ladeansicht von „Anmeldung bestätigen" (Double-Opt-in, Nr. 38): Die Seite
 * prüft den Link und liest das Abo. Form der Karte in der Fokus-Shell
 * (Kopfleiste 52 px, ab md 64 px), wie /verify.
 */
export default function NeuigkeitenBestaetigenLaden(): React.JSX.Element {
  return (
    <div data-design="neu" className="min-h-dvh bg-background">
      <div className="h-[52px] border-b border-border bg-background md:h-16" />
      <div className="mx-auto w-full max-w-[520px] animate-pulse px-4 pt-6 pb-12 md:pt-10" aria-busy="true">
        <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="size-6 shrink-0 rounded-full bg-muted" />
            <div className="flex-1">
              <div className="mb-3 h-6 w-48 rounded-lg bg-border" />
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
