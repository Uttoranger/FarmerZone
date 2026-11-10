import Link from 'next/link'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { OHNE_STICHTAG, PLATZHALTER_ANGABE, type AgbKontext, type AgbStueck } from '@/lib/rechtstexte/stuecke'

/**
 * Zeichnet Textstücke (src/lib/rechtstexte/stuecke.ts) als Fließtext: Klartext,
 * fett, kursiv, Link, Mail-Adresse — und die Platzhalter der AGB, gefüllt
 * aus den Konstanten des Impressums bzw. dem Stichtag (`kontext`, N45). Ohne eigene Farbe
 * außer dem Fettdruck; den Link gibt der Aufrufer vor, weil die Seite der AGB
 * und die Sätze in Registrierung und Kasse verschieden aussehen.
 */
export function AgbStuecke({
  stuecke,
  linkKlasse,
  neuerTab = false,
  kontext,
}: {
  stuecke: readonly AgbStueck[]
  /** Klassen jedes Links im Text. */
  linkKlasse: string
  /** Links öffnen in einem neuen Tab — wo ein Formular offen bleiben muss. */
  neuerTab?: boolean
  /**
   * Der Stichtag für „[Tag des Inkrafttretens]“ (AGB 1.0). Pflicht, ohne Vorgabe: Bei Rechtstexten fällt
   * nichts still auf einen Ersatz zurück — wer keinen Stichtag braucht, gibt OHNE_STICHTAG ausdrücklich mit.
   */
  kontext: AgbKontext
}): React.JSX.Element {
  return (
    <>
      {stuecke.map((stueck, i) => {
        if (typeof stueck === 'string') return stueck
        switch (stueck.art) {
          case 'fett':
            return (
              <strong key={i} className="font-semibold text-foreground">
                <AgbStuecke stuecke={stueck.stuecke} linkKlasse={linkKlasse} neuerTab={neuerTab} kontext={kontext} />
              </strong>
            )
          case 'kursiv':
            return <em key={i}>{stueck.text}</em>
          case 'link':
            return (
              <Link
                key={i}
                href={stueck.ziel}
                target={neuerTab ? '_blank' : undefined}
                rel={neuerTab ? 'noopener noreferrer' : undefined}
                className={linkKlasse}
              >
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
            return <AgbStuecke key={i} stuecke={PLATZHALTER_ANGABE(kontext)[stueck.was]} linkKlasse={linkKlasse} neuerTab={neuerTab} kontext={kontext} />
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
      {/* Die Sätze der Einbindung tragen keinen Platzhalter für den Stichtag — darum ausdrücklich ohne. */}
      <AgbStuecke stuecke={stuecke} linkKlasse={SATZ_LINK} neuerTab={neuerTab} kontext={OHNE_STICHTAG} />
    </p>
  )
}
