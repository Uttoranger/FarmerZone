import type { Metadata } from 'next'
import { HOEFE_ENTDECKEN, PRODUKT_NICHT_GEFUNDEN_TEXT, PRODUKT_NICHT_GEFUNDEN_TITEL } from '@/lib/fehlerseite'
import { NichtGefundenAnsicht } from '@/components/shared/nicht-gefunden-ansicht'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = {
  title: `Produkt nicht gefunden — ${MARKE}`,
  robots: { index: false, follow: false },
}

/**
 * Die 404 unter /[hof]/produkt/[id] (Nr. 11). Hier landen ein falscher Slug,
 * ein Hof, der nicht öffentlich ist, ein fremdes, ausgeblendetes oder
 * unbekanntes Produkt — die Seite unterscheidet sie nicht, und dieser Text
 * nennt deshalb keinen Grund.
 *
 * Seit Nr. 231 im selben Aufbau wie die 404 des Hauses und der Hofadresse
 * (Boards s3/w3-fehlerseiten Bild 3, statt der älteren EmptyState-Form): der
 * grüne Weg zurück zum Hof der Adresse („Zum Hof" — eine not-found-Datei
 * bekommt keine Parameter, den Slug liest die Ansicht im Browser), daneben
 * die Höfe; kein Suchfeld.
 */
export default function ProduktNichtGefunden() {
  return (
    <KundeShellMitSitzung>
      <NichtGefundenAnsicht
        titel={PRODUKT_NICHT_GEFUNDEN_TITEL}
        text={PRODUKT_NICHT_GEFUNDEN_TEXT}
        haupt="zum-hof"
        neben={{ href: '/hoefe', text: HOEFE_ENTDECKEN }}
      />
    </KundeShellMitSitzung>
  )
}
