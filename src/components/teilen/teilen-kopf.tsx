import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { RUECKWEG_PRAEFIX } from '@/lib/bauern-navigation'
import { Wortmarke } from '@/components/shared/wortmarke'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'
import { cn } from '@/lib/utils'

/**
 * Kopfleiste der Seite /teilen (Boards s2-/w2-teilen; Nr. 278). Die Seite steht ohne Shell (Ziel des
 * Teilen-Menüs), deshalb trägt sie ihre eigene Leiste über die volle Breite:
 * - Handy: 56 px, „‹“ (44 px) zur Elternseite, daneben der Seitenname in Serif — die h1 steht darunter
 *   im Inhalt (Board s2-teilen: Leiste und h1 tragen denselben Namen).
 * - Web: 65 px, Wortmarke, Seitenname fett, „← <Elternseite>“ bündig rechts (Board w2-teilen).
 * Die Leiste bleibt beim Scrollen oben (`sticky`), wie die Kopfleisten der Shells.
 */
export function TeilenKopf({ titel, zurueckHref, zurueckName }: { titel: string; zurueckHref: string; zurueckName: string }): React.JSX.Element {
  return (
    <header className="sticky top-0 z-30 flex min-h-14 items-center gap-1 border-b border-border bg-card px-1 md:h-[65px] md:gap-5 md:px-10">
      <Link
        href={zurueckHref}
        className={cn('grid size-11 shrink-0 place-items-center text-foreground hover:bg-muted md:hidden', RUNDUNG.feld, FOKUS_RAHMEN)}
      >
        <ChevronLeft className="size-[22px]" strokeWidth={2} aria-hidden="true" />
        <span className="sr-only">{`${RUECKWEG_PRAEFIX} ${zurueckName}`}</span>
      </Link>
      <span className="hidden md:flex">
        <Wortmarke />
      </span>
      <p className="min-w-0 truncate font-heading text-[20px] leading-tight font-semibold text-foreground md:font-sans md:text-[17px] md:font-bold">
        {titel}
      </p>
      <Link
        href={zurueckHref}
        // Grüner, unterstrichener Textlink wie der Rückweg des Werkzeug-Kopfs (Board w2-teilen; Liste Z. 682, Runde 1).
        className={cn('ml-auto hidden min-h-11 items-center text-[15px] font-semibold text-status-fertig underline decoration-1 underline-offset-4 md:inline-flex', FOKUS_RAHMEN)}
      >
        <span aria-hidden="true">←&nbsp;</span>
        {`Zu ${zurueckName}`}
      </Link>
    </header>
  )
}
