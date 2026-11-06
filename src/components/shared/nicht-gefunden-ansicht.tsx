'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { SUCHTEXT_MAX, SUCHTEXT_PARAMETER } from '@/schemas/hoefe-filter'
import { NICHT_GEFUNDEN_KICKER, SUCHE_TEXT, ZUM_HOF } from '@/lib/fehlerseite'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { FEHLER_HAUPT, FEHLER_UMRISS, FehlerseiteAufbau } from '@/components/shared/fehler-ansicht'

/*
 * Die 404 im neuen Design (seit Nr. 54; seit Nr. 231 nach den Boards
 * s3/w3-fehlerseiten): der gemeinsame Aufbau der Fehlerseiten
 * (`FehlerseiteAufbau`) mit Kompass, „Fehler 404", Überschrift, Satz und zwei
 * Wegen zurück (einer grün, einer als Umriss). EINE Ansicht für die 404 des
 * Hauses, der Hofadresse und der Produktseite — nur Texte, Reihenfolge der
 * Wege und das Suchfeld unterscheiden sich: Nur die 404 des Hauses sucht.
 *
 * Die Shell (KundeShellMitSitzung) bindet die Seite ein, nicht diese Ansicht
 * (tests/shells.test.ts: unter src/components bindet nichts eine Shell ein).
 *
 * Eine Client-Komponente nur für den Weg „Zum Hof" der Produktseite: Eine
 * not-found-Datei bekommt keine Parameter, die Adresse kennt nur der Browser
 * (`useParams`). Den Slug nimmt der Link, wie er in der Adresse steht — gibt
 * es den Hof nicht (mehr), führt er auf die 404 der Hofadresse; verraten wird
 * dabei nichts.
 *
 * Das Suchfeld ist ein gewöhnliches GET-Formular auf /hoefe und braucht kein
 * JavaScript; Enter schickt es ab. Den Text liest dort `leseHoefeFilter` als
 * Parameter — eine Systemgrenze, die Müll verwirft, statt eine Fehlerseite zu
 * zeigen.
 */

type Weg = { href: string; text: string }

/** Der Hof aus der Adresse (/[farmSlug]/produkt/[id]) — ohne Slug die Höfe. */
function wegZumHof(slug: unknown): Weg {
  return typeof slug === 'string' && slug !== '' ? { href: `/${encodeURIComponent(slug)}`, text: ZUM_HOF } : { href: '/hoefe', text: ZUM_HOF }
}

export function NichtGefundenAnsicht({
  titel,
  text,
  haupt: hauptVorgabe,
  neben,
  suchfeldId,
}: {
  titel: string
  text: string
  /** Der eine grüne Weg (Kundenaktion, DESIGN_SYSTEM „Farbrollen"); `'zum-hof'` = der Hof aus der Adresse. */
  haupt: Weg | 'zum-hof'
  /** Der zweite Weg, als Umriss. */
  neben: Weg
  /** Kennung des Suchfelds — nur die 404 des Hauses zeigt eins (Board). */
  suchfeldId?: string
}): React.JSX.Element {
  const params = useParams()
  const haupt = hauptVorgabe === 'zum-hof' ? wegZumHof(params?.farmSlug) : hauptVorgabe
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-center px-[22px] pt-[70px] pb-16 md:pt-[110px]">
      <FehlerseiteAufbau zeichen="weg" kicker={NICHT_GEFUNDEN_KICKER} titel={titel} text={text}>
        <Link href={haupt.href} className={FEHLER_HAUPT.gruen}>
          {haupt.text}
        </Link>
        <Link href={neben.href} className={FEHLER_UMRISS}>
          {neben.text}
        </Link>
        {suchfeldId && (
          // Die Beschriftung steht sichtbar über dem Feld (Maßstab Punkt 3: Felder mit sichtbarer Beschriftung;
          // das Board w3-/s3-fehlerseiten blendet sie aus — Maßstab vor Board, Nr. 242). Ohne Lupe, 44 px als
          // Pille wie im Board.
          <form action="/hoefe" method="get" role="search" className="mt-1 flex w-full flex-col gap-1.5 text-left">
            <label htmlFor={suchfeldId} className="text-[14px] font-semibold text-foreground">
              {SUCHE_TEXT.beschriftung}
            </label>
            <input
              id={suchfeldId}
              type="search"
              name={SUCHTEXT_PARAMETER}
              maxLength={SUCHTEXT_MAX}
              placeholder={SUCHE_TEXT.platzhalter}
              className={cn(
                'h-11 w-full rounded-full border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground md:text-[15px]',
                FOKUS_RAHMEN
              )}
            />
          </form>
        )}
      </FehlerseiteAufbau>
    </div>
  )
}
