import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, h1, bodyText, leiseZeile } from './_layout'
import { ZU_VIELE_VERSUCHE_MAIL, type FehlversuchArt } from '@/lib/anmeldecode'

export interface ZuVieleVersucheProps {
  art: FehlversuchArt
  /** Ende der Pause, fertig für die Mail („Mi, 3. März 2027, 09:15 Uhr“, V9 über formatZeitpunktMitWochentag, Nr. 280). */
  bis: string
}

/**
 * „Zu viele falsche Codes" bzw. „… Passwörter" (Register E7, Ergänzung;
 * Nr. 112). Geht einmal je Pause an das Konto hinter der Adresse, beim
 * Passwort höchstens einmal am Tag (src/server/bremse-datenbank.ts). Hell wie
 * alle Mails, ohne Emojis.
 *
 * Bewusst OHNE Code und OHNE Link: Die Mail sagt nur Bescheid. Ein Link zum
 * Anmelden darin wäre genau die Mail, die ein Angreifer nachbauen möchte —
 * wer etwas tun will, geht selbst auf die Seite („Passwort vergessen").
 */
export function ZuVieleVersucheEmail({ art, bis }: ZuVieleVersucheProps): React.JSX.Element {
  const text = ZU_VIELE_VERSUCHE_MAIL[art]
  return (
    <EmailLayout fuss={{ art: 'plattform' }} previewText={text.titel}>
      <Text style={h1}>{text.titel}</Text>
      {/* Board s3/w3-mail-sicherheit Bild 2 und 3: ohne Anrede, gleich der Satz (Nr. 280). */}
      <Text style={bodyText}>{text.text(bis)}</Text>
      <Text style={leiseZeile}>{text.ausweg}</Text>
    </EmailLayout>
  )
}
