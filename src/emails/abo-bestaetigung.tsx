import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, h1, bodyText, leiseZeile, Knopf, KnopfReihe } from './_layout'

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
    <EmailLayout fuss={{ art: 'plattform' }} previewText={`Du möchtest Neuigkeiten von ${hofName} per E-Mail bekommen?`}>
      <Text style={h1}>Bitte bestätige deine Anmeldung</Text>
      {/* Board s3/w3-mail-neuigkeiten Bild 1 — aber ehrlich: Der Knopf öffnet nur die Seite, bestätigt wird dort (Link-Scanner). */}
      {/* Der Hofname fett wie im Board (B-Zeile mail-neuigkeiten Bild 1, Nr. 255). */}
      <Text style={bodyText}>
        {'Hallo, du möchtest Neuigkeiten von '}
        <strong>{hofName}</strong>
        {' per E-Mail bekommen? Tipp auf den Knopf und bestätige auf der Seite.'}
      </Text>

      <KnopfReihe>
        <Knopf href={url}>Anmeldung bestätigen</Knopf>
      </KnopfReihe>

      <Text style={leiseZeile}>{`Der Link gilt ${tage} Tage. Ohne Bestätigung schicken wir dir nichts.`}</Text>
    </EmailLayout>
  )
}
