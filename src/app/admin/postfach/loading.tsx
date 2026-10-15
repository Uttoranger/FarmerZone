import { ADMIN_RAHMEN } from '@/components/admin/admin-teile'

/**
 * Ladeansicht von /admin/postfach (Nr. 87, seit Nr. 95 im Seitenmuster N15) —
 * Seitenkopf, drei Kennzahlen, Unterreiter, links die Liste des Eingangs
 * (480 px ab 1024 px) und rechts die Spalte; die AdminShell steht schon.
 */
export default function AdminPostfachLaden(): React.JSX.Element {
  return (
    <div className={ADMIN_RAHMEN}>
      <div className="flex animate-pulse flex-col gap-4 md:gap-5" aria-busy="true">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div>
            <div className="h-8 w-36 rounded-lg bg-border md:h-9" />
            <div className="mt-2 h-3.5 w-72 max-w-full rounded bg-muted" />
          </div>
          <div className="h-11 w-full rounded-full bg-muted md:w-56" />
        </div>
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[64px] rounded-2xl border border-border bg-card md:h-[92px]" />
          ))}
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 rounded-full bg-app-trough" />
          <div className="h-9 w-32 rounded-full bg-muted" />
          <div className="h-9 w-28 rounded-full bg-muted" />
        </div>
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[480px_minmax(0,1fr)]">
          <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex gap-2 px-3.5 pt-3 pb-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-9 w-16 rounded-full bg-muted" />
              ))}
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 border-t border-border px-3.5 py-3">
                <div className="mt-1.5 size-2 shrink-0 rounded-full bg-muted" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="h-4 w-40 rounded bg-app-trough" />
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
