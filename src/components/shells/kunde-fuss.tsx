import Link from 'next/link'
import { SEITENFUSS, type FussLink } from '@/lib/kunden-navigation'
import { MARKE } from '@/lib/marke'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Wortmarke } from '@/components/shared/wortmarke'
import { ThemeUmschalterZeile } from '@/components/shared/theme-umschalter'

/**
 * Ein Link im Seitenfuß: 32 px hoch wie im Board, die Trefferfläche reicht über
 * einen unsichtbaren Rand (::before, 6 px oben und unten) auf 44 px.
 */
const FUSS_LINK = cn(
  "relative inline-flex h-8 items-center rounded-md px-1 text-[13px] whitespace-nowrap text-muted-foreground transition-colors duration-[250ms] before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] hover:text-foreground",
  FOKUS_RAHMEN
)

function FussLinks({ beschriftung, links, className }: { beschriftung: string; links: readonly FussLink[]; className?: string }) {
  return (
    <nav aria-label={beschriftung} className={className}>
      {/* 12 px Abstand am Handy: So passen die vier Links bei 390 px in eine Zeile wie im Board. */}
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 md:gap-x-4">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={FUSS_LINK}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * Der Seitenfuß (Register N22, Wortliste: „Seitenfuß", nicht „Footer"; Board
 * system-k1-entdecken-v2): Impressum, Datenschutz, AGB und „Problem melden"
 * auf jeder Seite der KundeShell — das erfüllt „AGB-Link in jeder Fußzeile"
 * (O4). Am Computer unter dem Inhalt, links die Marke und die Wege der
 * Kopfzeile; am Handy der letzte Teil der Seite über der Unterleiste, darunter
 * Hell/Dunkel wie bisher (im Browser steht der Schalter im Kopf). Nicht in der
 * KundeFokusShell: In Kasse und Bestätigung steht der AGB-Satz unter dem
 * Kaufknopf. Ziele und Wörter aus src/lib/kunden-navigation.ts (SEITENFUSS).
 */
export function KundeFuss({ className }: { className?: string }): React.JSX.Element {
  return (
    <footer data-slot="seitenfuss" className={cn('border-t border-border print:hidden', className)}>
      <div className="mx-auto flex max-w-[1200px] flex-col gap-1 px-4 py-3 md:flex-row md:items-center md:gap-6 md:px-6 md:py-4">
        <div className="hidden items-center gap-6 md:flex">
          <Link href="/" aria-label={`${MARKE} – zur Startseite`} className={cn('rounded-md', FOKUS_RAHMEN)}>
            {/* Der Fuß steht nicht im ersten Blick — vorab geladen wird die Marke nur in der Kopfzeile. */}
            <Wortmarke priority={false} />
          </Link>
          <FussLinks beschriftung="Mehr entdecken" links={SEITENFUSS.wege} />
        </div>
        <span className="hidden flex-1 md:block" />
        <FussLinks beschriftung="Rechtliches" links={SEITENFUSS.rechtlich} />
        <div className="-mx-2 md:hidden">
          <ThemeUmschalterZeile className={cn('w-auto text-muted-foreground hover:text-foreground', FOKUS_RAHMEN)} />
        </div>
      </div>
    </footer>
  )
}
