import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText, Knopf, KnopfReihe } from './_layout'

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
    <EmailLayout previewText={`Bestätige deine E-Mail-Adresse – der Link gilt ${stunden} Stunden`}>
      <Text style={h1}>Bestätige deine E-Mail-Adresse</Text>
      <Text style={bodyText}>
        Hallo,
        <br />
        schön, dass du deinen Hof bei FarmerZone einrichtest. Bitte bestätige noch kurz, dass diese
        E-Mail-Adresse dir gehört. Öffne dazu den Link und tippe auf der Seite auf „E-Mail bestätigen“.
      </Text>

      <KnopfReihe>
        <Knopf href={url}>Zur Bestätigung</Knopf>
      </KnopfReihe>

      <Text style={{ ...mutedText, margin: '0 0 6px' }}>
        Bis dahin kannst du deinen Hof schon einrichten. Fotos hochladen und die Freischaltung gehen,
        sobald die Adresse bestätigt ist.
      </Text>
      <Text style={{ ...mutedText, margin: '0 0 6px' }}>
        Der Link gilt <strong>{stunden} Stunden</strong>. Danach kannst du dir nach dem Anmelden einen
        neuen schicken lassen.
      </Text>
      <Text style={mutedText}>
        Du hast dich nicht bei FarmerZone registriert? Dann kannst du diese E-Mail einfach ignorieren.
      </Text>
    </EmailLayout>
  )
}
