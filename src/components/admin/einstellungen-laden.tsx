import { cn } from '@/lib/utils'
import { ADMIN_RAHMEN } from '@/components/admin/admin-teile'

/**
 * Ladeansicht von /admin/einstellungen (Nr. 93) — in der Form der fertigen
 * Seite, innerhalb der AdminShell (der Kopf steht schon): Titel, ab 1024 px
 * die Navigation links und die Karte der Gruppe rechts, darunter die drei
 * Gruppen als Liste. Farbstaffelung wie die übrigen Admin-Ladeansichten.
 */
export function AdminEinstellungenLaden(): React.JSX.Element {
  return (
    <div className={cn(ADMIN_RAHMEN, 'flex animate-pulse flex-col gap-4 lg:gap-[18px]')} aria-busy="true">
      <div>
        <div className="h-8 w-40 rounded-lg bg-border md:h-9" />
        <div className="mt-2 h-3 w-72 max-w-full rounded bg-muted" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-[18px]">
        <div className="hidden flex-col gap-1 rounded-2xl border border-border bg-card p-2 lg:flex">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-muted" />
          ))}
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-3.5 lg:p-5">
            <div className="h-5 w-40 rounded bg-border" />
            <div className="hidden grid-cols-3 gap-3 sm:grid">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-muted" />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              <div className="h-[62px] rounded-xl bg-muted" />
              <div className="h-[62px] rounded-xl bg-muted" />
            </div>
            <div className="h-14 rounded-xl bg-muted" />
            <div className="h-20 rounded-xl bg-muted" />
          </div>
          {[0, 1].map((i) => (
            <div key={i} className="h-14 rounded-2xl border border-border bg-card lg:hidden" />
          ))}
        </div>
      </div>
    </div>
  )
}
