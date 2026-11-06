import Link from 'next/link'
import { SEITENFUSS, type FussLink } from '@/lib/kunden-navigation'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { ThemeUmschalterPille } from '@/components/shared/theme-umschalter'

/**
 * Ein Link im Seitenfuß: 32 px hoch wie im Board, die Trefferfläche reicht über
 * einen unsichtbaren Rand (::before, 6 px oben und unten) auf 44 px. Im Browser
 * 13,5 px wie in w1-bestaetigung — mit 14 px passte die Zeile mit fünf
 * Rechtslinks nicht mehr in die Spalte von 896 px (UI-Runde 3). Unterstrichen
 * auch am Handy (G11, Boards s2-kundenkonto, s3-rechtstexte): ein Link sieht
 * aus wie ein Link, nicht wie eine Zeile Text.
 */
const FUSS_LINK = cn(
  "relative inline-flex h-8 items-center rounded-md px-1 text-[13px] whitespace-nowrap text-muted-foreground underline underline-offset-4 transition-colors duration-[250ms] before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] hover:text-foreground md:text-[13.5px]",
  FOKUS_RAHMEN
)

/** Im Browser die Wege grün wie die Links der Boards (w1-bestaetigung, w1-bestellung-link), die rechtlichen leise. */
const FUSS_LINK_WEG = 'md:text-status-fertig md:hover:text-foreground'

function FussLinks({
  beschriftung,
  links,
  className,
  listeKlasse,
  linkKlasse,
}: {
  beschriftung: string
  links: readonly FussLink[]
  className?: string
  listeKlasse?: string
  linkKlasse?: string
}) {
  return (
    <nav aria-label={beschriftung} className={className}>
      {/* 12 px Abstand am Handy: So passen die vier Links bei 390 px in eine Zeile wie im Board. Im Browser 8 px (mit dem
          Polster der Links 16 px von Wort zu Wort wie in w1-bestaetigung): So steht der Fuß in der Spalte von 896 px in
          EINER Zeile, auch mit „Vertrag widerrufen“ als fünftem Rechtslink (N39). */}
      <ul className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 md:gap-x-2', listeKlasse)}>
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
 *
 * Seit Nr. 247 (G11, Boards w2-kundenkonto, w3-rechtstexte, w2-systemseiten):
 * im Browser ohne Marke — die steht schon im Kopf —, links die Wege, rechts
 * die Rechtslinks; bricht die Zeile der Rechtslinks um, steht „Vertrag
 * widerrufen“ bündig rechts unter den anderen, nicht eingerückt.
 */
export function KundeFuss({ className, spalte }: { className?: string; spalte?: string }): React.JSX.Element {
  return (
    // Lauf 31 (Boards w1-bestaetigung, w1-bestellung-link, w1-meine-bestellungen): Im Browser steht der Fuß in der
    // Spalte des Inhalts — die Linie oben reicht nur so weit wie sie; am Handy über die volle Breite wie bisher.
    <footer data-slot="seitenfuss" className={cn('max-md:border-t max-md:border-border print:hidden', className)}>
      <div className={cn('mx-auto flex max-w-[1200px] flex-col gap-1 px-4 py-3 md:px-6 md:py-4', spalte)}>
        {/* Im Browser eine Zeile (Boards w1-bestaetigung, w2-kundenkonto; UI-Runde 3): links die Wege, die Rechtslinks
            rechts bündig über `ml-auto` statt eines Platzhalters — der kostete zwei Abstände. Erst wenn die Spalte zu
            schmal ist, bricht der rechte Teil um — bündig rechts wie die Zeile darüber (G11, „Vertrag widerrufen“). */}
        <div className="flex flex-col gap-1 md:flex-row md:flex-wrap md:items-center md:gap-x-4 md:border-t md:border-border md:pt-3">
          <FussLinks beschriftung="Mehr entdecken" links={SEITENFUSS.wege} linkKlasse={FUSS_LINK_WEG} className="hidden md:block" />
          <FussLinks beschriftung="Rechtliches" links={SEITENFUSS.rechtlich} className="md:ml-auto" listeKlasse="md:justify-end" />
        </div>
        {/* „Darstellung: hell“ als Umriss-Pille unter den Links (Board s1-startseite, Bild 4). */}
        <div className="pt-2 pb-1 md:hidden">
          <ThemeUmschalterPille />
        </div>
      </div>
    </footer>
  )
}
