import { cn } from '@/lib/utils'
import { ADMIN_RAHMEN } from '@/components/admin/admin-teile'

/**
 * Ladeansicht von /admin/betrieb (Nr. 103) — in der Form der Seite, die
 * AdminShell steht schon: Kopf mit Knopf, vier Kacheln, darunter ab 1024 px
 * zwei Spalten (Verlauf, Abläufe | Tarife, Dashboard, Bilder ohne
 * Verwendung), am Handy eine Liste.
 * Die Warnkarte fehlt: Sie ist bedingt (DESIGN_SYSTEM „Ladeansicht“).
 */
const FLAECHE = 'rounded-2xl border border-border bg-card'

export default function Laden(): React.JSX.Element {
  return (
    <div aria-busy="true" className={cn(ADMIN_RAHMEN, 'flex animate-pulse flex-col gap-4 lg:gap-[18px]')}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-36 rounded-md bg-border" />
          <div className="h-4 w-72 max-w-full rounded bg-app-chip" />
        </div>
        <div className="h-11 w-64 max-w-full rounded-full bg-muted" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 lg:gap-3.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn(FLAECHE, 'flex h-[172px] flex-col gap-3 p-4')}>
            <div className="h-5 w-28 rounded bg-border" />
            <div className="h-7 w-24 rounded bg-app-trough" />
            <div className="h-2 w-full rounded-full bg-muted" />
            <div className="h-3.5 w-4/5 rounded bg-app-chip" />
          </div>
        ))}
      </div>
      <div className="hidden gap-[18px] lg:grid lg:grid-cols-[minmax(0,1fr)_468px]">
        <div className="flex flex-col gap-[18px]">
          <div className={cn(FLAECHE, 'h-[360px]')} />
          <div className={cn(FLAECHE, 'h-[240px]')} />
        </div>
        <div className="flex flex-col gap-[18px]">
          <div className={cn(FLAECHE, 'h-[380px]')} />
          <div className={cn(FLAECHE, 'h-[300px]')} />
          <div className={cn(FLAECHE, 'h-[340px]')} />
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:hidden">
        <div className={cn(FLAECHE, 'h-[236px]')} />
        <div className={cn(FLAECHE, 'h-[340px]')} />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn(FLAECHE, 'h-14')} />
        ))}
      </div>
    </div>
  )
}
