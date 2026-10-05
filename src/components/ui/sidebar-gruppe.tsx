import type { ReactNode } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Zaehler } from '@/components/ui/zaehler'

/**
 * SidebarGruppe + SidebarEintrag: die Seitenleiste des Hofbereichs ab 768 px
 * (Mockup system-komponente-seitenleiste-hof.html). Eine Gruppe hat eine
 * leise Überschrift in Großbuchstaben („Verkauf und Kunden") oder keine; ein
 * Eintrag ist ein Link mit Symbol, Namen und optional einem Zähler.
 *
 * Aktiv ist der Eintrag, dem die Navigations-Quelle `aktuell` gibt — er steht
 * hell auf dunkel bzw. dunkel auf hell (umgekehrte Textfarbe). Mindestens
 * 44 px hoch (Mockup 42 px; das Touch-Ziel geht vor).
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
        <p aria-hidden="true" className="px-3 pt-[18px] pb-1.5 text-[10.5px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
          {titel}
        </p>
      )}
      <ul aria-label={titel} className="flex flex-col gap-1">
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
  klein = false,
}: {
  href: string
  label: string
  symbol: LucideIcon
  aktuell?: 'page' | 'true'
  zahl?: number
  zahlWofuer?: string
  /** Die Einträge unten in der Leiste sind eine Spur kleiner (14 px statt 14,5 px). */
  klein?: boolean
}): React.JSX.Element {
  const aktiv = aktuell !== undefined
  return (
    <li>
      <Link
        href={href}
        aria-current={aktuell}
        className={cn(
          'flex min-h-11 items-center gap-[11px] rounded-xl px-3 transition-colors duration-[250ms]',
          klein ? 'text-[14px]' : 'text-[14.5px]',
          aktiv ? 'bg-foreground font-semibold text-background' : 'font-medium text-foreground hover:bg-muted',
          FOKUS_RAHMEN
        )}
      >
        <Symbol className="size-[18px] shrink-0" strokeWidth={1.7} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <Zaehler anzahl={zahl} wofuer={zahlWofuer} />
      </Link>
    </li>
  )
}
