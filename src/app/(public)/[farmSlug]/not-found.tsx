import type { Metadata } from 'next'
import {
  HOEFE_ENTDECKEN,
  HOF_NICHT_GEFUNDEN_TEXT,
  HOF_NICHT_GEFUNDEN_TITEL,
  ZUR_STARTSEITE,
} from '@/lib/fehlerseite'
import { NichtGefundenAnsicht } from '@/components/shared/nicht-gefunden-ansicht'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'

export const metadata: Metadata = {
  title: 'Hof nicht gefunden — FarmerZone',
  robots: { index: false, follow: false },
}

/**
 * Die 404 unter einer Hof-Adresse. Hier landet mehr als ein Fall, und das ist
 * der Grund für den vorsichtigen Wortlaut:
 *
 * - ein Slug, den es nie gab;
 * - ein STILLGELEGTER Hof (`archivedAt`), ein abgeschalteter (`isActive`) und
 *   ein noch nicht freigeschalteter — alle drei fallen schon aus der Query
 *   (`OEFFENTLICH_SICHTBAR`, src/server/queries/farm.ts), die Seite sieht sie
 *   gar nicht und kann sie deshalb auch nicht verraten;
 * - ein unbekannter Bestell-Link unter /confirm und ein Hof in Pause unter
 *   /checkout, denn deren notFound() fängt ebenfalls diese Datei.
 *
 * Deshalb behauptet der Text keinen Grund („vielleicht … oder …"): Warum ein
 * Hof nicht mehr da ist, ist seine Sache. Der primäre Weg ist hier nicht die
 * Startseite, sondern die Hofübersicht — wer einen Hof sucht, sucht einen Hof.
 *
 * Seit Nr. 54 in der KundeShell, dieselbe Ansicht wie die 404 des Hauses
 * (Mockups fehler-404-*), nur mit den Hof-Texten und der Hofübersicht zuerst.
 */
export default function HofNichtGefunden() {
  return (
    <KundeShellMitSitzung>
      <NichtGefundenAnsicht
        titel={HOF_NICHT_GEFUNDEN_TITEL}
        text={HOF_NICHT_GEFUNDEN_TEXT}
        haupt={{ href: '/hoefe', text: HOEFE_ENTDECKEN }}
        neben={{ href: '/', text: ZUR_STARTSEITE }}
        suchfeldId="hof-nicht-gefunden-suche"
      />
    </KundeShellMitSitzung>
  )
}
