import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'

/**
 * ListGruppe: Zeilen auf einer Karte, durch feine Linien getrennt — wie das
 * Mehr-Blatt und die Bestellliste in den Mockups.
 */
export function ListGruppe({
  beschriftung,
  children,
  className,
}: {
  /** Name der Liste für Screenreader, wenn darüber keine sichtbare Überschrift steht. */
  beschriftung?: string
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <ul
      aria-label={beschriftung}
      data-slot="list-gruppe"
      className={cn('overflow-hidden rounded-2xl border border-border bg-card [&>li+li]:border-t [&>li+li]:border-border', className)}
    >
      {children}
    </ul>
  )
}

/**
 * ListRow: eine Zeile mit Symbol, Titel, Unterzeile und Ende (Betrag, Zähler,
 * Schalter). Mit `href` ist die ganze Zeile ein Link und trägt den Pfeil;
 * ohne ist sie nur Anzeige. Mindestens 50 px hoch (Touch-Ziel ≥ 44 px);
 * `gross` ist die Zeile der Blätter „Mehr“ (Board s1-mehr-neu, Nr. 233):
 * 56 px, Titel 15 px fett, Unterzeile 13 px, Pfeil 18 px kräftig in der Schriftfarbe.
 *
 * Titel und Unterzeile kürzen auf eine Zeile; ein Text als Titel steht
 * zusätzlich vollständig im `title` (lange Hof- und Personennamen).
 */
export function ListRow({
  titel,
  untertitel,
  symbol: Symbol,
  ende,
  href,
  aktuell,
  onNavigate,
  gross = false,
  className,
}: {
  titel: ReactNode
  untertitel?: ReactNode
  symbol?: LucideIcon
  ende?: ReactNode
  href?: string
  /** aria-current, wenn die Zeile zur offenen Seite führt. */
  aktuell?: 'page' | 'true'
  onNavigate?: () => void
  /** Zeile im Mehr-Blatt: 56 px, Titel fett 15 px (Board s1-mehr-neu). */
  gross?: boolean
  className?: string
}): React.JSX.Element {
  const inhalt = (
    <>
      {Symbol && <Symbol className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />}
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate', gross ? 'text-[15px] font-bold' : 'text-[14.5px] font-medium')} title={typeof titel === 'string' ? titel : undefined}>
          {titel}
        </span>
        {untertitel && <span className={cn('mt-0.5 block truncate text-muted-foreground', gross ? 'text-[13px]' : 'text-[12.5px]')}>{untertitel}</span>}
      </span>
      {ende}
      {/* Im Mehr-Blatt der Pfeil des Boards s1-mehr-neu: 18 px, Strich 2, in der Schriftfarbe (UI-Runde 3 der Nr. 233). */}
      {href && (
        <ChevronRight
          className={cn('shrink-0', gross ? 'size-[18px] text-foreground' : 'size-4 text-muted-foreground')}
          strokeWidth={gross ? 2 : 1.7}
          aria-hidden="true"
        />
      )}
    </>
  )
  const zeile = cn('flex w-full items-center text-left text-foreground', gross ? 'min-h-14 gap-2.5 px-3 py-1.5' : 'min-h-[50px] gap-3 px-3.5 py-2')

  return (
    <li data-slot="list-row" className={className}>
      {href ? (
        <Link
          href={href}
          onClick={onNavigate}
          aria-current={aktuell}
          className={cn(zeile, 'transition-colors duration-[250ms] hover:bg-muted aria-[current]:font-semibold', FOKUS_RAHMEN_INNEN)}
        >
          {inhalt}
        </Link>
      ) : (
        <div className={zeile}>{inhalt}</div>
      )}
    </li>
  )
}
