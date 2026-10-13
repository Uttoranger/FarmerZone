import Link from 'next/link'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { PLATZHALTER_ANGABE, type AgbStueck } from '@/lib/rechtstexte/stuecke'

/**
 * Zeichnet Textstücke (src/lib/rechtstexte/stuecke.ts) als Fließtext: Klartext,
 * fett, kursiv, Link, Mail-Adresse — und die zwei Platzhalter des AGB-Entwurfs,
 * die aus den Konstanten des Impressums gefüllt werden. Ohne eigene Farbe
 * außer dem Fettdruck; den Link gibt der Aufrufer vor, weil die Seite der AGB
 * und die Sätze in Registrierung und Kasse verschieden aussehen.
 */
export function AgbStuecke({
  stuecke,
  linkKlasse,
  neuerTab = false,
}: {
  stuecke: readonly AgbStueck[]
  /** Klassen jedes Links im Text. */
  linkKlasse: string
  /** Links öffnen in einem neuen Tab — wo ein Formular offen bleiben muss. */
  neuerTab?: boolean
}): React.JSX.Element {
  return (
    <>
      {stuecke.map((stueck, i) => {
        if (typeof stueck === 'string') return stueck
        switch (stueck.art) {
          case 'fett':
            return (
              <strong key={i} className="font-semibold text-foreground">
                <AgbStuecke stuecke={stueck.stuecke} linkKlasse={linkKlasse} neuerTab={neuerTab} />
              </strong>
            )
          case 'kursiv':
            return <em key={i}>{stueck.text}</em>
          case 'link':
            return (
              <Link key={i} href={stueck.ziel} target={neuerTab ? '_blank' : undefined} className={linkKlasse}>
                {stueck.text}
              </Link>
            )
          case 'mail':
            return (
              <a key={i} href={`mailto:${stueck.adresse}`} className={linkKlasse}>
                {stueck.adresse}
              </a>
            )
          case 'platzhalter':
            return <AgbStuecke key={i} stuecke={PLATZHALTER_ANGABE[stueck.was]} linkKlasse={linkKlasse} neuerTab={neuerTab} />
        }
      })}
    </>
  )
}

/**
 * Ein Link in einem Satz (Registrierung, Kasse): grün und unterstrichen. Die
 * Trefferfläche reicht 16 px über und unter die Zeile und 10 px zur Seite —
 * mindestens 44 px —, ohne die Zeilen des Satzes auseinanderzuziehen (gemessen
 * mit elementFromPoint, nicht an der Höhe des Links).
 */
export const SATZ_LINK = cn(
  "relative rounded-sm font-semibold text-status-fertig underline underline-offset-2 after:absolute after:-inset-x-2.5 after:-inset-y-4 after:content-[''] hover:opacity-80",
  FOKUS_RAHMEN
)

/** Ein Satz mit Links als Absatz — die Einbindung der AGB in Registrierung und Kasse (Register O4). */
export function AgbSatz({
  stuecke,
  className,
  neuerTab = false,
}: {
  stuecke: readonly AgbStueck[]
  className?: string
  neuerTab?: boolean
}): React.JSX.Element {
  return (
    <p className={className}>
      <AgbStuecke stuecke={stuecke} linkKlasse={SATZ_LINK} neuerTab={neuerTab} />
    </p>
  )
}
