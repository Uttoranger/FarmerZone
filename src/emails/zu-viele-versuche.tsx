import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText } from './_layout'
import { ZU_VIELE_VERSUCHE_MAIL, type FehlversuchArt } from '@/lib/anmeldecode'

export interface ZuVieleVersucheProps {
  art: FehlversuchArt
  /** Ende der Pause, fertig für die Mail („Montag, 19. Oktober, 15:00 Uhr", zeitpunktFuerMail). */
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
    <EmailLayout previewText={text.titel}>
      <Text style={h1}>{text.titel}</Text>
      <Text style={bodyText}>
        Hallo,
        <br />
        {text.text(bis)}
      </Text>
      <Text style={mutedText}>{text.ausweg}</Text>
    </EmailLayout>
  )
}
