import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText, Knopf, KnopfReihe } from './_layout'

export interface AboBestaetigungProps {
  /** Name des Hofes — Text des Hofs, React escaped ihn. */
  hofName: string
  /** Volle Adresse der Seite mit dem Knopf (aboBestaetigungsPfad). */
  url: string
  /** Gültigkeit in Tagen — aus ABO_BESTAETIGUNG_GUELTIG_TAGE, nie eine zweite Zahl. */
  tage: number
}

/**
 * „Bitte bestätige deine Anmeldung" (Double-Opt-in, Register S11, Nr. 38).
 * Keine Werbung darin: kein Produkt, kein Beitrag, kein Bild — nur die Bitte.
 *
 * Der Link öffnet nur die Seite — bestätigt wird dort per Knopf. Link-Scanner
 * der Mailprogramme rufen Links ungefragt auf (ARCHITECTURE §5).
 */
export function AboBestaetigungEmail({ hofName, url, tage }: AboBestaetigungProps) {
  return (
    <EmailLayout previewText={`Bitte bestätige deine Anmeldung für Neuigkeiten von ${hofName}`}>
      <Text style={h1}>Bitte bestätige deine Anmeldung</Text>
      <Text style={bodyText}>
        Hallo,
        <br />
        du möchtest Neuigkeiten von <strong>{hofName}</strong> per E-Mail bekommen. Öffne dazu den Link und
        tippe auf der Seite auf „Anmeldung bestätigen“. Erst dann schicken wir dir Neuigkeiten.
      </Text>

      <KnopfReihe>
        <Knopf href={url}>Anmeldung bestätigen</Knopf>
      </KnopfReihe>

      <Text style={{ ...mutedText, margin: '0 0 6px' }}>
        Der Link gilt <strong>{tage} Tage</strong>.
      </Text>
      <Text style={mutedText}>Wenn du dich nicht angemeldet hast, ignorier diese Mail. Dann bekommst du nichts von uns.</Text>
    </EmailLayout>
  )
}
