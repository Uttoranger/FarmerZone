import type { ReactNode } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Zaehler } from '@/components/ui/zaehler'

/**
 * SidebarGruppe + SidebarEintrag: die Seitenleiste des Hofbereichs ab 768 px
 * (Board w1-mehr-neu, Seitenleiste in allen Hof-Web-Boards). Eine Gruppe hat
 * eine leise Überschrift in Großbuchstaben („Verkauf und Kunden", 12 px) oder
 * keine; ein Eintrag ist ein Link mit Namen und optional einem Zähler — seit
 * Nr. 233 ohne Symbol wie im Board (`symbol` bleibt für andere Leisten).
 *
 * Aktiv ist der Eintrag, dem die Navigations-Quelle `aktuell` gibt — seit
 * Nr. 233 eine grün getönte Fläche mit grüner Schrift (Paar „läuft“, beide
 * Modi ≥ 4,5:1); die umgekehrte Pille (hell auf dunkel) war im Dunkeln ein
 * heller Fleck. 44 px hoch, ohne Abstand zwischen den Einträgen (Board).
 */
export function SidebarGruppe({
  titel,
  children,
  className,
}: {
  titel?: string
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div data-slot="sidebar-gruppe" className={className}>
      {titel && (
        <p aria-hidden="true" className="px-3 pt-1 pb-0.5 text-[12px] font-bold tracking-[0.72px] text-muted-foreground uppercase">
          {titel}
        </p>
      )}
      <ul aria-label={titel} className="flex flex-col">
        {children}
      </ul>
    </div>
  )
}

export function SidebarEintrag({
  href,
  label,
  symbol: Symbol,
  aktuell,
  zahl,
  zahlWofuer = '',
}: {
  href: string
  label: string
  /** Nur, wo ein Board Symbole zeigt — die Seitenleiste des Hofbereichs hat seit Nr. 233 keine. */
  symbol?: LucideIcon
  aktuell?: 'page' | 'true'
  zahl?: number
  zahlWofuer?: string
}): React.JSX.Element {
  const aktiv = aktuell !== undefined
  return (
    <li>
      <Link
        href={href}
        aria-current={aktuell}
        className={cn(
          'flex min-h-11 items-center gap-[11px] rounded-[10px] px-3 text-[15px] transition-colors duration-[250ms]',
          aktiv ? 'bg-zustand-laeuft-grund font-bold text-zustand-laeuft' : 'font-medium text-foreground hover:bg-muted',
          FOKUS_RAHMEN
        )}
      >
        {Symbol && <Symbol className="size-[18px] shrink-0" strokeWidth={1.7} aria-hidden="true" />}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <Zaehler anzahl={zahl} wofuer={zahlWofuer} />
      </Link>
    </li>
  )
}
