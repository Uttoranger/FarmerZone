import type { Metadata } from 'next'
import {
  HOEFE_ENTDECKEN,
  NICHT_GEFUNDEN_TEXT,
  NICHT_GEFUNDEN_TITEL,
  ZUR_STARTSEITE,
} from '@/lib/fehlerseite'
import { NichtGefundenAnsicht } from '@/components/shared/nicht-gefunden-ansicht'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = {
  title: `Seite nicht gefunden — ${MARKE}`,
  robots: { index: false, follow: false },
}

/**
 * Die 404 des ganzen Hauses — und damit auch das, was jemand ohne Admin-Rechte
 * unter /admin sieht (`verlangeAdminSeite` wirft bewusst notFound() statt 403,
 * damit der Bereich sich nicht verrät). Deshalb steht hier nichts, was einen
 * Bereich preisgibt, und auch kein Hof-Login: Das ist eine Kundenseite.
 *
 * Seit Nr. 54 in der KundeShell (Mockups fehler-404-seite-nicht-gefunden und
 * fehler-404-mobil). Die Sitzung für den Kopf liest der Browser
 * (KundeShellMitSitzung) — die 404 fragt den Server nichts. Am Handy steht
 * die Unterleiste der Shell darunter: Die 404 ist keine Fokus-Seite.
 */
export default function NotFound() {
  return (
    <KundeShellMitSitzung>
      <NichtGefundenAnsicht
        titel={NICHT_GEFUNDEN_TITEL}
        text={NICHT_GEFUNDEN_TEXT}
        haupt={{ href: '/', text: ZUR_STARTSEITE }}
        neben={{ href: '/hoefe', text: HOEFE_ENTDECKEN }}
        suchfeldId="nicht-gefunden-suche"
      />
    </KundeShellMitSitzung>
  )
}
