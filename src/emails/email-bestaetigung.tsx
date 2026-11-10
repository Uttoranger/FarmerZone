import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, h1, bodyText, leiseZeile, Knopf, KnopfReihe } from './_layout'
import { MARKE } from '@/lib/marke'

export interface EmailBestaetigungProps {
  /** Vollständige Adresse von /verify mit dem signierten Token (bestaetigungsPfad). */
  url: string
  /** Gültigkeit in Stunden — aus BESTAETIGUNG_GUELTIG_SEKUNDEN, nie eine zweite Zahl. */
  stunden: number
}

/**
 * „Bestätige deine E-Mail" für neue Höfe (S3, Nachtlauf Nr. 17b). Hell wie
 * alle Mails, ohne Emojis, Palette aus _layout.tsx.
 *
 * Der Link öffnet nur die Seite /verify — bestätigt wird dort per Knopf.
 * Link-Scanner der Mailprogramme rufen Links ungefragt auf; ein Link, der
 * beim Öffnen bestätigte, bestätigte auch jede fremd registrierte Adresse
 * (ARCHITECTURE §5). Deshalb sagt die Mail „klick auf den Knopf auf der
 * Seite" und nicht „mit dem Klick ist es erledigt".
 */
export function EmailBestaetigungEmail({ url, stunden }: EmailBestaetigungProps) {
  return (
    <EmailLayout fuss={{ art: 'plattform' }} previewText={`Der Link gilt ${stunden} Stunden.`}>
      <Text style={h1}>Bestätige deine E-Mail-Adresse</Text>
      <Text style={bodyText}>{`Hallo, schön, dass du deinen Hof bei ${MARKE} einrichtest. Bitte bestätige noch deine E-Mail-Adresse:`}</Text>
      {/* Der Knopf öffnet nur /verify; bestätigt wird dort per Knopf (Link-Scanner, siehe oben). */}
      <KnopfReihe>
        <Knopf href={url}>Zur Bestätigung</Knopf>
      </KnopfReihe>
      <Text style={leiseZeile}>{`Der Link gilt ${stunden} Stunden.`}</Text>
    </EmailLayout>
  )
}
