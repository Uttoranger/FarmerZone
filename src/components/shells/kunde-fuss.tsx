import Link from 'next/link'
import { SEITENFUSS, type FussLink } from '@/lib/kunden-navigation'
import { MARKE } from '@/lib/marke'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Wortmarke } from '@/components/shared/wortmarke'
import { ThemeUmschalterPille } from '@/components/shared/theme-umschalter'

/**
 * Ein Link im Seitenfuß: 32 px hoch wie im Board, die Trefferfläche reicht über
 * einen unsichtbaren Rand (::before, 6 px oben und unten) auf 44 px. Im Browser
 * 13,5 px wie in w1-bestaetigung — mit 14 px passte die Zeile mit fünf
 * Rechtslinks nicht mehr in die Spalte von 896 px (UI-Runde 3).
 */
const FUSS_LINK = cn(
  "relative inline-flex h-8 items-center rounded-md px-1 text-[13px] whitespace-nowrap text-muted-foreground transition-colors duration-[250ms] before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] hover:text-foreground md:text-[13.5px] md:underline md:underline-offset-4",
  FOKUS_RAHMEN
)

/** Im Browser die Wege grün wie die Links der Boards (w1-bestaetigung, w1-bestellung-link), die rechtlichen leise. */
const FUSS_LINK_WEG = 'md:text-status-fertig md:hover:text-foreground'

function FussLinks({
  beschriftung,
  links,
  className,
  linkKlasse,
}: {
  beschriftung: string
  links: readonly FussLink[]
  className?: string
  linkKlasse?: string
}) {
  return (
    <nav aria-label={beschriftung} className={className}>
      {/* 12 px Abstand am Handy: So passen die vier Links bei 390 px in eine Zeile wie im Board. Im Browser 8 px (mit dem
          Polster der Links 16 px von Wort zu Wort wie in w1-bestaetigung): So steht der Fuß in der Spalte von 896 px in
          EINER Zeile, auch mit „Vertrag widerrufen“ als fünftem Rechtslink (N39). */}
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 md:gap-x-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={cn(FUSS_LINK, linkKlasse)}>
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
 * „Darstellung: hell“ als Pille (seit Nr. 220; im Browser steht der Schalter im Kopf). Nicht in der
 * KundeFokusShell: In Kasse und Bestätigung steht der AGB-Satz unter dem
 * Kaufknopf. Ziele und Wörter aus src/lib/kunden-navigation.ts (SEITENFUSS).
 */
export function KundeFuss({ className, spalte }: { className?: string; spalte?: string }): React.JSX.Element {
  return (
    // Lauf 31 (Boards w1-bestaetigung, w1-bestellung-link, w1-meine-bestellungen): Im Browser steht der Fuß in der
    // Spalte des Inhalts — die Linie oben reicht nur so weit wie sie; am Handy über die volle Breite wie bisher.
    <footer data-slot="seitenfuss" className={cn('max-md:border-t max-md:border-border print:hidden', className)}>
      <div className={cn('mx-auto flex max-w-[1200px] flex-col gap-1 px-4 py-3 md:px-6 md:py-4', spalte)}>
        {/* Im Browser eine Zeile (Boards w1-bestaetigung, w1-bestellung-link; UI-Runde 3): links Marke und Wege, die
            Rechtslinks rechts bündig über `ml-auto` statt eines Platzhalters — der kostete zwei Abstände. Erst wenn die
            Spalte zu schmal ist (768–1023 px), bricht der rechte Teil in eine zweite Zeile um. */}
        <div className="flex flex-col gap-1 md:flex-row md:flex-wrap md:items-center md:gap-x-4 md:border-t md:border-border md:pt-3">
          <div className="hidden flex-wrap items-center gap-x-3 md:flex">
            <Link href="/" aria-label={`${MARKE} – zur Startseite`} className={cn('inline-flex min-h-11 items-center rounded-md', FOKUS_RAHMEN)}>
              {/* Der Fuß steht nicht im ersten Blick — vorab geladen wird die Marke nur in der Kopfzeile. */}
              <Wortmarke priority={false} />
            </Link>
            <FussLinks beschriftung="Mehr entdecken" links={SEITENFUSS.wege} linkKlasse={FUSS_LINK_WEG} />
          </div>
          <FussLinks beschriftung="Rechtliches" links={SEITENFUSS.rechtlich} className="md:ml-auto" />
        </div>
        {/* „Darstellung: hell“ als Umriss-Pille unter den Links (Board s1-startseite, Bild 4). */}
        <div className="pt-2 pb-1 md:hidden">
          <ThemeUmschalterPille />
        </div>
      </div>
    </footer>
  )
}
