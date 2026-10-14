import { ADMIN_RAHMEN } from '@/components/admin/admin-teile'

/** Ladeansicht von /admin/postfach (Nachtlauf Nr. 87) — Kopf, Reiter, Liste links und Faden rechts; die AdminShell steht schon. */
export default function AdminPostfachLaden(): React.JSX.Element {
  return (
    <div className={ADMIN_RAHMEN}>
      <div className="flex animate-pulse flex-col gap-4" aria-busy="true">
        <div className="flex items-center gap-4">
          <div className="h-8 w-36 rounded-lg bg-border" />
          <div className="hidden h-4 w-72 rounded bg-app-chip md:block" />
          <div className="ml-auto h-11 w-48 rounded-full bg-muted" />
        </div>
        <div className="flex gap-6 border-b border-border pb-3">
          <div className="h-5 w-32 rounded bg-app-trough" />
          <div className="h-5 w-24 rounded bg-app-chip" />
          <div className="h-5 w-28 rounded bg-app-chip" />
        </div>
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[400px_minmax(0,1fr)]">
          <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 border-t border-border px-3.5 py-3 first:border-t-0">
                <div className="size-10 shrink-0 rounded-full bg-muted" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="h-4 w-28 rounded bg-app-trough" />
                  <div className="h-3.5 w-full rounded bg-app-chip" />
                </div>
              </div>
            ))}
          </div>
          <div className="h-80 rounded-2xl border border-border bg-card" />
        </div>
      </div>
    </div>
  )
}
